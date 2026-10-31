// Small crypto helpers for the browser-only data store.
// Passwords are salted + hashed so they are never kept in plain text in
// localStorage. This is NOT a substitute for server-side security: anyone with
// access to the browser profile can read or edit the stored data.

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toHex(bytes);
}

// 24-hex-char id, same format as a MongoDB ObjectId (timestamp + random)
export function newId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  return timestamp + randomHex(8);
}

// FNV-1a fallback for insecure contexts (e.g. plain-HTTP LAN address) where
// crypto.subtle is unavailable.
function fnv1a(input) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return "sha256:" + toHex(new Uint8Array(digest));
  }
  return "fnv:" + fnv1a(input);
}

export async function verifyPassword(password, salt, storedHash) {
  return (await hashPassword(password, salt)) === storedHash;
}
