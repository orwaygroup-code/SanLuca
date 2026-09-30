# Runbook — Rotar `BOT_API_KEY` sin dejar mudo al bot

> Escrito el 29 sep 2026. La llave vieja es `sanluca-bot-2026`: adivinable por
> construcción (nombre + "bot" + año), en texto plano en el crontab y en el historial
> de ejecuciones de n8n. Protege **12 rutas** y ninguna tiene límite de tasa.

## Regla que ordena todo

**Nunca cambies la configuración y el secreto al mismo tiempo.**

- **Fase 1 — mover sin cambiar.** La llave vieja pasa de estar escrita en 7 nodos de n8n a
  vivir en UNA credencial. El valor no cambia, así que el bot no puede romperse por esto.
  Se puede hacer de a un nodo por día.
- **Fase 2 — rotar.** Ya con un solo lugar, cambiar el valor son minutos.

## Dónde se valida la llave (12 rutas)

`/api/admin/jobs/auto-tag` · `close-day` · `shift-close` (las 3 del cron) y
`/api/bot/reservation` · `reservations` · `pedido` · `messages` · `messages/delete-by-mid` ·
`menu` · `reply` · `analyze-transfer` · `/api/whisper`.

`/api/bot/reply` y `/api/bot/menu` **no aparecen en ningún nodo de n8n**. Posibles rutas
muertas — NO borrarlas sin comprobar los logs de nginx primero (ver el caso Whisper: se
borró por parecer código muerto y el bot quedó 12 días sin transcripción).

## Estado antes de empezar

```bash
grep -n '^BOT_API_KEY' /var/www/sanluca/.env; crontab -l | grep -o 'x-bot-key: [^"]*' | sort -u; sqlite3 -readonly ~/.n8n/database.sqlite "SELECT (length(nodes)-length(replace(nodes,'sanluca-bot-2026','')))/length('sanluca-bot-2026') AS nodos_con_llave_vieja FROM workflow_entity WHERE id='qwN0IYjX8soUDGGo';"
```

Verificado el 29 sep: `.env` = vieja, cron = vieja (un solo valor), n8n = **7** nodos.

---

## Fase 1 — en n8n (riesgo cero, incremental)

### 1. Crear la credencial

Credentials → Add credential → **Header Auth**:

| campo | valor |
|---|---|
| Name | `x-bot-key` |
| Value | `sanluca-bot-2026`  ← **la vieja, a propósito** |
| nombre de la credencial | `SanLuca — x-bot-key` |

No reusar `Header Auth account` (`EaZEQTL9m0XyzoHm`): es del nodo `OpenAI API Test`, su
header es el de OpenAI. Dejarla en paz.

### 2. Migrar los 7 nodos

Workflow `qwN0IYjX8soUDGGo` — «San Luca AI Multi-Plataforma v36».

En cada nodo: **Authentication** → `Generic Credential Type` → **Generic Auth Type** →
`Header Auth` → elegir `SanLuca — x-bot-key` → bajar a **Headers** (o «Header Parameters»
en nodos de versión vieja) y **borrar el renglón `x-bot-key`**; si no queda ningún otro,
apagar **Send Headers**. Guardar el workflow.

Dejar el header manual *y* la credencial manda la cabecera dos veces: que quede una sola
fuente.

| # | nodo | ruta | cómo se prueba desde el teléfono |
|---|---|---|---|
| 1 | `HTTP_Log_BD` | `/api/bot/messages` | cualquier mensaje al bot |
| 2 | `HTTP_Consultar_Reservas_VPS` | `/api/bot/reservations` | preguntarle por tus reservas |
| 3 | `HTTP_Enviar_Reserva` | `/api/bot/reservation` | reservar por el bot (y borrarla) |
| 4 | `HTTP_Enviar_Pedido` | `/api/bot/pedido` | un pedido de prueba |
| 5 | `HTTP_Whisper_Proxy` | `/api/whisper` | mandarle una **nota de voz** |
| 6 | `HTTP_Analizar_Transferencia` | `/api/bot/analyze-transfer` | mandarle **foto de un comprobante** |
| 7 | `Borrar_De_BD` | `/api/bot/messages/delete-by-mid` | borrar un mensaje ya enviado |

### 3. Medir el avance con números

