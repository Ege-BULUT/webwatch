// Offline smoke test: node test/check.js  (all network mocked; nothing leaves the machine)
const { chromium } = require('/opt/homebrew/lib/node_modules/@playwright/mcp/node_modules/playwright');
const path = require('path'), fs = require('fs');
const URL_ = 'file://' + path.resolve(__dirname, '../index.html');
const OUT = process.argv[2] || '/tmp';
const FONT = fs.readFileSync('/System/Library/Fonts/Supplemental/Impact.ttf');
const LIST = [
  { id: 'orbitron', family: 'Orbitron', category: 'sans-serif', weights: [400, 700], subsets: ['latin'] },
  { id: 'inter', family: 'Inter', category: 'sans-serif', weights: [200, 400, 500], subsets: ['latin', 'latin-ext'] },
  { id: 'vt323', family: 'VT323', category: 'monospace', weights: [400], subsets: ['latin'] },
];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium' });
  const ctx = await b.newContext({ viewport: { width: 900, height: 320 } });
  let net = 0;
  const PORT = 8000 + Math.floor(Math.random() * 900), LOCAL = `http://127.0.0.1:${PORT}/`;
  const srv = require('child_process').spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '..')], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  await ctx.route(/^https?:/, r => { const u = r.request().url(); if (u.startsWith(LOCAL)) return r.continue(); net++;
    if (u.includes('api.fontsource.org')) return r.fulfill({ json: LIST });
    if (u.includes('cdn.jsdelivr.net')) return r.fulfill({ body: FONT, contentType: 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
    return r.abort(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/net::|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto(URL_); await p.waitForTimeout(1200);
  const txt = () => p.$$eval('.el .t', a => a.filter(x => x.offsetParent).map(x => x.textContent));
  const t0 = await txt(); ok(/^\d\d:\d\d:\d\d$/.test(t0[0]), 'time text ' + JSON.stringify(t0));
  // responsive: every visible element inside the block, for every preset and size
  const names = await p.$$eval('#hTheme option', o => o.map(x => x.textContent));
  for (const [w, h] of [[900, 320], [1400, 260], [320, 560], [220, 120], [700, 700]]) {
    await p.setViewportSize({ width: w, height: h });
    for (let i = 0; i < names.length; i++) {
      await p.selectOption('#hTheme', String(i)); await p.waitForTimeout(250);
      const bad = await p.$$eval('.el', (els, [W, H]) => els.filter(e => e.offsetParent || e.style.display !== 'none').map(e => { const r = e.getBoundingClientRect(); return { r, cls: e.textContent }; })
        .filter(({ r }) => r.width && (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2)).map(x => x.cls + ' ' + [x.r.left, x.r.top, x.r.right, x.r.bottom].map(Math.round)), [w, h]);
      ok(!bad.length, `${names[i]} @${w}x${h} inside` + (bad.length ? ' ' + JSON.stringify(bad) : ''));
      if (w === 900) await p.screenshot({ path: `${OUT}/view-${i}.png` });
    }
  }
  await p.setViewportSize({ width: 900, height: 320 });
  await p.selectOption('#hTheme', String(names.indexOf('Matrix')));
  await p.waitForTimeout(800);
  const lit = await p.$eval('#mx', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 0; return n; });
  ok(lit > 500, 'matrix canvas drawn px=' + lit);
  await p.selectOption('#hTheme', String(names.indexOf('Klasik'))); await p.waitForTimeout(200);
  await p.click('#hSec'); await p.waitForTimeout(1100);
  ok(/^\d\d:\d\d$/.test((await txt())[0]), 'seconds off: ' + (await txt())[0]);
  await p.click('#hDate'); await p.waitForTimeout(300);
  ok((await txt()).length === 1, 'date off hides date');
  await p.click('#hDate'); await p.click('#hSec'); await p.click('#h12'); await p.waitForTimeout(1100);
  ok(/^\d\d:\d\d:\d\d \S+$/.test((await txt())[0]), '12h: ' + (await txt())[0]);
  await p.click('#h12');

  // editor
  await p.setViewportSize({ width: 1400, height: 860 });
  await p.keyboard.press('e'); await p.waitForTimeout(300);
  ok(await p.$eval('body', b => b.classList.contains('editing')), 'e opens editor');
  const st = await p.$eval('#stage', s => { const r = s.getBoundingClientRect(); return [r.width, r.height]; });
  ok(st[0] > 200 && st[1] > 100, 'editor stage sized ' + st.map(Math.round));
  const el = await p.$('.el'); const bb = await el.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  await p.mouse.move(bb.x + bb.width / 2 + st[0] * 0.35, bb.y + bb.height / 2 - st[1] * 0.3, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(500);
  const th = () => p.evaluate(() => JSON.parse(localStorage.getItem('wc.themes')).find(t => t.name === 'Klasik'));
  let k = await th(); ok(k.els[0].x > 70 && k.els[0].ax === 100, `drag + auto anchor x=${k.els[0].x} ax=${k.els[0].ax} ay=${k.els[0].ay}`);
  await p.screenshot({ path: `${OUT}/editor-el.png` });
  // undo
  await p.keyboard.press('Meta+z'); await p.waitForTimeout(400);
  k = await th(); ok(k.els[0].x === 50, 'undo restores x=' + k.els[0].x);
  // select time element again, color wheel
  const el2 = await p.$('.el'); const b2 = await el2.boundingBox(); await p.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await p.click('#right summary:has-text("Renk ve kontur") ~ .f .sw'); await p.waitForTimeout(200);
  ok(!!(await p.$('.pop.cp')), 'color picker open');
  const wb = await (await p.$('.cp canvas')).boundingBox();
  await p.mouse.click(wb.x + wb.width * 0.9, wb.y + wb.height / 2); // hue 0 (red), high sat
  await p.$eval('.cp input[type=range]:nth-of-type(2)', r => { r.value = 0.5; r.dispatchEvent(new Event('input')); });
  await p.screenshot({ path: `${OUT}/picker.png` });
  await p.click('#top .hint'); await p.waitForTimeout(400);
  k = await th(); ok(/^#[e-f][0-9a-f][0-5][0-9a-f][0-5][0-9a-f]80$/i.test(k.els[0].color), 'wheel+alpha color ' + k.els[0].color);
  // font picker
  await p.click('#right .fontbtn'); await p.waitForTimeout(300);
  await p.fill('.fp input', 'orb'); await p.waitForTimeout(200);
  const rows = await p.$$eval('.fr .nm', a => a.map(x => x.textContent)); ok(rows.length === 1 && rows[0].startsWith('Orbitron'), 'font search ' + JSON.stringify(rows));
  await p.hover('.fr'); await p.waitForTimeout(300);
  ok((await p.$eval('.el .t', t => t.style.fontFamily)).includes('Orbitron'), 'hover previews font');
  await p.screenshot({ path: `${OUT}/fontpicker.png` });
  await p.mouse.move(5, 5); await p.waitForTimeout(200);
  ok(!(await p.$eval('.el .t', t => t.style.fontFamily)).includes('Orbitron'), 'leave reverts preview');
  await p.click('.fr .dl'); await p.waitForTimeout(600);
  ok(await p.$eval('.fr .dl', d => d.textContent === '✓'), 'download marks ✓');
  await p.click('.fr'); await p.waitForTimeout(400);
  k = await th(); ok(k.els[0].font === 'Orbitron' && k.els[0].fontId === 'orbitron', 'font applied ' + k.els[0].font);
  const fontsLoaded = await p.evaluate(() => [...document.fonts].filter(f => f.family.includes('Orbitron') && f.status === 'loaded').length);
  ok(fontsLoaded > 0, 'Orbitron face loaded ' + fontsLoaded);
  // add elements + fx
  for (const t of ['Analog', 'Şekil', 'Metin']) await p.click(`#adds button:has-text("${t}")`);
  await p.waitForTimeout(400);
  ok((await th()).els.length === 5, 'added 3 elements');
  await p.click('.tabs button:has-text("Efektler")');
  for (const s of ['Matrix yağmuru', 'Renk kayması (kromatik)', 'Tarama çizgileri', 'Gren / parazit']) await p.click(`#right summary:has-text("${s}") ~ .f input[type=checkbox]`);
  await p.waitForTimeout(800);
  ok(await p.$eval('#scene', s => s.style.filter.includes('url')), 'chroma filter applied');
  await p.screenshot({ path: `${OUT}/editor-fx.png` });
  // aspect previews
  for (const v of ['0.5625', '5']) { await p.selectOption('#ar', v); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/editor-ar-${v}.png` }); }
  // new theme persists over reload
  await p.click('#tNew'); await p.waitForTimeout(400);
  await p.click('#done'); await p.reload(); await p.waitForTimeout(800);
  const after = await p.$$eval('#hTheme option', o => o.map(x => x.textContent));
  ok(after.includes('Yeni tema') && (await p.$eval('#hTheme', s => s.selectedOptions[0].textContent)) === 'Yeni tema', 'new theme persisted + active ' + JSON.stringify(after));
  ok(await p.evaluate(() => new Promise(r => { const q = indexedDB.open('waveclock'); q.onsuccess = () => q.result.transaction('fonts').objectStore('fonts').count().onsuccess = e => r(e.target.result > 0); })), 'downloaded font in IndexedDB');
  // ?theme= pin
  await p.goto(URL_ + '?theme=Neon'); await p.waitForTimeout(500);
  ok((await p.$eval('#hTheme', s => s.selectedOptions[0].textContent)) === 'Neon', '?theme=Neon pins theme');

  // ---------- hosted site mode ----------
  const sp = await ctx.newPage(); sp.on('pageerror', e => errs.push('site: ' + e.message));
  await sp.setViewportSize({ width: 1440, height: 880 });
  await sp.goto(LOCAL); await sp.waitForTimeout(800);
  ok(await sp.$eval('body', b => b.classList.contains('editing')), 'site opens straight into editor');
  ok(await sp.isVisible('#xBtn') && await sp.isVisible('#qBtn') && (await sp.textContent('.newbtn')).includes('Yeni layout'), 'export, ? and + Yeni layout visible');
  await sp.hover('#qBtn'); await sp.waitForTimeout(350);
  ok(await sp.$eval('#qCard', c => getComputedStyle(c).opacity === '1' && c.textContent.includes('açık kaynak')), '? hover shows motivation card');
  await sp.screenshot({ path: `${OUT}/site-q.png` });
  await sp.click('.ti:has-text("Dünya Saatleri")'); await sp.waitForTimeout(1200);
  const wt = await sp.$$eval('.el .t', a => a.map(x => x.textContent));
  ok(new Set(wt.filter(t => /^\d\d:\d\d$/.test(t))).size === 3 && ['Istanbul', 'New York', 'Tokyo'].every(c => wt.some(t => t.includes(c))) && wt.some(t => t.includes('GMT')), 'world clocks: 3 zones in one scene ' + JSON.stringify(wt));
  await sp.screenshot({ path: `${OUT}/site-world.png` });
  const first = await sp.$('.el'); const fb = await first.boundingBox(); await sp.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2);
  const tzIn = await sp.$('#insp input[list=tzlist]'); await tzIn.fill('Europe/Paris'); await tzIn.press('Enter'); await tzIn.evaluate(i => i.dispatchEvent(new Event('change'))); await sp.waitForTimeout(1200);
  const wt2 = await sp.$$eval('.el .t', a => a.map(x => x.textContent));
  ok(wt2.some(t => t.includes('Paris')) && !wt2.some(t => t.includes('Istanbul')), 'tz change follows group label ' + JSON.stringify(wt2));
  await sp.fill('#insp input[list=tzlist]', 'Mars/Olympus'); await sp.$eval('#insp input[list=tzlist]', i => i.dispatchEvent(new Event('change'))); await sp.waitForTimeout(300);
  ok(await sp.$eval('#insp input[list=tzlist]', i => i.value === 'Europe/Paris'), 'invalid tz rejected');
  // group drag moves label with clock
  const before = await sp.$$eval('.el', a => a.slice(0, 3).map(x => x.getBoundingClientRect().left));
  const b1 = await (await sp.$('.el')).boundingBox();
  await sp.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await sp.mouse.down(); await sp.mouse.move(b1.x + b1.width / 2 + 60, b1.y + b1.height / 2 + 40, { steps: 5 }); await sp.mouse.up(); await sp.waitForTimeout(300);
  const after2 = await sp.$$eval('.el', a => a.slice(0, 3).map(x => x.getBoundingClientRect().left));
  ok(after2[1] - before[1] > 40 && after2[2] - before[2] > 40, 'group moves together ' + JSON.stringify([before, after2].map(a => a.map(Math.round))));
  // add world clock
  await sp.click('#adds button:has-text("Dünya saati")'); await sp.waitForTimeout(400);
  ok(await sp.$eval('#insp input[list=tzlist]', i => !!i.value), 'world clock added with tz');
  // export
  await sp.click('#xBtn'); await sp.waitForTimeout(500);
  const wj = await sp.$eval('#xp textarea', t => t.value);
  ok(wj.includes('"view": "web"') && wj.includes('?view=1#t='), 'wave widgets.json entry');
  await sp.screenshot({ path: `${OUT}/site-export.png` });
  const viewURL = JSON.parse(wj)[Object.keys(JSON.parse(wj))[0]].blockdef.meta.url;
  ok(viewURL.startsWith(LOCAL) && viewURL.length < 2500, 'share url local + short len=' + viewURL.length);
  await sp.click('.xtabs button:has-text("Siteye göm")'); await sp.waitForTimeout(200);
  const embeds = await sp.$$eval('#xp textarea', a => a.map(t => t.value));
  ok(embeds[0].startsWith('<iframe') && embeds[1].includes('embed.js') && embeds[1].includes('<\/script>'.replace('\\', '')), 'iframe + script snippets');
  const wv = await ctx.newPage(); await wv.goto(viewURL); await wv.waitForTimeout(1000);
  ok(!(await wv.$eval('body', b => b.classList.contains('editing'))) && (await wv.$eval('#hTheme', s => s.selectedOptions[0].textContent)) === 'Dünya Saatleri' && (await wv.$$eval('.el .t', a => a.map(x => x.textContent))).some(t => t.includes('Paris')), 'view link renders exported theme');
  const em = await ctx.newPage(); await em.goto(viewURL.replace('?view=1', '?embed=1')); await em.waitForTimeout(800);
  ok(await em.$eval('body', b => b.classList.contains('embed') && getComputedStyle(document.querySelector('#hud')).display === 'none'), 'embed mode bare');
  // embed.js on a foreign page
  const host = await ctx.newPage();
  await host.setContent(`<div style="width:600px">${embeds[1]}</div>`); await host.waitForTimeout(2500);
  const fr = host.frames().find(f => f.url().includes('embed=1'));
  const nEl = fr ? await fr.$$eval('.el .t', a => a.length) : -1;
  ok(nEl > 0, `embed.js injects working iframe frames=${JSON.stringify(host.frames().map(f => f.url().slice(0, 60)))} els=${nEl}`);
  await host.screenshot({ path: `${OUT}/embed-host.png` });
  // offline single file
  await sp.click('#xp button:has-text("Kapat")');
  await sp.click('.ti:has-text("Klasik")'); await sp.waitForTimeout(300);
  const html = await sp.evaluate(() => buildOffline('view'));
  const off = path.join(OUT, 'offline-test.html'); fs.writeFileSync(off, html);
  const octx = await b.newContext({ viewport: { width: 700, height: 300 } }); let leaked = 0;
  await octx.route(/^https?:/, r => { leaked++; r.abort(); });
  const op = await octx.newPage(); op.on('pageerror', e => errs.push('offline: ' + e.message));
  await op.goto('file://' + off); await op.waitForTimeout(1200);
  ok((await op.$eval('#hTheme', s => s.selectedOptions[0].textContent)) === 'Klasik' && /^\d\d:\d\d:\d\d$/.test(await op.textContent('.el .t')), 'offline html renders');
  ok(leaked === 0 && await op.evaluate(() => [...document.fonts].some(f => f.family.includes('Inter') && f.status === 'loaded')), `offline fonts embedded, network requests=${leaked}`);
  await octx.close();
  srv.kill();
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  console.log('mocked network requests:', net);
  await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
