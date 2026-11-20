const testProducts = {
  plink_1Ubfs5FsZftPYE5lwf9k9MVa: { key: 'plush', title: 'Mumipo Plush', amount: 19900 },
  plink_1UbpVOFsZftPYE5lnSySFX56: { key: 'coloring', title: 'Mumipo’s Coloring Book', amount: 9900 },
};
const acceptedEvents = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);
const sessionPattern = /^cs_test_[A-Za-z0-9]{10,160}$/;
const maxEventBytes = 128 * 1024;
const utf8 = new TextEncoder();

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readEvent(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxEventBytes);
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, offset));
    if (offset + value.length > bytes.length) {
      await reader.cancel();
      return null;
    }
    bytes.set(value, offset);
    offset += value.length;
  }
}

async function verifyStripeSignature(header, body, signingSecret) {
  const parts = header.split(',').map(part => part.trim());
  const timestamp = parts.find(part => /^t=\d+$/.test(part))?.slice(2);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const signatures = parts.filter(part => /^v1=[a-f0-9]{64}$/.test(part));
  if (!signatures.length) return false;
  const key = await crypto.subtle.importKey('raw', utf8.encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const message = utf8.encode(timestamp + '.' + body);
  const verified = await Promise.all(signatures.map(part => {
    const signature = Uint8Array.from(part.slice(3).match(/../g), byte => Number.parseInt(byte, 16));
    return crypto.subtle.verify('HMAC', key, signature, message);
  }));
  return verified.includes(true);
}

async function receiveEvent(request, env) {
  const signature = request.headers.get('Stripe-Signature');
  if (!signature || signature.length > 2048) return json({ message: 'Invalid Stripe signature.' }, 400);
  if (!env.STRIPE_TEST_WEBHOOK_SECRET) return json({ message: 'Test order confirmation is not connected yet.' }, 503);
  const body = await readEvent(request).catch(() => null);
  if (body === null || !await verifyStripeSignature(signature, body, env.STRIPE_TEST_WEBHOOK_SECRET)) {
    return json({ message: 'Invalid Stripe signature.' }, 400);
  }
  let event;
  try { event = JSON.parse(body); }
  catch { return json({ message: 'Invalid Stripe event.' }, 400); }

  const session = event?.data?.object;
  if (event?.livemode !== false || !acceptedEvents.has(event.type) ||
      session?.livemode !== false || session.object !== 'checkout.session' ||
      session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid' ||
      !sessionPattern.test(session.id) || !Object.hasOwn(testProducts, session.payment_link)) return json({ received: true });

  const product = testProducts[session.payment_link];
  if (session.currency !== 'sek' || session.amount_total !== product.amount) return json({ received: true });

  await env.PICNIC_REWARDS.prepare(`INSERT INTO shop_test_orders (session_id, product, amount, currency, confirmed_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING`)
    .bind(session.id, product.key, session.amount_total, session.currency, Date.now()).run();
  return json({ received: true });
}

async function confirmOrder(request, env) {
  const form = await request.json().catch(() => null);
  if (typeof form?.sessionId !== 'string' || !sessionPattern.test(form.sessionId)) {
    return json({ message: 'This test order could not be found.' }, 404);
  }
  if (!env.STRIPE_TEST_WEBHOOK_SECRET) return json({ message: 'Automatic test order confirmation is not connected yet.' }, 503);
  const order = await env.PICNIC_REWARDS.prepare('SELECT product, amount FROM shop_test_orders WHERE session_id = ?')
    .bind(form.sessionId).first();
  if (!order) return json({ state: 'pending' }, 202);
  const product = Object.values(testProducts).find(item => item.key === order.product);
  return json({ state: 'confirmed', title: product.title, amount: order.amount, currency: 'sek' });
}

export async function handleShop(request, env, url) {
  if (url.pathname === '/api/shop' && request.method === 'GET') {
    return json({ orderConfirmationReady: Boolean(env.STRIPE_TEST_WEBHOOK_SECRET) });
  }
  if (request.method !== 'POST') return json({ message: 'Page not found.' }, 404);
  try {
    if (url.pathname === '/api/shop/stripe-event') return await receiveEvent(request, env);
    if (url.pathname === '/api/shop/confirm') {
      if (request.headers.get('Origin') !== url.origin) return json({ message: 'Request not allowed.' }, 403);
      return await confirmOrder(request, env);
    }
    return json({ message: 'Page not found.' }, 404);
  } catch {
    return json({ message: 'Test order confirmation is temporarily unavailable.' }, 503);
  }
}
