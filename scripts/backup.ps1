# 3DTSI LIP - D1 database backup script
# Exports the full remote database to backups/lip-db-<timestamp>.sql and
# uploads a copy to the lip-files R2 bucket under backups/.
$ErrorActionPreference = 'Stop'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir "lip-db-$stamp.sql"

Write-Host "Exporting D1 database to $file" -ForegroundColor Cyan
npx wrangler d1 export lip-db --remote --output $file --config worker/wrangler.toml
if ($LASTEXITCODE -ne 0) { throw 'D1 export failed.' }

Write-Host 'Uploading backup to R2 (lip-files/backups/)' -ForegroundColor Cyan
npx wrangler r2 object put "lip-files/backups/lip-db-$stamp.sql" --file $file --remote
if ($LASTEXITCODE -ne 0) { Write-Warning 'R2 upload failed - local backup file kept.' } else { Write-Host 'Backup complete.' -ForegroundColor Green }
