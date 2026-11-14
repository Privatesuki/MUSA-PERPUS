-- =====================================================================
-- MUSA PERPUS - FITUR BARU
--   1) Ulasan & rating buku populer
--   2) Suka + komentar pada usulan buku (pengajuan)
--   3) Data siswa (NIS -> nama & kelas) untuk scan kartu pelajar
-- Jalankan SETELAH supabase-schema.sql, di Supabase > SQL Editor.
-- Aman dijalankan ulang (if not exists / create or replace).
-- Cara kerja identitas pengunjung: setiap browser membuat kode acak (device_id)
-- yang TIDAK pernah ditampilkan. Kode ini dipakai untuk membuktikan bahwa
-- ulasan/komentar itu milik browser tersebut (boleh diedit oleh pemiliknya).
-- Semua penulisan publik lewat fungsi di bawah; tabel tidak bisa diakses langsung.
-- =====================================================================

-- ---------- 1) ULASAN BUKU ----------
create table if not exists public.buku_ulasan (
  id          bigint generated always as identity primary key,
  judul       text not null check (char_length(judul) between 1 and 250),   -- disimpan HURUF BESAR
  nama        text not null check (char_length(nama)  between 1 and 60),
  kelas       text default '' check (char_length(kelas) <= 60),
  rating      int  not null check (rating between 1 and 5),
  ulasan      text default '' check (char_length(ulasan) <= 300),
  device_id   text not null check (char_length(device_id) >= 16),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (device_id, judul)                       -- 1 ulasan per perangkat per buku (bisa diedit)
);
alter table public.buku_ulasan enable row level security;
drop policy if exists ulasan_admin on public.buku_ulasan;
create policy ulasan_admin on public.buku_ulasan for all to authenticated using (true) with check (true);

create or replace view public.buku_ulasan_publik as
  select id, judul, nama, kelas, rating, ulasan, created_at, updated_at from public.buku_ulasan;

create or replace function public.simpan_ulasan(
  p_device text, p_judul text, p_nama text, p_kelas text, p_rating int, p_ulasan text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_device is null or char_length(p_device) < 16 then raise exception 'perangkat tidak valid'; end if;
  if coalesce(trim(p_judul),'') = '' or coalesce(trim(p_nama),'') = '' then raise exception 'judul dan nama wajib'; end if;
  insert into public.buku_ulasan (judul, nama, kelas, rating, ulasan, device_id)
  values (upper(left(regexp_replace(trim(p_judul), '\s+', ' ', 'g'), 250)),
          left(trim(p_nama), 60), left(coalesce(trim(p_kelas),''), 60),
          greatest(1, least(5, p_rating)), left(coalesce(trim(p_ulasan),''), 300), p_device)
  on conflict (device_id, judul) do update
     set nama = excluded.nama, kelas = excluded.kelas, rating = excluded.rating,
         ulasan = excluded.ulasan, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- ---------- 2) SUKA + KOMENTAR USULAN BUKU ----------
