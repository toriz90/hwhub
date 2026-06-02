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

function productSearchTerm(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !["precio", "stock", "producto", "productos", "tienen", "tienes", "cuanto", "cuesta", "quiero"].includes(word))
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

export async function buildConnectorContext({ text, store }) {
  const context = {};
  const errors = [];

  if (wantsProducts(text)) {
    try {
      const config = await store.integrationConfig?.("woocommerce");
      if (config) context.products = await fetchWooProducts(config, productSearchTerm(text));
    } catch (error) {
      errors.push({ provider: "woocommerce", message: error.message });
    }
  }

  if (wantsAppointments(text)) {
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

async function fetchEasyAppointmentServices(config) {
  const endpoint = endpointFrom(config);
  if (!endpoint) return null;
  const testPath = config.testPath || "/index.php/api/v1/services";
  const headers = {};
  const token = config.apiKey || config.token;
  if (token) headers.authorization = `Bearer ${token}`;
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
