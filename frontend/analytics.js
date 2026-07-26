
let currentTableAnalytics = null;
function populateAnalyticsTableSelect() {
    const select = document.getElementById('analyticsTable');
    select.innerHTML = '<option value="">Select table</option>';
    state.tables.forEach(table => {
        const option = document.createElement('option'); option.value = table.name;
        option.textContent = `${table.name} (${table.records} records)`;
        select.appendChild(option);
    });
}

async function loadTableAnalytics(tableName) {
    if (!tableName) {
        document.getElementById('analyticsContent').innerHTML = `
            <div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg><p>Select a table to view analytics</p></div>`;
        return;
    }
    try {
        showToast('info', 'Data analysis', 'Processing statistics...');
        const response = await fetch(API.getTableProfile(tableName));
        if (!response.ok) throw new Error(await response.text() || 'Error loading profile');
        const profile = await response.json(); currentTableAnalytics = profile;
        renderAnalytics(profile);
        showToast('success', 'Done!', 'Analytics loaded');
    } catch (error) {
        console.error('Analytics error:', error); showToast('error', 'Analytics error', error.message);
        document.getElementById('analyticsContent').innerHTML = `<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><p>Error loading analytics</p><p style="font-size: 0.875rem; color: var(--neutral-500);">${error.message}</p></div>`;
    }
}

