#!/bin/bash
# Deploy completo de SanLuca en VPS
# Uso: bash /var/www/sanluca/scripts/deploy-vps.sh
# IMPORTANTE: antes de ejecutar, hacer git push desde la máquina local

set -e

APP_DIR="/var/www/sanluca"
PM2_APP="sanluca"

echo "════════════════════════════════════════"
echo "  SanLuca — Deploy completo"
echo "════════════════════════════════════════"

# ── 1. Directorio
cd "$APP_DIR"

# ── 2. Git pull (descartar cambios locales para no bloquear el merge)
echo ""
echo "▶ [1/7] Actualizando código..."
git stash
git pull origin main

# ── 3. Dependencias
echo ""
echo "▶ [2/7] Instalando dependencias..."
npm install

# ── 4. Prisma
echo ""
echo "▶ [3/7] Generando Prisma Client y aplicando migraciones..."
npx prisma generate
npx prisma migrate deploy

# ── 5. Actualizar menú brunch en BD
echo ""
echo "▶ [4/7] Actualizando menú brunch en base de datos..."
npx tsx scripts/update-menu-brunch.ts

# ── 6. Build (limpiar caché primero para evitar stale assets)
echo ""
echo "▶ [5/7] Compilando Next.js..."
rm -rf .next
npm run build

# ── 7. Copiar assets estáticos al standalone
#    Next.js standalone NO copia public/ ni .next/static/ automáticamente.
#    Sin este paso el sitio carga sin estilos ni imágenes.
echo ""
echo "▶ [6/7] Copiando assets estáticos al standalone..."
rsync -a --delete public/       .next/standalone/public/
rsync -a --delete .next/static/ .next/standalone/.next/static/

# ── 8. Reiniciar PM2 (o arrancar si no existe)
#    Nginx debe apuntar a 127.0.0.1:3000 (NO localhost — resuelve a IPv6 y da 502)
echo ""
echo "▶ [7/7] Reiniciando servicio PM2..."
if pm2 describe "$PM2_APP" > /dev/null 2>&1; then
    pm2 restart "$PM2_APP"
else
    pm2 start .next/standalone/server.js --name "$PM2_APP"
fi
pm2 save

echo ""
echo "▶ Estado del servicio:"
pm2 status "$PM2_APP"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Deploy completado exitosamente"
echo "════════════════════════════════════════"
