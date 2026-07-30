# DESIGN.md — Referencia única de diseño · WhaleHub

Fuente de verdad. Todo color, medida y componente del front sale de aquí. Si algo en `styles.css` no coincide, el bug está en el CSS.

Estado: sistema de color cerrado en las Fases 0-3; escalas de layout cerradas en la Fase 4. Los patrones de composición por pantalla (P1-P8) y su calendario viven en [`layout-audit.md`](layout-audit.md) y se aplican en las Fases 5-8.

---

## 0. Regla única

**Los componentes no llevan valores literales.** Ni color, ni espaciado, ni altura de control, ni radio. Solo `var(--token)`.

Dos capas de tokens, y los componentes solo tocan la segunda:

| Capa | Qué es | Ejemplo | Quién la usa |
|---|---|---|---|
| **Primitivas** (90) | Un paso por color real de la interfaz, agrupadas por matiz | `--neutral-850`, `--blue-140` | Solo los semánticos. **Nunca** un componente. |
| **Semánticos** (97) | El rol que cumple el valor | `--surface`, `--accent`, `--space-4` | Todo el CSS de componentes. |

Verificación: `check-tokens.py` aplana el layout y falla si aparece un literal de espaciado, altura de control o radio fuera de `:root`, o una declaración con `var()` sin definir.

---

## 1. Color

Base **neutra fría** con un único acento **azul**. La identidad crema/dorada (`--gold #FFD106`, `--bg #FFFDF0`, `--ink`, `--muted`, `--line`) se retiró en las Fases 0-3: esos tokens ya no existen. El amarillo sobrevive solo como color de canal de marketplace y como estado de aviso.

### Tema

`:root` define el tema **claro**; `html[data-theme="dark"]` lo sobrescribe. El atributo lo pone `app.js` vía `document.documentElement.dataset.theme`, y **el valor por defecto es `dark`** (`app.js:43`), persistido en `localStorage` bajo `hwhub-theme`. Cualquier token nuevo se declara en las dos capas o no cambia con el tema.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#fafafa` | `#0a0a0a` | Fondo de app |
| `--surface` | `#ffffff` | `#111113` | Tarjetas y paneles |
| `--surface-sunken` | `#f4f4f5` | `#0a0a0a` | Fondo hundido (cabeceras de tabla, filtros) |
| `--surface-raised` | `#ffffff` | `#18181b` | Elevado (modales, dropdowns) |
| `--text` | `#111113` | `#fafafa` | Texto normal |
| `--text-strong` | `#0a0a0a` | `#ffffff` | Títulos y énfasis |
| `--text-muted` | `#52525b` | `#a1a1aa` | Texto secundario (AA ✅ en ambos) |
| `--text-subtle` | `#64646d` | `#8b8b93` | Meta, timestamps |
| `--border` | `#e4e4e7` | `#27272a` | Bordes y divisores |
| `--border-strong` | `#8b8b93` | `#64646d` | Borde de control enfocable |

### Acento

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--accent` | `#2563eb` | `#2f6df0` | Acción primaria, estado activo |
| `--accent-strong` | `#1d4ed8` | — | **Solo fondo**, por eso no se aclara en oscuro |
| `--accent-hover` / `--accent-active` | `#1d4ed8` / `#1e40af` | — | Estados del acento |
| `--accent-contrast` | `#ffffff` | `#ffffff` | Texto **sobre** el acento sólido |
| `--accent-text` | `#1d4ed8` | — | Acento **como** texto sobre fondo claro |
| `--accent-subtle` | `#eff6ff` | — | Tinte de fondo |

Regla: sobre acento sólido, siempre `--accent-contrast`. El acento como texto usa `--accent-text`, nunca `--accent`.

### Estado

Cada estado tiene tres tokens: sólido (fondo), superficie (tinte) y texto. No mezclar el sólido como color de texto.

| Estado | Sólido | Superficie | Texto (claro → oscuro) |
|---|---|---|---|
| Éxito | `--success` | `--success-surface` / `--success-border` | `--success-text` `#047857` → `#34d399` |
| Error | `--danger`, `--danger-strong` | `--danger-surface` / `--danger-border` | `--danger-text` `#991b1b` → `#f87171` |
| Aviso | `--warning` | `--warning-surface` | `--warning-text` `#92400e` → `#fbbf24` |
| Info | `--info` | `--info-surface` / `--info-border` | `--info-text` `#1d4ed8` → `#93b4fb` |
| Neutro | `--chip-surface` | — | `--text-muted` |

### Chrome y canal

`--chrome-hover`, `--chrome-text-muted`, `--chrome-text-subtle`, `--chrome-border`: superficie oscura fija (sidebar), no cambia con el tema.

`--brand-mercadolibre` `#ffe600` y `--brand-amazon` `#ff9900` **identifican al canal**, no decoran. Único uso legítimo del amarillo como color de marca.

