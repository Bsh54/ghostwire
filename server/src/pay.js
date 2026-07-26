// Settles a real on-chain micro-payment from the assistant (operator account)
// to a service provider account, and returns the HashScan link.
import { TransferTransaction, AccountId, Hbar } from "@hashgraph/sdk";
import { NETWORK } from "./hedera.js";
import { toMirrorId } from "./x402.js";

// Settle a payment from a given buyer client/account to a provider account.
export async function payFrom(client, buyerAccountId, providerAccountId, amountHbar) {
  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(buyerAccountId), new Hbar(amountHbar).negated())
    .addHbarTransfer(AccountId.fromString(providerAccountId), new Hbar(amountHbar))
    .execute(client);
  const receipt = await tx.getReceipt(client);
  const txId = tx.transactionId.toString();
  return {
    ok: receipt.status.toString() === "SUCCESS",
    txId,
    hashscan: `https://hashscan.io/${NETWORK}/transaction/${toMirrorId(txId)}`,
  };
}