function renderAnalytics(profile) {
    const container = document.getElementById('analyticsContent');
    const avgCompleteness = profile.columns.reduce((sum, col) => sum + (((profile.total_rows - col.null_count) / profile.total_rows) * 100), 0) / profile.columns.length;
    const overallQuality = { score: avgCompleteness, grade: avgCompleteness >= 95 ? 'excellent' : avgCompleteness >= 85 ? 'good' : avgCompleteness >= 70 ? 'fair' : 'poor', color: avgCompleteness >= 95 ? '#10b981' : avgCompleteness >= 85 ? '#3b82f6' : avgCompleteness >= 70 ? '#f59e0b' : '#ef4444' };

    container.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 1rem; margin-bottom: 2rem; border: 1px solid var(--neutral-200); box-shadow: var(--shadow-md);">
            <h3 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 1.5rem;">Overall rating: <strong>${profile.table_name}</strong></h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div class="stat-card" style="box-shadow: none; border: 2px solid var(--neutral-200);"><div class="stat-content"><p class="stat-label">Data completeness</p><p class="stat-value" style="color: ${overallQuality.color}">${overallQuality.score.toFixed(1)}%</p></div></div>
                <div class="stat-card" style="box-shadow: none; border: 2px solid var(--neutral-200);"><div class="stat-content"><p class="stat-label">Grade</p><p class="stat-value" style="font-size: 1.5rem; text-transform: uppercase;">${overallQuality.grade}</p></div></div>
                <div class="stat-card" style="box-shadow: none; border: 2px solid var(--neutral-200);"><div class="stat-content"><p class="stat-label">Total columns</p><p class="stat-value">${profile.columns.length}</p></div></div>
                <div class="stat-card" style="box-shadow: none; border: 2px solid var(--neutral-200);"><div class="stat-content"><p class="stat-label">Total records</p><p class="stat-value">${(profile.total_rows || 0).toLocaleString()}</p></div></div>
            </div>
        </div>
        ${(profile.suggested_groupby?.length > 0 || profile.suggested_metrics?.length > 0) ? `
            <div style="background: white; padding: 2rem; border-radius: 1rem; margin-bottom: 2rem; border: 1px solid var(--neutral-200); box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 1rem;">Analytics recommendations</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                    ${profile.suggested_groupby?.length > 0 ? `
                        <div style="padding: 1rem; background: linear-gradient(135deg, var(--primary-50) 0%, var(--neutral-50) 100%); border-radius: 0.75rem; border: 1px solid var(--primary-200);">
                            <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--neutral-900); margin-bottom: 0.75rem;">⭐ Recommended for grouping</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${profile.suggested_groupby.map(field => `<span style="padding: 0.25rem 0.75rem; background: var(--primary-100); color: var(--primary-700); border-radius: 0.375rem; font-size: 0.8125rem; font-family: var(--font-mono);">${field}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    ${profile.suggested_metrics?.length > 0 ? `
                        <div style="padding: 1rem; background: linear-gradient(135deg, var(--accent-50) 0%, var(--neutral-50) 100%); border-radius: 0.75rem; border: 1px solid var(--accent-200);">
                            <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--neutral-900); margin-bottom: 0.75rem;">📊 Recommended for aggregation</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${profile.suggested_metrics.map(field => `<span style="padding: 0.25rem 0.75rem; background: var(--accent-100); color: var(--accent-700); border-radius: 0.375rem; font-size: 0.8125rem; font-family: var(--font-mono);">${field}</span>`).join('')}
                            </div>
                        </div>` : ''}
                </div>
            </div>` : ''}
        <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--neutral-200); box-shadow: var(--shadow-md);">
            <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 1.5rem;">Column statistics</h3>
            <div style="display: grid; gap: 1.5rem;">${profile.columns.map(col => renderColumnCard(col, profile.total_rows)).join('')}</div>
        </div>`;
}

function renderColumnCard(column, totalRows) {
    const isNumeric = column.type === 'INTEGER' || column.type === 'NUMERIC' || column.type === 'BIGINT';
    const completeness = ((totalRows - column.null_count) / totalRows) * 100;
    const uniqueness = (column.unique_values / totalRows) * 100;
    return `
        <div style="border: 1px solid var(--neutral-200); border-radius: 0.75rem; padding: 1.5rem; transition: all 0.2s; min-width: 0; overflow: hidden; box-sizing: border-box;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h4 style="font-family: var(--font-mono); font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem;">${column.name}</h4>
                    <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--primary-100); color: var(--primary-700); border-radius: 0.25rem; font-family: var(--font-mono);">${column.type}</span>
                </div>
                <button class="btn-icon" onclick="showColumnDetails('${column.name}')" title="Details">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                <div>
                    <span style="font-size: 0.75rem; color: var(--neutral-600);">Completeness</span>
                    <div style="margin-top: 0.25rem;">
                        <div style="height: 4px; background: var(--neutral-200); border-radius: 2px; overflow: hidden;"><div style="height: 100%; width: ${Math.min(completeness, 100).toFixed(1)}%; background: linear-gradient(90deg, var(--success) 0%, var(--primary-500) 100%);"></div></div>
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--neutral-700);">${completeness.toFixed(1)}%</span>
                    </div>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--neutral-600);">Uniqueness</span>
                    <div style="margin-top: 0.25rem;">
                        <div style="height: 4px; background: var(--neutral-200); border-radius: 2px; overflow: hidden;"><div style="height: 100%; width: ${Math.min(uniqueness, 100).toFixed(1)}%; background: linear-gradient(90deg, var(--primary-500) 0%, var(--accent-500) 100%);"></div></div>
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--neutral-700);">${uniqueness.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            <div style="width: 100%; box-sizing: border-box; padding: 1rem; background: var(--neutral-50); border-radius: 0.5rem; overflow: hidden;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: ${isNumeric && column.min !== undefined ? '0.75rem' : '0'};">
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">Records</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${totalRows.toLocaleString()}</p></div>
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">Unique</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(column.unique_values || 0).toLocaleString()}</p></div>
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">NULL</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900);">${column.null_count}</p></div>
                </div>
                ${isNumeric && column.min !== undefined ? `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--neutral-200);">
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">Minimum</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${parseFloat(column.min).toFixed(2)}</p></div>
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">Maximum</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${parseFloat(column.max).toFixed(2)}</p></div>
                    <div style="min-width: 0;"><span style="font-size: 0.75rem; color: var(--neutral-600); display: block;">Average</span><p style="font-weight: 600; margin: 0; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${column.avg !== undefined ? parseFloat(column.avg).toFixed(2) : '—'}</p></div>
                </div>` : ''}
            </div>
            ${column.top_values && column.top_values.length > 0 ? `
                <div style="margin-top: 1rem;">
                    <span style="font-size: 0.75rem; color: var(--neutral-600); display: block; margin-bottom: 0.5rem;">Most frequent values</span>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        ${column.top_values.slice(0, 5).map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 0.25rem; font-size: 0.875rem; border: 1px solid var(--neutral-200);">
                                <span style="color: var(--neutral-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${item.value !== null ? item.value : '<i>NULL</i>'}</span>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;"><span style="font-weight: 600; color: var(--primary-600);">${item.count}</span>${item.percentage ? `<span style="font-size: 0.75rem; color: var(--neutral-500);">(${item.percentage.toFixed(1)}%)</span>` : ''}</div>
                            </div>`).join('')}
                    </div>
                </div>` : ''}
        </div>`;
}

