// Generates js/charlas-calendario.js from the CSV calendar data
const fs = require('fs');
const csv = fs.readFileSync('calendario_raw.csv','utf8');
const lines = csv.trim().split('\n').slice(1); // skip header
const entries = [];
lines.forEach(line => {
  line = line.replace(/\r/g,'').trim();
  if(!line) return;
  const parts = line.split(',');
  if(parts.length < 4) return;
  const fecha = parts[0].trim();
  const tema = parts[2].trim();
  const fileId = parts[3].trim();
  if(!fecha || !fileId) return;
  // Convert DD-MM-YYYY to YYYY-MM-DD
  const [dd,mm,yyyy] = fecha.split('-');
  const isoDate = `${yyyy}-${mm}-${dd}`;
  entries.push({date:isoDate, tema, fileId});
});
const out = `// Auto-generated calendar data - ${entries.length} charlas
const CALENDARIO = ${JSON.stringify(entries, null, 0)};
`;
fs.writeFileSync('js/charlas-calendario.js', out, 'utf8');
console.log(`Generated ${entries.length} entries`);
