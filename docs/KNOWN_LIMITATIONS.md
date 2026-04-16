# Known Limitations — OpenCap Lite v0.1

**Status legend:** `[ ]` unaddressed · `[~]` partially addressed · `[x]` addressed

> OpenCap Lite is a modeling tool, not legal, tax, or accounting advice. Always
> validate results with your attorney and CPA before making decisions.

## Calculation engine

- [ ] Multi-tranche preferred with different participation rights per tranche.
  The engine treats preferred as a single class during conversion.
- [ ] Anti-dilution adjustments (weighted-average, full-ratchet) on existing
  preferred. No ratchet recalculation is performed.
- [ ] Liquidation waterfall modeling. Post-exit distribution to preferred and
  common is not computed.
- [ ] Drag-along / tag-along rights.
- [ ] Unresolved MFN SAFE pricing — MFN instruments without explicit cap or
  discount are surfaced as a warning and excluded from conversion rather than
  inferred from sibling terms.

## Tax & compliance

- [ ] QSBS holding period tracking (Section 1202).
- [ ] ISO vs NSO tax treatment distinctions.
- [ ] 83(b) / early exercise cash-flow modeling.
- [ ] 409A valuation — no support. Strike prices must be entered manually.
- [ ] ASC 718 stock-based compensation expense reporting.

## Scope

- [ ] Document generation (SAFE / note / option-grant PDFs).
- [ ] E-signature workflows.
- [ ] Data room / investor update publishing.
- [ ] Multi-jurisdiction legal templates (US Delaware C-corp only in spirit).

## Deployment

- [~] One-click deploys. `fly.toml`, `render.yaml`, and `railway.json` ship
  with the repo but the Deploy-to-X buttons have not been verified against a
  live account on every platform.
- [ ] SSO (SAML, OIDC). Auth is credentials-only in v1.0.
- [ ] Multi-tenant SaaS mode. OpenCap Lite is single-tenant per deployment.

## Testing

- [x] Engine golden-file corpus (4 fixtures) runs on every build.
- [x] Property-based tests (ownership sums to 100%, best-for-investor, pool
  solver, monotonicity, determinism).
- [ ] End-to-end Playwright specs for the five critical UI flows are stubbed
  but not exhaustive.

## Other

- [ ] i18n / locale-aware formatting. English + USD hard-coded in most places.
- [ ] Real-time collaborative editing.
- [ ] Offline / PWA support.
