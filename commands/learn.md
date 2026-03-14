# /learn - Extract Reusable Patterns

Run the supported ai-learning workflow to analyze the current session and extract reusable patterns.

## Trigger

Run `/learn` at any point during a session when you've solved a non-trivial problem.

## Process

1. Treat `/learn` as the user-facing entrypoint to the same learning pipeline used by `mdt learning`.
2. In hook-enabled environments, analyze the accumulated observations through the supported learning runtime.
3. In hook-free environments, capture a concise session summary first when needed, then run the supported analysis flow.
4. Review the resulting instincts, candidates, or analysis output and summarize the reusable patterns that were extracted.
5. Ask before promoting, materializing, or doing any manual recovery work outside the supported runtime.

## Notes

- `/learn` should not bypass the runtime by drafting instinct markdown or learned skill files directly.
- `/learn-eval` remains the quality-gated, save-location-aware follow-up when the user explicitly wants evaluation before saving.
- Focus on patterns that will save time in future sessions.
