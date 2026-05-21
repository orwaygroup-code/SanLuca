# Runbook — Auto-tagging deploy (fase 2)

Sistema de auto-tagging para conversaciones de WhatsApp y perfiles de usuario.
Spec completa: `Wiki (docs)/01 - Modules/Auto-tagging.md`.

Commits incluidos: `fe2fe6f` (schema) → `fbf4a20` (UI). Total: 7 commits granulares.

---

## Pre-requisitos

- [ ] **OPENAI_API_KEY** lista (formato `sk-proj-XXXXXXXX`). Pedirla al admin.
- [ ] Sistema de tags fase 1 deployado y funcionando (verificar `/crm/tags` carga).
- [ ] PM2 / Postgres / cron daemon funcionando en el VPS.

---

## §1 — Backup DB previo

```bash
cd /var/www/sanluca
sudo -u postgres pg_dump sanluca_db > /tmp/backup-pre-auto-tagging-$(date +%Y%m%d-%H%M).sql
ls -lh /tmp/backup-pre-auto-tagging-*.sql
```

**ESPERADO:** archivo de varios cientos de KB. Si pesa 0 bytes → STOP.

---

## §2 — Configurar `OPENAI_API_KEY` en `.env`

**ANTES** de hacer `git pull` (porque `deploy.sh` corre el build con el `.env`
actual):

```bash
nano /var/www/sanluca/.env
```

Añadir al final:

```
# OPENAI — auto-tagging LLM (fase 2 de tags)
OPENAI_API_KEY=sk-proj-XXXXXXXX
```

Guardar (`Ctrl+O` → `Enter` → `Ctrl+X`).

> Sin esta variable, el cron LLM pass falla con "OPENAI_API_KEY no está
> definido en el entorno". El rules pass sigue funcionando. Lo verás en
> los logs del primer run del cron.

---

## §3 — Pull + schema

```bash
cd /var/www/sanluca
git pull origin main
# ESPERADO: trae hasta el commit más reciente del feature (fbf4a20 o
# posterior si hubo follow-ups). 20+ archivos cambiados.
```

```bash
npm run db:push
# ESPERADO: "Your database is now in sync with your Prisma schema. Done"
# Si pide confirmar "data loss" → STOP, pegar la salida y diagnosticar.
```

Verificar tablas/columnas nuevas:

```bash
sudo -u postgres psql sanluca_db -c '\d "UserTag"' | head -20
sudo -u postgres psql sanluca_db -c '\d "ConversationTag"' | grep -i source
```

**ESPERADO:**
- `UserTag` con columnas `id`, `userId`, `tagId`, `source`, `appliedAt`, `appliedById` + índices.
- `ConversationTag` con columna `source` tipo `TagSource` default `MANUAL`.

---

## §4 — Build + restart con env actualizada

```bash
bash deploy.sh
```

`deploy.sh` corre `npm install` (instala el paquete `openai` nuevo),
`prisma generate`, RLS sql, build, copia de assets y `pm2 restart sanluca`.

**Verificar:**

```bash
pm2 describe sanluca | grep -E "(uptime|created at|status)"
# uptime de segundos, created at de ahora.

curl -s https://sanlucaristorante.com/api/health
# Debe responder healthy con timestamp de ahora.
```

---

## §5 — Smoke tests post-deploy

> Necesitas tu cookie `sl_session` ADMIN (ver runbook fase 1 §5).

### §5.1 — Endpoints CRUD UserTag

```bash
export COOKIE="<sl_session>"
# Lista users (sacar un userId real)
curl -s 'https://sanlucaristorante.com/api/crm/users' \
  -H "Cookie: sl_session=$COOKIE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['users'][0]['id'], '·', d['users'][0]['name'])"

# Sustituir <USER_ID> y <TAG_ID> (sacar uno del catálogo con /api/crm/tags)
export USER_ID="<USER_ID>"
export TAG_ID="<TAG_ID>"

# Aplicar tag MANUAL al user
curl -s -X POST "https://sanlucaristorante.com/api/crm/users/$USER_ID/tags" \
  -H "Cookie: sl_session=$COOKIE" -H "Content-Type: application/json" \
  -d "{\"tagId\":\"$TAG_ID\"}"

# Listar tags del user (debe aparecer el aplicado con source: MANUAL)
curl -s "https://sanlucaristorante.com/api/crm/users/$USER_ID/tags" \
  -H "Cookie: sl_session=$COOKIE"

# Promover a... mismo source (operación no-op pero verifica que el PATCH funciona)
curl -s -X PATCH "https://sanlucaristorante.com/api/crm/users/$USER_ID/tags/$TAG_ID" \
  -H "Cookie: sl_session=$COOKIE" -H "Content-Type: application/json" \
  -d '{"source":"MANUAL"}'

# Quitar el tag (idempotente — re-DELETE también devuelve success)
curl -s -X DELETE "https://sanlucaristorante.com/api/crm/users/$USER_ID/tags/$TAG_ID" \
  -H "Cookie: sl_session=$COOKIE"
```

