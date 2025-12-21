/**
 * Formatea una fecha a un formato relativo (ej. "hace 2 horas").
 */
export function timeAgo(dateString: string): string {
  if (!dateString) return '';

  let date = new Date(dateString);

  // Si la fecha es inválida (NaN), intentamos aplicar el parche para formato SQLite antiguo
  if (isNaN(date.getTime())) {
    const compatibleDateString = dateString.replace(' ', 'T') + 'Z';
    date = new Date(compatibleDateString);
  }

  // Si sigue siendo inválida después del parche, nos rendimos
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle cases where the date is slightly in the future (e.g., due to clock skew)
  if (seconds < 0) {
    return 'justo ahora';
  }

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
  return `hace ${Math.floor(seconds)} segundos`;
}

/**
 * Formatea una cadena de fecha a un formato localizado completo.
 */
export const formatFullDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  
  let date = new Date(dateString);

  // Parche para fechas SQLite antiguas
  if (isNaN(date.getTime())) {
    const compatibleDateString = dateString.replace(' ', 'T') + 'Z';
    date = new Date(compatibleDateString);
  }

  // Si sigue siendo inválida
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
