# Release Notes

## v1.0.0 — Foundation Release (2026-06-09)

The first production release of the 3DTSI Labor Intelligence Platform: a continuously learning labor database that turns every technician work session into smarter estimates, schedules, and staffing decisions.

### Highlights
- **Field tracking that feeds the brain.** Technicians select a project (search or QR scan), choose device or cable mode, press START, and the platform records true working time with pause/resume. Completion captures quantities and instantly shows production rates — and every result becomes permanent intelligence.
- **Labor Intelligence Engine.** Learned hours-per-device and feet-per-man-hour by device, cable type, crew size, technician, customer, market, office, and project type — each with sample counts and confidence levels, benchmarked against the estimating database.
- **AI insights.** Automatic findings like "Card Reader installations average 1.9 hours each; estimating uses 2.8 — reduce estimates 32%", labor-overrun warnings, optimal crew-size recommendations, and training opportunities.
- **Project labor control.** Live budget vs spent vs earned hours, variance, productivity score, and estimate-at-completion on every project.
- **Executive dashboard.** Top technicians, crews, PMs, and offices; most/least profitable systems; weekly labor and productivity trends.
- **Enterprise security.** MFA, RBAC with nine configurable roles, revocable sessions, audit logging, login/device/IP history.
- **Cloudflare native.** Workers + D1 + R2 + Pages, deployed automatically from GitHub with a test gate.

### Known limitations
- PDF export uses the browser print dialog (print-optimized styles included); native server-side PDF generation is a candidate for v1.1.
- Local Worker emulation (`wrangler dev --local`) is unavailable on Windows ARM64 development machines (no `workerd` binary); use `--remote` or CI.
- QR generation in the UI uses a public QR-image service; swap to a bundled generator if projects must remain fully internal.

### Upgrade path
Fresh install — see README “First deployment”.
