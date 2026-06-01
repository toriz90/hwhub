import { $, $$, api, esc, formPayload } from "./shared.js";

export function renderIntegrations(integrations = []) {
  $("#integrations-list").innerHTML = integrations
    .map((item) => `
      <article class="card">
        <strong>${esc(item.name)}</strong>
        <p class="meta">${esc(item.provider)} - ${item.active ? "activa" : "inactiva"}</p>
        ${Object.entries(item.config || {})
          .map(([key, value]) => `<span class="tag">${esc(key)}: ${esc(value)}</span>`)
          .join("")}
        <div class="row-actions">
          <button data-edit-integration="${esc(item.id)}">Editar</button>
        </div>
      </article>
    `)
    .join("");

  for (const button of $$("[data-edit-integration]")) {
    button.onclick = () => {
      const item = integrations.find((entry) => entry.id === button.dataset.editIntegration);
      if (!item) return;
      const form = $("#integration-form");
      form.elements.id.value = item.id;
      form.elements.provider.value = item.provider;
      form.elements.name.value = item.name;
      form.elements.active.checked = item.active;
      form.elements.config.value = JSON.stringify(item.config || {}, null, 2);
    };
  }
}

export function bindIntegrations(refresh) {
  $("#integration-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    try {
      payload.config = payload.config ? JSON.parse(payload.config) : {};
    } catch {
      alert("La configuracion debe ser JSON valido.");
      return;
    }
    await api("/api/integrations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    await refresh();
  });
}
