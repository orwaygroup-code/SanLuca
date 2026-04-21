#!/bin/bash
# Deploy completo de SanLuca en VPS
# Uso: bash scripts/deploy-vps.sh
# Ejecutar desde: /var/www/sanluca

set -e  # Detener si cualquier comando falla

APP_DIR="/var/www/sanluca"
PM2_APP="sanluca"

echo "════════════════════════════════════════"
echo "  SanLuca — Deploy completo"
echo "════════════════════════════════════════"

# ── 1. Ir al directorio
cd "$APP_DIR"

# ── 2. Git pull
echo ""
echo "▶ [1/7] Actualizando código..."
git pull origin main

# ── 3. Instalar dependencias (solo si package-lock cambió)
echo ""
echo "▶ [2/7] Instalando dependencias..."
npm ci --omit=dev

# ── 4. Generar Prisma Client
echo ""
echo "▶ [3/7] Generando Prisma Client..."
npx prisma generate

# ── 5. Actualizar menú brunch en DB
echo ""
echo "▶ [4/7] Actualizando menú brunch en base de datos..."
npx tsx scripts/update-menu-brunch.ts

# ── 6. Build de Next.js
echo ""
echo "▶ [5/7] Compilando Next.js..."
npm run build

# ── 7. Copiar archivos estáticos al standalone
echo ""
echo "▶ [6/7] Copiando assets estáticos..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# ── 8. Reiniciar PM2
echo ""
echo "▶ [7/7] Reiniciando servicio PM2..."
pm2 restart "$PM2_APP"
pm2 save

# ── 9. Limpiar caché de Next.js (opcional, por si hay stale cache)
echo ""
echo "▶ Limpiando caché..."
rm -rf .next/cache 2>/dev/null || true

# ── 10. Verificar estado
echo ""
echo "▶ Estado del servicio:"
pm2 status "$PM2_APP"

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Deploy completado exitosamente"
echo "════════════════════════════════════════"
