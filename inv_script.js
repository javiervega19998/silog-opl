

import { updateInventory } from './js/services.js';

  document.getElementById('inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-inv');
    btn.disabled = true; btn.textContent = 'Guardando...';
    const disp = parseInt(document.getElementById('item-qty').value) || 0;
    const noDisp = parseInt(document.getElementById('item-nodisp').value) || 0;
    const qty = disp + noDisp;
    let status = document.getElementById('item-status').value;
    if (qty === 0) status = 'no_disponible';
    
    const litrosPorUnidad = parseFloat(document.getElementById('item-litros-por-unidad').value) || 0;
    const kgPorUnidad = parseFloat(document.getElementById('item-kg-por-unidad').value) || 0;

    const data = {
      code:          document.getElementById('item-code').value.trim(),
      name:          document.getElementById('item-name').value.trim(),
      codigo_barras: document.getElementById('item-barcode').value.trim(),
      qty:           qty,
      cantidad:      qty,
      disponible:    disp,
      no_disponible: noDisp,
      stock_minimo:  parseInt(document.getElementById('item-min').value) || 0,
      unit:          document.getElementById('item-unit').value,
      litros_por_unidad: litrosPorUnidad,
      kg_por_unidad:     kgPorUnidad,
      litros_actuales:   litrosPorUnidad * qty,
      kg_actuales:       kgPorUnidad * qty,
      nombre:        document.getElementById('item-name').value.trim(),
      status:        status,
      notes:         document.getElementById('item-notes').value.trim(),
    };

    if (window.editingId) {
      data.id = window.editingId; // Añadir ID para indicar que es una actualización
    }

    try {
      await updateInventory(data);
      if (window.editingId) {
        if(window.showToast) window.showToast('Ítem actualizado ✅', 'success');
      } else {
        if(window.showToast) window.showToast('Ítem agregado ✅', 'success');
      }
      if (window.closeModal) window.closeModal();
      if (window.loadInventory) window.loadInventory();
    } catch(err) {
      // El error ya fue manejado (mostrado) en el servicio, aquí solo capturamos para evitar crasheos si hay más lógica
      console.warn("La operación fue abortada en el servicio.");
    }
    btn.disabled = false; btn.textContent = 'Guardar';
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      window.currentFilter = tab.dataset.filter;
      if (window.applyFilter) window.applyFilter();
    });
  });
  document.getElementById('search-inv').addEventListener('input', applyFilter);

  requireAuth((user, userData) => {
    renderNavbar(userData);
    userRole = userData.rol || userData.role;
    loadInventory();
    // Check low stock
    checkLowStock();
  });

  // ═══ COMPARTIDO: Las importaciones y exportaciones de Excel se manejan en js/inventory-helpers.js ═══
