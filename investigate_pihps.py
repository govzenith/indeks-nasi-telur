"""Test berbagai variasi parameter ke endpoint GetChartDaerah & GetGridDataDaerah."""
import sys
import json
from datetime import date, timedelta
import requests

sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://www.bi.go.id/hargapangan"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "id,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE}/TabelHarga/PasarTradisionalDaerah",
}


def call(name, endpoint, params):
    print(f"\n--- {name} ---")
    print(f"params: {params}")
    r = requests.get(f"{BASE}{endpoint}", params=params, headers=HEADERS, timeout=20)
    print(f"Status: {r.status_code} | Size: {len(r.text)}")
    try:
        data = r.json()
        payload = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(payload, list):
            print(f"Records: {len(payload)}")
            for row in payload[:5]:
                print(f"  {row}")
            return payload
        else:
            print(f"Payload: {payload}")
            return None
    except Exception:
        print(f"Body (300): {r.text[:300]}")
        return None


# === EKSPERIMEN TANGGAL ===
today = date.today()
print(f"Today (system): {today}\n")

variations = [
    # (label, start_offset_days, end_offset_days)
    ("kemarin saja", -1, -1),
    ("7 hari terakhir berakhir kemarin", -8, -1),
    ("30 hari terakhir berakhir kemarin", -31, -1),
    ("rentang lama (90-60 hari lalu)", -90, -60),
    ("Januari 2025", None, None),  # special
]

for label, s_off, e_off in variations:
    if s_off is None:
        start = date(2025, 1, 1)
        end = date(2025, 1, 31)
    else:
        start = today + timedelta(days=s_off)
        end = today + timedelta(days=e_off)
    params = {
        "price_type_id": 1,
        "comcat_id": "com_3",     # Beras Kualitas Medium I
        "province_id": "13",       # DKI Jakarta
        "regency_id": "",
        "market_id": "",
        "tipe_laporan": 1,
        "start_date": start.strftime("%Y-%m-%dT00:00:00.000"),
        "end_date": end.strftime("%Y-%m-%dT00:00:00.000"),
    }
    payload = call(f"CHART · {label}", "/WebSite/TabelHarga/GetChartDaerah", params)
    if payload:
        # cek apakah data sebenarnya berisi
        non_empty = [r for r in payload if r]
        if non_empty:
            print(f"  ★ DAPAT {len(non_empty)} record berisi!")
            break

print("\n\n=== COBA category level (cat_1) bukan com_3 ===")
params = {
    "price_type_id": 1,
    "comcat_id": "cat_1",
    "province_id": "13",
    "regency_id": "",
    "market_id": "",
    "tipe_laporan": 1,
    "start_date": (today - timedelta(days=8)).strftime("%Y-%m-%dT00:00:00.000"),
    "end_date": (today - timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000"),
}
call("CHART cat_1 (Beras kategori)", "/WebSite/TabelHarga/GetChartDaerah", params)

print("\n\n=== COBA GetGridDataDaerah ===")
call("GRID 7 hari berakhir kemarin", "/WebSite/TabelHarga/GetGridDataDaerah", params)
