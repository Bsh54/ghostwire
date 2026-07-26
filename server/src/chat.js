// The assistant loop: DeepSeek decides which paid tools to use, each tool call
// settles a real Hedera payment before running, and every step is streamed out.
import { chatCompletion } from "./llm.js";
import { TOOLS, TOOL_DEFS } from "./tools.js";
import { payFrom } from "./pay.js";
import { emitEvent } from "./bus.js";

const SYSTEM = `You are Wire, the Ghostwire assistant — sharp, friendly and to the point.
You get things done by hiring paid tools; each tool call costs a tiny HBAR micro-payment
settled automatically on Hedera. Use tools when they genuinely help; otherwise answer directly.
Keep replies concise and use light Markdown (bold, short lists) when it improves clarity.`;

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
        const tool = TOOLS[name];
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
        if (!tool) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: "unknown tool" });
          continue;
        }

        emit({ type: "chat-step", phase: "start", tool: name, price: tool.price });

        // Settle the real on-chain payment from the user's own agent account.
        let pay;
        try {
          pay = await payFrom(agent.client, agent.accountId, tool.provider, tool.price);
        } catch (e) {
          const msg = String(e.message || e);
          const funds = /INSUFFICIENT_ACCOUNT_BALANCE|INSUFFICIENT_PAYER_BALANCE/.test(msg);
          emit({ type: "chat-step", phase: "error", tool: name, message: funds ? "agent budget exhausted (on-chain limit reached)" : msg });
          messages.push({ role: "tool", tool_call_id: tc.id, content: funds ? "payment declined: the agent has no funds left" : "payment failed" });
          continue;
        }
        emit({ type: "chat-step", phase: "paid", tool: name, price: tool.price, hashscan: pay.hashscan, txId: pay.txId, from: agent.accountId });
        steps.push({ tool: name, price: tool.price, hashscan: pay.hashscan, status: "paid" });
        emitEvent({ type: "payment", from: agent.accountId, to: name, amount: tool.price, hashscan: pay.hashscan, service: name });

        // Run the actual service work.
        let result;
        try { result = await tool.run(args); } catch (e) { result = "(service error: " + e.message + ")"; }
        emit({ type: "chat-step", phase: "done", tool: name });
        messages.push({ role: "tool", tool_call_id: tc.id, content: String(result).slice(0, 4000) });
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
