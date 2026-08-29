import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { donations, subscriptions, users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const authUserStr = request.headers.get('x-user-state');
    if (!authUserStr)
      return new Response(JSON.stringify({ error: 'Debes iniciar sesión.' }), { status: 401 });

    let authUser: { id: string; email?: string } | null = null;
    try {
      authUser = JSON.parse(authUserStr);
    } catch {
      return new Response(JSON.stringify({ error: 'Sesión inválida.' }), { status: 401 });
    }
    if (!authUser?.id)
      return new Response(JSON.stringify({ error: 'Usuario no válido.' }), { status: 401 });

    const payload = await request.json();
    const { type, currency, txHash, amount, tier } = payload;
    if (!txHash || !currency || !amount)
      return new Response(JSON.stringify({ error: 'Faltan datos obligatorios.' }), { status: 400 });

    const env = locals.runtime.env;
    const db = getDB(env);
    const userId = authUser.id;

    if (currency === 'XMR') {
      await db.insert(donations).values({
        id: uuidv4(),
        userId: userId,
        amount: amount,
        currency: currency,
        gateway: 'crypto',
        txHash: txHash.trim(),
        status: 'completed',
      });
      return new Response(
        JSON.stringify({ success: true, message: '¡Gracias por tu donación en Monero!' }),
        { status: 200 }
      );
    }

    let isVerified = false;
    let apiErrorMsg = 'Transacción no encontrada en la blockchain o monto insuficiente.';

    try {
      let btcPrice = 0,
        ethPrice = 0;
      if (currency !== 'USDT') {
        const cgRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
        );
        if (cgRes.ok) {
          const prices = (await cgRes.json()) as Record<string, { usd?: number }>;
          btcPrice = prices?.bitcoin?.usd || 0;
          ethPrice = prices?.ethereum?.usd || 0;
        }
      }

      const requiredUsd = amount * 0.95;

      if (currency === 'BTC' && btcPrice > 0) {
        const res = await fetch(`https://mempool.space/api/tx/${txHash}`);
        if (res.ok) {
          const txData = (await res.json()) as {
            vout: { scriptpubkey_address: string; value: number }[];
          };
          const vout = txData.vout.find((v) => v.scriptpubkey_address === env.PUBLIC_BTC_WALLET);
          if (vout) {
            const usdSent = (vout.value / 100000000) * btcPrice;
            if (usdSent >= requiredUsd) isVerified = true;
          }
        } else {
          apiErrorMsg = 'La red de Bitcoin está saturada o la transacción aún no se confirma.';
        }
      } else if (currency === 'ETH' && ethPrice > 0) {
        const res = await fetch('https://cloudflare-eth.com', {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionByHash',
            params: [txHash],
            id: 1,
          }),
        });
        if (res.ok) {
          const txData = (await res.json()) as { result?: { to?: string; value: string } };
          if (txData.result?.to?.toLowerCase() === env.PUBLIC_ETH_WALLET?.toLowerCase()) {
            const ethSent = parseInt(txData.result?.value || '0', 16) / 1e18;
            const usdSent = ethSent * ethPrice;
            if (usdSent >= requiredUsd) isVerified = true;
          }
        }
      } else if (currency === 'USDT') {
        const res = await fetch(
          `https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`
        );
        if (res.ok) {
          const txData = (await res.json()) as {
            trc20TransferInfo?: {
              to_address: string;
              symbol: string;
              amount_str: string;
              decimals: number;
            }[];
          };
          if (txData.trc20TransferInfo) {
            const transfer = txData.trc20TransferInfo.find(
              (t) => t.to_address === env.PUBLIC_USDT_TRC20_WALLET && t.symbol === 'USDT'
            );
            if (transfer) {
              const usdtSent = parseFloat(transfer.amount_str) / 10 ** transfer.decimals;
              if (usdtSent >= requiredUsd) isVerified = true;
            }
          }
        }
      }
    } catch (e) {
      console.log('Error API Cripto:', e);
      apiErrorMsg = 'Error temporal al conectar con la blockchain. Intenta de nuevo.';
    }

    if (!isVerified) {
      return new Response(
        JSON.stringify({
          error: `${apiErrorMsg} Si acabas de transferir, por favor espera 1 minuto y vuelve a presionar el botón de Verificar Pago.`,
        }),
        { status: 400 }
      );
    }

    if (type === 'subscription') {
      await db.insert(subscriptions).values({
        id: uuidv4(),
        userId: userId,
        tier: tier || 1,
        status: 'completed',
        gateway: 'crypto',
        txHash: txHash.trim(),
      });
      await db.update(users).set({ vipTier: tier }).where(eq(users.id, userId));
    } else {
      await db.insert(donations).values({
        id: uuidv4(),
        userId: userId,
        amount: amount,
        currency: currency,
        gateway: 'crypto',
        txHash: txHash.trim(),
        status: 'completed',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          '¡Pago verificado instantáneamente en la blockchain! Tu membresía VIP ya está activa.',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error procesando pago cripto:', error);
    return new Response(JSON.stringify({ error: 'Ocurrió un error en el servidor.' }), {
      status: 500,
    });
  }
};
