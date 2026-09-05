# Setup local — SanLuca (para un nuevo dev)

Guía para levantar el proyecto en local con **datos reales de producción**.
Stack: Next.js 14 + Prisma + PostgreSQL 16. Comandos en `bash` (Git Bash en Windows);
en PowerShell ajusta `cp`→`copy` y las variables.

> **Nota sobre RLS:** en producción hay dos roles (`sanluca_user` admin + `sanluca_app`
> con Row-Level Security). **En local usamos solo `sanluca_user`** (bypassa RLS) para
> simplificar — es lo que ya corre el equipo. No necesitas `DATABASE_URL_APP`.

---

## 0. Requisitos

- **Git**
- **Node.js 20 LTS** (Next 14 requiere ≥18.17)
- **PostgreSQL 16** (mismo mayor que prod, para que el dump restaure sin fricción)
  - Las tools (`psql`, `pg_restore`) deben estar en el PATH. Si no, usa la ruta del bin,
    p. ej. Windows: `C:\Program Files\PostgreSQL\16\bin\`.

## 1. Clonar, instalar y cambiar a la rama de pruebas

Trabajamos en la rama **`pruebas-local`** (no en `main`). Ahí subimos cambios para que los
pruebes; lo que se valida se integra a `main` aparte.

```bash
git clone <URL_DEL_REPO> sanluca
cd sanluca
git checkout pruebas-local     # la rama donde probamos
npm install
```

## 2. Crear el rol y la base local

Conéctate como superusuario (`postgres`) y crea el rol + la BD. Cambia `TU_PASSWORD`
por lo que quieras (es solo tu local):

```bash
psql -U postgres -c "CREATE ROLE sanluca_user LOGIN PASSWORD 'TU_PASSWORD' CREATEDB;"
psql -U postgres -c "CREATE DATABASE sanluca_db OWNER sanluca_user;"
# Rol de RLS: NO lo usamos en local, pero créalo (vacío) para que el restore del dump
# de prod no marque errores por los GRANT/policies que lo mencionan:
psql -U postgres -c "CREATE ROLE sanluca_app LOGIN PASSWORD 'lo_que_sea';"
```

## 3. Configurar `.env`

```bash
cp .env.example .env
```

Edita `.env`:

- `DATABASE_URL="postgresql://sanluca_user:TU_PASSWORD@localhost:5432/sanluca_db?schema=public"`
- `DATABASE_URL_APP` → **déjalo igual que `DATABASE_URL`** (o coméntalo). En local no aplicamos RLS.
- `AUTH_SECRET` → genéralo: `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL="http://localhost:3000"`
- `MERCADOPAGO_ACCESS_TOKEN` / `OPENAI_API_KEY` → déjalos vacíos o con un TEST; sus
  funciones se degradan solas en local.

## 4. Cargar los datos de producción

Pídele a **Paul** el archivo `prod_YYYYMMDD_HHMM.dump` (no tienes acceso al VPS; te lo
pasa por drive/USB). Guárdalo, p. ej. en `~/Downloads/`. Restaura:

```bash
pg_restore -U sanluca_user -h localhost -d sanluca_db \
  --clean --if-exists --no-owner --no-privileges \
  ~/Downloads/prod_YYYYMMDD_HHMM.dump
```

> Puede imprimir un par de warnings sobre `sanluca_app`/policies — son inofensivos en
> local (no usamos RLS). Las tablas y los datos sí entran.

## 5. Reconciliar esquema + generar cliente

```bash
npx prisma db push     # deja el esquema en sync con prisma/schema.prisma
npx prisma generate    # regenera el cliente Prisma
```

## 6. Correr

```bash
npm run dev
```

Abre <http://localhost:3000>.

- **Admin** (Ricardo): `/login`
- **Staff** (mesero/caja): `/staff/login` con PIN

**Login:** los PINs de staff vienen con los datos de prod. Pídele a Paul un PIN de prueba,
o resetea uno con los seeds (`npm run db:seed:staff` acepta variables como `SEED_RICARDO_PIN`).

## 7. Actualizar tras cada push (el loop de cada día)

Cada vez que subimos cambios a `pruebas-local`, sincroniza tu local así:

```bash
git pull origin pruebas-local
npm install            # por si cambiaron dependencias
npx prisma db push     # por si cambió el esquema (agrega columnas nuevas, sin borrar datos)
npx prisma generate    # SIEMPRE — regenera el cliente Prisma
# reinicia el server: Ctrl+C y de nuevo  npm run dev
```

> **Importante — no te saltes `npx prisma generate`.** Es el paso que más se olvida. Si el
> esquema cambió (p. ej. campos nuevos como `splitLabel` / `parentComandaId`) y no regeneras
> el cliente, `tsc` y el build fallan con errores tipo *"Property … does not exist"* aunque
> el código esté bien: es el cliente Prisma desactualizado, no un bug del código.

---

## Alternativa: sin datos de prod (demo fresca)

Si no necesitas datos reales, en vez de los pasos 4–5:

```bash
npm run setup   # = prisma db push + prisma db seed (crea datos demo)
```

## Refrescar los datos más adelante

Cuando quieras volver a traer prod encima de tu local, repite el paso 4 (Paul genera un
dump nuevo) y luego el paso 5. Tu `.env` no cambia.
