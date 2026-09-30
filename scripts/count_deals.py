import os
import sys

# Ensure src module is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.rdstation_client import RDStationClient

def main():
    print("==================================================")
    print("📊 RD Station CRM - Contagem Geral de Oportunidades")
    print("==================================================")

    client = RDStationClient()

    print("\nBuscando dados no CRM...")
    ongoing = client.get_deal_count_by_status("ongoing")
    won = client.get_deal_count_by_status("won")
    lost = client.get_deal_count_by_status("lost")

    total = ongoing + won + lost

    print(f"\n🟢 Oportunidades Abertas (Ongoing): {ongoing:,}")
    print(f"🏆 Oportunidades Ganhas (Won)      : {won:,}")
    print(f"❌ Oportunidades Perdidas (Lost)   : {lost:,}")
    print(f"--------------------------------------------------")
    print(f"📈 Total Geral de Oportunidades    : {total:,}")
    print("==================================================")

if __name__ == "__main__":
    main()
