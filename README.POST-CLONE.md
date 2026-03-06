# Post-Clone Setup

Run these commands after cloning to get the most out of git in this repository.

## Improved diff hunk headers

`.gitattributes` assigns custom diff drivers to Markdown, JavaScript, and JSON
files. The driver **names** are shared via `.gitattributes`, but the driver
**definitions** live in your local git config. Without these, Git silently
falls back to the default diff behavior.

### Markdown

Git ships with a built-in `markdown` driver — no config needed. Hunk headers
will show the nearest `#` heading.

### JavaScript

Shows the nearest function, class, method, or test block in hunk headers:

```bash
# One line (works in PowerShell, cmd, and Bash):
git config --local diff.javascript.xfuncname "^[ \t]*(((export[ \t]+(default[ \t]+)?)?(async[ \t]+)?function[ \t]+\w|class[ \t]+\w|(const|let|var)[ \t]+\w+[ \t]*=[ \t]*(async[ \t]+)?[[(]|module\.exports)|(describe|it|test)[ \t]*\()"
```

### JSON

Shows the nearest key name in hunk headers:

```bash
# Single quotes so inner " are literal (works in Bash and PowerShell):
git config --local diff.json.xfuncname '^[ \t]*"[^"]+"[ \t]*:'
```

## Verify

After running the commands above, confirm they took effect:

```bash
git config --local --get diff.javascript.xfuncname
git config --local --get diff.json.xfuncname
```

Both should print back the patterns you just set.
