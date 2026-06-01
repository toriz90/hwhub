# Despliegue con Docker Compose y Cloudflare Tunnel

Esta configuracion soporta dos modos:

- Tunnel dedicado dentro del compose: Cloudflare llega a `app:3000`.
- Tunnel global existente en el servidor: Cloudflare llega a `localhost:8041`, publicado solo en `127.0.0.1`.

## Requisitos del servidor

- Docker Engine.
- Docker Compose v2.
- Acceso SSH.
- Un tunnel creado en Cloudflare Zero Trust.
- Token del tunnel.

## Archivos importantes

- `compose.yaml`: app, PostgreSQL con pgvector y cloudflared.
- `.env.example`: variables necesarias.
- `Dockerfile`: imagen de la app.
- `/health`: endpoint de salud para Docker.

## Configuracion recomendada en Cloudflare

En el Public Hostname del tunnel:

```txt
Subdomain: hub
Domain: tu-dominio.com
Service: http://app:3000
```

Si el tunnel se configura desde el dashboard usando token, el contenedor `cloudflared` solo necesita:

```txt
CLOUDFLARE_TUNNEL_TOKEN=...
```

## Instalacion en servidor

```bash
git clone <repo> hwhub
cd hwhub
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

## Instalacion usando el tunnel global existente

Este es el modo recomendado para el NAS actual, donde ya existe un `cloudflared` global.

```bash
git clone git@github-hwhub:toriz90/hwhub.git hwhub-app
cd hwhub-app
cp .env.example .env
nano .env
docker compose -f compose.yaml -f compose.cloudflare.yaml up -d --build
docker compose -f compose.yaml -f compose.cloudflare.yaml ps
```

Configura el Public Hostname en Cloudflare asi:

```txt
Subdomain: hwhub
Domain: victortoriz.cc
Path: vacio
Service: http://localhost:8041
```

El puerto queda ligado a `127.0.0.1`, no a `0.0.0.0`, por lo que no se publica hacia la red.

## Verificacion

Desde el servidor:

```bash
docker compose exec app node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.json()).then(console.log)"
```

Desde fuera, abre el hostname configurado en Cloudflare, por ejemplo:

```txt
https://hub.tu-dominio.com
```

## Actualizacion

```bash
git pull
docker compose up -d --build
docker compose logs -f app
```

## Notas de seguridad

- No usar `ports:` en `compose.yaml`.
- Mantener llaves reales solo en `.env`.
- No commitear `.env`.
- Rotar el token del tunnel si se comparte accidentalmente.
- Cuando se conecte WhatsApp, validar firmas/webhooks antes de procesar mensajes.
