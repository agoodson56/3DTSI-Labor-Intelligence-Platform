# 3DTSI Labor Intelligence Platform (LIP)

A continuously learning labor intelligence database for [3D Technology Services](https://www.3dtsi.com). Field technicians record real production work (devices installed, cable pulled) with a live timer; every completed session permanently feeds a labor-intelligence database that improves estimating, project management, scheduling, staffing, and profitability.

**This is not a timecard application.** Every field entry makes 3DTSI smarter.

## What it answers

- How long does it *actually* take to install a horn strobe or card reader?
- How many feet of Cat6A can a two-man crew install per hour?
- Which crew sizes produce the best labor efficiency?
- Which devices/systems consistently exceed estimated labor?
- Which projects, customers, markets, and offices are most profitable on labor?

## Architecture

| Layer | Technology |
|---|---|
| Front end | React 18 + TypeScript + Tailwind CSS 4, mobile-first PWA (installable, offline shell) |
| API | Cloudflare Workers (Hono) |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 (`lip-files`, used for DB backups) |
| Hosting | Cloudflare Pages (web) + Workers (API) |
| Auth | Email + password (PBKDF2-SHA256) + TOTP MFA, JWT sessions, full RBAC. Cloudflare Access can be layered in front for SSO. |
| CI/CD | GitHub Actions → Cloudflare (tests must pass before deploy) |

```
worker/    Cloudflare Worker API + D1 migrations + tests
web/       React PWA (Vite)
scripts/   deploy.ps1, backup.ps1
.github/   CI/CD workflow
```

## Core flows

1. **Login** — email + password, optional TOTP MFA. Login history, device, IP, and session list are tracked and visible to the user.
2. **Project selection** — search, or scan the project QR code (each project has a QR token; Admin → Projects shows a printable code).
3. **Device Installation Mode** — pick System → Device → Task Type → crew size → **START**. Pause/Resume/Stop. On stop, enter total quantity installed; the platform computes total hours, man-hours, hours/device, devices/hour, devices/man-hour and stores them permanently.
4. **Cable Installation Mode** — pick cable type, add reels with starting footage (auto-numbered). On stop, enter remaining footage per reel; the platform computes feet pulled, feet/hour, feet/man-hour.
5. **Labor Intelligence** — learned rates per device/cable/crew size/technician/customer/market/office, with sample counts and confidence levels, compared against the estimating database rate stored on each device.
6. **AI Insights** — rule-based analytics flag estimate reductions ("Card Readers average 1.9 h vs 2.8 h estimated — reduce 32%"), labor overruns, optimal crew sizes, and training opportunities.
7. **Project management** — per-project labor budget vs spent vs earned hours, variance, productivity score (earned/spent), and estimate-at-completion.
8. **Executive dashboard** — top technicians/crews/PMs/offices, most/least profitable systems, weekly labor and productivity trends.
9. **Reports** — daily/weekly/monthly/quarterly/annual, grouped by project/technician/crew/customer/system/device/market. Export CSV (opens in Excel) or print to PDF.

## Roles & permissions

Technician, Lead Technician, Foreman, Superintendent, Project Manager, Estimator, Operations Manager, Executive, Administrator — each carries a configurable permission set editable in Admin → Roles.

## Local development

```bash
npm install              # on Windows ARM64 use: npm install --ignore-scripts (workerd has no win-arm64 binary)
npm test                 # 48 unit + security + integration tests
npm run dev              # wrangler dev (API on :8787) — requires x64/mac/linux for workerd emulation
npm run dev:local        # Node-based API on :8787 with a persistent SQLite file (works on ANY machine, incl. Windows ARM64)
npm run dev:web          # vite dev server on :5173 (proxies /api to :8787)
```

> **Windows ARM64 note:** Cloudflare's local runtime (`workerd`) does not ship a Windows ARM64 binary, so `wrangler dev --local` and `--local` D1 migrations don't run on this machine. Use `npm run dev:local` instead — it runs the real API over a local SQLite file (`worker/.data/lip-local.db`) that emulates D1. Tests, builds, type-checks, and *deployments* all work normally.

## First deployment

The GitHub Actions pipeline is **self-provisioning** — it creates the D1 database, R2 bucket, and Pages project automatically, patches the database id, applies migrations, and sets the worker's JWT secret. One-time setup:

1. Add three repository secrets (GitHub → Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` — custom token with account-level **Workers Scripts: Edit, D1: Edit, Workers R2 Storage: Edit, Cloudflare Pages: Edit** (create at dash.cloudflare.com → My Profile → API Tokens)
   - `CLOUDFLARE_ACCOUNT_ID` — shown on the Cloudflare dashboard overview / in any zone's right sidebar
   - `JWT_SECRET` — 64+ random characters (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
2. Push to `main` (or re-run the failed workflow). The pipeline tests, provisions, and deploys everything.
3. Optionally set repository variable `VITE_API_URL` to a custom API URL; otherwise the pipeline auto-detects the workers.dev URL.
4. Open the web app (`https://3dtsi-lip.pages.dev`) → **First-time setup: create administrator** → sign in → enable MFA → add users, customers, projects.

Manual deployment from a workstation (x64/mac/linux) remains available via `npm run deploy` after `npx wrangler login` — see `scripts/deploy.ps1` header for the one-time resource commands.

## Backups

`npm run backup` exports the full D1 database to `backups/` and uploads a copy to the `lip-files` R2 bucket.

## Security

- PBKDF2-SHA256 (100k iterations) password hashing; TOTP MFA (RFC 6238)
- HS256 JWTs bound to server-side revocable sessions with configurable timeout
- Role-based access control on every endpoint; audit log of every sensitive action
- Login history with IP, device, and user agent; per-user active-session list
- TLS in transit (Cloudflare) and encryption at rest (D1/R2 are encrypted at rest by Cloudflare)
- Strict CORS allow-list + secure headers

## Estimating integration

`GET /api/intelligence/recommendations/estimate?deviceId=…&quantity=…` returns the learned labor rate, recommended crew size, production rate, and expected duration with confidence level — the integration point for SmartPlans2, MyKyah Estimating, 3D Change Order, and the PM system.
