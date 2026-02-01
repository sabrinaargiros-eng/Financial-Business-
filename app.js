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
    { id: 101, name: 'Tommaso', icon: '🥸', baseSweet: 27, baseChip: 8 },
    { id: 102, name: 'Andrea', icon: '😑', baseSweet: 13, baseChip: 3 },
    { id: 103, name: 'Leo', icon: '🥴', baseSweet: 6, baseChip: 3 },
    { id: 104, name: 'Sofia', icon: '😋', baseSweet: 3, baseChip: 1 },
];

const SALARY_RATES = {
    'sweet': 0.116,
    'chip': 0.268
};

const INITIAL_SUBS = [
    { id: 1, name: 'Sofia 1H', days: [false, false, false, false, false], type: 'sweet' },
    { id: 2, name: 'Leonardo 1H', days: [false, false, false, false, false], type: 'chip' },
];

const INITIAL_CREDITS = [
    { id: 1, name: 'Alexandra 1H', amount: 2.00, paid: false },
    { id: 2, name: 'Fabrizio 5D', amount: 1.00, paid: false },
];

const PRODUCT_COLORS = {
    'patatina': '#FFD700',
    'pan_goccole': '#DAA520',
    'crostatina_ciocco': '#8B4513',
    'crostatina_albicocca': '#FF69B4'
};
const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']; // Fallback

// --- APP STATE ---
let products = DB.get('products', INITIAL_PRODUCTS);
let team = DB.get('team', INITIAL_TEAM);
// Force update if baseSweet is missing (Migration to new structure)
if (team.length === 0 || !team[0].hasOwnProperty('baseSweet')) {
    team = INITIAL_TEAM;
    DB.set('team', team);
}
let subs = DB.get('subs', INITIAL_SUBS);
// Migration: Ensure all subs have a type
if (subs.length > 0 && !subs[0].hasOwnProperty('type')) {
    subs.forEach(s => s.type = s.type || 'sweet');
    DB.set('subs', subs);
}
let credits = DB.get('credits', INITIAL_CREDITS);
let transactions = DB.get('transactions', []);
let inventoryHistory = DB.get('inventoryHistory', []);
let teamTransactions = DB.get('teamTransactions', []); // { id, date, memberId, type, qty, amount, paid }

