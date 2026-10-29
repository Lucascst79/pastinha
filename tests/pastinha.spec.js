// Testes da Pastinha num navegador de verdade: npm test
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const { PDFDocument } = require('pdf-lib');

const F = name => path.join(__dirname, name.endsWith('.heic') ? 'fixtures' : '.fixtures', name);

// Abre a página e junta os erros do console para conferir no fim do teste
async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('#empty')).toBeVisible();
  return errors;
}

async function add(page, files, expectedCards) {
  await page.locator('#fileInput').setInputFiles(files.map(F));
  await expect(page.locator('#grid .card')).toHaveCount(expectedCards);
  await expect(page.locator('#busy')).toBeHidden();
  await expect(page.locator('#grid .card img:not([hidden])')).toHaveCount(expectedCards);
}

// Ordem das páginas como aparece na tela, ex.: ["comprovante", "contrato 1", ...]
const order = page => page.locator('#grid .card').evaluateAll(cards => cards.map(c => {
  const name = c.querySelector('.fname').textContent.replace(/\.\w+$/, '');
  const info = c.querySelector('.pinfo').textContent;
  return info ? `${name} ${info.split(' ')[1]}` : name;
}));

async function download(page) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#dlBtn').click()]);
  return { name: d.suggestedFilename(), buf: fs.readFileSync(await d.path()) };
}

// Arrasta um card até um ponto, com o mouse de verdade e passos intermediários
async function dragCard(page, from, to, { hold = 0 } = {}) {
  const box = await from.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 3 + 10, { steps: 5 });
  const target = typeof to === 'function' ? await to() : to;
  await page.mouse.move(target.x, target.y, { steps: 25 });
  for (let t = 0; t < hold; t += 100) { await page.mouse.move(target.x + (t % 200 ? 1 : 0), target.y); await page.waitForTimeout(100); }
  return async finalPoint => {
    if (finalPoint) {
      const p = typeof finalPoint === 'function' ? await finalPoint() : finalPoint;
      await page.mouse.move(p.x, p.y, { steps: 15 });
      await page.waitForTimeout(300);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
}

// Renderiza uma página do PDF baixado (no próprio navegador) e devolve a cor de alguns pontos
async function pixels(page, buf, pageNum, points) {
  return page.evaluate(async ({ b64, pageNum, points }) => {
    const data = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pg = await pdf.getPage(pageNum);
    const vp = pg.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    const x = c.getContext('2d');
    await pg.render({ canvasContext: x, viewport: vp, intent: 'print' }).promise;
    const lum = (px, py) => { const d = x.getImageData(Math.round(px * c.width), Math.round(py * c.height), 1, 1).data; return Math.round(0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2]); };
    const out = { points: points.map(([px, py]) => lum(px, py)) };
    // pixels escuros na faixa de baixo (onde escrevemos o texto)
    let dark = 0;
    for (let py = 0.86; py < 0.95; py += 0.004) for (let px = 0.05; px < 0.7; px += 0.004) if (lum(px, py) < 110) dark++;
    out.darkBottom = dark;
    return out;
  }, { b64: buf.toString('base64'), pageNum, points });
}

