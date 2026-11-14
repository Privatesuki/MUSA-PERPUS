/* =====================================================================
   MUSA PERPUS - FITUR BARU  (dipasang SETELAH script.js)
   1. Dark mode mulus            4. Usulan buku: Suka + komentar
   2. Menu titik tiga (HP/iPad)  5. Data siswa (NIS -> nama & kelas)
   3. Scan kamera HP             6. Buku populer + rating + ulasan
   Butuh tabel/fungsi dari supabase-fitur-baru.sql
   ===================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const norm = (j) => String(j || '').trim().replace(/\s+/g, ' ').toUpperCase();

    /* ---------- Identitas perangkat (rahasia, tidak pernah ditampilkan) & profil ---------- */
    const DEV = (() => {
        try {
            let d = localStorage.getItem('musa_device');
            if (!d || d.length < 16) {
                d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                    : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                localStorage.setItem('musa_device', d);
            }
            return d;
        } catch (_) { return 'tmp' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    })();
    const profil = {
        get() { try { return JSON.parse(localStorage.getItem('musa_profil') || '{}'); } catch (_) { return {}; } },
        set(o) { try { localStorage.setItem('musa_profil', JSON.stringify(o)); } catch (_) {} }
    };

    /* =================================================================
       1. DARK MODE
       ================================================================= */
    const root = document.documentElement;
    const temaSekarang = () => root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    function terapkanTema(t, animasi) {
        if (animasi) { root.classList.add('tema-anim'); setTimeout(() => root.classList.remove('tema-anim'), 450); }
        root.setAttribute('data-theme', t);
        const ic = $('themeBtn') && $('themeBtn').querySelector('i');
        if (ic) ic.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        const m = $('metaTema'); if (m) m.setAttribute('content', t === 'dark' ? '#0a120e' : '#f3f8f4');
    }
    terapkanTema(temaSekarang(), false);
    $('themeBtn').addEventListener('click', () => {
        const t = temaSekarang() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('musa_tema', t); } catch (_) {}
        terapkanTema(t, true);
    });
    try {   // ikuti pengaturan sistem selama pengguna belum memilih sendiri
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('musa_tema')) terapkanTema(e.matches ? 'dark' : 'light', true);
        });
    } catch (_) {}

    /* =================================================================
       2. MENU TITIK TIGA (HP/iPad)
       ================================================================= */
    const menu = $('mobileMenu'), menuBtn = $('menuBtn');
    function tutupMenu() {
        menu.classList.add('hidden'); menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.querySelector('i').className = 'fa-solid fa-ellipsis-vertical';
    }
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const buka = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !buka); menuBtn.setAttribute('aria-expanded', String(buka));
        menuBtn.querySelector('i').className = buka ? 'fa-solid fa-xmark' : 'fa-solid fa-ellipsis-vertical';
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('[data-nav]')) tutupMenu(); });
    document.addEventListener('click', (e) => { if (!menu.classList.contains('hidden') && !e.target.closest('#mobileMenu, #menuBtn')) tutupMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutupMenu(); });
    window.addEventListener('resize', () => { if (innerWidth >= 1024) tutupMenu(); });

    /* =================================================================
       3. KAMERA SCAN (BarcodeDetector bila ada, cadangan: ZXing)
       ================================================================= */
    const Kamera = (() => {
        let stream = null, timer = null, zx = null, aktif = false, cb = null, zxMuat = null;
        const status = (t) => { const e = $('camStatus'); if (e) e.textContent = t; };
        function muatZXing() {
            if (window.ZXing) return Promise.resolve();
            if (!zxMuat) zxMuat = new Promise((ok, gagal) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
                s.onload = ok; s.onerror = () => gagal(new Error('Gagal memuat pemindai cadangan (cek internet).'));
                document.head.appendChild(s);
            });
            return zxMuat;
        }
        function stop() {
            aktif = false; clearInterval(timer); timer = null;
            if (zx) { try { zx.reset(); } catch (_) {} zx = null; }
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
            const v = $('camVideo'); if (v) v.srcObject = null;
        }
        function selesai(kode) {
            if (!aktif || !kode) return;
            if (navigator.vibrate) navigator.vibrate(60);
            const f = cb; stop(); closeModal('camModal');
            if (f) f(String(kode).trim());
        }
        async function buka(callback) {
            cb = callback;
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return toast('Kamera hanya bisa dipakai lewat alamat HTTPS dan browser yang mendukung.', 'err', 5000);
            }
            openModal('camModal'); status('Membuka kamera…'); aktif = true;
            const v = $('camVideo');
            const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
            try {
                let detektor = null;
                if ('BarcodeDetector' in window) {
                    const dukung = await BarcodeDetector.getSupportedFormats();
                    const mau = ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code'];
                    const formats = mau.filter(f => dukung.includes(f));
                    if (formats.length) detektor = new BarcodeDetector({ formats });
                }
                if (detektor) {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (!aktif) return stop();
                    v.srcObject = stream; await v.play();
                    status('Arahkan kamera ke barcode (jaga jarak ±15 cm)');
                    timer = setInterval(async () => {
                        if (v.readyState < 2) return;
                        try { const r = await detektor.detect(v); if (r.length) selesai(r[0].rawValue); } catch (_) {}
                    }, 220);
                } else {                                       // iPhone/Safari & browser lama
                    await muatZXing();
                    zx = new ZXing.BrowserMultiFormatReader();
                    status('Arahkan kamera ke barcode (jaga jarak ±15 cm)');
                    await zx.decodeFromConstraints(constraints, v, (res) => { if (res) selesai(res.getText()); });
                }
            } catch (e) {
                stop(); closeModal('camModal');
                const izin = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
                toast(izin ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser.'
                    : (e && e.name === 'NotFoundError' ? 'Kamera tidak ditemukan di perangkat ini.' : (e && e.message) || 'Kamera gagal dibuka.'), 'err', 5000);
            }
        }
        // ditutup dengan cara apa pun (tombol X, Esc, klik luar) -> matikan kamera
        new MutationObserver(() => { if (!$('camModal').classList.contains('open')) stop(); })
            .observe($('camModal'), { attributes: true, attributeFilter: ['class'] });
        return { buka };
    })();
    window.MusaKamera = Kamera;

    /* =================================================================
       4. DATA SOSIAL (ulasan, suka, komentar)
       ================================================================= */
    const S = {
        ulasan: [], suka: {}, komentar: [], saya: { suka: [], komentar: [], ulasan: [] },
        dbOk: true, per: 'bulan', daftarPop: [], bukaUlasan: new Set(), usulanSemua: false, usulanBuka: new Set(), editKom: null
    };
    const tabelBelumAda = () => `<div class="glass p-6 text-sm text-slate-500 md:col-span-2 lg:col-span-2"><i class="fa-solid fa-database text-amber-500 mr-2"></i>Fitur ini butuh tabel baru di Supabase. Jalankan <b>supabase-fitur-baru.sql</b> di SQL Editor, lalu muat ulang halaman.</div>`;

    async function muatSosial() {
        try {
            const [u, s, k, me] = await Promise.all([
                sb.from('buku_ulasan_publik').select('*').order('created_at', { ascending: false }).limit(2000),
                sb.from('pengajuan_suka_jumlah').select('*'),
                sb.from('pengajuan_komentar_publik').select('*').order('created_at', { ascending: true }).limit(3000),
                sb.rpc('saya', { p_device: DEV })
            ]);
            if (u.error || s.error || k.error) { S.dbOk = false; console.warn(u.error || s.error || k.error); }
            else {
                S.dbOk = true; S.ulasan = u.data || []; S.komentar = k.data || [];
                S.suka = Object.fromEntries((s.data || []).map(r => [r.pengajuan_id, r.jumlah]));
            }
            if (!me.error && me.data) S.saya = { suka: me.data.suka || [], komentar: me.data.komentar || [], ulasan: me.data.ulasan || [] };
        } catch (e) { S.dbOk = false; console.warn(e); }
        renderPopuler(); renderUsulan();
    }

    const stars = (v, kecil) => {
        let h = '';
        for (let i = 1; i <= 5; i++) {
            h += `<i class="${v >= i - 0.25 ? 'fa-solid fa-star star' : v >= i - 0.75 ? 'fa-solid fa-star-half-stroke star' : 'fa-regular fa-star star-off'}"></i>`;
        }
        return `<span class="stars${kecil ? ' sm' : ''}" aria-label="${(+v || 0).toFixed(1)} dari 5">${h}</span>`;
    };

    /* =================================================================
       5. BUKU POPULER + RATING + ULASAN
       ================================================================= */
    function hitungPopuler() {
        const awal = S.per === 'bulan' ? todayISO().slice(0, 8) + '01' : '';
        const m = new Map();
        state.pm.forEach(p => {
            const j = norm(p.judul); if (!j) return;
            const t = normTgl(p.tgl_pinjam);
            if (awal && (!t || t < awal)) return;
            const o = m.get(j) || { judul: j, n: 0, buku: 0 };
            o.n++; o.buku += p.jumlah || 1; m.set(j, o);
        });
        return [...m.values()].sort((a, b) => b.n - a.n || b.buku - a.buku).slice(0, 10);
    }
    const ulasanBuku = (j) => S.ulasan.filter(r => norm(r.judul) === j);

    function renderUlasanItem(r) {
        const milik = S.saya.ulasan.includes(r.id);
        const diedit = r.updated_at && r.created_at && (new Date(r.updated_at) - new Date(r.created_at)) > 60000;
        return `<div class="rv-item">
            <div class="flex items-center justify-between gap-2">
                <div class="text-xs"><b class="text-emerald-950">${esc(r.nama)}</b>${r.kelas ? ' · ' + esc(r.kelas) : ''}${milik ? ' <span class="badge b-info">Ulasanmu</span>' : ''}</div>
                ${stars(r.rating, true)}
            </div>
            ${r.ulasan ? `<p class="text-sm mt-1 break-words">${esc(r.ulasan)}</p>` : ''}
            <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-3">${tglIndo(r.created_at)}${diedit ? ' · diedit' : ''}
                ${state.isAdmin ? `<button type="button" data-act="rv-hapus" data-id="${r.id}" class="text-rose-600 font-semibold hover:underline">Hapus</button>` : ''}</div>
        </div>`;
    }

    function renderPopuler() {
        const box = $('pop-list'); if (!box) return;
        document.querySelectorAll('#pop-seg button').forEach(b => b.classList.toggle('on', b.dataset.per === S.per));
        if (!S.dbOk) { box.innerHTML = tabelBelumAda(); return; }
        S.daftarPop = hitungPopuler();
        if (!S.daftarPop.length) {
            box.innerHTML = `<div class="glass p-8 text-center text-sm text-slate-500 lg:col-span-2"><i class="fa-solid fa-book-open text-2xl text-emerald-600 mb-3 block"></i>${S.per === 'bulan' ? 'Belum ada peminjaman bulan ini. Coba pilih "Semua waktu".' : 'Belum ada data peminjaman.'}</div>`;
            return;
        }
        box.innerHTML = S.daftarPop.map((b, i) => {
            const rv = ulasanBuku(b.judul);
            const avg = rv.length ? rv.reduce((n, r) => n + r.rating, 0) / rv.length : 0;
            const milik = rv.some(r => S.saya.ulasan.includes(r.id));
            const buka = S.bukaUlasan.has(b.judul);
            return `<article class="glass p-5">
                <div class="flex gap-3 items-start">
                    <div class="pop-rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-extrabold text-emerald-950 leading-snug break-words">${esc(b.judul)}</h3>
                        <div class="text-xs text-slate-500 mt-1">${b.n}× dipinjam · ${b.buku} buku</div>
                        <div class="flex flex-wrap items-center gap-2 mt-2">${stars(avg)}
                            <span class="text-xs font-bold">${rv.length ? avg.toFixed(1) : 'Belum ada rating'}</span>
                            ${rv.length ? `<span class="text-xs text-slate-500">(${rv.length} ulasan)</span>` : ''}</div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-4">
                    <button type="button" data-act="rv-tulis" data-i="${i}" class="btn btn-primary btn-sm"><i class="fa-solid fa-star"></i> ${milik ? 'Edit ulasanku' : 'Beri ulasan'}</button>
                    ${rv.length ? `<button type="button" data-act="rv-toggle" data-i="${i}" class="btn btn-ghost btn-sm">${buka ? 'Sembunyikan' : 'Lihat'} ulasan (${rv.length})</button>` : ''}
                </div>
                ${buka ? `<div class="mt-3">${rv.slice(0, 15).map(renderUlasanItem).join('')}</div>` : ''}
            </article>`;
        }).join('');
    }

    /* ---------- Modal ulasan ---------- */
    const rv = { judul: '', rating: 0 };
    function setRating(n) {
        rv.rating = n;
        document.querySelectorAll('#rv-stars .star-btn').forEach(b => b.classList.toggle('on', +b.dataset.v <= n));
    }
    function bukaReview(judul) {
        rv.judul = judul;
        const own = S.ulasan.find(r => norm(r.judul) === judul && S.saya.ulasan.includes(r.id));
        const p = profil.get();
        $('rv-title').textContent = own ? 'Edit Ulasanku' : 'Tulis Ulasan';
        $('rv-judul').textContent = judul;
        $('rv-nama').value = own ? own.nama : (p.nama || '');
        $('rv-kelas').value = own ? (own.kelas || '') : (p.kelas || '');
        $('rv-teks').value = own ? (own.ulasan || '') : '';
        $('rv-count').textContent = $('rv-teks').value.length;
        $('rv-error').classList.add('hidden');
        setRating(own ? own.rating : 0);
        openModal('rvModal');
    }
    initKelasCombobox('rv-kelas', 'rv-kelas-list');
    $('rv-stars').addEventListener('click', (e) => { const b = e.target.closest('.star-btn'); if (b) setRating(+b.dataset.v); });
    $('rv-teks').addEventListener('input', () => { $('rv-count').textContent = $('rv-teks').value.length; });
    $('rv-save').addEventListener('click', async () => {
        const err = (m) => { $('rv-error').textContent = m; $('rv-error').classList.remove('hidden'); };
        const nama = $('rv-nama').value.trim(), kelas = $('rv-kelas').value.trim().toUpperCase().replace(/\s+/g, ' ');
        if (!rv.rating) return err('Pilih jumlah bintang dulu.');
        if (!nama) return err('Nama wajib diisi.');
        const btn = $('rv-save'); btn.disabled = true;
        const { error } = await sb.rpc('simpan_ulasan', { p_device: DEV, p_judul: rv.judul, p_nama: nama, p_kelas: kelas, p_rating: rv.rating, p_ulasan: $('rv-teks').value.trim() });
        btn.disabled = false;
        if (error) return err('Gagal menyimpan: ' + (error.message || 'terjadi kesalahan'));
        profil.set({ nama, kelas });
        closeModal('rvModal');
        S.bukaUlasan.add(rv.judul);
        toast('Terima kasih! Ulasanmu tersimpan.', 'ok');
        muatSosial();
    });

    $('pop-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-per]'); if (b) { S.per = b.dataset.per; renderPopuler(); } });
    $('pop-list').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act, buku = S.daftarPop[+b.dataset.i];
        if (act === 'rv-tulis' && buku) bukaReview(buku.judul);
        else if (act === 'rv-toggle' && buku) { S.bukaUlasan.has(buku.judul) ? S.bukaUlasan.delete(buku.judul) : S.bukaUlasan.add(buku.judul); renderPopuler(); }
        else if (act === 'rv-hapus' && state.isAdmin) {
            if (!confirm('Hapus ulasan ini?')) return;
            const { error } = await sb.from('buku_ulasan').delete().eq('id', +b.dataset.id);
            if (error) return dbError(error, 'Gagal menghapus ulasan');
            toast('Ulasan dihapus', 'ok'); muatSosial();
        }
    });

    /* =================================================================
       6. USULAN BUKU: SUKA + KOMENTAR
       ================================================================= */
    function komentarHTML(k) {
        const milik = S.saya.komentar.includes(k.id), edit = S.editKom === k.id;
        const diedit = k.updated_at && k.created_at && (new Date(k.updated_at) - new Date(k.created_at)) > 30000;
        return `<div class="kom-item">
            <div class="flex items-center justify-between gap-2 text-xs"><b class="text-emerald-950">${esc(k.nama)}</b><span class="text-slate-400">${tglIndo(k.created_at)}${diedit ? ' · diedit' : ''}</span></div>
            ${edit ? `<div class="flex flex-wrap gap-2 mt-1"><input class="field kom-edit flex-1 min-w-[160px]" maxlength="300" value="${esc(k.komentar)}">
                    <button type="button" data-act="kom-simpan" data-id="${k.id}" class="btn btn-primary btn-sm">Simpan</button>
                    <button type="button" data-act="kom-batal" class="btn btn-ghost btn-sm">Batal</button></div>`
                : `<p class="text-sm mt-0.5 break-words">${esc(k.komentar)}</p>`}
            <div class="flex gap-3 text-[11px] mt-1">
                ${milik && !edit ? `<button type="button" data-act="kom-edit" data-id="${k.id}" class="text-emerald-700 font-semibold hover:underline">Edit</button>` : ''}
                ${state.isAdmin ? `<button type="button" data-act="kom-hapus" data-id="${k.id}" class="text-rose-600 font-semibold hover:underline">Hapus</button>` : ''}
            </div></div>`;
    }

    function renderUsulan() {
        const box = $('usulan-list'); if (!box) return;
        if (!S.dbOk) { box.innerHTML = tabelBelumAda(); $('usulan-more').classList.add('hidden'); return; }
        const semua = [...state.pg].sort((a, b) => (S.suka[b.id] || 0) - (S.suka[a.id] || 0) || b.id - a.id);
        if (!semua.length) { box.innerHTML = '<p class="text-sm text-slate-500 md:col-span-2">Belum ada usulan buku. Kirim usulan lewat form di atas!</p>'; $('usulan-more').classList.add('hidden'); return; }
        const tampil = S.usulanSemua ? semua : semua.slice(0, 6);
        box.innerHTML = tampil.map(p => {
            const liked = S.saya.suka.includes(p.id), n = S.suka[p.id] || 0;
            const kom = S.komentar.filter(k => k.pengajuan_id === p.id), buka = S.usulanBuka.has(p.id);
            const nm = profil.get().nama || '';
            return `<article class="us-card" data-id="${p.id}">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0"><h4 class="font-bold text-emerald-950 break-words">${esc(p.judul)}</h4>
                        <div class="text-xs text-slate-500 mt-0.5">${esc(namaTampil(p.pemohon))}${p.jabatan ? ' · ' + esc(p.jabatan) : ''} · ${esc(p.qty)} eks</div></div>
                    <span class="badge ${PG_CSS[p.status] || 'b-info'} shrink-0">${esc(p.status)}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-3">
                    <button type="button" data-act="suka" data-id="${p.id}" class="suka-btn ${liked ? 'on' : ''}" aria-pressed="${liked}"><i class="${liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> Suka <b>${n}</b></button>
                    <button type="button" data-act="kom-toggle" data-id="${p.id}" class="suka-btn"><i class="fa-regular fa-comment"></i> Komentar <b>${kom.length}</b></button>
                </div>
                ${buka ? `<div class="mt-3">
                    ${kom.map(komentarHTML).join('') || '<p class="text-xs text-slate-400 pb-2">Belum ada komentar. Jadilah yang pertama!</p>'}
                    <div class="grid grid-cols-1 sm:grid-cols-[9rem_1fr_auto] gap-2 pt-3 border-t border-emerald-900/10">
                        <input class="field kom-nama" maxlength="60" placeholder="Namamu" value="${esc(nm)}">
                        <input class="field kom-teks" maxlength="300" placeholder="Tulis komentar…">
                        <button type="button" data-act="kom-kirim" data-id="${p.id}" class="btn btn-primary btn-sm">Kirim</button>
                    </div></div>` : ''}
            </article>`;
        }).join('');
        const more = $('usulan-more');
        more.classList.toggle('hidden', semua.length <= 6);
        more.textContent = S.usulanSemua ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${semua.length})`;
    }
    $('usulan-more').addEventListener('click', () => { S.usulanSemua = !S.usulanSemua; renderUsulan(); });
    $('usulan-list').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act, id = +b.dataset.id, kartu = b.closest('.us-card');
        if (act === 'suka') {
            b.disabled = true;
            const { data, error } = await sb.rpc('toggle_suka', { p_device: DEV, p_pengajuan: id });
            if (error) { b.disabled = false; return dbError(error, 'Gagal menyimpan suka'); }
            S.suka[id] = data.jumlah;
            S.saya.suka = data.liked ? [...new Set([...S.saya.suka, id])] : S.saya.suka.filter(x => x !== id);
            renderUsulan();
        } else if (act === 'kom-toggle') {
            S.usulanBuka.has(id) ? S.usulanBuka.delete(id) : S.usulanBuka.add(id); S.editKom = null; renderUsulan();
        } else if (act === 'kom-kirim') {
            const nama = kartu.querySelector('.kom-nama').value.trim(), teks = kartu.querySelector('.kom-teks').value.trim();
            if (!nama || !teks) return toast('Nama dan komentar wajib diisi', 'err');
            b.disabled = true;
            const { error } = await sb.rpc('tambah_komentar', { p_device: DEV, p_pengajuan: id, p_nama: nama, p_komentar: teks });
            if (error) { b.disabled = false; return dbError(error, 'Gagal mengirim komentar'); }
            profil.set({ ...profil.get(), nama });
            toast('Komentar terkirim', 'ok'); await muatSosial();
        } else if (act === 'kom-edit') { S.editKom = id; renderUsulan(); }
        else if (act === 'kom-batal') { S.editKom = null; renderUsulan(); }
        else if (act === 'kom-simpan') {
            const teks = kartu.querySelector('.kom-edit').value.trim();
            if (!teks) return toast('Komentar tidak boleh kosong', 'err');
            const { error } = await sb.rpc('edit_komentar', { p_device: DEV, p_id: id, p_komentar: teks });
            if (error) return dbError(error, 'Gagal menyimpan perubahan');
            S.editKom = null; toast('Komentar diperbarui', 'ok'); await muatSosial();
        } else if (act === 'kom-hapus' && state.isAdmin) {
            if (!confirm('Hapus komentar ini?')) return;
            const { error } = await sb.from('pengajuan_komentar').delete().eq('id', id);
            if (error) return dbError(error, 'Gagal menghapus komentar');
            toast('Komentar dihapus', 'ok'); await muatSosial();
        }
    });
    $('usulan-list').addEventListener('keydown', (e) => {     // Enter = kirim / simpan
        if (e.key !== 'Enter') return;
        const kartu = e.target.closest('.us-card'); if (!kartu) return;
        const tombol = e.target.classList.contains('kom-edit') ? kartu.querySelector('[data-act="kom-simpan"]') : kartu.querySelector('[data-act="kom-kirim"]');
        if (tombol) { e.preventDefault(); tombol.click(); }
    });
    const dalamForm = () => document.activeElement && $('usulan-list').contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    document.addEventListener('data:pg', () => { if (!dalamForm()) renderUsulan(); });
    document.addEventListener('data:pm', renderPopuler);

    /* =================================================================
       7. DATA SISWA (khusus admin)
       ================================================================= */
    const SW = { rows: [], q: '' };
    async function muatSiswa() {
        if (!state.isAdmin) { SW.rows = []; return renderSiswa(); }
        let all = [], from = 0;
        for (;;) {
            const { data, error } = await sb.from('siswa').select('*').order('nama').range(from, from + 999);
            if (error) return dbError(error, 'Gagal memuat data siswa (sudah menjalankan supabase-fitur-baru.sql?)');
            all = all.concat(data || []);
            if (!data || data.length < 1000) break;
            from += 1000;
        }
        SW.rows = all; renderSiswa();
    }
    function renderSiswa() {
        $('siswa-guard').classList.toggle('hidden', state.isAdmin);
        $('siswa-body').classList.toggle('hidden', !state.isAdmin);
        if (!state.isAdmin) return;
        const q = SW.q.trim().toLowerCase();
        const cocok = q ? SW.rows.filter(r => `${r.nis} ${r.nama} ${r.kelas}`.toLowerCase().includes(q)) : SW.rows;
        $('siswa-info').textContent = `${fmt(cocok.length)} dari ${fmt(SW.rows.length)} siswa${cocok.length > 200 ? ' · menampilkan 200 pertama' : ''}`;
        $('siswa-tbody').innerHTML = cocok.length ? cocok.slice(0, 200).map(r => `<tr>
            <td class="font-mono text-xs">${esc(r.nis)}</td><td class="font-semibold">${esc(r.nama)}</td><td>${esc(r.kelas) || '-'}</td>
            <td class="text-center whitespace-nowrap">
                <button type="button" data-sw="edit" data-nis="${esc(r.nis)}" class="btn btn-amber btn-sm" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button type="button" data-sw="hapus" data-nis="${esc(r.nis)}" class="btn btn-red btn-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
            : '<tr><td colspan="4" class="text-center text-slate-500 py-8">Belum ada data siswa. Klik Import Excel untuk memasukkan data.</td></tr>';
    }
    $('siswa-search').addEventListener('input', () => { SW.q = $('siswa-search').value; renderSiswa(); });
    /* ---------- Tambah / edit siswa (admin) ---------- */
    const ES = { lama: null };           // NIS lama saat edit; null = tambah baru
    initKelasCombobox('es-kelas', 'es-kelas-list');
    function bukaEditSiswa(nis) {
        const r = nis == null ? null : SW.rows.find(x => String(x.nis) === String(nis));
        ES.lama = r ? r.nis : null;
        $('es-title').textContent = r ? 'Edit Data Siswa' : 'Tambah Siswa';
        $('es-nis').value = r ? r.nis : '';
        $('es-nama').value = r ? r.nama : '';
        $('es-kelas').value = r ? (r.kelas || '') : '';
        $('es-error').classList.add('hidden');
        openModal('editSiswaModal');
        setTimeout(() => $(r ? 'es-nama' : 'es-nis').focus(), 60);
    }
    $('siswa-add').addEventListener('click', () => { if (state.isAdmin) bukaEditSiswa(null); });
    $('es-save').addEventListener('click', async () => {
        if (!state.isAdmin) return;
        const err = (m) => { $('es-error').textContent = m; $('es-error').classList.remove('hidden'); };
        const nis = $('es-nis').value.trim().replace(/\s+/g, '');
        const nama = $('es-nama').value.trim().replace(/\s+/g, ' ');
        const kelas = $('es-kelas').value.trim().toUpperCase().replace(/\s+/g, ' ');
        if (!/^\d{3,10}$/.test(nis)) return err('NIS/NISN harus angka 3–10 digit.');
        if (!nama) return err('Nama siswa wajib diisi.');
        if (!kelas) return err('Kelas wajib diisi.');
        const btn = $('es-save'); btn.disabled = true;
        let error;
        if (ES.lama == null) {                                        // tambah baru
            if (SW.rows.some(x => String(x.nis) === nis)) { btn.disabled = false; return err('NIS ini sudah terdaftar. Edit datanya dari daftar.'); }
            ({ error } = await sb.from('siswa').insert({ nis, nama, kelas }));
        } else {                                                      // edit (NIS boleh diganti)
            if (nis !== String(ES.lama) && SW.rows.some(x => String(x.nis) === nis)) { btn.disabled = false; return err('NIS baru itu sudah dipakai siswa lain.'); }
            ({ error } = await sb.from('siswa').update({ nis, nama, kelas }).eq('nis', ES.lama));
        }
        btn.disabled = false;
        if (error) return err('Gagal menyimpan: ' + (error.message || 'terjadi kesalahan'));
        closeModal('editSiswaModal');
        toast(ES.lama == null ? 'Siswa ditambahkan' : 'Data siswa diperbarui', 'ok');
        muatSiswa();
    });
    ['es-nis', 'es-nama', 'es-kelas'].forEach(id => $(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); $('es-save').click(); }
    }));
    $('siswa-tbody').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-sw]'); if (!b || !state.isAdmin) return;
        if (b.dataset.sw === 'edit') return bukaEditSiswa(b.dataset.nis);
        if (!confirm('Hapus siswa ini dari daftar?')) return;
        const { error } = await sb.from('siswa').delete().eq('nis', b.dataset.nis);
        if (error) return dbError(error, 'Gagal menghapus');
        toast('Siswa dihapus', 'ok'); muatSiswa();
    });
    // siswa baru dari scan, atau admin membuka halaman Data Siswa -> muat ulang daftar
    document.addEventListener('siswa:changed', () => { if (state.isAdmin) muatSiswa(); });
    $('siswa-import').addEventListener('click', () => $('siswa-file').click());
    $('siswa-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f || !state.isAdmin) return;
        try {
            const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
            const baris = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
            const ambil = (r, ...kunci) => { for (const k of Object.keys(r)) if (kunci.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return r[k]; return ''; };
            const peta = new Map();
            let lewat = 0;
            baris.forEach(r => {
                const nis = String(ambil(r, 'nis', 'nisn', 'nomorinduk', 'noinduk')).trim().replace(/\.0+$/, '');
                const nama = String(ambil(r, 'nama', 'namasiswa', 'namalengkap')).trim().replace(/\s+/g, ' ');
                const kelas = String(ambil(r, 'kelas', 'rombel')).trim().toUpperCase().replace(/\s+/g, ' ');
                if (!nis || !nama) { lewat++; return; }
                peta.set(nis, { nis, nama, kelas });
            });
            const daftar = [...peta.values()];
            if (!daftar.length) return toast('Tidak ada data terbaca. Pastikan judul kolom: NIS, Nama, Kelas.', 'err', 5000);
            for (let i = 0; i < daftar.length; i += 500) {
                const { error } = await sb.from('siswa').upsert(daftar.slice(i, i + 500), { onConflict: 'nis' });
                if (error) return dbError(error, 'Import gagal');
            }
            toast(`${fmt(daftar.length)} siswa diimpor${lewat ? `, ${lewat} baris dilewati` : ''}`, 'ok', 5000);
            muatSiswa();
        } catch (err) { dbError(err, 'File Excel tidak bisa dibaca'); }
    });
    $('siswa-export').addEventListener('click', () => {
        if (!SW.rows.length) return toast('Belum ada data siswa', 'info');
        const ws = XLSX.utils.json_to_sheet(SW.rows.map(r => ({ NIS: r.nis, Nama: r.nama, Kelas: r.kelas })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
        XLSX.writeFile(wb, 'data-siswa.xlsx');
    });
    $('siswa-clear').addEventListener('click', async () => {
        if (!state.isAdmin) return;
        if ((prompt(`Hapus SEMUA data siswa (${SW.rows.length})?\nKetik HAPUS untuk melanjutkan.`) || '').trim().toUpperCase() !== 'HAPUS') return;
        const { error } = await sb.from('siswa').delete().neq('nis', '');
        if (error) return dbError(error, 'Gagal mengosongkan data siswa');
        toast('Data siswa dikosongkan', 'ok'); muatSiswa();
    });

    document.addEventListener('admin:changed', () => { muatSiswa(); renderPopuler(); renderUsulan(); });
    document.addEventListener('click', (e) => {              // segarkan data sosial saat membuka halaman terkait
        const a = e.target.closest('[data-nav]');
        if (a && ['populer', 'pengajuan'].includes(a.dataset.nav)) setTimeout(muatSosial, 60);
        if (a && a.dataset.nav === 'siswa' && state.isAdmin) setTimeout(muatSiswa, 60);
    });
    window.addEventListener('hashchange', () => {
        const h = location.hash.slice(1);
        if (['populer', 'pengajuan'].includes(h)) muatSosial();
        if (h === 'siswa' && state.isAdmin) muatSiswa();
    });
    window.MusaSiswa = { count: () => SW.rows.length };
    renderSiswa();
    muatSosial();
    if (state.isAdmin) muatSiswa();     // sesi admin sudah aktif sebelum file ini dimuat (mis. setelah refresh) -> langsung ambil dari database
})();
