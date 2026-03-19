/** Generates a UUID v4 string using the Web Crypto API. */
export function generateId(): string {
  return crypto.randomUUID();
}
