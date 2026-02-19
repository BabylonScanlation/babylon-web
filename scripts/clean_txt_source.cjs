/* eslint-disable no-irregular-whitespace */
const fs = require('fs');

const TXT_FILE = 'Títulos Proyectos.txt';

function cleanTitle(title, _chapterNum) {
  if (!title) return 'Sin título';

  // 1. Eliminar asteriscos y espacios extra al inicio
  title = title.replace(/^\s*\**\s*/, '');

  // 2. Eliminar contenido entre paréntesis
  title = title.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '');

  // 3. Eliminar caracteres chinos y puntuación china
  title = title.replace(/[一-龥　-〿＀-￯]/g, '');

  // 4. Quedarse solo con la primera parte si hay "/"
  title = title.split('/')[0];

  // 5. Eliminar separadores iniciales (guiones, puntos, etc.)
  title = title.replace(/^[—\-.:\s*?]+/, '').trim();

  // 6. Arreglar puntuación separada (ej: "Hola !" -> "Hola!")
  title = title.replace(/\s+([!?;:.,])/g, '$1');

  // 7. Eliminar punto final
  title = title.replace(/\.$/, '');

  // 8. Título por defecto si queda vacío o es solo "Capítulo X" redundante
  if (!title || /^Capítulo\s+\d+$/i.test(title)) return 'Sin título';

  return title.trim();
}

function main() {
  const rawText = fs.readFileSync(TXT_FILE, 'utf-8');
  const lines = rawText.split('\n');

  const outputLines = [];
  let currentSeriesLastChapter = 0;
  let processingSeries = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      outputLines.push('');
      continue;
    }

    const rangeMatch = line.match(/^(\*?\s*\**)?(\d+)\s*-\s*(\d+)/);
    const chapterMatch = line.match(/^(\*?\s*\**)?(\d+(\.\d+)?)\s*\**\s*(.*)/);

    if (rangeMatch) {
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[3]);

      if (processingSeries) {
        for (let i = currentSeriesLastChapter + 1; i < start; i++) {
          outputLines.push(`${i} Sin título`);
        }
      }

      for (let i = start; i <= end; i++) {
        outputLines.push(`${i} Sin título`);
      }
      currentSeriesLastChapter = end;
    } else if (chapterMatch) {
      const chapterNum = parseFloat(chapterMatch[2]);

      if (processingSeries && Number.isInteger(chapterNum)) {
        if (chapterNum > currentSeriesLastChapter + 1) {
          if (chapterNum - currentSeriesLastChapter < 100) {
            for (let i = currentSeriesLastChapter + 1; i < chapterNum; i++) {
              outputLines.push(`${i} Sin título`);
            }
          }
        }
      }

      const rawTitle = chapterMatch[4] || '';
      const finalTitle = cleanTitle(rawTitle, chapterNum);

      outputLines.push(`${chapterNum} ${finalTitle}`);

      if (chapterNum > currentSeriesLastChapter) {
        currentSeriesLastChapter = chapterNum;
      }
    } else {
      let seriesTitle = line.replace(/[一-龥]/g, '').trim();
      if (!seriesTitle) seriesTitle = line;

      outputLines.push(seriesTitle);
      currentSeriesLastChapter = 0;
      processingSeries = true;
    }
  }

  fs.writeFileSync(TXT_FILE, outputLines.join('\n'));
  console.log(`✅ Archivo '${TXT_FILE}' limpiado con reglas de puntuación y formato.`);
}

main();
