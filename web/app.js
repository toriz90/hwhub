const state = {
  data: null,
  users: [],
  alerts: 0,
  selectedConversationId: null,
  role: "viewer",
  user: null,
  typing: {},
  conversationDetails: {},
  unread: {}
};

const filters = {
  status: "",
  channel: "",
  priority: "",
  slaState: "",
  search: "",
  branchState: "",
  branchSearch: "",
  directoryArea: "",
  directorySearch: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const themeStorageKey = "hwhub-theme";

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function setTheme(theme, persist = true) {
  const selected = normalizeTheme(theme);
  document.documentElement.dataset.theme = selected;
  const toggle = $("#theme-toggle");
  if (toggle) toggle.checked = selected === "dark";
  if (persist) localStorage.setItem(themeStorageKey, selected);
}

setTheme(localStorage.getItem(themeStorageKey) || document.documentElement.dataset.theme || "light", false);

function notify(message, type = "ok", detail = "") {
  const region = $("#toast-region");
  if (!region || !message) return;
  const toast = document.createElement("div");
  toast.className = `toast is-${type}`;
  toast.innerHTML = `${esc(message)}${detail ? `<small>${esc(detail)}</small>` : ""}`;
  region.append(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    window.setTimeout(() => toast.remove(), 180);
  }, type === "error" ? 5200 : 3200);
}

function setButtonBusy(button, busy, label = "Procesando...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText ||= button.textContent;
    button.textContent = label;
    button.classList.add("is-busy");
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  delete button.dataset.originalText;
  button.classList.remove("is-busy");
  button.disabled = false;
}

const rolePermissions = {
  admin: ["*"],
  supervisor: ["conversation", "faqs", "branches", "directoryContacts", "agents", "routingRules", "integrations"],
  agent: ["conversation"],
  marketplace: ["conversation"],
  wholesale: ["conversation"],
  viewer: []
};

const roleCatalog = {
  admin: ["configurar APIs", "editar reglas", "editar agentes", "cerrar conversaciones", "ver secretos enmascarados"],
  supervisor: ["reasignar conversaciones", "pausar chats", "editar FAQs", "editar directorio", "ver reportes"],
  agent: ["tomar conversaciones", "responder clientes", "devolver al bot"],
  marketplace: ["atender Amazon", "atender MercadoLibre", "atender marketplaces"],
  wholesale: ["atender mayoreo", "ver contactos de sucursales", "canalizar sucursal"],
  viewer: ["ver bandeja", "ver FAQs", "ver sucursales", "ver directorio"]
};

const viewMeta = {
  dashboard: {
    eyebrow: "Operacion en tiempo real",
    title: "WhaleHub operativo",
    subtitle: "Panel central de atencion, IA y operaciones Honey Whale."
  },
  conversations: {
    eyebrow: "Inbox multicanal",
    title: "Conversaciones",
    subtitle: "Atiende chats del widget, WhatsApp, WooCommerce y marketplaces desde una bandeja viva."
  },
  chatbot: {
    eyebrow: "Configuracion IA",
    title: "Chatbot",
    subtitle: "Prompt, comportamiento, apariencia del widget, instalacion y pruebas de ruteo."
  },
  agents: {
    eyebrow: "Multiagente",
    title: "Agentes",
    subtitle: "Gestiona disponibilidad, skills, canales y capacidad operativa del equipo."
  },
  knowledge: {
    eyebrow: "Base de conocimiento",
    title: "FAQs",
    subtitle: "Preguntas, respuestas y etiquetas que alimentan la asistencia del bot y los agentes."
  },
  branches: {
    eyebrow: "Datos operativos",
    title: "Sucursales",
    subtitle: "Directorio de ubicaciones, horarios, canales y servicios por zona."
  },
  directory: {
    eyebrow: "Canalizacion",
    title: "Directorio",
    subtitle: "Contactos por area, marketplace, skill e intencion para fallback y escalamiento."
  },
  routing: {
    eyebrow: "Motor de decision",
    title: "Ruteo",
    subtitle: "Reglas que deciden si responde el bot, se pausa o se canaliza con agentes."
  },
  integrations: {
    eyebrow: "Conectores",
    title: "APIs",
    subtitle: "Credenciales, pruebas de conexion y estado de integraciones externas."
  },
  users: {
    eyebrow: "Sistema",
    title: "Usuarios",
    subtitle: "Cuentas, roles, estado y relacion con agentes del backoffice."
  },
  roles: {
    eyebrow: "Permisos",
    title: "Roles",
    subtitle: "Capacidades por rol y pruebas de comportamiento de acceso."
  }
};

const integrationDefinitions = [
  {
    provider: "openai",
    name: "OpenAI produccion",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "sk-..." },
      { key: "model", label: "Modelo", type: "text", required: true, value: "gpt-4.1-mini" },
      { key: "useForChat", label: "Usar en chatbot", type: "checkbox", value: true }
    ]
  },
  {
    provider: "claude",
    name: "Claude produccion",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "sk-ant-..." },
      { key: "model", label: "Modelo", type: "text", required: true, value: "claude-sonnet-4-20250514" },
      { key: "useForChat", label: "Usar en chatbot", type: "checkbox", value: true }
    ]
  },
  {
    provider: "whatsapp_cloud",
    name: "WhatsApp oficial",
    fields: [
      { key: "token", label: "Access token", type: "password", required: true, placeholder: "EA..." },
      { key: "phoneNumberId", label: "Phone number ID", type: "text", required: true },
      { key: "businessAccountId", label: "Business account ID", type: "text" },
      { key: "graphVersion", label: "Graph version", type: "text", required: true, value: "v20.0" }
    ]
  },
  {
    provider: "evolution_api",
    name: "Evolution API",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://evolution.tudominio.com" },
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "instanceName", label: "Instancia", type: "text", required: true, value: "whalehub" },
      { key: "testPath", label: "Ruta de prueba", type: "text", required: true, value: "/instance/fetchInstances" }
    ]
  },
  {
    provider: "telnyx",
    name: "Telnyx WhatsApp/SMS",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "KEY..." },
      { key: "messagingProfileId", label: "Messaging profile ID", type: "text" }
    ]
  },
  {
    provider: "plivo",
    name: "Plivo WhatsApp/SMS",
    fields: [
      { key: "authId", label: "Auth ID", type: "text", required: true },
      { key: "authToken", label: "Auth token", type: "password", required: true },
      { key: "phoneNumber", label: "Numero", type: "text" }
    ]
  },
  {
    provider: "woocommerce",
    name: "WooCommerce tienda oficial",
    fields: [
      { key: "baseUrl", label: "URL de tienda", type: "url", required: true, placeholder: "https://tutienda.com" },
      { key: "consumerKey", label: "Consumer key", type: "password", required: true, placeholder: "ck_..." },
      { key: "consumerSecret", label: "Consumer secret", type: "password", required: true, placeholder: "cs_..." },
      { key: "widgetSharedSecret", label: "Secreto widget WooCommerce", type: "password", placeholder: "Mismo secreto usado en WordPress" }
    ]
  },
  {
    provider: "easyappointments",
    name: "Easy!Appointments agenda",
    fields: [
      { key: "baseUrl", label: "URL de agenda", type: "url", required: true, placeholder: "https://agenda.tudominio.com" },
      { key: "apiKey", label: "API key/token", type: "password" },
      { key: "testPath", label: "Ruta de prueba", type: "text", required: true, value: "/index.php/api/v1/services" }
    ]
  },
  {
    provider: "trackship",
    name: "TrackShip envios",
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "appName", label: "App name", type: "text", required: true, value: "WhaleHub" },
      { key: "trackingProvider", label: "Proveedor default", type: "text", placeholder: "dhl, fedex, estafeta..." }
    ]
  }
];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusLabel(status) {
  return {
    bot_active: "Bot activo",
    waiting_for_agent: "Esperando agente",
    agent_active: "Agente activo",
    paused: "Pausado",
    closed: "Cerrado"
  }[status] || status;
}

function statusShortLabel(status) {
  return {
    bot_active: "BOT",
    waiting_for_agent: "BOT -> AGENTE",
    agent_active: "AGENTE",
    paused: "PAUSADO",
    closed: "RESUELTO"
  }[status] || String(status || "SIN ESTADO").toUpperCase();
}

function channelLabel(channel) {
  return {
    whatsapp_cloud: "WhatsApp",
    web_widget: "Widget",
    woocommerce: "WooCommerce",
    official_site: "Pagina oficial",
    evolution_api: "Evolution",
    telnyx: "Telnyx",
    plivo: "Plivo"
  }[channel] || channel || "Canal";
}

function channelClass(channel, marketplace = "") {
  const value = String(marketplace || channel || "").toLowerCase();
  if (value.includes("mercado")) return "mercadolibre";
  if (value.includes("amazon")) return "amazon";
  if (String(channel || "").includes("whatsapp")) return "whatsapp";
  return "web";
}

function initials(name = "") {
  const parts = String(name || "Cliente").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "C").concat(parts[1]?.[0] || "").toUpperCase();
}

function formatShortTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "long" });
}

