// Settles a real on-chain micro-payment from the assistant (operator account)
// to a service provider account, and returns the HashScan link.
import { TransferTransaction, AccountId, Hbar } from "@hashgraph/sdk";
import { getClient, NETWORK, OPERATOR_ID } from "./hedera.js";
import { toMirrorId } from "./x402.js";

const client = getClient();

export async function payProvider(providerAccountId, amountHbar) {
  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(OPERATOR_ID), new Hbar(amountHbar).negated())
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
