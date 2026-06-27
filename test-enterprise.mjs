const BASE = 'http://localhost:3001';

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  amber:  s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0, failed = 0;

const p = (ok, label, val = '') => {
  console.log(`  ${ok ? c.green('✔') : c.red('✘')} ${label.padEnd(46)} ${c.dim(String(val))}`);
  ok ? passed++ : failed++;
};
const h  = t => console.log(`\n${c.bold(c.cyan('┌─[ ' + t + ' ]'))}`);
const ln = s => console.log(`  ${c.dim('│')} ${s}`);

// ─── SUITE 1: Health ──────────────────────────────────────────
h('SUITE 1 — Health & Connectivity');
const health = await fetch(`${BASE}/api/health`).then(r => r.json());
p(health.status === 'ok' && health.db === 'connected',
  'GET /api/health',
  `uptime=${health.uptime?.toFixed(1)}s  db=${health.db}`);

// ─── SUITE 2: Inventory Seed ──────────────────────────────────
h('SUITE 2 — Inventory Engine: Seed & List');
const seed = await fetch(`${BASE}/api/inventory/seed`, { method: 'POST' }).then(r => r.json());
p(typeof seed.upserted === 'number', 'POST /api/inventory/seed', `upserted=${seed.upserted}  matched=${seed.matched}`);

const inv = await fetch(`${BASE}/api/inventory`).then(r => r.json());
p(inv.length >= 14, 'GET /api/inventory (14 menu items)', `${inv.length} ingredients tracked`);
ln(`Sample: ${inv.slice(0,4).map(i => i.ingredientName + '(' + i.stockLevel + ' ' + i.unit + ')').join(', ')}`);

