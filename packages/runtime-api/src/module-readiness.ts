import {withPositionVerdict} from './position-review';
import type { ModuleRuntimeResult } from './project-state-types';
import type { CrossModuleCertification } from './certification';
import {consistencyForModule} from './certification';
import { assessModuleIssues } from './module-issues';

const NON_BLOCKING_REVIEW_CODES = new Set([
  'INDEPENDENT_COMPARISON_NOT_ESTABLISHED',
  'SOURCE_AUTHORITY_COMPARISON',
]);

/**
 * Readiness is module-scoped.
 *
 * A calculation finishing is never enough for a green evidence verdict, but an
 * unrelated project-wide comparison gap must not make every specialist page
 * partial either. Each module keeps its own calculation/evidence/professional
 * gates and only the cross-module consistency checks that actually affect it.
 * Submitted-vs-independent comparison remains visible as a review dimension;
 * it is not a universal prerequisite for every commercial/control page.
 */
export function enforceModuleReadiness(
  result: ModuleRuntimeResult,
  consistency: Pick<CrossModuleCertification, 'state' | 'failedCheckIds' | 'checkCount'> &
    Partial<Pick<CrossModuleCertification,'checks'>>,
): ModuleRuntimeResult {
  const scopedConsistency = consistencyForModule(consistency, result.key);
  const issueAssessment = assessModuleIssues(result, consistency);
  const data = result.data as any;
  if (!data || typeof data !== 'object') {
    return {...result, issueAssessment};
  }

  const integrity = data.systemEvidenceContract;
  const calculation =
    integrity?.state === 'verified_for_checked_metrics'
      ? 'checked'
      : integrity?.state === 'failed'
        ? 'failed'
        : 'pending';
  const evidence = result.evidenceState ?? 'not_established';
  const professional = result.professionalState ?? 'review_required';
  const reconciliation = data.challenge?.reconciliationState ?? 'not_checked';
  const challengeItems = Array.isArray(data.challenge?.items)
    ? data.challenge.items
    : [];
  const advisoryDefaultChallenge =
    challengeItems.length === 1 &&
    challengeItems[0]?.metric === 'module_position';
  const reconciliationRequired =
    challengeItems.length > 0 &&
    !advisoryDefaultChallenge;
  const reconciliationReady =
    ['within_tolerance', 'not_applicable'].includes(reconciliation);

  const blockingIssues = (issueAssessment.issues ?? []).filter((issue:any) => {
    if (
      issue.kind === 'system_defect' ||
      issue.kind === 'source_conflict' ||
      issue.kind === 'data_quality' ||
      issue.kind === 'missing_information'
    ) {
      return true;
    }
    if (
      issue.kind === 'verification_pending' &&
      !NON_BLOCKING_REVIEW_CODES.has(issue.code)
    ) {
      return true;
    }
    return false;
  });

  const failures = [
    calculation !== 'checked'
      ? 'calculation checks ' + calculation
      : null,
    evidence !== 'established'
      ? 'evidence ' + evidence
      : null,
    professional !== 'defensible'
      ? 'professional review required'
      : null,
    scopedConsistency.state !== 'pass'
      ? 'affected consistency checks failed'
      : null,
    reconciliationRequired &&
    !reconciliationReady
      ? 'submitted/independent reconciliation ' + String(reconciliation).replaceAll('_', ' ')
      : null,
    blockingIssues.length > 0
      ? String(blockingIssues.length) + ' blocking information/system issue(s)'
      : null,
  ].filter(Boolean);

  const checked =
    result.status === 'ready' &&
    failures.length === 0;

  const moduleReadiness = {
    state: checked ? 'checked' : 'review_required',
    calculation,
    evidence,
    professional,
    reconciliation,
    comparisonState: reconciliation,
    comparisonRequired: reconciliationRequired,
    consistency: scopedConsistency.state,
    projectConsistency: consistency.state,
    failedConsistencyCheckIds: scopedConsistency.failedCheckIds,
    consistencyCheckCount: consistency.checkCount,
    calculationCheckCount: integrity?.checks?.length ?? 0,
    reviewIssueCount: issueAssessment.issues?.length ?? 0,
    blockingIssueCount: blockingIssues.length,
    scope:
      'Readiness is assessed from this module\'s calculation, evidence, professional review and affected consistency checks. Submitted/independent comparison remains a separate review dimension unless the module explicitly depends on it.',
  };

  return withPositionVerdict({
    ...result,
    issueAssessment,
    status:
      result.status === 'blocked'
        ? 'blocked'
        : checked
          ? 'ready'
          : 'partial',
    professionalState:
      checked
        ? 'defensible'
        : 'review_required',
    reason:
      checked
        ? result.reason
        : [
            result.reason,
            failures.length
              ? 'Readiness review: ' + failures.join('; ') + '.'
              : null,
          ]
            .filter(Boolean)
            .join(' '),
    data: {
      ...data,
      moduleReadiness,
      issueAssessment,
    },
  });
}
