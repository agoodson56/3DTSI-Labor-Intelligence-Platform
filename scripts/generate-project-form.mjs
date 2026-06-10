// Generates the single-project PM setup form (Description / Answer layout,
// based on the form 3DTSI project managers fill out per project).
// Output: web/public/templates/3DTSI-Project-Form.xlsx
// Run: node scripts/generate-project-form.mjs
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'templates', '3DTSI-Project-Form.xlsx');

const TEAL = 'FF0C8A80';
const GOLD = 'FFD4AF37';
const LIGHT = 'FFECFDFA';

const SYSTEMS = [
  'Structured Cabling',
  'Fiber Optic Systems',
  'Access Control',
  'CCTV / Video Surveillance',
  'Intrusion Detection',
  'Networking',
  'Audio Visual',
  'Fire Alarm',
  'Data Center',
  'Specialty Electrical / Low Voltage',
  'Service',
];
const MARKETS = ['Healthcare', 'Education', 'Government', 'Military', 'Commercial', 'Industrial', 'Data Centers'];
const PROJECT_TYPES = ['Installation', 'Retrofit', 'Service', 'Design-Build', 'Tenant Improvement'];

const wb = new ExcelJS.Workbook();
wb.creator = '3DTSI Labor Intelligence Platform';

const ws = wb.addWorksheet('Project Form');
ws.columns = [{ width: 26 }, { width: 48 }];

// Title
ws.mergeCells('A1:B1');
const title = ws.getCell('A1');
title.value = '3DTSI PROJECT SETUP FORM';
title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
title.alignment = { horizontal: 'center', vertical: 'middle' };
ws.getRow(1).height = 26;

ws.mergeCells('A2:B2');
const sub = ws.getCell('A2');
sub.value = 'Fill the Answer column, save, then upload in the app: Admin -> Projects -> Import from Excel';
sub.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };

// Header row
const hdr = ws.getRow(3);
hdr.getCell(1).value = 'Description';
hdr.getCell(2).value = 'Answer';
for (const c of [1, 2]) {
  hdr.getCell(c).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF105954' } };
}

const FIELDS = [
  { label: 'Project Number*', note: 'Required. Unique job number, e.g. P-2026-105.' },
  { label: 'Project Name*', note: 'Required.' },
  { label: 'Customer*', note: 'Required. Created automatically if new.' },
  { label: 'Project Address' },
  { label: 'Market Segment', list: 'markets' },
  { label: 'Project Type', list: 'types' },
  { label: 'Office Location' },
  { label: 'Labor Budget Hours', note: 'Total estimated labor man-hours.' },
  { label: 'Project Manager', note: 'Name or email. Matched to a platform user when possible.' },
  { label: 'Project Superintendent' },
  { label: 'Project Foreman / Lead' },
  { label: 'Project System #1', list: 'systems' },
  { label: 'Project System #2', list: 'systems' },
  { label: 'Project System #3', list: 'systems' },
  { label: 'Project System #4', list: 'systems' },
  { label: 'Project System #5', list: 'systems' },
  { label: 'Project System #6', list: 'systems' },
];

const LIST_RANGES = {
  systems: `Reference!$A$2:$A$${SYSTEMS.length + 1}`,
  markets: `Reference!$B$2:$B$${MARKETS.length + 1}`,
  types: `Reference!$C$2:$C$${PROJECT_TYPES.length + 1}`,
};

FIELDS.forEach((f, i) => {
  const row = ws.getRow(i + 4);
  const label = row.getCell(1);
  label.value = f.label;
  label.font = { name: 'Arial', bold: true };
  if (f.label.includes('*')) label.font = { name: 'Arial', bold: true, color: { argb: 'FFB8932A' } };
  if (f.note) label.note = { texts: [{ text: f.note, font: { name: 'Arial', size: 10 } }] };

  const answer = row.getCell(2);
  answer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  answer.font = { name: 'Arial', color: { argb: 'FF0000FF' } };
  answer.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  if (f.list) {
    answer.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [LIST_RANGES[f.list]],
      showErrorMessage: true,
      errorTitle: 'Pick from the list',
      error: 'Choose a value from the dropdown (see Reference sheet).',
    };
  }
});

// Reference sheet
const ref = wb.addWorksheet('Reference');
ref.columns = [{ width: 36 }, { width: 20 }, { width: 22 }];
[['Systems', SYSTEMS], ['Market Segments', MARKETS], ['Project Types', PROJECT_TYPES]].forEach(([t, values], col) => {
  const head = ref.getCell(1, col + 1);
  head.value = t;
  head.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  values.forEach((v, i) => {
    ref.getCell(i + 2, col + 1).value = v;
    ref.getCell(i + 2, col + 1).font = { name: 'Arial' };
  });
});

mkdirSync(dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);
console.log(`Project form written: ${OUT}`);
