export const state = {
  data: null,
  alerts: 0,
  selectedConversationId: null,
  role: "viewer",
  user: null
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
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function loadSession() {
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

export async function login(email, password) {
  const data = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  state.user = data.user;
  state.role = data.user.role;
  return data.user;
}

export async function logout() {
  await api("/api/logout", { method: "POST" });
  state.user = null;
  state.data = null;
  state.role = "viewer";
}

export async function loadBootstrap() {
  state.data = await api("/api/bootstrap");
  return state.data;
}
