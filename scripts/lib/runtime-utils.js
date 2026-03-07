const fs = require('fs');

/**
 * Standard internal success envelope.
 * @param {any} data
 * @returns {{ ok: true, data: any, error: null }}
 */
function ok(data) {
  return { ok: true, data, error: null };
}

/**
 * Standard internal failure envelope.
 * @param {Error|string} error
 * @returns {{ ok: false, data: null, error: Error }}
 */
function err(error) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return { ok: false, data: null, error: normalized };
}

/**
 * Wrap an error with contextual message while preserving root message.
 * @param {string} message
 * @param {Error|string} cause
 * @returns {Error}
 */
function wrapError(message, cause) {
  const base = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${message}: ${base}`);
}

/**
 * Safely parse JSON text.
 * @param {string} text
 * @returns {{ ok: true, data: any, error: null } | { ok: false, data: null, error: Error }}
 */
function safeJsonParse(text) {
  try {
    return ok(JSON.parse(text));
  } catch (parseError) {
    return err(parseError);
  }
}

/**
 * Parse JSON Lines (JSONL). Invalid lines are skipped and counted.
 * @param {string} text
 * @returns {{ ok: true, data: { entries: any[], invalidCount: number }, error: null }}
 */
function parseJsonLines(text) {
  const lines = String(text || '').split('\n').filter(Boolean);
  const entries = [];
  let invalidCount = 0;

  for (const line of lines) {
    const parsed = safeJsonParse(line);
    if (!parsed.ok) {
      invalidCount++;
      continue;
    }
    entries.push(parsed.data);
  }

  return ok({ entries, invalidCount, totalLines: lines.length });
}

/**
 * Create a per-run cached existsSync wrapper to avoid repeated fs hits.
 * @param {(filePath: string) => boolean} [existsImpl]
 * @returns {(filePath: string) => boolean}
 */
function createPathExistsCache(existsImpl = fs.existsSync) {
  const cache = new Map();
  return (filePath) => {
    if (cache.has(filePath)) {
      return cache.get(filePath);
    }

    let result = false;
    try {
      result = existsImpl(filePath);
    } catch {
      result = false;
    }
    cache.set(filePath, result);
    return result;
  };
}

/**
 * Return insertion-order unique values as a new array.
 * @template T
 * @param {T[]} values
 * @returns {T[]}
 */
function unique(values) {
  return Array.from(new Set(values));
}

module.exports = {
  ok,
  err,
  wrapError,
  safeJsonParse,
  parseJsonLines,
  createPathExistsCache,
  unique
};
