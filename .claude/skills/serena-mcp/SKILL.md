---
name: serena-mcp
description: >
  How to use the Serena MCP server for token-efficient code navigation, symbol
  analysis, and targeted editing. Use this skill whenever Serena tools are
  available (mcp__serena__* tools appear in your tool list), when exploring
  unfamiliar codebases, before editing any file larger than ~100 lines, when
  finding all callers of a function, or when you need to understand a module
  without reading it whole. ALWAYS prefer Serena's symbolic tools over raw
  Read calls for TypeScript, JavaScript, Python, or any language with LSP
  support — it is almost always faster and cheaper.

---

# Serena MCP — Token-Efficient Code Navigation

## Core Philosophy

**Symbol-first, file-last.** Never read a whole file when a symbol query gives you exactly what you need. Serena wraps an LSP server, so it understands the *structure* of code — not just its text.

Key rule: if the file is larger than ~50 lines and you know (or can guess) the name of the symbol you want, use Serena. Reserve `Read` for:
- Files you already know are small
- Non-code files (JSON, YAML, Markdown, config)
- When you already have the full file in context from an earlier read

---

## Tool Quick Reference

| Goal | Tool |
|------|------|
| Understand what's in a file | `get_symbols_overview` |
| Find a specific function or class | `find_symbol` (`include_body=false` first) |
| Read a function body | `find_symbol` with `include_body=true` |
| Find all callers of a symbol | `find_referencing_symbols` |
| Search for a pattern across files | `search_for_pattern` |
| List directory contents | `list_dir` |
| Find a file by name | `find_file` |
| Replace an entire function/class body | `replace_symbol_body` |
| Add code after a symbol | `insert_after_symbol` |
| Add code before a symbol | `insert_before_symbol` |
| Rename a symbol everywhere | `rename_symbol` |
| Store architectural context | `write_memory` |
| Recall stored context | `read_memory` / `list_memories` |

### Key parameters to know

- **`name_path`** — slash-separated path to a nested symbol: `ClassName/methodName`, `OuterFn/innerFn`
- **`include_body`** — set `true` only when you need the implementation; `false` for structural surveys
- **`depth`** — how many levels of nesting to return in `find_symbol`; `depth=1` gives direct children only
- **`relative_path`** — restrict any search to a specific file or directory; always use this when you know the location

### `name_path` syntax edge cases

| Situation | What to use | Notes |
|-----------|-------------|-------|
| Top-level function | `myFunction` | No slash needed |
| Class method | `MyClass/myMethod` | Class name / method name |
| Nested function inside function | `outerFn/innerFn` | Works if LSP tracks it |
| Default export (anonymous) | Use `get_symbols_overview` first | Name assigned by LSP varies — often `default` or the inferred name |
| Named export, no class | `exportedFunctionName` | Same as top-level function |
| Constructor | `MyClass/__init__` (Python) or `MyClass/constructor` (TS/JS) | Language-dependent |
| Deeply nested (3+ levels) | `A/B/C` | Prefer `depth` param to survey first |
| Unknown name | Use `search_for_pattern` or `get_symbols_overview` | Find the name, then use `find_symbol` |

