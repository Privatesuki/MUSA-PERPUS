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
const PAGES = ['dashboard', 'inventaris', 'peminjaman', 'pengajuan', 'cetak'];
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
            <td class="text-center text-slate-500">${start + i + 1}</td>
            <td class="font-mono font-semibold text-emerald-800 whitespace-nowrap">${esc(it.no_inventaris)}</td>
            <td class="font-semibold">${esc(it.nama)}</td>
            <td class="text-slate-600">${esc(it.merek) || '-'}</td>
            <td class="text-center">${it.tahun}</td>
            <td class="text-center">${it.eksemplar}</td>
            <td><span class="badge b-info">${esc(it.kategori || 'Umum')}</span></td>
            <td class="text-center"><span class="badge ${KOND_CSS[it.kondisi] || 'b-info'}">${esc(it.kondisi)}</span></td>
            ${admin ? `<td class="text-center whitespace-nowrap">
                <button data-act="inv-edit" data-id="${it.id}" class="btn btn-amber btn-sm" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button data-act="inv-del" data-id="${it.id}" class="btn btn-red btn-sm" title="Hapus eksemplar"><i class="fa-solid fa-trash"></i></button>
            </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="9" class="text-center text-slate-500 py-10">${state.inv.length ? 'Tidak ada data yang cocok.' : 'Belum ada data inventaris.'}</td></tr>`;

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
async function insertBatches(rows, size = 500, table = 'inventaris') {
    for (let i = 0; i < rows.length; i += size) {
        const { error } = await sb.from(table).insert(rows.slice(i, i + size));
        if (error) throw error;
        const msg = `Menyimpan ${fmt(Math.min(i + size, rows.length))} / ${fmt(rows.length)} data…`;
        if (table === 'inventaris') $('inv-count').textContent = msg; else toast(msg, 'info', 1200);
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
    if (!b) return;
    // Konfirmasi pengembalian boleh dilakukan siapa saja (bukan hanya admin)
    if (b.dataset.act === 'pm-return') return kembalikanBuku(Number(b.dataset.id));
    if (!state.isAdmin) return;
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
    renderPeminjaman(); renderStats(); renderRecent(); renderKelasStats();
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
            <td data-label="No" class="text-center text-slate-500">${start + i + 1}</td>
            <td data-label="Peminjam" class="font-semibold">${esc(namaTampil(p.nama))}</td>
            <td data-label="Kelas">${esc(p.kelas) || '-'}</td>
            <td data-label="Judul Buku" class="max-w-[260px] truncate" title="${esc(p.judul)}">${esc(p.judul)}</td>
            <td data-label="Jumlah" class="text-center font-bold">${p.jumlah}</td>
            <td data-label="Tgl Pinjam" class="whitespace-nowrap">${tglIndo(p.tgl_pinjam)}</td>
            <td data-label="Status">${p.tgl_kembali
                ? `<span class="badge b-ok"><i class="fa-solid fa-check"></i> Kembali ${tglIndo(p.tgl_kembali)}</span>`
                : `<button type="button" data-act="pm-return" data-id="${p.id}" class="status-btn pulse-soft" title="Klik untuk konfirmasi sudah dikembalikan"><i class="fa-solid fa-hourglass-half"></i> Dipinjam · klik jika kembali</button>`}</td>
            <td data-label="No Buku" class="font-mono text-xs text-slate-600">${esc(p.no_buku) || '-'}</td>
            <td data-label="Catatan" class="max-w-[160px] truncate text-slate-500" title="${esc(p.catatan)}">${esc(p.catatan) || '-'}</td>
            ${state.isAdmin ? `<td data-label="Aksi" class="text-center whitespace-nowrap">
                <button data-act="pm-del" data-id="${p.id}" class="btn btn-red btn-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="10" class="text-center text-slate-500 py-10">Belum ada data peminjaman.</td></tr>`;
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
        nama, kelas: $('pm-kelas').value.trim().toUpperCase().replace(/\s+/g, ' '), judul, jumlah,
        no_buku: $('pm-nobuku').value.trim(), tgl_pinjam: $('pm-tgl').value || todayISO(),
        catatan: $('pm-catatan').value.trim()
    });
    btn.disabled = false;
    if (error) return dbError(error, 'Gagal menyimpan');
    ['pm-nama', 'pm-kelas', 'pm-judul', 'pm-nobuku', 'pm-catatan'].forEach(id => $(id).value = '');
    $('pm-jumlah').value = 1;
    toast('Peminjaman berhasil dicatat', 'ok');
    document.dispatchEvent(new CustomEvent('pm:saved'));
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
            <td class="whitespace-nowrap text-slate-500">${tglIndo(p.created_at)}</td>
            <td><div class="font-semibold">${esc(namaTampil(p.pemohon))}</div><div class="text-[11px] text-slate-500">${esc(p.jabatan) || '-'}</div></td>
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
        : `<tr><td colspan="8" class="text-center text-slate-500 py-10">Belum ada pengajuan.</td></tr>`;
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
        <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition">
            <div class="min-w-0">
                <div class="font-semibold truncate">${esc(p.judul)}</div>
                <div class="text-[11px] text-slate-500">${esc(namaTampil(p.nama))} · ${tglIndo(p.tgl_pinjam)}</div>
            </div>
            ${p.tgl_kembali ? '<span class="badge b-ok">Kembali</span>' : '<span class="badge b-warn pulse-soft">Dipinjam</span>'}
        </div>`).join('')
        : '<p class="text-slate-500 text-sm">Belum ada peminjaman.</p>';
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

// ==================== IMPORT EXCEL: PEMINJAMAN & PENGAJUAN (ADMIN) ====================
function parseTanggal(v) {
    if (v == null || v === '' || v === '-') return null;
    const valid = (y, m, d) => (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)
        ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
    if (v instanceof Date) {
        if (isNaN(v)) return null;
        return new Date(v.getTime() + 12 * 3600 * 1000).toLocaleDateString('en-CA'); // +12 jam: aman dari selisih zona waktu
    }
    if (typeof v === 'number') {
        const p = XLSX.SSF.parse_date_code(v);
        return p ? valid(p.y, p.m, p.d) : null;
    }
    const s = String(v).trim().split(' ')[0];
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    return null;
}
// Baca sheet pertama; nama kolom dinormalkan: "KELAS/ GURU" -> "KELASGURU", "CATATAN'" -> "CATATAN"
function bacaExcelRows(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
                resolve(rows.map(r => {
                    const o = {};
                    Object.keys(r).forEach(k => { o[String(k).toUpperCase().replace(/[^A-Z0-9]/g, '')] = r[k]; });
                    return o;
                }));
            } catch (e) { reject(e); }
        };
        reader.readAsArrayBuffer(file);
    });
}
const pick = (o, ...keys) => { for (const k of keys) { if (o[k] !== undefined && String(o[k]).trim() !== '') return o[k]; } return ''; };
const bersih = (v, max) => { const s = String(v == null ? '' : v).trim(); return (s === '-' ? '' : s).slice(0, max); };

$('pm-import').addEventListener('click', () => $('pm-file').click());
$('pm-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !state.isAdmin) return;
    try {
        const rows = await bacaExcelRows(file);
        const out = []; let lewat = 0;
        rows.forEach(o => {
            const nama = bersih(pick(o, 'NAMAPEMINJAM', 'NAMA'), 100);
            const judul = bersih(pick(o, 'JUDULBUKU', 'JUDUL'), 250);
            if (!nama || !judul) { lewat++; return; }
            out.push({
                nama, judul,
                kelas: bersih(pick(o, 'KELASGURU', 'KELAS'), 60),
                jumlah: Math.min(50, Math.max(1, parseInt(pick(o, 'JUMLAHBUKU', 'JUMLAH'), 10) || 1)),
                tgl_pinjam: parseTanggal(pick(o, 'TANGGALPINJAM')) || todayISO(),
                tgl_kembali: parseTanggal(pick(o, 'TANGGALKEMBALI')),
                no_buku: bersih(pick(o, 'NOBUKU'), 60),
                catatan: bersih(pick(o, 'CATATAN'), 200)
            });
        });
        if (!out.length) return toast('Tidak ada baris valid (butuh kolom NAMA PEMINJAM & JUDUL BUKU)', 'err', 5000);
        if (!confirm(`Tambahkan ${fmt(out.length)} data peminjaman ke database?` + (lewat ? `\n(${lewat} baris kosong dilewati)` : ''))) return;
        await insertBatches(out, 500, 'peminjaman');
        toast(`Import selesai: ${fmt(out.length)} data peminjaman`, 'ok', 5000);
        await loadPeminjaman();
    } catch (err) { dbError(err, 'Import peminjaman gagal'); }
});

$('pg-import').addEventListener('click', () => $('pg-file').click());
$('pg-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !state.isAdmin) return;
    const statusMap = { pending: 'Pending', ditunggu: 'Pending', diterima: 'Diterima', ditolak: 'Ditolak' };
    try {
        const rows = await bacaExcelRows(file);
        const out = []; let lewat = 0;
        rows.forEach(o => {
            const pemohon = bersih(pick(o, 'NAMAPEMOHON', 'PEMOHON'), 100);
            const judul = bersih(pick(o, 'JUDULBUKU', 'JUDUL'), 250);
            if (!pemohon || !judul) { lewat++; return; }
            const row = {
                pemohon, judul,
                jabatan: bersih(pick(o, 'MAPELJABATAN', 'JABATAN', 'MAPEL'), 100),
                penerbit: bersih(pick(o, 'PENERBIT'), 100),
                qty: Math.min(1000, Math.max(1, parseInt(pick(o, 'JUMLAHQTY', 'QTY', 'JUMLAH'), 10) || 1)),
                alasan: bersih(pick(o, 'ALASANPENGAJUAN', 'ALASAN'), 100) || 'Update Kurikulum Baru',
                status: statusMap[String(pick(o, 'STATUS')).trim().toLowerCase()] || 'Pending'
            };
            const tgl = parseTanggal(pick(o, 'TANGGAL'));
            if (tgl) row.created_at = tgl + 'T05:00:00Z';
            out.push(row);
        });
        if (!out.length) return toast('Tidak ada baris valid (butuh kolom NAMA PEMOHON & JUDUL BUKU)', 'err', 5000);
        if (!confirm(`Tambahkan ${fmt(out.length)} pengajuan buku ke database?` + (lewat ? `\n(${lewat} baris kosong dilewati)` : ''))) return;
        await insertBatches(out, 500, 'pengajuan');
        toast(`Import selesai: ${fmt(out.length)} pengajuan`, 'ok', 5000);
        await loadPengajuan();
    } catch (err) { dbError(err, 'Import pengajuan gagal'); }
});

// ==================== HERO SLIDESHOW ====================
(function initSlideshow() {
    const box = $('heroSlides'), dots = $('heroDots'), hero = $('heroBanner');
    if (!box || !dots) return;
    const imgs = ['assets/img/kayu.jpeg', 'assets/img/lemari.jpeg', 'assets/img/perpus.jpeg', 'assets/img/rame.jpeg'];
    const slides = imgs.map(src => {
        const d = document.createElement('div');
        d.className = 'hero-slide';
        d.style.backgroundImage = `url('${src}')`;
        box.appendChild(d);
        return d;
    });
    dots.innerHTML = imgs.map((_, i) => `<button class="hero-dot" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
    let cur = 0, timer = null;
    const go = (i) => {
        cur = (i + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle('active', k === cur));
        dots.querySelectorAll('.hero-dot').forEach((b, k) => b.classList.toggle('active', k === cur));
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { stop(); timer = setInterval(() => go(cur + 1), 5000); };
    $('heroPrev').addEventListener('click', () => { go(cur - 1); start(); });
    $('heroNext').addEventListener('click', () => { go(cur + 1); start(); });
    dots.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { go(+b.dataset.i); start(); } });
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    go(0); start();
})();

