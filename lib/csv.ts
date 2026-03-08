import Papa from 'papaparse';

export async function fetchCSV<T=any>(url?: string): Promise<T[]> {
  if (!url) return [];
  const res = await fetch(url);
  if (!res.ok) return [];
  const text = await res.text();
  const out = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  return (out.data as any) || [];
}
