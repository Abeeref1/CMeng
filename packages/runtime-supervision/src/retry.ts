import type {
  RetryDecision,
  RetryPolicy,
} from "./types";

export const DEFAULT_CONNECTION_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitterRatio: 0,
  maxAttempts: null,
};

export function retryDecision(
  attempt: number,
  policy: RetryPolicy =
    DEFAULT_CONNECTION_RETRY_POLICY,
): RetryDecision {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new Error(
      "attempt must be a non-negative integer",
    );
  }

  const giveUp =
    policy.maxAttempts !== null &&
    attempt >= policy.maxAttempts;

  const raw =
    policy.baseDelayMs *
    Math.pow(policy.multiplier, attempt);
  const bounded = Math.min(
    policy.maxDelayMs,
    Math.max(policy.baseDelayMs, raw),
  );

  return {
    attempt,
    delayMs: Math.round(bounded),
    giveUp,
  };
}

export async function supervisedConnectionAttempt<T>(
  operation: () => Promise<T>,
  attempt: number,
  policy: RetryPolicy =
    DEFAULT_CONNECTION_RETRY_POLICY,
): Promise<
  | { status: "success"; value: T }
  | {
      status: "retry";
      decision: RetryDecision;
      error: Error;
    }
> {
  try {
    return {
      status: "success",
      value: await operation(),
    };
  } catch (error) {
    const decision = retryDecision(
      attempt,
      policy,
    );
    if (decision.giveUp) {
      throw error;
    }
    return {
      status: "retry",
      decision,
      error:
        error instanceof Error
          ? error
          : new Error(String(error)),
    };
  }
}
