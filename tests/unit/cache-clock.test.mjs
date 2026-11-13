import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheClock, cacheFromResume, cacheFromStatus, cacheGuess, TTL_MS } from '../../src/shared/cache-clock.js';

const NOW = 1_800_000_000_000;

test('from the status line: warm until expires_at, then cold, re-reading what it says', () => {
  // (the documented example: code.claude.com/docs/en/statusline, prompt_cache)
  const c = cacheFromStatus({ warm: true, caching_observed: true, ttl: '1h', expires_at: NOW / 1000 + 23 * 60, hit_ratio: 0.91, recache_tokens_if_cold: 45000 });
  assert.deepEqual(c, { until: NOW + 23 * 60e3, ttl: '1h', tokens: 45000, guessed: false });
  const k = cacheClock(c, NOW);
  assert.equal(k.state, 'warm'); assert.equal(Math.round(k.left / 60e3), 23); assert.ok(Math.abs(k.warmth - 23 / 60) < 1e-9);
  assert.equal(cacheClock(c, NOW + 23 * 60e3).state, 'cold');
  assert.equal(cacheClock(c, NOW + 23 * 60e3).warmth, 0);
  assert.equal(cacheClock(c, NOW + 30 * 60e3).tokens, 45000);
});

test('from the status line: cold when the last response had no cache, nothing when caching is off', () => {
  assert.equal(cacheClock(cacheFromStatus({ warm: false, caching_observed: true, ttl: '5m', expires_at: null, recache_tokens_if_cold: 9000 }), NOW).state, 'cold');
  assert.equal(cacheFromStatus({ warm: false, caching_observed: false }), null);
  assert.equal(cacheFromStatus(undefined), null);
  // right after a compaction it doesn't know what a cold start re-reads: the context's size stands in
  assert.equal(cacheFromStatus({ warm: true, ttl: '5m', expires_at: NOW / 1000 + 60, recache_tokens_if_cold: null }, 52000).tokens, 52000);
  assert.equal(cacheFromStatus({ warm: true, ttl: 'weird', expires_at: NOW / 1000 + 60 }).ttl, '5m');
});

test('a resumed session: SessionStart says whether it is likely cold, and what the first request re-sends', () => {
  const cold = cacheFromResume({ source: 'resume', seconds_since_last_response: 5400, context_tokens: 182340, prompt_cache_likely_expired: true, estimated_cache_write_usd: 1.1396 }, '1h', NOW);
  assert.equal(cacheClock(cold, NOW).state, 'cold');
  assert.equal(cold.tokens, 182340); assert.equal(cold.usd, 1.1396);
  const warm = cacheFromResume({ source: 'fork', seconds_since_last_response: 120, context_tokens: 30000, prompt_cache_likely_expired: false }, '5m', NOW);
  assert.equal(warm.until, NOW - 120e3 + TTL_MS['5m']); assert.equal(warm.guessed, true);
  assert.equal(cacheFromResume({ source: 'startup' }, '5m', NOW), null, 'a new session says nothing');
});

test('no word from Claude Code: the last response plus the documented lifetime, marked as a guess', () => {
  const g = cacheGuess(NOW - 4 * 60e3, 120000, '5m');
  assert.equal(cacheClock(g, NOW).state, 'warm'); assert.equal(cacheClock(g, NOW).guessed, true);
  assert.equal(Math.round(cacheClock(g, NOW).left / 60e3), 1);
  assert.equal(cacheClock(g, NOW + 60e3).state, 'cold');
  assert.equal(cacheClock(cacheGuess(NOW - 50 * 60e3, 1, '1h'), NOW).state, 'warm');
  assert.deepEqual(cacheClock(null, NOW), { state: 'none', left: 0, warmth: 0, tokens: 0, guessed: false });
});

