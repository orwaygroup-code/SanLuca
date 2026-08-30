#!/usr/bin/env bash
# SanLuca VPS deploy — uso: bash deploy.sh
# Ejecuta el flujo completo y se detiene al primer error.
set -euo pipefail

APP_DIR="/var/www/sanluca"
PM2_NAME="sanluca"

# Este script se ejecuta a sí mismo desde una copia fuera del repo.
#
# Más abajo hay un `git pull` que puede reescribir este mismo archivo, y bash
# lee los scripts de forma perezosa, por desplazamiento de bytes: si el archivo
# cambia de tamaño a media ejecución, bash sigue leyendo desde un offset que
# ahora cae en mitad de otra instrucción. Copiarse y re-ejecutarse elimina el
# problema de raíz.
if [ "${DEPLOY_REEXEC:-}" != "1" ]; then
  SELF_COPY="$(mktemp /tmp/sanluca-deploy.XXXXXX.sh)"
  cp "$0" "$SELF_COPY"
  export DEPLOY_REEXEC=1
  bash "$SELF_COPY" "$@"
  STATUS=$?
  rm -f "$SELF_COPY"
  exit $STATUS
fi

cd "$APP_DIR"

log() { echo -e "\n\033[1;33m▶ $*\033[0m"; }
ok()  { echo -e "\033[1;32m✓ $*\033[0m"; }
warn(){ echo -e "\033[1;31m✗ $*\033[0m"; }

# 0. El servidor es una copia de solo lectura del repo.
#
# El historial guarda dos commits de "rescate" (ae4c01a en mayo, 258fec1 en
# junio) de trabajo escrito directo aquí y recuperado a mano. Cada `git pull`
# de este script pone en riesgo lo que esté sin commitear en el servidor, así
# que se bloquea la escritura y se aborta si aparece trabajo local.
log "Comprobaciones previas"

HOOK=".git/hooks/pre-commit"
if [ ! -f "$HOOK" ]; then
  printf '#!/bin/sh\necho "Este checkout es de solo lectura. Trabaja en local y despliega."\nexit 1\n' > "$HOOK"
  chmod +x "$HOOK"
  ok "Instalado el bloqueo de commits en el servidor"
fi

# Cambios locales sin commitear (package-lock se ignora: npm lo reescribe solo)
DIRTY="$(git status --porcelain -- . ':(exclude)package-lock.json')"
if [ -n "$DIRTY" ]; then
  warn "Hay cambios sin commitear en $APP_DIR. El pull los perdería."
  echo "$DIRTY"
  echo "Guárdalos (git stash) o súbelos desde tu máquina antes de desplegar."
  exit 1
fi

# Desplegar algo que no sea main deja el servidor en un estado que nadie puede
# reproducir desde el repo.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  warn "El servidor está en la rama '$BRANCH', no en main. Se detiene."
  exit 1
fi
ok "Árbol limpio y en main"

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

# 3b. RLS policies (idempotentes — re-ejecutables sin riesgo)
if [ -f prisma/sql/rls.sql ]; then
  log "Aplicando RLS policies"
  sudo -u postgres psql sanluca_db -v ON_ERROR_STOP=1 -f prisma/sql/rls.sql >/dev/null
  ok "RLS aplicado"
fi

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

# Sello del commit desplegado, junto al BUILD_ID que ya lee /api/version.
# Con esto "qué está corriendo en producción" se responde con un curl en vez
# de una sesión SSH.
DEPLOYED_SHA="$(git rev-parse --short HEAD)"
echo "$DEPLOYED_SHA" > .next/COMMIT_SHA
cp .next/BUILD_ID .next/standalone/.next/BUILD_ID 2>/dev/null || true
echo "$DEPLOYED_SHA" > .next/standalone/.next/COMMIT_SHA
ok "Assets copiados (commit $DEPLOYED_SHA)"

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
if [ -f scripts/migrate-cartas.ts ]; then
  log "Migración de cartas del menú (turno/carta)"
  npx tsx scripts/migrate-cartas.ts
  ok "Cartas migradas"
fi

# 7. Restart
log "PM2 restart"
pm2 restart "$PM2_NAME" --update-env
pm2 save >/dev/null
ok "PM2 reiniciado"

# 8. Verificación: la app que quedó sirviendo debe reportar ESTE commit.
#
# Cierra el hueco que más confusión ha causado: un `git pull` que dice "Already
# up to date" y un reinicio exitoso se ven idénticos tanto si el cambio llegó
# como si nunca se mergeó a main.
log "Verificando el commit en servicio"
SERVED=""
for _ in $(seq 1 20); do
  SERVED="$(curl -fsS --max-time 3 http://127.0.0.1:3000/api/version 2>/dev/null \
            | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')"
  [ -n "$SERVED" ] && break
  sleep 1
done

if [ -z "$SERVED" ]; then
  warn "La app no respondió en /api/version. Revisa: pm2 logs $PM2_NAME"
  exit 1
fi

if [ "$SERVED" != "$DEPLOYED_SHA" ]; then
  warn "La app sirve el commit $SERVED, pero se desplegó $DEPLOYED_SHA."
  warn "El proceso quedó con un build anterior. Revisa: pm2 logs $PM2_NAME"
  exit 1
fi
ok "En servicio: $SERVED"

echo -e "\n\033[1;32m🎉 Deploy completo — commit $DEPLOYED_SHA en producción\033[0m"
pm2 status "$PM2_NAME" | tail -5
