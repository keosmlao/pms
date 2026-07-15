import { pbkdf2Sync, scryptSync, timingSafeEqual } from "node:crypto";

function safeEqualBuf(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function safeEqualStr(a: string, b: string): boolean {
  return safeEqualBuf(Buffer.from(a), Buffer.from(b));
}

// Params seen in the "scrypt$salt$hash" (base64) rows of odg_employee.
// keylen and salt are derived per-row; N/r/p are not encoded, so the known
// working combination is used.
const SCRYPT_DOLLAR = { N: 16384, r: 8, p: 1 };

/**
 * Verifies a password against the value stored in odg_employee.password.
 *
 * Rows come in several shapes:
 *   - Werkzeug hashes:  "scrypt:N:r:p$salt$hex", "pbkdf2:sha256:iter$salt$hex"
 *   - Base64 scrypt:    "scrypt$<b64 salt>$<b64 hash>"
 *   - Plaintext:        the password as-is
 * All forms must be accepted.
 */
export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored || !plain) return false;

  const parts = stored.split("$");
  if (parts.length === 3) {
    const [method, salt, expected] = parts;

    // Base64 scrypt: "scrypt$<b64 salt>$<b64 hash>"
    if (method === "scrypt") {
      const saltBuf = Buffer.from(salt, "base64");
      const expectedBuf = Buffer.from(expected, "base64");
      const { N, r, p } = SCRYPT_DOLLAR;
      const derived = scryptSync(plain, saltBuf, expectedBuf.length, {
        N,
        r,
        p,
        maxmem: 132 * N * r,
      });
      return safeEqualBuf(derived, expectedBuf);
    }

    const args = method.split(":");

    // Werkzeug scrypt: "scrypt:N:r:p$salt$hex"
    if (args[0] === "scrypt" && args.length === 4) {
      const [, N, r, p] = args.map(Number);
      const derived = scryptSync(plain, salt, expected.length / 2, {
        N,
        r,
        p,
        maxmem: 132 * N * r,
      });
      return safeEqualStr(derived.toString("hex"), expected);
    }

    // Werkzeug pbkdf2: "pbkdf2:sha256:iter$salt$hex"
    if (args[0] === "pbkdf2" && args.length === 3) {
      const digest = args[1];
      const iterations = Number(args[2]);
      const derived = pbkdf2Sync(plain, salt, iterations, expected.length / 2, digest);
      return safeEqualStr(derived.toString("hex"), expected);
    }

    return false;
  }

  return safeEqualStr(plain, stored);
}
