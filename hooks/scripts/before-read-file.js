#!/usr/bin/env node
/**
 * beforeReadFile: warn when reading sensitive files (.env, .key, .pem).
 *
 * Payload source: stdin, or MDT_HOOK_PAYLOAD_FILE (read then delete) so a
 * caller can pass large payloads via a temp file and avoid ENAMETOOLONG.
 *
 * Known Cursor limitation (Windows): when the payload is large, Cursor may
 * pass it via spawn args/env instead of stdin, causing spawn ENAMETOOLONG
 * before this script runs. Workaround: remove the beforeReadFile entry from
 * .cursor/hooks.json, or (when supported) have the caller set
 * MDT_HOOK_PAYLOAD_FILE to a temp file path. See docs/tools/cursor.md.
 */
const { readHookPayload } = require('./adapter');
readHookPayload().then(raw => {
  try {
    const input = JSON.parse(raw);
    const filePath = input.file_path || input.path || input.file || '';
    if (/\.(env|key|pem)$|\.env\.|credentials|secret/i.test(filePath)) {
      console.error('[MDT] WARNING: Reading sensitive file: ' + filePath);
      console.error('[MDT] Ensure this data is not exposed in outputs');
    }
  } catch (_error) {
    process.stdout.write(raw);
    return;
  }
  process.stdout.write(raw);
}).catch(() => process.exit(0));
