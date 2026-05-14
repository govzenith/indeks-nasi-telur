import streamlit as st
import pandas as pd
import sqlite3
import os

# Memastikan berada di direktori yang benar
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 1. KONFIGURASI HALAMAN
st.set_page_config(page_title="Indeks Nasi Telur", page_icon="🍳", layout="centered")

# 2. FUNGSI MENGAMBIL DATA
def load_data():
    conn = sqlite3.connect('database.db')
    df = pd.read_sql_query("SELECT * FROM harga_harian", conn)
    conn.close()
    return df

try:
    df = load_data()
except Exception as e:
    df = pd.DataFrame() # Kosong jika db belum ada

# 3. BAGIAN HEADER
st.title("🍳 Indeks Nasi Telur Anak Kos")
st.markdown("Mengukur **inflasi sesungguhnya** dari sudut pandang perut dan dompet Gen Z.")
st.divider()

if df.empty:
    st.warning("Belum ada data! Sedang memproses data awal...")
else:
    # 4. LOGIKA EKONOMI & STORYTELLING
    harga_beras = df[df['komoditas'] == 'Beras']['harga'].values[0]       
    harga_telur = df[df['komoditas'] == 'Telur Ayam']['harga'].values[0]  
    harga_minyak = df[df['komoditas'] == 'Minyak Goreng']['harga'].values[0] 
    
    # Rumus Resep 1 Porsi: 200gr Beras, 1 Butir Telur (~60gr), 50ml Minyak
    biaya_beras = harga_beras * 0.20
    biaya_telur = harga_telur * 0.06
    biaya_minyak = harga_minyak * 0.05
    
    biaya_satu_porsi = biaya_beras + biaya_telur + biaya_minyak
    
    uang_saku = 50000
    porsi_didapat = int(uang_saku / biaya_satu_porsi)
    
    # 5. TAMPILAN UI
    st.subheader("Daya Beli Uang Rp 50.000 Hari Ini 💸")
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric(label="Biaya Pembuatan 1 Porsi", value=f"Rp {int(biaya_satu_porsi):,}")
    with col2:
        st.metric(label="Bisa Makan Sebanyak", value=f"{porsi_didapat} Porsi", 
                  delta="-1 Porsi (vs Bulan Lalu)", delta_color="inverse")
        
    st.error(f"💡 **The Coffee Sacrifice:** Kenaikan total biaya makanmu bulan ini memaksa kamu untuk puasa **2 Gelas Kopi Susu** Kekinian.")

    st.divider()
    
    st.subheader("📊 Harga Bahan Baku di Pasaran")
    st.dataframe(df, use_container_width=True)
    st.caption("Data ini akan diupdate otomatis melalui web scraping setiap harinya.")
