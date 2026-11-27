'use strict';

const STORAGE_KEY = 'contamz_demo_entries_v1';

const form = document.getElementById('entry-form');
const formCard = document.getElementById('form-card');
const formError = document.getElementById('form-error');
const formEyebrow = document.getElementById('form-eyebrow');
const formTitle = document.getElementById('form-title');
const formSymbol = document.getElementById('form-symbol');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');

const kindInput = document.getElementById('kind');
const dateInput = document.getElementById('entry-date');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const vatInput = document.getElementById('vat');
const paymentInput = document.getElementById('payment');
const previewNetEl = document.getElementById('preview-net');
const previewVatEl = document.getElementById('preview-vat');

const filterSearch = document.getElementById('filter-search');
const filterKind = document.getElementById('filter-kind');
const filterPayment = document.getElementById('filter-payment');
const filterSort = document.getElementById('filter-sort');
const clearFiltersBtn = document.getElementById('clear-filters');
const emptyClearFiltersBtn = document.getElementById('empty-clear-filters');

const entriesBody = document.getElementById('entries-body');
const entriesCount = document.getElementById('entries-count');
const table = document.getElementById('entries-table');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const clearAllBtn = document.getElementById('clear-all');

const salesLabel = document.getElementById('sales-label');
const expensesLabel = document.getElementById('expenses-label');
const vatLabel = document.getElementById('vat-label');
const salesTotalEl = document.getElementById('sales-total');
const expensesTotalEl = document.getElementById('expenses-total');
const vatTotalEl = document.getElementById('vat-total');

const toastEl = document.getElementById('toast');
const toastMsgEl = document.getElementById('toast-message');
const toastUndoBtn = document.getElementById('toast-undo');

const confirmDialog = document.getElementById('confirm-dialog');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmAcceptBtn = document.getElementById('confirm-accept');

const moneyFormatter = new Intl.NumberFormat('pt-MZ', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const money = n => `${moneyFormatter.format(n)} MT`;

let entries = [];
let editingId = null;
let lastDeleted = null;
let toastTimer = null;
let lastFocusedBeforeDialog = null;

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '—';
  }
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function computeVat(amount, rate) {
  // Amount is treated as a final/gross amount. VAT is extracted from it, not added on top.
  return rate === 0 ? 0 : (amount * rate) / (100 + rate);
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (!description || !Number.isFinite(amount) || amount <= 0) return null;

  const kind = raw.kind === 'despesa' ? 'despesa' : 'venda';
  const vatRate = raw.vatRate !== undefined ? Number(raw.vatRate) : (Number(raw.vatAmount) > 0 ? 16 : 0);
  const safeRate = vatRate === 16 ? 16 : 0;
  const vatAmount = Number.isFinite(Number(raw.vatAmount))
    ? Number(raw.vatAmount)
    : computeVat(amount, safeRate);
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : (typeof raw.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.createdAt)
      ? raw.createdAt.slice(0, 10)
      : todayIsoDate());

  return {
    id: String(raw.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7))),
    kind,
    date,
    description,
    amount,
    vatRate: safeRate,
    vatAmount,
    payment: typeof raw.payment === 'string' && raw.payment ? raw.payment : 'Numerário',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined
  };
}

function readEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

entries = readEntries();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  render();
}

function showToast(message, undoPayload) {
  clearTimeout(toastTimer);
  lastDeleted = undoPayload || null;
  toastMsgEl.textContent = message;
  toastUndoBtn.hidden = !lastDeleted;
  toastEl.hidden = false;

  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
    lastDeleted = null;
  }, 6000);
}

function updateVatPreview() {
  const raw = Number(amountInput.value);
  const amount = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const rate = Number(vatInput.value) === 16 ? 16 : 0;
  const vat = computeVat(amount, rate);
  const net = amount - vat;

  previewNetEl.textContent = money(net);
  previewVatEl.textContent = money(vat);
}

function clearValidation() {
  formError.hidden = true;
  formError.textContent = '';
  [dateInput, descriptionInput, amountInput].forEach(input => {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  });
}

function showValidationError(input, message) {
  formError.textContent = message;
  formError.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', 'form-error');
  input.focus();
}

function hasActiveFilters() {
  return (
    filterSearch.value.trim() !== '' ||
    filterKind.value !== 'all' ||
    filterPayment.value !== 'all'
  );
}

