"""
processor.py — Hitung Micro CPI dari data harga PIHPS.

Output: data/data_indeks.csv (per provinsi + nasional, per tanggal).
Rumus weighted CPI:
    Indeks_t = sum((Harga_komoditas_t / Harga_komoditas_baseline) * Bobot_komoditas) * 100
Baseline = harga pertama yang tersedia per kombinasi (provinsi, komoditas).
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent
CSV_HARGA = ROOT / "data" / "data_harga.csv"
CSV_INDEKS = ROOT / "data" / "data_indeks.csv"
CSV_NASIONAL = ROOT / "data" / "data_indeks_nasional.csv"
LOG_PATH = ROOT / "data" / "processor.log"

# Bobot komoditas dalam keranjang Micro CPI (jumlah = 1.0)
BOBOT_KOMODITAS: dict[str, float] = {
    "Beras":         0.35,
    "Minyak Goreng": 0.20,
    "Telur Ayam":    0.15,
    "Cabai Merah":   0.15,
    "Bawang Merah":  0.15,
}

# Populasi 9 provinsi (juta jiwa, perkiraan BPS 2023) — untuk bobot nasional
POPULASI_PROVINSI: dict[str, float] = {
    "DKI Jakarta":      10.7,
    "Jawa Tengah":      37.5,
    "Sumatera Utara":   15.4,
    "Sulawesi Selatan":  9.2,
    "Riau":              6.6,
    "Kalimantan Timur":  3.9,
    "Kalimantan Barat":  5.5,
    "Sulawesi Utara":    2.7,
    "Papua":             4.4,
}


def log(msg: str) -> None:
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_data() -> pd.DataFrame:
    if not CSV_HARGA.exists():
        raise FileNotFoundError(f"File harga tidak ditemukan: {CSV_HARGA}")
    df = pd.read_csv(CSV_HARGA)
    df["tanggal"] = pd.to_datetime(df["tanggal"])
    df["harga"] = pd.to_numeric(df["harga"], errors="coerce")
    df = df.dropna(subset=["harga"])
    df = df[df["harga"] > 0]
    log(f"Loaded {len(df)} baris harga | tanggal {df['tanggal'].min().date()} -> {df['tanggal'].max().date()}")
    return df


def fill_missing_dates(df: pd.DataFrame) -> pd.DataFrame:
    full_dates = pd.date_range(df["tanggal"].min(), df["tanggal"].max(), freq="D")
    provinces = df["provinsi"].unique()
    commodities = df["komoditas"].unique()
    grid = pd.MultiIndex.from_product(
        [full_dates, provinces, commodities],
        names=["tanggal", "provinsi", "komoditas"],
    ).to_frame(index=False)

    merged = grid.merge(df, on=["tanggal", "provinsi", "komoditas"], how="left")
    merged = merged.sort_values(["provinsi", "komoditas", "tanggal"])
    merged["harga"] = merged.groupby(["provinsi", "komoditas"])["harga"].ffill()
    merged["harga"] = merged.groupby(["provinsi", "komoditas"])["harga"].bfill()
    merged = merged.dropna(subset=["harga"])
    log(f"Forward+backward fill -> {len(merged)} baris setelah expand grid")
    return merged


def compute_baseline(df: pd.DataFrame) -> pd.DataFrame:
    base_dates = df.groupby(["provinsi", "komoditas"])["tanggal"].min().reset_index()
    base = base_dates.merge(df, on=["provinsi", "komoditas", "tanggal"], how="left")
    base = base.rename(columns={"harga": "harga_baseline"})[["provinsi", "komoditas", "harga_baseline"]]
    log(f"Baseline harga dihitung untuk {len(base)} kombinasi provinsi x komoditas")
    return base


def compute_provincial_cpi(df: pd.DataFrame, baseline: pd.DataFrame) -> pd.DataFrame:
    merged = df.merge(baseline, on=["provinsi", "komoditas"])
    merged["rasio"] = merged["harga"] / merged["harga_baseline"]
    merged["bobot"] = merged["komoditas"].map(BOBOT_KOMODITAS)
    if merged["bobot"].isna().any():
        unknown = merged[merged["bobot"].isna()]["komoditas"].unique()
        raise ValueError(f"Komoditas tanpa bobot: {unknown}")
    merged["kontribusi"] = merged["rasio"] * merged["bobot"]

    cpi = (
        merged.groupby(["tanggal", "provinsi"])["kontribusi"].sum().reset_index()
              .rename(columns={"kontribusi": "indeks"})
    )
    cpi["indeks"] = cpi["indeks"] * 100

    cpi = cpi.sort_values(["provinsi", "tanggal"])
    cpi["perubahan_harian_pct"] = cpi.groupby("provinsi")["indeks"].pct_change() * 100
    log(f"Indeks provinsi: {len(cpi)} baris (9 provinsi x ~{len(cpi)//9} hari)")
    return cpi


def compute_national_cpi(cpi_prov: pd.DataFrame) -> pd.DataFrame:
    total_pop = sum(POPULASI_PROVINSI.values())
    bobot_prov = {p: v / total_pop for p, v in POPULASI_PROVINSI.items()}

    cpi = cpi_prov.copy()
    cpi["bobot_pop"] = cpi["provinsi"].map(bobot_prov)
    cpi["kontribusi"] = cpi["indeks"] * cpi["bobot_pop"]
    nasional = (
        cpi.groupby("tanggal")["kontribusi"].sum().reset_index()
           .rename(columns={"kontribusi": "indeks_nasional"})
    )
    nasional["perubahan_harian_pct"] = nasional["indeks_nasional"].pct_change() * 100
    log(f"Indeks nasional: {len(nasional)} hari")
    return nasional


def save(df_prov: pd.DataFrame, df_nasional: pd.DataFrame) -> None:
    df_prov.to_csv(CSV_INDEKS, index=False, date_format="%Y-%m-%d")
    df_nasional.to_csv(CSV_NASIONAL, index=False, date_format="%Y-%m-%d")
    log(f"Tersimpan: {CSV_INDEKS.name} ({len(df_prov)} baris), {CSV_NASIONAL.name} ({len(df_nasional)} baris)")


def main() -> None:
    log("=== PROCESSOR START ===")
    df = load_data()
    df_filled = fill_missing_dates(df)
    baseline = compute_baseline(df_filled)
    cpi_prov = compute_provincial_cpi(df_filled, baseline)
    cpi_nas = compute_national_cpi(cpi_prov)
    save(cpi_prov, cpi_nas)

    log("\n=== RINGKASAN INDEKS TERAKHIR PER PROVINSI ===")
    latest = cpi_prov.sort_values("tanggal").groupby("provinsi").tail(1)
    for _, r in latest.iterrows():
        delta = r["perubahan_harian_pct"]
        delta_str = f"{delta:+.2f}%" if pd.notna(delta) else "n/a"
        log(f"  {r['provinsi']:<20} indeks={r['indeks']:6.2f}  Δ={delta_str}")

    log("\n=== INDEKS NASIONAL TERAKHIR ===")
    last_nas = cpi_nas.tail(1).iloc[0]
    delta = last_nas["perubahan_harian_pct"]
    delta_str = f"{delta:+.2f}%" if pd.notna(delta) else "n/a"
    log(f"  Tanggal {last_nas['tanggal'].date()}  indeks_nasional={last_nas['indeks_nasional']:.2f}  Δ={delta_str}")
    log("=== PROCESSOR END ===\n")


if __name__ == "__main__":
    main()
