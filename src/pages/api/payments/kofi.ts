import type { APIRoute } from 'astro';
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { donations, subscriptions, users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Leer el cuerpo de la petición (Ko-fi envía Content-Type: application/x-www-form-urlencoded)
    const formData = await request.formData();
    const dataString = formData.get('data')?.toString();

    if (!dataString) {
      return new Response('No data', { status: 400 });
    }

    // 2. Parsear el JSON
    const payload = JSON.parse(dataString);

    // 3. Verificar el Token de Seguridad
    const env = locals.runtime.env;
    const KOFI_TOKEN = env.KOFI_VERIFICATION_TOKEN;

    if (KOFI_TOKEN && payload.verification_token !== KOFI_TOKEN) {
      console.warn('Ko-fi webhook falló la verificación de token');
      return new Response('Unauthorized', { status: 401 });
    }

    const {
      type, // 'Donation', 'Subscription'
      email,
      from_name,
      amount,
      currency,
      message,
      kofi_transaction_id,
      is_subscription_payment,
    } = payload;

    const db = getDB(env);

    // 4. Buscar al usuario en la base de datos (por email de Ko-fi, o si puso su nombre de usuario en el mensaje)
    const userQuery = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, email || ''),
          eq(users.username, message?.trim() || ''),
          eq(users.username, from_name?.trim() || '')
        )
      )
      .limit(1);

    const user = userQuery[0];
    const userId = user ? user.id : null;

    if (!user) {
      console.warn(`[Ko-fi] Pago recibido pero no se encontró un usuario para el email: ${email}`);
      // Aún así guardamos la donación para que el admin pueda asignarla manualmente después
    }

    const amountNum = parseFloat(amount);
    const now = new Date();

    // 5. Procesar el pago dependiendo si es suscripción o única
    if (type === 'Subscription' || is_subscription_payment) {
      // Determinar el tier basado en el monto mensual pagado
      let tier = 1;
      if (amountNum >= 5.0) tier = 5;
      else if (amountNum >= 3.5) tier = 4;
      else if (amountNum >= 1.5) tier = 3;
      else if (amountNum >= 0.5) tier = 2;
      else tier = 1;

      // 30 días de suscripción
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.insert(subscriptions).values({
        id: uuidv4(),
        userId: userId || 'PENDING_LINK', // En una app real, si userId es null, queda huérfano
        tier,
        status: 'active',
        gateway: 'kofi',
        txHash: kofi_transaction_id,
        expiresAt: expiresAt,
      });

      // Actualizar al usuario si existe
      if (user) {
        await db
          .update(users)
          .set({ vipTier: tier, vipExpiresAt: expiresAt })
          .where(eq(users.id, user.id));
      }
    } else {
      // Donación Única
      await db.insert(donations).values({
        id: uuidv4(),
        userId: userId, // Puede ser null si es anónimo
        amount: amountNum,
        currency: currency || 'USD',
        gateway: 'kofi',
        txHash: kofi_transaction_id,
        status: 'completed',
      });

      // Regla de negocio: Si dona más de X, darle VIP por 1 mes
      if (user && amountNum >= 1.5) {
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(users)
          .set({ vipTier: 3, vipExpiresAt: expiresAt }) // Le damos un VIP 3 simbólico
          .where(eq(users.id, user.id));
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error procesando webhook de Ko-fi:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
