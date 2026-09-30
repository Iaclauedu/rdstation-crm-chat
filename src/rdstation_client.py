import json
import uuid
import urllib.request
import urllib.parse
import re

DEFAULT_MCP_URL = "https://mcp.rdstationmentor.com/crm/mcp?key=01a0f3d5-5d7f-7ad0-9b06-0b89467e7cc7"

class RDStationClient:
    """Client for interacting with RD Station CRM via MCP Endpoint."""

    def __init__(self, mcp_url: str = DEFAULT_MCP_URL):
        self.mcp_url = mcp_url

    def call_tool(self, name: str, arguments: dict = None) -> dict:
        """Invokes a tool on the MCP server via JSON-RPC HTTP POST."""
        if arguments is None:
            arguments = {}

        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.mcp_url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            method="POST"
        )

        with urllib.request.urlopen(req) as resp:
            raw_resp = resp.read().decode("utf-8")
            return self._parse_mcp_response(raw_resp)

    def _parse_mcp_response(self, raw_resp: str) -> dict:
        """Parses the Server-Sent Events / JSON response from MCP."""
        for line in raw_resp.split("\n"):
            if line.startswith("data: "):
                data_str = line[6:].strip()
                data_obj = json.loads(data_str)
                if "result" in data_obj and "content" in data_obj["result"]:
                    content_text = data_obj["result"]["content"][0]["text"]
                    return json.loads(content_text)
        return json.loads(raw_resp)

    def get_funnels(self) -> list:
        """Lists all sales funnels/pipelines."""
        res = self.call_tool("funnel_list", {})
        return res.get("data", [])

    def get_deal_count_by_status(self, status: str = "ongoing", pipeline_id: str = None) -> int:
        """Returns the total number of deals matching status and optional pipeline_id."""
        filter_parts = []
        if pipeline_id:
            filter_parts.append(f"pipeline_id:{pipeline_id}")
        if status:
            filter_parts.append(f"status:{status}")
        
        filter_str = " ".join(filter_parts)
        res = self.call_tool("deals_list", {"filter": filter_str, "page": {"size": 1, "number": 1}})
        
        links = res.get("links", {})
        last_url = links.get("last", "")
        if not last_url:
            return len(res.get("data", []))

        match = re.search(r"page%5Bnumber%5D=(\d+)", last_url)
        if match:
            return int(match.group(1))
        return len(res.get("data", []))
