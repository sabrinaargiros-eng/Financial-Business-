// --- DATA STORE (LocalStorage Wrapper) ---
const DB = {
    get: (key, defaultVal) => JSON.parse(localStorage.getItem(key)) || defaultVal,
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// --- INITIAL STATE ---
const INITIAL_PRODUCTS = [
    { id: 'crostatina_ciocco', name: 'Crostatina Cioccolato', icon: '🍫', start: 20, restock: 0, sales: 0, type: 'sweet' },
    { id: 'crostatina_albicocca', name: 'Crostatina Albicocca', icon: '🍑', start: 20, restock: 0, sales: 0, type: 'sweet' },
    { id: 'pan_goccole', name: 'Pan Goccole', icon: '🍪', start: 20, restock: 0, sales: 0, type: 'sweet' },
    { id: 'patatina', name: 'Patatina', icon: '🍟', start: 30, restock: 0, sales: 0, type: 'chip' },
];

const INITIAL_TEAM = [
    { id: 1, name: 'Tommaso', salesSweet: 27, salesChip: 8 },
    { id: 2, name: 'Alessandro', salesSweet: 10, salesChip: 2 },
];

const INITIAL_SUBS = [
    { id: 1, name: 'Sofia 1H', days: [false, false, false, false, false] },
    { id: 2, name: 'Leonardo 1H', days: [false, false, false, false, false] },
];

const INITIAL_CREDITS = [
    { id: 1, name: 'Alexandra 1H', amount: 2.00 },
    { id: 2, name: 'Fabrizio 5D', amount: 1.00 },
];

// --- APP STATE ---
let products = DB.get('products', INITIAL_PRODUCTS);
let team = DB.get('team', INITIAL_TEAM);
let subs = DB.get('subs', INITIAL_SUBS);
let credits = DB.get('credits', INITIAL_CREDITS);
let transactions = DB.get('transactions', []); // { id, date, type, amount, desc }
let inventoryHistory = DB.get('inventoryHistory', []); // { date, products: [{id, sales, end...}] }

// Migration: Ensure all have IDs
transactions = transactions.map(t => ({ ...t, id: t.id || Math.random().toString(36).substr(2, 9) }));
DB.set('transactions', transactions);

// --- NAVIGATION ---
function switchTab(tabName) {
    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Find the clicked element based on simple logic (not robust but works for fixed tabs)
    const index = ['home', 'inventory', 'team', 'subs', 'credits'].indexOf(tabName);
    document.querySelectorAll('.nav-item')[index].classList.add('active');

    // Update View
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabName}`).classList.add('active');

    // Trigger Re-renders
    if (tabName === 'home') renderDashboard();
    if (tabName === 'inventory') renderInventory();
    if (tabName === 'team') renderTeam();
    if (tabName === 'subs') renderSubs();
    if (tabName === 'credits') renderCredits();
}

// --- RENDER FUNCTIONS ---

let currentInventoryDate = new Date().toISOString().split('T')[0];

function loadInventoryDate(date) {
    currentInventoryDate = date;
    renderInventory();
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    // Set date picker value to match current state
    const picker = document.getElementById('inventory-date-picker');
    if (picker) picker.value = currentInventoryDate;

    const todayStr = new Date().toISOString().split('T')[0];

    const isToday = currentInventoryDate === todayStr;

    // Sync Logic: If viewing/editing Today, ensure Start matches the most recent history End
    if (isToday) {
        syncLiveStartWithHistory();
    }

    // Determine Data Source
    let displayProducts = [];

    if (isToday) {
        displayProducts = products; // Live Data
    } else {
        // Historical Data
        let entry = inventoryHistory.find(h => h.date === currentInventoryDate);

        if (!entry) {
            // Virtual Entry for Backfilling or Planning
            // Try to find the closest PREVIOUS record to pull "Start" values from
            const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            const prevEntry = sortedHistory.find(h => h.date < currentInventoryDate);

            displayProducts = products.map(p => {
                let startVal = 0;
                if (prevEntry) {
                    const prevP = prevEntry.products.find(hp => hp.id === p.id);
                    if (prevP) startVal = prevP.end;
                }

                return {
                    id: p.id,
                    name: p.name,
                    icon: getProductIcon(p.id),
                    start: startVal,
                    restock: 0,
                    end: startVal, // Default to start (no sales yet)
                    sales: 0
                };
            });
        } else {
            displayProducts = entry.products.map(p => ({ ...p, icon: getProductIcon(p.id) }));
        }
    }

    displayProducts.forEach(p => {
        // Common Logic
        // In History: p.end is valid. In Live: p.currentEnd is used. 
        const startVal = p.start;
        const restockVal = p.restock;
        const endVal = isToday ? (p.currentEnd !== undefined ? p.currentEnd : (p.start + p.restock)) : p.end;

        // Recalculate sales for display
        const maxStock = startVal + restockVal;
        const calculatedSales = maxStock - endVal;
        const lowStock = endVal < 5 ? `<span style="color: var(--color-expense); font-weight: bold;">⚠ BASSA SCORTA</span>` : '';

        // Restock Display: Text in Live (safe), Input in History (edit correction)
        const restockDisplay = isToday
            ? `<b>${restockVal}</b>`
            : `<input type="number" value="${restockVal}" style="width: 40px; text-align: center; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;" onchange="updateHistoryItem('${p.id}', 'restock', this.value)">`;

        // Start Display: Text in Live (safe), Input in History (edit correction)
        const startDisplay = isToday
            ? `<b>${startVal}</b>`
            : `<input type="number" value="${startVal}" style="width: 40px; text-align: center; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;" onchange="updateHistoryItem('${p.id}', 'start', this.value)">`;

        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3>${p.icon || '📦'} ${p.name}</h3>
                ${lowStock}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 5px; text-align: center; font-size: 0.8rem;">
                <div>Inizio<br>${startDisplay}</div>
                <div>Riforn.<br>${restockDisplay}</div>
                <div>Vendite<br><b>${calculatedSales}</b></div>
                <div style="color: var(--color-income)">
                    Rimanenza<br>
                    <input type="number" 
                        value="${endVal}" 
                        min="0" 
                        max="${maxStock}" /* Note: Max might be violated if editing restock, but loose validation ok here */
                        style="width: 50px; text-align: center; border-radius: 5px; border: 1px solid #555; background: #222; color: #fff;"
                        onchange="${isToday ? `updateProductEnd('${p.id}', this.value)` : `updateHistoryItem('${p.id}', 'end', this.value)`}"
                    >
                </div>
            </div>
            ${isToday ? `
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn glass-card" style="flex: 1" onclick="openStockModal('${p.id}', 'restock')">+ Riforn.</button>
            </div>` : ''}
        `;
        list.appendChild(card);
    });

    // Add Chart Container if not exists
    if (!document.getElementById('inventoryChart')) {
        const chartDiv = document.createElement('div');
        chartDiv.className = 'glass-card';
        chartDiv.style.marginTop = '20px';
        chartDiv.innerHTML = `<h2 style="text-align: center;">Andamento Vendite</h2><canvas id="inventoryChartCanvas"></canvas>`;
        list.parentNode.appendChild(chartDiv);
    }
    renderInventoryChart();

    // Add Close Day Button if not exists (Only Today)
    if (isToday && !document.getElementById('btn-close-day')) {
        const container = document.createElement('div');
        container.style.marginTop = '20px';
        container.style.display = 'flex';
        container.style.gap = '10px';

        const btnClose = document.createElement('button');
        btnClose.id = 'btn-close-day';
        btnClose.className = 'btn';
        btnClose.style.flex = '2';
        btnClose.style.background = 'var(--color-profit)';
        btnClose.style.color = '#000';
        btnClose.innerText = '🌙 Chiudi Giornata';
        btnClose.onclick = () => closeDay();

        const btnPause = document.createElement('button');
        btnPause.className = 'btn glass-card';
        btnPause.style.flex = '1';
        btnPause.innerText = '⏸ Pausa';
        btnPause.onclick = registerPauseDay;

        container.appendChild(btnClose);
        container.appendChild(btnPause);
        list.parentNode.appendChild(container);
    }

    // Add Reset Button if not exists
    if (!document.getElementById('btn-reset-inv')) {
        const btn = document.createElement('button');
        btn.id = 'btn-reset-inv';
        btn.className = 'btn';
        btn.style.width = '100%';
        btn.style.marginTop = '10px';
        btn.style.background = 'var(--color-expense)'; // Red warning color
        btn.style.color = '#fff';
        btn.innerText = '⚠ Reset Totale Magazzino';
        btn.onclick = resetInventoryData;
        list.parentNode.appendChild(btn);
    }
}

