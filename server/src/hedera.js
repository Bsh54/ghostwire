// Hedera client setup for Ghostwire.
// Loads the operator account from the root .env and returns a configured testnet client.
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
export const NETWORK = process.env.HEDERA_NETWORK || "testnet";

function loadOperatorKey() {
  const raw = process.env.HEDERA_OPERATOR_KEY;
  if (!raw) throw new Error("HEDERA_OPERATOR_KEY missing in .env");
  // ECDSA key from the Hedera portal (hex, with or without 0x prefix).
  return (process.env.HEDERA_KEY_TYPE || "ECDSA").toUpperCase() === "ECDSA"
    ? PrivateKey.fromStringECDSA(raw)
    : PrivateKey.fromStringED25519(raw);
}

export function getClient() {
  if (!OPERATOR_ID) throw new Error("HEDERA_OPERATOR_ID missing in .env");
  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), loadOperatorKey());
  return client;
}

// Build a HashScan explorer URL for a transaction id.
export function hashscanTx(txId) {
  const normalized = txId.toString().replace("@", "-").replace(/\.(\d+)$/, "-$1");
  return `https://hashscan.io/${NETWORK}/transaction/${normalized}`;
}
