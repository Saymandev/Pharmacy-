import type { Content, ContentText, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatReportValue, isMoneyColumn, reportLabel, type ReportModel } from "./report-model";

export type PdfReportContext = { title: string; branch: string; startDate: string; endDate: string; generated: string; search?: string; type?: string; language?: string; density?: 'standard'|'dense' };

// Separate font runs preserve Bengali shaping while keeping Latin text readable.
function text(value: string): ContentText {
  return { text: (value.match(/[\u0980-\u09ff\u200c\u200d]+|[^\u0980-\u09ff\u200c\u200d]+/g) ?? [""]).map(run => ({ text: run, font: /[\u0980-\u09ff]/.test(run) ? "Bengali" : "Roboto" })) };
}

export function reportPdfDefinition(model: ReportModel, context: PdfReportContext, t: (value: string) => string = value => value): TDocumentDefinitions {
  const locale = context.language === "bn" ? "bn-BD" : "en-BD";
  const wide = model.tables.some(table => table.columns.length > 6);
  const dense = context.density === 'dense';
  const generated = new Date(context.generated).toLocaleString(locale, { timeZone: "Asia/Dhaka" });
  const content: Content[] = [
    { ...text("PHARMACY · " + t("Reports")), color: "#147956", bold: true, fontSize: 10, margin: [0, 0, 0, 8] },
    { ...text(context.title), fontSize: 22, bold: true, margin: [0, 0, 0, 12] },
    { ...text(t("Branch") + ": " + context.branch), margin: [0, 0, 0, 5] },
    { ...text(t("Period") + ": " + (context.startDate ? `${context.startDate} — ${context.endDate}` : t("All dates"))), margin: [0, 0, 0, 5] },
    { ...text(t("Generated") + ": " + generated + " · Asia/Dhaka"), color: "#60736a", fontSize: 9, margin: [0, 0, 0, 14] },
  ];
  if (context.search) content.push({ ...text(t("Invoice search") + ": " + context.search), margin: [0, 0, 0, 6] });
  if (context.type) content.push({ ...text(t("Sale type") + ": " + context.type), margin: [0, 0, 0, 10] });
  if (model.metrics.length) {
    content.push({ ...text(t("Summary")), bold: true, fontSize: 13, margin: [0, 8, 0, 9] });
    content.push({ table: { headerRows: 1, widths: ["*", 140], body: [
      [{ ...text(t("Metric")), style: "tableHeader" }, { ...text(t("Value")), style: "tableHeader", alignment: "right" }],
      ...model.metrics.map(metric => [text(t(metric.label)), { ...text(formatReportValue(metric.key, metric.value, locale)), alignment: "right" as const, bold: true }]),
    ] }, layout: "lightHorizontalLines", fontSize: 9, margin: [0, 0, 0, 14] });
  }
  for (const table of model.tables) {
    const columnGroups: string[][] = [];
    if (table.columns.length <= 12) columnGroups.push(table.columns);
    else for (let index = 1; index < table.columns.length; index += 8) columnGroups.push([table.columns[0], ...table.columns.slice(index, index + 8)]);
    for (let part = 0; part < columnGroups.length; part++) {
      const columns = columnGroups[part];
      if (!columns.length) continue;
      const heading = t(table.name) + (columnGroups.length > 1 ? ` · ${part + 1}/${columnGroups.length}` : "");
      const body: TableCell[][] = [columns.map(key => ({ ...text(t(reportLabel(key))), style: "tableHeader", alignment: isMoneyColumn(key) ? "right" : "left" })),
        ...table.rows.map(row => columns.map(key => ({ ...text(formatReportValue(key, row[key], locale)), alignment: isMoneyColumn(key) ? "right" as const : "left" as const })))];
      content.push({ ...text(heading), bold: true, fontSize: 13, margin: [0, 10, 0, 5], pageBreak: part > 0 ? "before" : undefined });
      content.push({ ...text(`${table.rows.length.toLocaleString(locale)} ${t("records")}`), color: "#60736a", fontSize: 8, margin: [0, 0, 0, 8] });
      content.push({ table: { headerRows: 1, widths: columns.map(() => "*"), body }, layout: dense ? {paddingTop:()=>2,paddingBottom:()=>2,hLineWidth:()=>0.3,vLineWidth:()=>0,hLineColor:()=>"#dce5df"} : "lightHorizontalLines", fontSize: columns.length > 6 ? 7 : 8, margin: [0, 0, 0, dense ? 8 : 12] });
    }
    if (table.totals.length) content.push({ ...text(table.totals.map(metric => `${t(metric.label)}: ${formatReportValue(metric.key, metric.value, locale)}`).join(" · ")), bold: true, fontSize: 9, margin: [0, 0, 0, 12] });
  }
  return { info: { title: context.title, author: "Pharmacy POS", subject: context.branch }, pageSize: "A4", pageOrientation: wide ? "landscape" : "portrait", pageMargins: [32, 32, 32, 42], defaultStyle: { font: "Roboto", fontSize: 10, color: "#20372c", lineHeight: 1.15 }, styles: { tableHeader: { bold: true, color: "#147956", fillColor: "#edf5f0", fontSize: 8 } }, content,
    footer: (page, total) => ({ columns: [{ ...text(context.title), color: "#60736a", fontSize: 8 }, { text: `${page} / ${total}`, alignment: "right", color: "#60736a", fontSize: 8 }], margin: [32, 14, 32, 0] }),
  };
}

export async function downloadReportPdf(model: ReportModel, context: PdfReportContext, filename: string, t?: (value: string) => string) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.addVirtualFileSystem(fonts);
  pdfMake.addFonts({ Bengali: { normal: new URL("/fonts/NotoSansBengali-Regular.ttf", window.location.origin).href, bold: new URL("/fonts/NotoSansBengali-Bold.ttf", window.location.origin).href, italics: new URL("/fonts/NotoSansBengali-Regular.ttf", window.location.origin).href, bolditalics: new URL("/fonts/NotoSansBengali-Bold.ttf", window.location.origin).href } });
  await pdfMake.createPdf(reportPdfDefinition(model, context, t)).download(filename);
}
