import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import StudentPicker from '../components/StudentPicker';
import StickyBar from '../components/StickyBar';
import { fetchCSV } from '../lib/csv';
import { applyTokens, defaultClosing, PronounSet } from '../lib/tokens';

type Curriculum = {
  Year?: string;
  Subject?: string;
  Strand?: string;
  Lesson?: string;
  Topic?: string;
  Template1?: string;
  Template2?: string;
  Template3?: string;
};

type LastFeedback = {
  key: string;
  at: number;
  parentName: string;
};

export default function FeedbackPage() {
  const campusName = process.env.NEXT_PUBLIC_CAMPUS_NAME || 'Success Tutoring Parramatta';
  const campusKey = 'parramatta';

  // Curriculum vs Custom feedback
  const [mode, setMode] = useState<'curriculum' | 'custom'>('curriculum');
  const isCustom = mode === 'custom';

  const [student, setStudent] = useState('');
  const [parentName, setParentName] = useState('');
  const [pronouns, setPronouns] = useState<PronounSet>('');
  const [year, setYear] = useState('');
  const [subject, setSubject] = useState('');
  const [strand, setStrand] = useState('');
  const [lesson, setLesson] = useState('');
  const [topic, setTopic] = useState('');
  const [rows, setRows] = useState<Curriculum[]>([]);
  const [template, setTemplate] = useState('');
  const [custom, setCustom] = useState('');
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [hasEditedCustom, setHasEditedCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorName, setTutorName] = useState('');
  const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [hasPendingSend, setHasPendingSend] = useState(false);
  const [pendingSeconds, setPendingSeconds] = useState(0);
  const pendingTimeoutRef = useRef<number | null>(null);
  const pendingIntervalRef = useRef<number | null>(null);
  const pendingPayloadRef = useRef<any | null>(null);

  useEffect(() => {
    try {
      setTutorName(localStorage.getItem('st_tutor') || '');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_CURRICULUM_CSV_URL as string | undefined;
        const raw = await fetchCSV<any>(url);
        const normalised: Curriculum[] = (raw || [])
          .map((r: any) => ({
            Year: r.Year ?? r.year ?? '',
            Subject: r.Subject ?? r.subject ?? '',
            Strand: r.Strand ?? r.strand ?? '',
            Lesson: r.Lesson ?? r.lesson ?? '',
            Topic: r.Topic ?? r.topic ?? '',
            Template1: r.Template1 ?? r.template1 ?? '',
            Template2: r.Template2 ?? r.template2 ?? '',
            Template3: r.Template3 ?? r.template3 ?? '',
          }))
          .filter((r) => r.Year && r.Subject && r.Strand && r.Lesson);
        setRows(normalised);
      } catch (e: any) {
        console.error('Failed to load curriculum', e);
        setError('Failed to load curriculum – please try Refresh.');
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
      if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
    };
  }, []);

  const groups = useMemo(() => {
    return rows.filter((r) => r.Year && r.Subject && r.Strand && r.Lesson);
  }, [rows]);

  const years = useMemo(
    () => Array.from(new Set(groups.map((r) => r.Year!))),
    [groups],
  );
  const subjects = useMemo(
    () => Array.from(new Set(groups.filter((r) => r.Year === year).map((r) => r.Subject!))),
    [groups, year],
  );
  const strands = useMemo(
    () =>
      Array.from(
        new Set(
          groups
            .filter((r) => r.Year === year && r.Subject === subject)
            .map((r) => r.Strand!),
        ),
      ),
    [groups, year, subject],
  );
  const lessons = useMemo(
    () =>
      Array.from(
        new Set(
          groups
            .filter((r) => r.Year === year && r.Subject === subject && r.Strand === strand)
            .map((r) => r.Lesson!),
        ),
      ),
    [groups, year, subject, strand],
  );

  const currentRow = useMemo(
    () =>
      groups.find(
        (r) =>
          r.Year === year &&
          r.Subject === subject &&
          r.Strand === strand &&
          r.Lesson === lesson,
      ) || null,
    [groups, year, subject, strand, lesson],
  );

  useEffect(() => {
    // In curriculum mode, the topic + default template are driven by the curriculum row.
    // In custom mode, the user can type their own Topic and message.
    if (isCustom) return;
    setTopic(currentRow?.Topic || '');
    setTemplate('');
    setCustom('');
    setHasEditedCustom(false);
  }, [currentRow?.Topic, isCustom]);

  const firstName = useMemo(
    () => (student ? student.split(' ')[0] : ''),
    [student],
  );

  const tokens = useMemo(
    () => ({
      name: firstName || student || 'your child',
      topic: topic || currentRow?.Topic || '',
      subject: subject || '',
      pronouns,
      parent: parentName || 'Parent',
    }),
    [firstName, student, topic, currentRow?.Topic, subject, pronouns, parentName],
  );

  const subjectLine = useMemo(() => {
    if (!student) return '';

    if (isCustom) {
      const mid = [subject || 'Custom Feedback', topic].filter(Boolean).join(' • ');
      const lessonBit = lesson ? ` • Lesson ${lesson}` : '';
      return `${firstName || student} – ${mid}${lessonBit}`;
    }

    if (!subject || !strand || !lesson) return '';
    const mid = topic ? topic : strand;
    return `${firstName || student} – ${subject} • ${mid} • Lesson ${lesson}`;
  }, [student, firstName, subject, strand, lesson, topic, isCustom]);

  const body = useMemo(() => {
    const raw = (custom || template || '').trim();
    if (!raw) return '';
    const main = applyTokens(raw, tokens);
    const greeting = parentName
      ? `Hi ${parentName},`
      : 'Hi Parent,';

    const extraLines: string[] = [];
    if (year) extraLines.push(`Year focus: ${year}`);
    if (tutorName) extraLines.push(`Tutor: ${tutorName}`);
    const extraBlock = extraLines.length ? extraLines.join('\n') + '\n\n' : '';

    return `${greeting}\n\n${main}\n\n${extraBlock}${defaultClosing(campusName)}`;
  }, [custom, template, tokens, campusName, tutorName, parentName, year]);

  const canSend = !!student && !!body && !!subjectLine;

  function handleUseTemplate(index: number, text: string) {
    setTemplate(text || '');
    setHasEditedCustom(false);
    setSelectedTemplateIndex(index);
    // custom text will be populated via body/tokens when rendered
    setCustom(applyTokens(text || '', tokens));
  }

  
  // Keep the draft message in sync when the tutor changes student / pronouns / topic,
  // as long as they haven't manually edited the message.
  useEffect(() => {
    if (isCustom) return;
    if (selectedTemplateIndex === null) return;
    if (hasEditedCustom) return;

    const src =
      selectedTemplateIndex === 0 ? currentRow?.Template1 :
      selectedTemplateIndex === 1 ? currentRow?.Template2 :
      selectedTemplateIndex === 2 ? currentRow?.Template3 :
      '';

    const text = (src || template || '').trim();
    if (!text) return;

    setCustom(applyTokens(text, tokens));
  }, [isCustom, selectedTemplateIndex, hasEditedCustom, currentRow, template, tokens]);
function handleCustomChange(v: string) {
    setCustom(v);
    setHasEditedCustom(true);
    setSelectedTemplateIndex(null);
  }

  function clearAll() {
    setMode('curriculum');
    setStudent('');
    setParentName('');
    setPronouns('');
    setYear('');
    setSubject('');
    setStrand('');
    setLesson('');
    setTopic('');
    setTemplate('');
    setCustom('');
    setHasEditedCustom(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // NOTE: we deliberately do NOT cancel any pending send.
  }

  function setFeedbackMode(next: 'curriculum' | 'custom') {
    setMode(next);
    // Keep the chosen student, but reset the form fields so the UI is predictable.
    setYear('');
    setSubject('');
    setStrand('');
    setLesson('');
    setTopic('');
    setTemplate('');
    setCustom('');
    setHasEditedCustom(false);
    setSelectedTemplateIndex(null);
  }

  function makeFeedbackKey(): string {
    return [student, subject, strand, lesson, topic].join('|');
  }

  async function actuallySendFromPending() {
    if (!pendingPayloadRef.current) return;

    const payload = pendingPayloadRef.current;
    pendingPayloadRef.current = null;
    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
    pendingTimeoutRef.current = null;
    pendingIntervalRef.current = null;
    setHasPendingSend(false);
    setPendingSeconds(0);

    setIsSending(true);
    try {
      const res = await fetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        alert(j?.error || 'Failed to send feedback.');
      } else {
        const key = makeFeedbackKey();
        setLastFeedback({
          key,
          at: Date.now(),
          parentName: payload.meta?.parentName || parentName || 'Parent',
        });
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to send feedback.');
    } finally {
      setIsSending(false);
    }
  }

  function scheduleSend() {
    if (!canSend || isSending || hasPendingSend) return;

    const key = makeFeedbackKey();
    const now = Date.now();
    if (lastFeedback && lastFeedback.key === key && now - lastFeedback.at < 5 * 60 * 1000) {
      const again = window.confirm(
        `You recently sent feedback for this student and lesson. Send again anyway?`,
      );
      if (!again) return;
    }

    const payload = {
      toName: student,
      subject: subjectLine,
      text: body,
      meta: {
        campusKey,
        campusName,
        tutorName,
        studentFirstName: firstName || student,
        parentName: parentName || 'Parent',
        year,
        subject,
        strand,
        lesson,
        topic,
        subjectLine,
      },
    };

    pendingPayloadRef.current = payload;
    setHasPendingSend(true);
    setPendingSeconds(5);

    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);

    pendingTimeoutRef.current = window.setTimeout(() => {
      actuallySendFromPending();
    }, 5000) as unknown as number;

    pendingIntervalRef.current = window.setInterval(() => {
      setPendingSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000) as unknown as number;
  }

  function undoPending() {
    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
    pendingTimeoutRef.current = null;
    pendingIntervalRef.current = null;
    pendingPayloadRef.current = null;
    setHasPendingSend(false);
    setPendingSeconds(0);
  }

  const sendLabel = isSending ? 'Sending…' : 'Send to Parent';

  return (
    <div>
      <Header />
      <main className="container">
        <div className="card">
          <h2 className="section-title">Parent Feedback</h2>
          <p className="text-muted">
            Pick a student and lesson, choose a template, then customise the message if needed.
          </p>

          <div className="segmented mt-4">
            <button
              type="button"
              className={`seg-btn ${!isCustom ? 'active' : ''}`}
              onClick={() => setFeedbackMode('curriculum')}
            >
              Curriculum feedback
            </button>
            <button
              type="button"
              className={`seg-btn ${isCustom ? 'active' : ''}`}
              onClick={() => setFeedbackMode('custom')}
            >
              Custom feedback
            </button>
          </div>

          {isCustom && (
            <div className="text-sm text-muted mt-2">
              Custom mode: type any subject/topic you need (Selective, OC, NAPLAN, etc.) and write the message
              below.
            </div>
          )}

          <div className="mt-4">
            <label className="label">Student</label>
            <StudentPicker
              value={student}
              onChange={setStudent}
              onPronouns={setPronouns}
              onParentName={setParentName}
              required
            />
          </div>

          {!isCustom && (
            <div className="grid grid-2 grid-col mt-4">
            <div>
              <label className="label">Year</label>
              <select
                className="input"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setSubject('');
                  setStrand('');
                  setLesson('');
                }}
              >
                <option value="">Select year…</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Subject</label>
              <select
                className="input"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setStrand('');
                  setLesson('');
                }}
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            </div>
          )}

          {!isCustom && (
            <div className="grid grid-2 grid-col mt-3">
            <div>
              <label className="label">Strand</label>
              <select
                className="input"
                value={strand}
                onChange={(e) => {
                  setStrand(e.target.value);
                  setLesson('');
                }}
              >
                <option value="">Select strand…</option>
                {strands.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lesson</label>
              <select
                className="input"
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
              >
                <option value="">Select lesson…</option>
                {lessons.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            </div>
          )}

          {isCustom && (
            <div className="grid grid-2 grid-col mt-4">
              <div>
                <label className="label">Year (optional)</label>
                <input
                  className="input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. Year 6"
                />
              </div>
              <div>
                <label className="label">Subject / Program (optional)</label>
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Naplan, Selective, OC"
                />
              </div>
              <div>
                <label className="label">Lesson / Session (optional)</label>
                <input
                  className="input"
                  value={lesson}
                  onChange={(e) => setLesson(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div>
                <label className="label">Strand / Area (optional)</label>
                <input
                  className="input"
                  value={strand}
                  onChange={(e) => setStrand(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className="label">Topic</label>
            <input
              className="input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic"
            />
          </div>

          {!isCustom && currentRow && (
            <section className="mt-4">
              <h3 className="text-sm text-muted mb-2">Templates</h3>
              <div className="grid grid-3 grid-col">
                {[currentRow.Template1, currentRow.Template2, currentRow.Template3]
                  .filter(Boolean)
                  .map((t, idx) => (
                    <div
                      key={idx}
                      className={`card p-3 ${selectedTemplateIndex === idx ? 'selected-template' : ''}`}
                    >
                      <div className="text-sm text-muted mb-2">Option {idx + 1}</div>
                      <p className="text-sm" style={{ whiteSpace: 'pre-line' }}>
                        {applyTokens(t || '', tokens)}
                      </p>
                      <button
                        type="button"
                        className="btn mt-3 w-full"
                        onClick={() => handleUseTemplate(idx, t || '')}
                      >
                        Use this
                      </button>
                    </div>
                  ))}
                {!currentRow.Template1 &&
                  !currentRow.Template2 &&
                  !currentRow.Template3 && (
                    <div className="text-sm text-muted">
                      No templates for this lesson – type a custom message below.
                    </div>
                  )}
              </div>
            </section>
          )}

          <section className="mt-4">
            <label className="label">Custom message</label>
            <textarea
              className="input"
              value={custom}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={
                isCustom
                  ? 'Write a custom message…'
                  : 'Start typing or pick a template above…'
              }
            />
            <p className="text-sm text-muted mt-2">
              Tokens like {'{name}'}, {'{topic}'}, {'{they}'}, {'{their}'} will be filled in automatically.
            </p>
          </section>

          <section className="mt-4">
            <h3 className="text-sm text-muted mb-1">Preview</h3>
            <div className="card p-3" style={{ whiteSpace: 'pre-line', fontSize: '.9rem' }}>
              <div className="text-sm text-muted mb-2">Subject</div>
              <div className="mb-3">{subjectLine || '(subject will appear here)'}</div>
              <div className="text-sm text-muted mb-2">Email</div>
              <div>{body || '(message will appear here)'}</div>
              {lastFeedback && (
                <div className="text-sm text-muted mt-3">
                  Last sent to {lastFeedback.parentName} at{' '}
                  {new Date(lastFeedback.at).toLocaleTimeString()}
                </div>
              )}
            </div>
          </section>

          {error && (
            <div className="mt-3 text-sm" style={{ color: '#fca5a5' }}>
              {error}
            </div>
          )}
        </div>
      </main>

      {hasPendingSend && (
        <div className="undo-banner">
          <span>
            Message scheduled – sending in {pendingSeconds || 1}s
          </span>
          <button type="button" className="btn" onClick={undoPending}>
            Undo
          </button>
        </div>
      )}

      <StickyBar>
        <button
          className="btn-primary flex-1"
          type="button"
          disabled={!canSend || isSending || hasPendingSend}
          onClick={scheduleSend}
        >
          {sendLabel}
        </button>
        <button
          className="btn flex-1"
          type="button"
          onClick={clearAll}
        >
          Clear
        </button>
        <button
          className="btn flex-1"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Return to top
        </button>
      </StickyBar>

      <footer className="container footer mt-8" style={{ textAlign: 'center' }}>
        © Success Tutoring Parramatta · Made By Kevin John Abu
      </footer>
    </div>
  );
}