```bash
sqlite3 -readonly ~/.n8n/database.sqlite "SELECT (length(nodes)-length(replace(nodes,'sanluca-bot-2026','')))/length('sanluca-bot-2026') AS quedan FROM workflow_entity WHERE id='qwN0IYjX8soUDGGo';"
```

Baja de **7 a 0**. Si tras migrar los siete no da 0, la llave está además en otro sitio del
workflow (un nodo Code, un Set) y hay que encontrarla antes de la Fase 2.

Si un nodo falla: se ve aislado en el historial de ejecuciones y se arregla volviendo a
poner el header a mano. El resto del bot sigue vivo porque la llave no cambió.

---

## Fase 2 — rotar (solo cuando el contador diga 0)

Todo en la **misma terminal del VPS**, sin cerrarla: `$NEW` vive en esa sesión.

```bash
NEW=$(openssl rand -hex 24) && echo "$NEW"
```

Hex, no base64: `/` y `+` rompen los `sed`. Y que sea una llave **nueva**, no una que haya
pasado por un chat o un log.

```bash
cd /var/www/sanluca && cp .env .env.bak-$(date -u +%Y%m%d-%H%M) && sed -i "s|^BOT_API_KEY=.*|BOT_API_KEY=$NEW|" .env && grep '^BOT_API_KEY' .env
```

Editar `.env` **no afecta a la app corriendo** (Next lee el entorno al arrancar). Hasta aquí
nada cambió en servicio.

```bash
crontab -l | sed "s|x-bot-key: [^\"]*|x-bot-key: $NEW|" > /tmp/cron.rot && crontab /tmp/cron.rot && crontab -l | grep -o 'x-bot-key: [^"]*'
```

Desde aquí los 3 trabajos de cron fallan con 401 hasta el reinicio. `shift-close` (cada 15
min) y `auto-tag` se recuperan solos; **`close-day` NO**: corre a las 06:05 UTC = 00:05 de
México y si se salta, se salta.

**Ahora n8n:** cambiar el campo *Value* de `SanLuca — x-bot-key`. Un solo campo, sin
reiniciar n8n, efecto inmediato. Volver a la terminal en seguida:

```bash
pm2 restart sanluca --update-env
```

Ese hueco —entre guardar la credencial y el restart— es el único en que el bot no responde.
Con la Fase 1 hecha son segundos.

### Verificación (no es opcional)

```bash
curl -s -o /dev/null -w "nueva=%{http_code}\n" -X POST -H "x-bot-key: $NEW" http://127.0.0.1:3000/api/admin/jobs/shift-close && curl -s -o /dev/null -w "vieja=%{http_code}\n" -X POST -H "x-bot-key: sanluca-bot-2026" http://127.0.0.1:3000/api/admin/jobs/shift-close
```

`nueva=200` y `vieja=401`. Si la vieja no da 401, la rotación no surtió efecto.

El curl solo prueba las 3 rutas del cron. **Mandar un mensaje real al bot** es lo que prueba
las otras 9 — y una nota de voz, que es la que se murió en septiembre.

```bash
rm -f /var/www/sanluca/.env.bak-*
```

---

## Si algo sale mal a media Fase 2

Volver atrás es alinear todo en la llave vieja:

```bash
crontab -l | sed "s|x-bot-key: [^\"]*|x-bot-key: sanluca-bot-2026|" > /tmp/cron.back && crontab /tmp/cron.back && sed -i "s|^BOT_API_KEY=.*|BOT_API_KEY=sanluca-bot-2026|" /var/www/sanluca/.env && pm2 restart sanluca --update-env
```

Y regresar el *Value* de la credencial a `sanluca-bot-2026`.

## Pendientes relacionados

- **El historial de ejecuciones de n8n (1.2 GB) conserva la llave vieja** en los datos de
  cada ejecución pasada. Hasta purgarlo, la llave sigue escrita en disco. Purgar
  (`EXECUTIONS_DATA_PRUNE`) + `VACUUM` antes de respaldar `~/.n8n`, o el respaldo nocturno
  pasa de 2 MB a más de un giga.
- **`~/.n8n` no está respaldado.** Ahí viven los workflows y TODAS las credenciales,
  incluidos los tokens de Meta, cifradas con `N8N_ENCRYPTION_KEY` (`~/.n8n/config`).
- **`BOT_API_KEY` no está en `.env.example`.** Es la llave con más consumidores del proyecto
  y no está documentada: la instancia del próximo restaurante nacerá sin ella.