function getProductIcon(id) {
    const p = INITIAL_PRODUCTS.find(x => x.id === id);
    return p ? p.icon : '📦';
}

function updateHistoryItem(id, field, val) {
    let entry = inventoryHistory.find(h => h.date === currentInventoryDate);

    // If saving for a date that doesn't exist yet, create it!
    if (!entry) {
        // Inherit from previous
        const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const prevEntry = sortedHistory.find(h => h.date < currentInventoryDate);

        entry = {
            date: currentInventoryDate,
            products: INITIAL_PRODUCTS.map(p => {
                let startVal = 0;
                if (prevEntry) {
                    const prevP = prevEntry.products.find(hp => hp.id === p.id);
                    if (prevP) startVal = prevP.end;
                }
                return {
                    id: p.id, name: p.name,
                    start: startVal, restock: 0, end: startVal, sales: 0
                };
            })
        };
        inventoryHistory.push(entry);
    }

    const p = entry.products.find(p => p.id === id);
    if (!p) return;

    let numVal = parseInt(val);
    if (isNaN(numVal)) numVal = 0;

    if (field === 'start') p.start = numVal;
    if (field === 'restock') p.restock = numVal;
    if (field === 'end') p.end = numVal;

    // Recalculate Sales
    p.sales = (p.start + p.restock) - p.end;

    DB.set('inventoryHistory', inventoryHistory);
    renderInventory();
    renderInventoryChart(); // Update chart
    renderInventoryChart(); // Update chart
}

