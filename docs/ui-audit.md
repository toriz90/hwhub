# Auditoría de UI/UX — WhaleHub

**Fecha:** 2026-07-28
**Alcance:** widget de chat (cliente final) y backoffice, en escritorio y móvil.
**Propósito:** diagnóstico previo al rediseño hacia un SaaS vendible con identidad neutra
(neutro oscuro + un acento, estilo Linear/Vercel) y white-label por cliente.
**Esta auditoría no cambia código.** Todos los hallazgos citan archivo y línea.

---

## Resumen ejecutivo

WhaleHub funciona, pero visualmente es un producto **hecho para un cliente, no un producto vendible**.
Los tres bloqueos de fondo:

1. **El CSS no está listo para white-label.** Hay 73 tokens en `:root`, pero **287 valores hex
   en la hoja**, de los cuales **249 están fuera de la declaración de tokens**. Cambiar el acento
   de un cliente hoy exige tocar la hoja a mano. Además los tokens se llaman `--gold`, `--amber`,
   `--wh-cream`: nombres de la marca Honey Whale, no roles semánticos.
2. **La hoja de estilos es un sedimento de rediseños sucesivos.** 6 372 líneas, **67 selectores de
   clase declarados más de una vez** (`.topbar` 4 veces, `.wh-thread-header` 5), 13 breakpoints
   distintos y bloques rotulados "Bloque A…F", "Fix 4". Cada capa pisa a la anterior en vez de
   reemplazarla. Rediseñar encima de esto cuesta más que reescribir la capa de presentación.
3. **Móvil está resuelto a medias, y donde falla es en el caso de uso que se vende.** El widget usa
   `100vh` (nunca `dvh`), sin áreas seguras ni contención de scroll; el backoffice apila la bandeja
   de conversaciones sobre el hilo, así que un agente en el teléfono tiene que pasar toda la lista
   para leer un mensaje.

---

## A. Widget del chat (cliente final)

### A1 · CRÍTICO — `100vh` en móvil: el teclado tapa el input

**Dónde:** `web/widget.js:302` (`max-height: min(820px, calc(100vh - 112px))`), `:368`, `:675`
(`calc(100vh - 92px)` en el breakpoint de 520px). Cero usos de `dvh`/`svh` en todo el proyecto.

**Por qué es problema:** en iOS y Android el teclado virtual no reduce `100vh`. Al enfocar el
textarea el panel conserva su alto y el compositor queda **debajo del teclado**: el cliente escribe
a ciegas o no ve el botón Enviar. Es el fallo más caro del widget, porque ocurre en el momento
exacto en que el usuario intenta convertir.

**Recomendación:** `100dvh` con fallback a `100vh`, y `visualViewport` para reposicionar el panel
cuando el teclado abre. Verificar en Safari iOS y Chrome Android reales.

### A2 · CRÍTICO — Sin áreas seguras (notch / home indicator)

**Dónde:** `web/widget.js` no contiene ni un `env(safe-area-inset-*)`. La burbuja vive en
`bottom: 22px` (`:194`) y el panel en `bottom: 78px` en móvil (`:673`).

**Por qué es problema:** en iPhone con barra de gestos, el botón flotante queda pegado al
*home indicator*: se toca la barra del sistema en vez del chat. En un SaaS que se incrusta en sitios
de terceros, esto se lee como producto no terminado.

**Recomendación:** `bottom: calc(22px + env(safe-area-inset-bottom))` en burbuja y panel, y padding
inferior equivalente en el compositor.

### A3 · ALTO — En móvil el chat es una tarjeta flotante, no una pantalla

**Dónde:** `web/widget.js:669-676` — el único breakpoint (520px) deja `right: 8px; left: 8px;
bottom: 78px`, es decir el panel sigue siendo una tarjeta con márgenes.

