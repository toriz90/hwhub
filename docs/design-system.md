# Guia de diseno y UX de WhaleHub

## Principios

- El producto debe sentirse como una herramienta operativa profesional: claro, rapido y facil de escanear.
- Las pantallas de trabajo deben priorizar densidad ordenada sobre decoracion.
- Las acciones frecuentes deben estar visibles y cerca del contexto donde se usan.
- El chatbot debe sentirse confiable: estados de escritura, horas visibles, fechas por dia y mensajes de error utiles.
- El panel debe evitar duplicar formularios o pedir datos que ya fueron capturados.

## Layout

- Dashboard: resumen ejecutivo, metricas y accesos rapidos.
- Conversaciones: vista de ancho completo con lista, detalle de mensajes, contexto del cliente y actividad.
- Chatbot: configuracion de comportamiento, prompt, temperatura, reglas, hand-off y apariencia del widget.
- APIs: credenciales, pruebas de conexion, ultima sincronizacion y errores.
- FAQs: carga, busqueda, categorizacion y trazabilidad de informacion usada por IA.

## Componentes

- Tarjetas solo para elementos repetidos o entidades editables.
- Tablas/listas para datos operativos de alta densidad.
- Badges para estado, prioridad, SLA y origen.
- Botones primarios para acciones principales; acciones destructivas siempre diferenciadas.
- Formularios con validacion antes de guardar, prueba de conexion antes de activar APIs y feedback visible.

## Conversaciones

- La lista debe permitir filtrar por estado, canal, prioridad y busqueda.
- La tarjeta completa debe abrir la conversacion; los botones internos solo ejecutan acciones rapidas.
- El detalle debe mostrar contexto del cliente, mensajes y actividad por separado.
- El historial operacional debe ser secundario frente a los mensajes, pero siempre accesible.
- El composer de agente debe mantenerse visible al final del panel.

## Widget

- Antes de iniciar debe pedir datos basicos obligatorios.
- Si el cliente pide cita, debe solicitar datos extra solo en ese flujo.
- Debe mostrar fecha cuando cambie el dia y hora en cada mensaje.
- Si esta minimizado y llega un mensaje nuevo, debe mostrar contador en el boton.
- Debe evitar pedir nombre, telefono o email si ya fueron capturados.

## Paleta sugerida

- Base: fondos claros, tinta oscura y lineas suaves.
- Acento principal: teal/verde institucional para estado positivo y seleccion.
- Alerta: rosa/rojo solo para urgencia o riesgo.
- Advertencia: amarillo/ambar para espera o accion pendiente.
- Evitar una interfaz dominada por un solo color.
