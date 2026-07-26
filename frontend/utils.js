
function getCookie(name) { const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`); if (parts.length === 2) return parts.pop().split(';').shift(); return null; }
function setCookie(name, value, days = 1) { const expires = new Date(Date.now() + days * 864e5).toUTCString(); document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`; }
function deleteCookie(name) { document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`; }
function initCurrentTableFromCookie() { const tableName = getCookie('tableName'); if (tableName) state.currentTable = tableName; }

async function checkDuplicates(tableName) {
    try {
        showToast('info', 'Checking duplicates', 'Analyzing table...');
        const response = await fetch(API.getTableDuplicates(tableName));
        if (!response.ok) throw new Error(await response.text() || 'Error checking duplicates');
        const result = await response.json();
        if (result.duplicates_found === 0) showToast('success', 'No duplicates', 'Table contains no full duplicates');
        else showDuplicatesModal(result, tableName);
    } catch (error) { showToast('error', 'Error', error.message); }
}

function showDuplicatesModal(result, tableName) {
    const content = `
        <div style="margin-bottom: 1.5rem;"><h4 style="color: var(--warning); margin-bottom: 0.5rem;">Found ${result.duplicates_found} duplicates</h4><p style="color: var(--neutral-600); font-size: 0.875rem;">These rows are completely identical across all fields</p></div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${result.duplicate_groups?.map((group, idx) => `<div style="margin-bottom: 1rem; padding: 1rem; background: var(--neutral-50); border-radius: 0.5rem; border-left: 3px solid var(--warning);"><h5 style="font-size: 0.875rem; margin-bottom: 0.5rem;">Group ${idx + 1} (${group.count} copies)</h5><div style="font-size: 0.8125rem; font-family: var(--font-mono);">${Object.entries(group.sample).map(([key, val]) => `<div style="padding: 0.25rem 0;"><strong>${key}:</strong> ${val !== null ? val : '<i>NULL</i>'}</div>`).join('')}</div></div>`).join('') || ''}
        </div>
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--neutral-200);"><p style="font-size: 0.875rem; color: var(--neutral-600);">Recommended to delete duplicates to improve analytics quality</p></div>
    `;
    document.getElementById('modalColumnName').textContent = `Duplicates in table: ${tableName}`; document.getElementById('columnDetailsContent').innerHTML = content; openModal('columnDetailsModal');
}

function formatNumber(num, decimals = 2) { if (num == null) return '—'; return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
function debounce(func, wait) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; }
async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); showToast('success', 'Copied!', 'Text copied to clipboard'); } catch (error) { showToast('error', 'Error', 'Failed to copy'); } }
function downloadJSON(data, filename) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); showToast('success', 'Downloaded!', `File ${filename} saved`); }

function showTableActionsMenu(tableName, event) {
    event.stopPropagation(); let menu = document.getElementById('table-actions-menu');
    if (!menu) { menu = document.createElement('div'); menu.id = 'table-actions-menu'; menu.style.cssText = `position: fixed; background: white; border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); padding: 0.5rem; z-index: 1000; min-width: 200px;`; document.body.appendChild(menu); }
    menu.innerHTML = `<div class="menu-item" onclick="viewTableData('${tableName}'); closeTableMenu()"><span>View data</span></div><div class="menu-item" onclick="checkDuplicates('${tableName}'); closeTableMenu()"><span>Check duplicates</span></div><div style="height: 1px; background: var(--neutral-200); margin: 0.5rem 0;"></div><div class="menu-item danger" onclick="deleteTable('${tableName}'); closeTableMenu()"><span>Delete</span></div>`;
    const rect = event.target.getBoundingClientRect(); menu.style.top = `${rect.bottom + 5}px`; menu.style.left = `${rect.left}px`; menu.style.display = 'block'; setTimeout(() => document.addEventListener('click', closeTableMenu, { once: true }), 0);
}
function closeTableMenu() { const menu = document.getElementById('table-actions-menu'); if (menu) menu.style.display = 'none'; }

function initKeyboardShortcuts() { document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); showToast('info', 'Search', 'Feature in development'); } if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); navigateTo('import'); } if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); navigateTo('charts'); } if (e.key === 'Escape') { closeModal(); closeTableMenu(); } }); }
let autoRefreshInterval = null; function startAutoRefresh(intervalSeconds = 30) { if (autoRefreshInterval) clearInterval(autoRefreshInterval); autoRefreshInterval = setInterval(() => { const page = document.querySelector('.page.active').id; if (page === 'page-tables') loadTables(); else if (page === 'page-dashboard') loadDashboardStats(); }, intervalSeconds * 1000); }
function stopAutoRefresh() { if (autoRefreshInterval) { clearInterval(autoRefreshInterval); autoRefreshInterval = null; } }

window.addEventListener('error', (e) => showToast('error', 'Application error', e.message || 'An unexpected error occurred', e.error?.stack?.substring(0, 150)));
window.addEventListener('unhandledrejection', (e) => { showToast('error', 'Processing error', e.reason?.message || String(e.reason), e.reason?.stack?.substring(0, 150)); e.preventDefault(); });
document.addEventListener('DOMContentLoaded', () => { initCurrentTableFromCookie(); initKeyboardShortcuts(); });
