/**
 * Small defensive decoder used by the deterministic fuzz-testing sample.
 * It accepts UTF-8 JSON bytes containing a minimal Solana transaction envelope.
 * Invalid input is reported as a plain Error; JSON null is a valid "no result".
 */
export function decodeTransactionEnvelope(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("expected UTF-8 bytes");
  }

  let value;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch {
    throw new Error("invalid UTF-8 JSON payload");
  }

  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected a transaction object");
  }

  const message = value.transaction?.message;
  const meta = value.meta;
  if (!message || typeof message !== "object" || !meta || typeof meta !== "object") {
    throw new Error("missing transaction message or metadata");
  }

  const accountKeys = message.accountKeys;
  const preBalances = meta.preBalances;
  const postBalances = meta.postBalances;

  if (!Array.isArray(accountKeys) || !Array.isArray(preBalances) || !Array.isArray(postBalances)) {
    throw new Error("missing account keys or balance arrays");
  }
  if (preBalances.length !== accountKeys.length || postBalances.length !== accountKeys.length) {
    throw new Error("balance arrays must match account key count");
  }

  const normalizedKeys = accountKeys.map((key) => {
    const pubkey = typeof key === "string" ? key : key?.pubkey;
    if (typeof pubkey !== "string" || pubkey.length === 0) {
      throw new Error("account key must be a non-empty string");
    }
    return pubkey;
  });

  const normalizeBalances = (balances) => balances.map((balance) => {
    if (!Number.isSafeInteger(balance) || balance < 0) {
      throw new Error("balances must be non-negative safe integers");
    }
    return balance;
  });

  return {
    accountKeys: normalizedKeys,
    preBalances: normalizeBalances(preBalances),
    postBalances: normalizeBalances(postBalances),
  };
}
