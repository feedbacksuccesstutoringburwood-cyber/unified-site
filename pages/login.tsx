import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';

type Campus = { id:string; name:string; tutors?:string[] };

function getCampuses(): Campus[] {
  try { return JSON.parse(process.env.NEXT_PUBLIC_CAMPUSES_JSON || '[]'); }
  catch { return []; }
}

export default function LoginPage() {
  const router = useRouter();
  const campuses = useMemo(() => getCampuses(), []);
  const [campusId, setCampusId] = useState(campuses[0]?.id || 'parramatta');
  const [tutor, setTutor] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|undefined>();

  const nextPath = (typeof router.query.next === 'string' && router.query.next) ? router.query.next : '/feedback';
  const currentTutors = useMemo(
    () => (campuses.find(c => c.id === campusId)?.tutors || []).slice().sort(),
    [campusId, campuses]
  );

  useEffect(() => {
    if (tutor && !currentTutors.includes(tutor)) setTutor('');
  }, [campusId, currentTutors, tutor]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try {
      const pickedTutor = tutor.trim();
      if (!pickedTutor) throw new Error('Pick your tutor name before signing in.');
      const res = await fetch('/api/login', {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({ campus: campusId, tutor: pickedTutor, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Login failed');
      try {
        // Store a short (first-name) tutor for emails/UI, and keep the full name too.
        const shortTutor = pickedTutor.split(/\s+/).filter(Boolean)[0] || pickedTutor;
        localStorage.setItem('st_tutor', shortTutor);
        localStorage.setItem('st_tutor_full', pickedTutor);
        localStorage.setItem('st_campus', campuses.find(c => c.id === campusId)?.name || campusId);
      } catch {}
      // Force a full navigation so middleware sees the freshly-set auth cookie immediately.
      window.location.assign(nextPath);
    } catch (e:any) {
      setError(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-login">
      <Header />
      <main className="container page-login-main" style={{maxWidth:'860px'}}>
        <div className="card login-card">
          <h1 className="section-title" style={{marginBottom:'.5rem'}}>Success Tutoring</h1>
          <p className="text-muted" style={{marginBottom:'1.5rem', fontSize:'1.1rem'}}>Sign in to continue</p>

          <form onSubmit={submit} className="grid grid-col" autoComplete="off">
            <div>
              <label className="label">Campus</label>
              <select className="input" value={campusId} onChange={e=>setCampusId(e.target.value)}>
                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {!campuses.length && <option value="parramatta">Parramatta</option>}
              </select>
            </div>

            <div>
              <label className="label">Tutor</label>
              <div className="tutor-picker">
                <input
                  list="tutors"
                  className="input tutor-input"
                  value={tutor}
                  onChange={e=>setTutor(e.target.value)}
                  placeholder="Type or pick your name"
                  autoComplete="off"
                />
                <select className="input tutor-select" value={tutor} onChange={e=>setTutor(e.target.value)}>
                  <option value="">Select tutor…</option>
                  {currentTutors.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <datalist id="tutors">
                  {currentTutors.map(t => <option key={t} value={t}>{t}</option>)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="flex gap-2">
                <input type={showPwd?'text':'password'} className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter site password" />
                <button type="button" className="btn" onClick={()=>setShowPwd(v=>!v)}>{showPwd?'Hide':'Show'}</button>
              </div>
            </div>

            {error && <div className="mt-2" style={{color:'#fca5a5'}}>{error}</div>}

            <div className="mt-4">
              <button type="submit" className="btn-primary w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
            </div>

            <p className="text-sm text-muted" style={{marginTop:'.75rem'}}>You’ll be redirected to <b>{nextPath}</b> after login.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
