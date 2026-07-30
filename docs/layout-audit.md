# Auditoría de layout — backoffice WhaleHub

Diagnóstico previo al reacomodo uniforme. **No incluye cambios de código.** El sistema de color quedó cerrado en las Fases 0-3; esto trata exclusivamente de estructura, espaciado, densidad y consistencia de componentes.

Método: análisis estático de `web/styles.css` (6 511 líneas), `web/index.html` (1 105) y `web/app.js` (2 605), resolviendo el selector contenedor de cada declaración y el orden real de cascada. Las cifras son medidas, no estimaciones.

---

## 0. Hallazgos transversales

Estos cuatro explican la mayoría de los síntomas por pantalla. Atacarlos primero hace que el resto del reacomodo sea mecánico.

### 0.1 · La escala `--space-*` existe y no se usa — **P0**

La Fase 0 definió nueve pasos (`--space-1: 4px` … `--space-12: 48px`). Uso real en toda la hoja:

```
usos de var(--space-*):        0
declaraciones de espaciado:  489   (padding 176 · gap 158 · margin 136 · otros 19)
valores literales distintos:  68   en 514 ocurrencias
```

Los 68 valores conviven en **dos sistemas de unidades en paralelo**: `rem` con decimales arbitrarios (`0.55rem`, `0.42rem`, `0.78rem`, `0.18rem`, `1.35rem`) y `px` enteros (`10px`, `13px`, `14px`, `18px`, `22px`). No hay conversión coherente entre ambos: `0.55rem` = 8.8px convive con `8px` y con `9px` en contextos equivalentes.

Los 12 valores más frecuentes concentran el 60 % del uso y **casi todos caen a 1-2px de un paso de la escala** — es decir, el reacomodo es en su mayoría redondeo, no rediseño:

| Actual | Ocurrencias | Paso destino | Δ |
|---|---|---|---|
| `1rem` (16px) | 45 | `--space-4` (16) | 0 |
| `0.75rem` (12px) | 28 | `--space-3` (12) | 0 |
| `0.55rem` (8.8px) | 27 | `--space-2` (8) | −0.8 |
| `12px` | 26 | `--space-3` (12) | 0 |
| `10px` | 26 | `--space-2` (8) o `--space-3` (12) | ±2 |
| `8px` | 22 | `--space-2` (8) | 0 |
| `14px` | 22 | `--space-4` (16) | +2 |
| `16px` | 20 | `--space-4` (16) | 0 |
| `0.85rem` (13.6px) | 19 | `--space-3` (12) | −1.6 |
| `0.25rem` (4px) | 17 | `--space-1` (4) | 0 |
| `0.8rem` (12.8px) | 15 | `--space-3` (12) | −0.8 |
| `0.35rem` (5.6px) | 15 | `--space-1` (4) | −1.6 |

Falta un paso intermedio: no existe `--space-7` (28px), y `22px`/`28px` se usan hoy como padding de página. Ver §2.1.

### 0.2 · Generaciones de layout apiladas que se pisan — **P0**

El CSS contiene al menos **tres generaciones de reglas de layout** sobre los mismos selectores, sin que las anteriores se hayan retirado. Gana la última por orden de cascada; las previas son peso muerto que hace imposible razonar sobre el archivo.

Selectores redefinidos (conteo de bloques distintos):

```
x8  .topbar · .grid-two · .widget-preview-panel · .editor · .wh-topbar.topbar
x7  textarea · .user-pill · .metrics · .status-metrics button · .embed-box · .reply-form · main.wh-main
x6  .status-metrics · .metrics article · .conversation-workspace · .chatbot-block · .module-grid
x5  input · select
```

Ejemplo literal, `.wh-inbox .filters` — dos definiciones con **modelo de caja distinto**:

```css
/* línea 3541 — generación rem */        /* línea 4160 — generación px (gana) */
display: grid;                           display: flex;
grid-template-columns: 1fr;              flex-wrap: wrap;
gap: 0.55rem;                            gap: 6px;
padding: 0.8rem;                         padding: 10px 16px 14px;
```

