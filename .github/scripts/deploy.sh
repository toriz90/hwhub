#!/bin/bash
set -euo pipefail

# Variables from GitHub Actions
GIT_SHA="${1:-${github_sha:-unknown}}"
DEPLOY_PATH="${2:-~/docker/stacks/hwhub-app}"

echo "==> Deploy remoto en NAS"
echo "    GIT_SHA: ${GIT_SHA}"
echo "    DEPLOY_PATH: ${DEPLOY_PATH}"
echo ""

# 1) Git fetch + reset al commit exacto
echo "==> [1/4] git fetch + reset --hard"
cd "${DEPLOY_PATH}"
git fetch --all --prune 2>&1 | tail -3
git reset --hard "${GIT_SHA}" 2>&1 | tail -2

# 2) Docker compose build
echo ""
echo "==> [2/4] docker compose build"
docker compose build 2>&1 | tail -15

# 3) Recreate containers
echo ""
echo "==> [3/4] docker compose up -d --force-recreate"
docker compose up -d --force-recreate --remove-orphans 2>&1 | tail -8

# 4) Health check: 60 intentos x 3 segundos = 180 segundos (3 minutos)
echo ""
echo "==> [4/4] health check en http://127.0.0.1:8041/health"
echo "    (60 intentos, 3 segundos entre cada uno)"
echo ""

ok=0
for i in $(seq 1 60); do
  # Intentar curl con timeout de 5 segundos
  health=$(curl -fsS -m 5 http://127.0.0.1:8041/health 2>/dev/null || true)
  
  # Verificar si el JSON contiene "ok":true o similar
  if printf '%s' "${health}" | grep -qE '"ok"|"healthy"|"status"' 2>/dev/null; then
    ok=1
    echo "✓ Health check PASSED en intento ${i}/60"
    echo "  Response: ${health}"
    break
  fi
  
  if [ $((i % 10)) -eq 0 ] || [ "${i}" -le 3 ]; then
    echo "  intento ${i}/60: esperando health check..."
  fi
  sleep 3
done

# Si health check falló, mostrar logs y salir con error
if [ "${ok}" -ne 1 ]; then
  echo ""
  echo "✗ Health check falló tras 60 intentos (180 segundos)" >&2
  echo "" >&2
  echo "==> Docker compose status:" >&2
  docker compose ps >&2
  echo "" >&2
  echo "==> Últimos 50 logs:" >&2
  docker compose logs --tail=50 app >&2
  exit 1
fi

echo ""
echo "✓ Deploy exitoso"
echo "  Commit: ${GIT_SHA}"
echo "  URL: http://127.0.0.1:8041/"
