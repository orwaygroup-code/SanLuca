# Runbook — Deploy del sistema de Tags

**Versión:** 1.0 · **Fecha:** 2026-05-20 · **Feature branch:** main (commits 421e24a..1919089)

Spec completa: `Wiki (docs)/01 - Modules/Conversation Tags.md`.

---

## 0. Pre-flight

Lo que va al VPS este deploy:
- Schema Prisma: **tabla nueva `Tag`** + **tabla nueva `ConversationTag`** + columna `tags[]` (relación inversa) en `WhatsAppConversation`. No hay cambios destructivos.
- 7 endpoints API (catálogo + por-conversación + extensión de existentes).
- 4 componentes UI + página nueva `/crm/tags` + nav item.
- Script idempotente de seed.

**Riesgo principal:** las tablas nuevas pueden no tener políticas RLS configuradas. Si el rol `sanluca_app` no tiene grants, los endpoints fallarán con 500 (cubierto en §5 troubleshooting).

---

## 1. Backup de DB

Antes de tocar el schema:

```bash
ssh tu-vps
cd /var/www/sanluca

# Opción A (preferida) — sudo postgres evita peer auth
sudo -u postgres pg_dump sanluca_db > ~/backup-pre-tags-$(date +%Y%m%d_%H%M).sql

# Opción B — credenciales del .env si A falla
PGPASSWORD=$(grep '^DATABASE_URL=' .env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|') \
  pg_dump -h localhost -U sanluca_user sanluca_db > ~/backup-pre-tags-$(date +%Y%m%d_%H%M).sql

ls -lh ~/backup-pre-tags-*.sql   # debe pesar varios cientos de KB
```

---

## 2. Apply schema

```bash
git pull origin main      # commits 421e24a..1919089
npm run db:push           # AGREGA Tag + ConversationTag — sin warning de data loss
```

Output esperado: `🚀  Your database is now in sync with your Prisma schema.`

Si pide confirmar algo destructivo (`will be lost`), **NO confirmar** y pegar la salida.

Verificar las tablas:
```bash
sudo -u postgres psql sanluca_db -c '\d "Tag"' | head -15
sudo -u postgres psql sanluca_db -c '\d "ConversationTag"' | head -15
```

Debe mostrar las columnas del schema (id, name, color, isActive, etc.).

---

## 3. Seed de tags default

```bash
npx tsx scripts/seed-tags.ts
```

Output esperado:
```
[seed-tags] created=10 skipped=0 total=10
```

Idempotente — re-correrlo dice `created=0 skipped=10` y no toca ediciones manuales.

---

## 4. Build + restart

```bash
bash /var/www/sanluca/deploy.sh
```

Verificar:
```bash
pm2 describe sanluca | grep -E "(uptime|created at|status)"
# uptime debe ser segundos, created at de ahora.
```

---

## 5. Smoke tests post-deploy

> **Pre-requisito:** necesitas la cookie `sl_session` de un usuario ADMIN. Sácala del navegador con DevTools → Application → Cookies, o haciendo login y guardándola.
>
> Sustituye `<COOKIE>` por el valor del cookie y `<PHONE>` por un teléfono real de la DB (cualquiera con conversación WA existente).

### 5.1 Catálogo: listar tags (debe haber 10 del seed)
```bash
curl -s 'https://sanlucaristorante.com/api/crm/tags' \
  -H "Cookie: sl_session=<COOKIE>" | jq '.data.tags | length'
```
Esperado: `10`.

### 5.2 Catálogo: crear un tag
```bash
curl -s -X POST 'https://sanlucaristorante.com/api/crm/tags' \
  -H "Cookie: sl_session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke","color":"blue","description":"Tag creado por runbook"}' | jq
```
Esperado: `{"success":true,"data":{"tag":{...,"name":"Smoke"...}}}`. Anota el `id`.

### 5.3 Catálogo: rename y verificar 409 al colisionar
```bash
TAG_ID="<id del paso anterior>"
curl -s -X PATCH "https://sanlucaristorante.com/api/crm/tags/$TAG_ID" \
  -H "Cookie: sl_session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"name":"VIP"}' | jq
```
Esperado: `{"success":false,"error":"name_already_exists"}` (porque "VIP" ya existe del seed).

### 5.4 Aplicar tag a conversación
```bash
PHONE="<teléfono real con conversación>"
curl -s -X POST "https://sanlucaristorante.com/api/crm/whatsapp/conversations/$PHONE/tags" \
  -H "Cookie: sl_session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d "{\"tagId\":\"$TAG_ID\"}" | jq
```
Esperado: `201 {"success":true,"data":{"tag":{...},"conversationTag":{...}}}`.

### 5.5 Listar tags aplicados
```bash
curl -s "https://sanlucaristorante.com/api/crm/whatsapp/conversations/$PHONE/tags" \
  -H "Cookie: sl_session=<COOKIE>" | jq '.data.tags[].name'
```
Esperado: la lista debe incluir `"Smoke"`.

### 5.6 Verificar tags[] en la lista de conversaciones
```bash
curl -s 'https://sanlucaristorante.com/api/crm/whatsapp/conversations' \
  -H "Cookie: sl_session=<COOKIE>" | jq '.data[] | select(.phone=="'$PHONE'") | .tags'
```
Esperado: array con el tag "Smoke".

