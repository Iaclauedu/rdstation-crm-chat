/**
 * RD Station CRM MCP AI Chat - Frontend Application
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatContainer = document.getElementById("chat-container");
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("btn-send");
  const welcomeHero = document.getElementById("welcome-hero");
  const typingIndicator = document.getElementById("typing-indicator");
  const btnClearChat = document.getElementById("btn-clear-chat");
  const btnNewChat = document.getElementById("btn-new-chat");
  const funnelsList = document.getElementById("funnels-list");
  const funnelsCountBadge = document.getElementById("funnels-count-badge");
  const footerLatency = document.getElementById("footer-latency");
  const toast = document.getElementById("toast");

  // Sidebar elements
  const sidebar = document.getElementById("sidebar");
  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
  const btnMobileMenu = document.getElementById("btn-mobile-menu");

  // Tools Modal elements
  const btnOpenTools = document.getElementById("btn-open-tools");
  const toolsModalBackdrop = document.getElementById("tools-modal-backdrop");
  const btnCloseTools = document.getElementById("btn-close-tools");
  const selectTool = document.getElementById("select-tool");
  const toolDesc = document.getElementById("tool-desc");
  const toolArgsInput = document.getElementById("tool-args-input");
  const btnRunTool = document.getElementById("btn-run-tool");
  const toolResultSection = document.getElementById("tool-result-section");
  const toolResultCode = document.getElementById("tool-result-code");
  const execDuration = document.getElementById("exec-duration");

  let allToolsCache = [];
  let isGenerating = false;

  // Initialize
  initApp();

  async function initApp() {
    setupEventListeners();
    await checkStatus();
    await loadFunnels();
    userInput.focus();
  }

  function setupEventListeners() {
    // Form submit
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Auto-grow textarea & Enter key to send
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    userInput.addEventListener("input", () => {
      userInput.style.height = "auto";
      userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
    });

    // Clear chat
    btnClearChat.addEventListener("click", clearChat);
    btnNewChat.addEventListener("click", clearChat);

    // Sidebar toggles
    btnToggleSidebar.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });

    if (btnMobileMenu) {
      btnMobileMenu.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
      });
    }

    // Starter Cards & Suggestion Chips delegation
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-query]");
      if (target) {
        const query = target.getAttribute("data-query");
        if (query) {
          userInput.value = query;
          userInput.style.height = "auto";
          sendMessage();
        }
      }
    });

    // Tools Inspector Modal
    btnOpenTools.addEventListener("click", openToolsModal);
    btnCloseTools.addEventListener("click", closeToolsModal);
    toolsModalBackdrop.addEventListener("click", (e) => {
      if (e.target === toolsModalBackdrop) closeToolsModal();
    });

    selectTool.addEventListener("change", onToolSelected);
    btnRunTool.addEventListener("click", runMcpTool);
  }

  // Toast notification helper
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // MCP Status Check
  async function checkStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (data.status === "connected") {
        footerLatency.textContent = `${data.latencyMs} ms`;
      } else {
        footerLatency.textContent = "Offline";
      }
    } catch {
      footerLatency.textContent = "Erro de rede";
    }
  }

  // Load Funnels in Sidebar
  async function loadFunnels() {
    try {
      const res = await fetch("/api/funnels");
      const data = await res.json();
      const funnels = data.funnels || [];

      funnelsCountBadge.textContent = funnels.length;
      funnelsList.innerHTML = "";

      if (funnels.length === 0) {
        funnelsList.innerHTML = '<div class="sidebar-loading">Nenhum funil encontrado.</div>';
        return;
      }

      funnels.forEach((f) => {
        const item = document.createElement("button");
        item.className = "funnel-item";
        item.setAttribute("data-query", `quantas oportunidades abertas existem no funil da ${f.name}?`);

        const stageCount = f.details?.stage_ids?.length || 0;
        item.innerHTML = `
          <span class="funnel-name" title="${f.name}">${f.name}</span>
          <span class="funnel-stages-pill">${stageCount} etapas</span>
        `;
        funnelsList.appendChild(item);
      });
    } catch (err) {
      funnelsList.innerHTML = '<div class="sidebar-loading">Erro ao carregar funis.</div>';
    }
  }

  // Clear Chat
  function clearChat() {
    chatMessages.innerHTML = "";
    welcomeHero.classList.remove("hidden");
    userInput.value = "";
    userInput.style.height = "auto";
    userInput.focus();
  }

  // Send Message Flow
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isGenerating) return;

    // Hide welcome hero
    welcomeHero.classList.add("hidden");

    // Add User Message
    appendMessage("user", text);
    userInput.value = "";
    userInput.style.height = "auto";
    sendBtn.disabled = true;
    isGenerating = true;

    // Show typing indicator
    typingIndicator.classList.remove("hidden");
    scrollToBottom();

    try {
      const startTime = Date.now();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();
      typingIndicator.classList.add("hidden");

      if (response.ok) {
        appendMessage("assistant", data.reply, {
          toolCalls: data.toolCalls,
          suggestions: data.suggestions
        });
      } else {
        appendMessage("assistant", `❌ **Erro na consulta ao MCP:** ${data.error || "Ocorreu um erro desconhecido"}`);
      }
    } catch (err) {
      typingIndicator.classList.add("hidden");
      appendMessage("assistant", `⚠️ **Falha de conexão com o servidor local:** ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      isGenerating = false;
      userInput.focus();
      scrollToBottom();
    }
  }

  // Append a message to the chat view
  function appendMessage(sender, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message-row ${sender}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    let avatarHtml = "";
    if (sender === "user") {
      avatarHtml = `<div class="msg-avatar user-avatar">VOCÊ</div>`;
    } else {
      avatarHtml = `
        <div class="msg-avatar bot-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
      `;
    }

    const body = document.createElement("div");
    body.className = "msg-body";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = renderMarkdown(text);
    body.appendChild(bubble);

    // If there were MCP tool calls, append interactive inspector accordion
    if (options.toolCalls && options.toolCalls.length > 0) {
      const toolContainer = document.createElement("div");
      toolContainer.className = "tool-calls-container";

      options.toolCalls.forEach((tc, idx) => {
        const accordion = document.createElement("div");
        accordion.className = "tool-accordion";

        const summary = document.createElement("button");
        summary.className = "tool-accordion-summary";
        summary.innerHTML = `
          <div class="tool-pill">
            <span>⚙️ MCP:</span>
            <span class="tool-badge">${tc.tool}</span>
          </div>
          <span class="tool-duration">${tc.durationMs}ms ▾</span>
        `;

        const content = document.createElement("div");
        content.className = "tool-accordion-content";
        content.style.display = "none";
        content.innerHTML = `
          <div style="margin-bottom:6px; color:#94a3b8;"><strong>Argumentos:</strong> ${JSON.stringify(tc.args)}</div>
          <pre><code>${escapeHtml(JSON.stringify(tc.data, null, 2))}</code></pre>
        `;

        summary.addEventListener("click", () => {
          const isHidden = content.style.display === "none";
          content.style.display = isHidden ? "block" : "none";
          summary.querySelector(".tool-duration").textContent = `${tc.durationMs}ms ${isHidden ? "▴" : "▾"}`;
        });

        accordion.appendChild(summary);
        accordion.appendChild(content);
        toolContainer.appendChild(accordion);
      });

      body.appendChild(toolContainer);
    }

    // Follow-up suggestions
    if (options.suggestions && options.suggestions.length > 0) {
      const sugWrapper = document.createElement("div");
      sugWrapper.className = "follow-up-suggestions";
      options.suggestions.forEach((sug) => {
        const btn = document.createElement("button");
        btn.className = "follow-up-btn";
        btn.setAttribute("data-query", sug);
        btn.textContent = `💡 ${sug}`;
        sugWrapper.appendChild(btn);
      });
      body.appendChild(sugWrapper);
    }

    const timestamp = document.createElement("div");
    timestamp.className = "msg-timestamp";
    timestamp.textContent = timeStr;
    body.appendChild(timestamp);

    row.appendChild(avatarHtml === "" ? "" : parseHTML(avatarHtml));
    row.appendChild(body);

    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function parseHTML(str) {
    const t = document.createElement("div");
    t.innerHTML = str;
    return t.firstElementChild;
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Simple and Robust Markdown to HTML Renderer
  function renderMarkdown(md) {
    if (!md) return "";

    let html = md;

    // Code blocks ```lang ... ```
    html = html.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Tables: recognize | header | header |\n| :--- | :--- |\n| val | val |
    html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
      const lines = match.trim().split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      let tableHtml = "<table>";
      let isHeader = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if separator line (| :--- | :--- |)
        if (line.includes("---") || line.includes(":--")) {
          isHeader = false;
          continue;
        }

        const cells = line.split("|").slice(1, -1).map(c => c.trim());
        if (isHeader) {
          tableHtml += "<thead><tr>";
          cells.forEach(c => {
            tableHtml += `<th>${c}</th>`;
          });
          tableHtml += "</tr></thead><tbody>";
        } else {
          tableHtml += "<tr>";
          cells.forEach(c => {
            tableHtml += `<td>${c}</td>`;
          });
          tableHtml += "</tr>";
        }
      }

      tableHtml += "</tbody></table>";
      return tableHtml;
    });

    // Headers
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

    // Bold & Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Unordered lists (- item)
    html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/gim, "<ul>$1</ul>");

    // Paragraphs (double newlines)
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(p => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith("<table") || p.startsWith("<h") || p.startsWith("<pre") || p.startsWith("<ul") || p.startsWith("<blockquote")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- MCP Tools Drawer Logic ---
  async function openToolsModal() {
    toolsModalBackdrop.classList.remove("hidden");
    if (allToolsCache.length === 0) {
      selectTool.innerHTML = '<option value="">Carregando ferramentas MCP...</option>';
      try {
        const res = await fetch("/api/tools");
        const data = await res.json();
        allToolsCache = data.tools || [];
        populateToolsDropdown(allToolsCache);
      } catch (err) {
        selectTool.innerHTML = '<option value="">Erro ao carregar ferramentas.</option>';
      }
    }
  }

  function closeToolsModal() {
    toolsModalBackdrop.classList.add("hidden");
  }

  function populateToolsDropdown(tools) {
    selectTool.innerHTML = '<option value="">-- Escolha uma ferramenta --</option>';
    // Sort tools alphabetically
    tools.sort((a, b) => a.name.localeCompare(b.name));
    tools.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.textContent = `${t.name} - ${t.title || t.name}`;
      selectTool.appendChild(opt);
    });

    // Default select deals_list if present
    if (tools.some(t => t.name === "deals_list")) {
      selectTool.value = "deals_list";
      onToolSelected();
    }
  }

  function onToolSelected() {
    const selectedName = selectTool.value;
    const tool = allToolsCache.find(t => t.name === selectedName);
    if (!tool) {
      toolDesc.textContent = "Selecione uma ferramenta para inspecionar.";
      toolArgsInput.value = "{}";
      return;
    }

    toolDesc.innerHTML = `<strong>${escapeHtml(tool.title || tool.name)}:</strong> ${escapeHtml(tool.description?.slice(0, 200) || "")}...`;

    // Construct intelligent default template based on tool parameters
    const schema = tool.parameters?.properties || {};
    const defaultArgs = {};
    if (selectedName === "deals_list") {
      defaultArgs["filter"] = "status:ongoing";
      defaultArgs["page"] = { size: 10, number: 1 };
    } else if (selectedName === "funnel_stages_list") {
      defaultArgs["pipeline_id"] = "697ca1253dd49d0013d1ff8d";
    } else {
      for (const [key, val] of Object.entries(schema)) {
        if (key === "page") {
          defaultArgs[key] = { size: 10, number: 1 };
        } else if (val.type === "string") {
          defaultArgs[key] = "";
        }
      }
    }

    toolArgsInput.value = JSON.stringify(defaultArgs, null, 2);
  }

  async function runMcpTool() {
    const toolName = selectTool.value;
    if (!toolName) {
      showToast("Selecione uma ferramenta primeiro.");
      return;
    }

    let args = {};
    try {
      args = JSON.parse(toolArgsInput.value);
    } catch (err) {
      showToast("JSON de argumentos inválido!");
      return;
    }

    btnRunTool.disabled = true;
    btnRunTool.innerHTML = "Executando no MCP...";
    toolResultSection.classList.remove("hidden");
    toolResultCode.textContent = "Carregando resposta da API...";
    execDuration.textContent = "-- ms";

    try {
      const res = await fetch("/api/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, args })
      });
      const data = await res.json();
      execDuration.textContent = `${data.durationMs || 0} ms`;
      toolResultCode.textContent = JSON.stringify(data.data, null, 2);
      showToast(`Ferramenta ${toolName} executada!`);
    } catch (err) {
      toolResultCode.textContent = `Erro: ${err.message}`;
    } finally {
      btnRunTool.disabled = false;
      btnRunTool.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Executar no MCP
      `;
    }
  }
});
