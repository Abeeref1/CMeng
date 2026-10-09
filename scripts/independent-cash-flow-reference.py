"""Freeze cash ledgers and expected answers before importing/running CMeng.

Integer cents and dated transactions are the reference, independent of the
product's grouping/delta code. Invalid or incomplete populations retain known
subtotals but cannot establish net cash, funding need or certified unpaid.
"""
import collections
import hashlib
import json
import pathlib
import random
import secrets
import sys


def generate(seed, count=120):
    rng = random.Random(seed)
    scenarios = ['incremental', 'cumulative', 'missing_paid', 'missing_certified',
                 'missing_cost', 'undated_cost', 'candidate_cost', 'conflicted_cost',
                 'unknown_cost_group', 'unopened_cost_group', 'falling_cost_group',
                 'candidate_paid', 'conflicted_paid', 'candidate_certified',
                 'candidate_paid_opening', 'future_cost', 'unknown_tax', 'incremental',
                 'cumulative', 'partial_cost']
    cases = []
    for i in range(count):
        scenario = scenarios[i % len(scenarios)]
        case_id = f'CASH-{seed[:10]}-{i:03}'
        payments, metrics, expected = [], [], []
        # Repeated references/amount shapes in separate currencies and tax bases
        # must never be added together. The third partition is deliberately
        # unaffected by the failing population in the first two.
        for partition, (currency, tax) in enumerate([('AED', 'exclusive'), ('USD', 'inclusive'), ('AED', 'inclusive')]):
            s = scenario if partition < 2 else 'incremental'
            if s == 'unknown_tax':
                tax = 'unknown'
            paid_events, certified_events, cost_events = [], [], []
            cumulative = s in ('cumulative', 'candidate_paid_opening')
            paid_state = 'candidate' if s in ('candidate_paid', 'candidate_paid_opening') else 'conflicted' if s == 'conflicted_paid' else 'established'
            cert_state = 'candidate' if s == 'candidate_certified' else 'established'
            cost_state = {'candidate_cost': 'candidate', 'conflicted_cost': 'conflicted', 'partial_cost': 'partial'}.get(s, 'established')
            if s == 'missing_paid': paid_state = 'partial'
            if s == 'missing_certified': cert_state = 'partial'
            if s in ('missing_cost', 'undated_cost', 'unknown_cost_group', 'unopened_cost_group', 'falling_cost_group'): cost_state = 'partial'
            basis = 'project_cumulative' if cumulative else 'incremental'
            totals = [0, 0, 0]
            for j in range(4):
                month = min(3, j + 1)
                day = rng.randint(2, 7) + (10 if j == 3 else 0)
                certification = f'2035-{month:02}-{day:02}'
                paid_date = f'2035-{month:02}-{day+8:02}'
                cost_date = f'2035-{month:02}-{day+3:02}'
                cert, paid, cost = [rng.randint(10000, 9999999) for _ in range(3)]
                certified_events.append((certification, cert)); paid_events.append((paid_date, paid)); cost_events.append((cost_date, cost))
                totals = [a+b for a,b in zip(totals, [cert, paid, cost])]
                row = dict(paymentId=f'IPC-{j}', periodEnd=f'2035-{month:02}-01', certificationDate=certification,
                           paymentDate=paid_date, currency=currency, taxBasis=tax,
                           certifiedAmount=(totals[0] if cumulative else cert)/100,
                           paidAmount=(totals[1] if cumulative else paid)/100,
                           certifiedAmountBasis=basis, paidAmountBasis=basis,
                           certifiedState='candidate' if s == 'candidate_certified' else 'official',
                           paidState=('candidate' if s == 'candidate_paid' else 'conflicted' if s == 'conflicted_paid' else 'official'),
                           sourceRefs=[f'{case_id}:{partition}:payment:{j}'])
                payments.append(row)
                metrics.append(dict(metric='actual expenditure', value=(totals[2] if cumulative else cost)/100,
                                    currency=currency, taxBasis=tax, asOf=cost_date,
                                    state={'candidate_cost':'candidate','conflicted_cost':'conflicted','partial_cost':'partial'}.get(s,'official'),
                                    sourceStatus='Frozen test source', amountBasis=basis, cbsId='A', wbsId=None,
                                    sourceRefs=[f'{case_id}:{partition}:cost:{j}']))
            if cumulative:
                payments.append({**payments[-1], 'paymentId':'OPEN', 'periodEnd':'2034-12-31', 'certificationDate':'2034-12-31',
                                 'paymentDate':'2034-12-31', 'certifiedAmount':0, 'paidAmount':0,
                                 'paidState':'candidate' if s == 'candidate_paid_opening' else 'official', 'sourceRefs':[f'{case_id}:{partition}:opening']})
                metrics.append({**metrics[-1], 'asOf':'2034-12-31', 'value':0, 'sourceRefs':[f'{case_id}:{partition}:cost-opening']})
            if s in ('missing_paid', 'missing_certified'):
                row = {**payments[-1], 'paymentId':'INCOMPLETE', 'certifiedAmount':rng.randint(100,9999)/100, 'paidAmount':rng.randint(100,9999)/100}
                if s == 'missing_paid': row['paidAmount']=None; certified_events.append((row['certificationDate'], round(row['certifiedAmount']*100)))
                else: row['certifiedAmount']=None; paid_events.append((row['paymentDate'], round(row['paidAmount']*100)))
                payments.append(row)
            if s in ('missing_cost', 'undated_cost', 'unknown_cost_group', 'unopened_cost_group', 'falling_cost_group', 'future_cost'):
                extra = {**metrics[-1], 'cbsId':'B', 'value':rng.randint(100,9999)/100, 'asOf':'2035-03-25', 'sourceRefs':[f'{case_id}:{partition}:unresolved']}
                if s == 'missing_cost': extra['value']=None
                if s == 'undated_cost': extra['asOf']=None
                if s == 'unknown_cost_group': extra['amountBasis']='unknown'
                if s in ('unopened_cost_group','falling_cost_group'): extra['amountBasis']='project_cumulative'
                if s == 'future_cost': extra['asOf']='2035-04-01'
                if s == 'falling_cost_group':
                    metrics.extend([{**extra,'asOf':'2035-03-01','value':0},{**extra,'asOf':'2035-03-10','value':extra['value']+500}])
                metrics.append(extra)
            paid_total = sum(n for _,n in paid_events)/100
            cert_total = sum(n for _,n in certified_events)/100
            cost_total = sum(n for _,n in cost_events)/100
            cash_ready = tax != 'unknown' and paid_state == cost_state == 'established'
            unpaid_ready = tax != 'unknown' and paid_state == cert_state == 'established'
            movements = collections.defaultdict(int)
            monthly = collections.defaultdict(int)
            for date, amount in paid_events: movements[date] += amount; monthly[date[:7]] += amount
            for date, amount in cost_events: movements[date] -= amount; monthly[date[:7]] -= amount
            running, peak, timeline = 0, 0, []
            dates = sorted(set(movements) | {date for date,_ in certified_events})
            for date in dates:
                running += movements[date]; peak = max(peak, -running)
                timeline.append([date, running/100 if cash_ready else None])
            expected.append(dict(currency=currency,taxBasis=tax,
                paidIncome=dict(value=paid_total if tax!='unknown' else None,state=paid_state if tax!='unknown' else 'missing'),
                certifiedIncome=dict(value=cert_total if tax!='unknown' else None,state=cert_state if tax!='unknown' else 'missing'),
                actualExpenditure=dict(value=cost_total if tax!='unknown' else None,state=cost_state if tax!='unknown' else 'missing'),
                netCashPosition=(paid_total-cost_total if cash_ready else None),
                certifiedUnpaid=(cert_total-paid_total if unpaid_ready else None),peakFundingNeed=(peak/100 if cash_ready else None),
                monthly={month:value/100 if cash_ready else None for month,value in sorted(monthly.items())},timeline=timeline))
        rng.shuffle(payments);rng.shuffle(metrics)
        cases.append(dict(id=case_id,scenario=scenario,input=dict(projectId=case_id,dataDateIso='2035-03-31',generatedAt='2035-04-01T00:00:00Z',costSnapshots=[],costMetrics=metrics,payments=payments),expected=expected))
    return cases


if __name__ == '__main__':
    out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    if (out/'reference.json').exists():raise SystemExit('Frozen reference exists.')
    seed=secrets.token_hex(20)
    content=json.dumps(dict(seed=seed,classification='Internal independent cash arithmetic; not external acceptance',
                           limits=['Explicit incremental or zero-opening cumulative ledgers; no FX conversion, financing facilities or legal entitlement'],cases=generate(seed)),indent=2)+'\n'
    (out/'reference.json').write_text(content);digest=hashlib.sha256(content.encode()).hexdigest()
    (out/'reference.sha256').write_text(digest+'\n')
    print(json.dumps(dict(cases=120,partitions=360,sha256=digest)))
