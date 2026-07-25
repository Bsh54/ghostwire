import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Builds the wallet integration into web/assets/wallet.js so the static
// landing page can load a real Hedera WalletConnect flow.
export default defineConfig({
  plugins: [nodePolyfills()],
  build: {
    outDir: "../web/assets",
    emptyOutDir: true,
    lib: {
      entry: "main.js",
      formats: ["es"],
      fileName: () => "wallet.js",
    },
  },
});
