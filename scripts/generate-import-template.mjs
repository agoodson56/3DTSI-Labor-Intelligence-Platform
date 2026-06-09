// Generates the 3DTSI project bulk-import Excel template with dropdowns and
// a reference sheet. Output: web/public/templates/3DTSI-Project-Import-Template.xlsx
// Run: node scripts/generate-import-template.mjs
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'templates', '3DTSI-Project-Import-Template.xlsx');

const TEAL = 'FF0C8A80';
const GOLD = 'FFD4AF37';
const INK = 'FF0B1215';
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

const HEADERS = [
  { key: 'projectNumber', title: 'Project Number*', width: 18, note: 'Required. Must be unique - rows with an existing project number are skipped.' },
  { key: 'name', title: 'Project Name*', width: 38, note: 'Required.' },
  { key: 'customer', title: 'Customer*', width: 28, note: 'Required. Created automatically if it does not exist yet.' },
  { key: 'siteAddress', title: 'Site Address', width: 38 },
  { key: 'marketSegment', title: 'Market Segment', width: 16, note: 'Pick from the dropdown. Defaults to Commercial.' },
  { key: 'projectType', title: 'Project Type', width: 18, note: 'Pick from the dropdown. Defaults to Installation.' },
  { key: 'officeLocation', title: 'Office Location', width: 16, note: 'Your branch/office name, e.g. Nashville.' },
  { key: 'laborBudgetHours', title: 'Labor Budget Hours', width: 18, note: 'Total estimated labor man-hours for the project.' },
  { key: 'pmEmail', title: 'PM Email', width: 26, note: 'Optional. Must match an existing user to be assigned.' },
  { key: 'systems', title: 'Systems (comma-separated)', width: 44, note: 'Optional. Comma-separated list from the Reference sheet, e.g. "Fire Alarm, Access Control". Limits the systems technicians see for this project.' },
];

const wb = new ExcelJS.Workbook();
wb.creator = '3DTSI Labor Intelligence Platform';

// ---------- Instructions ----------
const info = wb.addWorksheet('Instructions');
info.columns = [{ width: 110 }];
const lines = [
  ['3DTSI LABOR INTELLIGENCE PLATFORM - PROJECT IMPORT TEMPLATE', 'title'],
  [''],
  ['How to use this template', 'h'],
  ['1. Fill one row per project on the "Projects" sheet. Two example rows are provided - replace them.'],
  ['2. Columns marked with * are required: Project Number, Project Name, Customer.'],
  ['3. Market Segment and Project Type have dropdowns. Valid values are also listed on the "Reference" sheet.'],
  ['4. Systems: type a comma-separated list from the Reference sheet (e.g. "Fire Alarm, Access Control, CCTV / Video Surveillance").'],
  ['   When provided, technicians only see those systems when tracking work on the project.'],
  ['5. Save the file, then in the web app go to Admin -> Projects -> Import from Excel and choose this file.'],
  [''],
  ['Import behavior', 'h'],
  ['- Customers that do not exist yet are created automatically with the row\'s market segment.'],
  ['- Rows whose Project Number already exists are skipped (nothing is overwritten).'],
  ['- PM Email is matched against existing platform users; unmatched emails are noted but do not block the import.'],
  ['- Every imported project automatically gets a QR code (printable from Admin -> Projects).'],
  ['- The importer reports the result of every row: created, skipped, or the exact error.'],
];
lines.forEach(([text, style], i) => {
  const cell = info.getCell(i + 1, 1);
  cell.value = text ?? '';
  if (style === 'title') {
    cell.font = { name: 'Arial', size: 16, bold: true, color: { argb: TEAL } };
  } else if (style === 'h') {
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: GOLD } };
  } else {
    cell.font = { name: 'Arial', size: 11 };
  }
});

// ---------- Projects ----------
const ws = wb.addWorksheet('Projects', { views: [{ state: 'frozen', ySplit: 1 }] });
ws.columns = HEADERS.map((h) => ({ key: h.key, width: h.width }));

const headerRow = ws.getRow(1);
HEADERS.forEach((h, i) => {
  const cell = headerRow.getCell(i + 1);
  cell.value = h.title;
  cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  cell.alignment = { vertical: 'middle' };
  cell.border = { bottom: { style: 'medium', color: { argb: INK } } };
  if (h.note) cell.note = { texts: [{ text: h.note, font: { name: 'Arial', size: 10 } }] };
});
headerRow.height = 22;

// example rows (blue = user input convention)
const EXAMPLES = [
  ['P-2026-101', 'East Tower Fire Alarm Retrofit', 'Metro General Hospital', '100 Hospital Way, Nashville TN', 'Healthcare', 'Retrofit', 'Nashville', 500, 'pm@3dtsi.com', 'Fire Alarm, Access Control'],
  ['P-2026-102', 'High School Camera Expansion', 'Franklin ISD', '400 Rebel Rd, Franklin TX', 'Education', 'Installation', 'Dallas', 320, '', 'CCTV / Video Surveillance, Structured Cabling, Networking'],
];
EXAMPLES.forEach((row, r) => {
  row.forEach((v, c) => {
    const cell = ws.getCell(r + 2, c + 1);
    cell.value = v === '' ? null : v;
    cell.font = { name: 'Arial', color: { argb: 'FF0000FF' } };
    if (r % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  });
});

// dropdown validations for 500 data rows
for (let r = 2; r <= 501; r++) {
  ws.getCell(r, 5).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`Reference!$B$2:$B$${MARKETS.length + 1}`],
    showErrorMessage: true,
    errorTitle: 'Invalid market segment',
    error: 'Pick a market segment from the dropdown (see Reference sheet).',
  };
  ws.getCell(r, 6).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`Reference!$C$2:$C$${PROJECT_TYPES.length + 1}`],
    showErrorMessage: true,
    errorTitle: 'Invalid project type',
    error: 'Pick a project type from the dropdown (see Reference sheet).',
  };
  ws.getCell(r, 8).dataValidation = {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    allowBlank: true,
    formulae: [0],
    showErrorMessage: true,
    errorTitle: 'Invalid budget',
    error: 'Labor Budget Hours must be a number greater than or equal to 0.',
  };
}

// ---------- Reference ----------
const ref = wb.addWorksheet('Reference');
ref.columns = [{ width: 36 }, { width: 20 }, { width: 22 }];
[['Systems', SYSTEMS], ['Market Segments', MARKETS], ['Project Types', PROJECT_TYPES]].forEach(([title, values], col) => {
  const head = ref.getCell(1, col + 1);
  head.value = title;
  head.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  values.forEach((v, i) => {
    const cell = ref.getCell(i + 2, col + 1);
    cell.value = v;
    cell.font = { name: 'Arial' };
  });
});

mkdirSync(dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);
console.log(`Template written: ${OUT}`);
