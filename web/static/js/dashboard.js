/**
 * Administr Dashboard - Multi-page + Charts + Map + Tables
 */

// ============ COLORS ============
const C = {
    accent: '#6366f1', cyan: '#06b6d4', green: '#10b981',
    red: '#ef4444', yellow: '#f59e0b', orange: '#f97316',
    pink: '#ec4899', lime: '#84cc16', blue: '#3b82f6',
    text2: '#94a3b8', grid: 'rgba(148,163,184,0.08)',
};
const PALETTE = [C.accent, C.cyan, C.green, C.yellow, C.orange, C.red, C.pink, C.lime, C.blue, '#a78bfa'];

// ============ Chart.js Defaults ============
Chart.defaults.color = C.text2;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.animation.duration = 1000;

// ============ Utils ============
const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toLocaleString('vi-VN');


async function api(url) {
    try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); }
    catch { return null; }
}

function animVal(el, end, dur=800) {
    const start = performance.now();
    (function up(now) {
        const p = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * e).toLocaleString('vi-VN');
        if (p < 1) requestAnimationFrame(up);
    })(start);
}

function scoreColor(score) {
    if (score >= 80) return C.red;
    if (score >= 60) return C.orange;
    if (score >= 40) return C.yellow;
    if (score >= 20) return '#84cc16';
    return C.green;
}

function scoreBg(score) {
    const c = scoreColor(score);
    return `background:${c}; color:#fff`;
}

// ============ Navigation ============
const pages = {};
document.querySelectorAll('.page-content').forEach(p => pages[p.id.replace('page-', '')] = p);
const navItems = document.querySelectorAll('.nav-item');
let currentPage = 'dashboard';
let mapsInitialized = { dashboard: false, report: false };

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page === currentPage) return;
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        Object.values(pages).forEach(p => p.classList.remove('active'));
        pages[page].classList.add('active');
        currentPage = page;
        
        // Update topbar title
        const titles = {
            dashboard: 'Administr Dashboard',
            logs: 'Administr Logs',
            analysis: 'Administr Phân tích User',
            reports: 'Administr Báo cáo'
        };
        document.getElementById('topbar-title').textContent = titles[page] || 'Administr Dashboard';
        
        // Lazy load pages
        if (page === 'logs' && !logsLoaded) loadLogs();
        if (page === 'analysis' && !analysisLoaded) loadAnalysis();
        if (page === 'reports' && !reportsLoaded) loadReports();
        
        // Fix map rendering on tab switch
        if (page === 'dashboard' && !mapsInitialized.dashboard) {
            setTimeout(() => loadMapDashboard(), 200);
        }
        if (page === 'reports' && !mapsInitialized.report) {
            setTimeout(() => loadMapReport(), 200);
        }
    });
});

// ============ THEME TOGGLE ============
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let currentTheme = localStorage.getItem('dashboard-theme') || 'dark';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem('dashboard-theme', theme);
    currentTheme = theme;
    
    // Update Chart.js defaults for current theme
    const textColor = theme === 'light' ? '#475569' : '#94a3b8';
    Chart.defaults.color = textColor;
}

applyTheme(currentTheme);

themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// ============ SIDEBAR TOGGLE ============
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarIcon = sidebarToggle.querySelector('.material-icons-round');

sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    sidebarIcon.textContent = isCollapsed ? 'menu' : 'menu_open';
    
    // Đợi transition CSS kết thúc rồi báo cho ChartJS vẽ lại kích thước
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
});

// ============ DASHBOARD ============
async function loadDashboard() {
    const overview = await api('/api/overview');
    
    if (overview) {
        animVal(document.getElementById('kpi-total'), overview.total_transactions);
        animVal(document.getElementById('kpi-accepted'), overview.success_count);
        animVal(document.getElementById('kpi-blocked'), overview.fail_count);
        animVal(document.getElementById('kpi-review'), overview.need_review);
    }
    
    // Load all dashboard charts
    await Promise.all([
        loadTPS(), loadStatusDonut(), loadAlerts(),
        loadFraudChart(), loadAmountChart(), loadTypesChart(),
        loadAccTxChart(), loadAnomalyChart(), loadAccountsChart(),
        loadMapDashboard()
    ]);
}

