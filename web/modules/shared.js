export const state = {
  data: null,
  alerts: 0,
  selectedConversationId: null,
  role: localStorage.getItem("hwhub.role") || "admin"
};

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export function statusLabel(status) {
  const labels = {
    bot_active: "Bot activo",
    waiting_for_agent: "Esperando agente",
    agent_active: "Agente activo",
    paused: "Pausado",
    closed: "Cerrado"
  };
  return labels[status] || status;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formPayload(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    payload[checkbox.name] = checkbox.checked;
  }
  return payload;
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      "x-hwhub-role": state.role,
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function loadBootstrap() {
  state.data = await api("/api/bootstrap");
  return state.data;
}
