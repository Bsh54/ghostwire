// Day 1 proof: connect to Hedera testnet, read balance, and settle a real
// on-chain HBAR transfer. Prints the HashScan link for verification.
import {
  AccountBalanceQuery,
  TransferTransaction,
  AccountId,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, OPERATOR_ID, NETWORK, hashscanTx } from "../src/hedera.js";

const client = getClient();

console.log(`\nGhostwire · Hedera ${NETWORK}`);
console.log(`Operator: ${OPERATOR_ID}`);

// 1. Read balance
const balance = await new AccountBalanceQuery()
  .setAccountId(OPERATOR_ID)
  .execute(client);
console.log(`Balance:  ${balance.hbars.toString()}`);

// 2. Settle a real transfer (0.01 HBAR to the Hedera fee account 0.0.98)
const RECEIVER = "0.0.98";
const amount = new Hbar(0.01);
console.log(`\nSettling ${amount.toString()} -> ${RECEIVER} ...`);

const tx = await new TransferTransaction()
  .addHbarTransfer(AccountId.fromString(OPERATOR_ID), amount.negated())
  .addHbarTransfer(AccountId.fromString(RECEIVER), amount)
  .execute(client);

const receipt = await tx.getReceipt(client);
console.log(`Status:   ${receipt.status.toString()}`);
console.log(`Tx ID:    ${tx.transactionId.toString()}`);
console.log(`HashScan: ${hashscanTx(tx.transactionId)}\n`);

client.close();
