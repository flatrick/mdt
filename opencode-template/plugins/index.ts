/**
 * Everything Claude Code (MDT) Plugins for OpenCode
 *
 * This module exports all MDT plugins for OpenCode integration.
 * Plugins provide hook-based automation that mirrors Claude Code's hook system
 * while taking advantage of OpenCode's more sophisticated 20+ event types.
 */

export { MDTHooksPlugin, default } from "./mdt-hooks.js"

// Re-export for named imports
export * from "./mdt-hooks.js"