function syncLiveStartWithHistory() {
    // 1. Sort history by date descending
    const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. Find latest entry strictly before today
    const todayStr = new Date().toISOString().split('T')[0];
    const lastEntry = sortedHistory.find(h => h.date < todayStr);

    if (!lastEntry) return; // No history to sync from

    let changed = false;
    products.forEach(p => {
        const histP = lastEntry.products.find(hp => hp.id === p.id);
        if (histP && p.start !== histP.end) {
            p.start = histP.end;
            changed = true;
        }
    });

    if (changed) {
        DB.set('products', products);
    }
}

function resetInventoryData() {
    if (!confirm("ATTENZIONE: Questo azzererà TUTTI i dati del magazzino (Inizio, Rifornimenti, Rimanenze).\nSei sicuro di voler procedere?")) return;

    products.forEach(p => {
        p.start = 0;
        p.restock = 0;
        p.sales = 0;
        p.currentEnd = 0;
    });

    DB.set('products', products);
    renderInventory();
    alert("Magazzino resettato!");
}

function updateProductEnd(id, val) {
    const p = products.find(p => p.id === id);
    if (!p) return;

    // Validate
    const max = p.start + p.restock;
    let newEnd = parseInt(val);
    if (newEnd < 0) newEnd = 0;
    if (newEnd > max) newEnd = max;

    p.currentEnd = newEnd;
    p.sales = max - newEnd; // Update internal sales tracking too for legacy?
    // Actually we should store 'sales' as the derived value.

    DB.set('products', products);
    renderInventory();
}

