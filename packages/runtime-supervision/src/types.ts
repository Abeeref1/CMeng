export interface StartupContract {
  bindLivenessFirst: true;
  startDurableRebuildsInline: false;
  durableWorkMode: "supervised_workers";
}

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio: number;
  maxAttempts: number | null;
}

export interface RetryDecision {
  attempt: number;
  delayMs: number;
  giveUp: boolean;
}
