import Header from '../components/Header';
import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <Header />
      <main className="container">
        <div className="card">
          <h2 className="section-title">Welcome</h2>
          <p className="text-muted">Choose an action below.</p>
          <div className="grid grid-2 grid-col mt-4">
            <Link href="/feedback" prefetch={false} className="tile p-6">
              <div className="text-xl" style={{fontWeight:700}}>Feedback</div>
              <div className="text-sm text-muted">Send parent feedback in seconds.</div>
            </Link>
            <Link href="/print" prefetch={false} className="tile p-6">
              <div className="text-xl" style={{fontWeight:700}}>Print</div>
              <div className="text-sm text-muted">Print lesson packs (L/R/H).</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
