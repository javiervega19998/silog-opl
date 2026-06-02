const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let newContent = content.replace(/>Historial Viajes</g, '>Viajes<');
  // Handle other potential cases:
  newContent = newContent.replace(/<title>Silog SpA · Historial Viajes<\/title>/g, '<title>Silog SpA · Viajes</title>');
  newContent = newContent.replace(/<div class="module-name">Historial Viajes<\/div>/g, '<div class="module-name">Viajes</div>');
  newContent = newContent.replace(/>Historial de Viajes</g, '>Viajes<');
  newContent = newContent.replace(/<div class="module-name">Historial de Viajes<\/div>/g, '<div class="module-name">Viajes</div>');
  
  if (content !== newContent) {
    fs.writeFileSync(f, newContent);
    console.log('Updated', f);
  }
});