function openStockModal(id, type) {
    const p = products.find(p => p.id === id);
    if (!p) return;

    // Only Restock allowed via modal now
    if (type !== 'restock') return;

    const html = `
        <input type="hidden" id="s-id" value="${id}">
        <input type="hidden" id="s-type" value="${type}">
        <div style="text-align: center; margin-bottom: 20px;">
            <h3>${p.icon} ${p.name}</h3>
            <p>Quanti prodotti vuoi aggiungere?</p>
        </div>
        <div class="form-group">
            <label>Quantità</label>
            <input type="number" id="s-amount" class="form-input" value="1" min="1">
        </div>
        <button class="btn" style="width: 100%; background: var(--color-income); color: #000;" onclick="confirmStockUpdate()">
            Conferma Rifornimento
        </button>
    `;
    openModal("Rifornimento", html);
    setTimeout(() => document.getElementById('s-amount').select(), 100);
}

function confirmStockUpdate() {
    const id = document.getElementById('s-id').value;
    const type = document.getElementById('s-type').value;
    const amount = parseInt(document.getElementById('s-amount').value);

    if (amount > 0) {
        updateStock(id, type, amount);
        closeModal();
    } else {
        alert("Inserisci una quantità valida.");
    }
}

function updateStock(id, type, amount) {
    const p = products.find(p => p.id === id);
    if (!p) return;

    if (type === 'restock') {
        p.restock += amount;
        // When we add restock, we assume potential stock increases.
        // Current End should probably increase by same amount to keep Sales constant?
        // Or does user physically count AFTER restock?
        // Usually: Restocking puts items on shelf. So End count (what is on shelf) increases.
        if (p.currentEnd !== undefined) p.currentEnd += amount;
    }

    DB.set('products', products);
    renderInventory();
}

function registerPauseDay() {
    if (!confirm("Registrare oggi come GIORNO DI PAUSA?\n\n- Nessuna vendita verrà registrata.\n- Le scorte rimarranno invariate per domani.\n- La giornata verrà chiusa.")) return;

    // Force set End = Start (so Sales = 0)
    products.forEach(p => {
        p.restock = 0;
        p.currentEnd = p.start; // No sales
    });

    closeDay(true); // Call closeDay with skipConfirm = true
}

function closeDay(skipConfirm = false) {
    if (!skipConfirm && !confirm("Sicuro di voler chiudere la giornata?\nQuesto salverà i dati attuali e preparerà il magazzino per domani.")) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Log History
    const historyEntry = {
        date: todayStr,
        products: products.map(p => ({
            id: p.id,
            name: p.name,
            start: p.start,
            restock: p.restock,
            end: p.currentEnd,
            sales: (p.start + p.restock) - p.currentEnd
        }))
    };
    inventoryHistory.push(historyEntry);
    DB.set('inventoryHistory', inventoryHistory);

    // 2. Rotate Days
    products.forEach(p => {
        const nextStart = p.currentEnd;
        p.start = nextStart;
        p.restock = 0;
        p.sales = 0; // Reset calculated sales
        p.currentEnd = nextStart; // Initial assumption for next day
    });
    DB.set('products', products);

    alert("Giornata chiusa con successo!");
    renderInventory();
    renderDashboard(); // Update home chart if needed (depends on transaction logic, but we decoupled that)
}

let inventoryChart;
function renderInventoryChart() {
    const ctx = document.getElementById('inventoryChartCanvas');
    if (!ctx) return;

    if (inventoryChart) inventoryChart.destroy();

    // Prepare datasets
    const allDates = inventoryHistory.map(h => new Date(h.date).toLocaleDateString());
    // Get unique product IDs
    const productIds = INITIAL_PRODUCTS.map(p => p.id);

    const datasets = productIds.map(pid => {
        const pRef = INITIAL_PRODUCTS.find(p => p.id === pid);
        const data = inventoryHistory.map(h => {
            const pHist = h.products.find(hp => hp.id === pid);
            return pHist ? pHist.sales : 0;
        });

        // Generate random color or use fixed if defined
        const color = pRef.type === 'sweet' ? '#FF69B4' : '#FFD700';

        return {
            label: pRef.name,
            data: data,
            borderColor: color,
            backgroundColor: 'transparent',
            tension: 0.3
        };
    });

    inventoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { grid: { display: false } }
            }
        }
    });

}