test.describe('Pastinha', () => {
  test('abre sem erros e mostra a área para soltar arquivos', async ({ page }) => {
    const errors = await open(page);
    await expect(page).toHaveTitle(/Pastinha/);
    await expect(page.locator('#dlBtn')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('junta PDF e fotos e baixa um PDF único com o nome escolhido', async ({ page }) => {
    const errors = await open(page);
    await add(page, ['contrato.pdf', 'rg-frente.jpg', 'comprovante.png'], 5);
    expect(await order(page)).toEqual(['comprovante', 'contrato 1', 'contrato 2', 'contrato 3', 'rg-frente']);
    await page.locator('#fname').fill('Dossiê Maria');
    const { name, buf } = await download(page);
    expect(name).toBe('Dossiê Maria.pdf');
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPageCount()).toBe(5);
    const size = i => pdf.getPage(i).getSize();
    expect(Math.round(size(0).width)).toBe(595); // foto em pé numa A4 em pé
    expect(Math.round(size(4).width)).toBe(842); // foto deitada numa A4 deitada
    expect(errors).toEqual([]);
  });

  test('arrastar com o mouse muda a ordem', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no celular o arrasto é por toque');
    await open(page);
    await add(page, ['contrato.pdf', 'rg-frente.jpg', 'comprovante.png'], 5);
    const cards = page.locator('#grid .card');
    const first = await cards.nth(0).boundingBox();
    const drop = await dragCard(page, cards.nth(4), { x: first.x + 12, y: first.y + first.height / 2 });
    await drop();
    expect((await order(page))[0]).toBe('rg-frente');
    await expect(cards.nth(0).locator('.num')).toHaveText('1');
  });

  test('arrastar até a borda de cima rola a tela sozinho', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no celular o arrasto é por toque');
    await page.setViewportSize({ width: 1400, height: 600 });
    await open(page);
    await add(page, ['longo-15.pdf'], 15);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const startY = await page.evaluate(() => scrollY);
    expect(startY).toBeGreaterThan(200);
    const last = page.locator('#grid .card').nth(14);
    const drop = await dragCard(page, last, { x: 400, y: 8 }, { hold: 3000 });
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await drop(async () => {
      const b = await page.locator('#grid .card:not(.ghost)').first().boundingBox();
      return { x: b.x + 12, y: b.y + b.height / 2 };
    });
    expect((await order(page))[0]).toBe('longo-15 15');
  });

  test('Para o início, Para o fim e Desfazer', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf', 'rg-frente.jpg', 'comprovante.png'], 5);
    const cards = page.locator('#grid .card');
    await cards.nth(2).locator('.meta').click();
    await cards.nth(3).locator('.meta').click();
    await page.locator('[data-bulk="first"]').click();
    expect((await order(page)).slice(0, 3)).toEqual(['contrato 2', 'contrato 3', 'comprovante']);
    await page.locator('[data-bulk="last"]').click();
    expect((await order(page)).slice(-2)).toEqual(['contrato 2', 'contrato 3']);
    await page.locator('#undoBtn').click();
    expect((await order(page)).slice(0, 2)).toEqual(['contrato 2', 'contrato 3']);
    // arquivo inteiro para o início pela visão "Arquivos"
    await page.locator('#vFiles').click();
    await page.locator('#fileGrid .card', { hasText: 'rg-frente' }).locator('[data-fact="first"]').click();
    await page.locator('#vPages').click();
    expect((await order(page))[0]).toBe('rg-frente');
  });

  test('girar uma página sai girada no PDF, sem perder o texto', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#grid .card').nth(0).hover();
    await page.locator('#grid .card').nth(0).locator('[data-act="rotR"]').click();
    const { buf } = await download(page);
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPage(0).getRotation().angle).toBe(90);
    expect(pdf.getPage(1).getRotation().angle).toBe(0);
    // o texto continua sendo texto selecionável (a página não virou imagem)
    const text = await page.evaluate(async b64 => {
      const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise;
      const content = await (await pdf.getPage(1)).getTextContent();
      return content.items.map(i => i.str).join(' ');
    }, buf.toString('base64'));
    expect(text).toContain('Contrato - pagina 1');
  });

  test('editor: tarja preta e texto aparecem no PDF baixado', async ({ page }) => {
    const errors = await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#grid .card').nth(0).locator('.thumb').dblclick();
    await expect(page.locator('#editor')).toBeVisible();
    const canvas = page.locator('#edCanvas');
    await expect.poll(async () => (await canvas.boundingBox()).width).toBeGreaterThan(100);
    // mede a página na hora de cada traço (a barra de opções muda de altura ao trocar de ferramenta)
    const at = async (fx, fy) => { const b = await canvas.boundingBox(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; };

    await page.locator('[data-tool="rect"]').click();
    await page.locator('#swatches .sw').first().click(); // preto
    let p = await at(0.2, 0.4); await page.mouse.move(p.x, p.y); await page.mouse.down();
    p = await at(0.6, 0.55); await page.mouse.move(p.x, p.y, { steps: 10 }); await page.mouse.up();

    await page.locator('[data-tool="text"]').click();
    p = await at(0.1, 0.9); await page.mouse.click(p.x, p.y);
    await expect(page.locator('#edText')).toBeVisible();
    await page.keyboard.type('CONFERE COM O ORIGINAL');
    await page.keyboard.press('Enter');

    await page.locator('#edSave').click();
    await expect(page.locator('#editor')).toBeHidden();
    await expect(page.locator('#grid .card').nth(0).locator('.tag-ed')).toBeVisible();

    const { buf } = await download(page);
    const res = await pixels(page, buf, 1, [[0.25, 0.42], [0.4, 0.47], [0.55, 0.53], [0.8, 0.2]]);
    expect(res.points.slice(0, 3).every(v => v < 60)).toBe(true); // tarja preta
    expect(res.points[3]).toBeGreaterThan(200);                    // fora da tarja continua branco
    expect(res.darkBottom).toBeGreaterThan(40);                     // o texto escrito apareceu
    expect(errors).toEqual([]);
  });

  test('borracha apaga só o que foi desenhado, sem apagar o documento', async ({ page }) => {
    const errors = await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#grid .card').nth(0).locator('.thumb').dblclick();
    await expect(page.locator('#editor')).toBeVisible();
    const canvas = page.locator('#edCanvas');
    await expect.poll(async () => (await canvas.boundingBox()).width).toBeGreaterThan(100);
    // mede a página na hora de cada traço (a barra de opções muda de altura ao trocar de ferramenta)
    const at = async (fx, fy) => { const b = await canvas.boundingBox(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; };
    const stroke = async (from, to) => {
      let p = await at(...from); await page.mouse.move(p.x, p.y); await page.mouse.down();
      p = await at(...to); await page.mouse.move(p.x, p.y, { steps: 20 }); await page.mouse.up();
    };

    // risco grosso na parte de baixo (vazia) e outro por cima do título
    await page.locator('[data-tool="pen"]').click();
    await page.locator('#swatches .sw').first().click();
    await page.locator('#edSize').fill('12');
    await stroke([0.1, 0.9], [0.6, 0.9]);
    await stroke([0.1, 0.095], [0.6, 0.095]);

    // borracha: apaga a metade esquerda do risco de baixo e passa por cima do título
    await page.locator('[data-tool="erase"]').click();
    await page.locator('#edSize').fill('50');
    await stroke([0.05, 0.9], [0.32, 0.9]);
    await stroke([0.05, 0.095], [0.65, 0.095]);

    await page.locator('#edSave').click();
    await expect(page.locator('#editor')).toBeHidden();
    const { buf } = await download(page);
    const res = await pixels(page, buf, 1, [[0.15, 0.9], [0.25, 0.9], [0.45, 0.9], [0.55, 0.9]]);
    expect(res.points[0]).toBeGreaterThan(200); // apagado
    expect(res.points[1]).toBeGreaterThan(200); // apagado
    expect(res.points[2]).toBeLessThan(80);     // risco que ficou
    expect(res.points[3]).toBeLessThan(80);
    // a faixa do título ficou igual ao documento original: o risco sumiu e o título continua
    const diff = await page.evaluate(async ([outB64, origB64]) => {
      const region = async b64 => {
        const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 1.5 });
        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        const x = c.getContext('2d');
        await pg.render({ canvasContext: x, viewport: vp }).promise;
        return x.getImageData(0, Math.round(c.height * 0.07), Math.round(c.width * 0.7), Math.round(c.height * 0.05)).data;
      };
      const [a, o] = [await region(outB64), await region(origB64)];
      let changed = 0, dark = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - o[i]) + Math.abs(a[i + 1] - o[i + 1]) + Math.abs(a[i + 2] - o[i + 2]) > 240) changed++;
        if (o[i] + o[i + 1] + o[i + 2] < 300) dark++;
      }
      return { changed: changed / (a.length / 4), titleDark: dark / (a.length / 4) };
    }, [buf.toString('base64'), fs.readFileSync(F('contrato.pdf')).toString('base64')]);
    expect(diff.titleDark).toBeGreaterThan(0.02); // a faixa tem mesmo o título
    expect(diff.changed).toBeLessThan(0.02);      // e saiu igual ao original
    expect(errors).toEqual([]);
  });

  test('no editor, girar e recortar levam o desenho junto (e ele continua apagável)', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#grid .card').nth(0).locator('.thumb').dblclick();
    const canvas = page.locator('#edCanvas');
    await expect.poll(async () => (await canvas.boundingBox()).width).toBeGreaterThan(100);
    await page.locator('[data-tool="pen"]').click();
    await page.locator('#swatches .sw').first().click();
    await page.locator('#edSize').fill('12');
    // risco vertical no canto de baixo, à esquerda (página em pé)
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.85); await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.95, { steps: 10 }); await page.mouse.up();
    // gira para a direita: o canto de baixo-esquerda vira o canto de cima-esquerda
    await page.locator('#edRotR').click();
    await expect.poll(async () => { const r = await canvas.boundingBox(); return r.width > r.height; }).toBe(true);
    await page.locator('#edSave').click();
    await expect(page.locator('#editor')).toBeHidden();
    const { buf } = await download(page);
    const pdf = await PDFDocument.load(buf);
    const size = pdf.getPage(0).getSize();
    expect(size.width).toBeGreaterThan(size.height); // ficou deitada
    // risco: em pé ia de y=0,85 a 0,95 em x=0,1 → deitada fica em y=0,1, de x=0,05 a 0,15
    const res = await pixels(page, buf, 1, [[0.08, 0.1], [0.12, 0.1], [0.5, 0.1]]);
    expect(res.points[0]).toBeLessThan(80);
    expect(res.points[1]).toBeLessThan(80);
    expect(res.points[2]).toBeGreaterThan(200);
  });

  test('"Apagar tudo o que desenhei" volta a página limpa e dá para desfazer', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#grid .card').nth(0).locator('.thumb').dblclick();
    const canvas = page.locator('#edCanvas');
    await expect.poll(async () => (await canvas.boundingBox()).width).toBeGreaterThan(100);
    await page.locator('[data-tool="pen"]').click();
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.9); await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.9, { steps: 10 }); await page.mouse.up();
    await page.locator('[data-tool="erase"]').click();
    await page.locator('#clearDrawings').click();
    await expect(page.locator('.toast', { hasText: 'Desenhos e textos apagados' })).toBeVisible();
    // desfazer traz o risco de volta; apagar de novo e cancelar não muda nada
    await page.locator('#edUndo').click();
    await page.locator('#clearDrawings').click();
    page.once('dialog', d => d.accept());
    await page.locator('#edCancel').click();
    await expect(page.locator('#editor')).toBeHidden();
    await expect(page.locator('#grid .card').nth(0).locator('.tag-ed')).toBeHidden();
  });

  test('baixa em todos os formatos, com vários arquivos num .zip', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf', 'rg-frente.jpg', 'comprovante.png'], 5);
    await page.locator('#fname').fill('Dossie Joao');
    const expected = {
      'pdf': { name: 'Dossie Joao.pdf' },
      'pdf-files': { name: 'Dossie Joao.zip', inside: ['Dossie Joao - 01 - comprovante.pdf', 'Dossie Joao - 02 - contrato.pdf', 'Dossie Joao - 03 - rg-frente.pdf'] },
      'pdf-pages': { name: 'Dossie Joao.zip', count: 5, ext: '.pdf' },
      'jpg': { name: 'Dossie Joao.zip', count: 5, ext: '.jpg' },
      'png': { name: 'Dossie Joao.zip', count: 5, ext: '.png' },
    };
    for (const [fmt, exp] of Object.entries(expected)) {
      await page.locator(`[data-fmt="${fmt}"]`).click();
      const { name, buf } = await download(page);
      expect(name, fmt).toBe(exp.name);
      if (name.endsWith('.zip')) {
        const files = Object.keys((await JSZip.loadAsync(buf)).files).sort();
        if (exp.inside) expect(files).toEqual(exp.inside);
        else { expect(files).toHaveLength(exp.count); expect(files.every(f => f.endsWith(exp.ext))).toBe(true); }
        const firstFile = await (await JSZip.loadAsync(buf)).file(files[0]).async('nodebuffer');
        const magic = { '.pdf': '%PDF', '.jpg': '\xff\xd8', '.png': '\x89PNG' }[path.extname(files[0])];
        expect(firstFile.toString('latin1').startsWith(magic), fmt).toBe(true);
      } else {
        expect((await PDFDocument.load(buf)).getPageCount()).toBe(5);
      }
    }
  });

  test('as 3 qualidades reduzem o tamanho de um PDF escaneado', async ({ page }) => {
    await open(page);
    await add(page, ['escaneado.pdf'], 2);
    const sizes = {};
    for (const q of ['max', 'balanced', 'compact']) {
      await page.locator(`.qopt[data-q="${q}"]`).click();
      sizes[q] = (await download(page)).buf.length;
    }
    expect(sizes.balanced).toBeLessThan(sizes.max * 0.6);
    expect(sizes.compact).toBeLessThan(sizes.balanced);
  });

  test('tela cheia: passa as páginas e fecha', async ({ page }) => {
    await open(page);
    await add(page, ['contrato.pdf'], 3);
    await page.locator('#viewBtn').click();
    await expect(page.locator('#viewer')).toBeVisible();
    await expect(page.locator('#vwNum')).toHaveText('Página 1 de 3');
    await expect(page.locator('#vwSpin')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#vwNum')).toHaveText('Página 2 de 3');
    await page.locator('#vwNext').click();
    await expect(page.locator('#vwNum')).toHaveText('Página 3 de 3');
    await expect(page.locator('#vwNext')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('#viewer')).toBeHidden();
  });

  test('aceita foto HEIC do iPhone', async ({ page }) => {
    await open(page);
    await add(page, ['foto-iphone.heic'], 1);
    const { buf } = await download(page);
    expect((await PDFDocument.load(buf)).getPageCount()).toBe(1);
  });

  test('no celular a tela não rola para os lados', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'só no celular');
    await open(page);
    await add(page, ['contrato.pdf', 'rg-frente.jpg'], 4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const { name } = await download(page);
    expect(name).toBe('dossie.pdf');
  });

  test('funciona sem internet depois de aberto uma vez', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'o modo offline do teste é confiável só no Chromium');
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#empty')).toBeVisible();
    await add(page, ['contrato.pdf', 'rg-frente.jpg'], 4);
    const { buf } = await download(page);
    expect((await PDFDocument.load(buf)).getPageCount()).toBe(4);
    await context.setOffline(false);
  });

  test('pode ser instalado como app', async ({ page, request }) => {
    await open(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(href)).json();
    expect(manifest.short_name).toBe('Pastinha');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    expect((await request.get('sw.js')).ok()).toBe(true);
  });
});
