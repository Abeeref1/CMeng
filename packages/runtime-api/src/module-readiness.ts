import {withPositionVerdict} from './position-review';
import type { ModuleRuntimeResult } from './project-state-types';
import type { CrossModuleCertification } from './certification';
import {consistencyForModule} from './certification';
import { assessModuleIssues, type IssueScanContext } from './module-issues';
import {comparisonRequirement} from './comparison-requirement';
import {countText} from './count-text';

/** The evidence state of a page in plain words. */
export function readinessEvidenceText(evidence: unknown): string {
  const words: Record<string, string> = {
    partial: 'evidence incomplete',
    missing: 'evidence missing',
    not_established: 'evidence not confirmed',
    conflicted: 'evidence gives more than one value',
  };
  return words[String(evidence)] ?? 'evidence ' + String(evidence).replaceAll('_', ' ');
}

/** What the submitted/independent comparison still needs, in plain words. */
export function readinessComparisonText(state: unknown): string {
  const words: Record<string, string> = {
    independent_unavailable: 'no independent figure to compare with the submitted one',
    submitted_missing: 'no submitted figure to compare with the independent one',
    material_difference: 'submitted and independent figures differ',
    conflicting_evidence: 'more than one submitted or independent figure in the records',
    incomparable: 'submitted and independent figures cannot be compared on the same basis',
    scenario: 'the independent figure is a scenario',
    comparison_pending: 'submitted and independent figures not yet compared',
    not_checked: 'submitted and independent figures not yet compared',
  };
  return words[String(state)] ?? 'submitted and independent comparison: ' + String(state).replaceAll('_', ' ');
}

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
  scanContext?:IssueScanContext,
): ModuleRuntimeResult {
  const scopedConsistency = consistencyForModule(consistency, result.key);
  const issueAssessment = assessModuleIssues(result, consistency,scanContext);
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
  const comparison = comparisonRequirement(data,result.key);
  const reconciliation = comparison.state;
  const reconciliationRequired = comparison.required;
  const reconciliationReady =
    ['within_tolerance', 'not_applicable'].includes(reconciliation);

  const blockingIssues = (issueAssessment.issues ?? []).filter((issue:any) => {
    if (
      issue.kind === 'system_defect' ||
      issue.kind === 'source_conflict' ||
      issue.kind === 'data_quality'
    ) {
      return true;
    }
    if (issue.kind === 'missing_information') {
      // Field-level gaps stay visible and block the affected figure, not an
      // otherwise established page. Missing module authority is already gated
      // by result.status/evidence above. This keeps "Missing" distinct from zero
      // without turning every optional contract term into a page-level blocker.
      return result.status === 'blocked' ||
        ['missing', 'not_established', 'conflicted'].includes(evidence);
    }
    if (
      issue.kind === 'verification_pending' &&
      !NON_BLOCKING_REVIEW_CODES.has(issue.code)
    ) {
      return true;
    }
    return false;
  });

  // W5/W8: the readiness reason is said in plain words, one clause per open check
  // ('no independent figure to compare with the submitted one', never the state
  // code 'submitted/independent reconciliation independent unavailable').
  const failures = [
    calculation !== 'checked'
      ? 'calculation checks ' + calculation
      : null,
    evidence !== 'established'
      ? readinessEvidenceText(evidence)
      : null,
    professional !== 'defensible'
      ? 'professional review required'
      : null,
    scopedConsistency.state !== 'pass'
      ? 'affected consistency checks failed'
      : null,
    reconciliationRequired &&
    !reconciliationReady
      ? readinessComparisonText(reconciliation)
      : null,
    blockingIssues.length > 0
      ? countText(blockingIssues.length, 'blocking information or system issue')
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
