# Akun & akses

Menu **Akun & akses** menyediakan OAuth Gmail, Google Calendar, Notion, dan GitHub. Ini koneksi untuk aplikasi kantor Anda sendiri; plugin akun di Codex tidak otomatis memberikan token kepada web kantor/Hermes.

Belum ada akun pribadi yang dihubungkan oleh pengembang. Client OAuth, pilihan akun, dan persetujuan akses harus dibuat/diselesaikan pemilik pada provider resmi. UI menampilkan **Perlu setup OAuth** jika konfigurasi belum tersedia; tidak berpura-pura terhubung.

## Konfigurasi backend

Pada `server/.env` untuk lokal, atau `/etc/hermes-office.env` untuk AWS, tambahkan nilai asli hanya di server:

```dotenv
OFFICE_PUBLIC_URL=http://localhost:8787
OFFICE_VAULT_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

OFFICE_VAULT_KEY adalah 64 karakter hex (32 byte acak). Buat di terminal pribadi, misalnya `openssl rand -hex 32`, lalu simpan hasilnya di file env. Jangan kirim key/token ke chat atau commit ke Git. Di produksi gunakan `OFFICE_PUBLIC_URL=https://api.rage.ai.id` dan cookie Secure. Restart backend setelah mengubah env, ketika antrean tidak sedang menjalankan pekerjaan.

Token/refresh token disimpan terenkripsi AES-256-GCM pada SQLite. Master key berada di env, bukan database atau browser. Cadangkan key secara terpisah; mengubah/menghilangkan key membuat token lama tidak dapat dibaca, sehingga koneksi perlu dihapus dan diotorisasi ulang. Respons `/state` hanya mengembalikan metadata status, tanpa token atau cipher.

## Google: Gmail dan Calendar

1. Buat project Google Cloud untuk aplikasi Anda. Aktifkan Gmail API dan Google Calendar API.
2. Konfigurasi OAuth consent screen dan akun penguji sesuai mode publikasi aplikasi.
3. Buat OAuth Client ID jenis Web application.
4. Daftarkan redirect URI persis seperti yang ditampilkan menu akun. Untuk lokal:
   - `http://localhost:8787/connections/callback/gmail`
   - `http://localhost:8787/connections/callback/calendar`
5. Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET pada env backend, restart, lalu klik **Hubungkan** di kantor.

Untuk produksi, gunakan dua callback yang sama dengan origin `https://api.rage.ai.id`. Google dapat meminta proses verifikasi/persetujuan tambahan berdasarkan scope dan status aplikasi; ikuti console Google. Scope yang diminta: `gmail.readonly` atau `calendar.readonly`, secara terpisah. Authorization code flow memakai state terikat sesi dan PKCE, dengan offline access untuk refresh token.

Dokumentasi resmi: https://developers.google.com/identity/protocols/oauth2/web-server

## Notion

Buat public OAuth connection/integration pada portal pengembang Notion milik Anda. Atur capability membaca konten sesuai kebutuhan; aplikasi kantor hanya menggunakan operasi baca. Daftarkan callback yang muncul di menu, misalnya `https://api.rage.ai.id/connections/callback/notion` atau callback localhost bila diizinkan konfigurasi provider. Isi NOTION_CLIENT_ID dan NOTION_CLIENT_SECRET, lalu otorisasi dari menu kantor. Pilih halaman workspace yang memang boleh dibaca saat consent. Halaman yang tidak dibagikan tidak otomatis tersedia.

Dokumentasi: https://developers.notion.com/guides/get-started/authorization

## GitHub

Buat OAuth App pada GitHub Developer settings dengan callback `/connections/callback/github` pada OFFICE_PUBLIC_URL yang sesuai. Isi GITHUB_CLIENT_ID dan GITHUB_CLIENT_SECRET. Scope awal `read:user`; adapter hanya membaca daftar repo **publik**. Akses private repo atau push/PR memerlukan adapter GitHub App dengan permission per repository; fitur tersebut belum disediakan oleh konektor awal ini. Jangan memperluas scope menjadi `repo` hanya agar tombol terlihat aktif.

Dokumentasi: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

## Cara memberikan data kepada agent

Tiga langkah terpisah diperlukan:

1. Hubungkan akun melalui OAuth pada menu **Akun & akses**. Login kantor harus tetap aktif selama callback; state sekali pakai berlaku 10 menit.
2. **Atur tim → pilih bot → Izin membaca sumber akun**: pilih sumber yang boleh dipakai bot.
3. **Brief team lead → Sumber akun untuk misi ini**: pilih sumber yang boleh dipakai pada misi itu.

Sumber hanya dibaca sebelum langkah subagent yang cocok dengan dua pilihan izin tersebut. Team lead planner tidak membaca akun otomatis. Hasil subagent dapat memuat cuplikan data dan diteruskan ke langkah berikutnya/team lead untuk menyusun laporan. Semua bot yang terlibat dalam alur dapat melihat hasil handoff; jika data tidak boleh keluar dari satu bot, gunakan tugas individual tanpa sumber akun (atau implementasikan pembatasan alur tambahan sebelum memakai data itu). Jangan memasukkan data sensitif ke misi tim tanpa meninjau peserta.

Data referensi dikirim ke runtime Hermes dan provider model yang Anda konfigurasi, disimpan pada riwayat tugas jika masuk output. Token tidak dikirim ke Hermes/model. Perintah yang terkandung dalam email/halaman diperlakukan sebagai bahan referensi, bukan instruksi pemilik, tetapi prompt tersebut bukan sandbox keamanan. Izin tool native Hermes tetap dikelola terpisah pada AWS.

## Batas data yang dibaca

| Sumber | Adapter awal |
|---|---|
| Gmail | Metadata dan snippet maksimal 5 pesan inbox terbaru, tanpa attachment/body lengkap |
| Calendar | Maksimal 10 event primary calendar dalam 7 hari ke depan |
| Notion | Maksimal 5 halaman yang dibagikan, maksimal 20 blok tingkat atas per halaman |
| GitHub | Metadata maksimal 10 repository publik terbaru |

Ini snapshot terbatas, bukan akses pencarian penuh ke semua akun. Tidak ada operasi kirim email, edit event, tulis Notion, atau push GitHub. Ketika menggunakan tombol **Baca contoh**, snapshot hanya ditampilkan kepada pemilik di browser; tidak dikirim ke model oleh tombol itu.

**Putuskan** menghapus token dan state OAuth dari database kantor, sehingga pembacaan baru berhenti. Untuk mencabut grant pada provider juga, gunakan halaman connected apps milik provider. Data yang sudah masuk hasil tugas/Hermes tidak otomatis terhapus saat disconnect. Tugas yang sudah berjalan juga mungkin telah membaca data sebelum disconnect.
