import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distRoot = 'dist';

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (path.endsWith('.js')) out.push(path);
  }
  return out;
}

function replaceAll(text, from, to) {
  return text.split(from).join(to);
}

const copyReplacements = [
  ['Claims fully linked', 'Fully defensible claim chain'],
  ['Claim → event → activity correspondence', 'Full chain: claim → event → activity'],
  ['Assigned Resources', 'Resource assignment records'],
  ['Assigned resources', 'Resource assignment records'],
  ['assigned resources', 'resource assignment records'],
  ['Lifecycle coverage', 'Final-stage coverage'],
  ['lifecycle coverage', 'final-stage coverage'],
  ['Full governed dated register; no presentation-only row cap.', 'Source register available in drill-down; management view shows the defensible position first.'],
  ['AUTHORITATIVE MASTER REVIEW', 'MANAGEMENT ANSWER & EVIDENCE STATE'],
  ['COMPLETE TRUTH · SAME GOVERNED CALCULATIONS', 'MAIN POSITION · EVIDENCE STATE · TRACE'],
  ['Independent forecast aligns with the official adjusted completion date.', 'Independent forecast aligns with the current comparison basis. Confirm EOT Position for contractual entitlement.'],
  ['the official adjusted completion date.', 'the current comparison basis. Confirm EOT Position before treating this as contractual entitlement.'],
  ['Current programme total float', 'Current programme total float; population and exclusions must be visible'],
  ['Governed near-critical threshold', 'Governed near-critical threshold; population and exclusions must be visible'],
  ['Final approval status coverage', 'Final approval status coverage, not full lifecycle date coverage'],
  ['Actual man-hours are missing, not zero', 'Periodized actual man-hour history is missing; actual total may still exist'],
  ['Actual history: Not established', 'Periodized actual history: Not established'],
  ['Active bonds', 'Active bonds evidenced'],
  ['Open obligations', 'Open obligations evidenced'],
  ['Controlled obligations', 'Controlled obligations evidenced'],
];

