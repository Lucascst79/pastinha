// Gera os arquivos de exemplo usados nos testes (PDFs e fotos) em tests/.fixtures/
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const DIR = path.join(__dirname, '.fixtures');

async function textPdf(file, pages, title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595.28, 841.89]);
    p.drawText(`${title} - pagina ${i}`, { x: 60, y: 760, size: 28, font, color: rgb(0.1, 0.1, 0.3) });
    for (let l = 0; l < 25; l++) p.drawText(`Linha ${l + 1} do documento ${title}`, { x: 60, y: 700 - l * 22, size: 12, font });
  }
  fs.writeFileSync(path.join(DIR, file), await doc.save());
}

module.exports = async () => {
  if (fs.existsSync(path.join(DIR, 'pronto.txt'))) return;
  fs.mkdirSync(DIR, { recursive: true });
  await textPdf('contrato.pdf', 3, 'Contrato');
  await textPdf('longo-15.pdf', 15, 'Longo');

  // Fotos e um PDF "escaneado" (página que é só imagem) desenhados num navegador
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const make = async (w, h, label, type, quality, noise) => page.evaluate(async ({ w, h, label, type, quality, noise }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e9dcc9'); g.addColorStop(1, '#b8c4c2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < noise; i++) { x.fillStyle = `rgba(${Math.random() * 90 | 0},${Math.random() * 90 | 0},${Math.random() * 90 | 0},.45)`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    x.fillStyle = '#111'; x.font = `bold ${Math.round(h / 14)}px Arial`; x.fillText(label, w * 0.07, h * 0.2);
    const blob = await new Promise(r => c.toBlob(r, type, quality));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { w, h, label, type, quality, noise });

  fs.writeFileSync(path.join(DIR, 'rg-frente.jpg'), Buffer.from(await make(1600, 1000, 'RG FRENTE', 'image/jpeg', 0.92, 20000)));
  fs.writeFileSync(path.join(DIR, 'comprovante.png'), Buffer.from(await make(1000, 1400, 'COMPROVANTE', 'image/png', 1, 2000)));
  const scan = await make(2480, 3508, 'DOCUMENTO ESCANEADO', 'image/jpeg', 0.95, 150000);
  await browser.close();

  const doc = await PDFDocument.create();
  const jpg = await doc.embedJpg(Uint8Array.from(scan));
  for (let i = 0; i < 2; i++) doc.addPage([595.28, 841.89]).drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
  fs.writeFileSync(path.join(DIR, 'escaneado.pdf'), await doc.save());
  fs.writeFileSync(path.join(DIR, 'pronto.txt'), 'ok');
};
