import { defaultAgents, defaultSettings, enrichAgent } from '../shared/team.js';

export function createTeamStore(db) {
  db.exec('CREATE TABLE IF NOT EXISTS office_config (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, value TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO office_config (id,revision,value) VALUES (1,1,?)').run(JSON.stringify({ settings: defaultSettings, agents: defaultAgents }));
  function read() {
    const row = db.prepare('SELECT * FROM office_config WHERE id=1').get();
    const value=JSON.parse(row.value);
    return { revision: row.revision, ...value, settings:{...value.settings,leadId:value.settings.leadId||'atlas'},agents:value.agents.map(enrichAgent) };
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
    const settings = { name: text(s.name, 60, 'Nama kantor'), focus: text(s.focus, 2000, 'Tujuan kantor'), language: s.language, paused: s.paused, motion: s.motion, theme: s.theme, leadId: s.leadId || 'atlas' };
    if (!Array.isArray(input.agents) || input.agents.length < 1 || input.agents.length > 18 || new Set(input.agents.map(a => a.id)).size !== input.agents.length) invalid('Tim harus berisi 1–18 bot dengan ID berbeda.');
    if(defaultAgents.some(a=>!input.agents.some(v=>v.id===a.id)))invalid('Peran bawaan tidak dapat dihapus; nonaktifkan jika tidak dipakai.');
    const agents = input.agents.map(raw => {
      const a = enrichAgent(raw);
      if(typeof a.id!=='string'||!/^[a-z][a-z0-9-]{1,45}$/.test(a.id))invalid('ID bot tidak valid.');
      if (!a || typeof a.enabled !== 'boolean' || typeof a.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(a.color)) invalid('Konfigurasi peran tidak valid.');
      if(!Array.isArray(a.skills)||a.skills.length<1||a.skills.length>15||a.skills.some(v=>typeof v!=='string'||!v.trim()||v.length>60))invalid('Isi 1–15 skill, maksimal 60 karakter per skill.');
      if(!Array.isArray(a.permissions)||a.permissions.some(v=>!['gmail','calendar','github','notion'].includes(v)))invalid('Izin akun tidak valid.');
      if(!Array.isArray(a.nativeSkills)||a.nativeSkills.length>10||a.nativeSkills.some(v=>typeof v!=='string'||v.length>180||!v.trim()))invalid('Native skills tidak valid.');
      return { id: a.id, name: text(a.name, 40, 'Nama bot'), role: text(a.role, 80, 'Peran bot'), instructions: text(a.instructions, 4000, 'Instruksi bot'), specialty:text(a.specialty||a.role,300,'Spesialisasi'),skills:[...new Set(a.skills.map(v=>v.trim()))],nativeSkills:[...new Set(a.nativeSkills)],permissions:[...new Set(a.permissions)],enabled: a.enabled, color: a.color };
    });
    if (!agents.some(a => a.enabled)) invalid('Aktifkan minimal satu bot.');
    if(!agents.some(a=>a.id===settings.leadId&&a.enabled))invalid('Team lead harus dipilih dari bot yang aktif.');
    db.prepare('UPDATE office_config SET revision=revision+1,value=? WHERE id=1').run(JSON.stringify({ settings, agents }));
    return read();
  }
  return { read, save };
}
