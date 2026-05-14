# 🍳 Indeks Nasi Telur Anak Kos

> Dashboard daya beli harian berbasis data harga **3 bahan pokok** dari PIHPS Bank Indonesia — dirancang dari sudut pandang perut dan dompet Gen Z.

**Why?** Inflasi versi resmi (IHK BPS) dirilis sebulan sekali dan dihitung dalam angka abstrak. Proyek ini menerjemahkannya ke pertanyaan yang lebih nyata: *Dengan Rp 50.000, berapa porsi nasi telur yang bisa saya makan hari ini dibanding bulan lalu?*

Live site: **[govzenith.github.io/indeks-nasi-telur](https://govzenith.github.io/indeks-nasi-telur/)**

## ✨ Fitur

- 🔄 **Scraper otomatis** dari API publik PIHPS Bank Indonesia (`requests`-only, tanpa browser headless)
- 📊 **Indeks Daya Beli**: harga 3 komoditas × 5 provinsi referensi, dirata-rata sebagai harga nasional
- 📈 **Dashboard interaktif** (GitHub Pages + Chart.js): grafik 30 hari, porsi harian, Indomie Survival Index
- 🌿 **Streamlit app** lokal dengan grafik historis dan metrik perbandingan vs kemarin
- ⏰ **Auto-update harian** via GitHub Actions (setiap jam 10.00 WIB)

## 🛒 Komoditas yang Dilacak

| Komoditas | Kode PIHPS | Satuan |
|---|---|---|
| Beras | com_3 | Beras Kualitas Medium I |
| Telur Ayam | com_9 | Telur Ayam Ras Segar |
| Minyak Goreng | com_14 | Minyak Goreng Curah |

**Provinsi referensi** (rata-rata 3 provinsi = representasi harga nasional):
DKI Jakarta · Sumatera Utara · Jawa Tengah

## 🚀 Cara Menjalankan

### Setup awal (sekali)

```bash
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Ambil data PIHPS + update frontend

```bash
python scraper.py 30      # bootstrap 30 hari ke belakang (sekali saja)
python scraper.py 3       # update harian (3 hari terakhir)
```

### Jalankan dashboard Streamlit

```bash
streamlit run app.py
```

Buka `http://localhost:8501` di browser.

### Update harian otomatis (Windows)

Setup via Task Scheduler menggunakan `run_daily.bat`:
1. Buka **Task Scheduler** → **Create Basic Task**
2. Name: `Micro CPI Daily Update`
3. Trigger: **Daily**, jam **09:00**
4. Action: **Start a program** → browse ke `run_daily.bat`

## 🌐 Arsitektur

```
PIHPS API (Bank Indonesia)
    │
    └─→ scraper.py
            │
            ├─→ database.db          (SQLite — dibaca app.py Streamlit)
            └─→ frontend/data.json   (dibaca index.html GitHub Pages)
```

GitHub Actions menjalankan `scraper.py 3` setiap pagi dan meng-commit `frontend/data.json` ke repo secara otomatis → live site langsung terupdate.

## 📁 Struktur Proyek

```
indeks-nasi-telur/
├── app.py              # Streamlit dashboard (lokal)
├── scraper.py          # Scraper PIHPS + generator data.json
├── run_daily.bat       # Batch script (Task Scheduler Windows)
├── requirements.txt
├── frontend/
│   ├── index.html      # Dashboard utama (GitHub Pages)
│   ├── app.js          # Logic Chart.js + fetch data
│   ├── style.css       # Styling
│   ├── data.json       # Data JSON (di-generate scraper.py)
│   └── indonesia.svg   # Peta Indonesia
└── .github/workflows/
    └── daily-update.yml  # Auto-update via GitHub Actions
```

## 📚 Sumber Data

- **PIHPS Nasional** — Bank Indonesia (https://www.bi.go.id/hargapangan)
- Data bersifat publik, tidak memerlukan API key

## ⚠️ Disclaimer

Proyek ini adalah **karya edukasi/portofolio** untuk kompetisi TUNAS / JuaraVibeCoding. Indeks Nasi Telur di sini **bukan indikator resmi** pemerintah dan tidak bisa digunakan untuk keputusan kebijakan publik atau finansial.

## 📜 Lisensi

MIT — silakan fork, modifikasi, dan pakai untuk belajar.
