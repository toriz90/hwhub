function endpointFrom(config = {}) {
  return String(config.baseUrl || config.url || config.endpoint || "").replace(/\/+$/, "");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return data;
}

function easyHeaders(config = {}) {
  const token = config.apiKey || config.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

const defaultAppointmentCatalogs = {
  sources: {
    marketplace: ["Amazon", "Mercado Libre", "Walmart", "Coppel", "Elektra", "TikTok", "Temu", "Pagina oficial", "Otro"],
    sucursal: ["Genova", "Otro"],
    distribuidor: ["Distribuidor autorizado", "Mayorista", "Tienda departamental", "Otro"]
  },
  equipmentModels: [
    "H4",
    "U1S",
    "ZL Wolf",
    "KC Cool",
    "E9 Max",
    "BK05",
    "T5",
    "M1 Lite",
    "T4A",
    "ZL X",
    "E9",
    "H3",
    "H2",
    "Otro"
  ]
};

function csvList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
}

function appointmentCatalogs(config = {}) {
  const catalogs = config.catalogs || config.appointmentCatalogs || {};
  const sourceAliases = {
    marketplace: ["marketplaces", "appointmentMarketplaces"],
    sucursal: ["branches", "sucursales", "appointmentBranches"],
    distribuidor: ["distributors", "distribuidores", "appointmentDistributors"]
  };
  const sources = Object.fromEntries(Object.entries(defaultAppointmentCatalogs.sources).map(([key, fallback]) => {
    const configured = csvList(catalogs[key] || sourceAliases[key].map((alias) => config[alias]).find(Boolean));
    const values = [...configured, ...fallback];
    return [key, [...new Set(values)]];
  }));
  const equipmentModels = [
    ...csvList(catalogs.models || catalogs.equipmentModels || config.models || config.equipmentModels || config.appointmentModels),
    ...defaultAppointmentCatalogs.equipmentModels
  ];
  return {
    sources,
    equipmentModels: [...new Set(equipmentModels)]
  };
}

function productSearchTerm(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => ![
      "precio",
      "precios",
      "stock",
      "producto",
      "productos",
      "tienen",
      "tienes",
      "cuanto",
      "cuesta",
      "quiero",
      "saber",
      "disponible",
      "disponibles",
      "existencia",
      "comprar",
      "catalogo"
    ].includes(word))
    .slice(0, 5)
    .join(" ");
}

function wantsProducts(text = "") {
  const value = String(text).toLowerCase();
  return ["producto", "precio", "stock", "existencia", "disponible", "comprar", "catalogo"].some((term) => value.includes(term));
}

function wantsAppointments(text = "") {
  const value = String(text).toLowerCase();
  return ["cita", "agenda", "agendar", "horario", "servicio", "reservar"].some((term) => value.includes(term));
}

function conversationText(text = "", history = []) {
  return [...history.slice(-8).map((message) => message.body), text].filter(Boolean).join("\n");
}

