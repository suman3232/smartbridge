// LIVE email-OTP flow test against the real Supabase project.
// Uses a disposable mail.tm inbox to receive the actual confirmation email, so
// T2/T5 are tested for real (not inferred). Run:
//   node --dns-result-order=ipv4first scripts/otp-live-test.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const out = [];
const rec = (id, name, pass, detail = '') => {
  out.push({ id, name, pass, detail });
  console.log(`${id}  ${pass === null ? 'INFO ' : pass ? 'PASS ' : 'FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- mail.tm disposable inbox ----------
const MT = 'https://api.mail.tm';
async function mtFetch(path, opts = {}, token) {
  const res = await fetch(MT + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers ?? {}) },
  });
  if (!res.ok && res.status !== 201) throw new Error(`mail.tm ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function makeInbox(tag) {
  const domains = await mtFetch('/domains');
  const domain = domains['hydra:member']?.[0]?.domain;
  if (!domain) throw new Error('mail.tm: no domains');
  const address = `ob-otp-${tag}-${Date.now()}@${domain}`;
  const password = `Mt-${Date.now()}-Aa1!`;
  await mtFetch('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
  const { token } = await mtFetch('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
  return { address, token };
}
async function waitForMail(inbox, timeoutMs = 120000, afterId = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await mtFetch('/messages', {}, inbox.token);
    const msgs = list['hydra:member'] ?? [];
    const fresh = afterId ? msgs.filter((m) => m.id !== afterId) : msgs;
    if (fresh.length) {
      const full = await mtFetch(`/messages/${fresh[0].id}`, {}, inbox.token);
      return { id: fresh[0].id, subject: fresh[0].subject, text: full.text ?? '', html: Array.isArray(full.html) ? full.html.join('\n') : (full.html ?? '') };
    }
    await sleep(5000);
  }
  return null;
}
const extractSixDigit = (s) => {
  // Avoid matching digits inside URLs/attributes: strip tags & URLs first.
  const cleaned = s.replace(/https?:\/\/\S+/g, ' ').replace(/<[^>]+>/g, ' ');
  const m = cleaned.match(/(?<!\d)(\d{6})(?!\d)/);
  return m ? m[1] : null;
};

console.log(`\n=== LIVE OTP flow test — ${env.VITE_SUPABASE_URL} ===\n`);

let inbox;
try {
  inbox = await makeInbox('a');
  console.log(`Disposable inbox: ${inbox.address}\n`);
} catch (e) {
  console.log('Could not create disposable inbox (mail.tm unreachable):', e.message);
  console.log('Falling back to signup-behavior checks only.\n');
}

const email = inbox?.address ?? `otp-fallback-${Date.now()}@smartdealtest.com`;
const password = `Otp-${Date.now()}-Aa1!`;
const phone = `+91 91111 ${String(Date.now()).slice(-5)}`;
const c = mk();

// ---------- T1: signup requires verification ----------
const su = await c.auth.signUp({
  email, password,
  options: { data: { full_name: 'OTP Live Test', preferred_role: 'both', phone } },
});
if (su.error) {
  rec('T1', 'signup requires verification (no session)', false, `signup errored: ${su.error.status} ${su.error.message}`);
  if (/sending|smtp|email/i.test(su.error.message)) {
    console.log('\n>>> Signup failed AT THE EMAIL-SENDING STEP — the sender/config is the blocker.');
  }
  process.exit(1);
}
const t1pass = !su.data.session && !!su.data.user;
rec('T1', 'signup requires verification (no session until OTP)', t1pass,
  su.data.session ? 'session returned immediately ⇒ "Confirm email" is OFF on this project' : 'no session — confirmation required');

let token6 = null, mail = null;
if (t1pass && inbox) {
  // ---------- T2: email actually arrives ----------
  mail = await waitForMail(inbox);
  rec('T2', 'OTP email actually delivered (to a non-team address)', !!mail, mail ? `subject: "${mail.subject}"` : 'nothing arrived in 120s');
  if (mail) {
    token6 = extractSixDigit(`${mail.subject}\n${mail.text}\n${mail.html}`);
    const hasLink = /supabase\.co\/auth\/v1\/verify|token_hash=|confirm/i.test(mail.text + mail.html);
    rec('T2b', 'email contains a 6-digit code (template uses {{ .Token }})', !!token6,
      token6 ? `code found: ${token6}` : hasLink ? 'LINK ONLY — template not showing the 6-digit token' : 'neither code nor link found');
  }
} else if (t1pass) {
  rec('T2', 'OTP email delivered', null, 'skipped — no disposable inbox available');
}

// ---------- T3: wrong OTP rejected ----------
if (t1pass) {
  const bad = await c.auth.verifyOtp({ email, token: '000000', type: 'signup' });
  rec('T3', 'wrong OTP rejected', !!bad.error, bad.error?.message);
}

// ---------- T4: resend works (after the server's 48s anti-spam cooldown) ----------
let secondMail = null;
if (t1pass) {
  console.log('      … waiting 55s for the resend cooldown');
  await sleep(55000);
  const rs = await c.auth.resend({ type: 'signup', email });
  if (!rs.error) {
    rec('T4', 'resend OTP succeeds', true);
    if (inbox && mail) {
      secondMail = await waitForMail(inbox, 120000, mail.id);
      rec('T4b', 'resent email actually delivered', !!secondMail, secondMail ? `subject: "${secondMail.subject}"` : 'not delivered in 120s');
    }
  } else {
    rec('T4', 'resend OTP succeeds', false, rs.error.message);
  }
}

// ---------- T5: complete verification and get a session ----------
// The 6-digit path is blocked while the template is link-only, so verify via the
// link the SAME way a user clicking it does (GoTrue verifies the token_hash
// server-side), then prove the account is active by signing in.
let session = null;
if (t1pass && token6) {
  const ok = await c.auth.verifyOtp({ email, token: token6, type: 'signup' });
  session = ok.data?.session ?? null;
  rec('T5', 'correct 6-digit OTP verifies and creates a session', !!session && !ok.error, ok.error?.message ?? `user ${ok.data?.user?.id?.slice(0, 8)}…`);
} else if (t1pass && (secondMail || mail)) {
  const src = (secondMail ?? mail);
  const linkMatch = (src.html + '\n' + src.text).match(/https:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/);
  if (!linkMatch) {
    rec('T5', 'verification completes', false, 'no 6-digit code AND no verify link found in the email');
  } else {
    const resp = await fetch(linkMatch[0].replace(/&amp;/g, '&'), { redirect: 'manual' });
    const redirected = resp.status >= 300 && resp.status < 400;
    const si = await c.auth.signInWithPassword({ email, password });
    session = si.data?.session ?? null;
    rec('T5', 'verification completes and account becomes active (via emailed link; 6-digit entry blocked by link-only template)',
      redirected && !!session && !si.error,
      `verify redirect ${resp.status}; sign-in after verify: ${si.error?.message ?? 'session OK'}`);
  }
} else if (t1pass) {
  rec('T5', 'verification completes', null, 'skipped: no email received');
}

// ---------- T6/T7: post-verification persistence ----------
if (session) {
  const uid = session.user.id;
  await sleep(800);
  const { data: prof } = await c.from('profiles').select('id, full_name, email, phone, referral_code').eq('id', uid).maybeSingle();
  let phoneOk = prof?.phone === phone;
  let phoneNote = phoneOk ? 'saved by DB trigger' : '';
  if (!phoneOk && prof) {
    // The app backfills the pending phone client-side right after verification —
    // simulate exactly that and confirm it persists under RLS.
    const { error: upErr } = await c.from('profiles').update({ phone }).eq('id', uid);
    if (!upErr) {
      const { data: p2 } = await c.from('profiles').select('phone').eq('id', uid).maybeSingle();
      phoneOk = p2?.phone === phone;
      phoneNote = phoneOk ? 'via client backfill (app behavior); DB trigger did not persist it' : 'backfill failed';
    }
  }
  rec('T6', 'phone persists after verification', phoneOk, phoneNote);
  const { data: wallet } = await c.from('wallets').select('user_id, balance').eq('user_id', uid).maybeSingle();
  rec('T7a', 'profile created with referral code', !!prof && !!prof.referral_code, prof ? `code ${prof.referral_code}` : 'no profile row');
  rec('T7b', 'wallet auto-created', !!wallet, wallet ? `balance ${wallet.balance}` : 'no wallet row');
  // Referral attribution post-verification (the app calls apply_referral_code
  // with an invalid + self code to prove the RPC path is live and guarded).
  const selfTry = await c.rpc('apply_referral_code', { p_code: prof?.referral_code ?? 'XXXXXXXX' });
  const selfBlocked = selfTry.error || selfTry.data?.applied === false;
  const badTry = await c.rpc('apply_referral_code', { p_code: 'NOPE0000' });
  const badBlocked = badTry.error || badTry.data?.applied === false;
  rec('T7c', 'referral RPC live post-verification (self + invalid codes rejected)', !!selfBlocked && !!badBlocked,
    `self:${selfTry.error?.message ?? JSON.stringify(selfTry.data)} invalid:${badTry.error?.message ?? JSON.stringify(badTry.data)}`);
}

console.log('\n=== summary ===');
out.forEach((r) => console.log(`${r.id}: ${r.pass === null ? 'INFO' : r.pass ? 'PASS' : 'FAIL'}`));