function showColumnDetails(columnName) {
    if (!currentTableAnalytics) return;
    const column = currentTableAnalytics.columns.find(c => c.name === columnName);
    if (!column) return;
    const totalRows = currentTableAnalytics.total_rows;
    const completeness = ((totalRows - column.null_count) / totalRows) * 100;
    const uniqueness = (column.unique_values / totalRows) * 100;
    const isNumeric = ['INTEGER','BIGINT','NUMERIC'].includes(column.type);
    document.getElementById('modalColumnName').textContent = columnName;
    document.getElementById('columnDetailsContent').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:1.5rem;">
            <div><h4 style="font-size:0.875rem;color:var(--neutral-600);margin-bottom:0.5rem;">Data type</h4><span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;padding:0.375rem 0.75rem;background:var(--primary-100);color:var(--primary-700);border-radius:0.375rem;">${column.type}</span></div>
            <div><h4 style="font-size:0.875rem;color:var(--neutral-600);margin-bottom:1rem;">Quality metrics</h4>${renderQualityMetric('Completeness', completeness, 'Percentage of non-empty values')}${renderQualityMetric('Uniqueness', uniqueness, 'Percentage of unique values')}</div>
            <div><h4 style="font-size:0.875rem;color:var(--neutral-600);margin-bottom:1rem;">Statistics</h4>
                <div style="background:var(--neutral-50);padding:1rem;border-radius:0.5rem;">
                    <table style="width:100%;font-size:0.875rem;border-collapse:collapse;">
                        ${[['Total values', (totalRows || 0).toLocaleString()],['Unique', (column.unique_values || 0).toLocaleString()],['NULL values', column.null_count],...(isNumeric && column.min !== undefined ? [['Minimum', parseFloat(column.min).toFixed(2)],['Maximum', parseFloat(column.max).toFixed(2)],['Average', column.avg !== undefined ? parseFloat(column.avg).toFixed(2) : '—']] : [])].map(([l,v])=>`<tr style="border-bottom:1px solid var(--neutral-200);"><td style="padding:0.5rem 0;color:var(--neutral-600);">${l}</td><td style="padding:0.5rem 0;font-weight:600;text-align:right;">${v}</td></tr>`).join('')}
                    </table>
                </div>
            </div>
            ${column.top_values && column.top_values.length > 0 ? `<div><h4 style="font-size:0.875rem;color:var(--neutral-600);margin-bottom:0.75rem;">Most frequent values</h4><div style="display:flex;flex-direction:column;gap:0.375rem;">${column.top_values.slice(0,7).map(item=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;background:white;border-radius:0.375rem;border:1px solid var(--neutral-200);font-size:0.875rem;"><span style="color:var(--neutral-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${item.value !== null ? item.value : '<i style="color:var(--neutral-400)">NULL</i>'}</span><div style="display:flex;align-items:center;gap:0.5rem;margin-left:1rem;flex-shrink:0;"><span style="font-weight:600;color:var(--primary-600);">${item.count}</span>${item.percentage !== undefined ? `<span style="font-size:0.75rem;color:var(--neutral-500);">${parseFloat(item.percentage).toFixed(1)}%</span>` : ''}</div></div>`).join('')}</div></div>` : ''}
            <div><h4 style="font-size:0.875rem;color:var(--neutral-600);margin-bottom:0.75rem;">Recommendations</h4><div style="background:linear-gradient(135deg,var(--primary-50) 0%,var(--neutral-50) 100%);padding:1rem;border-radius:0.5rem;border:1px solid var(--primary-200);">${generateColumnRecs(column, totalRows, completeness, uniqueness).map(rec=>`<div style="display:flex;align-items:start;gap:0.5rem;margin-bottom:0.5rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" stroke-width="2.5" style="flex-shrink:0;margin-top:3px;"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p style="margin:0;font-size:0.875rem;color:var(--neutral-700);">${rec}</p></div>`).join('')}</div></div>
        </div>`;
    openModal('columnDetailsModal');
}

