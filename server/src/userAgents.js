// Per-user agents: when someone connects a wallet, they get their own Hedera
// account (their agent's wallet), seeded with test HBAR. Their agent pays for
// services from this account — so payments come from the user's own agent,
// and the chain itself caps spending at the wallet balance.
import {
  AccountCreateTransaction,
  PrivateKey,
  Hbar,
  Client,
  AccountId,
} from "@hashgraph/sdk";
import { getClient, NETWORK } from "./hedera.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../data/user-agents.json");

const operator = getClient();
let store = {};
try { store = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (_) {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(store, null, 2));

const clientCache = {};
const SEED_HBAR = 3;

// Get (or lazily create + fund) the agent account for a given user id (wallet address).
export async function getOrCreateUserAgent(userId) {
  const id = (userId || "guest").toLowerCase();
  let created = false;
  if (!store[id]) {
    const key = PrivateKey.generateECDSA();
    const tx = await new AccountCreateTransaction()
      .setKeyWithoutAlias(key.publicKey)
      .setInitialBalance(new Hbar(SEED_HBAR))
      .execute(operator);
    const accountId = (await tx.getReceipt(operator)).accountId.toString();
    store[id] = { accountId, privateKey: key.toStringRaw() };
    save();
    created = true;
  }
  return { ...store[id], created };
}

// A signing client operated by the user's own agent account.
export function userClient(agent) {
  if (clientCache[agent.accountId]) return clientCache[agent.accountId];
  const c = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(AccountId.fromString(agent.accountId), PrivateKey.fromStringECDSA(agent.privateKey));
  clientCache[agent.accountId] = c;
  return c;
}
