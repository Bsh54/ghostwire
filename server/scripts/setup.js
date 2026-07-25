// One-time setup: create on-chain agent accounts (each with its own key and
// identity) and an HCS topic for immutable payment receipts. Saves everything
// to server/data (git-ignored) so the running server can load it.
import {
  AccountCreateTransaction,
  PrivateKey,
  Hbar,
  TopicCreateTransaction,
} from "@hashgraph/sdk";
import { getClient, OPERATOR_ID } from "../src/hedera.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../data");
fs.mkdirSync(DATA, { recursive: true });

const client = getClient();

// Agent roster. Each becomes a real Hedera account. `cap` is the spending
// guardrail in HBAR; the Verifier gets a tight cap to demo on-chain blocking.
const ROSTER = [
  { symbol: "OR", name: "Orchestrator", fund: 20, cap: 10 },
  { symbol: "SC", name: "Scraper",      fund: 15, cap: 8 },
  { symbol: "VF", name: "Verifier",     fund: 15, cap: 0.15 },
  { symbol: "LX", name: "Translator",   fund: 15, cap: 8 },
  { symbol: "DA", name: "Data broker",  fund: 15, cap: 8 },
];

console.log(`Setup on Hedera testnet · operator ${OPERATOR_ID}\n`);

const agents = [];
for (const a of ROSTER) {
  const key = PrivateKey.generateECDSA();
  const tx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(key.publicKey)
    .setInitialBalance(new Hbar(a.fund))
    .execute(client);
  const receipt = await tx.getReceipt(client);
  const accountId = receipt.accountId.toString();
  agents.push({
    symbol: a.symbol,
    name: a.name,
    accountId,
    privateKey: key.toStringRaw(),
    capHbar: a.cap,
  });
  console.log(`  ${a.symbol} ${a.name.padEnd(14)} ${accountId}  (${a.fund} ℏ, cap ${a.cap} ℏ)`);
}

// HCS topic for receipts
const topicTx = await new TopicCreateTransaction()
  .setTopicMemo("Ghostwire payment receipts")
  .execute(client);
const topicId = (await topicTx.getReceipt(client)).topicId.toString();
console.log(`\n  Receipts topic (HCS): ${topicId}`);

fs.writeFileSync(path.join(DATA, "agents.json"), JSON.stringify(agents, null, 2));
fs.writeFileSync(path.join(DATA, "topic.json"), JSON.stringify({ topicId }, null, 2));
console.log(`\nSaved to server/data. Setup complete.`);
client.close();