function generateColumnRecs(column, totalRows, completeness, uniqueness) {
    const isNumeric = ['INTEGER','BIGINT','NUMERIC'].includes(column.type); const recs = [];
    if (completeness < 100) recs.push(`Consider filling ${column.null_count} missing values`);
    if (uniqueness === 100) recs.push('Field is unique — can be used as identifier');
    if (!isNumeric && uniqueness < 15) recs.push('Low uniqueness — ideal for GROUP BY and filtering');
    if (isNumeric) recs.push('Numeric field — suitable for SUM, AVG, MIN, MAX aggregations');
    if (recs.length === 0) recs.push('Data quality is excellent, no additional actions required');
    return recs;
}

function renderQualityMetric(label, value, description) {
    let color = 'var(--success)'; if (value < 95) color = 'var(--info)'; if (value < 85) color = 'var(--warning)'; if (value < 70) color = 'var(--error)';
    return `<div><div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span style="font-size: 0.875rem; color: var(--neutral-700);">${label}</span><span style="font-weight: 600; color: ${color};">${value.toFixed(1)}%</span></div><div style="height: 8px; background: var(--neutral-200); border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${value.toFixed(1)}%; background: ${color}; transition: width 0.3s;"></div></div><p style="font-size: 0.75rem; color: var(--neutral-600); margin-top: 0.25rem; margin-bottom: 0;">${description}</p></div>`;
}

function populateCompareSelects() {
    ['compareTableA', 'compareTableB'].forEach(id => {
        const select = document.getElementById(id); const current = select.value; select.innerHTML = '<option value="">Select table</option>';
        state.tables.forEach(table => { const option = document.createElement('option'); option.value = table.name; option.textContent = `${table.name} (${(table.records || 0).toLocaleString()} records)`; select.appendChild(option); });
        select.value = current;
    });
}

async function onCompareTableChange() {
    const tableA = document.getElementById('compareTableA').value; const tableB = document.getElementById('compareTableB').value; const optionsEl = document.getElementById('compareOptions');
    if (!tableA || !tableB || tableA === tableB) { optionsEl.style.display = 'none'; return; }
    try {
        const [profileA, profileB] = await Promise.all([ fetch(API.getTableProfile(tableA)).then(r => r.json()), fetch(API.getTableProfile(tableB)).then(r => r.json()) ]);
        const colsA = new Set((profileA.columns || []).map(c => c.name)); const colsB = new Set((profileB.columns || []).map(c => c.name));
        const common = [...colsA].filter(c => colsB.has(c)); const allCols = [...new Set([...(profileA.columns || []).map(c => c.name), ...(profileB.columns || []).map(c => c.name)])];
        
        const groupBySelect = document.getElementById('compareGroupBy'); const prevGroupBy = groupBySelect.value; groupBySelect.innerHTML = '<option value="">Select field</option>';
        common.forEach(col => { const opt = document.createElement('option'); opt.value = col; opt.textContent = col; groupBySelect.appendChild(opt); });
        if (common.includes(prevGroupBy)) groupBySelect.value = prevGroupBy;
        
        const fieldSelect = document.getElementById('compareField'); const prevField = fieldSelect.value; fieldSelect.innerHTML = '<option value="*">* (for COUNT)</option>';
        allCols.forEach(col => { const opt = document.createElement('option'); opt.value = col; opt.textContent = col; fieldSelect.appendChild(opt); });
        if (prevField && prevField !== '*') fieldSelect.value = prevField;
        
        optionsEl.style.display = 'block';
    } catch (error) { optionsEl.style.display = 'none'; }
}

