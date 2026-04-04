/**
 * Convierte cualquier valor de fecha a un timestamp numérico (ms).
 * Optimizada para ser el estándar de comunicación entre servidor y cliente.
 */
export function parseToTimestamp(dateInput: any): number {
  if (!dateInput) return 0;

  // 1. Manejo de Números (Detección Segundos vs Milisegundos)
  if (typeof dateInput === 'number') {
    // 5*10^9 es el año 2128 en segundos. Si es menor, asumimos segundos.
    // Las fechas actuales en ms son del orden de 1.7*10^12.
    return dateInput < 5000000000 ? dateInput * 1000 : dateInput;
  }

  // 2. Manejo de objetos Date
  if (dateInput instanceof Date) {
    const t = dateInput.getTime();
    return isNaN(t) ? 0 : t;
  }

  // 3. Manejo de Strings
  try {
    let s = String(dateInput).trim();
    if (!s || s === 'null' || s === 'undefined' || s === '[object Object]') return 0;

    // Si es un string numérico "1234567890"
    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      return num < 5000000000 ? num * 1000 : num;
    }

    // Normalizar formato para Date()
    // Reemplazar espacio por T si parece una fecha ISO sin T
    if (s.includes(' ') && s.includes('-')) s = s.replace(' ', 'T');

    let t = new Date(s).getTime();

    // Fallback para formatos raros o faltas de zona horaria
    if (isNaN(t)) {
      // Intentar añadir Z para forzar UTC si parece ISO
      const sWithZ = s.endsWith('Z') ? s : `${s}Z`;
      const t2 = new Date(sWithZ).getTime();
      if (!isNaN(t2)) t = t2;
    }

    return isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/**
 * Devuelve una etiqueta de tiempo relativo (ej. "hace 5 minutos").
 */
export function timeAgo(dateVal: any): string {
  const timestamp = parseToTimestamp(dateVal);

  // Si no hay fecha o es absurdamente antigua (era Unix), es "justo ahora"
  if (timestamp <= 0 || timestamp < 1000000000) return 'justo ahora';

  const now = Date.now();
  const diff = now - timestamp;
  const absDiff = Math.abs(diff);

  // 1. Manejo de futuro y desfases leves (hasta 2 minutos)
  if (diff < 0 && absDiff < 120000) return 'justo ahora';

  // 2. Si la diferencia es de segundos
  const seconds = Math.floor(absDiff / 1000);
  if (seconds < 60) return 'justo ahora';

  // 3. Minutos
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  // 4. Horas
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;

  // 5. Días
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;

  // 6. Meses
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;

  // 7. Años
  const years = Math.floor(days / 365);
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

export const formatFullDate = (dateString: string | number | Date | null | undefined) => {
  const ts = parseToTimestamp(dateString);
  if (ts <= 0) return 'N/A';

  return new Date(ts).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const generateRandomUsername = () => {
  const adjectives = [
    'Happy',
    'Swift',
    'Brave',
    'Calm',
    'Wild',
    'Silent',
    'Cosmic',
    'Lucky',
    'Crazy',
    'Epic',
  ];
  const animals = [
    'Panda',
    'Tiger',
    'Eagle',
    'Wolf',
    'Fox',
    'Bear',
    'Lion',
    'Hawk',
    'Dragon',
    'Phoenix',
  ];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${Math.floor(Math.random() * 1000)}`;
};

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getImageUrl(
  path: string | null | undefined,
  r2PublicUrl: string = '',
  fallbackType: 'series' | 'chapter' | 'user' = 'series'
): string {
  if (!path) {
    const placeholders = {
      series: '/assets/placeholder-series.jpg',
      chapter: '/assets/placeholder-chapter.jpg',
      user: '/assets/placeholder-user.jpg',
    };
    return placeholders[fallbackType];
  }
  if (path.startsWith('http') || path.startsWith('/')) return path;
  const base = r2PublicUrl || '/api/assets/proxy';
  return `${base}/${path}`.replace(/([^:]\/)\/+/g, '$1');
}
