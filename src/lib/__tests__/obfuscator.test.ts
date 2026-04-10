import { describe, expect, it } from 'vitest';
import { deobfuscate, obfuscate } from '../obfuscator';

describe('Obfuscator (XOR Transform)', () => {
  const salt = 'test-salt-secret-key-123';
  const data = {
    images: ['img1.jpg', 'img2.jpg'],
    metadata: { chapter: 1, series: 'test' },
  };

  it('should obfuscate and deobfuscate correctly', () => {
    const encrypted = obfuscate(data, salt);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(JSON.stringify(data));

    const decrypted = deobfuscate(encrypted, salt);
    expect(decrypted).toEqual(data);
  });

  it('should fail with wrong salt', () => {
    const encrypted = obfuscate(data, salt);
    const decrypted = deobfuscate(encrypted, 'wrong-salt');

    // El XOR con sal errónea producirá basura que no será JSON válido
    expect(decrypted).toBeNull();
  });

  it('should handle empty or null input', () => {
    expect(deobfuscate('', salt)).toBeNull();
    expect(deobfuscate(null as any, salt)).toBeNull();
  });
});