**Por qué es problema:** en pantallas de 360-390px el área útil de conversación queda reducida por
márgenes laterales, la burbuja sigue ocupando espacio y el formulario de citas —con siete campos—
se comprime. El estándar de la categoría (Intercom, Crisp) es **pantalla completa en móvil**.

**Recomendación:** en `max-width: 640px`, panel a pantalla completa con cabecera fija y botón de
cierre explícito; la burbuja se oculta mientras el panel está abierto.

### A4 · ALTO — El scroll del chat arrastra la página anfitriona

**Dónde:** cero usos de `overscroll-behavior` en `web/widget.js` y `web/styles.css`.

**Por qué es problema:** al llegar al final del historial, el gesto sigue hacia la página que hospeda
el widget: el cliente "pierde" el chat mientras lee. En móvil es constante.

**Recomendación:** `overscroll-behavior: contain` en el contenedor de mensajes y en el panel.

### A5 · ALTO — Objetivos táctiles por debajo del mínimo

**Dónde:** `web/widget.js:276` — los chips de acción rápida (`📅 Cita`, `📦 Mi pedido`,
`📍 Sucursal`) son `font-size: 11px; padding: 4px 10px` ⇒ ~21px de alto. El textarea del
compositor mide `min-height: 40px` (`:417`).

**Por qué es problema:** WCAG 2.5.5 y las guías de Apple/Google piden 44×44px. Los chips son el
atajo principal del widget y son el elemento más difícil de tocar de toda la interfaz.

**Recomendación:** mínimo 44px de alto en chips, botón enviar y campos; el texto puede seguir
siendo pequeño, el área táctil no.

### A6 · ALTO — El cliente nunca sabe si habla con un bot o con una persona

**Dónde:** `web/widget.js` no referencia ninguno de los estados de conversación del backend
(`bot_active`, `waiting_for_agent`, `agent_active`, `paused`, `closed`). El único indicador,
`setWidgetStatus()` (`:1222-1233`), reporta **conectividad de red**, no el estado de la atención:
"En línea / Reconectando / Sin conexión".

**Por qué es problema:** cuando un agente toma la conversación el backend devuelve respuesta vacía
(control manual) y el widget no anuncia el cambio. El cliente escribe y no pasa nada visible.
Es el hueco de UX más grave del producto: rompe la promesa de "chatbot + agentes".

