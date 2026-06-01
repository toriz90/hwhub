import { $, $$, api, esc, formPayload } from "./shared.js";

export function renderAdminCollections(appState) {
  renderAgents(appState.agents);
  renderRouting(appState.routingRules);
  renderBranches(appState.branches);
  renderFaqs(appState.faqs, $("#faq-search").value);
  bindRowActions(appState);
}

export function renderFaqs(faqs, query = "") {
  const value = query.toLowerCase();
  const filtered = faqs.filter((faq) => {
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

function renderAgents(agents) {
  $("#agents-list").innerHTML = agents
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

function renderRouting(rules) {
  $("#routing-list").innerHTML = rules
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

function renderBranches(branches) {
  $("#branches-list").innerHTML = branches
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

export function bindEditors(refresh) {
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

function bindRowActions(appState) {
  for (const button of $$("[data-edit]")) {
    button.onclick = () => {
      const collection = button.dataset.edit;
      const item = appState[collection].find((entry) => String(entry.id) === button.dataset.id);
      if (item) fillForm(collection, item);
    };
  }
  for (const button of $$("[data-delete]")) {
    button.onclick = async () => {
      await api(`/api/${button.dataset.delete}/${button.dataset.id}`, { method: "DELETE" });
      window.dispatchEvent(new CustomEvent("hwhub:refresh"));
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
