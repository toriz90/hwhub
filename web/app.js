const state = {
  data: null,
  users: [],
  alerts: 0,
  selectedConversationId: null,
  role: "viewer",
  user: null,
  typing: {}
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
      { key: "consumerSecret", label: "Consumer secret", type: "password", required: true, placeholder: "cs_..." }
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
}

function renderConversations() {
  const appState = state.data;
  const conversations = appState.conversations.filter((item) => {
    const haystack = `${item.customer || ""} ${item.lastMessage || ""} ${item.intent || ""}`.toLowerCase();
    return (
      (!filters.status || item.status === filters.status) &&
      (!filters.channel || item.channel === filters.channel) &&
      (!filters.priority || item.priority === filters.priority) &&
      (!filters.slaState || item.slaState === filters.slaState || (filters.slaState === "at_risk" && item.slaState === "breached")) &&
      (!filters.search || haystack.includes(filters.search.toLowerCase()))
    );
  });

  $("#conversation-list").innerHTML = conversations
    .map((item) => {
      const agent = appState.agents.find((entry) => entry.id === item.assignedAgentId);
      return `
        <article class="item conversation-card ${state.selectedConversationId === item.id ? "selected" : ""}" data-open-conversation="${esc(item.id)}">
          <div class="conversation-card-head">
            <strong>${esc(item.customer)}</strong>
            <span>${item.waitingMinutes || 0} min</span>
          </div>
          <p>${esc(item.lastMessage)}</p>
          <p class="meta">${esc(item.channel)} - ${esc(item.intent || "sin intencion")} - ${agent ? esc(agent.name) : "sin agente"}</p>
          <span class="status ${esc(item.status)}">${statusLabel(item.status)}</span>
          <span class="priority ${esc(item.priority)}">${priorityLabel(item.priority)} · ${item.waitingMinutes || 0} min</span>
          <div class="row-actions">
            <button data-quick-conversation-action="take" data-id="${esc(item.id)}" title="Asignar a agente y detener respuestas automaticas">Tomar chat</button>
            <button data-quick-conversation-action="pause" data-id="${esc(item.id)}" title="Pausar respuestas automaticas">Pausar bot</button>
            <button data-quick-conversation-action="bot" data-id="${esc(item.id)}" title="Reactivar respuestas automaticas">Activar bot</button>
            <button data-quick-conversation-action="close" data-id="${esc(item.id)}" title="Cerrar la conversacion">Cerrar chat</button>
          </div>
        </article>
      `;
    })
    .join("") || `<article class="item"><p class="meta">No hay conversaciones con esos filtros.</p></article>`;

  for (const item of $$(".conversation-card")) {
    item.onclick = (event) => {
      if (event.target.closest("button")) return;
      openConversation(item.dataset.openConversation);
    };
  }
  for (const button of $$("[data-quick-conversation-action]")) {
    button.onclick = async () => {
      await api(`/api/conversations/${button.dataset.id}/${button.dataset.quickConversationAction}`, { method: "POST" });
      await refresh();
    };
  }
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
    };
  }

  for (const button of $$("[data-test-integration]")) {
    button.onclick = async () => {
      const item = integrations.find((entry) => entry.id === button.dataset.testIntegration);
      if (!item) return;
      button.disabled = true;
      button.textContent = "Probando...";
      $("#integration-status").textContent = `Probando conexion de ${item.name}...`;
      try {
        const result = await api(`/api/integrations/${encodeURIComponent(item.id)}/test`, { method: "POST" });
        $("#integration-status").textContent = result.message || "Prueba finalizada.";
        await refresh();
      } catch (error) {
        $("#integration-status").textContent = error.message || "No se pudo probar la API.";
      } finally {
        button.disabled = false;
        button.textContent = "Probar";
      }
    };
  }

  for (const button of $$("[data-delete-integration]")) {
    button.onclick = async () => {
      const item = integrations.find((entry) => entry.id === button.dataset.deleteIntegration);
      if (!item || !confirm(`Eliminar la API "${item.name}"?`)) return;
      button.disabled = true;
      $("#integration-status").textContent = `Eliminando ${item.name}...`;
      try {
        await api(`/api/integrations/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        $("#integration-status").textContent = "API eliminada correctamente.";
        await refresh();
      } catch (error) {
        $("#integration-status").textContent = error.message || "No se pudo eliminar la API.";
      } finally {
        button.disabled = false;
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
  const defaults = { positionHorizontal: "right", positionVertical: "bottom" };
  for (const key of ["title", "subtitle", "buttonLabel", "welcome", "headerColor", "accentColor", "botBubbleColor", "userBubbleColor", "positionHorizontal", "positionVertical"]) {
    if (form.elements[key]) form.elements[key].value = widget[key] || defaults[key] || (form.elements[key].type === "color" ? "#111b25" : "");
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
    headerColor: form.elements.headerColor.value || "#111b25",
    accentColor: form.elements.accentColor.value || "#087f7b",
    botBubbleColor: form.elements.botBubbleColor.value || "#e5f6f3",
    userBubbleColor: form.elements.userBubbleColor.value || "#111b25"
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
}

function bindStaticEvents() {
  for (const link of $$("[data-view-link]")) link.addEventListener("click", () => showView(link.dataset.viewLink));
  showView(window.location.hash.replace("#", "") || "dashboard");

  $("#chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendChat($("#message").value, $("#channel").value);
    await refresh();
  });
  $("#chatbot-settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("#chatbot-settings-status");
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
    try {
      await api("/api/settings/chatbot", { method: "POST", body: JSON.stringify(payload) });
      status.textContent = "Configuracion guardada. El codigo del widget no cambia; el widget lee estos ajustes desde WhaleHub.";
      await refresh();
    } catch (error) {
      status.textContent = error.message || "No se pudo guardar la configuracion.";
    }
  });
  $("#chatbot-settings-form").addEventListener("input", updateWidgetPreview);
  $("#chatbot-settings-form").addEventListener("change", updateWidgetPreview);
  $("#simulate-whatsapp").addEventListener("click", async () => {
    $("#channel").value = "whatsapp_cloud";
    $("#message").value = "Quiero informacion de ventas mayoristas";
    await sendChat($("#message").value, $("#channel").value);
    await refresh();
  });
  $("#simulate-marketplace").addEventListener("click", async () => {
    $("#channel").value = "whatsapp_cloud";
    $("#message").value = "Necesito ayuda con mi compra de Amazon";
    await sendChat($("#message").value, $("#channel").value);
    await refresh();
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
  });
  $("#copy-widget-code").addEventListener("click", async () => {
    const output = $("#widget-embed-code");
    const status = $("#widget-code-status");
    updateWidgetEmbedCode();
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = "Codigo copiado.";
    } catch {
      output.select();
      document.execCommand("copy");
      status.textContent = "Codigo seleccionado para copiar.";
    }
  });
  $("#logout-button").addEventListener("click", async () => {
    await logout();
    window.location.hash = "#dashboard";
    setAuthenticatedUi(false);
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
      return;
    }
    button.disabled = true;
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
    } catch (error) {
      form.dataset.configTested = "false";
      $("#save-integration").disabled = true;
      status.textContent = error.message || "No se pudo probar la conexion.";
    } finally {
      button.disabled = false;
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
    const payload = formPayload(event.currentTarget);
    if (!payload.password) delete payload.password;
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    event.currentTarget.reset();
    await refresh();
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

async function openConversation(id) {
  state.selectedConversationId = id;
  setConversationActionStatus();
  const data = await api(`/api/conversations/${id}`);
  const currentAgent = state.data.agents.find((agent) => agent.id === data.conversation.assignedAgentId);
  $("#conversation-status").textContent = statusLabel(data.conversation.status);
  $("#conversation-status").className = `status ${data.conversation.status}`;
  $("#conversation-detail").className = "";
  $("#conversation-detail").innerHTML = `
    <section class="conversation-shell">
      <div class="conversation-thread">
        <div class="conversation-context">
          <article><span>Cliente</span><strong>${esc(data.conversation.customer)}</strong></article>
          <article><span>Canal</span><strong>${esc(data.conversation.channel)}</strong></article>
          <article><span>Intencion</span><strong>${esc(data.conversation.intent || "sin intencion")}</strong></article>
          <article><span>Agente</span><strong>${currentAgent ? esc(currentAgent.name) : "sin asignar"}</strong></article>
        </div>
        <div class="message-list">
          ${data.messages
            .map((message) => `
              <div class="message ${esc(message.senderType)}">
                <div class="message-body">${renderRichText(message.body)}</div>
                ${renderMessageRichContent(message.metadata?.richContent)}
                <small>${esc(message.senderType)} - ${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
              </div>
            `)
            .join("")}
          ${state.typing[id]?.bot ? `<div class="message bot typing"><p>Bot escribiendo...</p></div>` : ""}
          ${state.typing[id]?.agent ? `<div class="message agent typing"><p>Agente escribiendo...</p></div>` : ""}
        </div>
      </div>
      <aside class="conversation-activity">
        <h3>Actividad</h3>
        <div class="timeline">
          ${(data.events || [])
            .map((event) => `
              <article class="timeline-event">
                <strong>${esc(event.body)}</strong>
                <p class="meta">${esc(event.eventType)} - ${esc(event.actorType)}</p>
                <p class="meta">${new Date(event.createdAt).toLocaleString()}</p>
              </article>
            `)
            .join("") || `<article class="timeline-event"><p class="meta">Sin eventos registrados.</p></article>`}
        </div>
      </aside>
    </section>
  `;
  renderConversations();
  const messageList = $("#conversation-detail .message-list");
  if (messageList) messageList.scrollTop = messageList.scrollHeight;
  applyConversationActionAvailability(data.conversation.status);
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
        $("#conversation-status").textContent = statusLabel(updated.status);
        $("#conversation-status").className = `status ${updated.status}`;
        applyConversationActionAvailability(updated.status);
        setConversationActionStatus(labels.done, "ok");
        await refresh();
        await openConversation(state.selectedConversationId);
        setConversationActionStatus(labels.done, "ok");
      } catch (error) {
        setConversationActionStatus(error.message || "No se pudo aplicar la accion.", "error");
      } finally {
        button.textContent = labels.button || previousText;
        button.classList.remove("is-loading");
        for (const item of $$("[data-conversation-action]")) item.disabled = !roleCan("conversation");
      }
    });
  }
  $("#agent-reply-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedConversationId) return;
    const input = $("#agent-reply");
    const body = input.value.trim();
    if (!body) return;
    await api(`/api/conversations/${state.selectedConversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ senderType: "agent", body })
    });
    input.value = "";
    await refresh();
    await openConversation(state.selectedConversationId);
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
  for (const form of $$(".editor[data-editor]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const collection = form.dataset.editor;
      const note = collection === "agents" ? $("#agent-presence-note") : null;
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
      } catch (error) {
        if (note) note.textContent = error.message || "No se pudo guardar el agente.";
        else throw error;
      }
    });
  }
}

