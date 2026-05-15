import sqlite3
import datetime
import os
import json
import time
import requests

os.chdir(os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "https://www.bi.go.id/hargapangan"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "id,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE_URL}/TabelHarga/PasarTradisionalDaerah",
}

KOMODITAS = {
    "Beras":         "com_3",   # Beras Kualitas Medium I
    "Telur Ayam":    "com_10",  # Telur Ayam Ras Segar
    "Minyak Goreng": "com_17",  # Minyak Goreng Curah
    "Cabai Merah":   "com_14",  # Cabai Merah Keriting
}

# 3 provinsi referensi yang terverifikasi aktif di PIHPS
PROVINCES = {
    "DKI Jakarta":    "13",
    "Sumatera Utara": "12",
    "Jawa Tengah":    "33",
}


def setup_database():
    conn = sqlite3.connect('database.db')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS harga_harian (
            tanggal   TEXT,
            komoditas TEXT,
            harga     REAL,
            UNIQUE(tanggal, komoditas)
        )
    ''')
    conn.commit()
    conn.close()


def fetch_grid(comcat_id, province_id, start_date, end_date):
    params = {
        "price_type_id": 1,
        "comcat_id":     comcat_id,
        "province_id":   province_id,
        "regency_id":    "",
        "market_id":     "",
        "tipe_laporan":  1,
        "start_date":    start_date.strftime("%Y-%m-%dT00:00:00.000"),
        "end_date":      end_date.strftime("%Y-%m-%dT00:00:00.000"),
    }
    r = requests.get(
        f"{BASE_URL}/WebSite/TabelHarga/GetGridDataDaerah",
        params=params, headers=HEADERS, timeout=20
    )
    r.raise_for_status()
    result = r.json()
    return result.get("data", result) if isinstance(result, dict) else result


def parse_grid_to_daily(rows):
    """Ubah baris wide-format grid ke dict {tanggal_iso: harga}."""
    if not rows or not isinstance(rows, list):
        return {}
    daily = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        for key, value in row.items():
            if len(key) == 10 and key[2] == '/' and key[5] == '/':
                try:
                    tanggal = datetime.datetime.strptime(key, "%d/%m/%Y").strftime("%Y-%m-%d")
                    if value is not None:
                        # PIHPS mengirim harga sebagai string "16,800" — hapus koma ribuan
                        daily[tanggal] = float(str(value).replace(',', ''))
                except (ValueError, TypeError):
                    continue
    return daily


def fetch_national_average(comcat_id, start_date, end_date):
    """
    Median harga harian dari PROVINCES (bukan mean) untuk tahan terhadap
    outlier data PIHPS per provinsi. Butuh minimal 2 provinsi agar valid.
    """
    per_tanggal = {}  # {tanggal: [harga_prov1, harga_prov2, ...]}

    for prov_name, prov_id in PROVINCES.items():
        try:
            rows  = fetch_grid(comcat_id, prov_id, start_date, end_date)
            daily = parse_grid_to_daily(rows)
            for tanggal, harga in daily.items():
                per_tanggal.setdefault(tanggal, []).append(harga)
            print(f"    {prov_name}: {len(daily)} hari")
            time.sleep(0.6)
        except Exception as e:
            print(f"    SKIP {prov_name}: {e}")

    result = {}
    for tanggal, harga_list in per_tanggal.items():
        if len(harga_list) < 2:
            # Hanya 1 provinsi lapor — terlalu berisiko ada outlier, lewati
            print(f"    SKIP {tanggal}: hanya {len(harga_list)} provinsi (butuh min. 2)")
            continue
        sorted_h = sorted(harga_list)
        n = len(sorted_h)
        median = sorted_h[n // 2] if n % 2 == 1 else (sorted_h[n // 2 - 1] + sorted_h[n // 2]) / 2
        result[tanggal] = round(median, -2)
    return result


def simpan_ke_db(komoditas, tanggal, harga):
    conn = sqlite3.connect('database.db')
    try:
        conn.execute(
            "INSERT OR REPLACE INTO harga_harian (tanggal, komoditas, harga) VALUES (?, ?, ?)",
            (tanggal, komoditas, harga)
        )
        conn.commit()
    finally:
        conn.close()


def generate_indomie_tracker():
    """
    Data kreatif: simulasi konsumsi Indomie berdasarkan tanggal dalam bulan.
    Ini adalah 'indikator informal' — makin akhir bulan, makin banyak Indomie dimakan.
    Seed tetap agar konsisten setiap kali dijalankan.
    """
    import random
    random.seed(99)

    today = datetime.datetime.now()
    data = []

    for days_ago in range(89, -1, -1):
        tanggal = today - datetime.timedelta(days=days_ago)
        hari = tanggal.day

        if hari <= 5:
            bungkus = random.choices([0, 0, 0, 1], weights=[40, 30, 20, 10])[0]
        elif hari <= 15:
            bungkus = random.choices([0, 1, 1, 2], weights=[30, 35, 25, 10])[0]
        elif hari <= 24:
            bungkus = random.choices([0, 1, 2, 2], weights=[15, 30, 35, 20])[0]
        else:
            bungkus = random.choices([1, 2, 3, 3, 4], weights=[10, 20, 30, 25, 15])[0]

        data.append({
            "tanggal": tanggal.strftime("%Y-%m-%d"),
            "bungkus": bungkus,
            "hari":    hari
        })

    return data


def export_to_json():
    """
    Ekspor data dari SQLite ke frontend/data.json.
    Bersifat ADDITIVE: baca data.json lama terlebih dahulu, merge dengan data
    baru dari DB, sehingga historical data tidak hilang di GitHub Actions.
    data.json adalah satu-satunya persistent store di server (GitHub).
    """
    conn = sqlite3.connect('database.db')

    # Harga terbaru per komoditas dari DB lokal
    rows = conn.execute("""
        SELECT h.komoditas, h.harga, h.tanggal
        FROM harga_harian h
        INNER JOIN (
            SELECT komoditas, MAX(tanggal) AS max_tanggal
            FROM harga_harian GROUP BY komoditas
        ) latest ON h.komoditas = latest.komoditas AND h.tanggal = latest.max_tanggal
    """).fetchall()
    latest_dict = {r[0]: {"harga": r[1], "tanggal": r[2]} for r in rows}

    # Semua data historis dari DB lokal
    rows = conn.execute(
        "SELECT tanggal, komoditas, harga FROM harga_harian ORDER BY tanggal ASC"
    ).fetchall()
    conn.close()

    # Bangun map baru dari DB: {komoditas: {tanggal: harga}}
    db_map = {}
    for tanggal, komoditas, harga in rows:
        db_map.setdefault(komoditas, {})[tanggal] = harga

    # Baca data.json lama (persistent store di GitHub) jika ada
    json_path = 'frontend/data.json'
    existing = {}
    if os.path.exists(json_path):
        try:
            with open(json_path, encoding='utf-8') as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    # Merge: gabungkan historis lama + baru, DB menang jika ada konflik tanggal
    merged_map = {}
    old_historis = existing.get("historis", {})
    all_komoditas = set(db_map.keys()) | set(old_historis.keys())
    for k in all_komoditas:
        merged = {}
        # Isi dari data lama dulu
        old = old_historis.get(k, {})
        if isinstance(old, dict) and "tanggal" in old:
            for t, h in zip(old["tanggal"], old["harga"]):
                merged[t] = h
        # Timpa/tambah dengan data dari DB (DB lebih fresh, punya override priority)
        for t, h in db_map.get(k, {}).items():
            merged[t] = h
        merged_map[k] = merged

    # Konversi kembali ke format array terurut
    history_dict = {}
    for k, tgl_harga in merged_map.items():
        sorted_tgl = sorted(tgl_harga.keys())
        history_dict[k] = {
            "tanggal": sorted_tgl,
            "harga":   [tgl_harga[t] for t in sorted_tgl]
        }

    # Update latest_dict: jika DB tidak punya komoditas tertentu, pakai dari JSON lama
    for k, v in existing.get("terbaru", {}).items():
        if k not in latest_dict:
            latest_dict[k] = v

    output = {
        "terbaru":         latest_dict,
        "historis":        history_dict,
        "indomie_tracker": generate_indomie_tracker(),
        # "forecast" akan diisi oleh forecaster.py, jaga nilai lama jika ada
        **({"forecast": existing["forecast"]} if "forecast" in existing else {}),
    }

    os.makedirs('frontend', exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False)

    print("\nEkspor selesai -> frontend/data.json")
    print(f"  Komoditas terbaru : {list(latest_dict.keys())}")
    for k, v in history_dict.items():
        print(f"  {k:15s}: {len(v['tanggal'])} hari historis (total akumulatif)")


def main(days_back=30):
    print("=" * 50)
    print(" Micro CPI Scraper — Data PIHPS Bank Indonesia")
    print("=" * 50)
    setup_database()

    today      = datetime.date.today()
    start_date = today - datetime.timedelta(days=days_back)
    print(f"Rentang: {start_date}  ->  {today}\n")

    for nama, comcat_id in KOMODITAS.items():
        print(f"[{nama}]")
        try:
            daily = fetch_national_average(comcat_id, start_date, today)
            if not daily:
                print(f"  PERINGATAN: tidak ada data diterima")
                continue
            for tanggal, harga in sorted(daily.items()):
                simpan_ke_db(nama, tanggal, harga)
            print(f"  {len(daily)} hari tersimpan ke database")
        except Exception as e:
            print(f"  ERROR: {e}")

    export_to_json()
    print("\nSelesai! Jalankan 'git add frontend/data.json && git commit' untuk update live site.")


if __name__ == "__main__":
    import sys
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    main(days)
