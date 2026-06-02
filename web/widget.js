(function () {
  const currentScript = document.currentScript;
  const api = currentScript?.dataset.hwhubApi || "";
  const channel = currentScript?.dataset.channel || "web_widget";
  const storageKey = `hwhub-widget:${api || location.origin}:${channel}`;

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        visitorId: saved.visitorId || crypto.randomUUID(),
        conversationId: saved.conversationId || "",
        profile: {
          name: currentScript?.dataset.customerName || saved.profile?.name || "",
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
      return { visitorId: crypto.randomUUID(), conversationId: "", profile: {}, messages: [] };
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

  const session = loadSession();

  const button = document.createElement("button");
  button.className = "hwhub-widget-button";
  button.type = "button";
  button.setAttribute("aria-label", "Abrir chat");
  button.textContent = "Chat";

  const panel = document.createElement("section");
  panel.className = "hwhub-widget-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header>
      <strong>Honey Whale</strong>
      <p>Atencion por chatbot y agentes</p>
    </header>
    <div class="hwhub-widget-body">
      <form id="hwhub-widget-profile" class="hwhub-widget-profile">
        <input id="hwhub-widget-name" placeholder="Nombre" autocomplete="name">
        <input id="hwhub-widget-phone" placeholder="Telefono o WhatsApp" autocomplete="tel">
        <input id="hwhub-widget-email" placeholder="Email para cita" autocomplete="email">
      </form>
      <div id="hwhub-widget-messages" class="hwhub-widget-messages"></div>
      <div class="hwhub-widget-compose">
        <textarea id="hwhub-widget-message" placeholder="Escribe tu pregunta"></textarea>
        <button id="hwhub-widget-send" type="button">Enviar</button>
      </div>
    </div>
  `;

  document.body.append(panel, button);

  const messages = panel.querySelector("#hwhub-widget-messages");
  const nameInput = panel.querySelector("#hwhub-widget-name");
  const phoneInput = panel.querySelector("#hwhub-widget-phone");
  const emailInput = panel.querySelector("#hwhub-widget-email");
  const textarea = panel.querySelector("#hwhub-widget-message");
  const sendButton = panel.querySelector("#hwhub-widget-send");

  nameInput.value = session.profile.name || "";
  phoneInput.value = session.profile.phone || "";
  emailInput.value = session.profile.email || "";

  function renderMessages() {
    const items = session.messages.length ? session.messages : [
      { senderType: "bot", body: "Hola, puedo ayudarte con pedidos, citas, productos, sucursales o canalizarte con un agente." }
    ];
    messages.innerHTML = items
      .slice(-30)
      .map((message) => `
        <article class="hwhub-widget-message ${esc(message.senderType)}">
          ${esc(message.body)}
        </article>
      `)
      .join("");
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

  function syncProfile() {
    session.profile.name = nameInput.value.trim();
    session.profile.phone = phoneInput.value.trim();
    session.profile.email = emailInput.value.trim();
    saveSession();
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      renderMessages();
      textarea.focus();
    }
  });

  nameInput.addEventListener("input", syncProfile);
  phoneInput.addEventListener("input", syncProfile);
  emailInput.addEventListener("input", syncProfile);

  async function sendMessage() {
    const message = textarea.value.trim();
    if (!message) return;
    syncProfile();
    session.messages.push({ senderType: "customer", body: message });
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
        body: item.body
      }));
      saveSession();
      renderMessages();
    } catch (error) {
      setTyping(false);
      session.messages.push({ senderType: "system", body: error.message || "No se pudo contactar al asistente." });
      renderMessages();
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

  renderMessages();
  saveSession();
})();
