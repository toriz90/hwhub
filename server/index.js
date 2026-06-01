import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = normalize(join(__dirname, ".."));
const publicDir = join(root, "web");
const port = Number(process.env.PORT || 3000);

const clients = new Set();

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

function findAgent(requiredSkill) {
  return state.agents
    .filter((agent) => agent.online && agent.activeConversations < agent.maxConversations)
    .find((agent) => agent.skills.includes(requiredSkill) || agent.skills.includes("atc"));
}

function routeMessage({ text, channel }) {
  const intent = detectIntent(text);
  const marketplace = detectMarketplace(text, channel);
  const rule = state.routingRules
    .filter((item) => item.intent === intent)
    .sort((a, b) => a.priority - b.priority)[0];

  if (!rule) {
    return {
      intent,
      marketplace,
      status: "bot_active",
      reply: answerFromFaq(text),
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
  const assignedAgent = findAgent(skill);
  if (assignedAgent) {
    return {
      intent,
      marketplace,
      status: "waiting_for_agent",
      reply: `Te canalizo con ${assignedAgent.name}, especialista en ${assignedAgent.role}.`,
      assignedAgent
    };
  }

  const contact = state.branches.find((branch) => branch.services.includes(rule.requiredSkill)) || state.branches[1];
  return {
    intent,
    marketplace,
    status: "paused",
    reply: `${rule.fallbackMessage} Contacto: ${contact.phone} / WhatsApp ${contact.whatsapp}.`,
    assignedAgent: null
  };
}

function answerFromFaq(text) {
  const value = text.toLowerCase();
  const faq = state.faqs.find((item) => item.tags.some((tag) => value.includes(tag))) || state.faqs[0];
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
    res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
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

  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    clients.add(res);
    res.write(`event: ready\ndata: {"ok":true}\n\n`);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname === "/api/bootstrap") {
    sendJson(res, state);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, {
      ok: true,
      service: "hwhub",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body = await readBody(req);
    const channel = body.channel || "web_widget";
    const routed = routeMessage({ text: body.message || "", channel });
    const conversation = {
      id: `conv-${Date.now()}`,
      channel,
      customer: body.customer || "Visitante",
      status: routed.status,
      intent: routed.intent,
      marketplace: routed.marketplace,
      assignedAgentId: routed.assignedAgent?.id || null,
      lastMessage: body.message || ""
    };
    state.conversations.unshift(conversation);
    emit("conversation.created", conversation);
    sendJson(res, {
      conversation,
      reply: routed.reply,
      assignedAgent: routed.assignedAgent
    });
    return;
  }

  if (url.pathname.startsWith("/api/conversations/") && req.method === "POST") {
    const id = url.pathname.split("/")[3];
    const action = url.pathname.split("/")[4];
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation) {
      sendJson(res, { error: "Conversation not found" }, 404);
      return;
    }
    if (action === "pause") conversation.status = "paused";
    if (action === "take") conversation.status = "agent_active";
    if (action === "bot") conversation.status = "bot_active";
    if (action === "close") conversation.status = "closed";
    emit("conversation.updated", conversation);
    sendJson(res, conversation);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const key = url.pathname.replace("/api/", "");
    if (Object.hasOwn(state, key)) {
      sendJson(res, state[key]);
      return;
    }
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`HWHub listo en http://localhost:${port}`);
});
