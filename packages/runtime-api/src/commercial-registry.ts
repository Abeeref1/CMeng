export interface CommercialModuleDescriptor {
  key: string;
  label: string;
  group:
    | "Commercial Foundation"
    | "Commercial Control"
    | "Commercial Assurance"
    | "Commercial Governance";
  purpose: string;
  tier: 1 | 2 | 3 | 4;
}

export const COMMERCIAL_MODULES:
  CommercialModuleDescriptor[] = [
  {key:"commercial-terms",label:"Commercial Terms",group:"Commercial Foundation",purpose:"Governed contract facts, precedence and clause-dependent commercial controls.",tier:1},
  {key:"contract-amendments",label:"Contract Amendments",group:"Commercial Foundation",purpose:"Amendment numbering, effective dates, precedence and changed-term comparison.",tier:1},
  {key:"cost-register",label:"Cost Register",group:"Commercial Foundation",purpose:"CBS-level budget, commitments, certified, paid, actual and forecast truth.",tier:1},
  {key:"payment-register",label:"Payment Register (IPC)",group:"Commercial Foundation",purpose:"Application, assessment, certification, deductions, receipts and outstanding payment position.",tier:1},
  {key:"cbs-breakdown",label:"CBS Breakdown",group:"Commercial Foundation",purpose:"Cost hierarchy and BOQ/payment/WBS mapping completeness.",tier:1},

  {key:"cost-control",label:"Cost Control",group:"Commercial Control",purpose:"Management cost position, EVM, forecast and variance reconciliation.",tier:2},
  {key:"evm-performance",label:"EVM Curves & Performance",group:"Commercial Control",purpose:"Documented and calculated PV/EV/AC, CPI/SPI and dated performance.",tier:2},
  {key:"cash-flow-register",label:"Cash Flow Register",group:"Commercial Control",purpose:"Period budget, forecast, certified income, paid income and expenditure.",tier:2},
  {key:"cost-scurve",label:"Cost S-Curve",group:"Commercial Control",purpose:"Cumulative planned, earned/certified, actual and forecast cost series.",tier:2},
  {key:"variations",label:"Variations",group:"Commercial Control",purpose:"Instruction-to-certification variation lifecycle and contract-sum impact.",tier:2},
  {key:"site-instructions",label:"Site Instructions",group:"Commercial Control",purpose:"Instruction register, responses, commercial actions and downstream links.",tier:2},
  {key:"contract-obligations",label:"Contract Obligations",group:"Commercial Control",purpose:"Governed obligations, deadlines, time bars and conditions precedent.",tier:2},
  {key:"liquidated-damages",label:"Liquidated Damages",group:"Commercial Control",purpose:"LD exposure under contractual, EOT and completion scenarios.",tier:2},
  {key:"bonds-insurance",label:"Bonds & Insurance",group:"Commercial Control",purpose:"Required versus issued instruments, expiry, renewal, claims and recoveries.",tier:2},
  {key:"retention-calendar",label:"Retention Calendar",group:"Commercial Control",purpose:"Retention withheld, release triggers, cap, remaining and overdue release.",tier:2},

  {key:"final-account",label:"Final Account / Closeout",group:"Commercial Assurance",purpose:"Original sum through revised sum, certified, paid and final settlement readiness.",tier:3},
  {key:"earned-schedule",label:"Earned Schedule",group:"Commercial Assurance",purpose:"ES, SPI(t), SV(t) and time-based EVM where dated series evidence exists.",tier:3},
  {key:"evm-by-wbs",label:"EVM by WBS",group:"Commercial Assurance",purpose:"WBS-level PV/EV/AC/EAC/ETC/VAC with reconciliation.",tier:3},
  {key:"risk-register",label:"Risk Register",group:"Commercial Assurance",purpose:"Governed qualitative risk position, owners, mitigation and residual exposure.",tier:3},
  {key:"monte-carlo-risk",label:"Monte Carlo Risk",group:"Commercial Assurance",purpose:"Probabilistic time/cost analysis with explicit QRA readiness gates.",tier:3},
  {key:"contract-risk",label:"Contract Risk",group:"Commercial Assurance",purpose:"Clause-level risk, deadlines, severity, recommendations and source trace.",tier:3},
  {key:"tender-readiness",label:"Tender Readiness",group:"Commercial Assurance",purpose:"Tender returnables, BOQ/compliance checks and evidence-cutoff readiness.",tier:3},

  {key:"commitment-tracking",label:"Commitment Tracking",group:"Commercial Governance",purpose:"POs, subcontracts and service agreements linked to CBS and actual cost.",tier:4},
  {key:"accruals",label:"Accruals",group:"Commercial Governance",purpose:"Period-end accrual, invoice matching, reversal and governance.",tier:4},
  {key:"contingency-reserve",label:"Contingency & Management Reserve",group:"Commercial Governance",purpose:"Reserve allocation, draws, release approval and risk linkage.",tier:4},
  {key:"escalation-price-adjustment",label:"Escalation & Price Adjustment",group:"Commercial Governance",purpose:"Indices, base dates, formulas and governed price adjustments.",tier:4},
  {key:"vat-tax",label:"VAT & Tax",group:"Commercial Governance",purpose:"VAT basis, tax invoices, withholding and jurisdictional treatment.",tier:4},
  {key:"multi-currency",label:"Multi-Currency",group:"Commercial Governance",purpose:"Contract, payment and reporting currencies with governed FX conversion.",tier:4},
  {key:"cost-audit-trail",label:"Cost Audit Trail",group:"Commercial Governance",purpose:"Before/after cost mutations, actor, reason, date and source lineage.",tier:4},
  {key:"reconciliation-report",label:"Reconciliation Report",group:"Commercial Governance",purpose:"Contract to variations to revised contract to certified to paid to balance.",tier:4},
  {key:"cost-position",label:"Cost Position",group:"Commercial Governance",purpose:"Current cash position, peak funding need and overdraft/funding requirement.",tier:4},
];

export function commercialModuleDescriptor(
  key: string,
): CommercialModuleDescriptor | null {
  return COMMERCIAL_MODULES.find(
    (module) =>
      module.key === key,
  ) ?? null;
}

export function isCommercialModuleKey(
  key: string,
): boolean {
  return commercialModuleDescriptor(key) !== null;
}
