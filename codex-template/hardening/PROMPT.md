# Codex Home Hardening Prompt

Use this prompt in Codex on another machine or as another user when you want to harden the sensitive base files in that user's `~/.codex` folder.

## Prompt

```text
Scan my user-level Codex home folder at ~/.codex and harden the sensitive base files only:

1. Treat this as a real implementation task, not just advice.
2. Inspect the current folder first and adapt to what is actually present.
3. Tighten auth token exposure:
   - Find auth.json.
   - On Windows: remove sandbox-user read access from that file only. If the access is inherited, disable inheritance on auth.json first, then remove the sandbox-user ACL entry. Keep the owner, Administrators, and SYSTEM access intact.
   - On Linux/macOS: tighten auth.json to owner-only permissions, equivalent to chmod 600.
4. Identify the other sensitive Codex base files that should be treated as private local state, such as:
   - history.jsonl
   - sessions/
   - log/
   - state_*.sqlite*
   - any similar runtime state files that contain prompts, tokens, session metadata, or local environment details
5. Do not rewrite unrelated workflow files such as AGENTS.md or rules/default.rules unless I explicitly ask.
6. Verify the result:
   - On Windows: show the final icacls output for auth.json.
   - On Linux/macOS: show the final auth.json mode/owner permissions.
   - Confirm whether sandboxed access to auth.json should now fail or be restricted while normal user access still works.
   - Summarize exactly which sensitive files were changed and which were only identified.

If any permission change needs elevation, request it with a concise justification and then continue.
```

## Notes

- This prompt is adaptive: it tells Codex to inspect first instead of assuming the target machine matches this one exactly.
- It stays focused on sensitive base files instead of unrelated workflow customizations.