function renderTeam() {
    const list = document.getElementById('team-list');
    list.innerHTML = '';
    // Sort by total items sold
    const sortedTeam = [...team].sort((a, b) => (b.salesSweet + b.salesChip) - (a.salesSweet + a.salesChip));

    sortedTeam.forEach((member, idx) => {
        const total = member.salesSweet + member.salesChip;
        const rank = idx + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5rem;">${medal}</span>
                <div>
                    <strong>${member.name}</strong><br>
                    <small style="color: var(--text-secondary)">Totale: ${total}</small>
                </div>
            </div>
            <div style="text-align: right; font-size: 0.9rem;">
                <div>🍫 ${member.salesSweet}</div>
                <div>🍟 ${member.salesChip}</div>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderSubs() {
    const list = document.getElementById('subs-list');
    list.innerHTML = '';
    subs.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">${sub.name}</div>
            <div style="display: flex; justify-content: space-between;">
                ${sub.days.map((checked, i) => `
                    <div 
                        onclick="toggleSubDay('${sub.id}', ${i})"
                        style="
                            width: 30px; height: 30px; 
                            border: 2px solid ${checked ? 'var(--color-profit)' : '#fff'}; 
                            background: ${checked ? 'var(--color-profit)' : 'transparent'};
                            border-radius: 6px; cursor: pointer;
                        "
                    ></div>
                `).join('')}
            </div>
        `;
        list.appendChild(div);
    });
}

function toggleSubDay(id, dayIdx) {
    const s = subs.find(s => s.id == id); // loose match for id
    if (s) {
        s.days[dayIdx] = !s.days[dayIdx];
        DB.set('subs', subs);
        renderSubs();
    }
}

function renderCredits() {
    const list = document.getElementById('credits-list');
    list.innerHTML = '';
    credits.forEach(c => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <div>
                <strong>${c.name}</strong>
            </div>
            <div style="color: var(--color-expense); font-weight: bold;">
                €${c.amount.toFixed(2)}
            </div>
        `;
        list.appendChild(div);
    });
}

function renderDashboard() {
    // Calculate totals
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    document.getElementById('val-income').innerText = '€' + income.toFixed(2);
    document.getElementById('val-expense').innerText = '€' + expense.toFixed(2);
    document.getElementById('val-profit').innerText = '€' + profit.toFixed(2);

    updateChart();
    renderTransactions();
}



let isSelectionMode = false;

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const btn = document.querySelector('#view-home h2 + button'); // Select button relative to header
    // Or just find by text in a simpler app, or give ID next time. 
    // Let's use simpler text toggle for the button found in the header area logic if we had ID.
    // Since we didn't give ID to button, we can re-render to update UI or just manipulate DOM.
    // Let's update text content simply by querying.
    const selectBtn = document.querySelector('button[onclick="toggleSelectionMode()"]');
    if (selectBtn) selectBtn.innerText = isSelectionMode ? 'Annulla' : 'Seleziona';

    document.getElementById('bulk-actions').style.display = isSelectionMode ? 'block' : 'none';
    renderTransactions();
}

