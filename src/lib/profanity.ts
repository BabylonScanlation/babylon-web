/**
 * Sistema de Censura Automática (Astra + Orion)
 * Este módulo se encarga de filtrar palabras prohibidas en comentarios y noticias.
 */

// Lista base de palabras prohibidas (Se puede mover a un archivo JSON o KV en el futuro)
const BAD_WORDS = [
  'mierda',
  'puta',
  'hijo de puta',
  'cabron',
  'cabrón',
  'maricon',
  'maricón',
  'zorra',
  'pendejo',
  'gilipollas',
  'estupido',
  'estúpido',
  'idiota',
  'subnormal',
  'perra',
  'malnacido',
  'hdp',
  'nazi',
  'violacion',
  'violación',
  'pedofilo',
  'pedófilo',
];

/**
 * Reemplaza palabras prohibidas en un texto con asteriscos.
 * @param text El texto a censurar
 * @returns El texto censurado
 */
export function censorText(text: string | undefined | null): string {
  if (!text) return '';

  let censoredText = text;

  for (const word of BAD_WORDS) {
    // Creamos una regex que ignore mayúsculas y sea global
    // Usamos límites de palabra (\b) para evitar censurar palabras que contengan la palabra prohibida
    // (ej. "escritorio" no debería censurarse si la palabra prohibida es "ito")
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censoredText = censoredText.replace(regex, (match) => '*'.repeat(match.length));
  }

  return censoredText;
}

/**
 * Verifica si un texto contiene palabras prohibidas.
 */
export function hasProfanity(text: string | undefined | null): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return regex.test(lowerText);
  });
}
