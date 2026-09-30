import { serve } from "bun";
import { existsSync } from "fs";
import { join } from "path";
import {
  callMcpTool,
  listMcpTools,
  getFunnelsList,
  handleChatQuery,
  MCP_URL
} from "./api/_lib/mcp.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_DIR = join(import.meta.dir, "public");

// Start Bun Server for local development
const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    // API Routes
    if (url.pathname === "/api/status") {
      const start = Date.now();
      try {
        const funnels = await getFunnelsList();
        const latency = Date.now() - start;
        return new Response(JSON.stringify({
          status: "connected",
          latencyMs: latency,
          funnelsCount: funnels.length,
          mcpUrl: MCP_URL.split("?")[0]
        }), { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({
          status: "error",
          error: err.message
        }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/funnels") {
      try {
        const funnels = await getFunnelsList();
        return new Response(JSON.stringify({ funnels }), { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/tools") {
      try {
        const tools = await listMcpTools();
        return new Response(JSON.stringify({ tools }), { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/mcp/call" && req.method === "POST") {
      try {
        const body: any = await req.json();
        const { tool, args } = body || {};
        if (!tool) {
          return new Response(JSON.stringify({ error: "Parâmetro 'tool' é obrigatório" }), { status: 400, headers });
        }
        const result = await callMcpTool(tool, args || {});
        return new Response(JSON.stringify(result), { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body: any = await req.json();
        const { message } = body || {};
        if (!message) {
          return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400, headers });
        }
        const responseData = await handleChatQuery(message);
        return new Response(JSON.stringify(responseData), { headers });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    // Static Files
    let filePath = join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    if (existsSync(filePath)) {
      const file = Bun.file(filePath);
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`🚀 Servidor RD Station CRM MCP Web Chat rodando em http://localhost:${server.port}`);