async function runComparison() {
    const tableA = document.getElementById('compareTableA').value; const tableB = document.getElementById('compareTableB').value;
    const groupBy = document.getElementById('compareGroupBy')?.value; const operation = document.getElementById('compareOperation')?.value || 'COUNT'; const field = document.getElementById('compareField')?.value || '*';
    if (!tableA || !tableB) { showToast('error', 'Select tables', 'Please select both tables'); return; }
    if (tableA === tableB) { showToast('error', 'Same tables', 'Select different tables for comparison'); return; }
    if (!groupBy) { showToast('error', 'Select field', 'Specify field for grouping (group_by)'); return; }
    
    const resultsContainer = document.getElementById('comparisonResults');
    resultsContainer.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Comparing tables...</p></div>`;
    try {
        const response = await fetch(API.compareTables, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_a: tableA, table_b: tableB, group_by: groupBy, operation, field }) });
        if (!response.ok) throw new Error(await response.text() || 'Comparison error');
        const comparison = await response.json(); renderComparison(comparison, tableA, tableB, groupBy, operation);
        showToast('success', 'Done!', 'Comparison completed');
    } catch (error) { showToast('error', 'Comparison error', error.message); resultsContainer.innerHTML = `<div class="empty-state"><p style="color: var(--error);">Error: ${error.message}</p></div>`; }
}

function renderComparison(comparison, tableA, tableB, groupBy, operation) {
    const container = document.getElementById('comparisonResults');
    const rows = (comparison.data || []).sort((a, b) => Math.abs(b.delta_percent) - Math.abs(a.delta_percent));
    if (rows.length === 0) { container.innerHTML = '<div class="empty-state"><p>No common data to compare</p></div>'; return; }
    const opLabel = operation === 'COUNT' ? 'Count' : operation;
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--neutral-200); box-shadow: var(--shadow-md);">
            <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 1.5rem;">Comparison by field <code style="background: var(--primary-100); color: var(--primary-700); padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.9em;">${groupBy}</code></h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                    <thead><tr style="background: var(--neutral-50); border-bottom: 2px solid var(--neutral-200);"><th style="padding: 0.75rem 1rem; text-align: left; color: var(--neutral-700);">${groupBy}</th><th style="padding: 0.75rem 1rem; text-align: right; color: var(--primary-700);">${tableA}</th><th style="padding: 0.75rem 1rem; text-align: right; color: var(--primary-600);">${tableB}</th><th style="padding: 0.75rem 1rem; text-align: right;">Δ</th><th style="padding: 0.75rem 1rem; text-align: right;">Δ%</th></tr></thead>
                    <tbody>${rows.map(row => { const color = row.delta > 0 ? '#10b981' : row.delta < 0 ? '#ef4444' : '#94a3b8'; const sign = row.delta > 0 ? '+' : ''; return `<tr style="border-bottom: 1px solid var(--neutral-100);"><td style="padding: 0.75rem 1rem; font-weight: 500;">${row.group || '—'}</td><td style="padding: 0.75rem 1rem; text-align: right; font-family: var(--font-mono);">${row.value_a?.toLocaleString() ?? '—'}</td><td style="padding: 0.75rem 1rem; text-align: right; font-family: var(--font-mono);">${row.value_b?.toLocaleString() ?? '—'}</td><td style="padding: 0.75rem 1rem; text-align: right; font-family: var(--font-mono); color: ${color}; font-weight: 600;">${sign}${row.delta?.toLocaleString() ?? '—'}</td><td style="padding: 0.75rem 1rem; text-align: right; font-family: var(--font-mono); color: ${color}; font-weight: 600;">${row.delta_percent != null ? sign + row.delta_percent.toFixed(1) + '%' : '—'}</td></tr>`; }).join('')}</tbody>
                </table>
            </div>
            <p style="margin-top: 1rem; font-size: 0.8125rem; color: var(--neutral-500);">${rows.length} groups · ${opLabel} · <span style="color:#10b981">▲ increase</span> · <span style="color:#ef4444">▼ decrease</span></p>
        </div>`;
}