function getFilteredEntries() {
  const query = filterSearch.value.trim().toLowerCase();
  const kind = filterKind.value;
  const payment = filterPayment.value;
  const sortBy = filterSort.value;

  const filtered = entries.filter(item => {
    if (kind !== 'all' && item.kind !== kind) return false;
    if (payment !== 'all' && item.payment !== payment) return false;
    if (query && !item.description.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  });

  return filtered;
}

function setFormMode(entry) {
  clearValidation();
  if (entry) {
    editingId = entry.id;
    kindInput.value = entry.kind;
    dateInput.value = entry.date;
    descriptionInput.value = entry.description;
    amountInput.value = entry.amount.toFixed(2);
    vatInput.value = String(entry.vatRate);
    paymentInput.value = entry.payment;

    formCard.classList.add('is-editing');
    formEyebrow.textContent = 'EDITAR MOVIMENTO';
    formTitle.textContent = 'Atualizar registo';
    formSymbol.textContent = '✎';
    submitBtn.textContent = 'Guardar alterações →';
    cancelEditBtn.hidden = false;

    updateVatPreview();
    formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    descriptionInput.focus();
  } else {
    editingId = null;
    form.reset();
    dateInput.value = todayIsoDate();

    formCard.classList.remove('is-editing');
    formEyebrow.textContent = 'NOVO MOVIMENTO';
    formTitle.textContent = 'Adicionar registo';
    formSymbol.textContent = '＋';
    submitBtn.textContent = 'Guardar movimento →';
    cancelEditBtn.hidden = true;
    updateVatPreview();
  }
}

function resetFilters() {
  filterSearch.value = '';
  filterKind.value = 'all';
  filterPayment.value = 'all';
  filterSort.value = 'date-desc';
  render();
  showToast('Filtros repostos.');
}

function openConfirmDialog() {
  if (!entries.length) return;
  lastFocusedBeforeDialog = document.activeElement;
  confirmDialog.hidden = false;
  confirmCancelBtn.focus();
}

function closeConfirmDialog() {
  confirmDialog.hidden = true;
  if (lastFocusedBeforeDialog && typeof lastFocusedBeforeDialog.focus === 'function') {
    lastFocusedBeforeDialog.focus();
  }
  lastFocusedBeforeDialog = null;
}

function createCell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function render() {
  const filtered = getFilteredEntries();
  const filtersActive = hasActiveFilters();

  entriesBody.innerHTML = '';

  let sales = 0;
  let expenses = 0;
  let vatSales = 0;

  filtered.forEach(item => {
    if (item.kind === 'venda') {
      sales += item.amount;
      vatSales += item.vatAmount;
    } else {
      expenses += item.amount;
    }

    const tr = document.createElement('tr');
    if (item.id === editingId) {
      tr.classList.add('is-editing');
    }

    const dateTd = createCell(formatDate(item.date), 'date-cell');
    const descTd = createCell(item.description);

    const typeTd = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = 'type-tag' + (item.kind === 'despesa' ? ' expense' : '');
    tag.textContent = item.kind === 'venda' ? 'Venda' : 'Despesa';
    typeTd.append(tag);

    const paymentTd = document.createElement('td');
    const paymentBadge = document.createElement('span');
    paymentBadge.className = 'payment-pill';
    paymentBadge.textContent = item.payment;
    paymentTd.append(paymentBadge);

    const amountTd = createCell(money(item.amount), 'num-cell');
    const vatTd = createCell(money(item.vatAmount), 'num-cell');

    const actionTd = document.createElement('td');
    actionTd.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-entry';
    editBtn.type = 'button';
    editBtn.textContent = 'Editar';
    editBtn.setAttribute('aria-label', `Editar ${item.description}`);
    editBtn.addEventListener('click', () => {
      setFormMode(item);
      render();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-entry';
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', `Eliminar ${item.description}`);
    delBtn.addEventListener('click', () => {
      const idx = entries.findIndex(x => x.id === item.id);
      if (idx === -1) return;
      const removed = entries[idx];
      entries.splice(idx, 1);
      if (editingId === item.id) {
        setFormMode(null);
      }
      save();
      showToast(`Movimento "${removed.description}" eliminado.`, { entry: removed, index: idx });
    });

    actionTd.append(editBtn, delBtn);
    tr.append(dateTd, descTd, typeTd, paymentTd, amountTd, vatTd, actionTd);
    entriesBody.append(tr);
  });

  const suffix = filtersActive ? ' (filtro)' : '';
  salesLabel.textContent = `Total de vendas${suffix}`;
  expensesLabel.textContent = `Total de despesas${suffix}`;
  vatLabel.textContent = `IVA incluído nas vendas*${suffix}`;

  salesTotalEl.textContent = money(sales);
  expensesTotalEl.textContent = money(expenses);
  vatTotalEl.textContent = money(vatSales);

  if (filtersActive) {
    entriesCount.textContent = `${filtered.length} de ${entries.length}`;
  } else {
    entriesCount.textContent = `${entries.length} ${entries.length === 1 ? 'movimento' : 'movimentos'}`;
  }

  clearFiltersBtn.hidden = !filtersActive;
  clearAllBtn.disabled = entries.length === 0;

  emptyState.hidden = entries.length > 0;
  noResultsState.hidden = !(entries.length > 0 && filtered.length === 0);
  table.hidden = filtered.length === 0;
}

function applyInitialQueryParams() {
  if (typeof window === 'undefined' || !window.location || !window.location.search) return;
  const params = new URLSearchParams(window.location.search);
  const presetAmount = Number(params.get('valor'));
  const presetRate = params.get('taxa');
  if (Number.isFinite(presetAmount) && presetAmount > 0) {
    amountInput.value = presetAmount.toFixed(2);
  }
  if (presetRate === '0' || presetRate === '16') {
    vatInput.value = presetRate;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  clearValidation();

  const kind = kindInput.value === 'despesa' ? 'despesa' : 'venda';
  const date = dateInput.value;
  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const rate = Number(vatInput.value) === 16 ? 16 : 0;
  const payment = paymentInput.value;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    showValidationError(dateInput, 'Selecione uma data válida para o movimento.');
    return;
  }
  if (!description) {
    showValidationError(descriptionInput, 'Introduza uma descrição para o movimento.');
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showValidationError(amountInput, 'Introduza um valor total superior a 0,00 MT.');
    return;
  }

  const vatAmount = computeVat(amount, rate);

  if (editingId) {
    entries = entries.map(item =>
      item.id === editingId
        ? {
            ...item,
            kind,
            date,
            description,
            amount,
            vatRate: rate,
            vatAmount,
            payment,
            updatedAt: new Date().toISOString()
          }
        : item
    );
    setFormMode(null);
    save();
    showToast(`Movimento "${description}" atualizado.`);
  } else {
    entries.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      kind,
      date,
      description,
      amount,
      vatRate: rate,
      vatAmount,
      payment,
      createdAt: new Date().toISOString()
    });
    form.reset();
    dateInput.value = todayIsoDate();
    updateVatPreview();
    save();
    showToast(`Movimento "${description}" guardado.`);
    descriptionInput.focus();
  }
});

