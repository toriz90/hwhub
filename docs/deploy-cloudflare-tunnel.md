# Despliegue con Docker Compose y Cloudflare Tunnel

Esta configuracion no publica puertos del servidor. El trafico externo entra por Cloudflare Tunnel y llega al servicio interno `app:3000`.

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
