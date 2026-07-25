// The agent runtime. Loads on-chain agent accounts, lets them pay each other
// via the x402 flow, enforces per-agent spending guardrails, and writes an
// immutable receipt to HCS for every settled payment.
import {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NETWORK } from "./hedera.js";
import { SERVICES } from "./marketplace.js";
import { verifyPayment, toMirrorId } from "./x402.js";
import { emitEvent } from "./bus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../data");

const agents = JSON.parse(fs.readFileSync(path.join(DATA, "agents.json"), "utf8"));
const { topicId } = JSON.parse(fs.readFileSync(path.join(DATA, "topic.json"), "utf8"));

// Runtime state per agent (own client + spend tracking).
for (const a of agents) {
  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(a.accountId), PrivateKey.fromStringECDSA(a.privateKey));
  a.client = client;
  a.spent = 0;
  a.trust = 70 + Math.floor(Math.random() * 20);
}

const byId = Object.fromEntries(agents.map((a) => [a.symbol, a]));
export function agentList() {
  return agents.map((a) => ({
    symbol: a.symbol, name: a.name, accountId: a.accountId,
    capHbar: a.capHbar, spent: +a.spent.toFixed(4), trust: a.trust,
  }));
}
export function topic() { return topicId; }

const hashscan = (txId) => `https://hashscan.io/${NETWORK}/transaction/${toMirrorId(txId)}`;

// A buyer agent purchases a service from its provider agent, x402-style.
async function purchase(buyer, service) {
  const provider = byId[service.provider];
  if (!provider || provider.symbol === buyer.symbol) return;

  const amount = service.priceHbar;

  // Guardrail: enforce the spending cap before any money moves.
  if (buyer.spent + amount > buyer.capHbar) {
    emitEvent({
      type: "blocked", from: buyer.symbol, to: provider.symbol,
      amount, reason: "spending cap reached",
    });
    return;
  }

  // 1. Settle the payment on-chain (buyer signs with its own key).
  let txId, receiptStatus;
  try {
    const tx = await new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(buyer.accountId), new Hbar(amount).negated())
      .addHbarTransfer(AccountId.fromString(provider.accountId), new Hbar(amount))
      .execute(buyer.client);
    receiptStatus = (await tx.getReceipt(buyer.client)).status.toString();
    txId = tx.transactionId.toString();
  } catch (e) {
    emitEvent({ type: "error", from: buyer.symbol, to: provider.symbol, reason: String(e.message || e) });
    return;
  }
  if (receiptStatus !== "SUCCESS") return;

  buyer.spent += amount;
  provider.trust = Math.min(100, provider.trust + 1);

  // 2. Verify on-chain via the mirror node (this is the x402 "verify" step).
  const verified = await verifyPayment({ txId, payTo: provider.accountId, amountHbar: amount });

  // 3. Write an immutable receipt to HCS.
  let seq = null;
  try {
    const msg = JSON.stringify({ from: buyer.symbol, to: provider.symbol, service: service.id, amount, txId });
    const sub = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId).setMessage(msg).execute(byId.OR.client);
    seq = (await sub.getReceipt(byId.OR.client)).topicSequenceNumber?.toString() ?? null;
  } catch (_) { /* receipt is best-effort */ }

  emitEvent({
    type: "payment",
    from: buyer.symbol, to: provider.symbol,
    service: service.id, serviceName: service.name,
    amount, txId, hashscan: hashscan(txId),
    verified: verified.ok, receiptSeq: seq,
  });
}

let running = false;
// Continuous autonomous economy: random buyer hires a random service.
export function startEconomy(intervalMs = 4000) {
  if (running) return;
  running = true;
  emitEvent({ type: "system", message: "economy started", topicId });
  const tickOnce = async () => {
    if (!running) return;
    const buyer = agents[Math.floor(Math.random() * agents.length)];
    const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
    try { await purchase(buyer, service); } catch (_) {}
    setTimeout(tickOnce, intervalMs);
  };
  tickOnce();
}
export function stopEconomy() { running = false; }
