// Read-only helpers over the real on-chain agent accounts and the HCS receipts
// topic. No simulation — just the actual accounts created on Hedera.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"));
let topicId = "";
try { topicId = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/topic.json"), "utf8")).topicId; } catch (_) {}

export function agentList() {
  return agents.map((a) => ({ symbol: a.symbol, name: a.name, accountId: a.accountId }));
}
export function topic() {
  return topicId;
}
