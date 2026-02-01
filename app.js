// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAtL58Aw6oIvoMIFpi_ObZrFNJEGQA9luU",
    authDomain: "snackstock-app.firebaseapp.com",
    projectId: "snackstock-app",
    storageBucket: "snackstock-app.firebasestorage.app",
    messagingSenderId: "544360978481",
    appId: "1:544360978481:web:32714ef242d77518bb9d10",
    databaseURL: "https://snackstock-app-default-rtdb.firebaseio.com/" // Corrected based on console link
};

// Initialize Firebase (Compat Mode)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- DATA STORE (Firebase + LocalStorage hybrid) ---
const DB = {
    get: (key, defaultVal) => JSON.parse(localStorage.getItem(key)) || defaultVal,
    set: (key, val) => {
        // Prevent saving if data is identical (optimization)
        const localVal = JSON.parse(localStorage.getItem(key));
        if (JSON.stringify(val) === JSON.stringify(localVal)) return;

        localStorage.setItem(key, JSON.stringify(val));
        // Sync to cloud
        database.ref('data/' + key).set(val);
    },
};

// Listen for remote changes
function initSync() {
    // 1. Database URL check
    if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes('default-rtdb')) {
        console.warn("Database URL might be incorrect. Please check your Firebase Console.");
    }

    // 2. Connection state
    database.ref('.info/connected').on('value', (snap) => {
        updateSyncStatus(snap.val() === true);
    }, (error) => {
        console.error("Sync Connection Error:", error);
        updateSyncStatus(false);
    });

    const keys = ['products', 'team', 'subs', 'credits', 'transactions', 'inventoryHistory', 'teamTransactions'];
    keys.forEach(key => {
        database.ref('data/' + key).on('value', (snapshot) => {
            const val = snapshot.val();
            const localRaw = localStorage.getItem(key);
            const localVal = localRaw ? JSON.parse(localRaw) : null;

            // FIRST SYNC / EMPTY CLOUD: If cloud is null, try to push local data
            if (val === null) {
                // Determine if we have anything to push (either from localStorage or current in-memory variable)
                let dataToPush = localVal;

                // If localVal is null (first run ever), we use the variables which are initialized with defaults
                if (!dataToPush || (Array.isArray(dataToPush) && dataToPush.length === 0)) {
                    if (key === 'products') dataToPush = products;
                    if (key === 'team') dataToPush = team;
                    if (key === 'subs') dataToPush = subs;
                    if (key === 'credits') dataToPush = credits;
                }

                if (dataToPush && (Array.isArray(dataToPush) ? dataToPush.length > 0 : true)) {
                    console.log(`Pushing initial data for ${key} to cloud...`);
                    database.ref('data/' + key).set(dataToPush);
                    return;
                }
                return;
            }

            // REGULAR UPDATE: Only update if remote is actually different from local
            if (JSON.stringify(val) === JSON.stringify(localVal)) return;

            console.log(`Cloud update for ${key} received.`);
            localStorage.setItem(key, JSON.stringify(val));
            updateLocalState(key, val);
        });
    });
}

function updateLocalState(key, val) {
    if (key === 'products') products = val;
    if (key === 'team') team = val;
    if (key === 'subs') subs = val;
    if (key === 'credits') credits = val;
    if (key === 'transactions') transactions = val;
    if (key === 'inventoryHistory') inventoryHistory = val;
    if (key === 'teamTransactions') teamTransactions = val;

    // Trigger UI updates based on current view
    const activeView = document.querySelector('.view-section.active');
    if (!activeView) return;

    if (activeView.id === 'view-home') renderDashboard();
    if (activeView.id === 'view-inventory') renderInventory();
    if (activeView.id === 'view-team') renderTeam();
    if (activeView.id === 'view-subs') renderSubs();
    if (activeView.id === 'view-credits') renderCredits();
}

