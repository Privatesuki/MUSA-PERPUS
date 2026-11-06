/* =====================================================================
   abaikan-sheet-induk.js  -  add-on MUSA PERPUS
   Tujuan : saat Import Excel, sheet induk ("DATA SEMUA KOLEKSI BUKU" dan "ALL BOOK")
            tetap boleh ada di file Excel, tetapi TIDAK ikut dihitung.
            Yang dihitung hanya sheet mata pelajaran / kategori.
   Cara   : file ini hanya MENAMBAH perilaku. Kode di script.js tidak diubah/dihapus.
            Pasang di index.html, setelah script.js:
                <script src="script.js"></script>
                <script src="abaikan-sheet-induk.js"></script>
   Tambah/ubah nama sheet induk lewat daftar SHEET_INDUK di bawah.
   ===================================================================== */
(function () {
    'use strict';

    const SHEET_INDUK = ['DATA SEMUA KOLEKSI BUKU', 'ALL BOOK'];
    const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
    const induk = new Set(SHEET_INDUK.map(norm));

    // hitungStatistik() selalu dipanggil script.js setelah import selesai membaca semua sheet,
    // sebelum tabel/statistik digambar. Kita bungkus: buang dulu buku milik sheet induk, lalu jalankan aslinya.
    const hitungStatistikAsli = window.hitungStatistik;
    if (typeof hitungStatistikAsli !== 'function') return;

    window.hitungStatistik = function () {
        try {
            if (Array.isArray(daftarBuku)) {
                for (let i = daftarBuku.length - 1; i >= 0; i--) {
                    const sh = daftarBuku[i] && daftarBuku[i].sheetName;   // buku input manual tidak punya sheetName -> aman
                    if (sh && induk.has(norm(sh))) daftarBuku.splice(i, 1);
                }

                // rapikan daftar kategori supaya nama sheet induk tidak muncul di filter
                const dipakai = new Set(daftarBuku.map((b) => b.kategori));
                if (Array.isArray(kategoriPilihan)) {
                    kategoriPilihan = kategoriPilihan.filter((k) => dipakai.has(k));
                }
                if (typeof mapSheetKeKategori === 'object' && mapSheetKeKategori) {
                    Object.keys(mapSheetKeKategori).forEach((sh) => { if (induk.has(norm(sh))) delete mapSheetKeKategori[sh]; });
                }
                if (typeof kategoriFilter !== 'undefined' && kategoriFilter) {
                    const pilihan = kategoriFilter.value;
                    kategoriFilter.innerHTML = '<option value="">Semua Kategori</option>';
                    kategoriPilihan.forEach((k) => { kategoriFilter.innerHTML += `<option value="${k}">${k}</option>`; });
                    kategoriFilter.value = dipakai.has(pilihan) ? pilihan : '';
                }
                if (typeof updateDropdownSheetModal === 'function') updateDropdownSheetModal();
                try { localStorage.setItem('daftarBuku', JSON.stringify(daftarBuku)); } catch (e) { /* abaikan */ }
            }
        } catch (err) {
            console.error('abaikan-sheet-induk:', err);   // jika gagal, perilaku lama tetap jalan
        }
        return hitungStatistikAsli.apply(this, arguments);
    };
})();
