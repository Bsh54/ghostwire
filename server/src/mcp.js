// Real MCP server (Streamable HTTP): exposes the Ghostwire agent team as MCP
// tools so any MCP client (Claude Desktop, Cursor, ...) can call them. Each
// tool call settles a real on-chain Hedera payment before returning a result.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { TOOLS } from "./tools.js";
import { payFrom } from "./pay.js";
import { getClient, OPERATOR_ID } from "./hedera.js";

const operator = getClient();

function zshape(params) {
  const shape = {};
  for (const [k, v] of Object.entries(params.properties || {})) {
    let zt = z.string().describe(v.description || "");
    if (!(params.required || []).includes(k)) zt = zt.optional();
    shape[k] = zt;
  }
  return shape;
}

function build() {
  const server = new McpServer({ name: "ghostwire", version: "1.0.0" });
  for (const [name, t] of Object.entries(TOOLS)) {
    server.tool(name, t.def.function.description, zshape(t.def.function.parameters), async (args) => {
      let note = "";
      try {
        const pay = await payFrom(operator, OPERATOR_ID, t.provider, t.price);
        note = `\n\n[settled ${t.price} HBAR on Hedera testnet · ${pay.hashscan}]`;
      } catch (e) {
        note = `\n\n[payment error: ${e.message}]`;
      }
      const result = await t.run(args);
      return { content: [{ type: "text", text: String(result) + note }] };
    });
  }
  return server;
}

export function mountMcp(app) {
  app.post("/mcp", async (req, res) => {
    try {
      const server = build();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { try { transport.close(); server.close(); } catch (_) {} });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: String(e.message || e) });
    }
  });
  // Simple probe for humans / health checks.
  app.get("/mcp/info", (_req, res) =>
    res.json({ name: "ghostwire", transport: "streamable-http", tools: Object.keys(TOOLS) }));
}
