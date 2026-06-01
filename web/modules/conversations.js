import { $, $$, api, esc, state, statusLabel } from "./shared.js";

export function renderConversations(appState) {
  $("#conversation-list").innerHTML = appState.conversations
    .map((item) => {
      const agent = appState.agents.find((entry) => entry.id === item.assignedAgentId);
      return `
        <article class="item">
          <strong>${esc(item.customer)}</strong>
          <p>${esc(item.lastMessage)}</p>
          <p class="meta">${esc(item.channel)} - ${esc(item.intent || "sin intencion")} - ${agent ? esc(agent.name) : "sin agente"}</p>
          <span class="status ${esc(item.status)}">${statusLabel(item.status)}</span>
          <div class="row-actions">
            <button data-open-conversation="${esc(item.id)}">Abrir</button>
          </div>
        </article>
      `;
    })
    .join("");

  for (const button of $$("[data-open-conversation]")) {
    button.onclick = () => openConversation(button.dataset.openConversation);
  }
}

export async function openConversation(id) {
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
  `;
}

export function bindConversationActions(refresh) {
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

export async function sendChat(message, channel = "web_widget") {
  const data = await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, channel, customer: "Cliente demo" })
  });
  $("#chat-result").innerHTML = `
    <strong>Respuesta:</strong> ${esc(data.reply)}
    <p class="meta">Estado: ${statusLabel(data.conversation.status)} - Agente: ${data.assignedAgent?.name || "sin asignar"}</p>
  `;
  return data;
}
