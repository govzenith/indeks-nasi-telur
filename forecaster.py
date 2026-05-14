"""
forecaster.py — Prediksi Biaya Pangan Anak Kos 7 Hari ke Depan
=================================================================

MODEL EKONOMETRIKA: Linear Trend + Moving Average (MA7)
-------------------------------------------------------

VARIABEL:
  B(t)  = biaya 1 porsi nasi telur pada hari t (variabel endogen)
  t     = indeks waktu (hari ke-1, 2, ..., n)

KOMPOSISI 1 PORSI (resep standar anak kos):
  - 200g beras        → 0.20 × P_beras(t)
  - 60g telur (1 butir) → 0.06 × P_telur(t)
  - 50ml minyak goreng → 0.05 × P_minyak(t)
  - 10g cabai merah   → 0.01 × P_cabai(t)

  B(t) = 0.20·P_beras + 0.06·P_telur + 0.05·P_minyak + 0.01·P_cabai

METODE FORECASTING:
  Langkah 1 — MA7(t): Rata-rata bergerak 7 hari terakhir
    MA7(t) = [B(t) + B(t-1) + ... + B(t-6)] / 7
    Fungsi: memperhalus fluktuasi harian, menangkap "level" harga terkini

  Langkah 2 — Slope b: Regresi linier OLS pada seluruh serie historis
    b = Σ[(t - t̄)(B(t) - B̄)] / Σ[(t - t̄)²]
    Fungsi: mengukur arah dan kecepatan tren harga (Rp per hari)

  Langkah 3 — Forecast k hari ke depan:
    forecast(t+k) = MA7(t) + b × k

  Langkah 4 — Interval kepercayaan (±1 std residual):
    σ = √[ Σ(B(t) - (a + b·t))² / n ]
    lower(t+k) = forecast(t+k) - σ
    upper(t+k) = forecast(t+k) + σ

ASUMSI MODEL:
  1. Tren harga bersifat linier dalam jangka pendek (7 hari)
  2. Tidak ada supply shock mendadak (bencana alam, kebijakan darurat)
  3. Pola hari kerja/libur konsisten (PIHPS tidak update weekend)
  4. Harga dari 3 provinsi referensi representatif untuk nasional

KETERBATASAN:
  - Hanya valid untuk horizon 7 hari (semakin jauh, error semakin besar)
  - Tidak menangkap seasonality (panen raya, Ramadan, Lebaran)
  - Cabai sangat volatil — interval kepercayaan mungkin lebih lebar kenyataannya
"""

import sqlite3
import datetime
import json
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# === PARAMETER MODEL ===
RECIPE = {
    "Beras":         0.20,   # kg per porsi
    "Telur Ayam":    0.06,   # kg per porsi (1 butir ~60g)
    "Minyak Goreng": 0.05,   # liter per porsi
    "Cabai Merah":   0.01,   # kg per porsi (sambal sederhana)
}
MA_WINDOW = 7   # jumlah hari untuk moving average
HORIZON   = 7   # hari ke depan yang diprediksi


def load_harga_dari_db():
    """Baca harga harian dari SQLite, return dict {komoditas: {tanggal: harga}}."""
    conn = sqlite3.connect('database.db')
    rows = conn.execute(
        "SELECT tanggal, komoditas, harga FROM harga_harian ORDER BY tanggal ASC"
    ).fetchall()
    conn.close()

    data = {}
    for tanggal, komoditas, harga in rows:
        if komoditas not in data:
            data[komoditas] = {}
        data[komoditas][tanggal] = harga
    return data


def hitung_biaya_harian(harga_data):
    """
    Hitung B(t) untuk setiap hari di mana SEMUA komoditas tersedia.
    Return list of {"tanggal": str, "biaya": float} sorted by date.
    """
    tanggal_per_komoditas = [set(harga_data.get(k, {}).keys()) for k in RECIPE]
    tanggal_lengkap = sorted(set.intersection(*tanggal_per_komoditas))

    if not tanggal_lengkap:
        return []

    hasil = []
    for t in tanggal_lengkap:
        biaya = sum(RECIPE[k] * harga_data[k][t] for k in RECIPE)
        hasil.append({"tanggal": t, "biaya": round(biaya, 2)})
    return hasil


def moving_average(values, window):
    """Rata-rata bergerak sederhana dari window terakhir."""
    efektif = min(window, len(values))
    return sum(values[-efektif:]) / efektif


def regresi_linier_ols(values):
    """
    OLS: B(t) = a + b*t  di mana t = 0, 1, 2, ..., n-1
    Return (a, b) — intercept dan slope.
    """
    n = len(values)
    if n < 2:
        return values[0], 0.0

    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n

    pembilang   = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
    penyebut    = sum((i - x_mean) ** 2 for i in range(n))

    b = pembilang / penyebut if penyebut != 0 else 0.0
    a = y_mean - b * x_mean
    return a, b


