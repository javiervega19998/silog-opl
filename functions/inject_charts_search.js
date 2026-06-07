/**
 * Agrega buscador global en finanzas.html y gráficos Chart.js en dashboard.html
 */
const fs = require('fs');
const path = require('path');
const BASE = 'C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\silog-ops';

// ══════════════════════════════════════════════════════════════
// 1. BÚSQUEDA EN FINANZAS — Agrega barra de búsqueda global
// ══════════════════════════════════════════════════════════════
{
  const file = path.join(BASE, 'finanzas.html');
  let html = fs.readFileSync(file, 'utf8');

  // Add search bar CSS (if not already there)
  if (!html.includes('search-global')) {
    const searchCSS = `
.search-global-wrap{display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 16px}
.search-global-wrap input{flex:1;background:transparent;border:none;color:var(--text);font-size:.88rem;font-family:'Inter',sans-serif;outline:none}
.search-global-wrap input::placeholder{color:var(--text2)}
.search-global-wrap .s-icon{font-size:1.1rem;color:var(--text2)}
`;
    html = html.replace('/* Tabs */', searchCSS + '/* Tabs */');

    // Add search bar HTML before the tab row
    const tabRowMatch = html.indexOf('<div class="tab-row">');
    if (tabRowMatch !== -1) {
      const searchHTML = `
  <!-- Búsqueda Global -->
  <div class="search-global-wrap">
    <span class="s-icon">🔍</span>
    <input type="text" id="global-search" placeholder="Buscar por conductor, comuna, patente, cliente…" oninput="onGlobalSearch(this.value)"/>
    <button onclick="document.getElementById('global-search').value='';onGlobalSearch('');" style="background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:.85rem;padding:0">✕</button>
  </div>\n`;
      html = html.slice(0, tabRowMatch) + searchHTML + html.slice(tabRowMatch);
    }
    console.log('✅ finanzas.html → search bar HTML+CSS agregado');
  }

  // Add onGlobalSearch function to finanzas_script.js
  const scriptFile = path.join(BASE, 'js', 'finanzas_script.js');
  let script = fs.readFileSync(scriptFile, 'utf8');
  if (!script.includes('onGlobalSearch')) {
    const searchFn = `
// ── Búsqueda Global ──────────────────────────────────────────
function onGlobalSearch(q) {
  q = (q || '').toLowerCase().trim();
  // Buscar en tabla centro de costos
  const rows = document.querySelectorAll('#centro-costos-body tr, #hojas-ruta-body tr, #tabla-gastos-body tr');
  rows.forEach(function(row) {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
  // Buscar en prefacturas
  const fRows = document.querySelectorAll('#facturas-body tr');
  fRows.forEach(function(row) {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}
`;
    script = searchFn + script;
    fs.writeFileSync(scriptFile, script, 'utf8');
    console.log('✅ finanzas_script.js → onGlobalSearch() agregado');
  }

  fs.writeFileSync(file, html, 'utf8');
}

