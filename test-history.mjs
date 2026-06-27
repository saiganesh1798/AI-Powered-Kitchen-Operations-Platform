const BASE = 'http://localhost:3001';

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

console.log(c.bold(c.cyan('=== TESTING ORDER HISTORY ENDPOINT ===')));

try {
  const res = await fetch(`${BASE}/api/orders/history`);
  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }
  const data = await res.json();
  
  console.log(`\n${c.green('✔')} ${c.bold('Endpoint Response Received')}`);
  console.log(`  Date: ${c.cyan(data.date)}`);
  console.log(`  Total Served Today: ${c.bold(data.totalServed)}`);
  console.log(`  Breach Count: ${c.red(data.breachCount)}`);
  console.log(`  Avg Prep Minutes: ${c.cyan(data.avgPrepMinutes + 'm')}`);
  
  console.log(`\n${c.bold('Orders List:')}`);
  if (data.orders.length === 0) {
    console.log(c.dim('  (No orders served yet today)'));
  } else {
    data.orders.forEach((order, idx) => {
      console.log(`  ${idx + 1}. Order ${c.dim(order._id)}`);
      console.log(`     Table Number: ${c.bold(order.tableNumber)}`);
      console.log(`     Total Items: ${order.totalItems}`);
      console.log(`     Prep Duration: ${order.prepDurationMs ? (order.prepDurationMs / 1000).toFixed(1) + 's' : 'N/A'}`);
      console.log(`     SLA Breached: ${order.slaBreached ? c.red('YES') : c.green('NO')}`);
      console.log(`     Items: ${order.items.map(i => `${i.quantity}x ${i.name} [${i.station || 'assembly'}]`).join(', ')}`);
    });
  }
} catch (error) {
  console.error(`${c.red('✘')} Failed to connect or fetch history:`, error.message);
  process.exit(1);
}
