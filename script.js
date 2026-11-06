'use strict';
/* =====================================================================
   MUSA PERPUS - script.js
   Supabase + Auth admin + Auto Inventaris (SheetJS)
   ===================================================================== */

// ==================== SUPABASE ====================
const SUPABASE_URL = 'https://atfowpthwlvozqbqztur.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qmqkwFb_dmZHLt21D0OnNw_pNAANp31';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== STATE & UTIL ====================
const state = {
    isAdmin: false,
    inv: [],            // 1 objek = 1 eksemplar
    pm: [],
    pg: [],
    invPage: 1, invPer: 50,
    pmPage: 1, pmPer: 10,
    editId: null,
    shownStats: { judul: 0, eks: 0, dipinjam: 0, baik: 0 }
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('id-ID');
const pad4 = (n) => String(n).padStart(4, '0');
const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (zona waktu lokal)
const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function ambilTahun(v) {
    const m = String(v == null ? '' : v).match(/(19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
}
function ambilInt(v) {
    if (v === '' || v == null) return null;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? null : Math.floor(n);
}
// "Adam Winatra" -> "Adam W."
function singkatNama(n) {
    const w = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (w.length <= 1) return w[0] || '';
    return w[0] + ' ' + w.slice(1).map(x => x.charAt(0).toUpperCase() + '.').join(' ');
}
function tglIndo(s) {
    if (!s) return '-';
    const p = String(s).slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}
function dbError(e, prefix) {
    console.error(e);
    toast((prefix ? prefix + ': ' : '') + (e && e.message ? e.message : 'Terjadi kesalahan'), 'err');
}

// ==================== TOAST ====================
function toast(msg, type = 'info', ms = 3600) {
    const icons = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${esc(msg)}</span>`;
    $('toastWrap').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
}

// ==================== MODAL ====================
const openModal = (id) => $(id).classList.add('open');
const closeModal = (id) => $(id).classList.remove('open');
document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (c) return closeModal(c.getAttribute('data-close'));
    if (e.target.classList && e.target.classList.contains('modal-wrap')) e.target.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-wrap.open').forEach(m => m.classList.remove('open'));
});

// ==================== KURSOR KUSTOM ====================
(function initCursor() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const dot = $('curDot'), ring = $('curRing');
    let mx = -100, my = -100, rx = -100, ry = -100;
    document.body.classList.add('cursor-ready');
    window.addEventListener('mousemove', (e) => {
        mx = e.clientX; my = e.clientY;
        document.body.classList.add('cursor-on');
        dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    }, { passive: true });
    document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-on'));
    document.addEventListener('mouseover', (e) => {
        const t = e.target;
        ring.classList.toggle('hover', !!t.closest('a,button,select,label,[data-act],.glass-hover'));
        document.body.classList.toggle('cur-text', !!t.closest('input:not([type=checkbox]),textarea'));
    });
    document.addEventListener('mousedown', () => ring.classList.add('press'));
    document.addEventListener('mouseup', () => ring.classList.remove('press'));
    (function loop() {
        rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
        ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        requestAnimationFrame(loop);
    })();
})();

// ==================== TYPING & DELETING ====================
(function initTyping() {
    const el = $('typingText');
    const msgs = [
        'Selamat Datang di MUSA PERPUS...',
        'Sistem Inventaris & Peminjaman Real-time...',
        'Pencarian Buku Cepat & Akurat...'
    ];
    let m = 0, i = 0, del = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = msgs[0]; return; }
    (function tick() {
        const full = msgs[m];
        i += del ? -1 : 1;
        el.textContent = full.slice(0, i);
        let delay = del ? 28 : 65;
        if (!del && i === full.length) { del = true; delay = 1800; }
        else if (del && i === 0) { del = false; m = (m + 1) % msgs.length; delay = 450; }
        setTimeout(tick, delay);
    })();
})();

// ==================== COUNT-UP ====================
function animateCount(el, to, from = 0, dur = 1200) {
    if (!el) return;
    const t0 = performance.now();
    (function step(t) {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4); // easeOutQuart
        el.textContent = fmt(Math.round(from + (to - from) * e));
        if (p < 1) requestAnimationFrame(step);
    })(t0);
}

// ==================== NAVIGASI ====================
const PAGES = ['dashboard', 'inventaris', 'peminjaman', 'pengajuan'];
function showPage(name) {
    if (!PAGES.includes(name)) name = 'dashboard';
    PAGES.forEach(p => {
        const sec = $('page-' + p);
        const on = p === name;
        sec.classList.toggle('hidden', !on);
        if (on) { sec.classList.remove('page'); void sec.offsetWidth; sec.classList.add('page'); }
    });
    document.querySelectorAll('.nav-pill').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.nav;
    history.replaceState(null, '', '#' + name);
    showPage(name);
});
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));

// ==================== AUTH ADMIN ====================
function setAdmin(flag) {
    state.isAdmin = !!flag;
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !state.isAdmin));
    $('adminBadge').classList.toggle('hidden', !state.isAdmin);
    $('authLabel').textContent = state.isAdmin ? 'Logout' : 'Login Admin';
    $('authBtn').querySelector('i').className = state.isAdmin ? 'fa-solid fa-right-from-bracket' : 'fa-solid fa-right-to-bracket';
    renderInventaris(); renderPeminjaman(); renderPengajuan();
}
$('authBtn').addEventListener('click', async () => {
    if (state.isAdmin) {
        const { error } = await sb.auth.signOut();
        if (error) return dbError(error, 'Logout gagal');
        toast('Berhasil logout', 'info');
    } else {
        $('login-error').classList.add('hidden');
        openModal('loginModal');
        setTimeout(() => $('login-email').focus(), 50);
    }
});
$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-submit');
    btn.disabled = true; btn.textContent = 'Memeriksa…';
    const { error } = await sb.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-pass').value });
    btn.disabled = false; btn.textContent = 'Masuk';
    if (error) {
        $('login-error').textContent = 'Login gagal: ' + error.message;
        $('login-error').classList.remove('hidden');
        return toast('Login gagal', 'err');
    }
    $('login-pass').value = '';
    closeModal('loginModal');
    toast('Selamat datang, Admin!', 'ok');
});
sb.auth.onAuthStateChange(async (_evt, session) => {
    const was = state.isAdmin;
    setAdmin(!!session);
    // Tabel peminjaman/pengajuan berbeda sumber untuk admin vs publik -> muat ulang
    if (was !== !!session) { await Promise.all([loadPeminjaman(), loadPengajuan()]); }
});

// ==================== AUTO INVENTARIS: PARSING EXCEL ====================
function parseSheet(aoa) {
    const out = [], warn = [];
    let h = -1;
    for (let i = 0; i < Math.min(10, aoa.length); i++) {
        if ((aoa[i] || []).some(c => norm(c).includes('nama barang'))) { h = i; break; }
    }
    if (h === -1) throw new Error('Header kolom "Nama Barang" tidak ditemukan di sheet pertama.');

    const head = aoa[h].map(norm);
    const col = {
        nama: head.findIndex(x => x.includes('nama barang')),
        merek: head.findIndex(x => x.includes('merek') || x.includes('penerbit')),
        qty: head.findIndex(x => x.includes('kuantitas')),
        tahun: head.findIndex(x => x.startsWith('tahun')),
        baik: head.findIndex(x => x === 'baik'),
        kurang: head.findIndex(x => x === 'kurang baik'),
        rusak: head.findIndex(x => x === 'rusak'),
        kategori: head.findIndex(x => x.includes('kategori'))
    };
    const hilang = ['nama', 'qty', 'tahun'].filter(k => col[k] === -1);
    if (hilang.length) {
        const label = { nama: 'Nama Barang', qty: 'Kuantitas', tahun: 'Tahun Pembuatan/Pembelian' };
        throw new Error('Kolom wajib tidak ditemukan: ' + hilang.map(k => label[k]).join(', '));
    }
    const get = (row, k) => (col[k] === -1 ? '' : row[col[k]]);
    const str = (v) => String(v == null ? '' : v).trim();

    for (let i = h + 1; i < aoa.length; i++) {
        const row = aoa[i] || [];
        const nama = str(get(row, 'nama'));
        const tahun = ambilTahun(get(row, 'tahun'));
        const baris = i + 1;
        if (!nama && !tahun) continue;
        if (!nama) { warn.push(`Baris ${baris}: Nama Barang kosong, dilewati`); continue; }
        if (!tahun) { warn.push(`Baris ${baris}: tahun tidak valid, "${nama}" dilewati`); continue; }

        let qty = ambilInt(get(row, 'qty'));
        if (qty == null || qty < 1) { warn.push(`Baris ${baris}: Kuantitas kosong/tidak valid, "${nama}" dianggap 1 eksemplar`); qty = 1; }

        const b = Math.max(0, ambilInt(get(row, 'baik')) || 0);
        const k = Math.max(0, ambilInt(get(row, 'kurang')) || 0);
        const r = Math.max(0, ambilInt(get(row, 'rusak')) || 0);
        let baik, kurang, rusak;
        if (b + k + r === 0) { baik = qty; kurang = 0; rusak = 0; }
        else {
            if (b + k + r !== qty) warn.push(`Baris ${baris}: jumlah kondisi (${b + k + r}) tidak sama dengan Kuantitas (${qty}), "${nama}" disesuaikan`);
            baik = Math.min(b, qty);
            rusak = Math.min(r, qty - baik);
            kurang = qty - baik - rusak;
        }
        out.push({ nama, merek: str(get(row, 'merek')), tahun, qty, baik, kurang, rusak, kategori: str(get(row, 'kategori')) || 'Umum' });
    }
    return { groups: out, warn };
}

// Ekspansi kuantitas -> baris eksemplar. NoUrut mulai 0001 untuk tiap tahun baru.
// `start` = penghitung awal per tahun (untuk tambah manual), default kosong (import).
function expandGroups(groups, start = {}) {
    const counter = Object.assign({}, start);
    const urut = groups.map((g, idx) => ({ g, idx })).sort((a, b) => (a.g.tahun - b.g.tahun) || (a.idx - b.idx));
    const rows = [];
    urut.forEach(({ g }) => {
        counter[g.tahun] = (counter[g.tahun] || 0) + 1;
        const no = counter[g.tahun];
        for (let e = 1; e <= g.qty; e++) {
            const kondisi = e <= g.baik ? 'Baik' : (e <= g.baik + g.kurang ? 'Kurang Baik' : 'Rusak');
            rows.push({
                group_id: `${g.tahun}-${pad4(no)}`,
                no_urut: no,
                no_inventaris: `INV/${pad4(no)}/${g.tahun}/${e}`,
                nama: g.nama, merek: g.merek, tahun: g.tahun, eksemplar: e, kondisi, kategori: g.kategori || 'Umum'
            });
        }
    });
    return rows;
}

// ==================== INVENTARIS: DATA ====================
function prepInv(r) {
    r._s = `${r.no_inventaris} ${r.nama} ${r.merek || ''} ${r.kategori || ''} ${r.tahun} ${r.kondisi}`.toLowerCase();
    return r;
}
async function loadInventaris() {
    try {
        let all = [], from = 0;
        const step = 1000;
        for (;;) {
            const { data, error } = await sb.from('inventaris').select('*')
                .order('tahun').order('no_urut').order('eksemplar').range(from, from + step - 1);
            if (error) throw error;
            all = all.concat(data);
            if (data.length < step) break;
            from += step;
        }
        state.inv = all.map(prepInv);
    } catch (e) { dbError(e, 'Gagal memuat inventaris'); }
    isiFilterInventaris();
    renderInventaris();
    renderStats();
    $('dl-judul').innerHTML = [...new Set(state.inv.map(i => i.nama))].slice(0, 3000).map(n => `<option value="${esc(n)}">`).join('');
}

let filterKey = '';
function isiFilterInventaris() {
    const ths = [...new Set(state.inv.map(i => i.tahun))].sort((a, b) => a - b);
    const kts = [...new Set(state.inv.map(i => i.kategori).filter(Boolean))].sort();
    const key = ths.join(',') + '|' + kts.join(',');
    if (key === filterKey) return;
    filterKey = key;
    const st = $('inv-tahun'), sk = $('inv-kategori');
    const ct = st.value, ck = sk.value;
    st.innerHTML = '<option value="">Semua Tahun</option>' + ths.map(t => `<option value="${t}">${t}</option>`).join('');
    sk.innerHTML = '<option value="">Semua Kategori</option>' + kts.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
    st.value = ths.map(String).includes(ct) ? ct : '';
    sk.value = kts.includes(ck) ? ck : '';
}

function invTersaring() {
    const q = $('inv-search').value.trim().toLowerCase();
    const th = parseInt($('inv-tahun').value, 10) || 0;
    const kt = $('inv-kategori').value;
    const kd = $('inv-kondisi').value;
    if (!q && !th && !kt && !kd) return state.inv;
    return state.inv.filter(it => (!th || it.tahun === th) && (!kt || it.kategori === kt) && (!kd || it.kondisi === kd) && (!q || it._s.includes(q)));
}

const KOND_CSS = { 'Baik': 'b-ok', 'Kurang Baik': 'b-warn', 'Rusak': 'b-bad' };

function renderInventaris() {
    const data = invTersaring();
    const per = state.invPer;
    const maxHal = Math.max(1, Math.ceil(data.length / per));
    if (state.invPage > maxHal) state.invPage = maxHal;
    const start = (state.invPage - 1) * per;
    const slice = data.slice(start, start + per);
    const admin = state.isAdmin;

    $('inv-tbody').innerHTML = slice.length ? slice.map((it, i) => `
        <tr class="row-in">
            <td class="text-center text-slate-400">${start + i + 1}</td>
            <td class="font-mono font-semibold text-cyan-200 whitespace-nowrap">${esc(it.no_inventaris)}</td>
            <td class="font-semibold">${esc(it.nama)}</td>
            <td class="text-slate-300">${esc(it.merek) || '-'}</td>
            <td class="text-center">${it.tahun}</td>
            <td class="text-center">${it.eksemplar}</td>
            <td><span class="badge b-info">${esc(it.kategori || 'Umum')}</span></td>
            <td class="text-center"><span class="badge ${KOND_CSS[it.kondisi] || 'b-info'}">${esc(it.kondisi)}</span></td>
            ${admin ? `<td class="text-center whitespace-nowrap">
                <button data-act="inv-edit" data-id="${it.id}" class="btn btn-amber btn-sm" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button data-act="inv-del" data-id="${it.id}" class="btn btn-red btn-sm" title="Hapus eksemplar"><i class="fa-solid fa-trash"></i></button>
            </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="9" class="text-center text-slate-400 py-10">${state.inv.length ? 'Tidak ada data yang cocok.' : 'Belum ada data inventaris.'}</td></tr>`;

    $('inv-count').textContent = `${fmt(data.length)} dari ${fmt(state.inv.length)} eksemplar`;
    $('inv-page').textContent = `${state.invPage} / ${maxHal}`;
    $('inv-info').textContent = data.length ? `Menampilkan ${fmt(start + 1)} – ${fmt(Math.min(start + per, data.length))} dari ${fmt(data.length)} data` : 'Menampilkan 0 data';
}

// ==================== INVENTARIS: EVENT ====================
const onSearchInv = debounce(() => { state.invPage = 1; renderInventaris(); }, 140);
$('inv-search').addEventListener('input', onSearchInv);
['inv-tahun', 'inv-kategori', 'inv-kondisi'].forEach(id => $(id).addEventListener('change', () => { state.invPage = 1; renderInventaris(); }));
$('inv-perpage').addEventListener('change', (e) => { state.invPer = parseInt(e.target.value, 10) || 50; state.invPage = 1; renderInventaris(); });
$('inv-reset').addEventListener('click', () => {
    $('inv-search').value = ''; $('inv-tahun').value = ''; $('inv-kategori').value = ''; $('inv-kondisi').value = '';
    state.invPage = 1; renderInventaris();
});
$('inv-prev').addEventListener('click', () => { if (state.invPage > 1) { state.invPage--; renderInventaris(); } });
$('inv-next').addEventListener('click', () => { if (state.invPage * state.invPer < invTersaring().length) { state.invPage++; renderInventaris(); } });
function keHalaman() {
    const n = parseInt($('inv-goto').value, 10);
    if (isNaN(n)) return;
    const max = Math.max(1, Math.ceil(invTersaring().length / state.invPer));
    state.invPage = Math.min(Math.max(1, n), max);
    $('inv-goto').value = '';
    renderInventaris();
}
$('inv-goto-btn').addEventListener('click', keHalaman);
$('inv-goto').addEventListener('keydown', (e) => { if (e.key === 'Enter') keHalaman(); });

// ---------- Import Excel (admin) ----------
async function insertBatches(rows, size = 500) {
    for (let i = 0; i < rows.length; i += size) {
        const { error } = await sb.from('inventaris').insert(rows.slice(i, i + size));
        if (error) throw error;
        $('inv-count').textContent = `Menyimpan ${fmt(Math.min(i + size, rows.length))} / ${fmt(rows.length)} eksemplar…`;
    }
}
$('inv-import').addEventListener('click', () => $('inv-file').click());
$('inv-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !state.isAdmin) return;
    const reader = new FileReader();
    reader.onerror = () => toast('Gagal membaca file', 'err');
    reader.onload = async (ev) => {
        let res;
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            res = parseSheet(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }));
        } catch (err) { return toast(err.message, 'err', 6000); }

        const rows = expandGroups(res.groups);
        if (!rows.length) return toast('Tidak ada baris valid di file ini', 'err');
        if (!confirm(`File berisi ${fmt(res.groups.length)} judul → ${fmt(rows.length)} eksemplar.\n\nSEMUA data inventaris saat ini akan DIGANTI. Lanjutkan?`)) return;

        try {
            toast('Mengimpor data, mohon tunggu…', 'info');
            const del = await sb.from('inventaris').delete().gt('id', 0);
            if (del.error) throw del.error;
            await insertBatches(rows);
            const w = $('inv-warning');
            if (res.warn.length) {
                w.classList.remove('hidden');
                w.innerHTML = `<b>${res.warn.length} catatan saat import:</b><br>` + res.warn.slice(0, 20).map(esc).join('<br>') + (res.warn.length > 20 ? '<br>…' : '');
            } else { w.classList.add('hidden'); w.innerHTML = ''; }
            toast(`Import selesai: ${fmt(res.groups.length)} judul → ${fmt(rows.length)} eksemplar`, 'ok', 5000);
        } catch (err) { dbError(err, 'Import gagal'); }
        await loadInventaris();
    };
    reader.readAsArrayBuffer(file);
});

