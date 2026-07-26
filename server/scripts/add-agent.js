// One-off: create + fund one extra agent account and append it to
// server/data/agents.json (idempotent by symbol). Usage: node scripts/add-agent.js MC "Merchant"
import { AccountCreateTransaction, PrivateKey, Hbar } from "@hashgraph/sdk";
import { getClient, OPERATOR_ID } from "../src/hedera.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../data/agents.json");
const symbol = process.argv[2] || "MC";
const name = process.argv[3] || "Merchant";

const arr = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (arr.find((a) => a.symbol === symbol)) {
  console.log(`${symbol} already exists: ${arr.find((a) => a.symbol === symbol).accountId}`);
  process.exit(0);
}

const client = getClient();
console.log(`Creating agent ${symbol} (${name}) from operator ${OPERATOR_ID}...`);
const key = PrivateKey.generateECDSA();
const tx = await new AccountCreateTransaction().setKeyWithoutAlias(key.publicKey).setInitialBalance(new Hbar(15)).execute(client);
const accountId = (await tx.getReceipt(client)).accountId.toString();
arr.push({ symbol, name, accountId, privateKey: key.toStringRaw(), capHbar: 8 });
fs.writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added ${symbol} ${name} -> ${accountId}`);
client.close();
