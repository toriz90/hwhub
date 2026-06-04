const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

export async function generateBotReply({ text, routed, currentState, store }) {
  const provider = await resolveProvider(store);
  const context = buildContext({ text, routed, currentState });

  if (provider.name === "openai" && provider.apiKey) {
    return callOpenAI(provider, context);
  }

  if (provider.name === "claude" && provider.apiKey) {
    return callClaude(provider, context);
  }

  return {
    provider: "mock",
    reply: mockReply({ text, routed, currentState }),
    usedContext: context.summary
  };
}

async function resolveProvider(store) {
  const configured = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (configured === "openai") {
    const integration = await store.integrationConfig?.("openai");
    return {
      name: "openai",
      apiKey: integration?.apiKey || integration?.token || process.env.OPENAI_API_KEY,
      model: integration?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
    };
  }
  if (configured === "claude" || configured === "anthropic") {
    const integration = await store.integrationConfig?.("claude");
    return {
      name: "claude",
      apiKey: integration?.apiKey || integration?.token || process.env.ANTHROPIC_API_KEY,
      model: integration?.model || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
    };
  }
  const openaiIntegration = await store.integrationConfig?.("openai");
  const openaiKey = openaiIntegration?.apiKey || openaiIntegration?.token;
  if (openaiIntegration?.useForChat === true && isUsableKey(openaiKey)) {
    return {
      name: "openai",
      apiKey: openaiKey,
      model: openaiIntegration.model || DEFAULT_OPENAI_MODEL
    };
  }
  const claudeIntegration = await store.integrationConfig?.("claude");
  const claudeKey = claudeIntegration?.apiKey || claudeIntegration?.token;
  if (claudeIntegration?.useForChat === true && isUsableKey(claudeKey)) {
    return {
      name: "claude",
      apiKey: claudeKey,
      model: claudeIntegration.model || DEFAULT_ANTHROPIC_MODEL
    };
  }
  return { name: "mock" };
}

function isUsableKey(value) {
  const key = String(value || "").trim();
  return key.length > 12 && !["...", "test", "placeholder", "changeme"].includes(key.toLowerCase());
}

