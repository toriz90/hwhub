#!/bin/bash
set -euo pipefail

# Script de deploy remoto para hwhub en NAS
# Uso: GIT_SHA=<commit> DEPLOY_PATH=<path> bash deploy.sh
# Se ejecuta en el contexto remoto (NAS) via SSH

if [ -z "${GIT_SHA:-}" ]; then
  echo "✗ GIT_SHA no definido" >&2
  exit 1
fi

if [ -z "${DEPLOY_PATH:-}" ]; then
  echo "✗ DEPLOY_PATH no definido" >&2
  exit 1
fi

echo "==> Deploy remoto iniciado"
echo "    GIT_SHA: ${GIT_SHA}"
echo "    DEPLOY_PATH: ${DEPLOY_PATH}"

cd "${DEPLOY_PATH}" || exit 1
echo "==> directorio: $(pwd)"

# 1) Checkout exacto del commit
echo "==> git fetch + reset"
git fetch --all --prune 2>&1 | tail -5
git reset --hard "${GIT_SHA}" 2>&1 | tail -3

# 2) Docker compose build
echo "==> docker compose build"
COMPOSE="docker compose"
$COMPOSE build --build-arg GIT_SHA="${GIT_SHA}" 2>&1 | tail -20

# Capturar ID de imagen construida
built_image=$(docker image inspect -f '{{.Id}}' hwhub-app-app 2>/dev/null || echo 'none')
echo "==> imagen construida: ${built_image}"

# 3) Recreación DETERMINISTA
echo "==> eliminando contenedor anterior"
docker rm -f hwhub-app-app-1 2>/dev/null || true

echo "==> levantando stack con imagen nueva"
if ! $COMPOSE up -d --force-recreate --remove-orphans; then
  echo "✗ 'docker compose up' falló" >&2
  $COMPOSE logs --tail=100 app >&2
  exit 1
fi

# 4) Verificación: el contenedor DEBE correr la imagen recién construida
echo "==> verificando imagen en vivo"
run_image=$(docker inspect -f '{{.Image}}' hwhub-app-app-1 2>/dev/null || echo 'none')
echo "    en vivo: ${run_image}"

if [ "${run_image}" != "${built_image}" ]; then
  echo "✗ Mismatch: imagen construida vs en vivo" >&2
  echo "   esperada: ${built_image}" >&2
  echo "   en vivo:  ${run_image}" >&2
  exit 1
fi

# 5) Health check en puerto 8041
echo "==> health check: http://127.0.0.1:8041/health"
ok=0
for i in $(seq 1 30); do
  health=$(curl -fsS -m 5 http://127.0.0.1:8041/health 2>/dev/null || true)
  if printf '%s' "${health}" | grep -qiE 'ok|healthy|running|\"status\"' 2>/dev/null; then
    ok=1
    echo "==> health check PASSED (intento ${i}/30)"
    break
  fi
  echo "   intento ${i}/30: esperando health check..."
  sleep 2
done

if [ "${ok}" -ne 1 ]; then
  echo "✗ Health check falló tras 30 intentos" >&2
  echo "   respuesta final: ${health:-sin respuesta}" >&2
  $COMPOSE logs --tail=80 app >&2
  exit 1
fi

echo ""
echo "✓ Deploy exitoso en commit ${GIT_SHA}"
echo "  URL: http://127.0.0.1:8041/"
