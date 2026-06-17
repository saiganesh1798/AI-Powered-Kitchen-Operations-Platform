/**
 * KDS Automated Integration Test Suite
 * Tests all endpoints and the full order lifecycle against the live server.
 */

const BASE = 'http://localhost:3001';

let passed = 0;
let failed = 0;
let createdOrderId = null;

const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const amber  = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

function log(label, msg) {
  console.log(`  ${dim('│')} ${label.padEnd(42)} ${msg}`);
}

function section(title) {
  console.log(`\n${bold(cyan(`┌─[ ${title} ]`))}`);
}

async function assert(testName, fn) {
  try {
    await fn();
    console.log(`  ${green('✔')} ${testName}`);
    passed++;
  } catch (e) {
    console.log(`  ${red('✘')} ${testName}`);
    console.log(`    ${red('→ ' + e.message)}`);
    failed++;
  }
}

function expect(val, label) {
  return {
    toBe: (expected) => {
      if (val !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual: (expected) => {
      const a = JSON.stringify(val), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
    },
    toContain: (substr) => {
      if (!String(val).includes(substr)) throw new Error(`${label}: expected to contain "${substr}", got "${val}"`);
    },
    toBeGreaterThan: (n) => {
      if (!(val > n)) throw new Error(`${label}: expected > ${n}, got ${val}`);
    },
    toBeArray: () => {
      if (!Array.isArray(val)) throw new Error(`${label}: expected Array, got ${typeof val}`);
    },
    toBeString: () => {
      if (typeof val !== 'string') throw new Error(`${label}: expected string, got ${typeof val}`);
    },
    toBeOneOf: (...vals) => {
      if (!vals.includes(val)) throw new Error(`${label}: expected one of [${vals.join(', ')}], got "${val}"`);
    }
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TEST SUITES ────────────────────────────────────────────────────────────

async function testHealth() {
  section('SUITE 1 — Health Check');
  await assert('GET /api/health → 200 OK', async () => {
    const r = await fetch(`${BASE}/api/health`);
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    expect(body.status, 'body.status').toBe('ok');
    expect(body.db, 'body.db').toBe('connected');
    log('uptime', `${body.uptime.toFixed(2)}s`);
  });
}

async function testCreateOrder() {
  section('SUITE 2 — Order Creation');

  await assert('POST /api/orders → creates order with status received', async () => {
    const r = await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: 99,
        items: [
          { name: 'Smash Burger',   quantity: 2, notes: 'NO PEANUT OIL - ALLERGY' },
          { name: 'Caesar Salad',   quantity: 1 },
          { name: 'Truffle Fries',  quantity: 3 },
        ],
        phone: '+911234567890'
      })
    });
    expect(r.status, 'status').toBe(201);
    const body = await r.json();
    expect(body.status, 'status field').toBe('received');
    expect(body.tableNumber, 'tableNumber').toBe(99);
    createdOrderId = body._id;
    log('created order _id', createdOrderId);
  });

  await assert('POST /api/orders → rejects invalid payload (missing items)', async () => {
    const r = await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: 1, items: [] })
    });
    expect(r.status, 'status').toBe(400);
  });
}

async function testActiveOrders() {
  section('SUITE 3 — Active Orders Query');
  await assert('GET /api/orders/active → returns array including our order', async () => {
    const r = await fetch(`${BASE}/api/orders/active`);
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    expect(body, 'body').toBeArray();
    const found = body.find(o => o._id === createdOrderId);
    if (!found) throw new Error('Created order not found in active list');
    expect(found.status, 'order status').toBe('received');
    log('active orders count', body.length);
  });
}

async function testStatusTransitions() {
  section('SUITE 4 — Status Lifecycle Transitions');

  await assert('PATCH /:id/status → received → cooking', async () => {
    const r = await fetch(`${BASE}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cooking' })
    });
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    expect(body.status, 'order status').toBe('cooking');
    if (!body.cookingStartedAt) throw new Error('cookingStartedAt not set');
    log('cookingStartedAt', body.cookingStartedAt);
  });

  await assert('PATCH /:id/status → invalid transition (cooking → received) is rejected', async () => {
    const r = await fetch(`${BASE}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received' })
    });
    expect(r.status, 'status').toBe(400);
  });

  await assert('PATCH /:id/status → cooking → ready', async () => {
    const r = await fetch(`${BASE}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' })
    });
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    expect(body.status, 'order status').toBe('ready');
    if (!body.readyAt) throw new Error('readyAt not set');
    log('readyAt', body.readyAt);
  });

  await assert('PATCH /:id/status → ready → served (bump bar archive)', async () => {
    const r = await fetch(`${BASE}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'served' })
    });
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    expect(body.status, 'order status').toBe('served');
  });

  await assert('GET /api/orders/active → served order no longer in active queue', async () => {
    const r = await fetch(`${BASE}/api/orders/active`);
    const body = await r.json();
    if (body.find(o => o._id === createdOrderId)) {
      throw new Error('Served order should not appear in active queue');
    }
  });
}

