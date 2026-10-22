# Mengatur tim dan menjalankan misi

## Mulai dari pengaturan tim

1. Jalankan SSH tunnel, backend kantor, dan frontend seperti biasa. Login lewat ikon **Koneksi Hermes** menggunakan backend lokal `http://localhost:8787`.
2. Klik **Atur tim** atau ikon **Pengaturan**. Pengaturan tim terpisah dari pengaturan koneksi.
3. Pada **Kantor & suasana**, isi nama kantor, tujuan tim, dan bahasa jawaban. Pilih Sunshine, Peach Club, atau Mint Garden. Animasi robot dapat dimatikan. Preferensi reduced-motion perangkat juga dihormati.
4. Pilih bot di navigasi panel untuk mengubah nama, jabatan, warna, instruksi, dan status aktif. Klik **Simpan pengaturan**. Minimal satu bot harus aktif.

Pengaturan disimpan di SQLite backend, termasuk setelah restart. Mengubah instruksi tidak mengubah kredensial atau konfigurasi global Hermes. Instruksi peran merupakan arahan model, bukan sandbox/perubahan izin tool; akses tool tetap ditentukan konfigurasi Hermes di AWS.

Enam peran awal:

| Bot | Tanggung jawab |
|---|---|
| Atlas | Menyusun brief, prioritas, dan kriteria sukses |
| Nova | Riset dan sumber yang relevan |
| Pixel | Implementasi dan verifikasi teknis |
| Quill | Naskah, konten, dan dokumentasi |
| Sage | Analisis, pemeriksaan kualitas, dan keterbatasan |
| Echo | Merangkum hasil, petunjuk penggunaan, dan tindak lanjut |

Semua peran menggunakan satu runtime Hermes dan antrean berurutan. Tidak ada pekerjaan berulang atau misi otomatis tanpa brief yang dikirim pemilik. Akses proyek/file di AWS perlu tersedia pada Hermes sebelum bot dapat mengerjakan file tersebut.

## Beri tugas individual

Pilih robot atau anggota tim → **Beri tugas baru**. Tugas individual mengirim brief dan instruksi peran tanpa riwayat tugas sebelumnya. Buka detail agent atau Aktivitas untuk membaca hasil. Status completed berarti Hermes mengembalikan respons sukses; tetap tinjau hasil dan verifikasinya untuk menilai tujuan pekerjaan benar-benar tercapai.

## Jalankan misi tim

1. Klik **Misi tim**.
2. Pilih alur: **Dream team**, **Research sprint**, **Build something**, atau **Content studio**.
3. Isi brief yang konkret: tujuan, konteks, input, hasil yang diharapkan, dan batasan.
4. Tinjau urutan bot. Klik **Mulai misi tim** untuk menjalankan satu misi. Tiap bot merupakan satu permintaan Hermes terpisah dan menggunakan kuota model sesuai konfigurasi Hermes Anda.
5. Panel Misi tim menampilkan progres setiap langkah. Klik kartu misi untuk melihat hasil tugas dalam alur tersebut; klik hasil tugas untuk membacanya.

Contoh brief yang tidak memerlukan akses proyek:

> Buat rencana MVP aplikasi pencatat tugas pribadi untuk pengguna Indonesia. Hasilkan kebutuhan inti, tiga prioritas, rancangan alur pengguna, serta checklist pengujian. Tahap ini hanya perencanaan; jangan mengubah file, mengirim pesan, atau melakukan deployment.

Hasil langkah sebelumnya diteruskan sebagai bahan referensi ke langkah berikutnya (maksimal 24.000 karakter terakhir). Tiap peran diarahkan untuk merangkum konteks yang perlu diteruskan. Ini handoff satu arah, bukan percakapan bebas atau eksekusi enam runtime secara bersamaan.

Jika satu langkah gagal/terputus, langkah berikutnya berstatus **blocked** dan tidak dijalankan. Periksa hasil sebelum membuat misi baru; timeout/restart tidak membuktikan tindakan di Hermes belum terjadi.

## Jeda antrean

Pengaturan kantor → **Jeda antrean** → Simpan. Tugas yang sedang berjalan diizinkan selesai, dan tugas berikutnya menunggu. Matikan jeda dan simpan untuk melanjutkan. Menonaktifkan bot hanya menolak tugas/misi baru untuk bot tersebut; tugas yang sudah diterima tetap memakai pengaturan saat dikirim. Antrean dan snapshot instruksi disimpan agar perubahan pengaturan tidak mengubah brief yang sudah diterima.

## Pengembangan lokal

Backend perlu restart setelah kode server berubah. Hentikan dengan Ctrl+C lalu jalankan `npm run server`. Jangan restart ketika pekerjaan penting masih berjalan. Tidak perlu mengubah file `.env` atau token untuk memakai fitur tim ini. Selama pengujian lokal, SSH tunnel dan backend harus tetap hidup.

Mode demo hanya contoh interaktif. Penyimpanan tim dan misi nyata memerlukan backend terhubung. Theme dapat dipreview secara lokal dalam mode demo.