// Initialize Base Transactions if empty
if (teamTransactions.length === 0) {
    team.forEach(m => {
        if (m.baseSweet > 0) {
            teamTransactions.push({
                id: `init_${m.id}_s`, date: '2026-01-01', memberId: m.id, type: 'sweet',
                qty: m.baseSweet, amount: m.baseSweet * SALARY_RATES.sweet, paid: false
            });
        }
        if (m.baseChip > 0) {
            teamTransactions.push({
                id: `init_${m.id}_c`, date: '2026-01-01', memberId: m.id, type: 'chip',
                qty: m.baseChip, amount: m.baseChip * SALARY_RATES.chip, paid: false
            });
        }
    });
    DB.set('teamTransactions', teamTransactions);
}

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
    if (tabName === 'subs') toggleSubsView('active');
    if (tabName === 'credits') renderCredits();

    // Hide Team FAB if not in team view
    const fab = document.querySelector('.fab-btn');
    if (fab) fab.style.display = (tabName === 'team' && !currentTeamMemberId) ? 'block' : 'none';
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

    // --- NEW: Sticky Current Stock Widget ---
    // Find the latest chronological entry that is NOT PAUSED to show reliable "Real Time" stock
    const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    // Find first non-paused entry
    const latestEntry = sortedHistory.find(h => !h.paused) || sortedHistory[0]; // Fallback to latest if all paused (unlikely)

    if (latestEntry) {
        const dateObj = new Date(latestEntry.date);
        const dateStr = dateObj.toLocaleDateString();
        // Check if this entry is older than today to warn user? Maybe not needed.

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'glass-card';
        summaryDiv.style.marginBottom = '20px';
        summaryDiv.style.border = '1px solid var(--color-profit)'; // Highlight
        summaryDiv.innerHTML = `<h3 style="text-align: center; margin-bottom: 10px;">📦 Scorte Attuali (Del ${dateStr})</h3>`;

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '10px';

        latestEntry.products.forEach(p => {
            const item = document.createElement('div');
            item.style.textAlign = 'center';
            item.innerHTML = `
                <span style="font-size: 1.2rem;">${getProductIcon(p.id)}</span> ${p.name}
                <div style="font-weight: bold; font-size: 1.1rem; color: var(--color-income);">${p.end}</div>
            `;
            grid.appendChild(item);
        });
        summaryDiv.appendChild(grid);
        list.appendChild(summaryDiv);
    }
    // ----------------------------------------

    // Set date picker value to match current state
    const picker = document.getElementById('inventory-date-picker');
    if (picker) picker.value = currentInventoryDate;

    // Determine current entry (Live or History)
    let entry = inventoryHistory.find(h => h.date === currentInventoryDate);
    const isToday = currentInventoryDate === new Date().toISOString().split('T')[0];

    // Auto-create entry for Today if missing
    if (isToday && !entry) {
        // Sync Logic: Get latest end from strictly text-sorted previous history
        let previousEndValues = {};
        const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastEntry = sortedHistory.find(h => h.date < currentInventoryDate);

        if (lastEntry) {
            lastEntry.products.forEach(p => previousEndValues[p.id] = p.end);
        } else {
            INITIAL_PRODUCTS.forEach(p => previousEndValues[p.id] = p.start);
        }

        entry = {
            date: currentInventoryDate,
            products: products.map(p => {
                const startVal = previousEndValues[p.id] !== undefined ? previousEndValues[p.id] : p.start;
                return {
                    id: p.id, name: p.name, start: startVal, restock: 0, end: startVal, sales: 0
                };
            })
        };
        inventoryHistory.push(entry);
        DB.set('inventoryHistory', inventoryHistory);
    }

    // Prepare Display Data
    let displayProducts = [];
    if (entry) {
        displayProducts = entry.products.map(p => ({ ...p, icon: getProductIcon(p.id) }));
    } else {
        // Fallback for past dates (Virtual View - Read Only or Create on Interaction?)
        // If we are viewing a past date that doesn't exist, we probably shouldn't CREATE it until user edits.
        // But for consistency let's show virtual data based on previous day.
        const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const prevEntry = sortedHistory.find(h => h.date < currentInventoryDate);

        displayProducts = products.map(p => {
            let startVal = 0;
            if (prevEntry) {
                const prevP = prevEntry.products.find(hp => hp.id === p.id);
                if (prevP) startVal = prevP.end;
            } else {
                // If absolutely no history before this date, use Initial default
                const initP = INITIAL_PRODUCTS.find(ip => ip.id === p.id);
                if (initP) startVal = initP.start;
            }
            return {
                id: p.id, name: p.name, icon: getProductIcon(p.id),
                start: startVal, restock: 0, end: startVal, sales: 0
            };
        });
    }

    displayProducts.forEach(p => {
        // Calculate Sales
        const sales = (p.start + p.restock) - p.end;

        // Input Controls
        const restockInput = `<input type="number"
            value="${p.restock}"
            style="width: 40px; text-align: center; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;"
            onchange="updateHistoryItem('${p.id}', 'restock', this.value)">`;

        const startInput = `<input type="number" 
            value="${p.start}" 
            style="width: 40px; text-align: center; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;" 
            onchange="updateHistoryItem('${p.id}', 'start', this.value)">`;

        const endInput = `<input type="number"
            value="${p.end}"
            min="0"
            style="width: 50px; text-align: center; border-radius: 5px; border: 1px solid #555; background: #222; color: #fff;"
            onchange="updateHistoryItem('${p.id}', 'end', this.value)">`;


        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3>${p.icon || '📦'} ${p.name}</h3>
                ${p.end < 5 ? '<span style="color: var(--color-expense);">⚠</span>' : ''}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 5px; text-align: center; font-size: 0.8rem;">
                <div>Inizio<br>${startInput}</div>
                <div>Riforn.<br>${restockInput}</div>
                <div>Vendite<br><b>${sales}</b></div>
                <div style="color: var(--color-income)">
                    Rimanenza<br>
                    ${endInput}
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // Chart
    const chartDiv = document.createElement('div');
    chartDiv.className = 'glass-card';
    chartDiv.style.marginTop = '20px';
    chartDiv.innerHTML = `<h2 style="text-align: center;">Andamento Vendite</h2><canvas id="inventoryChartCanvas"></canvas>`;
    list.appendChild(chartDiv);

    renderInventoryChart();

    // No Pause Button
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

    // Logic:
    // Start is calculated, but if we edit it locally (via some other means? removed input), fine.
    // If we edit RESTOCK or END, Sales change.

    if (field === 'start') p.start = numVal;
    if (field === 'restock') p.restock = numVal;
    if (field === 'end') p.end = numVal;

    // Recalculate Sales
    p.sales = (p.start + p.restock) - p.end;

    // RIPPLE EFFECT: Propagate to future days
    if (field === 'end') {
        propagateStockUsingRipple(entry.date);
    } else {
        DB.set('inventoryHistory', inventoryHistory); // Just save strict if no ripple needed
        renderInventory();
        renderInventoryChart();
    }
}

function propagateStockUsingRipple(changedDateStr) {
    // 1. Sort history asc
    let sorted = [...inventoryHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Find index
    let idx = sorted.findIndex(h => h.date === changedDateStr);
    if (idx === -1) return;

    // 3. Loop from next day
    for (let i = idx + 1; i < sorted.length; i++) {
        const prevParams = sorted[i - 1].products;
        const currParams = sorted[i].products;

        currParams.forEach(currP => {
            const prevP = prevParams.find(p => p.id === currP.id);
            if (prevP) {
                // The CORE logic: Next Start = Prev End
                currP.start = prevP.end;
                // Since Start changed, Recalculate Sales (Sales = Start + Restock - End)
                // Assumes End (physical count) is the fixed truth for that day.
                currP.sales = (currP.start + currP.restock) - currP.end;
            }
        });
    }

    // 4. Save
    inventoryHistory = sorted; // Updates reference? Localstorage needs pure array
    DB.set('inventoryHistory', inventoryHistory);
    renderInventory();
    renderInventoryChart();
}

// Replaced by 'openStockModal' but keeping for reference if needed
function updateProductEnd(id, val) {
    // Legacy mapping to updateHistoryItem for Today because we treat everything as history/live hybrid now
    updateHistoryItem(id, 'end', val);
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
        // This function is for "live" product restock, which should update the current day's entry.
        // We need to find the current day's entry and update its restock value.
        let entry = inventoryHistory.find(h => h.date === currentInventoryDate);
        if (entry) {
            const productInEntry = entry.products.find(prod => prod.id === id);
            if (productInEntry) {
                productInEntry.restock += amount;
                // When restock changes, end might need to be adjusted to keep sales consistent,
                // or we assume end is manually updated. For now, let's just update restock
                // and let the user adjust end if needed, or let the sales calculation reflect it.
                // The `updateHistoryItem` function will handle the sales recalculation.
                // For now, we'll just call updateHistoryItem to trigger the save and re-render.
                updateHistoryItem(id, 'restock', productInEntry.restock);
            }
        }
    }

    // DB.set('products', products); // This line is for the global 'products' array, not inventory history
    // renderInventory(); // updateHistoryItem already calls this
}

// --- PRODUCT MANAGEMENT ---
function openAddProductModal() {
    const html = `
        <div class="form-group">
            <label>Nome Prodotto</label>
            <input type="text" id="p-name" class="form-input" placeholder="es. Fanta">
        </div>
        <div class="form-group">
            <label>Icona (Emoji)</label>
            <input type="text" id="p-icon" class="form-input" placeholder="🥤">
        </div>
        <div class="form-group">
            <label>Scorte Iniziali (Giacenza)</label>
            <input type="number" id="p-stock" class="form-input" value="10" min="0">
        </div>
        <div class="form-group">
            <label>Categoria</label>
            <select id="p-type" class="form-input">
                <option value="sweet">🍫 Dolce</option>
                <option value="chip">🍟 Salato</option>
            </select>
        </div>
        <button class="btn" style="width: 100%; background: var(--color-profit); color: #000; margin-top: 10px;" onclick="saveProduct()">
            Salva Prodotto
        </button>
    `;
    openModal('Aggiungi Nuovo Prodotto', html);
}

function saveProduct() {
    const name = document.getElementById('p-name').value;
    const icon = document.getElementById('p-icon').value || '📦';
    const start = parseInt(document.getElementById('p-stock').value) || 0;
    const type = document.getElementById('p-type').value;

    if (!name) return alert("Inserisci un nome.");

    const newId = name.toLowerCase().replace(/\s+/g, '_');

    // Check if exists
    if (products.some(p => p.id === newId)) return alert("Un prodotto con questo nome esiste già.");

    const newProd = { id: newId, name, icon, start, restock: 0, sales: 0, type };

    // 1. Add to global products (for future inventory initializations)
    products.push(newProd);
    DB.set('products', products);

    // 2. Add to ALL inventory history entries to avoid breakage in ripple/history view
    inventoryHistory.forEach(h => {
        h.products.push({ ...newProd });
    });
    DB.set('inventoryHistory', inventoryHistory);

    closeModal();
    renderInventory();
    renderDashboard();
}

let inventoryChart;
function renderInventoryChart() {
    const ctx = document.getElementById('inventoryChartCanvas');
    if (!ctx) return;

    if (inventoryChart) inventoryChart.destroy();

    // Prepare datasets
    const allDates = inventoryHistory.map(h => new Date(h.date).toLocaleDateString());
    // Get last 7 days for chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }

    // Prepare Datasets
    const datasets = INITIAL_PRODUCTS.map((prod, index) => {
        const data = last7Days.map(date => {
            const entry = inventoryHistory.find(h => h.date === date);
            if (!entry) return 0;
            const p = entry.products.find(p => p.id === prod.id);
            return p ? p.sales : 0;
        });

        const color = PRODUCT_COLORS[prod.id] || COLORS[index % COLORS.length];

        return {
            label: prod.name,
            data: data,
            borderColor: color,
            backgroundColor: color,
            tension: 0.3,
            fill: false
        };
    });

    inventoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })),
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


