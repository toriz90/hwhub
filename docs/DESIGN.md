# DESIGN.md — Referencia única de diseño · WhaleHub

Fuente de verdad. Todo color/medida/componente del front sale de aquí. Si algo en `styles.css` no coincide, el bug está en el CSS.

---

## 1. Tokens de diseño

Definidos una sola vez en `:root` (light) y sobrescritos en `html[data-theme="dark"]`. Usar **siempre** la variable, nunca el hex literal.

### Color — marca (fijos, no cambian por tema)
| Token | Hex | Uso |
|-------|-----|-----|
| `--gold` | `#FFD106` | Primario. **Solo fondo** (ver §2). |
| `--amber` | `#FFA506` | Secundario/acento, hover de gold. **Solo fondo/borde.** |
| `--black` | `#000000` | Chrome oscuro fijo (sidebar, botones primarios) — no flipa con el tema. |
| `--white` | `#ffffff` | Texto sobre fondos oscuros/gold. |

### Color — tema (light → dark)
| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--bg` | `#FFFDF0` | `#0a0a0a` | Fondo de app |
| `--surface` | `#ffffff` | `#171b21` | Tarjetas/paneles |
| `--surface-soft` | `#f6f1e5` | `#12151a` | Paneles secundarios |
| `--ink` | `#000000` | `#ffffff` | Texto principal |
| `--muted` | `#667085` | `#9aa0a8` | Texto secundario (AA ✅) |
| `--line` | `#e7e3d8` | `#262b33` | Bordes/divisores |

### Color — estado (semánticos, no de marca)
| Token | Hex | Uso |
|-------|-----|-----|
| `--green` | `#059669` | OK/éxito — **solo fondo o texto grande/bold** (3.8:1) |
| `--red` / `--rose` | `#d6452f` / `#dc2626` | Error/destructivo |
| `--blue` | `#2f6df0` | Info/links |

> ⚠️ **Deprecado/no usar:** `--wh-muted-2 #9aa0a8` como texto en light (2.6:1, falla AA). Migrar a `--muted`.

### Tipografía
| Token | Valor |
|-------|-------|
| `--font-ui` | `"Plus Jakarta Sans", system-ui, …` |
| `--font-display` | `"Fraunces", Georgia, serif` (solo h1/títulos) |
| Escala | `11px` meta · `13px` body · `14px` énfasis · `18px` h3 · `24px` h2 · `32px` h1 |
| Pesos | `400` normal · `600` medio · `800` fuerte/labels · `750` display |

### Espaciado (escala única, base 4)
`4 · 8 · 12 · 16 · 24 · 32 · 48px`. Nada fuera de esta escala. Padding de componentes en §3.

### Radios
| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | `9px` | Inputs, botones, badges cuadrados |
| `--radius` | `14px` | Cards, paneles, modales |
| pill | `999px` | Toggles, tags, status pills |

### Sombras
| Token | Uso |
|-------|-----|
| `--shadow-soft` | Cards en reposo |
| `--shadow` | Elevación/hover, modales, dropdowns |

---

## 2. Reglas de uso: gold vs amber

**Gold `#FFD106` es brillante → casi blanco en luminancia.**

| Situación | Permitido |
|-----------|-----------|
| Gold como **fondo** + texto `--black` encima | ✅ (14.4:1) |
| Gold como **color de texto** sobre claro | ❌ (1.5:1) — usar `--ink` |
| Texto **blanco sobre gold** | ❌ (1.5:1) — usar negro |
| Gold como texto sobre **dark** (`#0a0a0a`) | ✅ (13.6:1) — único caso de gold-texto |
| Gold en **bordes/acentos** (border-left, focus ring) | ✅ |

**Amber `#FFA506`:** acento secundario, hover del gold, bordes. Mismas reglas que gold (no como texto sobre claro). Diferenciador visual: gold = acción primaria/marca; amber = énfasis secundario/hover.

Regla mnemónica: **gold/amber pintan, no escriben** (salvo sobre negro).

---

## 3. Especificación de componentes

Valores canónicos. Donde el CSS tenga duplicados conflictivos, este es el correcto.

### Botón
| Variante | Fondo | Texto | Borde | Radio | Padding |
|----------|-------|-------|-------|-------|---------|
| Primario | `--black` | `--white` | — | `--radius-sm` | `8px 12px` |
| Acción/CTA | `--gold` | `--black` | — | `--radius-sm` | `8px 12px` |
| Secundario | `--surface` | `--ink` | `1px --line` | `--radius-sm` | `8px 12px` |
| Destructivo | `--red` | `--white` | — | `--radius-sm` | `8px 12px` |
| Compacto (row-actions) | igual variante | — | — | `--radius-sm` | `6px 10px` |

Hover: oscurecer fondo (gold→amber). Foco: **una sola convención** → `box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 35%, transparent)`. Altura mínima táctil **44px** en móvil.

### Card / Panel
- Fondo `--surface` · borde `1px --line` · radio `--radius` · sombra `--shadow-soft` · padding `16px` (`clamp(12px,1.6vw,20px)`).
- Una sola definición de `.panel`. Nada de 5px/7px/12px sueltos.

