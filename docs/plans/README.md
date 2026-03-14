# Plans

This directory holds implementation plans for non-trivial changes to MDT.

## When to write a plan

Write a plan before starting any change that:

- touches ≥ 3 files
- introduces a new file format or data schema
- alters the public install or package contract
- spans multiple sessions or contributors

If it's a one-liner or a trivial text edit, skip the plan.

## File naming

```
docs/plans/details/YYYYMMDD.HH.mm.<slug>.md
```

- `YYYYMMDD` — date the plan was created (e.g. `20260314`)
- `HH.mm` — 24-hour hour and minute at creation in **UTC** (e.g. `02.03`)
- `<slug>` — short kebab-case description (e.g. `command-tool-metadata`)

Example: `docs/plans/details/20260314.02.03.install-dependency-and-tool-support-manifests.md`

## Lifecycle

1. **Create** — copy `TEMPLATE.md`, name it per the convention above, set status `not-started`
2. **Register** — add an entry to `active.md`
3. **Work** — update status to `in-progress` when work begins; keep the checklist current
4. **Close** — on completion move to `finished.md`; on rejection move to `rejected.md` with a reason at the top of the archived file

## Index files

| File | Purpose |
|------|---------|
| `active.md` | Plans that are `not-started`, `in-progress`, or `halted` |
| `finished.md` | Completed plans |
| `rejected.md` | Abandoned or superseded plans with rejection reasons |
| `TEMPLATE.md` | Blank plan template — copy this to start a new plan |
| `details/` | Individual plan documents |
| `archive/` | Closed plan documents (linked from finished/rejected) |