### §5.2 — Endpoint cron (manual trigger)

```bash
# Debe responder success:true con estadísticas. Primera vez genera AUTO_RULE
# en masa (oleada esperada).
curl -s -X POST -H "x-bot-key: $(grep BOT_API_KEY /var/www/sanluca/.env | cut -d= -f2 | tr -d \")" \
  http://127.0.0.1:3000/api/admin/jobs/auto-tag | python3 -m json.tool | head -40
```

**ESPERADO:**
- `success: true`
- `rulesApplied > 0` (aplica VIP/Inactivo/Cumpleañero/Grupo grande a usuarios elegibles)
- `rulesRemoved: 0` en el primer run (nada que limpiar todavía)
- `llmApplied` y `llmConsidered` dependen del volumen de WhatsApp de las
  últimas 7d. Si tienes 50 conversaciones activas, espera ~$0.02 USD en el run.
- `errors: []` o con detalle si OpenAI rechaza algo.

### §5.3 — Trigger en tiempo real

Crea una reserva nueva desde el panel admin o desde el sitio público.
En los logs:

```bash
pm2 logs sanluca --lines 50 --nostream | grep AUTO_TAG
```

**ESPERADO:** ver línea `[AUTO_TAG] reEval Inactivo: removed from user=<id>`
o `applied to user=<id>` según el estado del cliente.

### §5.4 — UI visual (en navegador)

1. `/crm/whatsapp` → seleccionar una conversación con `userId` → ver DOS bloques:
   - **CLIENTE** (UserTag, con badge 👤/⚙️/🤖 por tag)
   - **TAGS** (ConversationTag, idem)
2. Aplicar/quitar tag desde cada uno.
3. Click en 🔒 sobre un tag AUTO → debe pasar a 🔓 (MANUAL).
4. `/crm/usuarios` → seleccionar un user → ver el bloque "CLIENTE" con sus UserTag.
5. `/crm/tags` → click en el filtro "⚙️ Reglas" → solo los tags VIP/Inactivo/
   Cumpleañero/Grupo grande deberían aparecer (los que tienen al menos 1 AUTO_RULE).

---

## §6 — Configurar cron del VPS

Editar el crontab del usuario que corre PM2 (en este caso `root`):

```bash
crontab -e
```

Añadir al final:

```cron
# Auto-tagging diario — 02:00 hora MX (08:00 UTC), después del close-day.
0 8 * * * curl -s -X POST -H "x-bot-key: $(grep BOT_API_KEY /var/www/sanluca/.env | cut -d= -f2 | tr -d \")" http://127.0.0.1:3000/api/admin/jobs/auto-tag >> /var/log/sanluca-auto-tag.log 2>&1
```

Asegurarte de que el archivo de log existe:

```bash
touch /var/log/sanluca-auto-tag.log
chmod 644 /var/log/sanluca-auto-tag.log
```

Verificar el crontab:

```bash
crontab -l | grep auto-tag
```

**Validar la próxima ejecución:** la próxima madrugada (02:00 MX = 08:00 UTC)
debe haber un nuevo bloque en `/var/log/sanluca-auto-tag.log`. Si no aparece,
verificar `journalctl -u cron.service --since "2 hours ago"`.

---

## §7 — Rollback (si todo falla)

### §7.1 — Rollback rápido del código

```bash
cd /var/www/sanluca
git log --oneline -10                 # identificar el commit pre-auto-tagging (anterior a fe2fe6f)
git revert --no-edit fe2fe6f^..HEAD   # revierte todos los commits del feature
git push origin main                  # opcional, si quieres que el repo refleje el rollback
bash deploy.sh                        # build con código viejo
```

