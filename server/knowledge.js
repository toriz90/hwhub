// Seleccion de contexto para la IA desde knowledge_base.
// Regla de oro: nunca inyectar el documento completo de codigos de falla (522 entradas, ~312 KB);
// solo las entradas que el mensaje del cliente pide, y con tope duro de caracteres.

const BRAND_LIMIT = 12000;
const FAULT_CHAR_LIMIT = 6000;
const FAULT_CODE_ONLY_LIMIT = 6;
// Unico modelo del catalogo que colisiona con una palabra comun del espanol ("UNA"):
// para esos se exige la forma exacta en mayusculas del mensaje original.
const MODEL_STOPWORDS = new Set(["una", "un", "uno"]);

// Documentos que viven en el modulo pero nunca son contexto del bot.
const NEVER_INJECTED = new Set(["system_prompt"]);

// Las paginas solo entran cuando el cliente pide un recurso o un enlace; si no, son ~4 KB por mensaje a cambio de nada.
const SITE_PAGE_TERMS = [
  "enlace", "link", "url", "pagina", "sitio web", "catalogo",
  "garantia", "factura", "facturacion", "manual", "instructivo", "tutorial",
  "politica", "privacidad", "termino", "devolucion", "reembolso", "cancelar",
  "promocion", "sucursal", "tienda fisica", "directorio", "contacto",
  "rastreo", "vacante", "mayoreo", "mayorista", "recompensa", "boletin",
  "donde puedo", "donde encuentro", "donde veo", "donde consigo", "donde descargo", "como consigo"
];

const cache = new Map(); // key -> { updatedAt, parsed }

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// E001, E01, E1 y "1" colapsan a la misma clave; los codigos sin letra quedan como #1.
export function normalizeCodeKey(value) {
  const raw = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = raw.match(/^([A-Z]*)0*(\d+)$/);
  if (!match) return raw || null;
  const [, letters, digits] = match;
  return letters ? `${letters}${Number(digits)}` : `#${Number(digits)}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

// Devuelve clave normalizada -> token tal cual aparecio en el mensaje, para poder descartar
// despues los tokens que en realidad son un modelo del catalogo (P1, S10, H2...).
export function codesFromText(text = "") {
  const value = normalizeText(text);
  const found = new Map();
  // "E4", "e 04", "e-004": letra + digitos.
  for (const match of value.matchAll(/\b([a-z])\s*-?\s*(\d{1,3})\b/g)) {
    const token = `${match[1]}${match[2]}`;
    const key = normalizeCodeKey(token);
    if (key) found.set(key, token);
    // El prefijo depende del modelo (E001, ERROR1, DISPLAY1 o solo el numero),
    // asi que el mismo numero se busca tambien sin letra.
    found.set(`#${Number(match[2])}`, token);
  }
  // "error 4", "codigo 12", "falla 3": numero pelado solo cuando una palabra lo anuncia.
  for (const match of value.matchAll(/\b(?:error|codigo|falla|clave|fault)\s*#?\s*(\d{1,3})\b/g)) {
    found.set(`#${Number(match[1])}`, `#${match[1]}`);
  }
  return found;
}

function buildFaultIndex(entries) {
  const models = new Map();
  const indexed = entries.map((entry) => {
    const model = String(entry.modelo ?? "").trim();
    const normalizedModel = normalizeText(model);
    if (model && !models.has(normalizedModel)) {
      models.set(normalizedModel, {
        raw: model,
        normalized: normalizedModel,
        // \b no funciona con CJK ni con parentesis: esos modelos se buscan como subcadena.
        simple: /^[a-z0-9 .-]+$/.test(normalizedModel),
        stopword: MODEL_STOPWORDS.has(normalizedModel)
      });
    }
    const codeKeys = new Set(
      [entry.codigo, ...(Array.isArray(entry.claves_codigo) ? entry.claves_codigo : [])]
        .map(normalizeCodeKey)
        .filter(Boolean)
    );
    return { entry, normalizedModel, codeKeys };
  });
  return { indexed, models: [...models.values()] };
}

export function modelsFromText(text = "", models = []) {
  const normalized = normalizeText(text);
  const hits = models.filter((model) => {
    if (model.stopword) return new RegExp(`\\b${escapeRegExp(model.raw)}\\b`).test(String(text));
    if (!model.simple) return normalized.includes(model.normalized);
    return new RegExp(`\\b${escapeRegExp(model.normalized)}\\b`).test(normalized);
  });
  // F6 es subcadena de F6PRO: si el mensaje dice F6PRO, gana el mas largo.
  return hits.filter((model) => !hits.some((other) => other !== model && other.normalized.includes(model.normalized)));
}

function faultEntryPayload({ entry }) {
  return {
    modelo: entry.modelo,
    codigo: entry.codigo,
    significado: entry.significado,
    categoria: entry.categoria,
    pasos: entry.pasos_reparacion || [],
    pagina_manual: entry.pagina_manual
  };
}

function capByChars(items, limit) {
  const kept = [];
  let size = 0;
  for (const item of items) {
    const cost = JSON.stringify(item).length;
    if (size + cost > limit) break;
    kept.push(item);
    size += cost;
  }
  return { kept, truncated: kept.length < items.length };
}

