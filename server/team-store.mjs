import { defaultAgents, defaultSettings } from '../shared/team.js';

export function createTeamStore(db) {
  db.exec('CREATE TABLE IF NOT EXISTS office_config (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, value TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO office_config (id,revision,value) VALUES (1,1,?)').run(JSON.stringify({ settings: defaultSettings, agents: defaultAgents }));
  function read() {
    const row = db.prepare('SELECT * FROM office_config WHERE id=1').get();
    return { revision: row.revision, ...JSON.parse(row.value) };
  }
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  function text(value, max, name) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(`${name} wajib diisi, maksimal ${max} karakter.`);
    return value.trim();
  }
  function save(input) {
    if (input.revision !== read().revision) throw Object.assign(new Error('Pengaturan telah berubah. Tutup dan buka kembali panel untuk memuat versi terbaru.'), { status: 409 });
    const s = input.settings;
    if (!s || typeof s.paused !== 'boolean' || typeof s.motion !== 'boolean' || !['id', 'en'].includes(s.language) || !['sunshine', 'peach', 'mint'].includes(s.theme)) invalid('Pengaturan kantor tidak valid.');
    const settings = { name: text(s.name, 60, 'Nama kantor'), focus: text(s.focus, 2000, 'Tujuan kantor'), language: s.language, paused: s.paused, motion: s.motion, theme: s.theme };
    if (!Array.isArray(input.agents) || input.agents.length !== defaultAgents.length || new Set(input.agents.map(a => a.id)).size !== defaultAgents.length) invalid('Daftar peran tidak valid.');
    const agents = defaultAgents.map(original => {
      const a = input.agents.find(v => v.id === original.id);
      if (!a || typeof a.enabled !== 'boolean' || typeof a.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(a.color)) invalid('Konfigurasi peran tidak valid.');
      return { id: a.id, name: text(a.name, 40, 'Nama bot'), role: text(a.role, 80, 'Peran bot'), instructions: text(a.instructions, 4000, 'Instruksi bot'), enabled: a.enabled, color: a.color };
    });
    if (!agents.some(a => a.enabled)) invalid('Aktifkan minimal satu bot.');
    db.prepare('UPDATE office_config SET revision=revision+1,value=? WHERE id=1').run(JSON.stringify({ settings, agents }));
    return read();
  }
  return { read, save };
}
