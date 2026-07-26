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
import { agentList, topic } from "./src/agents.js";
import { runChat } from "./src/chat.js";
import { AGENTS } from "./src/registry.js";
import { getOrCreateUserAgent, userClient, getBalance } from "./src/userAgents.js";
import * as store from "./src/store.js";
import { getBudget, setCap } from "./src/budget.js";
import { mountMcp } from "./src/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3005;

const app = express();
app.use(express.json());

// Real MCP server endpoint (POST /mcp).
mountMcp(app);

// --- API ---
app.get("/api/state", (_req, res) => {
  res.json({ agents: agentList(), services: SERVICES, topicId: topic(), recent: recentEvents() });
});

// A user's agent: on-chain balance + session budget guardrail.
app.get("/api/agent", async (req, res) => {
  const rec = await getOrCreateUserAgent(req.query.user);
  const balance = await getBalance(rec.accountId);
  const b = getBudget(req.query.user);
  res.json({ accountId: rec.accountId, balance, cap: b.cap, spent: b.spent });
});
app.post("/api/budget", (req, res) => {
  const b = setCap(req.body.user, req.body.cap);
  res.json({ cap: b.cap, spent: b.spent });
});

// Conversations (server-stored chat history, per user).
app.get("/api/conversations", (req, res) => res.json(store.list(req.query.user)));
app.get("/api/conversation/:id", (req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});
app.delete("/api/conversation/:id", (req, res) => { store.remove(req.params.id); res.json({ ok: true }); });

// The real paid tools the assistant can hire (for the marketplace UI).
app.get("/api/tools", (_req, res) => {
  res.json(
    Object.entries(AGENTS).map(([name, a]) => ({
      name,
      price: a.price,
      provider: a.account,
      description: a.def.function.description,
      persona: a.persona,
    })),
  );
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

// Clean URLs (no .html): /app serves the console, / serves the landing.
app.get(["/app", "/console"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.resolve(__dirname, "../web/app.html"));
});
app.get("/app.html", (_req, res) => res.redirect(301, "/app"));
app.get("/index.html", (_req, res) => res.redirect(301, "/"));

// --- static web app (never cache HTML so deploys show immediately) ---
app.use(
  express.static(path.resolve(__dirname, "../web"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }),
);

// --- websocket live feed ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "snapshot", agents: agentList(), topicId: topic(), recent: recentEvents() }));
  ws.on("message", async (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch (_) { return; }
    if (data.type === "chat" && typeof data.text === "string") {
      const emit = (evt) => { if (ws.readyState === 1) ws.send(JSON.stringify(evt)); };
      try {
        const text = data.text.slice(0, 2000);
        const conv = store.getOrCreate(data.conversationId, data.user, text);
        emit({ type: "conversation", id: conv.id, title: conv.title });
        emit({ type: "agent-preparing" });
        const record = await getOrCreateUserAgent(data.user);
        const client = userClient(record);
        emit({ type: "agent-info", accountId: record.accountId, created: record.created });
        const history = conv.messages.slice(-10);
        const result = await runChat(text, emit, { client, accountId: record.accountId, user: data.user }, history);
        store.appendTurn(conv.id, { role: "user", content: text }, { role: "assistant", content: result.content, steps: result.steps });
      } catch (e) {
        emit({ type: "chat-error", message: String(e.message || e) });
      }
    }
  });
});
bus.on("event", (evt) => {
  const msg = JSON.stringify({ type: "event", event: evt });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
});

server.listen(PORT, () => {
  console.log(`Ghostwire server on :${PORT}`);
});
