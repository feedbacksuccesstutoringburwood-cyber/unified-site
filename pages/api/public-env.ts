export default function handler(_req:any,res:any){
  const keys = ['NEXT_PUBLIC_CONTACTS_CSV_URL','NEXT_PUBLIC_CURRICULUM_CSV_URL','NEXT_PUBLIC_SHEET_REFRESH_MS','NEXT_PUBLIC_CAMPUS_NAME','PRINT_API_URL'];
  const obj:any = {};
  for (const k of keys) obj[k] = process.env[k] ? 'set' : 'missing';
  res.status(200).json(obj);
}
