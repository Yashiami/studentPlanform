
const state = { currentTable: null, tables: [], currentChart: null, reports: [], activities: [] };
const API_BASE = 'http://localhost:8080';
const API = {
    uploadFile: `${API_BASE}/read`, buildChart: `${API_BASE}/build`, exportReport: `${API_BASE}/export`,
    getTables: `${API_BASE}/tables`, getTableProfile: (name) => `${API_BASE}/tables/${name}/profile`, getTablePreview: (name, limit = 10) => `${API_BASE}/tables/${name}/preview?limit=${limit}`,
    getTableDuplicates: (name) => `${API_BASE}/tables/${name}/duplicates`, deleteTable: (name) => `${API_BASE}/tables/${name}`,
    compareTables: `${API_BASE}/compare`, saveReport: `${API_BASE}/reports`, listReports: `${API_BASE}/reports`, getReport: (id) => `${API_BASE}/reports/${id}`, deleteReport: (id) => `${API_BASE}/reports/${id}`
};

document.addEventListener('DOMContentLoaded', () => { initNavigation(); initFileUpload(); initDragAndDrop(); loadInitialData(); setupEventListeners(); initChartTypeSelection(); });

function loadInitialData() { loadTables(); loadDashboardStats(); loadActivities(); }

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => { item.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.dataset.page); }); });
}

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    loadPageData(page);
}

async function loadPageData(page) {
    switch(page) {
        case 'dashboard': loadDashboardStats(); break;
        case 'tables': loadTables(); break;
        case 'analytics': populateAnalyticsTableSelect(); break;
        case 'charts': await populateChartTableSelect(); break;
        case 'reports': loadReports(); break;
        case 'compare': populateCompareSelects(); break;
    }
}

function initFileUpload() {
    const uploadZone = document.getElementById('uploadZone'); const fileInput = document.getElementById('fileInput'); const uploadBtn = document.getElementById('uploadBtn');
    uploadZone.addEventListener('click', () => fileInput.click()); fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0])); uploadBtn.addEventListener('click', () => uploadFile());
}

function initDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => uploadZone.addEventListener(eName, e => { e.preventDefault(); e.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(eName => uploadZone.addEventListener(eName, () => uploadZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(eName => uploadZone.addEventListener(eName, () => uploadZone.classList.remove('dragover')));
    uploadZone.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files[0]));
}

let selectedFile = null; let _fileInputEl = null;
function _getFileInput() { if (!_fileInputEl) _fileInputEl = document.getElementById('fileInput'); return _fileInputEl; }
function _reattachFileInput(zone) { const input = _getFileInput(); if (input && !zone.contains(input)) zone.appendChild(input); }

function handleFileSelect(file) {
    if (!file) return;
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|json)$/i)) { showToast('error', 'Invalid file format', 'Only CSV, XLSX and JSON files are supported'); return; }
    selectedFile = file;
    let tableName = file.name.replace(/\.(csv|xlsx|json)$/i, '').replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (/^[0-9]/.test(tableName)) tableName = 'table_' + tableName;
    const tableNameInput = document.getElementById('tableName'); if (tableNameInput) tableNameInput.value = tableName;
    const uploadBtn = document.getElementById('uploadBtn'); if (uploadBtn) uploadBtn.disabled = false;
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        uploadZone.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg><h3>${file.name}</h3><p>${formatFileSize(file.size)}</p><button class="btn-secondary btn-small" onclick="resetFileUpload(event)">Select another file</button>`;
        _reattachFileInput(uploadZone);
    }
}

function resetFileUpload(e) {
    if (e) e.stopPropagation(); selectedFile = null;
    const fileInput = document.getElementById('fileInput'); if (fileInput) fileInput.value = '';
    const uploadBtn = document.getElementById('uploadBtn'); if (uploadBtn) uploadBtn.disabled = true;
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        uploadZone.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><h3>Drag and drop file here</h3><p>or click to select</p><div class="supported-formats"><span class="format-badge">CSV</span><span class="format-badge">XLSX</span><span class="format-badge">JSON</span></div>`;
        _reattachFileInput(uploadZone);
    }
}

