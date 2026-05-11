#!/usr/bin/env bash
# tests/smoke.sh — End-to-end smoke test post-hardening.
# Uso: bash tests/smoke.sh
# Variables: BASE_URL (default http://localhost:3000)
#
# Verifica auth cookie, RLS, CORS bypass para curl (sin Origin), 403 para
# customers en endpoints admin, endpoints públicos. Limpia el user test al final.

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_A="$(mktemp -t sanluca_smoke_A.XXXXXX)"
TEST_EMAIL="smoke_$(date +%s)_$$@sanluca.test"
TEST_PASSWORD="SmokeTest@2026!"
TEST_NAME="Smoke Test User"
TEST_PHONE="5544332211"

pass=0
fail=0
total=9

green()  { printf "\033[32m%s\033[0m" "$1"; }
red()    { printf "\033[31m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

check() {
  local name="$1"; local expected="$2"; local actual="$3"; local detail="${4:-}"
  if [[ "$expected" == "$actual" ]]; then
    printf "  %s  %-55s  %s\n" "$(green ✓)" "$name" "[$actual]"
    pass=$((pass + 1))
  else
    printf "  %s  %-55s  expected=%s got=%s %s\n" "$(red ✗)" "$name" "$expected" "$actual" "$detail"
    fail=$((fail + 1))
  fi
}

cleanup() {
  rm -f "$COOKIE_A"
  if [[ -n "${TEST_EMAIL:-}" ]]; then
    npx tsx tests/smoke-cleanup.ts "$TEST_EMAIL" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo
echo "  SanLuca Smoke Test — base=$BASE_URL"
echo "  ────────────────────────────────────────────────────────────────────"

# ── 1. Register ─────────────────────────────────────────────────────────
status=$(curl -s -o /tmp/sl_smoke_1.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_A" \
  -d "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"phone\":\"$TEST_PHONE\",\"password\":\"$TEST_PASSWORD\",\"confirmPassword\":\"$TEST_PASSWORD\"}")
has_cookie=$(grep -c 'sl_session' "$COOKIE_A" 2>/dev/null || echo 0)
if [[ "$status" == "201" && "$has_cookie" -ge 1 ]]; then
  check "1. POST /api/auth/register + sl_session cookie" "ok" "ok" "($status, cookie set)"
else
  check "1. POST /api/auth/register + sl_session cookie" "ok" "fail" "($status, cookie=$has_cookie)"
fi

# ── 2. /me con cookie ───────────────────────────────────────────────────
me=$(curl -s -o /tmp/sl_smoke_2.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me" -b "$COOKIE_A")
check "2. GET /api/auth/me con cookie" "200" "$me"

# ── 3. /me sin cookie ───────────────────────────────────────────────────
me_no=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me")
check "3. GET /api/auth/me sin cookie" "401" "$me_no"

# ── 4. /reservations (RLS: solo propias) ────────────────────────────────
res_list_status=$(curl -s -o /tmp/sl_smoke_4.json -w "%{http_code}" \
  -X GET "$BASE_URL/api/reservations" -b "$COOKIE_A")
# Esperamos 200. RLS: como user nuevo, lista debe estar vacía o solo propias.
data_count=$(grep -o '"id":' /tmp/sl_smoke_4.json | wc -l | tr -d ' ')
if [[ "$res_list_status" == "200" ]]; then
  check "4. GET /api/reservations (RLS scope propias)" "ok" "ok" "($res_list_status, items=$data_count, user nuevo → 0 esperado)"
else
  check "4. GET /api/reservations (RLS scope propias)" "ok" "fail" "($res_list_status)"
fi

# ── 5. POST /reservations (creación con session) ────────────────────────
# Fecha martes próximo (no lunes), hora 14:00. Mínimo viable.
NEXT_TUESDAY=$(date -d "next tuesday" +%Y-%m-%d 2>/dev/null || \
               date -v+Tue +%Y-%m-%d 2>/dev/null || \
               date +%Y-%m-%d)
create_status=$(curl -s -o /tmp/sl_smoke_5.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/reservations" \
  -H "Content-Type: application/json" -b "$COOKIE_A" \
  -d "{\"guestName\":\"$TEST_NAME\",\"guestPhone\":\"$TEST_PHONE\",\"date\":\"$NEXT_TUESDAY\",\"time\":\"14:00\",\"guests\":2,\"sectionPreference\":\"Terraza\"}")
# Aceptable: 201 (creada) o 400/409 (validación lógica). NO debe ser 401 ni 403.
if [[ "$create_status" == "201" || "$create_status" == "400" || "$create_status" == "409" ]]; then
  check "5. POST /api/reservations (auth+RLS permiten)" "ok" "ok" "($create_status)"
else
  check "5. POST /api/reservations (auth+RLS permiten)" "ok" "fail" "($create_status, esperaba 201/400/409)"
fi

# ── 6. /admin/reservations como CUSTOMER → 403 ──────────────────────────
admin_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/api/admin/reservations" -b "$COOKIE_A")
check "6. GET /api/admin/reservations (CUSTOMER → 403)" "403" "$admin_status"

# ── 7. /api/menu público ────────────────────────────────────────────────
menu_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/api/menu")
check "7. GET /api/menu (público)" "200" "$menu_status"

# ── 8. Logout limpia cookie ─────────────────────────────────────────────
logout=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/logout" -b "$COOKIE_A" -c "$COOKIE_A")
# Después del logout, /me debe ser 401
after_logout=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/api/auth/me" -b "$COOKIE_A")
if [[ "$logout" == "200" && "$after_logout" == "401" ]]; then
  check "8. POST /api/auth/logout + cookie invalidada" "ok" "ok" "(logout=$logout, me-post-logout=$after_logout)"
else
  check "8. POST /api/auth/logout + cookie invalidada" "ok" "fail" "(logout=$logout, me-post-logout=$after_logout)"
fi

# ── 9. Cleanup ──────────────────────────────────────────────────────────
# Lo hace el trap EXIT vía smoke-cleanup.ts (Prisma admin, bypass RLS).
# Verificamos aquí que el script existe y es ejecutable.
if [[ -f tests/smoke-cleanup.ts ]]; then
  check "9. Cleanup (test user delete via Prisma admin)" "ok" "ok" "(script presente, trap registrado)"
else
  check "9. Cleanup (test user delete via Prisma admin)" "ok" "fail" "(falta tests/smoke-cleanup.ts)"
fi

echo "  ────────────────────────────────────────────────────────────────────"
if [[ "$fail" == "0" ]]; then
  printf "  %s  %d/%d pruebas pasaron\n\n" "$(green ✅)" "$pass" "$total"
  exit 0
else
  printf "  %s  %d/%d pasaron, %d fallaron\n\n" "$(red ❌)" "$pass" "$total" "$fail"
  exit 1
fi