Otro, `.conversation-workspace.wh-inbox`:

```css
/* 3514 */ grid-template-columns: minmax(300px,340px) minmax(420px,1fr) minmax(280px,310px); gap: 0.85rem;
/* 4118 */ grid-template-columns: 340px minmax(0,1fr) 300px;                                 gap: 0;
```

Consecuencia práctica: cualquier ajuste hecho sobre la generación equivocada no tiene efecto visible, lo que invita a añadir una cuarta capa. **El reacomodo debe empezar por podar, no por añadir.**

Residuo notable: el `.topbar` de la generación 1 usa un hack de márgenes negativos para romper el padding de página (`margin: -1.25rem calc(clamp(1rem,2vw,2rem) * -1) 1.25rem`) que ya no aplica, porque la generación 3 puso `main.wh-main { padding: 0 }`.

### 0.3 · Alturas de control sin sistema — **P1**

Un mismo tipo de control mide distinto según la pantalla. Medido sobre `min-height` declarado:

| Control | Alturas encontradas | Dónde |
|---|---|---|
| Input / select | **42px** global · **39px** editor · **34px** filtros bandeja · **46px** input de respuesta | 4 valores |
| Botón | **40px** `.wh-app` · **38px** topbar · **36px** enviar · **34px** acciones de fila, formulario, filtros, acciones de conversación, respuestas rápidas · **30px** acciones dentro de tarjeta | 5 valores |
| Enlace de navegación | **56px** · **40px** · **38px** · **36px** | 4 generaciones apiladas |
| Pastilla / chip | **36px** · **28px** · **27px** · **24px** | 4 valores |
| Textarea | 150 · 92 · 86 · 72 · 70 · 44 · 22px | 7 valores |

No hay token de altura de control. El resultado es que en Conversaciones conviven en la misma columna botones de 34px con un input de 46px, y en el topbar botones de 38px junto a un `user-pill` de 48px.

### 0.4 · Radios sin sistema — **P1**

Sólo dos radios están tokenizados (`--radius-sm: 9px`, `--radius-md: 14px`), y compiten con **13 literales**:

```
25x 999px    16x --radius-md   14x --radius-sm   13x 4px    12x 50%
11x 8px       8x 0              7x 9px            6x 5px     6x 11px
 5x 7px       3x 10px           2x 6px            2x 12px    1x 20px   1x 18px
```

`9px` aparece siete veces como literal **teniendo el token que vale exactamente 9px**. Tarjetas equivalentes (`.card`, `.faq`, `.rule`, `.item`) declaran `5px` en la generación 1 y `--radius-md` en la 2.

---

## 1. Hallazgos por pantalla

### 1.1 · Conversaciones — **P0**, la pantalla más comprometida

Confirmados los tres síntomas reportados, con causa identificada en cada uno.

**a) El bloque de filtros ocupa espacio excesivo y comprime la lista.** Causa: la generación que gana convierte los filtros en `flex-wrap` con el buscador forzado a fila propia:

```css
.wh-inbox .filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 14px }
.wh-inbox .filters input { flex: 1 1 100%; order: -1 }   /* buscador: fila completa, primero */
.wh-inbox .filters select, .wh-inbox .filters input { min-height: 34px }
```

Con un buscador a 100 % + tres `select` + un botón «Limpiar» envolviendo, el bloque ocupa **tres filas ≈ 140px**. Sumado a la cabecera de columna (`padding: 14px 16px` + eyebrow + h2 + nota + pastilla SSE ≈ 90px), el cromo consume **~230px antes del primer chat**. La lista recibe el resto con `overflow-y: auto` propio, dentro de un contenedor ya limitado a `height: calc(100vh - 65px)`: de ahí la sensación de lista comprimida con scroll propio y vacío arriba.

**b) Los botones de acción son sueltos y de ancho desigual.** `.conversation-actions` y `.wh-quick-replies` son dos `flex` independientes con `gap` distinto según la generación (`0.45rem` vs el bloque px), y los botones no tienen ancho mínimo ni agrupación:

