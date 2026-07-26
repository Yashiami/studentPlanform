const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, Footer, PageBreak
} = require("docx");
const fs = require("fs");

const dataPath = process.argv[2];
const outPath  = process.argv[3];

if (!dataPath || !outPath) {
  console.error("Usage: node generate_report.js <data.json> <out.docx>");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const { table_name, generated, charts } = payload;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const PAGE_W = 9026; // A4 content width in DXA (A4 - 2×1" margins)

function heading(text, level) {
  return new Paragraph({ heading: level, children: [new TextRun(text)] });
}

function para(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })] });
}

function hrPara() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } },
    children: [],
  });
}

function makeTableFromData(data, keys) {
  if (!data || data.length === 0) return para("(no data)");

  const colW = Math.floor(PAGE_W / keys.length);

  const headerRow = new TableRow({
    children: keys.map(k =>
      new TableCell({
        borders, margins: cellMargins,
        width: { size: colW, type: WidthType.DXA },
        shading: { fill: "2E5FA3", type: ShadingType.CLEAR },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: String(k), bold: true, color: "FFFFFF", size: 20 })]
        })]
      })
    )
  });

  const dataRows = data.map((row, idx) =>
    new TableRow({
      children: keys.map(k =>
        new TableCell({
          borders, margins: cellMargins,
          width: { size: colW, type: WidthType.DXA },
          shading: { fill: idx % 2 === 0 ? "F5F7FA" : "FFFFFF", type: ShadingType.CLEAR },
          children: [new Paragraph({
            children: [new TextRun({ text: String(row[k] ?? ""), size: 18 })]
          })]
        })
      )
    })
  );

  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: keys.map(() => colW),
    rows: [headerRow, ...dataRows],
  });
}

function summaryTable(summary) {
  const pairs = [
    ["Groups",             summary.groups_count],
    ["Sum",                summary.sum],
    ["Average",            summary.average],
    ["Std. deviation",     summary.std_deviation],
    ["Maximum",            summary.max ? `${summary.max.group} — ${summary.max.value}` : "—"],
    ["Minimum",            summary.min ? `${summary.min.group} — ${summary.min.value}` : "—"],
  ];

  const rows = pairs.map(([label, value]) =>
    new TableRow({
      children: [
        new TableCell({
          borders, margins: cellMargins,
          width: { size: Math.floor(PAGE_W * 0.4), type: WidthType.DXA },
          shading: { fill: "EEF2FB", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })]
        }),
        new TableCell({
          borders, margins: cellMargins,
          width: { size: Math.floor(PAGE_W * 0.6), type: WidthType.DXA },
          shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: String(value), size: 18 })] })]
        }),
      ]
    })
  );

  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [Math.floor(PAGE_W * 0.4), Math.floor(PAGE_W * 0.6)],
    rows,
  });
}

const children = [];

children.push(
  heading(`Report for table: ${table_name}`, HeadingLevel.HEADING_1),
  para(`Generation date: ${generated}`, { color: "888888", size: 18 }),
  para(""),
  hrPara(),
  para(""),
);

charts.forEach((chart, idx) => {
  children.push(
    heading(`Chart ${idx + 1}`, HeadingLevel.HEADING_2),
    para(""),
  );

  // Summary statistics
  if (chart.summary) {
    children.push(
      heading("Summary statistics", HeadingLevel.HEADING_3),
      summaryTable(chart.summary),
      para(""),
    );
  }

  if (chart.data_quality) {
    const dq = chart.data_quality;
    children.push(
      heading("Data quality", HeadingLevel.HEADING_3),
      para(`Source rows: ${dq.total_source_rows}`),
      para(`Rows with NULL (excluded): ${dq.rows_with_nulls_excluded}`),
      para(`Rows used: ${dq.rows_used}`),
      para(`Data completeness: ${dq.completeness_percent?.toFixed(1)}%`),
      para(""),
    );
  }

  // Insights
  if (chart.insights && chart.insights.length > 0) {
    children.push(heading("Automated insights", HeadingLevel.HEADING_3));
    chart.insights.forEach(i => children.push(para(`• ${i}`)));
    children.push(para(""));
  }

  // Data table
  if (chart.data && chart.data.length > 0) {
    const keys = Object.keys(chart.data[0]);
    children.push(
      heading("Data", HeadingLevel.HEADING_3),
      makeTableFromData(chart.data, keys),
      para(""),
    );
  }

  // SQL query
  if (chart.debug_query) {
    children.push(
      heading("SQL query", HeadingLevel.HEADING_3),
      new Paragraph({
        children: [new TextRun({
          text: chart.debug_query,
          font: "Courier New", size: 16, color: "444444",
        })]
      }),
      para(""),
    );
  }

  if (idx < charts.length - 1) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
});

// ─── build & write ─────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: "1F3864" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "2E5FA3" },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "444444" },
        paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
          ],
        })]
      })
    },
    children,
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("Report written to", outPath);
}).catch(err => {
  console.error("Error generating docx:", err);
  process.exit(1);
});
