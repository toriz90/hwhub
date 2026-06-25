(function () {
  const currentScript = document.currentScript;
  const scriptOrigin = currentScript?.src ? new URL(currentScript.src).origin : "";
  const api = currentScript?.dataset.hwhubApi || scriptOrigin || "";
  const channel = currentScript?.dataset.channel || "web_widget";
  const storageKey = `hwhub-widget:${api || location.origin}:${channel}`;
  const requiredFields = ["firstName", "lastName", "email", "phone"];

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const firstName = currentScript?.dataset.customerFirstName || saved.profile?.firstName || "";
      const lastName = currentScript?.dataset.customerLastName || saved.profile?.lastName || "";
      const fallbackName = currentScript?.dataset.customerName || saved.profile?.name || "";
      return {
        visitorId: saved.visitorId || uuid(),
        conversationId: saved.conversationId || "",
        unread: saved.unread || 0,
        profileComplete: Boolean(saved.profileComplete),
        profile: {
          firstName,
          lastName,
          name: [firstName, lastName].filter(Boolean).join(" ") || fallbackName,
          phone: currentScript?.dataset.customerPhone || saved.profile?.phone || "",
          email: currentScript?.dataset.customerEmail || saved.profile?.email || "",
          wooCustomerId: currentScript?.dataset.customerId || saved.profile?.wooCustomerId || "",
          wooCustomerToken: currentScript?.dataset.customerToken || saved.profile?.wooCustomerToken || "",
          wooCustomerIssuedAt: currentScript?.dataset.customerIssuedAt || saved.profile?.wooCustomerIssuedAt || "",
          serviceCenter: currentScript?.dataset.serviceCenter || saved.profile?.serviceCenter || "",
          appointmentServiceId: saved.profile?.appointmentServiceId || "",
          appointmentProviderId: saved.profile?.appointmentProviderId || "",
          appointmentDate: saved.profile?.appointmentDate || "",
          appointmentTime: saved.profile?.appointmentTime || "",
          sourceType: saved.profile?.sourceType || "",
          sourceValue: saved.profile?.sourceValue || "",
          marketplace: currentScript?.dataset.marketplace || saved.profile?.marketplace || "",
          distributor: currentScript?.dataset.distributor || saved.profile?.distributor || "",
          equipmentModel: currentScript?.dataset.equipmentModel || saved.profile?.equipmentModel || "",
          serialNumber: currentScript?.dataset.serialNumber || saved.profile?.serialNumber || "",
          orderNumber: currentScript?.dataset.orderNumber || saved.profile?.orderNumber || "",
          details: saved.profile?.details || "",
          appointmentConfirmedAt: saved.profile?.appointmentConfirmedAt || "",
          appointmentId: saved.profile?.appointmentId || "",
          appointmentFolio: saved.profile?.appointmentFolio || "",
          appointmentStart: saved.profile?.appointmentStart || ""
        },
        messages: saved.messages || []
      };
    } catch {
      return { visitorId: uuid(), conversationId: "", unread: 0, profileComplete: false, profile: {}, messages: [] };
    }
  }

  function saveSession() {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderInlineText(value = "") {
    const urlPattern = /https?:\/\/[^\s<>"']+/gi;
    const parts = [];
    let lastIndex = 0;
    const source = String(value || "");
    for (const match of source.matchAll(urlPattern)) {
      const raw = match[0].replace(/[),.;]+$/, "");
      parts.push(esc(source.slice(lastIndex, match.index)));
      const href = safeUrl(raw);
      parts.push(href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(new URL(href).hostname.replace(/^www\./, ""))}</a>` : esc(raw));
      lastIndex = (match.index || 0) + match[0].length;
    }
    parts.push(esc(source.slice(lastIndex)));
    return parts.join("").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  }

  function renderText(value = "") {
    const lines = String(value || "").split(/\r?\n/);
    const html = [];
    let listOpen = false;
    const closeList = () => {
      if (!listOpen) return;
      html.push("</ul>");
      listOpen = false;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        html.push(`<div class="hwhub-message-gap"></div>`);
        continue;
      }
      const bullet = line.match(/^[-•]\s+(.+)$/);
      if (bullet) {
        if (!listOpen) {
          html.push(`<ul class="hwhub-message-list">`);
          listOpen = true;
        }
        html.push(`<li>${renderInlineText(bullet[1])}</li>`);
        continue;
      }
      closeList();
      const isHeading = /^\*\*[^*]+\*\*$/.test(line);
      html.push(`<p${isHeading ? ` class="hwhub-message-heading"` : ""}>${renderInlineText(line)}</p>`);
    }
    closeList();
    return html.join("");
  }

  function renderRichContent(blocks = []) {
    if (!Array.isArray(blocks) || !blocks.length) return "";
    return blocks.map((block) => {
      if (block.type === "products") {
        return `
          <section class="hwhub-rich-block">
            <strong>${esc(block.title || "Productos")}</strong>
            <div class="hwhub-product-list">
              ${(block.items || []).map((item) => `
                <article class="hwhub-product-card">
                  ${item.image ? `<img src="${esc(safeUrl(item.image))}" alt="${esc(item.imageAlt || item.title || "Producto")}" loading="lazy">` : `<div class="hwhub-product-empty">HW</div>`}
                  <div>
                    <h4>${esc(item.title)}</h4>
                    ${item.price ? `<p class="hwhub-product-price">${esc(item.price)}</p>` : ""}
                    ${item.regularPrice ? `<p class="hwhub-product-regular">${esc(item.regularPrice)}</p>` : ""}
                    ${item.stock ? `<p class="hwhub-product-stock">${esc(item.stock)}</p>` : ""}
                    ${safeUrl(item.url) ? `<a class="hwhub-rich-link" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">Ver producto</a>` : ""}
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
        `;
      }
      if (block.type === "links") {
        return `
          <section class="hwhub-rich-block">
            <strong>${esc(block.title || "Enlaces")}</strong>
            <div class="hwhub-link-list">
              ${(block.items || []).map((item) => safeUrl(item.url) ? `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title || item.url)}</a>` : "").join("")}
            </div>
          </section>
        `;
      }
      return "";
    }).join("");
  }

  function dateKey(value) {
    const date = value ? new Date(value) : new Date();
    return date.toISOString().slice(0, 10);
  }

  function dateLabel(value) {
    return new Date(value).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }

  function timeLabel(value) {
    return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function injectWidgetStyles() {
    if (document.getElementById("hwhub-widget-style")) return;
    const style = document.createElement("style");
    style.id = "hwhub-widget-style";
    style.textContent = `
      .hwhub-widget-button,
      .hwhub-widget-panel,
      .hwhub-widget-panel * {
        box-sizing: border-box;
      }

      .hwhub-widget-button {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 2147483000;
        width: 60px;
        height: 60px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 999px;
        background: var(--hwhub-widget-header, #1f2a37);
        color: #fff;
        cursor: pointer;
        box-shadow: 0 16px 38px rgba(31, 42, 55, 0.24);
        transform: translate(var(--hwhub-x-shift, 0), var(--hwhub-y-shift, 0));
        transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      }

      .hwhub-widget-button:hover {
        background: #313b47;
        box-shadow: 0 20px 46px rgba(31, 42, 55, 0.3);
      }

      .hwhub-widget-button span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }

      .hwhub-widget-button::before {
        content: "";
        width: 27px;
        height: 20px;
        display: block;
        border: 3px solid currentColor;
        border-radius: 9px;
      }

      .hwhub-widget-button::after {
        content: "";
        position: absolute;
        left: 20px;
        top: 36px;
        width: 10px;
        height: 10px;
        background: currentColor;
        clip-path: polygon(0 0, 100% 0, 0 100%);
      }

      .hwhub-widget-button strong {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--hwhub-widget-accent, #f5b301);
        color: #111;
        font: 800 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      @keyframes hw-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }

      .hwhub-widget-button:not(.is-open) {
        animation: hw-pulse 3s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .hwhub-widget-button { animation: none; }
      }

      .hw-status { font-size: 10px; padding: 2px 7px; border-radius: 999px; font-weight: 500; }
      .hw-status--online { background: rgba(76, 175, 80, 0.15); color: #2e7d32; }
      .hw-status--reconnecting { background: rgba(255, 165, 0, 0.15); color: #e65100; }
      .hw-status--offline { background: rgba(220, 38, 38, 0.15); color: #b91c1c; }

      .hw-quick-chips { display: flex; gap: 6px; padding: 6px 12px; overflow-x: auto; }
      .hw-chip { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #f5f5f0; border: 0.5px solid #e0dbd0; cursor: pointer; white-space: nowrap; }

      .hwhub-widget-button.is-open { animation: none; }
      .hwhub-widget-button.is-open span,
      .hwhub-widget-button.is-open strong,
      .hwhub-widget-button.is-open::after { display: none; }
      .hwhub-widget-button.is-open::before {
        content: "\\2715";
        width: auto;
        height: auto;
        background: none;
        border: 0;
        font-size: 24px;
        line-height: 1;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hwhub-widget-panel {
        position: fixed;
        right: 22px;
        bottom: 92px;
        z-index: 2147483000;
        width: min(430px, calc(100vw - 24px));
        max-height: min(820px, calc(100vh - 112px));
        display: grid;
        overflow: hidden;
        border: 1px solid #d9dee6;
        border-radius: 8px;
        background: #fff;
        color: #1f2a37;
        box-shadow: 0 24px 70px rgba(31, 42, 55, 0.22);
        font: 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transform: translate(var(--hwhub-x-shift, 0), var(--hwhub-y-shift, 0));
      }

      .hwhub-widget-panel[hidden] {
        display: none !important;
      }

      .hwhub-widget-panel header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 16px;
        background: var(--hwhub-widget-header, #1f2a37);
        color: var(--hwhub-header-text, #fff);
      }

      .hwhub-widget-panel header strong {
        display: block;
        font-size: 16px;
      }

      .hwhub-widget-panel header p {
        margin: 2px 0 0;
        color: var(--hwhub-header-text, #fff);
        opacity: 0.78;
      }

      .hwhub-widget-panel header button,
      .hwhub-widget-panel button {
        min-height: 38px;
        border: 0;
        border-radius: 6px;
        padding: 9px 12px;
        background: #1f2a37;
        color: #fff;
        font: 800 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      .hwhub-widget-panel header button {
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: #313b47;
      }

      .hwhub-widget-panel button:hover:not(:disabled) {
        background: #313b47;
      }

      .hwhub-widget-panel button:disabled {
        cursor: wait;
        opacity: 0.7;
      }

      .hwhub-widget-body {
        display: grid;
        gap: 12px;
        max-height: calc(min(820px, 100vh - 112px) - 70px);
        overflow-y: auto;
        padding: 16px;
        background: #fff;
      }

      .hwhub-widget-profile-screen,
      .hwhub-widget-chat-screen {
        display: grid;
        gap: 12px;
      }

      .hwhub-widget-profile-screen[hidden],
      .hwhub-widget-chat-screen[hidden] {
        display: none !important;
      }

      .hwhub-widget-profile-screen h3,
      .hwhub-widget-profile-screen p {
        margin: 0;
      }

      .hwhub-widget-profile-screen h3 {
        font-size: 16px;
      }

      .hwhub-widget-profile-screen p {
        color: #566273;
      }

      .hwhub-widget-profile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .hwhub-widget-profile-screen label {
        display: grid;
        gap: 5px;
        color: #566273;
        font-size: 12px;
        font-weight: 800;
      }

      .hwhub-widget-profile-screen input,
      .hwhub-widget-profile-screen select,
      .hwhub-widget-profile-screen textarea,
      .hwhub-widget-compose textarea {
        width: 100%;
        min-height: 40px;
        border: 1px solid #d9dee6;
        border-radius: 6px;
        background: #fff;
        color: #1f2a37;
        padding: 9px 10px;
        font: 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        outline: none;
      }

      .hwhub-widget-profile-screen input:focus,
      .hwhub-widget-profile-screen select:focus,
      .hwhub-widget-profile-screen textarea:focus,
      .hwhub-widget-compose textarea:focus {
        border-color: var(--hwhub-widget-accent, #f5b301);
        box-shadow: 0 0 0 3px rgba(245, 179, 1, 0.22);
      }

      .hwhub-widget-profile-screen textarea,
      .hwhub-widget-compose textarea {
        min-height: 84px;
        resize: vertical;
      }

      .hwhub-widget-error {
        min-height: 0;
        margin: 0;
        color: #991b1b;
        font-size: 12px;
      }

      .hwhub-widget-error:not(:empty) {
        padding: 8px 10px;
        border: 1px solid #fecaca;
        border-radius: 6px;
        background: #fef2f2;
      }

      .hwhub-widget-error.is-ok:not(:empty) {
        color: #065f46;
        border-color: #a7f3d0;
        background: #ecfdf5;
      }

      .hwhub-widget-error.is-warning:not(:empty) {
        color: #92400e;
        border-color: #fcd34d;
        background: #fffbeb;
      }

      .hwhub-widget-error a {
        color: inherit;
        font-weight: 900;
      }

      .hwhub-widget-form-actions {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
      }

      .hwhub-widget-form-actions button:first-child {
        border: 1px solid #d9dee6;
        background: #eef2f6;
        color: #1f2a37;
      }

      .hwhub-widget-messages {
        display: grid;
        align-content: start;
        gap: 8px;
        max-height: min(390px, 46vh);
        overflow-y: auto;
        padding: 10px;
        border: 1px solid #e6ebf1;
        border-radius: 8px;
        background: #f8fafc;
      }

      .hwhub-widget-date {
        justify-self: center;
        padding: 4px 10px;
        border: 1px solid #d9dee6;
        border-radius: 999px;
        background: #fff;
        color: #6b7788;
        font-size: 11px;
        font-weight: 900;
        text-transform: capitalize;
      }

      .hwhub-widget-message {
        max-width: 86%;
        padding: 9px 11px;
        border: 1px solid transparent;
        border-radius: 8px;
        color: #1f2a37;
        box-shadow: 0 2px 8px rgba(31, 42, 55, 0.07);
      }

      .hwhub-widget-message p {
        margin: 0;
      }

      .hwhub-widget-message time {
        display: block;
        margin-top: 5px;
        color: rgba(31, 42, 55, 0.55);
        font-size: 11px;
        font-weight: 800;
      }

      .hwhub-widget-message.customer {
        justify-self: end;
        background: var(--hwhub-widget-user, #1f2a37);
        color: #fff;
      }

      .hwhub-widget-message.customer time {
        color: rgba(255, 255, 255, 0.72);
      }

      .hwhub-widget-message.bot {
        justify-self: start;
        background: var(--hwhub-widget-bot, #e8f5f3);
        border-color: #cbe7e2;
      }

      .hwhub-widget-message.agent {
        justify-self: start;
        background: #fff6d8;
        border-color: rgba(245, 179, 1, 0.45);
      }

      .hwhub-widget-message.system {
        justify-self: center;
        background: #fef2f2;
        color: #991b1b;
      }

      .hwhub-widget-message a,
      .hwhub-rich-link,
      .hwhub-link-list a {
        color: #1f2a37;
        font-weight: 900;
        text-decoration-color: var(--hwhub-widget-accent, #f5b301);
      }

      .hwhub-message-list {
        margin: 0;
        padding-left: 18px;
      }

      .hwhub-rich-block {
        display: grid;
        gap: 8px;
        margin-top: 8px;
      }

      .hwhub-product-list,
      .hwhub-link-list {
        display: grid;
        gap: 8px;
      }

      .hwhub-product-card {
        display: grid;
        grid-template-columns: 66px 1fr;
        gap: 10px;
        align-items: center;
        border: 1px solid #d9dee6;
        border-radius: 8px;
        background: #fff;
        padding: 8px;
      }

      .hwhub-product-card img,
      .hwhub-product-empty {
        width: 66px;
        aspect-ratio: 1;
        border-radius: 7px;
        object-fit: cover;
      }

      .hwhub-product-empty {
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f5b301, #1f2a37);
        color: #fff;
        font-weight: 900;
      }

      .hwhub-product-card h4,
      .hwhub-product-card p {
        margin: 0;
      }

      .hwhub-product-price {
        color: #0f9d73;
        font-weight: 950;
      }

      .hwhub-product-regular,
      .hwhub-product-stock {
        color: #6b7788;
        font-size: 12px;
      }

      .hwhub-widget-typing {
        display: inline-flex;
        gap: 4px;
        align-items: center;
      }

      .hwhub-widget-typing span {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: currentColor;
        animation: hwhubTyping 0.9s infinite ease-in-out;
      }

      .hwhub-widget-typing span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .hwhub-widget-typing span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes hwhubTyping {
        0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
        40% { opacity: 1; transform: translateY(-2px); }
      }

      .hwhub-widget-compose {
        display: grid;
        gap: 10px;
      }

      .hwhub-widget-compose button,
      .hwhub-widget-profile-screen > button,
      .hwhub-widget-form-actions button:last-child {
        background: var(--hwhub-widget-header, #1f2a37);
      }

      @media (max-width: 520px) {
        .hwhub-widget-panel {
          right: 8px;
          left: 8px;
          bottom: 78px;
          width: auto;
          max-height: calc(100vh - 92px);
        }

        .hwhub-widget-profile-grid {
          grid-template-columns: 1fr;
        }

        .hwhub-widget-form-actions {
          grid-template-columns: 1fr;
        }

        .hwhub-widget-form-actions button {
          width: 100%;
        }

        .hwhub-widget-button {
          right: 14px;
          bottom: 14px;
          width: 56px;
          height: 56px;
        }
      }
    `;
    document.head.append(style);
  }

  function isProfileComplete() {
    return requiredFields.every((key) => String(session.profile[key] || "").trim());
  }

  const session = loadSession();
  let widgetConfig = {
    title: "Honey Whale",
    subtitle: "Atencion por chatbot y agentes",
    welcome: "Hola, completa tus datos y cuentame en que puedo ayudarte.",
    buttonLabel: "Chat",
    headerColor: "#1f2a37",
    accentColor: "#f5b301",
    botBubbleColor: "#e8f5f3",
    userBubbleColor: "#1f2a37",
    positionHorizontal: "right",
    positionVertical: "bottom"
  };
  session.profileComplete = session.profileComplete || isProfileComplete();
  injectWidgetStyles();

  const button = document.createElement("button");
  button.className = "hwhub-widget-button";
  button.type = "button";
  button.setAttribute("aria-label", "Abrir chat");
  button.innerHTML = `<span>${esc(widgetConfig.buttonLabel)}</span><strong id="hwhub-widget-badge" hidden>0</strong>`;

  const panel = document.createElement("section");
  panel.className = "hwhub-widget-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header>
      <div>
        <strong id="hwhub-widget-title">${esc(widgetConfig.title)}</strong>
        <p id="hwhub-widget-subtitle">${esc(widgetConfig.subtitle)}</p>
        <span id="hwhub-widget-status" class="hw-status hw-status--online">● En línea</span>
      </div>
      <button id="hwhub-widget-edit-profile" type="button">Datos</button>
    </header>
    <div class="hwhub-widget-body">
      <form id="hwhub-widget-profile" class="hwhub-widget-profile-screen">
        <h3>Antes de iniciar</h3>
        <p>Completa tus datos para que podamos dar seguimiento a pedidos, citas y soporte.</p>
        <div class="hwhub-widget-profile-grid">
          <label>Nombre *<input data-profile-field="firstName" required autocomplete="given-name"></label>
          <label>Apellido *<input data-profile-field="lastName" required autocomplete="family-name"></label>
          <label>Email *<input data-profile-field="email" type="email" required autocomplete="email"></label>
          <label>Telefono / WhatsApp *<input data-profile-field="phone" required autocomplete="tel"></label>
        </div>
        <button type="submit">Continuar al chat</button>
        <p id="hwhub-widget-profile-error" class="hwhub-widget-error"></p>
      </form>
      <form id="hwhub-widget-appointment" class="hwhub-widget-profile-screen" hidden>
        <h3>Datos para cita</h3>
        <p id="hwhub-widget-appointment-profile">Selecciona servicio, proveedor, fecha y horario disponible.</p>
        <div class="hwhub-widget-profile-grid">
          <label>Servicio *<select data-appointment-field="appointmentServiceId" required></select></label>
          <label>Proveedor *<select data-appointment-field="appointmentProviderId" required></select></label>
          <label>Fecha *<input data-appointment-field="appointmentDate" type="date" required></label>
          <label>Hora *<select data-appointment-field="appointmentTime" required></select></label>
          <label>Origen *<select data-appointment-field="sourceType" required>
            <option value="">Seleccionar</option>
            <option value="marketplace">Marketplace</option>
            <option value="sucursal">Sucursal</option>
            <option value="distribuidor">Distribuidor</option>
          </select></label>
          <label>Valor del origen *<select data-appointment-field="sourceValue" required></select></label>
          <label>Modelo del equipo *<select data-appointment-field="equipmentModel" required></select></label>
          <label>Numero de pedido<input data-appointment-field="orderNumber"></label>
          <label>Numero de serie<input data-appointment-field="serialNumber"></label>
        </div>
        <label>Detalles<textarea data-appointment-field="details" placeholder="Describe brevemente tu solicitud"></textarea></label>
        <div class="hwhub-widget-form-actions">
          <button type="button" id="hwhub-widget-cancel-appointment">Cancelar</button>
          <button type="submit">Continuar</button>
        </div>
        <p id="hwhub-widget-appointment-error" class="hwhub-widget-error"></p>
      </form>
      <section id="hwhub-widget-chat" class="hwhub-widget-chat-screen" hidden>
        <div id="hwhub-widget-messages" class="hwhub-widget-messages"></div>
        <div class="hw-quick-chips">
          <button class="hw-chip" type="button" data-msg="Quiero agendar una cita">📅 Cita</button>
          <button class="hw-chip" type="button" data-msg="¿Cuál es el estado de mi pedido?">📦 Mi pedido</button>
          <button class="hw-chip" type="button" data-msg="¿Dónde está la sucursal más cercana?">📍 Sucursal</button>
        </div>
        <div class="hwhub-widget-compose">
          <textarea id="hwhub-widget-message" placeholder="Escribe tu pregunta"></textarea>
          <button id="hwhub-widget-send" type="button">Enviar</button>
        </div>
      </section>
    </div>
  `;

  function mountWidget() {
    if (button.isConnected || panel.isConnected) return;
    document.body.append(panel, button);
  }

  if (document.body) {
    mountWidget();
  } else {
    document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
  }

  const badge = panel.ownerDocument.querySelector("#hwhub-widget-badge");
  const profileForm = panel.querySelector("#hwhub-widget-profile");
  const appointmentForm = panel.querySelector("#hwhub-widget-appointment");
  const profileError = panel.querySelector("#hwhub-widget-profile-error");
  const appointmentError = panel.querySelector("#hwhub-widget-appointment-error");
  const chatScreen = panel.querySelector("#hwhub-widget-chat");
  const messages = panel.querySelector("#hwhub-widget-messages");
  const textarea = panel.querySelector("#hwhub-widget-message");
  const sendButton = panel.querySelector("#hwhub-widget-send");
  const editProfile = panel.querySelector("#hwhub-widget-edit-profile");
  const cancelAppointment = panel.querySelector("#hwhub-widget-cancel-appointment");
  const title = panel.querySelector("#hwhub-widget-title");
  const subtitle = panel.querySelector("#hwhub-widget-subtitle");
  const appointmentProfile = panel.querySelector("#hwhub-widget-appointment-profile");
  let appointmentOptions = null;
  let pendingAppointmentMessage = "";
  let appointmentBusy = false;
  let syncInFlight = false;
  let syncTimer = null;

  async function loadWidgetConfig() {
    try {
      const response = await fetch(`${api}/api/widget-config`);
      if (!response.ok) return;
      widgetConfig = { ...widgetConfig, ...(await response.json()) };
      button.querySelector("span").textContent = widgetConfig.buttonLabel || "Chat";
      title.textContent = widgetConfig.title || "Honey Whale";
      subtitle.textContent = widgetConfig.subtitle || "";
      const headerColor = widgetConfig.headerColor || "#1f2a37";
      const accentColor = widgetConfig.accentColor || "#f5b301";
      panel.style.setProperty("--hwhub-widget-header", headerColor);
      panel.style.setProperty("--hwhub-header-text", widgetConfig.headerTextColor || "#ffffff");
      panel.style.setProperty("--hwhub-widget-accent", accentColor);
      panel.style.setProperty("--hwhub-widget-bot", widgetConfig.botBubbleColor || "#e8f5f3");
      panel.style.setProperty("--hwhub-widget-user", widgetConfig.userBubbleColor || "#1f2a37");
      button.style.setProperty("--hwhub-widget-header", headerColor);
      button.style.setProperty("--hwhub-widget-accent", accentColor);
      applyWidgetPosition();
      renderMessages();
    } catch {}
  }

  function applyWidgetPosition() {
    const horizontal = ["left", "center", "right"].includes(widgetConfig.positionHorizontal) ? widgetConfig.positionHorizontal : "right";
    const vertical = ["top", "center", "bottom"].includes(widgetConfig.positionVertical) ? widgetConfig.positionVertical : "bottom";
    const x = {
      left: { left: "22px", right: "auto", shift: "0" },
      center: { left: "50%", right: "auto", shift: "-50%" },
      right: { left: "auto", right: "22px", shift: "0" }
    }[horizontal];
    const buttonY = {
      top: { top: "22px", bottom: "auto", shift: "0" },
      center: { top: "50%", bottom: "auto", shift: "-50%" },
      bottom: { top: "auto", bottom: "22px", shift: "0" }
    }[vertical];
    const panelY = {
      top: { top: "92px", bottom: "auto", shift: "0" },
      center: { top: "50%", bottom: "auto", shift: "-50%" },
      bottom: { top: "auto", bottom: "92px", shift: "0" }
    }[vertical];
    for (const item of [button, panel]) {
      item.style.left = x.left;
      item.style.right = x.right;
      item.style.setProperty("--hwhub-x-shift", x.shift);
    }
    button.style.top = buttonY.top;
    button.style.bottom = buttonY.bottom;
    button.style.setProperty("--hwhub-y-shift", buttonY.shift);
    panel.style.top = panelY.top;
    panel.style.bottom = panelY.bottom;
    panel.style.setProperty("--hwhub-y-shift", panelY.shift);
  }

  function fillProfileForm() {
    for (const input of profileForm.querySelectorAll("[data-profile-field]")) {
      input.value = session.profile[input.dataset.profileField] || "";
    }
  }

  function syncProfileFromForm() {
    for (const input of profileForm.querySelectorAll("[data-profile-field]")) {
      session.profile[input.dataset.profileField] = input.value.trim();
    }
    session.profile.name = [session.profile.firstName, session.profile.lastName].filter(Boolean).join(" ");
    saveSession();
  }

  function clearAppointmentStatus() {
    appointmentError.textContent = "";
    appointmentError.className = "hwhub-widget-error";
  }

  function setAppointmentStatus(message, type = "error", html = false) {
    appointmentError.className = `hwhub-widget-error is-${type}`;
    if (html) {
      appointmentError.innerHTML = message;
    } else {
      appointmentError.textContent = message;
    }
  }

  function setAppointmentBusy(active) {
    appointmentBusy = active;
    for (const button of appointmentForm.querySelectorAll("button")) button.disabled = active;
    editProfile.disabled = active;
  }

  function resetAppointmentSelection() {
    for (const key of ["appointmentServiceId", "appointmentProviderId", "appointmentDate", "appointmentTime", "appointmentConfirmedAt", "appointmentId", "appointmentFolio", "appointmentStart"]) {
      session.profile[key] = "";
    }
    saveSession();
  }

  function existingAppointmentStatus(result = {}) {
    const current = result.existingAppointment || {};
    const url = safeUrl(current.rescheduleUrl || "");
    const link = url ? ` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Reagendar cita</a>` : "";
    const email = session.profile.email ? ` Correo: ${esc(session.profile.email)}.` : "";
    const folio = current.folio ? ` Folio: ${esc(current.folio)}.` : "";
    return `${esc(result.message || "Ya existe una cita futura asociada a este correo.")} Cita actual: ${esc(current.start || "sin fecha visible")}.${folio}${email}${link}`;
  }

  function setScreen(screen) {
    const showChat = screen === "chat" && session.profileComplete;
    const showAppointment = screen === "appointment" && session.profileComplete;
    profileForm.hidden = showChat || showAppointment;
    appointmentForm.hidden = !showAppointment;
    chatScreen.hidden = !showChat;
    editProfile.hidden = !(showChat || showAppointment);
    if (showChat) {
      renderMessages();
      textarea.focus();
    } else if (showAppointment) {
      syncProfileFromForm();
      loadAppointmentOptions();
    } else {
      fillProfileForm();
    }
  }

  function wantsAppointment(message) {
    return /cita|agenda|agendar|reservar|centro de servicio|servicio/i.test(message);
  }

  async function loadAppointmentOptions() {
    if (!appointmentOptions) {
      const response = await fetch(`${api}/api/appointments/options`);
      appointmentOptions = await response.json();
    }
    const serviceSelect = appointmentForm.querySelector('[data-appointment-field="appointmentServiceId"]');
    const providerSelect = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]');
    serviceSelect.innerHTML = `<option value="">Seleccionar</option>` + (appointmentOptions.services || [])
      .map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`)
      .join("");
    const dateInput = appointmentForm.querySelector('[data-appointment-field="appointmentDate"]');
    if (appointmentOptions.settings?.minimumAdvanceBooking) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + Number(appointmentOptions.settings.minimumAdvanceBooking));
      dateInput.min = minDate.toISOString().slice(0, 10);
    }
    if (appointmentOptions.settings?.futureBookingLimit) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + Number(appointmentOptions.settings.futureBookingLimit));
      dateInput.max = maxDate.toISOString().slice(0, 10);
    }
    await fillAppointmentForm();
  }

  async function fillAppointmentForm() {
    clearAppointmentStatus();
    appointmentProfile.textContent = `Agenda para ${session.profile.name || "cliente"} - ${session.profile.email || "sin correo"} - ${session.profile.phone || "sin telefono"}`;
    for (const input of appointmentForm.querySelectorAll("[data-appointment-field]")) {
      if (["appointmentProviderId", "sourceValue", "equipmentModel"].includes(input.dataset.appointmentField)) continue;
      input.value = session.profile[input.dataset.appointmentField] || "";
    }
    const serviceSelect = appointmentForm.querySelector('[data-appointment-field="appointmentServiceId"]');
    if (!serviceSelect.value && appointmentOptions.services?.length) {
      serviceSelect.value = appointmentOptions.services[0].id;
      session.profile.appointmentServiceId = serviceSelect.value;
    }
    updateProviderOptions(session.profile.appointmentProviderId || "");
    const providerSelect = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]');
    if (!providerSelect.value && providerSelect.options.length === 2) {
      providerSelect.selectedIndex = 1;
      session.profile.appointmentProviderId = providerSelect.value;
    }
    updateSourceValueOptions(session.profile.sourceValue || "");
    updateModelOptions(session.profile.equipmentModel || "");
    const dateInput = appointmentForm.querySelector('[data-appointment-field="appointmentDate"]');
    if (!dateInput.value && dateInput.min) {
      dateInput.value = dateInput.min;
      session.profile.appointmentDate = dateInput.value;
    }
    if (serviceSelect.value && providerSelect.value && dateInput.value) await prevalidateAppointment();
  }

  function syncAppointmentFromForm() {
    for (const input of appointmentForm.querySelectorAll("[data-appointment-field]")) {
      session.profile[input.dataset.appointmentField] = input.value.trim();
    }
    const type = session.profile.sourceType;
    session.profile.marketplace = type === "marketplace" ? session.profile.sourceValue : "";
    session.profile.serviceCenter = type === "sucursal" ? session.profile.sourceValue : "";
    session.profile.distributor = type === "distribuidor" ? session.profile.sourceValue : "";
    saveSession();
  }

  function optionList(items = [], selectedValue = "", options = {}) {
    const includeUnknown = options.includeUnknown !== false;
    const placeholder = options.placeholder || "Seleccionar";
    const values = items.map((item) => typeof item === "string" ? { value: item, label: item } : {
      value: item.value ?? item.id ?? item.name ?? "",
      label: item.label ?? item.name ?? item.value ?? item.id ?? ""
    }).filter((item) => String(item.value).trim());
    const hasSelected = includeUnknown && selectedValue && !values.some((item) => String(item.value) === String(selectedValue));
    const normalized = hasSelected ? [{ value: selectedValue, label: selectedValue }, ...values] : values;
    return `<option value="">${esc(placeholder)}</option>` + normalized
      .map((item) => `<option value="${esc(item.value)}"${String(item.value) === String(selectedValue) ? " selected" : ""}>${esc(item.label)}</option>`)
      .join("");
  }

  function updateProviderOptions(selectedValue = "") {
    if (!appointmentOptions) return;
    const serviceId = Number(appointmentForm.querySelector('[data-appointment-field="appointmentServiceId"]').value);
    const providerSelect = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]');
    const currentValue = selectedValue || "";
    const providers = (appointmentOptions.providers || []).filter((provider) => !serviceId || (provider.services || []).includes(serviceId));
    providerSelect.disabled = !serviceId;
    providerSelect.innerHTML = serviceId
      ? optionList(providers.map((provider) => ({ value: provider.id, label: provider.name })), currentValue, { includeUnknown: false })
      : `<option value="">Selecciona servicio primero</option>`;
  }

  function updateSourceValueOptions(selectedValue) {
    if (!appointmentOptions) return;
    const type = appointmentForm.querySelector('[data-appointment-field="sourceType"]').value;
    const sourceSelect = appointmentForm.querySelector('[data-appointment-field="sourceValue"]');
    const currentValue = selectedValue !== undefined ? selectedValue : sourceSelect.value || session.profile.sourceValue || "";
    const values = type ? appointmentOptions.sources?.[type] || [] : [];
    sourceSelect.disabled = !type;
    sourceSelect.innerHTML = type ? optionList(values, currentValue) : `<option value="">Selecciona origen primero</option>`;
  }

  function updateModelOptions(selectedValue = "") {
    if (!appointmentOptions) return;
    const modelSelect = appointmentForm.querySelector('[data-appointment-field="equipmentModel"]');
    const currentValue = selectedValue || modelSelect.value || session.profile.equipmentModel || "";
    modelSelect.innerHTML = optionList(appointmentOptions.equipmentModels || [], currentValue);
  }

  async function prevalidateAppointment() {
    syncAppointmentFromForm();
    const payload = {
      serviceId: session.profile.appointmentServiceId,
      providerId: session.profile.appointmentProviderId,
      date: session.profile.appointmentDate,
      email: session.profile.email
    };
    const response = await fetch(`${api}/api/appointments/prevalidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    const timeSelect = appointmentForm.querySelector('[data-appointment-field="appointmentTime"]');
    if (result.ok) {
      timeSelect.innerHTML = `<option value="">Seleccionar</option>` + result.slots
        .map((slot) => `<option value="${esc(slot)}">${esc(slot)}</option>`)
        .join("");
      setAppointmentStatus("Horarios disponibles cargados.", "ok");
      return;
    }
    timeSelect.innerHTML = `<option value="">Sin horarios</option>`;
    const next = result.nextAvailable;
    if (result.reason === "existing_appointment") {
      setAppointmentStatus(existingAppointmentStatus(result), "warning", true);
      return;
    }
    if (next?.date) {
      setAppointmentStatus(`${result.message} Proxima fecha disponible: ${next.date}.`, "warning");
      appointmentForm.querySelector('[data-appointment-field="appointmentDate"]').value = next.date;
      timeSelect.innerHTML = `<option value="">Seleccionar</option>` + (next.slots || [])
        .map((slot) => `<option value="${esc(slot)}">${esc(slot)}</option>`)
        .join("");
    } else {
      setAppointmentStatus(result.message || "No hay disponibilidad cercana.", result.reason === "missing_fields" ? "error" : "warning");
    }
  }

  function updateBadge() {
    badge.textContent = String(session.unread || 0);
    badge.hidden = !session.unread;
  }

  function normalizeMessages(items = []) {
    return items.map((item) => ({
      id: item.id || "",
      conversationId: item.conversationId || "",
      senderType: item.senderType,
      senderId: item.senderId || "",
      body: item.body,
      metadata: item.metadata || {},
      createdAt: item.createdAt || new Date().toISOString()
    }));
  }

  function sameMessageSet(nextMessages = []) {
    if (nextMessages.length !== session.messages.length) return false;
    return nextMessages.every((message, index) => {
      const current = session.messages[index] || {};
      if (message.id || current.id) return message.id === current.id;
      return message.senderType === current.senderType &&
        message.body === current.body &&
        message.createdAt === current.createdAt;
    });
  }

  async function syncConversation() {
    if (!session.conversationId || !session.visitorId || syncInFlight) return;
    syncInFlight = true;
    try {
      const params = new URLSearchParams({
        conversationId: session.conversationId,
        visitorId: session.visitorId,
        channel
      });
      const response = await fetch(`${api}/api/chat/sync?${params}`);
      if (!response.ok) return;
      const data = await response.json();
      if (!data.conversationId || !Array.isArray(data.messages)) return;
      const previousIds = new Set(session.messages.map((message) => message.id).filter(Boolean));
      const nextMessages = normalizeMessages(data.messages);
      if (sameMessageSet(nextMessages)) return;
      const incoming = nextMessages.filter((message) =>
        message.id &&
        !previousIds.has(message.id) &&
        !["customer", "system"].includes(message.senderType)
      );
      session.conversationId = data.conversationId;
      session.messages = nextMessages;
      if (panel.hidden && incoming.length) {
        session.unread = (session.unread || 0) + incoming.length;
      } else if (!panel.hidden) {
        session.unread = 0;
      }
      saveSession();
      renderMessages();
      updateBadge();
    } catch {
      // La sincronizacion es silenciosa para no interrumpir al cliente si hay red lenta.
    } finally {
      syncInFlight = false;
    }
  }

  function startSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(syncConversation, 3500);
  }

  function renderMessages() {
    const items = session.messages.length ? session.messages : [
      { senderType: "bot", body: widgetConfig.welcome || "Hola, completa tus datos y cuentame en que puedo ayudarte.", createdAt: new Date().toISOString() }
    ];
    let lastDate = "";
    messages.innerHTML = items.slice(-60).map((message) => {
      const createdAt = message.createdAt || new Date().toISOString();
      const key = dateKey(createdAt);
      const separator = key !== lastDate ? `<div class="hwhub-widget-date">${esc(dateLabel(createdAt))}</div>` : "";
      lastDate = key;
      return `
        ${separator}
        <article class="hwhub-widget-message ${esc(message.senderType)}">
          <div class="hwhub-widget-message-body">${renderText(message.body)}</div>
          ${renderRichContent(message.metadata?.richContent)}
          <time>${esc(timeLabel(createdAt))}</time>
        </article>
      `;
    }).join("");
    messages.scrollTop = messages.scrollHeight;
  }

  function setTyping(active, senderType = "bot") {
    const existing = messages.querySelector(".hwhub-widget-typing");
    if (existing) existing.remove();
    if (!active) return;
    const bubble = document.createElement("article");
    bubble.className = `hwhub-widget-message ${senderType} hwhub-widget-typing`;
    bubble.innerHTML = `<span></span><span></span><span></span>`;
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.classList.toggle("is-open", !panel.hidden);
    if (!panel.hidden) {
      session.unread = 0;
      saveSession();
      updateBadge();
      setScreen(session.profileComplete ? "chat" : "profile");
    }
  });

  for (const chip of panel.querySelectorAll(".hw-chip")) {
    chip.addEventListener("click", () => {
      textarea.value = chip.dataset.msg || "";
      sendMessageToApi(chip.dataset.msg || "");
    });
  }

  // El widget no tiene SSE (los eventos requieren sesion de backoffice). Estado real via navigator.onLine + resultado del envio.
  function setWidgetStatus(state) {
    const el = panel.querySelector("#hwhub-widget-status");
    if (!el) return;
    const map = {
      online: ["hw-status--online", "● En línea"],
      reconnecting: ["hw-status--reconnecting", "● Reconectando"],
      offline: ["hw-status--offline", "● Sin conexión"]
    };
    const [cls, text] = map[state] || map.online;
    el.className = "hw-status " + cls;
    el.textContent = text;
  }
  setWidgetStatus(navigator.onLine ? "online" : "offline");
  window.addEventListener("online", () => setWidgetStatus("online"));
  window.addEventListener("offline", () => setWidgetStatus("offline"));

  editProfile.addEventListener("click", () => setScreen("profile"));
  cancelAppointment.addEventListener("click", () => {
    pendingAppointmentMessage = "";
    setScreen("chat");
  });

  appointmentForm.addEventListener("change", async (event) => {
    if (event.target?.dataset?.appointmentField === "appointmentServiceId") {
      session.profile.appointmentProviderId = "";
      session.profile.appointmentTime = "";
      const providerSelect = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]');
      const timeSelect = appointmentForm.querySelector('[data-appointment-field="appointmentTime"]');
      providerSelect.value = "";
      timeSelect.innerHTML = `<option value="">Seleccionar</option>`;
      clearAppointmentStatus();
      updateProviderOptions("");
      if (providerSelect.options.length === 2) providerSelect.selectedIndex = 1;
    }
    if (event.target?.dataset?.appointmentField === "sourceType") {
      session.profile.sourceValue = "";
      event.target.closest("form").querySelector('[data-appointment-field="sourceValue"]').value = "";
      updateSourceValueOptions("");
    }
    if (["appointmentServiceId", "appointmentProviderId", "appointmentDate"].includes(event.target?.dataset?.appointmentField)) {
      const serviceId = appointmentForm.querySelector('[data-appointment-field="appointmentServiceId"]').value;
      const providerId = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]').value;
      const date = appointmentForm.querySelector('[data-appointment-field="appointmentDate"]').value;
      if (serviceId && providerId && date) await prevalidateAppointment();
    }
  });

  appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncAppointmentFromForm();
    const required = ["appointmentServiceId", "appointmentProviderId", "appointmentDate", "appointmentTime", "sourceType", "sourceValue", "equipmentModel"];
    const missing = required.filter((key) => !String(session.profile[key] || "").trim());
    if (missing.length) {
      setAppointmentStatus("Completa servicio, proveedor, fecha, hora, origen y modelo.", "error");
      return;
    }
    const service = appointmentOptions?.services?.find((item) => String(item.id) === String(session.profile.appointmentServiceId));
    const provider = appointmentOptions?.providers?.find((item) => String(item.id) === String(session.profile.appointmentProviderId));
    const source = `${session.profile.sourceType}: ${session.profile.sourceValue}`;
    setAppointmentStatus("Creando cita...", "ok");
    setAppointmentBusy(true);
    let createResult;
    try {
      const createResponse = await fetch(`${api}/api/appointments/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: session.profile.firstName,
          lastName: session.profile.lastName,
          email: session.profile.email,
          phone: session.profile.phone,
          serviceId: session.profile.appointmentServiceId,
          providerId: session.profile.appointmentProviderId,
          date: session.profile.appointmentDate,
          time: session.profile.appointmentTime,
          sourceType: session.profile.sourceType,
          sourceValue: session.profile.sourceValue,
          equipmentModel: session.profile.equipmentModel,
          orderNumber: session.profile.orderNumber,
          serialNumber: session.profile.serialNumber,
          details: session.profile.details
        })
      });
      createResult = await createResponse.json();
    } catch (error) {
      setAppointmentStatus(error.message || "No se pudo crear la cita.", "error");
      return;
    } finally {
      setAppointmentBusy(false);
    }
    if (!createResult.ok) {
      if (createResult.reason === "existing_appointment") {
        setAppointmentStatus(existingAppointmentStatus(createResult), "warning", true);
      } else {
        setAppointmentStatus(createResult.message || "No se pudo crear la cita.", "error");
      }
      return;
    }
    const message = [
      pendingAppointmentMessage || "Quiero agendar una cita",
      `Servicio: ${service?.name || session.profile.appointmentServiceId}`,
      `Proveedor: ${provider?.name || session.profile.appointmentProviderId}`,
      `Fecha y hora: ${session.profile.appointmentDate} ${session.profile.appointmentTime}`,
      `Origen: ${source}`,
      `Modelo: ${session.profile.equipmentModel}`,
      session.profile.orderNumber ? `Pedido: ${session.profile.orderNumber}` : "",
      session.profile.serialNumber ? `Serie: ${session.profile.serialNumber}` : "",
      session.profile.details ? `Detalles: ${session.profile.details}` : ""
    ].filter(Boolean).join("\n");
    const confirmation = [
      `Cita creada correctamente${createResult.appointment?.id ? ` con ID ${createResult.appointment.id}` : ""}.`,
      createResult.appointment?.folio ? `Folio: ${createResult.appointment.folio}` : "",
      `Servicio: ${service?.name || createResult.service?.name || session.profile.appointmentServiceId}`,
      `Proveedor: ${provider?.name || session.profile.appointmentProviderId}`,
      `Fecha y hora: ${createResult.appointment?.start || `${session.profile.appointmentDate} ${session.profile.appointmentTime}`}`,
      "Revisa tu correo electronico; ahi recibiras la confirmacion con el PDF adjunto."
    ].filter(Boolean).join("\n");
    session.profile.appointmentConfirmedAt = new Date().toISOString();
    session.profile.appointmentId = createResult.appointment?.id || "";
    session.profile.appointmentFolio = createResult.appointment?.folio || "";
    session.profile.appointmentStart = createResult.appointment?.start || `${session.profile.appointmentDate} ${session.profile.appointmentTime}`;
    pendingAppointmentMessage = "";
    setScreen("chat");
    session.messages.push({ senderType: "customer", body: message, createdAt: new Date().toISOString() });
    session.messages.push({ senderType: "bot", body: confirmation, createdAt: new Date().toISOString() });
    saveSession();
    renderMessages();
  });

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const previousEmail = String(session.profile.email || "").trim().toLowerCase();
    syncProfileFromForm();
    const nextEmail = String(session.profile.email || "").trim().toLowerCase();
    if (previousEmail && previousEmail !== nextEmail) resetAppointmentSelection();
    if (!isProfileComplete()) {
      profileError.textContent = "Completa todos los campos obligatorios.";
      return;
    }
    profileError.textContent = "";
    session.profileComplete = true;
    saveSession();
    setScreen("chat");
  });

  async function handleSendClick() {
    const message = textarea.value.trim();
    if (!message || !session.profileComplete) return;
    if (wantsAppointment(message)) {
      pendingAppointmentMessage = message;
      textarea.value = "";
      setScreen("appointment");
      return;
    }
    await sendMessageToApi(message);
  }

  async function sendMessageToApi(message) {
    const now = new Date().toISOString();
    session.messages.push({ senderType: "customer", body: message, createdAt: now });
    textarea.value = "";
    renderMessages();
    setTyping(true, "bot");
    sendButton.disabled = true;
    sendButton.textContent = "Enviando...";
    try {
      const response = await fetch(`${api}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          channel,
          visitorId: session.visitorId,
          conversationId: session.conversationId,
          customer: session.profile,
          customerName: session.profile.name,
          customerPhone: session.profile.phone,
          customerEmail: session.profile.email,
          wooCustomerId: session.profile.wooCustomerId,
          wooCustomerToken: session.profile.wooCustomerToken,
          wooCustomerIssuedAt: session.profile.wooCustomerIssuedAt
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el mensaje");
      session.conversationId = data.conversationId || data.conversation?.id || session.conversationId;
      session.visitorId = data.visitorId || session.visitorId;
      session.messages = normalizeMessages(data.messages || []);
      if (panel.hidden) session.unread = (session.unread || 0) + 1;
      saveSession();
      renderMessages();
      updateBadge();
      setWidgetStatus("online");
    } catch (error) {
      setTyping(false);
      setWidgetStatus(navigator.onLine ? "reconnecting" : "offline");
      session.messages.push({ senderType: "system", body: error.message || "No se pudo contactar al asistente.", createdAt: new Date().toISOString() });
      if (panel.hidden) session.unread = (session.unread || 0) + 1;
      renderMessages();
      updateBadge();
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = "Enviar";
      saveSession();
    }
  }

  sendButton.addEventListener("click", handleSendClick);
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
    }
  });

  fillProfileForm();
  updateBadge();
  setScreen(session.profileComplete ? "chat" : "profile");
  loadWidgetConfig();
  startSyncLoop();
  syncConversation();
  saveSession();
})();