function extractOrderNumber(text = "") {
  const match = String(text).match(/(?:#|pedido\s*#?|orden\s*#?)\s*(\d{3,})/i);
  return match?.[1] || null;
}

function extractTrackingNumber(text = "") {
  const match = String(text).match(/\b([A-Z0-9]{8,34})\b/i);
  if (!match) return null;
  const value = match[1];
  if (/^\d{3,7}$/.test(value)) return null;
  return value;
}

function wantsOrderStatus(text = "") {
  const value = String(text).toLowerCase();
  return ["pedido", "orden", "envio", "paquete", "guia", "rastreo", "tracking", "trackship"].some((term) => value.includes(term));
}

export async function buildConnectorContext({ text, history = [], store }) {
  const context = {};
  const errors = [];
  const fullText = conversationText(text, history);

  if (wantsProducts(fullText)) {
    try {
      const config = await store.integrationConfig?.("woocommerce");
      if (config) context.products = await fetchWooProducts(config, productSearchTerm(text));
    } catch (error) {
      errors.push({ provider: "woocommerce", message: error.message });
    }
  }

  if (wantsOrderStatus(fullText)) {
    const orderNumber = extractOrderNumber(fullText);
    const trackingNumber = extractTrackingNumber(fullText);
    try {
      const config = await store.integrationConfig?.("woocommerce");
      if (config && orderNumber) context.order = await fetchWooOrder(config, orderNumber);
    } catch (error) {
      errors.push({ provider: "woocommerce", message: error.message });
    }
    try {
      const config = await store.integrationConfig?.("trackship");
      const number = trackingNumber || context.order?.tracking?.trackingNumber;
      if (config && number) context.shipment = await fetchTrackShipStatus(config, number, context.order?.tracking?.trackingProvider);
    } catch (error) {
      errors.push({ provider: "trackship", message: error.message });
    }
  }

  if (wantsAppointments(fullText)) {
    try {
      const config = await store.integrationConfig?.("easyappointments");
      if (config) context.appointments = await fetchEasyAppointmentServices(config);
    } catch (error) {
      errors.push({ provider: "easyappointments", message: error.message });
    }
  }

  return {
    ...context,
    errors
  };
}

async function fetchWooProducts(config, search) {
  const endpoint = endpointFrom(config);
  if (!endpoint || !config.consumerKey || !config.consumerSecret) return null;
  const params = new URLSearchParams({
    per_page: "5",
    status: "publish",
    stock_status: "instock"
  });
  if (search) params.set("search", search);
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const products = await fetchJson(`${endpoint}/wp-json/wc/v3/products?${params}`, {
    headers: { authorization: `Basic ${auth}` }
  });
  return {
    query: search || null,
    total: Array.isArray(products) ? products.length : 0,
    items: (Array.isArray(products) ? products : []).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      regularPrice: product.regular_price,
      salePrice: product.sale_price,
      stockStatus: product.stock_status,
      stockQuantity: product.stock_quantity,
      permalink: product.permalink
    }))
  };
}

function trackingFromOrder(order) {
  const metas = Array.isArray(order.meta_data) ? order.meta_data : [];
  const trackingMeta = metas.filter((meta) => /track|guia|shipment|ast/i.test(String(meta.key)));
  const joined = trackingMeta.map((meta) => JSON.stringify(meta.value)).join(" ");
  const trackingNumber = extractTrackingNumber(joined);
  const trackingUrl = (joined.match(/https?:\/\/[^\s"']+/i) || [])[0] || null;
  const providerMeta = trackingMeta.find((meta) => /provider|carrier/i.test(String(meta.key)));
  return {
    trackingNumber,
    trackingUrl,
    trackingProvider: typeof providerMeta?.value === "string" ? providerMeta.value : null,
    rawKeys: trackingMeta.map((meta) => meta.key).slice(0, 10)
  };
}

async function fetchWooOrder(config, orderNumber) {
  const endpoint = endpointFrom(config);
  if (!endpoint || !config.consumerKey || !config.consumerSecret) return null;
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const order = await fetchJson(`${endpoint}/wp-json/wc/v3/orders/${encodeURIComponent(orderNumber)}`, {
    headers: { authorization: `Basic ${auth}` }
  });
  return {
    id: order.id,
    number: order.number || String(order.id),
    status: order.status,
    currency: order.currency,
    total: order.total,
    dateCreated: order.date_created,
    dateModified: order.date_modified,
    paymentMethod: order.payment_method_title,
    shippingName: [order.shipping?.first_name, order.shipping?.last_name].filter(Boolean).join(" "),
    tracking: trackingFromOrder(order),
    items: (order.line_items || []).slice(0, 6).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      total: item.total
    }))
  };
}

async function fetchTrackShipStatus(config, trackingNumber, provider) {
  if (!config.apiKey || !trackingNumber) return null;
  const payload = { tracking_number: trackingNumber };
  const trackingProvider = provider || config.trackingProvider;
  if (trackingProvider) payload.tracking_provider = trackingProvider;
  const data = await fetchJson("https://api.trackship.com/v1/shipment/get/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "trackship-api-key": config.apiKey,
      "app-name": config.appName || "WhaleHub"
    },
    body: JSON.stringify(payload)
  });
  return {
    trackingNumber,
    status: data?.data?.shipment_status || data?.data?.status || data?.status,
    trackingProvider: data?.data?.tracking_provider || trackingProvider || null,
    trackingUrl: data?.data?.tracking_page_link || data?.data?.tracking_url || null,
    estimatedDelivery: data?.data?.est_delivery_date || data?.data?.est_delivery || null,
    raw: data?.data ? {
      orderId: data.data.order_id,
      status: data.data.shipment_status || data.data.status
    } : null
  };
}