initSync();
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
    'crostatina_ciocco': '#7B3F00',   /* Chocolate Brown */
    'crostatina_albicocca': '#FF8C00', /* Dark Orange */
    'pan_goccole': '#A0522D',          /* Sienna/Cookie */
    'patatina': '#F1C40F',             /* Sun Yellow */
    'sweet': '#FFD700',
    'chip': '#FFD700'
};
const COLORS = ['#FFD700', '#FF4D4D', '#2ECC71', '#3498DB', '#9B59B6'];

// --- UTILITIES ---
function hapticFeedback() {
    if (window.navigator.vibrate) {
        window.navigator.vibrate(15);
    }
}

function updateSyncStatus(connected) {
    const dot = document.getElementById('sync-indicator');
    if (dot) {
        dot.style.background = connected ? 'var(--color-profit)' : 'var(--color-expense)';
        dot.title = connected ? 'Sincronizzato' : 'Offline';
    }
}

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
    // Find the clicked element based on simple logic
    const tabs = ['home', 'inventory', 'team', 'subs', 'credits'];
    const index = tabs.indexOf(tabName);
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[index]) {
        navItems.forEach(el => el.classList.remove('active'));
        navItems[index].classList.add('active');
    }

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
    if (!list) return;
    list.innerHTML = '';

    const sortedHistory = [...inventoryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestEntry = sortedHistory.find(h => !h.paused) || sortedHistory[0];

    if (latestEntry) {
        const dateStr = new Date(latestEntry.date).toLocaleDateString();
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'glass-card';
        summaryDiv.style.border = '1px solid var(--color-profit)';
        summaryDiv.innerHTML = `
            <div style="text-align: center;">
                <small style="color: var(--color-profit); font-weight: 800; font-size: 0.7rem; text-transform: uppercase;">Real-Time Stock</small>
                <div style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 12px;">Aggiornato al ${dateStr}</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    ${latestEntry.products.map(p => {
            const icon = getProductIcon(p.id);
            const masterProduct = products.find(mp => mp.id === p.id);
            const name = masterProduct ? masterProduct.name : (p.name || 'Prodotto');
            const stock = p.end !== undefined ? p.end : (p.start + p.restock - p.sales);
            return `
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 12px; border: 1px solid var(--border-glass);">
                                <div style="font-size: 1.2rem;">${icon}</div>
                                <div style="font-weight: 800; font-size: 1.1rem;">${stock}</div>
                                <small style="font-size: 0.65rem; opacity: 0.7; display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${name}</small>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
        list.appendChild(summaryDiv);
    }
    // Set date picker value to match current state
    const picker = document.getElementById('inventory-date-picker');
    if (picker) picker.value = currentInventoryDate;

    // Determine current entry (Live or History)
    let entry = inventoryHistory.find(h => h.date === currentInventoryDate);
    const isToday = currentInventoryDate === new Date().toISOString().split('T')[0];

    // Auto-create entry for Today if missing
    if (isToday && !entry) {
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

    if (!entry) {
        const noDataDiv = document.createElement('div');
        noDataDiv.className = 'glass-card';
        noDataDiv.style.textAlign = 'center';
        noDataDiv.innerHTML = `<p>Nessun dato per questa data.</p>`;
        list.appendChild(noDataDiv);
        return;
    }

    entry.products.forEach(p => {
        const icon = getProductIcon(p.id);
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.padding = '16px';

        // UI Layout with Inputs
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.5rem;">${icon}</div>
                    <div style="font-weight: 800; font-size: 1rem;">${p.name}</div>
                </div>
                <div style="text-align: right;">
                    <small style="color: var(--text-secondary); font-size: 0.65rem; font-weight: 700;">VENDITE</small>
                    <div style="font-weight: 900; font-size: 1.2rem; color: var(--color-expense);">${p.sales}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                <div class="glass-card" style="padding: 8px; min-height: auto; background: rgba(255,255,255,0.02);">
                    <small style="font-size: 0.6rem; opacity: 0.6; display: block;">INIZIO</small>
                    <input type="number" value="${p.start}" class="form-input" 
                        style="width: 100%; border: none; background: transparent; text-align: center; font-weight: 800; padding: 4px; margin: 0; min-height: auto;"
                        onchange="hapticFeedback(); updateHistoryItem('${p.id}', 'start', this.value)">
                </div>
                <div class="glass-card" style="padding: 8px; min-height: auto; background: rgba(255,255,255,0.02); border-color: rgba(46, 204, 113, 0.2);">
                    <small style="font-size: 0.6rem; color: var(--color-income); font-weight: 700; display: block;">CARICO</small>
                    <input type="number" value="${p.restock}" class="form-input" 
                        style="width: 100%; border: none; background: transparent; text-align: center; font-weight: 800; color: var(--color-income); padding: 4px; margin: 0; min-height: auto;"
                        onchange="hapticFeedback(); updateHistoryItem('${p.id}', 'restock', this.value)">
                </div>
                <div class="glass-card" style="padding: 8px; min-height: auto; background: rgba(255,255,255,0.02); border-color: rgba(255, 215, 0, 0.2);">
                    <small style="font-size: 0.6rem; color: var(--color-profit); font-weight: 700; display: block;">FINE</small>
                    <input type="number" value="${p.end}" class="form-input" 
                        style="width: 100%; border: none; background: transparent; text-align: center; font-weight: 800; color: var(--color-profit); padding: 4px; margin: 0; min-height: auto;"
                        onchange="hapticFeedback(); updateHistoryItem('${p.id}', 'end', this.value)">
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // Chart
    const chartDiv = document.createElement('div');
    chartDiv.className = 'glass-card';
    chartDiv.style.marginTop = '20px';
    chartDiv.style.paddingBottom = '20px'; // Add some padding at the bottom
    chartDiv.innerHTML = `
        <h2 style="text-align: center; margin-bottom: 15px;">Andamento Vendite</h2>
        <div style="height: 250px; position: relative;">
            <canvas id="inventoryChartCanvas"></canvas>
        </div>
    `;
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
            label: prod.icon, // Use icons only as requested
            data: data,
            borderColor: color,
            backgroundColor: color,
            tension: 0.4,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2
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
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'center',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        color: '#94A3B8'
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    titleFont: { size: 12 },
                    bodyFont: { size: 14, weight: '900' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#94A3B8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94A3B8', font: { size: 10 } }
                }
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
    // Sort logic
    const leaders = team.map(m => {
        const memberSales = teamTransactions.filter(t => t.memberId === m.id);
        const totalQty = memberSales.reduce((sum, t) => sum + t.qty, 0);
        return { ...m, totalQty };
    }).sort((a, b) => b.totalQty - a.totalQty);

    leaders.forEach((m, index) => {
        const rank = index + 1;
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';

        div.onclick = () => {
            hapticFeedback();
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
                <div style="font-size: 1.2rem; min-width: 30px; font-weight: 900; color: var(--text-secondary);">
                    ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank}
                </div>
                <div style="font-size: 2rem;">${m.icon || '👤'}</div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">${m.name}</h3>
                    <small style="color: var(--text-secondary); font-weight: 500;">${m.totalQty} Vendite</small>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 1.1rem; font-weight: 900; color: var(--color-profit);">
                    →
                </div>
            </div>
        `;
        container.appendChild(div);
        // FAB Management for Leaderboard
        const existingFab = document.querySelector('.fab-btn');
        if (existingFab) existingFab.remove();

        if (!selectionStates.team) {
            const fab = document.createElement('button');
            fab.innerText = '+';
            fab.className = 'btn fab-btn';
            fab.style.position = 'fixed';
            fab.style.bottom = '95px';
            fab.style.right = '20px';
            fab.style.width = '60px';
            fab.style.height = '60px';
            fab.style.borderRadius = '30px';
            fab.style.fontSize = '30px';
            fab.style.background = 'var(--color-profit)';
            fab.style.color = '#000';
            fab.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
            fab.style.zIndex = '999';
            fab.onclick = () => { hapticFeedback(); addEmployeePrompt(); };
            document.body.appendChild(fab);
        }
    });
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
        <button class="btn glass-card" style="margin-bottom: 24px; font-size: 0.8rem; padding: 10px 16px; min-height: auto;" onclick="hapticFeedback(); currentTeamMemberId=null; renderTeam();">
            ⬅ Classifica
        </button>
        
        <div class="glass-card" style="text-align: center; padding: 30px 20px;">
            <div style="font-size: 4.5rem; margin-bottom: 12px;">${m.icon || '👤'}</div>
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800;">${m.name}</h2>
            <div style="color: var(--color-income); font-weight: 700; font-size: 0.8rem; margin-top: 6px; letter-spacing: 0.05em; text-transform: uppercase;">
                ${(sweetCount + chipCount) > 20 ? '🏆 Top Seller' : (sweetCount + chipCount) > 5 ? '⭐ Rising Star' : 'Nuovo Membro'}
            </div>
        </div>

        <div class="glass-card" style="border: 1px solid var(--color-profit);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase;">Portafoglio</h3>
                    <div style="font-size: 1.8rem; font-weight: 900; margin-top: 4px;">€${unpaid.toFixed(2)}</div>
                </div>
                <div style="background: rgba(46, 204, 113, 0.1); padding: 10px; border-radius: 14px;">
                    💰
                </div>
            </div>
            ${unpaid > 0 ? `<button class="btn" style="width: 100%; margin-top: 20px; background: var(--color-profit); color: #000; font-weight: 800;" onclick="hapticFeedback(); payMember(${m.id})">EFFETTUA PAGAMENTO</button>` : ''}
            <div style="text-align: center; margin-top: 12px; font-size: 0.75rem; opacity: 0.6; font-weight: 500;">Guadagni Correnti: €${totalEarnings.toFixed(2)}</div>
        </div>

        <div class="glass-card">
            <h3 style="font-size: 1rem; margin-bottom: 15px;">📊 Performance</h3>
            <div class="chart-container" style="height: 200px;">
                <canvas id="memberPieChart"></canvas>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 24px 0 16px;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">Dettagli Vendite</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; padding-bottom: 40px;">
            ${myTrans.map(t => `
                <div class="glass-card" style="padding: 16px; border-left: 4px solid ${t.paid ? 'var(--color-profit)' : 'var(--color-expense)'};" onclick="hapticFeedback(); openEditTeamTransactionModal('${t.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 800; font-size: 1rem;">${t.type === 'sweet' ? '🍫 Dolce' : '🍟 Salato'} <span style="opacity: 0.5;">x${t.qty}</span></div>
                            <small style="color: var(--text-secondary); font-weight: 500;">${new Date(t.date).toLocaleDateString()}</small>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 900; font-size: 1.1rem; color: ${t.paid ? 'var(--color-profit)' : 'var(--color-income)'};">€${t.amount.toFixed(2)}</div>
                            <small style="color: ${t.paid ? 'var(--color-profit)' : 'var(--color-expense)'}; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">
                                ${t.paid ? 'Pagato' : 'In Sospeso'}
                            </small>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('memberPieChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Dolci', 'Salati'],
                datasets: [{
                    data: [sweetCount, chipCount],
                    backgroundColor: ['#D35400', '#FFD700'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } }
                }
            }
        });
    }, 100);
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
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.opacity = currentSubsView === 'registry' ? '0.7' : '1';

    card.onclick = () => {
        hapticFeedback();
        if (selectionStates.subs) {
            const cb = card.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
        } else if (currentSubsView === 'registry') {
            openEditSubModal(sub.id);
        }
    };

    const typeIcon = sub.type === 'sweet' ? '🍫' : '🍟';
    const typeLabel = sub.type === 'sweet' ? 'Dolce' : 'Salato';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                ${selectionStates.subs ? `<input type="checkbox" class="cb-subs" value="${sub.id}" style="transform: scale(1.3); margin-right: 8px;">` : ''}
                <div style="font-size: 1.8rem; background: rgba(255,255,255,0.05); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">${typeIcon}</div>
                <div>
                    <div style="font-weight: 800; font-size: 1.1rem;">${sub.name}</div>
                    <small style="color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase;">${typeLabel}</small>
                </div>
            </div>
            ${currentSubsView === 'active' ? `
                <div style="text-align: right;">
                    <button class="btn glass-card" style="padding: 6px 10px; min-height: auto; font-size: 0.65rem; font-weight: 800;" onclick="event.stopPropagation(); hapticFeedback(); toggleSubPaidStatus(${sub.id})">
                        ${sub.days.filter(d => d).length}/5 GG
                    </button>
                </div>
            ` : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; gap: 8px;">
            ${sub.days.map((day, i) => `
                <div 
                    onclick="event.stopPropagation(); hapticFeedback(); toggleSubDay(${sub.id}, ${i})"
                    class="glass-card"
                    style="
                        flex: 1; height: 44px; display: flex; align-items: center; justify-content: center;
                        background: ${day ? 'var(--color-profit)' : 'rgba(255, 255, 255, 0.03)'};
                        border: 1px solid ${day ? 'var(--color-profit)' : 'rgba(255, 255, 255, 0.1)'};
                        cursor: pointer; transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        color: ${day ? '#000' : '#888'}; font-weight: 900; font-size: 0.8rem;
                        box-shadow: ${day ? '0 4px 12px rgba(46, 204, 113, 0.2)' : 'none'};
                    "
                >
                    ${day ? '✓' : i + 1}
                </div>
            `).join('')}
        </div>
    `;
    return card;
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

    credits.sort((a, b) => (a.paid === b.paid ? 0 : a.paid ? 1 : -1));

    credits.forEach(c => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '16px';
        div.style.opacity = c.paid ? '0.5' : '1';

        div.onclick = () => {
            hapticFeedback();
            if (selectionStates.credits) {
                const cb = div.querySelector('input[type="checkbox"]');
                cb.checked = !cb.checked;
            } else {
                toggleCreditPaid(c.id);
            }
        };

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                ${selectionStates.credits ? `<input type="checkbox" class="cb-credits" value="${c.id}" style="transform: scale(1.3); margin-right: 8px;">` : ''}
                <div style="
                    width: 44px; height: 44px; border-radius: 12px;
                    border: 2px solid ${c.paid ? 'var(--color-profit)' : 'rgba(255,255,255,0.1)'}; 
                    background: ${c.paid ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.03)'};
                    display: flex; align-items: center; justify-content: center;
                    transition: 0.3s;
                ">
                    <span style="font-size: 1.2rem; color: ${c.paid ? 'var(--color-profit)' : '#888'}; font-weight: 900;">
                        ${c.paid ? '✓' : '!'}
                    </span>
                </div>
                <div style="text-decoration: ${c.paid ? 'line-through' : 'none'}; opacity: ${c.paid ? '0.6' : '1'};">
                    <strong style="font-size: 1rem; font-weight: 800; display: block;">${c.name}</strong>
                    <small style="color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase;">
                        ${c.paid ? 'Saldato' : 'In Sospeso'}
                    </small>
                </div>
            </div>
            <div style="color: ${c.paid ? 'var(--color-profit)' : 'var(--color-expense)'}; font-weight: 900; font-size: 1.1rem; text-align: right;">
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
        const amountColor = t.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)';
        const sign = t.type === 'income' ? '+' : '-';

        div.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1; gap: 15px;">
                ${selectionStates.home ? `<input type="checkbox" class="cb-home" value="${t.id}" style="transform: scale(1.3);">` : ''}
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: 0.95rem;">${t.desc}</div>
                    <small style="color: var(--text-secondary); font-weight: 500;">${dateStr}</small>
                </div>
            </div>
            <div style="color: ${amountColor}; font-weight: 900; font-size: 1.1rem; text-align: right;">
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
                borderColor: '#2ECC71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#2ECC71',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 14, weight: '900' },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `€${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#94A3B8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#94A3B8',
                        font: { size: 10 },
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
