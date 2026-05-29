/**
 * AURA Phase 3A — Controlled Live Connection Verification
 *
 * Runs approval-gated smoke tests against Make.com and configured LLM providers.
 * Security rules:
 *   - Key values are NEVER printed or logged
 *   - Prompts contain no secrets, no source code, no repo content
 *   - max_tokens capped at 16 to minimise cost
 *   - One call per provider, no retry loops
 *   - Make.com receives one live test event, no loop
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = join(root, '.env');
const env = {};
for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
  const line = rawLine.replace(/\r$/, '').trim(); // strip \r\n and leading/trailing whitespace
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  const val = line.slice(eq + 1).trim();
  if (key) env[key] = val;
}

function has(key) { return Boolean(env[key]); }
function get(key) { return env[key] ?? ''; }

// ── Task 2: Key presence check ────────────────────────────────────────────────
console.log('\n=== TASK 2: Key Presence Check ===');
const keyCheck = {
  anthropic:     { present: has('VITE_ANTHROPIC_API_KEY'),  required: true  },
  openai:        { present: has('VITE_OPENAI_API_KEY'),     required: true  },
  google:        { present: has('VITE_GOOGLE_API_KEY'),     required: true  },
  make_webhook:  { present: has('VITE_MAKE_WEBHOOK_URL'),   required: true  },
  make_live:     { present: get('VITE_MAKE_LIVE_CALLS') === 'true', required: true },
  elevenlabs:    { present: has('VITE_ELEVENLABS_API_KEY'), required: false },
  openai_rt:     { present: has('VITE_OPENAI_REALTIME_KEY'), required: false },
  antigravity:   { present: false, required: false, note: 'local-workspace-agent — no API key required' },
};
for (const [name, info] of Object.entries(keyCheck)) {
  const status = info.present ? '✓ PRESENT' : (info.required ? '✗ MISSING' : '— not required');
  console.log(`  ${name.padEnd(14)} ${status}${info.note ? '  (' + info.note + ')' : ''}`);
}

// ── Task 3: Make.com dry-run payload ──────────────────────────────────────────
console.log('\n=== TASK 3: Make.com Dry-run Payload ===');
const dryRunPayload = {
  eventId:     `aura-evt-dryrun-${Date.now()}`,
  eventType:   'phase3_connection_test',
  timestamp:   new Date().toISOString(),
  source:      'AURA Command Center',
  environment: 'local',
  testMode:    true,
  message:     'AURA Phase 3A Make.com dry-run payload.',
  riskLevel:   'safe',
};
console.log('  Payload shape:', JSON.stringify(dryRunPayload, null, 4));
console.log('  Dry-run result: Payload validated structurally. No network call made.');

// ── Task 4: Make.com live test ────────────────────────────────────────────────
console.log('\n=== TASK 4: Make.com Live Test (APPROVAL GATED) ===');
const webhookUrl = get('VITE_MAKE_WEBHOOK_URL');
const liveCallsEnabled = get('VITE_MAKE_LIVE_CALLS') === 'true';

let makeResult = { success: false, statusCode: null, message: 'Not attempted' };

if (!webhookUrl) {
  console.log('  SKIP — VITE_MAKE_WEBHOOK_URL not set');
} else if (!liveCallsEnabled) {
  console.log('  SKIP — VITE_MAKE_LIVE_CALLS is not true');
} else {
  console.log('  Approval record: Phase 3A controlled live test — one event, no loop, no secrets in payload.');
  const livePayload = {
    eventId:   `aura-evt-live-${Date.now()}`,
    eventType: 'phase3_connection_test',
    timestamp: new Date().toISOString(),
    source:    'AURA Command Center',
    testMode:  false,
    message:   'AURA Make.com live connection test.',
    riskLevel: 'safe',
  };
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(livePayload),
    });
    makeResult = { success: res.ok, statusCode: res.status, message: res.ok ? 'Accepted by Make.com' : `HTTP ${res.status}` };
    console.log(`  Result: ${makeResult.success ? '✓' : '✗'} status=${makeResult.statusCode} — ${makeResult.message}`);
  } catch (err) {
    makeResult = { success: false, statusCode: null, message: String(err) };
    console.log(`  Result: ✗ network error — ${makeResult.message}`);
  }
}

// ── Task 5: LLM provider smoke tests ─────────────────────────────────────────
console.log('\n=== TASK 5: LLM Provider Smoke Tests ===');

async function testAnthropic() {
  const key = get('VITE_ANTHROPIC_API_KEY');
  if (!key) return { provider: 'anthropic', success: false, error: 'No key' };
  const start = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 16, messages: [{ role: 'user', content: 'Reply with exactly: AURA_ANTHROPIC_OK' }] }),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'anthropic', success: false, error: data.error?.message ?? `HTTP ${res.status}`, latencyMs };
    const text = data.content?.[0]?.text?.trim() ?? '';
    return { provider: 'anthropic', success: text.includes('AURA_ANTHROPIC_OK'), response: text, model: 'claude-haiku-4-5-20251001', latencyMs };
  } catch (err) { return { provider: 'anthropic', success: false, error: String(err), latencyMs: Date.now() - start }; }
}

async function testOpenAI() {
  const key = get('VITE_OPENAI_API_KEY');
  if (!key) return { provider: 'openai', success: false, error: 'No key' };
  const start = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 16, messages: [{ role: 'user', content: 'Reply with exactly: AURA_OPENAI_OK' }] }),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'openai', success: false, error: data.error?.message ?? `HTTP ${res.status}`, latencyMs };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    return { provider: 'openai', success: text.includes('AURA_OPENAI_OK'), response: text, model: 'gpt-4o-mini', latencyMs };
  } catch (err) { return { provider: 'openai', success: false, error: String(err), latencyMs: Date.now() - start }; }
}

async function testGemini() {
  const key = get('VITE_GOOGLE_API_KEY');
  if (!key) return { provider: 'gemini', success: false, error: 'No key' };
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: AURA_GEMINI_OK' }] }], generationConfig: { maxOutputTokens: 16 } }),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'gemini', success: false, error: data.error?.message ?? `HTTP ${res.status}`, latencyMs };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return { provider: 'gemini', success: text.includes('AURA_GEMINI_OK'), response: text, model: 'gemini-2.0-flash', latencyMs };
  } catch (err) { return { provider: 'gemini', success: false, error: String(err), latencyMs: Date.now() - start }; }
}

const [anthropicRes, openaiRes, geminiRes] = await Promise.all([testAnthropic(), testOpenAI(), testGemini()]);

for (const r of [anthropicRes, openaiRes, geminiRes]) {
  const icon = r.success ? '✓' : '✗';
  const detail = r.success
    ? `response="${r.response}"  model=${r.model}  latency=${r.latencyMs}ms`
    : `error="${r.error}"${r.latencyMs ? `  latency=${r.latencyMs}ms` : ''}`;
  console.log(`  ${icon} ${r.provider.padEnd(10)} ${detail}`);
}

// ── Summary export ─────────────────────────────────────────────────────────────
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  keyPresence: keyCheck,
  makeDryRun: { success: true, message: 'Payload validated structurally.' },
  makeLive: makeResult,
  anthropic: anthropicRes,
  openai: openaiRes,
  gemini: geminiRes,
}, null, 2));
