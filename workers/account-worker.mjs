import { handleShop } from './shop-worker.mjs';

const accountPath = '/api/account';
const sessionCookie = '__Host-mumipo-session';
const earliestRewardMs = 45_000;
const roundLifetimeMs = 2 * 60 * 60 * 1000;

function json(body, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(body, { status, headers });
}

function cookieValue(token, seconds) {
  return sessionCookie + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + seconds;
}

async function accountFor(env, user) {
  const name = user.user_metadata?.name;
  const stars = await env.PICNIC_REWARDS?.prepare('SELECT stars FROM picnic_wallets WHERE user_id = ?')
    .bind(user.id).first('stars');
  return {
    name: typeof name === 'string' ? name.trim().slice(0, 32) : '',
    email: user.email,
    stars: stars ?? 0,
  };
}

async function auth(env, path, { token, method = 'GET', body } = {}) {
  const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(new URL('/auth/v1/' + path, env.SUPABASE_URL), {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
}

async function handleAccount(request, env, url) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return json({ message: 'Grown-up accounts are not open yet.' }, 503);
  }

  const path = url.pathname.slice(accountPath.length);
  const token = request.headers.get('Cookie')?.split('; ')
    .find(entry => entry.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1);

  if (path === '' && request.method === 'GET') {
    if (!token) {
      const settings = await auth(env, 'settings');
      if (!settings.ok) return json({ message: 'Account service is temporarily unavailable.' }, 503);
      const { external } = await settings.json();
      return json({ account: null, emailReady: external?.email === true && env.AUTH_EMAIL_READY === 'true' });
    }
    const response = await auth(env, 'user', { token });
    if (response.status === 401 || response.status === 403) {
      return json({ account: null }, 200, cookieValue('', 0));
    }
    if (!response.ok) return json({ message: 'Account service is temporarily unavailable.' }, 503);
    return json({ account: await accountFor(env, await response.json()) });
  }

  if (request.method !== 'POST') return json({ message: 'Page not found.' }, 404);
  if (request.headers.get('Origin') !== url.origin) return json({ message: 'Request not allowed.' }, 403);

  if (path === '/sign-out') {
    if (token) await auth(env, 'logout?scope=local', { token, method: 'POST' }).catch(() => {});
    return json({ account: null }, 200, cookieValue('', 0));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ message: 'Check the information you entered.' }, 400);

  if (path === '/name') {
    if (!token) return json({ message: 'Please sign in again.' }, 401);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 32) return json({ message: 'Enter a name up to 32 characters.' }, 400);
    const response = await auth(env, 'user', { token, method: 'PUT', body: { data: { name } } });
    if (!response.ok) return json({ message: 'Could not save your name. Please try again.' }, response.status === 401 ? 401 : 502);
    return json({ account: await accountFor(env, await response.json()) });
  }

  if (path === '/picnic/start' || path === '/picnic/finish') {
    if (!env.PICNIC_REWARDS) return json({ message: 'Star saving is unavailable.' }, 503);
    if (!token) return json({ message: 'Sign in to save picnic stars.' }, 401);
    const response = await auth(env, 'user', { token });
    if ([401, 403].includes(response.status)) return json({ message: 'Please sign in again.' }, 401);
    if (!response.ok) return json({ message: 'Star saving is unavailable.' }, 503);
    const { id } = await response.json();
    const now = Date.now();
    if (path === '/picnic/start') {
      const round = crypto.randomUUID();
      await env.PICNIC_REWARDS.prepare(`INSERT INTO picnic_wallets (user_id, round_id, started_at)
        VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
        round_id = excluded.round_id, started_at = excluded.started_at`).bind(id, round, now).run();
      return json({ round });
    }

    if (typeof body.round !== 'string' || !/^[a-f0-9-]{36}$/.test(body.round)) {
      return json({ message: 'Play a new picnic round to earn a star.' }, 400);
    }
    const saved = await env.PICNIC_REWARDS.prepare(`UPDATE picnic_wallets
      SET stars = stars + 1, last_reward_id = round_id, round_id = NULL, started_at = NULL
      WHERE user_id = ? AND round_id = ? AND started_at BETWEEN ? AND ?
      RETURNING stars`).bind(id, body.round, now - roundLifetimeMs, now - earliestRewardMs).first();
    if (saved) return json(saved);
    const earlierSave = await env.PICNIC_REWARDS.prepare('SELECT stars FROM picnic_wallets WHERE user_id = ? AND last_reward_id = ?')
      .bind(id, body.round).first();
    return earlierSave ? json(earlierSave) : json({ message: 'This picnic round can no longer be saved.' }, 409);
  }

  if (path !== '/send' && path !== '/verify') return json({ message: 'Page not found.' }, 404);
  if (env.AUTH_EMAIL_READY !== 'true') return json({ message: 'Email sign-in is still being set up.' }, 503);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ message: 'Enter a valid email address.' }, 400);
  }

  if (path === '/send') {
    const response = await auth(env, 'otp', { method: 'POST', body: { email, create_user: true } });
    if (!response.ok) return json({ message: 'Could not send a code. Please wait a minute and try again.' }, response.status === 429 ? 429 : 502);
    return json({});
  }

  if (typeof body.code !== 'string' || !/^\d{6,10}$/.test(body.code)) return json({ message: 'Enter the code from your email.' }, 400);
  const response = await auth(env, 'verify', { method: 'POST', body: { email, token: body.code, type: 'email' } });
  if (!response.ok) return json({ message: 'That code could not be verified. Check it or request a new one.' }, response.status === 429 ? 429 : 400);
  const session = await response.json();
  if (!session.access_token || !session.user || !session.expires_in) return json({ message: 'Sign-in service is temporarily unavailable.' }, 502);
  return json({ account: await accountFor(env, session.user) }, 200, cookieValue(session.access_token, session.expires_in));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.SHOP_TEST_PREVIEW === 'true' && (url.pathname === '/api/shop' || url.pathname.startsWith('/api/shop/'))) {
      return handleShop(request, env, url);
    }
    if (url.pathname !== accountPath && !url.pathname.startsWith(accountPath + '/')) return env.ASSETS.fetch(request);
    try { return await handleAccount(request, env, url); }
    catch { return json({ message: 'Account service is temporarily unavailable.' }, 503); }
  },
};
