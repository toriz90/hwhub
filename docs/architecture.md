# Arquitectura HWHub

## Objetivo

HWHub centraliza conversaciones, FAQs, sucursales, agenda y datos de venta para que el cliente reciba respuesta por widget web o WhatsApp, y para que un agente pueda tomar o pausar la conversacion cuando sea necesario.

## Principios

- El chatbot no depende de un canal especifico.
- WhatsApp, widget web y marketplaces se normalizan como conversaciones internas.
- PostgreSQL es la fuente principal de datos.
- El bot solo responde con informacion aprobada o con datos consultados en integraciones autorizadas.
- Los agentes pueden tomar, pausar, transferir o cerrar conversaciones.
- Las reglas de canalizacion se editan desde el backoffice.

## Canales soportados

- `web_widget`: widget embebible.
- `official_site`: pagina oficial.
- `woocommerce`: tienda WooCommerce.
- `whatsapp_cloud`: WhatsApp Business Cloud API.
- `evolution_api`: conexion propia via Evolution API.
- `telnyx`: proveedor externo.
- `plivo`: proveedor externo.

## Marketplace routing

Las consultas se clasifican por intencion y origen:

- Pedidos de pagina oficial y WooCommerce: chatbot primero, con acceso a pedidos y estados.
- Amazon, MercadoLibre, Walmart, Coppel, Elektra, TikTok, Temu y ATC general: canalizar a agentes activos.
- Si no hay agentes activos: responder mensaje generico y mostrar telefono de contacto tomado del directorio.
- Ventas mayoristas: canalizar segun directorio y reglas de sucursal/equipo.

## Estados de conversacion

```txt
bot_active
waiting_for_agent
agent_active
paused
closed
```

## Flujo de una consulta

1. Llega mensaje desde widget o WhatsApp.
2. Se normaliza a `conversation` y `message`.
3. Se detecta intencion: FAQ, pedido, agenda, sucursal, marketplace, mayorista o ATC.
4. Se aplican reglas de ruteo.
5. Si el bot puede responder con confianza, consulta FAQs, sucursales, WooCommerce o Easy!Appointments.
6. Si requiere humano, se asigna agente activo recomendado.
7. Si no hay agente activo, se muestra contacto generico del directorio.
8. Un agente puede tomar, pausar, transferir, cerrar o devolver al bot.

## IA

El backend debe usar un adaptador unico:

```txt
AiProvider.generateReply(context)
```

Implementaciones planeadas:

- `openai`
- `anthropic_claude`
- `mock`

El contexto del modelo debe incluir solo informacion autorizada: FAQs publicadas, directorio vigente, datos permitidos de pedidos/citas y reglas activas.
