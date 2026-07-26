// Shared agent registry (metadata only). Six specialist agents, each with a
// real capability the base model cannot do on its own. Capabilities live in
// capabilities.js, served by the independent agents service.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"));
const acct = (sym) => (agents.find((a) => a.symbol === sym) || {}).accountId;

export const AGENTS = {
  analyst: {
    path: "analyst", account: acct("AN"), price: 0.10,
    persona: { name: "Vesper Nightsong", role: "Strategist", icon: "brain", accent: "#F97316",
      blurb: "Commissions and pays several agents, then synthesizes a premium read." },
    def: { type: "function", function: {
      name: "analyst", description: "Premium deep analysis of a token or subject: it hires and pays several data agents, then synthesizes the findings.",
      parameters: { type: "object", properties: { subject: { type: "string", description: "Token or subject, e.g. HBAR" } }, required: ["subject"] } } },
  },
  token_detective: {
    path: "token-detective", account: acct("SC"), price: 0.03,
    persona: { name: "Eagleton Skywatcher", role: "Navigator", icon: "scan-search", accent: "#2DD4BF",
      blurb: "Scans any token's real liquidity, volume and red flags (DexScreener)." },
    def: { type: "function", function: {
      name: "token_detective", description: "Analyze a crypto token's live market: price, liquidity, volume, age and risk flags.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Token symbol, name or address" } }, required: ["query"] } } },
  },
  defi_pulse: {
    path: "defi-pulse", account: acct("LX"), price: 0.02,
    persona: { name: "Luna Mysticfang", role: "Oracle", icon: "gauge", accent: "#F59E0B",
      blurb: "Reads the live market mood: Fear & Greed plus what's trending." },
    def: { type: "function", function: {
      name: "defi_pulse", description: "Get the live crypto market sentiment (Fear & Greed index) and trending coins.",
      parameters: { type: "object", properties: {}, required: [] } } },
  },
  wallet_profiler: {
    path: "wallet-profiler", account: acct("VF"), price: 0.03,
    persona: { name: "Ursus Guardian", role: "Sentinel", icon: "user-search", accent: "#22C55E",
      blurb: "Profiles any Hedera account: balance, tokens, NFTs and activity." },
    def: { type: "function", function: {
      name: "wallet_profiler", description: "Profile a Hedera account: real balance, tokens, and recent on-chain activity.",
      parameters: { type: "object", properties: { account: { type: "string", description: "Account id, e.g. 0.0.98" } }, required: ["account"] } } },
  },
  dex_quote: {
    path: "dex-quote", account: acct("MC"), price: 0.02,
    persona: { name: "Reynard Swift", role: "Merchant", icon: "arrow-left-right", accent: "#EAB308",
      blurb: "Quotes live token prices on SaucerSwap, Hedera's native DEX." },
    def: { type: "function", function: {
      name: "dex_quote", description: "Get a live token price from SaucerSwap (Hedera's native DEX).",
      parameters: { type: "object", properties: { token: { type: "string", description: "Token symbol, e.g. SAUCE, HBAR, USDC" } }, required: ["token"] } } },
  },
  deep_researcher: {
    path: "deep-researcher", account: acct("OR"), price: 0.04,
    persona: { name: "Corvus Messenger", role: "Glitch", icon: "telescope", accent: "#FB923C",
      blurb: "Pulls multiple live sources on a topic for a grounded brief." },
    def: { type: "function", function: {
      name: "deep_researcher", description: "Gather real sources on a topic (encyclopedia + instant answers) for a grounded brief.",
      parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] } } },
  },
  whale_watcher: {
    path: "whale-watcher", account: acct("DA"), price: 0.02,
    persona: { name: "Athena Nightwing", role: "Archivist", icon: "waves", accent: "#38BDF8",
      blurb: "Surfaces the largest recent HBAR transfers on the network." },
    def: { type: "function", function: {
      name: "whale_watcher", description: "Find the largest recent HBAR transfers on the Hedera network (whale moves).",
      parameters: { type: "object", properties: {}, required: [] } } },
  },
};

export const TOOL_DEFS = Object.values(AGENTS).map((a) => a.def);
export const byName = (name) => AGENTS[name];
