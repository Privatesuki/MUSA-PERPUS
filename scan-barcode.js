/* =====================================================================
   MUSA PERPUS - ADD-ON: MODE SCAN BARCODE (SIRKULASI PEMINJAMAN)
   File ini HANYA menambah fitur. Tidak ada kode lama yang diubah.
   Pasang di index.html SETELAH <script src="script.js"></script>:
       <script src="scan-barcode.js"></script>
   ===================================================================== */
(function () {
    'use strict';

    const PARAF_IYA = 'Iya ✔';

    // ---------- Helper ----------
    const $ = (id) => document.getElementById(id);
    const norm = (s) => String(s == null ? '' : s).replace(/[\s\-]/g, '').toLowerCase();
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Tanggal lokal (bukan UTC) agar tidak mundur 1 hari sebelum jam 07.00 WIB
    function hariIniISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

const kamusBukuManual = {
    "9786025400841": "KEMUHAMMADIYAHAN XI",
    "9786232666917": "SEJARAH XI",
    "9786025400834": "KEMUHAMMADIYAHAN X",
    "9786238680214": "BAHASA ARAB X",
    "9786025400858": "KEMUHAMMADIYAHAN XII",
    "9786238680009": "AL ISLAM X",
    "9786232666818": "SEJARAH X",
    "9786022443216": "PKN X",
    "9786232666818": "BAHASA INDONESIA X",
    "9786231800497": "PKN XI",
    "9786238680153": "BAHASA ARAB XI",
    "9786233289900": "BISNIS DIGITAL XI",
    "9786238680023": "AL ISLAM XII",
    "9786235223094": "BAHASA INDONESIA XI (NEW COVER)",
    "9786232666924": "BAHASA INDONESIA XI (OLD COVER)",
    "9786238680160": "BAHASA ARAB XII",
    "9786231802422": "SENI RUPA X",
    "9786231804365": "SENI MUSIK X",
    "9786233289788": "ASISTEN KEPERAWATAN DAN CAREGIVER XI",
    "9786233289856": "DASAR-DASAR LAYANAN KESEHATAN X",
    "9786232667716": "SPLASH XI (OLD COVER)",
    "9786232668027": "SPLASH XI (NEW COVER)",
    "9786231809216": "PKK TEKNOLOGI MANUFAKTUR DAN REKAYASA XII",
    "9786231809223": "PKK TEKNOLOGI INFORMASI XII",
    "9786231808967": "PKK BISNIS DAN MANAJEMEN XII",
    "9786235222455": "DASAR TEKNOLOGI FARMASI",
    "9786235222448": "PELAYANAN FARMASI XI",
    "9786235226132": "FARMAKOLOGI XI",
    "9786235223285": "ADMINISTRASI FARMASI XI",
    "9786235225142": "ADMINISTRASI FARMASI XII",
    "9786231809759": "FARMAKOGNOSI XI",
    "9786342664872": "KIK TEKNOLOGI INFORMASI XII",
    "9786342667781": "KIK TEKNOLOGI MANUFAKTUR DAN REKAYASA XI",
    "9786342669815": "KIK TEKNOLOGI MANUFAKTUR DAN REKAYASA XII",
    "9786342668603": "KIK BISNIS DAN MANAJEMEN XII",
    "9786342667187": "KIK BISNIS DAN MANAJEMEN XI",
    "9786235228471": "TKA PKK 2025",
    "9786235228143": "TKA BAHASA INGGRIS 2025",
    "9786235228013": "TKA BAHASA INDONESIA 2025",
    "9786235228082": "TKA MATEMATIKA 2025",
    "9786235221304": "BAHASA JEPANG JLPT N4",
    "9786231809353": "BAHASA JEPANG JLPT N5",
    "9786232667440": "PROYEK IPAS RUMPUN KESEHATAN X",
    "9786232667402": "PROYEK IPAS RUMPUN TEKNOLOGI X",
    "9786232667488": "PROYEK IPAS RUMPUN BISNIS DAN MANAJEMEN X",
    
    
    


      
    // Tambahkan nomor & judul buku lainnya di sini dengan format:
    // "NOMOR_BARCODE": "JUDUL BUKU",
};

function cariBukuByBarcode(kode) {
    const k = norm(kode);
    if (!k) return null;

    if (kamusBukuManual[kode] || kamusBukuManual[k]) {
        return {
            barcode: kode,
            judul: kamusBukuManual[kode] || kamusBukuManual[k]
        };
    }

    if (typeof daftarBuku !== 'undefined' && Array.isArray(daftarBuku)) {
        return daftarBuku.find(b =>
            norm(b.barcode) === k ||
            norm(b.noInventaris) === k ||
            norm(b.no_inventaris) === k ||
            norm(b.no) === k ||
            norm(b.kode) === k ||
            norm(b.isbn) === k
        ) || null;
    }

    return null;
}

    // ---------- Inisialisasi UI ----------
    function init() {
        const page = $('page-peminjaman');
        const formManualBtn = $('submitPinjamBtn');
        if (!page || !formManualBtn) return;

        // Kartu form lama (Mode Manual) -> dibiarkan utuh, hanya di-show/hide
        const kartuManual = formManualBtn.closest('.bg-white');

        // 1) Toggle switcher
        const switcher = document.createElement('div');
        switcher.className = 'inline-flex bg-slate-200 rounded-2xl p-1 gap-1';
        switcher.innerHTML = `
            <button id="modeManualBtn" type="button" class="px-5 py-2 rounded-xl text-sm font-bold transition">
                <i class="fa-solid fa-keyboard mr-1"></i> Mode Manual
            </button>
            <button id="modeScanBtn" type="button" class="px-5 py-2 rounded-xl text-sm font-bold transition">
                <i class="fa-solid fa-barcode mr-1"></i> Mode Scan Barcode
            </button>`;
        kartuManual.parentNode.insertBefore(switcher, kartuManual);

        // 2) Panel Mode Scan
        const panel = document.createElement('div');
        panel.id = 'scanPanel';
        panel.className = 'hidden space-y-4';
        panel.innerHTML = `
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 space-y-4">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-3">
                    <i class="fa-solid fa-barcode text-blue-600"></i> Form Pinjam - Scan Barcode
                </h3>

                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Scan Barcode Buku (kursor otomatis di sini)</label>
                    <input type="text" id="scan_input" autocomplete="off"
                        class="w-full px-4 py-3 border-2 border-blue-400 rounded-xl text-base font-mono bg-blue-50 focus:outline-blue-600"
                        placeholder="Arahkan scanner ke barcode lalu tembak...">
                    <p id="scan_status" class="text-xs mt-1 text-slate-500">Menunggu scan...</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">No Buku (Barcode)</label>
                        <input type="text" id="sc_nobuku" readonly class="w-full px-3 py-2 border rounded-xl text-sm font-mono bg-slate-100">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Buku</label>
                        <input type="text" id="sc_judul" list="datalist-buku" class="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-slate-100" placeholder="Terisi otomatis dari scan">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal Pinjam</label>
                        <input type="date" id="sc_tgl" readonly class="w-full px-3 py-2 border rounded-xl text-sm bg-slate-100">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Paraf Pinjam</label>
                        <input type="text" id="sc_paraf" readonly value="${PARAF_IYA}" class="w-full px-3 py-2 border rounded-xl text-sm bg-slate-100">
                    </div>
                    <div></div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Peminjam</label>
                        <input type="text" id="sc_nama" class="w-full px-3 py-2 border rounded-xl text-sm focus:outline-blue-500" placeholder="Nama siswa / guru...">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Kelas / Guru</label>
                        <input type="text" id="sc_kelas" class="w-full px-3 py-2 border rounded-xl text-sm focus:outline-blue-500" placeholder="Contoh: XI BDP">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah Buku</label>
                        <input type="number" id="sc_jumlah" value="1" min="1" class="w-full px-3 py-2 border rounded-xl text-sm focus:outline-blue-500">
                    </div>
                    <div class="md:col-span-3">
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Catatan (opsional)</label>
                        <input type="text" id="sc_catatan" class="w-full px-3 py-2 border rounded-xl text-sm focus:outline-blue-500" placeholder="Keterangan tambahan jika ada...">
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button id="sc_reset" type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">Bersihkan</button>
                    <button id="sc_simpan" type="button" class="md:px-8 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-6 rounded-xl font-bold text-sm transition">
                        Simpan Transaksi Pinjam
                    </button>
                </div>
            </div>

            <!-- Detail transaksi terakhir -->
            <div id="sc_detail" class="hidden bg-emerald-50 border border-emerald-200 p-5 rounded-3xl">
                <h4 class="font-bold text-emerald-800 mb-3"><i class="fa-solid fa-circle-check"></i> Detail Transaksi Terakhir</h4>
                <dl id="sc_detail_body" class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"></dl>
            </div>

            <!-- Pengembalian -->
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-3 mb-3">
                    <i class="fa-solid fa-rotate-left text-amber-600"></i> Pengembalian Buku
                </h3>
                <p class="text-xs text-slate-500 mb-3">Pilih Tanggal Pengembalian, Paraf Kembali otomatis berubah menjadi "${PARAF_IYA}".</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs text-left">
                        <thead><tr class="bg-slate-100 text-slate-600 uppercase">
                            <th class="p-2">No Buku</th><th class="p-2">Judul</th><th class="p-2">Peminjam</th>
                            <th class="p-2">Kelas</th><th class="p-2">Jml</th><th class="p-2">Tgl Pinjam</th>
                            <th class="p-2">Tanggal Pengembalian</th><th class="p-2">Paraf Kembali</th>
                        </tr></thead>
                        <tbody id="sc_open_body"></tbody>
                    </table>
                </div>
            </div>`;
        kartuManual.parentNode.insertBefore(panel, kartuManual.nextSibling);

        // ---------- Mode switch ----------
        const btnManual = $('modeManualBtn');
        const btnScan = $('modeScanBtn');
        const aktif = 'bg-blue-600 text-white shadow';
        const pasif = 'text-slate-600 hover:bg-slate-300';

        function setMode(mode) {
            const scan = mode === 'scan';
            kartuManual.classList.toggle('hidden', scan);
            panel.classList.toggle('hidden', !scan);
            btnManual.className = `px-5 py-2 rounded-xl text-sm font-bold transition ${scan ? pasif : aktif}`;
            btnScan.className = `px-5 py-2 rounded-xl text-sm font-bold transition ${scan ? aktif : pasif}`;
            if (scan) {
                $('sc_tgl').value = hariIniISO();
                renderBelumKembali();
                fokusScanner();
            }
        }
        btnManual.addEventListener('click', () => setMode('manual'));
        btnScan.addEventListener('click', () => setMode('scan'));
        setMode('manual');

        // ---------- Scanner ----------
        const scanInput = $('scan_input');
        function fokusScanner() { setTimeout(() => scanInput.focus(), 50); }

        function setStatus(msg, tipe) {
            const el = $('scan_status');
            el.textContent = msg;
            el.className = 'text-xs mt-1 ' + (tipe === 'ok' ? 'text-emerald-600 font-semibold'
                : tipe === 'warn' ? 'text-amber-600 font-semibold' : 'text-slate-500');
        }

        scanInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const kode = scanInput.value.trim();
            scanInput.value = '';
            if (!kode) return;

            $('sc_nobuku').value = kode;
            $('sc_tgl').value = hariIniISO();      // auto hari ini
            $('sc_paraf').value = PARAF_IYA;       // auto paraf

            const buku = cariBukuByBarcode(kode);
            if (buku) {
                $('sc_judul').value = buku.judul;
                setStatus(`Ditemukan: ${buku.judul}`, 'ok');
            } else {
                $('sc_judul').value = '';
                setStatus(`Barcode "${kode}" tidak ada di Data Buku. Isi/pilih judul manual atau impor Data Buku dulu.`, 'warn');
                $('sc_judul').focus();
                return;
            }
            $('sc_nama').focus(); // lanjut isi data petugas
        });

        // Enter di kolom catatan = simpan
        ['sc_nama', 'sc_kelas', 'sc_jumlah', 'sc_catatan'].forEach(id => {
            $(id).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); simpan(); }
            });
        });

        function bersihkanForm() {
            ['sc_nobuku', 'sc_judul', 'sc_nama', 'sc_kelas', 'sc_catatan'].forEach(id => $(id).value = '');
            $('sc_jumlah').value = 1;
            $('sc_tgl').value = hariIniISO();
            $('sc_paraf').value = PARAF_IYA;
            setStatus('Menunggu scan...');
            fokusScanner();
        }
        $('sc_reset').addEventListener('click', bersihkanForm);

        // ---------- Simpan ----------
        function simpan() {
            const noBuku = $('sc_nobuku').value.trim();
            const judul = $('sc_judul').value.trim();
            const nama = $('sc_nama').value.trim();
            const kelas = $('sc_kelas').value.trim() || '-';
            const jumlah = parseInt($('sc_jumlah').value, 10) || 1;
            const catatan = $('sc_catatan').value.trim() || '-';
            const tglPinjam = $('sc_tgl').value || hariIniISO();

            if (!noBuku) { alert('Scan barcode buku terlebih dahulu!'); fokusScanner(); return; }
            if (!judul) { alert('Judul buku belum terisi!'); $('sc_judul').focus(); return; }
            if (!nama) { alert('Nama peminjam wajib diisi!'); $('sc_nama').focus(); return; }

            // Struktur data SAMA dengan modul lama, jadi tabel & export lama tetap jalan
            const transaksi = {
                nama, kelas, judul, jumlah, tglPinjam,
                parafPinjam: PARAF_IYA,
                tglKembali: '-', parafKembali: '-',
                noBuku, catatan
            };
            daftarPeminjaman.push(transaksi);
            try { localStorage.setItem('daftarPeminjaman', JSON.stringify(daftarPeminjaman)); } catch (_) {}

            currentPinjamPage = 1;
            renderPeminjamanTable();
            renderBelumKembali();
            tampilkanDetail(transaksi);
            bersihkanForm();
        }
        $('sc_simpan').addEventListener('click', simpan);

        // ---------- Detail transaksi ----------
        function tampilkanDetail(t) {
            const item = (label, val) =>
                `<div><dt class="text-[11px] uppercase font-bold text-emerald-700">${label}</dt><dd class="font-semibold text-slate-800">${esc(val)}</dd></div>`;
            $('sc_detail_body').innerHTML =
                item('Nomor Buku (Barcode)', t.noBuku) +
                item('Judul Buku', t.judul) +
                item('Tanggal Peminjaman', formatTanggalIndo(t.tglPinjam)) +
                item('Paraf Pinjam', t.parafPinjam) +
                item('Jumlah Pinjam', t.jumlah) +
                item('Kelas Peminjam', t.kelas) +
                item('Nama Peminjam', t.nama) +
                item('Catatan', t.catatan);
            $('sc_detail').classList.remove('hidden');
        }

        // ---------- Pengembalian ----------
        function renderBelumKembali() {
            const body = $('sc_open_body');
            const rows = [];
            daftarPeminjaman.forEach((p, i) => {
                if (p.tglKembali !== '-') return;
                rows.push(`
                    <tr class="border-b">
                        <td class="p-2 font-mono">${esc(p.noBuku || '-')}</td>
                        <td class="p-2">${esc(p.judul)}</td>
                        <td class="p-2">${esc(p.nama)}</td>
                        <td class="p-2">${esc(p.kelas)}</td>
                        <td class="p-2">${esc(p.jumlah)}</td>
                        <td class="p-2">${formatTanggalIndo(p.tglPinjam)}</td>
                        <td class="p-2"><input type="date" data-idx="${i}" class="sc-tgl-kembali border rounded-lg px-2 py-1"></td>
                        <td class="p-2 text-slate-400">-</td>
                    </tr>`);
            });
            body.innerHTML = rows.length ? rows.join('')
                : `<tr><td colspan="8" class="p-4 text-center text-slate-400">Tidak ada buku yang sedang dipinjam.</td></tr>`;
        }

        $('sc_open_body').addEventListener('change', (e) => {
            if (!e.target.classList.contains('sc-tgl-kembali')) return;
            const idx = parseInt(e.target.dataset.idx, 10);
            const tgl = e.target.value;
            if (!tgl || !daftarPeminjaman[idx]) return;

            daftarPeminjaman[idx].tglKembali = tgl;
            daftarPeminjaman[idx].parafKembali = PARAF_IYA; // otomatis
            try { localStorage.setItem('daftarPeminjaman', JSON.stringify(daftarPeminjaman)); } catch (_) {}

            renderPeminjamanTable();
            renderBelumKembali();
            fokusScanner();
        });

        // Jaga fokus scanner saat panel scan aktif & klik area kosong
        panel.addEventListener('click', (e) => {
            if (!/^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/.test(e.target.tagName)) fokusScanner();
        });

        // Segarkan daftar "belum kembali" saat menu Peminjaman dibuka
        const menuPinjam = $('menu-btn-peminjaman');
        if (menuPinjam) menuPinjam.addEventListener('click', () => {
            if (!panel.classList.contains('hidden')) { renderBelumKembali(); fokusScanner(); }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
