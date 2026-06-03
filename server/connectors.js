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

const easyCache = new Map();
const EASY_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchEasyJson(config, path, { cache = true } = {}) {
  const endpoint = endpointFrom(config);
  const headers = easyHeaders(config);
  const key = `${endpoint}${path}`;
  const cached = easyCache.get(key);
  if (cache && cached && Date.now() - cached.time < EASY_CACHE_TTL_MS) return cached.data;
  const data = await fetchJson(key, { headers });
  if (cache) easyCache.set(key, { time: Date.now(), data });
  return data;
}

async function postEasyJson(config, path, payload) {
  const endpoint = endpointFrom(config);
  return fetchJson(`${endpoint}${path}`, {
    method: "POST",
    headers: { ...easyHeaders(config), "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function cleanCatalogValue(value) {
  const text = String(value ?? "").trim();
  if (!text || /^n\/?a$/i.test(text)) return "";
  return text;
}

function uniqueSorted(values = []) {
  return [...new Set(values.map(cleanCatalogValue).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
}

function settingsMap(settings = []) {
  return Object.fromEntries((Array.isArray(settings) ? settings : []).map((item) => [item.name, item.value]));
}

function numberSetting(settings, key, fallback) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
}

function appointmentCatalogsFromCustomers(customers = []) {
  const rows = Array.isArray(customers) ? customers : [];
  return {
    sources: {
      marketplace: uniqueSorted(rows.map((item) => item.customField1)),
      sucursal: uniqueSorted(rows.map((item) => item.customField3)),
      distribuidor: uniqueSorted(rows.map((item) => item.customField4))
    },
    equipmentModels: uniqueSorted(rows.map((item) => item.customField5))
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
      permalink: product.permalink,
      image: product.images?.[0]?.src || null,
      imageAlt: product.images?.[0]?.alt || product.name || null
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
  if (!config) return { services: [], providers: [], sources: { marketplace: [], sucursal: [], distribuidor: [] }, equipmentModels: [] };
  const [servicesData, providersData, settingsData, customersData] = await Promise.all([
    fetchEasyJson(config, "/index.php/api/v1/services"),
    fetchEasyJson(config, "/index.php/api/v1/providers"),
    fetchEasyJson(config, "/index.php/api/v1/settings?length=1000"),
    fetchEasyJson(config, "/index.php/api/v1/customers?length=1000")
  ]);
  const settings = settingsMap(settingsData);
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
  return {
    services,
    providers,
    ...appointmentCatalogsFromCustomers(customersData),
    settings: {
      futureBookingLimit: numberSetting(settings, "future_booking_limit", 90),
      minimumAdvanceBooking: numberSetting(settings, "minimum_advance_booking", 1),
      requireAdvanceBookingDays: numberSetting(settings, "require_advance_booking_days", 1),
      defaultTimezone: settings.default_timezone || "America/Mexico_City"
    }
  };
}

function isoDate(value = new Date(), timezone = "America/Mexico_City") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(date, days) {
  const next = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutesToTime(date, time, minutes) {
  const [hour = "0", minute = "0"] = String(time || "").split(":");
  const total = (Number(hour) * 60) + Number(minute) + Number(minutes || 0);
  const nextHour = Math.floor(total / 60) % 24;
  const nextMinute = total % 60;
  return `${date} ${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}:00`;
}

function appointmentDateTime(date, time) {
  const value = String(time || "").trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(value)) return value.length === 16 ? `${value}:00` : value;
  return `${date} ${value.slice(0, 5)}:00`;
}

function appointmentPublicUrl(config = {}, hash) {
  const endpoint = endpointFrom(config);
  return hash && endpoint ? `${endpoint}/index.php/booking/reschedule/${encodeURIComponent(hash)}` : "";
}

function normalizeSlots(data) {
  if (Array.isArray(data)) return data.map((item) => typeof item === "string" ? item : item.start || item.time || item).filter(Boolean);
  const list = data?.availableHours || data?.availabilities || data?.data || [];
  return Array.isArray(list) ? list.map((item) => typeof item === "string" ? item : item.start || item.time || item).filter(Boolean) : [];
}

async function findFutureAppointmentByEmail(config, email, today) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const customerSearch = encodeURIComponent(normalizedEmail);
  const [customers, appointments] = await Promise.all([
    fetchEasyJson(config, `/index.php/api/v1/customers?q=${customerSearch}&sort=-id&length=50`, { cache: false }),
    fetchEasyJson(config, "/index.php/api/v1/appointments?sort=-id&length=1000", { cache: false })
  ]);
  const customerIds = new Set((Array.isArray(customers) ? customers : [])
    .filter((customer) => String(customer.email || "").trim().toLowerCase() === normalizedEmail)
    .map((customer) => customer.id));
  if (!customerIds.size) return null;
  const future = (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => customerIds.has(appointment.customerId))
    .filter((appointment) => String(appointment.start || "").slice(0, 10) >= today)
    .filter((appointment) => !/cancel/i.test(String(appointment.status || "")))
    .sort((left, right) => String(left.start).localeCompare(String(right.start)))[0];
  return future ? {
    appointmentId: future.id,
    start: future.start,
    status: future.status,
    hash: future.hash,
    rescheduleUrl: appointmentPublicUrl(config, future.hash),
    serviceId: future.serviceId,
    providerId: future.providerId
  } : null;
}

export async function prevalidateEasyAppointment(store, payload = {}) {
  const config = await store.integrationConfig?.("easyappointments");
  if (!config) return { ok: false, reason: "missing_integration", message: "Easy!Appointments no esta configurado." };
  const settings = settingsMap(await fetchEasyJson(config, "/index.php/api/v1/settings?length=1000"));
  const timezone = settings.default_timezone || "America/Mexico_City";
  const minimumAdvanceBooking = numberSetting(settings, "minimum_advance_booking", 1);
  const futureBookingLimit = numberSetting(settings, "future_booking_limit", 90);
  const serviceId = Number(payload.serviceId);
  const providerId = Number(payload.providerId);
  const date = String(payload.date || "");
  if (!serviceId || !providerId || !date) {
    return { ok: false, reason: "missing_fields", message: "Faltan servicio, proveedor o fecha." };
  }
  const today = isoDate(new Date(), timezone);
  const minDate = isoDate(addDays(today, minimumAdvanceBooking), timezone);
  const maxDate = isoDate(addDays(today, futureBookingLimit), timezone);
  const existingAppointment = await findFutureAppointmentByEmail(config, payload.email, today);
  if (existingAppointment) {
    return {
      ok: false,
      reason: "existing_appointment",
      message: "Ya existe una cita futura asociada a este correo. Para evitar duplicados, podemos ayudarte a reagendar la cita existente.",
      existingAppointment,
      limits: { minDate, maxDate, futureBookingLimit, minimumAdvanceBooking }
    };
  }
  if (date < minDate) {
    const next = await findNextAvailability(config, serviceId, providerId, minDate, maxDate);
    return {
      ok: false,
      reason: "same_day_blocked",
      message: `No se pueden agendar citas con menos de ${minimumAdvanceBooking} dia de anticipacion.`,
      nextAvailable: next
    };
  }
  if (date > maxDate) {
    return {
      ok: false,
      reason: "future_limit",
      message: `Solo se pueden agendar citas dentro de los proximos ${futureBookingLimit} dias.`,
      nextAvailable: null,
      limits: { minDate, maxDate, futureBookingLimit, minimumAdvanceBooking }
    };
  }
  const slots = await fetchEasyAvailabilities(config, serviceId, providerId, date);
  if (slots.length) return { ok: true, date, slots, limits: { minDate, maxDate, futureBookingLimit, minimumAdvanceBooking } };
  const next = await findNextAvailability(config, serviceId, providerId, isoDate(addDays(date, 1), timezone), maxDate);
  return {
    ok: false,
    reason: "no_slots",
    message: "No hay horarios disponibles para esa fecha.",
    nextAvailable: next,
    limits: { minDate, maxDate, futureBookingLimit, minimumAdvanceBooking }
  };
}

function sourceFieldsFromPayload(payload = {}) {
  const sourceType = String(payload.sourceType || "").trim();
  const sourceValue = String(payload.sourceValue || "").trim();
  return {
    customField1: sourceType === "marketplace" ? sourceValue : "",
    customField3: sourceType === "sucursal" ? sourceValue : "",
    customField4: sourceType === "distribuidor" ? sourceValue : "",
    customField5: String(payload.equipmentModel || "").trim()
  };
}

function appointmentNotes(payload = {}) {
  return [
    "Cita creada desde WhaleHub.",
    payload.sourceType && payload.sourceValue ? `Origen: ${payload.sourceType} - ${payload.sourceValue}` : "",
    payload.equipmentModel ? `Modelo: ${payload.equipmentModel}` : "",
    payload.orderNumber ? `Pedido: ${payload.orderNumber}` : "",
    payload.serialNumber ? `Serie: ${payload.serialNumber}` : "",
    payload.details ? `Detalles: ${payload.details}` : ""
  ].filter(Boolean).join("\n");
}

async function findCustomerByEmail(config, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const customerSearch = encodeURIComponent(normalizedEmail);
  const customers = await fetchEasyJson(config, `/index.php/api/v1/customers?q=${customerSearch}&sort=-id&length=50`, { cache: false });
  return (Array.isArray(customers) ? customers : [])
    .find((customer) => String(customer.email || "").trim().toLowerCase() === normalizedEmail) || null;
}

async function createEasyCustomer(config, payload = {}, timezone = "America/Mexico_City") {
  const customerPayload = {
    firstName: String(payload.firstName || "").trim(),
    lastName: String(payload.lastName || "").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "").trim(),
    timezone,
    language: "spanish",
    notes: appointmentNotes(payload),
    ...sourceFieldsFromPayload(payload)
  };
  return postEasyJson(config, "/index.php/api/v1/customers", customerPayload);
}

export async function createEasyAppointment(store, payload = {}) {
  const config = await store.integrationConfig?.("easyappointments");
  if (!config) return { ok: false, reason: "missing_integration", message: "Easy!Appointments no esta configurado." };

  const required = ["firstName", "lastName", "email", "phone", "serviceId", "providerId", "date", "time", "sourceType", "sourceValue", "equipmentModel"];
  const missing = required.filter((key) => !String(payload[key] || "").trim());
  if (missing.length) {
    return { ok: false, reason: "missing_fields", message: "Faltan datos obligatorios para crear la cita.", missing };
  }

  const settings = settingsMap(await fetchEasyJson(config, "/index.php/api/v1/settings?length=1000"));
  const timezone = settings.default_timezone || "America/Mexico_City";
  const validation = await prevalidateEasyAppointment(store, {
    serviceId: payload.serviceId,
    providerId: payload.providerId,
    date: payload.date,
    email: payload.email
  });
  if (!validation.ok) return validation;

  const selectedTime = String(payload.time || "").slice(0, 5);
  if (!validation.slots.some((slot) => String(slot).slice(0, 5) === selectedTime)) {
    return {
      ok: false,
      reason: "slot_unavailable",
      message: "Ese horario ya no esta disponible. Selecciona otro horario.",
      slots: validation.slots
    };
  }

  const services = await fetchEasyJson(config, "/index.php/api/v1/services");
  const service = (Array.isArray(services) ? services : []).find((item) => Number(item.id) === Number(payload.serviceId));
  const duration = Number(service?.duration || 15);
  let customer = await findCustomerByEmail(config, payload.email);
  if (!customer) customer = await createEasyCustomer(config, payload, timezone);

  const appointmentPayload = {
    start: appointmentDateTime(payload.date, selectedTime),
    end: addMinutesToTime(payload.date, selectedTime, duration),
    notes: appointmentNotes(payload),
    serviceId: Number(payload.serviceId),
    providerId: Number(payload.providerId),
    customerId: Number(customer.id),
    location: String(payload.sourceValue || "")
  };
  const appointment = await postEasyJson(config, "/index.php/api/v1/appointments", appointmentPayload);
  return {
    ok: true,
    appointment: { ...appointment, manageUrl: appointmentPublicUrl(config, appointment?.hash) },
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone
    },
    service: service ? { id: service.id, name: service.name, duration: service.duration } : null
  };
}

async function fetchEasyAvailabilities(config, serviceId, providerId, date) {
  const params = new URLSearchParams({ serviceId: String(serviceId), providerId: String(providerId), date });
  const data = await fetchEasyJson(config, `/index.php/api/v1/availabilities?${params}`);
  return normalizeSlots(data);
}

async function findNextAvailability(config, serviceId, providerId, startDate, maxDate) {
  for (let cursor = String(startDate); cursor <= String(maxDate); cursor = isoDate(addDays(cursor, 1))) {
    const date = cursor;
    const slots = await fetchEasyAvailabilities(config, serviceId, providerId, date);
    if (slots.length) return { date, slots };
  }
  return null;
}