### Badge / Pill / Tag
- Radio `999px` · padding `4px 9px` · font `11px/800`.
- Estado: fondo tinte claro + texto oscuro del mismo matiz (AA ≥4.5): OK `#047857`/verde-soft, warning `#92400e`/amber-soft, error `#991b1b`/red-soft, info `#1d4ed8`/blue-soft.
- Tags neutros: fondo `--surface-soft`, texto `--muted`.

### Input / Select / Textarea
- Fondo `--surface` · texto `--ink` · borde `1px --line` · radio `--radius-sm` · padding `10px 12px`.
- Foco: `border-color: --gold` + `box-shadow: 0 0 0 3px color-mix(--gold 22%, transparent)`. **Sin** mezclar outline+border.
- Ancho `100%` dentro de `.editor`.

### Toggle (`.switch-row`) — único toggle del sistema
```html
<label class="switch-row">
  <input type="checkbox"><span></span><em>Etiqueta</em>
</label>
```
- Riel `2.35rem×1.25rem` pill · OFF `--line` · ON `--gold`.
- Perilla `::after` **siempre `--white`** (base y `:checked`); en `:checked` solo `translateX`.
- `<span>` y `<em>` obligatorios (el CSS estiliza el span como riel). Sin ellos no renderiza.
- Prohibido: `.check`/`.check-row` (eliminados), perilla con fondo oscuro.

### Tabla / Matriz
- Header `--surface-soft`, texto `--muted/800`. Filas: borde inferior `1px --line`, hover `--table-hover`.
- Padding celda `8px 12px` · texto `13px`.
- **Móvil (<768px):** no scroll horizontal — colapsar a lista de cards (una card por fila, label:valor apilado).

---

## 4. Reglas de layout

**Mobile-first:** base = 1 columna apilada; multicolumna es enhancement vía `@media (min-width: …)`.

### Desktop (≥1024px)
- **Sidebar** fija izquierda, `--sidebar-width: 240px`, `position: fixed`, fondo `--black`.
- **Contenido** `margin-left: 240px`, padding `22px 28px`.
- Módulos form+lista: 2 columnas (`min-width:900px`). Conversaciones: 3 col (lista/thread/contexto) en `≥1100px`, 2 col `≥820px`.
- App-shell `height:100vh; overflow:hidden`; scroll interno por vista.

### Mobile (<768px)
- **Sidebar oculta** → **bottom nav fija** (4-5 destinos primarios: Dashboard, Conversaciones, Agentes, Chatbot, Más). `position: fixed; bottom: 0`, alto 56px, fondo `--surface`, item activo en `--gold`.
- Contenido: 1 columna, `margin-left:0`, `padding-bottom: 64px` (para no tapar con bottom nav).
- App-shell libera scroll: `height:auto; overflow-y:auto`.
- **Conversaciones:** navegación por vistas (lista → thread → contexto como push views), nunca 3 paneles. Contexto accesible vía botón/drawer.
- **Formularios largos:** secciones colapsables (acordeón), no scroll infinito.
- Topbar: solo título + 1 acción (menú overflow para el resto). Controles "Simular…" fuera del topbar.
- Touch targets ≥44px.

### Tablet (768–1023px)
- Sidebar colapsada a iconos o barra superior; contenido 1-2 col según módulo.

---

## 5. Reglas de contraste (WCAG AA: 4.5:1 normal · 3:1 grande/bold)

### ✅ Combinaciones permitidas
| Texto | Fondo | Ratio |
|-------|-------|-------|
| `--ink` `#000` | `--bg` / `--surface` | 20–21:1 |
| `--black` | `--gold` | 14.4:1 |
| `--white` | `--black` / sidebar | 19:1 |
| `--muted` `#667085` | `--surface` `#fff` | 4.97:1 |
| `--gold` | `--bg` dark `#0a0a0a` | 13.6:1 |
| badge texto oscuro | su tinte claro | ≥4.5:1 |

### ❌ Combinaciones prohibidas
| Texto | Fondo | Ratio | Usar en su lugar |
|-------|-------|-------|------------------|
| `--gold` / `--amber` | claro (`#fff`/cream) | 1.5–2.0:1 | `--ink` |
| `--white` | `--gold` / `--amber` | 1.5–2.0:1 | `--black` |
| `--wh-muted-2` `#9aa0a8` | claro | 2.6:1 | `--muted` |
| `--muted` `#667085` | `--surface-soft` | 4.41:1 | subir a `#5b6472` o fondo `--surface` |
| `--green` `#059669` (texto normal) | `#fff` | 3.77:1 | `#047857` o solo bold/grande |
| `--wh-muted-2` `#6c7280` dark (texto normal) | dark | 3.6–4.1:1 | `--muted` dark `#9aa0a8` |

### Regla rápida
- Texto sobre gold/amber → **siempre negro**.
- Gold/amber como texto → **solo sobre negro**.
- Texto secundario → `--muted` (nunca `--wh-muted-2`).
- Verde de estado → fondo, o texto bold/grande; para texto normal usar `#047857`.