async function loadTPS() {
    const data = await api('/api/step_frequency');
    if (!data) return;
    const ctx = document.getElementById('chart-tps').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, C.green + '50');
    grad.addColorStop(1, C.green + '05');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => `Step ${d.step}`),
            datasets: [{
                data: data.map(d => d.count),
                borderColor: C.green, backgroundColor: grad,
                borderWidth: 2.5, fill: true, tension: 0.4,
                pointBackgroundColor: C.green, pointBorderColor: '#fff',
                pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } },
                x: { grid: { display: false } }
            }
        }
    });
}

async function loadStatusDonut() {
    const data = await api('/api/status_distribution');
    if (!data) return;
    new Chart(document.getElementById('chart-status-donut'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: [C.red + 'cc', C.green + 'cc', C.yellow + 'cc'],
                borderColor: [C.red, C.green, C.yellow],
                borderWidth: 2, hoverOffset: 6,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.raw.toLocaleString('vi-VN')} (${((ctx.raw/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
                    }
                }
            }
        }
    });
}

async function loadAlerts() {
    const data = await api('/api/recent_alerts');
    if (!data) return;
    const list = document.getElementById('alerts-list');
    list.innerHTML = data.slice(0, 15).map(a => `
        <div class="alert-item ${a.level.toLowerCase()}">
            <div class="alert-info">
                <div class="alert-date">${a.created_at}</div>
                <div class="alert-desc">Giao dịch ID: ${a.id}...</div>
            </div>
            <span class="alert-level ${a.level.toLowerCase()}">${a.level === 'High' ? '▲ High' : '▲ Medium'}</span>
        </div>
    `).join('');
}

