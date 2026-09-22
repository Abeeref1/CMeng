import type { ModuleRuntimeResult } from './project-state-types';
import type { CrossModuleCertification } from './certification';

/** A renderer or calculation finishing is never a green evidence verdict. */
export function enforceModuleReadiness(result: ModuleRuntimeResult, consistency: Pick<CrossModuleCertification, 'state' | 'failedCheckIds' | 'checkCount'>): ModuleRuntimeResult {
  const data = result.data as any;
  if (!data || typeof data !== 'object') return result;
  const integrity = data.systemEvidenceContract;
  const calculation = integrity?.state === 'verified_for_checked_metrics' ? 'checked' : integrity?.state === 'failed' ? 'failed' : 'pending';
  const evidence = result.evidenceState ?? 'not_established';
  const professional = result.professionalState ?? 'review_required';
  const reconciliation = data.challenge?.reconciliationState ?? 'not_checked';
  const reconciled = ['within_tolerance', 'not_applicable'].includes(reconciliation);
  const failures = [calculation !== 'checked' ? 'calculation checks ' + calculation : null,
    evidence !== 'established' ? 'evidence ' + evidence : null,
    professional !== 'defensible' ? 'professional review required' : null,
    consistency.state !== 'pass' ? 'cross-module consistency failed' : null,
    !reconciled ? 'submitted/independent reconciliation ' + reconciliation.replaceAll('_', ' ') : null].filter(Boolean);
  const checked = result.status === 'ready' && failures.length === 0;
  const moduleReadiness = { state: checked ? 'checked' : 'review_required', calculation, evidence,
    professional, reconciliation, consistency: consistency.state, failedConsistencyCheckIds: consistency.failedCheckIds,
    consistencyCheckCount: consistency.checkCount, calculationCheckCount: integrity?.checks?.length ?? 0,
    scope: 'Only the listed calculation and consistency checks are certified. Missing evidence, causal conclusions and contractual entitlement are not certified by a successful calculation.' };
  return { ...result, status: result.status === 'blocked' ? 'blocked' : checked ? 'ready' : 'partial',
    professionalState: checked ? 'defensible' : 'review_required',
    reason: checked ? result.reason : [result.reason, failures.length ? 'Shared readiness gate: ' + failures.join('; ') + '.' : null].filter(Boolean).join(' '),
    data: { ...data, moduleReadiness } };
}