async function uploadFile() {
    if (!selectedFile) { showToast('error', 'No file selected', 'Please select a file to upload'); return; }
    const tableName = document.getElementById('tableName').value.trim();
    if (!tableName) { showToast('error', 'Table Name', 'Please specify the table name'); return; }
    if (!/^[\p{L}\p{N}_]+$/u.test(tableName)) { showToast('error', 'Invalid name', 'Table name can only contain letters, numbers and underscores'); return; }
    const formData = new FormData(); formData.append('file', selectedFile); formData.append('table_name', tableName);
    const hasHeaders = document.getElementById('hasHeaders').checked; formData.append('has_headers', hasHeaders ? 'true' : 'false');
    showProgress(true);
    try {
        updateProgress(10, 'Uploading file...');
        const response = await fetch(API.uploadFile, { method: 'POST', body: formData, credentials: 'include' });
        updateProgress(50, 'Processing data...');
        if (!response.ok) throw new Error(await extractErrorMessage(response));
        const result = await response.json();
        updateProgress(80, 'Creating table...');
        await new Promise(r => setTimeout(r, 500));
        updateProgress(100, 'Done!');
        showToast('success', 'Success!', `Table "${tableName}" successfully created (${result.rows_imported || 0} rows)`);
        document.cookie = `tableName=${tableName}; path=/; max-age=3600`;
        state.currentTable = tableName;
        addActivity('import', `Imported table "${tableName}" (${result.rows_imported || 0} rows)`, new Date());
        await loadTables();
        setTimeout(() => { showProgress(false); resetFileUpload(); navigateTo('tables'); }, 1000);
    } catch (error) { showToast('error', 'Upload error', error.message, error.message.substring(0, 200)); showProgress(false); }
}

function showProgress(show) { const el = document.getElementById('importProgress'); if (el) { el.style.display = show ? 'block' : 'none'; if (show) updateProgress(0, 'Preparing...'); } }
function updateProgress(percent, status) {
    const pPercent = document.getElementById('progressPercent'); if (pPercent) pPercent.textContent = `${percent}%`;
    const pFill = document.getElementById('progressFill'); if (pFill) pFill.style.width = `${percent}%`;
    const pStatus = document.getElementById('progressStatus'); if (pStatus) pStatus.textContent = status;
}

async function loadTables() {
    try {
        const response = await fetch(API.getTables);
        if (!response.ok) throw new Error(await extractErrorMessage(response));
        const tables = await response.json(); state.tables = tables || []; renderTablesList(state.tables); updateDashboardStats();
    } catch (error) { showToast('error', 'Error loading tables', error.message, error.stack?.substring(0, 150)); state.tables = []; renderTablesList([]); }
}

