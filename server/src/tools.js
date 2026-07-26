// The paid agent team the assistant can hire — variants of a market-intel
// crew, each with a persona. Every call settles a real Hedera payment, then
// does real work. Names echo a classic autonomous-agent roster.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ask } from "./llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"),
);
const acct = (sym) => (agents.find((a) => a.symbol === sym) || {}).accountId;

// Live price source (CoinGecko public API).
const CG = { hbar:"hedera-hashgraph", btc:"bitcoin", eth:"ethereum", sol:"solana", bnb:"binancecoin",
  xrp:"ripple", ada:"cardano", doge:"dogecoin", usdc:"usd-coin", usdt:"tether", sauce:"saucerswap",
  matic:"matic-network", dot:"polkadot", link:"chainlink", avax:"avalanche-2", ltc:"litecoin" };

export const TOOLS = {
  market_price: {
    provider: acct("SC"), price: 0.02,
    persona: { name: "Eagleton Skywatcher", role: "Navigator", icon: "radar", accent: "#2DD4BF",
      blurb: "Tracks live prices and 24h moves across the market." },
    def: { type: "function", function: {
      name: "market_price", description: "Get the live USD price and 24h change of a crypto asset.",
      parameters: { type: "object", properties: { symbol: { type: "string", description: "Ticker, e.g. HBAR, BTC, ETH" } }, required: ["symbol"] } } },
    run: async (a) => {
      const sym = (a.symbol || "HBAR").toLowerCase().replace(/[^a-z0-9-]/g, "");
      const id = CG[sym] || sym;
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
        const j = await r.json();
        const d = j[id];
        if (!d) return `No price found for ${a.symbol}.`;
        const ch = typeof d.usd_24h_change === "number" ? `${d.usd_24h_change >= 0 ? "+" : ""}${d.usd_24h_change.toFixed(2)}% 24h` : "";
        return `${(a.symbol || id).toUpperCase()}: $${d.usd} ${ch}`;
      } catch (e) { return "(price fetch failed: " + e.message + ")"; }
    },
  },
  summarize: {
    provider: acct("DA"), price: 0.02,
    persona: { name: "Athena Nightwing", role: "Archivist", icon: "scroll-text", accent: "#38BDF8",
      blurb: "Distills long text or news into sharp, faithful key points." },
    def: { type: "function", function: {
      name: "summarize", description: "Summarize a piece of text or news into concise key points.",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
    run: (a) => ask("Summarize the text into 3 short bullet points. Be factual.", a.text || ""),
  },
  analyze: {
    provider: acct("VF"), price: 0.03,
    persona: { name: "Luna Mysticfang", role: "Oracle", icon: "line-chart", accent: "#F59E0B",
      blurb: "Reads data and signals, returns a concise analytical take." },
    def: { type: "function", function: {
      name: "analyze", description: "Give a concise analytical read of a question, dataset or asset.",
      parameters: { type: "object", properties: { question: { type: "string" } }, required: ["question"] } } },
    run: (a) => ask("You are a sharp analyst. Give a concise analytical read with 2-3 key takeaways. Be balanced, not financial advice.", a.question || ""),
  },
  risk_check: {
    provider: acct("LX"), price: 0.03,
    persona: { name: "Ursus Guardian", role: "Sentinel", icon: "shield", accent: "#22C55E",
      blurb: "Weighs volatility and risk, and flags the downside." },
    def: { type: "function", function: {
      name: "risk_check", description: "Assess the risk and volatility profile of an asset or decision.",
      parameters: { type: "object", properties: { asset: { type: "string" } }, required: ["asset"] } } },
    run: (a) => ask("You are a risk manager. In one short paragraph, assess the risk/volatility profile and flag the key downside. Not financial advice.", a.asset || ""),
  },
  web_scout: {
    provider: acct("OR"), price: 0.02,
    persona: { name: "Corvus Messenger", role: "Glitch", icon: "radio", accent: "#FB923C",
      blurb: "Scouts the live web and brings back clean, readable intel." },
    def: { type: "function", function: {
      name: "web_scout", description: "Fetch a public web page and return its readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
    run: async (a) => {
      try {
        const r = await fetch(a.url, { headers: { "User-Agent": "Mozilla/5.0 Ghostwire" } });
        const html = await r.text();
        return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      } catch (e) { return "(fetch failed: " + e.message + ")"; }
    },
  },
};

export const TOOL_DEFS = Object.values(TOOLS).map((t) => t.def);
