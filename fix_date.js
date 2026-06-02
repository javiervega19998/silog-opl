const fs = require('fs');
let html = fs.readFileSync('scratch/silog-ops/js/inventory-helpers.js', 'utf8');

const targetDate = \const tripDate = trip.fecha_despacho || trip.fecha || '';
        if(tripDate) g.fechaEntrega = tripDate;\;
        
const replaceDate = \let tripDate = trip.fecha_despacho || trip.fecha || '';
        if(tripDate) {
           if (tripDate.includes('-')) {
              const parts = tripDate.split('-');
              if (parts[0].length === 4) tripDate = \\-\-\\;
           }
           g.fechaEntrega = tripDate;
        }\;

html = html.replace(targetDate, replaceDate);

fs.writeFileSync('scratch/silog-ops/js/inventory-helpers.js', html, 'utf8');
console.log('inventory-helpers.js updated');
