# Codex Manual Verification

Last verified:
- `2026-03-13`

Tested with version:
- `codex-cli 0.114.0`

Manual boundary:

- this page is the authoritative place for runtime checks that depend on Codex's internal `apply_patch` path
- do not treat a Node.js test, shell edit, or raw filesystem probe as proof that `apply_patch` is healthy on Windows

Use this page for quick Codex sanity checks and deeper runtime verification in a real local Codex session.

If you want the maintainer-only smoke surface, install with `mdt install --tool codex --dev ...`. Normal installs still support `mdt verify tool-setups`.

## Quick Smoke

Run:

```bash
mdt verify tool-setups
mdt dev smoke tool-setups --tool codex
mdt dev smoke workflows --tool codex
```

Installed-home equivalents:

```bash
node ~/.codex/mdt/scripts/mdt.js dev smoke tool-setups --tool codex
node ~/.codex/mdt/scripts/mdt.js dev smoke workflows --tool codex
```

## Deeper Checks

- install verification under `~/.codex/`
- `AGENTS.md`, skills, and rules visibility
- explicit/manual continuous-learning flows
- optional external observer behavior when installed

## Required Real-Session Check

After the scripted smoke passes, open a real Codex session in this repo and verify one small end-to-end MDT-guided task:

1. Ask Codex to make a tiny disposable documentation or test-only edit.
2. Confirm it follows repo guidance from `AGENTS.md`, uses the expected MDT workflow behavior, and can complete the edit loop in-session.
3. If the environment is Windows and patchability is in doubt, use the `apply_patch` ACL procedure below instead of trusting raw filesystem probes.
4. Record any mismatch between scripted smoke and Codex session behavior before calling the setup fully verified.

## Windows `apply_patch` ACL Check

Use this when a Windows operator reports:

```text
Failed to apply patch
execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 1" })
```

Preconditions:

1. Start in a real Codex session inside the target workspace.
2. Choose one existing healthy direct child of the workspace root, such as `docs/`.
3. Choose one disposable new direct child name, such as `fresh-patch-dir`.
4. Keep `.git` and any intentionally hardened child directories out of scope for this check.

Verification flow:

1. Run `apply_patch` at the workspace root or in an established direct child and confirm it succeeds.
2. Use `apply_patch` to create `fresh-patch-dir/file.txt`.
3. Use `apply_patch` again to create `fresh-patch-dir/second.txt`.
4. Compare that with two successive `apply_patch` calls under a nested path inside the healthy child, for example `docs/sandbox-owned-subdir/a.txt` and `docs/sandbox-owned-subdir/b.txt`.
5. If the direct-child retry fails but the nested retry succeeds, inspect the workspace root child ACLs with `Get-Acl` and `icacls`.
6. Follow the `icacls`-based repair procedure in `hardening/CODEX-WINDOWS-SANDBOX-ROOT-CHILD-ACL-ISSUE.md` from an elevated PowerShell terminal outside the sandbox.
7. Repeat steps 2 and 3 in the same real Codex session or a fresh Codex session.

Expected signal:

- raw filesystem probes may still pass
- the relevant success criterion is that the second `apply_patch` into the same direct child succeeds after repair

Supporting commands:

```powershell
codex --version
whoami
whoami /groups
Get-Acl C:\path\to\workspace | Format-List Owner,AccessToString
Get-Acl C:\path\to\workspace\fresh-patch-dir | Format-List Owner,AccessToString
icacls C:\path\to\workspace
icacls C:\path\to\workspace\fresh-patch-dir
```

Record in the verification note:

- the exact Codex version
- whether the failure reproduced on the second direct-child `apply_patch`
- whether nested `apply_patch` calls under an established sibling kept working
- whether the ACL repair changed the direct-child outcome
