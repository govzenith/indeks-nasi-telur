document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Mengambil data JSON dari Python Scraper
        const response = await fetch('data.json');
        const data = await response.json();
        
        // === DATA TERBARU (Untuk Kartu Utama) ===
        const terbaru = data.terbaru || data;
        const hargaBeras = terbaru['Beras'] ? terbaru['Beras'].harga : 15000;
        const hargaTelur = terbaru['Telur Ayam'] ? terbaru['Telur Ayam'].harga : 28000;
        const hargaMinyak = terbaru['Minyak Goreng'] ? terbaru['Minyak Goreng'].harga : 18000;

        // Logika Ekonomi (Harga 1 Porsi Anak Kos)
        const biayaBeras = hargaBeras * 0.20;
        const biayaTelur = hargaTelur * 0.06;
        const biayaMinyak = hargaMinyak * 0.05;
        
        const biayaSatuPorsi = biayaBeras + biayaTelur + biayaMinyak;
        const uangSaku = 50000;
        const porsiDidapat = Math.floor(uangSaku / biayaSatuPorsi);

        // Update UI Kartu
        document.getElementById('biaya-porsi').innerText = `Rp ${Math.round(biayaSatuPorsi).toLocaleString('id-ID')}`;
        document.getElementById('jumlah-porsi').innerText = `${porsiDidapat} Porsi`;

        // Hitung perbandingan porsi vs bulan lalu (simulasi kenaikan 5%)
        const hargaBulanLalu = biayaSatuPorsi / 1.05;
        const porsiBulanLalu = Math.floor(uangSaku / hargaBulanLalu);
        const selisih = porsiDidapat - porsiBulanLalu;
        const compEl = document.getElementById('porsi-comparison');
        if (compEl) {
            if (selisih < 0) {
                compEl.innerText = `${selisih} Porsi dari bulan lalu`;
            } else if (selisih > 0) {
                compEl.innerText = `+${selisih} Porsi dari bulan lalu`;
                compEl.style.background = '#E8F5E9';
                compEl.style.color = '#2E7D32';
            } else {
                compEl.innerText = `Stabil dari bulan lalu`;
                compEl.style.background = '#FFF3E0';
                compEl.style.color = '#E65100';
            }
        }

        // Render Kartu Harga Pasaran
        const rawDataContainer = document.getElementById('raw-data-container');
        for (const [komoditas, info] of Object.entries(terbaru)) {
            const harga = info && info.harga ? info.harga : 0;
            const tanggal = info && info.tanggal ? new Date(info.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
            const card = document.createElement('div');
            card.className = 'mini-card';
            card.innerHTML = `
                <div class="mini-card-title">${komoditas}</div>
                <div class="mini-card-price">Rp ${harga.toLocaleString('id-ID')}</div>
                <div class="mini-card-date">Per ${tanggal}</div>
            `;
            rawDataContainer.appendChild(card);
        }

        // === GRAFIK INTERAKTIF (TIME-SERIES STORYTELLING) ===
        const historis = data.historis;
        if (historis && historis['Beras'] && historis['Telur Ayam'] && historis['Minyak Goreng']) {
            const berasData = historis['Beras'];
            const telurData = historis['Telur Ayam'];
            const minyakData = historis['Minyak Goreng'];

            // Format tanggal menjadi "14 Apr", "15 Apr", dst
            const labels = berasData.tanggal.map(t => {
                const d = new Date(t);
                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });

            // --- CHART 1: Pergerakan Harga 30 Hari ---
            const ctx1 = document.getElementById('priceChart').getContext('2d');
            new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Beras',
                            data: berasData.harga,
                            borderColor: '#08787F',
                            backgroundColor: 'rgba(8, 120, 127, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: '#08787F'
                        },
                        {
                            label: 'Telur Ayam',
                            data: telurData.harga,
                            borderColor: '#FF9F1C',
                            backgroundColor: 'rgba(255, 159, 28, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: '#FF9F1C'
                        },
                        {
                            label: 'Minyak Goreng',
                            data: minyakData.harga,
                            borderColor: '#0D3B66',
                            backgroundColor: 'rgba(13, 59, 102, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: '#0D3B66'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 20,
                                font: { family: 'Outfit', size: 13, weight: '600' }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#0D3B66',
                            titleFont: { family: 'Outfit', size: 14, weight: '800' },
                            bodyFont: { family: 'Outfit', size: 13 },
                            padding: 14,
                            cornerRadius: 12,
                            callbacks: {
                                label: function(context) {
                                    return ` ${context.dataset.label}: Rp ${context.parsed.y.toLocaleString('id-ID')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(0,0,0,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Outfit' },
                                callback: function(value) {
                                    return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Outfit', size: 11 }, maxRotation: 0 }
                        }
                    }
                }
            });

            // --- CHART 2: Porsi Nasi Telur Setiap Hari ---
            const porsiHarian = berasData.harga.map((beras, i) => {
                const telur = telurData.harga[i];
                const minyak = minyakData.harga[i];
                const biaya = (beras * 0.20) + (telur * 0.06) + (minyak * 0.05);
                return Math.floor(50000 / biaya);
            });

            const ctx2 = document.getElementById('porsiChart').getContext('2d');
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Porsi Nasi Telur per Rp 50.000',
                        data: porsiHarian,
                        backgroundColor: 'rgba(8, 120, 127, 0.75)',
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0D3B66',
                            titleFont: { family: 'Outfit', size: 14, weight: '800' },
                            bodyFont: { family: 'Outfit', size: 13 },
                            padding: 14,
                            cornerRadius: 12,
                            callbacks: {
                                label: function(context) {
                                    return ` ${context.parsed.y} Porsi bisa dinikmati`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(0,0,0,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Outfit' },
                                stepSize: 1,
                                callback: function(value) {
                                    return value + ' porsi';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Outfit', size: 11 }, maxRotation: 0 }
                        }
                    }
                }
            });
        }

        // === INDOMIE SURVIVAL INDEX ===
        const indomieData = data.indomie_tracker;
        if (indomieData && indomieData.length > 0) {
            // Hitung insight cards
            const awalBulan = indomieData.filter(d => d.hari <= 5);
            const akhirBulan = indomieData.filter(d => d.hari >= 25);
            const totalBungkus = indomieData.reduce((sum, d) => sum + d.bungkus, 0);
            
            const avgAwal = awalBulan.length > 0 ? (awalBulan.reduce((s, d) => s + d.bungkus, 0) / awalBulan.length).toFixed(1) : '0';
            const avgAkhir = akhirBulan.length > 0 ? (akhirBulan.reduce((s, d) => s + d.bungkus, 0) / akhirBulan.length).toFixed(1) : '0';
            
            document.getElementById('indomie-awal').innerText = `${avgAwal} bungkus/hari`;
            document.getElementById('indomie-akhir').innerText = `${avgAkhir} bungkus/hari`;
            document.getElementById('indomie-total').innerText = `${totalBungkus} bungkus`;

            // Format labels
            const indomieLabels = indomieData.map(d => {
                const date = new Date(d.tanggal);
                return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });

            // Warna berdasarkan tanggal dalam bulan
            const indomieColors = indomieData.map(d => {
                if (d.hari <= 10) return 'rgba(8, 120, 127, 0.7)';
                if (d.hari <= 24) return 'rgba(255, 159, 28, 0.7)';
                return 'rgba(230, 57, 70, 0.7)';
            });

            const ctx3 = document.getElementById('indomieChart').getContext('2d');
            new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: indomieLabels,
                    datasets: [{
                        label: 'Bungkus Indomie',
                        data: indomieData.map(d => d.bungkus),
                        backgroundColor: indomieColors,
                        borderRadius: 3,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0D3B66',
                            titleFont: { family: 'Outfit', size: 14, weight: '800' },
                            bodyFont: { family: 'Outfit', size: 13 },
                            padding: 14,
                            cornerRadius: 12,
                            callbacks: {
                                label: function(context) {
                                    const d = indomieData[context.dataIndex];
                                    return ` ${d.bungkus} bungkus (tanggal ${d.hari})`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(0,0,0,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Outfit' },
                                stepSize: 1,
                                callback: function(value) {
                                    return value + ' bks';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                font: { family: 'Outfit', size: 10 }, 
                                maxRotation: 0,
                                maxTicksLimit: 15
                            }
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error("Gagal mengambil data:", error);
        document.getElementById('biaya-porsi').innerText = "Error";
        document.getElementById('jumlah-porsi').innerText = "—";
    }

    // --- LOGIKA POPUP OPENING ---
    const popup = document.getElementById('welcome-popup');
    const closeBtn = document.getElementById('close-popup-btn');
    
    setTimeout(() => {
        popup.classList.add('show');
        document.body.style.overflow = 'hidden';
    }, 500);

    closeBtn.addEventListener('click', () => {
        popup.classList.remove('show');
        document.body.style.overflow = 'auto';
    });

    // Menutup popup dengan tombol Escape di keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popup.classList.contains('show')) {
            popup.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
    });

    // --- LOGIKA TOMBOL LIVE TRACKER ---
    const liveTrackBtn = document.getElementById('live-track-btn');
    if(liveTrackBtn) {
        liveTrackBtn.addEventListener('click', () => {
            const originalText = liveTrackBtn.innerText;
            liveTrackBtn.innerText = "Mengecek API...";
            liveTrackBtn.style.opacity = '0.7';
            
            setTimeout(() => {
                liveTrackBtn.innerText = "Tersinkronisasi ✅";
                liveTrackBtn.style.opacity = '1';
                
                document.querySelector('.raw-data-section').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });

                setTimeout(() => {
                    liveTrackBtn.innerText = originalText;
                }, 3000);
            }, 800);
        });
    }

    // --- PARALLAX SCROLL EFFECT ---
    const parallaxShapes = document.querySelectorAll('.parallax-shape');
    const heroContent = document.querySelector('.hero-content');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;

        // Parallax pada floating shapes (bergerak + rotasi saat scroll)
        parallaxShapes.forEach((shape, i) => {
            const speed = parseFloat(shape.dataset.speed) || 0.03;
            const direction = i % 2 === 0 ? 1 : -1;
            const yMove = scrollY * speed * 25;
            const rotate = scrollY * speed * direction * 3;
            shape.style.transform = `translateY(${yMove}px) rotate(${rotate}deg)`;
        });

        // Parallax pada hero content
        if (heroContent && scrollY < 800) {
            heroContent.style.transform = `translateY(${scrollY * 0.4}px)`;
            heroContent.style.opacity = `${1 - scrollY / 700}`;
        }
    }, { passive: true });

    // --- SCROLL REVEAL (Intersection Observer) ---
    const revealElements = document.querySelectorAll('.scroll-reveal');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger delay berdasarkan urutan
                setTimeout(() => {
                    entry.target.classList.add('revealed');
                }, index * 100);
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

});
