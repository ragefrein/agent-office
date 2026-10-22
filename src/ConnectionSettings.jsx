import { useState } from 'react';
import { Link2, LoaderCircle, ShieldCheck, Wifi } from 'lucide-react';

export default function ConnectionSettings({ gateway, notify, onConnected }) {
  const [endpoint, setEndpoint] = useState(gateway.url || 'https://api.rage.ai.id');
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function connect(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await gateway.connect(endpoint, password);
      setPassword(''); onConnected();
      notify(data.hermesReady ? 'Terhubung ke kantor AWS dan Hermes.' : 'Backend terhubung, tetapi Hermes belum dapat dijangkau.');
    } catch (e) { setError(e.message || 'Koneksi gagal. Periksa URL, HTTPS, dan CORS backend.'); }
    finally { setBusy(false); }
  }
  return <><span className="modal-emblem"><Link2 size={24}/></span><h2 id="modal-title">Connect your Hermes.</h2><p>Masuk ke backend kantor di AWS. Tugas dan hasil tersimpan di server serta diperbarui setiap 5 detik.</p>
    <form onSubmit={connect}>
      <label>URL backend kantor<input required type="url" placeholder="https://api.rage.ai.id" value={endpoint} onChange={e => setEndpoint(e.target.value)}/></label>
      <label>Password kantor<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="OFFICE_PASSWORD yang Anda atur di AWS"/></label>
      <div className="connection-note"><ShieldCheck size={17}/><span>Token API Hermes tetap di AWS. Password kantor dikirim ke backend untuk login dan tidak disimpan di localStorage.</span></div>
      {(error || gateway.error) && <p className="connection-error" role="alert">{error || gateway.error}</p>}
      <button className="primary full" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <Wifi size={17}/>} {busy ? 'Menghubungkan...' : 'Masuk & hubungkan'}</button>
    </form>
    {gateway.live && <button className="secondary full" disabled={busy} onClick={async () => { setBusy(true); try { await gateway.disconnect(); onConnected(); notify('Keluar dari kantor AWS. Mode demo aktif.'); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Keluar & gunakan demo</button>}
    <div className="contract"><strong>Backend untuk rage.ai.id</strong><p>URL ini menunjuk backend kantor, bukan port 8642 Hermes. Panduan instalasi AWS ada di <code>deploy/AWS.md</code>.</p><p>Enam peran kantor memakai satu Hermes dengan antrean berurutan. Kantor mengirim tugas tanpa riwayat percakapan sebelumnya.</p></div>
  </>;
}
