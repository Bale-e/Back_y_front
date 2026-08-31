// ── Caché simple en memoria con expiración ────────────────────
// Reduce lecturas repetidas a Firestore mientras el dato siga "fresco".

const store = new Map(); // key -> { value, expiresAt }

const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000; // 5 minutos por defecto

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function invalidate(key) {
  store.delete(key);
}

function invalidateAll() {
  store.clear();
}

// ── Envuelve una función async: si hay valor en caché lo devuelve,
// si no, ejecuta la función, guarda el resultado y lo devuelve ────
async function withCache(key, fn, ttlMs = DEFAULT_TTL_MS) {
  const cached = get(key);
  if (cached !== undefined) return cached;
  const value = await fn();
  set(key, value, ttlMs);
  return value;
}

module.exports = { get, set, invalidate, invalidateAll, withCache };
