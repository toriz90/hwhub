const state = {
  data: null,
  users: [],
  alerts: 0,
  selectedConversationId: null,
  role: "viewer",
  user: null
};

const filters = {
  status: "",
  channel: "",
  priority: "",
  slaState: "",
  search: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const rolePermissions = {
  admin: ["*"],
  supervisor: ["conversation", "faqs", "branches", "agents", "routingRules", "integrations"],
  agent: ["conversation"],
  marketplace: ["conversation"],
  wholesale: ["conversation"],
  viewer: []
};

const roleCatalog = {
  admin: ["configurar APIs", "editar reglas", "editar agentes", "cerrar conversaciones", "ver secretos enmascarados"],
  supervisor: ["reasignar conversaciones", "pausar chats", "editar FAQs", "ver reportes"],
  agent: ["tomar conversaciones", "responder clientes", "devolver al bot"],
  marketplace: ["atender Amazon", "atender MercadoLibre", "atender marketplaces"],
  wholesale: ["atender mayoreo", "ver contactos de directorio", "canalizar sucursal"],
  viewer: ["ver bandeja", "ver FAQs", "ver directorio"]
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
        <article class="item">
          <strong>${esc(item.customer)}</strong>
          <p>${esc(item.lastMessage)}</p>
          <p class="meta">${esc(item.channel)} - ${esc(item.intent || "sin intencion")} - ${agent ? esc(agent.name) : "sin agente"}</p>
          <span class="status ${esc(item.status)}">${statusLabel(item.status)}</span>
          <span class="priority ${esc(item.priority)}">${priorityLabel(item.priority)} · ${item.waitingMinutes || 0} min</span>
          <div class="row-actions">
            <button data-open-conversation="${esc(item.id)}">Abrir</button>
            <button data-quick-conversation-action="take" data-id="${esc(item.id)}">Tomar</button>
            <button data-quick-conversation-action="pause" data-id="${esc(item.id)}">Pausar</button>
            <button data-quick-conversation-action="bot" data-id="${esc(item.id)}">Bot</button>
            <button data-quick-conversation-action="close" data-id="${esc(item.id)}">Cerrar</button>
          </div>
        </article>
      `;
    })
    .join("") || `<article class="item"><p class="meta">No hay conversaciones con esos filtros.</p></article>`;

  for (const button of $$("[data-open-conversation]")) button.onclick = () => openConversation(button.dataset.openConversation);
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
        ${(agent.skills || []).map((skill) => `<span class="tag">${esc(skill)}</span>`).join("")}
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
  $("#branches-list").innerHTML = state.data.branches
    .map((branch) => `
      <article class="card">
        <strong>${esc(branch.name)}</strong>
        <p>${esc(branch.city)} - ${esc(branch.hours)}</p>
        <p class="meta">${esc(branch.phone)} - ${esc(branch.whatsapp)}</p>
        <p class="meta">Mayoristas: ${esc(branch.wholesaleContact)}</p>
        <div class="row-actions">
          <button data-edit="branches" data-id="${esc(branch.id)}">Editar</button>
          <button data-delete="branches" data-id="${esc(branch.id)}">Eliminar</button>
        </div>
      </article>
    `)
    .join("");
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
  const canAdmin = roleCan("faqs") || roleCan("branches") || roleCan("agents") || roleCan("routingRules");
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
  applyRoleUi();
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

async function openConversation(id) {
  state.selectedConversationId = id;
  const data = await api(`/api/conversations/${id}`);
  $("#conversation-status").textContent = statusLabel(data.conversation.status);
  $("#conversation-status").className = `status ${data.conversation.status}`;
  $("#conversation-detail").className = "";
  $("#conversation-detail").innerHTML = `
    <div class="message-list">
      ${data.messages
        .map((message) => `
          <div class="message ${esc(message.senderType)}">
            <p>${esc(message.body)}</p>
            <small>${esc(message.senderType)} - ${new Date(message.createdAt).toLocaleString()}</small>
          </div>
        `)
        .join("")}
    </div>
    <div class="timeline">
      <h3>Historial</h3>
      ${(data.events || [])
        .map((event) => `
          <article class="timeline-event">
            <strong>${esc(event.body)}</strong>
            <p class="meta">${esc(event.eventType)} - ${esc(event.actorType)} - ${new Date(event.createdAt).toLocaleString()}</p>
          </article>
        `)
        .join("") || `<article class="timeline-event"><p class="meta">Sin eventos registrados.</p></article>`}
    </div>
  `;
}

function bindConversationActions() {
  for (const button of $$("[data-conversation-action]")) {
    button.addEventListener("click", async () => {
      if (!state.selectedConversationId) return;
      await api(`/api/conversations/${state.selectedConversationId}/${button.dataset.conversationAction}`, { method: "POST" });
      await refresh();
      await openConversation(state.selectedConversationId);
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
      const payload = formPayload(form);
      const id = payload.id;
      delete payload.id;
      await api(`/api/${collection}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      await refresh();
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
  events.addEventListener("message.created", async (event) => {
    const message = JSON.parse(event.data);
    if (message.conversationId === state.selectedConversationId) await openConversation(state.selectedConversationId);
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
