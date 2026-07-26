<p align="center">
  <img src="logo.png" width="104" alt="Ghostwire">
</p>

<h1 align="center">Ghostwire</h1>

<p align="center"><em>An AI that hires expert agents to get real answers — and pays them, for real, on Hedera.</em></p>

<p align="center">
  <a href="https://ghostwire.shadrakbessanh.me"><b>Live demo</b></a> ·
  Built for the <a href="https://hedera.com/x402-bounty/">Hedera x402 Bounty</a>
</p>

---

**Wire is a chat assistant that commands a team of specialist agents. Each agent is an
independent service behind an [x402](https://www.x402.org/) paywall; to answer you, Wire
contacts the right agent over the network, pays it on [Hedera](https://hedera.com/), and
delivers the result — with every payment verifiable on HashScan.**

## What it does

You connect a wallet and chat with **Wire**. When a task needs real data or an on-chain
action, Wire hires a specialist agent: it makes an HTTP request, receives **HTTP 402
Payment Required**, pays the agent on Hedera, and retries with the payment proof — which the
agent verifies on-chain itself before delivering.

Each user gets their **own Hedera agent account** (seeded with test HBAR) that spends on
their behalf, inside on-chain guardrails: an editable session budget cap plus the hard
wallet-balance limit mean funds can never be drained.

## The agent team (seven real-capability agents)

| Agent | Role | Real capability |
|-------|------|-----------------|
| **Vesper Nightsong** | Strategist | Premium deep read — hires and pays several agents itself, then synthesizes |
| **Eagleton Skywatcher** | Navigator | Token market & risk scan (DexScreener) |
| **Luna Mysticfang** | Oracle | Market sentiment — Fear & Greed + trending |
| **Ursus Guardian** | Sentinel | Profile a Hedera account on-chain (mirror node) |
| **Reynard Swift** | Merchant | Live token price on SaucerSwap (Hedera DEX) |
| **Corvus Messenger** | Glitch | Multi-source research brief (Wikipedia + DuckDuckGo) |
| **Athena Nightwing** | Archivist | Largest recent HBAR whale moves (mainnet mirror) |

Every agent does something the base model cannot — live external data or on-chain reads.
The Strategist goes further: to build its report it **sub-contracts and pays other agents
on-chain**, a genuine agent-to-agent payment cascade.

## Why this fits the bounty

- **Genuine x402 payments** — a real 402 handshake between buyer and agent, settled on
  Hedera and independently verified on-chain, plus **agent-to-agent** payments.
- **Effective use of Hedera** — per-user accounts, sub-cent transfers, mirror-node reads,
  HCS receipts, and an on-chain spending guardrail.
- **Agentic depth** — Wire *decides* which agents to hire; it is not a passive API.
- **Works end-to-end** — connect, chat, watch agents get hired and paid, with HashScan proof.
- **Open via MCP** — the same agents are exposed over a real MCP server at `/mcp`; any MCP
  client (Cursor, Claude Desktop) can list and call them, and every call settles on Hedera.

## Architecture

```
web/                Landing page + chat console (clean URLs: / and /app)
server/
  server.js         Buyer API + WebSocket chat + MCP endpoint
  agents-server.js  Independent agents service (x402 paywall, own port)
  src/
    registry.js       Agent metadata (shared)
    capabilities.js   Real agent work — served only by the agents service
    hire.js           x402 client: 402 -> pay on Hedera -> proof -> result
    chat.js           Wire's reasoning loop (DeepSeek) + tool calls
    userAgents.js     Per-user Hedera agent accounts
    budget.js         Session spending guardrail
    store.js          Server-stored conversations
    mcp.js, pay.js, x402.js, hedera.js
```

| Layer | Role | Stack |
|-------|------|-------|
| Web | Landing + chat console | Static HTML |
| Buyer | Chat loop, conversations, MCP server | Node.js / Express / WebSocket |
| Brain | Wire's reasoning | DeepSeek (OpenAI-compatible) |
| Agents | Independent x402 services | Node.js / Express (own process) |
| Chain | Payments, identity, receipts | Hedera Testnet (HBAR, HCS, mirror) |

## Run

```bash
cd server
cp ../.env.example ../.env    # Hedera + LLM keys
npm install
npm run setup                 # create on-chain agent accounts + HCS topic
node agents-server.js &       # the independent agents service (:3006)
npm start                     # the buyer app + web (:3005)
```

## Connect via MCP

```json
// Cursor / Streamable-HTTP clients
{ "mcpServers": { "ghostwire": { "url": "https://ghostwire.shadrakbessanh.me/mcp" } } }

// Claude Desktop (bridge the remote server)
{ "mcpServers": { "ghostwire": {
  "command": "npx", "args": ["mcp-remote", "https://ghostwire.shadrakbessanh.me/mcp"] } } }
```

## License

MIT
