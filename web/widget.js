(function () {
  const currentScript = document.currentScript;
  const api = currentScript?.dataset.hwhubApi || "";
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
  let widgetConfig = {
    title: "Honey Whale",
    subtitle: "Atencion por chatbot y agentes",
    welcome: "Hola, completa tus datos y cuentame en que puedo ayudarte.",
    buttonLabel: "Chat",
    headerColor: "#111b25",
    accentColor: "#e84c70",
    botBubbleColor: "#e8f6f4",
    userBubbleColor: "#111b25"
  };
  session.profileComplete = session.profileComplete && isProfileComplete();

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
        <p>Selecciona servicio, proveedor, fecha y horario disponible.</p>
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
  let appointmentOptions = null;
  let pendingAppointmentMessage = "";

  async function loadWidgetConfig() {
    try {
      const response = await fetch(`${api}/api/widget-config`);
      if (!response.ok) return;
      widgetConfig = { ...widgetConfig, ...(await response.json()) };
      button.querySelector("span").textContent = widgetConfig.buttonLabel || "Chat";
      title.textContent = widgetConfig.title || "Honey Whale";
      subtitle.textContent = widgetConfig.subtitle || "";
      panel.style.setProperty("--hwhub-widget-header", widgetConfig.headerColor || "#111b25");
      panel.style.setProperty("--hwhub-widget-accent", widgetConfig.accentColor || "#e84c70");
      panel.style.setProperty("--hwhub-widget-bot", widgetConfig.botBubbleColor || "#e8f6f4");
      panel.style.setProperty("--hwhub-widget-user", widgetConfig.userBubbleColor || "#111b25");
      button.style.background = widgetConfig.accentColor || "#e84c70";
      renderMessages();
    } catch {}
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
    fillAppointmentForm();
  }

  function fillAppointmentForm() {
    for (const input of appointmentForm.querySelectorAll("[data-appointment-field]")) {
      if (["appointmentProviderId", "sourceValue", "equipmentModel"].includes(input.dataset.appointmentField)) continue;
      input.value = session.profile[input.dataset.appointmentField] || "";
    }
    updateProviderOptions(session.profile.appointmentProviderId || "");
    updateSourceValueOptions(session.profile.sourceValue || "");
    updateModelOptions(session.profile.equipmentModel || "");
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

  function optionList(items = [], selectedValue = "") {
    const values = items.map((item) => typeof item === "string" ? { value: item, label: item } : {
      value: item.value ?? item.id ?? item.name ?? "",
      label: item.label ?? item.name ?? item.value ?? item.id ?? ""
    }).filter((item) => String(item.value).trim());
    const hasSelected = selectedValue && !values.some((item) => String(item.value) === String(selectedValue));
    const normalized = hasSelected ? [{ value: selectedValue, label: selectedValue }, ...values] : values;
    return `<option value="">Seleccionar</option>` + normalized
      .map((item) => `<option value="${esc(item.value)}"${String(item.value) === String(selectedValue) ? " selected" : ""}>${esc(item.label)}</option>`)
      .join("");
  }

  function updateProviderOptions(selectedValue = "") {
    if (!appointmentOptions) return;
    const serviceId = Number(appointmentForm.querySelector('[data-appointment-field="appointmentServiceId"]').value);
    const providerSelect = appointmentForm.querySelector('[data-appointment-field="appointmentProviderId"]');
    const currentValue = selectedValue || providerSelect.value || session.profile.appointmentProviderId || "";
    const providers = (appointmentOptions.providers || []).filter((provider) => !serviceId || (provider.services || []).includes(serviceId));
    providerSelect.innerHTML = optionList(providers.map((provider) => ({ value: provider.id, label: provider.name })), currentValue);
  }

  function updateSourceValueOptions(selectedValue = "") {
    if (!appointmentOptions) return;
    const type = appointmentForm.querySelector('[data-appointment-field="sourceType"]').value;
    const sourceSelect = appointmentForm.querySelector('[data-appointment-field="sourceValue"]');
    const currentValue = selectedValue || sourceSelect.value || session.profile.sourceValue || "";
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
      date: session.profile.appointmentDate
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
      appointmentError.textContent = "Horarios disponibles cargados.";
      return;
    }
    timeSelect.innerHTML = `<option value="">Sin horarios</option>`;
    const next = result.nextAvailable;
    if (next?.date) {
      appointmentError.textContent = `${result.message} Proxima fecha disponible: ${next.date}.`;
      appointmentForm.querySelector('[data-appointment-field="appointmentDate"]').value = next.date;
      timeSelect.innerHTML = `<option value="">Seleccionar</option>` + (next.slots || [])
        .map((slot) => `<option value="${esc(slot)}">${esc(slot)}</option>`)
        .join("");
    } else {
      appointmentError.textContent = result.message || "No hay disponibilidad cercana.";
    }
  }

  function updateBadge() {
    badge.textContent = String(session.unread || 0);
    badge.hidden = !session.unread;
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
  cancelAppointment.addEventListener("click", () => {
    pendingAppointmentMessage = "";
    setScreen("chat");
  });

  appointmentForm.addEventListener("change", async (event) => {
    if (event.target?.dataset?.appointmentField === "appointmentServiceId") {
      updateProviderOptions();
    }
    if (event.target?.dataset?.appointmentField === "sourceType") {
      session.profile.sourceValue = "";
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
      appointmentError.textContent = "Completa servicio, proveedor, fecha, hora, origen y modelo.";
      return;
    }
    const service = appointmentOptions?.services?.find((item) => String(item.id) === String(session.profile.appointmentServiceId));
    const provider = appointmentOptions?.providers?.find((item) => String(item.id) === String(session.profile.appointmentProviderId));
    const source = `${session.profile.sourceType}: ${session.profile.sourceValue}`;
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
    pendingAppointmentMessage = "";
    setScreen("chat");
    await sendMessageToApi(message);
  });

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
  saveSession();
})();
