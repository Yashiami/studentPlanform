
let currentChartInstance = null; let chartConfig = { type: 'bar', table: null, groupBy: [], aggregations: [], filters: [] };
function initChartTypeSelection() { const btns = document.querySelectorAll('.chart-type-btn'); btns.forEach(btn => btn.addEventListener('click', () => { btns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); chartConfig.type = btn.dataset.type; })); }

async function populateChartTableSelect() {
    if (!state.tables || state.tables.length === 0) await loadTables();
    const select = document.getElementById('chartTable'); select.innerHTML = '<option value="">Select a table</option>';
    state.tables.forEach(table => { const opt = document.createElement('option'); opt.value = table.name; opt.textContent = `${table.name} (${table.records} records)`; select.appendChild(opt); });
    if (state.tables.length > 0) { select.value = state.tables[0].name; chartConfig.table = state.tables[0].name; select.dispatchEvent(new Event('change', { bubbles: true })); }
}

async function updateChartFields() {
    const tableName = document.getElementById('chartTable').value; if (!tableName) return; chartConfig.table = tableName;
    chartConfig.aggregations = []; chartConfig.filters = []; chartConfig.groupBy = [];
    document.getElementById('aggregationsList').innerHTML = ''; document.getElementById('filtersList').innerHTML = '';
    try {
        const response = await fetch(API.getTableProfile(tableName)); if (!response.ok) throw new Error('Error loading table profile');
        const profile = await response.json(); const columns = profile.columns || [];
        populateFieldSelects(columns, profile.suggested_groupby || [], profile.suggested_metrics || []);
        showToast('success', 'Done', 'Table fields loaded');
    } catch (error) { showToast('error', 'Error', error.message); }
}

function populateFieldSelects(columns, suggestedGroupBy = [], suggestedMetrics = []) {
    const groupBySelect = document.getElementById('groupByField'); groupBySelect.innerHTML = '';
    columns.forEach(col => { const opt = document.createElement('option'); opt.value = col.name; opt.textContent = `${col.name} (${col.type})${suggestedGroupBy.includes(col.name) ? ' ⭐' : ''}`; groupBySelect.appendChild(opt); });
    window.tableColumns = columns; window.suggestedMetrics = suggestedMetrics; window.suggestedGroupBy = suggestedGroupBy;
}

function addAggregation() {
    const container = document.getElementById('aggregationsList'); const index = chartConfig.aggregations.length;
    const aggDiv = document.createElement('div'); aggDiv.className = 'aggregation-item'; aggDiv.dataset.index = index;
    const groupBySelect = document.getElementById('groupByField'); const fieldOptions = Array.from(groupBySelect?.options || []);
    const isNumericCol = (txt) => (txt || '').toUpperCase().match(/INT|FLOAT|NUMERIC|DECIMAL|REAL/) !== null;
    const allColumnOptions = fieldOptions.map(opt => `<option value="${opt.value}" data-numeric="${isNumericCol(opt.text)}">${opt.text}</option>`).join('');
    aggDiv.innerHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;"><select class="form-select agg-field" data-index="${index}"><option value="">Field</option>${allColumnOptions}</select><select class="form-select agg-operation" data-index="${index}"><option value="SUM">Sum</option><option value="AVG">Average</option><option value="COUNT">Count</option><option value="MIN">Minimum</option><option value="MAX">Maximum</option></select><button class="btn-icon" onclick="removeAggregation(${index})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
    container.appendChild(aggDiv); chartConfig.aggregations.push({ field: '', operation: 'SUM' });
    aggDiv.querySelector('.agg-field').addEventListener('change', e => chartConfig.aggregations[index].field = e.target.value);
    const opSelect = aggDiv.querySelector('.agg-operation'); const fieldSelect = aggDiv.querySelector('.agg-field');
    opSelect.addEventListener('change', e => { chartConfig.aggregations[index].operation = e.target.value; const needsNumeric = ['SUM', 'AVG'].includes(e.target.value); Array.from(fieldSelect.options).forEach(opt => { if (!opt.value) return; const isNum = opt.dataset.numeric === 'true'; opt.disabled = needsNumeric && !isNum; opt.style.color = (needsNumeric && !isNum) ? 'var(--color-text-tertiary)' : ''; }); if (fieldSelect.selectedOptions[0]?.disabled) { fieldSelect.value = ''; chartConfig.aggregations[index].field = ''; } });
}
function removeAggregation(index) { const el = document.querySelector(`.aggregation-item[data-index="${index}"]`); if (el) { el.remove(); chartConfig.aggregations.splice(index, 1); } }

