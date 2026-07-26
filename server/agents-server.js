// Independent agents service. Each agent is a real HTTP endpoint behind an
// x402 paywall: request -> 402 with payment requirements -> caller pays on
// Hedera -> caller retries with the X-PAYMENT proof -> the agent verifies the
// payment on the mirror node itself, then delivers. Runs as its own process.
import express from "express";
import { AGENTS } from "./src/registry.js";
import { CAPS } from "./src/capabilities.js";
import { verifyPayment } from "./src/x402.js";
import { NETWORK } from "./src/hedera.js";

const app = express();
app.use(express.json());
const PORT = process.env.AGENTS_PORT || 3006;

const usedProofs = new Set(); // replay protection

app.get("/", (_req, res) =>
  res.json({ service: "ghostwire-agents", network: NETWORK, agents: Object.keys(AGENTS) }));

for (const [key, agent] of Object.entries(AGENTS)) {
  app.post(`/${agent.path}`, async (req, res) => {
    const proof = req.header("X-PAYMENT");

    // No payment yet: return the x402 payment requirements.
    if (!proof) {
      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: "exact",
          network: `hedera-${NETWORK}`,
          asset: "HBAR",
          amount: agent.price,
          payTo: agent.account,
          resource: `/${agent.path}`,
          description: agent.def.function.description,
        }],
      });
    }

    // Payment presented: verify it on-chain, ourselves, before delivering.
    if (usedProofs.has(proof)) return res.status(402).json({ error: "payment already used" });
    const v = await verifyPayment({ txId: proof, payTo: agent.account, amountHbar: agent.price });
    if (!v.ok) return res.status(402).json({ error: "payment not verified", reason: v.reason });
    usedProofs.add(proof);

    let result;
    try { result = await CAPS[key](req.body.args || {}); }
    catch (e) { result = "(agent error: " + (e.message || e) + ")"; }

    res.setHeader("X-PAYMENT-RESPONSE", Buffer.from(JSON.stringify({ txId: proof, settled: true })).toString("base64"));
    res.json({ result });
  });
}

app.listen(PORT, () => console.log(`Ghostwire agents service on :${PORT}`));
