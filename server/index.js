import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createDataStore } from "./database.js";
import { generateBotReply } from "./ai.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = normalize(join(__dirname, ".."));
const publicDir = join(root, "web");
const port = Number(process.env.PORT || 3000);

const clients = new Set();
let store;

const state = {
  branches: [
    {
      id: "branch-cdmx",
      name: "Sucursal CDMX",
      city: "Ciudad de Mexico",
      phone: "+52 55 0000 0000",
      whatsapp: "+52 55 1111 1111",
      address: "Directorio pendiente de confirmar",
      services: ["ventas", "atc", "mayoristas", "garantias"],
      wholesaleContact: "mayoreo@honeywhale.mx",
      hours: "Lun-Sab 10:00-19:00"
    },
    {
      id: "branch-online",
      name: "Atencion online",
      city: "Nacional",
      phone: "+52 55 2222 2222",
      whatsapp: "+52 55 3333 3333",
      address: "Canal digital",
      services: ["woocommerce", "amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"],
      wholesaleContact: "mayoristas@honeywhale.mx",
      hours: "Lun-Dom 09:00-21:00"
    }
  ],
  agents: [
    {
      id: "agent-ana",
      name: "Ana",
      role: "Pedidos sitio oficial",
      skills: ["woocommerce", "pedidos", "pagos"],
      channels: ["web_widget", "woocommerce", "whatsapp_cloud"],
      online: true,
      activeConversations: 2,
      maxConversations: 6
    },
    {
      id: "agent-luis",
      name: "Luis",
      role: "Marketplaces",
      skills: ["amazon", "mercadolibre", "walmart", "coppel", "elektra"],
      channels: ["whatsapp_cloud", "evolution_api"],
      online: true,
      activeConversations: 3,
      maxConversations: 5
    },
    {
      id: "agent-mara",
      name: "Mara",
      role: "ATC y mayoristas",
      skills: ["atc", "mayoristas", "tiktok", "temu"],
      channels: ["whatsapp_cloud", "telnyx", "plivo"],
      online: false,
      activeConversations: 0,
      maxConversations: 5
    }
  ],
  faqs: [
    {
      id: "faq-order-status",
      question: "Como puedo revisar el estado de mi pedido?",
      shortAnswer: "Podemos revisar pedidos de la pagina oficial con el numero de orden o telefono.",
      longAnswer: "Para pedidos de WooCommerce el chatbot puede consultar el pedido, pago, envio y proceso interno cuando el cliente proporcione datos de identificacion.",
      category: "Pedidos",
      tags: ["woocommerce", "pedido", "envio", "estatus"],
      published: true
    },
    {
      id: "faq-marketplace",
      question: "Atienden pedidos de Amazon o MercadoLibre?",
      shortAnswer: "Si, pero esos canales se canalizan a un agente especializado.",
      longAnswer: "Las consultas de Amazon, MercadoLibre, Walmart, Coppel, Elektra, TikTok y Temu deben ir primero a agentes activos. Si no hay agentes, se muestra contacto del directorio.",
      category: "Marketplaces",
      tags: ["amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"],
      published: true
    },
    {
      id: "faq-wholesale",
      question: "Tienen ventas mayoristas?",
      shortAnswer: "Si, el directorio contiene contactos y reglas para ventas mayoristas.",
      longAnswer: "El bot debe identificar consultas de mayoreo, mostrar requisitos basicos y canalizar al contacto o agente disponible segun sucursal y horario.",
      category: "Mayoristas",
      tags: ["mayoreo", "mayoristas", "distribuidor"],
      published: true
    }
  ],
  routingRules: [
    {
      id: "rule-official-orders",
      name: "Pedidos oficiales por bot",
      priority: 10,
      channel: "woocommerce",
      marketplace: "official",
      intent: "order_status",
      requiredSkill: "woocommerce",
      botAllowed: true,
      fallbackMessage: "Puedo revisar pedidos de la pagina oficial. Comparte tu numero de pedido o telefono."
    },
    {
      id: "rule-marketplaces-agent",
      name: "Marketplaces a agente activo",
      priority: 20,
      channel: "whatsapp_cloud",
      marketplace: "marketplace",
      intent: "marketplace_support",
      requiredSkill: "marketplaces",
      botAllowed: false,
      fallbackMessage: "En este momento no hay agentes disponibles para marketplaces. Contactanos al numero del directorio y tomaremos tu caso."
    },
    {
      id: "rule-wholesale",
      name: "Mayoristas al directorio",
      priority: 30,
      channel: null,
      marketplace: null,
      intent: "wholesale",
      requiredSkill: "mayoristas",
      botAllowed: false,
      fallbackMessage: "Para ventas mayoristas te canalizo con el equipo correcto. Si no hay agentes activos, usa el contacto de mayoreo del directorio."
    }
  ],
  conversations: [
    {
      id: "conv-1001",
      channel: "whatsapp_cloud",
      customer: "Cliente WhatsApp",
      status: "waiting_for_agent",
      intent: "marketplace_support",
      marketplace: "mercadolibre",
      assignedAgentId: "agent-luis",
      lastMessage: "Compre por MercadoLibre y necesito ayuda con mi pedido."
    },
    {
      id: "conv-1002",
      channel: "web_widget",
      customer: "Visitante web",
      status: "bot_active",
      intent: "order_status",
      marketplace: "official",
      assignedAgentId: null,
      lastMessage: "Quiero saber donde va mi compra."
    }
  ]
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(data));
}

