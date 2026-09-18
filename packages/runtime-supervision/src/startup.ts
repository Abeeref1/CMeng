import type {
  StartupContract,
} from "./types";

export const DEFAULT_STARTUP_CONTRACT: StartupContract = {
  bindLivenessFirst: true,
  startDurableRebuildsInline: false,
  durableWorkMode: "supervised_workers",
};

export function assertStartupContract(
  contract: StartupContract,
): void {
  if (!contract.bindLivenessFirst) {
    throw new Error(
      "API startup must bind liveness before durable work",
    );
  }
  if (contract.startDurableRebuildsInline) {
    throw new Error(
      "Full project rebuilds are forbidden inside API startup",
    );
  }
  if (
    contract.durableWorkMode !==
    "supervised_workers"
  ) {
    throw new Error(
      "Durable work must run in supervised workers",
    );
  }
}
