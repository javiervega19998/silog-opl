

  document.getElementById('inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-inv');
    btn.disabled = true; btn.textContent = 'Guardando...';
    const qty = parseInt(document.getElementById('item-qty').value) || 0;
    let status = document.getElementById('item-status').value;
    if (qty === 0) status = 'no_disponible';
    
    const litrosPorUnidad = parseFloat(document.getElementById('item-litros-por-unidad').value) || 0;
    const kgPorUnidad = parseFloat(document.getElementById('item-kg-por-unidad').value) || 0;

    const data = {
      code:          document.getElementById('item-code').value.trim(),
      sku:           document.getElementById('item-sku').value.trim(),
      name:          document.getElementById('item-name').value.trim(),
      codigo_barras: document.getElementById('item-barcode').value.trim(),
      qty:           qty,
      cantidad:      qty,
      stock_minimo:  parseInt(document.getElementById('item-min').value) || 0,
      unit:          document.getElementById('item-unit').value,
      litros_por_unidad: litrosPorUnidad,
      kg_por_unidad:     kgPorUnidad,
      litros_actuales:   litrosPorUnidad * qty,
      kg_actuales:       kgPorUnidad * qty,
      nombre:        document.getElementById('item-name').value.trim(),
      status:        status,
      notes:         document.getElementById('item-notes').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.uid,
    };
    try {
      if (editingId) {
        await db.collection('inventory').doc(editingId).update(data);
        showToast('Ítem actualizado ✅', 'success');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = currentUser.uid;
        await db.collection('inventory').add(data);
        showToast('Ítem agregado ✅', 'success');
      }
      closeModal();
      loadInventory();
    } catch(err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Guardar';
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      applyFilter();
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