```
Tomar chat · Pausar bot · Reactivar bot · Cerrar chat        ← 4 anchos distintos
📅 Agendar cita · 📦 Estado de pedido · 📍 Sucursal cercana   ← 3 anchos distintos
```

Siete botones sueltos, dos filas sin relación visual, todos a 34px de alto dentro de un composer con `padding: 14px 18px`. No hay jerarquía: «Cerrar chat» (destructivo) pesa lo mismo que «Agendar cita» (atajo de texto).

**c) Las tres columnas tienen densidades distintas.** Cada columna resuelve su padding interior por su cuenta:

| Columna | Cabecera | Cuerpo |
|---|---|---|
| Bandeja | `14px 16px` | lista `padding: 0`, tarjetas `13px 16px` |
| Hilo | `14px 16px` | cuerpo `22px 18px`, composer `14px 18px` |
| Contexto | `14px 16px` | `padding: 0`, secciones propias |

Tres paddings horizontales (16 / 18 / 0) y tres verticales en una misma fila visual. Las cabeceras sí coinciden — es lo único alineado.

**d) Es la única pantalla sin padding de página.** `padding: 0` y altura fija de viewport, mientras el resto usa `22px 28px 40px`. Es una decisión defendible (modo *app shell* tipo bandeja de correo), pero hoy no está declarada como patrón: es el efecto colateral de una regla de excepción. Ver §2.4 P6.

### 1.2 · Chatbot — **P0**

**a) Inputs de color como barras a todo lo ancho.** Confirmado, y con una solución ya presente en el código. La vista usa el control desnudo:

```html
<label>Cabecera<input name="headerColor" type="color"></label>
```

Sin regla propia, `input[type="color"]` hereda el input genérico (`width: 100%`, `padding: 0.72rem 0.8rem`, `min-height: 42px`) y se pinta como barra. **En Configuración → Marca ya existe el patrón correcto**, sin usar:

```css
.color-pair { display: flex; gap: 6px; align-items: center }
.color-pair input[type="color"] { width: 36px; height: 32px; padding: 0; border-radius: 8px }
.color-pair input[type="text"]  { flex: 1 1 auto; min-width: 0 }   /* hex editable */
```

Son cinco campos de color en Chatbot (cabecera, texto cabecera, acento, burbuja bot, burbuja cliente). Adoptar `.color-pair` los compacta y de paso les da entrada hex, que hoy no tienen.

**b) Tres ritmos verticales en una sola pantalla.** El formulario anida tres `gap` distintos sin razón semántica:

```css
.chatbot-settings-form { gap: 1rem }      /* 16px entre bloques   */
.chatbot-ai-settings   { gap: 0.85rem }   /* 13.6px dentro del 01 */
.chatbot-form-grid     { gap: 0.75rem }   /* 12px dentro del 02   */
```

Ningún salto corresponde a una jerarquía real: 01 y 02 son secciones hermanas con separación interna distinta.

**c) Las dos columnas no comparten ritmo.** `.chatbot-console` es `1.55fr / minmax(320px, 0.85fr)` con `align-items: start`; el formulario crece por contenido y la preview es `sticky top: 1rem`. Como los bloques del formulario miden distinto (`01` con textarea de 150px, `02` con grid de 11 campos), ninguna línea horizontal coincide entre columnas. La numeración `01…06` refuerza visualmente una secuencia que el layout no respeta: `04`, `05` y `06` viven en `.chatbot-tools`, una tercera zona a ancho completo debajo.

**d) Alturas de campo inconsistentes dentro del mismo formulario.** Inputs a 42px, textarea del prompt a 150px, textarea del embed a 72px, `select` de canal a 39px (regla `.editor`).

### 1.3 · Dashboard — **P1**

