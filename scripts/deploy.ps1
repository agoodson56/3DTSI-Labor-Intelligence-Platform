# 3DTSI LIP - full deployment script (run from repo root)
# Prereqs: `wrangler login` (or CLOUDFLARE_API_TOKEN env var) and one-time resource creation:
#   npx wrangler d1 create lip-db          -> paste database_id into worker/wrangler.toml
#   npx wrangler r2 bucket create lip-files
#   npx wrangler pages project create lip
#   npx wrangler secret put JWT_SECRET --config worker/wrangler.toml
$ErrorActionPreference = 'Stop'

Write-Host '== 1/4 Tests ==' -ForegroundColor Cyan
npm run test --workspace=worker
if ($LASTEXITCODE -ne 0) { throw 'Tests failed - deployment aborted.' }

Write-Host '== 2/4 D1 migrations (remote) ==' -ForegroundColor Cyan
npx wrangler d1 migrations apply lip-db --remote --config worker/wrangler.toml
if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }

Write-Host '== 3/4 Deploy API worker ==' -ForegroundColor Cyan
npx wrangler deploy --config worker/wrangler.toml
if ($LASTEXITCODE -ne 0) { throw 'Worker deploy failed.' }

Write-Host '== 4/4 Build + deploy web app to Cloudflare Pages ==' -ForegroundColor Cyan
npm run build --workspace=web
if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
npx wrangler pages deploy web/dist --project-name=lip
if ($LASTEXITCODE -ne 0) { throw 'Pages deploy failed.' }

Write-Host 'Deployment complete.' -ForegroundColor Green