function renderTablesList(tables) {
    const container = document.getElementById('tablesList');
    if (!tables || tables.length === 0) { container.innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/></svg><p>No tables yet</p></div>`; return; }
    container.innerHTML = tables.map(table => `
        <div class="table-item">
            <div class="table-info"><div class="table-name">${table.name}</div><div class="table-meta"><span>${table.records ? table.records.toLocaleString() : 0} records</span><span>${table.columns || 0} columns</span><span>${table.size || 'N/A'}</span><span>${table.created || 'N/A'}</span></div></div>
            <div class="table-actions">
                <button class="btn-icon" onclick="viewTableData('${table.name}')" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                <button class="btn-icon" onclick="deleteTable('${table.name}')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
        </div>`).join('');
}

async function viewTableData(tableName) {
    try {
        const response = await fetch(API.getTablePreview(tableName, 20));
        if (!response.ok) throw new Error('Error loading data');
        const data = await response.json();
        const content = `
            <div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;"><thead><tr style="background: var(--neutral-100);">${Object.keys(data[0] || {}).map(key => `<th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--neutral-300);">${key}</th>`).join('')}</tr></thead><tbody>${data.map(row => `<tr style="border-bottom: 1px solid var(--neutral-200);">${Object.values(row).map(val => `<td style="padding: 0.75rem;">${val !== null ? val : '<span style="color: var(--neutral-400);">NULL</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
            <p style="margin-top: 1rem; color: var(--neutral-600); font-size: 0.875rem;">Showing first ${data.length} rows</p>`;
        document.getElementById('modalColumnName').textContent = `Preview: ${tableName}`; document.getElementById('columnDetailsContent').innerHTML = content; openModal('columnDetailsModal');
    } catch (error) { showToast('error', 'Error', error.message); }
}

async function deleteTable(tableName) {
    if (!confirm(`Are you sure you want to delete table "${tableName}"?\n\nThis action is irreversible!`)) return;
    try {
        const response = await fetch(API.deleteTable(tableName), { method: 'DELETE' });
        if (!response.ok) throw new Error(await response.text() || 'Deletion error');
        state.tables = state.tables.filter(t => t.name !== tableName); renderTablesList(state.tables);
        if (state.currentTable === tableName) { state.currentTable = null; document.cookie = 'tableName=; path=/; max-age=0'; }
        showToast('success', 'Table deleted', `Table "${tableName}" successfully deleted`); updateDashboardStats(); addActivity('delete', `Deleted table "${tableName}"`, new Date());
    } catch (error) { showToast('error', 'Deletion error', error.message); }
}

async function refreshTables() { showToast('info', 'Refresh', 'Refreshing tables list...'); await loadTables(); }

function loadDashboardStats() { updateDashboardStats(); }
function updateDashboardStats() {
    const totalTables = state.tables.length; const totalRecords = state.tables.reduce((sum, t) => sum + (t.records || 0), 0); const totalReports = state.reports.length; const lastImport = state.tables.length > 0 ? state.tables[0].created : '—';
    if (document.getElementById('totalTables')) document.getElementById('totalTables').textContent = totalTables;
    if (document.getElementById('totalRecords')) document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();
    if (document.getElementById('totalReports')) document.getElementById('totalReports').textContent = totalReports;
    if (document.getElementById('lastImport')) document.getElementById('lastImport').textContent = lastImport;
}

function loadActivities() {
    const container = document.getElementById('activityList');
    if (!state.activities || state.activities.length === 0) { container.innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No activity yet</p></div>`; return; }
    container.innerHTML = state.activities.map(activity => `<div class="activity-item"><div class="activity-icon ${activity.type}">${getActivityIcon(activity.type)}</div><div class="activity-content"><p>${activity.description}</p><small>${formatDate(activity.date)}</small></div></div>`).join('');
}
function addActivity(type, description, date) { state.activities.unshift({ type, description, date }); if (state.activities.length > 10) state.activities = state.activities.slice(0, 10); loadActivities(); }
function getActivityIcon(type) {
    const icons = { import: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', chart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>', delete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' };
    return icons[type] || icons.import;
}

async function loadReports() { try { const response = await fetch(API.listReports); if (!response.ok) throw new Error('Error loading reports'); state.reports = await response.json() || []; renderReports(state.reports); } catch (error) { state.reports = []; renderReports([]); } }
function renderReports(reports) {
    const container = document.getElementById('reportsGrid');
    if (!reports || reports.length === 0) { container.innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No reports yet</p></div>`; return; }
    container.innerHTML = reports.map(report => `<div class="report-card" onclick="openReport(${report.id})"><div class="report-thumbnail"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></div><h4>${report.name}</h4><div class="report-meta"><span>${report.table_name}</span><span>${new Date(report.created_at).toLocaleDateString('en-US')}</span></div><div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button class="btn-secondary btn-small" onclick="event.stopPropagation(); deleteReportById(${report.id})" style="flex: 1;">Delete</button></div></div>`).join('');
}
async function deleteReportById(reportId) { if (!confirm('Are you sure you want to delete this report?')) return; try { const response = await fetch(API.deleteReport(reportId), { method: 'DELETE' }); if (!response.ok) throw new Error('Error deleting report'); showToast('success', 'Report deleted', 'Report successfully deleted'); await loadReports(); } catch (error) { showToast('error', 'Error', error.message); } }

function formatFileSize(bytes) { if (bytes === 0) return '0 Bytes'; const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k)); return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]; }
function formatDate(date) { if (typeof date === 'string') return date; const diff = new Date() - date, seconds = Math.floor(diff / 1000), minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24); if (days > 0) return `${days} days ago`; if (hours > 0) return `${hours} hours ago`; if (minutes > 0) return `${minutes} minutes ago`; return 'Just now'; }

