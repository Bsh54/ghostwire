// The assistant loop: DeepSeek decides which paid tools to use, each tool call
// settles a real Hedera payment before running, and every step is streamed out.
import { chatCompletion } from "./llm.js";
import { AGENTS, TOOL_DEFS } from "./registry.js";
import { hire } from "./hire.js";
import { emitEvent } from "./bus.js";
import { canSpend, record } from "./budget.js";

const SYSTEM = `You are Wire, the Commander of Ghostwire — sharp, friendly and to the point.
You lead specialist agents that can do things you CANNOT do yourself, and you hire them
when needed (each hire is a tiny HBAR micro-payment settled on Hedera):
- Eagleton Skywatcher: scan a token's live market & risk (token_detective)
- Luna Mysticfang: live market sentiment, Fear & Greed + trending (defi_pulse)
- Ursus Guardian: profile a real Hedera account on-chain (wallet_profiler)
- Reynard Swift: live token price on SaucerSwap, Hedera's DEX (dex_quote)
- Corvus Messenger: gather real sources on a topic (deep_researcher)
- Athena Nightwing: largest recent HBAR whale moves (whale_watcher)
Always hire an agent for live data or on-chain facts — never guess prices, market data,
research or on-chain state from memory. For general knowledge or writing, just answer
directly. Be concise; use light Markdown when it helps. Not financial advice.`;

export async function runChat(userText, emit, agent, history = []) {
  const messages = [
    { role: "system", content: SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];
  const steps = [];
  let finalContent = "";

  for (let turn = 0; turn < 6; turn++) {
    let msg;
    try {
      msg = await chatCompletion(messages, TOOL_DEFS);
    } catch (e) {
      emit({ type: "chat-error", message: String(e.message || e) });
      return { content: "", steps };
    }
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length) {
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        const spec = AGENTS[name];
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
        if (!spec) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: "unknown agent" });
          continue;
        }

        emit({ type: "chat-step", phase: "start", tool: name, price: spec.price });

        // Guardrail: enforce the user's session budget cap before contacting the agent.
        if (!canSpend(agent.user, spec.price)) {
          emit({ type: "chat-step", phase: "blocked", tool: name, price: spec.price, reason: "session budget cap reached" });
          steps.push({ tool: name, price: spec.price, status: "blocked" });
          messages.push({ role: "tool", tool_call_id: tc.id, content: "payment blocked: the user's session budget cap was reached. Tell the user to raise the cap to continue." });
          continue;
        }

        // Contact the independent agent over x402: 402 -> pay on Hedera -> proof -> result.
        try {
          const out = await hire(spec.path, args, { client: agent.client, accountId: agent.accountId });
          record(agent.user, spec.price);
          emit({ type: "chat-step", phase: "paid", tool: name, price: spec.price, hashscan: out.hashscan, txId: out.txId, from: agent.accountId });
          steps.push({ tool: name, price: spec.price, hashscan: out.hashscan, status: "paid" });
          emitEvent({ type: "payment", from: agent.accountId, to: name, amount: spec.price, hashscan: out.hashscan, service: name });
          emit({ type: "chat-step", phase: "done", tool: name });
          messages.push({ role: "tool", tool_call_id: tc.id, content: String(out.result).slice(0, 4000) });
        } catch (e) {
          const m = String(e.message || e);
          const funds = /INSUFFICIENT_ACCOUNT_BALANCE|INSUFFICIENT_PAYER_BALANCE/.test(m);
          emit({ type: "chat-step", phase: "error", tool: name, message: funds ? "agent budget exhausted (on-chain limit reached)" : m });
          messages.push({ role: "tool", tool_call_id: tc.id, content: funds ? "payment declined: the agent has no funds left" : "hiring the agent failed" });
        }
      }
      continue; // let the model use the tool results
    }

    finalContent = msg.content || "";
    emit({ type: "chat-final", content: finalContent });
    return { content: finalContent, steps };
  }
  finalContent = "I stopped after several steps to stay safe.";
  emit({ type: "chat-final", content: finalContent });
  return { content: finalContent, steps };
}
