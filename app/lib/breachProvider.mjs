/** Server-side provider adapter. Do not call with an unverified user-supplied email. */
export class BreachProviderError extends Error {
  constructor(code, retryAfterSeconds = null) {
    super(code);
    this.name = 'BreachProviderError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function normalizeEmail(input) {
  if (typeof input !== 'string') throw new BreachProviderError('INVALID_EMAIL');
  const email = input.trim();
  if (email.length > 254 || !/^[^\s@/\\?#]+@[^\s@/\\?#]+\.[^\s@/\\?#]+$/.test(email)) {
    throw new BreachProviderError('INVALID_EMAIL');
  }
  const at = email.lastIndexOf('@');
  return email.slice(0, at) + '@' + email.slice(at + 1).toLowerCase();
}

/** Identity must be supplied by the trusted verification backend, never request JSON. */
export async function checkVerifiedEmail(identity, options = {}) {
  const now = options.now ?? Date.now();
  if (!identity || identity.verified !== true || !Number.isFinite(identity.expiresAt) || identity.expiresAt <= now) {
    throw new BreachProviderError('VERIFICATION_REQUIRED');
  }
  const email = normalizeEmail(identity.email);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(
      `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
      { signal: controller.signal, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'));
      throw new BreachProviderError('RATE_LIMITED', Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : null);
    }
    if (response.status !== 404 && !response.ok) throw new BreachProviderError('PROVIDER_UNAVAILABLE');
    let payload;
    try { payload = await response.json(); }
    catch { throw new BreachProviderError('INVALID_RESPONSE'); }
    // Require the documented body too: an infrastructure 404 is not a clean result.
    if (payload?.Error === 'Not found' && (response.ok || response.status === 404)) {
      return { provider: 'xposedornot', status: 'not_found', breaches: [], checkedAt: new Date(now).toISOString(), coverage: 'partial' };
    }
    if (!response.ok || !Array.isArray(payload?.breaches) || !payload.breaches.every(group => Array.isArray(group) && group.every(name => typeof name === 'string' && name.trim().length > 0 && name.length <= 300))) {
      throw new BreachProviderError('INVALID_RESPONSE');
    }
    const names = [...new Set(payload.breaches.flat().map(name => name.trim()))];
    if (!names.length) throw new BreachProviderError('INVALID_RESPONSE');
    return {
      provider: 'xposedornot', status: 'found',
      breaches: names.map(name => ({ name })),
      checkedAt: new Date(now).toISOString(), coverage: 'partial',
    };
  } catch (error) {
    if (error instanceof BreachProviderError) throw error;
    throw new BreachProviderError(controller.signal.aborted ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE');
  } finally { clearTimeout(timer); }
}
