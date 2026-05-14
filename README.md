# 🇮🇩 Micro CPI Indonesia — Real-Time Inflation Dashboard

> Dashboard inflasi alternatif yang melacak harga **5 bahan pokok** di **9 provinsi** secara harian, menggunakan data resmi PIHPS Bank Indonesia.

**Why?** Inflasi Indonesia versi resmi (IHK BPS) hanya dirilis sebulan sekali. Padahal harga di pasar bergerak setiap hari. Proyek ini membangun **indeks tandingan** yang lebih cepat dan transparan — sebagai latihan *data engineering* sekaligus alat literasi ekonomi bagi masyarakat.

## ✨ Fitur

- 🔄 **Scraper otomatis** dari API publik PIHPS Bank Indonesia (`requests`-only, tanpa headless browser → hemat memory ~30 MB)
- 📊 **Weighted Micro CPI**: 5 komoditas × 9 provinsi, dihitung mirip metodologi BPS (weighted average, bobot populasi untuk nasional)
- 📈 **Dashboard interaktif** Streamlit: line chart, ranking inflasi, detail per komoditas, filter rentang tanggal
- ⏰ **Auto-update harian** via Windows Task Scheduler atau GitHub Actions
- 💾 **Storage CSV** (ringan, gratis, version-controllable)

## 🗺️ Cakupan Wilayah

Sumatera Utara · Riau · DKI Jakarta · Jawa Tengah · Kalimantan Barat · Kalimantan Timur · Sulawesi Utara · Sulawesi Selatan · Papua

## 🛒 Keranjang Komoditas (Bobot)

| Komoditas | Bobot | Varian PIHPS |
|---|---|---|
| Beras | 35% | Beras Kualitas Medium I |
| Minyak Goreng | 20% | Minyak Goreng Curah |
| Telur Ayam | 15% | Telur Ayam Ras Segar |
| Cabai Merah | 15% | Cabai Merah Keriting |
| Bawang Merah | 15% | Bawang Merah Ukuran Sedang |

## 🚀 Cara Menjalankan

### Setup awal (sekali)

```bash
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Ambil data + hitung indeks

```bash
python scraper.py 30      # bootstrap 30 hari ke belakang (sekali saja)
python processor.py       # hitung Micro CPI
```

### Jalankan dashboard

```bash
streamlit run app.py
```

Buka `http://localhost:8501` di browser.

### Update harian otomatis (Windows)

`run_daily.bat` sudah disiapkan. Setup via Task Scheduler:

1. Buka **Task Scheduler** → **Create Basic Task**
2. Name: `Micro CPI Daily Update`
3. Trigger: **Daily**, jam **09:00**
4. Action: **Start a program** → browse ke `run_daily.bat`
5. Klik **Run** untuk test manual

## 🌐 Deploy ke Streamlit Community Cloud (gratis, publik)

1. Push repo ini ke GitHub (akun gratis)
2. Login ke [share.streamlit.io](https://share.streamlit.io) dengan akun GitHub
3. Klik **New app** → pilih repo → entry file: `app.py`
4. Deploy → dapat URL `https://<your-app>.streamlit.app`

> Untuk auto-update di Cloud, gunakan GitHub Actions (lihat `.github/workflows/daily-update.yml`).

## 📁 Struktur Proyek

```
micro-cpi/
├── app.py              # Streamlit dashboard
├── scraper.py          # Pengambil data dari PIHPS
├── processor.py        # Perhitungan Micro CPI
├── run_daily.bat       # Batch script (Task Scheduler)
├── requirements.txt
├── data/
│   ├── data_harga.csv          # harga mentah (long-format)
│   ├── data_indeks.csv         # indeks per provinsi
│   ├── data_indeks_nasional.csv
│   └── raw/                    # cache JSON API per request
└── .streamlit/config.toml
```

## ⚙️ Bagaimana Cara Kerjanya

```
PIHPS API → scraper.py → data/raw/*.json  ─┐
                                            ├─→ data_harga.csv
                                            │
processor.py ←──────────────────────────────┘
        │
        ├─→ data_indeks.csv          (per provinsi)
        └─→ data_indeks_nasional.csv (rata-rata 9 provinsi tertimbang populasi)

app.py reads CSV → render dashboard
```

### Rumus Indeks

Untuk setiap provinsi *p* dan tanggal *t*:
```
Indeks(p, t) = Σ_komoditas [ (Harga(p, k, t) / Harga(p, k, baseline)) × Bobot(k) ] × 100
```

Indeks Nasional:
```
Indeks_Nasional(t) = Σ_provinsi [ Indeks(p, t) × (Populasi(p) / Total) ]
```

Baseline = tanggal pertama tersedia per kombinasi (provinsi, komoditas). Harga di hari libur di-forward-fill dari hari kerja sebelumnya.

## 📚 Sumber Data

- **PIHPS Nasional** — Bank Indonesia (https://www.bi.go.id/hargapangan)
- **Populasi provinsi** — BPS estimasi 2023

## ⚠️ Disclaimer

Proyek ini adalah **karya edukasi/portofolio** untuk kompetisi TUNAS / JuaraVibeCoding. Indeks Micro CPI di sini **bukan indikator resmi** pemerintah dan tidak bisa digunakan untuk keputusan kebijakan publik atau finansial.

## 📜 Lisensi

MIT — silakan fork, modifikasi, dan pakai untuk belajar.
