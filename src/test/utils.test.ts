import { describe, expect, it } from 'vitest';
import { parseToTimestamp, timeAgo } from '../lib/utils';

describe('Utilidades de Fecha', () => {
  it('debería parsear correctamente el formato de SQLite con espacio', () => {
    const sqliteDate = '2026-02-19 06:00:00'; // Formato común en D1
    const ts = parseToTimestamp(sqliteDate);

    // Si parsea bien, el TS no puede ser 0
    expect(ts).toBeGreaterThan(0);

    // Verificamos que sea un objeto Date válido internamente
    const date = new Date(ts);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(1); // Febrero es 1
    expect(date.getUTCDate()).toBe(19);
  });

  it('debería manejar strings numéricos de milisegundos', () => {
    const tsStr = '1772255704000';
    expect(parseToTimestamp(tsStr)).toBe(1772255704000);
  });

  it('debería mostrar "hace un momento" para fechas muy cercanas', () => {
    const now = Date.now();
    // 5 segundos en el pasado
    expect(timeAgo(now - 5000)).toBe('hace un momento');
  });

  it('debería manejar errores de parseo devolviendo "hace un momento" o 0', () => {
    expect(parseToTimestamp('fecha-invalida')).toBe(0);
    expect(timeAgo('fecha-invalida')).toBe('hace un momento');
  });
});