async function loadFraudChart() {
    const data = await api('/api/fraud_distribution');
    if (!data) return;
    new Chart(document.getElementById('chart-fraud'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.green+'cc', C.red+'cc'], borderColor: [C.green, C.red], borderWidth: 2, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw.toLocaleString('vi-VN')} (${((ctx.raw/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(2)}%)` } } } }
    });
}

async function loadAmountChart() {
    const data = await api('/api/amount_distribution');
    if (!data) return;
    new Chart(document.getElementById('chart-amount'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.blue+'aa', C.yellow+'aa'], borderColor: [C.blue, C.yellow], borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } } }
    });
}

async function loadTypesChart() {
    const data = await api('/api/transaction_types');
    if (!data) return;
    new Chart(document.getElementById('chart-types'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: PALETTE.slice(0, data.length).map(c => c+'aa'), borderColor: PALETTE.slice(0, data.length), borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, y: { grid: { display: false } } } }
    });
}

async function loadAccTxChart() {
    const data = await api('/api/account_type_transactions');
    if (!data) return;
    const types = Object.keys(data);
    new Chart(document.getElementById('chart-acc-tx'), {
        type: 'bar',
        data: {
            labels: types,
            datasets: [
                { label: 'Customer', data: types.map(t => data[t].Customer || 0), backgroundColor: C.blue+'aa', borderColor: C.blue, borderWidth: 2, borderRadius: 6 },
                { label: 'Merchant', data: types.map(t => data[t].Merchant || 0), backgroundColor: C.pink+'aa', borderColor: C.pink, borderWidth: 2, borderRadius: 6 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { stacked: true, grid: { display: false } } } }
    });
}

async function loadAnomalyChart() {
    const data = await api('/api/anomaly_distribution');
    if (!data) return;
    const colors = [C.green, C.lime, C.yellow, C.orange, C.red, '#991b1b'];
    new Chart(document.getElementById('chart-anomaly'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: data.map((_, i) => (colors[i] || C.red)+'aa'), borderColor: data.map((_, i) => colors[i] || C.red), borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } } }
    });
}

async function loadAccountsChart() {
    const data = await api('/api/account_types');
    if (!data) return;
    new Chart(document.getElementById('chart-accounts'), {
        type: 'pie',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.blue+'cc', C.pink+'cc'], borderColor: [C.blue, C.pink], borderWidth: 2, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

async function loadMapDashboard() {
    if (mapsInitialized.dashboard) return;
    const data = await api('/api/map_data');
    if (!data || !data.length) return;
    
    const map = L.map('map-dashboard').setView([16.0, 106.5], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19
    }).addTo(map);
    
    const markers = L.markerClusterGroup({ maxClusterRadius: 50, showCoverageOnHover: false });
    data.forEach(p => {
        const isFraud = p.is_fraud === 1;
        const marker = L.circleMarker([p.lat, p.lng], {
            radius: isFraud ? 8 : 5, fillColor: isFraud ? C.red : C.green,
            color: isFraud ? C.red : C.green, weight: 1, opacity: 0.9, fillOpacity: 0.7,
        });
        marker.bindPopup(`<div style="min-width:160px"><strong style="color:${isFraud?C.red:C.green}">${isFraud?'GIAN LẬN':'Hợp lệ'}</strong><br>Vị trí: ${p.location}<br>Loại: ${p.type}<br>Số tiền: ${Number(p.amount).toLocaleString('vi-VN')}<br>Score: ${p.anomaly_score}</div>`);
        markers.addLayer(marker);
    });
    map.addLayer(markers);
    mapsInitialized.dashboard = true;
}

// ============ LOGS PAGE ============
let logsLoaded = false;
let logPage = 1;
let logSort = 'transaction_id';
let logDir = 'DESC';

async function loadLogs(page = 1) {
    logsLoaded = true;
    logPage = page;
    
    const txType = document.querySelector('input[name="logType"]:checked')?.value || '';
    const minAmt = document.getElementById('filter-min-amount').value;
    const maxAmt = document.getElementById('filter-max-amount').value;
    
    let url = `/api/transactions_table?page=${page}&per_page=15&sort=${logSort}&dir=${logDir}`;
    if (txType) url += `&type=${txType}`;
    if (minAmt) url += `&min_amount=${minAmt}`;
    if (maxAmt) url += `&max_amount=${maxAmt}`;
    
    const result = await api(url);
    if (!result) return;
    
    const tbody = document.getElementById('tx-table-body');
    tbody.innerHTML = result.data.map(r => `
        <tr class="${r.is_fraud ? 'fraud-row' : ''}">
            <td>${r.created_at}</td>
            <td>${r.id}</td>
            <td>${r.from_account}</td>
            <td>${r.to_account}</td>
            <td>${r.type}</td>
            <td>${Number(r.amount).toLocaleString('vi-VN')} VND</td>
            <td><span class="score-cell" style="${scoreBg(r.anomaly_score)}">${r.anomaly_score}</span></td>
            <td><span class="status-badge ${r.anomaly_score >= 60 ? 'blocked' : r.status}">${r.anomaly_score >= 60 ? 'Đã Bị Chặn' : r.status === 'success' ? 'Đã Phê Duyệt' : 'Nghi vấn'}</span></td>
        </tr>
    `).join('');
    
    // Pagination
    renderPagination('pagination', result.page, result.total_pages, p => loadLogs(p));
}

function renderPagination(containerId, current, total, callback) {
    const el = document.getElementById(containerId);
    if (total <= 1) { el.innerHTML = ''; return; }
    
    let html = `<button class="pg-btn" ${current <= 1 ? 'disabled' : ''} onclick="return false"></button>`;
    html += `<button class="pg-btn" ${current <= 1 ? 'disabled' : ''} onclick="return false"></button>`;
    
    const range = 2;
    const start = Math.max(1, current - range);
    const end = Math.min(total, current + range);
    
    if (start > 1) html += `<button class="pg-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span style="color:var(--text-3)">...</span>`;
    
    for (let i = start; i <= end; i++) {
        html += `<button class="pg-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (end < total - 1) html += `<span style="color:var(--text-3)">...</span>`;
    if (end < total) html += `<button class="pg-btn" data-page="${total}">${total}</button>`;
    
    html += `<button class="pg-btn" ${current >= total ? 'disabled' : ''} onclick="return false"></button>`;
    html += `<button class="pg-btn" ${current >= total ? 'disabled' : ''} onclick="return false"></button>`;
    
    el.innerHTML = html;
    
    // Event listeners
    el.querySelectorAll('.pg-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => callback(parseInt(btn.dataset.page)));
    });
    // First/Last/Prev/Next
    const btns = el.querySelectorAll('.pg-btn:not([data-page])');
    if (btns[0]) btns[0].addEventListener('click', () => { if (current > 1) callback(1); });
    if (btns[1]) btns[1].addEventListener('click', () => { if (current > 1) callback(current - 1); });
    if (btns[2]) btns[2].addEventListener('click', () => { if (current < total) callback(current + 1); });
    if (btns[3]) btns[3].addEventListener('click', () => { if (current < total) callback(total); });
}

// Sort handlers
document.querySelectorAll('.tx-table .sortable').forEach(th => {
    th.addEventListener('click', () => {
        const sort = th.dataset.sort;
        if (logSort === sort) logDir = logDir === 'DESC' ? 'ASC' : 'DESC';
        else { logSort = sort; logDir = 'DESC'; }
        loadLogs(1);
    });
});

// Filter
document.getElementById('btn-apply-filter').addEventListener('click', () => loadLogs(1));

// ============ ANALYSIS PAGE ============
let analysisLoaded = false;

async function loadAnalysis() {
    analysisLoaded = true;
    const [accounts, accTx, steps] = await Promise.all([
        api('/api/account_types'),
        api('/api/account_type_transactions'),
        api('/api/step_frequency')
    ]);
    
    if (accounts) {
        new Chart(document.getElementById('chart-accounts2'), {
            type: 'pie',
            data: { labels: accounts.map(d => d.label), datasets: [{ data: accounts.map(d => d.count), backgroundColor: [C.blue+'cc', C.pink+'cc'], borderColor: [C.blue, C.pink], borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    if (accTx) {
        const types = Object.keys(accTx);
        new Chart(document.getElementById('chart-acc-tx2'), {
            type: 'bar',
            data: {
                labels: types,
                datasets: [
                    { label: 'Customer', data: types.map(t => accTx[t].Customer || 0), backgroundColor: C.blue+'aa', borderColor: C.blue, borderWidth: 2, borderRadius: 6 },
                    { label: 'Merchant', data: types.map(t => accTx[t].Merchant || 0), backgroundColor: C.pink+'aa', borderColor: C.pink, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid } }, x: { stacked: true, grid: { display: false } } } }
        });
    }
    
    if (steps) {
        const ctx = document.getElementById('chart-step2').getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, C.accent + '40');
        grad.addColorStop(1, C.accent + '05');
        new Chart(ctx, {
            type: 'line',
            data: { labels: steps.map(d => `Step ${d.step}`), datasets: [{ data: steps.map(d => d.count), borderColor: C.accent, backgroundColor: grad, borderWidth: 3, fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: C.accent }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } } }
        });
    }
}

// ============ REPORTS PAGE ============
let reportsLoaded = false;
let reportCharts = {};

async function loadReports() {
    reportsLoaded = true;
    
    // Build query string from filters
    const type = document.getElementById('report-type-filter')?.value || '';
    const loc = document.getElementById('report-location-filter')?.value || '';
    const risk = document.getElementById('report-risk-filter')?.value || '';
    
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (loc) params.append('location', loc);
    if (risk) params.append('risk', risk);
    const qs = params.toString() ? '?' + params.toString() : '';
    
    const [blocked, riskType, geo] = await Promise.all([
        api('/api/blocked_by_step' + qs),
        api('/api/risk_by_type' + qs),
        api('/api/geo_heatmap' + qs)
    ]);
    
    if (blocked) {
        if (reportCharts.blockedStep) reportCharts.blockedStep.destroy();
        reportCharts.blockedStep = new Chart(document.getElementById('chart-blocked-step'), {
            type: 'bar',
            data: {
                labels: blocked.map(d => `Step ${d.step}`),
                datasets: [
                    { label: 'Bị chặn', data: blocked.map(d => d.blocked), backgroundColor: C.red+'aa', borderColor: C.red, borderWidth: 2, borderRadius: 6 },
                    { label: 'Nghi vấn', data: blocked.map(d => d.suspicious), backgroundColor: C.yellow+'aa', borderColor: C.yellow, borderWidth: 2, borderRadius: 6 },
                    { label: 'An toàn', data: blocked.map(d => d.clean), backgroundColor: C.green+'aa', borderColor: C.green, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { stacked: true, grid: { display: false } } } }
        });
    }
    
    if (riskType) {
        if (reportCharts.riskTrend) reportCharts.riskTrend.destroy();
        reportCharts.riskTrend = new Chart(document.getElementById('chart-risk-trend'), {
            type: 'bar',
            data: {
                labels: riskType.map(d => d.type),
                datasets: [
                    { label: 'Avg Anomaly Score', data: riskType.map(d => d.avg_score), backgroundColor: PALETTE.slice(0, riskType.length).map(c => c+'aa'), borderColor: PALETTE.slice(0, riskType.length), borderWidth: 2, borderRadius: 8, borderSkipped: false },
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100, grid: { color: C.grid } }, x: { grid: { display: false } } } }
        });
        
        if (reportCharts.riskType) reportCharts.riskType.destroy();
        reportCharts.riskType = new Chart(document.getElementById('chart-risk-type'), {
            type: 'bar',
            data: {
                labels: riskType.map(d => d.type),
                datasets: [
                    { label: 'Fraud Count', data: riskType.map(d => d.fraud_count), backgroundColor: C.red+'aa', borderColor: C.red, borderWidth: 2, borderRadius: 6 },
                    { label: 'Total', data: riskType.map(d => d.total), backgroundColor: C.blue+'22', borderColor: C.blue, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } } }
        });
    }
    
    // Geo heatmap
    if (geo) loadMapReport(geo);
    
    // Populate location filter (only once)
    if (geo && !window.reportLocationsLoaded) {
        const sel = document.getElementById('report-location-filter');
        geo.forEach(g => { const o = document.createElement('option'); o.value = g.location; o.textContent = g.location; sel.appendChild(o); });
        window.reportLocationsLoaded = true;
    }
}

async function loadMapReport(geo) {
    if (!geo) return;
    
    let map = window.reportMapInstance;
    if (!map) {
        map = L.map('map-report').setView([16.0, 106.5], 6);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19
        }).addTo(map);
        window.reportMapInstance = map;
        window.reportMapMarkers = L.layerGroup().addTo(map);
        mapsInitialized.report = true;
    } else {
        window.reportMapMarkers.clearLayers();
    }
    
    geo.forEach(g => {
        const intensity = Math.min(g.avg_score / 100, 1);
        const r = Math.round(255 * intensity);
        const green = Math.round(255 * (1 - intensity));
        const color = `rgb(${r}, ${green}, 50)`;
        const radius = Math.max(10, Math.min(35, g.total / 10000));
        
        L.circleMarker([g.lat, g.lng], {
            radius: radius, fillColor: color, color: color,
            weight: 2, opacity: 0.9, fillOpacity: 0.5,
        }).bindPopup(`<div><strong>${g.location}</strong><br>Tổng GD: ${g.total.toLocaleString('vi-VN')}<br>Fraud: ${g.fraud_count.toLocaleString('vi-VN')}<br>Avg Score: ${g.avg_score}</div>`)
        .addTo(window.reportMapMarkers);
    });
}

// Add Event Listeners for Filters
['report-type-filter', 'report-location-filter', 'report-risk-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
        if (reportsLoaded) loadReports();
    });
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', loadDashboard);
