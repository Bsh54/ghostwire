// Shared agent registry (metadata only, no capability code). Both the buyer
// side (Wire) and the independent agents service read this. Capabilities live
// in capabilities.js, served by the separate agents service.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"));
const acct = (sym) => (agents.find((a) => a.symbol === sym) || {}).accountId;

// Each agent is an independent x402 service (its own path + Hedera account).
export const AGENTS = {
  ticker: {
    path: "ticker", account: acct("SC"), price: 0.02,
    persona: { name: "Eagleton Skywatcher", role: "Navigator", icon: "radar", accent: "#2DD4BF",
      blurb: "Reads live market prices no model can know on its own." },
    def: { type: "function", function: {
      name: "ticker", description: "Live USD price and 24h change of a crypto asset (real market data).",
      parameters: { type: "object", properties: { symbol: { type: "string", description: "Ticker, e.g. HBAR, BTC" } }, required: ["symbol"] } } },
  },
  reader: {
    path: "reader", account: acct("OR"), price: 0.02,
    persona: { name: "Corvus Messenger", role: "Glitch", icon: "radio", accent: "#FB923C",
      blurb: "Fetches a live web page and extracts its readable text." },
    def: { type: "function", function: {
      name: "reader", description: "Fetch a live web page and return its clean, readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  },
  verifier: {
    path: "verifier", account: acct("VF"), price: 0.03,
    persona: { name: "Luna Mysticfang", role: "Oracle", icon: "badge-check", accent: "#F59E0B",
      blurb: "Pulls a real reference from Wikipedia to ground a claim." },
    def: { type: "function", function: {
      name: "verifier", description: "Fetch a factual reference summary about a topic from Wikipedia.",
      parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] } } },
  },
  ledger: {
    path: "ledger", account: acct("LX"), price: 0.03,
    persona: { name: "Ursus Guardian", role: "Sentinel", icon: "search-check", accent: "#22C55E",
      blurb: "Reads any Hedera account's real balance & tokens on-chain." },
    def: { type: "function", function: {
      name: "ledger", description: "Look up a Hedera account's real on-chain balance and tokens.",
      parameters: { type: "object", properties: { account: { type: "string", description: "e.g. 0.0.98" } }, required: ["account"] } } },
  },
  notary: {
    path: "notary", account: acct("DA"), price: 0.04,
    persona: { name: "Athena Nightwing", role: "Archivist", icon: "stamp", accent: "#38BDF8",
      blurb: "Anchors a statement to Hedera's immutable ledger (a real action)." },
    def: { type: "function", function: {
      name: "notary", description: "Anchor a short statement to Hedera's immutable consensus ledger (HCS).",
      parameters: { type: "object", properties: { statement: { type: "string" } }, required: ["statement"] } } },
  },
};

export const TOOL_DEFS = Object.values(AGENTS).map((a) => a.def);
export const byName = (name) => AGENTS[name];
