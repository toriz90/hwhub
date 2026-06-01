import { $, $$, loadBootstrap, state } from "./modules/shared.js";
import { renderDashboard } from "./modules/dashboard.js";
import { bindConversationActions, renderConversations, sendChat, openConversation } from "./modules/conversations.js";
import { bindEditors, renderAdminCollections, renderFaqs } from "./modules/admin-crud.js";
import { bindIntegrations, renderIntegrations } from "./modules/integrations.js";
import { bindRoleLab, renderRoleMatrix } from "./modules/roles.js";

async function refresh() {
  await loadBootstrap();
  render();
}

function render() {
  renderDashboard(state.data, state.alerts);
  renderConversations(state.data);
  renderAdminCollections(state.data);
  renderIntegrations(state.data.integrations || []);
  renderRoleMatrix();
}

function showView(view) {
  const selected = view || "dashboard";
  for (const section of $$("[data-view]")) {
    section.classList.toggle("active", section.dataset.view === selected);
  }
  for (const link of $$("[data-view-link]")) {
    link.classList.toggle("active", link.dataset.viewLink === selected);
  }
}

function bindNavigation() {
  for (const link of $$("[data-view-link]")) {
    link.addEventListener("click", () => showView(link.dataset.viewLink));
  }
  const initial = window.location.hash.replace("#", "") || "dashboard";
  showView(initial);
}

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

$("#faq-search").addEventListener("input", (event) => renderFaqs(state.data.faqs, event.target.value));
window.addEventListener("hwhub:refresh", refresh);

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

await loadBootstrap();
bindNavigation();
bindEditors(refresh);
bindConversationActions(refresh);
bindIntegrations(refresh);
bindRoleLab(() => state.data);
render();
