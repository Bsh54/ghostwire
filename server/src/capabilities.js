// The real work each agent does (served only by the independent agents
// service). Each uses live external data or on-chain data — nothing the base
// model could produce on its own.
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import { NETWORK } from "./hedera.js";
import { hire } from "./hire.js";
import { ask } from "./llm.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const roster = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"));

const TESTNET_MIRROR = "https://testnet.mirrornode.hedera.com";
const MAINNET_MIRROR = "https://mainnet-public.mirrornode.hedera.com";
const CG = { hbar:"hedera-hashgraph", btc:"bitcoin", eth:"ethereum", sol:"solana" };

const j = async (url, opts) => (await fetch(url, opts)).json();

// A signing client for the Strategist so it can pay the agents it sub-contracts.
const strat = roster.find((a) => a.symbol === "AN");
let stratClient = null;
if (strat) {
  stratClient = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  stratClient.setOperator(AccountId.fromString(strat.accountId), PrivateKey.fromStringECDSA(strat.privateKey));
}

export const CAPS = {
  // Strategist: sub-contracts and PAYS several agents (a real agent-to-agent
  // payment cascade), then synthesizes a premium read. This is why it costs more.
  analyst: async (a) => {
    const subject = String(a.subject || "").trim() || "HBAR";
    if (!stratClient) return "(strategist account not configured)";
    const buyer = { client: stratClient, accountId: strat.accountId };
    const facts = [];
    const chain = [];
    const sub = async (label, agentPath, args) => {
      try {
        const out = await hire(agentPath, args, buyer);
        facts.push(`${label}: ${out.result}`);
        chain.push(`- ${label}: paid ${out.amount} ℏ — ${out.hashscan}`);
      } catch (e) { facts.push(`${label}: unavailable`); }
    };
    // Sub-contract three specialists (each is a real on-chain payment from this agent).
    await sub("Price", "ticker", { symbol: subject });
    await sub("Token scan", "token-detective", { query: subject });
    await sub("Market sentiment", "defi-pulse", {});

    let analysis = "";
    try {
      analysis = await ask(
        "You are a market strategist. Using ONLY the data below, write a concise, balanced 2-3 sentence read on the subject. Professional tone, no emojis. This is not financial advice.",
        `Subject: ${subject}\n\n${facts.join("\n")}`,
      );
    } catch (_) { analysis = facts.join("\n"); }
    return `${analysis}\n\nAgents I hired and paid on-chain for this:\n${chain.join("\n") || "(none available)"}`;
  },

  // Token risk & market scan via DexScreener.
  token_detective: async (a) => {
    const q = encodeURIComponent(String(a.query || "").trim());
    const data = await j(`https://api.dexscreener.com/latest/dex/search?q=${q}`);
    const pairs = (data.pairs || []).filter((p) => p.liquidity?.usd).sort((x, y) => (y.liquidity.usd - x.liquidity.usd));
    const p = pairs[0];
    if (!p) return `No market found for "${a.query}".`;
    const ageDays = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 86400000) : null;
    const buys = p.txns?.h24?.buys ?? 0, sells = p.txns?.h24?.sells ?? 0;
    const flags = [];
    if ((p.liquidity.usd || 0) < 10000) flags.push("low liquidity");
    if (ageDays != null && ageDays < 7) flags.push("very new pair");
    if (sells > buys * 2) flags.push("sell pressure");
    return [
      `${p.baseToken?.name} (${p.baseToken?.symbol}) on ${p.dexId} / ${p.chainId}`,
      `Price: $${p.priceUsd} | 24h: ${p.priceChange?.h24 ?? "?"}%`,
      `Liquidity: $${Math.round(p.liquidity.usd).toLocaleString()} | 24h vol: $${Math.round(p.volume?.h24 || 0).toLocaleString()}`,
      `Age: ${ageDays != null ? ageDays + "d" : "?"} | 24h buys/sells: ${buys}/${sells}`,
      `Risk flags: ${flags.length ? flags.join(", ") : "none obvious"}`,
    ].join("\n");
  },

  // Market sentiment: Fear & Greed + trending.
  defi_pulse: async () => {
    let mood = "?";
    try {
      const f = await j("https://api.alternative.me/fng/");
      const d = f.data?.[0];
      if (d) mood = `${d.value} (${d.value_classification})`;
    } catch (_) {}
    let trending = [];
    try {
      const t = await j("https://api.coingecko.com/api/v3/search/trending");
      trending = (t.coins || []).slice(0, 6).map((c) => c.item.symbol.toUpperCase());
    } catch (_) {}
    return `Fear & Greed index: ${mood}\nTrending now: ${trending.length ? trending.join(", ") : "n/a"}`;
  },

  // Hedera account profile (mirror node).
  wallet_profiler: async (a) => {
    const id = String(a.account || "").trim();
    const acc = await j(`${TESTNET_MIRROR}/api/v1/accounts/${id}`);
    if (acc._status) return `Account ${id} not found on testnet.`;
    const hbar = (acc.balance?.balance || 0) / 1e8;
    const tokens = (acc.balance?.tokens || []).length;
    let txCount = 0, last = null;
    try {
      const tx = await j(`${TESTNET_MIRROR}/api/v1/transactions?account.id=${id}&limit=25&order=desc`);
      txCount = (tx.transactions || []).length;
      last = tx.transactions?.[0]?.consensus_timestamp;
    } catch (_) {}
    return [
      `Account ${id}`,
      `Balance: ${hbar.toFixed(4)} ℏ | Token types: ${tokens}`,
      `Recent transactions: ${txCount}${txCount === 25 ? "+" : ""}`,
      last ? `Last activity: ${new Date(Number(last.split(".")[0]) * 1000).toISOString().slice(0, 16)}Z` : "",
      `Explorer: https://hashscan.io/testnet/account/${id}`,
    ].filter(Boolean).join("\n");
  },

  // SaucerSwap live token price (Hedera native DEX).
  dex_quote: async (a) => {
    const sym = String(a.token || "").trim().toUpperCase();
    try {
      const tokens = await j("https://api.saucerswap.finance/tokens");
      const t = (tokens || []).find((x) => (x.symbol || "").toUpperCase() === sym);
      if (!t) return `SaucerSwap has no listed token "${a.token}".`;
      const usd = t.priceUsd ?? t.price ?? null;
      return `${t.symbol} on SaucerSwap: ${usd != null ? "$" + Number(usd).toPrecision(6) : "price n/a"} (token ${t.id})`;
    } catch (e) {
      return "(SaucerSwap unavailable: " + e.message + ")";
    }
  },

  // Multi-source research brief.
  deep_researcher: async (a) => {
    const topic = String(a.topic || "").trim();
    const out = [];
    try {
      const w = await j(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/\s+/g, "_"))}`, { headers: { "User-Agent": "Ghostwire/1.0" } });
      if (w.extract) out.push(`Wikipedia — ${w.title}: ${w.extract}`);
    } catch (_) {}
    try {
      const d = await j(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&t=ghostwire`);
      if (d.AbstractText) out.push(`DuckDuckGo — ${d.AbstractText}${d.AbstractURL ? " (" + d.AbstractURL + ")" : ""}`);
      const rel = (d.RelatedTopics || []).map((r) => r.Text).filter(Boolean).slice(0, 3);
      if (rel.length) out.push("Related: " + rel.join(" · "));
    } catch (_) {}
    return out.length ? out.join("\n\n") : `No live sources found on "${topic}".`;
  },

  // Largest recent HBAR transfers on Hedera mainnet (real whales).
  whale_watcher: async () => {
    const data = await j(`${MAINNET_MIRROR}/api/v1/transactions?limit=100&order=desc&transactiontype=cryptotransfer&result=success`);
    let best = [];
    for (const t of data.transactions || []) {
      const maxOut = Math.max(0, ...(t.transfers || []).map((tr) => tr.amount > 0 ? tr.amount : 0));
      if (maxOut > 0) best.push({ hbar: maxOut / 1e8, id: t.transaction_id });
    }
    best.sort((x, y) => y.hbar - x.hbar);
    best = best.slice(0, 3);
    if (!best.length) return "No recent transfers found.";
    return "Largest recent HBAR moves (mainnet):\n" + best.map((b, i) => `${i + 1}. ${Math.round(b.hbar).toLocaleString()} ℏ`).join("\n");
  },
};
