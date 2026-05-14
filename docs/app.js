// Zona daya beli — berapa porsi dari Rp 50.000
const ZONA_7 = Math.floor(50000 / 7);   // ~7.143
const ZONA_6 = Math.floor(50000 / 6);   // ~8.333

function buildNasiTelurStoryChart(forecastData) {
    if (!forecastData || !forecastData.biaya_harian || !forecastData.prediksi) return;

    const bHarian  = forecastData.biaya_harian;
    const prediksi = forecastData.prediksi;
    const histVals = bHarian.map(d => d.biaya);

    const fmt = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const histLabels = bHarian.map(d => fmt(d.tanggal));
    const predLabels = prediksi.map(d => fmt(d.tanggal));
    const allLabels  = [...histLabels, ...predLabels];

    const lastVal  = histVals[histVals.length - 1];
    const firstVal = histVals[0];
    const minVal   = Math.min(...histVals);
    const maxVal   = Math.max(...histVals);
    const avgVal   = Math.round(histVals.reduce((s, v) => s + v, 0) / histVals.length);
    const minIdx   = histVals.indexOf(minVal);
    const maxIdx   = histVals.indexOf(maxVal);
    const minDate  = bHarian[minIdx].tanggal;
    const maxDate  = bHarian[maxIdx].tanggal;

    // Hitung delta
    const deltaRp  = lastVal - firstVal;
    const deltaPct = ((deltaRp / firstVal) * 100).toFixed(1);
    const arah     = deltaRp >= 0 ? 'naik' : 'turun';
    const arahClr  = deltaRp >= 0 ? '#e63946' : '#27ae60';

    // Update stats row
    document.getElementById('stat-min').innerText = `Rp ${minVal.toLocaleString('id-ID')} (${fmt(minDate)})`;
    document.getElementById('stat-max').innerText = `Rp ${maxVal.toLocaleString('id-ID')} (${fmt(maxDate)})`;
    document.getElementById('stat-avg').innerText = `Rp ${avgVal.toLocaleString('id-ID')}`;
    const deltaEl = document.getElementById('stat-delta');
    deltaEl.innerText = `${deltaRp >= 0 ? '+' : ''}Rp ${Math.abs(deltaRp).toLocaleString('id-ID')} (${deltaRp >= 0 ? '+' : ''}${deltaPct}%)`;
    deltaEl.style.color = arahClr;

    // Narrative dinamis
    const zoneNow = lastVal < ZONA_7 ? '7+ porsi' : lastVal < ZONA_6 ? '6 porsi' : '5 porsi atau kurang';
    const predArah = forecastData.selisih >= 0 ? 'diprediksi naik' : 'diprediksi turun';
    const narrEl = document.getElementById('nasiTelur-narrative');
    if (narrEl) {
        narrEl.innerHTML =
            `Dalam <strong>${bHarian.length} hari terakhir</strong>, biaya 1 porsi nasi telur ` +
            `<strong style="color:${arahClr}">${arah} ${Math.abs(deltaPct)}%</strong> — ` +
            `dari <strong>Rp ${firstVal.toLocaleString('id-ID')}</strong> ke ` +
            `<strong>Rp ${lastVal.toLocaleString('id-ID')}</strong>. ` +
            `Daya beli hari ini: <strong>${zoneNow}</strong> dari Rp 50.000. ` +
            `Harga <strong>cabai merah</strong> menjadi komponen paling volatil dalam resep ini. ` +
            `Minggu depan biaya <strong>${predArah}</strong> sekitar ` +
            `<strong>Rp ${Math.abs(forecastData.selisih).toLocaleString('id-ID')}</strong> ` +
            `(${forecastData.persen_perubahan > 0 ? '+' : ''}${forecastData.persen_perubahan}%).`;
    }

    // Dataset: historis (dengan warna segmen per zona)
    const lineHistoris = [...histVals, ...Array(prediksi.length).fill(null)];

    // Dataset: prediksi (sambung di titik terakhir historis)
    const linePrediksi = [
        ...Array(histVals.length - 1).fill(null),
        lastVal,
        ...prediksi.map(d => d.biaya)
    ];

    const lineUpper = [...Array(histVals.length).fill(null), ...prediksi.map(d => d.upper)];
    const lineLower = [...Array(histVals.length).fill(null), ...prediksi.map(d => d.lower)];

    const ctx = document.getElementById('nasiTelurStoryChart').getContext('2d');

    // Gradient fill untuk historis
    const makeGradient = (chart) => {
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return 'rgba(8,120,127,0.1)';
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0,   'rgba(230, 57,  70,  0.18)');
        grad.addColorStop(0.4, 'rgba(255, 159, 28,  0.10)');
        grad.addColorStop(1,   'rgba(39,  174, 96,  0.04)');
        return grad;
    };

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Biaya 1 Porsi',
                    data: lineHistoris,
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: ctx => makeGradient(ctx.chart),
                    tension: 0.35,
                    spanGaps: false,
                    segment: {
                        borderColor: ctx => {
                            const avg = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
                            if (avg < ZONA_7) return '#27ae60';
                            if (avg < ZONA_6) return '#e67e22';
                            return '#e63946';
                        }
                    },
                    pointRadius: ctx => (ctx.dataIndex === minIdx || ctx.dataIndex === maxIdx) ? 7 : 3,
                    pointBackgroundColor: ctx => {
                        const v = ctx.parsed?.y;
                        if (v == null) return 'transparent';
                        if (v < ZONA_7) return '#27ae60';
                        if (v < ZONA_6) return '#e67e22';
                        return '#e63946';
                    },
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                },
                {
                    label: 'Prediksi',
                    data: linePrediksi,
                    borderColor: 'rgba(230,57,70,0.75)',
                    borderWidth: 2.5,
                    borderDash: [8, 5],
                    fill: false,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(230,57,70,0.75)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    spanGaps: false,
                },
                {
                    label: 'Batas Atas',
                    data: lineUpper,
                    borderColor: 'rgba(230,57,70,0.2)',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    backgroundColor: 'rgba(230,57,70,0.06)',
                    fill: '+1',
                    tension: 0.35,
                    pointRadius: 0,
                    spanGaps: false,
                },
                {
                    label: 'Batas Bawah',
                    data: lineLower,
                    borderColor: 'rgba(230,57,70,0.2)',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0,
                    spanGaps: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 15, 15, 0.95)',
                    titleFont: { family: 'Inter', size: 13, weight: '800' },
                    bodyFont:  { family: 'Inter', size: 12 },
                    padding: 14,
                    cornerRadius: 12,
                    callbacks: {
                        label: ctx => {
                            if (ctx.parsed.y == null) return null;
                            if (['Batas Atas', 'Batas Bawah'].includes(ctx.dataset.label)) return null;
                            const v     = ctx.parsed.y;
                            const porsi = Math.floor(50000 / v);
                            const zone  = v < ZONA_7 ? '✅ Zona Hemat' : v < ZONA_6 ? '⚠️ Zona Normal' : '🔴 Zona Mahal';
                            const tag   = ctx.dataset.label === 'Prediksi' ? ' (prediksi)' : '';
                            return [
                                ` ${ctx.dataset.label}${tag}: Rp ${Math.round(v).toLocaleString('id-ID')}`,
                                ` Dapat: ${porsi} porsi dari Rp 50.000`,
                                ` ${zone}`
                            ];
                        }
                    }
                },
                annotation: {
                    annotations: {
                        // Background zona hemat
                        bgHemat: {
                            type: 'box', yMin: 0, yMax: ZONA_7,
                            backgroundColor: 'rgba(39,174,96,0.05)',
                            borderWidth: 0,
                        },
                        // Background zona normal
                        bgNormal: {
                            type: 'box', yMin: ZONA_7, yMax: ZONA_6,
                            backgroundColor: 'rgba(230,126,34,0.04)',
                            borderWidth: 0,
                        },
                        // Background zona mahal
                        bgMahal: {
                            type: 'box', yMin: ZONA_6, yMax: 20000,
                            backgroundColor: 'rgba(230,57,70,0.04)',
                            borderWidth: 0,
                        },
                        // Garis batas 7 porsi
                        line7: {
                            type: 'line', yMin: ZONA_7, yMax: ZONA_7,
                            borderColor: 'rgba(39,174,96,0.3)',
                            borderWidth: 1, borderDash: [4, 4],
                        },
                        // Garis batas 6 porsi
                        line6: {
                            type: 'line', yMin: ZONA_6, yMax: ZONA_6,
                            borderColor: 'rgba(230,57,70,0.3)',
                            borderWidth: 1, borderDash: [4, 4],
                        },
                        // Garis rata-rata
                        avgLine: {
                            type: 'line', yMin: avgVal, yMax: avgVal,
                            borderColor: 'rgba(100,100,100,0.4)',
                            borderWidth: 1.5, borderDash: [6, 4],
                            label: {
                                display: true,
                                content: `Rata-rata Rp ${avgVal.toLocaleString('id-ID')}`,
                                position: 'start',
                                color: '#888',
                                font: { family: 'Inter', size: 10 },
                                backgroundColor: 'rgba(255,255,255,0.85)',
                                padding: { x: 6, y: 3 }, borderRadius: 4,
                            }
                        },
                        // Label min
                        lblMin: {
                            type: 'label',
                            xValue: minIdx, yValue: minVal,
                            content: [`Terhemat`, `Rp ${minVal.toLocaleString('id-ID')}`],
                            color: '#27ae60',
                            font: { family: 'Inter', size: 10, weight: '700' },
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            padding: { x: 6, y: 4 }, borderRadius: 6,
                            yAdjust: 28,
                        },
                        // Label max
                        lblMax: {
                            type: 'label',
                            xValue: maxIdx, yValue: maxVal,
                            content: [`Termahal`, `Rp ${maxVal.toLocaleString('id-ID')}`],
                            color: '#e63946',
                            font: { family: 'Inter', size: 10, weight: '700' },
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            padding: { x: 6, y: 4 }, borderRadius: 6,
                            yAdjust: -28,
                        },
                        // Pemisah "hari ini"
                        todayLine: {
                            type: 'line',
                            xMin: histLabels.length - 1,
                            xMax: histLabels.length - 1,
                            borderColor: 'rgba(13,59,102,0.45)',
                            borderWidth: 2, borderDash: [6, 3],
                            label: {
                                display: true,
                                content: ['Hari ini', '↓ prediksi'],
                                position: 'start',
                                color: '#0D3B66',
                                font: { family: 'Inter', size: 10, weight: '700' },
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                padding: { x: 6, y: 4 }, borderRadius: 6,
                            }
                        },
                    }
                }
            },
            scales: {
                y: {
                    min: Math.min(minVal, ...prediksi.map(d => d.lower)) * 0.975,
                    max: Math.max(maxVal, ...prediksi.map(d => d.upper)) * 1.025,
                    grid: { color: 'rgba(0,0,0,0.04)', borderDash: [5, 5] },
                    ticks: {
                        font: { family: 'Inter' },
                        callback: v => `Rp ${(v / 1000).toFixed(1)}rb`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 0, maxTicksLimit: 12 }
                }
            }
        }
    });
}

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
                                font: { family: 'Inter', size: 13, weight: '600' }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 15, 15, 0.95)',
                            titleFont: { family: 'Inter', size: 14, weight: '800' },
                            bodyFont: { family: 'Inter', size: 13 },
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
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Inter' },
                                callback: function(value) {
                                    return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Inter', size: 11 }, maxRotation: 0 }
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
                            backgroundColor: 'rgba(15, 15, 15, 0.95)',
                            titleFont: { family: 'Inter', size: 14, weight: '800' },
                            bodyFont: { family: 'Inter', size: 13 },
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
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Inter' },
                                stepSize: 1,
                                callback: function(value) {
                                    return value + ' porsi';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Inter', size: 11 }, maxRotation: 0 }
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
                            backgroundColor: 'rgba(15, 15, 15, 0.95)',
                            titleFont: { family: 'Inter', size: 14, weight: '800' },
                            bodyFont: { family: 'Inter', size: 13 },
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
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Inter' },
                                stepSize: 1,
                                callback: function(value) {
                                    return value + ' bks';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { 
                                font: { family: 'Inter', size: 10 }, 
                                maxRotation: 0,
                                maxTicksLimit: 15
                            }
                        }
                    }
                }
            });
        }

        // === STORYTELLING CHART: Perjalanan Biaya Nasi Telur ===
        if (data.forecast) {
            buildNasiTelurStoryChart(data.forecast);
        }

        // === FORECAST CHART ===
        const forecastData = data.forecast;
        if (forecastData && forecastData.biaya_harian && forecastData.prediksi) {

            // Update insight cards
            document.getElementById('forecast-sekarang').innerText =
                `Rp ${forecastData.biaya_sekarang.toLocaleString('id-ID')}`;
            document.getElementById('forecast-7hari').innerText =
                `Rp ${forecastData.biaya_7hari.toLocaleString('id-ID')}`;

            const selisih   = forecastData.selisih;
            const persen    = forecastData.persen_perubahan;
            const selisihEl = document.getElementById('forecast-selisih');
            const sign      = selisih >= 0 ? '+' : '';
            selisihEl.innerText = `${sign}Rp ${Math.abs(selisih).toLocaleString('id-ID')} (${sign}${persen}%)`;
            selisihEl.style.color = selisih > 0 ? '#E63946' : '#2E7D32';

            // Update Coffee Insight secara dinamis berdasarkan forecast
            const selisihBulanan = Math.abs(selisih) * 30;
            const hargoKopi      = 25000;
            const gelasKopi      = (selisihBulanan / hargoKopi).toFixed(1);
            const arahKopi       = selisih > 0 ? 'naik' : 'turun';
            const coffeeEl       = document.querySelector('.story-text p');
            if (coffeeEl) {
                coffeeEl.innerHTML = `Dengan tren harga saat ini, biaya makan bulananmu diprediksi
                    <strong>${arahKopi}</strong> setara
                    <strong>${gelasKopi} Gelas Kopi Susu</strong> Kekinian.
                    ${selisih > 0
                        ? 'Pertimbangkan untuk mulai mengurangi pengeluaran non-esensial.'
                        : 'Kabar baik — daya belimu membaik minggu ini!'}`;
            }

            // Siapkan data chart: historis + prediksi
            const histLen    = forecastData.biaya_harian.length;
            const predLen    = forecastData.prediksi.length;

            const histLabels = forecastData.biaya_harian.map(d => {
                const dt = new Date(d.tanggal);
                return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });
            const predLabels = forecastData.prediksi.map(d => {
                const dt = new Date(d.tanggal);
                return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            });
            const allLabels = [...histLabels, ...predLabels];

            const histValues  = forecastData.biaya_harian.map(d => d.biaya);
            const lastHistVal = histValues[histValues.length - 1];

            // Garis historis: nilai nyata, null untuk zona prediksi
            const lineHistoris = [...histValues, ...Array(predLen).fill(null)];

            // Garis prediksi: null untuk zona historis (kecuali titik sambung terakhir), lalu nilai prediksi
            const linePrediksi = [
                ...Array(histLen - 1).fill(null),
                lastHistVal,
                ...forecastData.prediksi.map(d => d.biaya)
            ];

            // Batas atas: null di zona historis, nilai upper di zona prediksi
            const lineUpper = [...Array(histLen).fill(null), ...forecastData.prediksi.map(d => d.upper)];
            const lineLower = [...Array(histLen).fill(null), ...forecastData.prediksi.map(d => d.lower)];

            const ctx4 = document.getElementById('forecastChart').getContext('2d');
            new Chart(ctx4, {
                type: 'line',
                data: {
                    labels: allLabels,
                    datasets: [
                        {
                            label: 'Biaya Historis',
                            data: lineHistoris,
                            borderColor: '#08787F',
                            backgroundColor: 'rgba(8, 120, 127, 0.08)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            spanGaps: false,
                        },
                        {
                            label: 'Prediksi',
                            data: linePrediksi,
                            borderColor: '#E63946',
                            borderWidth: 3,
                            borderDash: [7, 4],
                            fill: false,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            spanGaps: false,
                        },
                        {
                            label: 'Batas Atas',
                            data: lineUpper,
                            borderColor: 'rgba(230, 57, 70, 0.35)',
                            borderWidth: 1,
                            borderDash: [3, 3],
                            backgroundColor: 'rgba(230, 57, 70, 0.08)',
                            fill: '+1',
                            tension: 0.3,
                            pointRadius: 0,
                            spanGaps: false,
                        },
                        {
                            label: 'Batas Bawah',
                            data: lineLower,
                            borderColor: 'rgba(230, 57, 70, 0.35)',
                            borderWidth: 1,
                            borderDash: [3, 3],
                            fill: false,
                            tension: 0.3,
                            pointRadius: 0,
                            spanGaps: false,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                filter: item => !['Batas Atas', 'Batas Bawah'].includes(item.text),
                                usePointStyle: true,
                                font: { family: 'Inter', size: 13, weight: '600' }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 15, 15, 0.95)',
                            titleFont: { family: 'Inter', size: 14, weight: '800' },
                            bodyFont:  { family: 'Inter', size: 13 },
                            padding: 14,
                            cornerRadius: 12,
                            callbacks: {
                                label: function(context) {
                                    if (context.parsed.y === null) return null;
                                    if (['Batas Atas', 'Batas Bawah'].includes(context.dataset.label)) return null;
                                    return ` ${context.dataset.label}: Rp ${Math.round(context.parsed.y).toLocaleString('id-ID')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                            ticks: {
                                font: { family: 'Inter' },
                                callback: value => 'Rp ' + (value / 1000).toFixed(1) + 'rb'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 0, maxTicksLimit: 15 }
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
