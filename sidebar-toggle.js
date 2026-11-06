/* =====================================================================
   MUSA PERPUS - ADD-ON: SIDEBAR BUKA / TUTUP
   File ini HANYA menambah fitur. Tidak ada kode lama yang diubah/dipindah.
   Pasang di index.html SETELAH script lainnya (paling bawah):
       <script src="sidebar-toggle.js"></script>
   ===================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'musaSidebarCollapsed';
    var SIDEBAR_WIDTH = '18rem'; // = w-72 pada sidebar lama

    function init() {
        var aside = document.querySelector('aside');
        if (!aside || document.getElementById('sidebarToggleBtn')) return;

        // Konten utama = elemen kembaran sidebar yang memakai margin kiri (ml-72)
        var content = aside.parentElement
            ? aside.parentElement.querySelector(':scope > .ml-72')
            : null;
        if (!content) return;

        // ---------- CSS tambahan (tidak menyentuh style lama) ----------
        var style = document.createElement('style');
        style.textContent = [
            'aside.sb-aside{transition:transform .3s ease,visibility 0s linear 0s;z-index:40;}',
            '.sb-content{transition:margin-left .3s ease;}',
            'body.sb-collapsed aside.sb-aside{transform:translateX(-100%);visibility:hidden;',
            '  transition:transform .3s ease,visibility 0s linear .3s;}',
            'body.sb-collapsed .sb-content{margin-left:0 !important;}',
            '#sidebarToggleBtn{position:fixed;top:50%;left:' + SIDEBAR_WIDTH + ';',
            '  transform:translateY(-50%);width:26px;height:56px;z-index:41;',
            '  display:flex;align-items:center;justify-content:center;',
            '  background:#1d4ed8;color:#fff;border:0;cursor:pointer;',
            '  border-radius:0 12px 12px 0;box-shadow:2px 0 8px rgba(0,0,0,.25);',
            '  transition:left .3s ease,background .2s ease;}',
            '#sidebarToggleBtn:hover{background:#1e40af;}',
            'body.sb-collapsed #sidebarToggleBtn{left:0;}',
            '#sidebarToggleBtn i{transition:transform .3s ease;font-size:12px;}',
            'body.sb-collapsed #sidebarToggleBtn i{transform:rotate(180deg);}',
            '@media print{#sidebarToggleBtn{display:none !important;}}'
        ].join('\n');
        document.head.appendChild(style);

        aside.classList.add('sb-aside');
        content.classList.add('sb-content');

        // ---------- Tombol toggle ----------
        var btn = document.createElement('button');
        btn.id = 'sidebarToggleBtn';
        btn.type = 'button';
        btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        document.body.appendChild(btn);

        function terapkan(tutup) {
            document.body.classList.toggle('sb-collapsed', tutup);
            btn.title = tutup ? 'Buka menu' : 'Tutup menu';
            btn.setAttribute('aria-label', btn.title);
            btn.setAttribute('aria-expanded', String(!tutup));
            try { localStorage.setItem(STORAGE_KEY, tutup ? '1' : '0'); } catch (_) {}
        }

        btn.addEventListener('click', function () {
            terapkan(!document.body.classList.contains('sb-collapsed'));
        });

        // Ingat pilihan terakhir; tanpa transisi saat halaman pertama dimuat
        var awal = false;
        try { awal = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) {}
        aside.style.transition = 'none';
        content.style.transition = 'none';
        btn.style.transition = 'none';
        terapkan(awal);
        // paksa reflow lalu kembalikan transisi
        void aside.offsetWidth;
        aside.style.transition = '';
        content.style.transition = '';
        btn.style.transition = '';
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
