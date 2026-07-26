// The paid tools the assistant can hire. Each tool maps to a provider agent
// account and a price; calling it settles a real payment, then does real work.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ask } from "./llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agents = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/agents.json"), "utf8"),
);
const acct = (sym) => (agents.find((a) => a.symbol === sym) || {}).accountId;

// Tool catalogue: definition (for the LLM) + provider + price + handler.
export const TOOLS = {
  summarize: {
    provider: acct("DA"),
    price: 0.02,
    def: {
      type: "function",
      function: {
        name: "summarize",
        description: "Summarize a piece of text into concise key points.",
        parameters: {
          type: "object",
          properties: { text: { type: "string", description: "The text to summarize" } },
          required: ["text"],
        },
      },
    },
    run: (a) => ask("Summarize the text into 3 short bullet points. Be factual.", a.text || ""),
  },
  translate: {
    provider: acct("LX"),
    price: 0.02,
    def: {
      type: "function",
      function: {
        name: "translate",
        description: "Translate text into a target language.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
            target_language: { type: "string", description: "e.g. English, French" },
          },
          required: ["text", "target_language"],
        },
      },
    },
    run: (a) => ask(`Translate the text into ${a.target_language || "English"}. Output only the translation.`, a.text || ""),
  },
  factcheck: {
    provider: acct("VF"),
    price: 0.03,
    def: {
      type: "function",
      function: {
        name: "factcheck",
        description: "Assess whether a factual claim is plausible and explain briefly.",
        parameters: {
          type: "object",
          properties: { claim: { type: "string" } },
          required: ["claim"],
        },
      },
    },
    run: (a) => ask("You are a fact-checker. Give a short verdict (Likely true / Uncertain / Likely false) and one sentence of reasoning.", a.claim || ""),
  },
  web_fetch: {
    provider: acct("SC"),
    price: 0.02,
    def: {
      type: "function",
      function: {
        name: "web_fetch",
        description: "Fetch a public web page and return its readable text.",
        parameters: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    },
    run: async (a) => {
      try {
        const r = await fetch(a.url, { headers: { "User-Agent": "Mozilla/5.0 Ghostwire" } });
        const html = await r.text();
        return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      } catch (e) {
        return "(fetch failed: " + e.message + ")";
      }
    },
  },
};

export const TOOL_DEFS = Object.values(TOOLS).map((t) => t.def);