function roleCan(permission) {
  const permissions = rolePermissions[state.role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

function formatDateTime(value) {
  if (!value) return "Sin prueba";
  return new Date(value).toLocaleString();
}

function integrationTemplate(provider) {
  return integrationDefinitions.find((item) => item.provider === provider) || integrationDefinitions[0];
}

function definitionDefaults(definition) {
  return Object.fromEntries(definition.fields.map((field) => [field.key, field.value ?? ""]));
}

function renderIntegrationFields(provider, values = {}, keepSecrets = false) {
  const definition = integrationTemplate(provider);
  $("#integration-fields").innerHTML = definition.fields
    .map((field) => {
      const value = values[field.key] ?? field.value ?? "";
      const required = field.required ? "required" : "";
      if (field.type === "checkbox") {
        return `
          <label class="check integration-field">
            <input type="checkbox" data-config-field="${esc(field.key)}" ${value ? "checked" : ""}>
            ${esc(field.label)}
          </label>
        `;
      }
      if (field.type === "textarea") {
        return `
          <label class="integration-field integration-field-wide">
            ${esc(field.label)}${field.required ? " *" : ""}
            <textarea
              data-config-field="${esc(field.key)}"
              placeholder="${esc(field.placeholder || field.value || "")}"
              ${required}>${esc(value)}</textarea>
          </label>
        `;
      }
      return `
        <label class="integration-field">
          ${esc(field.label)}${field.required ? " *" : ""}
          <input
            type="${esc(field.type || "text")}"
            data-config-field="${esc(field.key)}"
            value="${keepSecrets && field.type === "password" ? "" : esc(value)}"
            placeholder="${esc(keepSecrets && field.type === "password" ? "Deja vacio para conservar el secreto guardado" : field.placeholder || field.value || "")}"
            ${required}>
        </label>
      `;
    })
    .join("");
  $("#integration-form").dataset.configTested = "false";
  $("#save-integration").disabled = true;
}

function readIntegrationConfig({ allowBlankSecrets = false } = {}) {
  const form = $("#integration-form");
  const definition = integrationTemplate(form.elements.provider.value);
  const config = {};
  const errors = [];
  for (const field of definition.fields) {
    const input = form.querySelector(`[data-config-field="${field.key}"]`);
    if (!input) continue;
    const value = field.type === "checkbox" ? input.checked : input.value.trim();
    const isBlankSecret = allowBlankSecrets && field.type === "password" && !value && form.elements.id.value;
    if (field.required && !value && !isBlankSecret) errors.push(`${field.label} es obligatorio.`);
    if (field.type === "url" && value && !/^https?:\/\//i.test(value)) errors.push(`${field.label} debe iniciar con http:// o https://.`);
    if (value || field.type === "checkbox") config[field.key] = value;
  }
  return { config, errors };
}

function syncIntegrationConfig({ allowBlankSecrets = false } = {}) {
  const { config, errors } = readIntegrationConfig({ allowBlankSecrets });
  $("#integration-form").elements.config.value = Object.keys(config).length ? JSON.stringify(config) : "";
  return { config, errors };
}

function formPayload(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    payload[checkbox.name] = checkbox.checked;
  }
  return payload;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

async function loadSession() {
  try {
    const data = await api("/api/session");
    state.user = data.user;
    state.role = data.user.role;
    return data.user;
  } catch {
    state.user = null;
    state.role = "viewer";
    return null;
  }
}

async function login(email, password) {
  const data = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  state.user = data.user;
  state.role = data.user.role;
  return data.user;
}

async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.data = null;
  state.role = "viewer";
}

async function loadBootstrap() {
  state.data = await api("/api/bootstrap");
  if (state.data?.conversations) {
    const validIds = new Set(state.data.conversations.map((item) => item.id));
    for (const id of Object.keys(state.unread)) {
      if (!validIds.has(id)) delete state.unread[id];
    }
  }
  return state.data;
}

async function loadUsers() {
  if (state.role !== "admin") {
    state.users = [];
    return state.users;
  }
  state.users = await api("/api/users");
  return state.users;
}

function setAuthenticatedUi(isAuthenticated) {
  $("#login-screen").classList.toggle("hidden", isAuthenticated);
  $(".sidebar").classList.toggle("hidden", !isAuthenticated);
  $("main").classList.toggle("hidden", !isAuthenticated);
  $("#active-user").textContent = state.user ? `${state.user.name} - ${state.user.role}` : "";
}

function upsertConversation(conversation) {
  if (!conversation || !state.data?.conversations) return;
  const index = state.data.conversations.findIndex((item) => item.id === conversation.id);
  if (index >= 0) {
    state.data.conversations[index] = { ...state.data.conversations[index], ...conversation };
  } else {
    state.data.conversations.unshift(conversation);
  }
  state.data.conversations.sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

function updateConversationSummaryFromMessage(message) {
  if (!message?.conversationId || !state.data?.conversations) return;
  const conversation = state.data.conversations.find((item) => item.id === message.conversationId);
  if (!conversation) return;
  conversation.lastMessage = message.body || conversation.lastMessage;
  conversation.updatedAt = message.createdAt || new Date().toISOString();
}

function cacheConversationDetail(data) {
  if (!data?.conversation?.id) return;
  state.conversationDetails[data.conversation.id] = data;
  upsertConversation(data.conversation);
}

function cacheMessage(message) {
  if (!message?.conversationId) return;
  const detail = state.conversationDetails[message.conversationId];
  if (detail?.messages && !detail.messages.some((item) => item.id === message.id)) {
    detail.messages.push(message);
  }
  updateConversationSummaryFromMessage(message);
}

function renderConversationFrame() {
  renderDashboard();
  renderConversations();
  applyRoleUi();
}

function renderDashboard() {
  const appState = state.data;
  $("#metric-conversations").textContent = appState.conversations.length;
  $("#metric-agents").textContent = appState.agents.filter((agent) => agent.online).length;
  $("#metric-faqs").textContent = appState.faqs.filter((faq) => faq.published).length;
  $("#metric-alerts").textContent = state.alerts;
  const counts = appState.conversations.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  $("#metric-bot-active").textContent = counts.bot_active || 0;
  $("#metric-waiting-agent").textContent = counts.waiting_for_agent || 0;
  $("#metric-agent-active").textContent = counts.agent_active || 0;
  $("#metric-paused").textContent = counts.paused || 0;
  $("#metric-closed").textContent = counts.closed || 0;
  $("#metric-urgent").textContent = appState.conversations.filter((item) => item.priority === "urgent").length;
  $("#metric-sla-risk").textContent = appState.conversations.filter((item) => ["at_risk", "breached"].includes(item.slaState)).length;
  renderDashboardInsights(appState);
}

function renderDashboardInsights(appState) {
  const attention = $("#dashboard-attention-list");
  const channels = $("#dashboard-channel-bars");
  const integrations = $("#dashboard-integration-status");
  if (!attention || !channels || !integrations) return;

  const priorityQueue = [...(appState.conversations || [])]
    .filter((item) => item.status !== "closed")
    .sort((left, right) => {
      const score = (item) => (item.priority === "urgent" ? 3 : item.slaState === "breached" ? 2 : item.status === "waiting_for_agent" ? 1 : 0);
      return score(right) - score(left) || new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    })
    .slice(0, 5);

  attention.innerHTML = priorityQueue.map((item) => `
    <button type="button" class="dashboard-attention-item" data-dashboard-open="${esc(item.id)}">
      <span>
        <strong>${esc(item.customer || "Cliente")}</strong>
        <small>${esc(channelLabel(item.channel))} - ${esc(statusLabel(item.status))}</small>
      </span>
      <em>${esc(formatShortTime(item.updatedAt))}</em>
    </button>
  `).join("") || `<article class="wh-empty-state compact"><strong>Sin pendientes</strong><p>No hay conversaciones abiertas que requieran atencion inmediata.</p></article>`;

  for (const item of $$("[data-dashboard-open]")) {
    item.onclick = () => {
      showView("conversations");
      history.replaceState(null, "", "#conversations");
      openConversation(item.dataset.dashboardOpen);
    };
  }

  const channelCounts = (appState.conversations || []).reduce((acc, item) => {
    const label = channelLabel(item.channel);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const maxChannel = Math.max(1, ...Object.values(channelCounts));
  channels.innerHTML = Object.entries(channelCounts).map(([label, count]) => `
    <article class="dashboard-channel-row">
      <div>
        <strong>${esc(label)}</strong>
        <span>${esc(count)} chats</span>
      </div>
      <i style="--bar:${Math.max(8, Math.round((count / maxChannel) * 100))}%"></i>
    </article>
  `).join("") || `<article class="wh-empty-state compact"><strong>Sin actividad</strong><p>Aun no hay conversaciones por canal.</p></article>`;

  const apiItems = appState.integrations || [];
  integrations.innerHTML = apiItems.slice(0, 6).map((item) => {
    const status = item.lastCheckStatus === "ok" ? "ok" : item.lastCheckStatus ? "warning" : "info";
    return `
      <article class="dashboard-api-row is-${status}">
        <span>${esc(item.name || item.provider)}</span>
        <strong>${esc(item.lastCheckStatus || "sin prueba")}</strong>
      </article>
    `;
  }).join("") || `<article class="wh-empty-state compact"><strong>Sin APIs</strong><p>Configura integraciones para ver su estado aqui.</p></article>`;
}

function renderConversationInbox() {
  const appState = state.data;
  const conversations = appState.conversations.filter((item) => {
    const profile = item.metadata?.customerProfile || {};
    const haystack = [
      item.customer,
      item.customerPhone,
      item.channel,
      item.marketplace,
      item.intent,
      item.lastMessage,
      profile.email,
      profile.orderNumber,
      profile.phone
    ].join(" ").toLowerCase();
    return (
      (!filters.status || item.status === filters.status) &&
      (!filters.channel || item.channel === filters.channel) &&
      (!filters.priority || item.priority === filters.priority) &&
      (!filters.slaState || item.slaState === filters.slaState || (filters.slaState === "at_risk" && item.slaState === "breached")) &&
      (!filters.search || haystack.includes(filters.search.toLowerCase()))
    );
  }).sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));

  $("#conversation-list").innerHTML = conversations
    .map((item) => {
      const agent = appState.agents.find((entry) => entry.id === item.assignedAgentId);
      const channel = channelLabel(item.channel);
      const avatarClass = channelClass(item.channel, item.marketplace);
      const statusText = item.status === "agent_active" && agent ? `AGENTE - ${agent.name}` : statusShortLabel(item.status);
      const unread = Number(state.unread[item.id] || 0);
      const tags = [
        `<span class="wh-conv-tag status-${esc(item.status)}">${esc(statusText)}</span>`,
        unread ? `<span class="wh-conv-tag is-unread">${esc(unread)} nuevo${unread > 1 ? "s" : ""}</span>` : "",
        item.priority === "urgent" ? `<span class="wh-conv-tag is-urgent">URGENTE</span>` : "",
        item.intent ? `<span class="wh-conv-tag">${esc(item.intent)}</span>` : "",
        item.marketplace && item.marketplace !== "official" ? `<span class="wh-conv-tag">${esc(item.marketplace)}</span>` : ""
      ].filter(Boolean).join("");
      return `
        <article class="item conversation-card wh-conv ${state.selectedConversationId === item.id ? "selected" : ""}" data-open-conversation="${esc(item.id)}" role="listitem" tabindex="0">
          <div class="wh-conv-avatar is-${esc(avatarClass)}">${esc(initials(item.customer))}</div>
          <div class="wh-conv-main">
            <div class="conversation-card-head">
              <strong>${esc(item.customer)}</strong>
              <span>${esc(channel)} - ${esc(formatShortTime(item.updatedAt))}</span>
            </div>
            <p>${esc(item.lastMessage || "Sin mensajes recientes")}</p>
            <div class="wh-conv-tags">${tags}</div>
          </div>
          ${unread ? `<strong class="wh-unread-dot" aria-label="${esc(unread)} mensajes nuevos">${esc(unread)}</strong>` : item.priority === "urgent" ? `<strong class="wh-unread-dot" aria-label="Urgente">!</strong>` : ""}
        </article>
      `;
    })
    .join("") || `<article class="item wh-empty-state"><strong>Sin resultados</strong><p>No hay conversaciones con esos filtros.</p></article>`;

  for (const item of $$(".conversation-card")) {
    item.onclick = (event) => {
      if (event.target.closest("button")) return;
      openConversation(item.dataset.openConversation);
    };
    item.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openConversation(item.dataset.openConversation);
      }
    };
  }
}

function renderConversations() {
  return renderConversationInbox();
}

function renderAdminCollections() {
  renderAgents();
  renderRouting();
  renderBranches();
  renderDirectoryContacts();
  renderFaqs();
  bindRowActions();
}

function renderFaqs(query = $("#faq-search").value || "") {
  const value = query.toLowerCase();
  const filtered = state.data.faqs.filter((faq) => {
    const haystack = `${faq.question} ${faq.shortAnswer} ${faq.category} ${(faq.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(value);
  });
  $("#faq-list").innerHTML = filtered
    .map((faq) => `
      <article class="faq">
        <strong>${esc(faq.question)}</strong>
        <p>${esc(faq.shortAnswer)}</p>
        <p class="meta">${esc(faq.category)}</p>
        ${(faq.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
        <div class="row-actions">
          <button data-edit="faqs" data-id="${esc(faq.id)}">Editar</button>
          <button data-delete="faqs" data-id="${esc(faq.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("");
}

function renderAgents() {
  $("#agents-list").innerHTML = state.data.agents
    .map((agent) => `
      <article class="card">
        <strong>${esc(agent.name)}</strong>
        <p>${esc(agent.role)}</p>
        <p class="meta">${agent.online ? "Activo" : "Fuera de linea"} - ${agent.activeConversations}/${agent.maxConversations} chats</p>
        ${agent.linkedUser ? `<p class="meta">Usuario: ${esc(agent.linkedUser.name || agent.linkedUser.email)}${agent.loginControlled ? " - controlado por sesion" : " - control manual disponible"}</p>` : `<p class="meta">Sin usuario vinculado - control manual</p>`}
        <label class="switch-row" title="${agent.loginControlled ? "La sesion iniciada controla este agente" : "Activar o desactivar manualmente"}">
          <input type="checkbox" data-agent-presence="${esc(agent.id)}" ${agent.online ? "checked" : ""} ${agent.loginControlled || !roleCan("agents") ? "disabled" : ""}>
          <span></span>
          <em>${agent.loginControlled ? "Activo por sesion" : agent.online ? "Activo manual" : "Inactivo manual"}</em>
        </label>
        ${(agent.skills || []).map((skill) => `<span class="tag">${esc(skill)}</span>`).join("")}
        ${agent.loginControlled ? `<span class="tag tag-session">Sesion activa</span>` : `<span class="tag">Manual</span>`}
        <div class="row-actions">
          <button data-edit="agents" data-id="${esc(agent.id)}">Editar</button>
          <button data-delete="agents" data-id="${esc(agent.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("");
}

function renderRouting() {
  $("#routing-list").innerHTML = state.data.routingRules
    .map((rule) => `
      <article class="rule">
        <strong>${esc(rule.name)}</strong>
        <p class="meta">${esc(rule.intent)} - ${rule.botAllowed ? "bot permitido" : "requiere agente"} - prioridad ${esc(rule.priority)}</p>
        <p>${esc(rule.fallbackMessage)}</p>
        <div class="row-actions">
          <button data-edit="routingRules" data-id="${esc(rule.id)}">Editar</button>
          <button data-delete="routingRules" data-id="${esc(rule.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("");
}

function renderBranches() {
  const branches = state.data.branches || [];
  const states = [...new Set(branches.map((branch) => branch.state || branch.city).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
  const stateSelect = $("#branch-state-filter");
  const selectedState = filters.branchState;
  stateSelect.innerHTML = `<option value="">Todos los estados</option>` + states
    .map((item) => `<option value="${esc(item)}"${item === selectedState ? " selected" : ""}>${esc(item)}</option>`)
    .join("");
  const query = filters.branchSearch.toLowerCase();
  const filtered = branches.filter((branch) => {
    const haystack = [
      branch.name,
      branch.state,
      branch.city,
      branch.municipality,
      branch.colony,
      branch.address,
      branch.phone,
      branch.whatsapp,
      branch.email,
      (branch.services || []).join(" ")
    ].join(" ").toLowerCase();
    return (!filters.branchState || branch.state === filters.branchState || branch.city === filters.branchState) &&
      (!query || haystack.includes(query));
  });

  $("#branches-list").innerHTML = filtered
    .map((branch) => `
      <article class="card">
        <strong>${esc(branch.name)}</strong>
        <p>${esc([branch.colony, branch.municipality, branch.state || branch.city].filter(Boolean).join(" - "))}</p>
        <p class="meta">${esc(branch.address || "Direccion pendiente")}</p>
        <p class="meta">WhatsApp: ${esc(branch.whatsapp || "sin dato")} ${branch.phone ? `- Tel: ${esc(branch.phone)}` : ""}</p>
        ${branch.email ? `<p class="meta">Email: ${esc(branch.email)}</p>` : ""}
        <p class="meta">Horario: ${esc(branch.hours || "sin horario")}</p>
        ${(branch.services || []).map((service) => `<span class="tag">${esc(service)}</span>`).join("")}
        ${branch.wholesaleContact ? `<p class="meta">Mayoristas: ${esc(branch.wholesaleContact)}</p>` : ""}
        <div class="row-actions">
          <button data-edit="branches" data-id="${esc(branch.id)}">Editar</button>
          <button data-delete="branches" data-id="${esc(branch.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("") || `<article class="card"><p class="meta">No hay sucursales con esos filtros.</p></article>`;
}

function renderDirectoryContacts() {
  const contacts = state.data.directoryContacts || [];
  const areas = [...new Set(contacts.map((contact) => contact.area).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
  const areaSelect = $("#directory-area-filter");
  if (!areaSelect) return;
  areaSelect.innerHTML = `<option value="">Todas las areas</option>` + areas
    .map((area) => `<option value="${esc(area)}"${area === filters.directoryArea ? " selected" : ""}>${esc(area)}</option>`)
    .join("");
  const query = filters.directorySearch.toLowerCase();
  const filtered = contacts.filter((contact) => {
    const haystack = [
      contact.area,
      contact.name,
      contact.email,
      contact.whatsapp,
      contact.schedule,
      contact.description,
      (contact.channels || []).join(" "),
      (contact.intents || []).join(" "),
      (contact.marketplaces || []).join(" "),
      (contact.skills || []).join(" ")
    ].join(" ").toLowerCase();
    return (!filters.directoryArea || contact.area === filters.directoryArea) &&
      (!query || haystack.includes(query));
  });

  $("#directory-list").innerHTML = filtered
    .map((contact) => `
      <article class="card directory-card">
        <strong>${esc(contact.name)}</strong>
        <p>${esc(contact.area || "Sin area")}</p>
        <p class="meta">WhatsApp: ${esc(contact.whatsapp || "sin dato")}${contact.email ? ` - Email: ${esc(contact.email)}` : ""}</p>
        <p class="meta">Horario: ${esc(contact.schedule || "sin horario")}</p>
        ${contact.description ? `<p>${esc(contact.description)}</p>` : ""}
        <p class="meta">Prioridad ${esc(contact.priority ?? 100)}</p>
        ${(contact.marketplaces || []).map((item) => `<span class="tag tag-market">${esc(item)}</span>`).join("")}
        ${(contact.channels || []).map((item) => `<span class="tag">${esc(item)}</span>`).join("")}
        ${(contact.intents || []).map((item) => `<span class="tag">${esc(item)}</span>`).join("")}
        ${(contact.skills || []).map((item) => `<span class="tag">${esc(item)}</span>`).join("")}
        <div class="row-actions">
          <button data-edit="directoryContacts" data-id="${esc(contact.id)}">Editar</button>
          <button data-delete="directoryContacts" data-id="${esc(contact.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("") || `<article class="card"><p class="meta">No hay contactos con esos filtros.</p></article>`;
}

function renderIntegrations() {
  const integrations = state.data.integrations || [];
  $("#integrations-list").innerHTML = integrations
    .map((item) => `
      <article class="card">
        <strong>${esc(item.name)}</strong>
        <p class="meta">${esc(item.provider)} - ${item.active ? "activa" : "inactiva"}</p>
        <p class="meta">
          Ultima prueba: ${esc(formatDateTime(item.lastCheckedAt))}
          ${item.lastCheckStatus ? `- ${esc(item.lastCheckStatus)}` : ""}
        </p>
        ${item.lastCheckMessage ? `<p class="meta">${esc(item.lastCheckMessage)}</p>` : ""}
        ${Object.entries(item.config || {}).map(([key, value]) => `<span class="tag">${esc(key)}: ${esc(value)}</span>`).join("")}
        <div class="row-actions">
          <button data-edit-integration="${esc(item.id)}">Editar</button>
          <button data-test-integration="${esc(item.id)}">Probar</button>
          <button class="danger" data-delete-integration="${esc(item.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("") || `<article class="card"><p class="meta">Sin APIs configuradas.</p></article>`;

  for (const button of $$("[data-edit-integration]")) {
    button.onclick = () => {
      const item = integrations.find((entry) => entry.id === button.dataset.editIntegration);
      if (!item) return;
      const form = $("#integration-form");
      form.reset();
      form.elements.id.value = item.id;
      form.elements.provider.value = item.provider;
      form.elements.name.value = item.name;
      form.elements.config.value = "";
      renderIntegrationFields(item.provider, definitionDefaults(integrationTemplate(item.provider)), true);
      form.elements.active.checked = Boolean(item.active);
      form.dataset.configTested = "true";
      $("#save-integration").disabled = false;
      $("#integration-status").textContent = "Editando API existente. Los secretos vacios se conservan; si cambias credenciales, prueba antes de guardar.";
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      notify("API cargada para editar", "info", item.name);
    };
  }

  for (const button of $$("[data-test-integration]")) {
    button.onclick = async () => {
      const item = integrations.find((entry) => entry.id === button.dataset.testIntegration);
      if (!item) return;
      setButtonBusy(button, true, "Probando...");
      $("#integration-status").textContent = `Probando conexion de ${item.name}...`;
      try {
        const result = await api(`/api/integrations/${encodeURIComponent(item.id)}/test`, { method: "POST" });
        $("#integration-status").textContent = result.message || "Prueba finalizada.";
        await refresh();
        notify(result.ok ? "Conexion probada correctamente" : "La prueba no fue correcta", result.ok ? "ok" : "warning", result.message || item.name);
      } catch (error) {
        $("#integration-status").textContent = error.message || "No se pudo probar la API.";
        notify("No se pudo probar la API", "error", error.message);
      } finally {
        setButtonBusy(button, false);
      }
    };
  }

  for (const button of $$("[data-delete-integration]")) {
    button.onclick = async () => {
      const item = integrations.find((entry) => entry.id === button.dataset.deleteIntegration);
      if (!item || !confirm(`Eliminar la API "${item.name}"?`)) return;
      setButtonBusy(button, true, "Eliminando...");
      $("#integration-status").textContent = `Eliminando ${item.name}...`;
      try {
        await api(`/api/integrations/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        $("#integration-status").textContent = "API eliminada correctamente.";
        await refresh();
        notify("API eliminada correctamente", "ok", item.name);
      } catch (error) {
        $("#integration-status").textContent = error.message || "No se pudo eliminar la API.";
        notify("No se pudo eliminar la API", "error", error.message);
      } finally {
        setButtonBusy(button, false);
      }
    };
  }
}

function renderRoleMatrix() {
  $("#role-matrix").innerHTML = Object.entries(roleCatalog)
    .map(([role, permissions]) => `
      <article class="card">
        <strong>${esc(role)}</strong>
        ${permissions.map((permission) => `<span class="tag">${esc(permission)}</span>`).join("")}
      </article>
    `)
    .join("");
}

function renderUsers() {
  const select = $("#user-agent-select");
  select.innerHTML = `<option value="">Sin agente asociado</option>` + state.data.agents
    .map((agent) => `<option value="${esc(agent.id)}">${esc(agent.name)} - ${esc(agent.role)}</option>`)
    .join("");

  $("#users-list").innerHTML = state.users
    .map((user) => {
      const agent = state.data.agents.find((item) => item.id === user.agentId);
      return `
        <article class="card">
          <strong>${esc(user.name)}</strong>
          <p>${esc(user.email)}</p>
          <p class="meta">${esc(user.role)} - ${user.isActive ? "activo" : "inactivo"}${agent ? ` - ${esc(agent.name)}` : ""}</p>
          <div class="row-actions">
            <button data-edit-user="${esc(user.id)}">Editar</button>
          </div>
        </article>
      `;
    })
    .join("") || `<article class="card"><p class="meta">Sin usuarios visibles.</p></article>`;

  for (const button of $$("[data-edit-user]")) {
    button.onclick = () => {
      const user = state.users.find((item) => item.id === button.dataset.editUser);
      if (!user) return;
      const form = $("#user-form");
      form.reset();
      form.elements.id.value = user.id;
      form.elements.name.value = user.name;
      form.elements.email.value = user.email;
      form.elements.role.value = user.role;
      form.elements.agentId.value = user.agentId || "";
      form.elements.isActive.checked = Boolean(user.isActive);
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }
}

function applyRoleUi() {
  $("#active-role").value = state.role;
  $("#active-role").disabled = true;
  const canAdmin = roleCan("faqs") || roleCan("branches") || roleCan("directoryContacts") || roleCan("agents") || roleCan("routingRules");
  for (const form of $$("[data-editor]")) {
    const collection = form.dataset.editor;
    const allowed = roleCan(collection);
    form.classList.toggle("is-disabled", !allowed);
    for (const control of $$("input, select, textarea, button").filter((item) => form.contains(item))) {
      control.disabled = !allowed;
    }
  }
  const integrationsAllowed = state.role === "admin" || roleCan("integrations");
  $("#integration-form").classList.toggle("is-disabled", !integrationsAllowed);
  for (const control of $$("input, select, textarea, button").filter((item) => $("#integration-form").contains(item))) {
    control.disabled = !integrationsAllowed;
  }
  const usersAllowed = state.role === "admin";
  $("#user-form").classList.toggle("is-disabled", !usersAllowed);
  for (const control of $$("input, select, textarea, button").filter((item) => $("#user-form").contains(item))) {
    control.disabled = !usersAllowed;
  }
  for (const button of $$("[data-delete], [data-edit]")) {
    const collection = button.dataset.delete || button.dataset.edit;
    button.disabled = !roleCan(collection);
  }
  for (const button of $$("[data-conversation-action], [data-quick-conversation-action]")) button.disabled = !roleCan("conversation");
  $("#agent-reply").disabled = !roleCan("conversation");
  $("#agent-reply-form button").disabled = !roleCan("conversation");
  document.body.classList.toggle("limited-role", !canAdmin);
}

function render() {
  renderDashboard();
  renderConversations();
  renderAdminCollections();
  renderIntegrations();
  renderRoleMatrix();
  renderUsers();
  renderChatbotSettings();
  applyRoleUi();
}

function renderChatbotSettings() {
  const form = $("#chatbot-settings-form");
  if (!form || !state.data) return;
  const settings = state.data.settings?.chatbot || {};
  const widget = settings.widget || {};
  form.elements.prompt.value = settings.prompt || "";
  form.elements.temperature.value = settings.temperature ?? 0.3;
  const defaults = {
    headerColor: "#1f2a37",
    accentColor: "#f5b301",
    botBubbleColor: "#e8f5f3",
    userBubbleColor: "#1f2a37",
    positionHorizontal: "right",
    positionVertical: "bottom"
  };
  for (const key of ["title", "subtitle", "buttonLabel", "welcome", "headerColor", "accentColor", "botBubbleColor", "userBubbleColor", "positionHorizontal", "positionVertical"]) {
    if (form.elements[key]) form.elements[key].value = widget[key] || defaults[key] || "";
  }
  updateWidgetEmbedCode();
  updateWidgetPreview();
}

function widgetEmbedCode() {
  const origin = window.location.origin;
  return `<script src="${origin}/widget.js" data-hwhub-api="${origin}" data-channel="official_site" async></script>`;
}

function updateWidgetEmbedCode() {
  const output = $("#widget-embed-code");
  if (!output) return;
  output.value = widgetEmbedCode();
}

function updateWidgetPreview() {
  const form = $("#chatbot-settings-form");
  const preview = $("#chatbot-widget-preview");
  if (!form || !preview) return;
  const values = {
    title: form.elements.title.value || "Honey Whale",
    subtitle: form.elements.subtitle.value || "Atencion por chatbot y agentes",
    buttonLabel: form.elements.buttonLabel.value || "Chat",
    welcome: form.elements.welcome.value || "Hola, en que puedo ayudarte?",
    headerColor: form.elements.headerColor.value || "#1f2a37",
    accentColor: form.elements.accentColor.value || "#f5b301",
    botBubbleColor: form.elements.botBubbleColor.value || "#e8f5f3",
    userBubbleColor: form.elements.userBubbleColor.value || "#1f2a37"
  };
  for (const key of ["title", "subtitle", "buttonLabel", "welcome"]) {
    const target = preview.querySelector(`[data-preview="${key}"]`);
    if (target) target.textContent = values[key];
  }
  const header = preview.querySelector(".widget-preview-header");
  const botBubble = preview.querySelector(".preview-message.bot");
  const userBubble = preview.querySelector(".preview-message.user");
  const button = preview.querySelector(".widget-preview-button");
  if (header) header.style.background = values.headerColor;
  if (botBubble) botBubble.style.background = values.botBubbleColor;
  if (userBubble) userBubble.style.background = values.userBubbleColor;
  if (button) button.style.background = values.accentColor;
}

async function refresh() {
  await loadBootstrap();
  await loadUsers();
  render();
}

function showView(view) {
  const selected = view || "dashboard";
  for (const section of $$("[data-view]")) section.classList.toggle("active", section.dataset.view === selected);
  for (const link of $$("[data-view-link]")) link.classList.toggle("active", link.dataset.viewLink === selected);
  const meta = viewMeta[selected] || viewMeta.dashboard;
  const eyebrow = $("#topbar-eyebrow");
  const title = $("#topbar-title");
  const subtitle = $("#topbar-subtitle");
  if (eyebrow) eyebrow.textContent = meta.eyebrow;
  if (title) title.textContent = meta.title;
  if (subtitle) subtitle.textContent = meta.subtitle;
}

function bindStaticEvents() {
  for (const link of $$("[data-view-link]")) link.addEventListener("click", () => showView(link.dataset.viewLink));
  showView(window.location.hash.replace("#", "") || "dashboard");
  const themeToggle = $("#theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      setTheme(themeToggle.checked ? "dark" : "light");
      notify(themeToggle.checked ? "Tema oscuro activo" : "Tema claro activo", "info");
    });
    setTheme(localStorage.getItem(themeStorageKey) || "light", false);
  }

  $("#chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    setButtonBusy(button, true, "Probando...");
    try {
      await sendChat($("#message").value, $("#channel").value);
      await refresh();
      notify("Prueba de ruteo ejecutada", "ok");
    } catch (error) {
      notify("No se pudo probar el ruteo", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  $("#chatbot-settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("#chatbot-settings-status");
    const button = form.querySelector("button");
    const payload = {
      prompt: form.elements.prompt.value,
      temperature: Number(form.elements.temperature.value || 0.3),
      widget: {
        title: form.elements.title.value,
        subtitle: form.elements.subtitle.value,
        buttonLabel: form.elements.buttonLabel.value,
        welcome: form.elements.welcome.value,
        headerColor: form.elements.headerColor.value,
        accentColor: form.elements.accentColor.value,
        botBubbleColor: form.elements.botBubbleColor.value,
        userBubbleColor: form.elements.userBubbleColor.value,
        positionHorizontal: form.elements.positionHorizontal.value,
        positionVertical: form.elements.positionVertical.value
      }
    };
    status.textContent = "Guardando...";
    setButtonBusy(button, true, "Guardando...");
    try {
      await api("/api/settings/chatbot", { method: "POST", body: JSON.stringify(payload) });
      status.textContent = "Configuracion guardada. El codigo del widget no cambia; el widget lee estos ajustes desde WhaleHub.";
      notify("Configuracion del chatbot guardada", "ok");
      await refresh();
    } catch (error) {
      status.textContent = error.message || "No se pudo guardar la configuracion.";
      notify("No se pudo guardar el chatbot", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  $("#chatbot-settings-form").addEventListener("input", updateWidgetPreview);
  $("#chatbot-settings-form").addEventListener("change", updateWidgetPreview);
  $("#simulate-whatsapp").addEventListener("click", async () => {
    const button = $("#simulate-whatsapp");
    setButtonBusy(button, true, "Simulando...");
    $("#channel").value = "whatsapp_cloud";
    $("#message").value = "Quiero informacion de ventas mayoristas";
    try {
      await sendChat($("#message").value, $("#channel").value);
      await refresh();
      notify("Simulacion WhatsApp ejecutada", "ok");
    } catch (error) {
      notify("No se pudo simular WhatsApp", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  $("#simulate-marketplace").addEventListener("click", async () => {
    const button = $("#simulate-marketplace");
    setButtonBusy(button, true, "Simulando...");
    $("#channel").value = "whatsapp_cloud";
    $("#message").value = "Necesito ayuda con mi compra de Amazon";
    try {
      await sendChat($("#message").value, $("#channel").value);
      await refresh();
      notify("Simulacion marketplace ejecutada", "ok");
    } catch (error) {
      notify("No se pudo simular marketplace", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  $("#faq-search").addEventListener("input", (event) => renderFaqs(event.target.value));
  $("#branch-state-filter").addEventListener("change", (event) => {
    filters.branchState = event.target.value;
    renderBranches();
    applyRoleUi();
  });
  $("#branch-search").addEventListener("input", (event) => {
    filters.branchSearch = event.target.value;
    renderBranches();
    applyRoleUi();
  });
  $("#clear-branch-filters").addEventListener("click", () => {
    filters.branchState = "";
    filters.branchSearch = "";
    $("#branch-state-filter").value = "";
    $("#branch-search").value = "";
    renderBranches();
    applyRoleUi();
    notify("Filtros de sucursales limpiados", "info");
  });
  $("#directory-area-filter").addEventListener("change", (event) => {
    filters.directoryArea = event.target.value;
    renderDirectoryContacts();
    applyRoleUi();
  });
  $("#directory-search").addEventListener("input", (event) => {
    filters.directorySearch = event.target.value;
    renderDirectoryContacts();
    applyRoleUi();
  });
  $("#clear-directory-filters").addEventListener("click", () => {
    filters.directoryArea = "";
    filters.directorySearch = "";
    $("#directory-area-filter").value = "";
    $("#directory-search").value = "";
    renderDirectoryContacts();
    applyRoleUi();
    notify("Filtros de directorio limpiados", "info");
  });
  $("#copy-widget-code").addEventListener("click", async () => {
    const output = $("#widget-embed-code");
    const status = $("#widget-code-status");
    const button = $("#copy-widget-code");
    updateWidgetEmbedCode();
    setButtonBusy(button, true, "Copiando...");
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = "Codigo copiado.";
      notify("Codigo del widget copiado", "ok");
    } catch {
      output.select();
      document.execCommand("copy");
      status.textContent = "Codigo seleccionado para copiar.";
      notify("Codigo seleccionado para copiar", "info");
    } finally {
      setButtonBusy(button, false);
    }
  });
  $("#logout-button").addEventListener("click", async () => {
    const button = $("#logout-button");
    setButtonBusy(button, true, "Saliendo...");
    try {
      await logout();
      window.location.hash = "#dashboard";
      setAuthenticatedUi(false);
      notify("Sesion cerrada", "info");
    } catch (error) {
      notify("No se pudo cerrar sesion", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  const integrationProvider = $("#integration-form").elements.provider;
  integrationProvider.addEventListener("change", () => {
    const definition = integrationTemplate(integrationProvider.value);
    const form = $("#integration-form");
    if (!form.elements.name.value) form.elements.name.value = definition.name;
    renderIntegrationFields(integrationProvider.value, definitionDefaults(definition));
    $("#integration-status").textContent = "Completa los campos y prueba la conexion antes de guardar.";
  });
  $("#integration-fields").addEventListener("input", () => {
    $("#integration-form").dataset.configTested = "false";
    $("#save-integration").disabled = true;
    $("#integration-status").textContent = "Cambios pendientes. Prueba la conexion antes de guardar.";
  });
  $("#integration-fields").addEventListener("change", () => {
    $("#integration-form").dataset.configTested = "false";
    $("#save-integration").disabled = true;
  });
  $("#test-integration-draft").addEventListener("click", async () => {
    const form = $("#integration-form");
    const status = $("#integration-status");
    const button = $("#test-integration-draft");
    const { config, errors } = syncIntegrationConfig();
    if (errors.length) {
      status.textContent = errors.join(" ");
      notify("Completa los campos requeridos", "warning", errors.join(" "));
      return;
    }
    setButtonBusy(button, true, "Probando...");
    status.textContent = "Probando conexion...";
    try {
      const result = await api("/api/integrations/test", {
        method: "POST",
        body: JSON.stringify({
          provider: form.elements.provider.value,
          name: form.elements.name.value || integrationTemplate(form.elements.provider.value).name,
          config
        })
      });
      form.dataset.configTested = result.ok ? "true" : "false";
      $("#save-integration").disabled = !result.ok;
      status.textContent = result.message || "Prueba finalizada.";
      notify(result.ok ? "Conexion probada correctamente" : "La prueba no fue correcta", result.ok ? "ok" : "warning", result.message || "");
    } catch (error) {
      form.dataset.configTested = "false";
      $("#save-integration").disabled = true;
      status.textContent = error.message || "No se pudo probar la conexion.";
      notify("No se pudo probar la conexion", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
  renderIntegrationFields(integrationProvider.value, definitionDefaults(integrationTemplate(integrationProvider.value)));
  bindEditors();
  bindConversationActions();
  bindConversationFilters();
  bindIntegrations();
  bindUsers();
  bindRoleLab();
  bindDashboardShortcuts();
}

function bindUsers() {
  $("#user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const payload = formPayload(event.currentTarget);
    if (!payload.password) delete payload.password;
    setButtonBusy(button, true, "Guardando...");
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      await refresh();
      notify("Usuario guardado correctamente", "ok");
    } catch (error) {
      notify("No se pudo guardar el usuario", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
}

function bindAuth() {
  $("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    $("#login-error").textContent = "";
    const data = new FormData(event.currentTarget);
    try {
      await login(data.get("email"), data.get("password"));
      await startApp();
    } catch (error) {
      $("#login-error").textContent = error.message || "Email o password incorrectos.";
    }
  };
}

function bindDashboardShortcuts() {
  for (const button of $$("[data-status-shortcut]")) {
    button.addEventListener("click", () => {
      showView("conversations");
      history.replaceState(null, "", "#conversations");
      filters.status = button.dataset.statusShortcut;
      filters.channel = "";
      filters.priority = "";
      filters.slaState = "";
      filters.search = "";
      $("#conversation-status-filter").value = filters.status;
      $("#conversation-channel-filter").value = "";
      $("#conversation-priority-filter").value = "";
      $("#conversation-search").value = "";
      render();
      notify("Filtro aplicado en conversaciones", "info", statusLabel(filters.status));
    });
  }
  for (const button of $$("[data-priority-shortcut]")) {
    button.addEventListener("click", () => {
      showView("conversations");
      history.replaceState(null, "", "#conversations");
      filters.status = "";
      filters.channel = "";
      filters.priority = button.dataset.priorityShortcut;
      filters.slaState = "";
      filters.search = "";
      $("#conversation-status-filter").value = "";
      $("#conversation-channel-filter").value = "";
      $("#conversation-priority-filter").value = filters.priority;
      $("#conversation-search").value = "";
      render();
      notify("Filtro aplicado en conversaciones", "info", `Prioridad ${priorityLabel(filters.priority)}`);
    });
  }
  for (const button of $$("[data-sla-shortcut]")) {
    button.addEventListener("click", () => {
      showView("conversations");
      history.replaceState(null, "", "#conversations");
      filters.status = "";
      filters.channel = "";
      filters.priority = "";
      filters.slaState = button.dataset.slaShortcut;
      filters.search = "";
      $("#conversation-status-filter").value = "";
      $("#conversation-channel-filter").value = "";
      $("#conversation-priority-filter").value = "";
      $("#conversation-search").value = "";
      render();
      notify("Filtro aplicado en conversaciones", "info", "Alertas de SLA");
    });
  }
}

function bindConversationFilters() {
  $("#conversation-status-filter").addEventListener("change", (event) => {
    filters.status = event.target.value;
    render();
  });
  $("#conversation-channel-filter").addEventListener("change", (event) => {
    filters.channel = event.target.value;
    render();
  });
  $("#conversation-priority-filter").addEventListener("change", (event) => {
    filters.priority = event.target.value;
    filters.slaState = "";
    render();
  });
  $("#conversation-search").addEventListener("input", (event) => {
    filters.search = event.target.value;
    render();
  });
  $("#clear-conversation-filters").addEventListener("click", () => {
    filters.status = "";
    filters.channel = "";
    filters.priority = "";
    filters.slaState = "";
    filters.search = "";
    $("#conversation-status-filter").value = "";
    $("#conversation-channel-filter").value = "";
    $("#conversation-priority-filter").value = "";
    $("#conversation-search").value = "";
    render();
    notify("Filtros de conversaciones limpiados", "info");
  });
}

function priorityLabel(priority) {
  return {
    urgent: "Urgente",
    high: "Alta",
    normal: "Normal"
  }[priority] || "Normal";
}

const conversationActionLabels = {
  take: {
    busy: "Tomando...",
    done: "Chat tomado. El bot queda detenido y la conversacion pasa a agente.",
    button: "Tomar chat"
  },
  pause: {
    busy: "Pausando...",
    done: "Bot pausado. No respondera en automatico hasta reactivarlo.",
    button: "Pausar bot"
  },
  bot: {
    busy: "Activando...",
    done: "Bot activado. La conversacion vuelve a respuestas automaticas.",
    button: "Activar bot"
  },
  close: {
    busy: "Cerrando...",
    done: "Chat cerrado correctamente.",
    button: "Cerrar chat"
  }
};

function setConversationActionStatus(message = "", type = "info") {
  const note = $("#conversation-action-status");
  if (!note) return;
  note.textContent = message;
  note.className = `action-feedback ${message ? `is-${type}` : ""}`;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""), location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderInlineRichText(value = "") {
  const source = String(value || "");
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  const parts = [];
  let lastIndex = 0;
  for (const match of source.matchAll(urlPattern)) {
    const raw = match[0].replace(/[),.;]+$/, "");
    parts.push(esc(source.slice(lastIndex, match.index)));
    const href = safeExternalUrl(raw);
    parts.push(href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(new URL(href).hostname.replace(/^www\./, ""))}</a>` : esc(raw));
    lastIndex = (match.index || 0) + match[0].length;
  }
  parts.push(esc(source.slice(lastIndex)));
  return parts.join("").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function renderRichText(value = "") {
  const lines = String(value || "").split(/\r?\n/);
  const html = [];
  let listOpen = false;
  const closeList = () => {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      html.push(`<div class="message-gap"></div>`);
      continue;
    }
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        html.push(`<ul class="message-list-content">`);
        listOpen = true;
      }
      html.push(`<li>${renderInlineRichText(bullet[1])}</li>`);
      continue;
    }
    closeList();
    const isHeading = /^\*\*[^*]+\*\*$/.test(line);
    html.push(`<p${isHeading ? ` class="message-heading"` : ""}>${renderInlineRichText(line)}</p>`);
  }
  closeList();
  return html.join("");
}

function renderMessageRichContent(blocks = []) {
  if (!Array.isArray(blocks) || !blocks.length) return "";
  return blocks.map((block) => {
    if (block.type === "products") {
      return `
        <section class="rich-block">
          <strong>${esc(block.title || "Productos")}</strong>
          <div class="product-list">
            ${(block.items || []).map((item) => {
              const productUrl = safeExternalUrl(item.url);
              const imageUrl = safeExternalUrl(item.image);
              return `
                <article class="product-card">
                  ${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(item.imageAlt || item.title || "Producto")}" loading="lazy">` : `<div class="product-empty">HW</div>`}
                  <div>
                    <h4>${esc(item.title)}</h4>
                    ${item.price ? `<p class="product-price">${esc(item.price)}</p>` : ""}
                    ${item.regularPrice ? `<p class="product-regular">${esc(item.regularPrice)}</p>` : ""}
                    ${item.stock ? `<p class="product-stock">${esc(item.stock)}</p>` : ""}
                    ${productUrl ? `<a class="rich-link" href="${esc(productUrl)}" target="_blank" rel="noopener noreferrer">Ver producto</a>` : ""}
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }
    if (block.type === "links") {
      return `
        <section class="rich-block">
          <strong>${esc(block.title || "Enlaces")}</strong>
          <div class="link-list">
            ${(block.items || []).map((item) => {
              const url = safeExternalUrl(item.url);
              return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || item.url)}</a>` : "";
            }).join("")}
          </div>
        </section>
      `;
    }
    return "";
  }).join("");
}

function renderThreadMessages(messages = [], conversationId = "") {
  if (!messages.length) {
    return `<article class="wh-empty-state"><strong>Sin mensajes</strong><p>Esta conversacion todavia no tiene mensajes registrados.</p></article>`;
  }
  let currentDay = "";
  const html = [];
  for (const message of messages) {
    const nextDay = dayLabel(message.createdAt);
    if (nextDay && nextDay !== currentDay) {
      currentDay = nextDay;
      html.push(`<div class="daysep">${esc(nextDay)}</div>`);
    }
    const type = message.senderType === "customer" ? "them" : message.senderType === "bot" ? "bot" : message.senderType === "system" ? "system" : "me";
    const senderLabel = {
      customer: "Cliente",
      bot: "WhaleBot",
      agent: "Agente",
      system: "Sistema"
    }[message.senderType] || message.senderType;
    html.push(`
      <div class="message ${esc(message.senderType)} msg ${esc(type)}">
        ${message.senderType === "bot" ? `<span class="wh-bot-flag">WhaleBot - automatico</span>` : ""}
        <div class="message-body">${renderRichText(message.body)}</div>
        ${renderMessageRichContent(message.metadata?.richContent)}
        <small>${esc(senderLabel)} - ${esc(formatMessageTime(message.createdAt))}</small>
      </div>
    `);
  }
  if (state.typing[conversationId]?.bot) html.push(`<div class="message bot msg bot typing"><p>Bot escribiendo...</p></div>`);
  if (state.typing[conversationId]?.agent) html.push(`<div class="message agent msg me typing"><p>Agente escribiendo...</p></div>`);
  return `<div class="message-list wh-thread-messages">${html.join("")}</div>`;
}

function renderConversationContext(data, currentAgent) {
  const conversation = data.conversation;
  const profile = conversation.metadata?.customerProfile || {};
  const wooVerified = profile.wooCustomerId && profile.wooCustomerToken;
  const events = data.events || [];
  const lastRichProducts = [...(data.messages || [])]
    .reverse()
    .flatMap((message) => message.metadata?.richContent || [])
    .find((block) => block.type === "products");
  return `
    <section class="wh-context-section">
      <p class="eyebrow">Identidad</p>
      <div class="wh-kv">
        <span>Cliente</span><strong>${esc(conversation.customer || "Visitante")}</strong>
        <span>Telefono</span><strong>${esc(conversation.customerPhone || profile.phone || "No registrado")}</strong>
        <span>Email</span><strong>${esc(profile.email || "No registrado")}</strong>
        <span>Canal</span><strong>${esc(channelLabel(conversation.channel))}</strong>
        <span>Login Woo</span><strong>${wooVerified ? "Verificado" : "Sin verificar"}</strong>
      </div>
    </section>
    <section class="wh-context-section">
      <p class="eyebrow">Operacion</p>
      <div class="wh-kv">
        <span>Estado</span><strong>${esc(statusLabel(conversation.status))}</strong>
        <span>Agente</span><strong>${currentAgent ? esc(currentAgent.name) : "Sin asignar"}</strong>
        <span>Intencion</span><strong>${esc(conversation.intent || "Sin intencion")}</strong>
        <span>Marketplace</span><strong>${esc(conversation.marketplace || "official")}</strong>
        <span>SLA</span><strong>${esc(conversation.slaState || "ok")} - ${esc(conversation.waitingMinutes || 0)} min</strong>
      </div>
    </section>
    <section class="wh-context-section">
      <p class="eyebrow">Pedido WooCommerce</p>
      ${profile.orderNumber ? `
        <article class="wh-order-card">
          <strong>#${esc(profile.orderNumber)}</strong>
          <span class="wh-conv-tag">${esc(profile.appointmentStart ? "Con cita" : "Referencia cliente")}</span>
          <p>Contexto tomado del perfil de conversacion.</p>
        </article>
      ` : `
        <article class="wh-empty-state compact">
          <strong>Sin pedido vinculado</strong>
          <p>TODO(backend): GET /api/conversations/:id/context para perfil + ultimo pedido Woo via HMAC.</p>
        </article>
      `}
      ${lastRichProducts ? renderMessageRichContent([lastRichProducts]) : ""}
    </section>
    <section class="wh-context-section">
      <p class="eyebrow">Sugerencia IA</p>
      <article class="wh-empty-state compact">
        <strong>Proximamente</strong>
        <p>TODO(backend): POST /api/conversations/:id/suggest para generar una respuesta sin enviarla.</p>
      </article>
    </section>
    <section class="wh-context-section">
      <p class="eyebrow">Actividad</p>
      <div class="timeline">
        ${events.slice(-8).map((event) => `
          <article class="timeline-event">
            <strong>${esc(event.body)}</strong>
            <p class="meta">${esc(event.eventType)} - ${esc(event.actorType)}</p>
            <p class="meta">${new Date(event.createdAt).toLocaleString()}</p>
          </article>
        `).join("") || `<article class="timeline-event"><p class="meta">Sin eventos registrados.</p></article>`}
      </div>
    </section>
  `;
}

function renderConversationDetailData(data) {
  if (!data?.conversation) return;
  const currentAgent = state.data.agents.find((agent) => agent.id === data.conversation.assignedAgentId);
  const heading = $("#conversation-thread-heading");
  if (heading) {
    heading.innerHTML = `
      <p class="eyebrow">${esc(channelLabel(data.conversation.channel))}</p>
      <h2>${esc(data.conversation.customer || "Cliente")}</h2>
      <p class="section-note">${esc(data.conversation.customerPhone || "Sin telefono")} - ${esc(data.conversation.intent || "sin intencion")} - ${currentAgent ? `Agente: ${esc(currentAgent.name)}` : "sin agente"}</p>
    `;
  }
  $("#conversation-status").textContent = statusLabel(data.conversation.status);
  $("#conversation-status").className = `status ${data.conversation.status}`;
  $("#conversation-detail").className = "wh-thread-body";
  $("#conversation-detail").innerHTML = renderThreadMessages(data.messages, id);
  const contextPanel = $("#conversation-context-panel");
  if (contextPanel) contextPanel.innerHTML = renderConversationContext(data, currentAgent);
  renderConversations();
  const threadMessageList = $("#conversation-detail .message-list");
  if (threadMessageList) threadMessageList.scrollTop = threadMessageList.scrollHeight;
  applyConversationActionAvailability(data.conversation.status);
}

async function openConversation(id) {
  state.selectedConversationId = id;
  state.unread[id] = 0;
  setConversationActionStatus();
  const data = await api(`/api/conversations/${id}`);
  cacheConversationDetail(data);
  renderConversationDetailData(data);
}

function applyConversationActionAvailability(status) {
  const activeActionByStatus = {
    bot_active: "bot",
    paused: "pause",
    agent_active: "take",
    closed: "close"
  };
  const activeAction = activeActionByStatus[status];
  for (const button of $$("[data-conversation-action]")) {
    button.classList.toggle("is-active-action", button.dataset.conversationAction === activeAction);
  }
}

function bindConversationActions() {
  for (const button of $$("[data-conversation-action]")) {
    button.addEventListener("click", async () => {
      if (!state.selectedConversationId) {
        setConversationActionStatus("Selecciona una conversacion antes de aplicar acciones.", "warning");
        notify("Selecciona una conversacion", "warning");
        return;
      }
      const action = button.dataset.conversationAction;
      const labels = conversationActionLabels[action] || { busy: "Aplicando...", done: "Accion aplicada.", button: button.textContent };
      const previousText = button.textContent;
      for (const item of $$("[data-conversation-action]")) item.disabled = true;
      button.textContent = labels.busy;
      button.classList.add("is-loading");
      setConversationActionStatus(labels.busy, "info");
      try {
        const updated = await api(`/api/conversations/${state.selectedConversationId}/${action}`, { method: "POST" });
        upsertConversation(updated);
        $("#conversation-status").textContent = statusLabel(updated.status);
        $("#conversation-status").className = `status ${updated.status}`;
        applyConversationActionAvailability(updated.status);
        setConversationActionStatus(labels.done, "ok");
        renderConversationFrame();
        await openConversation(state.selectedConversationId);
        setConversationActionStatus(labels.done, "ok");
        notify(labels.done, "ok");
      } catch (error) {
        setConversationActionStatus(error.message || "No se pudo aplicar la accion.", "error");
        notify("No se pudo aplicar la accion", "error", error.message);
      } finally {
        button.textContent = labels.button || previousText;
        button.classList.remove("is-loading");
        for (const item of $$("[data-conversation-action]")) item.disabled = !roleCan("conversation");
      }
    });
  }
  for (const button of $$("[data-quick-reply]")) {
    button.addEventListener("click", () => {
      const input = $("#agent-reply");
      if (!input || input.disabled) return;
      input.value = button.dataset.quickReply || "";
      input.focus();
      input.dispatchEvent(new Event("input"));
      notify("Respuesta rapida insertada", "info");
    });
  }
  $("#agent-reply")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  });
  $("#agent-reply-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedConversationId) return;
    const button = event.currentTarget.querySelector("button");
    const input = $("#agent-reply");
    const body = input.value.trim();
    if (!body) return;
    setButtonBusy(button, true, "Enviando...");
    const conversationId = state.selectedConversationId;
    const optimisticMessage = {
      id: `tmp-${Date.now()}`,
      conversationId,
      senderType: "agent",
      senderId: state.user?.agentId || state.user?.id || null,
      body,
      metadata: { optimistic: true },
      createdAt: new Date().toISOString()
    };
    cacheMessage(optimisticMessage);
    input.value = "";
    if (state.conversationDetails[conversationId]) {
      $("#conversation-detail").innerHTML = renderThreadMessages(state.conversationDetails[conversationId].messages, conversationId);
      const threadMessageList = $("#conversation-detail .message-list");
      if (threadMessageList) threadMessageList.scrollTop = threadMessageList.scrollHeight;
    }
    renderConversationFrame();
    try {
      const message = await api(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ senderType: "agent", body })
      });
      const detail = state.conversationDetails[conversationId];
      if (detail?.messages) {
        detail.messages = detail.messages.filter((item) => item.id !== optimisticMessage.id);
      }
      cacheMessage(message);
      await openConversation(conversationId);
      notify("Mensaje enviado", "ok");
    } catch (error) {
      const detail = state.conversationDetails[conversationId];
      if (detail?.messages) detail.messages = detail.messages.filter((item) => item.id !== optimisticMessage.id);
      input.value = body;
      if (conversationId === state.selectedConversationId) await openConversation(conversationId);
      notify("No se pudo enviar el mensaje", "error", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });
}

async function sendChat(message, channel = "web_widget") {
  $("#chat-result").innerHTML = `<p class="meta">Probando chatbot...</p>`;
  const data = await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, channel, customer: "Cliente demo" })
  });
  $("#chat-result").innerHTML = `
    <strong>Respuesta:</strong> ${esc(data.reply)}
    <p class="meta">Conversacion: ${esc(data.conversation.id)}</p>
    <p class="meta">Canal: ${esc(data.conversation.channel)} - Intencion: ${esc(data.conversation.intent)} - Marketplace: ${esc(data.conversation.marketplace)}</p>
    <p class="meta">Estado: ${statusLabel(data.conversation.status)} - Agente: ${data.assignedAgent?.name || "sin asignar"}</p>
    <p class="meta">IA: ${esc(data.ai?.provider || "rules")}${data.ai?.model ? ` - ${esc(data.ai.model)}` : ""}</p>
    <p class="meta">APIs: productos ${esc(data.connectors?.products?.total || 0)} - servicios agenda ${esc(data.connectors?.appointments?.total || 0)}</p>
    ${(data.connectors?.errors || []).map((error) => `<p class="meta">API ${esc(error.provider)}: ${esc(error.message)}</p>`).join("")}
    ${data.ai?.error ? `<p class="meta">Error IA: ${esc(data.ai.error)}</p>` : ""}
  `;
  return data;
}

function bindEditors() {
  const collectionLabels = {
    agents: "Agente",
    faqs: "FAQ",
    branches: "Sucursal",
    directoryContacts: "Contacto",
    routingRules: "Regla de ruteo"
  };
  for (const form of $$(".editor[data-editor]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const collection = form.dataset.editor;
      const note = collection === "agents" ? $("#agent-presence-note") : null;
      const button = form.querySelector("button");
      const payload = formPayload(form);
      if (collection === "branches" && !payload.hours) {
        payload.hours = [
          payload.weekdayHours ? `Lun-Vie ${payload.weekdayHours}` : "",
          payload.saturdayHours ? `Sab ${payload.saturdayHours}` : "",
          payload.sundayHours ? `Dom ${payload.sundayHours}` : ""
        ].filter(Boolean).join("; ");
      }
      const id = payload.id;
      delete payload.id;
      setButtonBusy(button, true, "Guardando...");
      try {
        await api(`/api/${collection}${id ? `/${id}` : ""}`, {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(payload)
        });
        form.reset();
        if (collection === "agents") {
          if (form.elements.online) form.elements.online.disabled = false;
          if (note) note.textContent = "Agente guardado correctamente.";
        }
        await refresh();
        notify(`${collectionLabels[collection] || "Registro"} guardado correctamente`, "ok");
      } catch (error) {
        if (note) note.textContent = error.message || "No se pudo guardar el agente.";
        notify(`No se pudo guardar ${collectionLabels[collection] || "el registro"}`, "error", error.message);
      } finally {
        setButtonBusy(button, false);
      }
    });
  }
}

function bindRowActions() {
  for (const button of $$("[data-edit]")) {
    button.onclick = () => {
      const collection = button.dataset.edit;
      const item = state.data[collection].find((entry) => String(entry.id) === button.dataset.id);
      if (item) {
        fillForm(collection, item);
        notify("Datos cargados para editar", "info");
      }
    };
  }
  for (const button of $$("[data-delete]")) {
    button.onclick = async () => {
      setButtonBusy(button, true, "Eliminando...");
      try {
        await api(`/api/${button.dataset.delete}/${button.dataset.id}`, { method: "DELETE" });
        await refresh();
        notify("Registro eliminado correctamente", "ok");
      } catch (error) {
        notify("No se pudo eliminar el registro", "error", error.message);
      } finally {
        setButtonBusy(button, false);
      }
    };
  }
  for (const input of $$("[data-agent-presence]")) {
    input.onchange = async () => {
      const agent = state.data.agents.find((item) => item.id === input.dataset.agentPresence);
      if (!agent || agent.loginControlled) return;
      input.disabled = true;
      try {
        await api(`/api/agents/${encodeURIComponent(agent.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: agent.name,
            role: agent.role,
            skills: agent.skills,
            channels: agent.channels,
            online: input.checked,
            activeConversations: agent.activeConversations ?? 0,
            maxConversations: agent.maxConversations ?? 5
          })
        });
        await refresh();
        notify(input.checked ? "Agente activado" : "Agente desactivado", "ok", agent.name);
      } catch (error) {
        input.checked = !input.checked;
        notify("No se pudo cambiar el estado del agente", "error", error.message);
      } finally {
        input.disabled = false;
      }
    };
  }
}

function fillForm(collection, item) {
  const form = document.querySelector(`[data-editor="${collection}"]`);
  form.reset();
  for (const [key, value] of Object.entries(item)) {
    const input = form.elements[key];
    if (!input) continue;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = Array.isArray(value) ? value.join(", ") : value ?? "";
  }
  form.elements.id.value = item.id;
  if (collection === "agents") {
    const onlineInput = form.elements.online;
    const note = $("#agent-presence-note");
    if (onlineInput) onlineInput.disabled = Boolean(item.loginControlled);
    if (note) {
      note.textContent = item.loginControlled
        ? `Activo por sesion iniciada de ${item.linkedUser?.name || item.linkedUser?.email || "usuario vinculado"}. No se puede modificar manualmente hasta cerrar sesion.`
        : "Sin sesion activa vinculada: puedes activar o desactivar manualmente.";
    }
  }
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindIntegrations() {
  $("#integration-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $("#save-integration");
    const status = $("#integration-status");
    if (form.dataset.saving === "true") return;
    const { errors } = syncIntegrationConfig({ allowBlankSecrets: true });
    if (errors.length) {
      status.textContent = errors.join(" ");
      notify("Completa los campos requeridos", "warning", errors.join(" "));
      return;
    }
    if (form.dataset.configTested !== "true") {
      status.textContent = "Primero prueba la conexion correctamente antes de guardar.";
      notify("Primero prueba la conexion", "warning");
      return;
    }
    form.dataset.saving = "true";
    setButtonBusy(button, true, "Guardando...");
    status.textContent = "Guardando...";
    try {
      const payload = formPayload(form);
      await api("/api/integrations", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      renderIntegrationFields(form.elements.provider.value, definitionDefaults(integrationTemplate(form.elements.provider.value)));
      form.dataset.configTested = "false";
      status.textContent = "API guardada correctamente.";
      await refresh();
      notify("API guardada correctamente", "ok");
    } catch (error) {
      status.textContent = error.message || "No se pudo guardar la API.";
      notify("No se pudo guardar la API", "error", error.message);
    } finally {
      form.dataset.saving = "false";
      setButtonBusy(button, false);
      button.disabled = form.dataset.configTested !== "true";
    }
  });
}

function bindRoleLab() {
  $("#role-test-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    $("#role-test-result").innerHTML = `
      <article class="card">
        <strong>${esc(data.get("role"))}</strong>
        <p class="meta">Canal: ${esc(data.get("channel"))}</p>
        <p>Prueba lista para validar canalizacion con datos actuales.</p>
      </article>
    `;
    notify("Prueba de rol lista", "ok");
  });
}

function bindRealtime() {
  const events = new EventSource("/api/events");
  events.addEventListener("conversation.created", (event) => {
    const conversation = JSON.parse(event.data);
    state.alerts += 1;
    upsertConversation(conversation);
    renderConversationFrame();
    notify("Nueva conversacion", "info", `${conversation.customer || "Cliente"} - ${channelLabel(conversation.channel)}`);
  });
  events.addEventListener("conversation.updated", async (event) => {
    const conversation = JSON.parse(event.data);
    state.alerts += 1;
    upsertConversation(conversation);
    renderConversationFrame();
    if (conversation.id === state.selectedConversationId) await openConversation(conversation.id);
  });
  events.addEventListener("conversation.typing", async (event) => {
    const data = JSON.parse(event.data);
    state.typing[data.conversationId] ||= {};
    state.typing[data.conversationId][data.senderType] = Boolean(data.typing);
    if (data.conversationId === state.selectedConversationId) {
      const detail = state.conversationDetails[state.selectedConversationId];
      if (detail) renderConversationDetailData(detail);
    }
  });
  events.addEventListener("message.created", async (event) => {
    const message = JSON.parse(event.data);
    cacheMessage(message);
    if (message.senderType === "customer" && message.conversationId !== state.selectedConversationId) {
      state.unread[message.conversationId] = (state.unread[message.conversationId] || 0) + 1;
      state.alerts += 1;
      notify("Mensaje nuevo de cliente", "info", message.body || "");
    }
    renderConversationFrame();
    if (message.conversationId === state.selectedConversationId) {
      const detail = state.conversationDetails[state.selectedConversationId];
      if (detail) renderConversationDetailData(detail);
      else await openConversation(state.selectedConversationId);
    }
  });
  for (const eventName of ["integrations.updated", "integrations.deleted", "users.updated", "agents.updated"]) {
    events.addEventListener(eventName, async () => {
      await refresh();
    });
  }
}

let appStarted = false;

async function startApp() {
  setAuthenticatedUi(true);
  try {
    await loadBootstrap();
    await loadUsers();
  } catch (error) {
    await logout();
    setAuthenticatedUi(false);
    $("#login-error").textContent = error.message || "No se pudo cargar el dashboard.";
    return;
  }
  if (!appStarted) {
    bindStaticEvents();
    bindRealtime();
    appStarted = true;
  }
  render();
}

async function init() {
  bindAuth();
  setAuthenticatedUi(false);
  if (await loadSession()) await startApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init().catch(showInitError));
} else {
  init().catch(showInitError);
}

function showInitError() {
  setAuthenticatedUi(false);
  $("#login-error").textContent = "No se pudo iniciar la aplicacion.";
}
