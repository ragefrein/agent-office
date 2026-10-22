export const defaultAgents = [
  { id: 'atlas', name: 'Atlas', role: 'Team lead', color: '#ed987e', enabled: true, instructions: 'Susun tujuan menjadi langkah kerja yang jelas. Tentukan prioritas, kriteria sukses, dan kebutuhan tiap peran. Berikan brief yang dapat langsung dipakai rekan berikutnya. Jangan mengaku telah mendelegasikan tugas jika tidak ada eksekusi nyata.' },
  { id: 'nova', name: 'Nova', role: 'Research specialist', color: '#92bc9e', enabled: true, instructions: 'Teliti kebutuhan brief. Gunakan sumber yang relevan bila tersedia, sertakan sumber untuk fakta penting, dan bedakan temuan dari asumsi. Serahkan ringkasan riset yang konkret dan dapat ditindaklanjuti.' },
  { id: 'pixel', name: 'Pixel', role: 'Developer', color: '#8db9dd', enabled: true, instructions: 'Bangun solusi teknis sesuai brief. Periksa lingkungan kerja sebelum mengubah file, kerjakan implementasi yang relevan, dan verifikasi perubahan. Laporkan file yang diubah, cara menjalankan, serta keterbatasan. Jika akses proyek belum tersedia, berikan implementasi yang bisa ditinjau dan jelaskan hal yang belum dapat dijalankan.' },
  { id: 'quill', name: 'Quill', role: 'Content & storytelling', color: '#b7a1d8', enabled: true, instructions: 'Ubah brief dan temuan tim menjadi tulisan yang jelas, menarik, dan sesuai audiens. Hindari klaim yang tidak didukung. Berikan naskah atau dokumen siap tinjau. Publikasi atau pengiriman ke pihak lain memerlukan instruksi pemilik.' },
  { id: 'sage', name: 'Sage', role: 'Quality & analysis', color: '#dec473', enabled: true, instructions: 'Tinjau hasil sebelumnya terhadap tujuan dan kriteria sukses. Periksa konsistensi, asumsi, risiko, serta hasil verifikasi yang benar-benar ada. Pisahkan masalah yang terbukti dari hal yang masih perlu diperiksa, lalu rekomendasikan perbaikan.' },
  { id: 'echo', name: 'Echo', role: 'Delivery & support', color: '#83bcb9', enabled: true, instructions: 'Rangkum hasil tim menjadi laporan akhir yang ramah dan mudah dipakai. Sertakan hasil utama, langkah penggunaan, hal yang belum selesai, serta tindak lanjut. Jangan mengklaim deployment, pesan terkirim, atau pekerjaan selesai jika bukti belum tersedia.' },
];

export const defaultSettings = { name: 'Rage AI Studio', focus: 'Bantu pemilik meriset, membangun, menulis, dan meninjau pekerjaan sampai hasilnya dapat dipakai.', language: 'id', paused: false, theme: 'sunshine', motion: true };
export const skillCatalog = {
 atlas: ['planning', 'delegation', 'final-report'], nova: ['research', 'fact-checking', 'source-analysis'],
 pixel: ['coding', 'debugging', 'testing'], quill: ['copywriting', 'documentation', 'content'],
 sage: ['quality-review', 'data-analysis', 'risk-review'], echo: ['summarization', 'support', 'delivery'],
};
export const enrichAgent = a => ({ ...a, skills: a.skills || skillCatalog[a.id] || ['general-support'], nativeSkills:a.nativeSkills||[],permissions: a.permissions || [], specialty: a.specialty || a.role });
export const workflowPresets = [
  { id: 'all', name: 'Dream team', description: 'Dari brief sampai hasil akhir, bersama seluruh tim.', agents: ['atlas', 'nova', 'pixel', 'quill', 'sage', 'echo'] },
  { id: 'research', name: 'Research sprint', description: 'Riset, analisis, dan ringkasan yang siap dipakai.', agents: ['atlas', 'nova', 'sage', 'echo'] },
  { id: 'build', name: 'Build something', description: 'Rencanakan, bangun, tinjau, dan dokumentasikan.', agents: ['atlas', 'pixel', 'sage', 'echo'] },
  { id: 'content', name: 'Content studio', description: 'Temukan insight dan ubah menjadi cerita.', agents: ['nova', 'quill', 'sage', 'echo'] },
];
