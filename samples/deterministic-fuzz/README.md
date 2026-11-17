# Deterministic fuzz-testing sample

A dependency-free Node.js example of testing a decoder against unpredictable byte input.

## Run

Requires Node.js 20 or newer:

```bash
node --test samples/deterministic-fuzz/decoder.test.mjs
```

## What it demonstrates

- A fixed-seed xorshift generator, so a failing sequence can be reproduced.
- 5,000 arbitrary byte sequences checked against a documented result contract.
- 500 generated valid transaction envelopes checked for correct normalization.
- Explicit checks that malformed input produces a plain `Error`, not an internal `TypeError`.
- A one-second runtime budget for the random-input pass.
- No third-party dependencies and no network access.

The decoder is intentionally a small teaching fixture, not a production Solana RPC parser. The sample demonstrates a testing technique and does not claim to modify or contribute to another project's codebase.
