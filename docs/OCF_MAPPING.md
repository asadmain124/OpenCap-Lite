# OCF v1.2.0 Mapping

OpenCap Lite targets [Open Cap Table Format (OCF)][ocf] v1.2.0 for import/export.

| OpenCap Lite entity | OCF object type                                 |
|---------------------|-------------------------------------------------|
| `Company`           | `Issuer`                                        |
| `Stakeholder`       | `Stakeholder`                                   |
| `SecurityClass`     | `StockClass` / `StockPlan` (OPTION_POOL) / `Warrant` |
| `EquityHolding`     | `StockIssuance` / `EquityCompensationIssuance`  |
| `OptionGrant`       | `EquityCompensationIssuance` (OPTION)           |
| `SAFEInstrument`    | `ConvertibleIssuance` (SAFE)                    |
| `ConvertibleNote`   | `ConvertibleIssuance` (NOTE)                    |
| `Scenario`          | *(internal — no OCF equivalent)*                |
| `AuditLog`          | *(internal — no OCF equivalent)*                |

## Field mappings

See `vendor/ocf-schemas/` for the JSON schema stubs OpenCap Lite validates against.
Unknown OCF fields on import are ignored with a warning rather than rejected.

[ocf]: https://open-cap-table-coalition.github.io/
