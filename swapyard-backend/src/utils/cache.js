// src/utils/cache.js
const cache = {};

function set(key, value, ttlSeconds = 60) {
  cache[key] = { value, expire: Date.now() + ttlSeconds * 1000 };
}

function get(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expire) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

module.exports = { set, get };
