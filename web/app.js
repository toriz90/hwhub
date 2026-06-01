let appState = null;
let alerts = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function statusLabel(status) {
  const labels = {
    bot_active: "Bot activo",
    waiting_for_agent: "Esperando agente",
    agent_active: "Agente activo",
    paused: "Pausado",
    closed: "Cerrado"
  };
  return labels[status] || status;
}

function list(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  $("#metric-conversations").textContent = appState.conversations.length;
  $("#metric-agents").textContent = appState.agents.filter((agent) => agent.online).length;
  $("#metric-faqs").textContent = appState.faqs.filter((faq) => faq.published).length;
  $("#metric-alerts").textContent = alerts;

  $("#conversation-list").innerHTML = appState.conversations
    .map((item) => {
      const agent = appState.agents.find((entry) => entry.id === item.assignedAgentId);
      return `
        <article class="item">
          <strong>${esc(item.customer)}</strong>
          <p>${esc(item.lastMessage)}</p>
          <p class="meta">${esc(item.channel)} - ${esc(item.intent || "sin intencion")} - ${agent ? esc(agent.name) : "sin agente"}</p>
          <span class="status ${esc(item.status)}">${statusLabel(item.status)}</span>
        </article>
      `;
    })
    .join("");

  $("#agents-list").innerHTML = appState.agents
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

  $("#routing-list").innerHTML = appState.routingRules
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

  renderFaqs($("#faq-search").value);

  $("#branches-list").innerHTML = appState.branches
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

  bindRowActions();
}

function renderFaqs(query = "") {
  const value = query.toLowerCase();
  const faqs = appState.faqs.filter((faq) => {
    const haystack = `${faq.question} ${faq.shortAnswer} ${faq.category} ${(faq.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(value);
  });
  $("#faq-list").innerHTML = faqs
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
  bindRowActions();
}

async function bootstrap() {
  const response = await fetch("/api/bootstrap");
  appState = await response.json();
  render();
}

async function refresh() {
  const response = await fetch("/api/bootstrap");
  appState = await response.json();
  render();
}

async function sendChat(message, channel = "web_widget") {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, channel, customer: "Cliente demo" })
  });
  const data = await response.json();
  $("#chat-result").innerHTML = `
    <strong>Respuesta:</strong> ${esc(data.reply)}
    <p class="meta">Estado: ${statusLabel(data.conversation.status)} - Agente: ${data.assignedAgent?.name || "sin asignar"}</p>
  `;
}

function formPayload(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    payload[checkbox.name] = checkbox.checked;
  }
  return payload;
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

function bindEditors() {
  for (const form of $$(".editor")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const collection = form.dataset.editor;
      const payload = formPayload(form);
      const id = payload.id;
      delete payload.id;
      const response = await fetch(`/api/${collection}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        alert("No se pudo guardar. Revisa los datos e intenta de nuevo.");
        return;
      }
      form.reset();
      await refresh();
    });
  }
}

function bindRowActions() {
  for (const button of $$("[data-edit]")) {
    button.onclick = () => {
      const collection = button.dataset.edit;
      const item = appState[collection].find((entry) => String(entry.id) === button.dataset.id);
      if (item) fillForm(collection, item);
    };
  }
  for (const button of $$("[data-delete]")) {
    button.onclick = async () => {
      const collection = button.dataset.delete;
      const id = button.dataset.id;
      const response = await fetch(`/api/${collection}/${id}`, { method: "DELETE" });
      if (response.ok) await refresh();
    };
  }
}

$("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendChat($("#message").value, $("#channel").value);
});

$("#simulate-whatsapp").addEventListener("click", () => {
  $("#channel").value = "whatsapp_cloud";
  $("#message").value = "Quiero informacion de ventas mayoristas";
  sendChat($("#message").value, $("#channel").value);
});

$("#simulate-marketplace").addEventListener("click", () => {
  $("#channel").value = "whatsapp_cloud";
  $("#message").value = "Necesito ayuda con mi compra de Amazon";
  sendChat($("#message").value, $("#channel").value);
});

$("#faq-search").addEventListener("input", (event) => renderFaqs(event.target.value));

const events = new EventSource("/api/events");
events.addEventListener("conversation.created", (event) => {
  alerts += 1;
  appState.conversations.unshift(JSON.parse(event.data));
  render();
});
events.addEventListener("conversation.updated", (event) => {
  alerts += 1;
  const next = JSON.parse(event.data);
  appState.conversations = appState.conversations.map((item) => (item.id === next.id ? next : item));
  render();
});

bindEditors();
bootstrap();