- **Cuatro grids distintos apilados verticalmente, con cuatro `gap` distintos**: `.dashboard-hero` (2 col, `gap: 1rem`), `.metrics` (4 col, `gap: 16px`), `.status-metrics` (7 col, `gap: 10px`), `.dashboard-insights` (3 col, `gap: 14px`). Cuatro ritmos horizontales en una sola página.
- **Columnas fijas por conteo, no por ancho mínimo**: `repeat(4, …)`, `repeat(5, …)` y `repeat(7, minmax(120px, 1fr))`. Con 7 columnas de 120px mínimo, las tarjetas de estado se aplastan en pantallas medianas antes de que salte el breakpoint.
- **Alturas de tarjeta divergentes**: `.metrics article` y `.status-metrics button` declaran `min-height: 106px` en una generación y `82px` en otra.
- Jerarquía débil: `.metrics` (4 KPIs) y `.status-metrics` (7 atajos) son visualmente casi idénticas pese a tener función distinta (indicador vs filtro accionable).

### 1.4 · Módulos de lista — Agentes, FAQs, Sucursales, Directorio, Ruteo — **P1**

Las cinco comparten estructura (`.module-header` + `.module-grid` > `.panel.list-panel`) y difieren en detalles que deberían ser idénticos:

- **La barra de acción no alinea con el contenido**: `.module-header { padding: 10px 20px }` dentro de una vista con `padding: 22px 28px 40px`. El botón «+ Nuevo» queda **8px a la izquierda** del borde del panel que tiene debajo. Afecta a las cinco pantallas.
- **`.module-grid` declara dos columnas para contenido de una**: `grid-template-columns: 300px minmax(0,1fr)` con un único hijo `.list-panel`, que por tanto ocupa la columna de 300px salvo que otra regla lo corrija. Sólo Configuración → APIs usa realmente las dos columnas.
- **Filtros con dos tratamientos**: Sucursales y Directorio usan `.filters` (caja con `padding: 16px 20px`, borde y `margin-bottom: 16px`); FAQs usa un `.search` suelto con `margin-bottom: 0.9rem`; Agentes y Ruteo no tienen filtros. Tres soluciones para el mismo problema.
- **Contenedores de lista con `gap` distinto**: `.cards` `0.75rem` · `.faq-list` `0.75rem` · `.rules` `0.75rem` en la generación 1, pero `.list-panel .cards` pasa a `14px` en la 2.
- **Tarjetas**: `.card`/`.faq`/`.rule`/`.item` comparten `padding: 0.85rem` y `border-radius: 5px` en una generación, `--radius-md` en otra.

### 1.5 · Configuración — **P1**

Cinco tabs con cinco layouts internos distintos:

| Tab | Layout | Espaciado propio |
|---|---|---|
| Marca | `.settings-form` + `.field-grid-2` / `.field-grid-3` | `gap: 14px` / `12px` |
| APIs | `.module-grid` de 2 columnas (form + lista) | `gap: 18px`, `.editor gap: 12px` |
| Accesos | eyebrow + título + `.module-header` + `.module-grid`, repetido dos veces | mezcla de patrones |
| Base de Conocimiento | — | — |
| Notificaciones | — | — |

- Es la **única** pantalla con encabezados de sección propios (`.form-section-eyebrow` + `.form-section-title`); el resto usa `header` dentro de `.panel`. Dos sistemas de titulación de sección conviviendo.
- Marca es el único formulario con el patrón correcto de campo (`.field-group` > `.field-label` + control) — el resto del backoffice usa `<label>` envolviendo el control, que no permite controlar el espacio etiqueta→campo.
- Accesos repite `.module-header` + `.module-grid` dos veces en la misma vista, heredando el desalineado de §1.4.

### 1.6 · Login — **P2**

- `.login-card` con tres definiciones: `padding: 1.35rem` + `border-radius: 6px`, luego `border-radius: 10px`, luego `padding: 1rem` en móvil. Ninguna usa `--radius-md`.
- Único formulario del producto con `<label>` envolvente y sin `.field-group`; sus inputs heredan los 42px globales, correctos, pero el `gap: 1rem` entre campos es mayor que el `12px` del resto de formularios.
- Es la pantalla más aislada y la de menor riesgo: buen candidato para validar el sistema nuevo antes de tocar las pantallas densas.

