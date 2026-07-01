# Contributing

Thanks for taking a look at Candelabrum Studio.

This is a local-first, single-operator project. Small, focused improvements are
the easiest to review. Open an issue first for larger architecture changes,
provider additions, or anything that changes the run-state contract.

## Development

```bash
bun install
bun run biome format --write .
bun run biome check .
bun run tsc --noEmit
bun test
```

Keep provider secrets in `.env`; never commit real keys, local run state, or
generated media.

## Pull Requests

- Keep the scope narrow.
- Include tests or a clear reason tests are not needed.
- Update docs when behavior, setup, or configuration changes.
- Do not include generated output from `runs/`, `renders/`, `ready/`, or `dist/`.
