import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCSV } from '../lib/csv';
import type { PronounSet } from '../lib/tokens';

// Supports two possible CSV schemas:
// A) id, firstName, lastName, gender, parentName, parentEmail, years
// B) Name, Email, Year, Gender, Pronouns, ParentName, ParentEmail

type StudentRowA = {
  id?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  parentName?: string;
  parentEmail?: string;
  years?: string;
  pronouns?: string;
};

type StudentRowB = {
  Name?: string;
  Email?: string;
  Year?: string;
  Gender?: string;
  Pronouns?: string;
  ParentName?: string;
  ParentEmail?: string;
};

type Student = {
  name: string; // full name
  email: string; // parent email (preferred)
  parentName: string;
  year: string;
  gender: string;
  pronouns: string;
};

function inferPronouns(s: { gender?: string; pronouns?: string }): PronounSet {
  const raw = `${s.pronouns || ''} ${s.gender || ''}`.toLowerCase().trim();

  // Pronouns column wins if present
  if (raw.includes('she') || raw.includes('her')) return 'she/her';
  if (raw.includes('he') || raw.includes('him') || raw.includes('his')) return 'he/him';
  if (raw.includes('they') || raw.includes('them') || raw.includes('their')) return 'they/them';

  // Gender fallbacks
  if (raw.includes('female') || raw === 'f' || raw.includes('girl') || raw.includes('woman')) return 'she/her';
  if (raw.includes('male') || raw === 'm' || raw.includes('boy') || raw.includes('man')) return 'he/him';

  return '';
}

function normalizeRow(row: StudentRowA | StudentRowB): Student | null {
  // RowA
  const rA = row as StudentRowA;
  if ((rA.firstName || '').trim() || (rA.lastName || '').trim()) {
    const first = (rA.firstName || '').trim();
    const last = (rA.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    if (!full) return null;
    return {
      name: full,
      email: (rA.parentEmail || '').trim(),
      parentName: (rA.parentName || '').trim(),
      year: (rA.years || '').trim(),
      gender: (rA.gender || '').trim(),
      pronouns: (rA.pronouns || '').trim(),
    };
  }

  // RowB
  const rB = row as StudentRowB;
  const name = (rB.Name || '').trim();
  if (!name) return null;
  return {
    name,
    email: (rB.ParentEmail || rB.Email || '').trim(),
    parentName: (rB.ParentName || '').trim(),
    year: (rB.Year || '').trim(),
    gender: (rB.Gender || '').trim(),
    pronouns: (rB.Pronouns || '').trim(),
  };
}

function scoreMatch(student: Student, tokens: string[]): number {
  const name = student.name.toLowerCase();
  const email = student.email.toLowerCase();

  // Split name into words for better prefix matching
  const nameWords = name.split(/\s+/).filter(Boolean);

  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    let matched = false;

    // Strong: word prefix ("li" matches "lily")
    if (nameWords.some(w => w.startsWith(t))) {
      score += 6;
      matched = true;
    } else if (name.startsWith(t)) {
      score += 5;
      matched = true;
    } else if (name.includes(t)) {
      score += 3;
      matched = true;
    } else if (email.startsWith(t)) {
      score += 2;
      matched = true;
    } else if (email.includes(t)) {
      score += 1;
      matched = true;
    }

    if (!matched) return 0; // all tokens must match somewhere
  }

  const joined = tokens.join(' ').trim();
  if (joined && name === joined) score += 100;

  return score;
}

export default function StudentPicker({
  value,
  onChange,
  onPronouns,
  onParentName,
  required,
  autoFocus,
  allowCustom,
  onCustomPick,
  customLabel = 'Use custom student',
  placeholder = 'Search name or email...',
}: {
  value: string;
  onChange: (v: string) => void;
  onPronouns?: (p: PronounSet) => void;
  onParentName?: (name: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  allowCustom?: boolean;
  onCustomPick?: (name: string) => void;
  customLabel?: string;
  placeholder?: string;
}) {
  const [list, setList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const url = process.env.NEXT_PUBLIC_CONTACTS_CSV_URL as string | undefined;
        const rows = await fetchCSV<StudentRowA | StudentRowB>(url);
        const cleaned = (rows || [])
          .map(normalizeRow)
          .filter(Boolean) as Student[];

        cleaned.sort((a, b) => a.name.localeCompare(b.name));

        setList(cleaned);
      } catch (error: any) {
        console.error('Failed to load students', error);
        setList([]);
        setLoadError('Failed to load student list');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // click outside to close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    // Show a chunk of the list immediately when focused
    if (!query) return list.slice(0, 200);

    const tokens = query.split(/\s+/).filter(Boolean);

    return list
      .map(s => ({ s, score: scoreMatch(s, tokens) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .slice(0, 200)
      .map(x => x.s);
  }, [list, q]);

  const pick = (s: Student) => {
    onChange(s.name);
    onParentName && onParentName(s.parentName);
    onPronouns && onPronouns(inferPronouns({ gender: s.gender, pronouns: s.pronouns }));
    setQ('');
    setOpen(false);
  };

  const pickCustom = () => {
    const name = q.trim();
    if (!name) return;
    onChange(name);
    onParentName && onParentName('');
    onPronouns && onPronouns('');
    onCustomPick && onCustomPick(name);
    setQ('');
    setOpen(false);
  };

  // When opened, we let tutors type fresh queries (input is the query)
  const displayValue = open ? q : value;
  const effectivePlaceholder = open ? (value ? `Selected: ${value}` : placeholder) : placeholder;

  const showCustomOption = useMemo(() => {
    if (!allowCustom) return false;
    const query = q.trim();
    if (query.length < 2) return false;
    const exists = list.some(s => s.name.toLowerCase() === query.toLowerCase());
    return !exists;
  }, [allowCustom, q, list]);

  return (
    <div className="relative" ref={rootRef}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="input"
        placeholder={effectivePlaceholder}
        value={displayValue}
        onFocus={() => {
          setOpen(true);
          // If there's already a value selected, keep it visible while closed;
          // on focus we still show the full list and allow typing.
        }}
        onChange={e => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            // Don't auto-pick the first suggestion on Enter (too easy to mis-pick on typos).
            // Only pick when the query EXACTLY matches a student name/email, or the explicit custom option.
            e.preventDefault();
            const queryRaw = q.trim();
            const query = queryRaw.toLowerCase();
            if (!query) return;

            const exact = list.find(
              s =>
                s.name.toLowerCase() === query ||
                (s.email && s.email.toLowerCase() === query)
            );
            if (exact) {
              pick(exact);
              return;
            }

            if (showCustomOption && filtered.length === 0) {
              pickCustom();
            }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        required={required}
      />

      {open && (
        <div className="suggest-panel" role="listbox">
          {loading && <div className="suggest-item suggest-hint">Loading students…</div>}
          {!loading && loadError && <div className="suggest-item suggest-hint">{loadError}</div>}

          {!loading && !loadError && showCustomOption && (
            <div className="suggest-item" onClick={pickCustom}>
              <div>
                <b>{customLabel}:</b> {q.trim()}
              </div>
              <div className="suggest-hint">(prints/logs under this name)</div>
            </div>
          )}

          {!loading && !loadError && filtered.map(s => (
            <div key={`${s.email}|${s.name}`} className="suggest-item" onClick={() => pick(s)}>
              <div>
                <div>{s.name}</div>
                {!!s.year && <div className="suggest-hint">{s.year}</div>}
              </div>
              <div className="suggest-hint">{s.email}</div>
            </div>
          ))}

          {!loading && !loadError && !filtered.length && !showCustomOption && (
            <div className="suggest-item suggest-hint">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