// ==================== CETAK PUNGGUNG BUKU ====================
const INSTANSI = 'SMK MUHAMMADIYAH 1 PRINGSEWU';
state.antrean = [];

function renderLabel() {
    $('lb-count').textContent = state.antrean.length;
    $('lb-tbody').innerHTML = state.antrean.length ? state.antrean.map((it, i) => `
        <tr>
            <td class="text-center font-bold">${i + 1}</td>
            <td>${esc(it.instansi)}</td>
            <td class="font-mono font-semibold">${esc(it.klasifikasi)}</td>
            <td>${esc(it.pengarang)}</td>
            <td>${esc(it.judul)}</td>
            <td class="text-center"><button data-lb-del="${i}" class="btn btn-red btn-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('')
        : `<tr><td colspan="6" class="text-center text-slate-500 py-8">Belum ada data label yang ditambahkan.</td></tr>`;
}
$('lb-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const klasifikasi = $('lb-klas').value.trim();
    const pengarang = $('lb-peng').value.trim();
    const judul = $('lb-judul').value.trim();
    const qty = Math.min(500, Math.max(1, parseInt($('lb-qty').value, 10) || 1));
    if (!klasifikasi || !pengarang || !judul) return toast('Semua kolom bertanda (*) wajib diisi!', 'err');
    for (let i = 0; i < qty; i++) state.antrean.push({ instansi: INSTANSI, klasifikasi, pengarang, judul });
    renderLabel();
    toast(`${qty} label ditambahkan ke daftar`, 'ok', 2200);
    $('lb-klas').value = ''; $('lb-peng').value = ''; $('lb-judul').value = ''; $('lb-qty').value = 1;
    $('lb-klas').focus();
});
$('lb-tbody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb-del]');
    if (!b) return;
    state.antrean.splice(Number(b.dataset.lbDel), 1);
    renderLabel();
});
$('lb-reset').addEventListener('click', () => {
    if (!state.antrean.length) return;
    if (confirm('Yakin ingin mengosongkan semua data label?')) { state.antrean = []; renderLabel(); }
});
$('lb-print').addEventListener('click', () => {
    if (!state.antrean.length) return toast('Tidak ada data label untuk dicetak!', 'err');
    const w = window.open('', '_blank');
    if (!w) return toast('Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.', 'err', 5000);

    let rowsHtml = '';
    for (let i = 0; i < state.antrean.length; i += 3) {
        const chunk = state.antrean.slice(i, i + 3);
        rowsHtml += '<tr>';
        chunk.forEach(it => {
            const inst = esc(it.instansi).replace('PRINGSEWU', '<br>PRINGSEWU');
            rowsHtml += `<td class="label-card"><div class="instansi-box">${inst}</div>
                <div class="content-box"><div class="klasifikasi">${esc(it.klasifikasi)}</div><div class="pengarang">${esc(it.pengarang)}</div><div class="judul">${esc(it.judul)}</div></div></td>`;
        });
        for (let j = chunk.length; j < 3; j++) rowsHtml += '<td class="label-card"></td>';
        rowsHtml += '</tr>';
    }
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cetak Label Punggung Buku</title><style>
        * { box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
        @page { size: A4 portrait; margin: 0.8cm; }
        body { font-family: Arial, sans-serif !important; background: #fff !important; }
        table.label-table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; border: 3px solid #000 !important; }
        table.label-table tr { page-break-inside: avoid !important; }
        td.label-card { border: 3px solid #000 !important; text-align: center !important; vertical-align: top !important; background: #fff !important; }
        .instansi-box { font-size: 13px !important; font-weight: bold !important; text-transform: uppercase !important; line-height: 1.25 !important; border-bottom: 3px solid #000 !important; padding: 6px 2px !important; width: 100% !important; }
        .content-box { padding: 6px 2px 8px 2px !important; display: flex !important; flex-direction: column !important; gap: 2px !important; }
        .klasifikasi { font-size: 13px !important; } .pengarang, .judul { font-size: 12px !important; }
        </style></head><body><table class="label-table"><tbody>${rowsHtml}</tbody></table>
        <script>window.onload = function () { window.print(); window.close(); };<\/script></body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
});
$('lb-export').addEventListener('click', () => {
    if (!state.antrean.length) return toast('Tidak ada data label untuk diekspor!', 'err');
    const rows = state.antrean.map((it, i) => ({
        'NO': i + 1, 'INSTANSI': it.instansi, 'NO KLASIFIKASI': it.klasifikasi, 'INISIAL PENGARANG': it.pengarang, 'INISIAL JUDUL': it.judul
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Label Punggung');
    XLSX.writeFile(wb, 'LABEL PUNGGUNG BUKU.xlsx');
    toast('File Excel label berhasil dibuat', 'ok');
});
renderLabel();

// ==================== KONFIRMASI PENGEMBALIAN (ADMIN & USER BIASA) ====================
async function kembalikanBuku(id) {
    const p = state.pm.find(x => x.id === id);
    if (!p || p.tgl_kembali) return;
    if (!confirm(`Konfirmasi buku "${p.judul}" sudah dikembalikan?\nTanggal pengembalian dicatat hari ini (${tglIndo(todayISO())}).`)) return;
    // Admin: update langsung. Pengunjung biasa: lewat fungsi database khusus (lihat supabase-kembalikan-buku.sql)
    const { error } = state.isAdmin
        ? await sb.from('peminjaman').update({ tgl_kembali: todayISO() }).eq('id', id)
        : await sb.rpc('kembalikan_buku', { p_id: id });
    if (error) return dbError(error, 'Gagal mengonfirmasi pengembalian');
    toast('Buku ditandai sudah dikembalikan', 'ok');
    p.tgl_kembali = todayISO(); renderPeminjaman(); renderStats(); renderRecent(); renderKelasStats();
    loadPeminjaman();
}

// ==================== DROPDOWN KELAS (ketik -> pilih) ====================
// Ubah/tambah jurusan di sini. Hasil: X AKUNTANSI, XI AKUNTANSI, XII AKUNTANSI, dst.
const TINGKAT = ['X', 'XI', 'XII'];
const JURUSAN = ['AKUNTANSI', 'PEMASARAN', 'FARMASI', 'BDP'];
const KELAS_LIST = TINGKAT.flatMap(t => JURUSAN.map(j => `${t} ${j}`)).concat(['GURU', 'STAFF']);

(function initKelasCombobox() {
    const inp = $('pm-kelas'), box = $('pm-kelas-list');
    let items = [], idx = -1;
    const close = () => { box.classList.add('hidden'); inp.setAttribute('aria-expanded', 'false'); idx = -1; };
    const pilih = (v) => { inp.value = v; close(); };
    function render() {
        const raw = inp.value.toUpperCase();
        const q = raw.trim().split(/\s+/).filter(Boolean);
        const joined = q.join(' ');
        items = KELAS_LIST.filter(k => {
            if (!q.length) return true;
            if (raw.endsWith(' ') && q.length === 1 && TINGKAT.includes(q[0])) return k.startsWith(q[0] + ' ');
            const w = k.split(' ');
            return q.every(t => w.some(x => x.startsWith(t)));
        }).sort((a, b) => (b.startsWith(joined) - a.startsWith(joined)));
        const custom = joined && !KELAS_LIST.includes(joined);
        box.innerHTML = items.map((k, i) => `<div class="cb-item" role="option" data-v="${esc(k)}" data-i="${i}">${esc(k)}</div>`).join('')
            + (custom ? `<div class="cb-item custom" data-v="${esc(joined)}">Gunakan “${esc(joined)}”</div>` : '');
        idx = -1;
        box.classList.toggle('hidden', !box.children.length);
        inp.setAttribute('aria-expanded', String(box.children.length > 0));
    }
    const mark = () => [...box.children].forEach((c, i) => { c.classList.toggle('on', i === idx); if (i === idx) c.scrollIntoView({ block: 'nearest' }); });
    inp.addEventListener('focus', render);
    inp.addEventListener('input', render);
    inp.addEventListener('blur', () => { setTimeout(close, 120); inp.value = inp.value.toUpperCase().replace(/\s+/g, ' ').trim(); });
    inp.addEventListener('keydown', (e) => {
        const n = box.children.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); if (box.classList.contains('hidden')) render(); idx = (idx + 1) % Math.max(n, 1); mark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + n) % Math.max(n, 1); mark(); }
        else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pilih(box.children[idx].dataset.v); }
        else if (e.key === 'Escape') close();
    });
    // pointerdown + preventDefault: pilihan terpilih sebelum input kehilangan fokus (aman di HP/iPad)
    box.addEventListener('pointerdown', (e) => {
        const it = e.target.closest('[data-v]');
        if (!it) return;
        e.preventDefault(); pilih(it.dataset.v);
    });
})();

// ==================== STATISTIK KELAS (DASBOR) ====================
function renderKelasStats() {
    const el = $('kelasStats'); if (!el) return;
    const m = new Map();
    state.pm.forEach(p => {
        const k = String(p.kelas || '').trim().toUpperCase().replace(/\s+/g, ' ');
        if (!k || k === '-') return;
        const o = m.get(k) || { n: 0, buku: 0 };
        o.n++; o.buku += p.jumlah || 1; m.set(k, o);
    });
    const rows = [...m].sort((a, b) => b[1].n - a[1].n || b[1].buku - a[1].buku).slice(0, 8);
    const top = $('kelasTop');
    if (!rows.length) { el.innerHTML = '<p class="text-sm text-slate-500 md:col-span-2">Belum ada data kelas peminjam.</p>'; top.classList.add('hidden'); return; }
    top.textContent = `Terbanyak: ${rows[0][0]}`; top.classList.remove('hidden');
    const max = rows[0][1].n;
    el.innerHTML = rows.map(([k, o], i) => `
        <div>
            <div class="flex items-center justify-between gap-3 text-sm mb-1.5">
                <span class="font-semibold text-emerald-950 truncate"><span class="text-slate-400 font-bold mr-1">${i + 1}.</span>${esc(k)}</span>
                <span class="text-xs text-slate-500 whitespace-nowrap"><b class="text-emerald-900">${fmt(o.n)}</b> pinjam · ${fmt(o.buku)} buku</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, o.n / max * 100).toFixed(1)}%"></div></div>
        </div>`).join('');
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
