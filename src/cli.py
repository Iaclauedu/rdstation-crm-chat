import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.rdstation_client import RDStationClient

def main():
    parser = argparse.ArgumentParser(description="RD Station CRM Command Line Tool")
    parser.add_argument("--summary", action="store_true", help="Exibe resumo geral de oportunidades")
    parser.add_argument("--funnels", action="store_true", help="Exibe o relatório de todos os funis")
    parser.add_argument("--search-org", type=str, help="Busca organizações por nome")

    args = parser.parse_args()
    client = RDStationClient()

    if args.summary:
        ongoing = client.get_deal_count_by_status("ongoing")
        won = client.get_deal_count_by_status("won")
        lost = client.get_deal_count_by_status("lost")
        print(f"Resumo CRM: Abertas={ongoing}, Ganhas={won}, Perdidas={lost}")

    elif args.funnels:
        funnels = client.get_funnels()
        for f in funnels:
            cnt = client.get_deal_count_by_status("ongoing", pipeline_id=f["id"])
            print(f"- {f['name']} ({f['id']}): {cnt} abertas")

    elif args.search_org:
        res = client.call_tool("organizations_list", {"page": {"size": 20, "number": 1}})
        orgs = res.get("data", [])
        matched = [o for o in orgs if args.search_org.lower() in o.get("name", "").lower()]
        print(f"Organizações encontradas para '{args.search_org}': {len(matched)}")
        for m in matched:
            print(f"  ID: {m['id']} - Nome: {m['name']}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
