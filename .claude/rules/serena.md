# Serena MCP Usage in MDT Development

Serena provides token-efficient code navigation via semantic (LSP-backed) tools.
Prefer Serena's symbolic tools over raw `Read` calls whenever you need to
explore or understand code — only fall back to `Read` when you need file
content in context for an `Edit`.

---

## Tool Selection Hierarchy

| Goal | Use |
|------|-----|
| Explore a file's structure | `get_symbols_overview` |
| Find a specific class/function | `find_symbol` with `include_body=false` |
| Read a specific method body | `find_symbol` with `include_body=true` |
| Find all callers of a function | `find_referencing_symbols` |
| Locate a file by name | `find_file` |
| Search for a pattern across the repo | `search_for_pattern` |
| Edit an entire symbol | `replace_symbol_body` |
| Add code at end of file | `insert_after_symbol` (last top-level symbol) |
| Add code at start of file | `insert_before_symbol` (first top-level symbol) |

---

## Common MDT Patterns

### Before editing any file > ~100 lines

```
1. get_symbols_overview(relative_path) → see all top-level symbols
2. find_symbol(name_path, include_body=false) → locate the target symbol
3. find_symbol(name_path, include_body=true) → read only what you need
4. Read only if Edit is next (Edit needs file content in context)
```

### Finding a validator or script entrypoint

```
find_file("validate-install-packages")    # returns path
get_symbols_overview(path)                # see exported functions
find_symbol("functionName", body=true)    # read the specific function
```

### Checking backward compatibility before changing a symbol

```
find_referencing_symbols(name_path, relative_path)
```

Returns callers with surrounding code snippets. Update all references or
ensure the change is backward-compatible before finishing.

### Navigating the skills directory

Skills follow a consistent `SKILL.md` + optional JS pattern. For skills:
- Use `find_file("SKILL.md", relative_path="skills/<name>")` to confirm location
- Use `search_for_pattern` for cross-skill pattern searches (e.g., find all
  skills that reference a deprecated API)

---

## What NOT to Do

- Don't `Read` an entire large file to find one function — use `find_symbol`
- Don't `grep` manually — use `search_for_pattern` or `find_referencing_symbols`
- Don't re-read a file with Serena tools after you've already `Read` it in full
  — you already have the information
- Don't use `get_symbols_overview` on a file you already have fully in context

---

## Serena + Context-Mode Together

For large script analysis (e.g., `install-mdt.js` at 59 KB):

```
1. get_symbols_overview("scripts/install-mdt.js")  → structural map
2. find_symbol("targetFunction", include_body=true) → read only what's needed
3. If you must run the script: ctx_execute("node scripts/install-mdt.js 2>&1")
```

Never `Read` the full file for exploration. Never run it via raw Bash.