// ══════════════════════════════════════════════════════════════
// 2. GRÁFICOS EN DASHBOARD — Chart.js
// ══════════════════════════════════════════════════════════════
{
  const file = path.join(BASE, 'dashboard.html');
  let html = fs.readFileSync(file, 'utf8');

  if (html.includes('Chart.js') || html.includes('chart.js')) {
    console.log('ℹ️  dashboard.html ya tiene Chart.js');
  } else {
    // Add Chart.js script tag before </body>
    const chartScript = `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`;
    html = html.replace('</body>', chartScript + '\n</body>');

    // Find a good place to insert chart cards — after the stats section or before </main>
    const chartCards = `
  <!-- Charts Section -->
  <div id="charts-section" style="display:none;margin-top:20px">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:14px">
      <h3 style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent);margin-bottom:14px">📈 Entregas de los Últimos 7 Días</h3>
      <canvas id="chart-entregas" height="120"></canvas>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px">
        <h3 style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent);margin-bottom:14px">🚛 Estado Flota</h3>
        <canvas id="chart-flota" height="140"></canvas>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px">
        <h3 style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent);margin-bottom:14px">💰 Gastos por Tipo</h3>
        <canvas id="chart-gastos" height="140"></canvas>
      </div>
    </div>
  </div>`;

    // Insert before last </div> before </body> — specifically find the main closing div
    const mainCloseIdx = html.lastIndexOf('</div>\n</body>');
    if (mainCloseIdx !== -1) {
      html = html.slice(0, mainCloseIdx) + chartCards + '\n</div>\n</body>';
    } else {
      // Fallback: insert before </body>
      html = html.replace('</body>', chartCards + '\n</body>');
    }

    console.log('✅ dashboard.html → chart containers agregados');
    fs.writeFileSync(file, html, 'utf8');
  }

  // Add chart initialization to dash_script.js
  const scriptFile = path.join(BASE, 'js', 'dash_script.js');
  let script = fs.readFileSync(scriptFile, 'utf8');

  if (!script.includes('initCharts')) {
    const chartFn = `
// ── Charts ───────────────────────────────────────────────────
let _chartsInitialized = false;
async function initCharts() {
  if (_chartsInitialized || typeof Chart === 'undefined') return;
  const section = document.getElementById('charts-section');
  if (section) section.style.display = 'block';
  _chartsInitialized = true;

  // 1. Entregas últimos 7 días
  try {
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' }));
      const snap = await db.collection('despachos')
        .where('estado', '==', 'entregado')
        .get();
      let count = 0;
      snap.forEach(doc => {
        const f = doc.data().pod_timestamp || doc.data().fecha;
        if (f && f.toDate) {
          const fd = f.toDate().toISOString().slice(0, 10);
          if (fd === iso) count++;
        }
      });
      data.push(count);
    }
    const ctx1 = document.getElementById('chart-entregas');
    if (ctx1) new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Entregas', data, backgroundColor: 'rgba(16,185,129,.6)', borderColor: '#10B981', borderWidth: 1, borderRadius: 6 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: {
        x: { ticks: { color: '#8A9DC0', font: { size: 11 } }, grid: { color: 'rgba(30,48,86,.5)' } },
        y: { ticks: { color: '#8A9DC0', font: { size: 11 } }, grid: { color: 'rgba(30,48,86,.5)' }, beginAtZero: true, precision: 0 }
      }}
    });
  } catch(e) { console.warn('Chart entregas:', e.message); }

  // 2. Estado de flota (donut)
  try {
    const vSnap = await db.collection('vehiculos').get();
    const counts = { 'Disponible': 0, 'En Ruta': 0, 'Mantención': 0, 'Fuera de Servicio': 0 };
    vSnap.forEach(d => { const e = d.data().estado || ''; if (counts[e] !== undefined) counts[e]++; });
    const ctx2 = document.getElementById('chart-flota');
    if (ctx2) new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: ['rgba(16,185,129,.7)','rgba(244,121,32,.7)','rgba(245,158,11,.7)','rgba(239,68,68,.7)'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8A9DC0', font: { size: 11 }, padding: 10 } } } }
    });
  } catch(e) { console.warn('Chart flota:', e.message); }

  // 3. Gastos por tipo (pie)
  try {
    const gSnap = await db.collection('gastos_ruta').limit(200).get();
    const byTipo = {};
    gSnap.forEach(d => { const t = d.data().tipo || 'Otro'; byTipo[t] = (byTipo[t] || 0) + (d.data().monto || 0); });
    const ctx3 = document.getElementById('chart-gastos');
    if (ctx3) new Chart(ctx3, {
      type: 'pie',
      data: {
        labels: Object.keys(byTipo),
        datasets: [{ data: Object.values(byTipo), backgroundColor: ['rgba(96,165,250,.7)','rgba(244,121,32,.7)','rgba(16,185,129,.7)','rgba(245,158,11,.7)','rgba(167,139,250,.7)'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8A9DC0', font: { size: 11 }, padding: 10 } } } }
    });
  } catch(e) { console.warn('Chart gastos:', e.message); }
}
`;
    // Append to end of script
    script = script + chartFn;
    // Also call initCharts after the main data load — find where loadDashboard or similar finishes
    // We'll call it from a DOMContentLoaded listener
    script = script + `\ndocument.addEventListener('DOMContentLoaded', function() { setTimeout(initCharts, 2000); });\n`;
    fs.writeFileSync(scriptFile, script, 'utf8');
    console.log('✅ dash_script.js → initCharts() agregado');
  } else {
    console.log('ℹ️  dash_script.js ya tiene charts');
  }
}

console.log('\n✅ Finanzas + Dashboard actualizados');
