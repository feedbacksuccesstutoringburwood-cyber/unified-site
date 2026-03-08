import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import StudentPicker from '../../components/StudentPicker';
import StickyBar from '../../components/StickyBar';
import BusyOverlay from '../../components/BusyOverlay';
import useAuthGuard from '../../hooks/useAuthGuard';
import type { PronounSet } from '../../lib/tokens';
import {
  CatalogItem,
  buildCatalogTree,
  getNode,
  isStandardYearLabel,
  listChildNames,
  sortFilesForDisplay,
  TreeNode,
} from '../../lib/catalog';

type PrintMeta = { student: string; tutor?: string; folder?: string };

function getTutorName() {
  try {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('st_tutor') || '';
  } catch {
    return '';
  }
}

export default function PrintPage() {
  useAuthGuard();

  const [status, setStatus] = useState('Checking…');
  const [qty, setQty] = useState(1);
  const [student, setStudent] = useState('');
  // Print flow doesn't currently use pronouns, but StudentPicker can emit them.
  // Keep the setter for future logging/metadata without introducing unused locals.
  const [, setPronouns] = useState<PronounSet>('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [msg, setMsg] = useState('');

  const [navPath, setNavPath] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyTitle, setBusyTitle] = useState<string>('Working…');
  const [busySubtitle, setBusySubtitle] = useState<string>('');
  const [needStudent, setNeedStudent] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });
  const selectionRef = useRef<HTMLDivElement>(null);
  const scrollSelection = () => selectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function refresh() {
    setMsg('');
    try {
      const h = await fetch('/api/print-proxy?action=health').then((r) => r.json());
      if (!h?.ok) throw new Error('Not connected');
      setStatus(`Connected · ${h.printer || 'Printer'}`);
      const c = await fetch('/api/print-proxy?action=catalog').then((r) => r.json());
      setCatalog(c?.items || []);
    } catch {
      setStatus('Not Connected');
      setCatalog([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const tree: TreeNode = useMemo(() => buildCatalogTree(catalog), [catalog]);
  const node = useMemo(() => getNode(tree, navPath), [tree, navPath]);
  const childNames = useMemo(() => listChildNames(node), [node]);
  const rootLabel = navPath[0] || '';
  // For standard Kindy → Year 10 content we apply the L1/R1/... ordering to *any* folder that contains files.
  const standardOrdering = isStandardYearLabel(rootLabel);

  const files = useMemo(() => sortFilesForDisplay(node.files || [], standardOrdering), [node.files, standardOrdering]);

  // Quick-jump dropdowns (one per folder level). Great for desktop printing.
  const dropdownLevels = useMemo(() => {
    const levels: { label: string; options: string[]; value: string }[] = [];

    const labelForDepth = (d: number) => {
      if (d === 0) return 'Year / Program';
      if (d === 1) return 'Subject / Folder';
      if (d === 2) return 'Strand / Folder';
      return 'Folder';
    };

    let cursor: TreeNode = tree;
    for (let depth = 0; depth < 12; depth++) {
	      const children = Array.from(cursor.children.values());
	      const opts = children.map((c) => c.name).sort((a, b) => a.localeCompare(b));
      if (!opts.length) break;
      const value = navPath[depth] || '';
      levels.push({ label: labelForDepth(depth), options: opts, value });
      if (!value) break;
	      const next = children.find((c) => c.name === value);
      if (!next) break;
      cursor = next;
    }

    return levels;
  }, [tree, navPath]);

  const setDropdownAt = (depth: number, value: string) => {
    setMsg('');
    setNavPath((prev) => {
      const next = prev.slice(0, depth);
      if (value) next[depth] = value;
      return next;
    });
    // Intentionally do NOT auto-scroll when changing dropdowns.
    // Auto-scrolling makes desktop navigation feel "jumpy" and forces
    // users to constantly move their mouse back up.
  };

  function clearAll() {
    // Clear everything the tutor may have entered/selected on the Print page
    // so they can start a new print flow without refreshing.
    setStudent('');
    setNavPath([]);
    setQty(1);
    setMsg('');
    setNeedStudent(false);
    scrollTop();
  }

  function goBack() {
    setMsg('');
    setNavPath((p) => p.slice(0, Math.max(0, p.length - 1)));
  }

  async function logPrint(payload: any) {
    try {
      await fetch('/api/log-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore
    }
  }

  async function doPrint(material_id: number, meta: PrintMeta) {
    const r = await fetch('/api/print-proxy?action=print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id, qty, meta }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok) throw new Error(j?.error || 'Print failed');
    await logPrint({ when: new Date().toISOString(), kind: 'print', ...meta, qty, ok: true, material_id });
  }

  async function printOne(material_id: number) {
    if (!student) {
      setNeedStudent(true);
      return;
    }
    setBusy(true);
    setBusyTitle('Sending to printer…');
    setBusySubtitle('');
    setMsg('');
    try {
      await doPrint(material_id, { student, tutor: getTutorName(), folder: navPath.join(' / ') });
      setMsg('Sent to printer.');
    } catch (e: any) {
      setMsg(e?.message || 'Print failed');
    } finally {
      setBusy(false);
    }
  }

  async function printFolderAll() {
    if (!student) {
      setNeedStudent(true);
      return;
    }
    if (!files.length) return;

    setBusy(true);
    setBusyTitle('Sending to printer…');
    setMsg('');
    try {
      const meta: PrintMeta = { student, tutor: getTutorName(), folder: navPath.join(' / ') };
      for (let i = 0; i < files.length; i++) {
        const it = files[i];
        setBusySubtitle(`Printing ${i + 1} of ${files.length}: ${it._nameLabel || it.fileName}`);
        await doPrint(it.id, meta);
      }
      setMsg('Folder sent to printer.');
    } catch (e: any) {
      setMsg(e?.message || 'Print failed');
    } finally {
      setBusy(false);
      setBusySubtitle('');
    }
  }

  const heading = (() => {
    const depth = navPath.length;
    if (depth === 0) return 'Select a Year';
    if (isStandardYearLabel(rootLabel)) {
      if (depth === 1) return 'Select a Subject';
      if (depth === 2) return 'Select a Strand';
      if (depth === 3) return 'Select Content';
    }
    return 'Select a Folder';
  })();

  return (
    <div>
      <div ref={topRef} />
      <Header />

      <BusyOverlay open={busy} title={busyTitle} subtitle={busySubtitle} />

      {/* Student required dialog */}
      {needStudent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.6)' }}
          onClick={() => setNeedStudent(false)}
        >
          <div className="card" style={{ maxWidth: 520, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="section-title" style={{ marginBottom: 8 }}>Student required</div>
            <div className="text-muted" style={{ marginBottom: 16 }}>
              Please select a student before sending anything to the printer.
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setNeedStudent(false);
                  scrollTop();
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container">
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="badge-success">{status}</div>
            {msg && <div className="text-sm text-muted" style={{ marginLeft: 12 }}>{msg}</div>}
          </div>

          <div className="grid grid-col mt-4">
            <div>
              <div className="label">Quantity</div>
              <input
                className="input w-28"
                type="number"
                min={1}
	                max={50}
                value={qty}
	                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
              />
            </div>
            <div>
              <div className="label">Student (required)</div>
	              <StudentPicker
	                value={student}
	                onChange={setStudent}
	                onPronouns={setPronouns}
	                allowCustom
	                customLabel="Use new student"
	                onCustomPick={(name) => {
	                  // Just a small hint so staff know it's not from the official list.
	                  setMsg(`Using new student: ${name}`);
	                }}
	                required
	              />
	              <div className="text-sm text-muted mt-2">New student? Type their name and choose “Use new student”.</div>
            </div>
          </div>

	          {dropdownLevels.length > 0 && (
	            <div className="mt-4 desktop-only">
	              <div
	                className="grid grid-col"
	                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
	              >
	                {dropdownLevels.map((lvl, idx) => (
	                  <div key={idx}>
	                    <div className="label">{lvl.label}</div>
	                    <select
	                      className="input"
	                      value={lvl.value}
	                      onChange={(e) => setDropdownAt(idx, e.target.value)}
	                    >
	                      <option value="">Select…</option>
	                      {lvl.options.map((opt) => (
	                        <option key={opt} value={opt}>
	                          {opt}
	                        </option>
	                      ))}
	                    </select>
	                  </div>
	                ))}
	                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
	                  <button className="btn w-full" onClick={scrollSelection}>Go to selection</button>
	                </div>
	              </div>
	              <div className="text-sm text-muted mt-2">Tip: Use these dropdowns to jump quickly without scrolling.</div>
	            </div>
	          )}

          {/* Breadcrumb */}
          <div className="mt-4" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" onClick={refresh}>Refresh</button>
            <button className="btn" onClick={clearAll}>Clear</button>
            <button className="btn" onClick={scrollTop}>Return to top</button>
            {navPath.length > 0 && (
              <div className="text-sm text-muted" style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {navPath.map((seg, idx) => (
                  <button
                    key={seg + idx}
                    className="btn"
                    style={{ padding: '.35rem .65rem', borderRadius: 999, opacity: idx === navPath.length - 1 ? 1 : 0.85 }}
                    onClick={() => setNavPath(navPath.slice(0, idx + 1))}
                  >
                    {seg}
                  </button>
                ))}
                <button className="btn" style={{ padding: '.35rem .65rem', borderRadius: 999 }} onClick={goBack}>
                  Back
                </button>
              </div>
            )}
          </div>
        </div>

	        {/* Anchor so the “Go to selection” button scrolls to the browsing UI. */}
	        <div ref={selectionRef} />

        {/* Folder tiles */}
        {childNames.length > 0 && (
          <section className="card mt-6">
            <h2 className="section-title">{heading}</h2>
            <div className={`grid ${navPath.length === 0 ? 'grid-2' : 'grid-3'} grid-col`}>
              {childNames.map((name) => (
                <button
                  key={name}
                  className="tile p-6"
                  onClick={() => {
                    setMsg('');
                    setNavPath([...navPath, name]);
                  }}
                >
                  <div className="text-xl" style={{ fontWeight: 700 }}>{name}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Files in current folder */}
        {files.length > 0 && (
          <section className="card mt-6">
            <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <h2 className="section-title" style={{ margin: 0 }}>{navPath.join(' • ')}</h2>
              <button
                className="btn-primary"
                disabled={busy || !student}
                onClick={printFolderAll}
              >
                Print Folder
              </button>
            </div>

            <div className="head mt-2">
              <div>Type</div>
              <div>Name</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>

            {files.map((it) => (
              <div key={it.id} className="row">
                <div>{it._typeLabel || it.type || it.item_type || 'File'}</div>
                <div>{it._nameLabel || it.name || it.item_name || it.fileName}</div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn-primary" disabled={busy || !student} onClick={() => printOne(it.id)}>
                    Print
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <footer className="container footer mt-8" style={{ textAlign: 'center' }}>
          © Success Tutoring Parramatta · Theme: dark/orange
        </footer>
      </main>

      {/* Sticky bar: quick controls (esp. on mobile) */}
      <StickyBar>
        <button onClick={refresh} className="btn flex-1">Refresh</button>
        <button onClick={clearAll} className="btn flex-1">Clear</button>
        <button onClick={scrollTop} className="btn flex-1">Return to top</button>
      </StickyBar>
    </div>
  );
}
