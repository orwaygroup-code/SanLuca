#!/bin/sh
set -e

echo "⏳ Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations done. Starting app..."
exec node server.js
