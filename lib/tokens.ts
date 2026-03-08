export type PronounSet = 'she/her'|'he/him'|'they/them'|'';

type PronounTokens = {
  they: string; them: string; their: string; theirs: string;
  is: string; has: string; does: string;
};

function pick(pronouns: PronounSet): PronounTokens {
  switch (pronouns) {
    case 'she/her': return { they:'she', them:'her', their:'her', theirs:'hers', is:'is', has:'has', does:'does' };
    case 'he/him':  return { they:'he',  them:'him', their:'his', theirs:'his', is:'is', has:'has', does:'does' };
    case 'they/them': return { they:'they', them:'them', their:'their', theirs:'theirs', is:'are', has:'have', does:'do' };
    default: return { they:'they', them:'them', their:'their', theirs:'theirs', is:'is', has:'has', does:'does' };
  }
}

export function applyTokens(template: string, params: {
  name?: string; topic?: string; year?: string; tutor?: string; subject?: string; lesson?: string;
  pronouns?: PronounSet;
}) {
  const p = pick(params.pronouns || '');
  const caps = (s:string) => s.charAt(0).toUpperCase() + s.slice(1);
  const map: Record<string,string> = {
    name: params.name || '',
    topic: params.topic || '',
    subject: params.subject || '',
    lesson: params.lesson || '',
    year: params.year || '',
    tutor: params.tutor || '',
    they: p.they,
    them: p.them,
    their: p.their,
    theirs: p.theirs,
    They: caps(p.they),
    Them: caps(p.them),
    Their: caps(p.their),
    Theirs: caps(p.theirs),
    THEY: p.they.toUpperCase(),
    THEM: p.them.toUpperCase(),
    THEIR: p.their.toUpperCase(),
    THEIRS: p.theirs.toUpperCase(),
    is_are: p.is,
    has_have: p.has,
    does_do: p.does,
    IS_ARE: p.is.toUpperCase(),
    HAS_HAVE: p.has.toUpperCase(),
    DOES_DO: p.does.toUpperCase(),
  };
  return template.replace(/\{([A-Za-z_]+)\}/g, (_, key) => (map[key] ?? ''));
}

export function defaultClosing(campusName?:string) {
  return `

Kind regards,
${campusName || 'Success Tutoring Parramatta'}
If you have any queries, feel free to contact us on 0401 051 838.`;
}
