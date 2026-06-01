import { $, esc } from "./shared.js";

const roles = {
  admin: {
    label: "Admin",
    permissions: ["configurar APIs", "editar reglas", "editar agentes", "cerrar conversaciones", "ver secretos enmascarados"],
    skills: ["*"]
  },
  supervisor: {
    label: "Supervisor",
    permissions: ["reasignar conversaciones", "pausar chats", "editar FAQs", "ver reportes"],
    skills: ["atc", "marketplaces", "mayoristas"]
  },
  agent: {
    label: "Agente ATC",
    permissions: ["tomar conversaciones", "responder clientes", "devolver al bot"],
    skills: ["atc", "pedidos"]
  },
  marketplace: {
    label: "Agente marketplace",
    permissions: ["atender Amazon", "atender MercadoLibre", "atender Walmart/Coppel/Elektra/TikTok/Temu"],
    skills: ["amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"]
  },
  wholesale: {
    label: "Mayoristas",
    permissions: ["atender mayoreo", "ver contactos de directorio", "canalizar sucursal"],
    skills: ["mayoristas", "distribuidor"]
  },
  viewer: {
    label: "Solo lectura",
    permissions: ["ver bandeja", "ver FAQs", "ver directorio"],
    skills: []
  }
};

export function renderRoleMatrix() {
  $("#role-matrix").innerHTML = Object.entries(roles)
    .map(([key, role]) => `
      <article class="card">
        <strong>${esc(role.label)}</strong>
        <p class="meta">${esc(key)}</p>
        ${role.permissions.map((permission) => `<span class="tag">${esc(permission)}</span>`).join("")}
      </article>
    `)
    .join("");
}

export function bindRoleLab(getAppState) {
  $("#role-test-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roleKey = data.get("role");
    const channel = data.get("channel");
    const message = String(data.get("message") || "").toLowerCase();
    const role = roles[roleKey];
    const marketplace = ["amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"].find((term) =>
      message.includes(term)
    );
    const appState = getAppState();
    const matchingAgent = appState.agents.find((agent) => {
      const skills = agent.skills || [];
      return agent.online && (!marketplace || skills.includes(marketplace)) && skills.some((skill) => role.skills.includes(skill) || role.skills.includes("*"));
    });
    const canWrite = roleKey !== "viewer";
    const decision = matchingAgent
      ? `Canalizar a ${matchingAgent.name}`
      : marketplace
        ? "No hay agente compatible activo: usar fallback del directorio"
        : "Puede responder con FAQ/directorio antes de escalar";

    $("#role-test-result").innerHTML = `
      <article class="card">
        <strong>${esc(role.label)}</strong>
        <p class="meta">Canal: ${esc(channel)} - Escritura: ${canWrite ? "permitida" : "bloqueada"}</p>
        <p>${esc(decision)}</p>
        ${role.permissions.map((permission) => `<span class="tag">${esc(permission)}</span>`).join("")}
      </article>
    `;
  });
}
