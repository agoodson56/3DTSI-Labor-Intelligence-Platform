# Changelog

All notable changes to the 3DTSI Labor Intelligence Platform.

## [1.0.0] - 2026-06-09

### Added
- **API (Cloudflare Worker, Hono)**
  - Email/password authentication with PBKDF2-SHA256 hashing, TOTP MFA (RFC 6238), HS256 JWT access tokens bound to revocable server-side sessions, login history (IP/device/user-agent), first-run administrator bootstrap.
  - Role-based access control with nine seeded roles (Technician → Administrator) and per-role configurable permissions.
  - Projects & customers with market segment, project type, office, labor budget, PM assignment, and QR tokens for instant project selection.
  - Catalog: 8 systems and 60+ devices seeded from 3DTSI operations (Structured Cabling, Fiber Optics, CCTV, Access Control, Fire Alarm, Networking, Audio Visual, Service), 14 task types, 7 cable types; admins can add unlimited systems/devices.
  - Work sessions: device-installation and cable-pulling modes with start/pause/resume/stop event timeline, crew size, multi-reel tracking with auto-numbering, and validated completion.
  - Labor metrics: permanent per-session production records (total hours, man-hours, hours/unit, units/hour, units/man-hour) tagged with customer, market, office, project type, and the estimating rate in force at time of work.
  - Labor Intelligence endpoints: learned rates by device, cable type, crew size, technician, customer, market, office, project type, and system, with sample counts and confidence levels.
  - AI insights engine: estimate-reduction opportunities, labor overruns, optimal crew-size recommendations, project budget warnings, and training opportunities.
  - Project labor status: budget vs spent vs earned hours, variance, productivity score, estimate at completion.
  - Executive dashboard aggregations and period reports (daily→annual) with CSV export.
  - Audit logging on all sensitive actions; strict CORS and secure headers.
- **Web (React + TypeScript + Tailwind 4 PWA)**
  - Mobile-first installable PWA in 3DTSI teal/gold/black branding.
  - Login with MFA step, first-run admin setup, account security page (MFA enrollment with QR, password change, login history, active sessions).
  - Project selection with search and camera QR scanning.
  - Field tracking: mode selection, big-button timer (start/pause/resume/stop), quantity/reel completion, instant production-rate results.
  - Executive dashboard with KPI cards, labor/productivity trend chart, leaderboards, and system profitability bars.
  - Labor Intelligence explorer with device/cable/crew/dimension tabs and AI insights feed.
  - Reports with period/grouping filters, CSV (Excel) export, and print-to-PDF.
  - Admin console: users, role permissions, projects/customers with printable QR codes, catalog management.
- **Operations**
  - GitHub Actions CI/CD: tests + type-check + build gate every push; auto-deploy of D1 migrations, Worker, and Pages on main.
  - `scripts/deploy.ps1` full deployment and `scripts/backup.ps1` D1 → local + R2 backup.
  - 32 unit/security tests (calculation engine, JWT, TOTP incl. RFC 6238 vector, password hashing, RBAC).
