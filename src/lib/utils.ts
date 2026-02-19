export function timeAgo(dateString: string | number | Date): string {
  if (!dateString) return '';

  let date: Date;

  if (typeof dateString === 'string') {
    // Si la cadena no termina en Z y no tiene T, es probable que sea de SQLite (UTC)
    // Ejemplo: "2026-01-20 10:00:00" -> "2026-01-20T10:00:00Z"
    let normalized = dateString;
    if (!normalized.includes('T') && !normalized.endsWith('Z')) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    date = new Date(normalized);
  } else {
    date = new Date(dateString);
  }

  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return 'justo ahora';
  if (seconds < 60) return `hace ${seconds} segundos`;

  let interval = seconds / 31536000;
  if (interval > 1) return `hace ${Math.floor(interval)} años`;
  interval = seconds / 2592000;
  if (interval > 1) return `hace ${Math.floor(interval)} meses`;
  interval = seconds / 86400;
  if (interval > 1) return `hace ${Math.floor(interval)} días`;
  interval = seconds / 3600;
  if (interval > 1) return `hace ${Math.floor(interval)} horas`;
  interval = seconds / 60;
  if (interval > 1) return `hace ${Math.floor(interval)} minutos`;
  return 'hace un momento';
}

export const formatFullDate = (dateString: string) => {
  if (!dateString) return 'N/A';

  let date = new Date(dateString);

  if (isNaN(date.getTime())) {
    const compatibleDateString = dateString.replace(' ', 'T') + 'Z';
    date = new Date(compatibleDateString);
  }

  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
    'Dark',
    'Light',
    'Magic',
    'Hyper',
    'Neo',
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
    'Cat',
    'Dog',
    'Shark',
    'Raven',
    'Viper',
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${animal}${num}`;
};

/**
 * Genera un UUID v4 de forma segura incluso en contextos no seguros (HTTP).
 * Prioriza crypto.randomUUID() si está disponible.
 */
export function generateUUID(): string {
  // 1. Prioridad Máxima: API nativa moderna (Producción y HTTPS)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // 2. Segunda Opción: Criptografía de hardware pero sin función de conveniencia
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) => {
      const array = new Uint8Array(1);
      crypto.getRandomValues(array);
      const randomValue = array[0] as number;
      return (c ^ (randomValue & (15 >> (c / 4)))).toString(16);
    });
  }

  // 3. Último Recurso: Fallback matemático (Solo para desarrollo local vía IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normaliza la URL de una imagen para usar R2 o el proxy local.
 * Astra + Orion: Garantiza que no haya barras duplicadas y maneja placeholders.
 */
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

  // Si ya es una URL absoluta, la devolvemos tal cual
  if (path.startsWith('http')) return path;

  // Si empieza por /, asumimos que es una ruta relativa al servidor
  if (path.startsWith('/')) return path;

  // Si no, concatenamos con el R2 public URL
  const base = r2PublicUrl || '/api/assets/proxy';

  // Limpiamos barras duplicadas (excepto después de ://)
  return `${base}/${path}`.replace(/([^:]\/)\/+/g, '$1');
}
