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
  if (isUsableKey(openaiKey)) {
    return {
      name: "openai",
      apiKey: openaiKey,
      model: openaiIntegration.model || DEFAULT_OPENAI_MODEL
    };
  }
  const claudeIntegration = await store.integrationConfig?.("claude");
  const claudeKey = claudeIntegration?.apiKey || claudeIntegration?.token;
  if (isUsableKey(claudeKey)) {
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
  const branches = currentState.branches.slice(0, 5).map((branch) => ({
    name: branch.name,
    city: branch.city,
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    services: branch.services,
    wholesaleContact: branch.wholesaleContact,
    hours: branch.hours
  }));
  const rules = currentState.routingRules.slice(0, 6).map((rule) => ({
    name: rule.name,
    intent: rule.intent,
    requiredSkill: rule.requiredSkill,
    botAllowed: rule.botAllowed,
    fallbackMessage: rule.fallbackMessage
  }));
  return {
    summary: {
      intent: routed.intent,
      marketplace: routed.marketplace,
      status: routed.status,
      faqs: faqs.length,
      branches: branches.length,
      rules: rules.length
    },
    prompt: [
      "Eres el asistente de Honey Whale / WhaleHub para atencion a clientes.",
      "Responde en espanol, claro y breve.",
      "Usa solamente la informacion de contexto. Si falta informacion, pide el dato necesario o canaliza a agente.",
      "No inventes telefonos, horarios, estados de pedidos, citas ni politicas.",
      "Si el ruteo indica agente o pausa, no prometas resolver: confirma la canalizacion.",
      "",
      `Mensaje del cliente: ${text || ""}`,
      `Ruteo detectado: ${JSON.stringify(routed)}`,
      `FAQs relevantes: ${JSON.stringify(faqs)}`,
      `Directorio: ${JSON.stringify(branches)}`,
      `Reglas: ${JSON.stringify(rules)}`
    ].join("\n")
  };
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
