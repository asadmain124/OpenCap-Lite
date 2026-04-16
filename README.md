# OpenCap Lite

Open-source, self-hosted cap-table and scenario-modeling tool for early-stage
founders raising on SAFEs and convertible notes. Carta-grade modeling with
every calculation traceable to its inputs. MIT-licensed, $0.

> OpenCap Lite is a modeling tool, not legal, tax, or accounting advice.
> Always validate results with your attorney and CPA before making decisions.

## Features

- Full cap table: stakeholders, security classes, holdings, option grants,
  SAFEs, and convertible notes
- **Scenario sandbox** that never mutates your real cap table
- SAFE / note conversion with cap, discount, best-for-investor, MFN, and
  per-instrument overrides
- Option-pool top-up solver (none, target post-money %, fixed shares,
  fixed % of pre-money)
- Priced-round PPS with editable cap and pre-money denominators
- Accelerator fixed-equity template (e.g. 7% YC)
- All 5 conversion-ordering rules selectable at scenario level
- OCF v1.2.0 import/export (merge or overwrite)
- CSV import/export per entity
- Live preview in the scenario builder (300ms debounced)
- Audit log on all cap-table mutations; scenario calculations are non-mutating

## Quick start

### Docker

```bash
cp .env.example .env
docker compose up --build
# first-time setup
docker compose exec app pnpm exec prisma migrate deploy
docker compose exec app pnpm db:seed   # loads "Acme Labs, Inc." demo
```

Then open [http://localhost:3000](http://localhost:3000).

### Local development

```bash
pnpm install
cp .env.example .env
# adjust DATABASE_URL to your Postgres
pnpm exec prisma migrate dev
pnpm db:seed
pnpm dev
```

## One-click deploy

<!-- Replace TEMPLATE_ID values with your Railway template; swap GITHUB placeholders for your fork. -->

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![Launch on Fly.io](https://fly.io/docs/img/fly-launch.svg)](https://fly.io/launch)

Each button provisions Postgres and the app container; see `fly.toml`,
`render.yaml`, and `railway.json` for the machine-readable configuration.

## Architecture

| Layer               | Tech                                                     |
| ------------------- | -------------------------------------------------------- |
| Runtime             | Next.js 14 App Router (Node 20)                          |
| Data                | Postgres 16 + Prisma                                     |
| Calculation engine  | Pure TypeScript + `decimal.js` + `bigint`                |
| Validation          | Zod                                                      |
| UI primitives       | shadcn/ui, Radix UI, Tailwind                            |
| Tables              | TanStack Table v8                                        |
| Tests               | Vitest, fast-check, Playwright                           |

The calculation engine lives in `src/lib/scenario-engine/` and has no DB or UI
imports. It is covered by:

- 29 unit tests (one per primitive module)
- 4 hand-verified **golden-file** fixtures replicating YC / Alexander Jarvis
  / Carta worked examples to the cent
- 6 property-based tests asserting ownership sums to 100%, best-for-investor
  picks the lower price, pool-topup converges, interest is monotonic in time,
  newMoney → founder-% is monotonic, and scenario outputs are deterministic

Run the full suite: `pnpm exec vitest run`.

## API

See `src/app/api/` for route handlers. Endpoints:

| Path                                            | Verbs                  |
| ----------------------------------------------- | ---------------------- |
| `/api/companies` · `/api/companies/:id`         | GET · POST · PUT · DEL |
| `/api/stakeholders` · `/api/stakeholders/:id`   | GET · POST · PUT · DEL |
| `/api/security-classes` · `…:id`                | GET · POST · PUT · DEL |
| `/api/holdings` · `…:id`                        | GET · POST · PUT · DEL |
| `/api/option-grants` · `…:id`                   | GET · POST · PUT · DEL |
| `/api/safes` · `…:id`                           | GET · POST · PUT · DEL |
| `/api/notes` · `…:id`                           | GET · POST · PUT · DEL |
| `/api/scenarios` · `…:id`                       | GET · POST · PUT · DEL |
| `/api/scenarios/calculate`                      | POST (non-mutating)    |
| `/api/companies/:id/summary`                    | GET                    |
| `/api/companies/:id/csv/:entityType`            | GET · POST             |
| `/api/companies/:id/ocf/export`                 | GET                    |
| `/api/companies/:id/ocf/import`                 | POST                   |
| `/api/health`                                   | GET                    |

## Known limitations

See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md). In short:
no waterfall, no anti-dilution recalculation, no ISO/NSO tax treatment,
no 409A, no ASC 718, no document generation, no SSO.

## Disclaimer

OpenCap Lite is a modeling tool, not legal, tax, or accounting advice.
Always validate results with your attorney and CPA before making decisions.

## License

MIT