### 1.7 · Documentación desalineada — **P2**

`docs/DESIGN.md` se declara «fuente de verdad» y sigue describiendo la identidad crema/dorada (`--gold #FFD106`, `--bg #FFFDF0`, `--ink`, `--muted`, `--line`) retirada en las Fases 0-3. Ninguno de esos tokens existe ya en `styles.css`. Debe actualizarse en el mismo lote que el reacomodo, o se convierte en una fuente de errores para quien la consulte.

---

## 2. Sistema de layout propuesto

### 2.1 · Escala de espaciado aplicada

Se conserva la escala 4/8 de la Fase 0 y se añade el paso que falta:

```
--space-1:   4px      --space-5:  20px      --space-10: 40px
--space-2:   8px      --space-6:  24px      --space-12: 48px
--space-3:  12px      --space-7:  28px  ←nuevo
--space-4:  16px      --space-8:  32px
```

Asignación canónica — cada caso de uso tiene **un** paso, no un rango:

| Caso de uso | Token | px | Sustituye a |
|---|---|---|---|
| Padding de página (vertical superior) | `--space-5` | 20 | `22px`, `1.25rem` |
| Padding de página (horizontal) | `--space-7` | 28 | `28px`, `clamp(1rem,2vw,2rem)` |
| Padding de página (inferior) | `--space-10` | 40 | `40px`, `2rem` |
| Separación entre secciones de página | `--space-6` | 24 | `1rem`, `16px`, `18px` |
| Gap entre tarjetas de un grid | `--space-4` | 16 | `1rem`, `14px`, `16px`, `18px`, `10px` |
| Padding interno de panel | `--space-5` | 20 | `clamp(1rem,1.6vw,1.35rem)`, `0.85rem` |
| Padding interno de tarjeta | `--space-4` | 16 | `0.85rem`, `13px 16px` |
| Cabecera de panel → contenido | `--space-4` | 16 | `1rem`, `0.85rem`, `14px` |
| Gap entre campos de formulario | `--space-3` | 12 | `0.75rem`, `12px`, `0.65rem` |
| Gap entre secciones de formulario | `--space-5` | 20 | `1rem`, `0.85rem`, `14px` |
| Etiqueta → control | `--space-1` | 4 | `0.25rem`, `2px`, `5px` |
| Gap entre botones de un grupo | `--space-2` | 8 | `0.55rem`, `0.45rem`, `6px`, `7px`, `8px` |
| Gap entre chips / pastillas | `--space-2` | 8 | `0.42rem`, `6px`, `4px` |
| Padding interior de columna (bandeja) | `--space-4` | 16 | `16px`, `18px`, `0.8rem`, `0` |

Regla: **ningún valor literal de espaciado en componentes.** Mismo criterio que cerró el color en la Fase 3.

### 2.2 · Tokens de componente nuevos

```
/* alturas de control — reemplazan 30/34/36/38/39/40/42/46/48 */
--control-sm:  32px   /* chips, acciones dentro de tarjeta, filtros densos */
--control-md:  40px   /* input, select y botón por defecto */
--control-lg:  48px   /* CTA principal, controles del topbar */

/* radios — reemplazan los 13 literales */
--radius-xs:    6px   /* chips, badges */
--radius-sm:    9px   /* controles (valor actual, se conserva) */
--radius-md:   14px   /* tarjetas y paneles (valor actual, se conserva) */
--radius-lg:   18px   /* modales */
--radius-pill: 999px

/* medidas de shell — hoy repetidas a mano en calc() */
--topbar-height:      65px
--inbox-list-width:  340px
--inbox-context-width: 300px
--content-max-width: 1440px
```

Las alturas cierran así: filtros de bandeja 34→32, input global 42→40, botones 34/36/38→40, acciones en tarjeta 30→32, input de respuesta 46→40. `--content-max-width` es nuevo: hoy nada limita el ancho, y en monitores anchos las filas de 4-7 tarjetas se estiran sin control.

