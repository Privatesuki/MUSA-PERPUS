/* =====================================================================
   MUSA PERPUS - MODE SCAN BARCODE (versi Supabase)
   Dipasang SETELAH script.js dan fitur-baru.js.

   ALUR SCAN (mode scan = tampilan utama, mode manual = pilihan kedua):
     - Kode 3-10 digit angka -> NIS/NISN kartu pelajar -> kolom Nama & Kelas terisi.
         NIS belum ada di database? Muncul kotak kecil: ketik nama + pilih kelas,
         langsung tersimpan ke database (tabel siswa) dan terisi di form.
     - Kode 11 digit ke atas -> barcode buku (mis. ISBN 13 digit) -> kolom No Buku & Judul terisi.
         Barcode belum dikenal? Muncul kotak minta judul buku; dingat di browser ini.
     - Kode 1-2 digit        -> dianggap salah baca, diminta scan ulang.
     - Kode bukan angka murni (mis. INV/0001/2020/1) -> dicek sebagai nomor inventaris buku.

   Butuh: fungsi database tambah_siswa() & cari_siswa() (supabase-lengkap.sql).
   KAMERA HP: tombol "Scan dengan Kamera" (butuh fitur-baru.js + HTTPS).
   ===================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const kunci = (s) => String(s == null ? '' : s).replace(/[^a-z0-9]/gi, '').toLowerCase();
    const POLA_NIS = /^\d{3,10}$/;       // 3-10 digit = kartu pelajar (NIS/NISN)
    const POLA_PENDEK = /^\d{1,2}$/;     // 1-2 digit  = salah baca
                                         // selain itu (11+ digit / ada huruf, mis. INV/0001/2020/1) = barcode buku

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
                <button id="pm-mode-scan" type="button"><i class="fa-solid fa-barcode"></i> Mode Scan Barcode</button>
                <button id="pm-mode-manual" type="button"><i class="fa-solid fa-keyboard"></i> Mode Manual</button>
            </div>
            <div id="scan-card" class="glass p-5 sm:p-6">
                <label class="lbl" for="scan-input">Scan barcode (kursor otomatis di sini)</label>
                <input id="scan-input" class="field font-mono !text-base !border-2 !border-emerald-500 !bg-emerald-50" autocomplete="off" inputmode="none" placeholder="Scan kartu pelajar (NIS) atau barcode buku…">
                <p id="scan-status" class="text-xs mt-2 text-slate-500">Menunggu scan…</p>
                <div class="grid sm:grid-cols-2 gap-2 mt-3 text-[11px] text-slate-600">
                    <div class="rounded-xl bg-emerald-50 border border-emerald-900/10 px-3 py-2"><b class="text-emerald-800"><i class="fa-solid fa-id-card"></i> 3–10 digit</b> = kartu pelajar (NIS/NISN) → <b>Nama &amp; Kelas</b> terisi otomatis</div>
                    <div class="rounded-xl bg-emerald-50 border border-emerald-900/10 px-3 py-2"><b class="text-emerald-800"><i class="fa-solid fa-book"></i> 11 digit ke atas</b> = barcode buku → <b>No Buku &amp; Judul</b> terisi otomatis</div>
                </div>
                <div class="flex flex-wrap items-center gap-3 mt-3">
                    <button id="scan-kamera" type="button" class="btn btn-primary btn-sm"><i class="fa-solid fa-camera"></i> Scan dengan Kamera</button>
                    <span class="text-[11px] text-slate-500">Scan kartu pelajar dulu, lalu scan buku, lalu simpan.</span>
                </div>
                <button id="scan-salin" type="button" class="text-xs font-semibold text-emerald-700 hover:underline mt-2 hidden"><i class="fa-regular fa-copy"></i> Salin <span id="scan-n">0</span> barcode tambahan (untuk ditempel ke kamusBukuManual)</button>
            </div>`;
        card.parentNode.insertBefore(wrap, card);

        // ---------- Kotak input judul untuk barcode buku baru ----------
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

        // ---------- Kotak tambah siswa baru (NIS belum terdaftar) ----------
        const modalSw = document.createElement('div');
        modalSw.id = 'sw-modal'; modalSw.className = 'modal-wrap'; modalSw.style.zIndex = '130';
        modalSw.innerHTML = `
            <div class="modal-card glass max-w-md p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-11 h-11 shrink-0 rounded-full bg-sky-100 text-sky-600 grid place-items-center text-lg"><i class="fa-solid fa-id-card"></i></div>
                    <div>
                        <h3 class="text-lg font-extrabold text-emerald-950 leading-tight">Siswa belum terdaftar</h3>
                        <p class="text-xs text-slate-500">Isi sekali, langsung tersimpan. Scan kartu berikutnya otomatis dikenali.</p>
                    </div>
                </div>
                <div class="rounded-xl bg-emerald-50 border border-emerald-900/10 px-3 py-2 mb-4">
                    <div class="text-[11px] text-slate-500">NIS (dari kartu pelajar)</div>
                    <div id="sw-nis" class="font-mono font-bold text-emerald-900 break-all"></div>
                </div>
                <div class="space-y-4">
                    <div><label class="lbl" for="sw-nama">Nama siswa <span class="text-rose-500">*</span></label>
                        <input id="sw-nama" class="field" maxlength="100" autocomplete="off" placeholder="Ketik nama lengkap"></div>
                    <div class="relative"><label class="lbl" for="sw-kelas">Kelas <span class="text-rose-500">*</span></label>
                        <input id="sw-kelas" class="field" maxlength="60" autocomplete="off" role="combobox" aria-expanded="false" placeholder="Ketik: X, XI, XII atau jurusan…">
                        <div id="sw-kelas-list" class="cb-list hidden" role="listbox"></div></div>
                </div>
                <p id="sw-error" class="text-xs text-rose-600 mt-3 hidden"></p>
                <div class="flex justify-end gap-3 mt-5">
                    <button id="sw-batal" type="button" class="btn btn-ghost">Batal</button>
                    <button id="sw-simpan" type="button" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan &amp; Pakai</button>
                </div>
            </div>`;
        document.body.appendChild(modalSw);
        if (typeof initKelasCombobox === 'function') initKelasCombobox('sw-kelas', 'sw-kelas-list');

        const inp = $('scan-input'), scanCard = $('scan-card'), bM = $('pm-mode-manual'), bS = $('pm-mode-scan');
        const modeScan = () => !scanCard.classList.contains('hidden');
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
        setMode(true);                                          // scan = tampilan utama

        // Kembali ke halaman Peminjaman -> kursor otomatis siap menerima scanner
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-nav="peminjaman"]') && modeScan()) setTimeout(fokus, 250);
        });
        window.addEventListener('hashchange', () => { if (location.hash === '#peminjaman' && modeScan()) setTimeout(fokus, 250); });

        // Isi form peminjaman dari hasil scan buku (tanggal = hari ini, instan)
        function isiForm(kode, judul, pesanAwal) {
            $('pm-nobuku').value = kode;
            $('pm-tgl').value = todayDMY();
            $('pm-judul').value = judul;
            const pinjam = state.pm.find(p => !sudahKembali(p) && kunci(p.no_buku) === kunci(kode));
            if (pinjam) status(`${pesanAwal}${judul} — perhatian: masih tercatat dipinjam ${namaTampil(pinjam.nama)}`, 'warn');
            else status(`${pesanAwal}${judul}`, 'ok');
            if ($('pm-nama').value.trim() && $('pm-kelas').value.trim()) $('pm-submit').focus();   // nama dari kartu sudah ada -> tinggal simpan
            else $('pm-nama').focus();
        }

        // ---------- Alur barcode buku baru ----------
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

        // ---------- Kartu pelajar: NIS -> nama & kelas ----------
        // Hasil: { siswa } bila ketemu, { siswa: null } bila belum ada, { gagal } bila pencarian error
        async function cariSiswa(nis) {
            try {
                const { data, error } = await sb.rpc('cari_siswa', { p_nis: nis });
                if (error) return { gagal: error };
                return { siswa: (data && data[0]) || null };
            } catch (e) { return { gagal: e }; }
        }
        function isiSiswa(nama, kelas, pesanAwal) {
            $('pm-nama').value = nama;
            $('pm-kelas').value = String(kelas || '').toUpperCase();
            $('pm-tgl').value = todayDMY();
            status(`${pesanAwal}${nama}${kelas ? ' (' + String(kelas).toUpperCase() + ')' : ''} — sekarang scan barcode buku.`, 'ok');
            fokus();
        }

        // ---------- Alur siswa baru ----------
        let nisBaru = '', swSimpan = false;
        function mintaSiswa(nis) {
            nisBaru = nis; swSimpan = false;
            $('sw-nis').textContent = nis;
            $('sw-nama').value = ''; $('sw-kelas').value = '';
            $('sw-error').classList.add('hidden');
            status(`NIS "${nis}" belum terdaftar — isi nama & kelas pada kotak yang muncul.`, 'warn');
            openModal('sw-modal');
            setTimeout(() => $('sw-nama').focus(), 80);
        }
        const swGalat = (m, fokusId) => {
            $('sw-error').textContent = m;
            $('sw-error').classList.remove('hidden');
            if (fokusId) $(fokusId).focus();
        };
        async function simpanSiswa() {
            const nama = $('sw-nama').value.trim().replace(/\s+/g, ' ');
            const kelas = $('sw-kelas').value.trim().toUpperCase().replace(/\s+/g, ' ');
            if (!nama) return swGalat('Nama siswa wajib diisi.', 'sw-nama');
            if (!kelas) return swGalat('Kelas wajib dipilih atau diketik.', 'sw-kelas');
            const btn = $('sw-simpan'); btn.disabled = true;
            const { data, error } = await sb.rpc('tambah_siswa', { p_nis: nisBaru, p_nama: nama, p_kelas: kelas });
            btn.disabled = false;
            if (error) {
                const hilang = /tambah_siswa|schema cache|does not exist/i.test(error.message || '');
                return swGalat('Gagal menyimpan: ' + (hilang
                    ? 'fungsi tambah_siswa belum ada di database. Jalankan supabase-lengkap.sql terbaru di SQL Editor.'
                    : (error.message || 'terjadi kesalahan')));
            }
            swSimpan = true;
            closeModal('sw-modal');
            if (data === false) {                              // NIS ternyata sudah terdaftar (mis. baru ditambah perangkat lain) -> pakai data yang ada
                toast('NIS sudah terdaftar, data yang ada dipakai', 'info');
                return prosesSiswa(nisBaru);
            }
            toast(`Siswa baru tersimpan: ${nama}`, 'ok');
            document.dispatchEvent(new Event('siswa:changed'));   // daftar di halaman Data Siswa (admin) ikut diperbarui
            isiSiswa(nama, kelas, 'Siswa baru: ');
        }
        $('sw-simpan').addEventListener('click', simpanSiswa);
        $('sw-batal').addEventListener('click', () => closeModal('sw-modal'));
        $('sw-nama').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('sw-kelas').focus(); } });
        $('sw-kelas').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); simpanSiswa(); } });
        $('sw-nama').addEventListener('input', () => $('sw-error').classList.add('hidden'));
        // Ditutup tanpa menyimpan -> tidak ada yang tersimpan, form diisi manual
        new MutationObserver(() => {
            if (modalSw.classList.contains('open') || swSimpan) return;
            status(`NIS "${nisBaru}" tidak disimpan. Isi Nama & Kelas secara manual, atau scan ulang kartunya.`, 'warn');
            $('pm-nama').focus();
        }).observe(modalSw, { attributes: true, attributeFilter: ['class'] });

        // ---------- Pemilah kode: NIS vs buku ----------
        async function prosesSiswa(nis) {
            status('Memeriksa kartu siswa…');
            const r = await cariSiswa(nis);
            if (r.gagal) {
                status('Data siswa tidak bisa diperiksa (cek internet / jalankan supabase-lengkap.sql). Isi Nama & Kelas manual.', 'warn');
                return $('pm-nama').focus();
            }
            if (r.siswa) return isiSiswa(r.siswa.nama, r.siswa.kelas, 'Kartu siswa: ');
            mintaSiswa(nis);                                   // belum ada -> daftarkan lewat web
        }
        function prosesBuku(kode) {
            $('pm-tgl').value = todayDMY();
            const buku = cariBuku(kode);
            if (buku) return isiForm(kode, buku.judul, 'Ditemukan: ');
            $('pm-nobuku').value = kode;
            mintaJudul(kode);                                  // bukan buku yang dikenal -> daftarkan judulnya
        }
        // Satu pintu untuk scanner USB maupun kamera
        async function proses(kodeMentah) {
            const kode = String(kodeMentah == null ? '' : kodeMentah).trim();
            if (!kode) return;
            const ringkas = kode.replace(/\s+/g, '');
            if (POLA_PENDEK.test(ringkas)) {
                status(`Kode "${kode}" terlalu pendek — scan ulang kartu pelajar (3–10 digit) atau barcode buku (11 digit ke atas).`, 'warn');
                return fokus();
            }
            if (POLA_NIS.test(ringkas)) return prosesSiswa(ringkas);
            return prosesBuku(kode);
        }
        window.MusaScan = { proses };

        inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const kode = inp.value.trim();
            inp.value = '';
            if (kode) proses(kode);
        });
        $('scan-kamera').addEventListener('click', () => {
            if (window.MusaKamera) window.MusaKamera.buka(proses);
            else toast('Fitur kamera belum dimuat (cek fitur-baru.js)', 'err');
        });

        // Enter di kolom isian = simpan (alur cepat saat scan)
        ['pm-nama', 'pm-jumlah', 'pm-catatan'].forEach(id => $(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && modeScan()) { e.preventDefault(); $('pm-submit').click(); }
        }));
        // Setelah tersimpan -> siap scan berikutnya
        document.addEventListener('pm:saved', () => {
            if (!modeScan()) return;
            $('pm-tgl').value = todayDMY();
            status('Menunggu scan…');
            fokus();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