When in doubt, call `get_symbols_overview` first — it shows the exact `name_path` strings the LSP has assigned, which you can then copy directly into `find_symbol`. See the [tool reference](https://oraios.github.io/serena/01-about/035_tools.html) for the full parameter spec.

---

## Workflows

### 1. Explore an unfamiliar file

Start broad, zoom in only as needed.

```
1. list_dir           → see what files exist in the directory
2. get_symbols_overview(relative_path="src/foo.ts")
                      → see all top-level symbols (classes, functions, exports)
3. find_symbol(name_path_pattern="MyClass", include_body=false, depth=1)
                      → list methods without reading bodies
4. find_symbol(name_path_pattern="MyClass/doThing", include_body=true)
                      → read only the method you actually need
```

Avoid jumping to step 4 without steps 2–3. You will often discover that the method you want is in a different class, or that a helper does the heavy lifting.

### 2. Pre-edit investigation

Before touching any non-trivial symbol:

```
1. get_symbols_overview(relative_path=<target file>)
                      → confirm symbol names and file structure
2. find_symbol(name_path_pattern=<target>, include_body=true)
                      → understand current implementation
3. find_referencing_symbols(name_path_pattern=<target>)
                      → discover every call site so you know the blast radius
4. Edit with confidence — you know exactly what breaks if the signature changes
```

### 3. Refactor or rename a symbol

```
1. find_symbol(name_path_pattern=<symbol>, include_body=false)
                      → confirm exact name and location
2. find_referencing_symbols(name_path_pattern=<symbol>)
                      → list all usages across the repo
3a. rename_symbol     → for pure renames (updates all references via LSP)
3b. replace_symbol_body + targeted edits at each call site
                      → for signature changes that need manual updates
```

### 4. Add new code to an existing file

```
1. get_symbols_overview(relative_path=<file>)
                      → identify the last top-level symbol in the file
2. insert_after_symbol(name_path_pattern=<last symbol>, ...)
                      → append new function/class after it

   OR

   insert_before_symbol(name_path_pattern=<first symbol>, ...)
                      → prepend (e.g., for imports or constants at the top)
```

### 5. Search when you don't know the symbol name

```
1. rg "functionNameFragment" --type js
                      → fastest first pass for raw text matches
   fd "*feature*.ts"
                      → fastest first pass for filename matches
2. search_for_pattern(pattern="functionNameFragment|conceptKeyword")
                      → use when you need LSP-aware results or non-code files
3. get_symbols_overview / find_symbol on the candidates found above
```

---

## Memory Tools

Use `write_memory` to persist context that would be expensive to re-derive in future sessions:

| What to persist | Example |
|-----------------|---------|
| Non-obvious architectural decisions | "The resolver walks deps in two passes; first pass collects, second pass validates" |
| Quirky module relationships | "hooks/scripts/ is the canonical location; hooks/cursor/ was the old path" |
| Known limitations or TODOs | "Dynamic `require()` calls in install-resolver.js are invisible to find_referencing_symbols" |

Do **not** use memory for things derivable from the code or git history. Memory is for context that lives between the lines.

---

## Limitations

### LSP quality by language

| Language | Symbol navigation | Cross-file references |
|----------|------------------|-----------------------|
| TypeScript | Excellent | Excellent |
| JavaScript (typed/JSDoc) | Good | Good |
| JavaScript (plain, untyped) | Fair | Weak — dynamic `require()` and implicit exports are often missed |
| Python | Good | Good |
| JSON / YAML / Markdown | **None** — fall back to `Read` | — |

### Other known limits

- **`get_symbols_overview` is per-file** — it does not accept a directory path. Use `list_dir` first, then call it per file.
- **Dynamic references are invisible** — `require(someVar)`, computed property names, and metaprogramming patterns will not appear in `find_referencing_symbols` results.
- **Renamed/moved files** — LSP caches can lag after a bulk rename. If results look stale, try `search_for_pattern` as a cross-check.
- **Generated or minified files** — symbol names are mangled; use `Read` or `search_for_pattern` with regex instead.

---

## When NOT to Use Serena

| Situation | Better tool |
|-----------|-------------|
| File is <50 lines | `Read` — overhead not worth it |
| You already have the full file in context | You already have it — no extra call needed |
| The file is JSON, YAML, TOML, Markdown | `Read` or `rg` |
| You need a specific line range | `Read` with `offset` + `limit` |
| Fuzzy text search (regex, multi-file grep) | `rg` — faster than `search_for_pattern` for pure text matches |
| Finding files by name or extension | `fd` — faster than `find_file` for name-only queries |
| Binary or image files | Not applicable |

## Shell Fallbacks: `rg` and `fd`

Both tools are available on this machine and outperform their equivalents for
text-only searches where LSP symbol understanding isn't needed.

### `rg` (ripgrep) — content search

Prefer over `search_for_pattern` when:
- You're matching a raw string or regex with no symbol context needed
- You want to search across non-code files (Markdown, YAML, JSON)
- You need multiple patterns or file-type filters in one pass

```shell
rg "resolveInstallPlan" scripts/        # fast literal search
rg -t md "context-mode" docs/           # Markdown files only
rg -l "TODO" --glob "*.js"              # list files with TODOs
rg "class\s+\w+\s+extends" -t ts       # regex across TypeScript
```

### `fd` (fd-find) — file name search

Prefer over `find_file` when:
- You only care about the file name or path, not its contents
- You need glob/extension filters or directory scoping

```shell
fd SKILL.md                             # find all SKILL.md files
fd -e js scripts/                       # all .js files under scripts/
fd -t f "validator" scripts/ci/         # files named *validator* in ci/
fd -e md docs/plans/                    # all plan markdown files
```

### Decision: Serena vs rg/fd

| Need | Use |
|------|-----|
| Find a function definition | `find_symbol` |
| Find all callers of a function | `find_referencing_symbols` |
| Understand a file's structure | `get_symbols_overview` |
| Search for a string in code files | `rg` |
| Find a file by name pattern | `fd` |
| Search non-code files | `rg` |

---

## Worked Example: MDT repo

Given MDT's JavaScript codebase with some untyped modules:

```
# Find what the install resolver exports
get_symbols_overview(relative_path="scripts/lib/install-resolver.js")

# Understand the main resolution function
find_symbol(name_path_pattern="resolveInstallPlan", include_body=true,
            relative_path="scripts/lib/install-resolver.js")

# See who calls it
find_referencing_symbols(name_path_pattern="resolveInstallPlan",
                         relative_path="scripts/lib/install-resolver.js")

# NOTE: dynamic require() calls in install-mdt.js may NOT appear in results.
# Cross-check with: search_for_pattern(pattern="resolveInstallPlan")
```

This pattern — symbol overview → targeted body read → reference check → pattern cross-check — is the standard loop for any non-trivial edit in this repo.

---

## References

| Resource | URL |
|----------|-----|
| GitHub repository | https://github.com/oraios/serena |
| Docs home | https://oraios.github.io/serena/ |
| Tool reference (all tools with parameters) | https://oraios.github.io/serena/01-about/035_tools.html |
| Configuration | https://oraios.github.io/serena/02-usage/050_configuration.html |
| MCP client integration | https://oraios.github.io/serena/02-usage/030_clients.html |

When a tool behaves unexpectedly or a parameter isn't documented here, the tool reference page is the authoritative source.
