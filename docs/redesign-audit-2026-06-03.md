# Auditoria de rediseño y pendientes - 2026-06-03

## Alcance

Revision de HWHub para preparar rediseño operativo y detectar pendientes de seguridad, funcionalidad, UX y mantenimiento.

## Seguridad

### Critico

- Las credenciales de integraciones se guardan en `integration_accounts.encrypted_config`, pero actualmente son JSON sin cifrado real. Debe implementarse cifrado en reposo antes de operar mas tokens sensibles.
- Los endpoints publicos del widget y citas (`/api/chat`, `/api/chat/sync`, `/api/appointments/options`, `/api/appointments/prevalidate`, `/api/appointments/create`) no tienen rate limit ni token publico de widget. Son necesarios para el widget, pero requieren controles anti abuso.
- `/api/appointments/create` puede crear citas reales desde un endpoint publico. Debe limitarse por origen, captcha invisible o token del widget, rate limit por IP/visitor/email y validacion estricta.
- No existe proteccion CSRF para acciones autenticadas del backoffice.

### Alto

- `access-control-allow-origin` esta abierto con `*`. Debe restringirse o separar CORS publico del widget y CORS privado del panel.
- Pruebas de integraciones permiten endpoints configurables. Debe validarse riesgo SSRF y restringir esquemas/hosts cuando aplique.
- Login no tiene bloqueo temporal ni rate limit por IP/email.
- Las sesiones expiran, pero no hay limpieza automatica ni pantalla para revocarlas.
- Politica de password minima es debil: solo se valida longitud en cambio de password.

### Medio

- Falta auditoria persistente para cambios de usuarios, APIs, prompts, reglas, sucursales y directorio.
- Falta registro visible de ultimo actor para acciones sensibles.
- Falta separar permisos de lectura/escritura de integraciones, usuarios y configuracion del chatbot.

## Funcionalidad

### Alto

- WhatsApp Cloud, Evolution API, Telnyx y Plivo tienen configuracion y prueba parcial, pero falta flujo real de webhooks inbound/outbound.
- Falta bandeja profesional de conversaciones con contexto compacto, timeline secundario y acciones mas claras por estado.
- Falta dashboard con datos realmente accionables: SLA, urgentes, conversaciones sin responder, agentes activos, APIs con error y ultimas citas.
- Falta modulo de auditoria/actividad general.
- Falta pruebas automatizadas para chat, citas, integraciones y permisos.

### Medio

- Falta consolidar ruteo para marketplaces con reglas visuales por canal, skill, disponibilidad de agentes y fallback de directorio.
- Falta manejo de transferencias entre agentes/equipos.
- Falta pantalla de estado de integraciones con ultima sincronizacion, ultimo error, proveedor activo para IA y canal.
- Falta herramienta para depurar contexto usado por IA sin exponer secretos.
- Falta versionado del prompt y rollback de configuracion.

### Bajo

- README aun describe algunos puntos como preparacion/mock aunque ya existen piezas productivas.
- Algunos textos siguen sin acentos por consistencia ASCII del proyecto; puede revisarse si se decide aceptar UTF-8 completo.

## UX y diseño

### Critico para rediseño

- El layout actual crecio por modulos y no tiene una jerarquia visual unificada.
- Formularios largos compiten con listados y resultados.
- Conversaciones necesita ocupar mejor el espacio disponible y priorizar lectura de mensajes sobre actividad interna.
- APIs, usuarios, roles y ruteo necesitan superficies mas operativas y menos "formulario suelto".

### Objetivo visual aprobado

- Base negra/grafito con acento dorado.
- Fondos claros de trabajo para lectura prolongada.
- Alto contraste en botones, estados y filtros.
- Estilo profesional de herramienta operativa, no landing page.
- Responsive 100% en movil, tablet, laptop y escritorio ancho.

## Plan de implementacion visual

1. Crear tokens globales negro/dorado, sombras, bordes, estados y superficies.
2. Rediseñar shell: sidebar, topbar, login y navegacion.
3. Rediseñar dashboard con tarjetas ejecutivas y accesos por estado.
4. Rediseñar conversaciones como vista de contact center.
5. Rediseñar modulos de configuracion: chatbot, APIs, agentes, usuarios, roles, FAQs, sucursales, directorio y ruteo.
6. Ajustar responsive con breakpoints consistentes.
7. Validar sintaxis, carga local y produccion antes de desplegar.
