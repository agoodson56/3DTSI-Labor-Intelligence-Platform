# Changelog

All notable changes to the 3DTSI Labor Intelligence Platform.

## [1.3.0] - 2026-06-10

### Added
- **PM project setup form**: single-project Excel form (Description/Answer layout matching the form 3DTSI PMs fill out - Project Number/Name/Customer/Address, Market Segment + Project Type dropdowns, PM/Foreman/Lead, Project System #1-5 dropdowns). Downloadable from Admin → Projects ("Project form (single)"). The importer auto-detects form-style vs bulk-table workbooks.
- Foreman and Lead captured on projects (migration 0005); Project Manager matched by name or email.
- Imported systems shown as chips on project cards (field project list and Admin).

## [1.2.0] - 2026-06-09

### Added
- **Excel bulk project import**: downloadable template (`Instructions` / `Projects` / `Reference` sheets, dropdown validation for market segment and project type) and an Admin → Projects "Import from Excel" uploader. The importer auto-creates missing customers, skips existing project numbers, matches PM emails to users, attaches per-project system scope, and reports a per-row result (created / skipped / error).
- Project system scoping (migration 0004): projects can declare which systems are in scope; the field tracking UI then only offers those systems.
- Template generator script: `node scripts/generate-import-template.mjs`.

### Fixed
- Migration 0003 rewritten with multi-row VALUES instead of UNION ALL chains - Cloudflare D1 enforces a low compound-SELECT term limit that failed the original migration in production.
- Excel parsing loads on demand so the field PWA bundle stays small.

## [1.1.0] - 2026-06-09

### Added
- Full 3DTSI device taxonomy (migration 0003): ~140 manufacturer-agnostic devices across 11 systems.
  - New systems: **Intrusion Detection**, **Data Center**, **Specialty Electrical / Low Voltage**.
  - Structured Cabling expanded with terminations (RJ45 Jack, Surface Mount Box, Biscuit Jack, Patch Panel Port), pathways (J-Hook, Cable Tray, Conduit, Innerduct, Raceway), and hardware (Ladder Rack, wire managers).
  - Fiber Optic Systems expanded with strand-count cables (6–144 strand), LC/SC/ST connectors, shelves, cassettes, media converters, transceivers, splice trays.
  - Access Control expanded with reader types, locking hardware, door controllers (1/2/4-door, intelligent), and credentials.
  - CCTV split into camera form factors (dome, bullet, PTZ, multi-sensor, fisheye, thermal, LPR), recording, and mounts/accessories.
  - Fire Alarm expanded with waterflow/tamper switches, speaker/speaker strobe, network node, voice evac panel, isolator module.
  - New cable types for pulling mode: Shielded Cat6A and 6–144 strand fiber.
- Existing devices renamed 1:1 where applicable (preserving recorded labor history); superseded generics deactivated.

### Changed
- Cable-type estimating-rate lookup now matches device names with or without a " Cable" suffix.

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