def bangun_forecast(biaya_harian):
    """
    Bangun prediksi 7 hari ke depan menggunakan MA7 + Linear Trend.
    Return dict hasil lengkap.
    """
    if len(biaya_harian) < MA_WINDOW + 2:
        return None

    values = [d["biaya"] for d in biaya_harian]
    tanggal_terakhir = datetime.date.fromisoformat(biaya_harian[-1]["tanggal"])

    # Hitung komponen model
    ma7       = moving_average(values, MA_WINDOW)
    a, slope  = regresi_linier_ols(values)

    # Std residual untuk interval kepercayaan
    n = len(values)
    residuals = [values[i] - (a + slope * i) for i in range(n)]
    std_resid = (sum(r ** 2 for r in residuals) / n) ** 0.5

    # Generate prediksi
    prediksi = []
    for k in range(1, HORIZON + 1):
        tgl = (tanggal_terakhir + datetime.timedelta(days=k)).isoformat()
        nilai = ma7 + slope * k
        prediksi.append({
            "tanggal": tgl,
            "biaya":   round(nilai),
            "lower":   round(nilai - std_resid),
            "upper":   round(nilai + std_resid),
        })

    biaya_aktual   = values[-1]   # nilai nyata hari ini (bisa ada spike/outlier)
    biaya_sekarang = round(ma7)   # level tren saat ini (diperhalus MA7) — basis forecast
    biaya_7hari    = prediksi[-1]["biaya"]
    selisih        = biaya_7hari - biaya_sekarang
    persen         = (selisih / biaya_sekarang) * 100

    return {
        "biaya_harian":      biaya_harian,
        "prediksi":          prediksi,
        "slope_per_hari":    round(slope, 2),
        "ma7":               round(ma7),
        "std_residual":      round(std_resid),
        "biaya_aktual":      round(biaya_aktual),   # nilai nyata hari ini
        "biaya_sekarang":    biaya_sekarang,         # MA7 = basis perbandingan forecast
        "biaya_7hari":       biaya_7hari,
        "selisih":           round(selisih),
        "persen_perubahan":  round(persen, 2),
        "n_data":            n,
    }


def cetak_laporan(hasil):
    """Tampilkan laporan hasil model ke console."""
    print("\n" + "=" * 55)
    print(" LAPORAN MODEL EKONOMETRIKA")
    print("=" * 55)
    print(f" Model       : MA{MA_WINDOW} + OLS Linear Trend")
    print(f" Data        : {hasil['n_data']} hari observasi")
    print(f" Slope tren  : Rp {hasil['slope_per_hari']:+.2f}/hari")
    print(f"               (tren jangka pendek naik/turun Rp {abs(hasil['slope_per_hari']):.2f} per hari)")
    print(f" Nilai aktual: Rp {hasil['biaya_aktual']:,}  (nilai nyata hari terakhir)")
    print(f" MA7 (basis) : Rp {hasil['ma7']:,}  (level tren diperhalus, basis forecast)")
    print(f" Std residual: Rp {hasil['std_residual']:,}")
    print(f"               (rentang ketidakpastian +/- Rp {hasil['std_residual']:,})")
    print()
    print(" PREDIKSI 7 HARI KE DEPAN:")
    print(f" {'Tanggal':12s}  {'Prediksi':>10s}  {'Batas Bawah':>12s}  {'Batas Atas':>10s}")
    print(" " + "-" * 50)
    for p in hasil["prediksi"]:
        print(f" {p['tanggal']:12s}  Rp {p['biaya']:>7,}  Rp {p['lower']:>9,}  Rp {p['upper']:>7,}")
    print()
    arah = "naik" if hasil["selisih"] > 0 else "turun"
    print(f" Kesimpulan: Dari level tren MA7 Rp {hasil['ma7']:,},")
    print(f"             biaya diprediksi {arah} Rp {abs(hasil['selisih']):,}")
    print(f"             ({hasil['persen_perubahan']:+.2f}% dalam 7 hari)")
    print("=" * 55)


def main():
    print("Memuat data dari database...")
    harga_data   = load_harga_dari_db()

    print("Komoditas tersedia:", list(harga_data.keys()))
    for k in RECIPE:
        n = len(harga_data.get(k, {}))
        print(f"  {k:15s}: {n} hari data")

    print("\nMenghitung biaya harian B(t)...")
    biaya_harian = hitung_biaya_harian(harga_data)

    if not biaya_harian:
        print("ERROR: Tidak ada hari dengan semua 4 komoditas lengkap.")
        print("Pastikan scraper.py sudah dijalankan dengan Cabai Merah.")
        return

    print(f"B(t) tersedia: {len(biaya_harian)} hari")
    print(f"Rentang      : {biaya_harian[0]['tanggal']} -> {biaya_harian[-1]['tanggal']}")
    print(f"B(t) hari ini: Rp {biaya_harian[-1]['biaya']:,.0f}")

    print("\nMembangun model forecasting...")
    hasil = bangun_forecast(biaya_harian)

    if not hasil:
        print(f"ERROR: Data terlalu sedikit. Butuh minimal {MA_WINDOW + 2} hari.")
        return

    cetak_laporan(hasil)

    # Tambahkan ke data.json
    json_path = 'frontend/data.json'
    if os.path.exists(json_path):
        with open(json_path, encoding='utf-8') as f:
            data_json = json.load(f)
    else:
        data_json = {}

    data_json['forecast'] = hasil

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data_json, f, ensure_ascii=False)

    print(f"\nForecast disimpan ke {json_path}")
    print("Selesai!")


if __name__ == "__main__":
    main()