### §7.2 — Rollback del schema (si el revert del código no basta)

Las tablas/columnas nuevas son aditivas — el código viejo funciona aunque
existan. Pero si quieres limpiarlas:

```bash
# Restaurar el backup completo de §1
sudo -u postgres dropdb sanluca_db
sudo -u postgres createdb sanluca_db
sudo -u postgres psql sanluca_db < /tmp/backup-pre-auto-tagging-<TIMESTAMP>.sql
```

> ⚠️ Esto descarta cualquier dato escrito después del backup. Solo hazlo
> si es estrictamente necesario.

### §7.3 — Desactivar el cron sin tocar código

```bash
crontab -e
# Comentar la línea del auto-tag con #
```

Sirve si quieres pausar el LLM (gasto) sin tocar nada más. Las APIs
manuales siguen funcionando.

---

## §8 — VERIFY ON DEPLOY markers

Grep de los markers que dejé en el código (todos del prompt anterior — para
fase 2 no añadí ninguno crítico nuevo):

```bash
grep -rn "VERIFY ON DEPLOY" /var/www/sanluca/app /var/www/sanluca/lib
```

**Resultado esperado actual:**
- `app/api/crm/tags/route.ts` — RLS sobre Tag/ConversationTag (resuelto en
  positivo en el deploy de fase 1).
- `app/api/crm/whatsapp/conversations/[phone]/tags/route.ts` — UX de upsert
  resucitando tags inactivos (decisión deliberada; sigue válida).

**Edge cases conocidos de fase 2** (no son VERIFY, son comportamientos
documentados):

1. **Hard-delete de MANUAL puede re-aplicar como AUTO_RULE en el próximo cron.**
   Sin tabla de tombstones no podemos distinguir "borrado intencionalmente"
   de "nunca aplicado". Para excluir permanentemente a un user de una regla,
   dejar el tag aplicado con `source: MANUAL`. Documentado en
   `lib/tagRules.ts` (línea con el comentario "Limitación conocida") y en
   `Wiki (docs)/01 - Modules/Auto-tagging.md` §Limitaciones conocidas.

2. **OpenAI SDK instalado en VPS, no local.** Mi máquina local tiene SSL
   inspection bloqueando `npm install openai`. El VPS resuelve durante
   `deploy.sh`. El typecheck local pasa con `// @ts-ignore` en
   `lib/openaiClient.ts:import`.

3. **Race condition cron ↔ trigger.** Improbable (cron es a las 02:00 MX,
   no es ventana de actividad). Las escrituras del cron usan `createMany
   skipDuplicates` y `deleteMany {source: AUTO_RULE}` — safe ante concurrencia.

---

## §9 — Costo y observabilidad

- **Estimado mensual OpenAI:** ~$5 USD (gpt-4o-mini, ~500 conversaciones
  activas × 30 días × $0.00033/conversación). Monitorear vía dashboard
  OpenAI las primeras 2 semanas.
- **Logs:** todo va a `/var/log/sanluca-auto-tag.log` con prefijo `[AUTO_TAG]`.
  Útil: `grep "applied AUTO_RULE \"VIP\"" /var/log/sanluca-auto-tag.log`
  para responder "¿por qué Pedro tiene VIP?".
- **Pase LLM con confianza baja:** el cron solo aplica con `confidence: "high"`.
  Si en 2-3 semanas hay pocos falsos positivos, abrir a `"medium"` editando
  `LLM_REQUIRED_CONFIDENCE` en `lib/autoTagJob.ts`.

---

## Resumen ejecutivo

| Paso | Comando clave | Esperado |
|---|---|---|
| 1 | `pg_dump > /tmp/backup-...` | varios cientos KB |
| 2 | `nano .env` añadir `OPENAI_API_KEY` | guardado |
| 3 | `git pull && npm run db:push` | `in sync` sin data loss |
| 4 | `bash deploy.sh` | build OK + PM2 fresh |
| 5 | Smoke tests curl + UI | success:true en todo |
| 6 | `crontab -e` añadir cron | `crontab -l` confirma |

**Tiempo estimado total:** 15-20 minutos.

**Primera evidencia de éxito real:** la próxima madrugada (02:00 MX), revisar
`/var/log/sanluca-auto-tag.log` y `/crm/whatsapp` para ver la oleada de
tags AUTO_RULE aplicados a usuarios existentes.
