let appState = null;
let alerts = 0;

const $ = (selector) => document.querySelector(selector);

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
          <strong>${item.customer}</strong>
          <p>${item.lastMessage}</p>
          <p class="meta">${item.channel} · ${item.intent || "sin intencion"} · ${agent ? agent.name : "sin agente"}</p>
          <span class="status ${item.status}">${statusLabel(item.status)}</span>
        </article>
      `;
    })
    .join("");

  $("#agents-list").innerHTML = appState.agents
    .map((agent) => `
      <article class="card">
        <strong>${agent.name}</strong>
        <p>${agent.role}</p>
        <p class="meta">${agent.online ? "Activo" : "Fuera de linea"} · ${agent.activeConversations}/${agent.maxConversations} chats</p>
        ${agent.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}
      </article>
    `)
    .join("");

  $("#routing-list").innerHTML = appState.routingRules
    .map((rule) => `
      <article class="rule">
        <strong>${rule.name}</strong>
        <p class="meta">${rule.intent} · ${rule.botAllowed ? "bot permitido" : "requiere agente"} · prioridad ${rule.priority}</p>
        <p>${rule.fallbackMessage}</p>
      </article>
    `)
    .join("");

  renderFaqs($("#faq-search").value);

  $("#branches-list").innerHTML = appState.branches
    .map((branch) => `
      <article class="card">
        <strong>${branch.name}</strong>
        <p>${branch.city} · ${branch.hours}</p>
        <p class="meta">${branch.phone} · ${branch.whatsapp}</p>
        <p class="meta">Mayoristas: ${branch.wholesaleContact}</p>
      </article>
    `)
    .join("");
}

function renderFaqs(query = "") {
  const value = query.toLowerCase();
  const faqs = appState.faqs.filter((faq) => {
    const haystack = `${faq.question} ${faq.shortAnswer} ${faq.category} ${faq.tags.join(" ")}`.toLowerCase();
    return haystack.includes(value);
  });
  $("#faq-list").innerHTML = faqs
    .map((faq) => `
      <article class="faq">
        <strong>${faq.question}</strong>
        <p>${faq.shortAnswer}</p>
        <p class="meta">${faq.category}</p>
        ${faq.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </article>
    `)
    .join("");
}

async function bootstrap() {
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
    <strong>Respuesta:</strong> ${data.reply}
    <p class="meta">Estado: ${statusLabel(data.conversation.status)} · Agente: ${data.assignedAgent?.name || "sin asignar"}</p>
  `;
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

bootstrap();
