import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Saved follow-up lists hold customer IDs and private notes. This checks, in the real app, that switching accounts
 * or signing out never shows the previous account's lists, even while the next account's lists are still loading,
 * and that guest lists in the browser are never pulled into an account on their own.
 *
 * Supabase is fully mocked inside the browser (page.route): no request leaves the machine, no real account is used,
 * and the sessions are fake test tokens. Row-level security on the real database is checked separately
 * (scripts/rls-check.sql).
 */
const REF = 'txxrblgxnwxuuvyqyzuw';
const HOST = `https://${REF}.supabase.co`;
const KEY = `sb-${REF}-auth-token`;
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub: string, email: string) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.test-signature`;
const user = (id: string, email: string) => ({
  id,
  email,
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
});
const session = (id: string, email: string) => ({
  access_token: jwt(id, email),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: `refresh-${id}`,
  user: user(id, email),
});
const A = { id: 'aaaaaaaa-0000-4000-8000-00000000000a', email: 'owner-a@example.test' };
const B = { id: 'bbbbbbbb-0000-4000-8000-00000000000b', email: 'owner-b@example.test' };
const list = (who: string, customer: string, note: string) => ({
  id: `list-${who}`,
  name: `Follow-up · list of ${who}`,
  since: '2011-12-10',
  source: 'Demo online shop',
  replay: false,
  meta: { shop: `Shop ${who}`, dataEnd: '2011-12-09', currency: 'GBP', rule: 'r', total: 100 },
  accounts: [
    {
      customer,
      email: null,
      spend: 100,
      share: 100,
      orders: 3,
      typicalGapDays: 20,
      daysSilent: 120,
      lastOrder: '2011-08-01',
      status: 'contacted',
      contactedOn: '2011-12-12',
      note,
    },
  ],
  last_check: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

/** Mock every Supabase call. `current` decides whose rows the REST API returns; B's lists arrive late. */
async function mockSupabase(page: Page, state: { current: 'A' | 'B' | null }) {
  await page.route(`${HOST}/**`, async (route: Route) => {
    const url = route.request().url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/auth/v1/token')) {
      state.current = 'B';
      return json(session(B.id, B.email));
    }
    if (url.includes('/auth/v1/logout')) {
      state.current = null;
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('/auth/v1/user')) return json(state.current === 'B' ? user(B.id, B.email) : user(A.id, A.email));
    if (url.includes('/rest/v1/profiles'))
      return json(
        state.current
          ? { id: state.current === 'A' ? A.id : B.id, display_name: null, shop_name: null, accent: 'violet' }
          : null,
      );
    if (url.includes('/rest/v1/follow_up_lists')) {
      if (route.request().method() !== 'GET') return json([]);
      if (state.current === 'A') return json([list('A', 'A-CUSTOMER-111', 'A-PRIVATE-NOTE')]);
      if (state.current === 'B') {
        await new Promise((r) => setTimeout(r, 2500)); // B's rows are slow: A's must not linger meanwhile
        return json([list('B', 'B-CUSTOMER-222', 'B-PRIVATE-NOTE')]);
      }
      return json([]);
    }
    if (url.includes('/rest/v1/saved_analyses')) return json([]);
    return json({});
  });
}

/** Open a saved list: it may already be open (lists from the loaded shop open themselves), else use the picker. */
async function openList(page: Page, name: string) {
  const picker = page.getByText('Select a saved list...');
  await expect(page.getByText(name).or(picker).first()).toBeVisible({ timeout: 15_000 });
  if (await picker.isVisible()) {
    await picker.click();
    await page.getByRole('button', { name }).click();
  }
}

test('switching accounts never shows the previous account’s lists or notes', async ({ page }) => {
  const state: { current: 'A' | 'B' | null } = { current: 'A' };
  await mockSupabase(page, state);
  // Signed in as A, with one guest list also sitting in this browser from an earlier visit.
  await page.addInitScript(
    ([key, s, guest]) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem(key, s);
        localStorage.setItem('blindspot.followups.v1', guest);
        sessionStorage.setItem('__seeded', '1');
      }
    },
    [KEY, JSON.stringify(session(A.id, A.email)), JSON.stringify([list('GUEST', 'GUEST-CUSTOMER-333', 'GUEST-NOTE')])],
  );
  await page.goto('/#/customers');
  await expect(page.getByText('Saved to your account')).toBeVisible();
  // A's list (made from the loaded shop) opens on its own.
  await openList(page, 'Follow-up · list of A');
  await expect(page.getByText('A-CUSTOMER-111')).toBeVisible();
  // The guest list is never shown inside A's account; A is told about it instead.
  await expect(page.getByText('GUEST-CUSTOMER-333')).toHaveCount(0);
  await expect(page.getByText(/saved in this browser as a guest/)).toBeVisible();

  // Sign out: nothing of A's remains, and only this browser's guest lists are available.
  await page.goto('/#/account?tab=security');
  await page.getByRole('button', { name: /Log out/ }).click();
  await page.goto('/#/customers');
  await expect(page.getByText('Saved in this browser')).toBeVisible();
  const body1 = await page.locator('body').innerText();
  expect(body1).not.toContain('A-CUSTOMER-111');
  expect(body1).not.toContain('A-PRIVATE-NOTE');

  // Log in as B (mocked). While B's lists are still loading, no A data may appear.
  await page.goto('/#/login');
  await page.locator('input[type="email"]').fill(B.email);
  await page.locator('input[type="password"]').fill('test-password-not-real');
  await page.locator('form button[type="submit"], form button:has-text("Log in")').last().click();
  await page.goto('/#/customers');
  for (let i = 0; i < 5; i++) {
    const t = await page.locator('body').innerText();
    expect(t).not.toContain('A-CUSTOMER-111');
    expect(t).not.toContain('A-PRIVATE-NOTE');
    await page.waitForTimeout(400);
  }
  await openList(page, 'Follow-up · list of B');
  await expect(page.getByText('B-CUSTOMER-222')).toBeVisible({ timeout: 15_000 });
  const body2 = await page.locator('body').innerText();
  expect(body2).not.toContain('A-CUSTOMER-111');
  expect(body2).not.toContain('GUEST-CUSTOMER-333');
});