function addFilter() {
    const container = document.getElementById('filtersList'); const index = chartConfig.filters.length;
    const filterDiv = document.createElement('div'); filterDiv.className = 'filter-item'; filterDiv.dataset.index = index;
    const _groupBy = document.getElementById('groupByField'); const filterColumnOptions = Array.from(_groupBy?.options || []).map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    filterDiv.innerHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;"><select class="form-select filter-field" data-index="${index}"><option value="">Field</option>${filterColumnOptions}</select><select class="form-select filter-operator" data-index="${index}"><option value="=">=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option><option value="!=">!=</option><option value="LIKE">LIKE</option><option value="IN">IN</option></select><input type="text" class="form-input filter-value" data-index="${index}" placeholder="Value"><button class="btn-icon" onclick="removeFilter(${index})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
    container.appendChild(filterDiv); chartConfig.filters.push({ field: '', operator: '=', value: '' });
    filterDiv.querySelector('.filter-field').addEventListener('change', e => chartConfig.filters[index].field = e.target.value); filterDiv.querySelector('.filter-operator').addEventListener('change', e => chartConfig.filters[index].operator = e.target.value); filterDiv.querySelector('.filter-value').addEventListener('input', e => chartConfig.filters[index].value = e.target.value);
}
function removeFilter(index) { const el = document.querySelector(`.filter-item[data-index="${index}"]`); if (el) { el.remove(); chartConfig.filters.splice(index, 1); } }

async function buildChart() {
    if (!chartConfig.table) { showToast('error', 'Table not selected', 'Please select a table'); return; }
    chartConfig.groupBy = Array.from(document.getElementById('groupByField').selectedOptions).map(o => o.value);
    if (chartConfig.groupBy.length === 0) { showToast('error', 'Grouping', 'Select at least one field for grouping'); return; }
    let validAggs = chartConfig.aggregations.filter(agg => agg.field && agg.operation); if (validAggs.length === 0) validAggs = [{ field: '*', operation: 'COUNT' }]; chartConfig.aggregations = validAggs;
    const payload = { table_name: chartConfig.table, dashboard_configuration: [{ visualization_type: chartConfig.type, group_by: chartConfig.groupBy, aggregations: validAggs, filters: chartConfig.filters.filter(f => f.field && f.operator && f.value) }] };
    try {
        const response = await fetch(API.buildChart, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(await response.text() || 'Error building chart');
        const results = await response.json(); const chartData = results[0]; renderChart(chartData); generateInsights(chartData);
        showToast('success', 'Done!', 'Chart successfully built'); addActivity('chart', `Created chart for table "${chartConfig.table}"`, new Date());
    } catch (error) { showToast('error', 'Error building chart', error.message); }
}

function renderChart(chartData) {
    const ctx = document.getElementById('previewChart'); if (currentChartInstance) currentChartInstance.destroy();
    const data = chartData.data || []; if (data.length === 0) { showToast('warning', 'No data', 'Query returned no rows'); return; }
    const labels = data.map(item => item[chartConfig.groupBy[0]]); const chartType = ['doughnut', 'pie', 'line'].includes(chartConfig.type) ? chartConfig.type : 'bar';
    const datasets = chartConfig.aggregations.map((agg, index) => {
        const fieldName = agg.field === '*' ? `${agg.operation.toLowerCase()}_all` : `${agg.operation.toLowerCase()}_${agg.field}`;
        const label = (agg.operation === 'COUNT' && agg.field === '*') ? 'Count' : `${agg.operation}(${agg.field})`;
        const multiColor = data.length > 2 && ['bar', 'pie', 'doughnut'].includes(chartType);
        return { label, data: data.map(i => parseFloat(i[fieldName] ?? 0)), backgroundColor: multiColor ? data.map((_, i) => getChartColor(i, 0.6)) : getChartColor(index, 0.6), borderColor: multiColor ? data.map((_, i) => getChartColor(i, 1)) : getChartColor(index, 1), borderWidth: 2, tension: chartType === 'line' ? 0.4 : 0 };
    });
    currentChartInstance = new Chart(ctx, { type: chartType, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: function(c) { let l = c.dataset.label ? c.dataset.label + ': ' : ''; const v = c.parsed?.y ?? c.parsed; l += v != null ? parseFloat(v).toFixed(2) : ''; if (data[c.dataIndex]?.share_percent != null) l += ` (${parseFloat(data[c.dataIndex].share_percent).toFixed(1)}%)`; return l; } } } }, scales: !['pie', 'doughnut'].includes(chartType) ? { y: { beginAtZero: true } } : {} } });
    window.currentChartData = chartData;
}
function getChartColor(idx, alpha = 1) { const colors = [`rgba(14, 165, 233, ${alpha})`, `rgba(249, 115, 22, ${alpha})`, `rgba(168, 85, 247, ${alpha})`, `rgba(34, 197, 94, ${alpha})`, `rgba(251, 146, 60, ${alpha})`, `rgba(99, 102, 241, ${alpha})`, `rgba(236, 72, 153, ${alpha})`, `rgba(20, 184, 166, ${alpha})`]; return colors[idx % colors.length]; }

