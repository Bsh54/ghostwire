// Real MCP server (Streamable HTTP): exposes the Ghostwire agent team as MCP
// tools so any MCP client (Claude Desktop, Cursor, ...) can call them. Each
// tool call settles a real on-chain Hedera payment before returning a result.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { AGENTS } from "./registry.js";
import { hire } from "./hire.js";
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
  for (const [name, a] of Object.entries(AGENTS)) {
    server.tool(name, a.def.function.description, zshape(a.def.function.parameters), async (args) => {
      let result = "", note = "";
      try {
        const out = await hire(a.path, args, { client: operator, accountId: OPERATOR_ID });
        result = out.result;
        note = out.hashscan ? `\n\n[settled ${out.amount} HBAR on Hedera testnet · ${out.hashscan}]` : "";
      } catch (e) {
        result = "(error contacting agent: " + (e.message || e) + ")";
      }
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