async function fetchEasyAppointmentServices(config) {
  const endpoint = endpointFrom(config);
  if (!endpoint) return null;
  const testPath = config.testPath || "/index.php/api/v1/services";
  const headers = easyHeaders(config);
  const services = await fetchJson(`${endpoint}${testPath}`, { headers });
  const list = Array.isArray(services) ? services : services?.services || services?.data || [];
  return {
    total: Array.isArray(list) ? list.length : 0,
    services: (Array.isArray(list) ? list : []).slice(0, 8).map((service) => ({
      id: service.id,
      name: service.name,
      duration: service.duration,
      price: service.price,
      description: service.description
    }))
  };
}

export async function getEasyAppointmentOptions(store) {
  const config = await store.integrationConfig?.("easyappointments");
  if (!config) return { services: [], providers: [], ...appointmentCatalogs() };
  const endpoint = endpointFrom(config);
  const headers = easyHeaders(config);
  const [servicesData, providersData] = await Promise.all([
    fetchJson(`${endpoint}/index.php/api/v1/services`, { headers }),
    fetchJson(`${endpoint}/index.php/api/v1/providers`, { headers })
  ]);
  const services = (Array.isArray(servicesData) ? servicesData : []).map((service) => ({
    id: service.id,
    name: service.name,
    duration: service.duration,
    price: service.price
  }));
  const providers = (Array.isArray(providersData) ? providersData : []).map((provider) => ({
    id: provider.id,
    name: [provider.firstName, provider.lastName].filter(Boolean).join(" "),
    email: provider.email,
    phone: provider.phone,
    timezone: provider.timezone,
    services: provider.services || [],
    workingPlan: provider.settings?.workingPlan || {}
  }));
  return { services, providers, ...appointmentCatalogs(config) };
}

function isoDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeSlots(data) {
  if (Array.isArray(data)) return data.map((item) => typeof item === "string" ? item : item.start || item.time || item).filter(Boolean);
  const list = data?.availableHours || data?.availabilities || data?.data || [];
  return Array.isArray(list) ? list.map((item) => typeof item === "string" ? item : item.start || item.time || item).filter(Boolean) : [];
}

export async function prevalidateEasyAppointment(store, payload = {}) {
  const config = await store.integrationConfig?.("easyappointments");
  if (!config) return { ok: false, reason: "missing_integration", message: "Easy!Appointments no esta configurado." };
  const serviceId = Number(payload.serviceId);
  const providerId = Number(payload.providerId);
  const date = String(payload.date || "");
  if (!serviceId || !providerId || !date) {
    return { ok: false, reason: "missing_fields", message: "Faltan servicio, proveedor o fecha." };
  }
  const today = isoDate();
  if (date <= today) {
    const next = await findNextAvailability(config, serviceId, providerId, addDays(new Date(), 1));
    return {
      ok: false,
      reason: "same_day_blocked",
      message: "No se pueden agendar citas para el mismo dia.",
      nextAvailable: next
    };
  }
  const slots = await fetchEasyAvailabilities(config, serviceId, providerId, date);
  if (slots.length) return { ok: true, date, slots };
  const next = await findNextAvailability(config, serviceId, providerId, addDays(new Date(date), 1));
  return {
    ok: false,
    reason: "no_slots",
    message: "No hay horarios disponibles para esa fecha.",
    nextAvailable: next
  };
}

async function fetchEasyAvailabilities(config, serviceId, providerId, date) {
  const endpoint = endpointFrom(config);
  const headers = easyHeaders(config);
  const params = new URLSearchParams({ serviceId: String(serviceId), providerId: String(providerId), date });
  const data = await fetchJson(`${endpoint}/index.php/api/v1/availabilities?${params}`, { headers });
  return normalizeSlots(data);
}

async function findNextAvailability(config, serviceId, providerId, startDate) {
  for (let index = 0; index < 30; index += 1) {
    const date = isoDate(addDays(startDate, index));
    const slots = await fetchEasyAvailabilities(config, serviceId, providerId, date);
    if (slots.length) return { date, slots };
  }
  return null;
}
