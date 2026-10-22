import { useCallback, useEffect, useRef, useState } from 'react';

export default function useGateway() {
  const [url, setUrl] = useState(() => localStorage.getItem('officeGateway') || import.meta.env.VITE_OFFICE_API_URL || '');
  const [live, setLive] = useState(() => Boolean(localStorage.getItem('officeGateway') || import.meta.env.VITE_OFFICE_API_URL));
  const [authenticated, setAuthenticated] = useState(false), [snapshot, setSnapshot] = useState(null), [error, setError] = useState('');
  const generation = useRef(0), request = useRef(null);
  async function api(base, path, options = {}) {
    let response;
    try {
      response = await fetch(base + path, { credentials: 'include', ...options, headers: { ...options.headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(12000) });
    } catch (error) {
      if (error.name === 'TimeoutError') throw new Error('Backend kantor tidak merespons dalam 12 detik. Periksa layanan backend dan koneksi Anda.');
      throw new Error('Backend kantor tidak dapat dijangkau. Jalankan npm run server, periksa URL backend, dan pastikan OFFICE_ORIGINS sesuai alamat web.');
    }
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Backend mengembalikan respons yang tidak sesuai (HTTP ${response.status}). Pastikan URL menunjuk backend kantor, bukan halaman web.`); }
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status });
    return data;
  }
  const refresh = useCallback(async () => {
    if (!live || !url) return;
    const version = generation.current;
    try {
      const data = await api(url, '/state');
      if (version !== generation.current) return;
      setSnapshot(data); setAuthenticated(true); setError('');
    } catch (e) {
      if (version !== generation.current) return;
      if (e.status === 401) setAuthenticated(false);
      setError(e.message || 'Backend tidak dapat dijangkau.');
    }
  }, [live, url]);
  useEffect(() => {
    if (!live) return;
    let stopped = false, timer;
    async function tick() { await refresh(); if (!stopped) timer = setTimeout(tick, 5000); }
    tick();
    return () => { stopped = true; clearTimeout(timer); generation.current++; };
  }, [refresh, live]);
  async function connect(rawUrl, password) {
    const parsed = new URL(rawUrl);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL backend tidak valid.');
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Gunakan HTTPS untuk backend AWS.');
    if (location.protocol === 'https:' && parsed.protocol !== 'https:') throw new Error('Website HTTPS memerlukan backend HTTPS.');
    const base = parsed.href.replace(/\/$/, '');
    const health = await api(base, '/health');
    if (health.service !== 'hermes-office') throw new Error('URL ini bukan backend kantor. Masukkan backend kantor, bukan API Hermes langsung.');
    await api(base, '/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    const data = await api(base, '/state');
    generation.current++; localStorage.setItem('officeGateway', base);
    setUrl(base); setLive(true); setSnapshot(data); setAuthenticated(true); setError('');
    return data;
  }
  async function submit(agentId, prompt) {
    if (!authenticated || error) throw new Error(error || 'Masuk melalui Settings terlebih dahulu.');
    const signature = JSON.stringify([agentId, prompt]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const data = await api(url, '/tasks', { method: 'POST', body: JSON.stringify({ agentId, prompt, requestId: request.current.id }) });
    request.current = null;
    await refresh(); return data;
  }
  async function disconnect() {
    if (url) {
      try { await api(url, '/auth/logout', { method: 'POST', body: '{}' }); }
      catch (error) { if (error.status !== 401) throw new Error('Logout belum berhasil. Periksa koneksi dan coba lagi.'); }
    }
    generation.current++; localStorage.removeItem('officeGateway');
    setLive(false); setUrl(''); setAuthenticated(false); setSnapshot(null); setError(''); request.current = null;
  }
  return { url, live, authenticated, snapshot, error, connect, submit, disconnect, refresh };
}
