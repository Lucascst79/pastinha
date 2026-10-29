// Dossiê grande: 60 fotos de celular (12 MP) + PDF longo. Rodar com: npm run test:stress
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { PDFDocument } = require('pdf-lib');

const PHOTOS = Number(process.env.FOTOS || 60);

test('dossiê grande: 60 fotos de 12 MP abrem, mexem e baixam sem travar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');

  // Gera as fotos no próprio navegador (4032 x 3024, como câmera de celular) e solta todas de uma vez
  const genMs = await page.evaluate(async n => {
    const t = performance.now();
    const files = [];
    const c = document.createElement('canvas'); c.width = 4032; c.height = 3024;
    const x = c.getContext('2d');
    for (let i = 0; i < n; i++) {
      x.fillStyle = `hsl(${i * 37 % 360} 30% 75%)`; x.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < 40000; k++) { x.fillStyle = `rgba(${Math.random() * 120 | 0},${Math.random() * 120 | 0},${Math.random() * 120 | 0},.4)`; x.fillRect(Math.random() * c.width, Math.random() * c.height, 4, 4); }
      x.fillStyle = '#111'; x.font = 'bold 220px Arial'; x.fillText(`FOTO ${i + 1}`, 200, 400);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      files.push(new File([blob], `foto-${String(i + 1).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
    }
    window.__fotos = files;
    return performance.now() - t;
  }, PHOTOS);
  console.log(`fotos geradas em ${(genMs / 1000).toFixed(1)} s`);

  const t0 = Date.now();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    window.__fotos.forEach(f => dt.items.add(f));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.__fotos = null;
  });
  await expect(page.locator('#grid .card')).toHaveCount(PHOTOS, { timeout: 300_000 });
  await expect(page.locator('#busy')).toBeHidden({ timeout: 300_000 });
  const importS = (Date.now() - t0) / 1000;
  console.log(`importação: ${importS.toFixed(1)} s (${(importS / PHOTOS).toFixed(2)} s por foto)`);

  // A tela continua respondendo: seleciona, move para o início e desfaz
  const t1 = Date.now();
  await page.locator('#grid .card').nth(PHOTOS - 1).locator('.meta').click();
  await page.locator('[data-bulk="first"]').click();
  await expect(page.locator('#grid .card').first().locator('.fname')).toHaveText(`foto-${String(PHOTOS).padStart(3, '0')}.jpg`);
  console.log(`mover para o início: ${Date.now() - t1} ms`);

  for (const q of ['balanced', 'max']) {
    await page.locator(`.qopt[data-q="${q}"]`).click();
    const t2 = Date.now();
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 400_000 }), page.locator('#dlBtn').click()]);
    const buf = fs.readFileSync(await d.path());
    console.log(`PDF ${q}: ${((Date.now() - t2) / 1000).toFixed(1)} s, ${(buf.length / 1048576).toFixed(1)} MB`);
    expect((await PDFDocument.load(buf)).getPageCount()).toBe(PHOTOS);
  }
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  if (mem) console.log(`memória JS em uso: ${mem} MB`);
  expect(errors).toEqual([]);
});