export function selectFaultCodes(index, text = "") {
  if (!index?.indexed?.length) return null;
  const models = modelsFromText(text, index.models);
  const modelNames = new Set(models.map((model) => model.normalized));
  // Un token que es el nombre de un modelo (P1, S10, H2) no es un codigo de falla.
  const codes = new Set(
    [...codesFromText(text)].filter(([, token]) => !modelNames.has(token)).map(([key]) => key)
  );
  if (!codes.size) return null; // solo el modelo no basta: volcar sus codigos seria enorme y poco util.

  const byCode = index.indexed.filter((item) => [...item.codeKeys].some((key) => codes.has(key)));
  const exact = modelNames.size ? byCode.filter((item) => modelNames.has(item.normalizedModel)) : [];

  // Modelo identificado pero sin ese codigo: en vez de servir los pasos de otro modelo
  // (peligroso en una reparacion), se entregan los codigos que ese modelo si documenta.
  if (modelNames.size && !exact.length) {
    const ownCodes = index.indexed.filter((item) => modelNames.has(item.normalizedModel));
    if (!ownCodes.length) return null;
    const { kept, truncated } = capByChars(ownCodes.map(faultEntryPayload), FAULT_CHAR_LIMIT);
    if (!kept.length) return null;
    return {
      fuente: "codigos de falla",
      coincidencia: "modelo sin ese codigo",
      nota: `El manual de ${models.map((model) => model.raw).join(", ")} no registra el codigo que dijo el cliente. Pide que lea el codigo tal cual aparece en pantalla; no uses pasos de otro modelo.`,
      ...(truncated ? { aviso: "Lista recortada, no la presentes como completa." } : {}),
      codigos: kept
    };
  }
  if (!byCode.length) return null;

  const limited = exact.length ? exact : byCode.slice(0, FAULT_CODE_ONLY_LIMIT);
  const { kept, truncated } = capByChars(limited.map(faultEntryPayload), FAULT_CHAR_LIMIT);
  if (!kept.length) return null;

  return {
    fuente: "codigos de falla",
    coincidencia: exact.length ? "modelo y codigo" : "solo codigo",
    nota: exact.length
      ? "Entradas del modelo y codigo que menciono el cliente."
      : "El cliente no dijo el modelo: pregunta cual tiene antes de dar por buena una reparacion.",
    ...(truncated || byCode.length > limited.length
      ? { aviso: "Lista recortada, no la presentes como completa." }
      : {}),
    codigos: kept
  };
}

export function wantsSitePages(text = "", pages = []) {
  const value = normalizeText(text);
  if (SITE_PAGE_TERMS.some((term) => value.includes(term))) return true;
  // El titulo completo de una pagina en el mensaje tambien cuenta ("quiero el aviso de privacidad").
  return pages.some((page) => String(page.titulo).length > 8 && value.includes(normalizeText(page.titulo)));
}

function parseDocument(doc) {
  if (doc.docType !== "json") return { text: String(doc.content || "") };
  let data = null;
  try {
    data = JSON.parse(doc.content);
  } catch {
    return null; // Un documento invalido se ignora en vez de tumbar la respuesta del bot.
  }
  if (doc.key === "fault_codes") return Array.isArray(data) ? buildFaultIndex(data) : null;
  if (doc.key === "site_pages") {
    const pages = Array.isArray(data) ? data : [];
    return { pages: pages.map((page) => ({ titulo: page.titulo, url: page.url })).filter((page) => page.titulo && page.url) };
  }
  return { data };
}

async function documentIndex(store, version) {
  const cached = cache.get(version.key);
  if (cached && cached.updatedAt === String(version.updatedAt)) return cached.parsed;
  const doc = await store.knowledgeDocument?.(version.key);
  if (!doc) return null;
  const parsed = parseDocument(doc);
  cache.set(version.key, { updatedAt: String(version.updatedAt), parsed });
  return parsed;
}

// Devuelve { blocks: [] } cuando no hay nada activo: el prompt queda identico al de antes de este modulo.
export async function buildKnowledgeContext(store, text = "") {
  const versions = await store.knowledgeVersions?.().catch(() => []);
  if (!Array.isArray(versions) || !versions.length) return { blocks: [] };
  const blocks = [];
  for (const version of versions.filter((item) => item.isActive)) {
    if (NEVER_INJECTED.has(version.key)) continue;
    const parsed = await documentIndex(store, version);
    if (!parsed) continue;
    if (version.key === "brand_kb" && parsed.text?.trim()) {
      blocks.push({ fuente: "base de marca", contenido: parsed.text.slice(0, BRAND_LIMIT) });
    }
    if (version.key === "site_pages" && parsed.pages?.length && wantsSitePages(text, parsed.pages)) {
      blocks.push({ fuente: "paginas del sitio", paginas: parsed.pages });
    }
    if (version.key === "fault_codes") {
      const faults = selectFaultCodes(parsed, text);
      if (faults) blocks.push(faults);
    }
  }
  return { blocks };
}
