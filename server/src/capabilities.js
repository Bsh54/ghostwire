// The real work each agent does — served ONLY by the independent agents
// service (never by the buyer). Every capability provides something the base
// model cannot know or do on its own: live data or a real on-chain action.
import { TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { getClient, NETWORK } from "./hedera.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let topicId = "";
try { topicId = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/topic.json"), "utf8")).topicId; } catch (_) {}
const client = getClient();

const MIRROR = NETWORK === "mainnet"
  ? "https://mainnet-public.mirrornode.hedera.com"
  : "https://testnet.mirrornode.hedera.com";
const CG = { hbar:"hedera-hashgraph", btc:"bitcoin", eth:"ethereum", sol:"solana", bnb:"binancecoin",
  xrp:"ripple", ada:"cardano", doge:"dogecoin", usdc:"usd-coin", usdt:"tether", sauce:"saucerswap",
  matic:"matic-network", dot:"polkadot", link:"chainlink", avax:"avalanche-2", ltc:"litecoin" };

export const CAPS = {
  ticker: async (a) => {
    const sym = (a.symbol || "HBAR").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const id = CG[sym] || sym;
    const j = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`)).json();
    const d = j[id];
    if (!d) return `No price found for ${a.symbol}.`;
    const ch = typeof d.usd_24h_change === "number" ? `${d.usd_24h_change >= 0 ? "+" : ""}${d.usd_24h_change.toFixed(2)}% 24h` : "";
    return `${(a.symbol || id).toUpperCase()}: $${d.usd} ${ch}`;
  },

  reader: async (a) => {
    const html = await (await fetch(a.url, { headers: { "User-Agent": "Mozilla/5.0 Ghostwire" } })).text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 2200) || "(no readable text found)";
  },

  verifier: async (a) => {
    const title = encodeURIComponent(String(a.topic || "").trim().replace(/\s+/g, "_"));
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { "User-Agent": "Ghostwire/1.0" } });
    if (!r.ok) return `No reference found for "${a.topic}".`;
    const j = await r.json();
    return `${j.title}: ${j.extract || "(no summary)"}\nSource: ${j.content_urls?.desktop?.page || "wikipedia.org"}`;
  },

  ledger: async (a) => {
    const id = String(a.account || "").trim();
    const j = await (await fetch(`${MIRROR}/api/v1/accounts/${id}`)).json();
    if (j._status) return `Account ${id} not found.`;
    const hbar = (j.balance?.balance || 0) / 1e8;
    const tokens = (j.balance?.tokens || []).length;
    return `Account ${id}: ${hbar.toFixed(4)} ℏ, ${tokens} token type(s). Explorer: https://hashscan.io/${NETWORK}/account/${id}`;
  },

  notary: async (a) => {
    if (!topicId) return "(no HCS topic configured)";
    const tx = await new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(String(a.statement || "").slice(0, 300)).execute(client);
    const seq = (await tx.getReceipt(client)).topicSequenceNumber?.toString();
    return `Anchored to HCS topic ${topicId} (message #${seq}). Immutable proof: https://hashscan.io/${NETWORK}/topic/${topicId}`;
  },
};
