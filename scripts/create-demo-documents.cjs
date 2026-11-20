const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const directory = resolve(__dirname, "../webapp/documents");
mkdirSync(directory, { recursive: true });

function makePdf(lines) {
    const content = lines.map(([size, x, y, text]) =>
        `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`).join("\n");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = objects.map((object, index) => {
        const offset = Buffer.byteLength(pdf, "latin1");
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
        return offset;
    });
    const xref = Buffer.byteLength(pdf, "latin1");
    pdf += "xref\n0 6\n0000000000 65535 f \n";
    offsets.forEach((offset) => { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, "latin1");
}

function write(name, title, period, details) {
    const lines = [
        [12, 55, 770, "PERSONALPORTAL   /   DEMODOKUMENT"],
        [24, 55, 719, title],
        [13, 55, 685, "Zeitraum: " + period],
        [11, 55, 645, "Für dieses Beispieldokument wurden fiktive Beträge verwendet."],
        ...details.map((text, index) => [12, 55, 590 - index * 28, text])
    ];
    writeFileSync(resolve(directory, name + ".pdf"), makePdf(lines));
}

[9, 10, 11, 12].forEach((month) => {
    const m = String(month).padStart(2, "0");
    write("pay-2024-" + m, "Entgeltnachweis", m + ".2024",
        ["Bruttoentgelt: 3.500,00 EUR", "Abzüge: 1.100,00 EUR", "Auszahlungsbetrag: 2.400,00 EUR"]);
});
[2021, 2022, 2023, 2024].forEach((year) => {
    write("tax-" + year, "Lohnsteuerbescheinigung", String(year),
        ["Bruttoarbeitslohn: 42.000,00 EUR", "Einbehaltene Lohnsteuer: 6.800,00 EUR"]);
});
