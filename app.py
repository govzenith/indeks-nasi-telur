import streamlit as st
import pandas as pd
import sqlite3
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

st.set_page_config(page_title="Indeks Nasi Telur", page_icon="🍳", layout="centered")


@st.cache_data(ttl=3600)
def load_data():
    conn = sqlite3.connect('database.db')
    df = pd.read_sql_query(
        "SELECT * FROM harga_harian ORDER BY tanggal DESC",
        conn
    )
    conn.close()
    return df


try:
    df = load_data()
except Exception:
    df = pd.DataFrame()

st.title("🍳 Indeks Nasi Telur Anak Kos")
st.markdown("Mengukur **inflasi sesungguhnya** dari sudut pandang perut dan dompet Gen Z.")
st.divider()

if df.empty:
    st.warning("Belum ada data. Jalankan `python scraper.py` untuk mengambil data pertama.")
    st.stop()

# Ambil harga terbaru per komoditas
def get_harga(nama_komoditas):
    rows = df[df['komoditas'] == nama_komoditas]
    if rows.empty:
        return None
    return rows.iloc[0]['harga']

harga_beras  = get_harga('Beras')
harga_telur  = get_harga('Telur Ayam')
harga_minyak = get_harga('Minyak Goreng')

if any(h is None for h in [harga_beras, harga_telur, harga_minyak]):
    st.error("Data belum lengkap — jalankan `python scraper.py` untuk mengambil ketiga komoditas.")
    st.stop()

# Rumus: 200gr beras + 1 butir telur (60gr) + 50ml minyak
biaya_beras  = harga_beras  * 0.20
biaya_telur  = harga_telur  * 0.06
biaya_minyak = harga_minyak * 0.05
biaya_porsi  = biaya_beras + biaya_telur + biaya_minyak
porsi_hari_ini = int(50000 / biaya_porsi)

# Hitung delta vs hari sebelumnya (jika ada data 2 hari)
def get_harga_kemarin(nama_komoditas):
    rows = df[df['komoditas'] == nama_komoditas]
    if len(rows) < 2:
        return None
    return rows.iloc[1]['harga']

harga_beras_kmrn  = get_harga_kemarin('Beras')
harga_telur_kmrn  = get_harga_kemarin('Telur Ayam')
harga_minyak_kmrn = get_harga_kemarin('Minyak Goreng')

delta_porsi = None
if all(h is not None for h in [harga_beras_kmrn, harga_telur_kmrn, harga_minyak_kmrn]):
    biaya_kmrn   = (harga_beras_kmrn * 0.20) + (harga_telur_kmrn * 0.06) + (harga_minyak_kmrn * 0.05)
    porsi_kemarin = int(50000 / biaya_kmrn)
    delta_porsi  = porsi_hari_ini - porsi_kemarin

# Hitung selisih biaya vs 30 hari lalu untuk "Coffee Sacrifice"
def get_harga_30hari(nama_komoditas):
    rows = df[df['komoditas'] == nama_komoditas]
    if len(rows) < 30:
        return None
    return rows.iloc[29]['harga']

harga_beras_30  = get_harga_30hari('Beras')
harga_telur_30  = get_harga_30hari('Telur Ayam')
harga_minyak_30 = get_harga_30hari('Minyak Goreng')

coffee_msg = None
if all(h is not None for h in [harga_beras_30, harga_telur_30, harga_minyak_30]):
    biaya_30hari  = (harga_beras_30 * 0.20) + (harga_telur_30 * 0.06) + (harga_minyak_30 * 0.05)
    selisih_bulan = (biaya_porsi - biaya_30hari) * 30  # selisih total sebulan
    harga_kopi    = 25000  # asumsi 1 gelas kopi susu kekinian
    gelas_kopi    = selisih_bulan / harga_kopi
    if gelas_kopi > 0.1:
        coffee_msg = f"Kenaikan biaya makan 30 hari terakhir setara **{gelas_kopi:.1f} Gelas Kopi Susu** Kekinian yang harus kamu korbankan."
    else:
        coffee_msg = "Harga stabil — dompetmu aman sebulan ini."

# === TAMPILAN ===
st.subheader("Daya Beli Uang Rp 50.000 Hari Ini 💸")

col1, col2 = st.columns(2)
with col1:
    st.metric(
        label="Biaya Pembuatan 1 Porsi",
        value=f"Rp {int(biaya_porsi):,}"
    )
with col2:
    if delta_porsi is not None:
        st.metric(
            label="Bisa Makan Sebanyak",
            value=f"{porsi_hari_ini} Porsi",
            delta=f"{delta_porsi:+d} Porsi (vs kemarin)",
            delta_color="inverse"
        )
    else:
        st.metric(label="Bisa Makan Sebanyak", value=f"{porsi_hari_ini} Porsi")

if coffee_msg:
    st.error(f"☕ **The Coffee Sacrifice:** {coffee_msg}")

st.divider()

st.subheader("📊 Harga Bahan Baku di Pasaran")
terbaru = df.sort_values('tanggal', ascending=False).groupby('komoditas').first().reset_index()
st.dataframe(terbaru[['komoditas', 'harga', 'tanggal']], use_container_width=True)

tanggal_update = df['tanggal'].max()
st.caption(f"Sumber: PIHPS Nasional — Bank Indonesia. Data terakhir diperbarui: {tanggal_update}.")

st.divider()

# Grafik pergerakan harga historis
st.subheader("📈 Pergerakan Harga 30 Hari Terakhir")
pivot = df.pivot_table(index='tanggal', columns='komoditas', values='harga').tail(30)
if not pivot.empty:
    st.line_chart(pivot)
else:
    st.info("Belum cukup data historis untuk menampilkan grafik.")
