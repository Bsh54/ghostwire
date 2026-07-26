// The assistant loop: DeepSeek decides which paid tools to use, each tool call
// settles a real Hedera payment before running, and every step is streamed out.
import { chatCompletion } from "./llm.js";
import { TOOLS, TOOL_DEFS } from "./tools.js";
import { payProvider } from "./pay.js";
import { emitEvent } from "./bus.js";

const SYSTEM = `You are Ghostwire, an assistant that gets things done by hiring paid tools.
Each tool call costs a tiny HBAR micro-payment, settled automatically on the Hedera network.
Use tools when they genuinely help; otherwise answer directly. Keep replies concise and clear.`;

const AUTO_APPROVE_LIMIT = 0.1; // HBAR; above this, a real product would ask the user.

export async function runChat(userText, emit) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userText },
  ];

  for (let turn = 0; turn < 6; turn++) {
    let msg;
    try {
      msg = await chatCompletion(messages, TOOL_DEFS);
    } catch (e) {
      emit({ type: "chat-error", message: String(e.message || e) });
      return;
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

        // Settle the real on-chain payment for this tool call.
        let pay;
        try {
          pay = await payProvider(tool.provider, tool.price);
        } catch (e) {
          emit({ type: "chat-step", phase: "error", tool: name, message: String(e.message || e) });
          messages.push({ role: "tool", tool_call_id: tc.id, content: "payment failed" });
          continue;
        }
        emit({ type: "chat-step", phase: "paid", tool: name, price: tool.price, hashscan: pay.hashscan, txId: pay.txId });
        emitEvent({ type: "payment", from: "YOU", to: name, amount: tool.price, hashscan: pay.hashscan, service: name });

        // Run the actual service work.
        let result;
        try { result = await tool.run(args); } catch (e) { result = "(service error: " + e.message + ")"; }
        emit({ type: "chat-step", phase: "done", tool: name });
        messages.push({ role: "tool", tool_call_id: tc.id, content: String(result).slice(0, 4000) });
      }
      continue; // let the model use the tool results
    }

    emit({ type: "chat-final", content: msg.content || "" });
    return;
  }
  emit({ type: "chat-final", content: "I stopped after several steps to stay safe." });
}