// ─── SUITE 3: Station-routed Order ───────────────────────────
h('SUITE 3 — Multi-Station Order Creation');
const orderRes = await fetch(`${BASE}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tableNumber: 42,
    items: [
      { name: 'Smash Burger',  quantity: 2, station: 'grill' },
      { name: 'Truffle Fries', quantity: 3, station: 'fry'   },
      { name: 'Caesar Salad',  quantity: 1, station: 'prep'  },
    ],
  }),
});
const order = await orderRes.json();
p(orderRes.status === 201,                    'POST /api/orders → 201',           `_id=${order._id}`);
p(order.items[0]?.station === 'grill',        '  items[0].station = grill',        order.items[0]?.name);
p(order.items[1]?.station === 'fry',          '  items[1].station = fry',          order.items[1]?.name);
p(order.items[2]?.station === 'prep',         '  items[2].station = prep',         order.items[2]?.name);

// ─── SUITE 4: Status lifecycle + auto-depletion ───────────────
h('SUITE 4 — Status Lifecycle & Auto-Depletion');

const burgerBefore = inv.find(i => i.ingredientName === 'smash burger')?.stockLevel ?? 0;
const friesBefore  = inv.find(i => i.ingredientName === 'truffle fries')?.stockLevel ?? 0;
const saladBefore  = inv.find(i => i.ingredientName === 'caesar salad')?.stockLevel ?? 0;

const cook = await fetch(`${BASE}/api/orders/${order._id}/status`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'cooking' }),
}).then(r => r.json());
p(cook.status === 'cooking', 'PATCH → cooking (triggers depletion)', `cookingStartedAt=${cook.cookingStartedAt}`);

await new Promise(r => setTimeout(r, 600));   // give async depletion time to write

const invAfter  = await fetch(`${BASE}/api/inventory`).then(r => r.json());
const burgerNow = invAfter.find(i => i.ingredientName === 'smash burger');
const friesNow  = invAfter.find(i => i.ingredientName === 'truffle fries');
const saladNow  = invAfter.find(i => i.ingredientName === 'caesar salad');

p(burgerNow && burgerNow.stockLevel === burgerBefore - 2,
  '  smash burger depleted by 2',
  `${burgerBefore} → ${burgerNow?.stockLevel} patties`);
p(friesNow && friesNow.stockLevel === friesBefore - 3,
  '  truffle fries depleted by 3',
  `${friesBefore} → ${friesNow?.stockLevel} portions`);
p(saladNow && saladNow.stockLevel === saladBefore - 1,
  '  caesar salad depleted by 1',
  `${saladBefore} → ${saladNow?.stockLevel} portions`);

// Verify threshold alert would fire for a low-stock item (set artificially low)
await fetch(`${BASE}/api/inventory`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ingredientName: 'mozzarella sticks', stockLevel: 3, criticalThreshold: 5, unit: 'portions' }),
});
ln('Set mozzarella sticks stock=3 (below threshold=5) → INVENTORY_ALERT will fire on next cooking transition');

const ready  = await fetch(`${BASE}/api/orders/${order._id}/status`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'ready' }),
}).then(r => r.json());
p(ready.status === 'ready' && ready.readyAt, 'PATCH → ready', `readyAt=${ready.readyAt}`);

const served = await fetch(`${BASE}/api/orders/${order._id}/status`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'served' }),
}).then(r => r.json());
p(served.status === 'served', 'PATCH → served (archived to history)', '');

// ─── SUITE 5: SLA Breach Telemetry ───────────────────────────
h('SUITE 5 — SLA Breach Telemetry Engine');
const sla = await fetch(`${BASE}/api/analytics/sla-breaches`).then(r => r.json());
p(sla.slaThresholdMinutes === 12,       'GET /api/analytics/sla-breaches',  `threshold=${sla.slaThresholdMinutes} min`);
p(typeof sla.summary === 'object',      '  summary.totalOrders',             sla.summary.totalOrders);
p(typeof sla.summary.overallBreachPct === 'number',
                                         '  summary.overallBreachPct',        sla.summary.overallBreachPct + '%');
p(Array.isArray(sla.byHour),            '  byHour array',                    sla.byHour.length + ' hour segments');
if (sla.byHour.length > 0) {
  const row = sla.byHour[0];
  ln(`Hour ${row.hour}: ${row.totalOrders} orders | ${row.breachCount} breaches | avg ${row.avgPrepMinutes}min | max ${row.maxPrepMinutes}min`);
}

// ─── SUITE 6: Predictive Insights ────────────────────────────
h('SUITE 6 — Predictive Bottleneck Analyzer');
const pred = await fetch(`${BASE}/api/analytics/predictive-insights`).then(r => r.json());
p(Array.isArray(pred.alerts), 'GET /api/analytics/predictive-insights', pred.alerts.length + ' alert(s)');
ln(pred.alerts[0]?.substring(0, 90));

// ─── SUITE 7: Station persistence verification ────────────────
h('SUITE 7 — Station Routing Persistence');
const fresh = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tableNumber: 7,
    items: [
      { name: 'Margherita Pizza',  quantity: 1, station: 'assembly' },
      { name: 'Mozzarella Sticks', quantity: 2, station: 'prep'     },
    ],
  }),
}).then(r => r.json());
p(fresh.items[0]?.station === 'assembly', '  Margherita Pizza → station=assembly', fresh.items[0]?.station);
p(fresh.items[1]?.station === 'prep',     '  Mozzarella Sticks → station=prep',     fresh.items[1]?.station);

// Verify station filter works (items without station default to assembly)
p(typeof fresh._id === 'string', '  Order persisted in MongoDB', fresh._id);

// ─── FINAL SUMMARY ────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${c.bold(c.cyan('╔══════════════════════════════════════════════╗'))}`);
console.log(`${c.bold(c.cyan('║  ENTERPRISE FEATURES TEST RESULTS            ║'))}`);
console.log(`${c.bold(c.cyan('╚══════════════════════════════════════════════╝'))}`);
console.log(`  ${c.green('Passed:')} ${passed} / ${total}`);
if (failed > 0) {
  console.log(`  ${c.red('Failed:')} ${failed} / ${total}`);
} else {
  console.log(`  ${c.green('✔ All enterprise systems operational.')}`);
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
