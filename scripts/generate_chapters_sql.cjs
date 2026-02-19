/* eslint-disable no-irregular-whitespace */
const fs = require('fs');

const TXT_FILE = 'Títulos Proyectos.txt';
const OUTPUT_SQL = 'scripts/bulk_update_chapters.sql';

const seriesMapping = {
  'Caos en el Inframundo': 18,
  'Criador espiritual de grado divino': 19,
  'El Apocalipsis es un Juego para Mí': 20,
  'El apocalipsis es un juego para mi': 20,
  'El horno exclusivo para las futuras emperatrices': 21,
  'El templo del Rey Dragón': 22,
  'El Templo del Rey Dragón': 22,
  'Frenesí de invocación post-apocalíptica': 23,
  'La Era del Gran Diluvio': 24,
  'Llevo mil años atrapado en el mismo día': 25,
  'Llevo 1000 años atrapado en el mismo día': 25,
  'Me Llevo El Oro Del Mundo Post-apocalíptico': 26,
  'Mi Esposa es de Hace Mil Años': 27,
  'Mi evolución a demonio': 28,
  'Sistema de combate invencible': 29,
  'Solo Leveling: Ragnarok': 31,
  '나 혼자만 레벨업 : 라그나로크': 31,
  'Soy el maestro de la jungla': 33,
  'Sr. Jiang Si': 36,
  'Super Shared Boyfriend System': 37,
  '¿Quién crio mal a mi discípulo y lo convirtió en un villano?': 38,
  'El pequeño esposo también quiere contraatacar hoy': 39,
  'El Pequeño esposo también quiere contraatacar hoy': 39,
  'Eres bonita': 40,
  'Eres Bonita': 40,
  'La dulce venganza de la noble esposa renacida': 41,
  'La Dulce Venganza de la Noble Esposa Renacida': 41,
  'La heroína se oscurece más cada día después de renacer': 42,
  'La heroína se Oscurece más cada Día después de Renacer': 42,
  'La princesa mimada de la corte quiere casarse con el eunuco': 43,
  'La Princesa Mimada de la Corte quiere Casarse con el Eunuco': 43,
  'Soy una groupie en la antigüedad': 44,
  'Soy una Groupie en la Antigüedad': 44,
};

function cleanTitle(title, chapterNum) {
  if (!title) return `Capítulo ${chapterNum}`;
  title = title.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '');
  title = title.replace(/[一-龥　-〿＀-￯]/g, '');
  title = title.split('/')[0];
  title = title.replace(/^[—\-.:\s*?]+/g, '').trim();
  if (!title) return `Capítulo ${chapterNum}`;
  return title;
}

function generateInsert(seriesId, chapterNum, title) {
  const safeTitle = title.replace(/'/g, "''");
  const placeholderFileId = `placeholder_id_${seriesId}_${chapterNum}`;
  return `INSERT INTO Chapters (series_id, chapter_number, title, telegram_file_id, status, views, created_at) VALUES (${seriesId}, ${chapterNum}, '${safeTitle}', '${placeholderFileId}', 'completed', 0, CURRENT_TIMESTAMP);`;
}

function main() {
  if (!fs.existsSync(TXT_FILE)) {
    console.error(`Error: No existe el archivo ${TXT_FILE}`);
    return;
  }

  const rawText = fs.readFileSync(TXT_FILE, 'utf-8');
  const lines = rawText.split('\n');

  let sqlContent = '';
  let currentSeriesId = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const chapterMatch = line.match(/^(\d+(\.\d+)?)\s+(.*)/);

    if (chapterMatch) {
      if (currentSeriesId) {
        const chapterNum = parseFloat(chapterMatch[1]);
        const title = cleanTitle(chapterMatch[3], chapterNum);
        sqlContent += generateInsert(currentSeriesId, chapterNum, title) + '\n';
      }
    } else {
      const seriesTitle = line.replace(/[一-龥]/g, '').trim();
      currentSeriesId = seriesMapping[seriesTitle] || null;
      if (!currentSeriesId) {
        // Intento fallback si el título tiene caracteres coreanos o similares
        currentSeriesId = seriesMapping[line] || null;
      }
    }
  }

  fs.writeFileSync(OUTPUT_SQL, sqlContent);
  console.log(`✅ SQL regenerado para Cloudflare D1.`);
}

main();
