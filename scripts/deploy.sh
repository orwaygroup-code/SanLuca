#!/bin/bash
set -e

cd /var/www/sanluca

echo "▶ git pull"
git pull origin main

echo "▶ npm install"
npm install

echo "▶ prisma generate"
npx prisma generate

echo "▶ build"
npm run build

echo "▶ copiando archivos estáticos"
rsync -a --delete public/       .next/standalone/public/
rsync -a --delete .next/static/ .next/standalone/.next/static/

echo "▶ pm2 restart"
pm2 restart sanluca
pm2 save

echo "✅ Deploy completado"
