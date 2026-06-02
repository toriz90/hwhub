# HWHub

Hub de atencion para sitio oficial, WooCommerce, WhatsApp y marketplaces.

## Primer arranque

```bash
npm run dev
```

Luego abre:

```txt
http://localhost:3000
```

## Que incluye esta primera base

- Front rapido y visual para operar el hub.
- Widget de chat embebible en sitios externos.
- Servidor Node sin dependencias externas.
- APIs mock para FAQs, sucursales, agentes, reglas de ruteo y conversaciones.
- Eventos en tiempo real con Server-Sent Events para alertas del backoffice.
- Flujo de chatbot configurable desde datos del backend.
- Preparacion para OpenAI o Claude como motor IA.
- Motor IA controlado por contexto de FAQs, directorio y reglas de ruteo. Por defecto usa `AI_PROVIDER=mock`; para IA real usa `AI_PROVIDER=openai` o `AI_PROVIDER=claude` con tokens por `.env`, o guarda una API activa `openai`/`claude` desde la pantalla APIs con `{"apiKey":"...", "model":"...", "useForChat":true}`.
- Preparacion para PostgreSQL con full-text search, trigramas, pgvector y reglas de ruteo.
- Preparacion para WooCommerce, Easy!Appointments, WhatsApp Cloud API, Evolution API, Telnyx y Plivo.

## Embed del widget

```html
<script
  src="https://tu-dominio.com/widget.js"
  data-hwhub-api="https://tu-dominio.com"
  data-channel="official_site">
</script>
```

En desarrollo:

```html
<script src="http://localhost:3000/widget.js" data-channel="woocommerce"></script>
```

## Siguientes pasos tecnicos

1. Reemplazar datos mock por PostgreSQL.
2. Conectar login de agentes.
3. Conectar WhatsApp Cloud API como canal oficial.
4. Agregar conectores Evolution API, Telnyx y Plivo.
5. Conectar WooCommerce para pedidos y estados.
6. Conectar Easy!Appointments para disponibilidad y citas.
7. Afinar prompts, pruebas y limites del proveedor IA real.