[dateInput, descriptionInput, amountInput].forEach(input => {
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') {
      clearValidation();
    }
  });
});

amountInput.addEventListener('input', updateVatPreview);
vatInput.addEventListener('change', updateVatPreview);

cancelEditBtn.addEventListener('click', () => {
  setFormMode(null);
  render();
  showToast('Edição cancelada.');
});

clearAllBtn.addEventListener('click', openConfirmDialog);
confirmCancelBtn.addEventListener('click', closeConfirmDialog);
confirmAcceptBtn.addEventListener('click', () => {
  entries = [];
  setFormMode(null);
  closeConfirmDialog();
  save();
  showToast('Todos os movimentos foram removidos.');
});

confirmDialog.addEventListener('click', event => {
  if (event.target === confirmDialog) {
    closeConfirmDialog();
  }
});

confirmDialog.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    if (event.shiftKey && document.activeElement === confirmCancelBtn) {
      event.preventDefault();
      confirmAcceptBtn.focus();
    } else if (!event.shiftKey && document.activeElement === confirmAcceptBtn) {
      event.preventDefault();
      confirmCancelBtn.focus();
    }
  }
});

toastUndoBtn.addEventListener('click', () => {
  if (!lastDeleted) return;
  const { entry, index } = lastDeleted;
  const insertAt = Math.min(Math.max(index, 0), entries.length);
  entries.splice(insertAt, 0, entry);
  lastDeleted = null;
  save();
  showToast(`Movimento "${entry.description}" restaurado.`);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!confirmDialog.hidden) {
    closeConfirmDialog();
  } else if (editingId) {
    setFormMode(null);
    render();
    showToast('Edição cancelada.');
  }
});

[filterSearch, filterKind, filterPayment, filterSort].forEach(control => {
  const eventName = control.tagName === 'INPUT' ? 'input' : 'change';
  control.addEventListener(eventName, render);
});

clearFiltersBtn.addEventListener('click', resetFilters);
emptyClearFiltersBtn.addEventListener('click', resetFilters);

dateInput.value = todayIsoDate();
applyInitialQueryParams();
updateVatPreview();
render();
