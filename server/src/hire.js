// The x402 client used by the buyer (Wire): contacts an independent agent over
// HTTP, receives 402, pays on Hedera, then retries with the payment proof.
import { payFrom } from "./pay.js";

const BASE = process.env.AGENTS_BASE_URL || "http://127.0.0.1:3006";

// buyer = { client, accountId }
export async function hire(agentPath, args, buyer) {
  // 1. Contact the agent — expect a 402 with payment requirements.
  const r1 = await fetch(`${BASE}/${agentPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args }),
  });
  if (r1.status !== 402) {
    const j = await r1.json().catch(() => ({}));
    return { result: j.result ?? "(agent did not require payment)", txId: null, hashscan: null, amount: 0 };
  }
  const req = await r1.json();
  const terms = (req.accepts || [])[0] || {};
  const payTo = terms.payTo;
  const amount = Number(terms.amount);
  if (!payTo || !amount) throw new Error("invalid payment terms from agent");

  // 2. Pay the agent on Hedera, from the buyer's own account.
  const pay = await payFrom(buyer.client, buyer.accountId, payTo, amount);
  if (!pay.ok) throw new Error("payment failed");

  // 3. Retry with the proof — the agent verifies it on-chain, then delivers.
  const r2 = await fetch(`${BASE}/${agentPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": pay.txId },
    body: JSON.stringify({ args }),
  });
  const data = await r2.json().catch(() => ({}));
  if (r2.status !== 200) throw new Error(data.error || "agent rejected payment");
  return { result: data.result, txId: pay.txId, hashscan: pay.hashscan, amount };
}
