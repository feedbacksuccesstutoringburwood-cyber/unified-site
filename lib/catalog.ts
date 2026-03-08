export type CatalogItem = {
  id: number;
  year?: string;
  subject?: string;
  topic?: string;
  type?: string;
  name?: string;
  item_type?: string;
  item_name?: string;
  path?: string;
  page_count?: number;
  file_bytes?: number;
  active?: number;
};

export type TreeFile = CatalogItem & {
  fileName: string;
  folderSegments: string[];
};

export type TreeNode = {
  name: string;
  pathSegments: string[];
  children: Map<string, TreeNode>;
  files: TreeFile[];
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function normalizePath(p: string) {
  return p.replace(/\\/g, '/').replace(/^\//, '');
}

function splitPath(p?: string) {
  if (!p) return [];
  return normalizePath(p).split('/').filter(Boolean);
}

export function buildCatalogTree(items: CatalogItem[]): TreeNode {
  const root: TreeNode = { name: '__root__', pathSegments: [], children: new Map(), files: [] };

  for (const it of items || []) {
    if (!it?.path) continue;
    const parts = splitPath(it.path);
    if (parts.length < 2) continue;
    const fileName = parts[parts.length - 1];
    const folderSegments = parts.slice(0, -1);

    let node = root;
    for (const seg of folderSegments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, {
          name: seg,
          pathSegments: [...node.pathSegments, seg],
          children: new Map(),
          files: [],
        });
      }
      node = node.children.get(seg)!;
    }

    node.files.push({ ...it, fileName, folderSegments });
  }

  // If there's a single top-level "Content" folder, treat it as the real root.
  if (root.children.size === 1) {
    const only = [...root.children.values()][0];
    if (only.name.toLowerCase() === 'content') return only;
  }

  return root;
}

export function getNode(root: TreeNode, pathSegments: string[]): TreeNode {
  let node = root;
  for (const seg of pathSegments) {
    const next = node.children.get(seg);
    if (!next) return node;
    node = next;
  }
  return node;
}

export function listChildNames(node: TreeNode): string[] {
  return [...node.children.keys()].sort(collator.compare);
}

export function isStandardYearLabel(label: string) {
  const l = label.trim().toLowerCase();
  if (l === 'kindy' || l === 'kindergarten') return true;
  if (l.startsWith('year ')) {
    const n = parseInt(l.replace('year ', ''), 10);
    return Number.isFinite(n) && n >= 1 && n <= 12;
  }
  return false;
}

export type SortResult = {
  typeLabel: string;
  nameLabel: string;
  sortKey: [number, number, number, string];
};

function parseFileSort(fileName: string, hasLessons: boolean): SortResult {
  const base = fileName.replace(/\.[^/.]+$/, '');
  const cleaned = base.trim();
  const upper = cleaned.toUpperCase();

  // Support both short codes (L1/R1/H1) and descriptive names (Lesson 1, Revision 2, Homework 3).
  // We keep it anchored to the start to avoid false positives.
  const mL = upper.match(/^(?:L\s*(\d{1,2})\b|LESSON\s*(\d{1,2})\b)/);
  if (mL) {
    const n = parseInt(mL[1] || mL[2], 10);
    return { typeLabel: 'Lesson', nameLabel: `Lesson #${n}`, sortKey: [0, n, 0, cleaned] };
  }
  const mR = upper.match(/^(?:R\s*(\d{1,2})\b|REVISION\s*(\d{1,2})\b|REV\s*(\d{1,2})\b)/);
  if (mR) {
    // IMPORTANT: R1/R2/etc should only be treated as "Revision" when lessons
    // exist in the same folder. Otherwise "R" may mean something else.
    if (!hasLessons) {
      return { typeLabel: 'File', nameLabel: cleaned, sortKey: [3, 0, 0, cleaned] };
    }
    const n = parseInt(mR[1] || mR[2] || mR[3], 10);
    return { typeLabel: 'Revision', nameLabel: `Revision #${n}`, sortKey: [0, n, 1, cleaned] };
  }
  if (upper.includes('ASSESSMENT') || upper === 'A' || upper.startsWith('A ')) {
    return { typeLabel: 'Assessment', nameLabel: 'Assessment', sortKey: [1, 0, 0, cleaned] };
  }
  const mH = upper.match(/^(?:H\s*(\d{1,2})\b|HW\s*(\d{1,2})\b|HOMEWORK\s*(\d{1,2})\b|HWK\s*(\d{1,2})\b)/);
  if (mH) {
    const n = parseInt(mH[1] || mH[2] || mH[3] || mH[4], 10);
    return { typeLabel: 'Homework', nameLabel: `Homework #${n}`, sortKey: [2, n, 0, cleaned] };
  }
  return { typeLabel: 'File', nameLabel: cleaned, sortKey: [3, 0, 0, cleaned] };
}

export function sortFilesForDisplay(files: TreeFile[], standardOrdering: boolean) {
  const hasLessons = (files || []).some((f) => {
    const up = (f.fileName || '').toUpperCase();
    return /^(?:L\s*\d{1,2}\b|LESSON\s*\d{1,2}\b)/.test(up);
  });

  // Use structured ordering when:
  // - standard K-12 year content (explicit), OR
  // - lesson-like files exist (so L1/L2 sorts properly and L1,R1 interleaving
  //   works anywhere, including OC/Selective, when revisions are present too).
  const useStructured = standardOrdering || hasLessons;

  const mapped = (files || []).map((f) => {
    const info = parseFileSort(f.fileName, hasLessons);
    return {
      ...f,
      _typeLabel: info.typeLabel,
      _nameLabel: info.nameLabel,
      _sortKey: info.sortKey,
    };
  });

  mapped.sort((a, b) => {
    if (useStructured) {
      // L/R interleaved, then Assessment, then Homework, then others
      for (let i = 0; i < a._sortKey.length; i++) {
        const av = a._sortKey[i];
        const bv = b._sortKey[i];
        if (typeof av === 'number' && typeof bv === 'number') {
          if (av !== bv) return av - bv;
        } else {
          const s = collator.compare(String(av), String(bv));
          if (s !== 0) return s;
        }
      }
      return 0;
    }

    // generic: filename ascending
    return collator.compare(a.fileName, b.fileName);
  });

  return mapped;
}
