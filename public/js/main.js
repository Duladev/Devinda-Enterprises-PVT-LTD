// Handles dynamic add/remove of item rows on Sales & Purchase forms,
// and auto-calculates line subtotal + grand total.

function addItemRow(tableBodyId, productsOptionsHtml) {
  const tbody = document.getElementById(tableBodyId);
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select name="product_id" class="form-select form-select-sm product-select" required>
        <option value="">-- Select product --</option>
        ${productsOptionsHtml}
      </select>
    </td>
    <td><input type="number" step="0.01" min="0" name="quantity" class="form-control form-control-sm qty-input" required></td>
    <td><input type="number" step="0.01" min="0" name="unit_price" class="form-control form-control-sm price-input" required></td>
    <td class="subtotal-cell text-end">0.00</td>
    <td class="text-center"><i class="bi bi-x-circle item-row-remove" onclick="removeItemRow(this)"></i></td>
  `;
  tbody.appendChild(row);
  attachRowEvents(row);
}

function removeItemRow(el) {
  const row = el.closest('tr');
  row.remove();
  recalcTotal();
}

function attachRowEvents(row) {
  const qty = row.querySelector('.qty-input');
  const price = row.querySelector('.price-input');
  [qty, price].forEach(input => {
    input.addEventListener('input', () => {
      const subtotal = (parseFloat(qty.value) || 0) * (parseFloat(price.value) || 0);
      row.querySelector('.subtotal-cell').textContent = subtotal.toFixed(2);
      recalcTotal();
    });
  });
}

function recalcTotal() {
  const subtotals = document.querySelectorAll('.subtotal-cell');
  let total = 0;
  subtotals.forEach(cell => { total += parseFloat(cell.textContent) || 0; });
  const totalDisplay = document.getElementById('grandTotalDisplay');
  if (totalDisplay) totalDisplay.textContent = total.toFixed(2);
  const totalHidden = document.getElementById('grandTotalHidden');
  if (totalHidden) totalHidden.value = total.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('table tbody tr').forEach(attachRowEvents);
});
