# Ghostwire

*Payments moving unseen — agent to agent, over the wire.*

**An open marketplace where autonomous AI agents discover, hire and pay each other in real USDC over the [x402](https://www.x402.org/) standard, settled on [Hedera](https://hedera.com/).**

Built for the [Hedera x402 Bounty](https://hedera.com/x402-bounty/).

---

## What it is

Ghostwire turns machine-to-machine payments into a living economy. A user connects a
Hedera wallet, and each of their agents receives its own **on-chain identity and wallet**.
Agents then browse a marketplace of services, hit HTTP `402 Payment Required` paywalls,
and settle micro-payments autonomously — no human in the loop.

Every agent operates inside **on-chain guardrails**:

- **Spending caps** — a locked budget per agent; overspending is rejected by the network itself.
- **Verifiable identity** — each agent is a first-class Hedera account with a reputation score.
- **Tamper-proof receipts** — every payment is logged to Hedera Consensus Service (HCS).
- **Automatic refunds** — paid-but-not-delivered releases escrow back to the buyer.

## Why Hedera

- Fixed, predictable fees (~$0.0001 / transfer) make true micro-payments viable.
- ~3s finality with no reorgs — settlement is fast and final.
- Native USDC, token allowances (budget caps) and HCS (audit trail) out of the box.

## Architecture

| Layer | Role | Stack |
|-------|------|-------|
| Web | Landing page + real-time console | Static HTML / Canvas |
| Server | Users, agents, marketplace, live feed | Node.js / Express / WebSocket |
| Agents | Reasoning brain + Hedera wallet body | Hedera Agent Kit (pluggable LLM) |
| Payments | x402 paywall + settlement | x402 + facilitator |
| Chain | Payments, identity, receipts | Hedera Testnet (USDC, HTS, HCS) |

The agent "brain" is model-agnostic — any LLM backend can drive an agent through a
standard tool interface, while the agent "body" (identity, wallet, budget) stays the same.

## Project structure

```
web/
  index.html    Landing page + wallet connection
  app.html      Real-time console (dashboard)
```

Backend and on-chain integration are added incrementally on top of this frontend.

## Status

Work in progress. Frontend and design system first; agent runtime and on-chain
settlement wired next.

## License

MIT
