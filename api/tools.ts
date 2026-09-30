import { listMcpTools } from "./_lib/mcp.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const tools = await listMcpTools();
    return res.status(200).json({ tools });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