function deleteSelectedTransactions() {
    const checkboxes = document.querySelectorAll('.t-checkbox:checked');
    if (checkboxes.length === 0) return alert("Nessuna transazione selezionata.");

    if (!confirm(`Vuoi eliminare ${checkboxes.length} transazioni?`)) return;

    const idsToDelete = Array.from(checkboxes).map(cb => cb.value);
    transactions = transactions.filter(t => !idsToDelete.includes(t.id));

    DB.set('transactions', transactions);
    toggleSelectionMode(); // Exit selection mode
    renderDashboard();
}

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    if (!list) return; // Guard for safety
    list.innerHTML = '';

    // Show recent first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(t => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.cursor = 'pointer';

        // If NOT in selection mode, click to edit. If IN selection mode, click to toggle checkbox (handled by label/input).
        if (!isSelectionMode) {
            div.onclick = () => openEditTransactionModal(t.id);
        } else {
            // Optional: make whole card clickable to check box
            div.onclick = (e) => {
                if (e.target.type !== 'checkbox') {
                    const cb = div.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                }
            };
        }

        const dateStr = new Date(t.date).toLocaleDateString();
        const amountColor = t.type === 'income' ? 'var(--color-profit)' : 'var(--color-expense)';
        const sign = t.type === 'income' ? '+' : '-';

        const checkboxHtml = isSelectionMode ? `
            <input type="checkbox" class="t-checkbox" value="${t.id}" style="transform: scale(1.5); margin-right: 15px;">
        ` : '';

        div.innerHTML = `
            <div style="display: flex; align-items: center;">
                ${checkboxHtml}
                <div>
                    <div style="font-weight: bold;">${t.desc}</div>
                    <small style="color: var(--text-secondary)">${dateStr}</small>
                </div>
            </div>
            <div style="color: ${amountColor}; font-weight: bold; font-size: 1.1rem;">
                ${sign}€${t.amount.toFixed(2)}
            </div>
        `;
        list.appendChild(div);
    });
}

// --- CHART & FILTERS ---
let currentFilter = 'all';

function setChartFilter(filter) {
    currentFilter = filter;
    // Visually update buttons
    const btns = document.querySelectorAll('#view-home button.glass-card');
    // This selector is a bit generic, in a real app better use IDs/classes.
    updateChart();
}

function addTransaction(type, amount, desc, date, id = null) {
    if (id) {
        // Edit existing
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index] = { ...transactions[index], type, amount, desc, date };
        }
    } else {
        // New
        transactions.push({
            id: Date.now().toString(), // Ensure ID
            date: date || new Date().toISOString(),
            type,
            amount,
            desc
        });
    }

    // Sort transactions by date ensure chart is correct
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    DB.set('transactions', transactions);
    renderDashboard();
}

function deleteTransaction(id) {
    if (!confirm("Sicuro di voler eliminare questa transazione?")) return;

    transactions = transactions.filter(t => t.id !== id);
    DB.set('transactions', transactions);
    renderDashboard();
    closeModal();
}

// --- CHART INSTANCE ---
let financeChart;

function updateChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');

    // FILTER DATA
    const now = new Date();
    let filteredTransactions = transactions;

    if (currentFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        filteredTransactions = transactions.filter(t => new Date(t.date) >= oneWeekAgo);
    } else if (currentFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        filteredTransactions = transactions.filter(t => new Date(t.date) >= oneMonthAgo);
    }

    // Sort just in case
    filteredTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Prepare Data
    const labels = filteredTransactions.map(t => new Date(t.date).toLocaleDateString());
    const dataPoints = filteredTransactions.map(t => t.amount * (t.type === 'income' ? 1 : -1));

    // Running total
    let runningTotal = 0;
    // Calculate initial running total from BEFORE the filtered period?
    // For "Balance" chart, usually we want to see the total balance curve.
    // If we filter "This Week", do we start at 0 or at the balance of last week?
    // User asked for "Bilancio", so it should probably track the Net Profit over time.
    // Let's keep it simple: Cumulative of the displayed period for now, OR cumulative of all time but correctly sliced.
    // simpler: Just cumulative sum of displayed points contextually.

    const profitData = dataPoints.map(val => {
        runningTotal += val;
        return runningTotal;
    });

    if (financeChart) financeChart.destroy();

    financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profitto Netto',
                data: profitData,
                borderColor: '#32CD32',
                backgroundColor: 'rgba(50, 205, 50, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#aaa' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        display: true, // SHOW LABELS
                        color: '#aaa',
                        maxTicksLimit: 5
                    }
                }
            }
        }
    });
}