async function testBaseAnalytics() {
  section('SUITE 5 — Base Analytics Aggregation');
  await assert('GET /api/analytics → returns prep times + orders by hour', async () => {
    const r = await fetch(`${BASE}/api/analytics`);
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    if (!('averagePreparationTimePerItem' in body)) throw new Error('missing averagePreparationTimePerItem');
    if (!('ordersByHour' in body)) throw new Error('missing ordersByHour');
    expect(body.averagePreparationTimePerItem, 'prepData').toBeArray();
    expect(body.ordersByHour, 'hourData').toBeArray();
    log('items with prep data', body.averagePreparationTimePerItem.length);
    log('hours with data',      body.ordersByHour.length);
  });
}

async function testPredictiveInsights() {
  section('SUITE 6 — Predictive Bottleneck Analyzer');
  await assert('GET /api/analytics/predictive-insights → returns alerts array', async () => {
    const r = await fetch(`${BASE}/api/analytics/predictive-insights`);
    expect(r.status, 'status').toBe(200);
    const body = await r.json();
    if (!Array.isArray(body.alerts)) throw new Error('alerts must be an array');
    expect(body.alerts.length, 'alerts.length').toBeGreaterThan(0);
    log('dayOfWeek',   body.dayOfWeek);
    log('hourOfDay',   body.hourOfDay);
    log('alert[0]',    body.alerts[0].substring(0, 70) + '...');
  });
}

async function testAIPrepSummary() {
  section('SUITE 7 — AI Prep Summary (Gemini 2.5 Flash)');
  await assert('GET /api/analytics/prep-summary → returns plain-text summary', async () => {
    console.log(`  ${amber('⏳')} Calling Gemini 2.5 Flash... (may take a few seconds)`);
    const r = await fetch(`${BASE}/api/analytics/prep-summary`);
    expect(r.status, 'status').toBe(200);
    const text = await r.text();
    expect(text, 'response body').toBeString();
    if (text.trim().length === 0) throw new Error('Response was empty');
    log('summary length (chars)', text.trim().length);
    console.log(`\n  ${bold('── AI PREP SUMMARY OUTPUT ──')}`);
    text.trim().split('\n').slice(0, 8).forEach(line => {
      console.log(`  ${dim('│')} ${line}`);
    });
    console.log(`  ${bold('────────────────────────────')}`);
  });
}

async function testNotFound() {
  section('SUITE 8 — Guard Rails');
  await assert('PATCH non-existent order → 404', async () => {
    const r = await fetch(`${BASE}/api/orders/000000000000000000000000/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cooking' })
    });
    expect(r.status, 'status').toBe(404);
  });
}

// ─── MAIN RUNNER ────────────────────────────────────────────────────────────
(async () => {
  console.log(bold(cyan('\n╔══════════════════════════════════════════════╗')));
  console.log(bold(cyan('║  KDS AI PLATFORM — AUTOMATED TEST SUITE      ║')));
  console.log(bold(cyan('╚══════════════════════════════════════════════╝')));
  console.log(dim(`  Target: ${BASE}`));

  await testHealth();
  await testCreateOrder();
  await testActiveOrders();
  await testStatusTransitions();
  await testBaseAnalytics();
  await testPredictiveInsights();
  await testAIPrepSummary();
  await testNotFound();

  // ─── SUMMARY ───
  const total = passed + failed;
  console.log('\n' + bold(cyan('╔══════════════════════════════════════════════╗')));
  console.log(bold(cyan('║  RESULTS                                     ║')));
  console.log(bold(cyan('╚══════════════════════════════════════════════╝')));
  console.log(`  ${green('Passed:')} ${passed} / ${total}`);
  if (failed > 0) {
    console.log(`  ${red('Failed:')} ${failed} / ${total}`);
  } else {
    console.log(`  ${green('All tests passed. System is fully operational.')}`);
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();