function generateInsights(chartData) {
    const container = document.getElementById('chartInsights'); const data = chartData.data || []; const summary = chartData.summary; const dq = chartData.data_quality;
    if (data.length === 0) { container.innerHTML = '<p>No data</p>'; return; }
    let html = '<h4>Automatic insights</h4>'; (chartData.insights || []).forEach(i => html += `<div class="insight-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>${i}</span></div>`);
    if (summary) { html += `<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--neutral-200);"><h4 style="margin-bottom: 1rem;">Statistics</h4><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;"><div style="padding: 1rem; background: var(--neutral-50); border-radius: 0.5rem;"><span style="font-size: 0.75rem; color: var(--neutral-600);">Total groups</span><p style="font-size: 1.25rem; font-weight: 700; margin: 0.25rem 0 0 0;">${summary.groups_count || data.length}</p></div>${summary.average ? `<div style="padding: 1rem; background: var(--neutral-50); border-radius: 0.5rem;"><span style="font-size: 0.75rem; color: var(--neutral-600);">Average</span><p style="font-size: 1.25rem; font-weight: 700; margin: 0.25rem 0 0 0;">${summary.average.toFixed(2)}</p></div>` : ''}</div></div>`; }
    if (dq) { const color = dq.completeness_percent >= 95 ? 'var(--success)' : dq.completeness_percent >= 70 ? 'var(--warning)' : 'var(--error)'; html += `<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--neutral-200);"><h4 style="margin-bottom: 1rem;">Data quality</h4><div class="insight-item" style="background: var(--neutral-50); padding: 1rem; border-radius: 0.5rem;"><div><span>Data completeness: <strong style="color: ${color}">${dq.completeness_percent.toFixed(1)}%</strong></span><small style="display: block; color: var(--neutral-600); margin-top: 0.25rem;">Used ${dq.rows_used} out of ${dq.total_source_rows} rows${dq.rows_with_nulls_excluded > 0 ? ` (excluded ${dq.rows_with_nulls_excluded} rows with NULL)` : ''}</small></div></div></div>`; }
    container.innerHTML = html;
}

async function saveChart() {
    if (!currentChartInstance || !window.currentChartData) { showToast('error', 'No chart', 'Build chart first'); return; }
    const name = prompt('Enter report name:', `Chart ${chartConfig.table}`); if (!name) return;
    try { const res = await fetch(API.saveReport, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, table_name: chartConfig.table, config: { dashboard_configuration: [{ visualization_type: chartConfig.type, group_by: chartConfig.groupBy, aggregations: chartConfig.aggregations, filters: chartConfig.filters }] }, data: [window.currentChartData] }) }); if (!res.ok) throw new Error('Error saving report'); const r = await res.json(); showToast('success', 'Saved!', `Report "${name}" successfully saved`); addActivity('chart', `Saved report "${name}"`, new Date()); } catch (error) { showToast('error', 'Save error', error.message); }
}

function downloadChart() { if (!currentChartInstance) { showToast('error', 'No chart', 'Build chart first'); return; } const link = document.createElement('a'); link.download = `chart_${chartConfig.table}_${Date.now()}.png`; link.href = currentChartInstance.toBase64Image(); link.click(); showToast('success', 'Downloaded!', 'Chart saved as image'); }
async function exportToDocx() { if (!window.currentChartData) { showToast('error', 'No data', 'Build chart first'); return; } try { showToast('info', 'Export', 'Generating DOCX report...'); const res = await fetch(API.exportReport, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_name: chartConfig.table, dashboard_configuration: [{ visualization_type: chartConfig.type, group_by: chartConfig.groupBy, aggregations: chartConfig.aggregations, filters: chartConfig.filters }] }) }); if (!res.ok) throw new Error('Export error'); const url = URL.createObjectURL(await res.blob()); const link = document.createElement('a'); link.href = url; link.download = `report_${chartConfig.table}_${Date.now()}.docx`; link.click(); URL.revokeObjectURL(url); showToast('success', 'Exported!', 'DOCX report successfully downloaded'); } catch (error) { showToast('error', 'Export error', error.message); } }
