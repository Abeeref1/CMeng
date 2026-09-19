export type LdTermState =
  | "candidate"
  | "missing"
  | "conflicted";

export type LdRateBasis =
  | "fixed_amount_per_day"
  | "fixed_amount_per_week"
  | "percent_contract_amount_per_day"
  | "percent_contract_amount_per_week";

export interface LdRateCandidate {
  candidateId: string;
  basis: LdRateBasis;
  amount: number | null;
  currency: string | null;
  percent: number | null;
  sourceRefs: string[];
  textSnippet: string;
}

export interface LdCapCandidate {
  candidateId: string;
  basis:
    | "fixed_amount"
    | "percent_contract_amount";
  amount: number | null;
  currency: string | null;
  percent: number | null;
  sourceRefs: string[];
  textSnippet: string;
}

export interface ContractLdTerms {
  rateState: LdTermState;
  capState: LdTermState;
  rate: LdRateCandidate | null;
  cap: LdCapCandidate | null;
  rateCandidates: LdRateCandidate[];
  capCandidates: LdCapCandidate[];
  diagnostics: string[];
}


export type ContractValueState =
  | "candidate"
  | "missing"
  | "conflicted";

export type ContractValueKind =
  | "accepted_contract_amount"
  | "original_contract_sum"
  | "contract_sum"
  | "contract_price";

export interface ContractValueCandidate {
  candidateId: string;
  kind: ContractValueKind;
  amount: number;
  currency: string;
  sourceRefs: string[];
  textSnippet: string;
}

export interface ContractValueExtraction {
  state: ContractValueState;
  value:
    ContractValueCandidate | null;
  candidates:
    ContractValueCandidate[];
  diagnostics: string[];
}