// ---------- Export Excel (admin) ----------
$('inv-export').addEventListener('click', () => {
    if (!state.inv.length) return toast('Belum ada data untuk diexport', 'err');
    const aoa = [['No Inventaris', 'Nama Barang', 'Merek / Penerbit', 'Tahun Pembelian', 'No Eksemplar', 'Kategori', 'Kondisi']]
        .concat(state.inv.map(it => [it.no_inventaris, it.nama, it.merek, it.tahun, it.eksemplar, it.kategori, it.kondisi]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'INVENTARIS');
    XLSX.writeFile(wb, 'INVENTARIS RUANG PERPUSTAKAAN.xlsx');
    toast('File Excel berhasil dibuat', 'ok');
});

// ---------- Tambah buku (admin) ----------
function nextNo(tahun) {
    let max = 0;
    state.inv.forEach(i => { if (i.tahun === tahun && i.no_urut > max) max = i.no_urut; });
    return max + 1;
}
let imKondisiManual = false;
function imHitung() {
    const q = parseInt($('im-qty').value, 10) || 0;
    const b = parseInt($('im-baik').value, 10) || 0;
    const r = parseInt($('im-rusak').value, 10) || 0;
    $('im-kurang').value = q - b - r;
    const th = parseInt($('im-tahun').value, 10);
    $('im-info').textContent = (th >= 1900 && th <= 2100 && q >= 1)
        ? `Nomor: INV/${pad4(nextNo(th))}/${th}/1` + (q > 1 ? ` s/d INV/${pad4(nextNo(th))}/${th}/${q}` : '')
        : '';
}
$('inv-add').addEventListener('click', () => {
    imKondisiManual = false;
    ['im-nama', 'im-merek', 'im-kategori'].forEach(id => $(id).value = '');
    $('im-tahun').value = new Date().getFullYear();
    $('im-qty').value = 1; $('im-baik').value = 1; $('im-rusak').value = 0;
    $('im-error').classList.add('hidden');
    imHitung();
    openModal('invModal');
    setTimeout(() => $('im-nama').focus(), 50);
});
['im-baik', 'im-rusak'].forEach(id => $(id).addEventListener('input', () => { imKondisiManual = true; imHitung(); }));
$('im-qty').addEventListener('input', () => { if (!imKondisiManual) $('im-baik').value = parseInt($('im-qty').value, 10) || 0; imHitung(); });
$('im-tahun').addEventListener('input', imHitung);

$('im-save').addEventListener('click', async () => {
    const err = (m) => { $('im-error').textContent = m; $('im-error').classList.remove('hidden'); };
    const nama = $('im-nama').value.trim();
    const merek = $('im-merek').value.trim();
    const kategori = $('im-kategori').value.trim() || 'Umum';
    const tahun = parseInt($('im-tahun').value, 10);
    const qty = parseInt($('im-qty').value, 10);
    const baik = parseInt($('im-baik').value, 10) || 0;
    const rusak = parseInt($('im-rusak').value, 10) || 0;
    if (!nama) return err('Nama Barang wajib diisi.');
    if (!(tahun >= 1900 && tahun <= 2100)) return err('Tahun harus 4 digit (1900–2100).');
    if (!(qty >= 1 && qty <= 10000)) return err('Kuantitas harus 1–10.000.');
    if (baik < 0 || rusak < 0) return err('Jumlah kondisi tidak boleh negatif.');
    const kurang = qty - baik - rusak;
    if (kurang < 0) return err('Jumlah Baik + Rusak melebihi Kuantitas.');

    const btn = $('im-save'); btn.disabled = true;
    try {
        const no = nextNo(tahun);
        const rows = expandGroups([{ nama, merek, tahun, qty, baik, kurang, rusak, kategori }], { [tahun]: no - 1 });
        await insertBatches(rows);
        closeModal('invModal');
        toast(`Ditambahkan: INV/${pad4(no)}/${tahun}/1 – ${qty} eksemplar`, 'ok');
        await loadInventaris();
    } catch (e) { dbError(e, 'Gagal menyimpan'); }
    btn.disabled = false;
});

// ---------- Edit / hapus (admin) ----------
document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !state.isAdmin) return;
    const act = b.dataset.act, id = Number(b.dataset.id);

    if (act === 'inv-edit') {
        const it = state.inv.find(x => x.id === id);
        if (!it) return;
        state.editId = id;
        $('em-no').textContent = it.no_inventaris;
        $('em-nama').value = it.nama; $('em-merek').value = it.merek || ''; $('em-kategori').value = it.kategori || '';
        $('em-kondisi').value = it.kondisi; $('em-all').checked = false;
        $('em-count').textContent = state.inv.filter(x => x.group_id === it.group_id).length;
        openModal('editModal');
    }
    else if (act === 'inv-del') {
        const it = state.inv.find(x => x.id === id);
        if (!it || !confirm(`Hapus eksemplar ${it.no_inventaris}?`)) return;
        const { error } = await sb.from('inventaris').delete().eq('id', id);
        if (error) return dbError(error, 'Gagal menghapus');
        toast('Eksemplar dihapus', 'ok'); loadInventaris();
    }
    else if (act === 'pm-return') {
        if (!confirm('Tandai buku ini sudah dikembalikan hari ini?')) return;
        const { error } = await sb.from('peminjaman').update({ tgl_kembali: todayISO() }).eq('id', id);
        if (error) return dbError(error, 'Gagal memperbarui');
        toast('Buku ditandai sudah kembali', 'ok'); loadPeminjaman();
    }
    else if (act === 'pm-del') {
        if (!confirm('Hapus data peminjaman ini?')) return;
        const { error } = await sb.from('peminjaman').delete().eq('id', id);
        if (error) return dbError(error, 'Gagal menghapus');
        toast('Data peminjaman dihapus', 'ok'); loadPeminjaman();
    }
    else if (act === 'pg-status') {
        const { error } = await sb.from('pengajuan').update({ status: b.dataset.status }).eq('id', id);
        if (error) return dbError(error, 'Gagal memperbarui status');
        toast(`Pengajuan ${b.dataset.status.toLowerCase()}`, 'ok'); loadPengajuan();
    }
    else if (act === 'pg-del') {
        if (!confirm('Hapus pengajuan ini?')) return;
        const { error } = await sb.from('pengajuan').delete().eq('id', id);
        if (error) return dbError(error, 'Gagal menghapus');
        toast('Pengajuan dihapus', 'ok'); loadPengajuan();
    }
});

