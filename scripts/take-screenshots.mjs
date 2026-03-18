import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'wiki', 'screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5173';
const TIMEOUT = 10000;

// Minimal tool records that satisfy the v7 Dexie schema
const SEED_TOOLS = [
  { id:'t1', toolNumber:1, type:'flat end mill', description:'6mm 2F End Mill', starred:false, tags:['roughing'], machineGroups:['VMC 01'], quantity:5, reorderPoint:2, unitCost:12.50, condition:'good', useCount:3, regrindThreshold:20, customFields:{}, addedAt: Date.now()-86400000*5, updatedAt: Date.now()-86400000*5, unit:'mm', geometry:{ diameter:6, shaftDiameter:6, oal:57, fluteLength:13, fluteCount:2, cornerRadius:0, taperAngle:0, tipDiameter:0 }, cutting:{ spindleRPM:10000, feedRate:1200, feedPlunge:400, feedRamp:600, feedRetract:3000, feedMode:'mm/min', coolant:'flood', clockwise:true }, materialEntries:[], nc:{} },
  { id:'t2', toolNumber:2, type:'ball end mill', description:'10mm 4F Ball Mill', starred:true, tags:['finishing'], machineGroups:['VMC 01'], quantity:2, reorderPoint:1, unitCost:24.99, condition:'new', useCount:0, regrindThreshold:30, customFields:{}, addedAt: Date.now()-86400000*3, updatedAt: Date.now()-86400000*3, unit:'mm', geometry:{ diameter:10, shaftDiameter:10, oal:75, fluteLength:22, fluteCount:4, cornerRadius:5, taperAngle:0, tipDiameter:0 }, cutting:{ spindleRPM:8000, feedRate:800, feedPlunge:300, feedRamp:500, feedRetract:3000, feedMode:'mm/min', coolant:'mist', clockwise:true }, materialEntries:[], nc:{} },
  { id:'t3', toolNumber:3, type:'drill', description:'8.5mm HSS Drill', starred:false, tags:['drilling'], machineGroups:['VMC 01','Drill Press'], quantity:10, reorderPoint:3, unitCost:4.20, condition:'good', useCount:12, regrindThreshold:50, customFields:{}, addedAt: Date.now()-86400000*10, updatedAt: Date.now()-86400000*2, unit:'mm', geometry:{ diameter:8.5, shaftDiameter:8.5, oal:117, fluteLength:75, fluteCount:2, cornerRadius:0, taperAngle:59, tipDiameter:0 }, cutting:{ spindleRPM:2000, feedRate:200, feedPlunge:200, feedRamp:200, feedRetract:3000, feedMode:'mm/min', coolant:'flood', clockwise:true }, materialEntries:[], nc:{} },
  { id:'t4', toolNumber:4, type:'chamfer mill', description:'45° Chamfer 12mm', starred:false, tags:['deburring'], machineGroups:['VMC 01'], quantity:3, reorderPoint:1, unitCost:18.00, condition:'worn', useCount:45, regrindThreshold:50, customFields:{}, addedAt: Date.now()-86400000*20, updatedAt: Date.now()-86400000*1, unit:'mm', geometry:{ diameter:12, shaftDiameter:12, oal:65, fluteLength:12, fluteCount:4, cornerRadius:0, taperAngle:45, tipDiameter:0 }, cutting:{ spindleRPM:6000, feedRate:900, feedPlunge:300, feedRamp:400, feedRetract:3000, feedMode:'mm/min', coolant:'none', clockwise:true }, materialEntries:[], nc:{} },
  { id:'t5', toolNumber:5, type:'tap', description:'M6×1.0 Spiral Tap', starred:false, tags:['threading'], machineGroups:['VMC 01'], quantity:8, reorderPoint:2, unitCost:6.75, condition:'new', useCount:0, regrindThreshold:0, customFields:{}, addedAt: Date.now()-86400000*7, updatedAt: Date.now()-86400000*7, unit:'mm', geometry:{ diameter:6, shaftDiameter:6, oal:80, fluteLength:18, fluteCount:3, cornerRadius:0, taperAngle:0, tipDiameter:0, threadPitch:1.0 }, cutting:{ spindleRPM:500, feedRate:500, feedPlunge:500, feedRamp:500, feedRetract:500, feedMode:'mm/rev', coolant:'flood', clockwise:true }, materialEntries:[], nc:{} },
];

async function seedDB(page) {
  await page.evaluate(async (tools) => {
    // Open at current version (no version specified = use existing)
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('cnc-tool-library');
      req.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('tools', 'readwrite');
          tools.forEach(t => tx.objectStore('tools').put(t));
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = (ev) => { db.close(); reject(ev.target.error); };
        } catch(err) { db.close(); reject(err); }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }, SEED_TOOLS);
}

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ✓ ${name}.png`);
}

async function closeByX(page) {
  const xBtn = page.locator('button[title="Close"]').first();
  if (await xBtn.count() > 0) {
    await xBtn.click({ timeout: 3000 });
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Suppress changelog modal
  await page.addInitScript(() => {
    localStorage.setItem('cnc-tool-converter:lastSeenVersion', '0.2.0');
  });

  // ── 1. Converter page — also lets Dexie initialize the DB ────
  console.log('Converter page...');
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // give Dexie time to open and upgrade DB
  await shot(page, 'converter-page');

  const selects = await page.locator('select').all();
  if (selects.length >= 2) {
    await selects[0].selectOption({ index: 1 });
    await selects[1].selectOption({ index: 2 });
    await page.waitForTimeout(400);
  }
  await shot(page, 'converter-format-selected');

  // Seed DB now that Dexie has initialised all stores
  console.log('Seeding DB...');
  await seedDB(page);

  // Reload so LibraryContext picks up the seeded tools
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // ── 2. Tool Manager page ──────────────────────────────────────
  console.log('Tool Manager page...');
  await page.locator('button, a').filter({ hasText: /tool manager/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(1200);
  await shot(page, 'tool-library-page');

  // ── 3. Dropdowns ─────────────────────────────────────────────
  console.log('Dropdowns...');

  await page.locator('button').filter({ hasText: /maintain/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'maintain-dropdown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.locator('button').filter({ hasText: /^print/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'print-dropdown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.locator('button').filter({ hasText: /^libraries/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'libraries-dropdown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 4. Tool editor tabs ───────────────────────────────────────
  console.log('Tool editor...');
  await page.locator('button').filter({ hasText: /new tool/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(900);
  await shot(page, 'tool-editor-library-tab');

  await page.locator('button').filter({ hasText: /^geometry$/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'tool-editor-geometry');

  await page.locator('button').filter({ hasText: /^cutting$/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'tool-editor-cutting');

  await page.locator('button').filter({ hasText: /^crib$/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(500);
  await shot(page, 'tool-editor-crib');

  await closeByX(page);

  // ── 5. Import panel ───────────────────────────────────────────
  console.log('Import panel...');
  await page.locator('button').filter({ hasText: /^import$/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(700);
  await shot(page, 'import-panel');
  await closeByX(page);

  // ── 6. Settings page ─────────────────────────────────────────
  console.log('Settings page...');
  await page.locator('button, a').filter({ hasText: /^settings$/i }).first().click({ timeout: TIMEOUT });
  await page.waitForTimeout(900);
  await shot(page, 'settings-page');

  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(400);
  await shot(page, 'settings-remote-db');

  await browser.close();
  console.log(`\nDone — ${OUT}`);
})();