create table if not exists public.pengajuan_suka (
  pengajuan_id bigint not null references public.pengajuan(id) on delete cascade,
  device_id    text   not null check (char_length(device_id) >= 16),
  created_at   timestamptz default now(),
  primary key (pengajuan_id, device_id)
);
create table if not exists public.pengajuan_komentar (
  id           bigint generated always as identity primary key,
  pengajuan_id bigint not null references public.pengajuan(id) on delete cascade,
  nama         text   not null check (char_length(nama) between 1 and 60),
  komentar     text   not null check (char_length(komentar) between 1 and 300),
  device_id    text   not null check (char_length(device_id) >= 16),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists pengajuan_komentar_idx on public.pengajuan_komentar (pengajuan_id);

alter table public.pengajuan_suka     enable row level security;
alter table public.pengajuan_komentar enable row level security;
drop policy if exists suka_admin on public.pengajuan_suka;
drop policy if exists kom_admin  on public.pengajuan_komentar;
create policy suka_admin on public.pengajuan_suka     for all to authenticated using (true) with check (true);
create policy kom_admin  on public.pengajuan_komentar for all to authenticated using (true) with check (true);

create or replace view public.pengajuan_suka_jumlah as
  select pengajuan_id, count(*)::int as jumlah from public.pengajuan_suka group by pengajuan_id;
create or replace view public.pengajuan_komentar_publik as
  select id, pengajuan_id, nama, komentar, created_at, updated_at from public.pengajuan_komentar;

-- tombol Suka: sekali klik = suka, klik lagi = batal
create or replace function public.toggle_suka(p_device text, p_pengajuan bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_liked boolean; v_n int;
begin
  if p_device is null or char_length(p_device) < 16 then raise exception 'perangkat tidak valid'; end if;
  if exists (select 1 from public.pengajuan_suka where pengajuan_id = p_pengajuan and device_id = p_device) then
    delete from public.pengajuan_suka where pengajuan_id = p_pengajuan and device_id = p_device;
    v_liked := false;
  else
    insert into public.pengajuan_suka (pengajuan_id, device_id) values (p_pengajuan, p_device);
    v_liked := true;
  end if;
  select count(*)::int into v_n from public.pengajuan_suka where pengajuan_id = p_pengajuan;
  return jsonb_build_object('liked', v_liked, 'jumlah', v_n);
end $$;

create or replace function public.tambah_komentar(p_device text, p_pengajuan bigint, p_nama text, p_komentar text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_device is null or char_length(p_device) < 16 then raise exception 'perangkat tidak valid'; end if;
  if coalesce(trim(p_nama),'') = '' or coalesce(trim(p_komentar),'') = '' then raise exception 'nama dan komentar wajib'; end if;
  insert into public.pengajuan_komentar (pengajuan_id, nama, komentar, device_id)
  values (p_pengajuan, left(trim(p_nama), 60), left(trim(p_komentar), 300), p_device)
  returning id into v_id;
  return v_id;
end $$;

-- hanya pemilik komentar (perangkat yang sama) yang bisa mengedit
create or replace function public.edit_komentar(p_device text, p_id bigint, p_komentar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_komentar),'') = '' then raise exception 'komentar wajib'; end if;
  update public.pengajuan_komentar
     set komentar = left(trim(p_komentar), 300), updated_at = now()
   where id = p_id and device_id = p_device;
  if not found then raise exception 'bukan komentar milikmu'; end if;
end $$;

-- daftar id milik perangkat ini (untuk menandai "Suka" aktif & tombol Edit)
create or replace function public.saya(p_device text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'suka',     coalesce((select jsonb_agg(pengajuan_id) from public.pengajuan_suka     where device_id = p_device), '[]'::jsonb),
    'komentar', coalesce((select jsonb_agg(id)           from public.pengajuan_komentar where device_id = p_device), '[]'::jsonb),
    'ulasan',   coalesce((select jsonb_agg(id)           from public.buku_ulasan        where device_id = p_device), '[]'::jsonb));
$$;

-- ---------- 3) DATA SISWA (kartu pelajar: NIS -> nama & kelas) ----------
create table if not exists public.siswa (
  nis        text primary key check (char_length(nis) between 1 and 30),
  nama       text not null check (char_length(nama) between 1 and 100),
  kelas      text default '',
  created_at timestamptz default now()
);
alter table public.siswa enable row level security;
drop policy if exists siswa_admin on public.siswa;
-- NIS hanya terlihat & bisa diubah oleh admin (user yang login)
create policy siswa_admin on public.siswa for all to authenticated using (true) with check (true);

-- Pengunjung hanya bisa menanyakan 1 NIS -> mendapat nama & kelas (tanpa NIS lain, tanpa daftar)
create or replace function public.cari_siswa(p_nis text)
returns table (nama text, kelas text)
language sql security definer set search_path = public stable as $$
  select s.nama, s.kelas from public.siswa s
   where trim(coalesce(p_nis,'')) <> ''
     and ltrim(s.nis, '0') = ltrim(trim(p_nis), '0')
   limit 1;
$$;
-- CATATAN PRIVASI: NIS biasanya berurutan sehingga bisa ditebak. Jika tidak ingin pengunjung
-- biasa bisa mencari nama lewat NIS, batasi fungsi ini hanya untuk admin dengan menjalankan:
--   revoke execute on function public.cari_siswa(text) from anon;

-- ---------- HAK AKSES ----------
grant select on public.buku_ulasan_publik, public.pengajuan_suka_jumlah, public.pengajuan_komentar_publik to anon, authenticated;

revoke all on function public.simpan_ulasan(text,text,text,text,int,text) from public;
revoke all on function public.toggle_suka(text,bigint)                    from public;
revoke all on function public.tambah_komentar(text,bigint,text,text)      from public;
revoke all on function public.edit_komentar(text,bigint,text)             from public;
revoke all on function public.saya(text)                                  from public;
revoke all on function public.cari_siswa(text)                            from public;
grant execute on function public.simpan_ulasan(text,text,text,text,int,text) to anon, authenticated;
grant execute on function public.toggle_suka(text,bigint)                    to anon, authenticated;
grant execute on function public.tambah_komentar(text,bigint,text,text)      to anon, authenticated;
grant execute on function public.edit_komentar(text,bigint,text)             to anon, authenticated;
grant execute on function public.saya(text)                                  to anon, authenticated;
grant execute on function public.cari_siswa(text)                            to anon, authenticated;
