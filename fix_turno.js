const fs = require('fs');
let c = fs.readFileSync('turno.html', 'utf8');

const target = `  async function loadVehicles() {
    const sel = document.getElementById('sel-vehiculo');
    try {
      const snap = await db.collection('vehiculos').get();
      snap.forEach(d => {
        const v = d.data();
        if (v.estado === 'Disponible' || v.conductor === _email) {
          const emoji = getVehicleEmoji(v.marca, v.modelo);
          const opt = document.createElement('option');
          opt.value = v.patente || d.id;
          opt.textContent = \`\${emoji} \${v.patente || d.id} - \${v.marca||''} \${v.modelo||''}\`.trim();
          if (v.conductor === _email) opt.selected = true;
          sel.appendChild(opt);
        }
      });
    } catch(e) { console.warn('Error loading vehicles:', e); }
  }`;

const replacement = `  async function loadVehicles() {
    const sel = document.getElementById('sel-vehiculo');
    try {
      db.collection('vehiculos').onSnapshot(snap => {
        sel.innerHTML = '<option value="" disabled selected>Seleccionar vehículo...</option>';
        snap.forEach(d => {
          const v = d.data();
          if (v.estado === 'Disponible' || v.estado === 'Disponible ' || v.conductor === _email) {
            const emoji = getVehicleEmoji(v.marca, v.modelo);
            const opt = document.createElement('option');
            opt.value = v.patente || d.id;
            opt.textContent = \`\${emoji} \${v.patente || d.id} - \${v.marca||''} \${v.modelo||''}\`.trim();
            if (v.conductor === _email) opt.selected = true;
            sel.appendChild(opt);
          }
        });
      }, err => { console.error('Error onSnapshot vehiculos:', err); });
    } catch(e) { console.warn('Error loading vehicles:', e); }
  }`;

// Deal with weird characters () by using a regex replace for the whole function
c = c.replace(/async function loadVehicles\(\) \{[\s\S]*?\} catch\(e\) \{ console\.warn\('Error loading vehicles:', e\); \}\r?\n\s*\}/, replacement);

fs.writeFileSync('turno.html', c);
console.log('Fixed turno.html');