function bindRowActions() {
  for (const button of $$("[data-edit]")) {
    button.onclick = () => {
      const collection = button.dataset.edit;
      const item = state.data[collection].find((entry) => String(entry.id) === button.dataset.id);
      if (item) fillForm(collection, item);
    };
  }
  for (const button of $$("[data-delete]")) {
    button.onclick = async () => {
      await api(`/api/${button.dataset.delete}/${button.dataset.id}`, { method: "DELETE" });
      await refresh();
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
      } catch (error) {
        input.checked = !input.checked;
        alert(error.message || "No se pudo cambiar el estado del agente.");
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
      return;
    }
    if (form.dataset.configTested !== "true") {
      status.textContent = "Primero prueba la conexion correctamente antes de guardar.";
      return;
    }
    form.dataset.saving = "true";
    button.disabled = true;
    status.textContent = "Guardando...";
    try {
      const payload = formPayload(form);
      await api("/api/integrations", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      renderIntegrationFields(form.elements.provider.value, definitionDefaults(integrationTemplate(form.elements.provider.value)));
      status.textContent = "API guardada correctamente.";
      await refresh();
    } catch (error) {
      status.textContent = error.message || "No se pudo guardar la API.";
    } finally {
      form.dataset.saving = "false";
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
  });
}

function bindRealtime() {
  const events = new EventSource("/api/events");
  events.addEventListener("conversation.created", async () => {
    state.alerts += 1;
    await refresh();
  });
  events.addEventListener("conversation.updated", async () => {
    state.alerts += 1;
    await refresh();
    if (state.selectedConversationId) await openConversation(state.selectedConversationId);
  });
  events.addEventListener("conversation.typing", async (event) => {
    const data = JSON.parse(event.data);
    state.typing[data.conversationId] ||= {};
    state.typing[data.conversationId][data.senderType] = Boolean(data.typing);
    if (data.conversationId === state.selectedConversationId) await openConversation(state.selectedConversationId);
  });
  events.addEventListener("message.created", async (event) => {
    const message = JSON.parse(event.data);
    if (message.conversationId === state.selectedConversationId) await openConversation(state.selectedConversationId);
  });
  events.addEventListener("agents.updated", async () => {
    await refresh();
  });
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
