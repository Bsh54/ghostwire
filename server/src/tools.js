// The paid agent team. Every agent does something the base model CANNOT do on
// its own — live external data or a real on-chain action — so paying for it is
// genuinely worth it. Each call settles a real Hedera payment first.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { getClient, NETWORK } from "./hedera.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"));
const acct = (sym) => (agents.find((a) => a.symbol === sym) || {}).accountId;
let topicId = "";
try { topicId = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/topic.json"), "utf8")).topicId; } catch (_) {}

const MIRROR = NETWORK === "mainnet"
  ? "https://mainnet-public.mirrornode.hedera.com"
  : "https://testnet.mirrornode.hedera.com";
const CG = { hbar:"hedera-hashgraph", btc:"bitcoin", eth:"ethereum", sol:"solana", bnb:"binancecoin",
  xrp:"ripple", ada:"cardano", doge:"dogecoin", usdc:"usd-coin", usdt:"tether", sauce:"saucerswap",
  matic:"matic-network", dot:"polkadot", link:"chainlink", avax:"avalanche-2", ltc:"litecoin" };
const client = getClient();

export const TOOLS = {
  // 1. Live price — real market data.
  market_price: {
    provider: acct("SC"), price: 0.02,
    persona: { name: "Eagleton Skywatcher", role: "Navigator", icon: "radar", accent: "#2DD4BF",
      blurb: "Pulls the live USD price and 24h move of any crypto asset." },
    def: { type: "function", function: {
      name: "market_price", description: "Get the live USD price and 24h change of a crypto asset.",
      parameters: { type: "object", properties: { symbol: { type: "string", description: "Ticker, e.g. HBAR, BTC" } }, required: ["symbol"] } } },
    run: async (a) => {
      const sym = (a.symbol || "HBAR").toLowerCase().replace(/[^a-z0-9-]/g, "");
      const id = CG[sym] || sym;
      try {
        const j = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`)).json();
        const d = j[id]; if (!d) return `No price found for ${a.symbol}.`;
        const ch = typeof d.usd_24h_change === "number" ? `${d.usd_24h_change >= 0 ? "+" : ""}${d.usd_24h_change.toFixed(2)}% 24h` : "";
        return `${(a.symbol || id).toUpperCase()}: $${d.usd} ${ch}`;
      } catch (e) { return "(price fetch failed: " + e.message + ")"; }
    },
  },

  // 2. Market trends — real trending data.
  market_trending: {
    provider: acct("DA"), price: 0.02,
    persona: { name: "Athena Nightwing", role: "Archivist", icon: "trending-up", accent: "#38BDF8",
      blurb: "Surfaces the coins trending across the market right now." },
    def: { type: "function", function: {
      name: "market_trending", description: "List the crypto assets trending right now.",
      parameters: { type: "object", properties: {}, required: [] } } },
    run: async () => {
      try {
        const j = await (await fetch("https://api.coingecko.com/api/v3/search/trending")).json();
        const list = (j.coins || []).slice(0, 7).map((c, i) => `${i + 1}. ${c.item.name} (${c.item.symbol.toUpperCase()})`);
        return list.length ? "Trending now:\n" + list.join("\n") : "No trending data.";
      } catch (e) { return "(trending fetch failed: " + e.message + ")"; }
    },
  },

  // 3. Live web — fetch a real page.
  web_scout: {
    provider: acct("OR"), price: 0.02,
    persona: { name: "Corvus Messenger", role: "Glitch", icon: "radio", accent: "#FB923C",
      blurb: "Fetches a live web page and returns its readable text." },
    def: { type: "function", function: {
      name: "web_scout", description: "Fetch a public web page and return its readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
    run: async (a) => {
      try {
        const html = await (await fetch(a.url, { headers: { "User-Agent": "Mozilla/5.0 Ghostwire" } })).text();
        return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      } catch (e) { return "(fetch failed: " + e.message + ")"; }
    },
  },

  // 4. Hedera ledger read — real on-chain account data (mirror node).
  hedera_account: {
    provider: acct("LX"), price: 0.03,
    persona: { name: "Ursus Guardian", role: "Sentinel", icon: "search-check", accent: "#22C55E",
      blurb: "Reads any Hedera account: balance, tokens and activity." },
    def: { type: "function", function: {
      name: "hedera_account", description: "Look up a Hedera account's real balance and tokens on-chain.",
      parameters: { type: "object", properties: { account: { type: "string", description: "Account id like 0.0.98" } }, required: ["account"] } } },
    run: async (a) => {
      const id = (a.account || "").trim();
      try {
        const j = await (await fetch(`${MIRROR}/api/v1/accounts/${id}`)).json();
        if (j._status) return `Account ${id} not found.`;
        const hbar = (j.balance?.balance || 0) / 1e8;
        const tokens = (j.balance?.tokens || []).length;
        return `Account ${id}: ${hbar.toFixed(4)} ℏ, ${tokens} token type(s). Explorer: https://hashscan.io/${NETWORK}/account/${id}`;
      } catch (e) { return "(account lookup failed: " + e.message + ")"; }
    },
  },

  // 5. On-chain action — anchor a statement to Hedera's immutable ledger (HCS).
  hcs_anchor: {
    provider: acct("VF"), price: 0.04,
    persona: { name: "Luna Mysticfang", role: "Oracle", icon: "stamp", accent: "#F59E0B",
      blurb: "Anchors a statement to Hedera's immutable ledger (HCS)." },
    def: { type: "function", function: {
      name: "hcs_anchor", description: "Anchor a short statement to Hedera's immutable consensus ledger (HCS).",
      parameters: { type: "object", properties: { statement: { type: "string" } }, required: ["statement"] } } },
    run: async (a) => {
      if (!topicId) return "(no HCS topic configured)";
      try {
        const tx = await new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(String(a.statement).slice(0, 300)).execute(client);
        const seq = (await tx.getReceipt(client)).topicSequenceNumber?.toString();
        return `Anchored to HCS topic ${topicId} (message #${seq}). Immutable proof: https://hashscan.io/${NETWORK}/topic/${topicId}`;
      } catch (e) { return "(anchor failed: " + e.message + ")"; }
    },
  },
};

export const TOOL_DEFS = Object.values(TOOLS).map((t) => t.def);
