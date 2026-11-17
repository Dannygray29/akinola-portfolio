import test from "node:test";
import assert from "node:assert/strict";
import { decodeTransactionEnvelope } from "./decoder.mjs";

const SEED = 0x6d2b79f5;

// A tiny deterministic PRNG. Keeping the seed fixed makes every failure repeatable.
function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    },
    int(max) {
      return this.next() % max;
    },
  };
}

function randomBytes(random, maxLength = 256) {
  const bytes = new Uint8Array(random.int(maxLength + 1));
  for (let i = 0; i < bytes.length; i++) bytes[i] = random.int(256);
  return bytes;
}

function assertAllowedOutcome(bytes, iteration) {
  try {
    const result = decodeTransactionEnvelope(bytes);
    if (result === null) return;
    assert.equal(typeof result, "object", `seed=${SEED} iteration=${iteration}: result must be an object or null`);
    assert.ok(Array.isArray(result.accountKeys), `seed=${SEED} iteration=${iteration}: accountKeys must be an array`);
    assert.ok(Array.isArray(result.preBalances), `seed=${SEED} iteration=${iteration}: preBalances must be an array`);
    assert.ok(Array.isArray(result.postBalances), `seed=${SEED} iteration=${iteration}: postBalances must be an array`);
    assert.equal(result.accountKeys.length, result.preBalances.length);
    assert.equal(result.accountKeys.length, result.postBalances.length);
  } catch (error) {
    // Internal TypeErrors usually mean malformed input reached an unsafe property access.
    assert.equal(
      error?.constructor,
      Error,
      `seed=${SEED} iteration=${iteration}: only a plain Error may be thrown; received ${error?.constructor?.name}`,
    );
  }
}

test("random byte sequences never crash the decoder with an internal error", () => {
  const random = createRandom(SEED);
  const started = performance.now();

  for (let i = 0; i < 5_000; i++) {
    assertAllowedOutcome(randomBytes(random), i);
  }

  const elapsed = performance.now() - started;
  assert.ok(elapsed < 1_000, `seed=${SEED}: 5,000 cases took ${elapsed.toFixed(1)}ms (limit: 1,000ms)`);
});

test("valid generated envelopes always normalize to the documented shape", () => {
  const random = createRandom(SEED ^ 0xa5a5a5a5);

  for (let i = 0; i < 500; i++) {
    const count = random.int(8);
    const accountKeys = Array.from({ length: count }, (_, index) => (
      index % 2 === 0 ? `Account-${random.next().toString(16)}` : { pubkey: `Account-${random.next().toString(16)}` }
    ));
    const preBalances = Array.from({ length: count }, () => random.int(10_000_000));
    const postBalances = Array.from({ length: count }, () => random.int(10_000_000));
    const payload = { transaction: { message: { accountKeys } }, meta: { preBalances, postBalances } };
    const decoded = decodeTransactionEnvelope(new TextEncoder().encode(JSON.stringify(payload)));

    assert.deepEqual(decoded.accountKeys, accountKeys.map((key) => typeof key === "string" ? key : key.pubkey));
    assert.deepEqual(decoded.preBalances, preBalances);
    assert.deepEqual(decoded.postBalances, postBalances);
  }
});

test("malformed UTF-8, malformed JSON, and inconsistent shapes produce plain Errors", () => {
  for (const bytes of [
    new Uint8Array([0xff, 0xfe]),
    new TextEncoder().encode("{"),
    new TextEncoder().encode(JSON.stringify({ transaction: { message: { accountKeys: ["A"] } }, meta: { preBalances: [], postBalances: [] } })),
  ]) {
    assert.throws(() => decodeTransactionEnvelope(bytes), (error) => error.constructor === Error);
  }

  assert.equal(decodeTransactionEnvelope(new TextEncoder().encode("null")), null);
});
