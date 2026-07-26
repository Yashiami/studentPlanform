
async function showHistogram(tableName, columnName) {
    try {
        showToast('info', 'Loading', 'Generating histogram...');
        const payload = {
            dashboard_configuration: [{
                visualization_type: 'bar', group_by: [`${columnName}_bucket`],
                aggregations: [{ field: columnName, operation: 'COUNT' }],
                filters: [], histogram: { field: columnName, bins: 10 }
            }]
        };
        const response = await fetch(API.buildChart, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Error building histogram');
        const result = await response.json();
        renderHistogramModal(result[0], columnName);
    } catch (error) {
        console.error('Histogram error:', error);
        showToast('error', 'Error', error.message);
    }
}

function renderHistogramModal(data, columnName) {
    const content = `
        <div style="margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 0.5rem;">Value distribution: ${columnName}</h4>
            <p style="color: var(--neutral-600); font-size: 0.875rem;">The histogram shows the frequency distribution of values</p>
        </div>
        <div style="height: 300px; margin-bottom: 1.5rem;"><canvas id="histogramChart"></canvas></div>
        ${data.summary ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1rem; background: var(--neutral-50); border-radius: 0.5rem;">
                ${data.summary.average !== undefined ? `<div><span style="font-size: 0.75rem; color: var(--neutral-600);">Average</span><p style="font-weight: 700; margin: 0.25rem 0 0 0; color: var(--neutral-900);">${data.summary.average.toFixed(2)}</p></div>` : ''}
                ${data.summary.std_deviation !== undefined ? `<div><span style="font-size: 0.75rem; color: var(--neutral-600);">Std. deviation</span><p style="font-weight: 700; margin: 0.25rem 0 0 0; color: var(--neutral-900);">${data.summary.std_deviation.toFixed(2)}</p></div>` : ''}
                <div><span style="font-size: 0.75rem; color: var(--neutral-600);">Total values</span><p style="font-weight: 700; margin: 0.25rem 0 0 0; color: var(--neutral-900);">${data.data.reduce((sum, item) => sum + (item.count || 0), 0)}</p></div>
            </div>` : ''}
    `;
    document.getElementById('modalColumnName').textContent = `Histogram`;
    document.getElementById('columnDetailsContent').innerHTML = content;
    openModal('columnDetailsModal');
    setTimeout(() => {
        const ctx = document.getElementById('histogramChart');
        if (ctx) renderHistogramChart(ctx, data);
    }, 100);
}

function renderHistogramChart(ctx, data) {
    const labels = data.data.map(item => {
        const keys = Object.keys(item);
        const bucketKey = keys.find(k => k.includes('bucket') || k.includes('range'));
        return bucketKey ? item[bucketKey] : '';
    });
    const values = data.data.map(item => item.count || 0);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Frequency', data: values, backgroundColor: 'rgba(14, 165, 233, 0.6)', borderColor: 'rgba(14, 165, 233, 1)', borderWidth: 2 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: function(context) { return `Range: ${context[0].label}`; }, label: function(context) { return `Count: ${context.parsed.y}`; } } } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxRotation: 45, minRotation: 45 } } }
        }
    });
}

async function exportTableToCSV(tableName) {
    try {
        showToast('info', 'Export', 'Loading data...');
        const response = await fetch(API.getTablePreview(tableName, 10000));
        if (!response.ok) throw new Error('Error loading data');
        const data = await response.json();
        if (!data || data.length === 0) { showToast('warning', 'No data', 'Table is empty'); return; }
        
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) return `"${stringValue.replace(/"/g, '""')}"`;
                return stringValue;
            }).join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${tableName}_export_${Date.now()}.csv`; link.click();
        URL.revokeObjectURL(url);
        
        showToast('success', 'Exported!', `Table ${tableName} saved as CSV`);
    } catch (error) {
        console.error('CSV export error:', error);
        showToast('error', 'Export error', error.message);
    }
}

class FilterBuilder {
    constructor() { this.filters = []; }
    addFilter(field, operator, value) { this.filters.push({ field, operator, value }); return this; }
    addDateRange(field, startDate, endDate) { this.filters.push({ field, operator: '>=', value: startDate }, { field, operator: '<=', value: endDate }); return this; }
    addInList(field, values) { this.filters.push({ field, operator: 'IN', value: values }); return this; }
    addLike(field, pattern) { this.filters.push({ field, operator: 'LIKE', value: `%${pattern}%` }); return this; }
    clear() { this.filters = []; return this; }
    build() { return this.filters; }
}

class QueryBuilder {
    constructor(tableName) { this.tableName = tableName; this.config = { visualization_type: 'bar', group_by: [], aggregations: [], filters: [] }; }
    groupBy(...fields) { this.config.group_by = fields; return this; }
    aggregate(field, operation) { this.config.aggregations.push({ field, operation }); return this; }
    sum(field) { return this.aggregate(field, 'SUM'); }
    avg(field) { return this.aggregate(field, 'AVG'); }
    count(field) { return this.aggregate(field, 'COUNT'); }
    min(field) { return this.aggregate(field, 'MIN'); }
    max(field) { return this.aggregate(field, 'MAX'); }
    filter(field, operator, value) { this.config.filters.push({ field, operator, value }); return this; }
    where(field, value) { return this.filter(field, '=', value); }
    chartType(type) { this.config.visualization_type = type; return this; }
    build() { return { dashboard_configuration: [this.config] }; }
    async execute() {
        const payload = this.build();
        const response = await fetch(API.buildChart, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(await response.text() || 'Query execution failed');
        return await response.json();
    }
}

async function example1() {
    const query = new QueryBuilder('students_2024').groupBy('faculty').avg('grade').count('student_id').chartType('bar');
    const result = await query.execute(); console.log('Result:', result);
}
async function example2() {
    const query = new QueryBuilder('students_2024').groupBy('course').sum('scholarship').where('faculty', 'Computer Science').filter('age', '>=', 18).chartType('line');
    const result = await query.execute(); console.log('Result:', result);
}
async function example3() {
    const query = new QueryBuilder('students_2024').groupBy('faculty', 'course').avg('grade').max('grade').min('grade').count('student_id').chartType('bar');
    const result = await query.execute(); console.log('Result:', result);
}

async function generateQualityReport(tableName) {
    try {
        showToast('info', 'Generating report', 'Analyzing data quality...');
        const profile = await fetch(API.getTableProfile(tableName)).then(r => r.json());
        const report = {
            table: tableName, timestamp: new Date().toISOString(),
            overview: { total_rows: profile.total_rows, total_columns: profile.columns.length, completeness: calculateCompleteness(profile), duplicates: await checkDuplicatesCount(tableName) },
            columns: profile.columns.map(col => ({ name: col.name, type: col.type, completeness: ((profile.total_rows - col.null_count) / profile.total_rows * 100).toFixed(2), uniqueness: (col.distinct_count / profile.total_rows * 100).toFixed(2), nulls: col.null_count, distinct: col.distinct_count })),
            recommendations: generateRecommendations(profile)
        };
        downloadJSON(report, `quality_report_${tableName}_${Date.now()}.json`);
        showToast('success', 'Report created!', 'Data quality report downloaded');
    } catch (error) {
        console.error('Quality report error:', error); showToast('error', 'Error', error.message);
    }
}

function calculateCompleteness(profile) {
    const totalCells = profile.total_rows * profile.columns.length;
    const nullCells = profile.columns.reduce((sum, col) => sum + col.null_count, 0);
    return ((totalCells - nullCells) / totalCells * 100).toFixed(2);
}

async function checkDuplicatesCount(tableName) {
    try { const response = await fetch(API.getTableDuplicates(tableName)); const result = await response.json(); return result.duplicates_found || 0; } catch { return 0; }
}

function generateRecommendations(profile) {
    const recommendations = [];
    const highNullColumns = profile.columns.filter(col => col.null_count / profile.total_rows > 0.3);
    if (highNullColumns.length > 0) recommendations.push({ type: 'warning', message: `Columns with high NULL count (>30%): ${highNullColumns.map(c => c.name).join(', ')}` });
    const lowCardNumeric = profile.columns.filter(col => (col.type === 'INTEGER' || col.type === 'NUMERIC') && col.distinct_count < 10);
    if (lowCardNumeric.length > 0) recommendations.push({ type: 'info', message: `Numeric fields with low cardinality (possibly categorical): ${lowCardNumeric.map(c => c.name).join(', ')}` });
    const highCardText = profile.columns.filter(col => col.type === 'TEXT' && col.distinct_count / profile.total_rows > 0.9);
    if (highCardText.length > 0) recommendations.push({ type: 'info', message: `Text fields with high uniqueness (possibly IDs): ${highCardText.map(c => c.name).join(', ')}` });
    return recommendations;
}

async function batchDeleteTables(tableNames) {
    const results = { success: [], failed: [] };
    for (const tableName of tableNames) {
        try {
            const response = await fetch(API.deleteTable(tableName), { method: 'DELETE' });
            if (response.ok) results.success.push(tableName); else results.failed.push(tableName);
        } catch (error) { results.failed.push(tableName); }
    }
    showToast(results.failed.length === 0 ? 'success' : 'warning', 'Operation completed', `Deleted: ${results.success.length}, Errors: ${results.failed.length}`);
    await loadTables(); return results;
}

window.FilterBuilder = FilterBuilder; window.QueryBuilder = QueryBuilder; window.showHistogram = showHistogram; window.exportTableToCSV = exportTableToCSV; window.generateQualityReport = generateQualityReport; window.batchDeleteTables = batchDeleteTables;
