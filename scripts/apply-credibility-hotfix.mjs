import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distRoot = 'dist';
const uiBundleSuffix = 'dist/packages/runtime-api/src/ui.js';

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
  var applying = false;
  var timer = null;
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
    'master-dashboard':['REVIEW REQUIRED','Executive interpretation requires evidence context','Separate engine execution from professional defensibility. Forecast and claims cards require visible comparison basis, population and evidence chain before management reliance.'],
    'command-center':['REVIEW REQUIRED','Command center must show actions, not duplicate KPIs','Use this page for immediate blockers, decisions, owners and aging. KPI repetition is secondary to actionable control.'],
    'pmo-analysis':['REVIEW REQUIRED','Population and terminology must be explicit','Resource assignment records are not distinct resources. Activity totals, analysed population and excluded activities must be shown together.'],
    'schedule-analytics':['REVIEW REQUIRED','Programme population requires explanation','If isolated activities are excluded, show total activities, analysed activities, excluded count and exclusion reason beside the KPI.'],
    'activity-analytics':['REVIEW REQUIRED','Activity status must reconcile with Programme Review','The in-progress count must state whether isolated or non-logic activities are included.'],
    'resource-utilization':['REVIEW REQUIRED','Resource count and assignment records are separate','Distinct resources, assigned resources, weekly rows and assignment records must be displayed as separate concepts.'],
    'progress-report':['EVIDENCE INCOMPLETE','Progress basis is incomplete','Schedule progress, contractor reported progress, certified progress and installed quantity progress must remain separate. Missing evidence is not zero.'],
    'variance-trends':['REVIEW REQUIRED','Variance trend needs governed basis','Show whether variance is against baseline, current plan, certified progress or physical progress before using it as a management conclusion.'],
    'progress-scurve':['EVIDENCE INCOMPLETE','S-curve evidence must be separated','Do not imply certified or actual progress where only schedule snapshot progress exists. Withhold curves when periodized evidence is missing.'],
    'quantity-scurve':['EVIDENCE INCOMPLETE','Quantity mapping not established','Installed-quantity analysis is not defensible until BOQ, quantity codes and activity/WBS mapping are established.'],
    'progress-breakdown':['REVIEW REQUIRED','Observed WBS is not approval authority','WBS progress must state whether packages are contract-approved, schedule-observed, candidate or derived.'],
    'manhour-scurve':['EVIDENCE INCOMPLETE','Actual total and periodized actual history are different','An actual labor-hours total may exist while periodized actual history is not established. The actual S-curve must stay withheld.'],
    'forecast-history':['REVIEW REQUIRED','Forecast history must explain source basis','Forecast movement should state whether it comes from contractor submissions, source productivity, CMeng CPM or probabilistic forecast.'],
    'independent-forecast':['REVIEW REQUIRED','Extreme forecast requires reconciliation narrative','Show contract finish, submitted programme finish, official adjusted finish if established, CMeng independent finish and exact comparison basis.'],
    'delay-claims':['EVIDENCE INCOMPLETE','Delay chain is not defensible yet','Claim/event evidence may exist, but 0 activity links means delay causation is not defensible. Show chain stages separately.'],
    'notices-claims':['EVIDENCE INCOMPLETE','Notice timeliness is not fully assessable','Notice existence, timeliness, claim linkage and determination status must be separated. Missing notice evidence is not issued notice evidence.'],
    'windows-analysis':['REVIEW REQUIRED','Window movement is not automatic EOT','Keep gross analytical movement, project completion movement and entitlement candidate separate.'],
    'eot-assessment':['REVIEW REQUIRED','EOT entitlement is not established by movement alone','Show embedded amendment time, determination register total, effective determinations, unresolved EOT and observed movement separately.'],
    'challenge-contract':['EVIDENCE INCOMPLETE','Challenge position needs readiness checklist','Show what is supportable, what is missing and what evidence is required before a contractual challenge can be issued.'],
    'commercial-overview':['EVIDENCE INCOMPLETE','Commercial story is incomplete','Contract and committed value are visible, but certification, payment, cash, retention and claims evidence are not fully established.'],
    'cost-forecast':['REVIEW REQUIRED','Cost forecast requires evidence basis and clean axes','Cost charts must start at zero unless negative values are real. Show actual, committed, remaining and EAC basis separately.'],
    'variations-change':['EVIDENCE INCOMPLETE','Variation lifecycle is not complete','Approved status coverage is not the same as full lifecycle coverage. Show instruction, submission, assessment, agreement, approval and downstream links separately.'],
    'payments':['EVIDENCE INCOMPLETE','Payment lifecycle evidence is incomplete','Stage coverage, applied, assessed, certified and paid dates must be established before this page is commercially defensible.'],
    'cash-flow':['EVIDENCE INCOMPLETE','Cash position withheld because evidence is incomplete','A funding or cash S-curve must not be drawn without dated cash receipts/expenditure and payment basis. Withholding is correct.'],
    'commercial-claims-notices':['EVIDENCE INCOMPLETE','Claim position is not management-readable yet','Show claim count, amount coverage, notice chain, determination status and evidence gaps first. Hashes belong in technical drill-down.'],
    'contract-particulars-bonds':['EVIDENCE INCOMPLETE','Zero obligations may mean missing evidence','Do not show zero bonds or obligations unless the source explicitly confirms none. If the register is missing, display not established.']
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
      var next=v;
      textRules.forEach(function(rule){ next=next.replace(rule[0],rule[1]); });
      if(next!==v) n.nodeValue=next;
    });
  }
  function currentKey(){
    if(window.currentModuleResult&&window.currentModuleResult.key) return window.currentModuleResult.key;
    var active=document.querySelector('.nav-item.active[data-key]');
    return active?active.getAttribute('data-key'):'';
  }
  function setBadge(rule){
    var badge=document.getElementById('moduleBadge');
    if(!badge) return;
    if(badge.textContent!==rule[0]) badge.textContent=rule[0];
    badge.classList.remove('cmeng-status-evidence','cmeng-status-review');
    badge.classList.add(rule[0].indexOf('INCOMPLETE')>=0?'cmeng-status-evidence':'cmeng-status-review');
  }
  function apply(){
    if(applying) return;
    var root=document.getElementById('moduleContent');
    if(!root) return;
    applying=true;
    try{
      ensureStyle();
      replaceText(root);
      var key=currentKey();
      var rule=pageRules[key];
      if(root.getAttribute('data-cmeng-credibility-key')!==key){
        root.querySelectorAll('.cmeng-credibility-banner,.cmeng-population-note').forEach(function(x){x.remove();});
        root.setAttribute('data-cmeng-credibility-key',key);
      }
      if(rule){
        if(!root.querySelector('.cmeng-credibility-banner')){
          var div=document.createElement('div');
          div.className='cmeng-credibility-banner';
          div.innerHTML='<b>'+rule[1]+'</b><p>'+rule[2]+'</p>';
          root.insertBefore(div,root.firstChild);
        }
        setBadge(rule);
      }
      if((key==='schedule-analytics'||key==='activity-analytics'||key==='pmo-analysis')&&!root.querySelector('.cmeng-population-note')){
        var note=document.createElement('div');
        note.className='cmeng-population-note';
        note.textContent='Population rule: every schedule KPI must show total activities, analysed population, excluded population and exclusion reason. Counts using different populations must not be compared without this note.';
        var anchor=root.querySelector('.cmeng-credibility-banner');
        root.insertBefore(note,anchor?anchor.nextSibling:root.firstChild);
      }
    } finally {
      applying=false;
    }
  }
  function schedule(){ if(applying) return; clearTimeout(timer); timer=setTimeout(apply,120); }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
</script>`;

let changedFiles = 0;
let sawUiBundle = false;
let injectedUi = false;

for (const file of walk(distRoot)) {
  let content = readFileSync(file, 'utf8');
  const before = content;
  for (const [from, to] of copyReplacements) {
    content = replaceAll(content, from, to);
  }
  if (file.endsWith(uiBundleSuffix)) {
    sawUiBundle = true;
    if (content.includes('__cmengCredibilityHotfix')) {
      injectedUi = true;
    } else if (content.includes('</body>')) {
      content = content.replace('</body>', `${clientHotfix}\n</body>`);
      injectedUi = true;
    }
  }
  if (content !== before) {
    writeFileSync(file, content);
    changedFiles += 1;
  }
}

if (!sawUiBundle) {
  throw new Error(`CMeng UI bundle not found at ${uiBundleSuffix}`);
}
if (!injectedUi) {
  throw new Error('CMeng credibility hotfix was not injected into the UI bundle');
}

console.log(JSON.stringify({ status: 'credibility-hotfix-applied', changedFiles, uiInjected: injectedUi }));
