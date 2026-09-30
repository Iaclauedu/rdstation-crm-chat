/**
 * Shared MCP Client and Natural Language Query Processing Logic
 */

export const MCP_URL = process.env.MCP_URL || "https://mcp.rdstationmentor.com/crm/mcp?key=01a0f3d5-5d7f-7ad0-9b06-0b89467e7cc7";

// In-memory cache (persists within warm serverless container)
let cachedFunnels: any[] = [];
let lastFunnelsFetch = 0;
const funnelStagesCache: Record<string, any[]> = {};

/**
 * Invokes an MCP tool directly via JSON-RPC HTTP POST (handles SSE data stream)
 */
export async function callMcpTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const startTime = Date.now();
  const payload = {
    jsonrpc: "2.0",
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    method: "tools/call",
    params: {
      name,
      arguments: args
    }
  };

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  const durationMs = Date.now() - startTime;

  let parsedResult: any = null;
  for (const line of rawText.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        const dataObj = JSON.parse(line.slice(6));
        if (dataObj?.result?.content?.[0]?.text) {
          parsedResult = JSON.parse(dataObj.result.content[0].text);
          break;
        }
      } catch (e) {
        // ignore parse error on incomplete chunks
      }
    }
  }

  if (!parsedResult) {
    try {
      parsedResult = JSON.parse(rawText);
    } catch {
      parsedResult = { raw: rawText };
    }
  }

  return {
    tool: name,
    args,
    durationMs,
    data: parsedResult
  };
}

/**
 * List available tools from the MCP server
 */
export async function listMcpTools(): Promise<any[]> {
  try {
    const payload = {
      jsonrpc: "2.0",
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      method: "tools/list",
      params: {}
    };

    const response = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    for (const line of rawText.split("\n")) {
      if (line.startsWith("data: ")) {
        const dataObj = JSON.parse(line.slice(6));
        if (dataObj?.result?.tools) {
          return dataObj.result.tools;
        }
      }
    }
    const parsed = JSON.parse(rawText);
    return parsed?.result?.tools || [];
  } catch (err) {
    console.error("Error listing tools:", err);
    return [];
  }
}

/**
 * Helper to fetch and cache funnels
 */
export async function getFunnelsList(force = false): Promise<any[]> {
  const now = Date.now();
  if (!force && cachedFunnels.length > 0 && now - lastFunnelsFetch < 60000) {
    return cachedFunnels;
  }
  const res = await callMcpTool("funnel_list", {});
  if (res.data?.data && Array.isArray(res.data.data)) {
    cachedFunnels = res.data.data;
    lastFunnelsFetch = now;
  }
  return cachedFunnels;
}

/**
 * Helper to get stages for a funnel
 */
export async function getFunnelStages(pipelineId: string): Promise<any[]> {
  if (funnelStagesCache[pipelineId]) {
    return funnelStagesCache[pipelineId];
  }
  const res = await callMcpTool("funnel_stages_list", { pipeline_id: pipelineId });
  const stages = res.data?.data || [];
  funnelStagesCache[pipelineId] = stages;
  return stages;
}

/**
 * Intelligent NLP & CRM Query Handler
 */
