// Real Hedera wallet connection over WalletConnect (HashPack, Blade, etc.).
// Exposes window.ghostwireConnect() which opens the wallet modal, lets the
// user approve, and stores the real account id before entering the app.
import {
  DAppConnector,
  HederaChainId,
  HederaJsonRpcMethod,
  HederaSessionEvent,
} from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";

const PROJECT_ID = "4313d0d32018b8ea165bbd6247950480";

const metadata = {
  name: "Ghostwire",
  description: "Agent-to-agent payments on Hedera",
  url: window.location.origin,
  icons: [window.location.origin + "/favicon.ico"],
};

let connector = null;
async function getConnector() {
  if (connector) return connector;
  connector = new DAppConnector(
    metadata,
    LedgerId.TESTNET,
    PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet],
  );
  await connector.init({ logger: "error" });
  return connector;
}

function accountFromSession(session) {
  const accts = session?.namespaces?.hedera?.accounts || [];
  return (accts[0] || "").split(":").pop(); // "hedera:testnet:0.0.x" -> "0.0.x"
}

window.ghostwireConnect = async function () {
  try {
    const c = await getConnector();
    const session = await c.openModal();
    const account = accountFromSession(session);
    if (!account) throw new Error("No account returned from wallet");
    localStorage.setItem(
      "ghostwire.session",
      JSON.stringify({ provider: "walletconnect", account, at: Date.now() }),
    );
    window.location.href = "app.html";
  } catch (e) {
    console.error("Wallet connection failed", e);
    alert("Wallet connection cancelled or failed.");
  }
};

// Signal to the page that the real connector is available.
window.ghostwireWalletReady = true;
