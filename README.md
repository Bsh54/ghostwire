# Ghostwire

*An agent that pays to get things done — for real, on Hedera.*

**Ghostwire is a chat assistant, "Wire", that commands a team of specialist AI agents and
hires them per task, settling real micro-payments over the [x402](https://www.x402.org/)
standard on [Hedera](https://hedera.com/).**

Built for the [Hedera x402 Bounty](https://hedera.com/x402-bounty/).
Live demo: **https://ghostwire.shadrakbessanh.me**

---

## What it does

You connect a wallet and chat with **Wire**. To answer you, Wire hires paid specialist
agents — each with its own on-chain Hedera account — and **pays them per task**, live,
with every payment verifiable on HashScan.

Each user gets their **own Hedera agent** (seeded with test HBAR) that spends on their
behalf, inside **on-chain guardrails**: a session budget cap and the hard wallet-balance
limit mean funds can never be drained. Every settlement is written to an immutable
**HCS receipt**.

### The agent team

| Agent | Role | Does |
|-------|------|------|
| **Wire** | Commander | Understands the task, hires and pays the right specialists |
| **Eagleton Skywatcher** | Navigator | Live market prices & 24h moves (CoinGecko) |
| **Athena Nightwing** | Archivist | Summarizes text and news |
| **Luna Mysticfang** | Oracle | Concise analytical takes |
| **Ursus Guardian** | Sentinel | Risk & volatility checks |
| **Corvus Messenger** | Glitch | Scouts and reads live web pages |

## Why this fits the bounty

- **Works end-to-end** — connect, chat, watch real payments settle, with HashScan proof.
- **Genuine on-chain x402 payments** — every tool call is a real Hedera transfer, verified.
- **Effective use of Hedera** — per-user accounts, sub-cent transfers, HCS receipts, and an
  on-chain spending guardrail (funds can't be drained).
- **Agentic depth** — the assistant *decides* which agents to hire; it is not a passive API.

## Architecture

| Layer | Role | Stack |
|-------|------|-------|
| Web | Landing + chat console (conversations, marketplace, MCP) | Static HTML / Canvas |
| Server | Chat loop, tools, payments, conversation store | Node.js / Express / WebSocket |
| Brain | The assistant's reasoning (tool-calling) | DeepSeek (OpenAI-compatible) |
| Agents | Per-user Hedera accounts that pay for tools | @hashgraph/sdk |
| Chain | Payments, identity, receipts | Hedera Testnet (HBAR, HCS) |

```
web/            Landing page + chat console
server/
  server.js     Express + WebSocket
  src/          hedera, chat loop, tools, payments, per-user agents, budget, store
```

## Run locally

```bash
cd server
cp ../.env.example ../.env   # fill in Hedera + LLM keys
npm install
npm run setup                # create on-chain agent accounts + HCS topic
npm start                    # serves web/ and the API on :3005
```

## Status

Live and working: real payments, per-user agents, guardrails, HCS receipts, live prices.
Next: a public MCP endpoint so external agents can pay for the same tools, and USDC settlement.

## License

MIT
