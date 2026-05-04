# Contributing to OpenCap Lite

Thanks for taking an interest. OpenCap Lite is an MIT-licensed, self-hosted
cap-table modeling tool. We welcome bug reports, feature ideas, documentation
improvements, and pull requests.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to uphold it.

## Getting set up

You need Docker and git. Node and pnpm are bundled in the container, so you
don't need them on the host unless you want to run the test suite locally.

```bash
git clone https://github.com/asadmain124/OpenCap-Lite.git
cd OpenCap-Lite
cp .env.example .env
# replace NEXTAUTH_SECRET with a random value, e.g.
#   sed -i '' "s|change-me-in-production|$(openssl rand -base64 32)|" .env
docker compose up -d --build
docker compose exec app pnpm db:seed
open http://localhost:3000
```

For host-side development without Docker:

```bash
pnpm install
pnpm exec prisma migrate dev
pnpm db:seed
pnpm dev
```

## Project layout

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components, organized by domain
  - `ui/` — shadcn/ui primitives
  - `scenario/` — scenario builder (wizard + expert modes), shared field
    fragments under `fields/`
  - `results/` — calculation result rendering, narrative synthesizer
  - `app/` — top-level shell (TopBar, Sidebar, dashboard helpers)
  - `help/` — HelpTip and EmptyStateLearn
- `src/lib/scenario-engine/` — pure-TypeScript calculation engine. No DB or UI
  imports. Covered by unit tests, golden-file fixtures, and property-based
  tests.
- `src/lib/validators/` — Zod schemas for the API
- `prisma/` — schema and migrations

## Testing

```bash
pnpm exec vitest run            # unit + integration tests
pnpm exec tsc --noEmit          # typecheck
pnpm exec next lint             # lint
pnpm e2e                        # Playwright (optional)
```

Engine changes must keep the four hand-verified golden-file fixtures (YC,
Alexander Jarvis, Carta worked examples) passing to the cent. Property-based
tests in `src/lib/scenario-engine/` assert invariants — don't loosen them
without explanation.

## Submitting a pull request

1. **Open an issue first** for non-trivial changes so we can agree on the
   approach before you spend time.
2. Fork, branch off `main`, and commit with a clear message describing the
   _why_, not just the _what_.
3. Run typecheck, lint, and the test suite locally before pushing.
4. Open a PR against `main`. The PR template will prompt you for context and
   a test plan. Keep PRs scoped — one logical change per PR.
5. CI runs typecheck, lint, and tests. PRs need a green build before review.

We squash-merge PRs, so you don't need to clean up your commit history.

## Reporting bugs

Use the bug-report issue template at
[`.github/ISSUE_TEMPLATE/bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml).
Include:

- What you did
- What you expected
- What actually happened
- Browser + OS, OpenCap Lite version (commit SHA is fine)
- A minimal repro if you can — the demo company seeded by `pnpm db:seed` is a
  good starting baseline

For potential security issues, please **don't** open a public issue. See
[`SECURITY.md`](SECURITY.md).

## What we won't accept

- Closed-source modules or proprietary dependencies — the project is MIT and
  stays that way.
- Changes that turn the calculation engine into a UI-coupled component. The
  engine has no DB or React imports for a reason — it's testable, portable,
  and reviewable.
- Features that require a hosted service (auth provider, telemetry endpoint,
  payment processor) without a self-hosted alternative.

## License

By contributing you agree your contributions are licensed under the MIT
License (see [LICENSE](LICENSE)).