### 2.3 · Reglas de componente uniformes

| Componente | Regla |
|---|---|
| Input / select | alto `--control-md`, radio `--radius-sm`, padding `0 var(--space-3)` |
| Textarea | mismo radio y padding; alto por `rows`, mínimo `88px` |
| Botón | alto `--control-md`, radio `--radius-sm`, padding `0 var(--space-4)`, sin ancho fijo |
| Botón denso (en tarjeta/filtro) | alto `--control-sm`, padding `0 var(--space-3)` |
| Chip / pastilla | alto `--control-sm`, radio `--radius-pill`, padding `0 var(--space-3)` |
| Tarjeta | padding `--space-4`, radio `--radius-md`, borde `1px var(--border)` |
| Panel | padding `--space-5`, radio `--radius-md` |
| Cabecera de panel | `padding-bottom: var(--space-4)`, borde inferior, `margin-bottom: var(--space-4)` |
| Campo de color | patrón `.color-pair` (swatch 36×32 + hex), **nunca** `input[type=color]` suelto |
| Grupo de campos | `.field-group` > `.field-label` + control, `gap: var(--space-1)` |

### 2.4 · Patrones canónicos de layout

**P1 — Shell de página.** Todas las vistas salvo Conversaciones.

```
.view.active
  display: grid
  gap: var(--space-6)
  padding: var(--space-5) var(--space-7) var(--space-10)
  max-width: var(--content-max-width)
```

**P2 — Encabezado de módulo.** Retira `.module-header` como barra suelta: la acción primaria va en el slot de acciones del topbar o en la cabecera del panel. Elimina el desalineado de 8px de §1.4 sin tocar el padding de página.

**P3 — Grid de tarjetas.** Sustituye todos los `repeat(N, …)` fijos:

```
display: grid
grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))
gap: var(--space-4)
```

Un solo patrón para `.metrics`, `.status-metrics`, `.cards`, `.dashboard-insights`. El conteo de columnas pasa a ser consecuencia del ancho disponible, no un número escrito a mano por breakpoint — elimina de paso buena parte de las media queries de §1.3.

**P4 — Panel de sección.** Contenedor único para todo bloque titulado:

```
.panel            padding: var(--space-5); border-radius: var(--radius-md); display: grid; gap: var(--space-4)
.panel > header   padding-bottom: var(--space-4); border-bottom: 1px solid var(--border)
```

Absorbe los dos sistemas de titulación de §1.5 en uno.

**P5 — Área de trabajo de dos columnas.** Chatbot (form + preview) y Configuración → APIs (form + lista):

```
display: grid
grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr)
gap: var(--space-6)
align-items: start
```

**P6 — App shell de tres columnas.** Exclusivo de Conversaciones, declarado como patrón y no como excepción:

```
height: calc(100vh - var(--topbar-height))
grid-template-columns: var(--inbox-list-width) minmax(0, 1fr) var(--inbox-context-width)
gap: 0                          /* separación por borde, no por hueco */
```

Cada columna: `header` fijo + cuerpo con scroll propio, **mismo padding interior `--space-4` en las tres**. Resuelve §1.1c.

**P7 — Formulario.**

```
.form           display: grid; gap: var(--space-5)   /* entre secciones */
.form-section   display: grid; gap: var(--space-3)   /* entre campos    */
.field-grid-2/3 gap: var(--space-3)
.field-group    display: grid; gap: var(--space-1)   /* etiqueta→control */
```

Un solo ritmo vertical, contra los tres de §1.2b.

**P8 — Grupo de acciones.** Para las siete acciones sueltas de §1.1b:

```
.actions        display: flex; flex-wrap: wrap; gap: var(--space-2)
.actions--split separador antes de la acción destructiva
```

Acciones de estado (Tomar / Pausar / Reactivar / Cerrar) agrupadas como control segmentado con ancho compartido; respuestas rápidas como chips de `--control-sm`, visualmente subordinadas. Da la jerarquía que hoy no existe.

