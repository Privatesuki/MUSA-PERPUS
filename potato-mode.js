/* =====================================================================
   MUSA PERPUS - ADD-ON: POTATO MODE (mode ringan untuk HP/PC low-spec)
   File ini HANYA menambah perilaku. Tidak ada kode lama yang diubah/dihapus.

   Pasang di index.html SESUDAH </style> dan SEBELUM </head>
   (harus dimuat SEBELUM script.js):
       <script src="potato-mode.js"></script>

   Saat Potato Mode AKTIF:
     1. Blur/glassmorphism diganti warna solid, semua animasi & transisi dimatikan,
        aurora/blob dimatikan, kursor kustom & animasi mengetik dimatikan.
     2. Tabel Inventaris dibatasi maks. 25 baris/halaman, Peminjaman maks. 25.
     3. Interval latar (>= 5 detik: auto-refresh data, badge, rotasi notifikasi, dst.)
        diperlambat (lihat THROTTLE). Interval cepat (mis. scan kamera 220 ms) TIDAK disentuh.
     4. Hero banner jadi statis (gradien hijau), tanpa slideshow/panah/titik.
   Pilihan disimpan di localStorage ('musa_potato').
   ===================================================================== */
(function () {
    'use strict';

    // ---------- Pengaturan (silakan ubah) ----------
    var KEY = 'musa_potato';
    var MAX_BARIS = 25;       // batas baris per halaman saat Potato Mode aktif
    var THROTTLE = 4;         // interval >= 5 detik berjalan 4x lebih jarang (60 dtk -> 4 menit)
    var MIN_INTERVAL = 5000;  // hanya interval selevel ini ke atas yang diperlambat

    var root = document.documentElement;
    var isPotato = function () { return root.classList.contains('potato'); };

    var simpan = null;
    try { simpan = localStorage.getItem(KEY); } catch (_) {}
    var awalAktif = simpan === '1';
    if (awalAktif) root.classList.add('potato');          // dipasang sebelum halaman digambar -> tanpa "kedip"
    var bootedInPotato = awalAktif;

    // ---------- 1) Bungkus setInterval: perlambat interval latar saat Potato aktif ----------
    var siAsli = window.setInterval;
    window.setInterval = function (fn, ms) {
        if (typeof fn !== 'function' || !(ms >= MIN_INTERVAL)) return siAsli.apply(window, arguments);
        var args = Array.prototype.slice.call(arguments, 2), n = 0;
        return siAsli.call(window, function () {
            if (isPotato()) { n++; if (n % THROTTLE) return; } else { n = 0; }
            return fn.apply(this, args);
        }, ms);
    };

    // ---------- 2) Matikan kursor kustom & animasi mengetik sejak awal ----------
    // script.js menanyakan dua media query ini hanya SEKALI saat dimuat; jawaban kita membuat
    // initCursor() & initTyping() berhenti sendiri (teks statis), tanpa mengubah script.js.
    var mmAsli = window.matchMedia && window.matchMedia.bind(window);
    if (mmAsli) {
        window.matchMedia = function (q) {
            if (isPotato()) {
                var s = String(q).replace(/\s+/g, ' ').trim().toLowerCase();
                var palsu = null;
                if (s === '(prefers-reduced-motion: reduce)') palsu = true;
                else if (s === '(hover: hover) and (pointer: fine)') palsu = false;
                if (palsu !== null) {
                    return { matches: palsu, media: String(q), onchange: null,
                        addEventListener: function () {}, removeEventListener: function () {},
                        addListener: function () {}, removeListener: function () {}, dispatchEvent: function () { return false; } };
                }
            }
            return mmAsli(q);
        };
    }

    // ---------- 3) CSS Potato Mode (tidak menyentuh style lama) ----------
    var css = [
        /* tombol toggle */
        '.potato-btn{gap:.4rem;white-space:nowrap}',
        '.potato-track{position:relative;display:inline-block;flex:none;width:26px;height:14px;border-radius:999px;background:rgba(100,116,139,.5)}',
        '.potato-knob{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#fff}',
        '.potato-btn[aria-checked="true"]{border-color:rgba(245,158,11,.65)!important}',
        '.potato-btn[aria-checked="true"] .potato-track{background:#f59e0b}',
        '.potato-btn[aria-checked="true"] .potato-knob{left:14px}',
        '@media (max-width:639px){.potato-label{display:none}}',

        /* semua animasi & transisi mati */
        'html.potato,html.potato body{scroll-behavior:auto!important}',
        'html.potato *,html.potato *::before,html.potato *::after{animation:none!important;transition:none!important;will-change:auto!important}',

        /* glassmorphism -> warna solid, tanpa blur */
        'html.potato[data-theme="light"]{--glass:#ffffff}',
        'html.potato[data-theme="dark"]{--glass:#13211a}',
        'html.potato .glass,html.potato .btn-onhero,html.potato .b-hero,html.potato .hero-arrow,html.potato .modal-wrap,html.potato [class*="backdrop-blur"]{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}',
        'html.potato .glass{box-shadow:0 1px 3px rgba(0,0,0,.12)!important}',
        'html.potato .glass-hover:hover{transform:none!important;box-shadow:0 1px 3px rgba(0,0,0,.12)!important}',
        'html.potato .modal-wrap{background:rgba(15,42,29,.62)!important}',
        'html.potato .modal-card{box-shadow:0 4px 14px rgba(0,0,0,.25)!important}',
        'html.potato #heroBanner{box-shadow:none!important}',

        /* latar aurora & blob */
        'html.potato .aurora{background:var(--bg)!important}',
        'html.potato .aurora .blob{display:none!important}',

        /* kursor kustom & caret mengetik */
        'html.potato .cur-dot,html.potato .cur-ring,html.potato .caret{display:none!important}',
        'html.potato body.cursor-ready{cursor:auto!important}',
        'html.potato body.cursor-ready a,html.potato body.cursor-ready button,html.potato body.cursor-ready select,html.potato body.cursor-ready label{cursor:pointer!important}',
        'html.potato body.cursor-ready input,html.potato body.cursor-ready textarea{cursor:text!important}',

        /* hero banner statis */
        'html.potato #heroSlides,html.potato #heroDots,html.potato #heroPrev,html.potato #heroNext{display:none!important}',

        /* teks berjalan notifikasi telat -> statis, bisa digeser */
        'html.potato .telat-compact .telat-marquee{overflow-x:auto!important}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'potatoModeStyle';
    style.textContent = css;
    document.head.appendChild(style);

    // ---------- 4) Bagian yang butuh DOM + script.js ----------
    var $ = function (id) { return document.getElementById(id); };
    var btn = null;
    var typingAsli = null, typingStub = null;
    var invSebelum = null;

    function syncTombol() {
        if (!btn) return;
        var on = isPotato();
        btn.setAttribute('aria-checked', String(on));
        btn.title = on ? 'Potato Mode AKTIF (klik untuk mematikan)' : 'Potato Mode: mode ringan untuk HP/PC spek rendah';
        btn.setAttribute('aria-label', btn.title);
    }

    // Animasi mengetik yang sudah berjalan: alihkan ke elemen "bayangan" statis (live toggle)
    function tukarTyping(on) {
        if (bootedInPotato) return;                       // sudah statis sejak awal
        var el = typingAsli || $('typingText');
        if (!el) return;
        if (on) {
            if (typingStub && typingStub.isConnected) return;
            typingAsli = el;
            typingStub = document.createElement('span');
            typingStub.className = el.className;
            typingStub.textContent = 'Selamat Datang di MUSA PERPUS';
            el.replaceWith(typingStub);                   // loop lama menulis ke elemen terlepas (tanpa biaya render)
        } else if (typingStub && typingStub.isConnected && typingAsli) {
            typingStub.replaceWith(typingAsli);
        }
    }

    function setInvPer(nilai) {
        var sel = $('inv-perpage');
        if (!sel) return;
        sel.value = String(nilai);
        if (sel.value !== String(nilai)) return;          // opsi tidak ada
        sel.dispatchEvent(new Event('change'));           // pakai handler asli script.js -> render ulang
    }

    function batasiBaris(on) {
        try {
            if (typeof state === 'undefined') return;
            var sel = $('inv-perpage');
            if (on) {
                if (invSebelum == null) invSebelum = state.invPer;
                if (sel) Array.prototype.forEach.call(sel.options, function (o) {
                    var besar = +o.value > MAX_BARIS; o.disabled = besar; o.hidden = besar;
                });
                if (state.invPer > MAX_BARIS) setInvPer(MAX_BARIS);
                if (state.pmPer > MAX_BARIS) {
                    state.pmPer = MAX_BARIS; state.pmPage = 1;
                    if (typeof renderPeminjaman === 'function') renderPeminjaman();
                }
            } else {
                if (sel) Array.prototype.forEach.call(sel.options, function (o) { o.disabled = false; o.hidden = false; });
                if (invSebelum != null && invSebelum !== state.invPer) setInvPer(invSebelum);
                invSebelum = null;
            }
        } catch (err) { console.error('potato-mode (baris):', err); }
    }

    function terapkan(on, dariKlik) {
        root.classList.toggle('potato', on);
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
        tukarTyping(on);
        batasiBaris(on);
        syncTombol();
        if (dariKlik && typeof toast === 'function') {
            if (on) toast('Potato Mode aktif: tampilan dibuat lebih ringan', 'ok');
            else if (bootedInPotato) toast('Potato Mode mati. Muat ulang halaman untuk mengaktifkan kembali kursor kustom & animasi mengetik.', 'ok', 5500);
            else toast('Potato Mode dimatikan', 'ok');
        }
    }

    function init() {
        if (!$('potatoBtn')) {
            btn = document.createElement('button');
            btn.id = 'potatoBtn';
            btn.type = 'button';
            btn.className = 'btn btn-ghost btn-sm potato-btn';
            btn.setAttribute('role', 'switch');
            btn.innerHTML = '<i class="fa-solid fa-gauge-high"></i><span class="potato-label text-xs">Potato</span>' +
                            '<span class="potato-track" aria-hidden="true"><span class="potato-knob"></span></span>';
            var tema = $('themeBtn');
            if (tema && tema.parentNode) tema.parentNode.insertBefore(btn, tema);
            else { var h = document.querySelector('header'); if (h) h.appendChild(btn); }
            btn.addEventListener('click', function () { terapkan(!isPotato(), true); });
        } else btn = $('potatoBtn');

        if (isPotato()) batasiBaris(true);
        syncTombol();
    }

    window.MusaPotato = {
        isOn: isPotato,
        on: function () { terapkan(true, false); },
        off: function () { terapkan(false, false); },
        toggle: function () { terapkan(!isPotato(), false); }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