const clientHotfix = String.raw`
<script>
(function(){
  if (window.__cmengCredibilityHotfix) return;
  window.__cmengCredibilityHotfix = true;
  var textRules = [
    [/Claims fully linked/g, 'Fully defensible claim chain'],
    [/Claim → event → activity correspondence/g, 'Full chain: claim → event → activity'],
    [/Assigned Resources/g, 'Resource assignment records'],
    [/Assigned resources/g, 'Resource assignment records'],
    [/assigned resources/g, 'resource assignment records'],
    [/Lifecycle coverage/g, 'Final-stage coverage'],
    [/lifecycle coverage/g, 'final-stage coverage'],
    [/AUTHORITATIVE MASTER REVIEW/g, 'MANAGEMENT ANSWER & EVIDENCE STATE'],
    [/COMPLETE TRUTH · SAME GOVERNED CALCULATIONS/g, 'MAIN POSITION · EVIDENCE STATE · TRACE'],
    [/Actual man-hours are missing, not zero/g, 'Periodized actual man-hour history is missing; actual total may still exist'],
    [/Actual history: Not established/g, 'Periodized actual history: Not established'],
    [/1,141\.7 calendar days/g, 'about 1,142 calendar days'],
    [/1,050\.33 days/g, 'about 1,050 days'],
    [/203\.17 d/g, 'about 203 d'],
    [/9,368,523\.27 h/g, '9.37M h'],
    [/2,063,425\.32 h/g, '2.06M h'],
    [/8,695,945,475\.89 SAR/g, 'SAR 8.70B']
  ];
  var pageRules = {
    'master-dashboard': {
      status: 'REVIEW REQUIRED',
      title: 'Executive interpretation requires evidence context',
      body: 'The dashboard now separates engine execution from professional defensibility. Treat forecast and claims cards as management review items until the comparison basis, population and evidence chain are visible.'
    },
    'command-center': {
      status: 'REVIEW REQUIRED',
      title: 'Command center must show actions, not duplicate KPIs',
      body: 'Use this page for immediate blockers, decisions, owners and aging. KPI repetition is secondary to actionable control.'
    },
    'pmo-analysis': {
      status: 'REVIEW REQUIRED',
      title: 'Population and terminology must be explicit',
      body: 'Resource assignment records are not distinct resources. Activity totals, analysed population and excluded activities must be shown together before this page is professionally defensible.'
    },
    'schedule-analytics': {
      status: 'REVIEW REQUIRED',
      title: 'Programme population requires explanation',
      body: 'If the status population excludes isolated activities, the page must show total activities, analysed activities, excluded count and exclusion reason beside the KPI.'
    },
    'activity-analytics': {
      status: 'REVIEW REQUIRED',
      title: 'Activity status must reconcile with Programme Review',
      body: 'The in-progress count must state whether isolated/non-logic activities are included. Same concept must not appear with different counts without a visible population note.'
    },
    'resource-utilization': {
      status: 'REVIEW REQUIRED',
      title: 'Resource count and assignment records are separate',
      body: 'Distinct resources, assigned resources, weekly rows and assignment records must be displayed as separate concepts. Do not label assignment rows as resources.'
    },
    'progress-report': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Progress basis is incomplete',
      body: 'Schedule progress, contractor reported progress, certified progress and installed quantity progress must remain separate. Missing certified or reported progress is not zero.'
    },
    'variance-trends': {
      status: 'REVIEW REQUIRED',
      title: 'Variance trend needs governed basis',
      body: 'Show whether variance is against baseline, current plan, certified progress or physical progress before using it as a management conclusion.'
    },
    'progress-scurve': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'S-curve evidence must be separated',
      body: 'Do not imply certified or actual progress where only schedule snapshot progress exists. Withhold curves when periodized evidence is missing.'
    },
    'quantity-scurve': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Quantity mapping not established',
      body: 'Installed-quantity analysis is not defensible until BOQ, quantity codes and activity/WBS mapping are established. Missing quantities are not zero.'
    },
    'progress-breakdown': {
      status: 'REVIEW REQUIRED',
      title: 'Observed WBS is not approval authority',
      body: 'WBS progress must state whether packages are contract-approved, schedule-observed, candidate or derived. Observed WBS does not automatically create approved work packages.'
    },
    'manhour-scurve': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Actual total and periodized actual history are different',
      body: 'An actual labor-hours total may exist while periodized actual history is not established. The actual S-curve must stay withheld until periodized evidence exists.'
    },
    'forecast-history': {
      status: 'REVIEW REQUIRED',
      title: 'Forecast history must explain source basis',
      body: 'Forecast movement should state whether it comes from contractor submissions, source productivity, CMeng CPM or probabilistic forecast. Do not mix them as one trend.'
    },
    'independent-forecast': {
      status: 'REVIEW REQUIRED',
      title: 'Extreme forecast requires reconciliation narrative',
      body: 'Show contract finish, submitted programme finish, official adjusted finish if established, CMeng independent finish and exact comparison basis. Do not imply entitlement from CPM variance.'
    },
    'delay-claims': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Delay chain is not defensible yet',
      body: 'Claim/event evidence may exist, but 0 activity links means delay causation is not defensible. Show claim → event, event → window, event → activity and notice/determination chain separately.'
    },
    'notices-claims': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Notice timeliness is not fully assessable',
      body: 'Notice existence, timeliness, claim linkage and determination status must be separated. Missing notice evidence is not an issued notice and not zero exposure.'
    },
    'windows-analysis': {
      status: 'REVIEW REQUIRED',
      title: 'Window movement is not automatic EOT',
      body: 'Keep gross analytical movement, project completion movement and entitlement candidate separate. Gross positive movement must not be read as project delay or approved EOT.'
    },
    'eot-assessment': {
      status: 'REVIEW REQUIRED',
      title: 'EOT entitlement is not established by movement alone',
      body: 'Show C02 embedded time, determination register total, determinations effective by data date, additional unresolved EOT and observed schedule movement separately.'
    },
    'challenge-contract': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Challenge position needs readiness checklist',
      body: 'This page should show what is supportable, what is missing and what evidence is required before a contractual challenge can be issued.'
    },
    'commercial-overview': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Commercial story is incomplete',
      body: 'Current contract and committed value are visible, but certification, payment, cash, retention and claims evidence are not fully established. Do not imply full commercial position.'
    },
    'cost-forecast': {
      status: 'REVIEW REQUIRED',
      title: 'Cost forecast requires evidence basis and clean axes',
      body: 'Cost charts must start at zero unless negative values are real. Show actual, committed, remaining and EAC basis separately.'
    },
    'variations-change': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Variation lifecycle is not complete',
      body: 'Approved status coverage is not the same as full lifecycle coverage. Instruction, submission, assessment, agreement, approval, schedule link, claim link and payment link must be shown separately.'
    },
    'payments': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Payment lifecycle evidence is incomplete',
      body: 'Stage coverage, applied, assessed, certified and paid dates must be established before this page is commercially defensible. Missing payment stage evidence is not zero.'
    },
    'cash-flow': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Cash position withheld because evidence is incomplete',
      body: 'A funding or cash S-curve must not be drawn without dated cash receipts/expenditure and payment basis. Withholding is correct; the page status must say evidence incomplete.'
    },
    'commercial-claims-notices': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Claim position is not management-readable yet',
      body: 'Show claim count, amount coverage, notice chain, determination status and evidence gaps first. Hashes and row-level evidence belong in technical drill-down.'
    },
    'contract-particulars-bonds': {
      status: 'EVIDENCE INCOMPLETE',
      title: 'Zero obligations may mean missing evidence',
      body: 'Do not show zero bonds or obligations unless the source explicitly confirms none. If the register is missing, display not established.'
    }
  };
  function ensureStyle(){
    if(document.getElementById('cmeng-credibility-style')) return;
    var style=document.createElement('style');
    style.id='cmeng-credibility-style';
    style.textContent='.cmeng-credibility-banner{border:1px solid #f2c879;background:#fff8e6;color:#4f3412;border-radius:12px;padding:14px 16px;margin:0 0 16px;box-shadow:0 5px 18px rgba(94,65,20,.07)}.cmeng-credibility-banner b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}.cmeng-credibility-banner p{margin:0;font-size:13px;line-height:1.45}.cmeng-status-evidence{background:#fff5df!important;color:#8a5a14!important;border-color:#e7c276!important}.cmeng-status-review{background:#fbeeed!important;color:#9f3d36!important;border-color:#e5aaa5!important}.cmeng-population-note{font-size:12px;color:#5f6b76;background:#f7f9fc;border:1px solid #dce5ef;border-radius:10px;padding:10px 12px;margin:8px 0 14px}';
    document.head.appendChild(style);
  }
  function replaceText(root){
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var v=n.nodeValue;
      textRules.forEach(function(rule){ v=v.replace(rule[0],rule[1]); });
      n.nodeValue=v;
    });
  }
  function currentKey(){
    if(window.currentModuleResult&&window.currentModuleResult.key) return window.currentModuleResult.key;
    var active=document.querySelector('.nav-item.active[data-key]');
    return active?active.getAttribute('data-key'):'';
  }
  function apply(){
    var root=document.getElementById('moduleContent');
    if(!root) return;
    ensureStyle();
    replaceText(root);
    var key=currentKey();
    var rule=pageRules[key];
    root.querySelectorAll('.cmeng-credibility-banner,.cmeng-population-note').forEach(function(x){x.remove();});
    if(rule){
      var div=document.createElement('div');
      div.className='cmeng-credibility-banner';
      div.innerHTML='<b>'+rule.title+'</b><p>'+rule.body+'</p>';
      root.insertBefore(div,root.firstChild);
      var badge=document.getElementById('moduleBadge');
      if(badge){
        badge.textContent=rule.status;
        badge.classList.add(rule.status.indexOf('INCOMPLETE')>=0?'cmeng-status-evidence':'cmeng-status-review');
      }
    }
    if(key==='schedule-analytics'||key==='activity-analytics'||key==='pmo-analysis'){
      var note=document.createElement('div');
      note.className='cmeng-population-note';
      note.textContent='Population rule: every schedule KPI must show total activities, analysed population, excluded population and exclusion reason. Counts using different populations must not be compared without this note.';
      root.insertBefore(note,root.firstChild.nextSibling);
    }
  }
  var t=null;
  function schedule(){ clearTimeout(t); t=setTimeout(apply,80); }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
</script>`;

let changedFiles = 0;
for (const file of walk(distRoot)) {
  let content = readFileSync(file, 'utf8');
  const before = content;
  for (const [from, to] of copyReplacements) {
    content = replaceAll(content, from, to);
  }
  if (file.endsWith('dist/packages/runtime-api/src/ui.js') && !content.includes('__cmengCredibilityHotfix')) {
    content = content.replace('</body>', `${clientHotfix}\n</body>`);
  }
  if (content !== before) {
    writeFileSync(file, content);
    changedFiles += 1;
  }
}

console.log(JSON.stringify({ status: 'credibility-hotfix-applied', changedFiles }));
