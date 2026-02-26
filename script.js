// ==========================================
// KONFIGURASI API BACKEND
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzZF4IpaGixmwDwoJj2irti_FZKonwd27WI4BnQvubtVGoM_Qc55spB0KHQas3SjxiAVg/exec'; 

window.globalDataTransaksi = [];
window.currentEditId = null; 

document.addEventListener('DOMContentLoaded', () => {

    const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

    // 1. OTENTIKASI & LOGOUT
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('.btn-primary');
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Memverifikasi...";
            btn.disabled = true;
            setTimeout(() => { localStorage.setItem('isLoggedIn', 'true'); window.location.href = 'dashboard.html'; }, 1000);
        });
    }

    const btnLogout = document.querySelector('.btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault(); localStorage.removeItem('isLoggedIn'); window.location.href = 'index.html';
        });
    }

    // ==========================================
    // 2. FUNGSI FETCH GANDA (TRANSAKSI + FREELANCE)
    // ==========================================
    window.fetchAndRenderData = function() {
        const totalSaldoEl = document.querySelector('.total-saldo h3');
        if (totalSaldoEl) totalSaldoEl.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";

        const tableBody = document.querySelector('.main-table tbody');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;"><i class='bx bx-loader-alt bx-spin'></i> Mengambil data...</td></tr>`;

        // Memanggil 2 Sheet Sekaligus secara paralel!
        const fetchTransaksi = fetch(API_URL).then(res => res.json());
        const fetchFreelance = fetch(API_URL + "?sheetName=Freelance_Shopee").then(res => res.json());

        Promise.all([fetchTransaksi, fetchFreelance])
            .then(results => {
                const resTransaksi = results[0];
                const resFreelance = results[1];

                if (resTransaksi.status === 'success') {
                    window.globalDataTransaksi = resTransaksi.data; 
                    
                    // Hitung total LABA dari Sheet Freelance
                    let totalLabaShopee = 0;
                    if (resFreelance.status === 'success' && resFreelance.data) {
                        resFreelance.data.forEach(item => {
                            totalLabaShopee += parseFloat(item.Laba) || 0;
                        });
                    }

                    // Lempar data transaksi dan laba shopee ke Dashboard
                    renderDashboard(resTransaksi.data, totalLabaShopee);
                    renderTabelTransaksi(resTransaksi.data);
                    if(typeof renderLayanan === "function") renderLayanan(resTransaksi.data);
                }
            })
            .catch(error => console.error('Error:', error));
    }

    // ==========================================
    // 3. RENDER DASHBOARD (DENGAN TAMBAHAN LABA SHOPEE)
    // ==========================================
    function renderDashboard(data, labaShopee) {
        const isDashboard = document.querySelector('.summary-grid');
        if (!isDashboard) return; 

        let totalPemasukan = 0, totalPengeluaran = 0;
        const monthlyData = {}; 

        data.forEach(item => {
            const nominal = parseFloat(item.nominal) || 0;
            if (item.tipe === 'Pemasukan') totalPemasukan += nominal;
            if (item.tipe === 'Pengeluaran') totalPengeluaran += nominal;

            if (item.tanggal) {
                const dateObj = new Date(item.tanggal);
                if (!isNaN(dateObj.getTime())) {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                    const monthKey = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                    if (!monthlyData[monthKey]) monthlyData[monthKey] = { in: 0, out: 0, time: dateObj.getTime() };
                    if (item.tipe === 'Pemasukan') monthlyData[monthKey].in += nominal;
                    if (item.tipe === 'Pengeluaran') monthlyData[monthKey].out += nominal;
                }
            }
        });

        // 🌟 INTEGRASI: Tambahkan Laba Shopee ke Total Pemasukan Global!
        totalPemasukan += labaShopee;

        document.querySelector('.total-saldo h3').innerText = formatRp(totalPemasukan - totalPengeluaran);
        document.querySelector('.pemasukan h3').innerText = formatRp(totalPemasukan);
        document.querySelector('.pengeluaran h3').innerText = formatRp(totalPengeluaran);

        const ctx = document.getElementById('cashflowChart');
        if (ctx) {
            const sortedMonths = Object.keys(monthlyData).sort((a,b) => monthlyData[a].time - monthlyData[b].time);
            const chartLabels = [], chartIn = [], chartOut = [];
            sortedMonths.slice(-7).forEach(m => { chartLabels.push(m); chartIn.push(monthlyData[m].in); chartOut.push(monthlyData[m].out); });

            if(window.myChart) window.myChart.destroy();
            window.myChart = new Chart(ctx, { type: 'bar', data: { labels: chartLabels, datasets: [ { label: 'Pemasukan', data: chartIn, backgroundColor: '#0D6EFD', borderRadius: 6 }, { label: 'Pengeluaran', data: chartOut, backgroundColor: '#F87171', borderRadius: 6 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        }
    }

    // 4. RENDER TABEL TRANSAKSI
    function renderTabelTransaksi(data) {
        const tableBody = document.querySelector('.main-table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (data.length === 0) { tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada data.</td></tr>'; return; }

        [...data].reverse().forEach(item => {
            const isIn = item.tipe === 'Pemasukan';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.tanggal}</td>
                <td><div class="cat-label"><i class='bx ${isIn?'bx-money':'bx-cart'}' style="color: ${isIn?'#16A34A':'#DC3545'};"></i> ${item.kategori}</div></td>
                <td>${item.keterangan}</td>
                <td><span class="status-badge ${isIn?'status-in':'status-out'}">${item.tipe}</span></td>
                <td class="tx-amount ${isIn?'amount-in':'amount-out'}">${isIn?'+':'-'} ${formatRp(item.nominal)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon edit" onclick="editTransaksi('${item.id}')" title="Edit"><i class='bx bx-pencil'></i></button>
                        <button class="btn-icon delete" onclick="hapusTransaksi('${item.id}')" title="Hapus"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    const nominalInput = document.getElementById('nominalInput');
    if (nominalInput) {
        nominalInput.addEventListener('input', function(e) {
            let value = this.value.replace(/[^0-9]/g, '');
            this.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        });
    }

    // 5. MODAL & SIMPAN
    const modal = document.getElementById('modalTransaksi');
    const btnTambah = document.getElementById('btnTambahData');
    const closeModal = document.getElementById('closeModal');
    const btnSimpan = document.querySelector('.btn-simpan');

    if (modal && btnTambah && closeModal) {
        btnTambah.addEventListener('click', () => {
            window.currentEditId = null; 
            document.getElementById('formTransaksi').reset();
            document.getElementById('modalTitle').innerText = "Tambah Transaksi";
            modal.classList.add('show');
        });
        closeModal.addEventListener('click', () => modal.classList.remove('show'));
    }

    if (btnSimpan) {
        btnSimpan.addEventListener('click', (e) => {
            e.preventDefault();
            let rawNominal = document.getElementById('nominalInput').value.replace(/\./g, '');
            const payload = {
                tanggal: document.getElementById('tglInput').value,
                kategori: document.getElementById('kategoriInput').value,
                tipe: document.getElementById('tipeInput').value,
                keterangan: document.getElementById('ketInput').value,
                nominal: rawNominal 
            };

            if (!payload.tanggal || !payload.kategori || !payload.tipe || !payload.keterangan || !payload.nominal) {
                alert('Mohon isi semua kolom!'); return;
            }

            if (window.currentEditId) { payload.action = 'update'; payload.id = window.currentEditId; }

            btnSimpan.innerHTML = "Menyimpan...";
            btnSimpan.disabled = true;

            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            })
            .then(r => r.json())
            .then(result => {
                modal.classList.remove('show');
                window.fetchAndRenderData(); 
            })
            .catch(e => alert('Error Jaringan'))
            .finally(() => { btnSimpan.innerHTML = "Simpan"; btnSimpan.disabled = false; });
        });
    }

    window.renderLayanan = function(data) {
        const container = document.getElementById('layananContainer');
        if (!container) return;
        const list = ['Top Up e-Wallet', 'Top Up Bank', 'Tarik Tunai', 'Pulsa & Kuota', 'Freelance'];
        const rekap = {};
        list.forEach(k => rekap[k] = { in: 0, out: 0, icon: k.includes('Bank')?'bx-building-house':k.includes('Pulsa')?'bx-mobile-alt':'bx-wallet-alt' });

        data.forEach(item => {
            const nom = parseFloat(item.nominal) || 0;
            if (rekap[item.kategori]) {
                if (item.tipe === 'Pemasukan') rekap[item.kategori].in += nom;
                if (item.tipe === 'Pengeluaran') rekap[item.kategori].out += nom;
            }
        });

        container.innerHTML = '';
        list.forEach(k => {
            const r = rekap[k], p = r.in - r.out;
            container.innerHTML += `<div class="layanan-card"><div class="layanan-header"><div class="layanan-icon"><i class='bx ${r.icon}'></i></div><div class="layanan-title">${k}</div></div><div class="layanan-stats"><div class="stat-row"><span class="stat-label">Pemasukan</span><span class="stat-val in">+ ${formatRp(r.in)}</span></div><div class="stat-row"><span class="stat-label">Pengeluaran</span><span class="stat-val out">- ${formatRp(r.out)}</span></div><div class="stat-profit"><span class="stat-label">Laba Bersih</span><span class="stat-val">${formatRp(p)}</span></div></div></div>`;
        });
    }

    window.fetchAndRenderData();
});

// FUNGSI HAPUS (DELETE)
window.hapusTransaksi = function(id) {
    if (!confirm('Hapus transaksi permanen?')) return;
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', id: id }) })
    .then(r => r.json()).then(res => { if(res.status === 'success') window.fetchAndRenderData(); });
}

// FUNGSI EDIT (UPDATE)
window.editTransaksi = function(id) {
    const item = window.globalDataTransaksi.find(x => x.id === id);
    if (!item) return;

    window.currentEditId = id;
    document.getElementById('tglInput').value = item.tanggal;
    document.getElementById('kategoriInput').value = item.kategori;
    document.getElementById('tipeInput').value = item.tipe;
    document.getElementById('ketInput').value = item.keterangan;
    
    let nomString = item.nominal.toString().replace(/[^0-9]/g, '');
    document.getElementById('nominalInput').value = nomString.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    document.getElementById('modalTitle').innerText = "Edit Transaksi";
    document.getElementById('modalTransaksi').classList.add('show');
}

// FUNGSI DOWNLOAD CSV
window.downloadCSV = function() {
    if (!window.globalDataTransaksi || window.globalDataTransaksi.length === 0) { alert("Belum ada data!"); return; }
    let csvContent = "ID,Tanggal,Kategori,Keterangan,Tipe,Nominal\n";
    window.globalDataTransaksi.forEach(row => {
        let ket = `"${row.keterangan.replace(/"/g, '""')}"`;
        csvContent += `${row.id},${row.tanggal},${row.kategori},${ket},${row.tipe},${row.nominal}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Laporan_Dompet_Pintar.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}