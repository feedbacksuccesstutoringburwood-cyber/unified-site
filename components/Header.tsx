import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Header(){
  const router = useRouter();
  const [tutor,setTutor] = useState('');
  useEffect(()=>{
    try { setTutor(localStorage.getItem('st_tutor') || ''); } catch {}
  },[]);

  // On the login screen, the nav can be confusing (it just bounces you back to login).
  const hideNav = router.pathname === '/login';

  async function doLogout(e: React.MouseEvent){
    e.preventDefault();
    await fetch('/api/logout', { method:'POST' });
    try { localStorage.removeItem('st_tutor'); localStorage.removeItem('st_campus'); } catch {}
    window.location.href = '/login';
  }

  return (
    <header className="header">
      <div className="header-inner container" style={{paddingLeft:'1rem', paddingRight:'1rem'}}>
        <div className="brand">
          <span className="accent">Success</span>{' '}
          <span>Tutoring</span>
          <span className="brand-portal"> Portal</span>
        </div>
        {!hideNav && (
          <nav className="nav">
            <Link className="btn" href="/feedback" prefetch={false}>Feedback</Link>
            <Link className="btn" href="/print" prefetch={false}>Print</Link>
            <button className="btn" onClick={doLogout} aria-label="Logout">
              Logout{tutor ? ` (${tutor})` : ''}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
