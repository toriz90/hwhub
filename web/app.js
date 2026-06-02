import { $, $$, loadBootstrap, loadSession, login, logout, state } from "./modules/shared.js";
import { renderDashboard } from "./modules/dashboard.js";
import { applyConversationStatusFilter, bindConversationActions, bindConversationFilters, renderConversations, sendChat, openConversation } from "./modules/conversations.js";
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
  applyRoleUi();
}

function setAuthenticatedUi(isAuthenticated) {
  $("#login-screen").classList.toggle("hidden", isAuthenticated);
  $(".sidebar").classList.toggle("hidden", !isAuthenticated);
  $("main").classList.toggle("hidden", !isAuthenticated);
  if (state.user) {
    $("#active-user").textContent = `${state.user.name} · ${state.user.role}`;
  }
}

function roleCan(permission) {
  const permissions = {
    admin: ["*"],
    supervisor: ["conversation", "faqs", "branches", "agents", "routingRules"],
    agent: ["conversation"],
    marketplace: ["conversation"],
    wholesale: ["conversation"],
    viewer: []
  }[state.role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

function applyRoleUi() {
  $("#active-role").value = state.role;
  $("#active-role").disabled = true;
  const canAdmin = roleCan("faqs") || roleCan("branches") || roleCan("agents") || roleCan("routingRules");
  for (const form of $$("[data-editor]")) {
    const collection = form.dataset.editor;
    form.classList.toggle("is-disabled", !roleCan(collection));
    for (const control of $$("input, select, textarea, button").filter((item) => form.contains(item))) {
      control.disabled = !roleCan(collection);
    }
  }
  $("#integration-form").classList.toggle("is-disabled", state.role !== "admin");
  for (const control of $$("input, select, textarea, button").filter((item) => $("#integration-form").contains(item))) {
    control.disabled = state.role !== "admin";
  }
  for (const button of $$("[data-delete], [data-edit]")) {
    const collection = button.dataset.delete || button.dataset.edit;
    button.disabled = !roleCan(collection);
  }
  for (const button of $$("[data-conversation-action], [data-quick-conversation-action]")) button.disabled = !roleCan("conversation");
  $("#agent-reply").disabled = !roleCan("conversation");
  $("#agent-reply-form button").disabled = !roleCan("conversation");
  document.body.dataset.role = state.role;
  document.body.classList.toggle("limited-role", !canAdmin);
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

function bindRoleSwitch() {
  $("#active-role").value = state.role;
}

function bindDashboardShortcuts() {
  for (const button of $$("[data-status-shortcut]")) {
    button.addEventListener("click", () => {
      showView("conversations");
      history.replaceState(null, "", "#conversations");
      applyConversationStatusFilter(button.dataset.statusShortcut, render);
    });
  }
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
function bindAuth() {
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#login-error").textContent = "";
    const data = new FormData(event.currentTarget);
    try {
      await login(data.get("email"), data.get("password"));
      await startApp();
    } catch {
      $("#login-error").textContent = "Email o password incorrectos.";
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await logout();
    window.location.hash = "#dashboard";
    setAuthenticatedUi(false);
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
  await loadBootstrap();
  if (!appStarted) {
    bindNavigation();
    bindRoleSwitch();
    bindDashboardShortcuts();
    bindEditors(refresh);
    bindConversationActions(refresh);
    bindConversationFilters(render);
    bindIntegrations(refresh);
    bindRoleLab(() => state.data);
    bindRealtime();
    window.addEventListener("hwhub:refresh", refresh);
    appStarted = true;
  }
  render();
}

bindAuth();
setAuthenticatedUi(false);
if (await loadSession()) await startApp();
