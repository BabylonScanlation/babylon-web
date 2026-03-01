/**
 * Convierte cualquier valor de fecha a un timestamp numérico (ms).
 * Optimizada para ser el estándar de comunicación entre servidor y cliente.
 */
export function parseToTimestamp(dateInput: any): number {
  if (!dateInput) return 0;

  if (typeof dateInput === 'number') {
    return dateInput < 10000000000 ? dateInput * 1000 : dateInput;
  }

  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? 0 : dateInput.getTime();
  }

  try {
    let s = String(dateInput).trim();
    if (!s || s === 'null' || s === 'undefined' || s === '[object Object]') return 0;

    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      return num < 10000000000 ? num * 1000 : num;
    }

    s = s.replace(' ', 'T');
    if (s.includes('T') && !s.includes('Z') && !s.includes('+')) s += 'Z';

    const t = new Date(s).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/**
 * Devuelve una etiqueta de tiempo relativo (ej. "hace 5 minutos").
 */
export function timeAgo(dateVal: any): string {
  const timestamp = parseToTimestamp(dateVal);
  if (timestamp <= 0) return 'justo ahora';

  const absDiff = Math.abs(Date.now() - timestamp);
  const seconds = Math.floor(absDiff / 1000);

  if (seconds < 10) return 'justo ahora';
  if (seconds < 60) return `hace ${seconds} segundos`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;

  return `hace ${Math.floor(days / 365)} años`;
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
