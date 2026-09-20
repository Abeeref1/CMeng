import { cell, dateValue, round, type SourceRow } from '../../truth-kernel/src';
import type { CommercialMoney, PaymentStageRecord } from './commercial-canonical';

/** Reconcile explicit certificate components without promoting certification to cash. */
export function reconcilePaymentEvidence(
  row: SourceRow,
  amounts: PaymentStageRecord['amounts'],
  dataDateIso: string | null,
): Pick<PaymentStageRecord, 'reconciliation' | 'diagnostics' | 'calculatedOutstandingAmount' | 'paymentDate' | 'paymentReference'> {
  const diagnostics: string[] = [];
  const parseTax = (s: string): CommercialMoney['taxBasis'] =>
    /excl/i.test(s) ? 'exclusive' : /incl/i.test(s) ? 'inclusive' : 'unknown';
  const net = amounts.netCertifiedAmount;
  const paid = amounts.paidAmount;
  const netTax = cell(row, 'net certified tax basis', 'net vat basis');
  const paidTax = cell(row, 'paid amount tax basis', 'paid vat basis');
  if (netTax) net.taxBasis = parseTax(netTax);
  if (paidTax) paid.taxBasis = parseTax(paidTax);
  const paidCurrency = cell(row, 'paid currency', 'payment currency');
  if (paidCurrency) paid.currency = paidCurrency.toUpperCase();

  const components = [amounts.grossWork, amounts.variations, amounts.retentionDeduction,
    amounts.advanceRecovery, amounts.otherDeduction];
  const basis = components[0]!.taxBasis;
  const comparable = net.currency !== null && basis !== 'unknown' &&
    components.every(a => a.value !== null && a.currency === net.currency && a.taxBasis === basis);
  let calculatedNet: number | null = null;
  if (comparable && net.value !== null) {
    const subtotal = amounts.grossWork.value! + amounts.variations.value! -
      amounts.retentionDeduction.value! - amounts.advanceRecovery.value! - amounts.otherDeduction.value!;
    if (net.taxBasis === basis) calculatedNet = subtotal;
    else if (basis === 'exclusive' && net.taxBasis === 'inclusive' &&
      amounts.taxAmount.value !== null && amounts.taxAmount.currency === net.currency) {
      calculatedNet = subtotal + amounts.taxAmount.value;
    } else diagnostics.push('CERTIFICATE_TAX_BASIS_NOT_RECONCILED');
  } else diagnostics.push('CERTIFICATE_COMPONENTS_OR_MONEY_BASIS_INCOMPLETE');
  const reconciliation = calculatedNet === null ? 'unresolved' as const :
    Math.abs(calculatedNet - net.value!) > 0.01 ? 'conflicted' as const : 'matched' as const;
  if (reconciliation === 'conflicted') diagnostics.push('CERTIFICATE_NET_COMPONENTS_CONFLICT');

  const paymentDate = dateValue(cell(row, 'payment as of', 'paid date', 'payment date'));
  const paymentReference = cell(row, 'payment reference', 'receipt reference') || null;
  const allocatedBasis = /^(cumulative|certificate total|cumulative allocated to certificate)$/i.test(
    cell(row, 'paid amount basis', 'payment amount basis').replace(/[_-]+/g, ' '));
  const posted = /^(approved|posted|verified)$/i.test(cell(row, 'payment source status', 'receipt status'));
  const sameMoneyBasis = net.currency !== null && paid.currency === net.currency &&
    net.taxBasis !== 'unknown' && paid.taxBasis === net.taxBasis;
  const effective = dataDateIso !== null && paymentDate !== null && paymentDate <= dataDateIso &&
    net.asOf !== null && net.asOf <= dataDateIso;
  const sourceGoverned = net.state === 'official' && paid.state === 'official';
  const canCalculate = net.value !== null && paid.value !== null && sameMoneyBasis &&
    allocatedBasis && posted && effective && paymentReference !== null && sourceGoverned;
  const calculatedOutstandingAmount: CommercialMoney = {
    ...net, value: canCalculate ? round(net.value! - paid.value!, 6) : null,
    state: canCalculate ? 'official' : 'missing',
    amountBasis: 'net certification less dated cumulative cash allocated to this certificate',
    asOf: dataDateIso, receipts: [...net.receipts, ...paid.receipts],
  };
  if (paid.value !== null && !canCalculate) diagnostics.push('DATED_GOVERNED_CUMULATIVE_PAYMENT_ALLOCATION_REQUIRED');
  // Keep the submitted outstanding figure intact. A calculation is a separate record.
  if (calculatedOutstandingAmount.value !== null && amounts.outstandingAmount.value !== null &&
    Math.abs(calculatedOutstandingAmount.value - amounts.outstandingAmount.value) > 0.01) {
    calculatedOutstandingAmount.state = 'conflicted';
    diagnostics.push('REPORTED_OUTSTANDING_DIFFERS_FROM_RECONCILIATION');
  }
  return {reconciliation, diagnostics, calculatedOutstandingAmount, paymentDate, paymentReference};
}
