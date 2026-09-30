import { getFunnelsList, MCP_URL } from "./_lib/mcp.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const start = Date.now();
  try {
    const funnels = await getFunnelsList();
    const latency = Date.now() - start;
    return res.status(200).json({
      status: "connected",
      latencyMs: latency,
      funnelsCount: funnels.length,
      mcpUrl: MCP_URL.split("?")[0]
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      error: err.message
    });
  }
}