// --- MODAL SYSTEM ---
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

function openModal(title, htmlContent) {
    modalTitle.innerText = title;
    modalBody.innerHTML = htmlContent;
    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

// Close on outside click
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// Specific Modals
function openTransactionModal(defaultType = 'income') {
    const isIncome = defaultType === 'income';
    const title = isIncome ? 'Nuova Entrata' : 'Nuova Spesa';
    const today = new Date().toISOString().split('T')[0];

    const html = `
        <input type="hidden" id="t-id" value="">
        <div class="form-group">
            <label>Tipo</label>
            <select id="t-type" class="form-input">
                <option value="income" ${isIncome ? 'selected' : ''}>Entrata (+)</option>
                <option value="expense" ${!isIncome ? 'selected' : ''}>Spesa (-)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Descrizione</label>
            <input type="text" id="t-desc" class="form-input" placeholder="Es. Vendita, Rifornimento...">
        </div>
        <div class="form-group">
            <label>Importo (€)</label>
            <input type="number" step="0.01" id="t-amount" class="form-input" placeholder="0.00">
        </div>
        <div class="form-group">
            <label>Data</label>
            <input type="date" id="t-date" class="form-input" value="${today}">
        </div>
        <button class="btn" style="width: 100%; background: var(--color-income); color: #000; margin-bottom: 10px;" onclick="saveTransaction()">
            Salva
        </button>
    `;
    openModal(title, html);

    // Focus amount field for quick entry
    setTimeout(() => document.getElementById('t-amount').focus(), 100);
}

function openEditTransactionModal(id) {
    const t = transactions.find(t => t.id === id);
    if (!t) return;

    const dateVal = new Date(t.date).toISOString().split('T')[0];

    const html = `
        <input type="hidden" id="t-id" value="${t.id}">
        <div class="form-group">
            <label>Tipo</label>
            <select id="t-type" class="form-input">
                <option value="income" ${t.type === 'income' ? 'selected' : ''}>Entrata (+)</option>
                <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Spesa (-)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Descrizione</label>
            <input type="text" id="t-desc" class="form-input" value="${t.desc}">
        </div>
        <div class="form-group">
            <label>Importo (€)</label>
            <input type="number" step="0.01" id="t-amount" class="form-input" value="${t.amount}">
        </div>
        <div class="form-group">
            <label>Data</label>
            <input type="date" id="t-date" class="form-input" value="${dateVal}">
        </div>
        <div style="display: flex; gap: 10px;">
            <button class="btn" style="flex: 1; background: var(--color-profit); color: #000;" onclick="saveTransaction()">
                Salva Modifiche
            </button>
            <button class="btn" style="flex: 1; background: var(--color-expense); color: #fff;" onclick="deleteTransaction('${t.id}')">
                Elimina
            </button>
        </div>
    `;
    openModal('Modifica Transazione', html);
}

function saveTransaction() {
    const id = document.getElementById('t-id').value || null;
    const type = document.getElementById('t-type').value;
    const desc = document.getElementById('t-desc').value;
    const amount = parseFloat(document.getElementById('t-amount').value);
    const dateInput = document.getElementById('t-date').value;

    if (amount) {
        addTransaction(type, amount, desc || (type === 'income' ? 'Entrata' : 'Spesa'), dateInput, id);
        closeModal();
    } else {
        alert('Inserisci almeno l\'importo!');
    }
}

function addEmployeePrompt() {
    const html = `
        <div class="form-group">
            <label>Nome</label>
            <input type="text" id="e-name" class="form-input" placeholder="Nome Dipendente">
        </div>
        <button class="btn btn-primary" style="width: 100%" onclick="saveEmployee()">Aggiungi</button>
    `;
    openModal('Nuovo Dipendente', html);
}

function saveEmployee() {
    const name = document.getElementById('e-name').value;
    if (name) {
        team.push({ id: Date.now(), name, salesSweet: 0, salesChip: 0 });
        DB.set('team', team);
        renderTeam();
        closeModal();
    }
}

function addCreditPrompt() {
    const html = `
        <div class="form-group">
            <label>Nome e Classe</label>
            <input type="text" id="c-name" class="form-input" placeholder="Es. Marco 3A">
        </div>
        <div class="form-group">
            <label>Importo (€)</label>
            <input type="number" step="0.01" id="c-amount" class="form-input" placeholder="0.00">
        </div>
        <button class="btn btn-primary" style="width: 100%" onclick="saveCredit()">Aggiungi</button>
    `;
    openModal('Nuovo Credito', html);
}

function saveCredit() {
    const name = document.getElementById('c-name').value;
    const amount = parseFloat(document.getElementById('c-amount').value);
    if (name && amount) {
        credits.push({ id: Date.now(), name, amount });
        DB.set('credits', credits);
        renderCredits();
        closeModal();
    }
}

// --- EXPORT ---
async function exportReport() {
    // Check if jsPDF is loaded
    if (!window.jspdf) {
        alert("Errore: Libreria PDF non caricata. Controlla la connessione internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.text("Business-Patatine Manager", 20, 20);

    doc.setFontSize(12);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, 30);

    // Financials
    const income = parseFloat(document.getElementById('val-income').innerText.replace('€', '') || "0");
    const expense = parseFloat(document.getElementById('val-expense').innerText.replace('€', '') || "0");
    const profit = parseFloat(document.getElementById('val-profit').innerText.replace('€', '') || "0");

    doc.text("BILANCIO:", 20, 45);
    doc.text(`Entrate: ${income.toFixed(2)} euro`, 20, 55);
    doc.text(`Spese: ${expense.toFixed(2)} euro`, 20, 65);
    doc.text(`Profitto Netto: ${profit.toFixed(2)} euro`, 20, 75);

    // Best Sellers / Team
    doc.text("TOP VENDITORI:", 20, 90);
    const topSeller = [...team].sort((a, b) => (b.salesSweet + b.salesChip) - (a.salesSweet + a.salesChip))[0];
    if (topSeller) {
        doc.text(`1. ${topSeller.name} (${topSeller.salesSweet + topSeller.salesChip} vendite)`, 20, 100);
    } else {
        doc.text("Nessun dato di vendita.", 20, 100);
    }

    doc.save("report-settimanale.pdf");
}

// --- SCALABILITY TOOLS ---
function openProfitCalculator() {
    const cost = parseFloat(prompt("Costo pacco all'ingrosso (€):", "1.99"));
    const pieces = parseInt(prompt("Pezzi nel pacco:", "6"));
    const sellPrice = parseFloat(prompt("Prezzo vendita singolo (€):", "1.00"));

    if (cost && pieces && sellPrice) {
        const totalRevenue = pieces * sellPrice;
        const profit = totalRevenue - cost;
        alert(`Profitto Potenziale: €${profit.toFixed(2)}\n(Markup: ${((profit / cost) * 100).toFixed(0)}%)`);
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    switchTab('home');

    // Add Calculator Button
    const btnCalc = document.createElement('button');
    btnCalc.className = 'btn glass-card';
    btnCalc.style.marginTop = '10px';
    btnCalc.style.marginRight = '10px';
    btnCalc.innerText = '🧮 Calcolatore Profitto';
    btnCalc.onclick = openProfitCalculator;
    document.getElementById('view-home').appendChild(btnCalc);

    // Add Export Button
    const btnExp = document.createElement('button');
    btnExp.className = 'btn glass-card';
    btnExp.style.marginTop = '10px';
    btnExp.innerText = '📄 Export PDF';
    btnExp.onclick = exportReport;
    document.getElementById('view-home').appendChild(btnExp);
});
