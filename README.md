# Hermes Agent Office

Kantor AI agent 3D berbasis React, Three.js, dan Vite, dengan backend Node.js untuk Hermes Agent di AWS.

## Tim & kantor ceria

Versi kampus: **[docs/CAMPUS.md](docs/CAMPUS.md)**. Tambahkan hingga 18 bot, definisikan skill, kirim prompt ke team lead untuk perencanaan/delegasi, dan baca laporan final kembali dari lead. Kantor diperluas dengan cabin, pantry, games room, lounge, ruang makan, serta navigasi idle/return-to-desk.

Menu **Akun & akses** memiliki alur OAuth Gmail, Calendar, Notion, GitHub dengan token terenkripsi pada server. Client provider harus dikonfigurasi pemilik; akun belum otomatis terhubung. Adapter awal membaca snapshot terbatas, bukan menulis/mengirim data: **[docs/ACCOUNTS.md](docs/ACCOUNTS.md)**.

- **Atur tim**: nama kantor, tujuan, bahasa, nama bot, instruksi, warna, dan status aktif tersimpan di backend.
- **Misi tim**: pilih alur, kirim satu brief, dan bot mengerjakan langkah secara berurutan dengan handoff hasil. Langkah berikutnya berhenti bila pendahulunya gagal.
- **Jeda antrean**: tugas aktif boleh selesai; pekerjaan berikutnya menunggu sampai antrean dilanjutkan.
- **Suasana**: tema Sunshine, Peach Club, Mint Garden, meja pastel, papan studio, coffee corner, label bot, dan animasi sesuai status.

Panduan pemakaian: **[docs/TEAM.md](docs/TEAM.md)**. Peran bot memakai satu runtime Hermes. Fitur ini tidak menjadwalkan pekerjaan berulang secara otomatis.

## Menjalankan web

```sh
npm ci
npm run dev
```

Build produksi: `npm run build`. Output: `dist/`. Deploy frontend ke Vercel atau Cloudflare Pages dengan custom domain `rage.ai.id`.

## Menghubungkan Hermes

**[Panduan instalasi langsung AWS → deploy/AWS.md](deploy/AWS.md)**

Frontend `https://rage.ai.id` → backend `https://api.rage.ai.id` → Hermes `http://127.0.0.1:8642` pada server AWS yang sama.

1. Pastikan API Hermes hidup dan API_SERVER_KEY sudah dikonfigurasi.
2. Instal backend sebagai layanan systemd menggunakan template di `deploy/`.
3. Isi `/etc/hermes-office.env` dengan token Hermes dan password kantor. Contoh tanpa secret: `server/.env.example`.
4. Hubungkan DNS, reverse proxy Nginx, dan sertifikat HTTPS untuk `api.rage.ai.id`.
5. Buka Settings di kantor → masukkan URL backend dan password kantor → **Masuk & hubungkan**.

Token API Hermes tidak dikirim ke browser. Sesi login memakai cookie HttpOnly/Secure selama 12 jam. Nilai `VITE_OFFICE_API_URL=https://api.rage.ai.id` pada hosting hanya memilih URL default; tidak boleh memuat token. Password kantor dikirim hanya ke backend yang Anda pilih untuk login, dan tidak disimpan di localStorage.

Tanpa koneksi backend, tersedia mode demo yang ditandai jelas. Bot merupakan persona/peran pada satu runtime Hermes. Tugas individual tidak membawa riwayat sebelumnya; misi tim meneruskan hasil dan menyusun laporan final. State backend dibaca setiap 2 detik, termasuk cuplikan output/tool publik dari stream Hermes jika tersedia.

## Tugas dan penyimpanan

- API kantor menerima tugas, menyimpannya di SQLite, lalu memanggil API chat Hermes secara berurutan.
- Tugas yang sudah diterima tetap berjalan setelah browser ditutup.
- Hasil dan status tersimpan setelah refresh/restart. UI menampilkan hasil melalui detail agent dan tab aktivitas.
- Antrean dilanjutkan setelah restart backend. Tugas yang sedang berjalan saat proses terputus ditandai `interrupted` dan tidak dikirim ulang otomatis: Hermes mungkin sudah melakukan tindakan. Periksa hasil sebelum mengulang.
- Health check berhasil hanya membuktikan liveness; uji satu tugas nyata untuk memverifikasi token/model.
- Deploy backend pada satu proses Node **22.13+** dengan penyimpanan permanen; disarankan Node 24. Jangan deploy worker antrean ini sebagai frontend statis atau fungsi per-request.

## Pengujian

```sh
npm run test:server
npm run build
```

Tes backend memakai Hermes tiruan, tanpa mengakses AWS. File rahasia `.env`, database `data/`, dan private key dikecualikan dari Git. `.env.example` hanya berisi contoh dan boleh di-commit.