### 5.7 Filtrar conversaciones por tag
```bash
curl -s "https://sanlucaristorante.com/api/crm/whatsapp/conversations?tag=$TAG_ID" \
  -H "Cookie: sl_session=<COOKIE>" | jq '.data | length'
```
Esperado: `>= 1` (al menos la conversación que acabas de etiquetar).

### 5.8 Quitar tag
```bash
curl -s -X DELETE "https://sanlucaristorante.com/api/crm/whatsapp/conversations/$PHONE/tags/$TAG_ID" \
  -H "Cookie: sl_session=<COOKIE>" | jq
```
Esperado: `{"success":true}`.

Re-correr el mismo DELETE → también `{"success":true}` (es idempotente — confirma el comportamiento documentado).

### 5.9 Soft delete del tag de prueba
```bash
curl -s -X DELETE "https://sanlucaristorante.com/api/crm/tags/$TAG_ID" \
  -H "Cookie: sl_session=<COOKIE>" | jq
```
Esperado: `{"success":true,"data":{"id":"...","isActive":false}}`.

### 5.10 UI: verificación visual

1. `https://sanlucaristorante.com/crm/tags` carga. Debe mostrar al menos los 10 tags del seed.
2. Crear un tag desde el form. Editar inline. Desactivar/reactivar.
3. `https://sanlucaristorante.com/crm/whatsapp` carga. En la lista izquierda, cualquier conversación con tags debe mostrar las pills debajo del preview.
4. Abrir una conversación. Debajo del header se ve el editor "Tags" con las pills + botón "+ Tag".
5. Click en "+ Tag" → picker abre, escribir texto, autocomplete filtra. Crear nuevo tag funciona. Aplicar tag existente funciona. Quitar tag (×) funciona.

---

## 6. Rollback

Si algo falla irremediablemente:

```bash
# 1. Revertir commits del feature (último → primero)
cd /var/www/sanluca
git revert --no-edit 1919089 2d9d97f e783610 23a01d8 939d116 c9b8f29 3c95f09 421e24a
git push origin main

# 2. Re-aplicar el schema viejo desde el backup
sudo -u postgres psql sanluca_db < ~/backup-pre-tags-<TIMESTAMP>.sql

# 3. Rebuild + restart
bash /var/www/sanluca/deploy.sh
```

> **Nota:** el `git revert` deja las **tablas Tag/ConversationTag huérfanas** en la DB. Si el rollback del schema desde el backup no es viable, se puede dejar las tablas vacías sin código que las use — no rompen nada porque ningún endpoint las consultará.

---

## 7. VERIFY ON DEPLOY (markers dejados en el código)

`grep -rn "VERIFY ON DEPLOY" app/ lib/ components/ scripts/` arroja:

| Archivo | Línea | Qué verificar |
|---|---|---|
| `app/api/crm/tags/route.ts` | 34 | RLS sobre las tablas nuevas `Tag` y `ConversationTag` — si el rol `sanluca_app` no tiene grants, `GET/POST/PATCH/DELETE` fallarán con 500. Fix rápido: usar `prisma` admin client en lugar de `withApp()`, o añadir policies. **Smoke test 5.1** lo detecta. |
| `app/api/crm/tags/route.ts` | 102 | El catch del POST expone 500 si RLS bloquea INSERT — revisar `pm2 logs sanluca` después del primer POST en VPS. |
| `app/api/crm/whatsapp/conversations/[phone]/tags/route.ts` | 142 | UX: el POST con `{name}` reactiva tags desactivados implícitamente. Confirmar con el admin que es el comportamiento deseado — si no, cambiar el `update: { isActive: true }` a `update: {}` para que falle con 404 o muestre alerta. |

### Si los smoke tests fallan con 500 / "Internal Server Error":

1. `pm2 logs sanluca --err --lines 50 --nostream` → buscar mensaje de Prisma.
2. Si dice `permission denied for table "Tag"` o `... for relation "ConversationTag"`:
   - Es el problema de RLS. Solución rápida (no merge a main, solo en VPS para pruebas): editar los 4 endpoints nuevos para usar `prisma` admin client en vez de `withApp()`.
   - Solución correcta: añadir policies SQL en `prisma/sql/` para las dos tablas nuevas y aplicarlas.
3. Si dice otra cosa: pegar el stack trace en la conversación con Claude para diagnóstico.

---

## 8. Post-deploy: validación con humanos

- Pedir a un admin que abra `/crm/tags` y cree un tag personalizado.
- Pedir que abra una conversación en `/crm/whatsapp` y le aplique 2-3 tags (mix de seed + custom).
- Confirmar que las pills se ven en la lista izquierda.
- Confirmar que recargar la página no pierde los tags (persistencia OK).

---

## 9. Lo que NO incluye este deploy (next prompts)

- Rediseño tabla del inbox (columnas Contact / Status / Tags / Score / Last Contact).
- Filtro multi-tag en `/crm/marketing` + dispatch real.
- Auto-tagging por reglas (cron).
- Sistema paralelo `UserTag`.

Si en producción aparecen necesidades de estas features, abrir prompts separados.
