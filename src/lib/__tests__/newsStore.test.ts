import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newsStore } from '../newsStore.svelte';

describe('NewsStore (Svelte 5 Runes)', () => {
  beforeEach(() => {
    newsStore.setCount(0);
  });

  it('debe inicializarse en cero', () => {
    expect(newsStore.count).toBe(0);
  });

  it('debe actualizar el conteo manualmente', () => {
    newsStore.setCount(10);
    expect(newsStore.count).toBe(10);
  });

  it('debe manejar la carga exitosa del fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 5 }),
    });

    await newsStore.refreshCount(mockFetch as any);
    expect(newsStore.count).toBe(5);
    expect(newsStore.isLoading).toBe(false);
  });

  it('debe mantener el conteo anterior si el fetch falla', async () => {
    newsStore.setCount(3);
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await newsStore.refreshCount(mockFetch as any);
    expect(newsStore.count).toBe(3);
  });
});