`--bubble-bot` (teal) y `--bubble-agent` (neutro) distinguen autor en el hilo.

---

## 2. Escalas de layout

### Espaciado — base 4/8

| Token | px | | Token | px |
|---|---|---|---|---|
| `--space-1` | 4 | | `--space-6` | 24 |
| `--space-2` | 8 | | `--space-7` | 28 |
| `--space-3` | 12 | | `--space-8` | 32 |
| `--space-4` | 16 | | `--space-10` | 40 |
| `--space-5` | 20 | | `--space-12` | 48 |

No existen `--space-9` ni `--space-11`: la escala se abre a partir de 32px. Un valor nuevo se redondea al paso más cercano y, **en empate (6, 10, 14, 18, 22…), hacia arriba**.

Excepciones admitidas, y son las únicas: `0`, valores por debajo de 2px (no hay paso que los represente) y por encima de 48px (medidas de shell, no de ritmo).

### Altura de control

| Token | px | Uso |
|---|---|---|
| `--control-sm` | 32 | Chips, acciones dentro de tarjeta, filtros densos |
| `--control-md` | 40 | Input, select y botón por defecto |
| `--control-lg` | 48 | CTA principal, controles del topbar |

Sustituyen a los 30/34/38/39/40/42/46/48 que había repartidos por pantalla. **Un cuadrado decorativo no es un control**: avatares y marca (`width == height`) conservan su medida propia, porque tocar solo el alto los deforma.

### Radio

| Token | px | Uso |
|---|---|---|
| `--radius-xs` | 6 | Chips, badges |
| `--radius-sm` | 9 | Controles |
| `--radius-md` | 14 | Tarjetas y paneles |
| `--radius-lg` | 18 | Modales |
| `--radius-full` | 999 | Pastillas y toggles |

`--radius-full` es el token de pastilla; no se añadió un `--radius-pill` porque ya existía. `50%` sigue siendo literal: es un círculo, no un paso de escala.

### Shell

| Token | Valor | Uso |
|---|---|---|
| `--topbar-height` | 65px | Alto del topbar; `calc(100vh - var(--topbar-height))` en Conversaciones |
| `--sidebar-width` | 200px | Ancho de la sidebar fija y `margin-left` del contenido |
| `--inbox-list-width` | 340px | Columna de bandeja |
| `--inbox-context-width` | 300px | Columna de contexto |
| `--content-max-width` | 1440px | **Sin uso todavía**: lo consume el patrón P1 en la Fase 5 |

### Tipografía

| Token | Valor | | Token | Valor |
|---|---|---|---|---|
| `--font-sans` | Plus Jakarta Sans, system-ui | | `--font-size-md` | 0.9rem |
| `--font-display` | Fraunces, Georgia, serif | | `--font-size-base` | 1rem |
| `--font-mono` | ui-monospace, SF Mono, Menlo | | `--font-size-lg` | 1.15rem |
| `--font-size-2xs` | 0.68rem | | `--font-size-xl` | 1.4rem |
| `--font-size-xs` | 0.72rem | | `--font-size-2xl` | 1.75rem |
| `--font-size-sm` | 0.82rem | | | |

Pesos: `--font-weight-regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 · `black` 800.
Interlineado: `--line-height-tight` 1.2 · `--line-height-normal` 1.5.

### Sombras

`--shadow-sm` y `--shadow` (hoy con el mismo valor: `0 1px 2px` + `0 8px 24px`, ambas casi planas). Elevación por superficie y borde, no por sombra.

---

## 3. Especificación de componentes

Valores canónicos. Donde el CSS tenga duplicados conflictivos, este es el correcto.

Las **alturas y los radios** de esta tabla ya están aplicados (Fase 4). Los **paddings** son el destino: hoy cada componente usa su paso de la escala, pero la unificación por rol la cierran las Fases 5-8.

| Componente | Alto | Radio | Padding | Notas |
|---|---|---|---|---|
| Input / select | `--control-md` | `--radius-sm` | `0 var(--space-3)` | Borde `1px --border-strong`; foco por `--accent` |
| Textarea | por `rows`, mínimo 88px | `--radius-sm` | `var(--space-3)` | Mismo radio y borde que input |
| Botón | `--control-md` | `--radius-sm` | `0 var(--space-4)` | Sin ancho fijo |
| Botón denso (tarjeta/filtro) | `--control-sm` | `--radius-sm` | `0 var(--space-3)` | |
| Chip / pastilla | `--control-sm` | `--radius-full` | `0 var(--space-3)` | |
| Tarjeta | — | `--radius-md` | `var(--space-4)` | Fondo `--surface`, borde `1px --border` |
| Panel | — | `--radius-md` | `var(--space-5)` | |
| Cabecera de panel | — | — | `padding-bottom: var(--space-4)` | Borde inferior + `margin-bottom: var(--space-4)` |
| Modal | — | `--radius-lg` | `var(--space-5)` | Fondo `--surface-raised` |

### Botón, por variante

| Variante | Fondo | Texto |
|---|---|---|
| Primario | `--accent` | `--accent-contrast` |
| Secundario | `--surface` | `--text` + borde `1px --border` |
| Destructivo | `--danger` | `--text-inverse` |

Hover del primario: `--accent-hover`. Activo: `--accent-active`. Foco visible siempre, en cualquier variante.

### Campo de color

Patrón `.color-pair`: swatch + hex editable. **Nunca** un `input[type=color]` suelto, que hereda el input genérico y se pinta como barra a todo lo ancho.

```html
<div class="color-pair">
  <input type="color" name="…"><input type="text" data-hex aria-label="… en hexadecimal">
