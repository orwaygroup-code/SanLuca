#!/usr/bin/env bash
# SanLuca VPS deploy — uso: bash deploy.sh
# Ejecuta el flujo completo y se detiene al primer error.
set -euo pipefail

APP_DIR="/var/www/sanluca"
PM2_NAME="sanluca"

cd "$APP_DIR"

log() { echo -e "\n\033[1;33m▶ $*\033[0m"; }
ok()  { echo -e "\033[1;32m✓ $*\033[0m"; }

# 1. Pull (resuelve package-lock automáticamente)
log "Git pull"
if ! git diff --quiet -- package-lock.json 2>/dev/null; then
  git stash push -m "auto-deploy" -- package-lock.json
  STASHED=1
else
  STASHED=0
fi
git pull
[ "$STASHED" = "1" ] && git stash drop >/dev/null 2>&1 || true
ok "Pull listo"

# 2. Dependencias
log "npm install"
npm install --no-audit --no-fund
ok "Deps instaladas"

# 3. Prisma (idempotente — no hace nada si schema sin cambios)
log "Prisma db push + generate"
npx prisma db push --accept-data-loss=false --skip-generate
npx prisma generate
ok "Prisma sincronizado"

# 4. Build
log "Next build"
NODE_OPTIONS="--max-old-space-size=2048" npm run build
[ -f .next/standalone/server.js ] || { echo "❌ standalone/server.js no se generó"; exit 1; }
ok "Build OK"

# 5. Assets para standalone (Next no los copia solo)
log "Copiando public + static a standalone"
rm -rf .next/standalone/public
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/
ok "Assets copiados"

# 6. Scripts de seed/data (idempotentes)
if [ -f scripts/update-menu-brunch.ts ]; then
  log "Aplicando update-menu-brunch.ts"
  npx tsx scripts/update-menu-brunch.ts
  ok "Menú actualizado"
fi
if [ -f scripts/backfill-created-by.ts ]; then
  log "Backfill Reservation.createdById"
  npx tsx scripts/backfill-created-by.ts
  ok "Backfill completo"
fi

# 7. Restart
log "PM2 restart"
pm2 restart "$PM2_NAME" --update-env
pm2 save >/dev/null
ok "PM2 reiniciado"

echo -e "\n\033[1;32m🎉 Deploy completo\033[0m"
pm2 status "$PM2_NAME" | tail -5
