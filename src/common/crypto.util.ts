import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Enkripsi simetris AES-256-GCM untuk biodata sensitif (alamat, telepon, kota, dst).
 *
 * Format output: `v1:<iv base64>:<authTag base64>:<ciphertext base64>`
 *  - `v1` = versi skema, untuk memudahkan rotasi kunci nanti.
 *  - GCM memberi autentikasi (authTag) sehingga data yang diubah akan gagal dibuka.
 *
 * Kunci diambil dari env AES_KEY. Apa pun bentuknya (hex/base64/passphrase),
 * diturunkan jadi 32 byte via SHA-256 supaya selalu valid untuk aes-256-gcm.
 */
const PREFIX = 'v1';

function getKey(): Buffer {
  const raw = process.env.AES_KEY;
  if (!raw) {
    throw new Error('AES_KEY belum di-set. Isi file .env di folder backend.');
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptField(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Format data terenkripsi tidak dikenali');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

/** true bila string tampak sebagai payload hasil enkripsi kita. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/** Enkripsi nilai bila belum terenkripsi; nilai kosong/null dibiarkan apa adanya. */
export function encryptIfNeeded(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  return isEncrypted(value) ? value : encryptField(value);
}

/** Dekripsi nilai bila terenkripsi; kalau bukan, kembalikan apa adanya (data lama). */
export function decryptIfNeeded(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decryptField(value);
  } catch {
    return null;
  }
}