$('em-save').addEventListener('click', async () => {
    const it = state.inv.find(x => x.id === state.editId);
    if (!it) return;
    const nama = $('em-nama').value.trim();
    if (!nama) return toast('Nama Barang wajib diisi', 'err');
    const common = { nama, merek: $('em-merek').value.trim(), kategori: $('em-kategori').value.trim() || 'Umum' };
    const kondisi = $('em-kondisi').value;
    const btn = $('em-save'); btn.disabled = true;
    try {
        if ($('em-all').checked) {
            const r1 = await sb.from('inventaris').update(common).eq('group_id', it.group_id);
            if (r1.error) throw r1.error;
            const r2 = await sb.from('inventaris').update({ kondisi }).eq('id', it.id);
            if (r2.error) throw r2.error;
        } else {
            const r = await sb.from('inventaris').update({ ...common, kondisi }).eq('id', it.id);
            if (r.error) throw r.error;
        }
        closeModal('editModal');
        toast('Perubahan disimpan', 'ok');
        await loadInventaris();
    } catch (e) { dbError(e, 'Gagal menyimpan'); }
    btn.disabled = false;
});
$('em-del-group').addEventListener('click', async () => {
    const it = state.inv.find(x => x.id === state.editId);
    if (!it) return;
    const n = state.inv.filter(x => x.group_id === it.group_id).length;
    if (!confirm(`Hapus SELURUH judul "${it.nama}" (${n} eksemplar)? Tindakan ini tidak bisa dibatalkan.`)) return;
    const { error } = await sb.from('inventaris').delete().eq('group_id', it.group_id);
    if (error) return dbError(error, 'Gagal menghapus');
    closeModal('editModal'); toast(`${n} eksemplar dihapus`, 'ok'); loadInventaris();
});