</div>
```

El `name` vive en el input de color: el hex es otra forma de escribir el mismo valor, no un campo aparte. Lo sincronizan `syncColorPairs` / `bindColorPairs` (`app.js`), compartidos por Marca y Chatbot.

### Grupo de campos

`.field-group` > `.field-label` + control, con `gap: var(--space-1)`. El `<label>` envolviendo el control no permite controlar el espacio etiqueta→campo; el patrón correcto es este.

### Toggle (`.switch-row`) — único toggle del sistema

```html
<label class="switch-row"><input type="checkbox"><span></span><em>Etiqueta</em></label>
```

- Riel pill · OFF `--border` · ON `--accent`.
- Perilla `::after` **siempre** `--white`, en base y en `:checked`; en `:checked` solo `translateX`.
- `<span>` y `<em>` son obligatorios: el CSS estiliza el span como riel. Sin ellos no renderiza.
- Prohibido: `.check` / `.check-row` (eliminados), perilla con fondo oscuro.

### Tabla

Cabecera `--surface-sunken` con texto `--text-muted`. Filas con borde inferior `1px --border` y hover `--row-hover`. Padding de celda `var(--space-2) var(--space-3)`.

**Móvil (<768px):** sin scroll horizontal — colapsar a lista de tarjetas, una por fila, con label:valor apilado.

---

## 4. Layout

**Mobile-first:** la base es una columna apilada; el multicolumna es enhancement por `@media (min-width: …)`.

### Desktop

- **Sidebar** fija a la izquierda, `--sidebar-width`, sobre superficie de chrome oscura.
- **Contenido** con `margin-left: var(--sidebar-width)` y padding de página `var(--space-5) var(--space-7) var(--space-10)`.
- Módulos form + lista a dos columnas. Conversaciones a tres (bandeja / hilo / contexto).
- App shell `height: 100vh` con scroll interno por vista.

### Móvil (<768px)

- Sidebar oculta → **bottom nav** fija con los destinos primarios; el contenido reserva su alto abajo.
- Una columna, `margin-left: 0`.
- **Conversaciones:** navegación por vistas (lista → hilo → contexto como push views), nunca tres paneles a la vez.
- Formularios largos: secciones colapsables, no scroll infinito.
- Topbar: título + una acción; el resto a overflow.
- Objetivos táctiles ≥44px, por encima de `--control-md`.

Los patrones canónicos de composición (shell de página, grid de tarjetas por `auto-fill`, área de dos columnas, app shell de tres, formulario y grupo de acciones) están especificados en [`layout-audit.md` §2.4](layout-audit.md) y se adoptan en las Fases 5-8.

---

## 5. Contraste (WCAG AA: 4.5:1 normal · 3:1 grande o bold)

El acento azul sí funciona como texto, a diferencia del dorado que sustituyó. Aun así, cada rol tiene su token: el sólido pinta, el `-text` escribe.

### Permitido

| Texto | Fondo |
|---|---|
| `--text` / `--text-strong` | `--bg`, `--surface`, `--surface-raised` |
| `--text-muted` | `--surface` (AA en claro y en oscuro) |
| `--accent-contrast` | `--accent`, `--accent-strong` |
| `--accent-text` | `--surface`, `--accent-subtle` |
| `--success-text` / `--danger-text` / `--warning-text` / `--info-text` | su `-surface` correspondiente |

### Prohibido

| Texto | Fondo | Usar en su lugar |
|---|---|---|
| `--accent` como texto | claro | `--accent-text` |
| Sólido de estado (`--success`, `--danger`, `--warning`) como texto | cualquiera | su token `-text` |
| `--text-subtle` | `--surface-sunken` | `--text-muted` |
| Amarillo de canal (`--brand-*`) como texto | cualquiera | es color de identidad, solo fondo o icono |
| Cualquier hex literal | cualquiera | el token semántico del rol |

### Regla rápida

- Sólido → fondo. `-text` → texto. `-surface` → tinte.
- Todo par nuevo texto/fondo se declara en claro **y** en oscuro.
- Si hay que elegir entre bajar el contraste o cambiar el token, se cambia el token.
