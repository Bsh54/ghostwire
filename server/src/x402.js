// Minimal x402 payment layer for Hedera.
// Resource servers answer HTTP 402 with payment requirements; clients pay
// on-chain and present the transaction id as proof, which we verify against
// the Hedera mirror node (real on-chain verification, not trust).
import { Hbar } from "@hashgraph/sdk";
import { NETWORK } from "./hedera.js";

const MIRROR = NETWORK === "mainnet"
  ? "https://mainnet-public.mirrornode.hedera.com"
  : "https://testnet.mirrornode.hedera.com";

// Build the 402 body a resource server returns when payment is required.
export function paymentRequired({ payTo, amountHbar, resource, description }) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "hedera-exact",
        network: NETWORK,
        asset: "HBAR",
        amount: amountHbar,
        payTo,
        resource,
        description,
      },
    ],
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Turn a Hedera SDK transaction id into the mirror-node / HashScan form.
export function toMirrorId(txId) {
  return txId.toString().replace("@", "-").replace(/\.(\d+)$/, "-$1");
}

// Verify on-chain that `txId` is a SUCCESS transfer of at least `amountHbar`
// to `payTo`. Polls the mirror node to absorb indexing lag.
export async function verifyPayment({ txId, payTo, amountHbar }) {
  const id = toMirrorId(txId);
  const needTinybar = new Hbar(amountHbar).toTinybars().toNumber();

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(`${MIRROR}/api/v1/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const tx = (data.transactions || [])[0];
        if (tx && tx.result === "SUCCESS") {
          const credited = (tx.transfers || [])
            .filter((t) => t.account === payTo && t.amount > 0)
            .reduce((s, t) => s + t.amount, 0);
          if (credited >= needTinybar) {
            return { ok: true, consensusAt: tx.consensus_timestamp };
          }
          return { ok: false, reason: "amount too low" };
        }
      }
    } catch (_) {
      /* retry */
    }
    await sleep(1200);
  }
  return { ok: false, reason: "not found on mirror node in time" };
}

export { NETWORK };
