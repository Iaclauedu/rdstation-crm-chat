# RD Station CRM - Integration & Query Project

Este projeto contém scripts e utilitários em Python para integração e consulta de dados no **RD Station CRM** via servidor MCP (Model Context Protocol) e API HTTP.

---

## 📁 Estrutura do Projeto

```text
rdstation-crm-project/
├── .env.example              # Modelo de variáveis de ambiente
├── .gitignore                # Arquivos ignorados pelo Git
├── mcp_config.json           # Configuração do servidor MCP do RD Station CRM
├── pyproject.toml            # Configurações do projeto e dependências (uv/pip)
├── README.md                 # Instruções do projeto
├── server.ts                 # Servidor HTTP Bun com processamento NLP e conexão MCP
├── public/                   # Interface Web moderna estilo chat
│   ├── index.html            # Estrutura HTML5 com dark mode e glassmorphism
│   ├── style.css             # Design system completo, responsivo e animações
│   └── app.js                # Lógica do chat, renderização markdown e inspetor MCP
├── scripts/
│   ├── count_deals.py        # Consulta estatísticas de oportunidades (abertas, ganhas, perdidas)
│   └── funnels_report.py     # Relatório de oportunidades abertas por funil (ex: BrinDay)
└── src/
    ├── __init__.py
    ├── cli.py                # Interface de linha de comando (CLI) para consultas rápidas
    └── rdstation_client.py   # Cliente HTTP / MCP reutilizável para o RD Station CRM
```

---

## 💬 Interface Web de Chat (MCP AI Chat)

Para iniciar o chat web interativo:

```bash
bun run server.ts
```

Acesse no navegador: **[http://localhost:3000](http://localhost:3000)**

Recursos da interface web:
- Chat em linguagem natural conectado diretamente ao MCP.
- Visualização instantânea de oportunidades, funis de venda, etapas, organizações e contatos.
- Tabelas detalhadas e métricas de distribuição por etapa.
- Accordion expansível com o tempo de resposta em ms e parâmetros da ferramenta MCP chamada (`deals_list`, `funnel_list`, etc.).
- Inspetor de ferramentas para executar qualquer uma das 54 ferramentas MCP com parâmetros customizados.

---

## 🚀 Como Executar

### 1. Definir esta pasta como Workspace Ativo no IDE
Para uma melhor experiência no Antigravity IDE, recomendamos abrir/definir o caminho deste projeto como o seu workspace ativo:
`C:\Users\carlos.moreira\.gemini\antigravity\scratch\rdstation-crm-project`

### 2. Instalação das Dependências

Usando `uv` ou `pip`:
```bash
pip install -r requirements.txt
# ou usando uv:
uv sync
```

### 3. Execução dos Scripts

#### Relatório Geral de Oportunidades:
```bash
python scripts/count_deals.py
```

#### Relatório de Funis (Ex: Funis BrinDay):
```bash
python scripts/funnels_report.py
```

#### CLI Interativa:
```bash
python src/cli.py --summary
```

---

## ⚙️ Configuração MCP
O arquivo `mcp_config.json` já está configurado com o endpoint SSE do servidor MCP:
```json
{
  "mcpServers": {
    "rdstation-crm": {
      "url": "https://mcp.rdstationmentor.com/crm/mcp?key=01a0f3d5-5d7f-7ad0-9b06-0b89467e7cc7",
      "transport": "sse"
    }
  }
}
```
