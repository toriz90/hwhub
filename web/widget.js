(function () {
  const currentScript = document.currentScript;
  const api = currentScript?.dataset.hwhubApi || "";
  const channel = currentScript?.dataset.channel || "web_widget";
  const storageKey = `hwhub-widget:${api || location.origin}:${channel}`;
  const requiredFields = ["firstName", "lastName", "email", "phone", "marketplace", "serviceCenter", "distributor", "equipmentModel"];

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
          serviceCenter: currentScript?.dataset.serviceCenter || saved.profile?.serviceCenter || "",
          marketplace: currentScript?.dataset.marketplace || saved.profile?.marketplace || "",
          distributor: currentScript?.dataset.distributor || saved.profile?.distributor || "",
          equipmentModel: currentScript?.dataset.equipmentModel || saved.profile?.equipmentModel || "",
          serialNumber: currentScript?.dataset.serialNumber || saved.profile?.serialNumber || "",
          orderNumber: currentScript?.dataset.orderNumber || saved.profile?.orderNumber || "",
          details: saved.profile?.details || ""
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

  function isProfileComplete() {
    return requiredFields.every((key) => String(session.profile[key] || "").trim());
  }

  const session = loadSession();
  session.profileComplete = session.profileComplete && isProfileComplete();

  const button = document.createElement("button");
  button.className = "hwhub-widget-button";
  button.type = "button";
  button.setAttribute("aria-label", "Abrir chat");
  button.innerHTML = `<span>Chat</span><strong id="hwhub-widget-badge" hidden>0</strong>`;

  const panel = document.createElement("section");
  panel.className = "hwhub-widget-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header>
      <div>
        <strong>Honey Whale</strong>
        <p>Atencion por chatbot y agentes</p>
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
          <label>Marketplace *<input data-profile-field="marketplace" required placeholder="Pagina oficial, Amazon, MercadoLibre..."></label>
          <label>Sucursal / centro de servicio *<input data-profile-field="serviceCenter" required placeholder="Centro de servicio o sucursal"></label>
          <label>Distribuidor *<input data-profile-field="distributor" required placeholder="Honey Whale, distribuidor, marketplace"></label>
          <label>Modelo del equipo *<input data-profile-field="equipmentModel" required placeholder="Modelo"></label>
          <label>Numero de serie<input data-profile-field="serialNumber"></label>
          <label>Numero de pedido<input data-profile-field="orderNumber"></label>
        </div>
        <label>Detalles<textarea data-profile-field="details" placeholder="Describe brevemente tu solicitud"></textarea></label>
        <button type="submit">Continuar al chat</button>
        <p id="hwhub-widget-profile-error" class="hwhub-widget-error"></p>
      </form>
      <section id="hwhub-widget-chat" class="hwhub-widget-chat-screen" hidden>
        <div id="hwhub-widget-messages" class="hwhub-widget-messages"></div>
        <div class="hwhub-widget-compose">
          <textarea id="hwhub-widget-message" placeholder="Escribe tu pregunta"></textarea>
          <button id="hwhub-widget-send" type="button">Enviar</button>
        </div>
      </section>
    </div>
  `;

  document.body.append(panel, button);

  const badge = panel.ownerDocument.querySelector("#hwhub-widget-badge");
  const profileForm = panel.querySelector("#hwhub-widget-profile");
  const profileError = panel.querySelector("#hwhub-widget-profile-error");
  const chatScreen = panel.querySelector("#hwhub-widget-chat");
  const messages = panel.querySelector("#hwhub-widget-messages");
  const textarea = panel.querySelector("#hwhub-widget-message");
  const sendButton = panel.querySelector("#hwhub-widget-send");
  const editProfile = panel.querySelector("#hwhub-widget-edit-profile");

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

  function setScreen(screen) {
    const showChat = screen === "chat" && session.profileComplete;
    profileForm.hidden = showChat;
    chatScreen.hidden = !showChat;
    editProfile.hidden = !showChat;
    if (showChat) {
      renderMessages();
      textarea.focus();
    } else {
      fillProfileForm();
    }
  }

  function updateBadge() {
    badge.textContent = String(session.unread || 0);
    badge.hidden = !session.unread;
  }

  function renderMessages() {
    const items = session.messages.length ? session.messages : [
      { senderType: "bot", body: "Hola, completa tus datos y cuentame en que puedo ayudarte.", createdAt: new Date().toISOString() }
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
          <p>${esc(message.body)}</p>
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
    if (!panel.hidden) {
      session.unread = 0;
      saveSession();
      updateBadge();
      setScreen(session.profileComplete ? "chat" : "profile");
    }
  });

  editProfile.addEventListener("click", () => setScreen("profile"));

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    syncProfileFromForm();
    if (!isProfileComplete()) {
      profileError.textContent = "Completa todos los campos obligatorios.";
      return;
    }
    profileError.textContent = "";
    session.profileComplete = true;
    saveSession();
    setScreen("chat");
  });

  async function sendMessage() {
    const message = textarea.value.trim();
    if (!message || !session.profileComplete) return;
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
          wooCustomerId: session.profile.wooCustomerId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el mensaje");
      session.conversationId = data.conversationId || data.conversation?.id || session.conversationId;
      session.visitorId = data.visitorId || session.visitorId;
      session.messages = (data.messages || []).map((item) => ({
        senderType: item.senderType,
        body: item.body,
        createdAt: item.createdAt || new Date().toISOString()
      }));
      if (panel.hidden) session.unread = (session.unread || 0) + 1;
      saveSession();
      renderMessages();
      updateBadge();
    } catch (error) {
      setTyping(false);
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

  sendButton.addEventListener("click", sendMessage);
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  fillProfileForm();
  updateBadge();
  setScreen(session.profileComplete ? "chat" : "profile");
  saveSession();
})();
