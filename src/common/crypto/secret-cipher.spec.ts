import { decryptSecret, deriveEncryptionKey, encryptSecret, maskSecret } from './secret-cipher';

const key = deriveEncryptionKey('a-development-encryption-secret-value');

describe('secret cipher', () => {
  it('round-trips a secret', () => {
    const secret = 'sk-test-0123456789abcdef';

    expect(decryptSecret(encryptSecret(secret, key), key)).toBe(secret);
  });

  it('produces a different ciphertext every time', () => {
    const first = encryptSecret('same value', key);
    const second = encryptSecret('same value', key);

    expect(first.cipher).not.toBe(second.cipher);
    expect(first.iv).not.toBe(second.iv);
  });

  it('refuses to decrypt with the wrong key', () => {
    const encrypted = encryptSecret('sk-test-0123456789abcdef', key);

    expect(() => decryptSecret(encrypted, deriveEncryptionKey('another secret'))).toThrow();
  });

  it('refuses to decrypt tampered ciphertext', () => {
    const encrypted = encryptSecret('sk-test-0123456789abcdef', key);
    const tampered = { ...encrypted, cipher: Buffer.from('tampered').toString('base64') };

    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});

describe('maskSecret', () => {
  it('keeps only the ends visible', () => {
    expect(maskSecret('sk-proj-0123456789abcdef')).toBe('sk-...cdef');
  });

  it('hides short values entirely', () => {
    expect(maskSecret('short')).toBe('***');
  });
});