**Recomendación:** cinta de estado con los estados reales ("Te responde el asistente" / "Un agente
se unió a la conversación" / "Conversación cerrada") alimentada por `conversation.status`, separada
del indicador de red.

### A7 · MEDIO — El formulario de citas no está pensado para el pulgar

**Dónde:** `web/index.html` del widget (`web/widget.js:752-777`): siete campos obligatorios
(servicio, proveedor, fecha, hora, origen, valor de origen, modelo) en una tarjeta flotante; en
móvil pasan a una columna (`:679`) pero sin agrupación ni pasos.

**Por qué es problema:** es el flujo que genera ingreso y exige rellenar siete `select` seguidos
dentro de un panel con scroll propio, encima del teclado. Alta probabilidad de abandono.

**Recomendación:** dividirlo en 2-3 pasos con progreso visible (el backoffice ya tiene un patrón de
modal por steps reutilizable) y ampliar los objetivos táctiles.

### A8 · MEDIO — El widget solo tiene 4 variables de tema y 77 colores fijos

**Dónde:** `--hwhub-widget-accent|header|bot|user` son las únicas variables (`web/widget.js`);
hay **77 valores hex hardcodeados** en el mismo archivo. Los defaults son de Honey Whale:
`accentColor: "#f5b301"`, `botBubbleColor: "#FFF8E0"`, `title: "Honey Whale"` (`:706-717`).

**Por qué es problema:** un cliente white-label puede cambiar cuatro colores; el resto de la
superficie (bordes `#d9dee6`, texto `#1f2a37`, fondos `#f5f5f0`) queda con la paleta de otro.

**Recomendación:** que el widget consuma el mismo set de tokens semánticos que el backoffice,
inyectados desde `/api/widget-config`.

---

## B. Backoffice

### B1 · CRÍTICO — La bandeja de conversaciones no es usable desde el teléfono

**Dónde:** `web/styles.css:2455-2472` — en móvil `.workspace`, `.conversation-workspace` y
`.conversation-shell` pasan a `grid-template-columns: 1fr`, y `.conversation-detail` pierde el
`min-height`. Lista y detalle quedan **apilados en la misma página**.

**Por qué es problema:** el caso de uso que vende el producto es "un agente atiende desde el móvil".
Con este layout, para leer un mensaje hay que hacer scroll más allá de toda la lista de
conversaciones, y para volver a la lista, scroll hacia arriba. No hay navegación lista↔detalle.

**Recomendación:** patrón maestro-detalle: en móvil la lista es la vista y al abrir una conversación
el hilo la reemplaza con botón "Volver"; el detalle ocupa el alto completo con el compositor fijo.

### B2 · ALTO — El login parece de otro producto

**Dónde:** `web/styles.css:1851-1855` — fondo `linear-gradient(135deg, #050506, #181818 56%,
#2d2106)` con halo dorado, mientras la app usa crema `--bg: #FFFDF0`. El CTA del login es dorado
(`:1897`) y el resto de la app usa botones negros (`:104`).

**Por qué es problema:** la primera pantalla del producto no anticipa la segunda. En una demo de
venta, ese salto se percibe como dos interfaces pegadas.

**Recomendación:** una identidad continua login → app; si se quiere un login con carácter, que sea
la misma paleta con más aire, no otra paleta.

### B3 · ALTO — Sin sistema de espaciado ni escala tipográfica

**Dónde:** `:root` declara **0 tokens de espaciado**; la hoja usa **137 combinaciones distintas** de
`padding`/`gap` y **46 tamaños de fuente distintos**, mezclando px (62 veces) y rem (69).

**Por qué es problema:** es la causa raíz de que la interfaz se vea "casera": nada se alinea con
nada porque no hay retícula. Los productos con los que se va a comparar (Linear, Vercel) usan
escalas de 6-8 pasos.

**Recomendación:** escala de espaciado 4/8px y escala tipográfica de ~7 pasos como tokens, y
migración progresiva por módulo.

### B4 · ALTO — 13 breakpoints distintos

**Dónde:** `web/styles.css` — `520, 560, 640, 720, 767, 820, 980, 1100, 1180, 1260, 1320px`, más
`min-width: 768px`. Tres reglas distintas usan 767px, tres usan 720px, tres usan 1100px.

**Por qué es problema:** entre 720 y 767px hay una franja donde unas reglas ya cambiaron y otras no.
Nadie puede predecir el layout en un ancho dado; cada arreglo responsive añade un breakpoint más.

**Recomendación:** 3 breakpoints (640 / 1024 / 1440) y refactor de las reglas existentes hacia ellos.

### B5 · MEDIO — Componentes que no combinan entre módulos

**Dónde:** `.row-actions button` es gris `#eef1f5` con texto oscuro (`:974-978`); los botones
globales son negros con texto blanco (`:104-113`); el CTA del login es dorado; los `modal-btn-save`
son otro tratamiento. `67 selectores de clase` están declarados más de una vez, con `.topbar`
redefinido 4 veces y `.wh-thread-header` 5.

**Por qué es problema:** no hay un componente "botón": hay cinco botones distintos según dónde
cayó el código. Es el síntoma visual más directo de producto no sistematizado.

**Recomendación:** inventario de componentes (botón, campo, tarjeta, badge, tabla, modal, toast) con
una sola definición por componente y variantes explícitas.

### B6 · MEDIO — Los tabs de Configuración se desbordan en móvil

**Dónde:** `web/styles.css:6087-6093` — `.settings-tabs` es un flex con `overflow-x: auto`. Con la
quinta pestaña ("Base de Conocimiento") el rótulo más largo del set, en 360px se ven dos y media sin
ninguna señal visual de que hay más.

**Por qué es problema:** navegación oculta sin afordancia; el usuario no sabe que existen "Accesos"
o "Notificaciones".

**Recomendación:** degradado de borde o flechas, o convertir a lista vertical en móvil.

### B7 · MEDIO — Objetivos táctiles y densidad en móvil

**Dónde:** `.row-actions button` con `padding: 0.45rem 0.6rem` ⇒ ~30px de alto; el mismo control se
usa en las tarjetas de FAQs, Sucursales, Directorio, Agentes e Integraciones.

**Por qué es problema:** editar/eliminar desde el teléfono exige puntería. Con acciones destructivas
al lado de las normales, el riesgo no es solo incomodidad.

**Recomendación:** 44px mínimo en móvil y separación de la acción destructiva.

### B8 · BAJO — Sin estados de carga por módulo

**Dónde:** 2 referencias a `is-loading` en `web/app.js`, 1 en la hoja; no hay skeletons. `render()`
repinta cuando los datos llegan.

**Por qué es problema:** en conexiones lentas los módulos aparecen vacíos y luego saltan. Un SaaS
serio muestra estructura mientras carga.

**Recomendación:** skeleton por tipo de módulo (lista, tarjeta, tabla) reutilizando el loader neutro
que ya existe en la verificación de sesión.

---

## C. Rastros de marca a neutralizar

| Rastro | Dónde | Acción |
|---|---|---|
| Tokens con nombre de marca: `--gold`, `--amber`, `--wh-gold`, `--wh-gold-soft`, `--wh-gold-strong`, `--wh-cream`, `--wh-paper` | `web/styles.css:5-60` | Renombrar a roles: `--accent`, `--accent-strong`, `--surface`, `--bg` |
| Hex de marca fijos (`#FFD106`, `#FFA506`, `#FFFDF0`) | 5 ocurrencias en `web/styles.css` | Sustituir por tokens |
| Logo "HW" | 10 en `web/index.html`, 1 en `app.js`, 1 en `widget.js` | Componente de logo configurable (imagen o iniciales) |
| "Honey Whale" | 4 en `index.html`, 2 en `app.js`, 2 en `widget.js`, 1 en `styles.css` | Texto desde configuración de marca |
| "WhaleHub" como nombre de producto | 5 en `index.html`, 3 en `app.js` | Decidir: marca del SaaS (se queda) vs marca del cliente (configurable) |
| Defaults de marca en el widget: `title: "Honey Whale"`, `accentColor: "#f5b301"`, `botBubbleColor: "#FFF8E0"` | `web/widget.js:706-717` | Defaults neutros |
| Migración de acentos viejos hardcodeada (`#e84c70`, `#087f7b` → `#f5b301`) | `server/index.js:60` | Eliminar al pasar a tokens |
| Fuentes y iconos desde CDN externo (Google Fonts, jsdelivr) | `web/index.html:10-13` | Auto-hospedar: un SaaS no debería filtrar tráfico de sus clientes a terceros, y hoy sin red externa la tipografía cae a system-ui |

---

## D. Estado del sistema de tokens (¿listo para white-label?)

**No. Está a un tercio del camino.**

| Métrica | Valor | Lectura |
|---|---|---|
| Tokens en `:root` | 73 | Existe la intención |
| Valores hex en la hoja | 287 (141 únicos) | La intención no se aplicó |
| Hex fuera de declaraciones de token | 249 | **87% del color está hardcodeado** |
| `rgba()` literales | 99 | Sombras, bordes y overlays sin tokenizar |
| Tokens de espaciado | 0 | No hay retícula |
| Tamaños de fuente distintos | 46 | No hay escala |
| Selectores duplicados | 67 | Capas superpuestas |
| Reglas `html[data-theme="dark"]` | 31 | Modo oscuro parcheado por selector, no derivado de tokens |
| Hex en el widget | 77 | Superficie del cliente casi sin tokenizar |

El modo oscuro merece una nota: hoy son 31 bloques `html[data-theme="dark"]` que **redeclaran
propiedades de componentes**, no solo tokens. Con esa arquitectura, cada componente nuevo necesita
su parche oscuro y cada cliente white-label multiplicaría el problema. El objetivo es que el tema
oscuro sea únicamente un set alterno de valores de token.

---

## E. Tabla resumen priorizada

| # | Severidad | Superficie | Hallazgo | Esfuerzo |
|---|---|---|---|---|
| A1 | Crítico | Widget móvil | `100vh` + teclado tapa el compositor | S |
| A2 | Crítico | Widget móvil | Sin áreas seguras (notch / home indicator) | S |
| B1 | Crítico | Backoffice móvil | Bandeja y hilo apilados: inatendible desde el teléfono | M |
| D | Crítico | Sistema | 249 colores hardcodeados y tokens con nombre de marca | L |
| A6 | Alto | Widget | El cliente no sabe si le responde un bot o un agente | M |
| A3 | Alto | Widget móvil | Tarjeta flotante en vez de pantalla completa | S |
| A4 | Alto | Widget móvil | Scroll arrastra la página anfitriona | S |
| A5 | Alto | Widget móvil | Objetivos táctiles de ~21px | S |
| B2 | Alto | Backoffice | Login con identidad distinta a la app | S |
| B3 | Alto | Sistema | Sin escala de espaciado ni tipográfica | M |
| B4 | Alto | Sistema | 13 breakpoints | M |
| A7 | Medio | Widget móvil | Formulario de citas de 7 campos sin pasos | M |
| A8 | Medio | Widget | Solo 4 variables de tema, 77 hex fijos | M |
| B5 | Medio | Backoffice | Cinco tratamientos de botón distintos | M |
| B6 | Medio | Backoffice móvil | Tabs de Configuración se desbordan sin afordancia | S |
| B7 | Medio | Backoffice móvil | Objetivos táctiles de ~30px | S |
| C | Medio | Marca | Rastros de Honey Whale en tokens, logos y textos | M |
| B8 | Bajo | Backoffice | Sin estados de carga por módulo | S |

Esfuerzo: S ≤ 1 día · M 2-4 días · L ≥ 1 semana.

---

## F. Fases propuestas para el rediseño

**Fase 0 — Tokens y limpieza (base de todo lo demás).**
Definir el set semántico (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`,
`--accent-contrast`, estados), escala de espaciado 4/8 y escala tipográfica. Migrar los 249 hex.
Reescribir el tema oscuro como valores de token. Sin cambio visual deliberado: es la base.

**Fase 1 — Identidad neutra.**
Paleta neutro oscuro + un acento, tipografía auto-hospedada, componente de logo configurable.
Aquí desaparece la marca Honey Whale del código y pasa a configuración.

**Fase 2 — Sistema de componentes.**
Una definición por componente (botón, campo, tarjeta, badge, modal, toast, tabla). Eliminar los 67
selectores duplicados y consolidar 13 breakpoints en 3.

**Fase 3 — Widget móvil.**
Pantalla completa, `dvh` + `visualViewport`, áreas seguras, contención de scroll, objetivos de 44px,
cinta de estado real de la conversación y formulario de citas por pasos. Es la superficie que ve el
cliente final: la que decide si el SaaS parece profesional.

**Fase 4 — Backoffice móvil.**
Maestro-detalle en conversaciones, formularios y modales revisados, objetivos táctiles, skeletons.

**Fase 5 — White-label.**
Configuración por cliente (acento, logo, modo claro/oscuro), previsualización en vivo y propagación
al widget vía `/api/widget-config`.

El orden importa: las fases 3 y 4 son mucho más baratas después de la 0 y la 2, porque hoy cada
arreglo responsive tiene que pelear con reglas duplicadas y colores fijos.