function buildContext({ text, routed, currentState }) {
  const settings = currentState.chatbotSettings || {};
  const normalized = String(text || "").toLowerCase();
  const faqs = currentState.faqs
    .filter((faq) => faq.published !== false)
    .map((faq) => ({
      question: faq.question,
      shortAnswer: faq.shortAnswer,
      longAnswer: faq.longAnswer,
      category: faq.category,
      score: (faq.tags || []).filter((tag) => normalized.includes(String(tag).toLowerCase())).length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const branches = selectRelevantBranches(currentState.branches || [], normalized).map((branch) => ({
    name: branch.name,
    state: branch.state,
    city: branch.city,
    municipality: branch.municipality,
    colony: branch.colony,
    address: branch.address,
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    services: branch.services,
    wholesaleContact: branch.wholesaleContact,
    hours: branch.hours
  }));
  const directoryContacts = selectRelevantContacts(currentState.directoryContacts || [], normalized).map((contact) => ({
    area: contact.area,
    name: contact.name,
    whatsapp: contact.whatsapp,
    email: contact.email,
    schedule: contact.schedule,
    description: contact.description,
    channels: contact.channels,
    intents: contact.intents,
    marketplaces: contact.marketplaces,
    skills: contact.skills
  }));
  const rules = currentState.routingRules.slice(0, 6).map((rule) => ({
    name: rule.name,
    intent: rule.intent,
    requiredSkill: rule.requiredSkill,
    botAllowed: rule.botAllowed,
    fallbackMessage: rule.fallbackMessage
  }));
  const connectorContext = currentState.connectorContext || {};
  const history = (currentState.conversationHistory || []).slice(-10).map((message) => ({
    sender: message.senderType,
    body: message.body,
    at: message.createdAt
  }));
  return {
    temperature: Number(settings.temperature ?? 0.3),
    summary: {
      intent: routed.intent,
      marketplace: routed.marketplace,
      status: routed.status,
      faqs: faqs.length,
      branches: branches.length,
      rules: rules.length,
      products: connectorContext.products?.total || 0,
      customerOrders: connectorContext.customerOrders?.total || 0,
      wooCustomerAuthenticated: Boolean(connectorContext.wooCustomerAuthenticated),
      wooCustomerAuthRequired: Boolean(connectorContext.wooCustomerAuthRequired),
      appointmentServices: connectorContext.appointments?.total || 0,
      directoryContacts: directoryContacts.length,
      order: connectorContext.order?.number || null,
      shipment: connectorContext.shipment?.trackingNumber || null,
      connectorErrors: connectorContext.errors?.length || 0
    },
    prompt: [
      settings.prompt || "Eres el asistente de Honey Whale / WhaleHub para atencion a clientes.",
      "Responde en espanol, claro y breve.",
      "Usa solamente la informacion de contexto. Si falta informacion, pide el dato necesario o canaliza a agente.",
      "No inventes telefonos, horarios, estados de pedidos, citas ni politicas.",
      "Si hay productos de WooCommerce, puedes mencionar precio, disponibilidad y enlace cuando exista.",
      "Si hay datos de pedido WooCommerce, responde con el estatus real del pedido y no digas que lo revisaras despues.",
      "Si customerOrders existe porque el cliente esta logueado y autenticado, puedes mencionar sus pedidos recientes y pedir que confirme cual desea revisar si hay varios.",
      "Si wooCustomerAuthRequired es true, no muestres pedidos por email o id de cliente; solicita numero de pedido, telefono o correo para validar manualmente.",
      "Si hay datos de TrackShip, menciona estatus de envio, guia y URL de seguimiento cuando exista.",
      "Si el perfil del cliente ya tiene nombre, telefono o email, no vuelvas a pedir esos datos.",
      "Si customerProfile.appointmentFolio existe, ese es el folio oficial de cita de Easy!Appointments; puedes mostrarlo, pero nunca inventes uno.",
      "Si customerProfile.appointmentConfirmedAt existe y el mensaje actual no pide explicitamente otra cita, NO sigas pidiendo datos de cita; responde normalmente al mensaje actual.",
      "Cuando respondas sobre sucursales, centros de servicio, direcciones o telefonos, usa este formato profesional y facil de leer:",
      "**Sucursal recomendada**",
      "- Nombre: nombre exacto",
      "- Ubicacion: colonia, municipio, estado",
      "- Direccion: direccion registrada o 'Dato no registrado'",
      "- WhatsApp: numero registrado o 'Dato no registrado'",
      "- Telefono: numero registrado o 'Dato no registrado'",
      "- Horario: horario registrado o 'Dato no registrado'",
      "- Servicios: servicios registrados o 'Dato no registrado'",
      "Cierra con una pregunta breve de seguimiento. No escribas todos los datos en un solo parrafo.",
      "Para citas usa appointmentState. Si appointmentState.canCreate es false, NO digas 'agendado', 'reservado' ni 'confirmado'. Solo pide los campos faltantes de appointmentState.missing.",
      "Si appointmentState.confirmed es true, considera cerrado el flujo de cita y no pidas campos faltantes.",
      "Si hay servicios de Easy!Appointments, puedes ofrecer iniciar la agenda, pero solo confirma una cita cuando appointmentState.canCreate sea true y exista confirmacion de la API.",
      "Usa el historial para mantener el hilo. Si el cliente pregunta 'por que no respondes' o continua una frase, asume que habla del tema vigente.",
      "Si el ruteo indica agente o pausa, no prometas resolver: confirma la canalizacion.",
      "",
      `Historial reciente: ${JSON.stringify(history)}`,
      `Mensaje del cliente: ${text || ""}`,
      `Ruteo detectado: ${JSON.stringify(routed)}`,
      `FAQs relevantes: ${JSON.stringify(faqs)}`,
      `Directorio: ${JSON.stringify(branches)}`,
      `Directorio de contactos por canalizacion: ${JSON.stringify(directoryContacts)}`,
      `Reglas: ${JSON.stringify(rules)}`,
      `Contexto externo de APIs: ${JSON.stringify(connectorContext)}`
    ].join("\n")
  };
}

function selectRelevantContacts(contacts = [], normalizedText = "") {
  const terms = normalizedText
    .split(/[^a-z0-9áéíóúñü]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  return [...contacts]
    .map((contact, index) => {
      const haystack = [
        contact.area,
        contact.name,
        contact.email,
        contact.whatsapp,
        contact.schedule,
        contact.description,
        (contact.channels || []).join(" "),
        (contact.intents || []).join(" "),
        (contact.marketplaces || []).join(" "),
        (contact.skills || []).join(" ")
      ].join(" ").toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { contact, score, index };
    })
    .sort((left, right) => right.score - left.score || Number(left.contact.priority || 100) - Number(right.contact.priority || 100) || left.index - right.index)
    .slice(0, 12)
    .map((item) => item.contact);
}

function selectRelevantBranches(branches = [], normalizedText = "") {
  const terms = normalizedText
    .split(/[^a-z0-9áéíóúñü]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  return [...branches]
    .map((branch, index) => {
      const haystack = [
        branch.name,
        branch.state,
        branch.city,
        branch.municipality,
        branch.colony,
        branch.address,
        branch.phone,
        branch.whatsapp,
        branch.email,
        branch.hours,
        (branch.services || []).join(" ")
      ].join(" ").toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { branch, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 24)
    .map((item) => item.branch);
}

function mockReply({ text, routed, currentState }) {
  if (routed.reply) return routed.reply;
  const normalized = String(text || "").toLowerCase();
  const faq = currentState.faqs.find((item) => (item.tags || []).some((tag) => normalized.includes(String(tag).toLowerCase())));
  return faq?.shortAnswer || "Puedo ayudarte con pedidos, FAQs, sucursales o canalizarte con un agente.";
}

async function callOpenAI(provider, context) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      instructions: "Responde como agente de soporte de WhaleHub con tono claro, util y prudente.",
      input: context.prompt,
      temperature: context.temperature ?? 0.3,
      max_output_tokens: 350
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed");
  return {
    provider: "openai",
    model: provider.model,
    reply: data.output_text || extractOpenAIText(data) || "No pude generar una respuesta en este momento.",
    usedContext: context.summary
  };
}

function extractOpenAIText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" || item.type === "text")
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n");
}

async function callClaude(provider, context) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 350,
      temperature: context.temperature ?? 0.3,
      system: "Responde como agente de soporte de WhaleHub con tono claro, util y prudente.",
      messages: [{ role: "user", content: context.prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Anthropic request failed");
  return {
    provider: "claude",
    model: provider.model,
    reply: (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n") || "No pude generar una respuesta en este momento.",
    usedContext: context.summary
  };
}
