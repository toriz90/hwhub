(function () {
  const currentScript = document.currentScript;
  const api = currentScript?.dataset.hwhubApi || "";
  const channel = currentScript?.dataset.channel || "web_widget";

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
      <p id="hwhub-widget-reply">Hola, puedo ayudarte con pedidos, citas, sucursales, FAQs o canalizarte con un agente.</p>
      <textarea id="hwhub-widget-message" placeholder="Escribe tu pregunta"></textarea>
      <button id="hwhub-widget-send" type="button">Enviar</button>
    </div>
  `;

  document.body.append(panel, button);

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  panel.querySelector("#hwhub-widget-send").addEventListener("click", async () => {
    const textarea = panel.querySelector("#hwhub-widget-message");
    const reply = panel.querySelector("#hwhub-widget-reply");
    const message = textarea.value.trim();
    if (!message) return;
    reply.textContent = "Consultando...";
    const response = await fetch(`${api}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, channel, customer: "Widget" })
    });
    const data = await response.json();
    reply.textContent = data.reply;
    textarea.value = "";
  });
})();