const rolePermissions = {
  admin: ["*"],
  supervisor: [
    "conversation:write",
    "faqs:write",
    "branches:write",
    "agents:write",
    "routingRules:write",
    "integrations:write"
  ],
  agent: ["conversation:write"],
  marketplace: ["conversation:write"],
  wholesale: ["conversation:write"],
  viewer: []
};

function isAdmin(req) {
  return roleFrom(req) === "admin";
}

function roleFrom(req) {
  if (req.user?.role) return req.user.role;
  if (process.env.ALLOW_ROLE_HEADER === "true") return req.headers["x-hwhub-role"] || "viewer";
  return "viewer";
}

function can(req, permission) {
  const permissions = rolePermissions[roleFrom(req)] || rolePermissions.viewer;
  return permissions.includes("*") || permissions.includes(permission);
}

function requirePermission(req, permission) {
  if (can(req, permission)) return;
  const error = new Error("Role does not have permission for this action");
  error.statusCode = 403;
  throw error;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
      })
  );
}

function sessionCookie(session, clear = false) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  if (clear) return `hwhub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  const maxAge = Math.max(0, Math.round((session.expiresAt.getTime() - Date.now()) / 1000));
  return `hwhub_session=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function sendUnauthorized(res) {
  sendJson(res, { error: "Authentication required" }, 401);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function secretFrom(config = {}) {
  return config.apiKey || config.token || config.accessToken || config.bearerToken || config.secret || "";
}

function endpointFrom(config = {}) {
  return String(config.baseUrl || config.url || config.endpoint || "").replace(/\/+$/, "");
}

async function readProviderError(response) {
  try {
    const text = await response.text();
    if (!text) return "";
    return text.slice(0, 140);
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function testIntegrationConnection(integration) {
  const provider = String(integration.provider || "").toLowerCase();
  const config = integration.config || {};
  const secret = secretFrom(config);

  if (!secret && ["openai", "claude", "whatsapp_cloud", "evolution_api", "telnyx", "plivo"].includes(provider)) {
    return { ok: false, message: "Falta apiKey/token en la configuracion." };
  }

  if (provider === "openai") {
    const response = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${secret}` }
    });
    if (response.ok) return { ok: true, message: "OpenAI respondio correctamente." };
    return { ok: false, message: `OpenAI rechazo la conexion (${response.status}).` };
  }

  if (provider === "claude") {
    const response = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": secret,
        "anthropic-version": "2023-06-01"
      }
    });
    if (response.ok) return { ok: true, message: "Claude respondio correctamente." };
    return { ok: false, message: `Claude rechazo la conexion (${response.status}).` };
  }

  if (provider === "woocommerce") {
    const endpoint = endpointFrom(config);
    if (!endpoint || !config.consumerKey || !config.consumerSecret) {
      return { ok: false, message: "Faltan url, consumerKey o consumerSecret de WooCommerce." };
    }
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
    const response = await fetchWithTimeout(`${endpoint}/wp-json/wc/v3/products?per_page=1`, {
      headers: { authorization: `Basic ${auth}` }
    });
    if (response.ok) return { ok: true, message: "WooCommerce respondio correctamente." };
    return { ok: false, message: `WooCommerce rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
  }

  if (provider === "easyappointments") {
    const endpoint = endpointFrom(config);
    if (!endpoint) return { ok: false, message: "Falta url/baseUrl de Easy!Appointments." };
    const testPath = config.testPath || "/index.php/api/v1/services";
    const headers = {};
    if (secret) headers.authorization = `Bearer ${secret}`;
    const response = await fetchWithTimeout(`${endpoint}${testPath}`, { headers });
    if (response.ok) return { ok: true, message: "Easy!Appointments respondio correctamente." };
    return { ok: false, message: `Easy!Appointments rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
  }

  if (provider === "whatsapp_cloud") {
    if (!config.phoneNumberId && !config.businessAccountId) {
      return { ok: false, message: "Falta phoneNumberId o businessAccountId de WhatsApp Cloud." };
    }
    const graphVersion = config.graphVersion || "v20.0";
    const target = config.phoneNumberId || config.businessAccountId;
    const fields = config.phoneNumberId ? "display_phone_number,verified_name" : "name";
    const response = await fetchWithTimeout(`https://graph.facebook.com/${graphVersion}/${target}?fields=${fields}`, {
      headers: { authorization: `Bearer ${secret}` }
    });
    if (response.ok) return { ok: true, message: "WhatsApp Cloud respondio correctamente." };
    return { ok: false, message: `WhatsApp Cloud rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
  }

  if (["evolution_api", "telnyx", "plivo"].includes(provider)) {
    if (!endpointFrom(config) && provider === "evolution_api") {
      return { ok: false, message: "Falta endpoint/baseUrl de Evolution API." };
    }
    if (provider === "evolution_api") {
      const response = await fetchWithTimeout(`${endpointFrom(config)}${config.testPath || "/instance/fetchInstances"}`, {
        headers: { apikey: secret, authorization: `Bearer ${secret}` }
      });
      if (response.ok) return { ok: true, message: "Evolution API respondio correctamente." };
      return { ok: false, message: `Evolution API rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
    }
    if (provider === "telnyx") {
      const response = await fetchWithTimeout("https://api.telnyx.com/v2/messaging_profiles?page[size]=1", {
        headers: { authorization: `Bearer ${secret}` }
      });
      if (response.ok) return { ok: true, message: "Telnyx respondio correctamente." };
      return { ok: false, message: `Telnyx rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
    }
    if (provider === "plivo") {
      if (!config.authId) return { ok: false, message: "Falta authId de Plivo." };
      const auth = Buffer.from(`${config.authId}:${secret}`).toString("base64");
      const response = await fetchWithTimeout(`https://api.plivo.com/v1/Account/${config.authId}/`, {
        headers: { authorization: `Basic ${auth}` }
      });
      if (response.ok) return { ok: true, message: "Plivo respondio correctamente." };
      return { ok: false, message: `Plivo rechazo la conexion (${response.status}). ${await readProviderError(response)}`.trim() };
    }
  }

  return { ok: true, message: "Configuracion registrada." };
}

function emit(event, payload) {
  const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(body);
}

function detectIntent(text = "") {
  const value = text.toLowerCase();
  const marketplaceTerms = ["amazon", "mercadolibre", "mercado libre", "walmart", "coppel", "elektra", "tiktok", "temu"];
  if (marketplaceTerms.some((term) => value.includes(term))) return "marketplace_support";
  if (["mayoreo", "mayorista", "distribuidor", "volumen"].some((term) => value.includes(term))) return "wholesale";
  if (["pedido", "orden", "envio", "paquete", "compra"].some((term) => value.includes(term))) return "order_status";
  if (["cita", "agenda", "horario", "sucursal"].some((term) => value.includes(term))) return "appointment";
  return "faq";
}

function detectMarketplace(text = "", channel = "web_widget") {
  const value = text.toLowerCase();
  const terms = ["amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"];
  const found = terms.find((term) => value.includes(term));
  if (found) return found;
  if (channel === "woocommerce" || channel === "official_site" || channel === "web_widget") return "official";
  return null;
}

function findAgent(requiredSkill, currentState) {
  return currentState.agents
    .filter((agent) => agent.online && agent.activeConversations < agent.maxConversations)
    .find((agent) => agent.skills.includes(requiredSkill) || agent.skills.includes("atc"));
}

function routeMessage({ text, channel, currentState }) {
  const intent = detectIntent(text);
  const marketplace = detectMarketplace(text, channel);
  const rule = currentState.routingRules
    .filter((item) => item.intent === intent)
    .sort((a, b) => a.priority - b.priority)[0];

  if (!rule) {
    return {
      intent,
      marketplace,
      status: "bot_active",
      reply: answerFromFaq(text, currentState),
      assignedAgent: null
    };
  }

  if (rule.botAllowed) {
    return {
      intent,
      marketplace,
      status: "bot_active",
      reply: rule.fallbackMessage,
      assignedAgent: null
    };
  }

  const skill = intent === "marketplace_support" ? marketplace : rule.requiredSkill;
  const assignedAgent = findAgent(skill, currentState);
  if (assignedAgent) {
    return {
      intent,
      marketplace,
      status: "waiting_for_agent",
      reply: `Te canalizo con ${assignedAgent.name}, especialista en ${assignedAgent.role}.`,
      assignedAgent
    };
  }

  const contact = currentState.branches.find((branch) => branch.services.includes(rule.requiredSkill)) || currentState.branches[1];
  return {
    intent,
    marketplace,
    status: "paused",
    reply: `${rule.fallbackMessage} Contacto: ${contact.phone} / WhatsApp ${contact.whatsapp}.`,
    assignedAgent: null
  };
}

function answerFromFaq(text, currentState) {
  const value = text.toLowerCase();
  const faq = currentState.faqs.find((item) => item.tags.some((tag) => value.includes(tag))) || currentState.faqs[0];
  return faq.shortAnswer;
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mime[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      res.end();
      return;
    }

  const cookies = parseCookies(req);
  req.sessionId = cookies.hwhub_session || null;
  req.user = await store.userFromSession(req.sessionId);

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const user = await store.authenticate(body.email, body.password);
    if (!user) {
      sendJson(res, { error: "Credenciales invalidas" }, 401);
      return;
    }
    const session = await store.createSession(user.id);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(session)
    });
    res.end(JSON.stringify({ user }));
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    await store.deleteSession(req.sessionId);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(null, true)
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/session") {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    sendJson(res, { user: req.user });
    return;
  }

  if (url.pathname === "/api/events") {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    clients.add(res);
    res.write(`event: ready\ndata: {"ok":true}\n\n`);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname === "/api/bootstrap") {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    sendJson(res, await store.bootstrap());
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, {
      ok: true,
      service: "hwhub",
      storage: store.mode,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body = await readBody(req);
    const channel = body.channel || "web_widget";
    const currentState = await store.bootstrap();
    const routed = routeMessage({ text: body.message || "", channel, currentState });
    let ai = { provider: "rules", reply: routed.reply, usedContext: null };
    if (routed.status === "bot_active") {
      try {
        ai = await generateBotReply({ text: body.message || "", routed, currentState, store });
      } catch (error) {
        ai = {
          provider: "fallback",
          reply: routed.reply || answerFromFaq(body.message || "", currentState),
          error: error.message,
          usedContext: null
        };
      }
    }
    const conversation = {
      id: `conv-${Date.now()}`,
      channel,
      customer: body.customer || "Visitante",
      status: routed.status,
      intent: routed.intent,
      marketplace: routed.marketplace,
      assignedAgentId: routed.assignedAgent?.id || null,
      lastMessage: body.message || "",
      aiProvider: ai.provider
    };
    const savedConversation = await store.createConversation(conversation);
    if (routed.status === "bot_active" && ai.reply) {
      await store.addMessage(savedConversation.id, {
        senderType: "bot",
        senderId: null,
        body: ai.reply,
        metadata: { provider: ai.provider, model: ai.model, usedContext: ai.usedContext, error: ai.error || null }
      });
    }
    emit("conversation.created", savedConversation);
    sendJson(res, {
      conversation: savedConversation,
      reply: ai.reply,
      assignedAgent: routed.assignedAgent,
      ai: {
        provider: ai.provider,
        model: ai.model || null,
        usedContext: ai.usedContext || null,
        error: ai.error || null
      }
    });
    return;
  }

  if (url.pathname.startsWith("/api/") && !req.user) {
    sendUnauthorized(res);
    return;
  }

  if (url.pathname.match(/^\/api\/conversations\/[^/]+\/(pause|take|bot|close)$/) && req.method === "POST") {
    requirePermission(req, "conversation:write");
    const id = url.pathname.split("/")[3];
    const action = url.pathname.split("/")[4];
    const currentState = await store.bootstrap();
    const conversation = currentState.conversations.find((item) => item.id === id);
    if (!conversation) {
      sendJson(res, { error: "Conversation not found" }, 404);
      return;
    }
    const nextStatus = {
      pause: "paused",
      take: "agent_active",
      bot: "bot_active",
      close: "closed"
    }[action];
    if (!nextStatus) {
      sendJson(res, { error: "Unsupported conversation action" }, 400);
      return;
    }
    const updated = await store.updateConversationStatus(id, nextStatus);
    await store.addEvent(id, {
      eventType: `conversation.${action}`,
      actorType: "user",
      actorId: req.user.id,
      body: `${req.user.name} ejecuto accion: ${action}`,
      metadata: { action, status: nextStatus, userEmail: req.user.email }
    });
    emit("conversation.updated", updated);
    sendJson(res, updated);
    return;
  }

  if (url.pathname.match(/^\/api\/conversations\/[^/]+$/) && req.method === "GET") {
    const id = url.pathname.split("/")[3];
    const currentState = await store.bootstrap();
    const conversation = currentState.conversations.find((item) => item.id === id);
    if (!conversation) {
      sendJson(res, { error: "Conversation not found" }, 404);
      return;
    }
    sendJson(res, {
      conversation,
      messages: await store.messages(id),
      events: await store.events(id)
    });
    return;
  }

  if (url.pathname.match(/^\/api\/conversations\/[^/]+\/messages$/) && req.method === "POST") {
    requirePermission(req, "conversation:write");
    const id = url.pathname.split("/")[3];
    const body = await readBody(req);
    const message = await store.addMessage(id, {
      senderType: body.senderType || "agent",
      senderId: body.senderId || req.user.agentId || null,
      body: body.body || ""
    });
    await store.addEvent(id, {
      eventType: "conversation.agent_reply",
      actorType: "user",
      actorId: req.user.id,
      body: `${req.user.name} respondio al cliente`,
      metadata: { userEmail: req.user.email }
    });
    emit("message.created", message);
    sendJson(res, message, 201);
    return;
  }

  if (url.pathname === "/api/integrations" && req.method === "GET") {
    sendJson(res, await store.integrations());
    return;
  }

  if (url.pathname === "/api/integrations" && req.method === "POST") {
    requirePermission(req, "integrations:write");
    const integration = await store.saveIntegration(await readBody(req));
    emit("integrations.updated", integration);
    sendJson(res, integration, 201);
    return;
  }

  if (url.pathname === "/api/integrations/test" && req.method === "POST") {
    requirePermission(req, "integrations:write");
    const body = await readBody(req);
    let config = body.config || {};
    try {
      config = typeof config === "string" ? JSON.parse(config || "{}") : config;
    } catch {
      sendJson(res, { error: "Integration config must be valid JSON" }, 400);
      return;
    }
    const result = await testIntegrationConnection({
      provider: body.provider,
      name: body.name || "Prueba temporal",
      config
    });
    sendJson(res, result);
    return;
  }

  if (url.pathname.match(/^\/api\/integrations\/[^/]+\/test$/) && req.method === "POST") {
    requirePermission(req, "integrations:write");
    const id = url.pathname.split("/")[3];
    const integration = await store.integrationById?.(id);
    if (!integration) {
      sendJson(res, { error: "Integration not found" }, 404);
      return;
    }
    const result = await testIntegrationConnection(integration);
    const updated = await store.recordIntegrationCheck?.(id, result);
    emit("integrations.updated", updated || integration);
    sendJson(res, { ...result, integration: updated || integration });
    return;
  }

  if (url.pathname.match(/^\/api\/integrations\/[^/]+$/) && req.method === "DELETE") {
    requirePermission(req, "integrations:write");
    const id = url.pathname.split("/")[3];
    const deleted = await store.deleteIntegration?.(id);
    if (!deleted) {
      sendJson(res, { error: "Integration not found" }, 404);
      return;
    }
    emit("integrations.deleted", { id });
    sendJson(res, { ok: true });
    return;
  }

  if (url.pathname === "/api/users" && req.method === "GET") {
    if (!isAdmin(req)) {
      sendJson(res, { error: "Only admins can manage users" }, 403);
      return;
    }
    sendJson(res, await store.users());
    return;
  }

  if (url.pathname === "/api/users" && req.method === "POST") {
    if (!isAdmin(req)) {
      sendJson(res, { error: "Only admins can manage users" }, 403);
      return;
    }
    const user = await store.saveUser(await readBody(req));
    if (!user) {
      sendJson(res, { error: "User not found" }, 404);
      return;
    }
    emit("users.updated", user);
    sendJson(res, user, 201);
    return;
  }

  if (url.pathname === "/api/users/password" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.newPassword || String(body.newPassword).length < 8) {
      sendJson(res, { error: "Password must have at least 8 characters" }, 400);
      return;
    }
    const user = await store.authenticate(req.user.email, body.currentPassword || "");
    if (!user) {
      sendJson(res, { error: "Current password is incorrect" }, 401);
      return;
    }
    sendJson(res, await store.updatePassword(req.user.id, body.newPassword));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const key = url.pathname.replace("/api/", "");
    const [collection, id] = key.split("/");
    const allowed = ["faqs", "branches", "agents", "routingRules"];
    if (allowed.includes(collection) && req.method === "GET") {
      sendJson(res, await store.collection(collection));
      return;
    }
    if (allowed.includes(collection) && req.method === "POST" && !id) {
      requirePermission(req, `${collection}:write`);
      const item = await store.create(collection, await readBody(req));
      emit(`${collection}.created`, item);
      sendJson(res, item, 201);
      return;
    }
    if (allowed.includes(collection) && req.method === "PUT" && id) {
      requirePermission(req, `${collection}:write`);
      const item = await store.update(collection, id, await readBody(req));
      if (!item) {
        sendJson(res, { error: "Not found" }, 404);
        return;
      }
      emit(`${collection}.updated`, item);
      sendJson(res, item);
      return;
    }
    if (allowed.includes(collection) && req.method === "DELETE" && id) {
      requirePermission(req, `${collection}:write`);
      const ok = await store.remove(collection, id);
      sendJson(res, { ok });
      return;
    }
  }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, { error: error.message || "Server error" }, error.statusCode || 500);
  }
});

store = await createDataStore(state);

server.listen(port, () => {
  console.log(`HWHub listo en http://localhost:${port}`);
});