let currentTeamMemberId = null; // null = Leaderboard, id = Profile

function renderTeam() {
    const container = document.getElementById('team-list');
    if (!container) return;
    container.innerHTML = '';

    if (currentTeamMemberId) {
        renderMemberProfile(currentTeamMemberId, container);
    } else {
        renderTeamLeaderboard(container);
    }
}

function renderTeamLeaderboard(container) {
    const stats = team.map(m => {
        const myTrans = teamTransactions.filter(t => t.memberId === m.id);
        const totalQty = myTrans.reduce((sum, t) => sum + t.qty, 0);
        return { ...m, totalQty };
    });

    stats.sort((a, b) => b.totalQty - a.totalQty);

    stats.forEach((m, idx) => {
        const rank = idx + 1;
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '15px';
        div.style.cursor = 'pointer';
        div.style.marginBottom = '10px';
        div.onclick = () => {
            if (selectionStates.team) {
                const cb = div.querySelector('input[type="checkbox"]');
                cb.checked = !cb.checked;
            } else {
                currentTeamMemberId = m.id; renderTeam();
            }
        };

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                ${selectionStates.team ? `<input type="checkbox" class="cb-team" value="${m.id}" style="transform: scale(1.3); margin-right: 5px;">` : ''}
                <div style="font-size: 1.5rem; width: 30px; text-align: center;">
                    ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank}
                </div>
                <div style="font-size: 2.5rem;">${m.icon || '👤'}</div>
                <div style="flex: 1;">
                    <h3 style="margin: 0;">${m.name}</h3>
                    <small style="color: var(--text-secondary);">${selectionStates.team ? 'Seleziona per eliminare' : 'Clicca per statistiche e stipendio'}</small>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 1.2rem; font-weight: bold;">${m.totalQty}</div>
                <small>Vendite</small>
            </div>
        `;
        container.appendChild(div);
    });

    const existingFab = document.querySelector('.fab-btn');
    if (existingFab) existingFab.remove();

    const fab = document.createElement('button');
    fab.innerText = '+';
    fab.className = 'btn fab-btn';
    fab.style.position = 'fixed';
    fab.style.bottom = '85px';
    fab.style.right = '20px';
    fab.style.width = '60px';
    fab.style.height = '60px';
    fab.style.borderRadius = '50%';
    fab.style.fontSize = '30px';
    fab.style.background = 'var(--color-profit)';
    fab.style.color = '#000';
    fab.style.zIndex = '999';
    fab.onclick = openQuickAddTeamModal;
    document.body.appendChild(fab);
}

function renderMemberProfile(memberId, container) {
    const existingFab = document.querySelector('.fab-btn');
    if (existingFab) existingFab.style.display = 'none';

    const m = team.find(tm => tm.id === memberId);
    if (!m) return;

    const myTrans = teamTransactions.filter(t => t.memberId === memberId).sort((a, b) => new Date(b.date) - new Date(a.date));
    const sweetCount = myTrans.filter(t => t.type === 'sweet').reduce((s, t) => s + t.qty, 0);
    const chipCount = myTrans.filter(t => t.type === 'chip').reduce((s, t) => s + t.qty, 0);
    const unpaid = myTrans.filter(t => !t.paid).reduce((s, t) => s + t.amount, 0);
    const totalEarnings = myTrans.reduce((s, t) => s + t.amount, 0);

    container.innerHTML = `
        <button class="btn" style="margin-bottom: 20px; background: rgba(255,255,255,0.1);" onclick="currentTeamMemberId=null; renderTeam();">
            ⬅ Torna alla Classifica
        </button>
        
        <div class="glass-card" style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 4rem;">${m.icon || '👤'}</div>
            <h2>${m.name}</h2>
            <div style="color: var(--color-income); font-weight: bold; margin-top: 5px;">
                ${(sweetCount + chipCount) > 20 ? '🏆 Top Seller' : (sweetCount + chipCount) > 5 ? '⭐ Rising Star' : ''}
            </div>
        </div>

        <div class="glass-card" style="margin-bottom: 20px; border: 1px solid var(--color-profit);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0;">Portafoglio</h3>
                    <small>Da Saldare</small>
                </div>
                <div style="font-size: 1.5rem; font-weight: bold;">€${unpaid.toFixed(2)}</div>
            </div>
            ${unpaid > 0 ? `<button class="btn" style="width: 100%; margin-top: 15px; background: var(--color-profit); color: #000;" onclick="payMember(${m.id})">💰 Segna come Pagato</button>` : ''}
            <div style="text-align: center; margin-top: 10px; font-size: 0.8rem; opacity: 0.7;">Guadagni Totali: €${totalEarnings.toFixed(2)}</div>
        </div>

        <div class="glass-card" style="margin-bottom: 20px;">
            <h3>Dettagli Vendite</h3>
            <canvas id="memberPieChart" height="200"></canvas>
        </div>

        <h3>Storico</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${myTrans.map(t => `
                <div class="glass-card" style="padding: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="openEditTeamTransactionModal('${t.id}')">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${t.type === 'sweet' ? '🍫 Dolce' : '🍟 Salato'} x${t.qty}</div>
                        <small>${new Date(t.date).toLocaleDateString()}</small>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                        <div>
                            <div style="font-weight: bold;">+€${t.amount.toFixed(2)}</div>
                            <small style="color: ${t.paid ? 'var(--color-profit)' : '#ff9f43'}">${t.paid ? 'PAGATO' : 'DA SALDARE'}</small>
                        </div>
                        <button class="btn-icon" onclick="event.stopPropagation(); deleteTeamTransaction('${t.id}')" style="background: none; border: none; font-size: 1.1rem; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('memberPieChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Dolce 🍫', 'Salato 🍟'],
                    datasets: [{
                        data: [sweetCount, chipCount],
                        backgroundColor: [PRODUCT_COLORS.crostatina_ciocco, PRODUCT_COLORS.patatina],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, cutout: '65%' }
            });
        }
    }, 50);
}

function openQuickAddTeamModal() {
    const today = new Date().toISOString().split('T')[0];
    const html = `
        <div class="form-group">
            <label>Chi ha venduto?</label>
            <select id="qa-member" class="form-input">
                ${team.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Cosa?</label>
            <div style="display: flex; gap: 10px;">
                <div id="btn-qa-sweet" onclick="setQaType('sweet')" style="flex: 1; padding: 10px; border: 2px solid var(--color-profit); border-radius: 10px; text-align: center; cursor: pointer; background: rgba(0,184,148,0.1);">
                    <div style="font-size: 1.5rem;">🍫</div> Dolce
                </div>
                <div id="btn-qa-chip" onclick="setQaType('chip')" style="flex: 1; padding: 10px; border: 2px solid #555; border-radius: 10px; text-align: center; cursor: pointer;">
                    <div style="font-size: 1.5rem;">🍟</div> Salato
                </div>
            </div>
            <input type="hidden" id="qa-type" value="sweet">
        </div>
        <div class="form-group">
            <label>Quantità</label>
            <input type="number" id="qa-qty" class="form-input" value="1" min="1">
        </div>
        <div class="form-group">
            <label>Data</label>
            <input type="date" id="qa-date" class="form-input" value="${today}">
        </div>
        <button class="btn" style="width: 100%; background: var(--color-profit); color: #000; margin-top: 10px;" onclick="confirmQuickTeamAdd()">✅ Registra</button>
    `;
    openModal("Vendita Rapida", html);
}

function setQaType(type) {
    document.getElementById('qa-type').value = type;
    document.getElementById('btn-qa-sweet').style.borderColor = type === 'sweet' ? 'var(--color-profit)' : '#555';
    document.getElementById('btn-qa-sweet').style.background = type === 'sweet' ? 'rgba(0,184,148,0.1)' : 'transparent';
    document.getElementById('btn-qa-chip').style.borderColor = type === 'chip' ? 'var(--color-profit)' : '#555';
    document.getElementById('btn-qa-chip').style.background = type === 'chip' ? 'rgba(0,184,148,0.1)' : 'transparent';
}

function confirmQuickTeamAdd() {
    const mId = parseInt(document.getElementById('qa-member').value);
    const type = document.getElementById('qa-type').value;
    const qty = parseInt(document.getElementById('qa-qty').value) || 1;
    const date = document.getElementById('qa-date').value;

    const rate = type === 'sweet' ? SALARY_RATES.sweet : SALARY_RATES.chip;
    teamTransactions.push({
        id: 't' + Date.now(),
        date,
        memberId: mId,
        type,
        qty,
        amount: qty * rate,
        paid: false
    });

    DB.set('teamTransactions', teamTransactions);
    closeModal();
    renderTeam();
}

function payMember(memberId) {
    if (confirm("Confermi di aver pagato il saldo?")) {
        teamTransactions.forEach(t => { if (t.memberId === memberId) t.paid = true; });
        DB.set('teamTransactions', teamTransactions);
        renderTeam();
    }
}

function deleteTeamTransaction(id) {
    if (!confirm("Sicuro di voler eliminare questa vendita?")) return;
    teamTransactions = teamTransactions.filter(t => t.id !== id);
    DB.set('teamTransactions', teamTransactions);
    renderTeam();
}

function openEditTeamTransactionModal(id) {
    const t = teamTransactions.find(t => t.id === id);
    if (!t) return;

    const html = `
        <input type="hidden" id="te-id" value="${t.id}">
        <div class="form-group">
            <label>Tipo Prodotto</label>
            <select id="te-type" class="form-input">
                <option value="sweet" ${t.type === 'sweet' ? 'selected' : ''}>🍫 Dolce</option>
                <option value="chip" ${t.type === 'chip' ? 'selected' : ''}>🍟 Salato</option>
            </select>
        </div>
        <div class="form-group">
            <label>Quantità</label>
            <input type="number" id="te-qty" class="form-input" value="${t.qty}" min="1">
        </div>
        <div class="form-group">
            <label>Data</label>
            <input type="date" id="te-date" class="form-input" value="${t.date}">
        </div>
        <div class="form-group">
            <label>Stato Pagamento</label>
            <select id="te-paid" class="form-input">
                <option value="false" ${!t.paid ? 'selected' : ''}>❌ Non Pagato (In Sospeso)</option>
                <option value="true" ${t.paid ? 'selected' : ''}>✅ Pagato</option>
            </select>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="btn" style="flex: 1; background: var(--color-profit); color: #000;" onclick="saveTeamTransaction()">
                Salva Modifiche
            </button>
        </div>
    `;
    openModal('Modifica Vendita', html);
}

function saveTeamTransaction() {
    const id = document.getElementById('te-id').value;
    const type = document.getElementById('te-type').value;
    const qty = parseInt(document.getElementById('te-qty').value) || 1;
    const date = document.getElementById('te-date').value;
    const paid = document.getElementById('te-paid').value === 'true';

    const t = teamTransactions.find(t => t.id === id);
    if (t) {
        t.type = type;
        t.qty = qty;
        t.date = date;
        t.paid = paid;
        t.amount = qty * (type === 'sweet' ? SALARY_RATES.sweet : SALARY_RATES.chip);

        DB.set('teamTransactions', teamTransactions);
        closeModal();
        renderTeam();
    }
}

let currentSubsView = 'active'; // 'active' or 'registry'

function toggleSubsView(view) {
    currentSubsView = view;
    // Update button styles
    document.getElementById('btn-subs-active').style.background = view === 'active' ? 'var(--color-profit)' : 'transparent';
    document.getElementById('btn-subs-active').style.color = view === 'active' ? '#000' : '#fff';
    document.getElementById('btn-subs-registry').style.background = view === 'registry' ? 'var(--color-profit)' : 'transparent';
    document.getElementById('btn-subs-registry').style.color = view === 'registry' ? '#000' : '#fff';

    // Hide controls if in registry
    document.getElementById('subs-controls').style.display = view === 'active' ? 'block' : 'none';

    renderSubs();
}

function renderSubs() {
    const list = document.getElementById('subs-list');
    if (!list) return;
    list.innerHTML = '';

    // Filter based on view
    const filteredSubs = subs.filter(s => {
        const isFinished = s.days.every(d => d === true);
        return currentSubsView === 'active' ? !isFinished : isFinished;
    });

    if (filteredSubs.length === 0) {
        list.innerHTML = `<p style="text-align: center; opacity: 0.5; margin-top: 20px;">
            ${currentSubsView === 'active' ? 'Nessun abbonamento attivo.' : 'Il registro è vuoto.'}
        </p>`;
        return;
    }

    // Group by category if in 'active' view
    if (currentSubsView === 'active') {
        const sections = [
            { id: 'sweet', name: '🍫 Crostatine', color: PRODUCT_COLORS.crostatina_ciocco },
            { id: 'chip', name: '🍟 Patatine', color: PRODUCT_COLORS.patatina }
        ];

        sections.forEach(sec => {
            const secSubs = filteredSubs.filter(s => s.type === sec.id);
            if (secSubs.length > 0) {
                const title = document.createElement('h3');
                title.innerHTML = sec.name;
                title.style.margin = '20px 0 10px 0';
                title.style.borderLeft = `4px solid ${sec.color}`;
                title.style.paddingLeft = '10px';
                list.appendChild(title);

                secSubs.forEach(sub => list.appendChild(createSubCard(sub)));
            }
        });
    } else {
        // Registry view - just a list
        filteredSubs.forEach(sub => list.appendChild(createSubCard(sub)));
    }
}

function createSubCard(sub) {
    const div = document.createElement('div');
    div.className = 'glass-card';
    div.style.marginBottom = '10px';
    div.style.cursor = selectionStates.subs ? 'pointer' : 'default';

    if (selectionStates.subs) {
        div.onclick = () => {
            const cb = div.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
        };
    }

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                ${selectionStates.subs ? `<input type="checkbox" class="cb-subs" value="${sub.id}" style="transform: scale(1.3);">` : ''}
                <div style="font-weight: bold; font-size: 1.1rem;">
                    ${sub.type === 'sweet' ? '🍫' : '🍟'} ${sub.name}
                </div>
            </div>
            ${currentSubsView === 'active' ? '' : `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--color-profit); font-size: 0.8rem; font-weight: bold;">COMPLETATO ✅</span>
                    <button class="btn-icon" onclick="restoreSub('${sub.id}')" title="Ripristina in Attivi" style="background:none; border:none; cursor:pointer; font-size:1rem; opacity: 0.7;">🔄</button>
                </div>
            `}
        </div>
        <div style="display: flex; justify-content: space-between; gap: 5px; ${selectionStates.subs ? 'pointer-events: none; opacity: 0.5;' : ''}">
            ${sub.days.map((checked, i) => {
        const daysLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
        return `
                    <div style="text-align: center; flex: 1;">
                        <div 
                            onclick="${currentSubsView === 'active' ? `toggleSubDay('${sub.id}', ${i})` : ''}"
                            style="
                                height: 35px; 
                                border: 2px solid ${checked ? 'var(--color-profit)' : '#555'}; 
                                background: ${checked ? 'var(--color-profit)' : 'rgba(255,255,255,0.05)'};
                                border-radius: 8px; cursor: ${currentSubsView === 'active' ? 'pointer' : 'default'};
                                display: flex; align-items: center; justify-content: center;
                                transition: 0.2s;
                            "
                        >
                            ${checked ? '<span style="color: #000; font-weight: bold;">✓</span>' : ''}
                        </div>
                        <small style="font-size: 0.7rem; opacity: 0.6; margin-top: 4px; display: block;">${daysLabels[i]}</small>
                    </div>
                `;
    }).join('')}
        </div>
    `;
    return div;
}

function toggleSubDay(id, dayIdx) {
    const s = subs.find(s => s.id == id);
    if (s) {
        s.days[dayIdx] = !s.days[dayIdx];
        DB.set('subs', subs);

        // If just finished, maybe show a little celebration or just re-render
        const isFinished = s.days.every(d => d === true);
        if (isFinished) {
            // Wait a bit to show the last check before it disappears
            setTimeout(() => {
                alert(`Complimenti! ${s.name} ha completato l'abbonamento settimanale. Spostato nel Registro.`);
                renderSubs();
            }, 300);
        } else {
            renderSubs();
        }
    }
}

function openAddSubModal() {
    const html = `
        <div class="form-group">
            <label>Nome Abbonato e Classe</label>
            <input type="text" id="sub-name" class="form-input" placeholder="Es. Mario Rossi 4B">
        </div>
        <div class="form-group">
            <label>Tipo Abbonamento</label>
            <div style="display: flex; gap: 10px; margin-top: 5px;">
                <div id="btn-sub-sweet" onclick="selectSubModType('sweet')" style="flex: 1; padding: 15px; border: 2px solid var(--color-profit); border-radius: 12px; text-align: center; cursor: pointer; background: rgba(0, 184, 148, 0.1);">
                    <div style="font-size: 1.5rem;">🍫</div>
                    <div style="font-size: 0.9rem; margin-top: 5px;">Dolce</div>
                </div>
                <div id="btn-sub-chip" onclick="selectSubModType('chip')" style="flex: 1; padding: 15px; border: 2px solid #555; border-radius: 12px; text-align: center; cursor: pointer;">
                    <div style="font-size: 1.8rem;">🍟</div>
                    <div style="font-size: 0.9rem; margin-top: 5px;">Salato</div>
                </div>
            </div>
            <input type="hidden" id="sub-type" value="sweet">
        </div>
        <button class="btn" style="width: 100%; background: var(--color-profit); color: #000; font-weight: bold; margin-top: 15px;" onclick="saveSub()">
            AGGIUNGI
        </button>
    `;
    openModal("Nuovo Abbonato", html);
}

function selectSubModType(type) {
    document.getElementById('sub-type').value = type;
    const sweetBtn = document.getElementById('btn-sub-sweet');
    const chipBtn = document.getElementById('btn-sub-chip');

    if (type === 'sweet') {
        sweetBtn.style.borderColor = 'var(--color-profit)';
        sweetBtn.style.background = 'rgba(0, 184, 148, 0.1)';
        chipBtn.style.borderColor = '#555';
        chipBtn.style.background = 'transparent';
    } else {
        chipBtn.style.borderColor = 'var(--color-profit)';
        chipBtn.style.background = 'rgba(0, 184, 148, 0.1)';
        sweetBtn.style.borderColor = '#555';
        sweetBtn.style.background = 'transparent';
    }
}

function saveSub() {
    const name = document.getElementById('sub-name').value;
    const type = document.getElementById('sub-type').value;
    if (!name) return alert("Inserisci un nome.");

    const newSub = {
        id: Date.now(),
        name: name,
        type: type,
        days: [false, false, false, false, false]
    };

    subs.push(newSub);
    DB.set('subs', subs);
    closeModal();
    renderSubs();
}

function deleteSub(id) {
    if (!confirm("Vuoi eliminare questo abbonamento?")) return;
    subs = subs.filter(s => s.id != id);
    DB.set('subs', subs);
    renderSubs();
}

function restoreSub(id) {
    const s = subs.find(s => s.id == id);
    if (s) {
        // Uncheck the last day to make it "incomplete" and return to active
        s.days[4] = false;
        DB.set('subs', subs);
        alert(`${s.name} riportato in Abbonamenti Attivi.`);
        renderSubs();
    }
}

function resetWeekSubs() {
    if (!confirm("Vuoi resettare tutti gli abbonamenti settimanali?")) return;

    // We can either reset all of them to unchecked (staying active)
    // or we can archive the ones that were partially finished?
    // User asked "Reset", so let's just uncheck everything in the ACTIVE list.
    // Actually, usually reset means start a new week.
    // Let's reset the 'days' array for all subscribers.
    subs.forEach(s => {
        s.days = [false, false, false, false, false];
    });
    DB.set('subs', subs);
    renderSubs();
}

function renderCredits() {
    const list = document.getElementById('credits-list');
    if (!list) return;
    list.innerHTML = '';

    credits.forEach(c => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.opacity = c.paid ? '0.6' : '1';
        div.style.cursor = selectionStates.credits ? 'pointer' : 'default';

        if (selectionStates.credits) {
            div.onclick = () => {
                const cb = div.querySelector('input[type="checkbox"]');
                cb.checked = !cb.checked;
            };
        }

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                ${selectionStates.credits ? `<input type="checkbox" class="cb-credits" value="${c.id}" style="transform: scale(1.3); margin-right: 5px;">` : ''}
                <div 
                    onclick="${selectionStates.credits ? '' : `toggleCreditPaid('${c.id}')`}"
                    style="
                        width: 24px; height: 24px; 
                        border: 2px solid ${c.paid ? 'var(--color-profit)' : '#888'}; 
                        background: ${c.paid ? 'var(--color-profit)' : 'transparent'};
                        border-radius: 6px; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        transition: 0.2s;
                        ${selectionStates.credits ? 'pointer-events: none;' : ''}
                    "
                >
                    ${c.paid ? '<span style="color: #000; font-weight: bold; font-size: 0.8rem;">✓</span>' : ''}
                </div>
                <div style="text-decoration: ${c.paid ? 'line-through' : 'none'};">
                    <strong>${c.name}</strong>
                </div>
            </div>
            <div style="color: var(--color-expense); font-weight: bold; font-size: 1rem; text-align: right;">
                €${c.amount.toFixed(2)}
            </div>
        `;
        list.appendChild(div);
    });
}

function toggleCreditPaid(id) {
    const c = credits.find(cr => cr.id == id);
    if (c) {
        c.paid = !c.paid;
        DB.set('credits', credits);
        renderCredits();
    }
}

function deleteCredit(id) {
    if (!confirm("Sicuro di voler eliminare questo credito?")) return;
    credits = credits.filter(c => c.id != id);
    DB.set('credits', credits);
    renderCredits();
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



let selectionStates = {
    home: false,
    team: false,
    subs: false,
    credits: false
};

function toggleSelectionMode(view) {
    selectionStates[view] = !selectionStates[view];

    // Update Action Bar visibility
    const actionBar = document.getElementById(`bulk-actions-${view}`);
    if (actionBar) actionBar.style.display = selectionStates[view] ? 'block' : 'none';

    // Update trigger button text if needed
    const selectBtn = document.querySelector(`button[onclick="toggleSelectionMode('${view}')"]`);
    if (selectBtn) selectBtn.innerText = selectionStates[view] ? 'Annulla' : 'Seleziona';

    // Re-render
    if (view === 'home') renderDashboard();
    if (view === 'team') renderTeam();
    if (view === 'subs') renderSubs();
    if (view === 'credits') renderCredits();
}

function bulkDelete(view) {
    const checkboxes = document.querySelectorAll(`.cb-${view}:checked`);
    if (checkboxes.length === 0) return alert("Nessun elemento selezionato.");

    if (!confirm(`Sicuro di voler eliminare ${checkboxes.length} elementi?`)) return;

    const idsToDelete = Array.from(checkboxes).map(cb => cb.value);

    if (view === 'home') {
        transactions = transactions.filter(t => !idsToDelete.includes(t.id));
        DB.set('transactions', transactions);
        renderDashboard();
    } else if (view === 'team') {
        team = team.filter(m => !idsToDelete.includes(m.id.toString()));
        DB.set('team', team);
        renderTeam();
    } else if (view === 'subs') {
        subs = subs.filter(s => !idsToDelete.includes(s.id.toString()));
        DB.set('subs', subs);
        renderSubs();
    } else if (view === 'credits') {
        credits = credits.filter(c => !idsToDelete.includes(c.id.toString()));
        DB.set('credits', credits);
        renderCredits();
    }

    toggleSelectionMode(view); // Exit mode
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
        if (selectionStates.home) {
            div.onclick = (e) => {
                const cb = div.querySelector('input[type="checkbox"]');
                if (e.target !== cb) cb.checked = !cb.checked;
            };
        } else {
            div.onclick = () => openEditTransactionModal(t.id);
        }

        const dateStr = new Date(t.date).toLocaleDateString();
        const amountColor = t.type === 'income' ? 'var(--color-profit)' : 'var(--color-expense)';
        const sign = t.type === 'income' ? '+' : '-';

        div.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1; gap: 15px;">
                ${selectionStates.home ? `<input type="checkbox" class="cb-home" value="${t.id}" style="transform: scale(1.3);">` : ''}
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${t.desc}</div>
                    <small style="color: var(--text-secondary)">${dateStr}</small>
                </div>
            </div>
            <div style="color: ${amountColor}; font-weight: bold; font-size: 1.1rem; text-align: right;">
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
        team.push({
            id: Date.now().toString(),
            name,
            icon: '👤',
            baseSweet: 0,
            baseChip: 0,
            salesSweet: 0, // Legacy
            salesChip: 0   // Legacy
        });
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
        credits.push({ id: Date.now(), name, amount, paid: false });
        DB.set('credits', credits);
        renderCredits();
        closeModal();
    }
}

// --- EXPORT ---
async function exportReport() {
    if (!window.jspdf) {
        alert("Errore: Libreria PDF non caricata. Controlla la connessione internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;

    function checkPageBreak(needed = 10) {
        if (y + needed > pageHeight - margin) {
            doc.addPage();
            y = 20;
        }
    }

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 184, 148); // var(--color-profit)
    doc.text("Business-Patatine Manager", margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report generato il: ${new Date().toLocaleString()}`, margin, y);
    y += 15;

    // 1. FINANCIAL SUMMARY
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("1. BILANCIO GENERALE", margin, y);
    y += 10;

    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    doc.setFontSize(12);
    doc.text(`Entrate Totali: €${income.toFixed(2)}`, margin + 5, y); y += 7;
    doc.text(`Spese Totali: €${expense.toFixed(2)}`, margin + 5, y); y += 7;
    doc.setFont(undefined, 'bold');
    doc.text(`Profitto Netto: €${profit.toFixed(2)}`, margin + 5, y);
    doc.setFont(undefined, 'normal');
    y += 15;

    // 2. TRANSACTION HISTORY
    checkPageBreak(20);
    doc.setFontSize(16);
    doc.text("2. STORICO TRANSAZIONI", margin, y);
    y += 10;
    doc.setFontSize(10);

    const sortedT = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedT.forEach(t => {
        checkPageBreak(7);
        const date = new Date(t.date).toLocaleDateString();
        const line = `${date} - ${t.desc}: ${t.type === 'income' ? '+' : '-'}€${t.amount.toFixed(2)}`;
        doc.text(line, margin + 5, y);
        y += 7;
    });
    y += 10;

    // 3. INVENTORY
    checkPageBreak(20);
    doc.setFontSize(16);
    doc.text("3. STATO INVENTARIO", margin, y);
    y += 10;
    doc.setFontSize(10);

    // Get latest real stock from history
    const sortedInv = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestInv = sortedInv.find(h => !h.paused) || sortedInv[0];

    if (latestInv) {
        latestInv.products.forEach(p => {
            checkPageBreak(7);
            const stock = p.start + p.restock - p.sales;
            doc.text(`${p.name}: ${stock} unita' rimaste`, margin + 5, y);
            y += 7;
        });
    } else {
        // Fallback to base products if no history
        products.forEach(p => {
            checkPageBreak(7);
            const stock = p.start + p.restock - p.sales;
            doc.text(`${p.name}: ${stock} unita' rimaste`, margin + 5, y);
            y += 7;
        });
    }
    y += 10;

    // 4. TEAM & PERFORMANCE
    checkPageBreak(20);
    doc.setFontSize(16);
    doc.text("4. TEAM E PORTAFOGLI", margin, y);
    y += 10;
    team.forEach(m => {
        checkPageBreak(15);
        const mTrans = teamTransactions.filter(tt => tt.memberId === m.id);
        const unpaid = mTrans.filter(tt => !tt.paid).reduce((s, tt) => s + tt.amount, 0);
        const totalSales = mTrans.reduce((s, tt) => s + tt.qty, 0);

        doc.setFont(undefined, 'bold');
        doc.text(`${m.name}:`, margin + 5, y);
        doc.setFont(undefined, 'normal');
        doc.text(`   Vendite totali: ${totalSales} | Da pagare: €${unpaid.toFixed(2)}`, margin + 30, y);
        y += 8;
    });
    y += 10;

    // 5. SUBSCRIPTIONS
    checkPageBreak(20);
    doc.setFontSize(16);
    doc.text("5. ABBONAMENTI SETTIMANALI", margin, y);
    y += 10;
    doc.setFontSize(10);
    subs.forEach(s => {
        checkPageBreak(7);
        const done = s.days.filter(d => d).length;
        const type = s.type === 'sweet' ? 'Dolce' : 'Salato';
        doc.text(`${s.name} (${type}): ${done}/5 giorni completati`, margin + 5, y);
        y += 7;
    });
    y += 10;

    // 6. CREDITS
    checkPageBreak(20);
    doc.setFontSize(16);
    doc.text("6. REGISTRO CREDITI", margin, y);
    y += 10;
    doc.setFontSize(10);
    credits.forEach(c => {
        checkPageBreak(7);
        doc.text(`${c.name}: €${c.amount.toFixed(2)} [${c.paid ? 'RISARCITO' : 'DA RISARCIRE'}]`, margin + 5, y);
        y += 7;
    });

    doc.save(`report-completo-${new Date().toISOString().split('T')[0]}.pdf`);
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
