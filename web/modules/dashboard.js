import { $ } from "./shared.js";

export function renderDashboard(appState, alerts) {
  $("#metric-conversations").textContent = appState.conversations.length;
  $("#metric-agents").textContent = appState.agents.filter((agent) => agent.online).length;
  $("#metric-faqs").textContent = appState.faqs.filter((faq) => faq.published).length;
  $("#metric-alerts").textContent = alerts;

  const counts = appState.conversations.reduce((acc, conversation) => {
    acc[conversation.status] = (acc[conversation.status] || 0) + 1;
    return acc;
  }, {});
  $("#metric-bot-active").textContent = counts.bot_active || 0;
  $("#metric-waiting-agent").textContent = counts.waiting_for_agent || 0;
  $("#metric-agent-active").textContent = counts.agent_active || 0;
  $("#metric-paused").textContent = counts.paused || 0;
  $("#metric-closed").textContent = counts.closed || 0;
}
