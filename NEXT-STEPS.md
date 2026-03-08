# Next Steps: Questions Before v2

The runtime migration track is complete, but v1 stabilization is still active.
Tests pass. The codebase is Node-only and hardened, but naming, metadata, and tool-agnostic documentation still need cleanup.

Before writing any more code, answer these questions honestly.

---

## 1. What is this fork for?

The v1 work was defensive: fixing what was broken, hardening what was fragile,
making CI trustworthy. That work is done. The next phase should be intentional.

- Is this a personal toolkit you use daily? If so, what workflows does it
  actually serve, and which of its 16 agents / 60+ skills / 30+ commands do
  you never touch?
- Is this a reference implementation you want others to adopt? If so, the
  installer UX, onboarding docs, and first-run experience matter more than
  adding features.
- Is this a learning project where the process of building is the point?
  If so, pick the direction that teaches you the most, not the one that
  ships the most.

Write down a one-sentence answer. If you can't, that's the first problem to
solve.

Answer: Primarily for myself, both at work and for my personal projects.
But I'm also hoping to share it with some friends and coworkers who could benefit from it.

## 2. What is your relationship with upstream?

`affaan-m/modeldev-toolkit` will keep shipping new agents, skills, and
commands. You need a policy:

- **Track upstream**: Periodically merge upstream changes and adapt them to
  your Node-only runtime. This keeps you current but creates ongoing merge
  work. You need a documented sync process and a list of files that are
  fork-specific overrides vs. files you accept from upstream.
- **Diverge fully**: Stop tracking upstream. Build only what you need. This
  is simpler but means you miss upstream improvements unless you manually
  cherry-pick them.
- **Selective sync**: Watch upstream for new agents/skills that interest you,
  but never bulk-merge. Port individual items on your own schedule.

Pick one. The answer affects whether you invest in sync tooling or delete the
upstream remote entirely.

Answer: upstream is going to be ignored going forward.
I may choose to download newer versions from the original author to compare and test, but that's about it.

## 3. What should be removed?

A lean fork that does 10 things well is more valuable than a comprehensive one
that does 60 things adequately. Look at each component family and ask: "Have I
used this in the last month?"

Candidates to evaluate:

- **Agents**: Do you use all 18? The specialized reviewers (Go, Rust, .NET,
  PowerShell, Django) are only useful if you work in those ecosystems.
- **Skills**: The skills directory has broad coverage. Which ones have you
  actually invoked? Skills you never use are not free — they add context
  noise when Claude scans for relevant skills.
- **Commands**: Same question. `/e2e`, `/python-review` — do these match your actual stack?
- **MCP configs**: Are you using all configured MCP servers? Unused configs
  are dead weight.
- **Hooks**: The hook system now has significant complexity. Which hooks
  fire on your real workflows, and which are aspirational?

Removing things is harder than adding them. Do it now while the codebase is
clean and you remember what everything does.

Answer: I have already removed some of the things I don't need and added some I do.

## 4. What is missing for YOUR workflows?

Forget what the upstream project thinks is important. Think about your last
10 coding sessions with Claude Code:

- Where did you lose time?
- What did you have to do manually that could have been automated?
- What context did Claude lack that you had to repeatedly provide?
- Were there patterns you kept repeating across sessions?

These are your v2 features. They should come from lived experience, not from
scanning for theoretical improvements.

Answer: I'm still learning about what _can_ be done with these agents;
I forked the original repository to make use of someone else's
hard earned experience to learn and build upon myself.

## 5. How do you want to maintain this going forward?

The v1 migration used a thorough but heavyweight process: three independent
audits, cross-validation, consolidated v3 plans, migration history docs. That
was appropriate for establishing a trusted baseline from an unknown state.

For ongoing work, decide:

- **Issue tracker vs. improvement docs**: Should future work be tracked in
  GitHub Issues, or do you prefer the IMPROVEMENT.md pattern? Issues are
  better for incremental work; docs are better for planned migration phases.
- **Review rigor**: Does every change need a multi-agent review pass, or is
  that overkill for a personal fork? Match the process to the stakes.
- **Test policy**: The test suite is now substantial. What's the bar for new
  code? Must every change have tests, or only changes to security-sensitive
  paths?

Answer: I have found that there is still a lot that needs to be fixed;
some skills referring to python-scripts that I've removed and replaced with javascript.

## 6. When is v2 done?

v1 had a clear finish line: "all planned items implemented and verified."
Define the same for v2 before starting. A project without a finish line
becomes a project that never ships.

Answer: I'm at this point feeling like v1 is still underway;
it is time to iron out any and all bugs from the move away from python/shell-scripts.

---

## After answering these questions

1. Delete or trim components you don't use (question 3).
2. Pick your upstream policy and document it (question 2).
3. Build the 2-3 things that would most improve your daily workflow (question 4).
4. Stop when you hit your finish line (question 6).

The codebase is in good shape. The risk now is not broken code — it's
building things you don't need.

---

## Post-Stabilization Follow-Up

After the v1 stabilization pass, the next work should stay narrow and
operational rather than expanding features.

### 1. Enforce the new checks in CI

Make sure every PR runs the stabilization guards, not just local test runs:

- `scripts/ci/validate-metadata.js`
- Schema contract coverage for real shipped configs/manifests
- `MDT_ROOT` regression coverage

### 2. Review the deliberate leftovers

The remaining references to `~/.claude/` should each be clearly intentional and
fall into one of these buckets:

- Claude-specific docs/examples
- upstream or historical references
- tests/validator text

If a leftover does not fit one of those buckets, clean it up.

### 3. Cut a stabilization release

This is a good release boundary because contracts, naming, installer output,
runtime placeholders, and docs all changed together.

Release notes should call out:

- `MDT_ROOT` is now the preferred runtime placeholder
- schemas were corrected to match shipped formats
- metadata consistency is now validated

### 4. Do one final narrow cleanup pass before new features

The best candidate is the remaining Claude-only documentation/examples, to
make sure they are explicitly labeled as Claude-specific and never read like
generic MDT guidance.
