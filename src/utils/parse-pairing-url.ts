// ── Pairing URL Parser ──────────────────────────────────────────────
// Extracts server URL and pairing token from the URL encoded in the
// QR code shown by `t3 serve`.
//
// Expected format:  http://host:port/pair#token=<TOKEN>
//   or:             http://host:port/pair?token=<TOKEN>

export function parsePairingUrl(
  raw: string,
): { serverUrl: string; token: string } | null {
  try {
    const url = new URL(raw);

    // Token can live in the hash fragment (#token=…) or query string (?token=…)
    const fromHash = new URLSearchParams(url.hash.slice(1)).get('token');
    const fromQuery = url.searchParams.get('token');
    const token = fromHash || fromQuery;

    if (!token) return null;

    const serverUrl = url.origin;
    return { serverUrl, token };
  } catch {
    return null;
  }
}
