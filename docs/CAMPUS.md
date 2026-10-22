# Campus, subagents, dan team lead

## Menambah subagent

**Atur tim → Tambah subagent**. Isi nama, jabatan, spesialisasi, daftar skills, instruksi, warna, serta status aktif. Maksimal 18 bot. Peran bawaan dapat dinonaktifkan; subagent tambahan dapat dihapus dari konfigurasi melalui API (riwayat lama tetap ada), dan UI menyediakan penonaktifan untuk menjaga riwayat jelas. Pilih team lead pada tab **Kantor & suasana**. Simpan pengaturan untuk membuatnya tersedia di backend dan menambah meja/robot pada kampus.

Contoh specialist:

```text
Nama: Orbit
Peran: SEO specialist
Spesialisasi: Audit judul halaman, metadata, dan struktur konten
Skills: seo-audit, keyword-analysis, content-review
Instruksi: Audit hanya data yang tersedia. Kutip bukti per temuan dan jelaskan
bagian yang tidak bisa diverifikasi. Jangan mengaku memeriksa website tanpa akses.
```

Skill adalah deklarasi kemampuan/routing, bukan instalasi tool atau jaminan faktual jawaban. Tambahkan koneksi/tool yang memang dibutuhkan pada Hermes secara terpisah. Jika agent tidak punya skill/data yang diperlukan, instruksinya meminta ia menyatakan keterbatasan.

Pada editor bot, **Sinkronkan skill Hermes** membaca `/v1/skills` dan `/v1/toolsets` lewat backend (autentikasi tetap di server). Pilih native skill dari katalog yang berhasil diverifikasi untuk meminta bot memuatnya lewat `skill_view`. Native skill yang hilang/tidak dapat diverifikasi menghentikan tugas, dan konfigurasi native skill baru ditolak jika tidak ada dalam katalog. Katalog di-cache 60 detik. Jika endpoint skills mengembalikan HTTP 500, UI menunjukkan kegagalannya serta daftar toolsets yang masih dapat dibaca; skill deklaratif tidak diberi label native skill. Katalog ini tidak mengubah aktivasi tool/skill atau memasang paket di AWS.

## Satu prompt kepada team lead

Klik **Brief team lead**. Isi tujuan, konteks, hasil akhir, dan batasan. Backend meminta lead menyusun JSON rencana yang memilih 1–8 langkah dari bot aktif serta skill yang benar-benar terdaftar. Backend menolak agent ID/skill yang tidak valid; tidak mengeksekusi rencana yang mengarang skill.

Setelah rencana valid:

1. Subagent menerima penugasan khusus beserta target output.
2. Hasil langkah sebelumnya diteruskan sebagai referensi. Eksekusi berurutan memakai satu runtime Hermes; tidak ada worker paralel independen yang diada-adakan.
3. Lead menerima hasil semua subagent dan menulis **laporan final**: hasil, kontribusi tiap bot, bukti, keterbatasan, dan langkah berikutnya.
4. Klik kartu misi → baca laporan final dan rincian tugas.

Satu misi memakai 1 panggilan perencanaan + 1–8 panggilan subagent + 1 panggilan laporan final. Jika ada langkah gagal/terputus, langkah setelahnya diblokir; laporan final sukses tidak dibuat. Rencana/hasil tidak di-retry otomatis untuk menghindari pengulangan tindakan. Fitur alur manual dari versi sebelumnya tetap tersedia lewat **Misi tim**.

## Gerak dan aktivitas

Kampus 28 × 22 memiliki studio meja, tiga cabin, pantry, games room, lounge, dan ruang makan. Idle agent berkeliling melalui jalur grid yang menghindari meja, dinding, dan beberapa perabot besar. Ini navigasi visual, bukan simulasi fisika lengkap: perabot kecil/karakter lain belum menjadi penghalang dinamis.

Saat tugas masuk antrean, robot kembali ke meja. Saat di meja, bagian depan wajah robot (+Z model) diputar ke arah monitor (-Z dunia), lalu animasi mengetik digunakan untuk status kerja. Pergerakan tidak menunda pekerjaan backend; mungkin tugas selesai sebelum animasi berjalan kembali ke meja, terutama pada respons cepat. Menonaktifkan animasi atau preferensi reduced-motion menempatkan bot di meja tanpa perjalanan.

Ini simulasi status dan perilaku visual. Bot tidak diberi kesadaran subjektif. Label lokasi diturunkan dari posisi visual; status tugas dan output berasal dari backend. Gerak berhenti ketika halaman tidak merender, tetapi pekerjaan server tetap berjalan.

## Percakapan di atas kepala

Nama bot dan lokasi tampil di atas robot. Toggle **Log di atas bot** mengaktifkan cuplikan:

- mulai tugas (log backend),
- delegasi lead ke agent (rencana yang divalidasi),
- tool aktif (jika stream Hermes mengirim event tool),
- output publik assistant,
- hasil/handoff dan laporan final.

Cuplikan adalah output publik/log, bukan pikiran pribadi model atau chat bebas yang dikarang. Backend mem-parsing SSE `delta.content` dan `hermes.tool.progress`, mengabaikan `reasoning_content`, dan tetap menerima respons JSON jika server mengirimkannya. UI mengambil perubahan tiap 2 detik; bubble bukan stream token langsung ke browser dan tugas singkat bisa langsung menampilkan hasil akhir. Detail agent menyajikan log yang lebih panjang, skill, instruksi, penugasan, dan hasil.

Instruksi peran/planning tidak menjadi enforcement izin tool native Hermes; autentikasi, pembatasan akses file, dan tool yang tersedia perlu dikonfigurasi pada Hermes. Integrasi akun kantor dijelaskan terpisah di [ACCOUNTS.md](ACCOUNTS.md).
