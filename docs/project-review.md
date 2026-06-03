# Revision del proyecto WhaleHub

Fecha: 2026-06-02

## Alcance actual

WhaleHub ya tiene una base funcional para operar como hub multicanal:

- Panel administrativo con login, usuarios, roles, agentes, ruteo, FAQs, directorio, APIs e integraciones.
- Widget web embebible con formulario inicial, persistencia de conversacion y notificacion cuando llegan mensajes con el chat minimizado.
- Conversaciones con estados operativos, toma por agente, pausa, retorno a bot y cierre.
- Configuracion de chatbot: prompt general, temperatura y reglas operativas.
- Integraciones base para OpenAI, WooCommerce y Easy Appointments con pruebas de conexion.
- Flujo de cita con prevalidacion de servicio, proveedor, fecha, hora y datos adicionales condicionados.
- Produccion activa en `https://whalehub.victortoriz.cc`.

## Pendientes del plan original

- WhatsApp real: conectar proveedor oficial o Evolution API/Telnyx/Plivo para mensajes entrantes y salientes.
- Hand-off en tiempo real: enviar respuestas de agentes al widget/WhatsApp sin refrescar, idealmente con SSE o WebSocket.
- Easy Appointments: crear cita real, reagendar cita existente y manejar errores del API con mensajes especificos.
- TrackShip: consultar guias, URL de rastreo y eventos de envio desde pedidos WooCommerce.
- WooCommerce cliente logueado: detectar sesion del cliente en pagina oficial mediante embed/plugin y consultar pedidos propios sin pedir datos duplicados.
- Marketplace routing: flujos dedicados para Amazon, Mercado Libre, Walmart, Coppel, Elektra, TikTok, Temu y ATC general.
- Base de conocimiento: carga masiva, busqueda avanzada, versionado de FAQs y trazabilidad de respuestas usadas por IA.
- Seguridad: cifrado fuerte de tokens, auditoria de cambios, permisos finos por rol y rotacion de credenciales.
- Observabilidad: alertas en tiempo real, metricas de SLA, errores por integracion y bitacora operacional.
- Pruebas: cobertura automatizada de API, widget, ruteo, cita y conectores.

## Limpieza realizada

- Se eliminaron modulos frontend antiguos en `web/modules/*` que ya no estaban importados por la app actual.
- La vista de Conversaciones se separo del layout generico del dashboard para ocupar mejor el espacio.
- El detalle de conversacion ahora distingue contexto, mensajes y actividad operacional.

## Riesgos actuales

- La app depende de integraciones externas, pero todavia no todas ejecutan acciones reales de negocio.
- El flujo de citas esta preparado para validacion, pero falta confirmar creacion/reagenda final contra Easy Appointments.
- Sin WebSocket/SSE, la experiencia multiagente aun requiere refrescos o polling para sentirse en tiempo real.
- Los conectores de marketplaces aun no tienen contratos claros de API, por lo que el ruteo puede depender de reglas genericas.

## Siguiente recomendacion

Priorizar un MVP operativo de conversacion:

1. Persistencia y actualizacion en tiempo real para widget y panel.
2. WhatsApp conectado a un proveedor.
3. Creacion/reagenda de citas reales.
4. Consulta real de pedidos, stock, precios y rastreo.
5. Mejoras visuales globales con el sistema de diseno definido.