---

## 3. Resumen priorizado

| # | Hallazgo | Pantalla | Sev. | Esfuerzo | Impacto visual |
|---|---|---|---|---|---|
| 1 | Escala `--space-*` con 0 usos; 68 literales | Todas | **P0** | Alto | Alto |
| 2 | Generaciones de layout apiladas (hasta 8 por selector) | Todas | **P0** | Alto | Nulo (poda) |
| 3 | Filtros comprimen la lista (~230px de cromo) | Conversaciones | **P0** | Medio | Alto |
| 4 | Siete botones sueltos sin agrupar ni jerarquía | Conversaciones | **P0** | Medio | Alto |
| 5 | Tres densidades distintas en tres columnas | Conversaciones | **P0** | Bajo | Alto |
| 6 | Inputs de color como barras (patrón ya existe sin usar) | Chatbot | **P0** | Bajo | Alto |
| 7 | Tres ritmos verticales en un formulario | Chatbot | **P0** | Bajo | Medio |
| 8 | Columnas form/preview sin ritmo compartido | Chatbot | P1 | Medio | Medio |
| 9 | Alturas de control sin token (4-5 valores por tipo) | Todas | P1 | Medio | Medio |
| 10 | Radios sin sistema (13 literales) | Todas | P1 | Bajo | Bajo |
| 11 | Cuatro grids con cuatro `gap` en una página | Dashboard | P1 | Bajo | Medio |
| 12 | Columnas fijas por conteo, no por ancho mínimo | Dashboard | P1 | Bajo | Medio |
| 13 | `.module-header` desalineado 8px del panel | 5 módulos | P1 | Bajo | Medio |
| 14 | Tres tratamientos de filtro para el mismo problema | Módulos de lista | P1 | Bajo | Medio |
| 15 | Cinco tabs con cinco layouts internos | Configuración | P1 | Medio | Medio |
| 16 | Dos sistemas de titulación de sección | Configuración | P1 | Bajo | Bajo |
| 17 | `.login-card` con tres definiciones, radio fuera de token | Login | P2 | Bajo | Bajo |
| 18 | `docs/DESIGN.md` describe la identidad ya retirada | Documentación | P2 | Bajo | Nulo |

---

## 4. Fases propuestas para el reacomodo

**Fase 4 — Cimientos (sin cambio visual buscado).** Hallazgos 1, 2, 9, 10.
Poda de generaciones muertas, alta de `--space-7` y de los tokens de §2.2, y migración mecánica de los 514 literales a la escala. Se hace primero porque cada fase posterior es trivial sobre un archivo podado e imposible sobre el actual. Verificación: comparación visual pantalla a pantalla antes/después; los deltas deben ser ≤2px.

**Fase 5 — Conversaciones.** Hallazgos 3, 4, 5.
Filtros a una fila con desbordamiento controlado, patrón P6 con padding uniforme en las tres columnas, y P8 para agrupar las acciones. Es la pantalla de uso diario y la de peor diagnóstico.

**Fase 6 — Chatbot.** Hallazgos 6, 7, 8.
Adopción de `.color-pair` en los cinco campos de color, P7 para el ritmo del formulario y P5 para las dos columnas. El hallazgo 6 es el mejor arranque de todo el reacomodo: máximo impacto visual, mínimo riesgo, y el patrón ya está escrito.

**Fase 7 — Dashboard y módulos de lista.** Hallazgos 11, 12, 13, 14.
P3 para todos los grids de tarjetas, P2 para retirar `.module-header`, y filtro único para Sucursales, Directorio y FAQs.

**Fase 8 — Configuración, modales y Login.** Hallazgos 15, 16, 17, 18.
P4 y P7 aplicados a los cinco tabs, unificación de titulación de sección, y actualización de `docs/DESIGN.md` para que vuelva a ser fuente de verdad.

Cada fase cierra con la misma verificación que las Fases 0-3: cero literales de espaciado nuevos en componentes, contraste sin regresiones y captura comparativa antes/después.
