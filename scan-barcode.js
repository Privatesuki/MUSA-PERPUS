/* =====================================================================
   MUSA PERPUS - MODE SCAN BARCODE (versi Supabase)
   Dipasang SETELAH script.js. Memakai form peminjaman yang sama,
   jadi data tersimpan ke database dan ikut tampil di tabel/dasbor.
   ===================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const kunci = (s) => String(s == null ? '' : s).replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Tambah barcode lain di sini:  "NOMOR_BARCODE": "JUDUL BUKU",
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
    "9786232666832": "BAHASA INDONESIA X",
    "9786231800497": "PKN XI",
    "9786238680153": "BAHASA ARAB XI",
    "9786233289900": "BISNIS DIGITAL XI",
    "9786238680023": "AL ISLAM XII",
    "9786238680016": "AL ISLAM XI",
    "9786235223094": "BAHASA INDONESIA XI (NEW COVER)",
    "9786232666924": "BAHASA INDONESIA XI (OLD COVER)",
    "9786238680160": "BAHASA ARAB XII",
    "9786238680023": "BAHASA ARAB XII",
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
    };
    const kamus = new Map(Object.entries(kamusBukuManual).map(([k, v]) => [kunci(k), v]));

    function cariBuku(kode) {
        const k = kunci(kode);
        if (!k) return null;
        if (kamus.has(k)) return { judul: kamus.get(k) };
        const it = state.inv.find(i => kunci(i.no_inventaris) === k);   // barcode = nomor inventaris
        return it ? { judul: it.nama } : null;
    }

    function init() {
        const card = $('pm-form-card');
        if (!card) return;
        const wrap = document.createElement('div');
        wrap.className = 'space-y-4';
        wrap.innerHTML = `
            <div class="inline-flex p-1 gap-1 rounded-2xl bg-white/70 border border-emerald-900/10">
                <button id="pm-mode-manual" type="button"><i class="fa-solid fa-keyboard"></i> Mode Manual</button>
                <button id="pm-mode-scan" type="button"><i class="fa-solid fa-barcode"></i> Mode Scan Barcode</button>
            </div>
            <div id="scan-card" class="glass p-5 sm:p-6 hidden">
                <label class="lbl" for="scan-input">Scan barcode buku (kursor otomatis di sini)</label>
                <input id="scan-input" class="field font-mono !text-base !border-2 !border-emerald-500 !bg-emerald-50" autocomplete="off" inputmode="none" placeholder="Arahkan scanner ke barcode lalu tembak…">
                <p id="scan-status" class="text-xs mt-2 text-slate-500">Menunggu scan…</p>
            </div>`;
        card.parentNode.insertBefore(wrap, card);

        const inp = $('scan-input'), scanCard = $('scan-card'), bM = $('pm-mode-manual'), bS = $('pm-mode-scan');
        const fokus = () => setTimeout(() => inp.focus(), 60);
        const status = (msg, tipe) => {
            const el = $('scan-status');
            el.textContent = msg;
            el.className = 'text-xs mt-2 ' + (tipe === 'ok' ? 'text-emerald-700 font-semibold' : tipe === 'warn' ? 'text-amber-600 font-semibold' : 'text-slate-500');
        };
        function setMode(scan) {
            scanCard.classList.toggle('hidden', !scan);
            bM.className = 'btn btn-sm ' + (scan ? 'btn-ghost !border-transparent' : 'btn-primary');
            bS.className = 'btn btn-sm ' + (scan ? 'btn-primary' : 'btn-ghost !border-transparent');
            if (scan) { $('pm-tgl').value = todayDMY(); fokus(); }
        }
        bM.addEventListener('click', () => setMode(false));
        bS.addEventListener('click', () => setMode(true));
        setMode(false);

        inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const kode = inp.value.trim();
            inp.value = '';
            if (!kode) return;
            $('pm-nobuku').value = kode;
            $('pm-tgl').value = todayDMY();
            const buku = cariBuku(kode);
            if (!buku) {
                $('pm-judul').value = '';
                status(`Barcode "${kode}" belum ada di daftar buku. Pilih/ketik judul secara manual.`, 'warn');
                return $('pm-judul').focus();
            }
            $('pm-judul').value = buku.judul;
            const pinjam = state.pm.find(p => !sudahKembali(p) && kunci(p.no_buku) === kunci(kode));
            if (pinjam) status(`Ditemukan: ${buku.judul} — perhatian: masih tercatat dipinjam ${namaTampil(pinjam.nama)}`, 'warn');
            else status(`Ditemukan: ${buku.judul}`, 'ok');
            $('pm-nama').focus();
        });

        // Enter di kolom isian = simpan (alur cepat saat scan)
        ['pm-nama', 'pm-jumlah', 'pm-catatan'].forEach(id => $(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !scanCard.classList.contains('hidden')) { e.preventDefault(); $('pm-submit').click(); }
        }));
        // Setelah tersimpan -> siap scan buku berikutnya
        document.addEventListener('pm:saved', () => {
            if (scanCard.classList.contains('hidden')) return;
            $('pm-tgl').value = todayDMY();
            status('Menunggu scan…');
            fokus();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
