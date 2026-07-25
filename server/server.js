// Ghostwire server: serves the web app, exposes the marketplace API and an
// x402-protected demo endpoint, and streams live payment events over WebSocket.
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { SERVICES, getService } from "./src/marketplace.js";
import { paymentRequired, verifyPayment } from "./src/x402.js";
import { bus, recentEvents } from "./src/bus.js";
import { agentList, topic, startEconomy } from "./src/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3005;

const app = express();
app.use(express.json());

// --- API ---
app.get("/api/state", (_req, res) => {
  res.json({ agents: agentList(), services: SERVICES, topicId: topic(), recent: recentEvents() });
});

// --- x402-protected demo endpoint (a live paywall you can call by hand) ---
app.get("/api/service/:id", async (req, res) => {
  const svc = getService(req.params.id);
  if (!svc) return res.status(404).json({ error: "unknown service" });

  const provider = agentList().find((a) => a.symbol === svc.provider);
  const proof = req.header("X-Payment");

  if (!proof) {
    return res.status(402).json(
      paymentRequired({
        payTo: provider.accountId,
        amountHbar: svc.priceHbar,
        resource: `/api/service/${svc.id}`,
        description: svc.description,
      })
    );
  }

  const v = await verifyPayment({ txId: proof, payTo: provider.accountId, amountHbar: svc.priceHbar });
  if (!v.ok) return res.status(402).json({ error: "payment not verified", reason: v.reason });

  res.json({ service: svc.id, delivered: true, result: `Result of ${svc.name}`, settledAt: v.consensusAt });
});

// --- static web app ---
app.use(express.static(path.resolve(__dirname, "../web")));

// --- websocket live feed ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "snapshot", agents: agentList(), topicId: topic(), recent: recentEvents() }));
});
bus.on("event", (evt) => {
  const msg = JSON.stringify({ type: "event", event: evt });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
});

server.listen(PORT, () => {
  console.log(`Ghostwire server on :${PORT}`);
  startEconomy(4000);
});
