import { describe, expect, it } from 'vitest';
import { timeAgo } from '../utils';

describe('utils: timeAgo', () => {
  it('debe retornar "justo ahora" para fechas muy recientes', () => {
    const now = new Date();
    expect(timeAgo(now)).toBe('justo ahora');
  });

  it('debe retornar "hace X segundos" para menos de un minuto', () => {
    const fortySecondsAgo = new Date(Date.now() - 40000);
    expect(timeAgo(fortySecondsAgo)).toBe('hace 40 segundos');
  });

  it('debe manejar strings de SQLite (UTC sin T/Z)', () => {
    const sqliteDate = '2020-01-01 10:00:00';
    // No comparamos el texto exacto porque depende de la fecha actual de ejecución,
    // pero verificamos que no retorne cadena vacía (error de parsing)
    expect(timeAgo(sqliteDate)).not.toBe('');
    expect(timeAgo(sqliteDate)).toContain('hace');
  });

  it('debe retornar cadena vacía para fechas inválidas', () => {
    expect(timeAgo('fecha-inventada')).toBe('');
    expect(timeAgo('')).toBe('');
  });
});