function showToast(type, title, message, details = null) {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`;
    const icons = { success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>', error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' };
    let detailsHTML = details && type === 'error' ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem; opacity: 0.9; max-height: 100px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; font-family: monospace; word-break: break-word;">${details}</div>` : '';
    toast.innerHTML = `<div class="toast-icon">${icons[type]}</div><div class="toast-content"><p>${title}</p><small>${message}</small>${detailsHTML}</div>`;
    container.appendChild(toast); setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, type === 'error' ? 3000 : 1000);
}
async function extractErrorMessage(response) { try { const text = await response.text(); try { const json = JSON.parse(text); if (json.error) return json.error; if (json.message) return json.message; return JSON.stringify(json).substring(0, 200); } catch { return text.replace(/<[^>]*>/g, '').substring(0, 300); } } catch { return 'Unknown server error'; } }

function openModal(modalId) { document.getElementById('modal-overlay').classList.add('active'); document.getElementById(modalId).classList.add('active'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function setupEventListeners() { document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }); }

function filterReports(type, event) { document.querySelectorAll('.header-actions .btn-secondary').forEach(b => b.classList.remove('active-filter')); if (event && event.target) event.target.classList.add('active-filter'); renderReports(type === 'all' ? state.reports : state.reports.filter(r => r.type === type)); }
function openImportModal() { navigateTo('import'); }

async function openReport(reportId) {
    try {
        const response = await fetch(API.getReport(reportId)); if (!response.ok) throw new Error('Error loading report');
        const report = await response.json(); navigateTo('charts');
        if (report.table_name) { state.currentTable = report.table_name; setCookie('tableName', report.table_name); document.getElementById('chartTable').value = report.table_name; await updateChartFields(); }
        if (report.config?.dashboard_configuration?.[0]) {
            const cfg = report.config.dashboard_configuration[0]; chartConfig.type = cfg.visualization_type || 'bar';
            document.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === chartConfig.type));
            const groupBySelect = document.getElementById('groupByField'); Array.from(groupBySelect.options).forEach(opt => opt.selected = cfg.group_by?.includes(opt.value) ?? false);
            document.getElementById('aggregationsList').innerHTML = ''; chartConfig.aggregations = [];
            cfg.aggregations?.forEach(agg => { addAggregation(); const idx = chartConfig.aggregations.length - 1; const fieldEl = document.querySelector(`.agg-field[data-index="${idx}"]`); const opEl = document.querySelector(`.agg-operation[data-index="${idx}"]`); if (fieldEl) fieldEl.value = agg.field; if (opEl) opEl.value = agg.operation; chartConfig.aggregations[idx] = { field: agg.field, operation: agg.operation }; });
            document.getElementById('filtersList').innerHTML = ''; chartConfig.filters = [];
            cfg.filters?.forEach(filter => { addFilter(); const idx = chartConfig.filters.length - 1; const fieldEl = document.querySelector(`.filter-field[data-index="${idx}"]`); const opEl = document.querySelector(`.filter-operator[data-index="${idx}"]`); const valEl = document.querySelector(`.filter-value[data-index="${idx}"]`); if (fieldEl) fieldEl.value = filter.field; if (opEl) opEl.value = filter.operator; if (valEl) valEl.value = filter.value; chartConfig.filters[idx] = { ...filter }; });
        }
        showToast('success', 'Report loaded', `Opened report "${report.name}"`);
    } catch (error) { showToast('error', 'Error', error.message); }
}
