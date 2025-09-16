/*
Отслеживание расходов
  - transaction: { id, name, amount (number), type: 'income'|'expense', dateISO }
  - Ключ для хранения: 'expenseTrackerTransactions_v1'
*/


const LS_KEY = 'expenseTrackerTransactions_v1';
const formatCurrency = (n) => {
  // форматируем для ru-RU, валюта ₽
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(n);
  } catch(e) {
    
    return (Math.round(n * 100) / 100).toFixed(2) + ' ₽';
  }
};

const el = (sel) => document.querySelector(sel);

// --- Состояние ---
let transactions = [];

// загрузка из локального хранилища
function loadTransactions() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    
    transactions = [];
    saveTransactions();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      transactions = parsed.map(t => ({
        id: t.id,
        name: String(t.name || ''),
        amount: Number(t.amount) || 0,
        type: t.type === 'expense' ? 'expense' : 'income',
        dateISO: t.dateISO || new Date().toISOString()
      }));
    } else {
      transactions = [];
    }
  } catch (e) {
    console.warn('Не удалось прочитать localStorage, очищаем...', e);
    transactions = [];
  }
}

function saveTransactions() {
  localStorage.setItem(LS_KEY, JSON.stringify(transactions));
}

// --- Основное ---
function addTransaction(name, amount, type) {
  // сумма, переданная как число
  const tx = {
    id: Date.now().toString(36) + Math.floor(Math.random()*10000).toString(36),
    name: String(name).trim(),
    amount: Number(amount) || 0,
    type: type === 'expense' ? 'expense' : 'income',
    dateISO: new Date().toISOString()
  };
  transactions.unshift(tx); 
  saveTransactions();
  render();
}

function deleteTransaction(id) {
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  transactions.splice(idx, 1);
  saveTransactions();
  render();
}

function clearAll() {
  if (!confirm('Вы точно хотите удалить все транзакции? Эта операция необратима.')) return;
  transactions = [];
  saveTransactions();
  render();
}

function exportJSON() {
  const data = JSON.stringify(transactions, null, 2);
  // создать двоичный файл для загрузки
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// вычисление сум
function computeTotals() {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += Number(t.amount) || 0;
    else expense += Number(t.amount) || 0;
  }
  income = Math.round(income * 100) / 100;
  expense = Math.round(expense * 100) / 100;
  const balance = Math.round((income - expense) * 100) / 100;
  return { income, expense, balance };
}

// отображение list & totals
function render() {
  const list = el('#txList');
  list.innerHTML = '';

  if (transactions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<strong>Пока нет транзакций</strong><div style="margin-top:6px">Добавьте доход или расход через форму выше.</div>';
    list.appendChild(empty);
  } else {
    for (const t of transactions) {
      const item = document.createElement('div');
      item.className = 'tx';

      const meta = document.createElement('div');
      meta.className = 'meta';

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = t.type === 'income' ? getComputedStyle(document.documentElement).getPropertyValue('--income') : getComputedStyle(document.documentElement).getPropertyValue('--expense');

      const textBlock = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = t.name || '(без названия)';
      const date = document.createElement('div');
      date.className = 'date';
      const d = new Date(t.dateISO);
      date.textContent = d.toLocaleString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric', hour:'2-digit', minute:'2-digit' });

      textBlock.appendChild(title);
      textBlock.appendChild(date);

      meta.appendChild(dot);
      meta.appendChild(textBlock);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';

      const amount = document.createElement('div');
      amount.className = 'amount ' + (t.type === 'income' ? 'income' : 'expense');
      const sign = t.type === 'income' ? '+' : '-';
      amount.textContent = sign + ' ' + formatCurrency(Math.abs(Number(t.amount) || 0));

      const del = document.createElement('button');
      del.className = 'delete';
      del.setAttribute('aria-label', 'Удалить транзакцию ' + (t.name || ''));
      del.textContent = 'Удалить';
      del.addEventListener('click', () => {
        if (confirm('Удалить транзакцию "' + (t.name || '') + '"?')) deleteTransaction(t.id);
      });

      right.appendChild(amount);
      right.appendChild(del);

      item.appendChild(meta);
      item.appendChild(right);

      list.appendChild(item);
    }
  }

  // обновить totals
  const totals = computeTotals();
  el('#incomeValue').textContent = formatCurrency(totals.income);
  el('#expenseValue').textContent = formatCurrency(totals.expense);
  const balEl = el('#balanceValue');
  balEl.textContent = formatCurrency(totals.balance);
  
  if (totals.balance > 0) {
    balEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--income');
  } else if (totals.balance < 0) {
    balEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--expense');
  } else {
    balEl.style.color = '';
  }
}

// --- Обработка форм ---
const form = el('#txForm');
form.addEventListener('submit', function(e){
  e.preventDefault();
  const name = el('#txName').value.trim();
  const amountRaw = el('#txAmount').value;
  const type = document.querySelector('input[name="txType"]:checked').value;

  if (!name) {
    alert('Введите название транзакции.');
    el('#txName').focus();
    return;
  }

  if (amountRaw === '' || isNaN(Number(amountRaw))) {
    alert('Введите корректную сумму.');
    el('#txAmount').focus();
    return;
  }

  const amount = Number(amountRaw);
  if (amount <= 0) {
    alert('Сумма должна быть больше нуля.');
    el('#txAmount').focus();
    return;
  }

  addTransaction(name, amount, type);

  el('#txName').value = '';
  el('#txAmount').value = '';
  el('#txName').focus();
});

// --- Кнопки ---
el('#clearAll').addEventListener('click', clearAll);
el('#exportBtn').addEventListener('click', exportJSON);

// начальная загрузка и рендер
loadTransactions();
render();

// фокусировка ввода
window.addEventListener('load', () => { setTimeout(()=>el('#txName').focus(), 150); });