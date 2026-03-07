const BASE_TEST_ENV = Object.freeze({
  FORCE_COLOR: '0',
  NO_COLOR: '1'
});

const TOOL_DETECTION_KEYS = Object.freeze([
  'CLAUDE_SESSION_ID',
  'CLAUDE_CODE',
  'CURSOR_AGENT',
  'CURSOR_TRACE_ID',
  'CODEX_SESSION_ID',
  'CODEX_TRACE_ID',
  'GEMINI_SESSION_ID',
  'GEMINI_TRACE_ID'
]);

const NEUTRAL_TOOL_ENV = Object.freeze(
  TOOL_DETECTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: undefined }), {})
);

const TEST_ENV_PROFILES = Object.freeze({
  claude: Object.freeze({
    ...NEUTRAL_TOOL_ENV,
    CLAUDE_CODE: '1',
    CLAUDE_SESSION_ID: 'test-claude-session'
  }),
  cursor: Object.freeze({
    ...NEUTRAL_TOOL_ENV,
    CURSOR_AGENT: '1',
    CURSOR_TRACE_ID: 'test-cursor-trace'
  }),
  codex: Object.freeze({
    ...NEUTRAL_TOOL_ENV,
    CODEX_SESSION_ID: 'test-codex-session'
  }),
  gemini: Object.freeze({
    ...NEUTRAL_TOOL_ENV,
    GEMINI_SESSION_ID: 'test-gemini-session'
  }),
  neutral: Object.freeze({
    ...NEUTRAL_TOOL_ENV
  })
});

function buildTestEnv(profile = 'neutral', overrides = {}) {
  const profileEnv = TEST_ENV_PROFILES[profile];
  if (!profileEnv) {
    throw new Error(`Unknown test env profile: ${profile}`);
  }

  const merged = {
    ...process.env,
    ...BASE_TEST_ENV,
    ...profileEnv,
    ...(overrides || {})
  };

  return Object.entries(merged).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      return { ...acc, [key]: value };
    }
    return acc;
  }, {});
}

module.exports = {
  BASE_TEST_ENV,
  TEST_ENV_PROFILES,
  buildTestEnv
};
