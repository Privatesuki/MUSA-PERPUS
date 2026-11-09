/* =====================================================================
   MUSA PERPUS - MODE SCAN BARCODE (versi Supabase)
   Dipasang SETELAH script.js. Memakai form peminjaman yang sama,
   jadi data tersimpan ke database dan ikut tampil di tabel/dasbor.

   FITUR PINTAR: barcode yang belum ada di kamus maupun inventaris
   -> muncul kotak "Barcode belum terdaftar" meminta judul buku.
   Judul itu langsung masuk ke kamus aktif, mengisi form peminjaman,
   dan diingat di browser ini (localStorage) sehingga scan berikutnya
   otomatis dikenali tanpa mengubah file kodingan.
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
    "9786024454166": "PRODUK KREATIF KEWIRAUSAHAAN XI (2018)",
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
    "9786235223346": "DASAR AKL VOLUME 2 X",
    "9786231800125": "DASAR AKL VOLUME 1 X",
    };
    const kamus = new Map(Object.entries(kamusBukuManual).map(([k, v]) => [kunci(k), v]));

    // ---------- Barcode tambahan hasil input lewat layar (disimpan di browser ini) ----------
    const KEY_TAMBAHAN = 'musa_kamus_buku_tambahan';
    const tambahan = {};                                  // { "kode asli": "JUDUL" }
    (function muatTambahan() {
        try {
            const t = JSON.parse(localStorage.getItem(KEY_TAMBAHAN) || '{}');
            Object.entries(t).forEach(([k, v]) => {
                if (!kamus.has(kunci(k)) && typeof v === 'string' && v.trim()) { tambahan[k] = v; kamus.set(kunci(k), v); }
            });
        } catch (_) { /* localStorage tidak tersedia -> tetap jalan di memori */ }
    })();
    function simpanTambahan() {
        try { localStorage.setItem(KEY_TAMBAHAN, JSON.stringify(tambahan)); } catch (_) {}
    }
    function daftarkanBarcode(kode, judul) {              // masuk ke kamus aktif + diingat
        kamusBukuManual[kode] = judul;                    // objek kamus aktif ikut diperbarui
        kamus.set(kunci(kode), judul);
        tambahan[kode] = judul;
        simpanTambahan();
    }

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
                <button id="scan-salin" type="button" class="text-xs font-semibold text-emerald-700 hover:underline mt-2 hidden"><i class="fa-regular fa-copy"></i> Salin <span id="scan-n">0</span> barcode tambahan (untuk ditempel ke kamusBukuManual)</button>
            </div>`;
        card.parentNode.insertBefore(wrap, card);

        // ---------- Kotak input judul untuk barcode baru ----------
        const modal = document.createElement('div');
        modal.id = 'bk-modal'; modal.className = 'modal-wrap'; modal.style.zIndex = '130';
        modal.innerHTML = `
            <div class="modal-card glass max-w-md p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-11 h-11 shrink-0 rounded-full bg-amber-100 text-amber-600 grid place-items-center text-lg"><i class="fa-solid fa-barcode"></i></div>
                    <div>
                        <h3 class="text-lg font-extrabold text-emerald-950 leading-tight">Barcode belum terdaftar</h3>
                        <p class="text-xs text-slate-500">Daftarkan sekali, scan berikutnya otomatis dikenali.</p>
                    </div>
                </div>
                <div class="rounded-xl bg-emerald-50 border border-emerald-900/10 px-3 py-2 mb-4">
                    <div class="text-[11px] text-slate-500">Kode barcode</div>
                    <div id="bk-kode" class="font-mono font-bold text-emerald-900 break-all"></div>
                </div>
                <label class="lbl" for="bk-judul">Judul buku <span class="text-rose-500">*</span></label>
                <input id="bk-judul" list="dl-judul" class="field" maxlength="250" autocomplete="off" placeholder="Ketik judul buku untuk barcode ini">
                <p id="bk-error" class="text-xs text-rose-600 mt-2 hidden"></p>
                <div class="flex justify-end gap-3 mt-5">
                    <button id="bk-batal" type="button" class="btn btn-ghost">Batal</button>
                    <button id="bk-simpan" type="button" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan &amp; Pakai</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const inp = $('scan-input'), scanCard = $('scan-card'), bM = $('pm-mode-manual'), bS = $('pm-mode-scan');
        const fokus = () => setTimeout(() => inp.focus(), 60);
        const status = (msg, tipe) => {
            const el = $('scan-status');
            el.textContent = msg;
            el.className = 'text-xs mt-2 ' + (tipe === 'ok' ? 'text-emerald-700 font-semibold' : tipe === 'warn' ? 'text-amber-600 font-semibold' : 'text-slate-500');
        };
        const segarkanSalin = () => {
            const n = Object.keys(tambahan).length;
            $('scan-n').textContent = n;
            $('scan-salin').classList.toggle('hidden', n === 0);
        };
        segarkanSalin();

        function setMode(scan) {
            scanCard.classList.toggle('hidden', !scan);
            bM.className = 'btn btn-sm ' + (scan ? 'btn-ghost !border-transparent' : 'btn-primary');
            bS.className = 'btn btn-sm ' + (scan ? 'btn-primary' : 'btn-ghost !border-transparent');
            if (scan) { $('pm-tgl').value = todayDMY(); fokus(); }
        }
        bM.addEventListener('click', () => setMode(false));
        bS.addEventListener('click', () => setMode(true));
        setMode(false);

        // Isi form peminjaman dari hasil scan (tanggal = hari ini, instan)
        function isiForm(kode, judul, pesanAwal) {
            $('pm-nobuku').value = kode;
            $('pm-tgl').value = todayDMY();
            $('pm-judul').value = judul;
            const pinjam = state.pm.find(p => !sudahKembali(p) && kunci(p.no_buku) === kunci(kode));
            if (pinjam) status(`${pesanAwal}${judul} — perhatian: masih tercatat dipinjam ${namaTampil(pinjam.nama)}`, 'warn');
            else status(`${pesanAwal}${judul}`, 'ok');
            $('pm-nama').focus();
        }

        // ---------- Alur barcode baru ----------
        let kodeBaru = '', tersimpan = false;
        function mintaJudul(kode) {
            kodeBaru = kode; tersimpan = false;
            $('bk-kode').textContent = kode;
            $('bk-judul').value = '';
            $('bk-error').classList.add('hidden');
            status(`Barcode "${kode}" belum terdaftar — isi judul buku pada kotak yang muncul.`, 'warn');
            openModal('bk-modal');
            setTimeout(() => $('bk-judul').focus(), 80);
        }
        function simpanJudul() {
            const judul = $('bk-judul').value.trim().replace(/\s+/g, ' ').toUpperCase();
            if (!judul) {
                $('bk-error').textContent = 'Judul buku wajib diisi.';
                $('bk-error').classList.remove('hidden');
                return $('bk-judul').focus();
            }
            daftarkanBarcode(kodeBaru, judul);
            tersimpan = true;
            closeModal('bk-modal');
            segarkanSalin();
            isiForm(kodeBaru, judul, 'Barcode baru didaftarkan: ');
            toast('Barcode baru tersimpan: ' + judul, 'ok');
        }
        $('bk-simpan').addEventListener('click', simpanJudul);
        $('bk-batal').addEventListener('click', () => closeModal('bk-modal'));
        $('bk-judul').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); simpanJudul(); } });
        $('bk-judul').addEventListener('input', () => $('bk-error').classList.add('hidden'));
        // Ditutup dengan cara apa pun tanpa menyimpan (Batal / Esc / klik luar) -> siap scan lagi
        new MutationObserver(() => {
            if (modal.classList.contains('open') || tersimpan) return;
            $('pm-nobuku').value = kodeBaru;                  // kode tetap tercatat; judul bisa diisi manual
            $('pm-judul').value = '';
            status(`Barcode "${kodeBaru}" belum terdaftar. Pilih/ketik judul secara manual.`, 'warn');
            $('pm-judul').focus();
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });

        $('scan-salin').addEventListener('click', async () => {
            const teks = Object.entries(tambahan).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
            try { await navigator.clipboard.writeText(teks); toast('Daftar barcode tambahan disalin', 'ok'); }
            catch (_) { window.prompt('Salin teks ini lalu tempel ke kamusBukuManual:', teks); }
        });

        inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const kode = inp.value.trim();
            inp.value = '';
            if (!kode) return;
            $('pm-nobuku').value = kode;
            $('pm-tgl').value = todayDMY();
            const buku = cariBuku(kode);
            if (!buku) return mintaJudul(kode);               // BARU: tanya judul, bukan sekadar peringatan
            isiForm(kode, buku.judul, 'Ditemukan: ');
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
