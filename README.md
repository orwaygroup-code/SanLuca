# Restaurant App

Aplicación web profesional para restaurante premium construida con arquitectura moderna y escalable.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, Server Components)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5
- **Validation:** Zod
- **Containerization:** Docker + Docker Compose

## Estructura del Proyecto

```
restaurant-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (Header + Footer)
│   ├── page.tsx            # Home page (Server Component)
│   ├── menu/
│   │   ├── page.tsx        # Menu index
│   │   └── [category]/
│   │       └── page.tsx    # Dynamic category page
│   └── api/
│       ├── health/         # GET  /api/health
│       ├── locations/      # GET  /api/locations
│       ├── menu/           # GET  /api/menu
│       └── contact/        # POST /api/contact
├── components/
│   ├── layout/             # Header, Footer
│   ├── sections/           # Page sections (Hero, Menu, etc.)
│   └── ui/                 # Reusable UI (ContactForm)
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   ├── db.ts               # Database service layer
│   └── validations.ts      # Zod schemas
├── types/                  # TypeScript type definitions
├── config/                 # Site configuration
├── services/               # External service integrations
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Mock data seeder
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # PostgreSQL + App services
└── .env.example            # Environment variables template
```

## Quick Start

### 1. Clonar y configurar variables de entorno

```bash
git clone <repo-url>
cd restaurant-app
cp .env.example .env
```

### 2. Levantar PostgreSQL con Docker

```bash
docker compose up postgres -d
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar base de datos

```bash
npx prisma generate      # Generar cliente
npx prisma db push        # Crear tablas
npx prisma db seed        # Insertar datos mock
```

### 5. Iniciar desarrollo

```bash
npm run dev
```

La app estará en `http://localhost:3000`.

### Setup rápido (todo en uno)

```bash
npm run setup   # Docker + migrate + seed
npm run dev
```

## Producción con Docker

```bash
docker compose up -d --build
```

Esto levanta PostgreSQL y la app Next.js en `http://localhost:3000`.

## API Endpoints

| Método | Ruta             | Descripción                    |
|--------|------------------|--------------------------------|
| GET    | `/api/health`    | Health check (DB connectivity) |
| GET    | `/api/locations` | Sucursales activas             |
| GET    | `/api/menu`      | Categorías con platillos       |
| POST   | `/api/contact`   | Enviar mensaje de contacto     |

### POST /api/contact - Body

```json
{
  "name": "string (2-100 chars)",
  "email": "valid email",
  "locationId": "location CUID",
  "message": "string (10-2000 chars)"
}
```

## Modelo de Datos

```
Location 1───N ContactMessage
MenuCategory 1───N MenuItem
```

- **Location:** Sucursales con datos de contacto y geolocalización
- **ContactMessage:** Mensajes del formulario vinculados a sucursal
- **MenuCategory:** Categorías del menú con slug para URLs
- **MenuItem:** Platillos con precio, alérgenos, disponibilidad

## Prisma Studio

```bash
npx prisma studio   # UI visual en http://localhost:5555
```

---

## Estrategia de Escalamiento

### Conversión a SaaS Multi-Tenant

Para soportar múltiples restaurantes en una sola instancia:

1. **Agregar modelo `Tenant`** con configuración por restaurante (nombre, dominio, tema, plan).
2. **Agregar `tenantId` como FK** a todos los modelos existentes.
3. **Middleware de resolución de tenant** que identifica el restaurante por subdominio (`restaurante-a.tuapp.com`) o header personalizado.
4. **Row-Level Security** en todas las queries para aislar datos entre tenants.
5. **Mover la identidad del restaurante** (nombre, dominio, tema, textos) a la base de datos.

### Tecnologías Recomendadas para Escalar

**Redis** — Recomendado cuando:
- Se necesite caché de menú y locations (cambian poco, se leen mucho)
- Rate limiting en endpoints públicos
- Session storage si se implementa auth custom

**Queue System (BullMQ + Redis)** — Recomendado cuando:
- Envío de emails de confirmación (contacto, reservas)
- Procesamiento de imágenes de menú
- Webhooks de pagos

**Stripe** — Recomendado para:
- Pagos de reservas con depósito
- Planes de suscripción si se convierte a SaaS
- Facturación por tenant

**Autenticación:**
- **Clerk** si se quiere implementación rápida con dashboard de admin
- **Auth.js (NextAuth)** si se prefiere control total y sin vendor lock-in
- Ambos se integran bien con Next.js App Router

### Estrategia de Deployment

| Opción    | Mejor para                                    | Pros                                     | Contras                      |
|-----------|-----------------------------------------------|------------------------------------------|------------------------------|
| **Vercel**   | MVP, startups, equipos pequeños            | Zero config, edge functions, preview deploys | DB externa necesaria, costos escalan |
| **Railway**  | Equipos medianos, full-stack                | PostgreSQL incluido, fácil Docker, buen DX   | Menos edge locations         |
| **AWS (ECS)**| Producción enterprise, alto tráfico         | Control total, escalado fino, VPC privada    | Mayor complejidad ops        |

**Recomendación progresiva:**
1. **Fase 1 (MVP):** Vercel + Supabase/Neon (PostgreSQL managed)
2. **Fase 2 (Crecimiento):** Railway con PostgreSQL incluido
3. **Fase 3 (Enterprise):** AWS ECS + RDS + ElastiCache + CloudFront