// ==================== PEMINJAMAN ====================
async function loadPeminjaman() {
    // Publik membaca VIEW yang namanya sudah disingkat di server; admin membaca tabel asli.
    const src = state.isAdmin ? 'peminjaman' : 'peminjaman_publik';
    const { data, error } = await sb.from(src).select('*').order('id', { ascending: false }).range(0, 1999);
    if (error) { dbError(error, 'Gagal memuat peminjaman'); return; }
    state.pm = data || [];
    renderPeminjaman(); renderStats(); renderRecent();
}

function pmTersaring() {
    const q = $('pm-search').value.trim().toLowerCase();
    const st = $('pm-filter').value;
    return state.pm.filter(p => {
        if (st === 'dipinjam' && p.tgl_kembali) return false;
        if (st === 'kembali' && !p.tgl_kembali) return false;
        if (!q) return true;
        return `${p.nama} ${p.judul} ${p.kelas}`.toLowerCase().includes(q);
    });
}
function namaTampil(n) { return state.isAdmin ? n : singkatNama(n); }

function renderPeminjaman() {
    const data = pmTersaring();
    const maxHal = Math.max(1, Math.ceil(data.length / state.pmPer));
    if (state.pmPage > maxHal) state.pmPage = maxHal;
    const start = (state.pmPage - 1) * state.pmPer;
    const slice = data.slice(start, start + state.pmPer);
    $('pm-tbody').innerHTML = slice.length ? slice.map((p, i) => `
        <tr class="row-in">
            <td class="text-center text-slate-400">${start + i + 1}</td>
            <td class="font-semibold">${esc(namaTampil(p.nama))}</td>
            <td>${esc(p.kelas) || '-'}</td>
            <td class="max-w-[260px] truncate" title="${esc(p.judul)}">${esc(p.judul)}</td>
            <td class="text-center font-bold">${p.jumlah}</td>
            <td class="whitespace-nowrap">${tglIndo(p.tgl_pinjam)}</td>
            <td>${p.tgl_kembali ? `<span class="badge b-ok"><i class="fa-solid fa-check"></i> ${tglIndo(p.tgl_kembali)}</span>` : `<span class="badge b-warn pulse-soft">Belum Kembali</span>`}</td>
            <td class="font-mono text-xs text-slate-300">${esc(p.no_buku) || '-'}</td>
            <td class="max-w-[160px] truncate text-slate-400" title="${esc(p.catatan)}">${esc(p.catatan) || '-'}</td>
            ${state.isAdmin ? `<td class="text-center whitespace-nowrap">
                ${p.tgl_kembali ? '' : `<button data-act="pm-return" data-id="${p.id}" class="btn btn-green btn-sm" title="Tandai kembali"><i class="fa-solid fa-rotate-left"></i></button>`}
                <button data-act="pm-del" data-id="${p.id}" class="btn btn-red btn-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="10" class="text-center text-slate-400 py-10">Belum ada data peminjaman.</td></tr>`;
    $('pm-page').textContent = `${state.pmPage} / ${maxHal}`;
    $('pm-info').textContent = data.length ? `Menampilkan ${start + 1} – ${Math.min(start + state.pmPer, data.length)} dari ${data.length} data` : 'Menampilkan 0 data';
}
const onSearchPm = debounce(() => { state.pmPage = 1; renderPeminjaman(); }, 140);
$('pm-search').addEventListener('input', onSearchPm);
$('pm-filter').addEventListener('change', () => { state.pmPage = 1; renderPeminjaman(); });
$('pm-prev').addEventListener('click', () => { if (state.pmPage > 1) { state.pmPage--; renderPeminjaman(); } });
$('pm-next').addEventListener('click', () => { if (state.pmPage * state.pmPer < pmTersaring().length) { state.pmPage++; renderPeminjaman(); } });
$('pm-refresh').addEventListener('click', async () => { await loadPeminjaman(); toast('Data diperbarui', 'info', 1800); });

$('pm-submit').addEventListener('click', async () => {
    const nama = $('pm-nama').value.trim();
    const judul = $('pm-judul').value.trim();
    const jumlah = parseInt($('pm-jumlah').value, 10) || 1;
    if (!nama || !judul) return toast('Nama peminjam dan judul buku wajib diisi', 'err');
    if (jumlah < 1 || jumlah > 50) return toast('Jumlah harus 1–50', 'err');
    const btn = $('pm-submit'); btn.disabled = true;
    // Tanpa .select(): pengunjung anonim hanya boleh INSERT, tidak boleh membaca tabel asli.
    const { error } = await sb.from('peminjaman').insert({
        nama, kelas: $('pm-kelas').value.trim(), judul, jumlah,
        no_buku: $('pm-nobuku').value.trim(), tgl_pinjam: $('pm-tgl').value || todayISO(),
        catatan: $('pm-catatan').value.trim()
    });
    btn.disabled = false;
    if (error) return dbError(error, 'Gagal menyimpan');
    ['pm-nama', 'pm-kelas', 'pm-judul', 'pm-nobuku', 'pm-catatan'].forEach(id => $(id).value = '');
    $('pm-jumlah').value = 1;
    toast('Peminjaman berhasil dicatat', 'ok');
    state.pmPage = 1;
    loadPeminjaman();
});
$('pm-export').addEventListener('click', () => {
    if (!state.pm.length) return toast('Belum ada data untuk diexport', 'err');
    const rows = state.pm.map((p, i) => ({
        'NO': i + 1, 'NAMA PEMINJAM': p.nama, 'KELAS/ GURU': p.kelas, 'JUDUL BUKU': p.judul, 'JUMLAH BUKU': p.jumlah,
        'TANGGAL PINJAM': tglIndo(p.tgl_pinjam), 'TANGGAL KEMBALI': tglIndo(p.tgl_kembali), 'NO BUKU': p.no_buku, 'CATATAN': p.catatan
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Peminjaman');
    XLSX.writeFile(wb, 'PEMINJAMAN BUKU.xlsx');
    toast('File Excel berhasil dibuat', 'ok');
});

// ==================== PENGAJUAN ====================
async function loadPengajuan() {
    const src = state.isAdmin ? 'pengajuan' : 'pengajuan_publik';
    const { data, error } = await sb.from(src).select('*').order('id', { ascending: false }).range(0, 1999);
    if (error) { dbError(error, 'Gagal memuat pengajuan'); return; }
    state.pg = data || [];
    renderPengajuan();
}
const PG_CSS = { Pending: 'b-warn pulse-soft', Diterima: 'b-ok', Ditolak: 'b-bad' };

function renderPengajuan() {
    const q = $('pg-search').value.trim().toLowerCase();
    const st = $('pg-status').value;
    const data = state.pg.filter(p => (!st || p.status === st) && (!q || `${p.pemohon} ${p.judul}`.toLowerCase().includes(q)));
    $('pg-tbody').innerHTML = data.length ? data.map(p => `
        <tr class="row-in">
            <td class="whitespace-nowrap text-slate-400">${tglIndo(p.created_at)}</td>
            <td><div class="font-semibold">${esc(namaTampil(p.pemohon))}</div><div class="text-[11px] text-slate-400">${esc(p.jabatan) || '-'}</div></td>
            <td class="font-semibold max-w-[240px]">${esc(p.judul)}</td>
            <td>${esc(p.penerbit) || '-'}</td>
            <td class="text-center font-bold">${p.qty}</td>
            <td><span class="badge b-info">${esc(p.alasan)}</span></td>
            <td><span class="badge ${PG_CSS[p.status] || 'b-info'}">${esc(p.status)}</span></td>
            ${state.isAdmin ? `<td class="text-center whitespace-nowrap">
                <button data-act="pg-status" data-status="Diterima" data-id="${p.id}" class="btn btn-green btn-sm" title="Setujui"><i class="fa-solid fa-check"></i></button>
                <button data-act="pg-status" data-status="Ditolak" data-id="${p.id}" class="btn btn-amber btn-sm" title="Tolak"><i class="fa-solid fa-ban"></i></button>
                <button data-act="pg-del" data-id="${p.id}" class="btn btn-red btn-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="8" class="text-center text-slate-400 py-10">Belum ada pengajuan.</td></tr>`;
}
$('pg-search').addEventListener('input', debounce(renderPengajuan, 140));
$('pg-status').addEventListener('change', renderPengajuan);

$('pg-submit').addEventListener('click', async () => {
    const pemohon = $('pg-nama').value.trim();
    const judul = $('pg-judul').value.trim();
    const qty = parseInt($('pg-jumlah').value, 10) || 1;
    if (!pemohon || !judul) return toast('Nama pemohon dan judul buku wajib diisi', 'err');
    if (qty < 1 || qty > 1000) return toast('Jumlah harus 1–1000', 'err');
    const btn = $('pg-submit'); btn.disabled = true;
    const { error } = await sb.from('pengajuan').insert({
        pemohon, jabatan: $('pg-jabatan').value.trim(), judul, penerbit: $('pg-penerbit').value.trim(),
        qty, alasan: $('pg-alasan').value, status: 'Pending'
    });
    btn.disabled = false;
    if (error) return dbError(error, 'Gagal mengirim');
    ['pg-nama', 'pg-jabatan', 'pg-judul', 'pg-penerbit'].forEach(id => $(id).value = '');
    $('pg-jumlah').value = 1;
    toast('Pengajuan terkirim, menunggu persetujuan admin', 'ok');
    loadPengajuan();
});
$('pg-export').addEventListener('click', () => {
    if (!state.pg.length) return toast('Belum ada data untuk diexport', 'err');
    const rows = state.pg.map((p, i) => ({
        'NO': i + 1, 'TANGGAL': tglIndo(p.created_at), 'NAMA PEMOHON': p.pemohon, 'MAPEL / JABATAN': p.jabatan,
        'JUDUL BUKU': p.judul, 'PENERBIT': p.penerbit, 'JUMLAH (QTY)': p.qty, 'ALASAN PENGAJUAN': p.alasan, 'STATUS': p.status
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pengajuan Buku');
    XLSX.writeFile(wb, 'DAFTAR PENGAJUAN BUKU BARU.xlsx');
    toast('File Excel berhasil dibuat', 'ok');
});

// ==================== DASHBOARD ====================
function renderStats() {
    const eks = state.inv.length;
    const judul = new Set(state.inv.map(i => i.group_id)).size;
    let baik = 0, kurang = 0, rusak = 0;
    state.inv.forEach(i => { if (i.kondisi === 'Baik') baik++; else if (i.kondisi === 'Kurang Baik') kurang++; else rusak++; });
    const dipinjam = state.pm.filter(p => !p.tgl_kembali).reduce((s, p) => s + (p.jumlah || 0), 0);

    const next = { judul, eks, dipinjam, baik };
    const ids = { judul: 'st-judul', eks: 'st-eks', dipinjam: 'st-dipinjam', baik: 'st-baik' };
    Object.keys(next).forEach(k => {
        if (next[k] !== state.shownStats[k]) animateCount($(ids[k]), next[k], state.shownStats[k]);
        state.shownStats[k] = next[k];
    });

    const pct = (n) => eks ? (n / eks * 100).toFixed(2) + '%' : '0%';
    $('bar-baik').style.width = pct(baik);
    $('bar-kurang').style.width = pct(kurang);
    $('bar-rusak').style.width = pct(rusak);
    $('lg-baik').textContent = fmt(baik);
    $('lg-kurang').textContent = fmt(kurang);
    $('lg-rusak').textContent = fmt(rusak);
}
function renderRecent() {
    const list = state.pm.slice(0, 5);
    $('recentLoans').innerHTML = list.length ? list.map(p => `
        <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition">
            <div class="min-w-0">
                <div class="font-semibold truncate">${esc(p.judul)}</div>
                <div class="text-[11px] text-slate-400">${esc(namaTampil(p.nama))} · ${tglIndo(p.tgl_pinjam)}</div>
            </div>
            ${p.tgl_kembali ? '<span class="badge b-ok">Kembali</span>' : '<span class="badge b-warn pulse-soft">Dipinjam</span>'}
        </div>`).join('')
        : '<p class="text-slate-400 text-sm">Belum ada peminjaman.</p>';
}
function updateOpenBadge() {
    const now = new Date();
    const mnt = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay(); // 0 = Minggu
    const rest = day !== 5 && mnt >= 720 && mnt < 780;
    const open = day >= 1 && day <= 6 && mnt >= 450 && mnt < 930 && !rest;
    const b = $('openBadge');
    b.textContent = open ? 'Buka Sekarang' : 'Tutup';
    b.className = 'badge ' + (open ? 'b-ok pulse-soft' : 'b-bad');
}

// ==================== INIT ====================
(async function init() {
    $('pm-tgl').value = todayISO();
    updateOpenBadge(); setInterval(updateOpenBadge, 60000);
    showPage(location.hash.slice(1) || 'dashboard');

    // Sesi login yang tersimpan (onAuthStateChange juga akan memicu pada INITIAL_SESSION)
    try {
        const { data } = await sb.auth.getSession();
        state.isAdmin = !!(data && data.session);
        setAdmin(state.isAdmin);
    } catch (e) { console.error(e); }

    await Promise.all([loadInventaris(), loadPeminjaman(), loadPengajuan()]);

    // Penyegaran berkala agar data tetap "real-time" untuk pengunjung
    setInterval(() => { if (!document.hidden) { loadPeminjaman(); loadPengajuan(); } }, 60000);
})();
