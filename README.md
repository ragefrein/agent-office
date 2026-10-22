# Hermes Agent Office

Kantor AI agent 3D berbasis React, Three.js, dan Vite. Ruang dibuat dari geometri lokal tanpa ketergantungan model eksternal.

## Menjalankan

```sh
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite. Build produksi: `npm run build`. Preview build: `npm run preview`.

## Fitur

- Studio 3D interaktif: putar, zoom, reset kamera, layar penuh, fokus ruangan.
- Enam agent contoh dengan detail, pemberian tugas, dan penyelesaian tugas demo.
- Pencarian tim dan riwayat aktivitas selama sesi.
- Pengaturan endpoint gateway disimpan di localStorage setelah health check berhasil.
- Layout responsif dan panel pengelolaan yang tetap bisa dipakai tanpa WebGL.

## Integrasi Hermes di AWS

**Mode saat ini adalah demo. Tidak ada agent AWS yang sudah tersambung.** Tugas demo berada dalam state browser dan hilang saat halaman dimuat ulang. Statistik 24 tugas dan tren 12% adalah contoh, bukan telemetri riil.

Panel koneksi memanggil `GET {gatewayUrl}/health`, timeout 10 detik, dan mengharapkan JSON `{"status":"ok"}` atau `{"status":"healthy"}`. Pemeriksaan berhasil hanya menunjukkan gateway sehat; belum menyinkronkan agent atau mengirim tugas.

Untuk menghubungkan Hermes yang ada, sediakan adapter backend pada instance AWS yang mengakses runtime Hermes Anda. Kontrak yang disarankan untuk tahap integrasi berikutnya:

```text
GET  /health           -> { "status": "ok" }
GET  /agents           -> { "agents": [{ "id": "atlas", "name": "Atlas", "role": "Lead orchestrator", "status": "working", "task": "..." }] }
POST /agents/:id/tasks -> { "taskId": "...", "status": "queued" }
GET  /events           -> Server-Sent Events untuk perubahan status/tugas
```

Endpoint selain `/health` belum dipanggil frontend. Kontrak ini usulan adapter, bukan asumsi bahwa Hermes menyediakan API tersebut. Implementasi aktual harus disesuaikan dengan versi dan antarmuka Hermes di AWS Anda.

Gunakan HTTPS, autentikasi sesi pada backend, dan CORS terbatas ke origin frontend. Simpan kredensial AWS/API hanya di backend. Jangan taruh secret di variabel Vite atau localStorage. Frontend tidak meminta atau menyimpan secret.

Untuk deploy, unggah direktori `dist/` ke hosting statis seperti S3/CloudFront atau sajikan menggunakan Nginx. Koneksi ke gateway memerlukan URL dan adapter yang tersedia dari browser pengguna.
