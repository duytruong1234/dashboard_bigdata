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
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toLocaleString('vi-VN');


async function api(url) {
    try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); }
    catch { return null; }
}

function animVal(el, end, dur = 800) {
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
        const total = overview.success_count + overview.fail_count;
        animVal(document.getElementById('kpi-total'), overview.total_transactions);
        animVal(document.getElementById('kpi-success'), overview.success_count);
        animVal(document.getElementById('kpi-fail'), overview.fail_count);
        const sPct = total > 0 ? ((overview.success_count / total) * 100).toFixed(1) + '%' : '--';
        const fPct = total > 0 ? ((overview.fail_count / total) * 100).toFixed(1) + '%' : '--';
        document.getElementById('kpi-success-pct').textContent = sPct;
        document.getElementById('kpi-fail-pct').textContent = fPct;
    }

    // Load all dashboard charts
    await Promise.all([
        loadTPS(), loadStatusDonut(),
        loadFraudChart(), loadAmountChart(), loadTypesChart(),
        loadAnomalyChart(), loadAccountsChart(),
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
    // Sắp xếp: Thành công trước, Thất bại sau
    const sorted = data.sort((a, b) => a.label === 'Thành công' ? -1 : 1);
    const colors = sorted.map(d => d.label === 'Thành công' ? C.green : C.red);
    new Chart(document.getElementById('chart-status-donut'), {
        type: 'doughnut',
        data: {
            labels: sorted.map(d => d.label),
            datasets: [{
                data: sorted.map(d => d.count),
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2, hoverOffset: 6,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.raw.toLocaleString('vi-VN')} (${((ctx.raw / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
                    }
                }
            }
        }
    });
}

// Alerts đã được bỏ theo yêu cầu

async function loadFraudChart() {
    const data = await api('/api/fraud_distribution');
    if (!data) return;
    new Chart(document.getElementById('chart-fraud'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.green + 'cc', C.red + 'cc'], borderColor: [C.green, C.red], borderWidth: 2, hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw.toLocaleString('vi-VN')} (${((ctx.raw / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(2)}%)` } }
            }
        }
    });
}

async function loadAmountChart() {
    const data = await api('/api/amount_distribution');
    if (!data) return;
    new Chart(document.getElementById('chart-amount'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.blue + 'aa', C.yellow + 'aa'], borderColor: [C.blue, C.yellow], borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } }
        }
    });
}

async function loadTypesChart() {
    const data = await api('/api/transaction_types');
    if (!data) return;
    new Chart(document.getElementById('chart-types'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: PALETTE.slice(0, data.length).map(c => c + 'aa'), borderColor: PALETTE.slice(0, data.length), borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, y: { grid: { display: false } } }
        }
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
                { label: 'Customer', data: types.map(t => data[t].Customer || 0), backgroundColor: C.blue + 'aa', borderColor: C.blue, borderWidth: 2, borderRadius: 6 },
                { label: 'Merchant', data: types.map(t => data[t].Merchant || 0), backgroundColor: C.pink + 'aa', borderColor: C.pink, borderWidth: 2, borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { stacked: true, grid: { display: false } } }
        }
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
            datasets: [{ data: data.map(d => d.count), backgroundColor: data.map((_, i) => (colors[i] || C.red) + 'aa'), borderColor: data.map((_, i) => colors[i] || C.red), borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } }
        }
    });
}

async function loadAccountsChart() {
    const data = await api('/api/account_types');
    if (!data) return;
    new Chart(document.getElementById('chart-accounts'), {
        type: 'pie',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.count), backgroundColor: [C.blue + 'cc', C.pink + 'cc'], borderColor: [C.blue, C.pink], borderWidth: 2, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

async function loadMapDashboard() {
    if (mapsInitialized.dashboard) return;
    const data = await api('/api/map_data');
    if (!data || !data.length) return;

    const map = L.map('map-dashboard').setView([16.0, 106.5], 6);
    // Sử dụng bản đồ Google Maps có tiếng Việt (hiển thị Biển Đông đúng chuẩn)
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps', maxZoom: 19
    }).addTo(map);

    const scoreColors = ['#16a34a', '#84cc16', '#eab308', '#f97316', '#ef4444', '#991b1b'];
    
    const markers = L.markerClusterGroup({ 
        maxClusterRadius: 50, 
        showCoverageOnHover: false,
        iconCreateFunction: function(cluster) {
            const childMarkers = cluster.getAllChildMarkers();
            let totalScore = 0;
            childMarkers.forEach(m => totalScore += (m.options.anomaly_score || 0));
            const avgScore = totalScore / childMarkers.length;
            
            let colorIndex = 0;
            if (avgScore > 0 && avgScore <= 20) colorIndex = 1;
            else if (avgScore > 20 && avgScore <= 40) colorIndex = 2;
            else if (avgScore > 40 && avgScore <= 60) colorIndex = 3;
            else if (avgScore > 60 && avgScore <= 80) colorIndex = 4;
            else if (avgScore > 80) colorIndex = 5;
            
            const color = scoreColors[colorIndex];
            
            return L.divIcon({
                html: `<div style="background-color: ${color}dd; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid ${color}; box-shadow: 0 0 8px ${color}88;">${cluster.getChildCount()}</div>`,
                className: 'custom-cluster-icon',
                iconSize: L.point(40, 40)
            });
        }
    });

    data.forEach(p => {
        const isFraud = p.is_fraud === 1;
        
        let colorIndex = 0;
        if (p.anomaly_score > 0 && p.anomaly_score <= 20) colorIndex = 1;
        else if (p.anomaly_score > 20 && p.anomaly_score <= 40) colorIndex = 2;
        else if (p.anomaly_score > 40 && p.anomaly_score <= 60) colorIndex = 3;
        else if (p.anomaly_score > 60 && p.anomaly_score <= 80) colorIndex = 4;
        else if (p.anomaly_score > 80) colorIndex = 5;
        const markerColor = scoreColors[colorIndex];

        const marker = L.circleMarker([p.lat, p.lng], {
            radius: isFraud ? 8 : 6,
            fillColor: markerColor,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
            anomaly_score: p.anomaly_score // Save score for cluster calculation
        });

        // Tooltip luôn hiển thị - không cần hover
        const shortAmt = p.amount >= 1000000
            ? (p.amount / 1000000).toFixed(1) + 'M'
            : p.amount >= 1000
                ? (p.amount / 1000).toFixed(0) + 'K'
                : Math.round(p.amount);
        marker.bindTooltip(
            `<b>${isFraud ? 'GIAN LAN' : 'OK'}</b> | ${shortAmt} | Score:${p.anomaly_score}`,
            {
                permanent: true,
                direction: 'top',
                offset: [0, -8],
                className: isFraud ? 'map-tooltip-fraud' : 'map-tooltip-normal'
            }
        );

        // Popup chi tiết khi click
        marker.bindPopup(`<div style="min-width:180px;font-size:13px;">
            <strong style="color:${markerColor}">${isFraud ? 'GIAN LAN' : 'Hop le'}</strong><br>
            <b>Vi tri:</b> ${p.location}<br>
            <b>Loai:</b> ${p.type}<br>
            <b>So tien:</b> ${Number(p.amount).toLocaleString('vi-VN')}<br>
            <b>Score:</b> ${p.anomaly_score}<br>
            <b>Log ID:</b> ${p.log_id}
        </div>`);

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
let logTotalPages = 1;

function getLogFilterParams() {
    const txType = document.querySelector('input[name="logType"]:checked')?.value || '';
    const minAmt = document.getElementById('filter-min-amount').value;
    const maxAmt = document.getElementById('filter-max-amount').value;
    let qs = '';
    if (txType) qs += `&type=${txType}`;
    if (minAmt) qs += `&min_amount=${minAmt}`;
    if (maxAmt) qs += `&max_amount=${maxAmt}`;
    return qs;
}

async function loadLogs(page = 1) {
    logsLoaded = true;
    logPage = page;
    const filterQs = getLogFilterParams();

    let url = `/api/transactions_table?page=${page}&per_page=15&sort=${logSort}&dir=${logDir}${filterQs}`;

    const [result, stats] = await Promise.all([
        api(url),
        api(`/api/logs_stats?${filterQs.replace(/^&/, '')}`)
    ]);

    if (!result) return;
    logTotalPages = result.total_pages;

    // Render stats
    if (stats) {
        document.getElementById('log-stat-success').textContent = stats.success_count.toLocaleString('vi-VN');
        document.getElementById('log-stat-fail').textContent = stats.fail_count.toLocaleString('vi-VN');

        // Score distribution bars
        const scoreColors = [C.green, '#84cc16', C.yellow, C.orange, C.red, '#991b1b'];
        const maxCount = Math.max(...stats.score_distribution.map(d => d.count), 1);
        const barsEl = document.getElementById('score-bars');
        barsEl.innerHTML = stats.score_distribution.map((d, i) => {
            const h = Math.max(12, (d.count / maxCount) * 160);
            const total = stats.success_count + stats.fail_count;
            const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
            return `<div class="score-bar-item">
                <div class="score-bar-count">${fmt(d.count)}</div>
                <div class="score-bar-fill" style="height:${h}px;background:${scoreColors[i] || C.red}"></div>
                <div class="score-bar-label">${d.label}</div>
                <div class="score-bar-label">${pct}%</div>
            </div>`;
        }).join('');
    }

    const fmtBal = n => n != null ? Number(n).toLocaleString('vi-VN') : '--';
    const tbody = document.getElementById('tx-table-body');
    tbody.innerHTML = result.data.map(r => `
        <tr class="${r.is_fraud ? 'fraud-row' : ''}">
            <td>${r.created_at}</td>
            <td>${r.id}</td>
            <td>${r.from_account}</td>
            <td>${r.to_account}</td>
            <td>${r.type}</td>
            <td>${Number(r.amount).toLocaleString('vi-VN')} VND</td>
            <td class="balance-cell">${fmtBal(r.old_balance_org)} → ${fmtBal(r.new_balance_org)}</td>
            <td class="balance-cell">${fmtBal(r.old_balance_dest)} → ${fmtBal(r.new_balance_dest)}</td>
            <td><span class="score-cell" style="${scoreBg(r.anomaly_score)}">${r.anomaly_score}</span></td>
            <td>${r.is_flagged_fraud ? '<span style="color:var(--red);font-weight:bold;">CÓ</span>' : '<span style="color:var(--text-3);">Không</span>'}</td>
            <td><span class="status-badge ${r.status}">${r.status === 'success' ? 'Success' : 'Fail'}</span></td>
        </tr>
    `).join('');

    // Pagination
    renderPagination('pagination', result.page, result.total_pages, p => loadLogs(p));
}

function renderPagination(containerId, current, total, callback) {
    const el = document.getElementById(containerId);
    if (total <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="pg-btn" ${current <= 1 ? 'disabled' : ''} onclick="return false">«</button>`;
    html += `<button class="pg-btn" ${current <= 1 ? 'disabled' : ''} onclick="return false">‹</button>`;

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

    html += `<button class="pg-btn" ${current >= total ? 'disabled' : ''} onclick="return false">›</button>`;
    html += `<button class="pg-btn" ${current >= total ? 'disabled' : ''} onclick="return false">»</button>`;

    el.innerHTML = html;

    el.querySelectorAll('.pg-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => callback(parseInt(btn.dataset.page)));
    });
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

// Page jump
document.getElementById('btn-page-jump')?.addEventListener('click', () => {
    const val = parseInt(document.getElementById('page-jump-input').value);
    if (val >= 1 && val <= logTotalPages) loadLogs(val);
});
document.getElementById('page-jump-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const val = parseInt(e.target.value);
        if (val >= 1 && val <= logTotalPages) loadLogs(val);
    }
});


// ============ ANALYSIS PAGE ============
let analysisLoaded = false;

async function loadAnalysis() {
    analysisLoaded = true;
    const [accounts, sendReceive, steps] = await Promise.all([
        api('/api/account_types'),
        api('/api/account_type_send_receive'),
        api('/api/step_frequency')
    ]);

    // Pie chart: TỶ LỆ (ratio) Customer vs Merchant
    if (accounts) {
        new Chart(document.getElementById('chart-accounts2'), {
            type: 'pie',
            data: {
                labels: accounts.map(d => d.label),
                datasets: [{ data: accounts.map(d => d.count), backgroundColor: [C.blue + 'cc', C.pink + 'cc'], borderColor: [C.blue, C.pink], borderWidth: 2 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return `${ctx.label}: ${ctx.raw.toLocaleString('vi-VN')} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Giao dịch GỬI theo loại tài khoản
    if (sendReceive && sendReceive.send) {
        const sendTypes = Object.keys(sendReceive.send);
        new Chart(document.getElementById('chart-acc-send'), {
            type: 'bar',
            data: {
                labels: sendTypes,
                datasets: [
                    { label: 'Customer (Gửi)', data: sendTypes.map(t => sendReceive.send[t].Customer || 0), backgroundColor: C.blue + 'aa', borderColor: C.blue, borderWidth: 2, borderRadius: 6 },
                    { label: 'Merchant (Gửi)', data: sendTypes.map(t => sendReceive.send[t].Merchant || 0), backgroundColor: C.pink + 'aa', borderColor: C.pink, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } }
            }
        });
    }

    // Giao dịch NHẬN theo loại tài khoản
    if (sendReceive && sendReceive.receive) {
        const recvTypes = Object.keys(sendReceive.receive);
        new Chart(document.getElementById('chart-acc-receive'), {
            type: 'bar',
            data: {
                labels: recvTypes,
                datasets: [
                    { label: 'Customer (Nhận)', data: recvTypes.map(t => sendReceive.receive[t].Customer || 0), backgroundColor: C.cyan + 'aa', borderColor: C.cyan, borderWidth: 2, borderRadius: 6 },
                    { label: 'Merchant (Nhận)', data: recvTypes.map(t => sendReceive.receive[t].Merchant || 0), backgroundColor: C.orange + 'aa', borderColor: C.orange, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } }
            }
        });
    }

    // Step frequency - chỉ hiển thị 1 chỗ thôi
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

    const type = document.getElementById('report-type-filter')?.value || '';
    const loc = document.getElementById('report-location-filter')?.value || '';
    const risk = document.getElementById('report-risk-filter')?.value || '';

    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (loc) params.append('location', loc);
    if (risk) params.append('risk', risk);
    const qs = params.toString() ? '?' + params.toString() : '';

    const [blocked, scoreDist, riskType, geo] = await Promise.all([
        api('/api/blocked_by_step' + qs),
        api('/api/score_distribution_by_type' + qs),
        api('/api/anomaly_score_by_type' + qs),
        api('/api/geo_heatmap' + qs)
    ]);

    // Chart 1: Giao dich theo Step - Thanh cong / That bai
    if (blocked) {
        if (reportCharts.blockedStep) reportCharts.blockedStep.destroy();
        reportCharts.blockedStep = new Chart(document.getElementById('chart-blocked-step'), {
            type: 'bar',
            data: {
                labels: blocked.map(d => `Step ${d.step}`),
                datasets: [
                    { label: 'Thành công', data: blocked.map(d => d.success), backgroundColor: C.green + 'aa', borderColor: C.green, borderWidth: 2, borderRadius: 6 },
                    { label: 'Thất bại', data: blocked.map(d => d.fail), backgroundColor: C.red + 'aa', borderColor: C.red, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { stacked: true, grid: { display: false } } } }
        });
    }

    // Chart 2: Phan bo muc diem Anomaly theo loai giao dich
    if (scoreDist) {
        if (reportCharts.scoreDistType) reportCharts.scoreDistType.destroy();
        const scoreLabels = ['0', '20', '40', '60', '80', '100'];
        const scoreColors = [C.green, '#84cc16', C.yellow, C.orange, C.red, '#991b1b'];
        const scoreKeys = ['score_0', 'score_20', 'score_40', 'score_60', 'score_80', 'score_100'];

        reportCharts.scoreDistType = new Chart(document.getElementById('chart-score-dist-type'), {
            type: 'bar',
            data: {
                labels: scoreDist.map(d => d.type),
                datasets: scoreLabels.map((label, i) => ({
                    label: `Score ${label}`,
                    data: scoreDist.map(d => d[scoreKeys[i]]),
                    backgroundColor: scoreColors[i] + 'aa',
                    borderColor: scoreColors[i],
                    borderWidth: 2,
                    borderRadius: 4
                }))
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { y: { beginAtZero: true, stacked: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { stacked: true, grid: { display: false } } }
            }
        });
    }

    // Chart 3: So luong thanh cong / that bai theo loai giao dich
    if (riskType) {
        if (reportCharts.riskType) reportCharts.riskType.destroy();
        reportCharts.riskType = new Chart(document.getElementById('chart-risk-type'), {
            type: 'bar',
            data: {
                labels: riskType.map(d => d.type),
                datasets: [
                    { label: 'Thành công', data: riskType.map(d => d.success_count), backgroundColor: C.green + 'aa', borderColor: C.green, borderWidth: 2, borderRadius: 6 },
                    { label: 'Thất bại', data: riskType.map(d => d.fail_count), backgroundColor: C.red + 'aa', borderColor: C.red, borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: v => fmt(v) } }, x: { grid: { display: false } } } }
        });
    }

    // Populate location filter (only once)
    if (geo && !window.reportLocationsLoaded) {
        const sel = document.getElementById('report-location-filter');
        geo.forEach(g => { const o = document.createElement('option'); o.value = g.location; o.textContent = g.location; sel.appendChild(o); });
        window.reportLocationsLoaded = true;
    }
}

// Add Event Listeners for Filters
['report-type-filter', 'report-location-filter', 'report-risk-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
        if (reportsLoaded) loadReports();
    });
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', loadDashboard);