export async function handleChatQuery(userMessage: string): Promise<{
  reply: string;
  toolCalls: any[];
  stats?: any;
  suggestions?: string[];
}> {
  const query = userMessage.trim().toLowerCase();
  const toolCalls: any[] = [];
  const funnels = await getFunnelsList();

  // 1. Direct tool invocation check (e.g. "/tool funnel_list" or "mcp deals_list")
  if (query.startsWith("/tool ") || query.startsWith("mcp ")) {
    const parts = query.replace(/^\/(tool|mcp)\s+/, "").split(" ");
    const toolName = parts[0];
    let args = {};
    if (parts.length > 1) {
      try {
        args = JSON.parse(parts.slice(1).join(" "));
      } catch {
        args = {};
      }
    }
    const res = await callMcpTool(toolName, args);
    toolCalls.push(res);
    return {
      reply: `### Execução direta da ferramenta MCP: \`${toolName}\`\n\n\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``,
      toolCalls,
      suggestions: ["Listar funis", "Ver resumo geral", "Buscar organizações"]
    };
  }

  // 2. Identify if a specific funnel was mentioned
  let matchedFunnel: any = null;
  for (const f of funnels) {
    const fNameLower = f.name.toLowerCase();
    const cleanFName = fNameLower.replace(/funil\s+(de\s+vendas\s+)?/g, "").trim();
    if (fNameLower.includes("alldot") && query.includes("alldot")) {
      matchedFunnel = f;
      break;
    }
    if (query.includes(fNameLower) || (cleanFName.length > 3 && query.includes(cleanFName))) {
      matchedFunnel = f;
      break;
    }
  }

  // Identify status intent
  let statusFilter = "ongoing"; // default to open deals
  let statusName = "abertas (em andamento)";
  if (query.includes("ganha") || query.includes("ganho") || query.includes("won")) {
    statusFilter = "won";
    statusName = "ganhas (fechadas)";
  } else if (query.includes("perdida") || query.includes("perdido") || query.includes("lost")) {
    statusFilter = "lost";
    statusName = "perdidas";
  } else if (query.includes("todas") || query.includes("geral") || query.includes("total")) {
    statusFilter = "";
    statusName = "todas";
  }

  // 3. Question about opportunities in a specific funnel (e.g. AllDot)
  if (matchedFunnel) {
    const stagesPromise = getFunnelStages(matchedFunnel.id);
    
    const filterParts = [`pipeline_id:${matchedFunnel.id}`];
    if (statusFilter) {
      filterParts.push(`status:${statusFilter}`);
    }
    const filterStr = filterParts.join(" ");

    const dealsToolRes = await callMcpTool("deals_list", {
      filter: filterStr,
      page: { size: 100, number: 1 }
    });
    toolCalls.push(dealsToolRes);

    const stages = await stagesPromise;
    const stageMap: Record<string, string> = {};
    stages.forEach((s: any) => {
      stageMap[s.id] = s.name;
    });

    const deals = dealsToolRes.data?.data || [];
    const count = deals.length;

    const byStage: Record<string, any[]> = {};
    let totalValue = 0;

    deals.forEach((d: any) => {
      const stageId = d.details?.stage_id;
      const sName = stageMap[stageId] || "Etapa Não Identificada";
      if (!byStage[sName]) byStage[sName] = [];
      byStage[sName].push(d);
      totalValue += (d.total_price || 0);
    });

    let reply = `No **${matchedFunnel.name}**, existem atualmente **${count} oportunidades** com status **${statusName}**.\n\n`;

    if (count > 0) {
      reply += `| Oportunidade | Etapa do Funil | Valor Total | Criada em |\n`;
      reply += `| :--- | :--- | :--- | :--- |\n`;

      deals.forEach((d: any) => {
        const sName = stageMap[d.details?.stage_id] || "Etapa Inicial";
        const val = d.total_price ? `R$ ${Number(d.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ 0,00";
        const dateStr = d.details?.created_at ? new Date(d.details.created_at).toLocaleDateString("pt-BR") : "-";
        reply += `| **${d.name || "Sem título"}** | \`${sName}\` | ${val} | ${dateStr} |\n`;
      });

      reply += `\n### 📊 Distribuição por Etapas:\n`;
      for (const [stg, list] of Object.entries(byStage)) {
        reply += `- **${stg}**: ${list.length} oportunidade(s)\n`;
      }

      if (totalValue > 0) {
        reply += `\n💰 **Valor total em negociação:** R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
      }
    } else {
      reply += `> Não foram encontradas oportunidades com status **${statusName}** neste funil no momento.`;
    }

    return {
      reply,
      toolCalls,
      stats: { count, totalValue, funnel: matchedFunnel.name },
      suggestions: [
        `Ver oportunidades ganhas no ${matchedFunnel.name}`,
        `Ver etapas do ${matchedFunnel.name}`,
        "Listar todos os funis de vendas",
        "Resumo geral de oportunidades no CRM"
      ]
    };
  }

  // 4. Question: List funnels
  if (query.includes("funil") || query.includes("funis") || query.includes("pipeline")) {
    const funnelToolRes = await callMcpTool("funnel_list", {});
    toolCalls.push(funnelToolRes);
    const funnelList = funnelToolRes.data?.data || [];

    let reply = `Encontrei **${funnelList.length} funis de vendas** configurados no RD Station CRM:\n\n`;
    reply += `| # | Nome do Funil | ID do Funil | Etapas |\n`;
    reply += `| :-: | :--- | :--- | :-: |\n`;

    funnelList.forEach((f: any) => {
      const stageCount = f.details?.stage_ids?.length || 0;
      reply += `| ${f.order} | **${f.name}** | \`${f.id}\` | ${stageCount} etapas |\n`;
    });

    reply += `\n*Você pode clicar em qualquer um deles ou me perguntar sobre as oportunidades em aberto de qualquer funil!*`;

    return {
      reply,
      toolCalls,
      suggestions: [
        "Quantas oportunidades abertas existem no funil da AllDot?",
        "Oportunidades no Funil de vendas Brinday",
        "Resumo geral de todos os negócios"
      ]
    };
  }

  // 5. Question: General deal summary
  if (query.includes("resumo") || query.includes("geral") || (query.includes("oportunidades") && !query.includes("empresa"))) {
    const [ongoingRes, wonRes, lostRes] = await Promise.all([
      callMcpTool("deals_list", { filter: "status:ongoing", page: { size: 1, number: 1 } }),
      callMcpTool("deals_list", { filter: "status:won", page: { size: 1, number: 1 } }),
      callMcpTool("deals_list", { filter: "status:lost", page: { size: 1, number: 1 } })
    ]);
    toolCalls.push(ongoingRes, wonRes, lostRes);

    const getCount = (res: any) => {
      const lastUrl = res.data?.links?.last || "";
      const match = lastUrl.match(/page%5Bnumber%5D=(\d+)/);
      return match ? parseInt(match[1], 10) : (res.data?.data?.length || 0);
    };

    const countOngoing = getCount(ongoingRes);
    const countWon = getCount(wonRes);
    const countLost = getCount(lostRes);
    const total = countOngoing + countWon + countLost;

    let reply = `### 📊 Panorama Geral de Oportunidades no CRM\n\n`;
    reply += `Aqui está a consolidação atual de todos os negócios registrados:\n\n`;
    reply += `| Status | Quantidade | Percentual |\n`;
    reply += `| :--- | :--- | :--- |\n`;
    reply += `| 🟢 **Abertas (Ongoing)** | **${countOngoing}** | ${total ? ((countOngoing / total) * 100).toFixed(1) : 0}% |\n`;
    reply += `| 🏆 **Ganhas (Won)** | **${countWon}** | ${total ? ((countWon / total) * 100).toFixed(1) : 0}% |\n`;
    reply += `| ❌ **Perdidas (Lost)** | **${countLost}** | ${total ? ((countLost / total) * 100).toFixed(1) : 0}% |\n`;
    reply += `| 📈 **Total Geral** | **${total}** | 100% |\n\n`;
    reply += `> Dica: Você pode detalhar qualquer funil específico, como o **Funil AllDot** ou o **Funil Brinday**.`;

    return {
      reply,
      toolCalls,
      suggestions: [
        "Quantas oportunidades abertas existem no funil da AllDot?",
        "Listar todos os funis",
        "Listar organizações cadastradas"
      ]
    };
  }

  // 6. Organizations / Empresas
  if (query.includes("empresa") || query.includes("organizac") || query.includes("organizaç") || query.includes("organizacao")) {
    const orgRes = await callMcpTool("organizations_list", { page: { size: 15, number: 1 } });
    toolCalls.push(orgRes);
    const orgs = orgRes.data?.data || [];

    let reply = `### 🏢 Organizações Cadastradas no CRM\n\n`;
    reply += `Listando até ${orgs.length} empresas recentes:\n\n`;
    reply += `| Nome da Organização | ID | Criado em |\n`;
    reply += `| :--- | :--- | :--- |\n`;
    orgs.forEach((o: any) => {
      const dt = o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "-";
      reply += `| **${o.name}** | \`${o.id}\` | ${dt} |\n`;
    });

    return {
      reply,
      toolCalls,
      suggestions: [
        "Listar contatos",
        "Quantas oportunidades abertas existem no funil da AllDot?",
        "Resumo geral de negócios"
      ]
    };
  }

  // 7. Contacts
  if (query.includes("contato") || query.includes("pessoa") || query.includes("lead")) {
    const contactRes = await callMcpTool("contacts_list", { page: { size: 15, number: 1 } });
    toolCalls.push(contactRes);
    const contacts = contactRes.data?.data || [];

    let reply = `### 👥 Contatos Registrados no CRM\n\n`;
    reply += `Listando ${contacts.length} contatos recentes:\n\n`;
    reply += `| Nome | Cargo / Empresa | Criado em |\n`;
    reply += `| :--- | :--- | :--- |\n`;
    contacts.forEach((c: any) => {
      const dt = c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "-";
      const title = c.title || "-";
      reply += `| **${c.name || "Sem nome"}** | ${title} | ${dt} |\n`;
    });

    return {
      reply,
      toolCalls,
      suggestions: [
        "Quantas oportunidades abertas existem no funil da AllDot?",
        "Listar funis de venda",
        "Resumo de oportunidades"
      ]
    };
  }

  // 8. Fallback: Search deals by name pattern
  const cleanTerm = query.replace(/[^\w\sÀ-ÿ]/g, "").trim();
  const searchDealRes = await callMcpTool("deals_list", {
    filter: `name:~${cleanTerm}`,
    page: { size: 10, number: 1 }
  });
  toolCalls.push(searchDealRes);
  const foundDeals = searchDealRes.data?.data || [];

  if (foundDeals.length > 0) {
    let reply = `Encontrei **${foundDeals.length} oportunidade(s)** correspondentes ao termo "${cleanTerm}":\n\n`;
    reply += `| Oportunidade | Status | Valor |\n`;
    reply += `| :--- | :--- | :--- |\n`;
    foundDeals.forEach((d: any) => {
      const statusPill = d.status === "ongoing" ? "🟢 Aberta" : (d.status === "won" ? "🏆 Ganha" : "❌ Perdida");
      const val = d.total_price ? `R$ ${d.total_price.toLocaleString("pt-BR")}` : "R$ 0";
      reply += `| **${d.name}** | ${statusPill} | ${val} |\n`;
    });
    return {
      reply,
      toolCalls,
      suggestions: [
        "Quantas oportunidades abertas existem no funil da AllDot?",
        "Listar todos os funis de vendas",
        "Resumo geral de oportunidades"
      ]
    };
  }

  // Generic fallback
  return {
    reply: `Olá! Sou seu assistente para o **RD Station CRM via MCP**. Você pode me fazer perguntas diretas sobre seus dados comerciais, tais como:\n\n` +
           `- *"Quantas oportunidades abertas existem no funil da AllDot?"*\n` +
           `- *"Quais são os funis de vendas cadastrados?"*\n` +
           `- *"Resumo geral de negócios ganhos e perdidos"*\n` +
           `- *"Listar empresas e organizações"*\n` +
           `- *"Listar contatos recentes"*\n\n` +
           `Ou você pode usar o inspetor de ferramentas para rodar qualquer uma das **54 ferramentas MCP** diretamente!`,
    toolCalls,
    suggestions: [
      "Quantas oportunidades abertas existem no funil da AllDot?",
      "Listar todos os funis de vendas",
      "Resumo geral de negócios no CRM"
    ]
  };
}
