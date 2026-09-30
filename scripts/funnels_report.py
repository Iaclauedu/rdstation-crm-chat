import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.rdstation_client import RDStationClient

def main():
    print("==================================================")
    print("🎯 RD Station CRM - Relatório de Funis & Oportunidades")
    print("==================================================")

    client = RDStationClient()

    print("\nBuscando funis de venda cadastrados...")
    funnels = client.get_funnels()

    print(f"\nTotal de funis encontrados: {len(funnels)}\n")

    print(f"{'ID':<26} | {'NOME DO FUNIL':<32} | {'OPORTUNIDADES ABERTAS'}")
    print("-" * 75)

    for f in funnels:
        fid = f["id"]
        fname = f["name"]
        ongoing_count = client.get_deal_count_by_status(status="ongoing", pipeline_id=fid)
        print(f"{fid:<26} | {fname:<32} | {ongoing_count:>5}")

    print("==================================================")

if __name__ == "__main__":
    main()
