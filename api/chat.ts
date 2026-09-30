import { handleChatQuery } from "./_lib/mcp.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const message = body?.message;
    if (!message) {
      return res.status(400).json({ error: "Mensagem vazia" });
    }

    const responseData = await handleChatQuery(message);
    return res.status(200).json(responseData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
