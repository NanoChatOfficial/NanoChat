// Helper to copy Uint8Array to a regular ArrayBuffer
function toRegularArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return Uint8Array.from(arr).buffer;
}
// Browser-compatible AES-GCM crypto utilities using Web Crypto API
const keyLength = 32; // 256 bits
const ivLength = 12; // Recommended IV size for GCM

export function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateKey(): Uint8Array {
  const key = window.crypto.getRandomValues(new Uint8Array(keyLength));
  return key;
}

export function generateKeyString(): string {
  const key = window.crypto.getRandomValues(new Uint8Array(keyLength));
  return uint8ArrayToHex(key);
}

export function generateIv(): string {
  return uint8ArrayToHex(
    window.crypto.getRandomValues(new Uint8Array(ivLength))
  );
}

export function generateRoomID(): string {
  return uint8ArrayToHex(window.crypto.getRandomValues(new Uint8Array(8)));
}

export async function encrypt(
  plaintext: string,
  key: Uint8Array,
  iv: Uint8Array
): Promise<{ encrypted: string; iv: string }> {
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    toRegularArrayBuffer(key),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const encoded = new TextEncoder().encode(plaintext);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toRegularArrayBuffer(iv) },
    cryptoKey,
    encoded
  );
  return {
    encrypted: uint8ArrayToHex(new Uint8Array(encryptedBuffer)),
    iv: uint8ArrayToHex(iv),
  };
}

export async function decrypt(
  encrypted: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    toRegularArrayBuffer(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toRegularArrayBuffer(iv) },
    cryptoKey,
    toRegularArrayBuffer(encrypted)
  );
  return new TextDecoder().decode(decryptedBuffer);
}
