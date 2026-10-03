import {projectDiagnosisScript,projectDiagnosisStyles} from './ui-project-diagnosis';
import {answerFirstScript,answerFirstStyles} from './ui-answer-first';
import {askAiHtml,askAiStyles,askAiScript} from './ui-ask-ai';
import {deliveryScript} from './ui-delivery';
import {programmeReviewScript} from './ui-programme-review';
import {uploadWorkScript} from './ui-upload-work';
import {aggregateCount} from '../../truth-kernel/src/aggregates';
import {MANAGEMENT_DIAGNOSTIC_LABELS} from '../../truth-kernel/src';
import {moduleRegistry, titleForModule} from './registry';
import {STATUS_LABELS} from './position-review';
import {systemReviewScript,systemReviewStyles} from './ui-system-review';
import {projectActionsScript,projectActionsStyles} from './ui-project-actions';
import {basisReviewScript} from './ui-basis-review';
import { experienceStyles, experienceScript } from './ui-experience';

export function cmengUatHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CMeng | Project Control</title>
<style>
:root{
  --bg:#f4f7fb;--panel:#ffffff;--ink:#1f2f43;--muted:#6f7f92;--line:#dce5ef;
  --accent:#4f7fb4;--accent-strong:#3d6897;--accent-soft:#edf4fb;--cool:#91a8c0;
  --graphite:#506579;--ivory:#ffffff;--stone:#eef3f8;--slate:#22364d;
  --danger:#b4483e;--warn:#b57922;--ok:#2c7a57;--teal:#6f8ca8;
  --soft:#f8fafc;--soft-blue:#f2f6fb;--shadow:0 1px 2px rgba(34,54,77,.025),0 7px 22px rgba(34,54,77,.045);
  --shadow-strong:0 12px 34px rgba(34,54,77,.065)
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;font-family:Inter,"Segoe UI",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5;overflow-x:hidden}h1,h2,h3,h4,h5,.brand-copy h1,.kpi-value,.summary-metric b,.position-value{font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif}
button,input,select{font:inherit}button{cursor:pointer}
.app{display:grid;grid-template-columns:258px minmax(0,1fr);min-height:100vh}
.sidebar{background:var(--ivory);color:var(--slate);padding:20px 14px 18px;position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #dce5ef;box-shadow:6px 0 28px rgba(46,58,70,.025)}
.brand{display:flex;align-items:center;gap:10px;padding:15px 7px 16px;border-bottom:1px solid #dce5ef;margin:-20px 0 14px;position:sticky;top:-20px;z-index:7;background:rgba(248,247,244,.98);backdrop-filter:blur(10px)}
.brand-mark{width:50px;height:50px;display:grid;place-items:center;flex:0 0 auto}.cmeng-emblem{width:50px;height:50px;display:block}.cmeng-emblem .c-ring{fill:none;stroke:url(#cmengBlue);stroke-width:9;stroke-linecap:round}.cmeng-emblem .arrow{fill:#2c3f54}.cmeng-emblem .hub{fill:#5f86ad}
.brand-copy h1{font-size:23px;line-height:1;margin:0 0 5px;letter-spacing:-.04em;font-weight:780;color:var(--slate)}.brand-copy p{margin:0;color:#66727f;font-size:9.5px;line-height:1.35;text-transform:uppercase;letter-spacing:.09em;font-weight:700}
.platform-nav{display:grid;gap:4px;margin:0 0 14px}.platform-item{width:100%;border:0;background:transparent;color:#4f5b67;text-align:left;padding:10px 11px;border-radius:9px;display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:650;transition:.16s ease}.platform-item:hover{background:#eef4fa;color:var(--slate)}.platform-item.active{background:#eaf2fb;color:var(--slate);box-shadow:inset 3px 0 0 var(--accent)}.platform-icon{width:18px;text-align:center;color:#7e8993;font-weight:850}.platform-item.active .platform-icon{color:#456f9f}.active-project-card{margin:10px 0 6px;padding:12px;border:1px solid #d7e2ed;border-radius:10px;background:#fff;box-shadow:0 4px 14px rgba(46,58,70,.03)}.active-project-card b{display:block;font-size:12.5px;color:#23272e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.active-project-card span{display:block;color:#7a8290;font-size:10.5px;margin-top:3px}.sidebar-divider{height:1px;background:#dce5ef;margin:13px 0}.sidebar-motto{margin:30px 10px 2px;padding-top:18px;border-top:1px solid #dce5ef;color:#7d8790}.sidebar-motto span{display:block;font-size:9px;letter-spacing:.13em;font-weight:800;margin-bottom:6px}.sidebar-motto b{display:block;font-size:11px;line-height:1.45;font-weight:600;color:#5f6b76}
.platform-view[hidden],#projectWorkspace[hidden],#projectModulePanel[hidden]{display:none!important}.project-side-only{display:none}.project-active .project-side-only{display:block}
.portfolio-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}.portfolio-hero h2{font-size:34px;line-height:1.08;margin:0 0 8px;letter-spacing:-.045em}.portfolio-hero p{margin:0;color:var(--muted);max-width:780px;font-size:14px}.portfolio-hero .section-kicker{color:#4e7299}
.portfolio-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.summary-metric{position:relative;padding:17px 18px 16px 62px;min-height:102px;background:#fff;border:1px solid #dce5ef;border-radius:12px;box-shadow:0 5px 16px rgba(46,58,70,.035)}.summary-icon{position:absolute;left:17px;top:17px;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:#edf4fb;color:#3d6897;font-size:16px;font-weight:800}.summary-metric b{display:block;font-size:27px;line-height:1;margin-bottom:7px;letter-spacing:-.04em;color:var(--slate)}.summary-metric span{display:block;font-size:10.5px;color:#5f6b76;text-transform:uppercase;letter-spacing:.065em;font-weight:800}.summary-metric small{display:block;color:#9299a0;font-size:11px;margin-top:4px}
.portfolio-section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:24px 0 10px}.portfolio-section-head h3{margin:0;font-size:18px;letter-spacing:-.02em}.portfolio-section-head span{font-size:12px;color:var(--muted)}
.portfolio-project-list{display:grid;gap:10px}.portfolio-project{background:#fff;border:1px solid #dce5ef;border-radius:13px;padding:0;overflow:hidden;box-shadow:0 5px 18px rgba(46,58,70,.035);transition:border-color .15s ease,box-shadow .15s ease}.portfolio-project:hover{border-color:#b8cadc;box-shadow:0 9px 28px rgba(46,58,70,.065)}.portfolio-project-main{display:grid;grid-template-columns:minmax(235px,1.25fr) repeat(4,minmax(125px,.72fr)) auto;gap:0;align-items:stretch}.portfolio-project-title{padding:18px 18px;border-right:1px solid #e6edf4}.portfolio-project-title h3{font-size:16px;margin:0 0 5px;letter-spacing:-.01em}.portfolio-project-title .project-meta{font-size:11.5px;color:var(--muted)}.portfolio-project-title .position-chip{margin-top:11px}
.portfolio-project-metric{padding:16px 14px;border-right:1px solid #e6edf4;display:flex;flex-direction:column;justify-content:center;min-width:0}.portfolio-project-metric span{font-size:9.5px;color:#7a8594;text-transform:uppercase;letter-spacing:.055em;font-weight:800;margin-bottom:6px}.portfolio-project-metric strong{font-size:14px;color:#202733;line-height:1.3;overflow:hidden;text-overflow:ellipsis}.portfolio-project-metric small{font-size:10.5px;color:#8a93a1;margin-top:4px}
.position-chip{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.position-chip.current{background:#edf7f1;color:#2c7a57}.position-chip.review{background:#fff5df;color:#9a671f}.position-chip.missing{background:#fbeeed;color:#a4433b}
.portfolio-project-open{display:flex;align-items:center;padding:14px 16px}.portfolio-project-open .btn{white-space:nowrap}.project-attention{border-top:1px solid #e6edf4;background:#f3f7fb;padding:10px 16px;font-size:12px;color:#76521a;display:flex;align-items:flex-start;gap:8px}.project-attention b{white-space:nowrap}.project-attention.no-action{background:#fbfdff;color:#7a8594}
.portfolio-attention{margin-top:18px;background:#fff;border:1px solid #dce5ef;border-radius:13px;overflow:hidden;box-shadow:0 5px 18px rgba(46,58,70,.03)}.portfolio-attention-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.portfolio-attention-head h3{margin:0;font-size:16px}.attention-row{display:grid;grid-template-columns:190px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 16px;border-bottom:1px solid #edf0f2}.attention-row:last-child{border-bottom:0}.attention-row b{font-size:12px}.attention-row span{font-size:12px;color:#5f6b7a}
.portfolio-empty{background:#fff;border:1px solid var(--line);border-radius:14px;padding:42px;display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:18px;align-items:center;box-shadow:0 6px 24px rgba(15,23,42,.035)}.portfolio-empty-mark{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#edf3f9;color:#496f98;font-size:24px}.portfolio-empty h3{font-size:20px;margin:0 0 6px}.portfolio-empty p{margin:0;color:var(--muted);font-size:13px;max-width:660px}.portfolio-empty-actions{display:flex;gap:8px;flex-wrap:wrap}
.project-create{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;max-width:620px}.project-create input{height:42px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px}
.ai-shell{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.65fr);gap:16px}.ai-panel,.ai-context{background:#fff;border:1px solid #dce5ef;border-radius:12px;padding:18px;box-shadow:var(--shadow)}.ai-panel h3,.ai-context h3{margin:0 0 6px}.ai-intro{color:var(--muted);font-size:13px;margin-bottom:15px}.ai-composer{display:flex;gap:8px}.ai-composer textarea{width:100%;min-height:96px;resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font:inherit}.ai-answer{margin-top:14px;border:1px solid #dce5ef;border-radius:10px;background:#faf8f5;padding:14px;white-space:pre-wrap;font-size:13px;line-height:1.55}.ai-suggestions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.ai-suggestion{border:1px solid #d8e3ee;background:#fff;border-radius:999px;padding:7px 10px;font-size:11.5px;color:#56626e;cursor:pointer}.run-state{font-size:11.5px;color:var(--muted)}
@media(max-width:1100px){.portfolio-project-main{grid-template-columns:minmax(230px,1fr) repeat(2,minmax(140px,.7fr));}.portfolio-project-open{grid-column:1/-1;justify-content:flex-end;border-top:1px solid #edf0f2}.portfolio-summary{grid-template-columns:1fr 1fr}.summary-metric:nth-child(2){border-right:0}.summary-metric:nth-child(-n+2){border-bottom:1px solid #eceff2}}@media(max-width:900px){.portfolio-summary{grid-template-columns:1fr 1fr}.ai-shell{grid-template-columns:1fr}.portfolio-project-main{grid-template-columns:1fr 1fr}.portfolio-project-title{grid-column:1/-1;border-right:0;border-bottom:1px solid #edf0f2}.portfolio-project-metric:nth-of-type(even){border-right:0}.portfolio-empty{grid-template-columns:48px 1fr}.portfolio-empty-actions{grid-column:1/-1}.attention-row{grid-template-columns:1fr}.attention-row .btn{justify-self:start}}
.nav-group{margin:18px 0}.nav-group-title{font-size:10.5px;color:#8a929a;text-transform:uppercase;letter-spacing:.11em;padding:0 10px 8px;font-weight:760}
.nav-item{width:100%;border:0;background:transparent;color:#56626e;text-align:left;padding:9px 11px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:13px;font-weight:590;transition:.16s ease}
.nav-item:hover{background:#eef4fa;color:var(--slate)}.nav-item.active{background:#e9f1f9;color:var(--slate);box-shadow:inset 3px 0 0 #5e88b7}
.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status-dot{width:8px;height:8px;border-radius:50%;background:#9ba3ad;flex:0 0 auto;box-shadow:0 0 0 3px rgba(90,75,40,.035)}.status-dot.ready{background:#32d583}.status-dot.partial{background:#fdb022}.status-dot.blocked{background:#f97066}.nav-state{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}.module-live-dot{width:8px;height:8px;border-radius:50%;background:#32d583;box-shadow:0 0 0 3px rgba(50,213,131,.09);flex:0 0 auto}.evidence-flag{width:15px;height:15px;border-radius:999px;display:inline-grid;place-items:center;font-size:9px;font-weight:900;line-height:1;flex:0 0 auto}.evidence-flag.partial{background:#fff4e5;border:1px solid #f5c97d;color:#9a671f}.evidence-flag.blocked{background:#f2f4f7;border:1px solid #d0d5dd;color:#667085}.nav-state-legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 9px 8px;padding:7px 8px;border:1px solid #e3e9ef;border-radius:8px;background:#fbfcfd;color:#7a8594;font-size:9.5px;font-weight:700}.nav-state-legend span{display:inline-flex;align-items:center;gap:5px}.nav-state-legend .evidence-flag{width:14px;height:14px;font-size:8px}
.main{min-width:0}.topbar{min-height:64px;background:rgba(248,247,244,.96);backdrop-filter:blur(12px);border-bottom:1px solid #dfdbd4;display:flex;align-items:center;gap:9px;padding:10px 26px;position:sticky;top:0;z-index:10;flex-wrap:wrap;box-shadow:0 1px 0 rgba(15,23,42,.02)}.topbar-context{display:flex;flex-direction:column;gap:1px;padding-left:14px;margin-left:2px;border-left:1px solid var(--line);min-width:150px}.topbar-context b{font-size:12px;color:var(--slate)}.topbar-context span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;font-weight:750}.topbar-spacer{flex:1}.release-state{display:none!important}.release-state:before{content:"";width:7px;height:7px;border-radius:50%;background:#32d583;box-shadow:0 0 0 3px #ecfdf3}.platform-context{display:flex;flex-direction:column;min-width:160px}.platform-context span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:800}.platform-context b{font-size:13px;color:var(--slate)}.project-only{display:none!important}.project-active .topbar{display:flex}.project-active .project-only{display:flex!important}.project-active button.project-only{display:inline-flex!important}.project-active .topbar-context.project-only{display:flex!important}.auto-run-toggle{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted);font-weight:650}.auto-run-toggle input{width:auto}
.project-input{display:flex;align-items:center;gap:9px;min-width:350px}.project-input label{font-size:12px;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}.project-input input{height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px;min-width:220px;background:#fff;color:var(--ink);font-weight:650;outline:none}.project-input input:focus{border-color:#6f96bd;box-shadow:0 0 0 3px rgba(79,127,180,.16)}
.btn{border:1px solid #cbd7e3;background:#fff;border-radius:9px;padding:9px 14px;font-weight:650;font-size:13px;color:var(--slate);min-height:40px;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}.btn:hover{background:#f6f3ee;border-color:#9eb6cf}.btn:active{transform:translateY(1px)}.btn.primary{background:#4f7fb4;border-color:#4f7fb4;color:#fff;box-shadow:0 4px 12px rgba(50,86,125,.16)}.btn.primary:hover{background:#3d6897;border-color:#3d6897}.btn.small{padding:7px 11px;font-size:12px;min-height:34px}.btn.active{background:#ece6de;border-color:#4f7fb4;color:var(--slate)}
.content{padding:30px 34px 66px;width:100%;max-width:none;margin:0}
.workspace-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.workspace-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}.quick-upload-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:11px 14px;border:1px solid #e6e0d4;border-left:3px solid var(--accent);border-radius:9px;background:#fcfbf8;color:var(--ink)}.quick-upload-copy{min-width:0}.quick-upload-copy b{display:block;font-size:14px;margin-bottom:2px}.quick-upload-copy span{font-size:12px;color:var(--muted)}.quick-upload-actions{display:flex;gap:8px;flex:0 0 auto}.btn.upload-cta{background:#fff;color:#3f3525;border-color:#d9cfbd;box-shadow:none}.btn.upload-cta:hover{background:var(--accent-strong);border-color:var(--accent-strong)}.btn.ghost-dark{background:#fff;color:#334155;border-color:#cbd5e1}.btn.ghost-dark:hover{background:#fbfdff;border-color:#b8c4d1}.page-title{margin:0}.page-title .eyebrow,.section-kicker{display:block;font-size:11px;color:#617086;text-transform:uppercase;letter-spacing:.095em;font-weight:800;margin-bottom:6px}.page-title h2{font-size:29px;line-height:1.15;letter-spacing:-.035em;margin:0 0 7px}.page-title p{margin:0;color:var(--muted);font-size:14px;max-width:780px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px}.grid.two{grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr)}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:18px}.card h3{font-size:16px;line-height:1.25;margin:0 0 13px;letter-spacing:-.01em}.kpi-card{padding:17px 18px;min-height:112px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;margin-bottom:9px;font-weight:750}.kpi-value{font-size:25px;font-weight:780;letter-spacing:-.035em;line-height:1.08}.kpi-sub{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.35}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.045em;background:#ece9e4;color:#55616d;white-space:nowrap}.badge.ready{background:#edf7f1;color:var(--ok)}.badge.partial{background:#fff5df;color:var(--warn)}.badge.blocked{background:#fbeeed;color:var(--danger)}
.module-panel{padding:0;margin:0;overflow:hidden;border-radius:12px;box-shadow:var(--shadow-strong);min-height:560px;border-color:#dfdbd4}.module-panel>.module-head{padding:20px 22px 18px;border-bottom:1px solid var(--line);margin:0;background:linear-gradient(180deg,#fff,#faf9f7)}.module-workspace-head>div{min-width:0}.module-workspace-head h3{font-size:24px;margin:0 0 4px;letter-spacing:-.025em}.module-workspace-head p{margin:0;color:var(--muted);font-size:13px}.module-panel #moduleContent{padding:22px;min-height:470px;background:#faf9f7}
.module-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.module-head-actions{display:flex;align-items:center;gap:8px}.module-head-actions #moduleReport{white-space:nowrap}.module-head h3{font-size:18px;margin:0}.role-view-selector{display:flex;align-items:center;gap:7px;padding:11px 18px;border-bottom:1px solid #dce5ef;background:#f7f9fc;overflow-x:auto;scrollbar-width:thin}.role-view-selector-label{flex:0 0 auto;font-size:9.5px;font-weight:850;letter-spacing:.075em;text-transform:uppercase;color:#7b8795;margin-right:4px}.role-view-button{flex:0 0 auto;border:1px solid #ced9e5;background:#fff;color:#506579;border-radius:8px;padding:7px 10px;font-size:10.5px;font-weight:760;white-space:nowrap;transition:.15s ease}.role-view-button:hover{border-color:#9fb7ce;color:#2f5f8d}.role-view-button.active{background:#315f8a;color:#fff;border-color:#315f8a;box-shadow:0 3px 10px rgba(49,95,138,.14)}.role-view-button small{display:none}.role-lens{margin:0 0 14px;border:1px solid #d7e2ed;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(34,54,77,.035)}.role-lens-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;padding:14px 16px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.role-lens-head .section-kicker{margin-bottom:4px}.role-lens-head h4{margin:0;font-size:17px;color:#22364d;letter-spacing:-.015em}.role-lens-head p{margin:5px 0 0;font-size:12px;color:#667085;max-width:900px}.role-lens-badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#edf4fb;color:#315f8a;font-size:9.5px;font-weight:850;text-transform:uppercase;letter-spacing:.045em;white-space:nowrap}.role-lens-body{padding:14px 16px}.role-focus-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}.role-focus-card{border:1px solid #e0e7ef;border-radius:9px;padding:11px 12px;background:#fff}.role-focus-card span{display:block;font-size:9px;color:#8a97a7;text-transform:uppercase;letter-spacing:.055em;font-weight:850}.role-focus-card b{display:block;margin-top:4px;font-size:11.5px;line-height:1.35;color:#344054}.role-signal-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.role-signal{min-width:0;border:1px solid #e1e7ee;border-radius:9px;padding:10px 11px;background:#f9fbfd}.role-signal.danger{border-top:3px solid #b4483e;background:#fff8f7}.role-signal.warning{border-top:3px solid #b57922;background:#fffaf2}.role-signal.success{border-top:3px solid #2c7a57;background:#f7fbf8}.role-signal span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.045em;color:#8491a2;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-signal b{display:block;margin-top:5px;font-size:14px;color:#22364d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-action-panel{margin-top:12px;border-top:1px solid #edf1f5;padding-top:11px}.role-action-panel>strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7b8795;margin-bottom:7px}.role-action-list{display:grid;gap:6px}.role-action-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;align-items:start;padding:7px 9px;border-radius:7px;background:#fff8ed;font-size:11px;color:#596777}.role-action-row i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#f4e6c7;color:#8a5a14;font-size:9px;font-weight:850}.role-review-layers{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.role-review-layer{padding:10px;border:1px solid #dfe7ef;border-radius:9px;background:#f9fbfd;min-width:0}.role-review-layer b{display:block;font-size:10.5px;color:#344054}.role-review-layer span{display:block;margin-top:3px;font-size:9.5px;color:#7b8795;line-height:1.3}.role-lens-compact .role-lens-head{border-bottom:0;padding-bottom:10px}.role-lens-compact-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid #edf1f5;background:#fbfcfe}.role-lens-compact-strip>div{padding:9px 14px;border-right:1px solid #edf1f5}.role-lens-compact-strip>div:last-child{border-right:0}.role-lens-compact-strip b{display:block;font-size:10px;color:#344054}.role-lens-compact-strip span{display:block;margin-top:2px;font-size:9.5px;color:#7b8795}.role-primary-analysis{min-width:0}.role-supporting-detail{margin-top:14px;border:1px solid #dce5ef;border-radius:11px;background:#fff;overflow:hidden}.role-supporting-detail>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#fbfdff;cursor:pointer;font-size:11px;font-weight:800;color:#344054}.role-supporting-detail>summary::-webkit-details-marker{display:none}.role-supporting-detail>summary span{font-weight:600;color:#7b8795}.role-supporting-detail-body{padding:14px}.role-view-executive .role-primary-analysis .planning-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.role-view-planning .role-lens{border-left:4px solid #566e99}.role-view-controls .role-lens{border-left:4px solid #4f7fb4}.role-view-project-director .role-lens{border-left:4px solid #3f7f76}.role-view-program-director .role-lens{border-left:4px solid #6d628e}.role-view-executive .role-lens{border-left:4px solid #315f8a}.role-view-overall .role-lens{border-left:4px solid #22364d}@media(max-width:1280px){.role-signal-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.role-review-layers{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:900px){.role-focus-grid{grid-template-columns:1fr}.role-signal-grid{grid-template-columns:1fr 1fr}.role-review-layers{grid-template-columns:1fr 1fr}.role-lens-compact-strip{grid-template-columns:1fr}.role-lens-compact-strip>div{border-right:0;border-bottom:1px solid #edf1f5}.role-lens-compact-strip>div:last-child{border-bottom:0}.role-lens-head{grid-template-columns:1fr}.role-view-selector{padding:9px 12px}}
.director-section{margin-top:24px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:14px;margin:0 0 12px}.section-heading h3{font-size:20px;margin:0 0 3px;letter-spacing:-.02em}.section-heading p{font-size:13px;color:var(--muted);margin:0}
.scalar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:11px;margin-bottom:14px}.scalar{background:#f7f5f1;padding:13px 14px;border-radius:9px;border:1px solid #e8e3db;min-width:0}.scalar b{display:block;font-size:11.5px;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;font-weight:750}.scalar span{font-size:15px;font-weight:680;word-break:break-word}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:min(66vh,680px);background:#fff;scrollbar-color:#c7d2df transparent;scrollbar-width:thin}table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f1eee9;color:#55616d;font-weight:780;position:sticky;top:0;z-index:2;font-size:11.5px;letter-spacing:.025em;white-space:nowrap;text-transform:none}td{color:#27364a}tbody tr:nth-child(even) td{background:#fbfaf8}tbody tr:hover td{background:#f5f2ed}tr:last-child td{border-bottom:0}.kpi-value,.position-value,.scalar span,.currency-line strong,.movement-value,.candidate-value{font-variant-numeric:tabular-nums}.module-panel{position:relative}.module-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#4f7fb4,#a9c1da);z-index:3}.module-basis{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.basis-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 9px;border:1px solid #dbe4ee;border-radius:9px;background:#fff;font-size:11.5px;color:#506579}.basis-chip b{font-size:10.5px;color:#738198;text-transform:uppercase;letter-spacing:.05em}.basis-chip strong{font-size:12.5px;color:#2e3a46;font-weight:780}.focus-module .app{grid-template-columns:minmax(0,1fr)}.focus-module .sidebar{display:none}.focus-module .content{max-width:none;padding:18px}.focus-module .topbar{position:sticky;top:0}.page-expand{white-space:nowrap;margin-left:auto;flex-shrink:0}
.advanced-control-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.advanced-control-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin:16px 0}.advanced-control-head h3{margin:0 0 4px}.advanced-controls #advancedControlHost:empty{display:none}
.scope-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px;align-items:end}.scope-filter-grid label{display:grid;gap:4px;font-size:10.5px;font-weight:750;color:#64748b}.scope-filter-grid select,.scope-filter-grid input{height:36px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:0 9px;color:#334155;font-size:11.5px}.scope-filter-grid .btn{align-self:end}
.progress-breakdown-tabs{margin:14px 0}.progress-breakdown-tabs .btn{display:grid;gap:2px;text-align:left;min-width:128px}.progress-breakdown-tabs .btn small{font-size:9.5px;font-weight:600;opacity:.78}.progress-breakdown-toolbar{display:grid;grid-template-columns:minmax(220px,2fr) minmax(180px,1fr) auto;gap:10px;align-items:end;margin:0 0 12px}.progress-breakdown-toolbar label{display:grid;gap:4px;font-size:10.5px;font-weight:750;color:#64748b}.progress-breakdown-toolbar input,.progress-breakdown-toolbar select{height:36px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:0 9px;color:#334155;font-size:11.5px}.progress-breakdown-toolbar .register-search-count{align-self:center;white-space:nowrap}@media(max-width:760px){.progress-breakdown-toolbar{grid-template-columns:1fr}.progress-breakdown-toolbar .register-search-count{justify-self:start}}
.actions{display:flex;flex-direction:column;gap:8px}.action{padding:11px 13px;background:#fff8ed;border-left:3px solid #f79009;border-radius:7px;font-size:13px}
.empty{padding:34px;text-align:center;color:var(--muted);font-size:14px}.notice{padding:12px 14px;border-radius:9px;font-size:13px;margin:11px 0;line-height:1.45}.notice.info{background:#f3eee7;color:#5b5144;border:1px solid #d8e4ef}.notice.warn{background:#fff6e5;color:#8b5a16;border:1px solid #ead8ac}.notice.error{background:#fff1f0;color:#912018;border:1px solid #ffd8d3}
.upload-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.upload-box{border:1px solid #ded8cf;border-radius:11px;padding:14px;background:#faf9f7}.upload-box strong{font-size:13px;display:block;margin-bottom:5px}.upload-box small{color:var(--muted);display:block;margin-bottom:10px;line-height:1.45;font-size:12px}.upload-box input{width:100%;font-size:12px}.intent-control{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:10px 0;padding:8px 9px;background:#eef4fa;border-radius:8px}.intent-control span{font-size:11px;color:#66727f;font-weight:750}.intent-control select{max-width:175px;height:32px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;font-size:11.5px;padding:0 7px}
.wide-upload{margin-top:12px;border:1px solid #d9e4ee;border-radius:11px;padding:14px;background:#faf8f5;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.wide-upload strong{font-size:13px;display:block;margin-bottom:4px}.wide-upload small{color:var(--muted);font-size:12px}.wide-upload input{font-size:12px;width:100%;margin-top:8px}
.upload-progress-card{margin-top:12px;padding:14px 15px;border:1px solid #cbdcec;border-radius:11px;background:#fff;box-shadow:0 5px 16px rgba(34,54,77,.035)}.upload-progress-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:10px}.upload-progress-head strong{font-size:13.5px;color:var(--slate)}.upload-progress-head b{font-size:19px;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums}.upload-progress-track{height:9px;border-radius:999px;background:#e7eef6;overflow:hidden}.upload-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#2f6fb2,#1f5eff);border-radius:999px;transition:width .25s ease}.upload-progress-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-top:9px;font-size:11.5px;color:var(--muted)}.upload-progress-current{margin-top:6px;font-size:11px;color:#506579;overflow-wrap:anywhere}.document-updated{white-space:nowrap;font-size:11.5px;color:#506579}.document-updated b{display:block;color:var(--slate);font-size:11.5px}.document-updated small{display:block;margin-top:2px;color:var(--muted)}
.queue{margin-top:9px;display:flex;flex-direction:column;gap:7px}.queue-row{display:grid;grid-template-columns:minmax(260px,1fr) 205px auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:#fff}.queue-file{min-width:0}.queue-name{display:block;font-size:12.5px;font-weight:700;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;color:var(--slate);line-height:1.35}.queue-path{display:block;margin-top:3px;font-size:10.5px;color:var(--muted);white-space:normal;overflow-wrap:anywhere}.queue-role-control{display:grid;gap:4px}.queue-role-control label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:800}.queue-row select{height:34px;border:1px solid #cbd5e1;border-radius:7px;font-size:11.5px;background:#fff}.queue-remove,.document-delete{border:1px solid #efc2bd;background:#fff;color:#a13f36;border-radius:7px;padding:6px 9px;font-size:11px;font-weight:700}.queue-remove:hover,.document-delete:hover{background:#fff1f0}.document-delete:disabled{opacity:.45;cursor:not-allowed;background:#fff}.document-file{min-width:260px;max-width:460px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.35}.document-file .muted{display:block;margin-top:4px;font-size:10.5px}.document-position{white-space:nowrap}.evidence-bulk-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:#f8fbff}.evidence-bulk-bar label{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--slate)}.evidence-bulk-bar .bulk-spacer{flex:1}.evidence-bulk-count{font-size:11.5px;color:var(--muted);font-weight:700}.evidence-select,.evidence-select-all{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}.select-col{width:42px;min-width:42px;text-align:center!important;padding-left:8px!important;padding-right:8px!important}.upload-actions{display:flex;justify-content:flex-end;margin-top:10px}
.workspace-drawer{margin-top:20px;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:var(--shadow);overflow:hidden}.auxiliary-drawer{display:none;position:fixed;right:18px;top:76px;width:min(940px,calc(100vw - 290px));max-height:calc(100vh - 94px);margin:0;z-index:70;overflow:auto!important;box-shadow:0 24px 70px rgba(25,42,62,.22)}.auxiliary-drawer[open]{display:block}.auxiliary-drawer>summary{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line)}.auxiliary-drawer .drawer-body{min-height:160px}.auxiliary-drawer[open] .drawer-hint:after{content:"Close";font-size:12px}.auxiliary-drawer[open] .drawer-hint{font-size:0}.auxiliary-drawer:not([open]){display:none}.workspace-drawer>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 18px;cursor:pointer;background:#fff}.workspace-drawer>summary::-webkit-details-marker{display:none}.workspace-drawer>summary strong{display:block;font-size:15px}.workspace-drawer>summary .section-kicker{margin-bottom:3px}.drawer-hint{font-size:12px;color:var(--accent);font-weight:750}.workspace-drawer[open] .drawer-hint{color:var(--muted)}.drawer-body{padding:0 18px 18px;background:#faf9f7;border-top:1px solid var(--line)}.evidence-control-grid{grid-template-columns:minmax(280px,.62fr) minmax(0,1.5fr);align-items:start;padding-top:18px}.evidence-status-card{position:sticky;top:92px}.evidence-intake-card{min-width:0}
details:not(.workspace-drawer){border:1px solid var(--line);border-radius:9px;background:#fff}details:not(.workspace-drawer)>summary{padding:11px 13px;cursor:pointer;font-size:12.5px;font-weight:700}pre{margin:0;padding:13px;max-height:560px;overflow:auto;background:#0c1525;color:#d7e5ff;font-size:12px;line-height:1.55;border-radius:0 0 9px 9px;white-space:pre-wrap;word-break:break-word}
.currency-card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.currency-code{font-size:17px;font-weight:820;margin-bottom:8px}.currency-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;color:#506579}.currency-line strong{color:#2e3a46}
.challenge-card{padding:0!important;overflow:hidden}.challenge-card .challenge-head{padding:17px 18px;border-bottom:1px solid var(--line)}.challenge-card .challenge-summary{padding:15px 18px 0}.challenge-card .challenge-table-wrap{margin:15px 18px 18px}.conflict-expand-row>td{padding:0;background:#faf8f5!important}.conflict-panel{padding:16px 18px;border-top:1px solid #e4ded6;border-bottom:1px solid #e4ded6;background:linear-gradient(180deg,#faf8f5,#f5f1eb)}.conflict-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.conflict-title strong{font-size:14px}.conflict-title p{margin:3px 0 0;color:var(--muted);font-size:12px}.candidate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.candidate-card{border:1px solid #ddd5ca;border-radius:10px;background:#fff;padding:13px}.candidate-card.recommended{border-color:#4f7fb4;box-shadow:0 0 0 2px rgba(201,183,159,.14)}.candidate-value{font-size:20px;font-weight:790;letter-spacing:-.025em;margin:3px 0 9px}.candidate-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:11.5px;color:var(--muted)}.candidate-meta b{display:block;color:#506579;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}.candidate-sources{font-size:11.5px;color:#5d6b7e;margin-top:9px;word-break:break-word}.recommendation-card{margin-top:12px;padding:13px 14px;border-radius:10px;background:#f2ede6;border:1px solid #d7e3ef;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.recommendation-card strong{display:block;font-size:16px;color:var(--slate);margin:3px 0}.recommendation-card p{margin:0;color:#66727f;font-size:12px;line-height:1.45}.recommendation-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:820;color:#4e7299}.decision-pill{flex:0 0 auto;background:#fff7e8;color:#8b4b08;border:1px solid #f6d99f;border-radius:999px;padding:6px 9px;font-size:10.5px;font-weight:820;text-transform:uppercase;letter-spacing:.04em}
.view-state-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px;padding:10px 12px;border:1px solid #d8e3ee;border-radius:9px;background:#f8fbff}.view-state-bar strong{font-size:12px;color:var(--slate)}.view-state-bar span{font-size:11.5px;color:var(--muted)}.view-state-complete{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:#edf7f1;color:#2c7a57!important;font-weight:800}.view-state-review{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:#fff5df;color:#9a671f!important;font-weight:800}.challenge-attention{margin:12px 18px 0;border:1px solid #e4eaf1;border-radius:10px;overflow:hidden;background:#fff}.challenge-attention-head{padding:11px 13px;background:#f8fafc;border-bottom:1px solid #e7edf3}.challenge-attention-head strong{font-size:12.5px}.challenge-attention-head span{display:block;margin-top:2px;font-size:11px;color:var(--muted)}.challenge-attention-row{display:grid;grid-template-columns:minmax(190px,.85fr) minmax(180px,.65fr) minmax(0,1.4fr);gap:12px;padding:10px 13px;border-bottom:1px solid #edf1f5;font-size:11.5px}.challenge-attention-row:last-child{border-bottom:0}.challenge-attention-row b{color:var(--slate)}.challenge-attention-row span{color:#5e6c7c}.document-state-guide{margin:0 0 12px;padding:13px;border:1px solid #dce5ef;border-radius:10px;background:#fff}.document-state-guide h4{margin:0 0 9px;font-size:13px}.document-state-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.document-state-item{padding:9px 10px;border:1px solid #e7edf3;border-radius:8px;background:#fafcff;font-size:11px;line-height:1.4}.document-state-item b{display:block;color:var(--slate);margin-bottom:2px}.document-state-item span{color:var(--muted)}
.chart-card{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
.planning-view{display:grid;gap:14px;--module-accent:#4f7fb4}.resource-view{--module-accent:#3f7f76}.contract-challenge-view{--module-accent:#8b6b35}.forecast-history-view,.independent-forecast-view{--module-accent:#6d628e}.delay-claims-view,.notices-view,.windows-view,.eot-view{--module-accent:#8b6b35}.window-card.clean{grid-template-columns:minmax(280px,1.2fr) minmax(220px,.8fr) minmax(220px,.8fr)}.movement-value.small{font-size:14px;line-height:1.3}.progress-position-view{--module-accent:#4f7fb4}.variance-view{--module-accent:#8b6b35}.progress-scurve-view{--module-accent:#4f7fb4}.quantity-view{--module-accent:#6f7d4c}.wbs-view{--module-accent:#566e99}.manhour-view{--module-accent:#6d628e}.module-bar-list{display:grid;gap:8px}.module-bar-row{display:grid;grid-template-columns:minmax(150px,.9fr) minmax(180px,1.7fr) 80px;gap:10px;align-items:center}.module-bar-row>span{font-size:11px;color:#506579;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.module-bar-row>div{height:11px;border-radius:999px;background:#edf1f5;overflow:hidden}.module-bar-row i{display:block;height:100%;border-radius:999px;background:#4f7fb4}.module-bar-row i.warning{background:#b57922}.module-bar-row i.danger{background:#b4483e}.module-bar-row i.success{background:#2c7a57}.module-bar-row b{text-align:right;font-size:11px;color:#344054}.progress-basis-bars{display:grid;gap:11px}.progress-basis-row{display:grid;grid-template-columns:minmax(190px,.9fr) minmax(260px,1.6fr) 70px;gap:12px;align-items:center}.progress-basis-row>div:first-child b{display:block;font-size:12px;color:#344054}.progress-basis-row>div:first-child span{display:block;font-size:10px;color:#7b8795;margin-top:2px}.progress-track{height:16px;background:#edf1f5;border-radius:999px;overflow:hidden}.progress-track i{display:block;height:100%;background:#4f7fb4;border-radius:999px}.progress-basis-row strong{text-align:right;font-size:13px}.evidence-gates{display:grid;gap:8px}.evidence-gate{display:flex;justify-content:space-between;gap:12px;padding:10px 11px;border-left:3px solid #98a2b3;border-radius:7px;background:#f8fafc}.evidence-gate.ready{border-left-color:#2c7a57;background:#f4fbf7}.evidence-gate.missing{border-left-color:#b57922;background:#fffaf0}.evidence-gate span{font-size:11px;color:#667085}.evidence-gate b{font-size:11px;color:#344054}.pressure-matrix{display:grid;gap:6px}.pressure-matrix-head,.pressure-matrix-row{display:grid;grid-template-columns:140px repeat(5,minmax(82px,1fr));gap:6px;align-items:stretch}.pressure-matrix-head span,.pressure-matrix-head b{font-size:10.5px;color:#667085;text-align:center;padding:5px}.pressure-matrix-head span{text-align:left}.pressure-matrix-row>strong{display:flex;align-items:center;font-size:11px;color:#344054}.pressure-cell{min-height:48px;border-radius:7px;display:grid;place-items:center;border:1px solid #e3e8ef;background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell.danger{background:rgba(180,72,62,var(--cell-alpha))}.pressure-cell.danger-soft{background:rgba(196,96,79,var(--cell-alpha))}.pressure-cell.warning{background:rgba(181,121,34,var(--cell-alpha))}.pressure-cell.accent{background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell b{font-size:12px;color:#1f3349}.pressure-note,.float-distribution-note{margin-top:9px;font-size:10.5px;color:#7b8795}.constraint-bars,.finish-period-bars{display:grid;gap:8px}.constraint-row,.finish-period-row{display:grid;grid-template-columns:minmax(140px,.9fr) minmax(160px,1.7fr) 54px;gap:10px;align-items:center}.constraint-row span,.finish-period-row span{font-size:11px;color:#506579}.constraint-row>div,.finish-period-row>div{height:10px;background:#eef2f6;border-radius:999px;overflow:hidden}.constraint-row i,.finish-period-row i{display:block;height:100%;background:#b4483e;border-radius:999px}.finish-period-row i{background:#b57922}.constraint-row b,.finish-period-row b{text-align:right;font-size:11px;color:#344054}.revision-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.revision-value-card{border:1px solid #dde5ee;border-radius:9px;padding:11px;background:#fbfdff}.revision-value-head{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e8edf3;padding-bottom:7px}.revision-value-head b{font-size:11.5px;color:#22364d}.revision-value-head span{font-size:10px;color:#7b8795}.revision-value-lines{display:grid;gap:5px;margin-top:8px}.revision-value-lines span{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:#667085}.revision-value-lines b{color:#22364d}.milestone-context{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;padding:7px 9px;border-radius:7px;background:#f6f8fb;font-size:10.5px;color:#667085}.milestone-label small{display:block;margin-top:3px;font-size:9.5px;color:#8a96a6}.lookahead-state{white-space:normal;line-height:1.1}.float-histogram{overflow-x:auto}.management-view{--module-accent:#315f8a}.management-view{display:grid;gap:16px}
.pmc-control-room{display:grid;gap:16px}.pmc-control-head{display:flex;align-items:end;justify-content:space-between;gap:18px;padding:4px 2px}.pmc-control-head h3{margin:0;font-size:22px;letter-spacing:-.03em;color:#22364d}.pmc-control-head p{margin:5px 0 0;max-width:920px;color:#667085;font-size:12px;line-height:1.45}.pmc-domain-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.pmc-domain-card{position:relative;min-height:178px;padding:17px 18px;border:1px solid #dce5ef;border-top:5px solid #91a0b0;border-radius:15px;background:linear-gradient(180deg,#fff,#fbfdff);box-shadow:0 8px 24px rgba(34,54,77,.055);overflow:hidden}.pmc-domain-card.danger{border-top-color:#b4483e;background:linear-gradient(180deg,#fff,#fff8f7)}.pmc-domain-card.warning{border-top-color:#b57922;background:linear-gradient(180deg,#fff,#fffaf2)}.pmc-domain-card.good{border-top-color:#2c7a57;background:linear-gradient(180deg,#fff,#f6fbf8)}.pmc-domain-card.source{border-top-color:#4f7fb4;background:linear-gradient(180deg,#fff,#f7faff)}.pmc-domain-card.unresolved{border-top-color:#91a0b0}.pmc-domain-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.pmc-domain-head b{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#667085}.pmc-domain-state{padding:4px 7px;border-radius:999px;background:#f0f3f6;color:#667085;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.pmc-domain-card.danger .pmc-domain-state{background:#fff0ee;color:#9f3e35}.pmc-domain-card.warning .pmc-domain-state{background:#fff4dc;color:#8f641d}.pmc-domain-card.good .pmc-domain-state{background:#eaf6ef;color:#276b4e}.pmc-domain-card.source .pmc-domain-state{background:#edf4fb;color:#315f8a}.pmc-domain-value{margin-top:13px;font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif;font-size:27px;line-height:1.08;font-weight:800;letter-spacing:-.04em;color:#22364d}.pmc-domain-sub{margin-top:7px;min-height:34px;color:#5f7084;font-size:11.5px;line-height:1.45}.pmc-domain-meta{display:grid;gap:4px;margin:11px 0 12px;padding-top:10px;border-top:1px solid #edf1f5}.pmc-domain-meta span{display:flex;justify-content:space-between;gap:10px;font-size:10.5px;color:#718096}.pmc-domain-meta b{color:#344054;text-align:right}.pmc-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.pmc-path-list{display:grid;gap:7px}.pmc-path-node{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid #e1e8ef;border-radius:9px;background:#fbfdff}.pmc-path-node>i{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#315f8a;color:#fff;font-style:normal;font-size:10px;font-weight:850}.pmc-path-node b{display:block;font-size:11px;color:#22364d}.pmc-path-node span{display:block;margin-top:2px;font-size:9.5px;color:#7b8795}.pmc-path-node strong{font-size:10.5px;color:#b4483e}.pmc-governance-table td:first-child b{font-size:12px}.pmc-governance-state{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:850;text-transform:uppercase}.pmc-governance-state.danger{background:#fff0ee;color:#9f3e35}.pmc-governance-state.warning{background:#fff4dc;color:#8f641d}.pmc-governance-state.good{background:#eaf6ef;color:#276b4e}.pmc-governance-state.source{background:#edf4fb;color:#315f8a}.pmc-governance-state.unresolved{background:#eef1f4;color:#667085}@media(max-width:1100px){.pmc-domain-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pmc-chart-grid{grid-template-columns:1fr}}@media(max-width:680px){.pmc-domain-grid{grid-template-columns:1fr}.pmc-control-head{align-items:start;flex-direction:column}}
.management-two-column{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.management-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.management-metric-card{border:1px solid #dce5ef;border-radius:14px;background:#fff;padding:17px 18px;min-height:0;box-shadow:0 7px 20px rgba(34,54,77,.035)}.management-metric-card.attention{border-top:3px solid #b57922}.management-metric-card.critical{border-top:3px solid #b4483e}.management-metric-card.good{border-top:3px solid #2c7a57}.management-metric-card.unavailable{border-top:3px solid #91a0b0}.management-metric-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.management-metric-head>span{font-size:11px;font-weight:820;text-transform:uppercase;letter-spacing:.05em;color:#718096;max-width:72%}.management-metric-value{margin-top:14px;font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif;font-size:28px;line-height:1.12;font-weight:780;letter-spacing:-.035em;color:#22364d;word-break:normal;overflow-wrap:normal}.management-metric-value.date{font-size:27px;white-space:nowrap}.management-metric-value.missing{font-size:21px;color:#667085;letter-spacing:-.015em}.management-metric-badges{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0 13px}.management-metric-basis{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;padding-top:11px;border-top:1px solid #edf1f5;font-size:11.5px}.management-metric-basis span,.management-metric-note span{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:820;color:#8a96a6}.management-metric-basis b{color:#506579;font-weight:700}.management-metric-note{margin-top:10px}.management-metric-note p{font-size:11.5px;line-height:1.45;color:#506579;margin:3px 0 0}.management-metric-note.action p{color:#315f8a;font-weight:650}.management-metric-owner{margin-top:13px}.management-module-link{border:1px solid #bfd0e1;background:#fff;color:#315f8a;border-radius:7px;padding:6px 9px;font-size:10.5px;font-weight:800;cursor:pointer}.management-module-link:hover{background:#f3f7fb}.management-alert-list{display:grid;gap:10px}.management-alert{border:1px solid #dce5ef;border-left:4px solid #91a0b0;border-radius:9px;padding:12px;background:#fff}.management-alert.critical{border-left-color:#b4483e}.management-alert.high{border-left-color:#c67d2e}.management-alert.medium{border-left-color:#b59c4a}.management-alert.information{border-left-color:#4f7fb4}.management-alert-head{display:flex;justify-content:space-between;gap:12px}.management-alert-head b{color:#22364d}.management-alert-head span{text-transform:uppercase;font-size:9px;font-weight:900;color:#7b8795}.management-alert p{font-size:12px;color:#5f6f80}.management-alert-action{display:grid;grid-template-columns:110px 1fr;gap:10px;margin:9px 0;font-size:11.5px}.management-alert-action strong{color:#344054}.management-alert-action span{color:#506579}.management-decision-list{display:grid;gap:10px}.management-decision{display:grid;grid-template-columns:30px 1fr;gap:10px;border:1px solid #dce5ef;border-radius:9px;padding:12px}.management-decision>i{width:26px;height:26px;border-radius:50%;background:#315f8a;color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800}.management-decision b{color:#22364d}.management-decision-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin:7px 0;color:#667085;font-size:10.5px}.management-decision small{color:#8a96a6}.management-detail{margin-top:14px;border:1px solid #e0e7ef;border-radius:8px}.management-detail summary{padding:10px 12px;cursor:pointer;font-weight:800;color:#344054}.management-detail summary span{float:right;color:#7b8795;font-weight:600}.management-tag-list{display:flex;flex-wrap:wrap;gap:7px;padding:12px;border-top:1px solid #e7edf3}.management-tag-list span{padding:5px 8px;border-radius:999px;background:#f3f6f9;color:#506579;font-size:10.5px}.programme-review{--module-accent:#4f7fb4}.activity-review{--module-accent:#566e99}.lookahead-view{--module-accent:#3f7f76}.changes-view{--module-accent:#8b6b35}.revision-view{--module-accent:#6d628e}.milestone-view{--module-accent:#44759c}.nearcritical-view{--module-accent:#9b6a24}.planning-view .planning-panel.primary{border-top:3px solid var(--module-accent)}.planning-view .planning-panel-head h4{letter-spacing:-.01em}.planning-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.planning-kpi{min-height:94px;padding:14px 15px;border:1px solid #dce5ef;border-radius:11px;background:#fff;box-shadow:0 5px 16px rgba(34,54,77,.035)}.planning-kpi span{display:block;font-size:11.5px;color:#718096;font-weight:800;text-transform:uppercase;letter-spacing:.045em}.planning-kpi strong{display:block;margin-top:7px;font-size:24px;line-height:1.1;color:#22364d;letter-spacing:-.025em}.planning-kpi small{display:block;margin-top:6px;font-size:12px;color:#7b8795}.planning-kpi.danger{border-top:3px solid #b4483e}.planning-kpi.warning{border-top:3px solid #b57922}.planning-kpi.success{border-top:3px solid #2c7a57}.planning-kpi.accent{border-top:3px solid #4f7fb4}
.planning-primary-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.85fr);gap:14px}.comparison-ribbon{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:12px 14px;border:1px solid #dce5ef;border-radius:11px;background:#f8fbff}.comparison-ribbon div{min-width:0}.comparison-ribbon span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:#7b8795}.comparison-ribbon b{display:block;margin-top:3px;font-size:14px;color:#22364d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.comparison-ribbon i{font-style:normal;color:#4f7fb4;font-size:18px}.planning-panel{border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(34,54,77,.035)}.planning-panel.primary{box-shadow:0 9px 26px rgba(34,54,77,.055)}.planning-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px 12px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.planning-panel-head h4{margin:0;font-size:16px;color:#22364d}.planning-panel-head p{margin:4px 0 0;font-size:12.5px;color:#718096}.planning-panel-body{padding:15px 16px}.planning-view .table-wrap{max-height:620px;overflow:auto}.planning-view .table-wrap thead th{position:sticky;top:0;z-index:2;background:#f8fafc}.planning-view .table-wrap tbody tr:hover{background:#f8fbff}.planning-split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.planning-split h5{margin:0 0 10px;font-size:13.5px;color:#506579}
.status-band{height:42px;display:flex;overflow:hidden;border-radius:9px;border:1px solid #dce5ef;background:#f6f8fb}.status-band-segment{min-width:28px;display:flex;flex-direction:column;justify-content:center;padding:0 8px;color:#fff;overflow:hidden}.status-band-segment span{font-size:10.5px;font-weight:800;white-space:nowrap}.status-band-segment b{font-size:13px}.status-band-segment.danger{background:#b4483e}.status-band-segment.warning{background:#b57922}.status-band-segment.success{background:#2c7a57}.status-band-segment.accent{background:#4f7fb4}.status-band-segment.neutral{background:#91a0b0}.status-band-legend{display:flex;flex-wrap:wrap;gap:9px 14px;margin-top:9px}.status-band-legend span{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#667085}.status-band-legend i{width:8px;height:8px;border-radius:2px;background:#91a0b0}.status-band-legend i.danger{background:#b4483e}.status-band-legend i.warning{background:#b57922}.status-band-legend i.success{background:#2c7a57}.status-band-legend i.accent{background:#4f7fb4}.status-band-legend b{color:#344054}
.coverage-line{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f5;font-size:11.5px;color:#667085}.coverage-line b{color:#22364d}.coverage-stack{display:grid;gap:7px;margin-top:12px}.coverage-stack span{display:flex;justify-content:space-between;font-size:11.5px;color:#667085}.coverage-stack b{color:#22364d}
.date-ladder{display:grid;gap:10px}.date-ladder-row{display:grid;grid-template-columns:165px minmax(0,1fr);gap:12px;align-items:center}.date-ladder-label b{display:block;font-size:12.5px;color:#344054}.date-ladder-label span{display:block;font-size:11.5px;color:#7b8795;margin-top:2px}.date-ladder-track{position:relative;height:20px;border-radius:999px;background:#f1f4f8;border:1px solid #e2e8f0}.date-marker{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 0 0 1px rgba(45,55,72,.12)}.date-marker.baseline{background:#68788b}.date-marker.current{background:#4f7fb4}.date-marker.cmeng{background:#5055a8}.date-marker.scenario{background:#7c5ca8}.date-marker.actual{background:#2c7a57}.date-data-line{position:absolute;top:-5px;bottom:-5px;width:1px;background:#1f2937;opacity:.35}.date-ladder-key,.milestone-key{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:10.5px;color:#667085}.date-ladder-key span,.milestone-key span{display:inline-flex;align-items:center;gap:5px}.date-ladder-key i,.milestone-key i{width:9px;height:9px;border-radius:50%;background:#68788b}.date-ladder-key i.current,.milestone-key i.current{background:#4f7fb4}.date-ladder-key i.cmeng{background:#5055a8}.date-ladder-key i.scenario{background:#7c5ca8}.milestone-key i.actual{background:#2c7a57}.milestone-key i.data{width:1px;height:12px;border-radius:0;background:#1f2937}
.management-attention{display:grid;gap:8px}.management-attention-row{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;border-left:3px solid #b57922;background:#fffaf0;border-radius:7px}.management-attention-row.danger{border-left-color:#b4483e;background:#fff6f5}.management-attention-row b{display:block;font-size:12.5px;color:#344054}.management-attention-row span{display:block;margin-top:3px;font-size:11.5px;color:#667085;line-height:1.35}.management-attention-row strong{flex:0 0 auto;font-size:14px;color:#22364d}.attention-clear{padding:13px;border:1px solid #d7eadf;background:#f4fbf7;border-radius:9px;font-size:11.5px;color:#2c6a4c}
.management-health-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.integrity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.integrity-card{padding:12px;border:1px solid #dce5ef;border-radius:9px;background:#fff}.integrity-card span{display:block;font-size:10.5px;color:#667085}.integrity-card b{display:block;margin-top:4px;font-size:18px;color:#22364d}.integrity-card.danger{border-left:3px solid #b4483e}.integrity-card.warning{border-left:3px solid #b57922}.integrity-card.success{border-left:3px solid #2c7a57}
.signed-bars{display:grid;gap:7px}.signed-row{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr) minmax(76px,.55fr);gap:10px;align-items:center}.signed-label{min-width:0;overflow-wrap:anywhere;white-space:normal;font-size:10.5px;color:#506579}.signed-track{height:14px;position:relative;background:#f3f6f9;border-radius:4px}.signed-zero{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#98a2b3}.signed-bar{position:absolute;top:2px;height:10px;border-radius:3px;background:#91a0b0}.signed-bar.late{background:#b4483e}.signed-bar.early{background:#2c7a57}.signed-row>b{min-width:0;overflow-wrap:anywhere;text-align:right;font-size:10.5px;color:#475467}.late-text{color:#b42318!important}.early-text{color:#067647!important}.date-trend-note{font-size:10.5px;color:#7b8795;margin-top:5px}
.lookahead-axis,.lookahead-row{display:grid;grid-template-columns:220px minmax(430px,1fr) 92px;gap:10px;align-items:center}.lookahead-weeks{position:relative;height:20px}.lookahead-weeks span{position:absolute;transform:translateX(-50%);font-size:10.5px;color:#7b8795}.lookahead-timeline{display:grid;gap:6px;max-height:620px;overflow-y:auto;padding-right:4px}.lookahead-label{min-width:0}.lookahead-label b{display:block;font-size:11.5px;color:#344054}.lookahead-label span{display:block;font-size:10.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lookahead-track{position:relative;height:17px;border-radius:4px;background:repeating-linear-gradient(90deg,#f5f7fa 0,#f5f7fa calc(16.666% - 1px),#e4e7ec calc(16.666% - 1px),#e4e7ec 16.666%)}.lookahead-bar{position:absolute;top:3px;height:11px;border-radius:4px;background:#4f7fb4;min-width:3px}.lookahead-bar.ready{background:#2c7a57}.lookahead-bar.conditional{background:#b57922}.lookahead-bar.blocked{background:#b4483e}.lookahead-state{font-size:10.5px;text-transform:uppercase;color:#667085}.lookahead-state.ready{color:#067647}.lookahead-state.conditional{color:#b54708}.lookahead-state.blocked{color:#b42318}
.readiness-cell{display:inline-grid;place-items:center;width:23px;height:23px;border-radius:6px;font-size:11px;font-weight:900}.readiness-cell.ready{background:#ecfdf3;color:#067647}.readiness-cell.blocked{background:#fef3f2;color:#b42318}.readiness-cell.unknown{background:#fffaeb;color:#b54708}.readiness-cell.not_applicable{background:#f2f4f7;color:#667085}
.milestone-timeline{display:grid;gap:8px;max-height:680px;overflow-y:auto;padding-right:4px}.milestone-row{display:grid;grid-template-columns:285px minmax(420px,1fr) 92px;gap:10px;align-items:center;padding:5px 6px;border-radius:8px}.milestone-row.priority-critical{background:#fff7f6}.milestone-row.priority-high{background:#fffbf2}.milestone-label{min-width:0}.milestone-label-line{display:flex;align-items:center;gap:7px;min-width:0}.milestone-label b{font-size:11.5px;color:#344054;white-space:nowrap}.milestone-label>span{display:block;font-size:10.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone-label small{display:block;font-size:9.8px;color:#8793a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone-priority-pill{display:inline-flex!important;align-items:center;width:max-content;padding:2px 6px;border-radius:999px;font-size:8.8px!important;font-weight:850;text-transform:uppercase;letter-spacing:.045em;line-height:1.4}.milestone-priority-pill.critical{background:#fef0ef;color:#b42318}.milestone-priority-pill.high{background:#fff4d8;color:#a15c00}.milestone-priority-pill.watch{background:#edf4fb;color:#3d6897}.milestone-priority-pill.normal{background:#f2f4f7;color:#667085}.milestone-track{position:relative;height:22px;background:#f6f8fb;border:1px solid #e5eaf0;border-radius:5px}.milestone-row.priority-critical .milestone-track{border-color:#efb5b0}.milestone-row.priority-high .milestone-track{border-color:#e6cf9c}.milestone-point{position:absolute;top:50%;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;z-index:2}.milestone-point.baseline{background:#68788b}.milestone-point.current{background:#4f7fb4}.milestone-point.actual{background:#2c7a57}.milestone-shift{position:absolute;top:9px;height:3px;background:#9aa7b5}.milestone-shift.late{background:#b4483e}.milestone-dd{position:absolute;top:-4px;bottom:-4px;width:1px;background:#1f2937;opacity:.35}.milestone-row-meta{text-align:right;min-width:0}.milestone-row-meta b{display:block;font-size:11px}.milestone-row-meta small{display:block;font-size:9.5px;color:#7b8795;margin-top:2px}.milestone-basis-note{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid #dce5ef;border-radius:9px;background:#f8fbff;margin-bottom:12px;font-size:11px;color:#667085}.milestone-basis-note b{color:#344054}.milestone-priority-board{display:grid;gap:8px}.milestone-priority-row{display:grid;grid-template-columns:78px minmax(205px,1.25fr) 105px 112px 92px 90px minmax(235px,1.35fr);gap:10px;align-items:center;padding:10px 11px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}.milestone-priority-row.critical{border-left:4px solid #b4483e;background:#fff8f7}.milestone-priority-row.high{border-left:4px solid #b57922;background:#fffaf2}.milestone-priority-row.watch{border-left:4px solid #4f7fb4}.milestone-priority-main{min-width:0}.milestone-priority-main b{display:block;font-size:11.5px;color:#344054}.milestone-priority-main span{display:block;font-size:10.5px;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.milestone-priority-main small{display:block;font-size:9.5px;color:#98a2b3;margin-top:2px}.milestone-priority-metric span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.045em;color:#98a2b3;font-weight:800}.milestone-priority-metric b{display:block;margin-top:2px;font-size:11px;color:#344054}.milestone-priority-action{font-size:10.5px;color:#475467;line-height:1.35}.milestone-flags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.milestone-flag{display:inline-flex;padding:2px 5px;border-radius:999px;background:#eef3f8;color:#596b7f;font-size:8.7px;font-weight:750;text-transform:uppercase;letter-spacing:.025em}.milestone-flag.danger{background:#fef0ef;color:#b42318}.milestone-flag.warning{background:#fff4d8;color:#a15c00}.milestone-criticality{font-weight:800}.milestone-criticality.critical{color:#b42318}.milestone-criticality.near_critical{color:#b54708}.milestone-criticality.positive_float{color:#2f6b57}.milestone-criticality.unknown{color:#667085}.milestone-chart-shell{border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden}.milestone-chart-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;padding:13px 15px 11px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.milestone-chart-head h5{margin:0;font-size:13px;color:#22364d}.milestone-chart-head p{margin:4px 0 0;font-size:11px;color:#6f7f92}.milestone-chart-legend{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;font-size:10px;color:#667085}.milestone-chart-legend span{display:inline-flex;align-items:center;gap:5px}.milestone-chart-legend i{display:inline-block;width:9px;height:9px}.milestone-chart-legend i.baseline{border:2px solid #68788b;border-radius:50%;background:#fff}.milestone-chart-legend i.current{background:#4f7fb4;transform:rotate(45deg);border-radius:2px}.milestone-chart-legend i.actual{background:#2c7a57;border-radius:2px}.milestone-chart-legend i.data{width:2px;height:12px;background:#344054}.milestone-chart-scroll{overflow-x:auto}.milestone-control-svg{display:block;width:100%;min-width:1080px;height:auto;background:#fff}.milestone-control-svg text{font-family:Inter,"Segoe UI",sans-serif}.milestone-control-svg .axis-label{fill:#7b8795;font-size:10px}.milestone-control-svg .axis-title{fill:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.milestone-control-svg .row-id{fill:#344054;font-size:10.5px;font-weight:800}.milestone-control-svg .row-name{fill:#667085;font-size:9.5px}.milestone-control-svg .row-meta{fill:#7b8795;font-size:8.8px}.milestone-control-svg .priority-text{font-size:8.5px;font-weight:850;text-transform:uppercase}.milestone-control-svg .value-main{fill:#344054;font-size:10.5px;font-weight:800}.milestone-control-svg .value-sub{fill:#7b8795;font-size:9px}.milestone-control-svg .late-value{fill:#b42318}.milestone-control-svg .early-value{fill:#067647}.milestone-control-svg .critical-value{fill:#b42318}.milestone-control-svg .near-value{fill:#b54708}.milestone-control-svg .grid-line{stroke:#e7edf3;stroke-width:1}.milestone-control-svg .row-line{stroke:#eef2f6;stroke-width:1}.milestone-control-svg .data-line{stroke:#344054;stroke-width:1.4;stroke-dasharray:5 4;opacity:.75}.milestone-control-svg .movement-late{stroke:#c35d54;stroke-width:3;stroke-linecap:round}.milestone-control-svg .movement-early{stroke:#4a8a6d;stroke-width:3;stroke-linecap:round}.milestone-control-svg .movement-neutral{stroke:#9aa7b5;stroke-width:2.5;stroke-linecap:round}.milestone-control-svg .baseline-point{fill:#fff;stroke:#68788b;stroke-width:2}.milestone-control-svg .current-point{fill:#4f7fb4;stroke:#fff;stroke-width:1.5}.milestone-control-svg .actual-point{fill:#2c7a57;stroke:#fff;stroke-width:1.5}.milestone-control-svg .critical-ring{fill:none;stroke:#b42318;stroke-width:2}.milestone-control-svg .near-ring{fill:none;stroke:#b57922;stroke-width:2}.milestone-chart-foot{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-top:1px solid #edf1f5;background:#fbfdff;font-size:10px;color:#7b8795}
.float-histogram{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:230px;align-items:end}.float-bin{height:100%;display:grid;grid-template-rows:1fr auto auto;gap:4px;text-align:center}.float-bar-wrap{display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #d0d5dd}.float-bar{width:65%;min-height:2px;background:#b57922;border-radius:5px 5px 0 0}.float-bin b{font-size:11px;color:#344054}.float-bin small{font-size:10.5px;color:#7b8795}
.empty-visual{padding:28px;text-align:center;color:#7b8795;background:#f8fafc;border:1px dashed #dce5ef;border-radius:9px}.reconciliation-panel{margin-top:14px;border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden}.reconciliation-panel>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:13px 15px;cursor:pointer;font-size:12px;font-weight:750;color:#344054;background:#fbfdff}.reconciliation-panel>summary::-webkit-details-marker{display:none}.reconciliation-panel>summary b{font-size:10.5px;color:#7b8795}.reconciliation-body{padding:0 0 2px}.reconciliation-body>.challenge-card{border:0!important;border-radius:0!important;margin:0!important;box-shadow:none!important}
.chart-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#faf9f6}.chart-card-head h4{margin:0;font-size:14px}.chart-card-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.chart-body{padding:14px 16px}.svg-chart{width:100%;min-width:0;height:auto;display:block}.chart-scroll{overflow-x:auto;padding-bottom:2px}.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 10px}.chart-canvas{position:relative;min-width:0}.chart-canvas-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 9px;color:#7b8795;font-size:9.5px;font-weight:750}.chart-canvas-focus-button{border:1px solid #cbd8e5;background:#fff;color:#425b74;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer}.chart-canvas-focus-button:hover{background:#f3f7fb;border-color:#9fb7ce}.visual-chart .chart-canvas-focus-button{display:none}.chart-canvas.chart-focus{position:fixed;inset:24px;z-index:1100;background:#fff;border:1px solid #aec4da;border-radius:16px;padding:20px;overflow:auto;box-shadow:0 24px 70px rgba(15,23,42,.28)}.chart-canvas.chart-focus .chart-canvas-toolbar{position:sticky;top:-20px;z-index:3;background:#fff;padding:10px 0;border-bottom:1px solid #e5ecf3}.chart-canvas.chart-focus .chart-scroll{overflow:auto}.chart-canvas.chart-focus .svg-chart{min-width:1200px;min-height:620px}.chart-canvas-open{overflow:hidden}.chart-hit-point{cursor:crosshair;outline:none}.chart-hit-point:focus{stroke:#22364d;stroke-width:1.5;fill:rgba(79,127,180,.08)}.legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#506579}.legend-dot{width:9px;height:9px;border-radius:50%}.domain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px}.domain-card{border:1px solid var(--line);border-radius:11px;background:#fff;padding:14px}.domain-card h5{margin:0 0 10px;font-size:14px}.domain-metric{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #edf1f5;font-size:12px;color:#5a687b}.domain-metric:last-child{border-bottom:0}.domain-metric strong{color:#2e3a46;text-align:right}.position-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.position-card{border:1px solid #dfe7ef;border-radius:10px;background:#fff;padding:13px}.position-card .position-label{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.position-card .position-value{font-size:19px;font-weight:780;margin:5px 0 3px;letter-spacing:-.02em}.position-card .position-sub{font-size:11.5px;color:var(--muted)}.readiness-table td{vertical-align:middle}.state-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.state-pill.ready,.state-pill.included{background:#ecfdf3;color:#067647}.state-pill.blocked,.state-pill.excluded{background:#fef3f2;color:#b42318}.state-pill.conditional,.state-pill.review,.state-pill.unknown{background:#fffaeb;color:#b54708}.state-pill.not_applicable{background:#f2f4f7;color:#667085}.window-strip{display:grid;gap:10px}.window-card{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1fr) minmax(180px,.6fr);gap:13px;border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.window-id{font-size:13px;font-weight:800}.window-dates{font-size:11.5px;color:var(--muted);margin-top:4px}.movement-value{font-size:22px;font-weight:780;letter-spacing:-.03em}.movement-label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:750}.event-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.event-tag{font-size:10.5px;border:1px solid #ded8cf;border-radius:999px;padding:3px 6px;background:#fbfdff;color:#506579}.data-section{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.data-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#fbfdff}.data-section-head h4{margin:0;font-size:14px;letter-spacing:-.01em}.data-section-body{padding:14px 16px}.value-list{display:flex;flex-wrap:wrap;gap:7px}.value-chip{display:inline-flex;padding:6px 9px;border:1px solid #ded8cf;border-radius:8px;background:#fbfdff;font-size:12px;color:#506579}.nested-block{margin-top:12px}.nested-block:first-child{margin-top:0}.nested-title{font-size:12px;font-weight:800;color:#506579;margin:0 0 8px;text-transform:uppercase;letter-spacing:.045em}.cell-details summary{padding:4px 0!important;border:0!important;background:transparent!important}.cell-details pre{max-height:320px}.technical-payload{margin-top:16px}.footer-note{font-size:12px;color:var(--muted);margin-top:22px;padding:0 2px}.muted{color:var(--muted)}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1280px){.planning-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.planning-primary-grid{grid-template-columns:1fr}.management-health-grid{grid-template-columns:1fr 1fr}.app{grid-template-columns:238px minmax(0,1fr)}.grid.three{grid-template-columns:1fr 1fr}.upload-row{grid-template-columns:1fr}.evidence-control-grid{grid-template-columns:1fr}.evidence-status-card{position:static}}
.drawer-header-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}.drawer-close,.drawer-expand{white-space:nowrap;flex-shrink:0}
.auxiliary-drawer.drawer-expanded{inset:8px;width:auto;height:calc(100vh - 16px);height:calc(100dvh - 16px);max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}.drawer-expanded .table-wrap{max-height:calc(100vh - 180px);max-height:calc(100dvh - 180px)}
@media(max-width:620px){.workspace-drawer>summary{flex-wrap:wrap;gap:8px}.drawer-header-actions{gap:8px}.page-expand{margin-left:0}}
@media(max-width:900px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;flex-wrap:wrap;padding:13px 18px}.content{padding:20px 18px 48px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.workspace-header{align-items:center}.grid.two,.grid.three{grid-template-columns:1fr}.module-panel #moduleContent{padding:16px}.module-panel>.module-head{padding:17px}.candidate-grid{grid-template-columns:1fr}.auxiliary-drawer{right:12px;top:12px;width:calc(100vw - 24px);max-height:calc(100vh - 24px)}}
@media(max-width:620px){.workspace-header{display:block}.queue-row{grid-template-columns:1fr}.queue-role-control{grid-template-columns:1fr}.queue-remove{justify-self:start}.quick-upload-bar{display:block}.quick-upload-actions{margin-top:10px}.quick-upload-actions .btn{width:100%}.workspace-actions{justify-content:flex-start;margin-top:10px}.workspace-header .badge{margin-top:10px}.grid.kpi{grid-template-columns:1fr 1fr}.scalar-grid{grid-template-columns:1fr}.wide-upload{grid-template-columns:1fr}.queue-row{grid-template-columns:1fr}.recommendation-card{display:block}.decision-pill{display:inline-flex;margin-top:10px}}

/* CMeng Project Control visual system v4 */
.module-panel{border-radius:18px!important;box-shadow:0 18px 48px rgba(31,47,67,.08)!important;border:1px solid #d9e3ee!important;background:#fff!important}
.module-panel>.module-head{padding:24px 28px 20px!important;background:linear-gradient(135deg,#ffffff 0%,#f7faff 68%,#eef5fc 100%)!important}
.module-workspace-head h3{font-size:28px!important;letter-spacing:-.035em!important}
.module-panel #moduleContent{padding:28px!important;background:linear-gradient(180deg,#f8fbff 0,#f5f8fc 100%)!important}
.role-view-selector{padding:12px 24px!important;background:#fff!important}
.role-lens{border-radius:16px!important;box-shadow:0 8px 24px rgba(34,54,77,.05)!important}
.role-review-layers{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.planning-view{display:grid;gap:18px;width:100%;min-width:0}
.planning-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px!important;margin-bottom:0!important}
.planning-kpi{position:relative;overflow:hidden;min-height:118px!important;padding:17px 17px 15px!important;border:1px solid #d9e4ef!important;border-radius:14px!important;background:linear-gradient(180deg,#fff 0,#fbfdff 100%)!important;box-shadow:0 7px 20px rgba(34,54,77,.045)!important}
.planning-kpi:before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:#91a8c0}
.planning-kpi.accent:before{background:#4f7fb4}.planning-kpi.success:before{background:#2c7a57}.planning-kpi.warning:before{background:#b57922}.planning-kpi.danger:before{background:#b4483e}
.planning-kpi span{font-size:10px!important;letter-spacing:.07em!important;font-weight:850!important;color:#728198!important}
.planning-kpi strong{display:block;font-size:24px!important;line-height:1.08!important;margin-top:8px!important;color:#22364d!important;letter-spacing:-.035em!important}
.planning-kpi small{display:block;margin-top:7px!important;font-size:10.5px!important;color:#7b8795!important;line-height:1.35}
.planning-panel{border:1px solid #d9e4ef!important;border-radius:16px!important;background:#fff!important;box-shadow:0 8px 26px rgba(34,54,77,.05)!important;overflow:hidden}
.planning-panel.primary{border-color:#c7d8e8!important;box-shadow:0 11px 32px rgba(49,95,138,.07)!important}
.planning-panel-head{padding:17px 20px 15px!important;background:linear-gradient(180deg,#fff,#fbfdff)!important;border-bottom:1px solid #e4ebf2!important}
.planning-panel-head h4{font-size:16px!important;letter-spacing:-.018em!important;color:#22364d!important}
.planning-panel-head p{font-size:11.5px!important;line-height:1.45!important;max-width:880px!important}
.planning-panel-body{padding:20px!important}
.planning-primary-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.85fr);gap:18px!important}
.chart-card{border-radius:16px!important;box-shadow:0 8px 26px rgba(34,54,77,.05)!important}
.chart-card-head{padding:17px 20px!important;background:linear-gradient(180deg,#fff,#fbfdff)!important}
.chart-body{padding:20px!important}
.chart-scroll{overflow:auto hidden!important;padding:4px 0 2px}
.svg-chart{width:100%!important;min-width:0!important;max-height:360px!important;background:#fff;border-radius:10px}
.chart-legend{gap:9px!important;margin-bottom:14px!important}
.legend-item{padding:5px 8px;border:1px solid #e1e8ef;border-radius:999px;background:#fbfdff;font-size:10.5px!important;font-weight:700}
.position-grid{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important;gap:12px!important}
.position-card{min-height:105px;border-radius:13px!important;padding:15px!important;box-shadow:0 5px 16px rgba(34,54,77,.035)}
.position-card .position-value{font-size:22px!important}
.table-wrap{border:1px solid #dfe7ef;border-radius:12px;overflow:auto;max-height:640px;background:#fff}
.table-wrap table{border-collapse:separate;border-spacing:0;width:100%}
.table-wrap thead th{position:sticky;top:0;z-index:2;background:#f3f7fb!important;color:#506579!important;font-size:9.5px!important;text-transform:uppercase;letter-spacing:.055em;border-bottom:1px solid #ccd8e4!important}
.table-wrap tbody tr:nth-child(even){background:#fbfdff}
.table-wrap tbody tr:hover{background:#f2f7fc}
.table-wrap td{border-bottom:1px solid #edf2f6!important;vertical-align:top}
.module-bar-row{grid-template-columns:minmax(145px,.9fr) minmax(260px,1.8fr) 110px!important;gap:12px!important}
.module-bar-row>span{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere}.module-bar-row>div{height:17px!important;border-radius:999px!important;background:#eef3f8!important;overflow:hidden}
.module-bar-row i{height:100%!important;border-radius:999px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.signed-track{height:18px!important;border-radius:999px!important;background:#eef3f8!important}
.signed-bar{top:3px!important;height:12px!important;border-radius:999px!important}
.status-band{height:34px!important;border-radius:10px!important;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(15,23,42,.06)}
.status-band-segment{min-width:3px;display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important}
.status-band-segment span,.status-band-segment b{font-size:9.5px!important}
.window-card{border-radius:14px!important;padding:16px!important;box-shadow:0 5px 18px rgba(34,54,77,.035)}
.currency-card{border-radius:14px!important;box-shadow:0 6px 18px rgba(34,54,77,.04)!important;background:linear-gradient(180deg,#fff,#fbfdff)!important}
.currency-code{font-size:13px!important;letter-spacing:.08em!important}
.visual-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.visual-chart-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.visual-chart{border:1px solid #d9e4ef;border-radius:16px;background:#fff;box-shadow:0 8px 26px rgba(34,54,77,.05);overflow:hidden;min-width:0}
.visual-chart-head{display:flex;justify-content:space-between;gap:14px;align-items:start;padding:16px 18px 13px;border-bottom:1px solid #e5ecf3;background:linear-gradient(180deg,#fff,#fbfdff)}
.visual-chart-head h5{margin:0;font-size:14px;color:#22364d;letter-spacing:-.015em}.visual-chart-head p{margin:4px 0 0;font-size:10.5px;color:#718096;line-height:1.4}
.visual-chart-body{padding:18px}
.donut-layout{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;align-items:center}
.donut-ring{width:142px;height:142px;border-radius:50%;position:relative;box-shadow:inset 0 0 0 1px rgba(34,54,77,.06)}
.donut-ring:after{content:"";position:absolute;inset:24px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #edf2f7}
.donut-center{position:absolute;inset:0;z-index:1;display:grid;place-content:center;text-align:center;pointer-events:none}.donut-center b{font-size:23px;color:#22364d;line-height:1}.donut-center span{margin-top:5px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#7b8795;font-weight:800}
.donut-legend{display:grid;gap:8px}.donut-legend-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:11px;color:#5f6f82}.donut-legend-row i{width:9px;height:9px;border-radius:3px}.donut-legend-row b{color:#22364d}
.visual-bars{display:grid;gap:10px}.visual-bar-row{display:grid;grid-template-columns:minmax(125px,.85fr) minmax(200px,1.6fr) 88px;gap:10px;align-items:center}.visual-bar-label{font-size:10.5px;color:#53657a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.visual-bar-track{height:20px;border-radius:999px;background:#eef3f8;overflow:hidden;position:relative}.visual-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#6f96bd,#4f7fb4);min-width:2px}.visual-bar-fill.success{background:linear-gradient(90deg,#5b9b7c,#2c7a57)}.visual-bar-fill.warning{background:linear-gradient(90deg,#d4a653,#b57922)}.visual-bar-fill.danger{background:linear-gradient(90deg,#d4776e,#b4483e)}.visual-bar-value{text-align:right;font-size:10.5px;font-weight:800;color:#344054}
.waterfall{display:grid;gap:8px}.waterfall-row{display:grid;grid-template-columns:minmax(145px,.85fr) minmax(230px,1.7fr) 96px;gap:10px;align-items:center}.waterfall-track{position:relative;height:22px;border-radius:7px;background:#eef3f8}.waterfall-zero{position:absolute;left:50%;top:0;bottom:0;width:1px;background:#98a2b3}.waterfall-bar{position:absolute;top:4px;height:14px;border-radius:5px}.waterfall-bar.positive{background:#b4483e}.waterfall-bar.negative{background:#2c7a57}.waterfall-bar.neutral{background:#91a0b0}
.chart-insight{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:10px 12px;border-radius:9px;background:#f6f9fc;color:#607086;font-size:10.5px;line-height:1.45}.chart-insight b{color:#344054}
.commercial-visual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px}
.commercial-currency-chart{border:1px solid #d9e4ef;border-radius:14px;background:#fff;padding:15px}.commercial-currency-chart h5{margin:0 0 12px;font-size:13px;color:#22364d}
.visual-chart-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}.visual-focus-button{border:1px solid #cbd8e5;background:#fff;color:#425b74;border-radius:7px;padding:6px 9px;font-size:10.5px;font-weight:750;cursor:pointer}.visual-focus-button:hover{background:#f3f7fb;border-color:#9fb7ce}.visual-panel-open{overflow:hidden}.visual-chart.visual-focus{position:fixed;inset:24px;z-index:1000;overflow:auto;box-shadow:0 24px 70px rgba(15,23,42,.28);border-color:#aec4da}.visual-chart.visual-focus .visual-chart-head{position:sticky;top:0;z-index:4}.visual-chart.visual-focus .visual-chart-body{padding:24px}.visual-chart.visual-focus .svg-chart{min-height:500px}.cash-flow-enterprise{display:grid;gap:16px}.cash-flow-position{border-color:#c7d8e8}.cash-flow-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:22px;padding:22px;border-radius:14px;margin-bottom:16px}.cash-flow-hero.established{background:linear-gradient(135deg,#f4faf6,#f8fbff);border:1px solid #cde2d5}.cash-flow-hero.withheld{background:linear-gradient(135deg,#fffaf0,#fbfcfe);border:1px solid #ead7ad}.cash-flow-hero>div>span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:#74859a}.cash-flow-hero>div>strong{display:block;margin-top:7px;font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif;font-size:36px;line-height:1.05;letter-spacing:-.04em;color:#22364d}.cash-flow-hero>div>p{margin:9px 0 0;color:#5f7084;font-size:12.5px;line-height:1.5}.cash-flow-hero-stats{display:grid!important;grid-template-columns:1fr 1fr;gap:10px}.cash-flow-hero-stats>div,.cash-flow-hero-rule{padding:12px;border:1px solid rgba(180,198,215,.65);border-radius:10px;background:rgba(255,255,255,.72)}.cash-flow-hero-stats span{font-size:9.5px!important}.cash-flow-hero-stats b{display:block;margin-top:5px;color:#22364d;font-size:13px}.cash-flow-hero-rule b{color:#8b651d;font-size:12px}.cash-flow-hero-rule p{font-size:11.5px!important}.cash-readiness-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 18px}.cash-readiness-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 10px;align-items:start;padding:13px;border:1px solid #dce5ef;border-radius:11px;background:#fff}.cash-readiness-item.established{border-top:3px solid #2c7a57}.cash-readiness-item.missing{border-top:3px solid #b57922}.cash-readiness-item>div span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;color:#7b8795}.cash-readiness-item>div b{display:block;margin-top:4px;font-size:13px;color:#344054}.cash-readiness-item small{grid-column:1/-1;color:#718096;font-size:10.5px;line-height:1.4}.cash-readiness-basis{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:7px;border-top:1px solid #edf1f5;font-size:10px}.cash-readiness-basis span{color:#8a96a6;text-transform:uppercase;letter-spacing:.045em;font-weight:800}.cash-readiness-basis b{color:#506579}.cash-readiness-item .management-module-link{justify-self:start}.cash-flow-curve-withheld{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:17px 18px;margin:16px 0;border:1px dashed #c9d6e3;border-radius:12px;background:#f8fafc}.cash-flow-curve-withheld span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:#8a96a6}.cash-flow-curve-withheld b{display:block;margin-top:3px;font-size:17px;color:#506579}.cash-flow-curve-withheld p{max-width:700px;margin:0;color:#667085;font-size:11.5px}.cash-flow-primary{display:grid;gap:12px;margin:18px 0}.cash-flow-primary .visual-chart-body{padding:20px}.cash-flow-primary .svg-chart{min-height:390px}.cash-flow-secondary{grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-top:18px}.cash-flow-register-detail,.cash-flow-trace,.cash-flow-evidence-detail{margin-top:16px;border:1px solid #dce5ef;border-radius:11px;background:#fff;overflow:hidden}.cash-flow-register-detail summary,.cash-flow-trace summary,.cash-flow-evidence-detail summary{cursor:pointer;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px}.cash-flow-register-detail summary div,.cash-flow-evidence-detail summary div{display:grid}.cash-flow-register-detail summary b,.cash-flow-trace summary b,.cash-flow-evidence-detail summary b{color:#344054;font-size:12px}.cash-flow-register-detail summary span,.cash-flow-trace summary span,.cash-flow-evidence-detail summary span{font-size:10.5px;color:#7b8795}.cash-flow-register-detail summary small{font-size:10.5px;color:#8a96a6}.cash-flow-register-body,.cash-flow-evidence-body{padding:0 15px 15px}.cash-flow-trace>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:7px;padding:0 15px 15px}.cash-trace-row{padding:8px 10px;border-radius:7px;background:#f7f9fb;color:#667085;font-size:10.5px}.cash-flow-related-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cash-movement-bars{display:grid;gap:9px}.cash-movement-row{display:grid;grid-template-columns:minmax(90px,.65fr) minmax(190px,1.55fr) 105px;gap:10px;align-items:center}.cash-movement-track{position:relative;height:22px;border-radius:7px;background:#eef3f8}.cash-movement-zero{position:absolute;left:50%;top:0;bottom:0;width:1px;background:#98a2b3}.cash-movement-bar{position:absolute;top:4px;height:14px;border-radius:5px}.cash-movement-bar.positive{background:#2c7a57}.cash-movement-bar.negative{background:#b4483e}.cash-movement-bar.neutral{background:#91a0b0}.cash-register-section{margin-top:20px}.section-heading.compact{align-items:center;margin-bottom:10px}.section-heading.compact h5{margin:0;font-size:14px;color:#22364d}.section-heading.compact p{margin:3px 0 0;font-size:11px;color:#718096}
.commercial-management-summary{margin-bottom:18px}.commercial-management-summary .currency-card{min-height:100%;box-shadow:0 8px 22px rgba(15,23,42,.05)}.cost-forecast-primary .visual-chart-body{padding:20px}.cost-forecast-primary .svg-chart{min-height:410px}.cost-control-secondary{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}.cost-control-position{border-color:#c9d8e6}.commercial-overview-enterprise>.commercial-visual-grid{margin-bottom:18px}.payment-lifecycle-grid,.variation-control-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}.change-bridge-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}.value-bridge{display:grid;grid-template-columns:minmax(135px,1fr) 28px minmax(135px,1fr) 28px minmax(135px,1fr);gap:8px;align-items:stretch}.value-bridge-cell{border:1px solid #d9e4ef;border-radius:10px;padding:12px;background:#fff;min-width:0}.value-bridge-cell span{display:block;font-size:10.5px;font-weight:700;color:#718096;margin-bottom:6px}.value-bridge-cell b{display:block;font-size:17px;color:#22364d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.value-bridge-cell small{display:block;margin-top:5px;font-size:9.5px;color:#8895a5}.value-bridge-cell.change{border-color:#b9d6c7;background:#f7fbf8}.value-bridge-cell.current{border-color:#adc7df;background:#f6f9fc}.value-bridge-cell.pending{border-color:#e6cf9f;background:#fffaf0}.value-bridge-op{display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#7b8da1}.value-bridge-pending{grid-column:1/-1;margin-top:4px}.value-bridge-pending .value-bridge-cell{display:grid;grid-template-columns:minmax(170px,1fr) auto;column-gap:16px;align-items:center}.value-bridge-pending .value-bridge-cell small{grid-column:1/-1}.payment-management-position,.variation-management-position{border-color:#b9ccde}.commercial-claims-management,.contract-particulars-management{border-color:#b9ccde}.claims-lifecycle-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin:18px 0}.contract-control-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}.contract-bridge-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}
@media(max-width:1450px){.planning-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.visual-chart-grid.three{grid-template-columns:1fr 1fr}}
@media(max-width:1050px){.planning-primary-grid,.visual-chart-grid,.visual-chart-grid.three,.cash-flow-secondary,.payment-lifecycle-grid,.variation-control-grid,.change-bridge-grid,.claims-lifecycle-grid,.contract-control-grid,.contract-bridge-grid,.management-two-column,.cash-flow-hero,.cash-readiness-grid{grid-template-columns:1fr!important}.donut-layout{grid-template-columns:140px minmax(0,1fr)}.role-review-layers{grid-template-columns:1fr 1fr!important}}
@media(max-width:700px){.planning-kpi-grid{grid-template-columns:1fr 1fr!important}.management-metric-grid{grid-template-columns:1fr!important}.management-metric-value.date{font-size:24px;white-space:normal}.cash-flow-hero>div>strong{font-size:30px}.cash-flow-hero-stats{grid-template-columns:1fr!important}.donut-layout{grid-template-columns:1fr}.donut-ring{margin:auto}.module-panel #moduleContent{padding:18px!important}.role-review-layers{grid-template-columns:1fr!important}.value-bridge{grid-template-columns:1fr}.value-bridge-op{min-height:18px}.value-bridge-pending{grid-column:auto}.value-bridge-pending .value-bridge-cell{grid-template-columns:1fr}}


/* Readable control panels at the actual available width. */
.planning-panel,.planning-panel-body,.visual-chart,.currency-card{min-width:0}
.planning-primary-grid,.visual-chart-grid,.commercial-visual-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))!important}
.module-bar-row,.visual-bar-row,.waterfall-row,.cash-movement-row,.constraint-row,.finish-period-row{grid-template-columns:minmax(0,1fr) minmax(70px,1fr) minmax(60px,auto)!important;gap:10px!important}
.module-bar-label,.visual-bar-label,.module-bar-value,.visual-bar-value,.currency-line strong,.planning-kpi-value,.management-kpi-value{overflow-wrap:anywhere;white-space:normal!important;min-width:0}
.progress-basis-row{grid-template-columns:minmax(0,1fr) minmax(70px,1fr) minmax(60px,auto)!important}
.planning-primary-grid:has(.svg-chart),.visual-chart-grid:has(.svg-chart),.commercial-visual-grid:has(.svg-chart){grid-template-columns:1fr!important}
.module-bar-row>span{white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere}
.svg-chart{min-width:700px}
.milestone-date-name span,.milestone-date-name small{display:block;margin-top:5px}
.chart-svg,.date-trend-svg{min-width:620px}.chart-canvas{overflow-x:auto}
.milestone-view .planning-primary-grid:has(.milestone-priority-board){grid-template-columns:1fr!important}
.milestone-priority-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:14px}
.milestone-priority-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;min-width:0;gap:12px!important;padding:16px!important}
.milestone-priority-row>.milestone-priority-pill,.milestone-priority-main,.milestone-priority-action{grid-column:1/-1}
.milestone-priority-main span,.milestone-priority-action{white-space:normal!important;overflow-wrap:anywhere;font-size:13px!important;line-height:1.6}
.milestone-basis-note{font-size:13px!important;line-height:1.7!important;padding:18px!important}
.milestone-basis-note span{display:block}
.milestone-date-chart{display:grid;gap:0;font-size:13px}
.milestone-date-row{display:grid;grid-template-columns:minmax(220px,1fr) minmax(230px,1.3fr);gap:20px;padding:18px 0;border-bottom:1px solid #e0e7ef;align-items:center}
.milestone-date-name{display:grid;gap:5px;line-height:1.5}.milestone-date-name small{font-size:12px;color:#526579}
.milestone-date-track{position:relative;height:34px;background:repeating-linear-gradient(to right,#e3eaf1 0,#e3eaf1 1px,transparent 1px,transparent 25%);border-bottom:1px solid #d0dae5}
.milestone-date-track .date-baseline,.milestone-date-track .date-current{position:absolute;top:11px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:white;border:2px solid #506579}
.milestone-date-track .date-current{background:#a94438;border-color:#a94438;border-radius:2px;transform:rotate(45deg)}
.milestone-date-track .date-span{position:absolute;top:16px;height:3px;background:#bd7167}
.milestone-date-axis{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:#526579;padding-bottom:8px}
.milestone-date-values{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;line-height:1.6;padding-top:8px}
.milestone-date-legend{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-size:13px}
.milestone-date-legend b{color:#a94438}
.table-wrap{overflow:auto!important} .table-wrap th{white-space:normal;min-width:85px} .table-wrap td{word-break:normal!important;overflow-wrap:normal!important;min-width:85px}
.currency-card:only-child{grid-column:1/-1}
@media(max-width:850px){.milestone-date-row{grid-template-columns:1fr}.module-bar-row,.visual-bar-row,.waterfall-row{grid-template-columns:minmax(0,1fr) minmax(55px,1fr) auto!important}}

.planning-primary-grid:has(.pressure-matrix),.planning-primary-grid:has(.float-histogram){grid-template-columns:minmax(0,1fr)!important}
.planning-kpi strong,.planning-kpi small{overflow-wrap:anywhere;min-width:0}
.contract-challenge-view .planning-primary-grid{grid-template-columns:minmax(0,1fr)!important}

.module-live-dot{background:#8a99a8!important;box-shadow:none!important}
.issue-badge{display:inline-block;border-radius:5px;padding:3px 6px;font-size:10px;font-weight:800;white-space:nowrap;background:#eef1f5;color:#596779}.issue-badge.system_defect{background:#fde8e7;color:#a42822}.issue-badge.source_conflict{background:#f1e8fa;color:#75429b}.issue-badge.data_quality{background:#fff0db;color:#976018}.issue-badge.missing_information{background:#fff8dc;color:#7b671c}.issue-badge.comparison_difference{background:#e6f0fc;color:#2d6099}.issue-badge.governance_review{background:#edeaf6;color:#65538a}.issue-badge.checked{background:#edf7f1;color:#286748}.issue-category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:12px 0}.issue-category{border:1px solid #dce4ee;border-radius:8px;padding:10px;background:white}.issue-category b{display:block;font-size:19px;margin:6px 0}.issue-category small{display:block;color:#5d6c7d;line-height:1.4}.issue-assessment{padding:14px;border:1px solid #dce4ee;border-radius:9px;background:#f7f9fc;margin-bottom:14px}.issue-assessment h4{margin:0 0 6px}.issue-assessment .table-wrap{max-height:400px}.nav-state .issue-badge{font-size:8px;padding:2px 4px}.issue-assessment details summary{cursor:pointer;font-weight:700;padding:9px 0}
${experienceStyles}
${answerFirstStyles}
${projectDiagnosisStyles}
${askAiStyles}
${systemReviewStyles}
${projectActionsStyles}
.planning-missing-kpis{margin:10px 0 16px;border:1px solid #e3e9ef;border-radius:9px;background:#fbfcfe}.planning-missing-kpis>summary{padding:10px 12px;font-size:11.5px;color:#5c6e80}.planning-missing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding:10px 12px}.planning-missing-grid div{padding:8px 9px;border:1px solid #e7ecf1;border-radius:7px;background:#fff}.planning-missing-grid b{display:block;font-size:11px}.planning-missing-grid span{display:block;margin-top:3px;font-size:10.5px;color:#6b7a8a;line-height:1.4}
.planning-kpi.unavailable strong{font-size:16px;font-weight:600;line-height:1.45}.planning-kpi.unavailable{background:#f8fafc}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark" aria-label="CMeng logo">
        <svg class="cmeng-emblem" viewBox="0 0 72 72" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="cmengBlue" x1="12" y1="8" x2="58" y2="62" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#9fc0df"/>
              <stop offset=".48" stop-color="#5f8fbd"/>
              <stop offset="1" stop-color="#3f6f9e"/>
            </linearGradient>
          </defs>
          <path class="c-ring" d="M53 16.5A25 25 0 1 0 53 55.5"/>
          <g transform="translate(36 36)">
            <path class="arrow" d="M0-20 7-10 3-10 3-5-3-5-3-10-7-10Z"/>
            <path class="arrow" d="M20 0 10 7 10 3 5 3 5-3 10-3 10-7Z"/>
            <path class="arrow" d="M0 20 7 10 3 10 3 5-3 5-3 10-7 10Z"/>
            <path class="arrow" d="M-20 0-10 7-10 3-5 3-5-3-10-3-10-7Z"/>
            <circle class="hub" cx="0" cy="0" r="4.5"/>
          </g>
        </svg>
      </div>
      <div class="brand-copy"><h1>CMeng</h1><p>Project Control Intelligence</p></div>
    </div>
    <div class="platform-nav" id="platformNav">
      <button class="platform-item active" data-view="portfolio"><span class="platform-icon">◫</span><span>Portfolio</span></button>
      <button class="platform-item" data-view="projects"><span class="platform-icon">▦</span><span>Projects</span></button>
      <button class="platform-item" data-view="ai"><span class="platform-icon">✦</span><span>Ask CMeng</span></button>
    </div>
    <div class="active-project-card project-side-only" id="activeProjectCard"><span>Active project</span><b id="activeProjectName">No project selected</b><span id="activeProjectMeta">Open a project from Portfolio or Projects</span></div>
    <div class="sidebar-divider project-side-only"></div>
    <div id="nav"></div>
    <div class="sidebar-motto"><span>CLARITY · CONTROL · PROGRESS</span><b>Turning complexity into confidence.</b></div>
  </aside>
  <main class="main">
    <div class="topbar">
      <div class="platform-context"><span>CMeng</span><b id="platformContextTitle">Portfolio</b></div>
      <div class="project-input project-only">
        <label>Project</label>
        <input id="projectId" value="" aria-label="Project ID">
      </div>
      <div class="topbar-context project-only"><span>Current view</span><b id="topbarModule">${titleForModule("pmo-analysis")}</b></div>
      <div class="topbar-spacer"></div>
      <button type="button" class="btn small page-expand" id="focusMode" aria-pressed="false" title="Use the full window width">Expand page</button>
      <span id="releaseStatus" class="release-state">Production</span>
      <span id="globalStatus" style="font-size:12px;color:#667085"></span>
    </div>
    <div class="content">
      <section id="backgroundUploads" aria-label="Project uploads" aria-live="polite" hidden></section>
      <section id="portfolioView" class="platform-view">
        <div class="portfolio-hero">
          <div><span class="section-kicker">Portfolio</span><h2>Portfolio Overview</h2><p>View every project, latest data date, project-document completeness and current control position. Open a project to add or update documents and refresh its position.</p></div>
          <button class="btn primary" id="portfolioNewProject">New project</button>
        </div>
        <div id="portfolioStats" class="portfolio-summary"></div>
        <div class="portfolio-section-head"><div><h3>Projects</h3><span>Current project position and key management signals</span></div></div>
        <div id="portfolioProjects" class="portfolio-project-list"><div class="empty">Loading projects...</div></div>
        <div id="portfolioAttention"></div>
      </section>

      <section id="projectsView" class="platform-view" hidden>
        <div class="portfolio-hero">
          <div><span class="section-kicker">Projects</span><h2>Projects</h2><p>Create a project or open an existing one. Documents, updates and calculations remain separate for each project.</p></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <h3>Create project</h3>
          <div class="project-create"><input id="newProjectId" placeholder="Project ID / code"><button class="btn primary" id="createProject">Create project</button></div>
          <div style="margin-top:10px"><button class="btn small" id="loadDemo">Open sample project</button></div>
          <div id="createProjectMessage"></div>
        </div>
        <div id="projectRegister"></div>
      </section>

      <div id="projectWorkspace" hidden>
      <div class="workspace-header">
        <div class="page-title">
          <span class="eyebrow">Current project</span>
          <h2>Project workspace</h2>
          <p id="workspaceProjectMeta">No project selected</p>
        </div>
        <div class="workspace-actions">
          <button class="btn" id="openProjectActions">Project review</button>
          <button class="btn" id="openLibraryQuick">Documents</button>
          <button class="btn primary" id="openEvidenceTop">Add documents</button>
          <button class="btn" id="runAnalysisTop">Update position</button>
          <button class="btn" id="openAiTop">Ask CMeng</button>
          <a class="btn" href="/external-ai" target="_blank" rel="noopener">External AI Access</a>
          <a class="btn" href="/settings/ask-ai" target="_blank" rel="noopener">AI settings</a>
          <button class="btn small" id="refresh">Refresh</button>
          <span id="projectBadge" class="badge">No project</span>
        </div>
      </div>

      <p id="projectActionNotification" class="analysis-summary" role="status" aria-live="polite"></p>
      <details id="projectReviewDrawer" class="project-review-drawer" hidden><summary>Project review · confirmations and information</summary><div id="projectReviewPanel"></div></details>
      ${askAiHtml}

      <section class="card module-panel module-workspace" id="projectModulePanel">
        <div class="module-head module-workspace-head">
          <div>
            <span class="section-kicker">Current view</span>
            <h3 id="moduleTitle">Project Controls</h3>
            <p id="moduleSubtitle">Current position, key changes and actions requiring attention.</p>
          </div>
          <div class="module-head-actions"><button class="btn small" id="moduleReport">Generate report</button><span id="moduleBadge" class="badge">Select a view</span></div>
        </div>
        <div id="roleViewSelector" class="role-view-selector" aria-label="Review view"></div>
        <div id="moduleContent" class="empty">Choose a project-control view from the left.</div>
      </section>

      <details class="workspace-drawer auxiliary-drawer" id="evidenceControlDrawer">
        <summary>
          <div><span class="section-kicker">Documents</span><strong>Add or update project documents</strong></div>
          <span class="drawer-header-actions"><button type="button" class="btn small drawer-expand" id="expandEvidenceControl" aria-label="Expand add documents" aria-pressed="false" aria-controls="evidenceControlDrawer">Expand</button><button type="button" class="btn small drawer-close" id="closeEvidenceControl" aria-label="Close add documents">Close ×</button></span>
        </summary>
        <div class="drawer-body">
          <div class="grid evidence-control-grid">
            <section class="card evidence-status-card">
              <div class="module-head"><h3>Project information</h3><span class="badge">Current record</span></div>
              <div id="projectStatus" class="empty">Add project documents to establish the current project position.</div>
            </section>

            <section class="card evidence-intake-card">
              <div class="module-head"><h3>Add / update project documents</h3><label class="auto-run-toggle"><input type="checkbox" id="runAfterUpload" checked> Update position after upload</label></div>
              <div class="upload-row">
                <div class="upload-box">
                  <strong>Schedule revisions</strong>
                  <small>Choose the purpose and scope of these programmes. Filenames and dates do not establish approval or replacement authority.</small>
                  <div class="intent-control"><span>Document action</span><select id="scheduleIntent"><option value="add_update" selected>Upload for review</option><option value="replace_current_basis">Adopt uploaded programme</option></select></div>
                  <div class="intent-control"><label for="scheduleScope">Programme coverage</label><select id="scheduleScope"><option value="project">Whole project</option><option value="phase">One phase only</option></select></div>
                  <div class="intent-control"><label for="schedulePhase">Phase ID (for phase programmes)</label><input id="schedulePhase" placeholder="e.g. Phase 2"></div>
                  <div class="intent-control"><label for="scheduleApproval">Baseline approval reference</label><input id="scheduleApproval" placeholder="Approval letter / document reference"></div>
                  <input type="file" id="scheduleFiles" multiple accept=".xer,.xml,.xlsx,.xlsm,.csv">
                  <div id="scheduleQueue" class="queue"></div><div id="phaseProgrammesPanel"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadSchedules">Upload schedule batch</button></div>
                </div>
                <div class="upload-box">
                  <strong>BOQ / quantity revisions</strong>
                  <small>Select one or more BOQ revisions. CMeng inspects the content and retains prior revisions rather than silently overwriting them.</small>
                  <div class="intent-control"><span>Document action</span><select id="boqIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current document</option></select></div>
                  <input type="file" id="boqFiles" multiple accept=".csv,.xlsx,.xlsm,.pdf">
                  <div id="boqQueue" class="queue"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadBoqs">Upload BOQ batch</button></div>
                </div>
                <div class="upload-box">
                  <strong>Contract family</strong>
                  <small>Select the main contract, amendments and appendices. Additive documents remain separate; replacement is an explicit user intent.</small>
                  <div class="intent-control"><span>Document action</span><select id="contractIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current document</option></select></div>
                  <input type="file" id="contractFiles" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
                  <div id="contractQueue" class="queue"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadContracts">Upload contract batch</button></div>
                </div>
              </div>

              <div class="wide-upload">
                <div>
                  <strong>Other project documents / full document pack</strong>
                  <small>Upload ZIP or multiple files covering cost/EVM, payment, variations, claims, risk, procurement, RFI, submittals, design, HSE, NCR, FM/assets, ORAT and other control evidence.</small>
                  <div class="intent-control"><span>Document action</span><select id="evidenceIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current document where applicable</option></select></div>
                  <input type="file" id="evidenceFiles" multiple accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
                  <div id="evidenceQueue" class="queue"></div>
                </div>
                <button class="btn primary" id="uploadEvidence">Add / update documents</button>
              </div>
              <div id="uploadMessage"></div>
            </section>
          </div>
        </div>
      </details>

      <details class="workspace-drawer director-section" id="directorDrawer">
        <summary>
          <div><span class="section-kicker">Management position</span><strong>More management detail</strong></div>
          <span class="drawer-hint">Open</span>
        </summary>
        <div class="drawer-body" style="padding-top:18px">
          <section id="director"></section>
        </div>
      </details>

      <details class="workspace-drawer auxiliary-drawer" id="evidenceLibraryDrawer">
        <summary>
          <div><span class="section-kicker">Documents</span><strong>Documents and activity links</strong></div>
          <span class="drawer-header-actions"><span id="evidenceBadge" class="badge">Documents not loaded</span><button type="button" class="btn small drawer-expand" id="expandEvidenceLibrary" aria-label="Expand documents" aria-pressed="false" aria-controls="evidenceLibraryDrawer">Expand</button><button type="button" class="btn small drawer-close" id="closeEvidenceLibrary" aria-label="Close documents">Close ×</button></span>
        </summary>
        <div class="drawer-body">
          <div id="evidenceLibrary" class="empty">No project documents have been added.</div>
        </div>
      </details>

      <div class="footer-note">Project documents, decisions and revisions remain in the audit history.</div>
      </div>
    </div>
  </main>
</div>
<script>
${aggregateCount.toString()}
${experienceScript}
${answerFirstScript}
${projectDiagnosisScript}
${systemReviewScript}
${projectActionsScript}
${basisReviewScript}
const moduleRegistry=${JSON.stringify(moduleRegistry).replace(/</g, '\u003c')};
const groups=moduleRegistry.reduce((groups,m)=>{(groups[m.group]??=[]).push(m.key);return groups},{});
const apiKeys=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.apiKey]));
const names=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.title]));
const descriptions=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.description]));
const advancedSubviewMap={
  "activity-analytics":[["scope-classification","Scope & Classification"]],
  "progress-breakdown":[["scope-classification","Scope & Classification"]],
  "independent-forecast":[["monte-carlo-risk","Monte Carlo Risk"]],
  "cost-forecast":[["cost-control","Cost Control"],["evm-performance","EVM Curves & Performance"],["earned-schedule","Earned Schedule"],["evm-by-wbs","EVM by WBS"],["cost-scurve","Cost S-Curve"],["cost-register","Cost Register"],["cbs-breakdown","CBS Breakdown"]],
  "payments":[["payment-register","Payment Register (IPC)"],["retention-calendar","Retention Calendar"]],
  "cash-flow":[["cash-flow-register","Cash Flow Register"],["cost-scurve","Cost S-Curve"]],
  "variations-change":[["site-instructions","Site Instructions"]],
  "contract-particulars-bonds":[["commercial-terms","Commercial Terms"],["contract-obligations","Contract Obligations"],["liquidated-damages","Liquidated Damages"],["bonds-insurance","Bonds & Insurance"],["contract-risk","Contract Risk"],["final-account","Final Account / Closeout"]],
  "commercial-overview":[["cost-control","Cost Control"],["payment-register","Payment Register"],["tender-readiness","Tender Readiness"],["contract-risk","Contract Risk"],["final-account","Final Account / Closeout"]]
};
const advancedSubviewTitles=Object.fromEntries(Object.values(advancedSubviewMap).flat().map(([key,label])=>[key,label]));
const roleViews={
  overall:{
    label:"Overall Detailed",
    short:"Overall",
    eyebrow:"Detailed evidence review",
    question:"What is the project position, with its supporting calculations and documents?"
  },
  planning:{
    label:"Planning Engineer",
    short:"Planning",
    eyebrow:"Technical planning review",
    question:"What exactly is happening in the programme, why is it happening, and are the dates, logic, float and revisions technically defensible?"
  },
  controls:{
    label:"Project Controls Manager",
    short:"Project Controls",
    eyebrow:"Integrated controls review",
    question:"Where is control being lost, which variances are material, and what must be reconciled, forecast or escalated?"
  },
  "project-director":{
    label:"Project Director",
    short:"Project Director",
    eyebrow:"Delivery leadership review",
    question:"What threatens delivery, who owns the recovery, and what decision or intervention is required now?"
  },
  "program-director":{
    label:"Program Director",
    short:"Program Director",
    eyebrow:"Programme integration review",
    question:"How can this position affect strategic milestones, interfaces, downstream packages and the wider programme commitment?"
  },
  executive:{
    label:"Executive / CEO",
    short:"Executive",
    eyebrow:"Executive commitment review",
    question:"Are the strategic commitments protected, what is the business exposure, and where is executive intervention required?"
  }
};
const roleViewOrder=["overall","planning","controls","project-director","program-director","executive"];
const storedRoleView=localStorage.getItem("cmeng-role-view");
let selectedRoleView=roleViewOrder.includes(storedRoleView)?storedRoleView:"overall";
let overview=null,selected="master-dashboard",portfolioData=null,appView="portfolio",currentModuleResult=null;
let projectRequestSeq=0,evidenceRequestSeq=0,aiRequestSeq=0,projectLoadState="idle";
let scheduleSelection=[],boqSelection=[],contractSelection=[],evidenceSelection=[];
const projectUploadJobs=new Map();
let selectedEvidenceDocuments=new Set();
const el=id=>document.getElementById(id);
const project=()=>el("projectId").value.trim();
const fmt=v=>v===null||v===undefined?"Unresolved":typeof v==="number"?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(v.toFixed(6))):humanizeIsoText(String(v));
const fmtExecutive=v=>{
  if(v===null||v===undefined)return"Unresolved";
  if(typeof v!=="number"||!Number.isFinite(v))return String(v);
  const a=Math.abs(v);
  if(a>=1000000000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v/1000000000)+"B";
  if(a>=1000000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v/1000000)+"M";
  if(a>=1000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(v/1000)+"k";
  if(a>=100)return new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(v);
  if(a>=10)return new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(v);
  return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(Number(v.toFixed(6)));
};
const statusClass=s=>s==="ready"?"ready":s==="partial"?"partial":"blocked";
const statusLabel=s=>s==="ready"?"Listed checks passed":s==="partial"?"Review required":"Calculation blocked";
function renderRoleViewSelector(){
  const host=el("roleViewSelector");
  if(!host)return;
  host.innerHTML='<span class="role-view-selector-label">View</span>'+roleViewOrder.map(key=>'<button class="role-view-button '+(selectedRoleView===key?"active":"")+'" data-role-view="'+key+'" title="'+escapeHtml(roleViews[key].label)+'" aria-pressed="'+String(selectedRoleView===key)+'">'+escapeHtml(roleViews[key].short)+'</button>').join("");
  host.querySelectorAll("[data-role-view]").forEach(button=>{
    button.onclick=()=>{
      const next=button.dataset.roleView;
      if(!roleViewOrder.includes(next)||next===selectedRoleView)return;
      selectedRoleView=next;
      localStorage.setItem("cmeng-role-view",selectedRoleView);
      renderRoleViewSelector();
      if(currentModuleResult)renderModuleResult(currentModuleResult);
    };
  });
}
function reconciliationSummary(challenge){
  const labels={within_tolerance:"Reconciled within tolerance",material_difference:"Difference requires review",independent_unavailable:"Independent comparison not confirmed",submitted_missing:"Comparison figure not provided",conflicting_evidence:"Conflicting evidence",incomparable:"Comparison bases differ",scenario:"Scenario comparison",comparison_pending:"Comparison pending"};
  return labels[challenge?.reconciliationState]||"Comparison pending";
}
function consistencyLabel(data){
  const c=data?.systemEvidenceContract;
  return c?.state==="verified_for_checked_metrics"?"Displayed metric checks passed":c?.state==="failed"?"Calculation consistency requires review":"Consistency checks pending";
}
function displayPercentDifference(a,b){
  return typeof a==="number"&&typeof b==="number"?Number((Number(a.toFixed(2))-Number(b.toFixed(2))).toFixed(2)):null;
}
function distributionSummary(d,unit="days",title="Value distribution"){
  if(!d)return "";
  return '<div class="domain-card"><h5>'+escapeHtml(title)+'</h5>'+metricLine("Median",d.median===null?"Unresolved":fmt(d.median)+" "+unit)+metricLine("90th percentile",d.p90===null?"Unresolved":fmt(d.p90)+" "+unit)+metricLine("Maximum",d.maximum===null?"Unresolved":fmt(d.maximum)+" "+unit)+metricLine("Rows at maximum",fmt(d.maximumCount)+(d.maximumPercent===null?"":" · "+fmt(d.maximumPercent)+"% of known values"))+metricLine("Most repeated value",d.dominantValue===null?"Unresolved":fmt(d.dominantValue)+" "+unit)+metricLine("Rows at that value",fmt(d.dominantCount)+(d.dominantPercent===null?"":" · "+fmt(d.dominantPercent)+"% of known values"))+'<p class="muted">Repeated values identify concentration. They do not establish a shared cause or separate entitlement.</p></div>';
}
function renderRoleContent(key,data,primaryView,challengeHtml="",includeTechnical=false){
  return experienceRoleContent(key,data,primaryView,challengeHtml,includeTechnical);
}

function setBusy(text){el("globalStatus").innerHTML=text?'<span class="spinner"></span> '+text:"";}
async function api(path,opts={}){
  const controller=(!opts.method||opts.method==="GET")&&typeof AbortController!=="undefined"?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),60000):null;
  try{const r=await fetch(path,{...opts,...(controller?{signal:controller.signal}:{})});let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data?.message||data?.reason||data?.error||("HTTP "+r.status));e.data=data;e.status=r.status;throw e}if(data===null)throw new Error("The service returned an incomplete response. Please try again.");if(opts.method&&!["GET","HEAD"].includes(opts.method)&&path.startsWith("/api/projects/"+encodeURIComponent(project())+"/")&&!path.includes("/intelligence/")&&typeof loadProjectActions==="function"){setTimeout(()=>{if(overview)void loadProjectActions();},0);}return data;}
  catch(error){if(controller?.signal.aborted)throw new Error("The connection took too long. Your documents remain saved. Try opening the project again.");throw error;}
  finally{if(timeout!==null)clearTimeout(timeout);}
}
function escapeHtml(s){if(s===null||s===undefined)return"";return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fileType(file){const n=file.name.toLowerCase();if(n.endsWith(".zip"))return"application/zip";if(n.endsWith(".xer"))return"text/plain";if(n.endsWith(".xml"))return"application/xml";if(n.endsWith(".csv"))return"text/csv";if(n.endsWith(".pdf"))return"application/pdf";if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(n.endsWith(".png"))return"image/png";if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return"image/jpeg";if(n.endsWith(".tif")||n.endsWith(".tiff"))return"image/tiff";if(n.endsWith(".bmp"))return"image/bmp";if(n.endsWith(".webp"))return"image/webp";if(n.endsWith(".xlsm"))return"application/vnd.ms-excel.sheet.macroEnabled.12";return file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
function inferScheduleRole(name){const n=name.toLowerCase();if(/(?:^|[_ .-])(draft|scenario|proposed)(?:[_ .-]|$)/.test(n))return"scenario";if(n.includes("revised")&&n.includes("baseline"))return"revised_baseline";if(n.includes("recovery"))return"recovery";if(n.includes("baseline")||n.includes("rev0")||n.startsWith("s01_"))return"baseline";return"update"}
function inferContractRole(name){const n=name.toLowerCase();if(n.includes("replacement")||n.includes("restated")||n.includes("replaced"))return"replacement";if(n.includes("amendment"))return"amendment";if(n.includes("appendix")||n.includes("technical"))return"appendix";if(n.includes("tender")||n.includes("employer_require"))return"tender";if(n.includes("main")||n.startsWith("c01_"))return"main";return"other"}
function fileDisplayName(file){return file.webkitRelativePath||file.name}
function humanBytes(value){
  const bytes=Number(value||0);
  if(!Number.isFinite(bytes)||bytes<=0)return "0 B";
  const units=["B","KB","MB","GB"];
  let n=bytes,index=0;
  while(n>=1024&&index<units.length-1){n/=1024;index+=1}
  return (index===0?Math.round(n):n.toFixed(n>=100?0:n>=10?1:2))+" "+units[index];
}
function formatDocumentTime(value){
  if(!value)return "—";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  return new Intl.DateTimeFormat(undefined,{
    year:"numeric",month:"short",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit"
  }).format(date);
}
function uploadId(){
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : "upload-"+Date.now()+"-"+Math.random().toString(16).slice(2);
}
function uploadPhaseLabel(state){
  return state==="receiving"?"Uploading package":
    state==="reading_package"?"Opening package":
    state==="identifying"?"Identifying documents":
    state==="processing"?"Processing documents":
    state==="updating_project"?"Updating project position":
    state==="complete"?"Package loaded":
    state==="failed"?"Upload failed":"Loading project documents";
}
function renderEvidenceUploadProgress(progress,fileIndex=0,fileTotal=1,transferDetail=""){
  const perFile=Math.max(0,Math.min(100,Number(progress?.percent||0)));
  const overall=Math.max(0,Math.min(100,Math.round(((fileIndex+(perFile/100))/Math.max(1,fileTotal))*100)));
  const phase=uploadPhaseLabel(progress?.state);
  const docDetail=progress?.documentTotal!==null&&progress?.documentTotal!==undefined
    ? (progress.state==="identifying"
        ? (progress.identifiedDocuments||0)+" / "+progress.documentTotal+" identified"
        : progress.state==="processing"
          ? (progress.processedDocuments||0)+" / "+progress.documentTotal+" processed"
          : progress.documentTotal+" documents")
    : "";
  const fileDetail=fileTotal>1?"File "+(fileIndex+1)+" of "+fileTotal:"";
  const meta=[fileDetail,docDetail,transferDetail].filter(Boolean).join(" · ");
  const current=progress?.currentDocument?'<div class="upload-progress-current">Current: '+escapeHtml(progress.currentDocument)+'</div>':"";
  el("uploadMessage").innerHTML=
    '<div class="upload-progress-card">'+
      '<div class="upload-progress-head"><strong>'+escapeHtml(phase)+'</strong><b>'+overall+'%</b></div>'+
      '<div class="upload-progress-track"><div class="upload-progress-fill" style="width:'+overall+'%"></div></div>'+
      '<div class="upload-progress-meta"><span>'+escapeHtml(progress?.message||phase)+'</span><span>'+escapeHtml(meta)+'</span></div>'+
      current+
    '</div>';
}
function renderPlatformNav(){
  document.querySelectorAll(".platform-item").forEach(button=>{
    button.classList.toggle("active",button.dataset.view===appView);
    button.onclick=()=>setAppView(button.dataset.view);
  });
}
function renderNav(){
  const nav=el("nav");
  if(!["project","ai"].includes(appView)||!overview){nav.innerHTML="";return}
  const states=new Map([...(overview?.moduleStates||[]),...(overview?.managementStates||[])].map(x=>[x.key,x]));
  const overall=states.get('master-dashboard')?.issueAssessment?.counts||{};
  const sourceTotal=(overall.source_conflict||0)+(overall.data_quality||0)+(overall.missing_information||0);
  let html='<button class="nav-item '+(appView==="ai"?'active':'')+'" id="projectAskNav" aria-current="'+(appView==="ai"?'page':'false')+'" title="Ask about '+escapeHtml(project())+'"><span class="nav-label">✦ Ask CMeng</span></button><button class="nav-item" id="projectActionsNav"><span>Project review</span><b id="projectActionNavCount">'+(typeof projectActionState!=='undefined'&&projectActionState?.projectId===project()&&projectActionState.status==='ready'?fmt(projectActionState.data.actionCount):'…')+'</b></button><div class="nav-group">';
  Object.entries(groups).forEach(([group,keys])=>{
    html+='<div class="nav-group-title" style="padding-top:10px">'+group+'</div>';
    keys.filter(key=>key!=='source-quality').forEach(key=>{
      const state=states.get(key)||{};
      const issues=state.issueAssessment?.counts||{};
      const errors=issues.system_defect||0,source=(issues.source_conflict||0)+(issues.data_quality||0)+(issues.missing_information||0),review=(issues.comparison_difference||0)+(issues.governance_review||0),pending=issues.verification_pending||0;
      const title=names[key]+' · Information items: '+source+' · System failures: '+errors+' · Reviews: '+review+' · Pending checks: '+pending;
      // Keep the full counts on Information & Actions. Repeating the same
      // propagated requests on every destination makes navigation look broken.
      const count='<span class="nav-counts">'+(errors?'<span class="nav-count error" aria-label="'+errors+' system failures">Error '+errors+'</span>':'')+'</span>';
      html+='<button class="nav-item '+(appView==="project"&&selected===key?"active":"")+'" data-key="'+key+'" title="'+escapeHtml(title)+'" aria-current="'+(appView==="project"&&selected===key?'page':'false')+'"><span class="nav-label">'+names[key]+'</span>'+count+'</button>';
    });
  });
  html+='</div>';
  nav.innerHTML=html;
  el("projectAskNav").onclick=()=>setAppView("ai");
  el("projectActionsNav").onclick=()=>openProjectActions();
  nav.querySelectorAll(".nav-item[data-key]").forEach(b=>b.onclick=()=>{selected=b.dataset.key;localStorage.setItem("cmeng-module",selected);setAppView("project");loadModule(selected)});
}
function scalarPairs(obj){if(!obj||typeof obj!=="object")return[];return Object.entries(obj).filter(([k,v])=>["string","number","boolean"].includes(typeof v)||v===null).slice(0,12)}
function humanizeIsoText(value){
  if(value===null||value===undefined)return"";
  return String(value).replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g,match=>planningShortDate(match));
}
function renderUniversalChallenge(challenge){
  if(!challenge||!Array.isArray(challenge.items))return"";
  const show=v=>v===null||v===undefined?"Unresolved":typeof v==="string"?humanizeIsoText(v):fmt(v);
  const withUnit=(v,u)=>show(v)+(u?" "+u:"");
  const conflictPanel=(item)=>{
    const sub=item.submitted||{};
    const comparisons=Array.isArray(item.candidateComparisons)?item.candidateComparisons:[];
    const rec=item.conflictRecommendation||{};
    if(sub.state!=="conflicted"&&comparisons.length<2)return"";
    const assessed=Array.isArray(rec.candidates)?rec.candidates:[];
    const candidateCards=comparisons.map((candidate,index)=>{
      const score=assessed.find(x=>String(x.value)===String(candidate.submittedValue)&&String(x.unit||"")===String(candidate.submittedUnit||""))||assessed[index]||{};
      const sources=(candidate.sourceRefs||score.sourceRefs||[]).join(", ")||"Programme records retained";
      const gap=candidate.comparable===false?"Not directly comparable":withUnit(candidate.gapValue,candidate.gapUnit);
      const evidenceScore=score.evidenceScore===undefined?"—":fmt(score.evidenceScore);
      const recommendationScore=score.recommendationScore===undefined?"—":fmt(score.recommendationScore);
      return '<div class="candidate-card '+(score.recommended?"recommended":"")+'">'+
        '<span class="section-kicker">Position '+escapeHtml(index+1)+(score.recommended?" · recommended":"")+'</span>'+
        '<div class="candidate-value">'+escapeHtml(withUnit(candidate.submittedValue,candidate.submittedUnit))+'</div>'+
        '<div class="candidate-meta">'+
          '<div><b>Independent gap</b>'+escapeHtml(gap)+'</div>'+
          '<div><b>Comparable</b>'+escapeHtml(candidate.comparable===false?"No":"Yes")+'</div>'+
          '<div><b>Source strength</b>'+escapeHtml(evidenceScore)+'</div>'+
          '<div><b>CMeng confidence</b>'+escapeHtml(recommendationScore)+'</div>'+
        '</div>'+
        '<div class="candidate-sources"><b>Sources:</b> '+escapeHtml(sources)+(candidate.note?'<br>'+escapeHtml(candidate.note):'')+'</div>'+
      '</div>';
    }).join("");
    const hasRecommendation=rec.recommendedValue!==null&&rec.recommendedValue!==undefined;
    const recommendation=hasRecommendation?withUnit(rec.recommendedValue,rec.recommendedUnit):"No unique candidate";
    const rationale=Array.isArray(rec.rationale)?rec.rationale.join(" "):(rec.rationale||"All defensible positions remain visible until management selects the adopted project position.");
    return '<div class="conflict-panel">'+
      '<div class="conflict-title"><div><strong>Conflicting project information · all defensible positions retained</strong><p>CMeng calculates each defensible position separately and keeps the supporting records visible until management selects the adopted position.</p></div><span class="badge partial">Conflict</span></div>'+
      '<div class="candidate-grid">'+candidateCards+'</div>'+
      '<div class="recommendation-card"><div><span class="recommendation-label">CMeng recommendation</span><strong>'+escapeHtml(recommendation)+'</strong><p>'+escapeHtml(rationale)+'</p></div><span class="decision-pill">Management decision required</span></div>'+
    '</div>';
  };
  const rows=challenge.items.map(item=>{
    const sub=item.submitted||{},ind=item.independent||{},gap=item.gap||{};
    const comparisons=Array.isArray(item.candidateComparisons)?item.candidateComparisons:[];
    const conflicted=sub.state==="conflicted"||comparisons.length>1;
    const submittedText=sub.state==="not_submitted"?"Not provided":conflicted?"Contradictory · "+Math.max(comparisons.length,sub.alternatives?.length||0)+" candidates":withUnit(sub.value,sub.unit);
    const gapText=conflicted?"Parallel calculations below":withUnit(gap.value,gap.unit);
    const main='<tr>'+
      '<td><b>'+escapeHtml(item.label||item.metric)+'</b><br><span class="muted">'+escapeHtml(item.evidenceState?humanizeKey(item.evidenceState):"")+'</span></td>'+
      '<td>'+escapeHtml(submittedText)+(sub.note?'<br><span class="muted">'+escapeHtml(sub.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(withUnit(ind.value,ind.unit))+'<br><span class="muted">'+escapeHtml(ind.state?humanizeKey(ind.state):"")+(ind.note?" · "+escapeHtml(ind.note):"")+'</span></td>'+
      '<td>'+escapeHtml(gapText)+(!conflicted&&gap.note?'<br><span class="muted">'+escapeHtml(gap.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(item.consequence||"—")+'</td>'+
      '<td>'+escapeHtml(item.action||"—")+'</td>'+
    '</tr>';
    const detail=conflictPanel(item);
    return main+(detail?'<tr class="conflict-expand-row"><td colspan="6">'+detail+'</td></tr>':'');
  }).join("");
  const missingItems=(challenge.items||[]).filter(item=>item.submitted?.state==="not_submitted");
  const conflictedItems=(challenge.items||[]).filter(item=>item.submitted?.state==="conflicted");
  const varianceItems=(challenge.items||[]).filter(item=>{
    const gap=item.gap?.value;
    return item.submitted?.state!=="not_submitted"&&item.submitted?.state!=="conflicted"&&((typeof gap==="number"&&Math.abs(gap)>0)||(typeof gap==="string"&&gap!=="0"));
  });
  const attentionItems=[
    ...missingItems.map(item=>({kind:"Submitted value missing",item})),
    ...conflictedItems.map(item=>({kind:"Conflicting submitted values",item})),
    ...varianceItems.map(item=>({kind:"Variance to CMeng check",item}))
  ];
  const attentionHtml=attentionItems.length
    ?'<div class="challenge-attention"><div class="challenge-attention-head"><strong>What needs attention</strong><span>These are the specific metrics behind the count above. "Missing" means a comparable submitted value was not found; it does not mean the whole document is missing.</span></div>'+attentionItems.map(entry=>{
      const item=entry.item||{};
      const independent=item.independent||{};
      const independentText=independent.value===null||independent.value===undefined?"Not derivable":withUnit(independent.value,independent.unit);
      return '<div class="challenge-attention-row"><b>'+escapeHtml(item.label||item.metric)+'</b><span>'+escapeHtml(entry.kind)+'</span><span>CMeng check: '+escapeHtml(independentText)+(item.action?'<br>Action: '+escapeHtml(item.action):'')+'</span></div>';
    }).join("")+'</div>'
    :"";
  const reviewStateLabels={derived:"Calculated",calculated:"Calculated",partial:"Partial",complete:"Complete",established:"Confirmed",missing:"Missing",not_submitted:"Not provided"};
  const submittedState=reviewStateLabels[challenge.submittedEvidenceState]||humanizeKey(challenge.submittedEvidenceState);
  const independentState=reviewStateLabels[challenge.independentState]||humanizeKey(challenge.independentState);
  return '<div class="card challenge-card" style="margin-bottom:14px"><div class="module-head challenge-head"><h3>Submitted position vs CMeng review</h3><span class="badge '+(challenge.challengedCount?"partial":"ready")+'">'+escapeHtml(reconciliationSummary(challenge))+'</span></div>'+
    '<div class="scalar-grid challenge-summary">'+
      '<div class="scalar"><b>Submitted position</b><span>'+escapeHtml(submittedState)+'</span></div>'+
      '<div class="scalar"><b>CMeng review</b><span>'+escapeHtml(independentState)+'</span></div>'+
      '<div class="scalar"><b>Missing submitted values</b><span>'+escapeHtml(challenge.notSubmittedCount)+'</span></div>'+'<div class="scalar"><b>Unavailable independent checks</b><span>'+escapeHtml(challenge.unavailableCheckCount??0)+'</span></div>'+
      '<div class="scalar"><b>Other scenarios</b><span>'+escapeHtml(challenge.scenarioCount)+'</span></div>'+
    '</div>'+attentionHtml+
    '<div class="table-wrap challenge-table-wrap"><table><thead><tr><th>Metric</th><th>Submitted</th><th>CMeng independent check</th><th>Gap</th><th>Consequence</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function renderContractSourceContext(contract){
  const contractCategoryCounts=contract?(contract.signals||[]).reduce((map,signal)=>{const label=humanizeKey(signal.category||"other");map.set(label,(map.get(label)||0)+1);return map},new Map()):new Map();
  const contractCategoryItems=[...contractCategoryCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value,tone:"accent"}));
  const contractCategoryBars=renderVisualBars(contractCategoryItems);
  const contractSources=contract?.sourceDocuments?.length?'<div class="table-wrap"><table><thead><tr><th>Source document</th><th>Role / authority</th><th>Clauses</th><th>Topic occurrences</th><th>Notice-pattern matches</th><th>Initial-claim period read</th></tr></thead><tbody>'+contract.sourceDocuments.map(x=>'<tr><td>'+escapeHtml(x.sourceFilename)+'</td><td>'+escapeHtml(humanizeKey(x.role))+' / '+escapeHtml(humanizeKey(x.basisState))+'</td><td>'+escapeHtml(fmt(x.clauseCount))+'</td><td>'+escapeHtml(fmt(x.signalCount))+'</td><td>'+escapeHtml(fmt(x.noticeCandidateCount))+'</td><td>'+escapeHtml((x.initialClaimPeriods||[]).map(n=>fmt(n)+' days').join('; ')||'Not read')+'</td></tr>').join('')+'</tbody></table></div>':'';
  const signalGroups=new Map();
  for(const signal of contract?.signals||[]){const key=[signal.documentId,signal.category,signal.textSnippet].join('|');const group=signalGroups.get(key)||{...signal,occurrences:0};group.occurrences++;signalGroups.set(key,group);}
  const contractTrace=signalGroups.size?'<details><summary>Inspect '+escapeHtml(fmt(signalGroups.size))+' distinct source passages / topics</summary><p>Repeated topic occurrences are grouped within each document. These counts are source analysis, not a count of defects, separate obligations or approved entitlements.</p><div class="table-wrap"><table><thead><tr><th>Source / authority</th><th>Topic</th><th>Source passage</th><th>Occurrences</th></tr></thead><tbody>'+[...signalGroups.values()].map(x=>'<tr><td>'+escapeHtml(x.sourceFilename||'Contract source')+'<br>'+escapeHtml(humanizeKey(x.basisState||'source'))+'</td><td>'+escapeHtml(humanizeKey(x.category))+'</td><td>'+escapeHtml(x.textSnippet)+'</td><td>'+escapeHtml(fmt(x.occurrences))+'</td></tr>').join('')+'</tbody></table></div></details>':'';
  const contractSummary=contract?'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Contract review</h4><p>Parsed clauses and detected signals retain source evidence. Zero detected signals does not establish complete notice or obligation coverage.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Contract wording groups",contract.uniqueWordingSignalCount??null,"identical text grouped within each document"],["Source topic occurrences",contract.signalCount??contract.signals?.length??0,"retained trace; not separate defects"],
    ["Notice-pattern matches",contract.noticeRequirementCandidates?.length??0,"pattern hits; several may occur in one clause"],
    ["Categories",(contract.categoriesPresent||[]).length,"identified"]
  ])+(contract.countingBasis?'<p>'+escapeHtml(contract.countingBasis)+'</p>':'')+contractSources+contractTrace+(contractCategoryCounts.size?'<div class="nested-title" style="margin-top:14px">Signals by contract topic</div>'+contractCategoryBars:'')+'</div></section>':'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Contract review</h4></div></div><div class="planning-panel-body"><div class="notice warn">Contract context is unresolved: provide readable contract terms for milestone and obligation references. Delivery review can use the available schedule and resource evidence.</div></div></section>';
  return contractSummary;
}
function renderSuppliedBoqRows(boq,page=0,query=''){
  const term=String(query).trim().toLowerCase();
  const rows=(boq?.rows||[]).filter(r=>!term||[r.itemNumber,r.itemId,r.section,r.description,r.unit].some(v=>String(v??'').toLowerCase().includes(term)));
  const pageCount=Math.max(1,Math.ceil(rows.length/100)),index=Math.max(0,Math.min(pageCount-1,page)),start=index*100;
  const field=v=>v===null||v===undefined||v===''?'Unresolved: not read from BOQ':typeof v==='number'?fmt(v):String(v);
  const body=rows.slice(start,start+100).map(r=>'<tr>'+[r.itemNumber||r.itemId,r.description,r.unit,r.quantity,r.rate,r.amount,r.currency].map(v=>'<td>'+escapeHtml(field(v))+'</td>').join('')+'</tr>').join('');
  return '<p>'+escapeHtml(rows.length?'Items '+fmt(start+1)+'–'+fmt(Math.min(start+100,rows.length))+' of '+fmt(rows.length)+(term?' matching items':''):'No matching BOQ items')+' · Page '+(index+1)+' of '+pageCount+'. Every item is available through these pages and in the Excel and data downloads.</p>'+
    '<div class="actions"><button type="button" '+(index===0?'disabled ':'')+'onclick="updateSuppliedBoq('+(index-1)+')">Previous BOQ items</button><button type="button" '+(index+1===pageCount?'disabled ':'')+'onclick="updateSuppliedBoq('+(index+1)+')">Next BOQ items</button></div>'+
    '<div class="table-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th>BOQ item</th><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate</th><th>Amount</th><th>Currency</th></tr></thead><tbody>'+(body||'<tr><td colspan="7">No matching BOQ items.</td></tr>')+'</tbody></table></div>';
}
function updateSuppliedBoq(page,query){
  const target=el('suppliedBoqRows');if(target)target.innerHTML=renderSuppliedBoqRows(currentModuleResult?.data?.suppliedBoq,page,query??el('suppliedBoqSearch')?.value??'');
}
function renderSuppliedBoq(boq){
  if(!boq?.rows?.length)return '';
  return '<section class="planning-panel supplied-boq-panel"><div class="planning-panel-head"><div><h4>Supplied BOQ figures</h4><p>'+escapeHtml(boq.sourceFilename||'Uploaded BOQ')+' · '+fmt(boq.itemCount)+' items. Quantities, rates and amounts are shown as read. Missing calculation inputs do not block these figures.</p></div></div><div class="planning-panel-body"><label for="suppliedBoqSearch">Find BOQ item</label><input id="suppliedBoqSearch" type="search" placeholder="Item number, description, section or unit" oninput="updateSuppliedBoq(0,this.value)"><div id="suppliedBoqRows">'+renderSuppliedBoqRows(boq)+'</div></div></section>';
}
function renderDeliveryChallenge(data,reason,status){
  const d=data?.deliveryChallenge||{};
  if(!data?.deliveryChallenge&&!data?.suppliedBoq?.rows?.length)return false;
  const f=data.boqFeasibility||{rows:[],activityChecks:[],overallStatus:"Unable to assess",reason:"Current quantity and productivity assessment is unresolved."};
  const availability=data?.featureAvailability||null;
  const prerequisites=Array.isArray(availability?.prerequisites)?availability.prerequisites:[];
  const prereqRows=prerequisites.map(row=>'<tr><td><b>'+escapeHtml(row.label)+'</b></td><td><span class="state-pill '+(row.established?"ready":"review")+'">'+escapeHtml(row.established?"Established":"Missing")+'</span></td><td>'+escapeHtml(row.evidence||"")+'</td></tr>').join("");
  const prereqTable=prereqRows?'<div class="table-wrap"><table><thead><tr><th>Prerequisite</th><th>State</th><th>Evidence basis</th></tr></thead><tbody>'+prereqRows+'</tbody></table></div>':'';
  const sourceKpis=planningKpis([
    ["BOQ scope",data?.suppliedBoq?.itemCount??data?.suppliedBoq?.rows?.length??"Not established","source quantity population"],
    ["BOQ feasibility rows",(f.rows||[]).length||"Not established","available item-level calculations"],
    ["Activity feasibility checks",(f.activityChecks||[]).length||"Not established","current activity checks"],
    ["Labour evidence",data.sourceLaborEvidence?"Available":"Not established","source hours remain evidence; not inferred headcount"]
  ]);
  const challengeActive=availability?availability.state==="active":Boolean(data?.deliveryChallenge&&(f.activityChecks||[]).length>0);
  if(!challengeActive){
    const compact='<section class="planning-view contract-challenge-view"><div class="notice info"><b>Challenge the Contract is not yet fully assessable.</b><p><b>Manpower and duration check: Unable to assess.</b> '+escapeHtml(availability?.reason||f.reason||"Delivery-challenge prerequisites are incomplete.")+'</p></div>'+sourceKpis+
      '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>What is available and what is missing</h4><p>The challenge activates only when BOQ, remaining quantities, activity links, productivity, calendar/working time and resource basis are all represented. Existing evidence remains visible.</p></div></div><div class="planning-panel-body">'+prereqTable+'</div></section></section>';
    el("moduleContent").innerHTML=renderModuleBasis(data)+renderRoleContent("challenge-contract",data,compact,"",true)+(data?.suppliedBoq?.rows?.length?'<details class="management-detail supplied-boq-support"><summary>Supplied BOQ evidence</summary>'+renderSuppliedBoq(data.suppliedBoq)+'</details>':'')+experienceReviewSummary(data.issueAssessment)+renderModuleReadiness(data,reason);
    return true;
  }
  const findings=Array.isArray(d.findings)?d.findings:[];
  const topics=[
    ["quantity","Quantities"],
    ["manpower","Manpower"],
    ["productivity","Productivity"],
    ["programme","Duration"],
    ["workfront","Sequencing"]
  ];
  const primaryRows=topics.map(([key,label])=>{
    const row=findings.find(item=>item.topic===key);
    return '<tr><td><b>'+escapeHtml(label)+'</b><br><span class="state-pill '+(row?.state==="challenged"?"blocked":row?.state==="supported"?"ready":"review")+'">'+escapeHtml(humanizeKey(row?.state||"missing_evidence"))+'</span></td>'+
      '<td>'+escapeHtml(row?.contractorAssumption||"Not established")+'</td>'+
      '<td>'+escapeHtml(row?.independentCalculation||"Not established")+'</td>'+
      '<td>'+escapeHtml(row?.difference||"Not established")+'</td>'+
      '<td>'+escapeHtml(row?.milestoneConsequence||"No programme consequence established from the available evidence")+'</td>'+
      '<td>'+escapeHtml(row?.requiredResponse||"No additional response identified by this check")+'</td></tr>';
  }).join("");
  const primary='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Delivery challenge</h4><p>Submitted assumption → Independent requirement → Gap → Programme consequence → Required action. Quantities, manpower, productivity, duration and sequencing are kept separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Challenge</th><th>Submitted assumption</th><th>Independent requirement</th><th>Gap</th><th>Programme consequence</th><th>Required action</th></tr></thead><tbody>'+primaryRows+'</tbody></table></div></div></section>';
  const activities=f.activityChecks||[];
  const itemRows=f.rows||[];
  const activityDetail=activities.length?'<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Required labour hours</th><th>Working hours</th><th>Required average people</th><th>Submitted people</th><th>Quantity-driven finish</th><th>State</th></tr></thead><tbody>'+activities.slice(0,100).map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b></td><td>'+escapeHtml(row.requiredLaborHours==null?"Unresolved":fmt(row.requiredLaborHours))+'</td><td>'+escapeHtml(row.availableWorkingHours==null?"Unresolved":fmt(row.availableWorkingHours))+'</td><td>'+escapeHtml(row.requiredAveragePeople==null?"Unresolved":fmt(row.requiredAveragePeople))+'</td><td>'+escapeHtml(row.submittedPeople==null?"Unresolved":fmt(row.submittedPeople))+'</td><td>'+escapeHtml(row.productionFinishIso?planningShortDate(row.productionFinishIso):"Unresolved")+'</td><td>'+escapeHtml(humanizeKey(row.scheduleState||"unresolved"))+'</td></tr>').join("")+'</tbody></table></div>':'<p>No activity-level feasibility calculation is established.</p>';
  const itemDetail=itemRows.length?'<div class="table-wrap"><table><thead><tr><th>BOQ item</th><th>Activity</th><th>Remaining quantity</th><th>Unit</th><th>Labour h/unit</th><th>Required labour hours</th><th>Reason</th></tr></thead><tbody>'+itemRows.slice(0,100).map(row=>'<tr><td><b>'+escapeHtml(row.quantityItemId)+'</b></td><td>'+escapeHtml(row.activityId||"Unresolved")+'</td><td>'+escapeHtml(row.remainingQuantity==null?"Unresolved":fmt(row.remainingQuantity))+'</td><td>'+escapeHtml(row.unit||"Unresolved")+'</td><td>'+escapeHtml(row.laborHoursPerUnit==null?"Unresolved":fmt(row.laborHoursPerUnit))+'</td><td>'+escapeHtml(row.requiredLaborHours==null?"Unresolved":fmt(row.requiredLaborHours))+'</td><td>'+escapeHtml(row.reason||"")+'</td></tr>').join("")+'</tbody></table></div>':'<p>No BOQ item calculation is established.</p>';
  const detail='<details class="management-detail"><summary>Calculation detail and source evidence</summary><p>'+escapeHtml(d.disclaimer||"")+'</p>'+prereqTable+
    '<h4>1. Challenge manpower plan</h4><p>Detailed manpower/resource evidence remains supporting calculation detail behind the five-topic management table.</p>'+
    '<h4>2. Challenge current schedule</h4>'+activityDetail+
    '<h4>3. Combined delivery challenge</h4>'+itemDetail+
    renderBasisReviews({...data,contractValueBasisReview:null},"challenge-contract")+'</details>';
  const html='<section class="planning-view contract-challenge-view"><div class="notice '+(d.position==="material_delivery_gap"||d.position==="challenged"?"warn":"info")+'"><b>Delivery challenge position: '+escapeHtml(humanizeKey(d.position||"not_yet_supportable"))+'</b><p>This is an analytical delivery challenge, not a replacement programme and not an EOT/entitlement decision.</p></div>'+sourceKpis+primary+detail+'</section>';
  el("moduleContent").innerHTML=renderModuleBasis(data)+renderRoleContent("challenge-contract",data,html,"",true)+(data?.suppliedBoq?.rows?.length?'<details class="management-detail supplied-boq-support"><summary>Supplied BOQ evidence</summary>'+renderSuppliedBoq(data.suppliedBoq)+'</details>':'')+experienceReviewSummary(data.issueAssessment)+renderModuleReadiness(data,reason);
  return true;
}
function resourceUnitLabel(unit){
  return ({labor_hour:"Labor hours",labour_hour:"Labor hours",equipment_hour:"Equipment hours"})[unit]||unit;
}
function humanizeKey(key){
  const sharedLabels=${JSON.stringify(STATUS_LABELS)};if(sharedLabels[key])return sharedLabels[key];
  const diagnosticLabels=${JSON.stringify(MANAGEMENT_DIAGNOSTIC_LABELS)};
  const diagnosticKey=String(key??"").split(":")[0];if(diagnosticLabels[diagnosticKey])return diagnosticLabels[diagnosticKey];
  const labels={PARALLEL_ASSESSMENT_VALUES_DIFFER:"Claim assessments disagree",REGISTER_DETERMINED_STATUS_NOT_IN_DETERMINATION_REGISTER:"Reported determination is absent from the award register",labor_hour:"Labor hours",equipment_hour:"Equipment hours",rfi_register:"RFI",design_deliverables:"Design deliverable",submittal_register:"Submittal",governed:"Confirmed",established:"Confirmed",candidate:"Needs review",not_established:"Unresolved",not_applicable:"Not applicable",quarantined:"Source evidence under review",not_submitted:"Not provided",submitted_unparsed:"Provided; not read",independent_cpm:"Calendar calculation",source_forecast:"Submitted forecast",event_date_missing:"Event / awareness date missing",requirement_missing:"Notice rule missing"};
  if(labels[key])return labels[key];
  const value=String(key);
  if(/^[A-Z][A-Z0-9_]+(?::.*)?$/.test(value)&&value.includes("_"))return "Additional calculation qualification";
  return value
    .replace(/[_-]+/g," ")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/\b\w/g,c=>c.toUpperCase());
}
function documentUseLabel(state,document=null){
  if(document?.category==="schedule"&&state==="active"&&document.scheduleAdoption?.method!=="explicit")return"Previous source selection · adoption needs confirmation";
  if(document?.category==="schedule_control"){
    const supportLabels={
      active:"Current supporting record",
      superseded:"Previous supporting record",
      candidate:"Supporting record needs review",
      additive:"Additional supporting record",
      historical:"Reference only",
      scenario:"Scenario only"
    };
    return supportLabels[state]||humanizeKey(state||"unknown");
  }
  const labels={
    active:"Current / used now",
    superseded:"Previous version",
    candidate:"Needs review before current",
    additive:"Adds to current record",
    historical:"Reference only",
    scenario:"Scenario only"
  };
  return labels[state]||humanizeKey(state||"unknown");
}
function documentReadLabel(state){
  const labels={
    parsed:"Read complete",
    partial:"Read partial",
    identified:"Identified only",
    ocr_pending:"Full OCR required",
    stored:"Stored only",
    unsupported:"Unsupported",
    error:"Could not read"
  };
  return labels[state]||humanizeKey(state||"unknown");
}
function documentReadNote(state){
  const notes={
    parsed:"Current reading pass completed for the supported content.",
    partial:"The current reading pass finished, but some content remains unresolved or needs review.",
    identified:"CMeng identified the document type, but did not convert the full content into structured project facts.",
    ocr_pending:"No completed full-page reading receipt is available. Refresh after document processing to see page coverage and any reading failures.",
    stored:"The file is retained but no structured reading has been established.",
    unsupported:"The file is retained but this format/content is not supported for structured reading.",
    error:"CMeng could not read the document successfully."
  };
  return notes[state]||"See the document detail for its reading result.";
}

function isScalarValue(value){
  return value===null||["string","number","boolean"].includes(typeof value);
}
function renderComplexCell(value){
  if(isScalarValue(value))return escapeHtml(fmt(value));
  if(Array.isArray(value)&&value.every(isScalarValue))return '<div class="value-list">'+value.map(v=>'<span class="value-chip">'+escapeHtml(fmt(v))+'</span>').join("")+'</div>';
  return '<details class="cell-details"><summary>Open detail</summary><div style="padding:8px 0">'+renderStructuredValue(value,1)+'</div></details>';
}
function renderRecordTable(records){
  const rows=records.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
  if(!rows.length)return"";
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  return '<div class="table-wrap"><table><thead><tr>'+columns.map(key=>'<th>'+escapeHtml(humanizeKey(key))+'</th>').join("")+'</tr></thead><tbody>'+
    rows.map(row=>'<tr>'+columns.map(key=>'<td>'+renderComplexCell(row[key])+'</td>').join("")+'</tr>').join("")+
    '</tbody></table></div>';
}
function renderStructuredValue(value,depth=0){
  if(isScalarValue(value))return '<div class="value-chip">'+escapeHtml(fmt(value))+'</div>';
  if(depth>3)return '<div class="muted">Additional supporting detail retained in the project record.</div>';
  if(Array.isArray(value)){
    if(!value.length)return '<div class="muted">No records.</div>';
    if(value.every(isScalarValue))return '<div class="value-list">'+value.map(v=>'<span class="value-chip">'+escapeHtml(fmt(v))+'</span>').join("")+'</div>';
    if(value.every(x=>x&&typeof x==="object"&&!Array.isArray(x)))return renderRecordTable(value);
    return '<details><summary>Additional records · '+escapeHtml(value.length)+'</summary><div style="padding:10px">'+value.map(item=>renderStructuredValue(item,depth+1)).join("")+'</div></details>';
  }
  if(!value||typeof value!=="object")return"";
  const entries=Object.entries(value);
  const scalars=entries.filter(([,v])=>isScalarValue(v));
  const complex=entries.filter(([,v])=>!isScalarValue(v));
  let html=scalars.length?'<div class="scalar-grid">'+scalars.map(([key,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(key))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("")+'</div>':"";
  if(depth>=2&&complex.length){
    html+='<div class="muted" style="margin-top:8px">Additional supporting records are retained with the project documents.</div>';
    return html;
  }
  html+=complex.map(([key,v])=>'<div class="nested-block"><div class="nested-title">'+escapeHtml(humanizeKey(key))+'</div>'+renderStructuredValue(v,depth+1)+'</div>').join("");
  return html||'<div class="muted">No displayable values.</div>';
}
function projectionFor(data,projectionKey){
  if(data?.projectionKey===projectionKey)return data;
  for(const value of Object.values(data||{})){
    if(value&&typeof value==="object"&&!Array.isArray(value)&&value.projectionKey===projectionKey)return value;
  }
  return data||{};
}
function chartToneColor(tone){
  const colors={
    accent:"#4f7fb4",success:"#2c7a57",warning:"#b57922",danger:"#b4483e",
    neutral:"#91a0b0",graphite:"#506579",purple:"#7c5ca8",teal:"#4c8f95"
  };
  return colors[tone]||tone||colors.accent;
}
function renderVisualPanel(title,description,body,badge=""){
  return '<section class="visual-chart" data-visual-panel><div class="visual-chart-head"><div><h5>'+escapeHtml(title)+'</h5>'+(description?'<p>'+escapeHtml(description)+'</p>':'')+'</div><div class="visual-chart-actions">'+(badge?'<span class="badge">'+escapeHtml(badge)+'</span>':'')+'<button class="visual-focus-button" type="button" aria-label="Expand '+escapeHtml(title)+'">Expand</button></div></div><div class="visual-chart-body">'+body+'</div></section>';
}
function renderDonutChart(items,centerLabel="Total"){
  const known=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)&&item.value>=0);
  const total=known.reduce((sum,item)=>sum+item.value,0);
  if(!known.length||total<=0)return '<div class="empty-visual">No established distribution is available for this chart.</div>';
  if(known.length>6){
    return renderVisualBars(known.map(item=>({label:item.label,value:item.value,tone:item.tone||"accent"})));
  }
  let cursor=0;
  const stops=[];
  known.forEach(item=>{
    const from=(cursor/total)*100;
    cursor+=item.value;
    const to=(cursor/total)*100;
    const color=chartToneColor(item.tone||"neutral");
    stops.push(color+" "+from.toFixed(3)+"% "+to.toFixed(3)+"%");
  });
  const legend=known.map(item=>{
    const percent=total>0?(item.value/total)*100:0;
    return '<div class="donut-legend-row"><i style="background:'+chartToneColor(item.tone||"neutral")+'"></i><span>'+escapeHtml(item.label)+'</span><b>'+escapeHtml(fmt(item.value)+" · "+fmt(percent)+"%")+'</b></div>';
  }).join("");
  return '<div class="donut-layout"><div class="donut-ring" style="background:conic-gradient('+stops.join(",")+')"><div class="donut-center"><b>'+escapeHtml(fmt(total))+'</b><span>'+escapeHtml(centerLabel)+'</span></div></div><div class="donut-legend">'+legend+'</div></div>';
}
function renderVisualBars(items,unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)&&item.value>=0);
  if(!rows.length)return '<div class="empty-visual">No comparable values are established for this chart.</div>';
  const max=unit.trim()==="%"?100:Math.max(1,...rows.map(item=>item.value));
  return '<div class="visual-bars">'+rows.map(item=>{
    const width=Math.min(100,Math.max(0,(item.value/max)*100));
    const tone=item.tone||"accent";
    return '<div class="visual-bar-row"><div class="visual-bar-label" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div><div class="visual-bar-track"><div class="visual-bar-fill '+escapeHtml(tone)+'" style="width:'+width.toFixed(2)+'%"></div></div><div class="visual-bar-value">'+escapeHtml((unit.trim()==="%"?percent2(item.value):fmt(item.value))+(unit?" "+unit:""))+'</div></div>';
  }).join("")+'</div>';
}
function renderWaterfallChart(items,unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value));
  if(!rows.length)return '<div class="empty-visual">No signed movement is established for this chart.</div>';
  const max=Math.max(1,...rows.map(item=>Math.abs(item.value)));
  return '<div class="waterfall">'+rows.map(item=>{
    const width=Math.min(49,(Math.abs(item.value)/max)*48);
    const left=item.value<0?50-width:50;
    const tone=item.value>0?"positive":item.value<0?"negative":"neutral";
    const text=(item.value>0?"+":"")+fmt(item.value)+(unit?" "+unit:"");
    return '<div class="waterfall-row"><div class="visual-bar-label" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div><div class="waterfall-track"><span class="waterfall-zero"></span><span class="waterfall-bar '+tone+'" style="left:'+left.toFixed(2)+'%;width:'+width.toFixed(2)+'%"></span></div><div class="visual-bar-value">'+escapeHtml(text)+'</div></div>';
  }).join("")+'</div>';
}
function renderCashMovementBars(items,unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value));
  if(!rows.length)return '<div class="empty-visual">No evidenced actual cash movement is established.</div>';
  const max=Math.max(1,...rows.map(item=>Math.abs(item.value)));
  return '<div class="cash-movement-bars">'+rows.map(item=>{
    const width=Math.min(49,(Math.abs(item.value)/max)*48);
    const left=item.value<0?50-width:50;
    const tone=item.value>0?"positive":item.value<0?"negative":"neutral";
    const text=(item.value>0?"+":"")+fmt(item.value)+(unit?" "+unit:"");
    return '<div class="cash-movement-row"><div class="visual-bar-label" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div><div class="cash-movement-track"><span class="cash-movement-zero"></span><span class="cash-movement-bar '+tone+'" style="left:'+left.toFixed(2)+'%;width:'+width.toFixed(2)+'%"></span></div><div class="visual-bar-value">'+escapeHtml(text)+'</div></div>';
  }).join("")+'</div>';
}
function renderCommercialValueBridge(base,approved,current,pending,unit=""){
  const sourceSnapshot=[base,approved,current].some(row=>(row?.diagnostics||[]).includes("EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS"));
  const cell=(label,metric,tone)=>{
    const value=metricValue(metric);
    const state=commercialSourceState(metric);
    return '<div class="value-bridge-cell '+escapeHtml(tone)+'"><span>'+escapeHtml(label)+'</span><b>'+escapeHtml(value===null?"Unresolved":fmt(value)+(unit?" "+unit:""))+'</b><small>'+escapeHtml(state)+'</small></div>';
  };
  return '<div class="value-bridge">'+
    cell(sourceSnapshot?"Source original contract":"Original contract",base,"base")+
    '<div class="value-bridge-op">+</div>'+
    cell(sourceSnapshot?"Source reported approved changes":"Approved changes by Data Date",approved,"change")+
    '<div class="value-bridge-op">=</div>'+
    cell(sourceSnapshot?"Source reported current contract":"Current contract",current,"current")+
    '<div class="value-bridge-pending">'+cell("Pending exposure · outside current contract",pending,"pending")+'</div>'+
    '</div>';
}
function metricValue(metric){
  if(metric===null||metric===undefined)return null;
  if(typeof metric==="number")return Number.isFinite(metric)?metric:null;
  if(typeof metric==="object"&&typeof metric.value==="number"&&Number.isFinite(metric.value))return metric.value;
  return null;
}
function renderCommercialMetricBars(row,fields){
  const items=(fields||[]).map(([label,field,tone])=>({label,value:metricValue(row?.[field]),tone:tone||"accent"})).filter(item=>item.value!==null);
  return renderVisualBars(items,row?.currency||"");
}
function renderLineChart(points,series,yMaxHint=null,options={}){
  if(points.length===1){const point=points[0];return '<div class="notice info"><b>Single observation · trend not confirmed</b><p>'+escapeHtml(planningShortDate(point.dateIso||point.asOf))+'</p>'+series.filter(item=>typeof point[item.key]==='number').map(item=>'<div class="currency-line"><span>'+escapeHtml(item.label)+'</span><strong>'+escapeHtml(fmt(point[item.key])+(options.unit?' '+options.unit:''))+'</strong></div>').join('')+'</div>';}

  series=series.filter(item=>Array.isArray(points)&&points.some(point=>typeof point?.[item.key]==="number"&&Number.isFinite(point[item.key])));
  if(!Array.isArray(points)||!points.length)return '<div class="empty-visual">No series points available.</div>';
  const numeric=[];
  points.forEach(point=>series.forEach(item=>{
    const value=point?.[item.key];
    if(typeof value==="number"&&Number.isFinite(value))numeric.push(value);
  }));
  if(!numeric.length)return '<div class="empty-visual">No numeric series points available.</div>';

  const dateKey=options.dateKey||"dateIso";
  const unit=options.unit||"";
  const yLabel=options.yLabel||unit||"";
  const xLabel=options.xLabel||"";
  const valueText=value=>unit?(unit==="%"?fmtExecutive(value)+"%":fmtExecutive(value)+" "+unit):fmtExecutive(value);
  const prepared=points.map((point,index)=>{
    const raw=point?.[dateKey];
    const ms=raw?planningDateMs(raw):null;
    return {point,index,raw,ms};
  });
  const validDates=prepared.filter(item=>typeof item.ms==="number");
  const useDateScale=validDates.length===prepared.length&&new Set(validDates.map(item=>item.ms)).size>1;
  const minX=useDateScale?Math.min(...validDates.map(item=>item.ms)):0;
  const maxX=useDateScale?Math.max(...validDates.map(item=>item.ms)):Math.max(1,points.length-1);

  const width=1080,height=352,left=78,right=30,top=28,bottom=66;
  const plotW=width-left-right,plotH=height-top-bottom;
  const observedMin=Math.min(...numeric),observedMax=Math.max(...numeric);
  const signed=observedMin<0;
  const range=Math.max(observedMax-observedMin,Math.max(0.01,Math.abs(observedMax)*0.02));
  const zeroBaseline=options.zeroBaseline!==false;
  const minY=yMaxHint!==null?0:signed?Math.min(0,observedMin-range*.08):zeroBaseline?0:Math.max(0,observedMin-range*.12);
  const maxY=yMaxHint!==null?yMaxHint:Math.max(minY+.0001,observedMax+range*.12);
  const span=Math.max(.0001,maxY-minY);

  const x=index=>{
    if(useDateScale){
      const ms=prepared[index]?.ms;
      return left+(((ms-minX)/Math.max(1,maxX-minX))*plotW);
    }
    return left+(points.length===1?plotW/2:(index/Math.max(1,points.length-1))*plotW);
  };
  const y=value=>top+plotH-((Math.max(minY,Math.min(maxY,value))-minY)/span)*plotH;

  const segments=key=>{
    const result=[];
    let current=[];
    points.forEach((point,index)=>{
      const value=point?.[key];
      if(typeof value==="number"&&Number.isFinite(value)){
        current.push({x:x(index),y:y(value),value,index});
      }else if(current.length){
        result.push(current);
        current=[];
      }
    });
    if(current.length)result.push(current);
    return result;
  };

  const grid=[0,.25,.5,.75,1].map(ratio=>{
    const value=minY+(span*ratio),yy=y(value);
    return '<line x1="'+left+'" y1="'+yy.toFixed(1)+'" x2="'+(width-right)+'" y2="'+yy.toFixed(1)+'" stroke="#e6edf4" stroke-width="1"/>'+
      '<text x="'+(left-12)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="#738399">'+escapeHtml(fmtExecutive(value))+'</text>';
  }).join("");

  const zero=minY<0&&maxY>0
    ? '<line x1="'+left+'" y1="'+y(0).toFixed(1)+'" x2="'+(width-right)+'" y2="'+y(0).toFixed(1)+'" stroke="#98a2b3" stroke-width="1.2" stroke-dasharray="4 4"/>'
    : '';

  const plots=series.map((item,seriesIndex)=>{
    const color=item.color||chartToneColor(item.tone||"accent");
    return segments(item.key).map(seg=>{
      const pathPoints=item.step?seg.flatMap((p,index)=>index?[{x:p.x,y:seg[index-1].y},p]:[p]):seg;
      const poly='<polyline points="'+pathPoints.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+'" fill="none" stroke="'+color+'" stroke-width="'+(seriesIndex===0?3:2.4)+'" stroke-linecap="round" stroke-linejoin="round"/>';
      const area=seriesIndex===0&&minY>=0&&seg.length>1
        ? '<polygon points="'+seg[0].x.toFixed(1)+","+y(minY).toFixed(1)+" "+seg.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+" "+seg.at(-1).x.toFixed(1)+","+y(minY).toFixed(1)+'" fill="'+color+'" fill-opacity=".055"/>'
        : '';
      const visibleDots=seg.length<=48
        ? seg.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.2" fill="#fff" stroke="'+color+'" stroke-width="1.8"></circle>').join("")
        : '';
      const hitDots=seg.map(p=>{
        const raw=prepared[p.index]?.raw;
        const dateText=raw?(planningShortDate(raw)||String(raw)):"Period "+(p.index+1);
        return '<circle class="chart-hit-point" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="7" fill="transparent" tabindex="0"><title>'+
          escapeHtml(item.label+" · "+valueText(p.value)+" · "+dateText)+'</title></circle>';
      }).join("");
      return area+poly+visibleDots+hitDots;
    }).join("");
  }).join("");

  let labels="";
  if(useDateScale){
    labels=[0,.25,.5,.75,1].map((ratio,index)=>{
      const ms=minX+((maxX-minX)*ratio);
      const xx=left+(plotW*ratio);
      return '<text x="'+xx.toFixed(1)+'" y="'+(height-24)+'" text-anchor="'+(index===0?"start":index===4?"end":"middle")+'" font-size="10" fill="#738399">'+
        escapeHtml(planningShortDate(new Date(ms).toISOString()))+'</text>';
    }).join("");
  }else{
    const labelIndexes=[0,Math.floor((points.length-1)/4),Math.floor((points.length-1)/2),Math.floor(((points.length-1)*3)/4),points.length-1]
      .filter((value,index,array)=>array.indexOf(value)===index);
    labels=labelIndexes.map(index=>
      '<text x="'+x(index).toFixed(1)+'" y="'+(height-24)+'" text-anchor="'+(index===0?"start":index===points.length-1?"end":"middle")+'" font-size="10" fill="#738399">'+
      escapeHtml(planningShortDate(points[index]?.[dateKey])||points[index]?.[dateKey]||String(index+1))+'</text>'
    ).join("");
  }

  const dataDateMs=options.dataDateIso?planningDateMs(options.dataDateIso):null;
  const dataDateX=useDateScale&&typeof dataDateMs==="number"&&dataDateMs>=minX&&dataDateMs<=maxX
    ? left+((dataDateMs-minX)/Math.max(1,maxX-minX))*plotW
    : null;
  const dataDateLine=dataDateX===null
    ? ''
    : '<line x1="'+dataDateX.toFixed(1)+'" y1="'+top+'" x2="'+dataDateX.toFixed(1)+'" y2="'+(height-bottom)+'" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="5 4"/>'+
      '<text x="'+(dataDateX+6).toFixed(1)+'" y="'+(top+12)+'" font-size="9.5" fill="#667085">Data date</text>';

  const axisTitle=yLabel
    ? '<text x="18" y="'+(top+plotH/2).toFixed(1)+'" transform="rotate(-90 18 '+(top+plotH/2).toFixed(1)+')" text-anchor="middle" font-size="10" font-weight="700" fill="#667085">'+escapeHtml(yLabel)+'</text>'
    : '';
  const xAxisTitle=xLabel
    ? '<text x="'+(left+plotW/2).toFixed(1)+'" y="'+(height-5)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#667085">'+escapeHtml(xLabel)+'</text>'
    : '';

  const legend='<div class="chart-legend">'+series.map(item=>{
    const values=points.map(point=>point?.[item.key]).filter(value=>typeof value==="number"&&Number.isFinite(value));
    const latest=values.length?values.at(-1):null;
    return '<span class="legend-item"><span class="legend-dot" style="background:'+(item.color||chartToneColor(item.tone||"accent"))+'"></span>'+
      escapeHtml(item.label)+'</span>';
  }).join("")+'</div>';

  const scaleNote=useDateScale?"True date spacing":"Ordered "+(options.categoryLabel||"period")+" spacing";
  const toolbar='<div class="chart-canvas-toolbar"><span>'+escapeHtml(scaleNote)+' · '+escapeHtml(points.length)+' plot points'+(options.observationCount!==undefined?' · '+escapeHtml(options.observationCount)+' source observations':'')+
    (unit?' · '+escapeHtml(unit):'')+'</span><button class="chart-canvas-focus-button" type="button" aria-label="Expand chart">Expand chart</button></div>';

  return '<div class="chart-canvas" data-chart-canvas>'+toolbar+legend+
    '<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escapeHtml(options.ariaLabel||"Trend chart")+'">'+
    grid+zero+dataDateLine+plots+labels+axisTitle+xAxisTitle+'</svg></div></div>';
}
function percent2(value){return typeof value==="number"&&Number.isFinite(value)?value.toFixed(2):"—";}
function renderProgressScope(scope){
  if(!scope)return '<div class="notice warn">Comparable progress is unavailable: match baseline and current activities before stating a performance gap.</div>';
  const gap=scope.gapPercentagePoints;
  const verdict=gap==null?'Progress gap cannot be calculated':Math.abs(gap).toFixed(2)+' pp '+(gap<0?'behind':gap>0?'ahead of':'level with')+' baseline on the same tasks and fixed weights';
  return '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>'+escapeHtml(verdict)+'</h4><p>'+fmt(scope.comparableActivityCount)+' comparable tasks out of '+fmt(scope.matchedActivityCount)+' matched · '+escapeHtml(humanizeKey(scope.state))+'</p></div></div><div class="planning-panel-body">'+planningKpis([
    ['Baseline plan',percent2(scope.baselinePlannedPercent)+'%','matched tasks, baseline duration weights'],
    ['Snapshot · fixed weights',percent2(scope.snapshotPercent)+'%','same tasks and baseline duration weights'],
    ['Schedule ratio',percent2(scope.ratio),'same tasks and weights; not EVM SPI'],
    ['Added tasks',scope.addedActivityCount,percent2(scope.addedDurationWeightPercent)+'% of current duration weight']
  ])+'<p>'+escapeHtml(scope.interpretation)+'</p><details><summary>Separate scope and duration-weight effects</summary><p>On matched tasks using current duration weights: snapshot '+percent2(scope.snapshotCurrentWeightsPercent)+'%; current plan '+percent2(scope.currentPlanCurrentWeightsPercent)+'%; snapshot / baseline ratio '+percent2(scope.currentWeightRatio)+'. Gap to baseline: '+percent2(scope.currentWeightGapPercentagePoints)+' pp.</p><p>Changing the duration weights contributes '+percent2(scope.durationWeightEffectPercentagePoints)+' pp; adding current scope contributes '+percent2(scope.scopeDilutionPercentagePoints)+' pp. Full-scope snapshot: '+percent2(scope.fullScopeSnapshotPercent)+'%.</p><p>'+fmt(scope.addedNotStartedCount)+' of '+fmt(scope.addedActivityCount)+' added tasks have not started. Earliest dated start: '+escapeHtml(planningShortDate(scope.addedEarliestStartIso))+'. Baseline population '+fmt(scope.baselineActivityCount)+'; current population '+fmt(scope.currentActivityCount)+'; removed '+fmt(scope.removedActivityCount)+'; ambiguous identities '+fmt(scope.ambiguousIdentityCount)+'.</p></details></div></section>';
}
function renderProgressScurveVisual(data){
  const p=projectionFor(data,"progress_scurve");
  if(!Array.isArray(p.points))return"";
  const snapshotLabel=p.actualHistoryMode==="snapshot_history"?"Schedule snapshot progress":p.actualHistoryMode==="current_snapshot_only"?"Current schedule snapshot":"Progress snapshot";
  const note=p.actualHistoryMode==="snapshot_history"
    ? '<div class="notice info"><b>The orange steps show schedule-revision progress history from source observations.</b> It is not contractor-certified or independently measured physical progress unless separate source evidence establishes that authority.</div>'
    : p.actualHistoryMode==="current_snapshot_only"
      ? '<div class="notice warn">Only one schedule progress snapshot is available. CMeng does not fabricate an earlier actual history from that single point.</div>'
      : '<div class="notice warn">No historical progress snapshots are established. Baseline and current planned curves can still be compared.</div>';
  const cutoff=planningDateMs(p.dataDateIso);
  const latest=p.points.filter(point=>{const at=planningDateMs(point.dateIso);return at!==null&&cutoff!==null&&at<=cutoff}).at(-1)||null;
  const kpis=planningKpis([
    ["Baseline planned",latest?.baselinePlannedPercent===null||latest?.baselinePlannedPercent===undefined?"—":fmt(latest.baselinePlannedPercent)+"%","at data date"],
    ["Current plan",latest?.currentForecastPercent===null||latest?.currentForecastPercent===undefined?"—":fmt(latest.currentForecastPercent)+"%","at data date"],
    ["Schedule snapshot",latest?.actualProgressPercent===null||latest?.actualProgressPercent===undefined?"—":fmt(latest.actualProgressPercent)+"%","not certified physical"],
    ["Baseline coverage",p.baselineCoveragePercent===null?"—":fmt(p.baselineCoveragePercent)+"%",fmt(p.populationContracts?.baseline?.denominator)+" eligible baseline activities"],
    ["Current coverage",p.currentCoveragePercent===null?"—":fmt(p.currentCoveragePercent)+"%",fmt(p.populationContracts?.current?.denominator)+" eligible current activities"],
    ["Snapshot coverage",p.actualSnapshotCoveragePercent===null?"—":fmt(p.actualSnapshotCoveragePercent)+"%",fmt(p.populationContracts?.snapshot?.denominator)+" eligible schedule progress records"]
  ]);
  const series=[{key:"baselinePlannedPercent",label:"Baseline plan · original scope",color:"#506579"},{key:"currentForecastPercent",label:"Current plan · current scope",color:"#4f7fb4"},{key:"actualProgressPercent",label:snapshotLabel+" · revision scope",color:"#d97706",step:true}];
  const first=planningDateMs(p.points[0]?.dateIso),endDate=first==null?null:new Date(first);
  if(endDate)endDate.setUTCFullYear(endDate.getUTCFullYear()+1);
  const early=p.points.filter(row=>endDate&&planningDateMs(row.dateIso)<=endDate.getTime());
  const options={unit:"%",yLabel:"Schedule progress",xLabel:"Reporting date",dataDateIso:p.dataDateIso,observationCount:p.observationCount??p.actualSnapshots?.length};
  return '<section class="planning-view progress-scurve-view">'+
    renderVisualPanel("Progress S-Curve","Baseline plan, current plan and available schedule-progress observations. Missing certified physical progress is never inferred.",renderLineChart(p.points,series,100,{...options,ariaLabel:"Full programme progress"}))+
    kpis+renderProgressScope(p.scopeComparison)+note+
    '<details class="source-scope"><summary>First 12 months and source-population coverage</summary>'+
      renderLineChart(early,series,null,{...options,ariaLabel:"Progress first 12 months"})+
    '</details></section>';
}
function renderQuantityScurveVisual(data){
  const p=projectionFor(data,"quantity_scurve");
  if(!Array.isArray(p.series))return"";
  const mappingLabel=p.mappingBasis==="governed"?"Confirmed links":p.mappingBasis==="candidate_scenario"?"Suggested links for review":"Activities not yet linked";
  const mappedSeries=p.series.filter(series=>(series.points||[]).length>0);
  const availability=data?.featureAvailability||p.featureAvailability||null;
  const seriesItemCount=p.series.reduce((sum,series)=>sum+(Number.isFinite(Number(series.itemCount))?Number(series.itemCount):0),0);
  const populationKnown=typeof p.boqItemCount==="number"||Boolean(p.boqRevisionId);
  const unmappedCount=populationKnown?p.unmappedItemIds?.length??null:null;
  const boqItemCount=typeof p.boqItemCount==="number"?p.boqItemCount:populationKnown?seriesItemCount>0?seriesItemCount:unmappedCount:null;
  const mappedItemCount=typeof p.allocatedItemCount==="number"?p.allocatedItemCount:null;
  const itemLinkCoverage=typeof p.itemLinkCoveragePercent==="number"?p.itemLinkCoveragePercent:null;
  const measurement=p.measurementReview;
  const installed=p.installedQuantityStatus;
  const installedSummary=installed?'<div class="notice '+(installed.state==='available'?'info':'warn')+'"><b>Measured installation: '+escapeHtml(humanizeKey(installed.state))+'</b><p>'+escapeHtml(installed.explanation)+'</p></div>':"";
  const measured=measurement?planningKpis([["Items with dated measurements",measurement.measuredItemCount,"of "+measurement.boqItemCount+" BOQ items"],["Measurement rows needing review",measurement.currentUnresolvedRowCount,"through the reporting date"],["Future measurement rows",measurement.futureRowCount,"excluded from current actuals"]])+'<div class="notice info">'+escapeHtml(measurement.basis)+'</div>':"";
  const top=planningKpis([
    ["BOQ items",boqItemCount===null?"Unresolved":boqItemCount,"quantity basis"],
    ["Programme-linked items",mappedItemCount===null?"Unresolved":mappedItemCount,"planned quantities; confirmed or scenario links"],
    ["Programme-link coverage",itemLinkCoverage===null?"Unresolved":fmt(itemLinkCoverage)+"%","separate from installed measurements"],
    ["Mapping basis",mappingLabel,""],
    ["Unit groups",populationKnown?p.series.length:null,"unknown units remain separate"],
    ["Unmapped items",populationKnown?p.unmappedItemIds?.length??null:null,"items",p.unmappedItemIds?.length?"warning":""],
    ["Partially mapped",populationKnown?p.partiallyAllocatedItemIds?.length??null:null,"items",p.partiallyAllocatedItemIds?.length?"warning":""],
    ["Over-allocated",populationKnown?p.overAllocatedItemIds?.length??null:null,"items",p.overAllocatedItemIds?.length?"danger":""]
  ]);
  const productivity=p.productivityForecast||null;
  const productivityRows=Array.isArray(productivity?.rows)?productivity.rows:[];
  const productivityHtml='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Remaining quantity & productivity forecast</h4><p>Source productivity evidence is kept separate from BOQ-to-programme mapping. Forecast is shown only when the source evidence establishes quantity, achieved rate and calculation basis.</p></div></div><div class="planning-panel-body">'+(productivityRows.length?'<div class="table-wrap"><table><thead><tr><th>Work package</th><th>Total quantity</th><th>Installed</th><th>Remaining</th><th>Evidenced rate / h</th><th>Rate basis</th><th>Forecast finish</th><th>State</th></tr></thead><tbody>'+productivityRows.map(row=>'<tr><td><b>'+escapeHtml(row.workPackageId)+'</b><br>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(row.totalQuantity==null?"Not established":fmt(row.totalQuantity)+" "+(row.unit||""))+'</td><td>'+escapeHtml(row.installedQuantity==null?"Not established":fmt(row.installedQuantity)+" "+(row.unit||""))+'</td><td>'+escapeHtml(row.remainingQuantity==null?"Not established":fmt(row.remainingQuantity)+" "+(row.unit||""))+'</td><td>'+escapeHtml(row.evidencedRatePerHour==null?"Not established":fmt(row.evidencedRatePerHour))+'</td><td>'+escapeHtml(humanizeKey(row.rateBasis||"missing"))+'</td><td>'+escapeHtml(row.completionIso?planningShortDate(row.completionIso):"Not established")+'</td><td>'+escapeHtml(humanizeKey(row.state||"unresolved"))+'</td></tr>').join("")+'</tbody></table></div>':'<div class="notice info">No source productivity/remaining-quantity forecast is established. BOQ and installed quantities remain visible independently.</div>')+'</div></section>';
  const diagnostics='<div class="notice info"><b>BOQ source: '+escapeHtml(p.boqSource?.sourceFilename||"Source reference in calculation detail")+'</b> · '+escapeHtml(humanizeKey(p.boqSource?.state||"source"))+'<p>'+escapeHtml(p.boqSource?.explanation||"")+'</p>BOQ loaded: '+escapeHtml(fmt(p.boqItemCount??boqItemCount))+' items; known contract quantities: '+escapeHtml(fmt(p.knownQuantityItemCount))+'. Candidate mapping: '+escapeHtml(humanizeKey(p.candidateMappingState||"not_established"))+'. Actual installations are independent of schedule mapping. Scenario plans do not become confirmed facts.</div>';
  if(mappedSeries.length===0){
    const candidates=p.inferredMapping?.selectedScenarioLinks?.length||0;
    const mappingSummary=boqItemCount===null?"BOQ item population is not confirmed.":fmt(mappedItemCount||0)+" of "+fmt(boqItemCount)+" BOQ items currently have an allocation.";
    return '<section class="planning-view quantity-view">'+installedSummary+measured+top+productivityHtml+'<div class="notice info"><b>No confirmed quantity curve is available.</b><p>Quantity evidence is available, but a complete quantity curve is not yet established. '+escapeHtml(availability?.reason||"Programme mapping and/or dated installed measurements are incomplete.")+'</p><p>'+escapeHtml(candidates?candidates+" candidate link(s) are retained for review. ":"")+escapeHtml(mappingSummary)+'</p></div>'+experienceDisclosure("Quantity-curve prerequisites",moduleEvidenceGate([
      {label:"BOQ quantity basis",value:p.boqRevisionId?"Loaded":"Not established",state:p.boqRevisionId?"ready":"missing"},
      {label:"Confirmed BOQ-to-activity links",value:p.mappingBasis==="governed"?"Established":"Not established",state:p.mappingBasis==="governed"?"ready":"missing"},
      {label:"Installed quantity history",value:"Dated installed measurements not confirmed",state:"missing"}
    ]),"Why the full curve is not yet available")+diagnostics+'</section>';
  }

  const charts=mappedSeries.map(series=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(series.unit||series.unitKey||"Unit")+' quantity curve</h4><p>'+escapeHtml(fmt(series.itemCount))+' BOQ item(s) in this unit · mapping coverage '+escapeHtml(series.mappingCoveragePercent===null?"—":fmt(series.mappingCoveragePercent)+"%")+'</p></div><span class="badge '+(p.mappingBasis==="governed"?"ready":"partial")+'">'+escapeHtml(p.mappingBasis==="governed"?"Confirmed mapped plan":p.mappingBasis==="candidate_scenario"?"Scenario plan; measured actual separate":"Measured actual; plan mapping missing")+'</span></div><div class="planning-panel-body">'+renderLineChart(series.points||[],[
    {key:"baselinePlannedQuantity",label:series.authority==="scenario_mapping"?"Scenario baseline plan":"Mapped baseline plan",color:"#506579"},
    {key:"currentForecastQuantity",label:series.authority==="scenario_mapping"?"Scenario current plan":"Mapped current plan",color:"#4f7fb4"},
    {key:"actualInstalledQuantity",label:"Measured installed quantities",step:true,color:"#2c7a57"}
  ],null,{unit:series.unit||series.unitKey||"",yLabel:"Cumulative quantity",xLabel:"Reporting date",dataDateIso:p.dataDateIso,ariaLabel:(series.unit||series.unitKey||"Quantity")+" S-Curve"})+'</div></section>').join("");
  return '<section class="planning-view quantity-view">'+installedSummary+measured+top+productivityHtml+charts+diagnostics+'</section>';
}
function renderLookAheadVisual(data){
  const p=projectionFor(data,"lookahead_schedule");
  if(!Array.isArray(p.rows))return"";
  const forwardRows=Array.isArray(p.forwardWindowRows)?p.forwardWindowRows:p.rows.filter(row=>row.classification!=="overdue"&&row.classification!=="missed_start"&&row.finishOverdue!==true&&row.missedPlannedStart!==true);
  const backlogRows=Array.isArray(p.overdueBacklogRows)?p.overdueBacklogRows:p.rows.filter(row=>row.classification==="overdue"||row.classification==="missed_start"||row.finishOverdue===true||row.missedPlannedStart===true);
  const inWindow=forwardRows.length;
  const kpis=planningKpis([
    ["Forward look-ahead",p.windowDays+" calendar days",planningShortDate(p.dataDateIso)+" → "+planningShortDate(p.windowEndIso)],
    ["Forward activities",inWindow,"current / upcoming work only"],
    ["Overdue backlog",backlogRows.length,"separate from the forward window","danger"],["Missed planned starts",p.missedStartCount,"overdue-start backlog; may also be finish overdue","warning"],
    ["Readiness confirmed",p.readyCount,"evidence complete; other activities may have missing records","success"],
    ["Activities with evidence gaps",p.evidenceGapActivityCount,"includes blocked activities","warning"],["Blocked with evidence gaps",p.blockedWithEvidenceGapCount,"Also included in the blocked count","warning"],["Blocker occurrences",p.blockerOccurrenceCount,"may include several per activity","warning"],
    ["Known blocker",p.blockedCount,"at least one explicit blocker","danger"]
  ]);
  const coverageHtml=experienceDisclosure("Readiness evidence coverage",moduleBarList((p.readinessCoverage||[]).map(row=>({label:humanizeKey(row.key)+" · "+fmt(row.knownCount)+" known / "+fmt(row.denominator)+" · "+fmt(row.linkedActivityCount??0)+" linked activities / "+fmt(row.linkedSourceRecordCount??0)+" records",value:row.coveragePercent})),"accent","%"),"Linked records can still have unresolved timing or status");
  const timeline=planningLookAheadTimeline({...p,rows:forwardRows});
  const dimensions=["predecessor","procurement_material","design_submittal","permit","resource","quality","commercial","risk","access"];
  const labels={predecessor:"Predecessors",procurement_material:"Materials",design_submittal:"Design / RFIs / Submittals",permit:"Permit",resource:"Resources",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const watch=[...forwardRows].sort((a,b)=>{
    const ar=a.readiness?.state==="blocked"?0:a.classification==="overdue"?1:a.readiness?.state==="conditional"?2:3;
    const br=b.readiness?.state==="blocked"?0:b.classification==="overdue"?1:b.readiness?.state==="conditional"?2:3;
    return ar-br||String(a.startIso||"").localeCompare(String(b.startIso||""));
  });
  const rows=watch.map(row=>{
    const map=new Map((row.readiness?.dimensions||[]).map(d=>[d.key,d]));
    const overall=row.readiness?.state==="blocked"?"Known blocker":row.readiness?.state==="conditional"?"Evidence gaps":"Ready";
    return '<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(planningShortDate(row.startIso))+'</td><td>'+escapeHtml(planningShortDate(row.finishIso))+'</td><td><span class="state-pill '+escapeHtml(row.readiness?.state||"unknown")+'">'+escapeHtml(overall)+'</span></td>'+dimensions.map(key=>{const dim=map.get(key);const state=dim?.state||"unknown";return '<td><details class="readiness-reason"><summary aria-label="'+escapeHtml(row.activityId+' '+labels[key]+' '+planningStateLabel(state))+'">'+escapeHtml(state==="ready"?"Ready":state==="blocked"?"Blocked":state==="not_applicable"?"N/A":dim?.sourceRefs?.length?"Dates / status need review":"No linked record")+'</summary><p>'+escapeHtml(dim?.note||'No linked readiness record')+'</p>'+((dim?.records||[]).length?'<ul>'+dim.records.map(r=>'<li><b>'+escapeHtml(r.recordId||r.documentType)+'</b> · '+escapeHtml(humanizeKey(r.documentType))+' · '+escapeHtml(planningStateLabel(r.state))+' · '+escapeHtml(r.note)+'</li>').join('')+'</ul>':'')+'</details></td>'}).join("")+'</tr>';
  }).join("");
  const readiness=planningStatusBand([["Ready",p.readyCount,"success"],["Gaps without known blocker",p.conditionalCount,"warning"],["Known blocker",p.blockedCount,"danger"]]);
  const blockers=planningLookAheadBlockers(p.blockerTypes);
  const interfacePosition=data?.interfacePosition||null,lookAheadIds=new Set(forwardRows.map(r=>r.activityId));
  const interfaceRows=(interfacePosition?.rows||[]).filter(r=>r.authority==='confirmed'&&r.state!=='closed'&&String(r.linkedActivity||'').split(';').map(x=>x.trim()).some(id=>lookAheadIds.has(id)));
  const interfaceHtml=interfaceRows.length?'<section class="planning-panel attention"><div class="planning-panel-head"><div><h4>Interfaces affecting this look-ahead</h4><p>Confirmed open/blocked/overdue interface obligations linked to activities inside the selected horizon.</p></div><b>'+fmt(interfaceRows.length)+'</b></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Interface</th><th>State</th><th>Activity</th><th>Required date</th><th>Responsible party</th><th>Consequence</th></tr></thead><tbody>'+interfaceRows.map(r=>'<tr><td><b>'+escapeHtml(r.interfaceId)+'</b></td><td>'+escapeHtml(humanizeKey(r.state))+'</td><td>'+escapeHtml(r.linkedActivity||'—')+'</td><td>'+escapeHtml(r.requiredDate?planningShortDate(r.requiredDate):'—')+'</td><td>'+escapeHtml(r.responsibleParty||'Not established')+'</td><td>'+escapeHtml(r.consequence||'—')+'</td></tr>').join('')+'</tbody></table></div></div></section>':'';
  const interventions=Array.isArray(p.managementInterventions)?p.managementInterventions:[];
  const interventionHtml=interventions.length?'<div class="table-wrap"><table><thead><tr><th>Blocker</th><th>Workfront / WBS</th><th>Affected activities</th><th>Milestones exposed</th><th>Required by</th><th>Owner</th><th>Action</th></tr></thead><tbody>'+interventions.slice(0,20).map(row=>'<tr><td><b>'+escapeHtml(humanizeKey(row.blockerType))+'</b></td><td>'+escapeHtml(row.wbsPath||row.wbsId||'Project scope')+'</td><td>'+escapeHtml(fmt(row.activityCount))+'<br><span class="muted">'+escapeHtml((row.activityIds||[]).slice(0,5).join('; '))+((row.activityIds||[]).length>5?' · '+escapeHtml(fmt(row.activityIds.length-5))+' more':'')+'</span></td><td>'+escapeHtml((row.affectedMilestoneIds||[]).join('; ')||'No downstream milestone identified in the programme logic')+'</td><td>'+escapeHtml(row.requiredByIso?planningShortDate(row.requiredByIso):'Not established')+'</td><td>'+escapeHtml(row.owner||'Not established in linked evidence')+'</td><td>'+escapeHtml(row.action)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="notice info">No confirmed blocker is identified inside the forward look-ahead. Evidence gaps remain visible in the readiness matrix.</div>';
  const backlogHtml=backlogRows.length?'<div class="table-wrap"><table><thead><tr><th>Overdue activity</th><th>WBS</th><th>Overdue basis</th><th>Required date</th><th>Start overdue days</th><th>Finish overdue days</th><th>Readiness</th><th>Milestones exposed</th></tr></thead><tbody>'+backlogRows.slice(0,30).map(row=>{const startOverdue=row.missedPlannedStart===true||row.classification==="missed_start",finishOverdue=row.finishOverdue===true||row.classification==="overdue";const basis=startOverdue&&finishOverdue?'Start and finish overdue':finishOverdue?'Finish overdue':'Start overdue';const overdueDays=(known,days)=>known&&typeof days==="number"?fmt(Math.max(0,-days)):'—';return '<tr><td><b>'+escapeHtml(row.activityId)+'</b><br>'+escapeHtml(row.name||'')+'</td><td>'+escapeHtml(row.wbsPath||row.wbsId||'—')+'</td><td>'+escapeHtml(basis)+'</td><td>'+escapeHtml(planningShortDate(finishOverdue?row.finishIso:row.startIso))+'</td><td>'+escapeHtml(overdueDays(startOverdue,row.daysToStart))+'</td><td>'+escapeHtml(overdueDays(finishOverdue,row.daysToFinish))+'</td><td>'+escapeHtml(row.readiness?.state==="blocked"?'Known blocker':row.readiness?.state==="conditional"?'Evidence gaps':'No blocker established')+'</td><td>'+escapeHtml((row.affectedMilestoneIds||[]).join('; ')||'—')+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="notice info">No overdue-start or overdue-finish backlog is identified from the current programme dates.</div>';
  return '<section class="planning-view lookahead-view">'+kpis+
    managementPanel("Forward-window interventions","Blockers are grouped by workfront/WBS before the detailed activity matrix. Owners are shown only when the linked evidence establishes them.",interventionHtml,true)+
    managementPanel("Overdue backlog","Work already overdue at the Data Date is controlled separately from the configured forward look-ahead.",backlogHtml)+
    coverageHtml+interfaceHtml+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>6-week execution view · forward window</h4><p>Configured horizon: '+escapeHtml(fmt(p.windowDays))+' calendar days. Showing current/upcoming activities only; overdue backlog is controlled separately above.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness position</h4><p>A known blocker is different from missing readiness evidence.</p></div></div><div class="planning-panel-body">'+readiness+'<div class="coverage-line"><span>Date coverage</span><b>'+escapeHtml(p.currentDateCoveragePercent===null?"—":fmt(p.currentDateCoveragePercent)+"%")+'</b></div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Why work is blocked</h4><p>Explicit blocker occurrences. Predecessor checks assess relationship anchors, working-calendar lag and submitted date fit; unfinished work alone is not a blocker.</p></div></div><div class="planning-panel-body">'+blockers+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness matrix</h4><p>All activities in the window. Search an activity, deliverable or package. Open a cell to read its source date and reason.</p></div></div><div class="planning-panel-body"><label class="register-search">Find a readiness record <input type="search" data-register-filter placeholder="Activity, deliverable, package or reason" aria-label="Filter readiness records"></label><span class="register-search-count" aria-live="polite">'+fmt(watch.length)+' activities</span><div class="table-wrap readiness-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Overall</th>'+dimensions.map(key=>'<th>'+escapeHtml(labels[key])+'</th>').join("")+'</tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderMonteCarloRiskVisual(data){
  const p=projectionFor(data,"schedule_risk_monte_carlo");
  if(!p||p.state==="unavailable")return '<section class="planning-view"><div class="notice warn"><b>Schedule risk simulation is not yet available.</b><p>'+escapeHtml(data?.reason||"Complete the deterministic schedule basis and remaining durations first.")+'</p></div></section>';
  const confidence=p.confidence||[];
  const percentile=name=>confidence.find(row=>row.percentile===name)?.completionIso??null;
  const drivers=(p.riskDrivers||[]).slice(0,20);
  const driverRows=drivers.map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(row.wbsId||"—")+'</td><td>'+escapeHtml(row.criticalityIndexPercent===null?"Unresolved":fmt(row.criticalityIndexPercent)+"%")+'</td><td>'+escapeHtml(row.remainingDurationHours===null?"—":fmt(row.remainingDurationHours)+" h")+'</td><td>'+escapeHtml(row.sourceTotalFloatHours===null?"—":fmt(row.sourceTotalFloatHours)+" h")+'</td><td>'+escapeHtml(fmt(row.linkedOpenRiskCount||0))+'</td></tr>').join("");
  const hist=(p.histogram||[]).map(row=>({dateIso:row.weekStartIso,count:row.count}));
  const probability=p.finishByRequiredDateProbabilityPercent;
  const uncertainty=p.uncertainty||{},sourceCovered=Number(uncertainty.sourceCoveredActivityCount||0),defaults=Number(uncertainty.scenarioDefaultActivityCount??p.uncertainActivityCount??0);
  const scenario='<div class="notice '+(defaults?"warn":"info")+'"><b>Schedule-risk simulation, not an official forecast.</b> '+(sourceCovered?escapeHtml(fmt(sourceCovered))+' activities use explicit source uncertainty ranges. ':'')+(defaults?escapeHtml(fmt(defaults))+' activities use scenario-default triangular factors '+escapeHtml(fmt(uncertainty.minFactor))+' / '+escapeHtml(fmt(uncertainty.modeFactor))+' / '+escapeHtml(fmt(uncertainty.maxFactor))+'. ':'')+(uncertainty.correlationGroupCount?escapeHtml(fmt(uncertainty.correlationGroupCount))+' explicit correlation groups are applied. ':'No explicit correlation group is established; ungrouped activities are sampled independently. ')+'Deterministic CPM remains the current schedule authority.</div>';
  return '<section class="planning-view monte-carlo-view">'+planningKpis([
    ["Deterministic finish",planningShortDate(p.deterministicFinishIso),"canonical CPM"],
    ["P50",planningShortDate(percentile("P50")),"scenario completion"],
    ["P80",planningShortDate(percentile("P80")),"scenario completion"],
    ["P90",planningShortDate(percentile("P90")),"scenario completion"],
    ["Required finish",planningShortDate(p.requiredFinishIso),"contract basis if established"],
    ["Probability ≤ required",probability===null?"Unresolved":fmt(probability)+"%","scenario only"],
    ["Iterations",p.iterationsCompleted,fmt(p.failedIterations||0)+" failed"],
    ["Uncertain activities",p.uncertainActivityCount,fmt(p.activityPopulation)+" execution activities"],
    ["Source uncertainty coverage",uncertainty.coveragePercent===null||uncertainty.coveragePercent===undefined?"0%":fmt(uncertainty.coveragePercent)+"%",sourceCovered+" source · "+defaults+" scenario default"],
    ["Correlation groups",uncertainty.correlationGroupCount||0,"explicit source groups only"]
  ])+scenario+
  '<div class="planning-primary-grid">'+
    renderVisualPanel("Completion distribution","Successful activity-by-activity network simulations grouped by completion week.",renderLineChart(hist,[{key:"count",label:"Simulations",tone:"accent"}],null,{unit:"runs",yLabel:"Runs",xLabel:"Completion week"}))+
    renderVisualPanel("Confidence dates","Percentile completion dates from the same simulation population.",basisTable(["Confidence","Completion"],confidence.map(row=>[row.percentile,planningShortDate(row.completionIso)])))+
  '</div>'+
  '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Schedule risk drivers</h4><p>Activities ranked by simulated criticality index. Linked risk-register records are context only; qualitative risk ratings are not converted into duration impacts.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>WBS</th><th>Criticality index</th><th>Remaining duration</th><th>Source float</th><th>Linked open risks</th></tr></thead><tbody>'+driverRows+'</tbody></table></div></div></section>'+
  '<details class="source-scope"><summary>Simulation assumptions and limitations</summary><ul>'+(p.assumptions||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ul><p>'+escapeHtml(p.riskRegister?.basis||"")+'</p></details></section>';
}
function forecastDiagnosticMessages(codes){
  const diagnostics=(Array.isArray(codes)?codes:[]).filter(code=>typeof code==="string");
  const labels={
    CALENDAR_SEMANTICS_UNRESOLVED:"Programme calendar definition does not sufficiently establish working days, shifts or exceptions.",
    CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:"Programme calendar work pattern is not sufficiently defined.",
    SCHEDULE_GRAPH_CYCLES:"Schedule logic contains a cycle/circular relationship.",
    SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:"The programme contains duplicate activity IDs.",
    SCHEDULE_GRAPH_SELF_LOOPS:"The programme contains a self-referencing relationship.",
    SCHEDULE_GRAPH_BROKEN_PREDECESSORS:"A relationship references a predecessor that is not present in the programme.",
    CPM_ACTIVITY_CALENDAR_UNRESOLVED:"An activity cannot be recalculated because its source calendar is unresolved.",
    CPM_DURATION_RAW_UNSUPPORTED:"A source duration value cannot be used by the CPM calculation.",
    CPM_DAY_DURATION_REQUIRES_UNIFORM_CALENDAR_DAY_HOURS:"A day-based duration cannot be converted because working hours per day are not established.",
    CPM_WEEK_DURATION_REQUIRES_CALENDAR_WEEK_HOURS:"A week-based duration cannot be converted because working hours per week are not established.",
    CPM_DURATION_UNIT_UNKNOWN:"A source activity duration unit is unknown.",
    CPM_REMAINING_DURATION_UNRESOLVED:"CPM remaining duration cannot be established for an activity.",
    CPM_RELATIONSHIP_TYPE_UNRESOLVED:"A schedule relationship type cannot be established.",
    CPM_RELATIONSHIP_LAG_UNRESOLVED:"A schedule relationship lag cannot be established.",
    CPM_EXTERNAL_RELATIONSHIP_UNRESOLVED:"An external relationship cannot be resolved inside the current programme.",
    CPM_RELATIONSHIP_UNRESOLVED:"A schedule relationship cannot be resolved for the CPM calculation.",
    CPM_PROJECT_START_UNRESOLVED:"The CPM project start cannot be established.",
    CPM_NETWORK_NOT_CALCULABLE:"The schedule network cannot be recalculated from the current source inputs.",
    CPM_RELATIONSHIP_ENDPOINT_UNRESOLVED:"A schedule relationship endpoint cannot be resolved.",
    CPM_COMPLETED_ACTIVITY_FINISH_UNRESOLVED:"A completed activity does not have a usable actual finish.",
    CPM_PREDECESSOR_TIMING_UNRESOLVED:"A predecessor timing position cannot be resolved.",
    CPM_UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE:"An unknown activity status is retained as incomplete for calculation.",
    CPM_ACTIVITY_UNRESOLVED:"An activity cannot be fully recalculated.",
    CPM_COMPLETED_ACTIVITY_FLOAT_NOT_RECALCULATED:"Float is not recalculated for a completed activity.",
    CPM_LATE_PASS_UNRESOLVED:"The CPM late-pass calculation cannot be completed for an activity."
  };
  const grouped=new Map();
  for(const code of diagnostics){
    const key=String(code).split(":")[0];
    if(!labels[key])continue;
    const group=grouped.get(key)||{count:0,examples:[]};group.count++;
    const suffix=String(code).includes(":")?String(code).slice(String(code).indexOf(":")+1):"";
    if(suffix&&group.examples.length<5&&!/[A-Z]{3,}_[A-Z0-9_]+/.test(suffix))group.examples.push(suffix);
    grouped.set(key,group);
  }
  return [...grouped.entries()].map(([key,group])=>labels[key]+(group.count>1?" ("+fmt(group.count)+" occurrences)":"")+(group.examples.length?" Affected: "+group.examples.join(", ")+".":""));
}
function renderForecastVisual(data){
  const p=projectionFor(data,"independent_forecast");
  if(!("independentForecastCompletionIso" in p))return"";
  const taxonomy=p.forecastTaxonomy||{};
  const gate=p.forecastReconciliationGate||{publishable:false,checks:[],reason:p.managementReviewReason||"Forecast reconciliation is not established.",basis:""};
  const rawProb=p.probabilistic||{};
  const probAvailable=rawProb.status==="available";
  const positions=[
    taxonomy.contractualCompletion||{label:"Contractual completion",completionIso:p.requiredFinishIso,state:p.requiredFinishIso?"established":"not_established"},
    taxonomy.contractorProgramme||{label:"Contractor programme forecast",completionIso:p.sourceForecastCompletionIso,state:p.sourceForecastCompletionIso?"established":"missing"},
    taxonomy.cmengCpm||{label:"CMeng CPM/network recalculation",completionIso:p.independentForecastCompletionIso,state:p.complete?"calculated":"review_required"},
    taxonomy.sourceProductivity||{label:"Source productivity forecast",completionIso:p.sourceProductivityForecastCompletionIso,state:p.sourceProductivityForecastState||"not_established"},
    taxonomy.independentEvidenceBased||{label:"Independent evidence-based forecast",completionIso:null,state:"not_established"},
    taxonomy.scenarioRecovery||{label:"Scenario/recovery forecast",completionIso:null,state:"not_established"}
  ];
  const managementForecast=p.managementForecastCompletionIso||null;
  const kpis=planningKpis([
    ["Management analytical forecast",managementForecast?planningShortDate(managementForecast):"Withheld",managementForecast?"all six reconciliation checks passed":"raw CPM result remains visible below; management publication gate not passed",managementForecast?"success":"warning"],
    ["CPM activity coverage",p.activityCoveragePercent===null?"Unresolved":fmt(p.activityCoveragePercent)+"%",fmt(p.calculatedActivityCount)+" calculated · "+fmt(p.unresolvedActivityCount)+" unresolved",p.unresolvedActivityCount?"warning":""],
    ["Submitted vs CPM",p.forecastVarianceDays===null?"Unresolved":(p.forecastVarianceDays>0?"+":"")+fmt(p.forecastVarianceDays)+" d","model comparison only; not delay"],
    ["Required finish",planningShortDate(taxonomy.contractualCompletion?.completionIso||p.requiredFinishIso),"contractual/required authority if established"]
  ]);
  const positionRows=positions.map(row=>'<tr><td><b>'+escapeHtml(row.label)+'</b></td><td>'+escapeHtml(row.completionIso?planningShortDate(row.completionIso):"Not established")+'</td><td>'+escapeHtml(humanizeKey(row.state||"not_established"))+'</td><td>'+escapeHtml(humanizeKey(row.authority||"not_established"))+'</td><td>'+escapeHtml(row.basis||"")+'</td></tr>').join("");
  const taxonomyTable='<div class="table-wrap"><table><thead><tr><th>Forecast position</th><th>Completion</th><th>State</th><th>Authority</th><th>Basis / limitation</th></tr></thead><tbody>'+positionRows+'</tbody></table></div>';
  const dateLadder=planningDateLadder(positions.filter(row=>row.completionIso).map((row,index)=>({label:row.label,date:row.completionIso,tone:["baseline","current","cmeng","scenario","accent","warning"][index]})),p.dataDateIso);
  const gateRows=(gate.checks||[]).map(check=>'<tr><td><b>'+escapeHtml(check.label)+'</b></td><td><span class="state-pill '+(check.state==="passed"?"ready":"review")+'">'+escapeHtml(humanizeKey(check.state))+'</span></td><td>'+escapeHtml(check.count===null?"—":fmt(check.count))+'</td><td>'+escapeHtml(check.detail)+'</td></tr>').join("");
  const gatePanel='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Management forecast reconciliation gate</h4><p>Calendar coverage, graph validity, source constraints, calculation coverage, material activity divergence and required-finish authority are checked independently. A matching Project finish cannot override an internal failure.</p></div><span class="badge '+(gate.publishable?"ready":"partial")+'">'+escapeHtml(gate.publishable?"Publishable":"Review required")+'</span></div><div class="planning-panel-body">'+(gateRows?'<div class="table-wrap"><table><thead><tr><th>Check</th><th>State</th><th>Count</th><th>Management meaning</th></tr></thead><tbody>'+gateRows+'</tbody></table></div>':'<div class="notice warn">Forecast reconciliation checks are not established.</div>')+'<p class="muted">'+escapeHtml(gate.basis||"")+'</p></div></section>';
  const constraintTrace=p.sourceConstraints?.length?'<details class="notice info"><summary>'+escapeHtml(fmt(p.sourceConstraints.length))+' activities have retained source constraints</summary><p>These constraints are preserved, but the current CPM/network recalculation does not apply them. Their effect must be reconciled before management publication.</p><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Constraint</th><th>Date</th></tr></thead><tbody>'+p.sourceConstraints.flatMap(a=>(a.constraints||[]).map(c=>'<tr><td>'+escapeHtml(a.activityId)+'</td><td>'+escapeHtml(c.type)+'</td><td>'+escapeHtml(c.dateIso||"Unresolved")+'</td></tr>')).join("")+'</tbody></table></div></details>':'';
  const diagnosticMessages=forecastDiagnosticMessages(p.diagnostics||[]);
  const diagnosticSummary=diagnosticMessages.length?'<ul>'+diagnosticMessages.map(message=>'<li>'+escapeHtml(message)+'</li>').join("")+'</ul>':'<p>No translated CPM/calendar exception is identified by the checked calculation.</p>';
  const technical='<details><summary>Additional technical calculation evidence</summary><p>Untranslated source calculation codes remain in the downloadable calculation data rather than primary management copy.</p></details>';
  const forecastDrivers=(p.activities||[]).filter(row=>typeof row.finishVarianceDays==="number").sort((a,b)=>Math.abs(b.finishVarianceDays)-Math.abs(a.finishVarianceDays)).slice(0,20);
  const driverRows=forecastDrivers.map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b></td><td>'+escapeHtml(planningShortDate(row.sourceFinishIso))+'</td><td>'+escapeHtml(planningShortDate(row.independentEarlyFinishIso))+'</td><td>'+escapeHtml((row.finishVarianceDays>0?"+":"")+fmt(row.finishVarianceDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.calendarMode))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td></tr>').join("");
  const diagnosticPanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>CPM reconciliation evidence</h4><p>Business-language diagnostics are shown first. Raw technical codes remain in supporting detail.</p></div></div><div class="planning-panel-body">'+diagnosticSummary+constraintTrace+technical+(driverRows?'<details><summary>Largest activity finish divergences</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Submitted finish</th><th>CPM recalculation</th><th>Difference</th><th>Calendar</th><th>State</th></tr></thead><tbody>'+driverRows+'</tbody></table></div></details>':'')+'</div></section>';
  const review=p.managementReviewState==="review_required"||gate.publishable===false;
  const positionBars=[
    {label:"Contractor programme",value:planningCalendarDaysBetween(p.dataDateIso,p.sourceForecastCompletionIso),tone:"current"},
    {label:"CMeng CPM/network recalculation",value:planningCalendarDaysBetween(p.dataDateIso,p.independentForecastCompletionIso),tone:"cmeng"},
    {label:"Source productivity forecast",value:planningCalendarDaysBetween(p.dataDateIso,p.sourceProductivityForecastCompletionIso),tone:"scenario"},
    {label:"Required finish",value:planningCalendarDaysBetween(p.dataDateIso,p.requiredFinishIso),tone:"baseline"}
  ].filter(row=>row.value!==null);
  const probabilityDistance=[
    {label:"P50 vs CMeng CPM",value:review?null:planningCalendarDaysBetween(p.independentForecastCompletionIso,rawProb.p50CompletionIso),tone:"warning"},
    {label:"P80 vs CMeng CPM",value:review?null:planningCalendarDaysBetween(p.independentForecastCompletionIso,rawProb.p80CompletionIso),tone:"warning"},
    {label:"P90 vs CMeng CPM",value:review?null:planningCalendarDaysBetween(p.independentForecastCompletionIso,rawProb.p90CompletionIso),tone:"warning"}
  ];
  const visualOverview='<details><summary>Alternative forecast-distance charts</summary><div class="visual-chart-grid">'+
    renderVisualPanel("Completion distance from Data Date","Calendar-day distance only; each authority remains separate.",renderVisualBars(positionBars,"d"))+
    renderVisualPanel("Sensitivity distance from CMeng CPM","Sensitivity is withheld when the independent calculation requires reconciliation.",renderVisualBars(probabilityDistance,"d"))+
    '</div></details>';
  const sensitivity=review?'<div class="notice info">P50, P80 and P90 are withheld until the independent calculation is reconciled for management use.</div>':probAvailable?'<div class="position-grid">'+[
    ["P50 duration sensitivity",planningShortDate(rawProb.p50CompletionIso)],
    ["P80 duration sensitivity",planningShortDate(rawProb.p80CompletionIso)],
    ["P90 duration sensitivity",planningShortDate(rawProb.p90CompletionIso)]
  ].map(row=>'<div class="position-card"><div class="position-label">'+escapeHtml(row[0])+'</div><div class="position-value">'+escapeHtml(row[1])+'</div><div class="position-sub">Non-official duration-factor sensitivity; not one of the six forecast authorities.</div></div>').join("")+'</div>':'<div class="notice info">P50/P80/P90 sensitivity is not available on the current reconciled calculation basis.</div>';
  const reviewWarning=review?'<div class="notice warn"><b>Independent forecast requires reconciliation before management use.</b><p>'+escapeHtml(gate.reason||p.managementReviewReason||"Complete the forecast reconciliation checks before publishing a management forecast.")+'</p></div>':'';
  return '<section class="planning-view independent-forecast-view">'+reviewWarning+kpis+
    '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Forecast taxonomy</h4><p>The six forecast positions remain separate. CMeng CPM/network recalculation is schedule-only and never implies BOQ, productivity, manpower or procurement evidence it does not use.</p></div></div><div class="planning-panel-body">'+taxonomyTable+dateLadder+'</div></section>'+
    gatePanel+visualOverview+
    '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Probabilistic / duration sensitivity</h4><p>Separate non-official sensitivity. It does not replace the six forecast authorities.</p></div></div><div class="planning-panel-body">'+sensitivity+'</div></section>'+
    diagnosticPanel+
  '</section>';
}
function renderWindowsVisual(data){
  const p=projectionFor(data,"windows_analysis");if(!Array.isArray(p.windows))return"";
  const programmeContextHtml=typeof renderDelayProgrammeContext==="function"?renderDelayProgrammeContext(data):"";
  const evidenceChainHtml=typeof renderDelayEvidenceChain==="function"?renderDelayEvidenceChain(data):"";
  const labels=p.revisionLabels||{},availability=data?.featureAvailability||p.featureAvailability||null;
  if(availability&&availability.state!=="active"&&!p.windows.length)return '<section class="planning-view windows-view"><div class="notice info"><b>Delay-window analysis is not yet applicable.</b><p>Window analysis not yet available — another comparable programme revision is required.</p><p>'+escapeHtml(availability.reason||"At least two comparable programme revisions are required.")+'</p></div>'+programmeContextHtml+evidenceChainHtml+'</section>';
  const bars=p.windows.map(w=>{const value=w.sourceForecastMovementDays??w.scheduleBoundaryMovementDays??null;return {label:"Window "+w.sequence,value,tone:value===null?"neutral":value>0?"danger":value<0?"success":"neutral"}});
  const cards=p.windows.map(w=>{const sourceMove=w.sourceForecastMovementDays??w.scheduleBoundaryMovementDays,independent=w.independentForecastMovementDays,from=shortRevision(w.fromRevisionId,labels),to=shortRevision(w.toRevisionId,labels);return '<div class="window-card clean"><div><div class="window-id">Window '+escapeHtml(w.sequence)+' · '+escapeHtml(from)+' → '+escapeHtml(to)+'</div><div class="window-dates">'+escapeHtml(planningShortDate(w.windowStartIso))+' → '+escapeHtml(planningShortDate(w.windowEndIso))+'</div></div><div><div class="movement-label">Submitted forecast movement</div><div class="movement-value">'+escapeHtml(sourceMove===null?"—":(sourceMove>0?"+":"")+fmt(sourceMove)+" days")+'</div><div class="muted">Progress movement '+escapeHtml(w.progressMovementPercent===null?"—":(w.progressMovementPercent>0?"+":"")+fmt(w.progressMovementPercent)+" pp")+'</div></div><div><div class="movement-label">Programme calendar recalculation movement</div><div class="movement-value small">'+escapeHtml(independent===null?"Not calculated in this view":(independent>0?"+":"")+fmt(independent)+" days")+'</div><div class="muted">'+escapeHtml((w.delayEvents||[]).length+" temporally associated event(s)")+'</div></div></div>';}).join("");
  const note='<div class="notice info"><b>Analytical movement, submitted window movement and Project Completion movement are different measures.</b> None is automatically delay entitlement or EOT.</div>';
  return '<section class="planning-view windows-view">'+programmeContextHtml+planningKpis([
    ["Windows",p.windowCount,"established revision intervals"],["Schedule-comparison windows",p.completeWindowCount,"calculation complete; causation unproven"],["Partial windows",p.partialWindowCount,"",p.partialWindowCount?"warning":""],
    ["Gross analytical movement",p.grossAnalyticalMovementDays==null?"Not established":fmt(p.grossAnalyticalMovementDays)+" d","independent recalculation; not project delay or EOT"],
    ["Positive submitted window movement",p.positiveProgrammeMovementDays==null?"Not established":fmt(p.positiveProgrammeMovementDays)+" d","sum of positive submitted completion shifts"],
    ["Project Completion movement",p.projectCompletionMovementDays==null?"Not established":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net first-to-latest submitted completion"],
    ["Window-associated events",p.windows.reduce((sum,w)=>sum+(w.delayEvents||[]).length,0),"established temporal references only"]
  ])+note+evidenceChainHtml+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme movement by window</h4><p>Source forecast movement is shown first. It is schedule movement, not automatic delay entitlement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(bars,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window detail</h4></div></div><div class="planning-panel-body"><div class="window-strip">'+cards+'</div></div></section></section>';
}
function delayClaimsProjectionFor(data){
  const direct=projectionFor(data,"delay_claims");
  if(
    direct &&
    typeof direct==="object" &&
    (
      Array.isArray(direct.events) ||
      typeof direct.eventCount==="number" ||
      typeof direct.claimCount==="number"
    )
  )return direct;
  const queue=[{value:data,depth:0}],seen=new Set();
  while(queue.length){
    const item=queue.shift(),value=item?.value,depth=item?.depth??0;
    if(!value||typeof value!=="object"||Array.isArray(value)||seen.has(value))continue;
    seen.add(value);
    if(
      value.projectionKey==="delay_claims" ||
      (
        typeof value.eventCount==="number" &&
        typeof value.claimCount==="number" &&
        (
          Array.isArray(value.events) ||
          typeof value.activityLinkedEventCount==="number"
        )
      )
    )return value;
    if(depth>=3)continue;
    Object.values(value).forEach(child=>{
      if(child&&typeof child==="object"&&!Array.isArray(child))queue.push({value:child,depth:depth+1});
    });
  }
  return direct||data||{};
}
function renderDelayProgrammeContext(data){
  const chain=data?.delayEotEvidenceChain||null,context=chain?.programmeContext||data?.contextualProgrammeIntelligence||null;
  if(!context)return "";
  const movement=context.projectCompletionMovementDays,rows=Array.isArray(context.pressureRows)?context.pressureRows:[];
  const detail=rows.length?'<details class="source-scope"><summary>Review '+escapeHtml(fmt(rows.length))+' leading programme-pressure activities</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>WBS</th><th>Baseline finish</th><th>Current / forecast finish</th><th>Movement</th><th>Float</th></tr></thead><tbody>'+rows.map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(row.wbsId||"—")+'</td><td>'+escapeHtml(row.baselineFinishIso?planningShortDate(row.baselineFinishIso):"—")+'</td><td>'+escapeHtml(planningShortDate(row.forecastFinishIso||row.currentFinishIso))+'</td><td>'+escapeHtml(row.varianceDays===null?"—":(row.varianceDays>0?"+":"")+fmt(row.varianceDays)+" d")+'</td><td>'+escapeHtml(row.totalFloatHours===null?"—":fmt(row.totalFloatHours)+" h")+'</td></tr>').join("")+'</tbody></table></div></details>':"";
  return '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Best available programme context</h4><p><b>Schedule pressure is contextual programme intelligence, not a contractual delay event.</b> It remains visible even when a formal delay-event register is absent, incomplete or quarantined.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Project Completion movement",movement===null||movement===undefined?"Not established":(movement>0?"+":"")+fmt(movement)+" d","net submitted first-to-latest movement"],
    ["Delayed activities",fmt(context.delayedActivityCount??0),"baseline-to-current/forecast schedule pressure"],
    ["Negative-float activities",fmt(context.negativeFloatActivityCount??0),"programme pressure; not contractual responsibility"],
    ["Pressured milestones",fmt(context.pressuredMilestoneCount??0),"late and/or non-positive-float milestones"],
    ["Comparable revisions",fmt(context.revisionCount??0),"controlled schedule states"],
    ["Analytical windows",fmt(context.windowCount??0),"window availability; causation separate"]
  ])+detail+'</div></section>';
}
function renderDelayEvidenceChain(data){
  const chain=data?.delayEotEvidenceChain||null;if(!chain)return "";
  const order=Array.isArray(chain.linkOrder)?chain.linkOrder:[],rows=Array.isArray(chain.rows)?chain.rows:[];
  if(!rows.length)return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Delay / EOT evidence chain</h4><p>Event → Notice → Activity → Window → Impact → Responsibility → EOT → Determination</p></div></div><div class="planning-panel-body"><div class="notice info">No event-level contractual chain is established. Population state: <b>'+escapeHtml(humanizeKey(chain.populationState||"missing"))+'</b>. Programme context remains visible separately and is not promoted into a contractual delay event.</div></div></section>';
  const pill=link=>'<span class="state-pill '+(link.state==="established"?"ready":link.state==="candidate"?"not_applicable":link.state==="quarantined"||link.state==="conflicted"?"blocked":"review")+'">'+escapeHtml(humanizeKey(link.state))+'</span>';
  const header=order.map(key=>'<th>'+escapeHtml(humanizeKey(key))+'</th>').join("");
  const body=rows.map(row=>'<tr><td><b>'+escapeHtml(row.eventId)+'</b><br><span class="muted">'+escapeHtml(row.title||"")+'</span></td>'+order.map(key=>{const link=(row.links||[]).find(item=>item.key===key);return '<td>'+(link?pill(link)+'<br><span class="muted">'+escapeHtml(link.value===null||link.value===undefined?"—":fmt(link.value))+'</span>':'—')+'</td>';}).join("")+'</tr>').join("");
  return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Canonical Delay / EOT evidence chain</h4><p>Event → Notice → Activity → Window → Impact → Responsibility → EOT → Determination. Schedule association and programme movement never become causation or entitlement by implication.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Event</th>'+header+'</tr></thead><tbody>'+body+'</tbody></table></div></div></section>';
}

function renderTenderReadinessVisual(data){
  const p=projectionFor(data,"tender_readiness");
  if(!Array.isArray(p.criteria))return "";
  const kpis=planningKpis([
    ["Established criteria",p.establishedCount,"of "+fmt(p.criterionCount)+" default evidence criteria"],
    ["Partial / unresolved",p.unresolvedCount,"criteria not yet fully evidenced",p.unresolvedCount?"warning":""],
    ["Evidence coverage",p.evidenceCoveragePercent===null||p.evidenceCoveragePercent===undefined?"Unresolved":fmt(p.evidenceCoveragePercent)+"%","evidence coverage only; not a tender score"],
    ["Weighted tender score","Not calculated","No governed criterion weights or pass threshold are invented"]
  ]);
  const rows=p.criteria.map(row=>'<tr><td><b>'+escapeHtml(row.criterion)+'</b></td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(row.availableEvidence||"Not established")+'</td><td>'+escapeHtml(row.gap||"—")+'</td><td>'+escapeHtml(row.owner||"Not assigned")+'</td><td>'+escapeHtml(row.criteriaAuthority||p.criteriaAuthority||"Not established")+'</td></tr>').join("");
  return '<section class="planning-view tender-readiness-view">'+
    '<div class="notice info"><b>Tender Readiness is evidence coverage, not a bid/no-bid score.</b> '+escapeHtml(p.basis||"")+'</div>'+
    kpis+
    '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Tender readiness evidence matrix</h4><p>Available evidence is shown first. Missing or partial criteria remain explicit and do not erase the established criteria.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Criterion</th><th>State</th><th>Available evidence</th><th>Gap</th><th>Owner</th><th>Criteria authority</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>'+
  '</section>';
}
function renderDelayClaimsVisual(data){
  const programmeContextHtml=typeof renderDelayProgrammeContext==="function"?renderDelayProgrammeContext(data):"";
  const evidenceChainHtml=typeof renderDelayEvidenceChain==="function"?renderDelayEvidenceChain(data):"";
  const p=delayClaimsProjectionFor(data),chain=data?.delayEotEvidenceChain||p.delayEotEvidenceChain||null,integrity=p.claimPopulationIntegrity||p.integrity||null;
  const quarantined=chain?.populationState==="quarantined"||integrity?.state==="quarantined";
  const sourcePopulationEstablished=chain?chain.populationState==="established":(p.contractorClaimEvidenceSubmitted===true&&!quarantined);
  const reporting=data?.claimsReporting||null,withheld=quarantined?"Withheld — source population quarantined":"Not established";
  const sourceEventCount=sourcePopulationEstablished?(reporting?.events?.population?.sourceCount??reporting?.events?.source?.length??p.eventCount??0):null;
  const currentEventCount=sourcePopulationEstablished?(reporting?.events?.asOf?.length??p.eventCount??0):null;
  const futureEventCount=sourcePopulationEstablished?(reporting?.events?.future?.length??0):null;
  const undatedEventCount=sourcePopulationEstablished?(reporting?.events?.undated?.length??0):null;
  const events=Array.isArray(p.events)?p.events:[],linkedClaimIds=new Set(events.flatMap(event=>event.linkedClaimIds||[]));
  const linked=!sourcePopulationEstablished?null:(p.linkedClaimCount??linkedClaimIds.size),unlinked=!sourcePopulationEstablished?null:(p.unlinkedClaimCount??Math.max(0,(p.claimCount||0)-(linked||0)));
  const activityGapCount=!sourcePopulationEstablished?null:(p.activityEvidenceInsufficientEventCount??events.filter(e=>(e.relatedActivityIds||[]).length===0).length);
  const incompleteDeterminationCount=!sourcePopulationEstablished?null:(p.determinationChainIncompleteEventCount??events.filter(e=>e.evidenceChainState==="determination_chain_incomplete").length);
  const movementEstablished=p.windowCount>0&&typeof p.observedPositiveProgrammeMovementDays==="number",populationValue=value=>sourcePopulationEstablished?value:withheld;
  const kpis=planningKpis([
    ["Current delay events",populationValue(currentEventCount),"evidenced contractual event population"],["Source delay-event rows",populationValue(sourceEventCount),"retained contractual event population"],["After Data Date",populationValue(futureEventCount),"retained outside current position"],["Event date missing",populationValue(undatedEventCount),"retained but excluded from current position"],
    ["Claims",quarantined?"Under review":p.contractorClaimEvidenceSubmitted===false&&p.claimCount===0?"Not established":p.claimCount,quarantined?"source population quarantined":"claim records",quarantined?"warning":""],
    ...(quarantined?[["Quarantined source claim rows",integrity?.quarantinedClaimCount??chain?.quarantinedClaimCount,"retained for audit; excluded from management truth","warning"]]:[]),
    ["Claims linked to events",linked===null?withheld:linked,"identity association; causation unproven"],["Claims without event links",unlinked===null?withheld:unlinked,"identity gap; linked claims still need causation"],
    ["Events linked to activities",populationValue(sourcePopulationEstablished?(p.activityLinkedEventCount??0):null),"schedule linkage"],["Activity evidence gaps",activityGapCount===null?withheld:activityGapCount,"fail-closed source gaps"],
    ["Events linked to windows",populationValue(sourcePopulationEstablished?(p.windowLinkedEventCount??0):null),"temporal association; not causation"],["Events with register notice references",populationValue(sourcePopulationEstablished?(p.noticeLinkedEventCount??0):null),"notice identity"],["Determined events",populationValue(sourcePopulationEstablished?(p.determinationLinkedEventCount??0):null),"Engineer determination linkage"],["Incomplete determination chains",incompleteDeterminationCount===null?withheld:incompleteDeterminationCount,"required links missing"],
    ["Positive submitted window movement",movementEstablished?fmt(p.observedPositiveProgrammeMovementDays)+" d":"Not established","programme movement; not event attribution"],["Project Completion movement",!movementEstablished||p.projectCompletionMovementDays==null?"Not established":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net submitted completion movement"]
  ]);
  const warning=quarantined?'<div class="notice error"><b>Claim source integrity gate: '+escapeHtml(fmt(integrity?.quarantinedClaimCount??chain?.quarantinedClaimCount))+' source rows are quarantined.</b> Contractual delay-event, notice, linkage and entitlement counts are withheld rather than presented as zero until the population is verified.</div>':!sourcePopulationEstablished?'<div class="notice info"><b>No delay-event / claim source population is established.</b> Programme intelligence remains available below, but schedule pressure is not converted into a contractual delay event.</div>':'';
  const rows=events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br>'+escapeHtml(e.title||"")+'</td><td>'+escapeHtml(humanizeKey(e.responsibility))+'</td><td>'+escapeHtml((e.relatedActivityIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.overlappingWindowIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.noticeIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.determinationIds||[]).join(", ")||"—")+'</td></tr>').join("");
  const detail=events.length?'<div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Activities</th><th>Windows</th><th>Notices</th><th>Determinations</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-visual">No contractual delay-event population is established. Claim records and schedule pressure are not converted into delay events.</div>';
  return '<section class="planning-view delay-claims-view">'+programmeContextHtml+kpis+warning+evidenceChainHtml+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Delay-event detail</h4></div></div><div class="planning-panel-body">'+detail+'</div></section></section>';
}
function renderEotVisual(data){
  const p=projectionFor(data,"eot_assessment");if(!Array.isArray(p.windowCandidates))return"";
  const programmeContextHtml=typeof renderDelayProgrammeContext==="function"?renderDelayProgrammeContext(data):"";
  const evidenceChainHtml=typeof renderDelayEvidenceChain==="function"?renderDelayEvidenceChain(data):"";
  const chain=data?.delayEotEvidenceChain||p.delayEotEvidenceChain||null,chainRows=Array.isArray(chain?.rows)?chain.rows:[];
  const linkState=(row,key)=>row?.links?.find(link=>link.key===key)?.state||"missing",anyLink=(key,states=["established"])=>chainRows.some(row=>states.includes(linkState(row,key)));
  const eventEstablished=chain?.populationState==="established"&&chainRows.length>0,activityEstablished=anyLink("activity",["established"]),noticeEstablished=anyLink("notice",["established"]);
  const determinationEstablished=p.officialApprovedEotState==="official"||anyLink("determination",["established"]),causationEstablished=false;
  const concurrencyReviewed=p.windowCandidates.length>0&&p.windowCandidates.every(window=>!(window.reasons||[]).includes("CONCURRENT_WINDOW_REQUIRES_REVIEW"));
  const observed=p.projectCompletionMovementDays;
  const kpis=planningKpis([
    ["Contractual completion",p.originalContractualCompletionIso?planningShortDate(p.originalContractualCompletionIso):"Not established",humanizeKey(p.originalContractualCompletionState||"missing")],
    ["Current submitted finish",p.sourceForecastCompletionIso?planningShortDate(p.sourceForecastCompletionIso):"Not established","current contractor programme"],
    ["Approved EOT",p.officialApprovedEotDays==null?"Not established":fmt(p.officialApprovedEotDays)+" d","dated determination authority through Data Date"],
    ["Amended contractual completion",p.amendedContractualCompletionIso?planningShortDate(p.amendedContractualCompletionIso):"Not established",humanizeKey(p.amendedContractualCompletionState||"missing")],
    ["Observed programme movement",observed==null?"Not established":(observed>0?"+":"")+fmt(observed)+" d","net first-to-latest submitted Project Completion movement; not EOT",observed>0?"warning":""]
  ]);
  const entitlementGate=moduleEvidenceGate([
    {label:"Event evidence",value:eventEstablished?"Established":"Not established",state:eventEstablished?"ready":"missing"},
    {label:"Activity linkage",value:activityEstablished?"Established":"Not established",state:activityEstablished?"ready":"missing"},
    {label:"Causation",value:causationEstablished?"Established":"Not established — schedule association is not causation",state:"missing"},
    {label:"Notice compliance",value:noticeEstablished?"Established for at least one event":"Not established",state:noticeEstablished?"ready":"missing"},
    {label:"Concurrency",value:concurrencyReviewed?"Reviewed on available windows":"Review required / not established",state:concurrencyReviewed?"ready":"missing"},
    {label:"Determination",value:determinationEstablished?"Established source determination exists":"Not established",state:determinationEstablished?"ready":"missing"}
  ]);
  const labels=p.revisionLabels||{},rows=p.windowCandidates.map(w=>'<tr><td><b>'+escapeHtml(readableWindow(w.windowId,labels))+'</b></td><td>'+escapeHtml(w.positiveProgrammeMovementDays==null?"—":fmt(w.positiveProgrammeMovementDays))+'</td><td>'+escapeHtml(humanizeKey(w.programmeMovementBasis))+'</td><td>'+escapeHtml(w.analyticalTimeImpactCandidateDays===null?"Not established":fmt(w.analyticalTimeImpactCandidateDays))+'</td><td>'+escapeHtml(humanizeKey(w.state))+'</td><td>'+escapeHtml(w.state==="review"?"Not established":fmt(w.includedCandidateDays))+'</td><td>'+escapeHtml((w.reasons||[]).map(managementReason).join("; ")||"—")+'</td></tr>').join("");
  const recon=p.timeBasisReconciliation;
  const reconciliation=recon?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Amendment and determination reconciliation</h4><p>As-of date: '+escapeHtml(planningShortDate(recon.dataDateIso))+'.</p></div></div><div class="planning-panel-body">'+planningKpis([["EOT incorporated in amendment",recon.incorporatedEotDays===null?"Not established":fmt(recon.incorporatedEotDays)+" d","already inside revised completion"],["Full determination register",recon.registerDeterminationDays===null?"Not established":fmt(recon.registerDeterminationDays)+" d",(recon.registerDeterminationCount===null||recon.registerDeterminationCount===undefined?"population not stated":fmt(recon.registerDeterminationCount)+" immutable determination(s)")],["Determinations by Data Date",recon.effectiveDeterminationCount===null||recon.effectiveDeterminationCount===undefined?"Not established":fmt(recon.effectiveDeterminationCount),"cutoff-controlled population"],["Additional approved EOT",recon.additionalApprovedEotDays===null?"Not established":fmt(recon.additionalApprovedEotDays)+" d","never register total plus amendment"]])+'<div class="notice warn">'+(recon.overlapResolution==="unresolved"?"Amendment incorporation has not been reconciled to the determination register. No additional days are applied to the revised contractual completion.":"Additional awards have an explicit incorporation reconciliation.")+'</div></div></section>':"";
  return '<section class="planning-view eot-view">'+kpis+reconciliation+programmeContextHtml+evidenceChainHtml+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Entitlement requirements</h4><p>Known time facts are shown first. Schedule movement is not an EOT time-impact assessment. Entitlement is assessed separately through Event → Activity → Causation → Notice → Concurrency → Determination.</p></div></div><div class="planning-panel-body">'+entitlementGate+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window assessment</h4><p>Review-state windows do not display a false zero entitlement.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Window</th><th>Observed movement d</th><th>Movement basis</th><th>Time-impact candidate d</th><th>State</th><th>Included days</th><th>Reason</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function visualSection(title,description,badge,body){
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div>'+(badge?'<span class="badge">'+escapeHtml(badge)+'</span>':'')+'</div><div class="chart-body">'+body+'</div></section>';
}
function metricLine(label,value){
  return '<div class="domain-metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"Unresolved":fmt(value))+'</strong></div>';
}

function planningDateMs(value){
  if(!value)return null;
  const text=String(value).trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/,"$1T$2");
  const n=Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text)?text+"Z":text);
  return Number.isFinite(n)?n:null;
}
function planningShortDate(value){
  if(!value)return "Unresolved: date not established";
  const at=planningDateMs(value);
  if(at===null)return String(value);
  return new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(at));
}
function planningDaysBetween(a,b){
  const am=planningDateMs(a),bm=planningDateMs(b);
  if(am===null||bm===null)return null;
  return Number(((bm-am)/86400000).toFixed(1));
}
function planningCalendarDaysBetween(a,b){
  if(!a||!b)return null;
  const am=planningDateMs(String(a).slice(0,10)),bm=planningDateMs(String(b).slice(0,10));
  return am===null||bm===null?null:Math.round((bm-am)/86400000);
}
function planningRevisionLabel(value){
  if(!value)return "—";
  const raw=String(value).split(/[\\/]/).at(-1)||String(value);
  return raw
    .replace(/\.(?:xer|xml|xlsx|xlsm|csv)$/i,"")
    .replace(/_\d{4,6}_Activities(?:_\d{4}-\d{2}-\d{2})?$/i,"")
    .replace(/[_-]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function planningStateLabel(value){
  if(value===null||value===undefined)return 'Not established';
  const sharedLabels=${JSON.stringify(STATUS_LABELS)};if(sharedLabels[value])return sharedLabels[value];
  const labels={
    ready:"Ready",partial:"Needs attention",blocked:"More information needed",
    completed:"Completed",in_progress:"In progress",not_started:"Not started",unknown:"Unknown",
    critical:"Critical",near_critical:"Near-critical",noncritical:"Other",
    available:"Available",missing:"Not provided",conditional:"Conditional",
    true:"Yes",false:"No",established:"Available",not_established:"Not available",
    deterministic:"Calculated",scenario:"Scenario",unresolved:"More information needed"
  };
  const key=String(value);
  return labels[key]||humanizeKey(key);
}
function planningKpis(items){
  const unavailable=item=>{const value=item[1];return value===null||value===undefined||/^(Not |—|Suppressed|Missing|Mapping not|Unresolved|Unavailable)/i.test(String(value));};
  const available=items.filter(item=>!unavailable(item)),missing=items.filter(unavailable);
  const card=item=>{const label=item[0],value=item[1],sub=item[2]||"",tone=item[3]||"";return '<div class="planning-kpi '+escapeHtml(tone)+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"Not available":fmt(value))+'</strong>'+(sub?'<small>'+escapeHtml(sub)+'</small>':'')+'</div>';};
  // Available facts always lead. If nothing is available, show a small sample of
  // unresolved measures so the page still explains what is missing.
  const primary=available.length?available:missing.slice(0,4);
  const remainingMissing=available.length?missing:missing.slice(4);
  const names=remainingMissing.slice(0,4).map(item=>item[0]);
  const labelPreview=names.length?' · '+names.map(escapeHtml).join('; ')+(remainingMissing.length>names.length?' · +'+(remainingMissing.length-names.length)+' more':''):'';
  const more=remainingMissing.length?'<details class="planning-missing-kpis"><summary>'+remainingMissing.length+' additional measure'+(remainingMissing.length===1?' needs':'s need')+' more information'+labelPreview+'</summary><div class="planning-missing-grid">'+remainingMissing.map(item=>'<div><b>'+escapeHtml(item[0])+'</b><span>'+escapeHtml(item[2]||'Not available from the current Project information.')+'</span></div>').join("")+'</div></details>':'';
  return '<div class="planning-kpi-grid">'+primary.map(card).join("")+'</div>'+more;
}
function planningStatusBand(items){
  const known=(items||[]).filter(item=>typeof item[1]==="number"&&Number.isFinite(item[1])&&item[1]>=0);
  const total=known.reduce((sum,item)=>sum+item[1],0);
  if(!known.length)return '<div class="empty-visual">This distribution is not confirmed from the available project information.</div>';
  if(total<=0)return '<div class="empty-visual">The established population is zero for this distribution.</div>';
  const segments=known.filter(item=>item[1]>0).map(item=>{
    const value=item[1];
    const width=(value/total)*100;
    const inner=width>=16
      ? '<span>'+escapeHtml(item[0])+'</span><b>'+escapeHtml(fmt(value))+'</b>'
      : width>=7
        ? '<b>'+escapeHtml(fmt(value))+'</b>'
        : '';
    return '<div class="status-band-segment '+escapeHtml(item[2]||"neutral")+'" style="width:'+width.toFixed(3)+'%" title="'+escapeHtml(item[0]+": "+fmt(value))+'">'+inner+'</div>';
  }).join("");
  return '<div class="status-band">'+segments+'</div><div class="status-band-legend">'+known.map(item=>'<span><i class="'+escapeHtml(item[2]||"neutral")+'"></i>'+escapeHtml(item[0])+' <b>'+escapeHtml(fmt(item[1]))+'</b></span>').join("")+'</div>';
}
function planningDateLadder(items,dataDate){
  const valid=items.map(item=>({...item,ms:planningDateMs(item.date)})).filter(item=>item.ms!==null);
  const dd=planningDateMs(dataDate);
  const all=[...valid.map(item=>item.ms),...(dd===null?[]:[dd])];
  if(!all.length)return '<div class="empty-visual">No completion dates are available.</div>';
  let min=Math.min(...all),max=Math.max(...all);
  if(min===max){min-=7*86400000;max+=7*86400000}
  const pad=Math.max(7*86400000,(max-min)*.08);
  min-=pad;max+=pad;
  const x=ms=>Math.max(2,Math.min(98,((ms-min)/(max-min))*100));
  const rows=valid.map(item=>'<div class="date-ladder-row"><div class="date-ladder-label"><b>'+escapeHtml(item.label)+'</b><span>'+escapeHtml(planningShortDate(item.date))+'</span></div><div class="date-ladder-track"><span class="date-marker '+escapeHtml(item.tone||"current")+'" style="left:'+x(item.ms).toFixed(2)+'%" title="'+escapeHtml(item.label+" · "+planningShortDate(item.date))+'"></span>'+(dd===null?'':'<span class="date-data-line" style="left:'+x(dd).toFixed(2)+'%" title="Data date '+escapeHtml(planningShortDate(dataDate))+'"></span>')+'</div></div>').join("");
  return '<div class="date-ladder">'+rows+'</div><div class="date-ladder-key"><span><i class="baseline"></i>Baseline / approved</span><span><i class="current"></i>Submitted programme</span><span><i class="cmeng"></i>CMeng calculation</span><span><i class="scenario"></i>Scenario</span></div>';
}
function planningAttention(items){
  const visible=items.filter(Boolean).slice(0,6);
  if(!visible.length)return '<div class="attention-clear"><b>No material programme exception identified from the available information.</b></div>';
  return '<div class="management-attention">'+visible.map(item=>'<div class="management-attention-row '+escapeHtml(item.tone||"watch")+'"><div><b>'+escapeHtml(item.title)+'</b><span>'+escapeHtml(item.text)+'</span></div>'+(item.value!==undefined?'<strong>'+escapeHtml(fmt(item.value))+'</strong>':'')+'</div>').join("")+'</div>';
}
function planningSignedBars(items,unit){
  const rows=items.filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)).slice(0,15);
  if(!rows.length)return '<div class="empty-visual">No comparable movement is available.</div>';
  const max=Math.max(1,...rows.map(item=>Math.abs(item.value)));
  return '<div class="signed-bars">'+rows.map(item=>{
    const pct=Math.min(50,(Math.abs(item.value)/max)*48);
    const left=item.value<0?50-pct:50;
    return '<div class="signed-row"><div class="signed-label" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div><div class="signed-track"><span class="signed-zero"></span><span class="signed-bar '+(item.value>0?"late":item.value<0?"early":"neutral")+'" style="left:'+left.toFixed(2)+'%;width:'+pct.toFixed(2)+'%"></span></div><b class="'+(item.value>0?"late-text":item.value<0?"early-text":"")+'">'+escapeHtml((item.value>0?"+":"")+fmt(item.value)+" "+(unit||""))+'</b></div>';
  }).join("")+'</div>';
}
function planningDateTrend(points,series){
  const width=960,height=308,left=118,right=26,top=24,bottom=58;
  const prepared=points.map((point,index)=>{
    const raw=point.dateIso||null;
    const values={};
    series.forEach(item=>{values[item.key]=planningDateMs(point[item.key]);});
    return {label:raw||("Revision "+(index+1)),xMs:raw?planningDateMs(raw):null,values};
  });
  const vals=[];
  prepared.forEach(point=>series.forEach(item=>{
    const value=point.values[item.key];
    if(typeof value==="number")vals.push(value);
  }));
  if(!vals.length)return '<div class="empty-visual">No completion-date trend is available.</div>';

  let min=Math.min(...vals),max=Math.max(...vals);
  if(min===max){min-=14*86400000;max+=14*86400000}
  const pad=Math.max(7*86400000,(max-min)*.08);
  min-=pad;max+=pad;

  const validX=prepared.filter(point=>typeof point.xMs==="number");
  const useDateScale=validX.length===prepared.length&&new Set(validX.map(point=>point.xMs)).size>1;
  const xMin=useDateScale?Math.min(...validX.map(point=>point.xMs)):0;
  const xMax=useDateScale?Math.max(...validX.map(point=>point.xMs)):Math.max(1,prepared.length-1);
  const pw=width-left-right,ph=height-top-bottom;
  const x=index=>useDateScale
    ? left+(((prepared[index].xMs-xMin)/Math.max(1,xMax-xMin))*pw)
    : left+(prepared.length===1?pw/2:(index/Math.max(1,prepared.length-1))*pw);
  const y=value=>top+ph-((value-min)/(max-min))*ph;

  const ticks=[0,.25,.5,.75,1].map(ratio=>{
    const ms=min+ratio*(max-min),yy=y(ms);
    return '<line x1="'+left+'" y1="'+yy.toFixed(1)+'" x2="'+(width-right)+'" y2="'+yy.toFixed(1)+'" stroke="#e4eaf1"/>'+
      '<text x="'+(left-9)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="#75849a">'+escapeHtml(planningShortDate(new Date(ms).toISOString()))+'</text>';
  }).join("");

  const paths=series.map(item=>{
    const segments=[];
    let current=[];
    prepared.forEach((point,index)=>{
      const value=point.values[item.key];
      if(typeof value==="number"){
        current.push(x(index).toFixed(1)+","+y(value).toFixed(1));
      }else if(current.length){
        segments.push(current);
        current=[];
      }
    });
    if(current.length)segments.push(current);
    return segments.map(segment=>'<polyline points="'+segment.join(" ")+'" fill="none" stroke="'+item.color+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>').join("");
  }).join("");

  const pointsSvg=series.map(item=>prepared.map((point,index)=>{
    const value=point.values[item.key];
    if(typeof value!=="number")return "";
    return '<circle cx="'+x(index).toFixed(1)+'" cy="'+y(value).toFixed(1)+'" r="3.5" fill="'+item.color+'" tabindex="0"><title>'+
      escapeHtml(item.label+" · "+planningShortDate(new Date(value).toISOString())+" · "+point.label)+'</title></circle>';
  }).join("")).join("");

  let labels="";
  if(useDateScale){
    labels=[0,.5,1].map((ratio,index)=>{
      const ms=xMin+((xMax-xMin)*ratio);
      const xx=left+(pw*ratio);
      return '<text x="'+xx.toFixed(1)+'" y="'+(height-20)+'" text-anchor="'+(index===0?"start":index===2?"end":"middle")+'" font-size="10" fill="#75849a">'+
        escapeHtml(planningShortDate(new Date(ms).toISOString()))+'</text>';
    }).join("");
  }else{
    const labelIndexes=[0,Math.floor((prepared.length-1)/2),prepared.length-1].filter((value,index,array)=>array.indexOf(value)===index);
    labels=labelIndexes.map(index=>
      '<text x="'+x(index).toFixed(1)+'" y="'+(height-20)+'" text-anchor="'+(index===0?"start":index===prepared.length-1?"end":"middle")+'" font-size="10" fill="#75849a">'+
      escapeHtml(planningRevisionLabel(prepared[index].label))+'</text>'
    ).join("");
  }

  const legend='<div class="chart-legend">'+series.map(item=>
    '<span class="legend-item"><span class="legend-dot" style="background:'+item.color+'"></span>'+escapeHtml(item.label)+'</span>'
  ).join("")+'</div>';
  const toolbar='<div class="chart-canvas-toolbar"><span>'+(useDateScale?'True reporting-date spacing':'Ordered revision spacing')+' · '+escapeHtml(prepared.length)+' revisions</span>'+
    '<button class="chart-canvas-focus-button" type="button">Expand chart</button></div>';

  return '<div class="chart-canvas" data-chart-canvas>'+toolbar+legend+
    '<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Forecast completion trend">'+
    ticks+paths+pointsSvg+labels+'</svg></div></div>';
}
function planningActivityPressure(rows){
  const all=rows||[],excluded=all.filter(r=>["level_of_effort","wbs_summary"].includes(r.activityType)),candidates=all.filter(r=>!["level_of_effort","wbs_summary"].includes(r.activityType));
  if(!all.length)return '<div class="empty-visual">No source activities are available.</div>';
  const columns=[
    {label:"On / early",match:v=>typeof v==="number"&&v<=0},
    {label:"1–30 d late",match:v=>typeof v==="number"&&v>0&&v<=30},
    {label:"31–90 d late",match:v=>typeof v==="number"&&v>30&&v<=90},
    {label:"91–180 d late",match:v=>typeof v==="number"&&v>90&&v<=180},
    {label:">180 d late",match:v=>typeof v==="number"&&v>180},
    {label:"Baseline unknown",match:v=>typeof v!=="number"||!Number.isFinite(v)}
  ];
  const bands=[
    {label:"Critical",tone:"danger",match:r=>r.criticality==="critical"},
    {label:"Near-critical",tone:"warning",match:r=>r.criticality==="near_critical"},
    {label:"Non-critical",tone:"accent",match:r=>r.criticality==="noncritical"},
    {label:"Float classification unknown",tone:"neutral",match:r=>!["critical","near_critical","noncritical"].includes(r.criticality)}
  ];
  const counts=bands.map(band=>columns.map(col=>candidates.filter(r=>band.match(r)&&col.match(r.finishVarianceDays)).length));
  const max=Math.max(1,...counts.flat());
  const head='<div class="pressure-matrix-head" style="grid-template-columns:150px repeat(6,minmax(55px,1fr))"><span>Float class</span>'+columns.map(col=>'<b>'+escapeHtml(col.label)+'</b>').join("")+'</div>';
  const body=bands.map((band,i)=>'<div class="pressure-matrix-row" style="grid-template-columns:150px repeat(6,minmax(55px,1fr))"><strong>'+escapeHtml(band.label)+'</strong>'+counts[i].map(count=>'<span class="pressure-cell '+band.tone+'" style="--cell-alpha:'+Math.max(.08,count/max).toFixed(3)+'"><b>'+escapeHtml(fmt(count))+'</b></span>').join("")+'</div>').join("");
  const excludedRow='<div class="pressure-matrix-row" style="grid-template-columns:150px repeat(6,minmax(55px,1fr))"><strong>LOE / WBS summaries</strong><span class="pressure-cell neutral" style="grid-column:span 6">'+fmt(excluded.length)+' source records excluded from execution float bands</span></div>';
  return '<div class="pressure-matrix">'+head+body+excludedRow+'</div><div class="pressure-note">All '+escapeHtml(fmt(candidates.length))+' execution activities are reconciled; LOE and WBS summaries are excluded. Thresholds use each activity calendar. Unknown dates and classifications remain visible.</div>';
}
function planningLookAheadTimeline(p){
  const labelMap={predecessor:"Predecessor",procurement_material:"Material",design_submittal:"Design / RFIs / Submittals",permit:"Permit",resource:"Resource",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const rows=[...(p.rows||[])].sort((a,b)=>{
    const ar=a.readiness?.state==="blocked"?0:a.classification==="overdue"?1:a.readiness?.state==="conditional"?2:3;
    const br=b.readiness?.state==="blocked"?0:b.classification==="overdue"?1:b.readiness?.state==="conditional"?2:3;
    return ar-br||String(a.startIso||"").localeCompare(String(b.startIso||""));
  }).slice(0,36);
  const start=planningDateMs(p.dataDateIso),end=planningDateMs(p.windowEndIso);
  if(start===null||end===null||end<=start)return '<div class="empty-visual">The look-ahead date window is not confirmed.</div>';
  const x=ms=>Math.max(0,Math.min(100,((ms-start)/(end-start))*100));
  const weekMarks=[];
  for(let i=0;i<=6;i++)weekMarks.push('<span style="left:'+((i/6)*100).toFixed(2)+'%">'+(i===0?"Data date":"W"+i)+'</span>');
  const body=rows.map(r=>{
    const s=planningDateMs(r.startIso),e=planningDateMs(r.finishIso);
    if(s===null||e===null)return "";
    const l=x(s),rr=x(e),w=Math.max(1,rr-l);
    const state=r.readiness?.state||"conditional";
    const dims=r.readiness?.dimensions||[];
    const blocked=dims.filter(d=>d.state==="blocked");
    const unknown=dims.filter(d=>d.state==="unknown");
    const records=blocked.flatMap(d=>(d.records||[]).filter(record=>record.state==="blocked"));
    let stateText="Ready";
    if(records.length) stateText=(records[0].recordId||humanizeKey(records[0].documentType))+(records.length>1?" +"+(records.length-1):"");
    else if(blocked.length===1) stateText=labelMap[blocked[0].key]||"Known blocker";
    else if(blocked.length>1) stateText=(labelMap[blocked[0].key]||"Blocker")+" +"+(blocked.length-1);
    else if(unknown.length>0) stateText="Evidence gaps";
    const notes=records.map(record=>humanizeKey(record.documentType)+" "+(record.recordId||"")+": "+record.note).join(" · ")||blocked.map(d=>(labelMap[d.key]||d.key)+(d.note?": "+d.note:"")).join(" · ")||unknown.map(d=>labelMap[d.key]||d.key).join(", ");
    const title=planningShortDate(r.startIso)+" → "+planningShortDate(r.finishIso)+" · "+stateText+(notes?" · "+notes:"");
    return '<div class="lookahead-row"><div class="lookahead-label"><b>'+escapeHtml(r.activityId)+'</b><span>'+escapeHtml(r.name||"")+'</span></div><div class="lookahead-track"><span class="lookahead-bar '+escapeHtml(state)+'" style="left:'+l.toFixed(2)+'%;width:'+w.toFixed(2)+'%" title="'+escapeHtml(title)+'"></span></div><b class="lookahead-state '+escapeHtml(state)+'" title="'+escapeHtml(notes||stateText)+'">'+escapeHtml(stateText)+'</b></div>';
  }).join("");
  return '<div class="lookahead-axis"><div></div><div class="lookahead-weeks">'+weekMarks.join("")+'</div><div></div></div><div class="lookahead-timeline">'+body+'</div>';
}
function planningMilestonePriorityRank(value){
  return value==="critical"?0:value==="high"?1:value==="watch"?2:3;
}
function planningMilestoneCriticalityLabel(row){
  if(row.criticality==="critical")return row.negativeFloat?"Submitted float critical · negative float":"Submitted float critical";
  if(row.criticality==="near_critical")return "Near-critical";
  if(row.criticality==="positive_float")return "Positive float";
  return "Float not confirmed";
}
function planningMilestoneDueLabel(row){
  const labels={
    completed:"Completed",
    overdue:"Overdue",
    due_30_days:"Due ≤30 days",
    due_90_days:"Due 31–90 days",
    future:"Future",
    unknown:"Due date unknown"
  };
  return labels[row.dueState]||humanizeKey(row.dueState||"unknown");
}
function planningMilestoneFlagLabel(flag){
  const labels={
    SOURCE_FLOAT_CRITICAL:"Submitted float critical",
    NEGATIVE_FLOAT:"Negative float",
    NEAR_CRITICAL:"Near-critical",
    OVERDUE:"Overdue",
    DUE_WITHIN_30_DAYS:"Due ≤30d",
    DUE_WITHIN_90_DAYS:"Due ≤90d",
    LATER_THAN_BASELINE:"Later than baseline",
    FLOAT_NOT_ESTABLISHED:"Float missing",
    TERMINAL_CRITICAL_MILESTONE:"Source-float critical terminal"
  };
  return labels[flag]||humanizeKey(flag);
}
function planningMilestoneFlagTone(flag){
  return ["NEGATIVE_FLOAT","OVERDUE","SOURCE_FLOAT_CRITICAL","TERMINAL_CRITICAL_MILESTONE"].includes(flag)?"danger":["NEAR_CRITICAL","DUE_WITHIN_30_DAYS","DUE_WITHIN_90_DAYS","LATER_THAN_BASELINE"].includes(flag)?"warning":"";
}
function planningMilestonePriorityBoard(p){
  const representedMovements=new Set();
  const candidates=[...(p.rows||[])]
    .filter(r=>r.status!=="completed")
    .sort((a,b)=>{
      const pr=planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority);
      if(pr!==0)return pr;
      const ac=a.criticality==="critical"?0:a.criticality==="near_critical"?1:2;
      const bc=b.criticality==="critical"?0:b.criticality==="near_critical"?1:2;
      if(ac!==bc)return ac-bc;
      const ad=typeof a.daysFromDataDate==="number"?a.daysFromDataDate:Number.MAX_SAFE_INTEGER;
      const bd=typeof b.daysFromDataDate==="number"?b.daysFromDataDate:Number.MAX_SAFE_INTEGER;
      if(ad!==bd)return ad-bd;
      return (b.varianceDays||0)-(a.varianceDays||0);
    })
    .filter((r,index)=>r.managementPriority!=="normal"||index<10)
    .filter(r=>{if(r.managementPriority!=="watch"||typeof r.varianceDays!=="number")return true;const k=r.varianceDays.toFixed(6);if(representedMovements.has(k))return false;representedMovements.add(k);return true;})
    .slice(0,20);
  if(!candidates.length)return '<div class="attention-clear"><b>No open milestone currently meets the critical/high/watch criteria.</b></div>';
  return '<div class="milestone-priority-board">'+candidates.map(r=>{
    const priority=r.managementPriority||"normal";
    const flags=(r.managementFlags||[]).slice(0,4);
    const floatText=r.totalFloatHours===null||r.totalFloatHours===undefined?"—":fmt(r.totalFloatHours)+" h";
    const variance=r.varianceDays===null||r.varianceDays===undefined?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)+" d");
    const status=planningStateLabel(r.status);
    const due=planningMilestoneDueLabel(r);
    const criticality=planningMilestoneCriticalityLabel(r);
    const wbs=r.wbsName||r.wbsId||"WBS not identified";
    return '<div class="milestone-priority-row '+escapeHtml(priority)+'">'+
      '<span class="milestone-priority-pill '+escapeHtml(priority)+'">'+escapeHtml(priority)+'</span>'+
      '<div class="milestone-priority-main"><b>'+escapeHtml(r.activityId)+'</b><span>'+escapeHtml(r.name||"")+'</span><small>'+escapeHtml(wbs)+'</small><div class="milestone-flags">'+flags.map(f=>'<span class="milestone-flag '+escapeHtml(planningMilestoneFlagTone(f))+'">'+escapeHtml(planningMilestoneFlagLabel(f))+'</span>').join("")+'</div></div>'+
      '<div class="milestone-priority-metric"><span>Status</span><b>'+escapeHtml(status)+'</b></div>'+
      '<div class="milestone-priority-metric"><span>Criticality</span><b class="milestone-criticality '+escapeHtml(r.criticality||"unknown")+'">'+escapeHtml(criticality)+'</b></div>'+
      '<div class="milestone-priority-metric"><span>Current date</span><b>'+escapeHtml(planningShortDate(r.currentDateIso))+'</b><small>'+escapeHtml(due)+'</small></div>'+
      '<div class="milestone-priority-metric"><span>Float / slip</span><b>'+escapeHtml(floatText)+'</b><small class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(variance)+'</small></div>'+
      '<div class="milestone-priority-action"><b>Required attention</b><br>'+escapeHtml(r.managementAction||"Monitor against the current programme and controlled baseline.")+'</div>'+
    '</div>';
  }).join("")+'</div>';
}
function planningMilestoneChartDateLabel(ms,span){
  const date=new Date(ms);
  if(span<=180*86400000){
    return new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short"}).format(date);
  }
  if(span<=730*86400000){
    return new Intl.DateTimeFormat(undefined,{month:"short",year:"2-digit"}).format(date);
  }
  return new Intl.DateTimeFormat(undefined,{month:"short",year:"numeric"}).format(date);
}
function planningMilestoneChartName(value,max=34){
  const text=String(value||"");
  return text.length<=max?text:text.slice(0,max-1)+"…";
}
function planningMilestoneChartPriority(row){
  let score=0;
  if(row.terminalMilestone)score+=20;
  if(row.negativeFloat)score+=100;
  if(row.criticality==="critical")score+=80;
  else if(row.criticality==="near_critical")score+=55;
  if(row.dueState==="overdue")score+=75;
  else if(row.dueState==="due_30_days")score+=45;
  else if(row.dueState==="due_90_days")score+=20;
  if(typeof row.varianceDays==="number"&&row.varianceDays>0)score+=Math.min(35,row.varianceDays/10);
  if(row.managementPriority==="critical")score+=30;
  else if(row.managementPriority==="high")score+=18;
  else if(row.managementPriority==="watch")score+=8;
  return score;
}
function planningMilestoneTimeline(p){
  const source=(p.rows||[]).filter(r=>r.status!=="completed"&&(planningDateMs(r.currentDateIso)!==null||planningDateMs(r.baselineDateIso)!==null));
  if(!source.length)return '<div class="empty-visual">No open milestone dates are available.</div>';
  const movements=new Set();
  const rows=[...source].sort((a,b)=>planningMilestoneChartPriority(b)-planningMilestoneChartPriority(a)||planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Infinity)-(b.daysFromDataDate??Infinity)))
    .filter(r=>{if(r.managementPriority!=="watch"||typeof r.varianceDays!=="number")return true;const k=r.varianceDays.toFixed(6);if(movements.has(k))return false;movements.add(k);return true}).slice(0,12);
  const dates=rows.flatMap(r=>[planningDateMs(r.baselineDateIso),planningDateMs(r.currentDateIso)]).filter(v=>v!==null);
  const low=Math.min(...dates),high=Math.max(...dates),pad=Math.max(14*86400000,(high-low)*.08),min=low-pad,max=high+pad;
  const x=v=>{const at=planningDateMs(v);return at===null?null:100*(at-min)/(max-min)};
  const axis='<div class="milestone-date-axis">'+[0,.25,.5,.75,1].map(f=>'<span>'+escapeHtml(planningShortDate(new Date(min+(max-min)*f).toISOString()))+'</span>').join('')+'</div>';
  return '<div class="milestone-date-legend"><span>○ Controlled baseline</span><span><b>◆ Current forecast</b></span><span>Open milestones only · Data Date '+escapeHtml(planningShortDate(p.dataDateIso))+'</span></div><div class="milestone-date-chart">'+rows.map(r=>{
    const bx=x(r.baselineDateIso),cx=x(r.currentDateIso),variance=typeof r.varianceDays==='number'?(r.varianceDays>0?'+':'')+fmt(r.varianceDays)+' d':'Unresolved';
    const count=source.filter(a=>a.managementPriority==='watch'&&a.varianceDays===r.varianceDays).length;
    const track=(bx!==null&&cx!==null?'<span class="date-span" style="left:'+Math.min(bx,cx)+'%;width:'+Math.abs(cx-bx)+'%"></span>':'')+(bx===null?'':'<span class="date-baseline" style="left:'+bx+'%"></span>')+(cx===null?'':'<span class="date-current" style="left:'+cx+'%"></span>');
    return '<div class="milestone-date-row"><div class="milestone-date-name"><b>'+escapeHtml(r.activityId)+' · '+escapeHtml(r.name||'')+'</b><span>'+escapeHtml(planningMilestoneCriticalityLabel(r))+' · '+escapeHtml(planningMilestoneDueLabel(r))+'</span><small>'+escapeHtml(r.wbsName||r.wbsId||'')+'</small>'+(r.managementPriority==='watch'&&count>1?'<small>Representative of '+escapeHtml(fmt(count))+' watch milestones with the same movement. This does not establish a common cause.</small>':'')+'</div><div>'+axis+'<div class="milestone-date-track">'+track+'</div><div class="milestone-date-values"><span>Baseline <b>'+escapeHtml(planningShortDate(r.baselineDateIso))+'</b></span><span>Current <b>'+escapeHtml(planningShortDate(r.currentDateIso))+'</b></span><span>Movement <b>'+escapeHtml(variance)+'</b></span><span>Float <b>'+escapeHtml(r.totalFloatHours==null?'Unresolved':fmt(r.totalFloatHours)+' h')+'</b></span></div></div></div>';
  }).join('')+'</div><p class="muted">'+escapeHtml(fmt(rows.length))+' priority representatives from '+escapeHtml(fmt(source.length))+' open milestones. All milestone records remain below.</p>';
}
function planningFloatHistogram(rows,limitHours){
  const vals=(rows||[]).map(r=>Number(r.totalFloatHours)).filter(v=>Number.isFinite(v)).map(v=>Number(v.toFixed(4)));
  if(!vals.length)return '<div class="empty-visual">Float information is not available.</div>';
  const counts=new Map();
  vals.forEach(v=>counts.set(v,(counts.get(v)||0)+1));
  const distinct=[...counts.entries()].sort((a,b)=>a[0]-b[0]);
  let groups=[];
  let exact=false;
  if(distinct.length<=10){
    exact=true;
    groups=distinct.map(([value,count])=>({label:fmt(value)+" h",count,value}));
  }else{
    const max=Math.max(1,Number(limitHours)||Math.max(...vals));
    const bins=5;
    const step=max/bins;
    groups=Array.from({length:bins},(_,i)=>({label:(i===0?"0":">"+fmt(i*step))+"–"+fmt((i+1)*step)+" h",count:0,value:i}));
    vals.forEach(v=>{
      const normalized=Math.max(0,Math.min(max,v));
      const idx=Math.min(bins-1,Math.max(0,Math.ceil(normalized/step)-1));
      groups[idx].count+=1;
    });
  }
  const peak=Math.max(1,...groups.map(g=>g.count));
  return '<div class="float-distribution-note">'+(exact?'Exact submitted total-float values':'Submitted total-float bands')+'</div><div class="float-histogram" style="grid-template-columns:repeat('+groups.length+',minmax(72px,1fr))">'+groups.map(group=>'<div class="float-bin"><div class="float-bar-wrap"><span class="float-bar" style="height:'+((group.count/peak)*100).toFixed(2)+'%"></span></div><b>'+escapeHtml(fmt(group.count))+'</b><small>'+escapeHtml(group.label)+'</small></div>').join("")+'</div>';
}


function planningLookAheadBlockers(groups){
  const labels={predecessor:"Predecessor date requirement",procurement_material:"Materials / procurement",design_submittal:"Design / RFI / submittal (type unavailable)",rfi:"RFI",rfi_register:"RFI",design:"Design",design_deliverables:"Design deliverable",submittal:"Submittal",submittal_register:"Submittal",quality:"Quality",quality_ncr_register:"NCR",permit:"Permit",resource:"Resource",commercial:"Commercial",risk:"Risk",access:"Access"};
  const entries=groups||[];
  if(!entries.length)return '<div class="attention-clear"><b>No explicit blocker has been recorded in the look-ahead.</b></div>';
  const max=Math.max(...entries.map(x=>x.activityCount),1);
  return '<div class="constraint-bars">'+entries.map(group=>'<div class="constraint-row" title="'+escapeHtml(group.recordIds.join(', '))+'"><span>'+escapeHtml(labels[group.documentType]||humanizeKey(group.documentType))+'</span><div><i style="width:'+((group.activityCount/max)*100).toFixed(2)+'%"></i></div><b>'+escapeHtml(fmt(group.activityCount))+'</b></div>').join("")+'</div><p class="muted">Activities with a confirmed blocker, split by source record type. An activity may appear in several types.</p>';
}
function planningRevisionValues(points){
  const visible=(points||[]).slice(-6);
  if(!visible.length)return"";
  return '<div class="revision-value-grid">'+visible.map(point=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(planningRevisionLabel(point.label)||("Revision "+point.sequence))+'</b><span>'+escapeHtml(planningShortDate(point.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Progress <b>'+escapeHtml(point.durationWeightedProgressPercent===null||point.durationWeightedProgressPercent===undefined?"—":fmt(point.durationWeightedProgressPercent)+"%")+'</b></span><span>Forecast finish <b>'+escapeHtml(planningShortDate(point.forecastCompletionIso))+'</b></span><span>Critical <b>'+escapeHtml(fmt(point.criticalCount))+'</b></span><span>Near-critical <b>'+escapeHtml(fmt(point.nearCriticalCount))+'</b></span><span>Negative float <b>'+escapeHtml(fmt(point.negativeFloatCount))+'</b></span></div></div>').join("")+'</div>';
}
function planningFinishPeriodBars(rows){
  const counts=new Map();
  for(const row of rows||[]){
    if(!row.currentFinishIso)continue;
    const date=new Date(row.currentFinishIso);
    if(Number.isNaN(date.getTime()))continue;
    const key=date.toISOString().slice(0,7);
    counts.set(key,(counts.get(key)||0)+1);
  }
  const entries=[...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  if(!entries.length)return '<div class="empty-visual">Current finish dates are not available.</div>';
  const max=Math.max(1,...entries.map(x=>x[1]));
  const renderPeriods=(items)=>'<div class="finish-period-bars">'+items.map(([month,count])=>'<div class="finish-period-row"><span>'+escapeHtml(new Intl.DateTimeFormat(undefined,{month:"short",year:"numeric"}).format(new Date(month+"-01T00:00:00Z")))+'</span><div><i style="width:'+((count/max)*100).toFixed(2)+'%"></i></div><b>'+escapeHtml(fmt(count))+'</b></div>').join("")+'</div>';
  return renderPeriods(entries.slice(0,8))+(entries.length>8?experienceDisclosure('All finish periods',renderPeriods(entries),'All '+fmt(entries.length)+' monthly groups'): '');
}

function renderPmoVisual(data){
  const p=projectionFor(data,"pmo_analysis");
  if(!p.schedule||!p.progress||!p.forecast)return"";
  const variance=typeof p.forecast.varianceDays==="number"?p.forecast.varianceDays:null;
  const known=data.knownScheduleCounts||{};
  const knownValue=(total,value)=>total??(typeof value==='number'?fmt(value)+' known':null);
  const kpis=planningKpis([
    ["Baseline finish",planningShortDate(p.programmeBaselineCompletionIso),"controlled baseline",""],
    ["Submitted finish",planningShortDate(p.forecast.sourceCompletionIso),"current programme",""],
    ["Critical",knownValue(p.schedule.criticalCount,known.critical),"activities","danger"],
    ["Near-critical",knownValue(p.schedule.nearCriticalCount,known.nearCritical),"activities","warning"],
    ["Negative float",knownValue(p.schedule.negativeFloatCount,known.negativeFloat),"activities","danger"],
    ["Overdue milestones",p.progress.lateMilestoneCount,"past the data date","danger"],["Missed planned starts",p.progress.lookAheadMissedStartCount,"execution activities","warning"]
  ]);
  const completion=planningDateLadder([
    {label:"Contract completion",date:p.claims?.contractualCompletionIso,tone:"baseline"},
    {label:"Controlled baseline finish",date:p.programmeBaselineCompletionIso,tone:"baseline"},
    {label:"Submitted finish",date:p.forecast.sourceCompletionIso,tone:"current"},
    {label:"Productivity forecast",date:p.sourceProductivityForecast?.completionIso,tone:"current"},
    {label:"Approved finish date",date:p.claims?.officialAdjustedCompletionIso,tone:"baseline"},
    {label:"Scenario finish date",date:p.claims?.scenarioAdjustedCompletionIso,tone:"scenario"}
  ],null);
  const attention=planningAttention([
    variance!==null&&variance>0?{title:"Calendar model needs reconciliation",text:"Submitted logic recalculated on its own calendars gives a different finish. Keep this scenario separate from delay and the source productivity outlook.",value:planningShortDate(p.forecast.independentCompletionIso),tone:"watch"}:null,
    p.schedule.negativeFloatCount>0?{title:"Negative float requires attention",text:"Activities are carrying schedule pressure against the current dates.",value:p.schedule.negativeFloatCount,tone:"danger"}:null,
    p.progress.lateMilestoneCount>0?{title:"Milestones are overdue",text:"Open milestone commitments have passed the current data date.",value:p.progress.lateMilestoneCount,tone:"danger"}:null,
    p.progress.lookAheadOverdueCount>0?{title:"Look-ahead contains overdue work",text:"Review overdue activities and immediate recovery actions.",value:p.progress.lookAheadOverdueCount,tone:"watch"}:null,
    p.resources.capacityChecksToDataDate?.actual.exceededCount>0?{title:"Actual resource-week capacity exceedances",text:"Through the Data Date; each resource and week counted once.",value:fmt(p.resources.capacityChecksToDataDate.actual.exceededCount)+" / "+fmt(p.resources.capacityChecksToDataDate.actual.comparableCount),tone:"watch"}:null,
    p.contract.uniqueWordingSignalCount>0?{title:"Contract wording groups to review",text:fmt(p.contract.challengeSignalCount)+" source occurrences grouped by category and identical wording; not independent obligations.",value:p.contract.uniqueWordingSignalCount,tone:"watch"}:null
  ]);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Activity status","Current programme population by execution state.",renderDonutChart([
      {label:"Completed",value:p.progress.completedCount||0,tone:"success"},
      {label:"In progress",value:p.progress.inProgressCount||0,tone:"accent"},
      {label:"Not started",value:p.progress.notStartedCount||0,tone:"neutral"},
      {label:"Unknown",value:p.progress.unknownStatusCount||0,tone:"neutral"}
    ],"Activities"))+
    renderVisualPanel("Schedule pressure","Disjoint critical and near-critical populations. Negative float is a separate KPI.",renderDonutChart([
      {label:"Critical",value:p.schedule.criticalCount,tone:"danger"},
      {label:"Near-critical",value:p.schedule.nearCriticalCount,tone:"warning"}
    ],"Critical + near-critical"))+
  '</div>';
  const health='<div class="management-health-grid">'+[
    ["Programme",[
      ["Source activities",p.schedule.sourceActivityCount??p.schedule.activityCount],["Execution population",p.schedule.executableActivityCount??p.schedule.activityCount],["Excluded",p.schedule.excludedActivityCount??0],["Relationships",p.schedule.relationshipCount],["Logic density",p.schedule.logicDensity],["Network calculation",p.schedule.independentCpmState==="established"?"Computed; source float unverified":"Unresolved"]
    ]],
    ["Progress",[
      ["Weighted progress",p.progress.durationWeightedProgressPercent===null?"—":fmt(p.progress.durationWeightedProgressPercent)+"%"],["Schedule progress-field coverage",p.progress.progressCoveragePercent===null?"—":fmt(p.progress.progressCoveragePercent)+"%"],["Completed",p.progress.completedCount],["In progress",p.progress.inProgressCount]
    ]],
    ["Delivery",[
      ["Assigned resources",p.resources.assignedResourceCount],["Capacity field coverage · supplied resource-week rows",p.resources.weeklyCapacityCoveragePercent===null?"—":fmt(p.resources.weeklyCapacityCoveragePercent)+"%"],["Actual overloads through DD",p.resources.capacityChecksToDataDate?fmt(p.resources.capacityChecksToDataDate.actual.exceededCount)+" / "+fmt(p.resources.capacityChecksToDataDate.actual.comparableCount)+" resource-weeks":"Unresolved"],["Measured installation",p.quantities.installedQuantityStatus?humanizeKey(p.quantities.installedQuantityStatus.state):"Unresolved"],["Programme links for planned quantities",planningStateLabel(p.quantities.allocationState)]
    ]],
    ["Claims & time",[
      ["Delay events",p.claims.eventCount],["Claims",p.claims.claimCount],["Recalculated window movement",fmt(p.claims.grossPositiveAnalyticalMovementDays)+" days · "+(p.claims.windowMovementTrace||[]).map(w=>fmt(w.calculatedDays)).join(" + ")],["Net submitted finish movement",fmt(p.claims.netSubmittedFinishMovementDays)+" days"],["Effective approved determinations at Data Date",fmt(p.claims.effectiveDeterminationDays)+" days"],["EOT incorporated in amendment",fmt(p.claims.incorporatedEotDays)+" days"],["Determination register total",fmt(p.claims.registerDeterminationDays)+" days"]
    ]]
  ].map(group=>'<div class="domain-card"><h5>'+escapeHtml(group[0])+'</h5>'+group[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  const detail=kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date position</h4><p>Controlled baseline, submitted finish date and any independently calculated, approved or scenario finish dates.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel attention"><div class="planning-panel-head"><div><h4>What needs attention</h4><p>Items that can change the current programme position.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Schedule coverage is field coverage, not physical progress. Gross and net time movements have different bases; their difference is not proven overlap.</p></div></div><div class="planning-panel-body">'+health+'</div></section>';
  return '<section class="planning-view management-view">'+(data.projectDiagnosis?renderProjectBrief(data.projectDiagnosis):renderCompletionPosition(data.completionPosition))+experienceDisclosure("Detailed project controls position",detail,"KPIs, charts, finish dates and programme health")+'</section>';
}
function renderScheduleAnalyticsVisual(data){
  const p=projectionFor(data,"schedule_analytics");
  const r=p.result||p;
  if(!r.graph||!r.float)return"";
  const openStarts=(r.graph.openStartActivityIds||[]).length,openFinishes=(r.graph.openFinishActivityIds||[]).length;
  const broken=(r.graph.brokenPredecessorActivityIds||[]).length+(r.graph.brokenSuccessorActivityIds||[]).length;
  const cycles=(r.graph.cyclicActivityIds||[]).length,isolated=(r.graph.isolatedActivityIds||[]).length;
  const kpis=planningKpis([
    ["Programme records",r.activityCount,"All programme records"],["Execution activities",r.population?.executableActivityCount,"Activities used for analysis"],["Excluded types",r.population?.excludedActivityCount,"LOE and WBS summaries"],
    ["Relationships",r.relationshipCount,"logic links"],
    ["Logic density",r.graph.logicDensity,"links per source activity"],
    ["Open starts",openStarts,"All programme links","warning"],
    ["Open finishes",openFinishes,"All programme links","warning"],
    ["Negative float",r.float.negativeFloatCount,"activities","danger"]
  ]);
  const classes=[
    {label:"Known critical",value:r.float.knownClassifications?.critical,tone:"danger"},
    {label:"Known near-critical",value:r.float.knownClassifications?.nearCritical,tone:"warning"},
    {label:"Known non-critical",value:r.float.knownClassifications?.noncritical,tone:"accent"},
    {label:"Classification unknown",value:r.float.knownClassifications?.unknown,tone:"neutral"}
  ];
  const pressure=planningStatusBand(classes.map(x=>[x.label,x.value,x.tone]))+'<p>Negative float: '+escapeHtml(fmt(r.float.negativeFloatCount))+' (separate overlapping indicator). Float-field coverage: '+escapeHtml(fmt(r.float.coveragePercent))+'% of execution activities.</p>';
  const visualOverview='<div class="visual-chart-grid">'+renderVisualPanel("Execution status","Execution activities",renderDonutChart([
    {label:"Completed",value:r.status.completed,tone:"success"},{label:"In progress",value:r.status.inProgress,tone:"accent"},
    {label:"Not started",value:r.status.notStarted,tone:"neutral"},{label:"Unknown",value:r.status.unknown,tone:"warning"}
  ],"Execution activities"))+renderVisualPanel("Submitted float classification","Disjoint confirmed classifications; independent path validation is separate.",renderDonutChart(classes,"Execution activities"))+'</div>';
  const integrity='<div class="integrity-grid">'+[
    ["Cycles",cycles,cycles?"danger":"success"],["Broken links",broken,broken?"danger":"success"],["Open starts",openStarts,openStarts?"warning":"success"],["Open finishes",openFinishes,openFinishes?"warning":"success"],["Isolated programme activities",isolated,isolated?"warning":"success"],["Schedule calculation",r.graph.complete?"Complete":"Review needed",r.graph.complete?"success":"danger"]
  ].map(x=>'<div class="integrity-card '+escapeHtml(x[2])+'"><span>'+escapeHtml(x[0])+'</span><b>'+escapeHtml(fmt(x[1]))+'</b></div>').join("")+'</div>';
  const completion=planningDateLadder((r.completionBases||[]).map(b=>({
    label:b.basis==="programme"?"Controlled baseline finish":b.basis==="forecast"?"Current forecast finish":"Actual finish",
    date:b.dateIso,
    tone:b.basis==="forecast"?"cmeng":b.basis==="actual"?"actual":"current"
  })),r.dataDateIso);
  const variance=r.finishVariance||{};
  const logic=r.logicQuality||{};
  const quality='<div class="notice info"><b>Logic quality: '+escapeHtml(humanizeKey(logic.state||"not_established"))+'</b><br>Execution open starts: '+escapeHtml(fmt(logic.executionOpenStartActivityIds?.length))+'; open finishes: '+escapeHtml(fmt(logic.executionOpenFinishActivityIds?.length))+'; isolated: '+escapeHtml(fmt(logic.executionIsolatedActivityIds?.length))+'. Excluded isolated source records: '+escapeHtml(fmt(logic.excludedIsolatedActivityIds?.length))+'. Boundary candidates: '+escapeHtml(fmt(logic.boundaryCandidateActivityIds?.length))+' require confirmed review.</div>';
  const varianceBand=planningStatusBand([
    ["Late",variance.lateActivities||0,"danger"],["On time",variance.onTimeActivities||0,"success"],["Early",variance.earlyActivities||0,"accent"],["Unknown",variance.unknownActivities||0,"neutral"]
  ]);
  return '<section class="planning-view programme-review"><div class="notice info"><b>Programme Review = whole-programme control.</b><p>This page answers programme health, logic, float, finish dates and baseline variance. Use Activity Review for individual activity filtering and detailed row investigation.</p></div>'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Float, progress and logic quality across the current programme.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic checks</h4><p>Issues that reduce confidence in schedule sequencing.</p></div></div><div class="planning-panel-body">'+integrity+quality+'<p>Submitted Near Critical label: '+escapeHtml(fmt(p.controlBasis?.sourceReportedNearCriticalLabelCount))+'; strict confirmed near-critical: '+escapeHtml(fmt(r.float.nearCriticalCount))+'; float-risk watchlist: '+escapeHtml(fmt(r.float.floatRiskWatchlistCount))+'. These definitions are reconciled separately.</p></div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish dates</h4><p>Baseline, current forecast and actual finish dates are kept separate so one is not mistaken for another.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish variance</h4><p>Controlled-baseline comparison by '+escapeHtml(humanizeKey(variance.populationBasis||'execution_control'))+'. Denominator: '+escapeHtml(fmt(variance.denominator??r.population?.executableActivityCount))+'.</p></div></div><div class="planning-panel-body">'+varianceBand+distributionSummary(variance.distribution)+'<div class="coverage-line"><span>Variance coverage</span><b>'+escapeHtml(variance.coveragePercent===null||variance.coveragePercent===undefined?"—":fmt(variance.coveragePercent)+"%")+'</b></div></div></section></div></section>';
}
function renderMovementConcentration(m,fallback){
  if(!m)return planningSignedBars(fallback,"calendar days");
  const signed=v=>v==null?"Unresolved":(v>0?"+":"")+fmt(v)+" d";
  const c=m.comparison||{},pop=m.population||{},all=m.maximumRows||[];
  if(m.distribution?.maximum==null)return '<div class="notice info"><b>Maximum movement: Unresolved</b><p>Activities sharing maximum: Unresolved. Comparable controlled-baseline and current finish dates are needed to establish a maximum and its population.</p></div>';
  const rows=all.map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br>'+escapeHtml(r.name||"")+'</td><td>'+escapeHtml(humanizeKey(r.activityType))+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.previousFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td>'+escapeHtml(signed(r.baselineMovementDays))+'</td><td>'+escapeHtml(signed(r.previousMovementDays))+'</td><td>'+escapeHtml(r.sourcePairVerified?"Date pair reconciles":"Review required")+'</td></tr>').join("");
  return '<div class="notice info"><b>Comparison: '+escapeHtml(c.baselineLabel||"Controlled baseline")+' → '+escapeHtml(c.currentLabel||"Current programme")+'</b><br>Baseline-comparable population: '+escapeHtml(fmt(pop.denominator))+' / '+escapeHtml(fmt(pop.sourceCount))+' source records · '+escapeHtml(fmt(m.coveragePercent))+'% coverage.</div>'+planningKpis([
    ["Maximum movement",signed(m.distribution?.maximum),"calendar days vs each activity baseline"],["Activities sharing maximum",m.distribution.maximumCount,m.distribution.maximumPercent==null?"Share of comparable population unresolved":fmt(m.distribution.maximumPercent)+"% of baseline-comparable population"],["Verified date pairs",m.sourcePairVerifiedCount,fmt(all.length)+" maximum rows inspected"],["Causation","Unresolved","movement is not attributable delay or EOT"]
  ])+'<div class="notice warn">'+escapeHtml(m.interpretation)+'</div><p><b>Activity types:</b> '+escapeHtml((m.activityTypes||[]).map(t=>fmt(t.count)+" "+humanizeKey(t.value)).join("; "))+'. <b>Baseline date patterns:</b> '+escapeHtml(fmt((m.baselineDatePatterns||[]).length))+'. <b>Current date patterns:</b> '+escapeHtml(fmt((m.currentDatePatterns||[]).length))+'. <b>WBS groups:</b> '+escapeHtml(fmt((m.wbsPatterns||[]).length))+'. Systematic revision shift: review required.</p>'+planningSignedBars((m.representatives||[]).map(r=>({label:r.activityId+" · "+(r.name||""),value:r.baselineMovementDays})),"calendar days")+'<p>Showing '+escapeHtml(fmt((m.representatives||[]).length))+' representatives of '+escapeHtml(fmt(all.length))+' at the maximum. Previous-revision comparison: '+escapeHtml(c.previousLabel||"Unresolved")+' → '+escapeHtml(c.currentLabel||"Current programme")+'.</p><details class="movement-cohort"><summary>View all '+escapeHtml(fmt(all.length))+' maximum-movement activities and date pairs</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Type</th><th>Controlled baseline finish</th><th>Previous revision finish</th><th>Current finish</th><th>Vs baseline</th><th>Vs previous revision</th><th>Source dates</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
}
function activityReviewRowHtml(a){
  return '<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span><br><span class="muted">'+escapeHtml(a.wbsPath||a.wbsId||"")+'</span></td>'+
    '<td>'+escapeHtml(a.zone||"—")+'</td><td>'+escapeHtml(a.floor||a.level||"—")+'</td><td>'+escapeHtml(a.discipline||"—")+'</td><td>'+escapeHtml(a.package||"—")+'</td>'+
    '<td>'+escapeHtml(planningStateLabel(a.status))+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(planningStateLabel(a.criticality))+'</span></td>'+
    '<td>'+escapeHtml(planningShortDate(a.currentStartIso))+'</td><td>'+escapeHtml(planningShortDate(a.currentFinishIso))+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td>'+
    '<td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(a.finishVarianceDays===null?"Unresolved":fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.delayStatus||"—")+'</td></tr>';
}
const activityFilterIds=["activityFilterSearch","activityFilterWbs","activityFilterZone","activityFilterFloor","activityFilterTower","activityFilterBuilding","activityFilterArea","activityFilterWorkFront","activityFilterPhase","activityFilterSection","activityFilterChainage","activityFilterDiscipline","activityFilterTrade","activityFilterSystem","activityFilterPackage","activityFilterCbs","activityFilterContractor","activityFilterSubcontractor","activityFilterStatus","activityFilterCriticality","activityFilterCondition"];
function activityFilterValue(id){const node=el(id);return node?String(node.value||"").trim():"";}
const projectScopeFilterMap={activityFilterWbs:"wbsId",activityFilterZone:"zone",activityFilterFloor:"floor",activityFilterTower:"tower",activityFilterBuilding:"building",activityFilterArea:"area",activityFilterWorkFront:"workFront",activityFilterPhase:"phase",activityFilterSection:"section",activityFilterChainage:"chainage",activityFilterDiscipline:"discipline",activityFilterTrade:"trade",activityFilterSystem:"system",activityFilterPackage:"package",activityFilterCbs:"cbs",activityFilterContractor:"contractor",activityFilterSubcontractor:"subcontractor",activityFilterStatus:"status",activityFilterCriticality:"criticality",activityFilterCondition:"scheduleCondition"};
function activityFilterStorageKey(){return "cmeng-activity-scope:"+project();}
function projectScopeStorageKey(){return "cmeng-project-scope:"+project();}
function currentProjectScopeContext(){let scope={};try{scope=JSON.parse(localStorage.getItem(projectScopeStorageKey())||"{}")||{};}catch{}return scope&&typeof scope==="object"&&!Array.isArray(scope)?scope:{};}
function saveActivityFilters(){const values={},scope={};activityFilterIds.forEach(id=>{const value=activityFilterValue(id);if(value){values[id]=value;const key=projectScopeFilterMap[id];if(key)scope[key]=value;}});try{localStorage.setItem(activityFilterStorageKey(),JSON.stringify(values));localStorage.setItem(projectScopeStorageKey(),JSON.stringify(scope));}catch{}}
function restoreActivityFilters(){let values={};try{values=JSON.parse(localStorage.getItem(activityFilterStorageKey())||"{}")||{};}catch{}const shared=currentProjectScopeContext();for(const [id,key] of Object.entries(projectScopeFilterMap))if(!values[id]&&shared[key])values[id]=shared[key];activityFilterIds.forEach(id=>{const node=el(id),value=values[id];if(!node||!value)return;if(node.tagName==="SELECT"&&![...node.options].some(option=>option.value===value))return;node.value=value;});filterActivityReview();}
function clearActivityFilters(){
  activityFilterIds.forEach(id=>{const node=el(id);if(node)node.value="";});
  try{localStorage.removeItem(activityFilterStorageKey());localStorage.removeItem(projectScopeStorageKey());}catch{}
  filterActivityReview();
}
function filterActivityReview(){
  if((currentModuleResult?.legacyKey||currentModuleResult?.key)!=="activity-analytics")return;
  const p=projectionFor(currentModuleResult.data||{},"activity_analytics"),body=el("activityFilterBody"),count=el("activityFilterCount");
  if(!body||!Array.isArray(p.rows))return;
  const q=activityFilterValue("activityFilterSearch").toLowerCase();
  const exact=(id,key,row)=>{const wanted=activityFilterValue(id);return !wanted||String(row[key]??"")===wanted;};
  const floorWanted=activityFilterValue("activityFilterFloor");
  const condition=activityFilterValue("activityFilterCondition");
  let rows=p.rows.filter(row=>!["level_of_effort","wbs_summary"].includes(row.activityType)).filter(row=>{
    if(q&&!String([row.activityId,row.name,row.wbsId,row.wbsPath,row.location,row.zone,row.floor,row.level,row.tower,row.building,row.area,row.workFront,row.phase,row.section,row.chainage,row.discipline,row.trade,row.system,row.package,row.cbs,row.contractor,row.subcontractor].filter(Boolean).join(" ")).toLowerCase().includes(q))return false;
    if(!exact("activityFilterWbs","wbsId",row)||!exact("activityFilterZone","zone",row)||!exact("activityFilterTower","tower",row)||!exact("activityFilterBuilding","building",row)||!exact("activityFilterArea","area",row)||!exact("activityFilterWorkFront","workFront",row)||!exact("activityFilterPhase","phase",row)||!exact("activityFilterSection","section",row)||!exact("activityFilterChainage","chainage",row)||!exact("activityFilterDiscipline","discipline",row)||!exact("activityFilterTrade","trade",row)||!exact("activityFilterSystem","system",row)||!exact("activityFilterPackage","package",row)||!exact("activityFilterCbs","cbs",row)||!exact("activityFilterContractor","contractor",row)||!exact("activityFilterSubcontractor","subcontractor",row)||!exact("activityFilterStatus","status",row)||!exact("activityFilterCriticality","criticality",row))return false;
    if(floorWanted&&String(row.floor??row.level??"")!==floorWanted)return false;
    if(condition==="delayed"&&row.scheduleDelayed!==true)return false;
    if(condition==="missed_start"&&row.missedPlannedStart!==true)return false;
    if(condition==="overdue_finish"&&row.finishOverdue!==true)return false;
    if(condition==="negative_float"&&!(typeof row.totalFloatHours==="number"&&row.totalFloatHours<0))return false;
    if(condition==="zero_float"&&row.totalFloatHours!==0)return false;
    if(condition==="float_risk"&&row.floatRiskWatchlist!==true)return false;
    if(condition==="open_logic"&&!(row.openStart||row.openFinish||row.isolated))return false;
    return true;
  });
  rows.sort((a,b)=>{const as=(a.scheduleDelayed?1500:0)+(a.criticality==="critical"?1000:a.criticality==="near_critical"?500:0)+(a.totalFloatHours<0?200:0)+(a.finishVarianceDays>0?a.finishVarianceDays:0);const bs=(b.scheduleDelayed?1500:0)+(b.criticality==="critical"?1000:b.criticality==="near_critical"?500:0)+(b.totalFloatHours<0?200:0)+(b.finishVarianceDays>0?b.finishVarianceDays:0);return bs-as||String(a.activityId).localeCompare(String(b.activityId));});
  if(count)count.textContent=fmt(rows.length)+" of "+fmt(p.rows.filter(r=>!["level_of_effort","wbs_summary"].includes(r.activityType)).length)+" execution activities";
  body.innerHTML=rows.slice(0,500).map(activityReviewRowHtml).join("")||'<tr><td colspan="13">No activities match the selected filters.</td></tr>';
  saveActivityFilters();
}
function renderActivityAnalyticsVisual(data){
  const rowHtml=a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span><br><span class="muted">'+escapeHtml(a.wbsPath||a.wbsId||"")+'</span></td>'+
    '<td>'+escapeHtml(a.zone||"—")+'</td><td>'+escapeHtml(a.floor||a.level||"—")+'</td><td>'+escapeHtml(a.discipline||"—")+'</td><td>'+escapeHtml(a.package||"—")+'</td>'+
    '<td>'+escapeHtml(planningStateLabel(a.status))+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(planningStateLabel(a.criticality))+'</span></td>'+
    '<td>'+escapeHtml(planningShortDate(a.currentStartIso))+'</td><td>'+escapeHtml(planningShortDate(a.currentFinishIso))+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td>'+
    '<td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(a.finishVarianceDays===null?"Unresolved":fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.delayStatus||"—")+'</td></tr>';
  const p=projectionFor(data,"activity_analytics");
  if(!Array.isArray(p.rows))return"";
  const executionRows=p.rows.filter(row=>!["level_of_effort","wbs_summary"].includes(row.activityType));
  const status={completed:0,in_progress:0,not_started:0,unknown:0};
  executionRows.forEach(r=>{status[r.status]=(status[r.status]||0)+1});
  const criticalKnown=executionRows.filter(r=>r.criticality==="critical").length;
  const critical=p.counts?p.counts.critical.value:aggregateCount(executionRows,r=>r.totalFloatHours==null?null:r.criticality==="critical").value;
  const nearKnown=executionRows.filter(r=>r.criticality==="near_critical").length;
  const near=p.counts?p.counts.nearCritical.value:aggregateCount(executionRows,r=>r.criticality==="unknown"||r.criticality==null||r.floatRiskWatchlist===null?null:r.criticality==="near_critical").value;
  const unknownCriticality=executionRows.filter(r=>r.criticality==="unknown").length;
  const noncritical=executionRows.filter(r=>r.criticality==="noncritical").length;
  const floatRisk=p.counts?p.counts.floatRisk.value:aggregateCount(executionRows,r=>r.floatRiskWatchlist).value;
  const late=p.counts?p.counts.late.value:aggregateCount(executionRows,r=>typeof r.finishVarianceDays==="number"?r.finishVarianceDays>0:null).value;
  const openLogic=executionRows.filter(r=>r.openStart||r.openFinish||r.isolated).length;
  const kpis=planningKpis([
    ["Execution activities",executionRows.length,"detail population for filtering and drill-down"],["Source records retained",p.rows.length,"full auditable register"],["Excluded execution types",p.rows.length-executionRows.length,"LOE and WBS summaries retained outside execution analysis"],
    ["Completed",status.completed,"activities","success"],
    ["In progress",status.in_progress,"activities","accent"],
    ["Critical",critical,"activities","danger"],
    ["Near-critical",near,"Near-critical float band","warning"],
    ["Float-risk watchlist",floatRisk,"includes critical boundary","accent"],
    ["Later than baseline",late,"requires comparable dates for every execution activity","danger"],
    ["Unresolved criticality",unknownCriticality,"execution activities awaiting classification"]
  ]);
  const repeatedMovementWarning="";
  const topLate=[...p.rows].filter(r=>typeof r.finishVarianceDays==="number").sort((a,b)=>b.finishVarianceDays-a.finishVarianceDays).slice(0,5).map(r=>({label:r.activityId+" · "+(r.name||""),value:r.finishVarianceDays}));
  const pressure=planningActivityPressure(p.rows);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Execution status","Activities by current status.",renderDonutChart([
      {label:"Completed",value:status.completed||0,tone:"success"},
      {label:"In progress",value:status.in_progress||0,tone:"accent"},
      {label:"Not started",value:status.not_started||0,tone:"neutral"},
      {label:"Unknown",value:status.unknown||0,tone:"warning"}
    ],"Activities"))+
    renderVisualPanel("Criticality classification","Mutually exclusive critical and near-critical classifications. Float-risk watchlist membership is tracked separately.",renderDonutChart([
      {label:"Confirmed critical",value:criticalKnown,tone:"danger"},
      {label:"Confirmed near-critical",value:nearKnown,tone:"warning"},
      {label:"Non-critical",value:noncritical,tone:"neutral"},
      {label:"Unknown",value:unknownCriticality,tone:"graphite"}
    ],"Activities"))+
  '</div>';
  const statusBand=planningStatusBand([
    ["Completed",status.completed,"success"],["In progress",status.in_progress,"accent"],["Not started",status.not_started,"neutral"],["Unknown",status.unknown,"warning"]
  ]);
  const ranked=[...executionRows].sort((a,b)=>{
    const as=(a.scheduleDelayed?1500:0)+(a.criticality==="critical"?1000:a.criticality==="near_critical"?500:0)+(a.finishVarianceDays>0?a.finishVarianceDays:0)+(a.totalFloatHours<0?200:0);
    const bs=(b.scheduleDelayed?1500:0)+(b.criticality==="critical"?1000:b.criticality==="near_critical"?500:0)+(b.finishVarianceDays>0?b.finishVarianceDays:0)+(b.totalFloatHours<0?200:0);
    return bs-as||String(a.activityId).localeCompare(String(b.activityId));
  }).slice(0,500);
  const rows=ranked.map(rowHtml).join("");
  const options=key=>[...new Set(executionRows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined&&String(v).trim()))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  const select=(id,label,key,custom=null)=>'<label>'+escapeHtml(label)+'<select id="'+id+'" onchange="filterActivityReview()"><option value="">All</option>'+((custom||options(key)).map(v=>'<option value="'+escapeHtml(String(Array.isArray(v)?v[0]:v))+'">'+escapeHtml(String(Array.isArray(v)?v[1]:v))+'</option>').join(""))+'</select></label>';
  const floors=[...new Set(executionRows.map(r=>r.floor??r.level).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  const filterPanel='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Filter activities</h4><p>Filter the full execution population by schedule status and source/source-derived project scope. Unclassified activities remain visible when no scope filter is selected.</p></div><b id="activityFilterCount">'+fmt(executionRows.length)+' of '+fmt(executionRows.length)+' execution activities</b></div><div class="planning-panel-body"><div class="scope-filter-grid">'+
    '<label>Search<input id="activityFilterSearch" placeholder="Activity ID, name, WBS, zone…" oninput="filterActivityReview()"></label>'+
    select("activityFilterWbs","WBS","wbsId")+select("activityFilterZone","Zone","zone")+select("activityFilterFloor","Floor / level","floor",floors)+select("activityFilterTower","Tower","tower")+select("activityFilterBuilding","Building","building")+select("activityFilterArea","Area","area")+select("activityFilterWorkFront","Work front","workFront")+
    select("activityFilterPhase","Phase","phase")+select("activityFilterSection","Section","section")+select("activityFilterChainage","Chainage","chainage")+select("activityFilterDiscipline","Discipline","discipline")+select("activityFilterTrade","Trade","trade")+select("activityFilterSystem","System","system")+select("activityFilterPackage","Package","package")+select("activityFilterCbs","CBS","cbs")+select("activityFilterContractor","Contractor","contractor")+select("activityFilterSubcontractor","Subcontractor","subcontractor")+
    select("activityFilterStatus","Status","status")+select("activityFilterCriticality","Criticality","criticality")+
    select("activityFilterCondition","Schedule condition","",[["delayed","Delayed / schedule pressure"],["missed_start","Missed start"],["overdue_finish","Overdue finish"],["negative_float","Negative float"],["zero_float","Zero float"],["float_risk","Float-risk watchlist"],["open_logic","Open / isolated logic"]])+
    '<button class="btn small" type="button" onclick="clearActivityFilters()">Clear filters</button></div></div></section>';
  return '<section class="planning-view activity-review"><div class="notice info"><b>Activity Review = detailed investigation.</b><p>Use the filters below to inspect individual activities by WBS, zone, package, discipline, status and schedule condition. Programme-level conclusions remain in Programme Review and Management Brief.</p></div>'+kpis+filterPanel+repeatedMovementWarning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish movement & float matrix</h4><p>Activity counts by controlled-baseline finish movement and submitted programme total float.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>'+escapeHtml(fmt(openLogic))+' activities also have an open or isolated logic condition.</p></div></div><div class="planning-panel-body">'+statusBand+'<div class="coverage-stack"><span>Source progress-field coverage <b>'+escapeHtml(p.percentCompleteCoveragePercent===null?"—":fmt(p.percentCompleteCoveragePercent)+"%")+'</b></span><span>Source float-field coverage <b>'+escapeHtml(p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%")+'</b></span><span>Source baseline-comparison coverage <b>'+escapeHtml(p.finishVarianceCoveragePercent===null?"—":fmt(p.finishVarianceCoveragePercent)+"%")+'</b></span></div></div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest activity finish movements vs controlled baseline</h4><p>Each activity is compared with its own controlled-baseline finish.</p></div></div><div class="planning-panel-body">'+renderMovementConcentration(p.movementAnalysis,topLate)+distributionSummary(p.movementDistribution)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity register</h4><p>Full execution population is filterable above. Up to 500 matching rows are shown on screen; project exports retain the complete source population.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity / WBS</th><th>Zone</th><th>Floor / level</th><th>Discipline</th><th>Package</th><th>Status</th><th>Criticality</th><th>Current start</th><th>Current finish</th><th>Progress</th><th>Total float h</th><th>Vs baseline d</th><th>Delay state</th></tr></thead><tbody id="activityFilterBody">'+rows+'</tbody></table></div></div></section></section>';
}

function moduleBarList(items,tone="accent",unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value));
  if(!rows.length)return '<div class="empty-visual">No comparable values are established for this chart.</div>';
  const max=unit.trim()==="%"?100:Math.max(1,...rows.map(item=>Math.max(0,item.value)));
  return '<div class="module-bar-list">'+rows.map(item=>'<div class="module-bar-row"><span title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</span><div><i class="'+escapeHtml(item.tone||tone)+'" style="width:'+Math.min(100,Math.max(0,(Math.max(0,item.value)/max)*100)).toFixed(2)+'%"></i></div><b>'+escapeHtml((unit.trim()==="%"?percent2(item.value):fmt(item.value))+(unit?" "+unit:""))+'</b></div>').join("")+'</div>';
}
function progressBasisDisplay(key,basis){
  if(key==="baselinePlanned")return "Baseline planned";
  if(key==="currentSchedule")return "Current programme plan";
  if(key==="physical")return "Physical progress";
  if(key==="scheduleSnapshot")return "Schedule progress snapshot";
  if(key==="contractorReported")return "Contractor reported";
  if(key==="certified")return "Certified progress";
  return humanizeKey(key);
}
function progressBasisBars(bases){
  const entries=Object.entries(bases||{});
  if(!entries.length)return '<div class="empty-visual">No progress basis is established.</div>';
  return '<div class="progress-basis-bars">'+entries.map(([key,basis])=>{
    const value=typeof basis?.valuePercent==="number"?basis.valuePercent:null;
    const label=progressBasisDisplay(key,basis);
    const authority=basis?.authority==="progress_snapshot"?"schedule snapshot":basis?.authority==="deterministic_schedule"?"schedule calculation":basis?.authority==="source_evidence"?"source record":"not provided";
    return '<div class="progress-basis-row"><div><b>'+escapeHtml(label)+'</b><span>'+escapeHtml(authority)+(basis?.asOfIso?" · "+planningShortDate(basis.asOfIso):"")+'</span></div><div class="progress-track"><i style="width:'+(value===null?0:Math.max(0,Math.min(100,value))).toFixed(2)+'%"></i></div><strong>'+escapeHtml(value===null?"—":percent2(value)+"%")+'</strong></div>';
  }).join("")+'</div>';
}
function moduleEvidenceGate(items){
  return '<div class="evidence-gates">'+items.map(item=>'<div class="evidence-gate '+escapeHtml(item.state||"missing")+'"><span>'+escapeHtml(item.label)+'</span><b>'+escapeHtml(item.value)+'</b></div>').join("")+'</div>';
}
function shortRevision(value,labels){
  return labels?.[value]?planningRevisionLabel(labels[value]):planningRevisionLabel(value);
}
function readableWindow(value,labels){
  const parts=String(value||"").split("->");
  if(parts.length!==2)return String(value||"—");
  return shortRevision(parts[0],labels)+" → "+shortRevision(parts[1],labels);
}

function renderResourceBasisReview(b){
  if(!b)return "";
  const w=b.weekly||{},x=b.xer||{},h=b.hse||{},pr=b.programme||{};
  const row=(basis,plan,actual,remaining,scope)=>'<tr><td>'+escapeHtml(basis)+'</td><td>'+escapeHtml(fmt(plan))+'</td><td>'+escapeHtml(fmt(actual))+'</td><td>'+escapeHtml(fmt(remaining))+'</td><td>'+escapeHtml(scope)+'</td></tr>';
  return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Hour totals disagree across the supplied bases</h4><p>'+escapeHtml(b.interpretation)+'</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Source basis</th><th>Planned hours</th><th>Recorded hours</th><th>Remaining / future plan</th><th>Boundary</th></tr></thead><tbody>'+row('Weekly labor register',w.plannedHours,w.actualHoursToDate,w.futurePlannedHours,fmt(w.periodCount)+' weeks; actual usage through DD, future hours are planned')+row('XER labor assignments',x.plannedLaborHours,x.actualRegularLaborHours,x.remainingLaborHours,fmt(x.laborAssignmentCount)+' assignments; actual regular hours; overtime '+(x.actualOvertimeLaborHours==null?'not supplied':fmt(x.actualOvertimeLaborHours)))+row('HSE exposure report',null,h.metrics?.manHours,null,'Reported period ends '+planningShortDate(h.periodEndIso)+'; monthly/cumulative exposure basis needs confirmation')+'</tbody></table></div><p>Register: '+escapeHtml(planningShortDate(w.firstWeekStartIso))+' to week starting '+escapeHtml(planningShortDate(w.lastWeekStartIso))+'. Programme: '+escapeHtml(planningShortDate(pr.startIso))+' to '+escapeHtml(planningShortDate(pr.finishIso))+' (about '+fmt(pr.calendarWeekSpan)+' calendar weeks).</p>'+(pr.registerEndsBeforeProgramme?'<div class="notice warn">The register ends before the programme. Its total planned hours are not a full-project total; 100% row coverage does not mean 100% programme coverage.</div>':'')+'</div></section>';
}
function renderResourceVisual(data){
  const p=projectionFor(data,"resource_utilization");
  if(!Array.isArray(p.rows)){
    return visualSection("Resources","Resource demand and capacity are kept separate so missing capacity is never treated as zero.","Review needed",'<div class="notice warn">Resource assignments or capacity evidence are not confirmed for the current programme.</div>');
  }
  const weekly=p.weeklyCapacityEvidence||null;
  const checks=weekly?.capacityChecksToDataDate;
  const weeklyGroups=weekly?.weeklyTotals?.reduce((map,row)=>{
    const unit=row.unit||"UNSPECIFIED";
    const list=map.get(unit)||[];
    list.push({dateIso:row.weekStartIso,availableCapacity:row.availableCapacity,plannedDemand:row.plannedDemand,actualApprovedUsage:row.actualApprovedUsage});
    map.set(unit,list);
    return map;
  },new Map())||new Map();

  const capacityKnown=Number(p.perHourCapacityBasedResourceCount??p.capacityBasedResourceCount??0);
  const capacityEligibleRows=(p.rows||[]).filter(r=>r.capacityEligible!==false&&(r.businessClass==="labor"||r.businessClass==="equipment"||!r.businessClass));
  const excludedCapacityRows=(p.rows||[]).filter(r=>!capacityEligibleRows.includes(r));
  const assessed=Number(p.assessedOverloadResourceCount??capacityKnown);
  const weeklyRows=Number(weekly?.rowCount||0);
  const weeklyComparable=Number(weekly?.comparableRowCount||0);
  const weeklyOver=Number(weekly?.overloadedRowCount||0);
  const weeklyUnits=Array.isArray(weekly?.unitLabels)?weekly.unitLabels:[];
  const perHourCapacityText=capacityKnown>0?fmt(capacityKnown)+" / "+fmt(p.assignedResourceCount):"Unresolved";
  const overloadValue=assessed>0?fmt(p.perHourOverloadedResourceCount??p.overloadedResourceCount):"Not assessable";

  const comparableDemand=[...capacityEligibleRows].map(r=>{
    const value=typeof r.peakRemainingUnitsPerHour==="number"
      ? r.peakRemainingUnitsPerHour
      : typeof r.peakPlannedUnitsPerHour==="number"
        ? r.peakPlannedUnitsPerHour
        : null;
    return value===null?null:{
      label:(r.resourceId||"")+" · "+(r.resourceName||""),
      value,
      tone:r.overloaded===true?"danger":r.state==="capacity_based"?"accent":"warning"
    };
  }).filter(Boolean).sort((a,b)=>b.value-a.value).slice(0,12);

  const kpis=planningKpis([
    ["P6 resource master",p.p6ResourceMasterCount??p.resourceCount,"schedule resource definitions"],["Weekly observed resources",p.weeklyObservedResourceCount,"Resources in the capacity register"],
    ["Assigned",p.assignedResourceCount,"with schedule assignments"],
    ["Weekly register-row coverage",weekly?.capacityCoveragePercent==null?"Unresolved":fmt(weekly.capacityCoveragePercent)+"%","applicable resource-week rows"],
    ["Planned utilization",weekly?.plannedAverageToDataDate==null?"Unresolved":fmt(weekly.plannedAverageToDataDate)+"%","mean resource-week ratio to Data Date"],
    ["Actual utilization",weekly?.actualAverageToDataDate==null?"Unresolved":fmt(weekly.actualAverageToDataDate)+"%","approved usage to Data Date"],
    ["Per-hour capacity",perHourCapacityText,"resources with comparable rate",capacityKnown?"accent":"warning"],
    ["Weekly comparable checks",weeklyRows?fmt(weeklyComparable)+" / "+fmt(weeklyRows):"Unresolved","rows with established capacity and demand",weeklyComparable?"accent":"warning"],
    ["Actual over capacity",checks?.actual?.comparableCount?fmt(checks.actual.exceededCount)+" / "+fmt(checks.actual.comparableCount):"Not assessable","comparable resource-weeks through Data Date",checks?.actual?.exceededCount?"warning":""],
    ["Planned over capacity",checks?.planned?.comparableCount?fmt(checks.planned.exceededCount)+" / "+fmt(checks.planned.comparableCount):"Not assessable","comparable resource-weeks through Data Date",checks?.planned?.exceededCount?"warning":""],
    ["Capacity units",weeklyUnits.length?weeklyUnits.map(resourceUnitLabel).join(" / "):"Unresolved","kept separate by source unit",weeklyUnits.length?"":"warning"]
  ]);

  const rows=[...p.rows].sort((a,b)=>(a.overloaded===true?0:a.state!=="capacity_based"?1:2)-(b.overloaded===true?0:b.state!=="capacity_based"?1:2)).map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(humanizeKey(r.businessClass||r.resourceType))+'</td><td>'+escapeHtml(r.assignmentCount)+'</td><td>'+escapeHtml(fmt(r.capacityUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakPlannedUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakRemainingUnitsPerHour))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"—":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.remainingUtilizationPercent===null?"—":fmt(r.remainingUtilizationPercent)+"%")+'</td><td><span class="state-pill '+(r.overloaded===true?"blocked":r.state==="capacity_based"?"ready":"review")+'">'+escapeHtml(r.state==="not_capacity_resource"?"Not a capacity resource":r.overloaded===true?"Overloaded":r.state==="capacity_based"?"Capacity assessed":"Capacity not set")+'</span></td></tr>').join("");
  const managementRows=[...capacityEligibleRows].sort((a,b)=>(b.remainingCapacityGapUnitsPerHour??-Infinity)-(a.remainingCapacityGapUnitsPerHour??-Infinity)||(b.peakRemainingUnitsPerHour??0)-(a.peakRemainingUnitsPerHour??0)).map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(humanizeKey(r.businessClass||r.resourceType))+'</td><td>'+escapeHtml(r.peakRemainingUnitsPerHour==null?"Not established":fmt(r.peakRemainingUnitsPerHour)+"/h")+'</td><td>'+escapeHtml(r.capacityUnitsPerHour==null?"Not established":fmt(r.capacityUnitsPerHour)+"/h")+'</td><td class="'+((r.remainingCapacityGapUnitsPerHour??0)>0?"late-text":"")+'">'+escapeHtml(r.remainingCapacityGapUnitsPerHour==null?"Not assessable":(r.remainingCapacityGapUnitsPerHour>0?"+":"")+fmt(r.remainingCapacityGapUnitsPerHour)+"/h")+'</td><td>'+escapeHtml(r.peakRemainingAtIso?planningShortDate(r.peakRemainingAtIso):"Not established")+'</td><td>'+escapeHtml((r.affectedWbsIds||[]).join("; ")||(r.affectedActivityIds||[]).slice(0,4).join("; ")||"Not linked")+'</td><td>'+escapeHtml(r.programmeEffect||"Programme effect not established")+'</td><td>'+escapeHtml(r.managementAction||"Monitor resource demand.")+'</td></tr>').join("");
  const excludedClassSummary=excludedCapacityRows.length?'<div class="notice info"><b>'+escapeHtml(fmt(excludedCapacityRows.length))+' non-capacity resource definitions excluded from crew/equipment utilization math.</b><p>'+escapeHtml(Object.entries(p.businessClassCounts||{}).filter(([key])=>!["labor","equipment"].includes(key)).map(([key,value])=>humanizeKey(key)+": "+fmt(value)).join(" · "))+'</p><p>Cost, quantity, material and physical-weight/progress resources remain visible in the detailed register but are not treated as labour or equipment capacity.</p></div>':"";

  const perHourNote=capacityKnown===0
    ? '<div class="notice warn"><b>Per-hour overload is not 0; it is not assessable.</b> The XER contains resource assignments but no usable max-units-per-hour capacity for the assigned resources. CMeng therefore leaves utilization blank instead of assuming zero or unlimited capacity.</div>'
    : p.capacityCoveragePercent<100
      ? '<div class="notice info">Per-hour utilization is calculated only for resources with established capacity. The remaining resources stay unassessed.</div>'
      : '';

  const weeklyNote=weeklyComparable
    ? '<div class="notice info"><b>Full register period, including future planned weeks:</b> '+escapeHtml(fmt(weeklyOver))+' demand-above-capacity row checks out of '+escapeHtml(fmt(weeklyComparable))+' comparable weekly rows. '+escapeHtml(fmt(p.weeklyOverloadedResourceCount))+' distinct resources have at least one exceedance. Use the separate through-Data-Date figures above for the current position; future planned weeks are excluded from those figures.</div>'
    : '';

  const aggregateCharts=weeklyGroups.size
    ? [...weeklyGroups.entries()].map(([unit,points])=>'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Weekly capacity vs demand · '+escapeHtml(resourceUnitLabel(unit))+'</h4><p>Available capacity, planned demand and approved usage from the source register. Different units are never added together.</p></div><span class="badge '+(weekly?.state==="available"?"ready":"partial")+'">'+escapeHtml(weekly?.state==="candidate"?"Source candidate":humanizeKey(weekly?.state||"partial"))+'</span></div><div class="planning-panel-body">'+renderLineChart(points,[
        {key:"availableCapacity",label:"Available capacity",color:"#506579"},
        {key:"plannedDemand",label:"Planned demand",color:"#b57922"},
        {key:"actualApprovedUsage",label:"Approved actual usage",color:"#2c7a57"}
      ],null,{unit:unit,yLabel:"Capacity / demand",xLabel:"Week"})+'</div></section>').join("")
    : '';

  const weeklyChart=p.basisComparison?.capacityExceptionTrend?.length?renderVisualPanel("Resources exceeding their own capacity each week","Counts of individual resource exceptions. Spare capacity in other resources cannot offset these checks; future planned counts remain a plan.",renderLineChart(p.basisComparison.capacityExceptionTrend,[{key:"plannedExceeded",label:"Planned exceptions",color:"#b57922"},{key:"actualExceeded",label:"Approved usage exceptions through DD",color:"#b4483e"}],null,{unit:"resources",yLabel:"Resources above capacity",xLabel:"Week",dataDateIso:p.dataDateIso,ariaLabel:"Individual resource capacity exceptions"}))+ '<details class="source-scope"><summary>Aggregate capacity and demand by unit</summary>'+aggregateCharts+'</details>':aggregateCharts;
  const demandPanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Per-hour demand concentration</h4><p>Only resources with an established planned or remaining demand rate are charted. Assignment counts are not used as a substitute for demand.</p></div></div><div class="planning-panel-body">'+moduleBarList(comparableDemand)+'</div></section>';

  const fullWeeklyDetail=weekly?.resourceSummaries?.length?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Weekly resource utilization detail</h4><p>Means of comparable resource-week ratios on or before '+escapeHtml(planningShortDate(weekly.dataDateIso))+'. Source units and resource classes stay separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Class</th><th>Unit</th><th>Full-horizon periods</th><th>Plan periods to Data Date</th><th>Actual periods to Data Date</th><th>Planned utilization</th><th>Actual utilization</th></tr></thead><tbody>'+weekly.resourceSummaries.map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br>'+escapeHtml(r.resourceName||"")+'</td><td>'+escapeHtml(r.resourceClass)+'</td><td>'+escapeHtml(r.unit||"Unresolved")+'</td><td>'+escapeHtml(fmt(r.periodCount))+'</td><td>'+escapeHtml(fmt(r.plannedPeriodCountToDataDate))+'</td><td>'+escapeHtml(fmt(r.actualPeriodCountToDataDate))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"Unresolved":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.actualUtilizationPercent===null?"Unresolved":fmt(r.actualUtilizationPercent)+"%")+'</td></tr>').join("")+'</tbody></table></div></div></section>':"";
  const exceptions=[...(weekly?.resourceSummaries||[])].sort((a,b)=>b.actualOverloadOccurrencesToDataDate-a.actualOverloadOccurrencesToDataDate||(b.peakActualPercentToDataDate??-1)-(a.peakActualPercentToDataDate??-1)||b.plannedOverloadOccurrences-a.plannedOverloadOccurrences);
  const weeklyDetail=exceptions.length?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Resources with the most capacity exceptions first</h4><p>Actual exceptions stop at the Data Date. Planned exceptions cover the supplied register horizon. Means and repeated period columns remain in the complete register below.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Actual weeks above capacity</th><th>Peak actual</th><th>Worst actual week</th><th>Planned weeks above capacity</th><th>Peak plan</th></tr></thead><tbody>'+exceptions.map(r=>'<tr><td>'+escapeHtml(r.resourceId+' · '+(r.resourceName||''))+'</td><td>'+fmt(r.actualOverloadOccurrencesToDataDate)+'</td><td>'+percent2(r.peakActualPercentToDataDate)+'%</td><td>'+escapeHtml(planningShortDate(r.worstActualWeekIso))+'</td><td>'+fmt(r.plannedOverloadOccurrences)+'</td><td>'+percent2(r.peakPlannedPercent)+'%</td></tr>').join('')+'</tbody></table></div><details><summary>Complete source resource summary and period coverage</summary>'+fullWeeklyDetail+'</details></div></section>':'';
  return '<section class="planning-view resource-view">'+kpis+excludedClassSummary+
    '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Labour & equipment capacity control</h4><p>Required remaining-work peak → available capacity → gap → peak date → affected scope → action. Non-capacity resource classes are excluded from this calculation.</p></div></div><div class="planning-panel-body">'+(managementRows?'<div class="table-wrap"><table><thead><tr><th>Resource</th><th>Class</th><th>Required peak</th><th>Available</th><th>Gap</th><th>Peak</th><th>Affected scope</th><th>Programme effect</th><th>Action</th></tr></thead><tbody>'+managementRows+'</tbody></table></div>':'<div class="notice info">No labour/equipment assignment population is available for capacity control.</div>')+'</div></section>'+
    renderResourceBasisReview(p.basisComparison)+perHourNote+weeklyNote+weeklyChart+weeklyDetail+'<div class="planning-primary-grid">'+demandPanel+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Capacity evidence</h4><p>Per-hour schedule capacity and weekly register capacity are shown as separate evidence bases.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Schedule assignments",value:p.assignedResourceCount+" resources",state:p.assignedResourceCount>0?"ready":"missing"},
    {label:"P6 max-units/hour capacity",value:capacityKnown>0?capacityKnown+" resources":"Unresolved",state:capacityKnown>0?"ready":"missing"},
    {label:"Weekly capacity register",value:weeklyComparable?fmt(weeklyComparable)+" comparable rows":"Unresolved",state:weeklyComparable?"ready":"missing"},
    {label:"Per-hour overload assessment",value:overloadValue,state:assessed>0?"ready":"missing"}
  ])+'</div></section></div><details class="planning-panel"><summary class="planning-panel-head"><div><h4>Complete P6 resource register</h4><p>Overloaded and unassessed resources appear first. Capacity and utilization remain blank when not confirmed; assignment, headcount and hour units are not interchangeable.</p></div></summary><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Business class</th><th>Assignments</th><th>Capacity/hr</th><th>Peak planned/hr</th><th>Peak remaining/hr</th><th>Planned util.</th><th>Remaining util.</th><th>Assessment</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></details></section>';
}
function renderProgressReportVisual(data){
  const p=projectionFor(data,"progress_report");
  if(!p.progressBases)return"";
  const snapshot=p.progressBases.scheduleSnapshot;
  const displayDifference=displayPercentDifference;
  const current=p.progressBases.currentPlanned||p.progressBases.currentSchedule;
  const snapshotGap=displayDifference(snapshot?.valuePercent,current?.valuePercent);
  const baseline=p.progressBases.baselinePlanned;
  const physical=p.progressBases.physical;
  const contractor=p.progressBases.contractorReported;
  const certified=p.progressBases.certified;
  const earned=p.progressBases.earnedValue;
  const headline=p.headlineProgress||{key:"missing",label:"Achieved progress",valuePercent:null,basis:"No achieved-progress evidence is established."};
  const planMovement=displayDifference(current?.valuePercent,baseline?.valuePercent);
  const progressMovement=displayDifference(physical?.valuePercent,baseline?.valuePercent);
  const progressVarianceLabel="Physical progress vs baseline";
  const sourceProgressEstablished=typeof contractor?.valuePercent==="number"||typeof certified?.valuePercent==="number"||(physical?.authority==="source_evidence"&&typeof physical?.valuePercent==="number");
  const physicalLabel="Physical progress";
  const kpis=planningKpis([
    ["Achieved progress",headline.valuePercent==null?"Not established":percent2(headline.valuePercent)+"%",headline.label+" · "+headline.basis,headline.valuePercent==null?"warning":"success"],
    ["Baseline plan · original scope",baseline?.valuePercent==null?"Unresolved":percent2(baseline.valuePercent)+"%","baseline activity population"],
    ["Current plan · current scope",current?.valuePercent==null?"—":percent2(current.valuePercent)+"%","contains actual dates; not an independent comparator"],
    ["Snapshot · current scope",snapshot?.valuePercent==null?"—":percent2(snapshot.valuePercent)+"%","duration-weighted source percent complete"],
    ...[[physicalLabel,physical],["Contractor reported",contractor],["Certified progress",certified],["Earned-value progress",earned]].filter(x=>typeof x[1]?.valuePercent==="number").map(x=>[x[0],percent2(x[1].valuePercent)+"%","separate source basis"])
  ]);
  const warning=!sourceProgressEstablished?'<div class="notice warn"><b>The programme contains a percentage-complete snapshot, but certified/contractor physical progress is not confirmed.</b> CMeng keeps the schedule snapshot separate from certified or independently sourced physical progress.</div>':'';
  const status=planningStatusBand([
    ["Completed",p.progress?.completedCount||0,"success"],
    ["In progress",p.progress?.inProgressCount||0,"accent"],
    ["Not started",p.progress?.notStartedCount||0,"neutral"],
    ["Unknown",p.progress?.unknownStatusCount||0,"warning"]
  ]);
  const pressure=planningStatusBand([
    ["Critical",p.schedule?.criticalCount,"danger"],
    ["Near-critical",p.schedule?.nearCriticalCount,"warning"]
  ]);
  const progressChart=renderVisualBars([
    {label:"Baseline planned",value:typeof baseline?.valuePercent==="number"?baseline.valuePercent:null,tone:"graphite"},
    {label:"Current programme plan",value:typeof current?.valuePercent==="number"?current.valuePercent:null,tone:"accent"},
    {label:"Schedule snapshot",value:snapshot?.valuePercent??null,tone:"warning"},
    {label:physicalLabel,value:typeof physical?.valuePercent==="number"?physical.valuePercent:null,tone:"teal"},
    {label:"Contractor reported",value:typeof contractor?.valuePercent==="number"?contractor.valuePercent:null,tone:"warning"},
    {label:"Certified progress",value:typeof certified?.valuePercent==="number"?certified.valuePercent:null,tone:"success"},
    {label:"Earned-value progress",value:typeof earned?.valuePercent==="number"?earned.valuePercent:null,tone:"purple"}
  ].filter(item=>item.value!==null),"%");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Progress basis comparison","Source percentages use different populations and weights; this chart is not a performance-gap calculation.",progressChart)+
    renderVisualPanel("Activity status","Current programme execution status.",renderDonutChart([
      {label:"Completed",value:p.progress?.completedCount||0,tone:"success"},
      {label:"In progress",value:p.progress?.inProgressCount||0,tone:"accent"},
      {label:"Not started",value:p.progress?.notStartedCount||0,tone:"neutral"},
      {label:"Unknown",value:p.progress?.unknownStatusCount||0,tone:"warning"}
    ],"Activities"))+
  '</div>';
  return '<section class="planning-view progress-position-view">'+renderProgressScope(p.scopeComparison)+kpis+warning+visualOverview+'<details class="source-scope"><summary>All progress bases and schedule pressure</summary><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Progress bases</h4><p>Baseline plan, current planned phasing, activity percentage-complete snapshot, physical, contractor-reported, certified and earned-value progress remain separate. Current planned phasing is never presented as achieved progress.</p></div></div><div class="planning-panel-body">'+progressBasisBars(p.progressBases)+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>Current programme population.</p></div></div><div class="planning-panel-body">'+status+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure</h4><p>Critical and near-critical are disjoint classes. Negative float is an Also included in the blocked count, not an additional population.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div></details><section class="planning-panel"><div class="planning-panel-head"><div><h4>Near-term delivery</h4><p>Milestones and look-ahead indicators tied to the current data date.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Milestones",p.milestones?.milestoneCount,"total"],
    ["Open milestones",p.milestones?.openCount,"open"],
    ["Overdue milestones",p.milestones?.lateOpenCount,"past data date",p.milestones?.lateOpenCount?"danger":""],
    ["Incomplete execution activities",p.lookAhead?.incompleteActivityCount,"full schedule; window selection shown in Look-Ahead"],
    ["Look-ahead overdue",p.lookAhead?.overdueCount,"activities",p.lookAhead?.overdueCount?"danger":""],
    ["Date coverage",p.lookAhead?.currentDateCoveragePercent===null?"—":fmt(p.lookAhead?.currentDateCoveragePercent)+"%","look-ahead"]
  ])+'</div></section></section>';
}
function renderRevisionMovementConcentration(a,fallback){
  if(!a)return planningSignedBars(fallback,"days");
  if(a.maximumDays==null)return '<div class="notice info"><b>Maximum movement: Unresolved</b><p>Activities sharing maximum: Unresolved. Matched activities with readable finish dates in both revisions are needed.</p></div>';
  const all=a.maximumRows||[],reps=all.slice(0,5),den=a.population?.denominator;
  return '<div class="notice info"><b>Common maximum movement: '+escapeHtml(fmt(a.maximumDays))+' elapsed days</b><p>'+escapeHtml(fmt(a.maximumCount))+' activities share the maximum · '+escapeHtml(fmt(a.maximumPercent))+'% of '+escapeHtml(fmt(den))+' matched activities with known finishes. Source population: '+escapeHtml(fmt(a.population?.sourceCount))+'.</p><p>'+escapeHtml(a.fromLabel)+' → '+escapeHtml(a.toLabel)+'. Date movement does not establish a shared cause, separate delays, project delay or entitlement.</p></div>'+planningSignedBars(reps.map(r=>({label:r.activityId,value:r.movementDays})),"days")+'<p>'+escapeHtml(fmt(reps.length))+' representatives of '+escapeHtml(fmt(all.length))+'. Verified source date pairs: '+escapeHtml(fmt(a.sourcePairVerifiedCount))+'.</p><details><summary>View all '+escapeHtml(fmt(all.length))+' maximum-movement source pairs</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Previous source finish</th><th>Current source finish</th><th>Elapsed days</th></tr></thead><tbody>'+all.map(r=>'<tr><td>'+escapeHtml(r.activityId)+'</td><td>'+escapeHtml(r.fromFinishIso)+'</td><td>'+escapeHtml(r.toFinishIso)+'</td><td>'+escapeHtml(fmt(r.movementDays))+'</td></tr>').join("")+'</tbody></table></div></details>';
}
function renderScheduleChangeVisual(data){
  const p=projectionFor(data,"schedule_change_report");
  if(!Array.isArray(p.changedActivities))return"";
  const availability=data?.featureAvailability||p.featureAvailability||null;
  if(availability&&availability.state!=="active"){
    return '<section class="planning-view changes-view"><div class="notice info"><b>Programme Changes requires a controlled revision pair.</b><p>'+escapeHtml(availability.reason||"At least two controlled programme revisions are required before a from/to change comparison is meaningful.")+'</p></div><p>This page answers what changed between two revisions. Current programme status remains available in Programme Review and Activity Review.</p></section>';
  }
  const comparisonRibbon='<div class="comparison-ribbon"><div><span>From</span><b>'+escapeHtml(planningRevisionLabel(p.fromRevisionLabel||p.fromRevisionId))+'</b></div><i>→</i><div><span>To</span><b>'+escapeHtml(planningRevisionLabel(p.toRevisionLabel||p.toRevisionId))+'</b></div></div>';
  const kpis=planningKpis([
    ["Activities compared",p.matchedActivityCount,"matched between revisions"],
    ["Activities matched",p.populationMatchPercent===null?"—":fmt(p.populationMatchPercent)+"%","comparison coverage"],
    ["Added",p.addedActivityCount,"activities","accent"],
    ["Removed",p.removedActivityCount,"activities","neutral"],
    ["Any tracked field changed",p.modifiedActivityCount,"overlapping categories below","warning"],["Execution records modified",p.executionModifiedActivityCount,"eligible for execution analysis"],["Excluded records modified",p.excludedModifiedActivityCount,"LOE / WBS summaries retained for audit"],
    ["Gross relationship churn",p.grossRelationshipChurn??((p.addedRelationshipCount||0)+(p.removedRelationshipCount||0)),"added + removed signatures","warning"],["Net relationship change",p.netRelationshipCountChange,"count difference"],["Type / lag modifications",p.modifiedRelationships?.length,"unique matched endpoints"],["Source target dates changed",p.sourceTargetDateChangeCount??0,"XER planning fields; separate from controlled baseline"],["Declared baseline dates changed",p.baselineMutationActivityCount,"source-declared baseline fields only",p.baselineMutationActivityCount>0?"warning":""]
  ]);
  const categoryHtml=moduleBarList((p.changeCategories||[]).map(row=>({label:humanizeKey(row.category),value:row.activityCount})));
  const identityHtml='<div class="notice info">Source record comparison. Identity coverage: '+escapeHtml(fmt(p.identityCoveragePercent))+'%. Ambiguous identities: '+escapeHtml(fmt((p.ambiguousFromActivityIds?.length||0)+(p.ambiguousToActivityIds?.length||0)))+'. Categories overlap and must not be summed. XER target dates remain source planning fields; they do not prove that the separate controlled baseline changed.</div>';
  const composition=planningStatusBand([
    ["Added",p.addedActivityCount,"accent"],["Removed",p.removedActivityCount,"neutral"],["Modified",p.modifiedActivityCount,"warning"],["Unchanged",p.unchangedActivityCount,"success"]
  ]);
const movementClusters=new Map();
  p.changedActivities.forEach(row=>{const value=typeof row.finishShiftDays==="number"?Number(row.finishShiftDays.toFixed(6)):null;if(value===null)return;movementClusters.set(value,(movementClusters.get(value)||0)+1)});
  const dominantMovement=[...movementClusters.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
  const repeatedMovementWarning=dominantMovement&&dominantMovement[1]>=5&&dominantMovement[1]/Math.max(1,p.changedActivities.length)>=0.2?'<div class="notice warn"><b>Common movement pattern detected.</b> '+escapeHtml(fmt(dominantMovement[1]))+' of '+escapeHtml(fmt(p.changedActivities.length))+' changed source rows share exactly '+escapeHtml((dominantMovement[0]>0?"+":"")+fmt(dominantMovement[0]))+' days. CMeng is showing the source-derived date difference, but this repeated pattern requires investigation and does not establish a common cause or '+escapeHtml(fmt(dominantMovement[1]))+' separate delay causes.</div>':'';
  const movements=[...p.changedActivities].filter(a=>typeof a.finishShiftDays==="number"&&a.finishShiftDays!==0).sort((a,b)=>Math.abs(b.finishShiftDays)-Math.abs(a.finishShiftDays)).slice(0,15).map(a=>({label:a.activityId,value:a.finishShiftDays}));
  const floatMoves=[...p.changedActivities].filter(a=>typeof a.floatShiftHours==="number"&&a.floatShiftHours!==0).sort((a,b)=>Math.abs(b.floatShiftHours)-Math.abs(a.floatShiftHours)).slice(0,15).map(a=>({label:a.activityId,value:-a.floatShiftHours}));
  const detail=[...p.changedActivities].sort((a,b)=>Math.abs(b.finishShiftDays||0)-Math.abs(a.finishShiftDays||0)).slice(0,250);
  const rows=detail.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b></td><td>'+escapeHtml(planningStateLabel(a.changeKind))+'</td><td class="'+((a.finishShiftDays||0)>0?"late-text":(a.finishShiftDays||0)<0?"early-text":"")+'">'+escapeHtml(a.finishShiftDays===null?"—":((a.finishShiftDays>0?"+":"")+fmt(a.finishShiftDays)))+'</td><td>'+escapeHtml(fmt(a.floatShiftHours))+'</td><td>'+escapeHtml(fmt(a.progressShiftPercent))+'</td><td>'+escapeHtml((a.fieldChanges||[]).length)+'</td><td>'+escapeHtml(a.identityMethod?humanizeKey(a.identityMethod):'Not matched')+(typeof a.identityConfidence==='number'?' · '+escapeHtml(fmt(a.identityConfidence*100))+'%':'')+'</td></tr>').join("");
  return '<section class="planning-view changes-view">'+comparisonRibbon+kpis+repeatedMovementWarning+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>What changed</h4><p>Activity changes between the two controlled programme revisions.</p></div></div><div class="planning-panel-body">'+composition+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic changes</h4><p>Relationships added or removed between the revisions.</p></div></div><div class="planning-panel-body">'+planningKpis([["Added links",p.addedRelationshipCount,"relationships","accent"],["Removed links",p.removedRelationshipCount,"relationships","warning"]])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Change categories & source identity</h4><p>Supporting classification and activity-identity coverage behind the revision comparison. Categories overlap and are not additive.</p></div></div><div class="planning-panel-body">'+identityHtml+categoryHtml+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest activity finish movements between these revisions</h4><p>'+escapeHtml(planningRevisionLabel(p.fromRevisionLabel||p.fromRevisionId))+' → '+escapeHtml(planningRevisionLabel(p.toRevisionLabel||p.toRevisionId))+'. Elapsed days (24 hours); this is separate from the controlled-baseline comparison in Activity Analytics. Date movement does not establish delay cause or entitlement.</p></div></div><div class="planning-panel-body">'+renderRevisionMovementConcentration(p.finishMovementAnalysis,movements)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest float deterioration</h4><p>Bars to the right indicate the largest loss of float.</p></div></div><div class="planning-panel-body">'+planningSignedBars(floatMoves,"hours lost")+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Changed activity detail</h4><p>Largest finish movements first. Showing '+escapeHtml(fmt(detail.length))+' of '+escapeHtml(fmt(p.changedActivities.length))+' changed activities. The complete confirmed population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body"><details><summary>Open the changed-activity register</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Change</th><th>Finish shift d</th><th>Float shift h</th><th>Progress shift pp</th><th>Fields changed</th><th>Identity basis</th></tr></thead><tbody>'+rows+'</tbody></table></div></details></div></section></section>';
}
function renderFloatPressureTrend(points){
  const fields=[{key:"criticalCount",label:"Critical",color:"#b4483e"},{key:"nearCriticalCount",label:"Strict near-critical",color:"#b57922"},{key:"negativeFloatCount",label:"Negative float",color:"#7a4b46"}];
  return '<div class="float-small-multiples">'+fields.map(field=>{const values=points.map(p=>p[field.key]);return renderVisualPanel(field.label+' · '+fmt(values[0])+' → '+fmt(values.at(-1)),"Separate zoomed count axis; compare the stated values. Negative float can overlap criticality.",renderLineChart(points,[field],null,{unit:"activities",zeroBaseline:false,yLabel:field.label,xLabel:"Reporting date",ariaLabel:field.label+" count change"}));}).join('')+'</div>';
}
function renderRevisionTrendVisual(data){
  const p=projectionFor(data,"revision_trend");
  if(!Array.isArray(p.points))return"";
  const availability=data?.featureAvailability||p.featureAvailability||null;
  if(availability&&availability.state!=="active"){
    const latest=p.points.at(-1)||null;
    return '<section class="planning-view revision-view"><div class="notice info"><b>Revision History is available, but a trend is not yet established.</b><p>'+escapeHtml(availability.reason||"At least two controlled revisions are required for movement trends.")+'</p></div>'+(latest?planningKpis([
      ["Current revision",planningRevisionLabel(latest.label)||("Revision "+latest.sequence),"chronology only"],
      ["Data Date",planningShortDate(latest.dataDateIso),"current controlled programme"],
      ["Schedule progress",latest.durationWeightedProgressPercent==null?"—":fmt(latest.durationWeightedProgressPercent)+"%","current revision"],
      ["Submitted forecast",planningShortDate(latest.forecastCompletionIso),"current revision"]
    ]):"")+'<p>Programme Changes compares two revisions. Variance Trend shows quantitative movement only after at least two comparable revisions exist.</p></section>';
  }
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||planningRevisionLabel(x.label)||("Revision "+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const kpis=planningKpis([
    ["Revisions",p.revisionCount,"controlled programmes"],
    ["Latest schedule progress",latest.durationWeightedProgressPercent===null||latest.durationWeightedProgressPercent===undefined?"—":fmt(latest.durationWeightedProgressPercent)+"%","weighted"],
    ["Latest critical",latest.criticalCount,"activities","danger"],
    ["Latest near-critical",latest.nearCriticalCount,"activities","warning"],
    ["Latest negative float",latest.negativeFloatCount,"activities","danger"],
    ["Latest submitted forecast",planningShortDate(latest.forecastCompletionIso),"date"]
  ]);
  const values=planningRevisionValues(p.points);
  const progress=renderLineChart(points,[{key:"durationWeightedProgressPercent",label:"Duration-weighted schedule progress",color:"#4f7fb4"}],100,{unit:"%",yLabel:"Progress",xLabel:"Reporting date"});
  const completion=planningDateTrend(points,[
    {key:"programmeCompletionIso",label:"Programme finish",color:"#506579"},
    {key:"forecastCompletionIso",label:"Submitted forecast finish",color:"#4f7fb4"}
  ]);
  const pressure=renderFloatPressureTrend(points);
  const changeBars=latest.addedVsPrevious===null?'<div class="empty-visual">N/A: no preceding revision.</div>':planningStatusBand([
    ["Added",latest.addedVsPrevious||0,"accent"],["Removed",latest.removedVsPrevious||0,"neutral"],["Modified",latest.modifiedVsPrevious||0,"warning"]
  ]);
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(planningRevisionLabel(x.label)||("Revision "+x.sequence))+'</b><br><span class="muted">'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></td><td>'+escapeHtml(x.durationWeightedProgressPercent===null?"—":fmt(x.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(x.activityCount)+'</td><td>'+escapeHtml(fmt(x.criticalCount))+'</td><td>'+escapeHtml(fmt(x.nearCriticalCount))+'</td><td>'+escapeHtml(fmt(x.negativeFloatCount))+'</td><td>'+escapeHtml(planningShortDate(x.forecastCompletionIso))+'</td><td>'+escapeHtml(x.addedVsPrevious===null||x.removedVsPrevious===null||x.modifiedVsPrevious===null?"N/A: first revision":fmt(x.addedVsPrevious+x.removedVsPrevious+x.modifiedVsPrevious))+'</td></tr>').join("");
  return '<section class="planning-view revision-view">'+kpis+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Exact values are shown here so the trend charts do not require guessing from a line.</p></div></div><div class="planning-panel-body">'+values+'</div></section><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date movement</h4><p>How the programme and forecast finish dates have moved across revisions.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Progress evolution</h4><p>Weighted schedule progress by revision.</p></div></div><div class="planning-panel-body">'+progress+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Submitted total-float trend</h4><p>Critical, near-critical and negative-float activity counts by revision.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Latest any-field record change volume</h4><p>Activity additions, removals and modifications in the latest revision.</p></div></div><div class="planning-panel-body">'+changeBars+moduleBarList((latest.changeCategories||[]).map(row=>({label:humanizeKey(row.category)+' (overlapping)',value:row.activityCount})))+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision history</h4><p>Controlled programme revisions in chronological order.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Schedule progress</th><th>Activities</th><th>Critical</th><th>Near-critical</th><th>Negative float</th><th>Submitted forecast finish</th><th>Added + removed + any-field modified</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderVarianceTrendVisual(data){
  const p=projectionFor(data,"variance_trends");
  if(!Array.isArray(p.points))return"";
  const availability=data?.featureAvailability||p.featureAvailability||null;
  if(availability&&availability.state!=="active"){
    const latest=p.points.at(-1)||null;
    return '<section class="planning-view variance-view"><div class="notice info"><b>Variance Trend is not yet a trend.</b><p>'+escapeHtml(availability.reason||"At least two comparable controlled revisions are required.")+'</p></div>'+(latest?planningKpis([
      ["Current revision",latest.sequence??1,"current controlled programme"],
      ["Late activities",latest.lateActivityCount??"Not established","current comparison position"],
      ["Project finish vs baseline",latest.projectCompletionVarianceDays==null?"Unresolved":fmt(latest.projectCompletionVarianceDays)+" d","current position; not a trend"]
    ]):"")+'<p>Use Programme Changes for a specific revision-to-revision comparison and Revision History for chronology.</p></section>';
  }
  const labels=p.revisionLabels||{};
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||("R"+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const averageMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.averageFinishVarianceDays==="number"?x.averageFinishVarianceDays:null})),"days");
  const projectMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.projectCompletionVarianceDays==="number"?x.projectCompletionVarianceDays:null})),"days");
  const pressure=renderFloatPressureTrend(points);
  const cards=p.points.map((x,index)=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b><span>'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Source activities compared <b>'+escapeHtml(fmt(x.comparableActivities))+' / '+escapeHtml(fmt(x.sourceActivityCount))+'</b></span><span>Unknown or unmatched <b>'+escapeHtml(fmt(x.unmatchedActivityCount))+'</b></span><span>Average activity finish movement <b>'+escapeHtml(x.averageFinishVarianceDays===null?"Unresolved":fmt(x.averageFinishVarianceDays)+" d")+'</b></span><span>Maximum activity movement <b>'+escapeHtml(x.maximumDelayDays===null?"Unresolved":fmt(x.maximumDelayDays)+" d")+'</b></span><span>Late activities <b>'+escapeHtml(fmt(x.lateActivityCount))+'</b></span><span>Project finish vs baseline <b>'+escapeHtml(x.projectCompletionVarianceDays===null?"Unresolved":fmt(x.projectCompletionVarianceDays)+" d")+'</b></span></div></div>').join("");
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b></td><td>'+escapeHtml(planningShortDate(x.dataDateIso))+'</td><td>'+escapeHtml(x.averageFinishVarianceDays===null?"Unresolved":fmt(x.averageFinishVarianceDays))+'</td><td>'+escapeHtml(x.maximumDelayDays===null?"Unresolved":fmt(x.maximumDelayDays))+'</td><td>'+escapeHtml(fmt(x.lateActivityCount))+'</td><td>'+escapeHtml(fmt(x.earlyActivityCount))+'</td><td>'+escapeHtml(fmt(x.onTimeActivityCount))+'</td><td>'+escapeHtml(fmt(x.negativeFloatCount))+'</td><td>'+escapeHtml(fmt(x.criticalCount))+'</td><td>'+escapeHtml(x.projectCompletionVarianceDays===null?"Unresolved":fmt(x.projectCompletionVarianceDays))+'</td></tr>').join("");
  return '<section class="planning-view variance-view">'+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish movement by revision</h4><p>Signed movement from the controlled baseline. Left means earlier, right means later.</p></div></div><div class="planning-panel-body"><div class="nested-title">Average activity finish movement</div>'+averageMovement+'<div class="nested-title" style="margin-top:16px">Project finish movement</div>'+projectMovement+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float pressure trend</h4><p>Execution-population float indicators by revision. Negative float overlaps criticality; these lines are not additive.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div>'+planningKpis([
    ["Revisions",p.revisionCount,"controlled"],
    ["Latest avg movement",latest.averageFinishVarianceDays===null?"Unresolved":fmt(latest.averageFinishVarianceDays)+" d","vs controlled baseline",latest.averageFinishVarianceDays>0?"warning":""],
    ["Latest max activity movement",latest.maximumDelayDays===null?"Unresolved":fmt(latest.maximumDelayDays)+" d","activity level",latest.maximumDelayDays>0?"danger":""],
    ["Late activities",latest.lateActivityCount,"vs controlled baseline",latest.lateActivityCount?"danger":""],
    ["Project finish movement",latest.projectCompletionVarianceDays===null?"Unresolved":fmt(latest.projectCompletionVarianceDays)+" d","vs controlled baseline",latest.projectCompletionVarianceDays>0?"danger":""]
  ])+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Exact values supporting the trend. Source activity finish movements use the shared activity matching; unknown baseline and ambiguous identity remain visible.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div>'+distributionSummary(latest.movementDistribution)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Avg vs baseline d</th><th>Max movement d</th><th>Late</th><th>Early</th><th>On time</th><th>Neg. float</th><th>Critical</th><th>Project finish vs baseline d</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function commercialCapabilityValue(value,unit=""){
  if(value&&typeof value==="object"&&"value" in value){
    const v=value.value;
    if(v===null||v===undefined)return"Unresolved";
    if(typeof v==="string"&&/^\d{4}-\d{2}-\d{2}/.test(v))return planningShortDate(v);
    return fmt(v)+(unit?" "+unit:"");
  }
  if(value===null||value===undefined)return"Unresolved";
  return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}/.test(value)?planningShortDate(value):fmt(value)+(unit?" "+unit:"");
}
function renderEarnedScheduleVisual(data){
  const p=projectionFor(data,"earned_schedule");
  if(!Array.isArray(p.series))return"";
  const established=p.series.filter(s=>s.state==="established");
  const panels=p.series.map(s=>{
    const current=s.current;
    if(s.state!=="established"||!current)return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(s.currency+" · Earned Schedule")+'</h4></div><span class="badge partial">Not established</span></div><div class="planning-panel-body"><p>'+escapeHtml(s.basis)+'</p></div></section>';
    const chart=(s.points||[]).map(r=>({dateIso:r.asOf,svt:r.scheduleVarianceTimeDays,spit:r.schedulePerformanceIndexTime}));
    return '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>'+escapeHtml(s.currency+" · "+humanizeKey(s.taxBasis||"unknown")+" · Earned Schedule")+'</h4><p>Time-based performance from the source PV curve; not value-based EVM SV/SPI.</p></div><span class="badge ready">Established</span></div><div class="planning-panel-body">'+planningKpis([
      ["Earned Schedule date",planningShortDate(current.earnedScheduleIso),"PV curve date corresponding to EV"],
      ["Actual time",fmt(current.actualTimeDays)+" d","elapsed from opening PV reference"],
      ["Earned time",fmt(current.earnedScheduleDays)+" d","elapsed to earned schedule date"],
      ["SV(t)",fmt(current.scheduleVarianceTimeDays)+" d","ES − AT"],
      ["SPI(t)",fmt(current.schedulePerformanceIndexTime),"ES / AT"],
      ["Source points",s.completePvEvPointCount,fmt(s.sourcePointCount)+" total"]
    ])+renderVisualPanel("Earned Schedule trend","SV(t) in elapsed calendar days. SPI(t) is shown in the exact table below.",renderLineChart(chart,[{key:"svt",label:"SV(t)",tone:"accent"}],null,{unit:"days",yLabel:"SV(t)",xLabel:"Reporting date",zeroBaseline:false}))+basisTable(["As of","PV","EV","ES date","AT d","ES d","SV(t) d","SPI(t)"],(s.points||[]).map(r=>[planningShortDate(r.asOf),r.pv,r.ev,planningShortDate(r.earnedScheduleIso),r.actualTimeDays,r.earnedScheduleDays,r.scheduleVarianceTimeDays,r.schedulePerformanceIndexTime]))+'</div></section>';
  }).join("");
  return '<section class="planning-view earned-schedule-view">'+planningKpis([["Established series",established.length,fmt(p.series.length)+" source partitions"],["Data Date",planningShortDate(p.dataDateIso),"programme reporting date"]])+panels+'</section>';
}
function renderEvmByWbsVisual(data){
  const p=projectionFor(data,"evm_by_wbs");
  if(!Array.isArray(p.rows))return"";
  const complete=p.rows.filter(r=>r.sourceState==="established").length;
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.wbsId||"Unmapped")+'</b></td><td>'+escapeHtml(r.currency)+'</td><td>'+escapeHtml(humanizeKey(r.taxBasis))+'</td><td>'+escapeHtml(fmt(r.pv))+'</td><td>'+escapeHtml(fmt(r.ev))+'</td><td>'+escapeHtml(fmt(r.ac))+'</td><td>'+escapeHtml(fmt(r.spi))+'</td><td>'+escapeHtml(fmt(r.cpi))+'</td><td>'+escapeHtml(fmt(r.scheduleVariance))+'</td><td>'+escapeHtml(fmt(r.costVariance))+'</td><td>'+escapeHtml(humanizeKey(r.sourceState))+'</td></tr>').join("");
  return '<section class="planning-view evm-wbs-view">'+planningKpis([
    ["WBS positions",p.rowCount,"explicit WBS-linked source metrics"],["Complete PV/EV/AC",complete,fmt(p.rowCount)+" positions"],
    ["Data Date",planningShortDate(p.dataDateIso),"future source metrics excluded"]
  ])+'<div class="notice info">Each row remains separate by WBS, currency and tax basis. CMeng does not cross-sum currencies or use Project-level EVM as a substitute for missing WBS evidence.</div><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>EVM by WBS</h4><p>'+escapeHtml(p.basis||"")+'</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>WBS</th><th>Currency</th><th>Tax basis</th><th>PV</th><th>EV</th><th>AC</th><th>SPI</th><th>CPI</th><th>SV</th><th>CV</th><th>Evidence</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderRiskRegisterVisual(data){
  const p=projectionFor(data,"risk_register_control");
  if(!Array.isArray(p.rows))return"";
  const validation=p.validation||{},conflicts=validation.ratingInconsistencyGroups?.length??0;
  const open=p.rows.filter(r=>r.status==="open").length,unknown=p.rows.filter(r=>r.status==="unknown").length;
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.riskId)+'</b><br><span class="muted">'+escapeHtml(r.subject||"")+'</span></td><td>'+escapeHtml(r.category||"—")+'</td><td>'+escapeHtml(humanizeKey(r.status))+'</td><td>'+escapeHtml(r.owner||"Unassigned")+'</td><td>'+escapeHtml(planningShortDate(r.dueIso))+'</td><td>'+escapeHtml(r.probability===null?"—":fmt(r.probability))+'</td><td>'+escapeHtml(r.impact===null?"—":fmt(r.impact))+'</td><td>'+escapeHtml(r.calculatedScore===null?"—":fmt(r.calculatedScore))+'</td><td>'+escapeHtml(r.suppliedRating||"—")+'</td><td><span class="state-pill '+(r.ratingCheck==="conflict"?"blocked":"ready")+'">'+escapeHtml(r.ratingCheck)+'</span></td><td>'+escapeHtml(r.linkedActivityId||"—")+'</td></tr>').join("");
  return '<section class="planning-view risk-register-view">'+planningKpis([
    ["Current risks",p.currentRecordCount,"as of Data Date"],["Open",open,"source status"],["Unknown status",unknown,"not forced open or closed"],
    ["Future records",p.futureRecordCount,"excluded from current"],["Undated records",p.undatedRecordCount,"historical status not assumed"],
    ["Rating conflicts",conflicts,"same probability × impact with inconsistent supplied rating",conflicts?"danger":""]
  ])+'<div class="notice '+(conflicts?"warn":"info")+'"><b>Risk scoring check.</b> '+escapeHtml(validation.scoreBasis||"Probability × impact is checked only where both source values exist. Rating thresholds are not invented.")+'</div><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Risk register</h4><p>Current dated source risks, ownership and activity links.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Risk</th><th>Category</th><th>Status</th><th>Owner</th><th>Due</th><th>P</th><th>I</th><th>P×I</th><th>Source rating</th><th>Rating check</th><th>Activity</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderContractRiskVisual(data){
  const p=projectionFor(data,"contract_risk");
  if(!Array.isArray(p.items))return"";
  const actions=p.items.filter(r=>r.state==="action").length,reviews=p.items.filter(r=>r.state==="review").length;
  const rows=p.items.map(r=>'<tr><td><span class="state-pill '+(r.state==="action"?"blocked":r.state==="review"?"review":"ready")+'">'+escapeHtml(humanizeKey(r.state))+'</span></td><td><b>'+escapeHtml(r.area)+'</b></td><td>'+escapeHtml(r.condition)+'</td><td>'+escapeHtml(r.basis)+'</td><td>'+escapeHtml(r.action)+'</td></tr>').join("");
  return '<section class="planning-view contract-risk-view">'+planningKpis([
    ["Conditions",p.itemCount,"deterministic contract controls"],["Immediate actions",actions,"dated/current exceptions"],["Review items",reviews,"evidence or commercial review"],["Data Date",planningShortDate(p.dataDateIso),"current contract position"]
  ])+'<div class="notice info">'+escapeHtml(p.basis||"")+'</div><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Contract risk & control exceptions</h4><p>Concrete obligations, notices, instructions, variations, security, retention and LD conditions requiring attention. No legal probability or entitlement is inferred.</p></div></div><div class="planning-panel-body">'+(rows?'<div class="table-wrap"><table><thead><tr><th>Attention</th><th>Area</th><th>Condition</th><th>Basis</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="notice info">No exception was identified by the current deterministic checks.</div>')+'</div></section></section>';
}
function renderFinalAccountVisual(data){
  const p=projectionFor(data,"final_account_closeout");
  if(!Array.isArray(p.checks))return"";
  const checkRows=p.checks.map(r=>'<tr><td><b>'+escapeHtml(r.label)+'</b></td><td><span class="state-pill '+(r.state==="clear"?"ready":r.state==="open"?"review":"blocked")+'">'+escapeHtml(humanizeKey(r.state))+'</span></td><td>'+escapeHtml(r.detail)+'</td><td>'+escapeHtml(r.source)+'</td></tr>').join("");
  const moneyRows=(p.currencies||[]).map(r=>'<tr><td><b>'+escapeHtml(r.currency)+'</b></td><td>'+escapeHtml(fmt(r.originalContractValue))+'</td><td>'+escapeHtml(fmt(r.currentContractValue))+'</td><td>'+escapeHtml(fmt(r.approvedVariationAmount))+'</td><td>'+escapeHtml(fmt(r.pendingVariationAmount))+'</td><td>'+escapeHtml(fmt(r.grossCertifiedAmount))+'</td><td>'+escapeHtml(fmt(r.paidAmount))+'</td><td>'+escapeHtml(fmt(r.certifiedUnpaidAmount))+'</td><td>'+escapeHtml(fmt(r.retentionHeldAmount))+'</td><td>'+escapeHtml(fmt(r.claimedAmount))+'</td><td>'+escapeHtml(fmt(r.assessedClaimAmount))+'</td></tr>').join("");
  const open=p.checks.filter(r=>r.state==="open").length,unresolved=p.checks.filter(r=>r.state==="unresolved").length;
  return '<section class="planning-view final-account-view">'+planningKpis([
    ["Closeout state",humanizeKey(p.state),"not a final-account certification"],["Open controls",open,"must be resolved or formally treated"],["Unresolved controls",unresolved,"missing population/evidence"],["Currencies",(p.currencies||[]).length,"never cross-summed"]
  ])+'<div class="notice info">'+escapeHtml(p.basis||"")+'</div><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Final-account readiness</h4><p>Commercial closeout remains blocked or qualified where an applicable population is open or not established.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Control</th><th>State</th><th>Detail</th><th>Source</th></tr></thead><tbody>'+checkRows+'</tbody></table></div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Commercial position by currency</h4><p>Amounts remain source/authority-specific and are not interpreted as an agreed final account.</p></div></div><div class="planning-panel-body">'+(moneyRows?'<div class="table-wrap"><table><thead><tr><th>Currency</th><th>Original</th><th>Current</th><th>Approved VO</th><th>Pending VO</th><th>Certified</th><th>Paid</th><th>Unpaid</th><th>Retention held</th><th>Claimed</th><th>Assessed claims</th></tr></thead><tbody>'+moneyRows+'</tbody></table></div>':'<div class="empty-visual">No commercial currency position is established.</div>')+'</div></section></section>';
}
function renderCommercialCapabilityVisual(key,data){
  if(!data||typeof data!=="object")return"";
  const table=(heads,rows,empty)=>rows.length?'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>':'<div class="empty-visual">'+escapeHtml(empty)+'</div>';
  const state=humanizeKey(data.state||"missing");
  const head=(title,description)=>'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div><span class="badge '+(data.state==="established"?"ready":"partial")+'">'+escapeHtml(state)+'</span></div><div class="planning-panel-body">';
  if(key==="commercial-terms"){
    const clauses=data.clauses||[],amendments=data.amendments||[];
    return '<section class="planning-view commercial-capability">'+planningKpis([
      ["Contract currency",commercialCapabilityValue(data.contractCurrency),"source term"],
      ["Contract completion",commercialCapabilityValue(data.contractualCompletionDate),"dated contract basis"],
      ["Retention",commercialCapabilityValue(data.retentionPercent,"%"),"contract term"],
      ["Retention cap",commercialCapabilityValue(data.retentionCapPercent,"%"),"contract term"],
      ["Certification period",commercialCapabilityValue(data.certificationPeriodDays,"days"),"contract term"],
      ["Payment period",commercialCapabilityValue(data.paymentPeriodDays,"days"),"contract term"],
      ["Notice period",commercialCapabilityValue(data.noticePeriodDays,"days"),"contract version at event date"],
      ["Clauses",clauses.length,amendments.length+" amendments"]
    ])+head("Commercial terms & amendments","Contract terms remain dated and source-backed. Provisional or conflicting terms do not become current facts.")+
      table(["Clause","Heading","Role","State","Page"],clauses.map(r=>'<tr><td>'+escapeHtml(r.identifier||"Not numbered")+'</td><td>'+escapeHtml(r.heading||"")+'</td><td>'+escapeHtml(r.documentRole||"")+'</td><td>'+escapeHtml(humanizeKey(r.governanceState))+'</td><td>'+escapeHtml(r.startPage??"—")+'</td></tr>'),"No contract clauses are established.")+
      '<details class="source-scope"><summary>Amendments · '+fmt(amendments.length)+'</summary>'+table(["Document","Effective","Completion","EOT incorporated","State"],amendments.map(r=>'<tr><td>'+escapeHtml(r.documentId)+'</td><td>'+escapeHtml(planningShortDate(r.effectiveDate))+'</td><td>'+escapeHtml(planningShortDate(r.completionIso))+'</td><td>'+escapeHtml(r.incorporatedEotDays===null?"Unresolved":fmt(r.incorporatedEotDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(r.state))+'</td></tr>'),"No amendments are established.")+'</details></div></section></section>';
  }
  if(key==="cost-register"){
    const rows=data.rows||[];
    return '<section class="planning-view commercial-capability">'+planningKpis([
      ["Cost records",data.recordCount,"source records"],
      ["Mapped to CBS",data.mappedCbsRecordCount,"records"],
      ["Unmapped",data.unmappedCbsRecordCount,"records"],
      ["CBS coverage",data.mappingCoveragePercent===null?"Unresolved":fmt(data.mappingCoveragePercent)+"%","explicit mapping only"]
    ])+head("Cost register","Cost records retain WBS, CBS, currency, tax basis and reporting date. Different currencies are not combined.")+
      table(["Cost code","Description","WBS","Currency","Tax basis","State"],rows.slice(0,500).map(r=>'<tr><td><b>'+escapeHtml(r.costCode||"Unmapped")+'</b></td><td>'+escapeHtml(r.description||"")+'</td><td>'+escapeHtml(r.wbsId||"—")+'</td><td>'+escapeHtml(r.currency||"")+'</td><td>'+escapeHtml(humanizeKey(r.taxBasis||"unknown"))+'</td><td>'+escapeHtml(humanizeKey(r.state||"missing"))+'</td></tr>'),"No cost-register records are established.")+'</div></section></section>';
  }
  if(key==="payment-register"){
    const rows=data.rows||[],lc=data.lifecycleCounts||{},sla=data.slaCounts||{};
    return '<section class="planning-view commercial-capability">'+planningKpis([
      ["Certificates by Data Date",data.asOfRecordCount??data.recordCount,"current population"],
      ["Future",data.futureRecordCount??0,"excluded from current"],
      ["Undated",data.undatedRecordCount??0,"excluded from current"],
      ["Stage coverage",data.stageCoveragePercent===null?"Unresolved":fmt(data.stageCoveragePercent)+"%","application → payment"],
      ["Applied",lc.applied??0,"records"],["Assessed",lc.assessed??0,"records"],["Certified",lc.certified??0,"records"],["Paid",lc.paid??0,"records"],
      ["Overdue unpaid",sla.overdueUnpaid===null||sla.overdueUnpaid===undefined?"Not assessable":sla.overdueUnpaid,"confirmed due dates only"]
    ])+head("Payment / IPC register","Application, assessment, certification and payment are separate lifecycle events. Future and undated periods never enter current totals.")+
      table(["Payment","Type","Period","Applied","Assessed","Certified","Payment due","Paid","SLA"],rows.slice(0,500).map(r=>'<tr><td><b>'+escapeHtml(r.paymentId)+'</b></td><td>'+escapeHtml(r.paymentType||"—")+'</td><td>'+escapeHtml(planningShortDate(r.periodEnd))+'</td><td>'+escapeHtml(planningShortDate(r.lifecycle?.applicationDate))+'</td><td>'+escapeHtml(planningShortDate(r.lifecycle?.assessmentDate))+'</td><td>'+escapeHtml(planningShortDate(r.lifecycle?.certificationDate))+'</td><td>'+escapeHtml(commercialCapabilityValue(r.lifecycle?.paymentDueDate))+'</td><td>'+escapeHtml(planningShortDate(r.lifecycle?.paymentDate))+'</td><td>'+escapeHtml(humanizeKey(r.lifecycle?.slaState||"not established"))+'</td></tr>'),"No payment records are established.")+'</div></section></section>';
  }
  if(key==="cbs-breakdown"){
    const rows=data.nodes||[];
    return '<section class="planning-view commercial-capability">'+planningKpis([
      ["CBS nodes",data.nodeCount,"hierarchy population"],["Roots",(data.rootCostCodes||[]).length,"root codes"],
      ["Mapping coverage",data.mappingCoveragePercent===null?"Unresolved":fmt(data.mappingCoveragePercent)+"%","explicit cost mapping"],
      ["Unmapped metrics",data.unmappedCostMetricCount,"retained for review"]
    ])+head("Cost Breakdown Structure","CBS remains separate from WBS and contractual package identity. Only explicit links are shown.")+
      table(["CBS","Description","Parent","WBS links","BOQ links","Payment links"],rows.slice(0,500).map(r=>'<tr><td><b>'+escapeHtml(r.costCode)+'</b></td><td>'+escapeHtml(r.description||"")+'</td><td>'+escapeHtml(r.parentCostCode||"Root")+'</td><td>'+escapeHtml((r.wbsIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((r.boqItemIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((r.paymentIds||[]).join(", ")||"—")+'</td></tr>'),"No CBS hierarchy is established.")+'</div></section></section>';
  }
  if(key==="cost-control"){
    const rows=data.positions||[];
    const panels=rows.map(r=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(r.currency+" · "+humanizeKey(r.taxBasis||"unknown")+" tax basis")+'</h4></div></div><div class="planning-panel-body">'+planningKpis([
      ["BAC",commercialCapabilityValue(r.bac,r.currency),"budget at completion"],["PV",commercialCapabilityValue(r.pv,r.currency),"planned value"],["EV",commercialCapabilityValue(r.ev,r.currency),"earned value"],["AC",commercialCapabilityValue(r.ac,r.currency),"actual cost"],
      ["SPI",commercialCapabilityValue(r.spi),"EV / PV"],["CPI",commercialCapabilityValue(r.cpi),"EV / AC"],["CV",commercialCapabilityValue(r.cv,r.currency),"EV − AC"],["SV",commercialCapabilityValue(r.sv,r.currency),"EV − PV"],
      ["Source EAC",commercialCapabilityValue(r.sourceEac,r.currency),"source forecast"],["VAC",commercialCapabilityValue(r.calculatedVac,r.currency),"BAC − source EAC"],["TCPI · BAC",commercialCapabilityValue(r.tcpiBudget),"required efficiency"],["TCPI · EAC",commercialCapabilityValue(r.tcpiForecast),"required efficiency"]
    ])+'</div></section>').join("");
    return '<section class="planning-view commercial-capability">'+head("Cost control","BAC, PV, EV, AC and forecast scenarios remain separated by currency and tax basis. Calculated scenarios never replace a source forecast.")+panels+'</div></section></section>';
  }
  if(key==="evm-performance"){
    const series=data.series||[];
    return '<section class="planning-view commercial-capability">'+planningKpis([["Series",series.length,"currency / tax partitions"],["State",state,"time-phased source observations"]])+
      series.map(s=>{const points=(s.points||[]).map(p=>({dateIso:p.asOf,pv:metricValue(p.pv),ev:metricValue(p.ev),ac:metricValue(p.ac),spi:metricValue(p.spi),cpi:metricValue(p.cpi)}));return '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>'+escapeHtml(s.currency+" · "+humanizeKey(s.taxBasis||"unknown"))+'</h4><p>'+escapeHtml(fmt(s.completePvEvAcPointCount))+' complete PV/EV/AC points · '+escapeHtml(s.coveragePercent===null?"coverage unresolved":fmt(s.coveragePercent)+"% coverage")+'</p></div></div><div class="planning-panel-body"><div class="commercial-visual-grid">'+
        renderVisualPanel("PV / EV / AC","Source time-phased values only.",renderLineChart(points,[{key:"pv",label:"PV",tone:"graphite"},{key:"ev",label:"EV",tone:"accent"},{key:"ac",label:"AC",tone:"danger"}],null,{unit:s.currency,yLabel:"Value",xLabel:"Reporting date"}))+
        renderVisualPanel("SPI / CPI","Calculated indices on the same source observations.",renderLineChart(points,[{key:"spi",label:"SPI",tone:"accent"},{key:"cpi",label:"CPI",tone:"success"}],null,{yLabel:"Index",xLabel:"Reporting date",zeroBaseline:false}))+
        '</div></div></section>';}).join("")+'</section>';
  }
  if(key==="cost-scurve"){
    return '<section class="planning-view commercial-capability">'+(data.series||[]).map(s=>{const points=(s.points||[]).map(p=>({dateIso:p.asOf,pv:metricValue(p.plannedCost),ev:metricValue(p.earnedValue),ac:metricValue(p.actualCost),eac:metricValue(p.sourceEac)}));return renderVisualPanel(s.currency+" · Cost S-Curve","PV, EV, AC and source EAC; currencies and tax bases remain separate.",renderLineChart(points,[{key:"pv",label:"PV",tone:"graphite"},{key:"ev",label:"EV",tone:"accent"},{key:"ac",label:"AC",tone:"danger"},{key:"eac",label:"EAC",tone:"purple"}],null,{unit:s.currency,yLabel:"Cost",xLabel:"Reporting date"}));}).join("")+'</section>';
  }
  if(key==="cash-flow-register"){
    return '<section class="planning-view commercial-capability">'+(data.currencies||[]).map(r=>'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>'+escapeHtml(r.currency+" · Cash Flow Register")+'</h4><p>Actual receipts, actual expenditure, certification and forward plan remain separate.</p></div></div><div class="planning-panel-body">'+planningKpis([
      ["Certified",commercialCapabilityValue(r.certifiedIncome,r.currency),"income certified"],["Paid",commercialCapabilityValue(r.paidIncome,r.currency),"cash received"],["Actual expenditure",commercialCapabilityValue(r.actualExpenditure,r.currency),"cash spent"],["Net cash",commercialCapabilityValue(r.netCashPosition,r.currency),"paid less actual expenditure"],["Peak funding need",commercialCapabilityValue(r.peakFundingNeed,r.currency),"observed deficit"]
    ])+'</div></section>').join("")+'</section>';
  }
  const rows=data.rows||data.bonds||data.insurances||data.scenarios||[];
  const count=data.recordCount??rows.length;
  return '<section class="planning-view commercial-capability">'+planningKpis([["Current state",state,"source-backed capability"],["Records / scenarios",count,"current capability population"]])+head(names[key]||humanizeKey(key),descriptions[key]||"Controlled commercial position.")+
    (rows.length?'<div class="table-wrap"><table><thead><tr>'+Object.keys(rows[0]).filter(k=>!["sourceRefs","diagnostics","source","cost","amount"].includes(k)&&["string","number","boolean"].includes(typeof rows[0][k])||rows[0][k]===null).slice(0,10).map(k=>'<th>'+escapeHtml(humanizeKey(k))+'</th>').join("")+'</tr></thead><tbody>'+rows.slice(0,300).map(row=>'<tr>'+Object.keys(rows[0]).filter(k=>!["sourceRefs","diagnostics","source","cost","amount"].includes(k)&&["string","number","boolean"].includes(typeof rows[0][k])||rows[0][k]===null).slice(0,10).map(k=>'<td>'+escapeHtml(row[k]===null||row[k]===undefined?"Unresolved":/^\d{4}-\d{2}-\d{2}/.test(String(row[k]))?planningShortDate(row[k]):fmt(row[k]))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>':'<div class="empty-visual">No current rows are established for this capability.</div>')+
    '</div></section></section>';
}
function renderScopeClassificationVisual(data){
  const p=projectionFor(data,"scope_classification");
  if(!Array.isArray(p.coverage))return"";
  const coverageRows=p.coverage.map(row=>'<tr><td><b>'+escapeHtml(row.label)+'</b></td><td>'+escapeHtml(fmt(row.classified))+' / '+escapeHtml(fmt(row.total))+'</td><td>'+escapeHtml(row.coveragePercent===null?"Unresolved":fmt(row.coveragePercent)+"%")+'</td><td>'+escapeHtml(row.basis)+'</td></tr>').join("");
  const dimensions=['zone','floor','level','tower','building','area','workFront','phase','section','chainage','discipline','trade','system','package','cbs','contractor','subcontractor'];
  const grouped=dimensions.map(key=>{
    const values=new Map();
    for(const row of p.rows||[]){const value=row[key];if(value!==null&&value!==undefined&&String(value).trim())values.set(String(value),(values.get(String(value))||0)+1);}
    if(!values.size)return"";
    const rows=[...values.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([value,count])=>'<tr><td>'+escapeHtml(value)+'</td><td>'+escapeHtml(fmt(count))+'</td></tr>').join("");
    return '<details class="source-scope"><summary>By '+escapeHtml(humanizeKey(key))+' · '+escapeHtml(fmt(values.size))+' values</summary><div class="table-wrap"><table><thead><tr><th>'+escapeHtml(humanizeKey(key))+'</th><th>Activities</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
  }).filter(Boolean).join("");
  const available=p.coverage.filter(row=>row.classified>0).length,missing=p.coverage.filter(row=>row.classified===0).length;
  return '<section class="planning-view scope-classification-view">'+planningKpis([
    ["Execution activities",p.activityCount,"classification population"],
    ["Dimensions available",available,"source or deterministic source-derived"],
    ["Dimensions unavailable",missing,"not inferred from absent evidence"],
    ["Classification state",humanizeKey(p.classificationState||"unresolved"),"source-derived classifications do not become official master data"]
  ])+
  '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Schedule scope classification coverage</h4><p>These dimensions drive Activity Review, WBS Progress and Ask CMeng filters. Explicit source wording may be deterministically classified; ambiguous or absent scope remains unclassified.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Classified</th><th>Coverage</th><th>Basis</th></tr></thead><tbody>'+coverageRows+'</tbody></table></div></div></section>'+
  '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Available schedule breakdowns</h4><p>Use these exact source-derived values in Ask CMeng, for example “activities for Zone 7” or “electrical activities by floor”.</p></div></div><div class="planning-panel-body">'+(grouped||'<div class="empty-visual">No spatial, discipline or package classification is readable from the current source programme.</div>')+'</div></section></section>';
}
function renderProgressBreakdownVisual(data){
  const p=projectionFor(data,"progress_breakdown");
  if(!Array.isArray(p.rows))return "";
  const pct=value=>typeof value==="number"?percent2(value)+"%":"—";
  const views=Array.isArray(p.dimensionViews)?p.dimensionViews:[];
  const initial=(views.find(view=>view.dimension==="wbs"&&view.available)||views.find(view=>view.available)||views[0])?.dimension||"wbs";
  const availableCount=views.filter(view=>view.available).length;
  const tabHtml=views.map(view=>{
    const coverage=typeof view.classificationCoveragePercent==="number"?percent2(view.classificationCoveragePercent)+"%":"No source classification";
    return '<button type="button" class="btn small progress-dimension-tab '+(view.dimension===initial?"primary":"")+'" data-progress-dimension="'+escapeHtml(view.dimension)+'">'+escapeHtml(view.label)+'<small>'+escapeHtml(coverage)+'</small></button>';
  }).join("");
  const viewHtml=views.map(view=>{
    const available=view.available===true;
    const rows=(view.rows||[]).map(row=>{
      const search=[row.groupLabel,row.groupKey].filter(Boolean).join(" ").toLowerCase();
      const open=row.activityCount-row.completedCount;
      return '<tr data-progress-row data-progress-search="'+escapeHtml(search)+'" data-progress-open="'+(open>0?"1":"0")+'" data-progress-critical="'+(typeof row.criticalCount==="number"&&row.criticalCount>0?"1":"0")+'" data-progress-negative="'+(typeof row.negativeFloatCount==="number"&&row.negativeFloatCount>0?"1":"0")+'" data-progress-unclassified="'+(row.classified?"0":"1")+'">'+
        '<td><b>'+escapeHtml(row.groupLabel)+'</b>'+(row.groupKey&&row.groupKey!==row.groupLabel&&row.groupKey!=="__UNCLASSIFIED__"?'<br><span class="muted">'+escapeHtml(row.groupKey)+'</span>':'')+'</td>'+
        '<td>'+escapeHtml(fmt(row.activityCount))+'</td>'+
        '<td>'+escapeHtml(fmt(row.completedCount))+'</td>'+
        '<td>'+escapeHtml(fmt(open))+'</td>'+
        '<td>'+escapeHtml(pct(row.scheduleProgressPercent))+'<br><small>Coverage '+escapeHtml(pct(row.progressCoveragePercent))+'</small></td>'+
        '<td>'+escapeHtml(pct(row.weightSharePercent))+'</td>'+
        '<td>'+escapeHtml(typeof row.progressContributionPercentagePoints==="number"?percent2(row.progressContributionPercentagePoints)+" pp":"—")+'</td>'+
        '<td>'+escapeHtml(typeof row.criticalCount==="number"?fmt(row.criticalCount):"—")+'</td>'+
        '<td>'+escapeHtml(typeof row.negativeFloatCount==="number"?fmt(row.negativeFloatCount):"—")+'</td>'+
      '</tr>';
    }).join("");
    const table=available
      ? '<div class="progress-breakdown-toolbar"><label>Find group<input type="search" data-progress-filter placeholder="WBS, zone, level, work front or CBS"></label><label>Show<select data-progress-attention><option value="all">All groups</option><option value="open">Groups with open work</option><option value="critical">Groups with critical activities</option><option value="negative">Groups with negative float</option><option value="unclassified">Unclassified only</option></select></label><span class="register-search-count" data-progress-count>'+escapeHtml(fmt(view.rows.length))+' groups</span></div>'+
        '<div class="table-wrap"><table><thead><tr><th>'+escapeHtml(view.label.replace(/^By /,""))+'</th><th>Activities</th><th>Complete</th><th>Open</th><th>Schedule progress</th><th>Known progress weight share</th><th>Progress contribution</th><th>Critical</th><th>Negative float</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      : '<div class="notice info"><b>'+escapeHtml(view.label)+' is not available from the current programme.</b><p>'+escapeHtml(view.basis)+'</p></div>';
    return '<section class="planning-panel progress-breakdown-view" data-progress-breakdown-view="'+escapeHtml(view.dimension)+'" '+(view.dimension===initial?"":"hidden")+'><div class="planning-panel-head"><div><h4>'+escapeHtml(view.label)+'</h4><p>'+escapeHtml(view.basis)+'</p></div><span class="badge">'+escapeHtml(fmt(view.classifiedPopulation))+' classified · '+escapeHtml(fmt(view.unclassifiedPopulation))+' unclassified</span></div><div class="planning-panel-body">'+table+'</div></section>';
  }).join("");
  const managementSource=(views.find(view=>view.dimension==="wbs"&&view.available)||views.find(view=>view.available))?.rows||[];
  const managementRows=managementSource.slice(0,30).map(row=>'<tr><td><b>'+escapeHtml(row.groupLabel)+'</b></td>'+
    '<td>'+escapeHtml(pct(row.baselinePlannedPercent))+'</td><td>'+escapeHtml(pct(row.currentPlanPercent))+'</td>'+
    '<td>'+escapeHtml(pct(row.scheduleProgressPercent))+'</td><td>'+escapeHtml(pct(row.physicalMeasuredPercent))+'</td><td>'+escapeHtml(pct(row.certifiedPhysicalPercent))+'</td>'+
    '<td>'+escapeHtml(row.forecastFinishIso?planningShortDate(row.forecastFinishIso):"Not established")+'</td>'+
    '<td>'+escapeHtml(fmt(row.delayedActivityCount||0))+'</td><td>'+escapeHtml((typeof row.criticalCount==="number"?fmt(row.criticalCount):"—")+' / '+(typeof row.negativeFloatCount==="number"?fmt(row.negativeFloatCount):"—"))+'</td>'+
    '<td>'+escapeHtml((row.milestoneThreatIds||[]).join("; ")||"Not linked")+'</td><td>'+escapeHtml(fmt(row.longLeadActivityCount||0))+'</td>'+
    '<td>'+escapeHtml(fmt(row.procurementBlockerCount||0)+' / '+fmt(row.designBlockerCount||0))+'</td><td>'+escapeHtml(row.owner||"Not recorded")+'</td><td>'+escapeHtml(row.managementAction||"Monitor current progress.")+'</td></tr>').join("");
  const managementTable='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Progress control by workfront</h4><p>Plan, achieved progress, finish exposure, blockers and action are kept in one management row. Physical/certified values remain blank when no granular source supports them.</p></div></div><div class="planning-panel-body">'+(managementRows?'<div class="table-wrap"><table><thead><tr><th>WBS / workfront</th><th>Baseline plan</th><th>Current plan</th><th>Schedule snapshot</th><th>Physical</th><th>Certified</th><th>Forecast finish</th><th>Delayed</th><th>Critical / neg float</th><th>Milestones</th><th>Long lead</th><th>Proc / design blockers</th><th>Owner</th><th>Action</th></tr></thead><tbody>'+managementRows+'</tbody></table></div>':'<div class="notice info">No classified workfront is available for the management breakdown.</div>')+'</div></section>';
  const baselineNote=p.baselinePlanAvailable
    ? '<div class="notice info"><b>Controlled baseline plan is available.</b> Baseline planned progress remains a separate schedule basis and is shown only in the WBS hierarchy detail below.</div>'
    : p.controlledBaselineAvailable
      ? '<div class="notice info"><b>Baseline planned progress is not shown.</b> A controlled baseline exists, but its working-calendar date phasing is not sufficiently established for a defensible planned-progress curve. Current programme progress remains usable without any extra user action.</div>'
      : '<div class="notice info"><b>Baseline planned progress is not shown.</b> No controlled baseline or revised baseline is available. Current programme progress and current-plan phasing remain usable without any extra user action.</div>';
  const hierarchy=p.hierarchyRows||p.rows;
  const baselineAvailable=p.baselinePlanAvailable===true;
  const currentPlanAvailable=hierarchy.some(row=>typeof row.currentPlanPercent==="number");
  const hierarchyRows=hierarchy.map(row=>'<tr><td style="min-width:220px;padding-left:'+((row.depth||0)*14+8)+'px"><b>'+escapeHtml(row.wbsName||row.wbsId)+'</b><br><span class="muted">'+escapeHtml(row.wbsId)+(row.parentWbsId?' · Parent '+escapeHtml(row.parentWbsId):' · Root')+'</span></td><td>'+escapeHtml(fmt(row.activityCount))+'</td><td>'+escapeHtml(fmt(row.directActivityCount??row.activityCount))+'</td>'+(baselineAvailable?'<td>'+escapeHtml(pct(row.baselinePlannedPercent))+'<br><small>Coverage '+escapeHtml(pct(row.baselinePlanCoveragePercent))+'</small></td>':'')+(currentPlanAvailable?'<td>'+escapeHtml(pct(row.currentPlanPercent))+'<br><small>Coverage '+escapeHtml(pct(row.currentPlanCoveragePercent))+'</small></td>':'')+'<td>'+escapeHtml(pct(row.durationWeightedProgressPercent))+'<br><small>Coverage '+escapeHtml(pct(row.durationWeightedCoveragePercent))+'</small></td><td>'+escapeHtml(typeof row.criticalCount==="number"?fmt(row.criticalCount):"—")+'</td><td>'+escapeHtml(typeof row.negativeFloatCount==="number"?fmt(row.negativeFloatCount):"—")+'</td></tr>').join("");
  const hierarchyDetail='<details class="source-scope"><summary>WBS hierarchy and schedule-plan basis</summary><div class="table-wrap"><table><thead><tr><th>WBS</th><th>Rollup activities</th><th>Direct activities</th>'+(baselineAvailable?'<th>Baseline plan</th>':'')+(currentPlanAvailable?'<th>Current plan</th>':'')+'<th>Schedule snapshot</th><th>Critical</th><th>Negative float</th></tr></thead><tbody>'+hierarchyRows+'</tbody></table></div></details>';
  return '<section class="planning-view wbs-view progress-breakdown-root" data-progress-breakdown-root data-active-dimension="'+escapeHtml(initial)+'">'+
    planningKpis([
      ["Execution activities",p.totalActivityCount,"current submitted programme"],
      ["Schedule activity progress",typeof p.overallScheduleProgressPercent==="number"?pct(p.overallScheduleProgressPercent):"Not available","duration-weighted current programme"],
      ["Progress coverage",typeof p.overallProgressCoveragePercent==="number"?pct(p.overallProgressCoveragePercent):"Not available","activities with usable duration and progress"],
      ["Breakdowns available",availableCount,"of "+fmt(views.length)+" source-supported views"]
    ])+
    '<div class="notice info"><b>This is current programme activity progress.</b> It does not claim physical, certified, BOQ-quantity or earned-value progress. Missing classifications are kept as Unclassified and are never guessed.</div>'+
    managementTable+
    '<div class="advanced-control-tabs progress-breakdown-tabs">'+tabHtml+'</div>'+
    viewHtml+baselineNote+hierarchyDetail+
  '</section>';
}
function renderMilestonesVisual(data){
  const p=projectionFor(data,"milestones");
  if(!Array.isArray(p.rows))return"";
  const dd=planningDateMs(p.dataDateIso);
  const due30=p.due30Count;
  const slippedOpen=aggregateCount(p.rows,r=>r.status==='completed'?false:r.status==='unknown'||r.varianceDays==null?null:r.varianceDays>0).value;
  const criticalCount=p.criticalMilestoneCount;
  const nearCriticalCount=p.nearCriticalMilestoneCount;
  const negativeFloatCount=p.negativeFloatMilestoneCount;
  const movements=p.rows.map(r=>r.varianceDays).filter(v=>typeof v==="number");
  const largest=movements.length?Math.max(...movements):null;
  const urgentDates=p.lateOpenCount==null||due30==null?null:p.lateOpenCount+due30;
  const priorityRows=[...p.rows].filter(r=>r.status!=="completed").sort((a,b)=>planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER))||((b.varianceDays||0)-(a.varianceDays||0)));
  const topPriority=priorityRows[0]||null;
  const kpis=planningKpis([
    ["Open milestones",p.openCount,"of "+fmt(p.milestoneCount)+" total"],
    ["Submitted float critical",criticalCount,"open milestones · submitted float",criticalCount?"danger":""],
    ["Negative float",negativeFloatCount,"open milestones",negativeFloatCount?"danger":""],
    ["Near-critical",nearCriticalCount,"open milestones",nearCriticalCount?"warning":""],
    ["Urgent dates",urgentDates,fmt(p.lateOpenCount)+" overdue · "+fmt(due30)+" due ≤30d",urgentDates?"warning":""],
    ["Largest movement",largest===null?"—":fmt(largest)+" days","vs controlled baseline",largest?"danger":""]
  ]);
  const basisState=p.sourceFloatState==="source_float_established"
    ?"Float coverage complete for milestone population"
    : p.sourceFloatState==="source_float_partial"
      ?"Float coverage is partial; milestones without float are not silently treated as non-critical"
      :"Source-float classification is not confirmed because milestone float is unavailable";
  const nearCriticalRule=p.nearCriticalThresholdBasis==="activity_calendar_working_days"&&p.nearCriticalThresholdWorkingDays!==null&&p.nearCriticalThresholdWorkingDays!==undefined
    ?"near-critical > "+fmt(p.criticalFloatThresholdHours??0)+" h through +"+fmt(p.nearCriticalThresholdWorkingDays)+" working days using each activity calendar"
    : typeof p.nearCriticalFloatThresholdHours==="number"
      ?"near-critical > "+fmt(p.criticalFloatThresholdHours??0)+" h to "+fmt(p.nearCriticalFloatThresholdHours)+" h"
      :"near-critical threshold not confirmed";
  const basis='<div class="milestone-basis-note"><span><b>Float classification:</b> current submitted programme total float. Critical ≤ '+escapeHtml(fmt(p.criticalFloatThresholdHours??0))+' h; '+escapeHtml(nearCriticalRule)+'. Float threshold approval: '+escapeHtml(humanizeKey(p.controlBasis?.state==='missing'?'not_established':p.controlBasis?.state||'not_established'))+'; method: '+escapeHtml(humanizeKey(p.controlBasis?.nearCriticalThresholdMethod||'unresolved'))+'; '+escapeHtml(fmt(p.controlBasis?.sourceRefs?.length))+' source reference(s) in evidence detail.</span><span><b>'+escapeHtml(basisState)+'</b>'+(p.floatCoveragePercent===null||p.floatCoveragePercent===undefined?'':' · '+escapeHtml(fmt(p.floatCoveragePercent))+'% coverage')+'</span></div>';
  const attention=planningAttention([
    negativeFloatCount?{title:"Investigate negative-float milestones",text:"Validate constraints, dates and driving logic before selecting recovery actions.",value:negativeFloatCount,tone:"danger"}:null,
    criticalCount?{title:"Review source-float critical milestones",text:"Independent driving-path evidence is required before claiming an effect on project completion.",value:criticalCount,tone:"danger"}:null,
    p.lateOpenCount?{title:"Overdue milestone commitments",text:"Current milestone dates are before the data date and need status/recovery confirmation.",value:p.lateOpenCount,tone:"danger"}:null,
    due30?{title:"Milestones due within 30 days",text:"Confirm predecessor completion, approvals, access, materials and responsible owner now.",value:due30,tone:"watch"}:null,
    nearCriticalCount?{title:"Near-critical milestones",text:"These milestones retain limited float and should be protected before they become critical.",value:nearCriticalCount,tone:"watch"}:null,
    slippedOpen?{title:"Open milestones later than baseline",text:"Current milestone commitments are later than the controlled baseline.",value:slippedOpen,tone:"watch"}:null,
    topPriority?{title:"Highest-priority milestone",text:topPriority.activityId+" · "+(topPriority.name||"")+" · "+planningShortDate(topPriority.currentDateIso),value:topPriority.managementPriority?humanizeKey(topPriority.managementPriority):undefined,tone:topPriority.managementPriority==="critical"?"danger":"watch"}:null
  ]);
const movementClusters=new Map();
  p.rows.filter(row=>row.status!=="completed").forEach(row=>{const value=typeof row.varianceDays==="number"?Number(row.varianceDays.toFixed(6)):null;if(value===null)return;movementClusters.set(value,(movementClusters.get(value)||0)+1)});
  const dominantMovement=[...movementClusters.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
  const repeatedMovementWarning=dominantMovement&&dominantMovement[1]>=5&&dominantMovement[1]/Math.max(1,p.openCount)>=0.2?'<div class="notice warn"><b>Common movement pattern detected.</b> '+escapeHtml(fmt(dominantMovement[1]))+' of '+escapeHtml(fmt(p.openCount))+' open milestones share exactly '+escapeHtml((dominantMovement[0]>0?"+":"")+fmt(dominantMovement[0]))+' days. CMeng is showing the source-derived date difference, but this repeated pattern requires investigation; it does not establish a common cause or '+escapeHtml(fmt(dominantMovement[1]))+' separate delay causes.</div>':'';
  const movementGroups='<section class="planning-panel"><div class="planning-panel-head"><h4>Milestone movement & criticality</h4></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Movement vs baseline</th><th>Open milestones</th><th>Share of open population</th></tr></thead><tbody>'+[...movementClusters.entries()].sort((a,b)=>b[1]-a[1]).map(([value,count])=>'<tr><td>'+escapeHtml((value>0?'+':'')+fmt(value)+' d')+'</td><td>'+escapeHtml(fmt(count))+'</td><td>'+escapeHtml(fmt(count/Math.max(1,p.openCount)*100)+'%')+'</td></tr>').join('')+'</tbody></table></div><p>Equal date movements do not prove a shared cause. Completed milestones are excluded from these groups.</p></div></section>';
  const authority=planningKpis([
    ["Float threshold approval",humanizeKey(p.controlBasis?.state==="missing"?"not_established":p.controlBasis?.state||"not_established"),humanizeKey(p.controlBasis?.nearCriticalThresholdMethod||"unresolved"),p.controlBasis?.state==='official'?'':'warning'],
    ["Contract completion",planningShortDate(p.contractualCompletionIso),"contract evidence, separate from activity names"],
    ["Independent driving path",humanizeKey(p.independentDrivingPathState||"not_established"),p.independentDrivingPathReason||"Independent CPM evidence required","warning"]
  ]);
  const timeline=planningMilestoneTimeline(p);
  const priorityBoard=planningMilestonePriorityBoard(p);
  const statusBand=planningStatusBand([
    ["Completed",p.completedCount,"success"],
    ["Open non-overdue",Math.max(0,p.openCount-(p.lateOpenCount||0)),"accent"],
    ["Overdue",p.lateOpenCount||0,"danger"]
  ]);
  const priorityBand=planningStatusBand([
    ["Critical",p.criticalPriorityCount??priorityRows.filter(r=>r.managementPriority==="critical").length,"danger"],
    ["High",p.highPriorityCount??priorityRows.filter(r=>r.managementPriority==="high").length,"warning"],
    ["Watch",priorityRows.filter(r=>r.managementPriority==="watch").length,"accent"],
    ["Normal",priorityRows.filter(r=>r.managementPriority==="normal").length,"neutral"]
  ]);
  const detail=[...p.rows].sort((a,b)=>{
    const ac=a.status==="completed"?1:0,bc=b.status==="completed"?1:0;
    return ac-bc||planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER))||((b.varianceDays||0)-(a.varianceDays||0));
  }).slice(0,500).map(r=>{
    const priority=r.managementPriority||"normal";
    const variance=r.varianceDays===null||r.varianceDays===undefined?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays));
    const currentOrActual=r.status==="completed"?(r.actualDateIso||r.currentDateIso):r.currentDateIso;
    const floatText=r.totalFloatHours===null||r.totalFloatHours===undefined?"—":fmt(r.totalFloatHours);
    const flags=(r.managementFlags||[]).map(f=>'<span class="milestone-flag '+escapeHtml(planningMilestoneFlagTone(f))+'">'+escapeHtml(planningMilestoneFlagLabel(f))+'</span>').join("");
    return '<tr>'+
      '<td><span class="milestone-priority-pill '+escapeHtml(priority)+'">'+escapeHtml(priority)+'</span></td>'+
      '<td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span><br><span class="muted">'+escapeHtml(r.wbsName||r.wbsId||"")+'</span></td>'+
      '<td>'+escapeHtml(planningStateLabel(r.status))+'</td>'+
      '<td><span class="milestone-criticality '+escapeHtml(r.criticality||"unknown")+'">'+escapeHtml(planningMilestoneCriticalityLabel(r))+'</span></td>'+
      '<td>'+escapeHtml(planningShortDate(r.baselineDateIso))+'</td>'+
      '<td>'+escapeHtml(planningShortDate(currentOrActual))+'<br><span class="muted">'+escapeHtml(planningMilestoneDueLabel(r))+'</span></td>'+
      '<td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(variance)+'</td>'+
      '<td>'+escapeHtml(floatText)+'<br><span class="muted">Near-critical limit: '+escapeHtml(r.nearCriticalThresholdHours==null?'Unresolved':fmt(r.nearCriticalThresholdHours)+' h')+' · Calendar '+escapeHtml(r.calendarId||'Unresolved')+'</span></td>'+
      '<td>'+flags+'</td>'+
      '<td>'+escapeHtml(r.managementAction||"Monitor against the current programme and controlled baseline.")+'</td>'+
    '</tr>';
  }).join("");
  const milestoneCategoryLabel={terminal_completion:"Terminal completion",testing_handover:"Testing / handover",programme:"Programme milestones"};
  const milestoneCategoryRank={terminal_completion:0,testing_handover:1,programme:2};
  const primaryMilestones=priorityRows.slice(0,40).sort((a,b)=>(milestoneCategoryRank[a.category]??9)-(milestoneCategoryRank[b.category]??9)||planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER)));
  const controlRows=primaryMilestones.map((r,index)=>{
    const variance=r.varianceDays===null||r.varianceDays===undefined?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)+" d");
    const float=r.totalFloatHours===null||r.totalFloatHours===undefined?"—":fmt(r.totalFloatHours)+" h";
    const category=r.category||"programme";
    const prior=primaryMilestones[index-1]?.category||null;
    const categoryRow=index===0||prior!==category?'<tr class="management-group-row"><td colspan="10"><b>'+escapeHtml(milestoneCategoryLabel[category]||humanizeKey(category))+'</b></td></tr>':'';
    const drivers=(r.driverActivityIds||[]).length?(r.driverActivityIds||[]).join("; "):
      r.predecessorCount?fmt(r.predecessorCount)+" predecessor(s); no immediate critical predecessor established":"No immediate driver established";
    const authority=humanizeKey(r.authority||"not_established");
    const movementBasis=humanizeKey(r.movementBasis||"not_established");
    return categoryRow+'<tr>'+
      '<td><b>'+escapeHtml(r.activityId)+'</b><br>'+escapeHtml(r.name||"")+'<br><span class="milestone-priority-pill '+escapeHtml(r.managementPriority||"normal")+'">'+escapeHtml(humanizeKey(r.managementPriority||"normal"))+'</span><br><span class="muted">'+escapeHtml(r.wbsName||r.wbsId||"")+'</span></td>'+
      '<td>'+escapeHtml(authority)+'</td>'+
      '<td>'+escapeHtml(planningShortDate(r.baselineDateIso))+'</td>'+
      '<td>'+escapeHtml(planningShortDate(r.currentDateIso))+'<br><span class="muted">'+escapeHtml(planningMilestoneDueLabel(r))+'</span></td>'+
      '<td>'+escapeHtml(r.forecastDateIso?planningShortDate(r.forecastDateIso):"Not established")+'</td>'+
      '<td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(variance)+'<br><span class="muted">'+escapeHtml(movementBasis)+'</span></td>'+
      '<td>'+escapeHtml(float)+'</td>'+
      '<td>'+escapeHtml(drivers)+'</td>'+
      '<td>'+escapeHtml(r.owner||"Not recorded")+'</td>'+
      '<td>'+escapeHtml(r.managementAction||"Monitor against the current programme and controlled baseline.")+'</td></tr>';
  }).join("");
  const managementControl=managementPanel("Milestones requiring management control","Milestone authority, baseline, current position, forecast, movement, float, driver, recorded owner and required action. Contractual/client authority is not inferred from a programme activity name.",controlRows?'<div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Authority</th><th>Baseline</th><th>Current</th><th>Forecast</th><th>Movement</th><th>Float</th><th>Driver</th><th>Owner</th><th>Action</th></tr></thead><tbody>'+controlRows+'</tbody></table></div>':'<div class="notice info">No open milestone currently requires ranked management action.</div>',true);
  const analytics=experienceDisclosure(
    "Milestone analytics & source-float detail",
    kpis+authority+basis+repeatedMovementWarning+movementGroups,
    "Counts, thresholds, movement clusters and authority"
  );
  const timelinePanel='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Milestone timeline</h4><p>Priority milestone dates on a common calendar axis after the management action table.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section>';
  const supportPanels='<div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Priority watchlist</h4><p>Supporting urgency and source-float view.</p></div></div><div class="planning-panel-body">'+priorityBoard+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management alerts</h4><p>Exceptions requiring intervention or protection.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div>'+
    '<div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone status</h4><p>Completed, open and overdue commitments.</p></div></div><div class="planning-panel-body">'+statusBand+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management priority</h4><p>Open milestones grouped by required level of attention.</p></div></div><div class="planning-panel-body">'+priorityBand+'</div></section></div>';
  const registerPanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone control register</h4><p>Source activity names are descriptive and do not establish contractual authority. Current/actual dates, baseline movement and source-float classifications remain separate. Showing '+escapeHtml(fmt(Math.min(500,p.rows.length)))+' of '+escapeHtml(fmt(p.rows.length))+' milestones; the complete population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body"><details><summary>Open the complete milestone register</summary><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Milestone / WBS</th><th>Status</th><th>Criticality</th><th>Baseline</th><th>Current / actual</th><th>Vs baseline d</th><th>Total float h</th><th>Flags</th><th>Required attention</th></tr></thead><tbody>'+detail+'</tbody></table></div></details></div></section>';
  return '<section class="planning-view milestone-view">'+managementControl+timelinePanel+supportPanels+analytics+registerPanel+'</section>';
}
function renderNearCriticalVisual(data){
  const p=projectionFor(data,"near_critical");
  if(!Array.isArray(p.rows))return"";
  const strictRows=p.rows||[];
  const statusRank={in_progress:0,not_started:1,unknown:2,completed:3};
  const riskRows=[...(Array.isArray(p.watchlistRows)?p.watchlistRows:strictRows)].sort((a,b)=>(statusRank[a.status]??2)-(statusRank[b.status]??2)||a.totalFloatHours-b.totalFloatHours);
  const inProgress=riskRows.filter(r=>r.status==="in_progress").length;
  const notStarted=riskRows.filter(r=>r.status==="not_started").length;
  const slipped=riskRows.filter(r=>planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)>0).length;
  const workingDays=p.nearCriticalThresholdWorkingDays??p.nearCriticalWorkingDays??null;
  const calendarBasis=p.thresholdBasis==="activity_calendar_working_days"||p.nearCriticalThresholdBasis==="activity_working_days";
  const limitValue=calendarBasis&&workingDays!==null?fmt(workingDays)+" working days":p.nearCriticalThresholdHours===null||p.nearCriticalThresholdHours===undefined?"Unresolved":fmt(p.nearCriticalThresholdHours)+" h";
  const limitSub=calendarBasis?"each activity calendar":"explicit hour threshold";
  const unresolved=p.unresolvedActivityCount??p.thresholdUnresolvedActivityCount??Math.max(0,riskRows.filter(r=>r.nearCriticalThresholdHours===null).length);
  const sourceCount=p.sourceReportedNearCriticalLabelCount??p.reconciliation?.sourceReportedCount??null;
  const sourceMatch=p.reconciliation?.sourceLabelReconcilesTo??null;
  const reconciliationText=p.floatRiskWatchlistCount===null
    ?"Comparison unresolved: "+fmt(unresolved)+" activities need resolved float and working-calendar inputs."
    :sourceCount===null
    ?"No submitted Near Critical population is available for reconciliation."
    : sourceMatch==="float_risk_watchlist"
      ?"The submitted label “Near Critical” reconciles to CMeng's Float-Risk Watchlist, not to strict Near-Critical."
      : sourceMatch==="strict_near_critical"
        ?"The submitted label “Near Critical” reconciles to CMeng's strict Near-Critical classification."
        :"The submitted population does not reconcile to either CMeng classification and remains a visible gap.";

  const criticalThreshold=p.criticalThresholdHours??0;
  const knownCount=(total,known)=>total!==null&&total!==undefined?total:typeof known==='number'?fmt(known)+' known; total unconfirmed':'Unresolved';
  const kpis=planningKpis([
    ["Strict near-critical",p.nearCriticalCount===null?"Unresolved: "+fmt(unresolved)+" activities":p.nearCriticalCount,"TF > "+fmt(criticalThreshold)+" h and ≤ "+limitValue,"warning"],
    ["Float-risk watchlist",p.floatRiskWatchlistCount===null?"Unresolved: "+fmt(unresolved)+" activities":p.floatRiskWatchlistCount,"critical boundary through "+limitValue,"accent"],
    ["Zero float",knownCount(p.zeroFloatCount,p.knownZeroFloatCount),"submitted TF = 0; missing float remains unconfirmed","danger"],
    ["Negative float",knownCount(p.negativeFloatCount,p.knownNegativeFloatCount),"submitted TF < 0; missing float remains unconfirmed","danger"],
    ["Source reported",sourceCount===null?"—":sourceCount,p.sourceReportedLabel||"Near Critical"],
    ["Float coverage",p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%","execution activities"],
    ["Classification coverage",p.classificationCoveragePercent===null||p.classificationCoveragePercent===undefined?"—":fmt(p.classificationCoveragePercent)+"%","calendar-aware",unresolved?"warning":""]
  ]);
  const classificationComplete=unresolved===0&&p.classificationCoveragePercent===100;
  const coverageMessage=classificationComplete?"The execution population is fully classifiable against the disclosed float rules.":unresolved>0?fmt(unresolved)+" execution activities still lack the float/calendar evidence required for complete classification. Known critical/negative-float rows remain useful, but they are not presented as the whole-project total.":"Project-wide classification is not established. Available source-float rows remain useful; they are not presented as a complete project population.";
  const coverageHeadline='<div class="notice '+(classificationComplete?"info":"warn")+'"><b>Float classification coverage: '+escapeHtml(p.classificationCoveragePercent===null||p.classificationCoveragePercent===undefined?"Not established":fmt(p.classificationCoveragePercent)+"%")+'</b><p>'+escapeHtml(coverageMessage)+'</p></div>';
  const managementGroups=Array.isArray(p.managementGroups)?p.managementGroups:[];
  const managementRows=managementGroups.slice(0,25).map(group=>{
    const erosion=group.floatErosionKnownCount?("max "+fmt(group.maxFloatErosionHours)+" h · avg "+fmt(group.averageFloatErosionHours)+" h · "+fmt(group.floatErosionKnownCount)+" comparable activities"):"Not established";
    return '<tr><td><b>'+escapeHtml(group.wbsPath||group.wbsId||"Project scope")+'</b></td><td>'+escapeHtml(fmt(group.activityCount))+'<br><span class="muted">'+escapeHtml((group.activityIds||[]).slice(0,5).join("; "))+((group.activityIds||[]).length>5?' · '+escapeHtml(fmt(group.activityIds.length-5))+' more':'')+'</span></td><td>'+escapeHtml(group.lowestFloatHours===null||group.lowestFloatHours===undefined?"—":fmt(group.lowestFloatHours)+" h")+'</td><td>'+escapeHtml(erosion)+'</td><td>'+escapeHtml(fmt(group.nearCriticalCount))+' / '+escapeHtml(fmt(group.criticalCount))+' / '+escapeHtml(fmt(group.negativeFloatCount))+'</td><td>'+escapeHtml(planningShortDate(group.earliestCurrentFinishIso))+'</td><td>'+escapeHtml((group.affectedMilestoneIds||[]).join("; ")||"No downstream milestone identified in programme logic")+'</td><td>'+escapeHtml(group.action||"Protect the remaining float and clear constraints.")+'</td></tr>';
  }).join("");
  const managementControl='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Work packages closest to critical</h4><p>WBS/workfront groups are ranked by remaining submitted float and then real float erosion between comparable programme revisions. Float erosion is previous comparable TF minus current TF; positive values mean float has been consumed. Comparison revision: '+escapeHtml(p.floatComparisonRevisionId||"Not established")+'. Detailed float histograms and boundary audits remain supporting analysis.</p></div></div><div class="planning-panel-body">'+(managementRows?'<div class="table-wrap"><table><thead><tr><th>WBS / workfront</th><th>Affected activities</th><th>Lowest float</th><th>Float erosion</th><th>Near / critical / negative</th><th>Earliest finish</th><th>Milestones exposed</th><th>Protection action</th></tr></thead><tbody>'+managementRows+'</tbody></table></div>':'<div class="notice info">No open float-risk work package is identified from the known submitted float values.</div>')+'</div></section>';

  const maxThreshold=Math.max(1,...riskRows.map(r=>typeof r.nearCriticalThresholdHours==="number"?r.nearCriticalThresholdHours:0));
  const exactFloatCounts=new Map();
  riskRows.forEach(row=>{if(typeof row.totalFloatHours==="number"){const value=Number(row.totalFloatHours.toFixed(4));exactFloatCounts.set(value,(exactFloatCounts.get(value)||0)+1)}});
  const dominantFloat=[...exactFloatCounts.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
  const floatConcentrationWarning=dominantFloat&&dominantFloat[1]>=25&&dominantFloat[1]/Math.max(1,riskRows.length)>=0.15?'<div class="notice info"><b>Concentrated submitted float values.</b> '+escapeHtml(fmt(dominantFloat[1]))+' activities share exactly '+escapeHtml(fmt(dominantFloat[0]))+' h total float. This is preserved from the submitted programme, not generated by CMeng. Review calendar/logic conventions if that concentration is unexpected.</div>':'';
  const histogram=planningFloatHistogram(riskRows,maxThreshold);
  const finishPeriods=planningFinishPeriodBars(riskRows);
  const watch=[...riskRows].map(r=>({...r,varianceDays:planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)})).sort((a,b)=>(statusRank[a.status]??2)-(statusRank[b.status]??2)||a.totalFloatHours-b.totalFloatHours||((b.varianceDays||0)-(a.varianceDays||0))).slice(0,150);
  const rows=watch.map(r=>{
    const classLabel=r.totalFloatHours===criticalThreshold?(criticalThreshold===0?"Zero-float boundary":"Critical boundary"):"Strict near-critical";
    return '<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(classLabel)+'</td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(r.previousTotalFloatHours===null||r.previousTotalFloatHours===undefined?"—":fmt(r.previousTotalFloatHours))+'</td><td class="'+((r.floatErosionHours||0)>0?"late-text":(r.floatErosionHours||0)<0?"early-text":"")+'">'+escapeHtml(r.floatErosionHours===null||r.floatErosionHours===undefined?"—":((r.floatErosionHours>0?"+":"")+fmt(r.floatErosionHours)))+'</td><td>'+escapeHtml(r.nearCriticalThresholdHours===null||r.nearCriticalThresholdHours===undefined?"—":fmt(r.nearCriticalThresholdHours))+'</td><td>'+escapeHtml(r.calendarId||"—")+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null?"Unresolved":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)))+'</td><td>'+escapeHtml(r.percentComplete===null?"—":fmt(r.percentComplete)+"%")+'</td></tr>';
  }).join("");
  const thresholdAuthority=p.nearCriticalThresholdAuthority==="project_source"?"Project control basis":p.nearCriticalThresholdAuthority==="cmeng_screening_policy"?"CMeng screening policy":"Threshold authority unresolved";
  const thresholdExplanation=p.nearCriticalThresholdExplanation||"The source of the near-critical threshold is not established.";
  const knownExceptions=[...new Map([...(p.criticalRows||[]),...(p.negativeFloatRows||[])].map(r=>[r.activityId,r])).values()].sort((a,b)=>(statusRank[a.status]??2)-(statusRank[b.status]??2)||a.totalFloatHours-b.totalFloatHours);
  const exceptionRows=knownExceptions.slice(0,150).map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br>'+escapeHtml(r.name||'')+'</td><td>'+escapeHtml(r.totalFloatHours<0?'Negative float':r.totalFloatHours===0?'Zero float':'Source critical')+'</td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(r.calendarId||'Not recorded')+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td></tr>').join('');
  const exceptionsPanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Known critical and negative-float activities</h4><p>'+fmt(knownExceptions.length)+' confirmed source-float exceptions. Showing '+fmt(Math.min(150,knownExceptions.length))+'. These submitted values remain available even when calendars cannot be read. They do not establish an independently calculated driving path. Critical and negative-float groups can overlap and are listed once here.</p>'+(p.unknownFloatCount?'<p>'+fmt(p.unknownFloatCount)+' execution activities have no submitted float; the project-wide total remains unconfirmed.</p>':'')+'</div></div><div class="planning-panel-body">'+(knownExceptions.length?'<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Source flag</th><th>Status</th><th>Total float h</th><th>Calendar</th><th>Current finish</th></tr></thead><tbody>'+exceptionRows+'</tbody></table></div>':'<p>No critical or negative-float exceptions are confirmed in the available float values.</p>')+'</div></section>';
  const basis='<div class="notice info"><b>Float screening basis:</b> '+escapeHtml(thresholdAuthority)+'. Critical = TF ≤ '+escapeHtml(fmt(criticalThreshold))+' h; Near-Critical screening = TF > '+escapeHtml(fmt(criticalThreshold))+' h and ≤ '+escapeHtml(limitValue)+'; Float-Risk Watchlist boundary inclusion: '+(p.floatRiskWatchlistIncludesCriticalThreshold?'Included':'Excluded')+'. Working-day limits use each activity\'s own programme calendar.<p>'+escapeHtml(thresholdExplanation)+'</p></div>';
  const reconciliation='<div class="notice '+(sourceMatch==="float_risk_watchlist"||sourceMatch==="strict_near_critical"?"good":"warn")+'"><b>Submitted label versus the float rules:</b> '+escapeHtml(reconciliationText)+'</div>';
  return '<section class="planning-view nearcritical-view">'+coverageHeadline+basis+managementControl+
    '<details class="source-scope"><summary>Float analytics & classification detail</summary><div class="planning-panel-body">'+kpis+exceptionsPanel+reconciliation+floatConcentrationWarning+distributionSummary(p.floatDistribution,'hours','All execution activity float values')+'</div></details>'+
    '<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Float-risk distribution</h4><p>Submitted total float is classified against the disclosed screening basis using each activity calendar. A CMeng policy threshold is never presented as a client-approved project rule.</p></div></div><div class="planning-panel-body">'+histogram+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Where float-risk work finishes</h4><p>Current finish-month concentration for the full float-risk watchlist.</p></div></div><div class="planning-panel-body">'+finishPeriods+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float-Risk Watchlist</h4><p>This band runs from the disclosed critical boundary to the near-critical limit. Critical and negative-float exceptions are listed above. Open activities appear before completed history. '+(p.floatRiskWatchlistCount===null?'The full screening count is unresolved for '+escapeHtml(fmt(unresolved))+' activities because float values or working-calendar inputs are missing. Any listed rows are the confirmed subset.':'Showing '+escapeHtml(fmt(watch.length))+' of '+escapeHtml(fmt(riskRows.length))+' watchlist activities; the complete population is available through Download Excel / Download data.')+'</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Risk class</th><th>Status</th><th>Current float h</th><th>Previous float h</th><th>Float erosion h</th><th>Threshold h</th><th>Calendar</th><th>Controlled baseline finish</th><th>Current finish</th><th>Vs controlled baseline d</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderManhourVisual(data){
  const p=projectionFor(data,"manhour_scurve");
  if(!Array.isArray(p.points)){
    const scenarios=Array.isArray(p.scenarios)?p.scenarios:[];
    const scenarioTable=scenarios.length?'<div class="table-wrap"><table><thead><tr><th>Crew size</th><th>Average manpower</th><th>Peak manpower</th><th>Remaining scenario hours</th><th>Basis</th></tr></thead><tbody>'+scenarios.map(s=>'<tr><td>'+escapeHtml(fmt(s.crewSize))+'</td><td>'+escapeHtml(fmt(s.averageManpower))+'</td><td>'+escapeHtml(fmt(s.peakManpower))+'</td><td>'+escapeHtml(fmt(s.remainingScenarioHours))+'</td><td>'+escapeHtml(s.basis||"—")+'</td></tr>').join("")+'</tbody></table></div>':'';
    return '<section class="planning-view manhour-view"><div class="notice warn"><b>Measured labor-assignment history is not confirmed.</b> Any values below are programme-derived scenarios and are not presented as actual man-hours.</div>'+scenarioTable+'</section>';
  }
  const weekly=p.actualHistoryMethod==="source_approved_weekly_usage";
  const planCoverage=weekly?p.plannedPeriodCoveragePercent:p.plannedAssignmentCoveragePercent;
  const actualCoverage=weekly?p.actualPeriodCoveragePercent:p.actualAssignmentCoveragePercent;
  const periodCoverage=weekly?p.actualPeriodCoveragePercent:p.periodActualAssignmentCoveragePercent;
  const actualEstablished=typeof p.actualHoursKnownCurrent==="number"&&Number.isFinite(p.actualHoursKnownCurrent);
  const actualHistoryEstablished=["stored_financial_period_actuals","source_approved_weekly_usage"].includes(p.actualHistoryMethod);
  const actualHistoryLabel=p.actualHistoryMethod==="stored_financial_period_actuals"?"Financial-period history":p.actualHistoryMethod==="source_approved_weekly_usage"?"Approved weekly usage history":"Unresolved";
  const actualHistoryBasis=p.actualHistoryMethod==="stored_financial_period_actuals"?"stored financial periods":p.actualHistoryMethod==="source_approved_weekly_usage"?"confirmed weekly actuals":"no fabricated history";
  const top=planningKpis([
    ["Planned labor hours",p.plannedHoursKnown===null?"—":fmt(p.plannedHoursKnown)+" h",weekly?"weekly demand over register period":"assignment plan"],
    ["Planned register-row coverage",planCoverage==null?"Unresolved":fmt(planCoverage)+"%",weekly?"source labor-resource periods":"labor assignments"],
    ["Actual labor hours",p.actualHoursKnownCurrent===null?"Unresolved":fmt(p.actualHoursKnownCurrent)+" h",p.actualHoursKnownCurrent===null?"missing, not zero":weekly?"approved usage through Data Date":"current known total",p.actualHoursKnownCurrent===null?"warning":"success"],
    ["Actual register-row coverage",actualCoverage==null?"Unresolved":fmt(actualCoverage)+"%",weekly?"approved source periods through Data Date":"assignment coverage",p.actualAssignmentCoveragePercent!==null&&p.actualAssignmentCoveragePercent!==undefined&&p.actualAssignmentCoveragePercent<100?"warning":""],
    [weekly?"Weekly remaining-work forecast":"Remaining labor hours",p.remainingHoursKnown===null?"Not in the data":fmt(p.remainingHoursKnown)+" h",weekly?"remaining productive work not supplied":"assignment remainder"],
    ...(weekly?[["Planned to Data Date",p.plannedHoursToDataDate==null?"Unresolved":fmt(p.plannedHoursToDataDate)+" h","same source weeks as actual"],["Actual minus plan",p.actualMinusPlannedHoursToDataDate==null?"Unresolved":fmt(p.actualMinusPlannedHoursToDataDate)+" h","same reporting horizon"]]:[]),
    ["Actual history",actualHistoryLabel,actualHistoryBasis,actualHistoryEstablished?"success":"warning"],
    ["Period actual coverage",periodCoverage==null?"Unresolved":fmt(periodCoverage)+"%",weekly?"source labor-resource periods through Data Date":"labor assignments with period actuals",p.periodActualAssignmentCoveragePercent!==null&&p.periodActualAssignmentCoveragePercent!==undefined&&p.periodActualAssignmentCoveragePercent<100?"warning":""]
  ]);
  const unitNote=(p.excludedNonHourLaborResourceIds||[]).length||p.unresolvedUnitLaborAssignmentCount
    ? '<div class="notice warn"><b>Non-hour labour evidence excluded.</b> '+escapeHtml(fmt((p.excludedNonHourLaborResourceIds||[]).length))+' labour resource definition(s) and '+escapeHtml(fmt(p.unresolvedUnitLaborAssignmentCount||0))+' labour assignment(s) do not establish an hour unit and are excluded from the man-hour curve.</div>'
    : '<div class="notice info"><b>Labour-hour unit gate passed.</b> Man-hour totals use only labour resources whose unit metadata explicitly establishes hours.</div>';
  const note=!actualEstablished
    ? '<div class="notice warn"><b>Actual man-hours are not confirmed.</b> Planned and remaining labor hours may exist, but no current actual-hours total is evidenced. CMeng therefore withholds the actual curve.</div>'
    : !actualHistoryEstablished
      ? '<div class="notice warn"><b>Actual total is established but periodized actual history is not.</b> CMeng keeps the known total and withholds a historical actual curve instead of fabricating time phasing.</div>'
      : '';
  const series=[
    {key:"plannedCumulativeHours",label:"Planned labor hours",color:"#506579"},
    ...(actualHistoryEstablished?[{key:"actualCumulativeHours",label:"Actual labor hours",color:"#2c7a57"}]:[]),
    ...(p.points.some(point=>typeof point.forecastCumulativeHours==="number")?[{key:"forecastCumulativeHours",label:"Forecast labor hours",color:"#4f7fb4"}]:[])
  ];
  return '<section class="planning-view manhour-view">'+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Man-Hour S-Curve</h4><p>Labor only. Missing actual history never becomes a zero line.</p></div></div><div class="planning-panel-body">'+renderLineChart(p.points,series,null,{unit:"h",yLabel:"Labor hours",xLabel:"Reporting date",dataDateIso:p.dataDateIso,ariaLabel:"Man-Hour S-Curve"})+'</div></section>'+top+unitNote+note+(weekly?'<div class="notice info">Weekly staffing hours describe input usage, not physical productivity. Periods are included by source week start. The planned total spans the Full register period; actuals stop at the Data Date. Remaining-hours forecast is not confirmed.</div>':'')+renderResourceBasisReview(p.basisComparison)+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Available records</h4><p>The curve uses weekly planned-demand and approved actual-usage evidence. Related P6 assignments are a separate supporting population.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Labor resource definitions",value:fmt(p.laborResourceDefinitionCount??p.laborResourceCount),state:(p.laborResourceDefinitionCount??p.laborResourceCount)>0?"ready":"missing"},
    {label:"Hour-compatible labor resources",value:fmt(p.laborHourResourceCount??p.laborResourceCount),state:(p.laborHourResourceCount??p.laborResourceCount)>0?"ready":"missing"},
    {label:weekly?"Related P6 labor assignments (separate basis)":"Labor assignments",value:fmt(p.laborAssignmentCount),state:p.laborAssignmentCount>0?"ready":"missing"},
    {label:"Planned hours · register horizon",value:p.plannedHoursKnown===null?"Unresolved":fmt(p.plannedHoursKnown)+" h",state:p.plannedHoursKnown===null?"missing":"ready"},
    {label:"Actual hours",value:p.actualHoursKnownCurrent===null?"Unresolved":fmt(p.actualHoursKnownCurrent)+" h",state:p.actualHoursKnownCurrent===null?"missing":"ready"},
    {label:"Period actual history",value:actualHistoryEstablished?"Established":"Unresolved",state:actualHistoryEstablished?"ready":"missing"}
  ])+'</div></section></section>';
}

function managementReason(value){
  const labels={
    CONTRACT_TIME_BASIS_NOT_SUBMITTED:"Contract time basis not confirmed",
    CONTRACT_TIME_BASIS_NOT_ESTABLISHED:"Contract finish and EOT day basis are not confirmed",
    CAUSAL_DELAY_EVENT_BASIS_NOT_ESTABLISHED:"Causal delay-event basis not confirmed",
    NO_EOT_ELIGIBLE_CAUSAL_EVENT_ESTABLISHED:"No employer/neutral causal event is established for EOT assessment",
    NO_ELIGIBLE_EVENT_IN_WINDOW:"No eligible delay event is linked to this window",
    CONCURRENT_WINDOW_REQUIRES_REVIEW:"Concurrent delay requires review",
    NOTICE_REQUIREMENT_NOT_SATISFIED:"Notice requirement not satisfied",
    DELAY_EVENT_RESPONSIBILITY_NOT_OFFICIAL:"Responsibility is not officially established"
  };
  return labels[value]||humanizeKey(value);
}
function claimStateCounts(claims){
  const map=new Map();
  for(const claim of claims||[]){
    const key=humanizeKey(claim.state||"unknown");
    map.set(key,(map.get(key)||0)+1);
  }
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
}

function renderForecastHistoryVisual(data){
  const p=projectionFor(data,"forecast_history");
  if(!Array.isArray(p.points))return"";
  const labels=p.revisionLabels||{};
  const availability=data?.featureAvailability||p.featureAvailability||null;
  if(availability&&availability.state!=="active"){
    const current=p.points.at(-1)||null;
    const currentPosition=current?planningKpis([
      ["Current revision",shortRevision(current.sourceRevisionId,labels),"single comparable programme state"],
      ["Data Date",planningShortDate(current.dataDateIso),"current recorded position"],
      ["Submitted finish",planningShortDate(current.sourceForecastCompletionIso),"source programme forecast"],
      ["Programme calendar recalculation",planningShortDate(current.independentForecastCompletionIso),"calculated only when available"]
    ]):"";
    return '<section class="planning-view forecast-history-view"><div class="notice info"><b>Completion history is not yet a trend.</b><p>'+escapeHtml(availability.reason||"At least two comparable programme revisions are required.")+'</p></div>'+currentPosition+'<details class="management-detail"><summary>History prerequisite</summary><p>CMeng keeps the current completion position visible, but does not draw a movement trend from a single observation.</p></details></section>';
  }
  const points=p.points.map((x,index)=>({...x,dateIso:x.dataDateIso||("Revision "+(index+1))}));
  const sourceCount=p.sourceForecastCount??p.points.filter(x=>x.sourceForecastCompletionIso).length;
  const independentCount=p.establishedForecastCount||0;
  const trend=planningDateTrend(points,[
    {key:"sourceForecastCompletionIso",label:"Submitted forecast finish",color:"#506579"},
    {key:"independentForecastCompletionIso",label:"Programme calendar recalculation",color:"#4f7fb4"}
  ]);
  const cards=p.points.map((x,index)=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(shortRevision(x.sourceRevisionId,labels))+'</b><span>'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Submitted finish <b>'+escapeHtml(planningShortDate(x.sourceForecastCompletionIso))+'</b></span><span>Programme calendar recalculation <b>'+escapeHtml(planningShortDate(x.independentForecastCompletionIso))+'</b></span><span>Submitted move vs prior <b>'+escapeHtml(index===0?'N/A':fmt(planningCalendarDaysBetween(p.points[index-1].sourceForecastCompletionIso,x.sourceForecastCompletionIso))+' d')+'</b></span><span>Submitted move vs first <b>'+escapeHtml(index===0?'N/A':fmt(planningCalendarDaysBetween(p.points[0].sourceForecastCompletionIso,x.sourceForecastCompletionIso))+' d')+'</b></span><span>Calendar movement vs prior <b>'+escapeHtml(x.movementDaysVsPrevious===null?"—":fmt(x.movementDaysVsPrevious)+" d")+'</b></span></div></div>').join("");
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(planningShortDate(x.dataDateIso))+'</td><td><b>'+escapeHtml(shortRevision(x.sourceRevisionId,labels))+'</b></td><td>'+escapeHtml(planningShortDate(x.sourceForecastCompletionIso))+'</td><td>'+escapeHtml(planningShortDate(x.independentForecastCompletionIso))+'</td><td>'+escapeHtml(x.movementDaysVsPrevious===null?"—":fmt(x.movementDaysVsPrevious))+'</td><td>'+escapeHtml(x.movementDaysVsFirst===null?"—":fmt(x.movementDaysVsFirst))+'</td><td>'+escapeHtml(x.independentForecastCompletionIso?humanizeKey(x.origin):"Not calculated in history view")+'</td></tr>').join("");
  const first=p.points[0],initialGap=first?.calendarVersusSubmittedDays??planningCalendarDaysBetween(first?.sourceForecastCompletionIso,first?.independentForecastCompletionIso);
  const inherited=initialGap!=null?'<div class="notice warn"><b>The first recorded revision already differs by '+fmt(initialGap)+' calendar days.</b> Its submitted finish is '+escapeHtml(planningShortDate(first.sourceForecastCompletionIso))+'; its Programme calendar recalculation is '+escapeHtml(planningShortDate(first.independentForecastCompletionIso))+'. This pre-existing model difference is not new slippage. Submitted date movements and later calendar-model movements remain separate.</div>':'';
  const note=independentCount===0?'<div class="notice info"><b>Source forecast history is available.</b> Programme calendar recalculation could not be established for these source revisions. Review the stated calculation checks.</div>':'';
  return '<section class="planning-view forecast-history-view">'+planningKpis([
    ["Revisions",p.snapshotCount,"controlled"],
    ["Submitted forecasts",sourceCount,"Recorded in programme revisions"],
    ["Calendar calculations",independentCount,"calculated snapshots",independentCount?"accent":"warning"]
   ])+inherited+note+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast values by revision</h4><p>Exact dates first; source finishes and calendar recalculations remain separate.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div></div></section><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Forecast movement</h4><p>Later vertical position means a later finish date.</p></div></div><div class="planning-panel-body">'+trend+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast history detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Data date</th><th>Revision</th><th>Submitted finish</th><th>Programme calendar recalculation</th><th>Calendar movement vs previous d</th><th>Calendar movement vs first d</th><th>Basis</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderNoticesClaimsVisual(data){
  const p=projectionFor(data,"notices_claims");if(!Array.isArray(p.events)||!Array.isArray(p.claims))return"";
  const evidenceChainHtml=typeof renderDelayEvidenceChain==="function"?renderDelayEvidenceChain(data):"";
  const chain=data?.delayEotEvidenceChain||p.delayEotEvidenceChain||null,integrity=p.claimPopulationIntegrity||p.integrity||null;
  const quarantined=chain?.populationState==="quarantined"||integrity?.state==="quarantined";
  const populationEstablished=chain?chain.populationState==="established":(!quarantined&&p.claimCount!==null&&p.eventCount!==null);
  const withheld=quarantined?"Withheld — source population quarantined":"Not established",count=value=>populationEstablished?(value==null?"Not established":value):withheld;
  const summary=planningKpis([
    ["Claims known by Data Date",count(p.claimCount),"established claim identities only"],
    ...(quarantined?[["Quarantined source claim rows",integrity?.quarantinedClaimCount??chain?.quarantinedClaimCount,"retained for audit; excluded from notice and entitlement conclusions","warning"]]:[]),
    ["Events evidenced by Data Date",count(p.eventCount),"contractual event identities"],["Timely notices",count(p.timelyNoticeCount),"requires event date, rule and notice"],["Late notices",count(p.lateNoticeCount),"requires event date, rule and notice"],["Event / awareness dates missing",count(p.noticeEventDateMissingCount),"notice trigger dates"],["Notice rules missing",count(p.noticeRequirementMissingCount),"applicable contract rule not established"],["Notice rules need review",count(p.noticeRequirementConflictCount),"resolve applicability or conflicting versions"],["Determined days through DD",p.effectiveDeterminationDays==null?"Not established in dated determination evidence":fmt(p.effectiveDeterminationDays)+" d","determination register; amendment overlap separate"]
  ]);
  const integrityWarning=quarantined?'<div class="notice error"><b>Notice/claim assessment withheld for '+escapeHtml(fmt(integrity?.quarantinedClaimCount??chain?.quarantinedClaimCount))+' quarantined source claim rows.</b> The six Notice Compliance counts are withheld rather than displayed as zero until the applicable population is verified.</div>':'';
  const notAssessableNotice=!populationEstablished?'<div class="notice warn"><b>Notice performance is not zero; it is not assessable.</b> Establish the applicable event population, notice trigger dates, contract rule and actual notice evidence before stating timely or late counts.</div>':'';
  const table=(heads,rows)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+escapeHtml(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  const eventRows=table(["Event","Event start","Notice date","Required days","Elapsed days","Assessment"],p.events.map(e=>[e.eventId,planningShortDate(e.eventStartIso),planningShortDate(e.noticeIssuedAt),fmt(e.requiredNoticeDays),fmt(e.elapsedNoticeDays),humanizeKey(e.noticeTimeliness)]));
  return '<section class="planning-view notices-view">'+summary+integrityWarning+notAssessableNotice+evidenceChainHtml+(populationEstablished?'<details class="source-scope"><summary>Review all '+fmt(p.events.length)+' established notice assessments</summary>'+eventRows+'</details>':'')+'</section>';
}
function commercialMetricHtml(metric,currency=""){
  if(!metric)return'<span class="muted">Unresolved</span>';
  const state=commercialSourceState(metric);
  const value=metric.value===null||metric.value===undefined
    ? "Unresolved"
    : (typeof metric.value==="number"?fmt(metric.value)+(currency?" "+currency:""):planningShortDate(metric.value));
  return '<b>'+escapeHtml(value)+'</b><br><span class="muted">'+escapeHtml(state)+'</span>';
}
function renderCommercialLedgerVisual(data,scoped=false){
  const p=projectionFor(data,"commercial_canonical"), rows=Array.isArray(p.rows)?p.rows:[], key=p.moduleKey;
  if(!scoped&&["commercial-payment-register","commercial-variations","commercial-cost-register"].includes(key)){
    const date=r=>key==="commercial-payment-register"?r.periodEnd:key==="commercial-variations"?r.approvalDate:r.amount?.asOf;
    const current=rows.filter(r=>date(r)&&p.dataDateIso&&date(r).slice(0,10)<=p.dataDateIso.slice(0,10));
    const future=rows.filter(r=>date(r)&&p.dataDateIso&&date(r).slice(0,10)>p.dataDateIso.slice(0,10));
    const undated=rows.filter(r=>!date(r)||!p.dataDateIso);
    const group=(label,list,scope)=>'<details class="source-scope"><summary>'+escapeHtml(label)+' · '+String(list.length)+' source records</summary>'+renderCommercialLedgerVisual({...p,rows:list,scope,summary:{effectiveRecordCount:scope==="as_of"?list.length:0}},true)+'</details>';
    return renderCommercialLedgerVisual({...p,rows:current,scope:"as_of",summary:{...p.summary,effectiveRecordCount:current.length}},true)+group("After Data Date, excluded from current totals",future,"future")+group("Date not confirmed, excluded from current totals",undated,"undated");
  }
  const num=v=>v===null||v===undefined?"Unresolved":new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(v);
  const amount=a=>a?'<b>'+escapeHtml(num(a.value))+'</b>'+(a.value===null?"":' <small>'+escapeHtml(a.currency||"Currency unresolved")+'</small>'):"Unresolved";
  const period=d=>escapeHtml(planningShortDate(d))+(d&&p.dataDateIso&&d>p.dataDateIso?'<br><span class="state-pill review">After Data Date</span>':"");
  const table=(heads,body)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+body.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  const evidence=list=>'<details><summary>Source evidence ('+(list||[]).length+')</summary>'+table(["Document","Location","Revision / hash","Basis"],(list||[]).map(r=>[escapeHtml(r.documentId),escapeHtml(r.locator),escapeHtml(r.revision||r.sourceHash),escapeHtml(r.basisState)]))+'</details>';
  const panel=(title,description,body)=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';
  let content="";
  if(key==="commercial-cost-position"){
    content=rows.map(r=>{
      const v=r.values||{}, money=k=>v[k]==null?"Unresolved":num(v[k])+" "+r.currency;
      const metrics=planningKpis([["Control budget / BAC",money("bac"),"source control budget"],["Source EAC",money("eac"),"source forecast, not CPI scenario"],["Variance at completion",money("calculated vac"),"BAC minus source EAC",v["calculated vac"]<0?"danger":""],["SPI",num(v.spi),"EV / PV"],["CPI",num(v.cpi),"EV / AC"],["CPI scenario EAC",money("cpi scenario eac"),"separate scenario; BAC / CPI"]]);
      const bars=moduleBarList([["PV · planned value","pv"],["EV · earned value","ev"],["AC · actual cost","ac"]].map(([label,k])=>({label,value:v[k]})),"accent",r.currency);
      const changes=planningSignedBars([["Schedule variance","calculated sv"],["Cost variance","calculated cv"],["Variance at completion","calculated vac"]].map(([label,k])=>({label,value:v[k]})),r.currency);
      return panel(r.currency+" · "+planningShortDate(r.asOf),"Tax basis: "+r.taxBasis+". Values from this reporting period only.",metrics+'<div class="planning-primary-grid">'+panel("Earned value position","Comparable values in one currency and tax basis.",bars)+panel("Variance position","Negative values are adverse; missing values are not zero.",changes)+'</div>'+table(["Original contract","Approved variations","Current contract","Remaining cost / ETC"],[[money("original contract value"),money("approved variations"),money("current contract value"),money("etc")]])+(r.diagnostics?.length?'<div class="notice warn">'+escapeHtml(r.diagnostics.map(humanizeKey).join("; "))+'</div>':"")+evidence(r.receipts));
    }).join("");
  } else if(key==="commercial-cost-register"){
    content=panel("Cost evidence register","Source values retain their reporting period, tax basis, approval description and provenance.",table(["Metric","Value","As of","Tax basis","Source status","CBS / WBS","Evidence"],rows.map(r=>[escapeHtml(r.metric),amount(r.amount),period(r.amount.asOf),escapeHtml(r.amount.taxBasis),escapeHtml(r.sourceStatus||"Unresolved"),escapeHtml([r.cbsId,r.wbsId].filter(Boolean).join(" / ")||"Not allocated"),evidence(r.amount.receipts)])));
  } else if(key==="commercial-payment-register"){
    content=planningKpis([["Certificate source records",rows.length,p.scope==="as_of"?"on or before Data Date":"outside current position"],["On / before Data Date",p.summary?.effectiveRecordCount,"dated certificate periods"],["Recorded paid amounts",rows.filter(r=>r.amounts.paidAmount.value!==null).length,"source figures, not verified receipt count"],["Reconciled balances",rows.filter(r=>r.calculatedOutstandingAmount?.state==="official").length,"dated, confirmed cash allocations"]])+panel("Payment stages and certificates","A certificate does not prove an employer approval or a bank receipt. No payment stage is copied into another.",table(["Certificate","Period","Source status","Application","Engineer assessment","Employer certification","Net certified","Paid","Outstanding","Evidence"],rows.map(r=>[escapeHtml(r.paymentId),period(r.periodEnd),escapeHtml(r.sourceStatus),amount(r.amounts.applicationAmount),amount(r.amounts.engineerAssessedAmount),amount(r.amounts.employerCertifiedAmount),amount(r.amounts.netCertifiedAmount),amount(r.amounts.paidAmount),amount(r.amounts.outstandingAmount),evidence(r.amounts.netCertifiedAmount.receipts)])))+panel("Certificate component checks","Gross work plus variations less retention, advance recovery and other deductions. The displayed check tests the stated equation; it does not treat omitted deduction fields as confirmed zero. Certification dates, complete accounting and cash are checked separately.",table(["Certificate","Gross work","Variations","Retention","Advance recovery","Other deductions","Tax","Component check"],rows.map(r=>[escapeHtml(r.paymentId),amount(r.amounts.grossWork),amount(r.amounts.variations),amount(r.amounts.retentionDeduction),amount(r.amounts.advanceRecovery),amount(r.amounts.otherDeduction),amount(r.amounts.taxAmount),escapeHtml(humanizeKey(r.componentArithmetic?.state||r.reconciliation)+(r.componentArithmetic?.state==="matched"?" · stated equation only":""))])));
    content+=panel("Cash allocation and balance reconciliation","Reported outstanding is retained unchanged. A calculated balance requires a dated, approved cumulative receipt allocated to this certificate on or before the Data Date.",table(["Certificate","Payment as of","Payment reference","Reported outstanding","Calculated outstanding","Balance state","Diagnostics","Evidence"],rows.map(r=>[escapeHtml(r.paymentId),period(r.paymentDate),escapeHtml(r.paymentReference||"Not provided"),amount(r.amounts.outstandingAmount),amount(r.calculatedOutstandingAmount),escapeHtml(humanizeKey(r.calculatedOutstandingAmount?.state||"missing")),escapeHtml((r.diagnostics||[]).map(humanizeKey).join("; ")||"No conflict in the checked fields"),evidence(r.calculatedOutstandingAmount?.receipts||[])])));
  } else if(key==="commercial-variations"){
    content=planningKpis([["Source variations",rows.length,"no duplicate addition to current contract"],["Approved by Data Date",rows.filter(r=>/^approved$/i.test(r.status)&&r.approvalDate&&p.dataDateIso&&r.approvalDate<=p.dataDateIso).length,"dated approved source records"]])+panel("Variation register","Approved variation values are not added again to a current contract value or BAC that already includes them.",table(["Variation","Description","Approval date","Status","Approved amount","Tax basis","Authority","Evidence"],rows.map(r=>[escapeHtml(r.variationId),escapeHtml(r.description),period(r.approvalDate),escapeHtml(r.status),amount(r.approvedAmount),escapeHtml(r.approvedAmount.taxBasis),escapeHtml(r.authority||"Not stated"),evidence([r.receipt])])));
  } else if(key==="commercial-amendments"){
    const s=p.summary||{};
    content=planningKpis([["Revised contract finish",planningShortDate(s.revisedCompletion),"applicable amendment"],["EOT incorporated",num(s.incorporatedEotDays)+" d","already inside revised completion"],["Determination register",num(s.determinationRegisterDays)+" d","all register dates"],["Determinations by Data Date",num(s.effectiveDeterminationDays)+" d","not automatically additional EOT"]])+panel("Contract amendments","Completion is not extended twice for the same award. Additional EOT stays unresolved until incorporation is reconciled.",table(["Effective date","Revised completion","Incorporated EOT","Basis","Evidence"],rows.map(r=>[period(r.effectiveDate),period(r.completionIso),escapeHtml(num(r.incorporatedEotDays)+" days"),escapeHtml(r.state),evidence([r.receipt])])));
    const d=p.determinations||[];content+=panel("Engineer determination register","Source awards remain immutable. Rows dated after the Data Date are not part of the as-of position.",table(["Determination","Claim","Date","Awarded days","Authority","State","Supersedes","Evidence"],d.map(r=>[escapeHtml(r.determinationId),escapeHtml(r.claimId),period(r.determinationDate),escapeHtml(num(r.awardedDays)),escapeHtml(r.authority),escapeHtml(humanizeKey(r.state)),escapeHtml(r.supersedes||"None stated"),evidence([r.receipt])])));
  } else {
    content=panel("Commercial reconciliation","Source comparisons do not substitute for approval workflows, allocations or receipts.",table(["Record","Reporting period","State","Findings","Evidence"],rows.map(r=>[escapeHtml(r.paymentId||r.currency||"Source"),period(r.asOf),escapeHtml(humanizeKey(r.state)),escapeHtml((r.diagnostics||[]).map(humanizeKey).join("; ")||"No conflict in the checked fields"),evidence(r.receipts||[r.receipt].filter(Boolean))])))+'<div class="notice warn">'+escapeHtml((p.summary?.gaps||[]).join(" "))+'</div>';
  }
  if(!rows.length)content='<div class="notice warn">No compatible source records are established for this view. Missing approvals, allocation records and receipts are not treated as zero.</div>'+content;
  return '<section class="planning-view commercial-view"><div class="notice info"><b>Data Date: '+escapeHtml(planningShortDate(p.dataDateIso))+'</b><br>Currency, tax basis and reporting period are kept separate. Source forecasts and calculated scenarios remain distinct.</div>'+content+'</section>';
}

function renderCommercialTemporalPosition(ledger){
  const p=ledger?.temporalPosition;if(!p)return '';
  const money=v=>v==null?'Unresolved':fmt(v);
  return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Reporting scope and source reconciliation</h4><p>Data Date '+escapeHtml(planningShortDate(ledger.dataDateIso))+'. Source sums retain their own currency and tax basis. They do not prove a held balance or a reconciled contract value.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Certificate periods by Data Date",p.payments.asOfCount,p.payments.futureCount+' future · '+p.payments.undatedCount+' undated'],
    ["Approvals by Data Date",p.variations.asOfApprovedCount,p.variations.futureApprovalCount+' future · '+p.variations.undatedApprovalCount+' undated'],
  ])+'<div class="table-wrap"><table><thead><tr><th>Source measure</th><th>Currency / tax</th><th>By Data Date</th><th>Future dated</th><th>Full register</th><th>Undated records</th></tr></thead><tbody>'+p.money.map(row=>'<tr><td>'+escapeHtml(row.kind)+'</td><td>'+escapeHtml(row.currency+' / '+row.taxBasis)+'</td><td>'+escapeHtml(money(row.asOfValue))+'<br><small>'+escapeHtml(row.asOfCount)+' records</small></td><td>'+escapeHtml(money(row.futureValue))+'<br><small>'+escapeHtml(row.futureCount)+' records</small></td><td>'+escapeHtml(money(row.fullValue))+'</td><td>'+escapeHtml(row.undatedCount)+'</td></tr>').join('')+'</tbody></table></div></div></section>';
}
function renderCommercialVisual(key,data){
  const p=projectionFor(data,data?.projectionKey||"");
  const position=p.position||data.position||data;
  if(!position||!Array.isArray(position.currencies))return"";
  const foundation=position.foundation||null;
  const countPosition=(state,count,noun)=>{
    const n=Number(count??0);
    if(n>0||state==="established")return fmt(n)+" "+noun;
    return "Unresolved";
  };
  const t=position.timeExposure||{};
  const time=planningKpis([
    ["Contract completion",t.contractualCompletion?.value?planningShortDate(t.contractualCompletion.value):"Unresolved",humanizeKey(t.contractualCompletion?.state||"not_submitted")],
    ["Gross determined days",t.approvedEotDays?.value===null||t.approvedEotDays?.value===undefined?"Unresolved":fmt(t.approvedEotDays.value)+" d",humanizeKey(t.approvedEotDays?.state||"not_submitted")],
    ["Further adjusted contractual completion",t.officialAdjustedCompletion?.value?planningShortDate(t.officialAdjustedCompletion.value):"Unresolved",commercialSourceState(t.officialAdjustedCompletion)],
    ["Variations",countPosition(position.contractControls?.variations?.state,position.variationCount,"records"),"confirmed change population"],
    ["Payment / IPC rows",countPosition(foundation?.paymentRegister?.state,foundation?.paymentRegister?.recordCount,"rows"),"source register population"],
    ["Commercial claims",countPosition(position.claimsNotices?.state,position.claimCommercialCount,"rows"),"money-linked claim population"]
  ]);
  const colsByKey={
    "commercial-overview":[["Original contract","originalContractValue"],["Current contract","currentContractValue"],["Pending variations","pendingVariationAmount"],["Dated gross certification","grossCertifiedAmount"],["Paid","paidAmount"],["Retention deducted through DD","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Claims","claimedAmount"],["Active bonds","activeBondAmount"]],
    "cost-forecast":[["Original contract","originalContractValue"],["Approved variations","approvedVariationAmount"],["Pending variations","pendingVariationAmount"],["Current contract","currentContractValue"],["Claimed","claimedAmount"],["Assessed claims","assessedClaimAmount"]],
    "variations-change":[["Approved variations","approvedVariationAmount"],["Pending variations","pendingVariationAmount"],["Current contract","currentContractValue"]],
    "payments":[["Source certificate periods","sourceCertificatePeriodCount"],["Dated gross certification","grossCertifiedAmount"],["Paid","paidAmount"],["Certified unpaid","certifiedUnpaidAmount"],["Retention deducted through DD","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Advance balance","advanceBalance"]],
    "cash-flow":[["Dated gross certification","grossCertifiedAmount"],["Paid","paidAmount"],["Certified unpaid","certifiedUnpaidAmount"],["Retention deducted through DD","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Advance balance","advanceBalance"]],
    "commercial-claims-notices":[["Claimed","claimedAmount"],["Assessed","assessedClaimAmount"],["Pending variations","pendingVariationAmount"]],
    "contract-particulars-bonds":[["Original contract","originalContractValue"],["Current contract","currentContractValue"],["Active bonds","activeBondAmount"]]
  };
  const cols=colsByKey[key]||colsByKey["commercial-overview"];
  const chartFieldsByKey={
    "commercial-overview":[["Original contract","originalContractValue","graphite"],["Current contract","currentContractValue","accent"],["Pending variations","pendingVariationAmount","warning"],["Dated gross certification","grossCertifiedAmount","teal"],["Paid","paidAmount","success"],["Claims","claimedAmount","danger"]],
    "cost-forecast":[["Original contract","originalContractValue","graphite"],["Current contract","currentContractValue","accent"],["Approved variations","approvedVariationAmount","success"],["Pending variations","pendingVariationAmount","warning"],["Claimed","claimedAmount","danger"],["Assessed claims","assessedClaimAmount","purple"]],
    "variations-change":[["Approved variations","approvedVariationAmount","success"],["Pending variations","pendingVariationAmount","warning"],["Current contract","currentContractValue","accent"]],
    "payments":[["Dated gross certification","grossCertifiedAmount","accent"],["Paid","paidAmount","success"],["Certified unpaid","certifiedUnpaidAmount","danger"],["Retention held","retentionHeldAmount","warning"],["Advance balance","advanceBalance","purple"]],
    "cash-flow":[["Dated gross certification","grossCertifiedAmount","accent"],["Paid","paidAmount","success"],["Certified unpaid","certifiedUnpaidAmount","danger"],["Retention held","retentionHeldAmount","warning"],["Advance balance","advanceBalance","purple"]],
    "commercial-claims-notices":[["Claimed","claimedAmount","danger"],["Assessed","assessedClaimAmount","purple"],["Pending variations","pendingVariationAmount","warning"]],
    "contract-particulars-bonds":[["Original contract","originalContractValue","graphite"],["Current contract","currentContractValue","accent"],["Active bonds","activeBondAmount","warning"]]
  };
  const chartFields=chartFieldsByKey[key]||chartFieldsByKey["commercial-overview"];
  const cards=position.currencies.length
    ? position.currencies.map(row=>{
        const lines=cols.map(([label,field])=>'<div class="currency-line"><span>'+escapeHtml(label)+'</span><strong>'+commercialMetricHtml(row[field],["interimCertificateCount","sourceCertificatePeriodCount"].includes(field)?"":row.currency)+'</strong></div>').join("");
        return '<div class="currency-card"><div class="currency-code">'+escapeHtml(row.currency)+'</div>'+lines+'</div>';
      }).join("")
    : '<div class="empty-visual">No established commercial currency position. Submitted-but-unparsed and missing evidence remain distinct from zero.</div>';
  const commercialCharts=position.currencies.length
    ? '<div class="commercial-visual-grid">'+position.currencies.map(row=>renderVisualPanel(
        row.currency+" · "+(names[key]||"Commercial position"),
        "Source transaction currency. Governing contract currency is a separate contract term. Missing values remain absent, not zero.",
        renderCommercialMetricBars(row,chartFields)
      )).join("")+'</div>'
    : "";
  const evidence=position.evidence||{};
  const gates=moduleEvidenceGate([
    {label:"Commercial source evidence",value:humanizeKey(evidence.commercial||"not_submitted"),state:evidence.commercial==="established"?"ready":"missing"},
    {label:"Variation source register",value:humanizeKey(evidence.variations||"not_submitted"),state:evidence.variations==="established"?"ready":"missing"},
    {label:"Payment source register",value:humanizeKey(evidence.payments||"not_submitted"),state:evidence.payments==="established"?"ready":"missing"},
    {label:"Bonds",value:humanizeKey(evidence.bonds||"not_submitted"),state:evidence.bonds==="established"?"ready":"missing"},
    {label:"Claim source evidence",value:humanizeKey(evidence.claims||"not_submitted"),state:evidence.claims==="established"?"ready":"missing"}
  ]);
  const registers=position.registers||{};
  const table=(headers,rows,emptyMessage)=>rows.length
    ? '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>'
    : '<div class="empty-visual">'+escapeHtml(emptyMessage)+'</div>';
  const findingValue=(finding,unit="")=>{
    if(!finding||finding.value===null||finding.value===undefined)return"Unresolved";
    return fmt(finding.value)+(unit?" "+unit:"");
  };
  const findingMeta=(finding)=>{
    if(!finding)return"Missing";
    const bits=finding.validationScope==="arithmetic_only"?["Arithmetic checked", "source reconciliation separate"]:[humanizeKey(finding.state||"missing"),humanizeKey(finding.authority||"missing")];
    if(finding.coverage)bits.push((key==="cost-forecast"?"Snapshot metric evidence: ":"Finding evidence: ")+fmt(finding.coverage.known)+" / "+fmt(finding.coverage.total)+(finding.coverage.percent==null?"":" ("+fmt(finding.coverage.percent)+"%)"));
    if(finding.basis?.asOfDate)bits.push("as of "+planningShortDate(finding.basis.asOfDate));
    return bits.join(" · ");
  };
  let foundationDetail="";
  if(foundation){
    const terms=foundation.commercialTerms||{};
    if(key==="commercial-overview"){
      foundationDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Contract and payment information</h4><p>Review the contract, certificates and payments. An unavailable figure is not zero.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Commercial Terms",humanizeKey(terms.state||"missing"),"contract facts, clauses and amendments"],
          ["Cost Register",humanizeKey(foundation.costRegister?.state||"missing"),countPosition(foundation.costRegister?.state,foundation.costRegister?.recordCount,"records")],
          ["Payment Register",humanizeKey(foundation.paymentRegister?.state||"missing"),countPosition(foundation.paymentRegister?.state,foundation.paymentRegister?.recordCount,"records")],
          ["CBS Breakdown",humanizeKey(foundation.cbsBreakdown?.state||"missing"),countPosition(foundation.cbsBreakdown?.state,foundation.cbsBreakdown?.nodeCount,"nodes")]
        ])+'</div></section>';
    }
    if(key==="cost-forecast"){
      const costRows=(foundation.costRegister?.rows||[]).slice(0,100).map(row=>{
        const metricNames=Object.keys(row.metrics||{}).sort();
        const metrics=metricNames.slice(0,8).map(name=>humanizeKey(name)+": "+findingValue(row.metrics[name],row.currency)).join(" · ");
        return '<tr><td><b>'+escapeHtml(row.costCode||"Unmapped")+'</b></td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(row.parentCostCode||"—")+'</td><td>'+escapeHtml(row.wbsId||"—")+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml(row.taxBasis)+'</td><td>'+escapeHtml(metrics||"No established metrics")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td></tr>';
      });
      const cbsRows=(foundation.cbsBreakdown?.nodes||[]).slice(0,100).map(node=>'<tr><td><b>'+escapeHtml(node.costCode)+'</b></td><td>'+escapeHtml(node.description||"")+'</td><td>'+escapeHtml(node.parentCostCode||"Root")+'</td><td>'+escapeHtml((node.childCostCodes||[]).join(", ")||"—")+'</td><td>'+escapeHtml((node.wbsIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((node.boqItemIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((node.paymentIds||[]).join(", ")||"—")+'</td></tr>');
      foundationDetail=
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Cost Register</h4><p>CBS/WBS/currency/tax/date/source authority remain explicit. Showing '+escapeHtml(fmt(costRows.length))+' of '+escapeHtml(fmt((foundation.costRegister?.rows||[]).length))+' rows; the complete population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Cost records",countPosition(foundation.costRegister?.state,foundation.costRegister?.recordCount,"records"),"Cost register, grouped by record"],
          ["CBS mapping",foundation.costRegister?.mappingCoveragePercent==null?"Unresolved":fmt(foundation.costRegister.mappingCoveragePercent)+"%","source rows mapped"],
          ["CBS nodes",countPosition(foundation.cbsBreakdown?.state,foundation.cbsBreakdown?.nodeCount,"nodes"),"hierarchy population"],
          ["Unmapped",countPosition(foundation.cbsBreakdown?.state,foundation.cbsBreakdown?.unmappedCostMetricCount,"metrics"),"retained for correction"]
        ])+
        table(["Cost code","Description","Parent","WBS","Currency","Tax basis","Current metrics","State"],costRows,"No cost-register source metrics are established.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>CBS Breakdown</h4><p>Cost breakdown, WBS/BOQ/payment links and amounts by currency. Showing '+escapeHtml(fmt(cbsRows.length))+' of '+escapeHtml(fmt((foundation.cbsBreakdown?.nodes||[]).length))+' nodes; the complete population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body">'+
        table(["CBS","Description","Parent","Children","WBS","BOQ links","Payment links"],cbsRows,"No CBS hierarchy is established.")+
        '</div></section>';
    }
    if(key==="payments"||key==="cash-flow"){
      const paymentRegister=foundation.paymentRegister||{};
      const lifecycleCounts=paymentRegister.lifecycleCounts||{};
      const slaCounts=paymentRegister.slaCounts||{};
      const paymentPopulationEstablished=(paymentRegister.recordCount??0)>0||paymentRegister.state==="established";
      const paymentRows=(paymentRegister.rows||[]).map(row=>{
        const amounts=row.amounts||{};
        return '<tr><td><b>'+escapeHtml(row.paymentId)+'</b></td><td>'+escapeHtml(row.paymentType||"Not stated")+'</td><td>'+escapeHtml(planningShortDate(row.periodEnd))+'<br><span class="muted">'+escapeHtml(humanizeKey(row.reportingScope||'undated'))+'</span></td><td>'+escapeHtml(planningShortDate(row.lifecycle?.applicationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.assessmentDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDate))+'</td><td>'+escapeHtml(humanizeKey(row.lifecycle?.slaState||"not_established"))+'</td><td>'+escapeHtml(findingValue(amounts.applicationAmount))+'</td><td>'+escapeHtml(findingValue(amounts.engineerAssessedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.grossWork))+'</td><td>'+escapeHtml(findingValue(amounts.grossCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.variationCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.employerCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.netCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.paidAmount))+'</td><td>'+escapeHtml(findingValue(amounts.outstandingAmount))+'</td></tr>';
      });
      const paymentActionRows=(paymentRegister.rows||[]).map(row=>{
        const amounts=row.amounts||{};
        const sla=row.lifecycle?.slaState||"not_established";
        const exposure=[
          amounts.outstandingAmount?.value!==null&&amounts.outstandingAmount?.value!==undefined?"Outstanding "+findingValue(amounts.outstandingAmount):null,
          amounts.employerCertifiedAmount?.value!==null&&amounts.employerCertifiedAmount?.value!==undefined?"Employer certified "+findingValue(amounts.employerCertifiedAmount):null,
          amounts.netCertifiedAmount?.value!==null&&amounts.netCertifiedAmount?.value!==undefined?"Net certified "+findingValue(amounts.netCertifiedAmount):null
        ].filter(Boolean).join(" · ")||"Not established";
        const due=row.lifecycle?.paymentDueDate?.value;
        const action=sla==="late"
          ?(row.lifecycle?.paymentDate?"Review the late-payment record and close any remaining reconciliation.":"Escalate the overdue payment against the confirmed due date.")
          :sla==="open"
            ?"Monitor payment against the confirmed due date."
            :sla==="not_established"
              ?(row.lifecycle?.paymentDueDate?.action||"Establish the payment due-date basis before SLA escalation.")
              :"No immediate payment action indicated by the current lifecycle.";
        return '<tr><td><b>'+escapeHtml(row.paymentId)+'</b></td><td>'+escapeHtml(exposure)+'</td><td>Not recorded</td><td>'+escapeHtml(due?planningShortDate(due):"Not recorded")+'</td><td>'+escapeHtml(action)+'</td><td>'+escapeHtml(humanizeKey(sla))+'</td></tr>';
      });
      const lifecycleVisual=renderVisualPanel(
        "IPC lifecycle completion",
        "Counts come from confirmed application, assessment, certification and payment event dates. Missing stages are not copied from another stage.",
        paymentPopulationEstablished?renderVisualBars([
          {label:"Applied",value:lifecycleCounts.applied??0,tone:"graphite"},
          {label:"Assessed",value:lifecycleCounts.assessed??0,tone:"purple"},
          {label:"Certified",value:lifecycleCounts.certified??0,tone:"accent"},
          {label:"Paid",value:lifecycleCounts.paid??0,tone:"success"}
        ],"records"):'<div class="empty-visual">Payment register is not confirmed. Lifecycle counts are not confirmed.</div>'
      );
      const slaAssessable=paymentRegister.slaAssessmentState==="established";
      const slaVisual=renderVisualPanel(
        "Payment SLA & aging position",
        slaAssessable
          ?"Paid-late, overdue-unpaid and open-not-due positions use confirmed actual/due dates."
          :"Payment SLA outcomes are withheld because due/payment date coverage is incomplete.",
        slaAssessable
          ?renderDonutChart([
              {label:"Paid on time",value:slaCounts.paidOnTime??0,tone:"success"},
              {label:"Paid late",value:slaCounts.paidLate??0,tone:"warning"},
              {label:"Overdue unpaid",value:slaCounts.overdueUnpaid??0,tone:"danger"},
              {label:"Open · not due",value:slaCounts.openUnpaid??0,tone:"accent"}
            ],"Assessable payments")
          :paymentPopulationEstablished?'<div class="notice warning"><b>Not assessable</b><p>'+escapeHtml(fmt(slaCounts.notEstablished??0))+' payment record(s) do not have sufficient confirmed SLA event dates.</p></div>':'<div class="empty-visual">Payment register is not confirmed. SLA counts are not confirmed.</div>'
      );
      foundationDetail='<section class="planning-panel primary payment-management-position"><div class="planning-panel-head"><div><h4>Payments & IPC Management Position</h4><p>Application, assessment, certification and payment remain separate. Due dates and SLA states come from evidenced event dates and contractual periods.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Certificate periods by Data Date",paymentPopulationEstablished?(paymentRegister.asOfRecordCount??0):"Unresolved","certificate periods on or before cutoff"],["Future / undated periods",fmt(paymentRegister.futureRecordCount??0)+" / "+fmt(paymentRegister.undatedRecordCount??0),fmt(paymentRegister.sourceRecordCount??paymentRegister.recordCount??0)+" full source records retained"],
          ["Stage coverage",paymentRegister.stageCoveragePercent==null?"Unresolved":fmt(paymentRegister.stageCoveragePercent)+"%","application / assessment / certification / payment dates"],
          ["Stated component arithmetic",paymentPopulationEstablished?fmt((paymentRegister.rows||[]).filter(row=>row.reportingScope==="as_of"&&row.componentArithmetic?.state==="matched").length)+" / "+fmt(paymentRegister.asOfRecordCount??0):"Unresolved","gross work + variations − retention − advance recovery; omitted fields remain unconfirmed"],
          ["Overdue unpaid",slaCounts.overdueUnpaid===null||slaCounts.overdueUnpaid===undefined?"Not assessable":slaCounts.overdueUnpaid,"past confirmed payment due date"],
          ["Paid late",slaCounts.paidLate===null||slaCounts.paidLate===undefined?"Not assessable":slaCounts.paidLate,"actual payment after due date"],
          ["SLA not confirmed",paymentPopulationEstablished?(slaCounts.notEstablished??0):"Unresolved","records without assessable due/payment dates",slaCounts.notEstablished?"warning":""],
          ["Payment period",findingValue(terms.paymentPeriodDays,"days"),findingMeta(terms.paymentPeriodDays)],
          ["Certification period",findingValue(terms.certificationPeriodDays,"days"),findingMeta(terms.certificationPeriodDays)]
        ])+
        ((paymentRegister.rows||[]).some(row=>row.reportingScope==="as_of"&&row.componentArithmetic?.state!=="matched")?'<div class="notice warn"><b>Certificate component reconciliation requires review.</b> Source net-certified amounts are retained. Missing or conflicting gross-work, variation, deduction, recovery or tax evidence prevents an independently reconciled certificate amount; see Certificate component checks below.</div>':'')+
        '<div class="commercial-visual-grid payment-lifecycle-grid">'+lifecycleVisual+slaVisual+'</div>'+
        '<div class="section-heading compact"><div><h5>Payment register / IPC lifecycle</h5><p>Full source register retained. Current summaries exclude future and undated certificate periods; event dates shown here are restricted to the Data Date.</p></div><span class="badge">'+escapeHtml(fmt((paymentRegister.rows||[]).length))+' records</span></div>'+
        table(["Payment","Type","Period","Applied","Assessed","Certified","Certification due","Payment due","Paid","SLA","Applied amount","Assessed amount","Gross work","Gross certified","Variation certified","Employer certified","Net certified","Paid amount","Outstanding"],paymentRows,"No payment register is established.")+
        '<div class="section-heading compact"><div><h5>Payment management actions</h5><p>Exposure, due date and status use existing payment evidence. Owner stays unassigned unless a source records one.</p></div></div>'+
        table(["Finding","Exposure","Owner","Due","Action","Status"],paymentActionRows,"No payment lifecycle actions are currently available.")+
        '</div></section>';
    }
    if(key==="contract-particulars-bonds"){
      const clauseRows=(terms.clauses||[]).map(row=>'<tr><td><b>'+escapeHtml(row.identifier?"Clause "+row.identifier:(row.referencedClauseIdentifiers||[]).length?"References clause "+row.referencedClauseIdentifiers.join(", "):"Source section; clause not identified")+'</b></td><td>'+escapeHtml(row.heading||"")+'</td><td>'+escapeHtml(row.documentRole)+'</td><td>'+escapeHtml(humanizeKey(row.governanceState))+'</td><td>'+escapeHtml(row.startPage||"—")+'</td><td>'+"<details><summary>Read complete wording · "+fmt(row.occurrenceCount??1)+" source sections</summary><p>"+escapeHtml(row.textPreview||"")+"</p><p>"+escapeHtml((row.sourceRefs||[row.sourceRef]).join("; "))+"</p></details>"+'</td></tr>');
      const amendmentRows=(terms.amendments||[]).map(row=>'<tr><td><b>'+escapeHtml(row.documentId)+'</b></td><td>'+escapeHtml(planningShortDate(row.effectiveDate))+'</td><td>'+escapeHtml(planningShortDate(row.completionIso))+'</td><td>'+escapeHtml(row.incorporatedEotDays===null?"Unresolved":fmt(row.incorporatedEotDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml((row.actions||[]).map(a=>a.action+" "+a.targetIdentifier).join("; ")||"No parsed clause actions")+'</td></tr>');
      foundationDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Commercial Terms</h4><p>Contract facts, clauses, amendments and candidate terms remain source-backed and are Separate from the current programme.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Contract currency",findingValue(terms.contractCurrency),findingMeta(terms.contractCurrency)],
          ["Contract completion",terms.contractualCompletionDate?.value?planningShortDate(terms.contractualCompletionDate.value):"Unresolved",findingMeta(terms.contractualCompletionDate)],
          ["Retention",findingValue(terms.retentionPercent,"%"),findingMeta(terms.retentionPercent)],
          ["Retention cap",findingValue(terms.retentionCapPercent,"%"),findingMeta(terms.retentionCapPercent)],
          ["Payment period",findingValue(terms.paymentPeriodDays,"days"),findingMeta(terms.paymentPeriodDays)],
          ["Initial notice",terms.noticeVersions?.length?"See contract versions":findingValue(terms.noticePeriodDays,"days"),"Original and amended terms shown separately"],
          ["LD rate",findingValue(terms.ldRate),findingMeta(terms.ldRate)],
          ["LD cap",findingValue(terms.ldCap),findingMeta(terms.ldCap)]
        ])+
        '<div class="notice info"><b>Performance security:</b> '+escapeHtml(findingValue(terms.performanceBondRequirement))+' · '+escapeHtml(findingMeta(terms.performanceBondRequirement))+'<br><b>Advance-payment security:</b> '+escapeHtml(findingValue(terms.advancePaymentBondRequirement))+' · '+escapeHtml(findingMeta(terms.advancePaymentBondRequirement))+'<br><b>Insurance clauses:</b> '+escapeHtml(countPosition(terms.state,(terms.insuranceRequirements||[]).length,"clauses"))+' · <b>Precedence clauses:</b> '+escapeHtml(countPosition(terms.state,(terms.hierarchyAndPrecedenceClauses||[]).length,"clauses"))+'</div>'+
        table(["Clause","Heading","Document role","Governance","Page","Source text"],clauseRows,"No parsed contract clauses are established.")+
        table(["Amendment","Effective","Revised completion","Incorporated EOT","State","Clause actions"],amendmentRows,"No contract amendments are established.")+
        '</div></section>';
    }
  }
  const performance=position.performance||null;
  if(key==='contract-particulars-bonds'&&foundation?.commercialTerms?.datedTerms?.length){
    const terms=foundation.commercialTerms.datedTerms;
    const labels={ldRate:'Delay damages rate',ldCap:'Delay damages cap',retentionPercent:'Retention rate',retentionCapPercent:'Retention cap',paymentPeriodDays:'Payment period',noticePeriodDays:'Initial claim notice',performanceSecurity:'Performance security',advanceSecurity:'Advance payment security'};
    foundationDetail+='<section class="planning-panel"><h4>Dated contract terms</h4><p>Each event uses the version effective on its event date. An end date is the first date of the next version.</p>'+table(['Term','Value','Effective from','Effective until','Clause / article','Page reference'],terms.map(v=>'<tr><td>'+escapeHtml(labels[v.term]||v.term)+'</td><td>'+escapeHtml(v.applicability==='unresolved'?'Unresolved: amendment applicability':fmt(v.value)+' '+v.unit)+'</td><td>'+escapeHtml(v.effectiveFromIso?planningShortDate(v.effectiveFromIso):'Original contract')+'</td><td>'+escapeHtml(v.effectiveToIso?planningShortDate(v.effectiveToIso):'No later change recorded')+'</td><td>'+escapeHtml(v.clauseIdentifier||'Unresolved: no number stated')+'</td><td>'+escapeHtml(v.sourceRefs.join('; '))+'</td></tr>'),'No dated contract terms were recognised.')+'</section>';
  }
  let performanceDetail="";
  if(performance){
    if(key==="commercial-overview"){
      performanceDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Cost and cash information</h4><p>Cost, earned value and cash figures use the same reporting date and currency.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Cost Control",humanizeKey(performance.costControl?.state||"missing"),countPosition(performance.costControl?.state,performance.costControl?.positions?.length,"currency/tax positions")],
          ["EVM Curves",humanizeKey(performance.evmPerformance?.state||"missing"),countPosition(performance.evmPerformance?.state,performance.evmPerformance?.series?.length,"series")],
          ["Cash Flow",humanizeKey(performance.cashFlow?.state||"missing"),countPosition(performance.cashFlow?.state,performance.cashFlow?.currencies?.length,"currencies")],
          ["Cost S-Curve",humanizeKey(performance.costScurve?.state||"missing"),countPosition(performance.costScurve?.state,performance.costScurve?.series?.length,"series")]
        ])+'</div></section>';
    }
    if(key==="cost-forecast"){
      const controlSections=(performance.costControl?.positions||[]).map(row=>{
        const scenarioRows=(row.eacScenarios||[]).map(s=>'<tr><td><b>'+escapeHtml(humanizeKey(s.method))+'</b></td><td>'+escapeHtml(findingValue(s.value,row.currency))+'</td><td>'+escapeHtml(s.method==="source_reported"?(s.official?"Source / governed":"Source / requires review"):"Scenario only")+'</td><td>'+escapeHtml((s.sameValueAs?"Same value as "+humanizeKey(s.sameValueAs)+"; not an additional range outcome. ":"")+(s.methodology||""))+'</td></tr>');
        const varianceRows=[
          ["Price",row.varianceDecomposition?.price],
          ["Quantity",row.varianceDecomposition?.quantity],
          ["Productivity",row.varianceDecomposition?.productivity]
        ].map(([label,value])=>'<tr><td><b>'+escapeHtml(label)+'</b></td><td>'+escapeHtml(findingValue(value,row.currency))+'</td><td>'+escapeHtml(findingMeta(value))+'</td></tr>');
        const scenarioVisual=renderVisualPanel(
          row.currency+' · EAC scenario range',
          'Equal values appear once in the range. Every method and the AC + source ETC arithmetic check remain in the table.',
          renderVisualBars((row.eacScenarios||[]).filter(s=>!s.sameValueAs).map(s=>({
            label:(s.method==='source_reported'?'Source · ':'Scenario · ')+humanizeKey(s.method),
            value:metricValue(s.value),
            tone:s.method==='source_reported'?'accent':'purple'
          })),row.currency)
        );
        const varianceVisual=renderVisualPanel(
          row.currency+' · Variance decomposition',
          'Source price, quantity and productivity drivers remain separate. Negative values are adverse; positive values are favorable.',
          renderWaterfallChart([
            {label:'Price',value:metricValue(row.varianceDecomposition?.price)},
            {label:'Quantity',value:metricValue(row.varianceDecomposition?.quantity)},
            {label:'Productivity',value:metricValue(row.varianceDecomposition?.productivity)}
          ],row.currency)
        );
        return '<section class="planning-panel cost-control-position"><div class="planning-panel-head"><div><h4>'+escapeHtml(row.currency)+' · Cost Control Management Position</h4><p>Tax basis: '+escapeHtml(row.taxBasis)+'. Source EAC stays separate from CMeng scenarios.</p></div></div><div class="planning-panel-body">'+
          planningKpis([
            ["BAC",findingValue(row.bac,row.currency),findingMeta(row.bac)],
            ["PV",findingValue(row.pv,row.currency),findingMeta(row.pv)],
            ["EV",findingValue(row.ev,row.currency),findingMeta(row.ev)],
            ["AC",findingValue(row.ac,row.currency),findingMeta(row.ac)],
            ["SPI",findingValue(row.spi),"Calculated EV / PV; amount reconciliation open"],
            ["CPI",findingValue(row.cpi),"Calculated EV / AC; amount reconciliation open"],
            ["CV",findingValue(row.cv,row.currency),findingMeta(row.cv)],
            ["SV",findingValue(row.sv,row.currency),findingMeta(row.sv)],
            ["Source EAC",findingValue(row.sourceEac,row.currency),"source forecast"],
            ["Calculated VAC",findingValue(row.calculatedVac,row.currency),findingMeta(row.calculatedVac)],
            ["TCPI · BAC",findingValue(row.tcpiBudget),findingMeta(row.tcpiBudget)],
            ["TCPI · EAC",findingValue(row.tcpiForecast),findingMeta(row.tcpiForecast)]
          ])+
          '<div class="commercial-visual-grid cost-control-secondary">'+scenarioVisual+varianceVisual+'</div>'+
          table(["Forecast method","Value","Authority","Methodology"],scenarioRows,"No EAC scenarios are calculable from the established basis.")+
          table(["Variance driver","Value","Evidence state"],varianceRows,"No source variance decomposition is established.")+
          ((row.diagnostics||[]).length?'<div class="notice info">'+escapeHtml(row.diagnostics.map(humanizeKey).join("; "))+'</div>':"")+
          '</div></section>';
      }).join("");
      const evmSections=(performance.evmPerformance?.series||[]).map(series=>{
        const points=(series.points||[]).map(point=>({
          dateIso:point.asOf,
          pv:point.pv?.value,
          ev:point.ev?.value,
          ac:point.ac?.value,
          spi:point.spi?.value,
          cpi:point.cpi?.value
        }));
        return '<div class="commercial-visual-grid">'+
          renderVisualPanel(
            series.currency+' · PV / EV / AC',
            'Time-phased source values only. Future-dated positions are excluded from the current series.',
            renderLineChart(points,[
              {key:"pv",label:"PV",tone:"graphite"},
              {key:"ev",label:"EV",tone:"accent"},
              {key:"ac",label:"AC",tone:"danger"}
            ],null,{unit:series.currency,yLabel:"Value",xLabel:"Reporting date"})
          )+
          renderVisualPanel(
            series.currency+' · SPI / CPI',
            'Calculated performance indices remain separate from documented source values.',
            renderLineChart(points,[
              {key:"spi",label:"SPI",tone:"accent"},
              {key:"cpi",label:"CPI",tone:"success"}
            ],null,{yLabel:"Index",xLabel:"Reporting date",zeroBaseline:false})
          )+
          '</div>';
      }).join("");
      const costCurveSections=(performance.costScurve?.series||[]).map(series=>{
        const points=(series.points||[]).map(point=>({
          dateIso:point.asOf,
          planned:point.plannedCost?.value,
          earned:point.earnedValue?.value,
          actual:point.actualCost?.value,
          eac:point.sourceEac?.value,
          remaining:point.remainingCost?.value
        }));
        return renderVisualPanel(
          series.currency+(points.length<2?' · Cost snapshot':' · Cost S-Curve'),
          'PV, EV, AC and source EAC remain partitioned by currency and tax basis.',
          renderLineChart(points,[
            {key:"planned",label:"Planned cost / PV",tone:"graphite"},
            {key:"earned",label:"Earned value",tone:"accent"},
            {key:"actual",label:"Actual cost",tone:"danger"},
            {key:"eac",label:"Source EAC",tone:"purple"}
          ],null,{unit:series.currency,yLabel:"Cost",xLabel:"Reporting date"})
        );
      }).join("");
      performanceDetail='<section class="planning-panel primary cost-forecast-primary"><div class="planning-panel-head"><div><h4>Cost Snapshot & Forecast Position</h4><p>PV, EV, AC and source EAC are the primary cost-control view. Source and calculated positions remain explicitly separated.</p></div></div><div class="planning-panel-body"><div class="commercial-visual-grid">'+costCurveSections+'</div></div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>EVM Curves & Performance Indices</h4><p>PV / EV / AC and calculated SPI / CPI require at least two comparable observations to establish a trend.</p></div></div><div class="planning-panel-body">'+evmSections+'</div></section>'+
        controlSections;
    }
    if(key==="cash-flow"){
      const cashSections=(performance.cashFlow?.currencies||[]).map(row=>{
        const points=(row.cumulativePositionSeries||row.cumulativeActualSeries||[]).map(point=>({
          dateIso:point.asOf,
          certified:point.cumulativeCertifiedIncome,
          paid:point.cumulativePaidIncome??point.cumulativeIncome,
          budget:point.cumulativeExpenditureBudget,
          forecast:point.cumulativeExpenditureForecast,
          actual:point.cumulativeActualExpenditure??point.cumulativeExpenditure,
          net:point.actualNetCash??point.net
        }));
        const curveKeys=["certified","paid","budget","forecast","actual","net"];
        const plottedPointCount=points.filter(point=>curveKeys.some(key=>point[key]!==null&&point[key]!==undefined&&Number.isFinite(Number(point[key])))).length;
        const sourceReadiness=row.sourceReadiness||null;
        const hasCurve=sourceReadiness?sourceReadiness.fundingCurveReady===true:plottedPointCount>=2;
        const periodMovements=(row.periodMovementSeries||[]).map(point=>({
          label:point.period,
          value:point.actualNetCashMovement
        }));
        const knownPeriodMovements=periodMovements.filter(point=>point.value!==null&&point.value!==undefined&&Number.isFinite(Number(point.value)));
        const entries=row.entries||[];
        const entryRows=entries.map(entry=>'<tr><td>'+escapeHtml(planningShortDate(entry.periodDate))+'</td><td>'+escapeHtml(humanizeKey(entry.kind))+'</td><td>'+escapeHtml(findingValue(entry.amount,row.currency))+'</td><td>'+escapeHtml(findingMeta(entry.amount))+'</td><td>'+escapeHtml((entry.sourceRefs||[]).join(", "))+'</td></tr>');
        const netValue=metricValue(row.netCashPosition);
        const peakValue=metricValue(row.peakFundingNeed);
        const paidValue=metricValue(row.paidIncome);
        const actualValue=metricValue(row.actualExpenditure);
        const certifiedValue=metricValue(row.certifiedIncome);
        const unpaidValue=metricValue(row.certifiedUnpaid);
        const budgetValue=metricValue(row.expenditureBudget);
        const forecastValue=metricValue(row.expenditureForecast);
        const netReady=sourceReadiness?sourceReadiness.netCashReady===true:netValue!==null;
        const readinessStateLabel=state=>state==="ready"?"Ready":state==="not_aggregable"?"Needs series basis":state==="partial"?"Partial":"Missing";
        const readinessTone=state=>state==="ready"?"ready":state==="not_aggregable"?"partial":"blocked";
        const basisLabel=basis=>basis==="no_rows"?"No source rows":basis==="project_cumulative"?"Project cumulative":basis==="certificate_cumulative"?"Certificate cumulative":basis==="incremental"?"Incremental":basis==="mixed"?"Mixed":"Unknown";
        const readinessCoverage=(domain,observed,total,noun)=>{
          if(!domain)return"Unresolved";
          if(domain.state==="missing"&&Number(total??0)===0)return"Unresolved";
          return fmt(observed)+" / "+fmt(total)+" "+noun;
        };
        const readinessDomain=(title,domain,coverage,owner)=>{
          if(!domain)return"";
          return '<div class="cash-readiness-item '+escapeHtml(domain.state==="ready"?"established":"missing")+'">'+
            '<div><span>'+escapeHtml(title)+'</span><b>'+escapeHtml(readinessStateLabel(domain.state))+'</b></div>'+
            '<span class="badge '+readinessTone(domain.state)+'">'+escapeHtml(coverage)+'</span>'+
            '<small>'+escapeHtml(domain.consequence||"")+'</small>'+
            (domain.basis?'<div class="cash-readiness-basis"><span>Series basis</span><b>'+escapeHtml(basisLabel(domain.basis))+'</b></div>':'')+
            managementModuleLink(owner,domain.state==="ready"?"Open source":"Resolve source")+
            '</div>';
        };
        const sourceSummary=sourceReadiness
          ? [
              sourceReadiness.paymentRecordCount>0
                ? fmt(sourceReadiness.paymentRecordCount)+" payment records"
                : sourceReadiness.certification.state==="missing"&&sourceReadiness.receipts.state==="missing"
                  ? "payment register not confirmed"
                  : "0 payment records",
              sourceReadiness.certification.state==="missing"&&sourceReadiness.certification.observedCount===0
                ? "certified values not confirmed"
                : fmt(sourceReadiness.certification.observedCount)+" certified values",
              sourceReadiness.receipts.state==="missing"&&sourceReadiness.receipts.observedCount===0
                ? "paid amounts not confirmed"
                : fmt(sourceReadiness.receipts.observedCount)+" paid amounts",
              sourceReadiness.receipts.state==="missing"&&sourceReadiness.receipts.paymentDateCount===0
                ? "payment dates not confirmed"
                : fmt(sourceReadiness.receipts.paymentDateCount)+" payment dates",
              sourceReadiness.expenditure.state==="missing"&&sourceReadiness.expenditure.observedCount===0
                ? "actual cash expenditure not confirmed"
                : fmt(sourceReadiness.expenditure.observedCount)+" actual cash-expenditure rows"
            ].join(" · ")
          : null;
        const actualCostContext=sourceReadiness&&sourceReadiness.expenditure.actualCostRecordCount>0&&sourceReadiness.expenditure.observedCount===0
          ? ' '+fmt(sourceReadiness.expenditure.actualCostRecordCount)+' Actual Cost row(s) exist, but AC/accrual cost is not relabelled as cash expenditure.'
          : '';
        const hero=netReady
          ? '<div class="cash-flow-hero established"><div><span>Net cash movement</span><strong>'+escapeHtml(fmtExecutive(netValue)+" "+row.currency)+'</strong><p>Actual receipts less actual expenditure. Opening cash and facilities are excluded.</p></div><div class="cash-flow-hero-stats"><div><span>Cash received</span><b>'+escapeHtml(experienceValue(paidValue,row.currency))+'</b></div><div><span>Cash spent</span><b>'+escapeHtml(experienceValue(actualValue,row.currency))+'</b></div><div><span>Peak observed deficit</span><b>'+escapeHtml(experienceValue(peakValue,row.currency))+'</b></div></div></div>'
          : '<div class="cash-flow-hero withheld"><div><span>Actual cash position</span><strong>Cash records incomplete</strong><p>Net cash requires dated receipts and expenditure. '+escapeHtml(sourceReadiness?.receipts?.observedCount>0?fmt(sourceReadiness.receipts.observedCount)+" paid amounts are available.":"Receipt amounts and dates are not confirmed.")+' '+escapeHtml(actualCostContext)+'</p></div></div>';
        const readinessGrid=sourceReadiness
          ? '<div class="cash-readiness-grid">'+
              readinessDomain(
                "Certification series",
                sourceReadiness.certification,
                readinessCoverage(sourceReadiness.certification,sourceReadiness.certification.observedCount,sourceReadiness.certification.totalCount,"amounts"),
                "payments"
              )+
              readinessDomain(
                "Actual cash receipts",
                sourceReadiness.receipts,
                readinessCoverage(sourceReadiness.receipts,sourceReadiness.receipts.observedCount,sourceReadiness.receipts.totalCount,"paid"),
                "payments"
              )+
              readinessDomain(
                "Actual cash expenditure",
                sourceReadiness.expenditure,
                sourceReadiness.expenditure.state==="missing"&&sourceReadiness.expenditure.observedCount===0?"Unresolved":fmt(sourceReadiness.expenditure.observedCount)+" cash rows",
                "cost-forecast"
              )+
              '<div class="cash-readiness-item '+escapeHtml(sourceReadiness.forwardPlan.state==="ready"?"established":"missing")+'">'+
                '<div><span>Expenditure plan coverage</span><b>'+escapeHtml(readinessStateLabel(sourceReadiness.forwardPlan.state))+'</b></div>'+
                '<span class="badge '+readinessTone(sourceReadiness.forwardPlan.state)+'">'+escapeHtml(sourceReadiness.forwardPlan.state==="missing"&&sourceReadiness.forwardPlan.budgetRecordCount===0&&sourceReadiness.forwardPlan.forecastRecordCount===0?"Unresolved":fmt(sourceReadiness.forwardPlan.budgetRecordCount)+" budget · "+fmt(sourceReadiness.forwardPlan.forecastRecordCount)+" forecast")+'</span>'+
                '<small>'+escapeHtml(sourceReadiness.forwardPlan.consequence||"")+'</small>'+
                '<div class="cash-readiness-basis"><span>Budget / forecast basis</span><b>'+escapeHtml(basisLabel(sourceReadiness.forwardPlan.budgetBasis)+" / "+basisLabel(sourceReadiness.forwardPlan.forecastBasis))+'</b></div>'+
                managementModuleLink("cost-forecast",sourceReadiness.forwardPlan.state==="ready"?"Open source":"Resolve source")+
              '</div>'+
            '</div>'
          : '';
        const curve=hasCurve
          ? '<div class="cash-flow-primary">'+renderVisualPanel(
              row.currency+' · Observed cash history',
              'Cumulative observed receipts and expenditure remain separate. Opening liquidity, facilities and future receipts are not confirmed by this history.',
              renderLineChart(points,[
                {key:"budget",label:"Expenditure budget",tone:"graphite"},
                {key:"forecast",label:"Expenditure forecast",tone:"purple"},
                {key:"actual",label:"Actual expenditure",tone:"danger"},
                {key:"certified",label:"Certified income",tone:"warning"},
                {key:"paid",label:"Paid income",tone:"success"},
                {key:"net",label:"Observed net movement",tone:"accent"}
              ],null,{unit:row.currency,yLabel:"Cash",xLabel:"Reporting date"})
            )+'</div>'
          : '<p class="certificate-footnote">Actual cash history needs at least two comparable receipt and expenditure observations. Certificate-period values are shown separately below. Add receipt dates, actual expenditure and the original advance-payment record to establish cash.</p>';
        const secondary=[];
        if([certifiedValue,paidValue,unpaidValue].some(value=>value!==null)){
          secondary.push(renderVisualPanel(
            row.currency+' · Income position',
            'Certified value, cash paid and certified-but-unpaid exposure remain distinct.',
            renderVisualBars([
              {label:"Certified income",value:certifiedValue,tone:"warning"},
              {label:"Paid income",value:paidValue,tone:"success"},
              {label:"Certified unpaid",value:unpaidValue,tone:"accent"}
            ],row.currency)
          ));
        }
        if([budgetValue,forecastValue,actualValue].some(value=>value!==null)){
          secondary.push(renderVisualPanel(
            row.currency+' · Expenditure position',
            'Budget, forecast and actual expenditure are not merged.',
            renderVisualBars([
              {label:"Budget",value:budgetValue,tone:"graphite"},
              {label:"Forecast",value:forecastValue,tone:"purple"},
              {label:"Actual",value:actualValue,tone:"danger"}
            ],row.currency)
          ));
        }
        if(knownPeriodMovements.length){
          secondary.push(renderVisualPanel(
            row.currency+' · Period cash movement',
            'Positive means paid cash exceeded actual expenditure; negative means a funding draw.',
            renderCashMovementBars(knownPeriodMovements,row.currency)
          ));
        }
        const register=entries.length
          ? '<details class="cash-flow-register-detail"><summary><div><b>Confirmed dated cash-flow register</b><span>'+escapeHtml(fmt(entries.length))+' entries</span></div><small>Receipts, payments and document references</small></summary><div class="cash-flow-register-body">'+table(["Date","Entry","Amount","Evidence state","Source"],entryRows,"No dated cash-flow entries are established.")+'</div></details>'
          : '';
        const diagnostics=(row.diagnostics||[]).length
          ? '<details class="cash-flow-trace"><summary><b>Calculation trace</b><span>'+escapeHtml(fmt(row.diagnostics.length))+' controls</span></summary><div>'+row.diagnostics.map(code=>'<div class="cash-trace-row">'+escapeHtml(humanizeKey(code))+'</div>').join("")+'</div></details>'
          : '';
        return '<section class="planning-panel primary cash-flow-position"><div class="planning-panel-head"><div><h4>'+escapeHtml(row.currency+' · '+humanizeKey(row.taxBasis||'unknown')+' tax basis')+' · Cash Flow & Funding</h4><p>Observed receipts less expenditure excludes opening cash, facilities and unrecorded cash movements. Certification and plans remain separate.</p></div><span class="badge '+(netReady?"ready":"partial")+'">'+escapeHtml(netReady?"Cash established":"Cash incomplete")+'</span></div><div class="planning-panel-body">'+
          hero+
          curve+
          experienceDisclosure("Cash inputs and coverage",readinessGrid,"Receipts, expenditure and plan")+
          (secondary.length?'<div class="commercial-visual-grid cash-flow-secondary">'+secondary.join("")+'</div>':'')+
          register+
          diagnostics+
          '</div></section>';
      }).join("");
      const certificatePanels=experienceCertificatePanels(position);
      const anyCashCurve=(performance.cashFlow?.currencies||[]).some(r=>r.sourceReadiness?.fundingCurveReady===true);
      performanceDetail=(cashSections+certificatePanels)||'<section class="planning-panel primary cash-flow-position"><div class="planning-panel-body"><div class="cash-flow-hero withheld"><div><span>Cash Flow</span><strong>Unresolved</strong><p>No confirmed cash-flow currency position can be produced from the current evidence. CMeng will not manufacture a cash curve from payment or cost values without a defensible dated cash basis.</p></div></div><div class="cash-flow-related-actions">'+managementModuleLink("payments","Open Payments")+managementModuleLink("cost-forecast","Open Cost & Forecast")+'</div></div></section>';
    }

  }
  const contractControls=position.contractControls||null;
  let contractControlDetail="";
  if(contractControls){
    if(key==="commercial-overview"){
      contractControlDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Contract obligations and securities</h4><p>Review variations, obligations, delay damages, bonds, insurance and retention with the relevant programme and claim records.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Variations",humanizeKey(contractControls.variations?.state||"missing"),countPosition(contractControls.variations?.state,contractControls.variations?.recordCount,"records")],
          ["Site Instructions",humanizeKey(contractControls.siteInstructions?.state||"missing"),countPosition(contractControls.siteInstructions?.state,contractControls.siteInstructions?.recordCount,"records")],
          ["Obligations",humanizeKey(contractControls.contractObligations?.state||"missing"),countPosition(contractControls.contractObligations?.state,contractControls.contractObligations?.recordCount,"controls")],
          ["LD",humanizeKey(contractControls.liquidatedDamages?.state||"missing"),countPosition(contractControls.liquidatedDamages?.state,contractControls.liquidatedDamages?.scenarios?.length,"scenarios")],
          ["Bonds & Insurance",humanizeKey(contractControls.bondsInsurance?.state||"missing"),countPosition(contractControls.bondsInsurance?.state,(contractControls.bondsInsurance?.bonds?.length||0)+(contractControls.bondsInsurance?.insurances?.length||0),"instruments")],
          ["Retention",humanizeKey(contractControls.retentionCalendar?.state||"missing"),countPosition(contractControls.retentionCalendar?.state,contractControls.retentionCalendar?.recordCount,"records")]
        ])+'</div></section>';
    }
    if(key==="variations-change"){
      const vo=contractControls.variations||{};
      const stageCounts=vo.lifecycleStageCounts||{};
      const ageBands=vo.pendingAgeBands||{};
      const variationPopulationEstablished=(vo.recordCount??0)>0||vo.state==="established";
      const lifecycleVisual=renderVisualPanel(
        "Variation lifecycle distribution",
        "Current controlled lifecycle stage for every variation. Instruction, submission, quotation, assessment, agreement, approval and rejection stay distinct.",
        variationPopulationEstablished?renderVisualBars([
          {label:"Instruction",value:stageCounts.instruction??0,tone:"graphite"},
          {label:"Submitted",value:stageCounts.submitted??0,tone:"accent"},
          {label:"Quoted",value:stageCounts.quoted??0,tone:"purple"},
          {label:"Assessed",value:stageCounts.assessed??0,tone:"warning"},
          {label:"Agreed",value:stageCounts.agreed??0,tone:"accent"},
          {label:"Approved",value:stageCounts.approved??0,tone:"success"},
          {label:"Rejected",value:stageCounts.rejected??0,tone:"danger"},
          {label:"Unknown",value:stageCounts.unknown??0,tone:"neutral"}
        ],"items"):'<div class="empty-visual">Variation register is not confirmed. Lifecycle counts are not confirmed.</div>'
      );
      const agingVisual=renderVisualPanel(
        "Pending and unknown-stage aging",
        "Known pending stages use dated lifecycle events. Unknown stages remain age-unassessable; closed variations are excluded.",
        variationPopulationEstablished?renderVisualBars([
          {label:"0–30 days",value:ageBands.upTo30Days??0,tone:"success"},
          {label:"31–60 days",value:ageBands.days31To60??0,tone:"accent"},
          {label:"61–90 days",value:ageBands.days61To90??0,tone:"warning"},
          {label:">90 days",value:ageBands.over90Days??0,tone:"danger"},
          {label:"Age not confirmed",value:ageBands.unknown??0,tone:"neutral"}
        ],"items"):'<div class="empty-visual">Variation aging is not assessable until a confirmed variation population is established.</div>'
      );
      const bridgeVisuals=(position.currencies||[]).map(row=>renderVisualPanel(
        row.currency+" · Contract value & change bridge",
        "Source-reported contract values retain their own authority. Reconciliation against dated change records is required before adopting them as a confirmed contract-value position.",
        renderCommercialValueBridge(
          row.originalContractValue,
          row.approvedVariationAmount,
          row.currentContractValue,
          row.pendingVariationAmount,
          row.currency
        )
      )).join("");
      const voRows=(vo.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.variationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.lifecycleStage))+'</td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(planningShortDate(row.dates?.instruction))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.submitted))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.assessed))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.agreed))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.approved))+'</td><td>'+escapeHtml(findingValue(row.ageDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.cost?.claimed))+'</td><td>'+escapeHtml(findingValue(row.cost?.assessed))+'</td><td>'+escapeHtml(findingValue(row.cost?.agreed))+'</td><td>'+escapeHtml(findingValue(row.cost?.approved))+'</td><td>'+escapeHtml(findingValue(row.scheduleImpactDays,"d"))+'</td><td>'+escapeHtml([row.instructionId,row.claimId,row.paymentId,(row.activityIds||[]).join("; ")].filter(Boolean).join(" · ")||"No cross-domain link")+'</td></tr>');
      const variationActionRows=(vo.rows||[]).map(row=>{
        const exposure=[
          row.cost?.approved?.value!==null&&row.cost?.approved?.value!==undefined?"Approved "+findingValue(row.cost.approved):null,
          row.cost?.agreed?.value!==null&&row.cost?.agreed?.value!==undefined?"Agreed "+findingValue(row.cost.agreed):null,
          row.cost?.assessed?.value!==null&&row.cost?.assessed?.value!==undefined?"Assessed "+findingValue(row.cost.assessed):null,
          row.cost?.claimed?.value!==null&&row.cost?.claimed?.value!==undefined?"Claimed "+findingValue(row.cost.claimed):null
        ].filter(Boolean).join(" · ")||"Not established";
        const action=row.lifecycleStage==="instruction"?"Obtain and record the commercial submission or quotation."
          :row.lifecycleStage==="submitted"?"Progress assessment of the submitted variation."
          :row.lifecycleStage==="quoted"?"Progress assessment of the quoted variation."
          :row.lifecycleStage==="assessed"?"Progress agreement of the assessed variation."
          :row.lifecycleStage==="agreed"?"Progress contractual approval of the agreed variation."
          :row.lifecycleStage==="unknown"?"Establish the current variation lifecycle stage from dated evidence."
          :"No open lifecycle action indicated by the current stage.";
        return '<tr><td><b>'+escapeHtml(row.variationId)+'</b> · '+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(exposure)+'</td><td>Not recorded</td><td>Not recorded</td><td>'+escapeHtml(action)+'</td><td>'+escapeHtml(humanizeKey(row.lifecycleStage))+'</td></tr>';
      });
      const si=contractControls.siteInstructions||{};
      const siteInstructionPopulationEstablished=(si.recordCount??0)>0||si.state==="established";
      const instructionPressure=renderVisualPanel(
        "Site Instruction conversion & quotation pressure",
        "An instruction is not automatically a variation. Overdue quotation and explicit VO conversion are shown separately.",
        siteInstructionPopulationEstablished?renderVisualBars([
          {label:"Instructions",value:si.recordCount??0,tone:"graphite"},
          {label:"Unquoted",value:si.unquotedCount||0,tone:"warning"},
          {label:"Overdue quotations",value:si.overdueQuotationCount||0,tone:"danger"},
          {label:"Converted to VO",value:si.convertedVariationCount||0,tone:"success"}
        ],"items"):'<div class="empty-visual">Site Instruction register is not confirmed. Conversion and quotation counts are not confirmed.</div>'
      );
      const siRows=(si.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.instructionId)+'</b></td><td>'+escapeHtml(planningShortDate(row.issueDate))+'</td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(planningShortDate(row.quotationDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.quotationDate))+'</td><td>'+escapeHtml(humanizeKey(row.quotationTimeliness))+'</td><td>'+escapeHtml(findingValue(row.openAgeDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.estimatedAmount))+'</td><td>'+escapeHtml(row.variationId||"Not linked")+'</td><td>'+escapeHtml([row.claimId,row.paymentId,(row.activityIds||[]).join("; ")].filter(Boolean).join(" · ")||"—")+'</td></tr>');
      const siteInstructionActionRows=(si.rows||[]).map(row=>{
        const exposure=[
          row.estimatedAmount?.value!==null&&row.estimatedAmount?.value!==undefined?"Estimate "+findingValue(row.estimatedAmount):null,
          row.scheduleImpactDays?.value!==null&&row.scheduleImpactDays?.value!==undefined?"Schedule impact "+findingValue(row.scheduleImpactDays,"d"):null
        ].filter(Boolean).join(" · ")||"Not established";
        const due=row.quotationDueDate?.value;
        const action=row.quotationTimeliness==="late"&&!row.quotationDate?"Escalate the overdue quotation."
          :!row.quotationDate&&due?"Obtain quotation by the confirmed due date."
          :!due?(row.quotationDueDate?.action||"Establish the quotation due-date basis.")
          :row.variationId?"Monitor the explicit variation conversion and downstream assessment."
          :"No immediate instruction action indicated by the current record.";
        return '<tr><td><b>'+escapeHtml(row.instructionId)+'</b> · '+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(exposure)+'</td><td>Not recorded</td><td>'+escapeHtml(due?planningShortDate(due):"Not recorded")+'</td><td>'+escapeHtml(action)+'</td><td>'+escapeHtml(humanizeKey(row.quotationTimeliness||row.status))+'</td></tr>';
      });
      contractControlDetail=
        '<section class="planning-panel primary variation-management-position"><div class="planning-panel-head"><div><h4>Variations & Change Management Position</h4><p>Lifecycle, aging, contract-value effect and schedule/claim/payment links remain controlled separately.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Variations by Data Date",variationPopulationEstablished?(vo.recordCount??0):"Unresolved",fmt(vo.sourceRecordCount??vo.recordCount)+" full source records retained"],
          ["Approved by Data Date",variationPopulationEstablished?(vo.approvedCount??0):"Unresolved","dated approval event"],["Future / undated records",fmt(vo.futureRecordCount??0)+" / "+fmt(vo.undatedRecordCount??0),"retained outside current stage totals"],["Stage unknown at Data Date",vo.unknownAsOfStageCount??"Unresolved","future approval does not prove a prior pending stage"],
          ["Known pending",variationPopulationEstablished?(vo.pendingCount??0):"Unresolved","dated pre-approval stages only"],
          ["Rejected",variationPopulationEstablished?(vo.rejectedCount??0):"Unresolved","closed without approval"],
          ["Final-stage coverage",vo.finalStageCoveragePercent==null?"Unresolved":fmt(vo.finalStageCoveragePercent)+"%","stage evidenced on or before Data Date"],
          ["Full lifecycle coverage",vo.fullLifecycleCoveragePercent==null?"Unresolved":fmt(vo.fullLifecycleCoveragePercent)+"%","instruction / submission / assessment / closure dates"],
          ["Schedule linkage",vo.scheduleLinkCoveragePercent==null?"Unresolved":fmt(vo.scheduleLinkCoveragePercent)+"%","time/activity evidence"],
          ["Claim linkage",vo.claimLinkCoveragePercent==null?"Unresolved":fmt(vo.claimLinkCoveragePercent)+"%","claim IDs"],
          ["Payment linkage",vo.paymentLinkCoveragePercent==null?"Unresolved":fmt(vo.paymentLinkCoveragePercent)+"%","certificate/payment IDs"]
        ])+
        '<div class="commercial-visual-grid variation-control-grid">'+lifecycleVisual+agingVisual+'</div>'+
        (bridgeVisuals?'<div class="commercial-visual-grid change-bridge-grid">'+bridgeVisuals+'</div>':"")+
        '<div class="section-heading compact"><div><h5>Variation register</h5><p>Current records only. Future and undated source records are retained in separate sections below.</p></div><span class="badge">'+escapeHtml(fmt((vo.rows||[]).length))+' records</span></div>'+
        experienceDisclosure("Review variation lifecycle records",table(["Variation","Stage","Description","Instruction","Submitted","Assessed","Agreed","Approved","Open age","Claimed","Assessed value","Agreed value","Approved value","Time impact","Cross-domain links"],voRows,"No confirmed variation lifecycle records are established."),fmt(voRows.length)+" current rows")+
        '<div class="section-heading compact"><div><h5>Variation management actions</h5><p>Owner and due date remain unassigned unless a source establishes them.</p></div></div>'+
        table(["Finding","Exposure","Owner","Due","Action","Status"],variationActionRows,"No variation management actions are currently available.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Site Instructions</h4><p>An instruction is not automatically a variation or entitlement. Quotation aging uses actual issue and due dates.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Instructions",siteInstructionPopulationEstablished?(si.recordCount??0):"Unresolved","source records"],
          ["Unquoted",siteInstructionPopulationEstablished?(si.unquotedCount??0):"Unresolved","quotation missing"],
          ["Overdue quotations",siteInstructionPopulationEstablished?(si.overdueQuotationCount??0):"Unresolved","past due"],
          ["Converted to VO",siteInstructionPopulationEstablished?(si.convertedVariationCount??0):"Unresolved","explicit link only"]
        ])+
        instructionPressure+
        table(["Instruction","Issued","Description","Status","Quote due","Quoted","Timeliness","Open age","Estimate","Variation","Other links"],siRows,"No Site Instruction register is established.")+
        '<div class="section-heading compact"><div><h5>Site Instruction management actions</h5><p>Due dates use only confirmed instruction/contract evidence; owner is not inferred.</p></div></div>'+
        table(["Finding","Exposure","Owner","Due","Action","Status"],siteInstructionActionRows,"No Site Instruction management actions are currently available.")+
        '</div></section>';
    }
    if(key==="contract-particulars-bonds"){
      const obl=contractControls.contractObligations||{};
      const ld=contractControls.liquidatedDamages||{};
      const bi=contractControls.bondsInsurance||{};
      const ret=contractControls.retentionCalendar||{};
      const obligationsEstablished=Number(obl.explicitRecordCount??0)>0;
      const bondsEstablished=Array.isArray(bi.bonds)&&bi.bonds.length>0;
      const insuranceEstablished=Array.isArray(bi.insurances)&&bi.insurances.length>0;
      const retentionRecordsEstablished=Number(ret.recordCount??(ret.rows||[]).length)>0;
      const retentionOverdueDisplay=ret.overdueCount===null||ret.overdueCount===undefined?"Not assessable":ret.overdueCount;
      const obligationVisual=renderVisualPanel(
        "Contract obligation control",
        "Only explicit controlled obligations receive compliance status. Clause-derived requirements stay candidates until mapped.",
        obligationsEstablished
          ? renderVisualBars([
              {label:"Open",value:obl.openCount??0,tone:"accent"},
              {label:"Overdue",value:obl.overdueCount??0,tone:"danger"},
              {label:"Complete",value:obl.completeCount??0,tone:"success"},
              {label:"Requirement wording groups",value:obl.clauseCandidateCount??0,tone:"warning"}
            ],"items")
          : '<div class="empty-visual">No controlled obligation register is established. Open, overdue and complete counts are not confirmed.</div>'
      );
      const securityVisual=renderVisualPanel(
        "Security & insurance monitoring",
        "Active, expiring and expired counts are monitoring indicators; expiring instruments may also be active.",
        (bondsEstablished||insuranceEstablished)
          ? renderVisualBars([
              ...(bondsEstablished?[
                {label:"Active bonds",value:bi.activeBondCount,tone:"success"},
                {label:"Expiring bonds",value:bi.expiringBondCount,tone:"warning"},
                {label:"Expired bonds",value:bi.expiredBondCount,tone:"danger"}
              ]:[]),
              ...(insuranceEstablished?[
                {label:"Active policies",value:bi.activeInsuranceCount,tone:"accent"},
                {label:"Expiring policies",value:bi.expiringInsuranceCount,tone:"warning"},
                {label:"Expired policies",value:bi.expiredInsuranceCount,tone:"danger"}
              ]:[])
            ],"instruments")
          : '<div class="empty-visual">No bond/security or insurance register is established. Instrument counts are not confirmed.</div>'
      );
      const retentionVisual=renderVisualPanel(
        "Retention release control",
        "Held, released, dated and overdue positions remain distinct; overdue may be a subset of held.",
        retentionRecordsEstablished?renderVisualBars([
          {label:"Held",value:ret.heldCount,tone:"warning"},
          {label:"Released",value:ret.releasedCount??null,tone:"success"},
          {label:"Release date established",value:ret.dueCount??0,tone:"accent"},
          ...(typeof ret.overdueCount==="number"?[{label:"Overdue unreleased",value:ret.overdueCount,tone:"danger"}]:[])
        ],"records")+
        (typeof ret.overdueCount==="number"?"":'<div class="notice info" style="margin-top:10px">Deduction rows do not establish held or released balances. Overdue retention is not assessable until release due dates or contractual release triggers are established.</div>'):'<div class="empty-visual">No retention register or confirmed balance records are established. Held, released and due counts are not confirmed.</div>'
      );
      const ldCurrencies=[...new Set((ld.scenarios||[]).map(row=>row.currency).filter(Boolean))];
      const ldVisuals=ldCurrencies.map(currency=>renderVisualPanel(
        currency+" · LD scenario exposure",
        "Only no additional EOT beyond the amendment and reconciled additional awarded-EOT scenarios may adjust project completion. Claim-register day totals never become project EOT. This is exposure analysis, not an automatic deduction.",
        renderVisualBars((ld.scenarios||[]).filter(row=>row.currency===currency).map(row=>({
          label:humanizeKey(row.scenario),
          value:metricValue(row.cappedExposure),
          tone:row.scenario==="awarded_eot"?"success":row.scenario==="no_eot"?"danger":"warning"
        })),currency)
      )).join("");
      const contractBridgeVisuals=(position.currencies||[]).map(row=>renderVisualPanel(
        row.currency+" · Contract value bridge",
        "Source contract totals retain their authority and date basis. Dated approval records require separate reconciliation. Pending changes remain outside the source current-contract total.",
        renderCommercialValueBridge(
          row.originalContractValue,
          row.approvedVariationAmount,
          row.currentContractValue,
          row.pendingVariationAmount,
          row.currency
        )
      )).join("");
      const obligationRows=(obl.rows||[]).map((row,index)=>'<tr><td><b>'+escapeHtml(row.origin==='contract_clause_candidate'?'Requirement wording group '+(index+1):row.obligationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.origin))+'</td><td>'+escapeHtml(row.clauseIdentifier||(row.referencedClauseIdentifiers||[]).map(id=>"References "+id).join(", ")||"Not identified")+'</td><td>'+'<details><summary>Read requirement · '+fmt(row.occurrenceCount??1)+' source occurrences</summary><p>'+escapeHtml(row.description||"")+'</p></details></td><td>'+escapeHtml(row.responsibleParty||"Not mapped")+'</td><td>'+escapeHtml(planningShortDate(row.dueDate))+'</td><td>'+escapeHtml(planningShortDate(row.completedDate))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.daysToDue,"d"))+'</td><td>'+'<details><summary>'+fmt((row.sourceRefs||[]).length)+' document references</summary><p>'+escapeHtml(row.obligationId)+'</p><ul>'+(row.sourceRefs||[]).map(ref=>'<li>'+escapeHtml(ref)+'</li>').join('')+'</ul></details>'+'</td></tr>');
      const ldRows=(ld.scenarios||[]).map(row=>'<tr><td><b>'+escapeHtml(row.scenario==="no_eot"?"No additional EOT beyond amendment":row.scenario==="awarded_eot"?"Reconciled additional EOT":humanizeKey(row.scenario))+'</b></td><td>'+escapeHtml(findingValue(row.eotDays,"d"))+'</td><td>'+escapeHtml(row.adjustedCompletion?.value?planningShortDate(row.adjustedCompletion.value):"Unresolved")+'</td><td>'+escapeHtml(row.forecastCompletion?.value?planningShortDate(row.forecastCompletion.value):"Unresolved")+'</td><td>'+escapeHtml(findingValue(row.exposureDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.uncappedExposure,row.currency||""))+'</td><td>'+escapeHtml(findingValue(row.capAmount,row.currency||""))+'</td><td>'+escapeHtml(findingValue(row.cappedExposure,row.currency||""))+'</td><td>'+escapeHtml(findingMeta(row.cappedExposure))+'</td></tr>');
      const ldActionRows=(ld.scenarios||[]).map(row=>{
        const exposure=row.cappedExposure?.value!==null&&row.cappedExposure?.value!==undefined?findingValue(row.cappedExposure,row.currency||""):"Not established";
        const due=row.adjustedCompletion?.value;
        const action=row.cappedExposure?.action||row.exposureDays?.action||(row.exposureDays?.value>0?"Review LD exposure against the governed contract terms and entitlement position.":"No current calculated LD exposure.");
        return '<tr><td><b>'+escapeHtml(row.scenario==="no_eot"?"No additional EOT beyond amendment":row.scenario==="awarded_eot"?"Reconciled additional EOT":humanizeKey(row.scenario))+'</b></td><td>'+escapeHtml(exposure)+'</td><td>Not recorded</td><td>'+escapeHtml(due?planningShortDate(due):"Not recorded")+'</td><td>'+escapeHtml(action)+'</td><td>'+escapeHtml(humanizeKey(row.cappedExposure?.state||ld.state||"missing"))+'</td></tr>';
      });
      const bondRows=(bi.bonds||[]).map(row=>'<tr><td><b>'+escapeHtml(row.bondId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.amount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td><td>'+escapeHtml(row.daysToExpiry?.action||"—")+'</td></tr>');
      const insuranceRows=(bi.insurances||[]).map(row=>'<tr><td><b>'+escapeHtml(row.policyId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(row.insurer||"Not stated")+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.coverageAmount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td><td>'+escapeHtml(row.sourceRequirement||"Not linked")+'</td><td>'+escapeHtml(row.daysToExpiry?.action||"—")+'</td></tr>');
      const retentionRows=(ret.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.retentionId)+'</b></td><td>'+escapeHtml(humanizeKey(row.origin))+'</td><td>'+escapeHtml(row.certificateNo||"—")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(row.trigger||"Unresolved")+'</td><td>'+escapeHtml(findingValue(row.amount))+'</td><td>'+escapeHtml(row.dueDate?.value?planningShortDate(row.dueDate.value):"Unresolved")+'</td><td>'+escapeHtml(planningShortDate(row.releaseDate))+'</td><td>'+escapeHtml(findingValue(row.daysToDue,"d"))+'</td></tr>');
      contractControlDetail=
        '<section class="planning-panel primary contract-particulars-management"><div class="planning-panel-head"><div><h4>Contract Particulars, Securities & Obligations Management Position</h4><p>Contract value, obligations, LD scenarios, securities, insurance and retention are controlled as separate evidence-backed positions.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Controlled obligation records",obligationsEstablished?(obl.explicitRecordCount??0):"Unresolved","explicit register"],
          ["Open obligations",obligationsEstablished?(obl.openCount??0):"Unresolved","controlled obligation register"],
          ["Overdue obligations",obligationsEstablished?(obl.overdueCount??0):"Unresolved","controlled obligation register"],
          ["Active bonds",bondsEstablished?(bi.activeBondCount??"Unresolved"):"Unresolved","security register instruments"],
          ["Expiring bonds",bondsEstablished?(bi.expiringBondCount??"Unresolved"):"Unresolved","security register instruments"],
          ["Expired bonds",bondsEstablished?(bi.expiredBondCount??"Unresolved"):"Unresolved","security register instruments"],
          ["Reconciled held records",retentionRecordsEstablished&&(ret.rows||[]).some(r=>r.origin!=="payment_deduction")?(ret.heldCount??0):"Unresolved","deduction records do not prove held balances"],
          ["Retention overdue",retentionOverdueDisplay,"requires release due dates"]
        ])+
        (contractBridgeVisuals?'<div class="commercial-visual-grid contract-bridge-grid">'+contractBridgeVisuals+'</div>':"")+
        '<div class="commercial-visual-grid contract-control-grid">'+obligationVisual+securityVisual+retentionVisual+ldVisuals+'</div>'+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Contract Obligations</h4><p>Explicit obligation controls remain separate from clause-derived candidates. A clause does not invent compliance status.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Controlled obligation records",obligationsEstablished?(obl.explicitRecordCount??0):"Unresolved","explicit register"],
          ["Requirement wording groups",obl.clauseCandidateCount||0,"repeated source sections grouped; requires review"],
          ["Open",obligationsEstablished?(obl.openCount??0):"Unresolved","controlled obligation register"],
          ["Overdue",obligationsEstablished?(obl.overdueCount??0):"Unresolved","controlled obligation register"],
          ["Complete",obligationsEstablished?(obl.completeCount??0):"Unresolved","controlled obligation register"]
        ])+
        table(["Obligation","Origin","Clause","Requirement","Responsible","Due","Completed","Status","Days to due","Evidence"],obligationRows,"No controlled obligation register or promoted clause candidates are established. This does not mean the contract contains no obligations.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Liquidated Damages Scenarios</h4><p>Only no additional EOT beyond the amendment and reconciled additional awarded-EOT time bases may adjust project completion. Claim-register day totals are statistics only and never become project EOT.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["LD state",humanizeKey(ld.state||"missing"),"scenario authority"],
          ["Rate",humanizeKey(ld.rateState||"missing"),"contract term"],
          ["Cap",humanizeKey(ld.capState||"missing"),"contract term"],
          ["Scenarios",(ld.scenarios||[]).length,"time positions"]
        ])+
        table(["Scenario","EOT","Adjusted completion","Forecast completion","Exposure days","Uncapped","Cap","Capped","Authority"],ldRows,"No defensible LD scenario can be calculated from the current evidence.")+
        '<div class="section-heading compact"><div><h5>LD management actions</h5><p>Owner is not inferred. Due uses the governed adjusted contractual completion where available.</p></div></div>'+
        table(["Finding","Exposure","Owner","Due","Action","Status"],ldActionRows,"No LD management actions are currently available.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Bonds & Insurance</h4><p>Security values, cash balances, contractual requirements and expiry status remain distinct.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Active bonds",bondsEstablished?(bi.activeBondCount??"Unresolved"):"Unresolved","security register records"],
          ["Expired bonds",bondsEstablished?(bi.expiredBondCount??"Unresolved"):"Unresolved","security register records"],
          ["Expiring bonds",bondsEstablished?(bi.expiringBondCount??"Unresolved"):"Unresolved","security register records"],
          ["Active policies",insuranceEstablished?(bi.activeInsuranceCount??"Unresolved"):"Unresolved","insurance register records"],
          ["Expired policies",insuranceEstablished?(bi.expiredInsuranceCount??"Unresolved"):"Unresolved","insurance register records"],
          ["Expiring policies",insuranceEstablished?(bi.expiringInsuranceCount??"Unresolved"):"Unresolved","insurance register records"]
        ])+
        '<div class="notice info"><b>Performance requirement:</b> '+escapeHtml(findingValue(bi.performanceBondRequirement))+' · '+escapeHtml(findingMeta(bi.performanceBondRequirement))+'<br><b>Advance-payment requirement:</b> '+escapeHtml(findingValue(bi.advancePaymentBondRequirement))+' · '+escapeHtml(findingMeta(bi.advancePaymentBondRequirement))+'<br><b>Contract insurance requirements:</b> '+escapeHtml(bi.insuranceRequirementCount>0?bi.insuranceRequirementCount:'Unresolved')+'</div>'+
        table(["Bond","Type","Status","Amount","Expiry","Days","Expiry state","Action"],bondRows,"No bond/security register is established.")+
        table(["Policy","Type","Insurer","Status","Coverage","Expiry","Days","Expiry state","Requirement","Action"],insuranceRows,"No insurance-policy register is established.")+'<div class="notice info">Policy records outside the current population: '+fmt(bi.futureInsurances?.length??0)+' future · '+fmt(bi.undatedInsurances?.length??0)+' undated. These remain in the source register.</div>'+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Retention Calendar</h4><p>Percentage, cap, deduction, held balance, release due date and actual release are not interchangeable.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Retention rate",findingValue(ret.retentionPercent,"%"),findingMeta(ret.retentionPercent)],
          ["Retention cap",findingValue(ret.retentionCapPercent,"%"),findingMeta(ret.retentionCapPercent)],
          ["Records by Data Date",retentionRecordsEstablished?(ret.recordCount??0):"Unresolved",fmt(ret.sourceRecordCount??ret.recordCount)+" full source records"],["Future / undated records",fmt(ret.futureRows?.length??0)+" / "+fmt(ret.undatedRows?.length??0),"excluded from current totals"],
          ["Reconciled held records",retentionRecordsEstablished&&(ret.rows||[]).some(r=>r.origin!=="payment_deduction")?(ret.heldCount??0):"Unresolved","deductions excluded from held count"],
          ["Released",retentionRecordsEstablished?(ret.releasedCount??null):"Unresolved","explicit release state"],
          ["Dated",retentionRecordsEstablished?(ret.dueCount??0):"Unresolved","release date/trigger established"],
          ["Overdue",retentionOverdueDisplay,"requires release due dates"]
        ])+
        table(["Retention","Origin","Certificate","State","Trigger","Amount","Due","Released","Days to due"],retentionRows,"No retention calendar records are established.")+
        '</div></section>';
    }
  }
  const commercialSummaryPanel=(heading,copy)=>
    '<section class="planning-panel primary commercial-management-summary"><div class="planning-panel-head"><div><h4>'+escapeHtml(heading)+'</h4><p>'+escapeHtml(copy)+'</p></div></div><div class="planning-panel-body"><div class="grid three">'+cards+'</div></div></section>';
  let detail="";
  let registerVisual="";
  if(key==="variations-change"&&!contractControls){
    const variationStates=(registers.variations||[]).reduce((map,row)=>{const state=humanizeKey(row.state||"unknown");map.set(state,(map.get(state)||0)+1);return map},new Map());
    if(variationStates.size)registerVisual=renderVisualPanel(
      "Variation status by Data Date",
      "Only records evidenced by the Data Date enter this distribution. Future and undated records are shown separately in Variations & Change.",
      renderDonutChart([...variationStates.entries()].map(([label,value])=>({label,value,tone:/approved/i.test(label)?"success":/pending|review/i.test(label)?"warning":"neutral"})),"Variations")
    );
    const rows=(registers.variations||[]).map(row=>'<tr><td><b>'+escapeHtml(row.variationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(fmt(row.amount))+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Variation register</h4><p>Approved and pending change remain separate and retain source lineage.</p></div></div><div class="planning-panel-body">'+table(["Variation","State","Amount","Currency","Source"],rows,"No confirmed variation records are established.")+'</div></section>';
  }
  if(key==="payments"){
    const rows=(registers.invoices||[]).map(row=>'<tr><td><b>'+escapeHtml(row.invoiceId)+'</b></td><td>'+escapeHtml(planningShortDate(row.certificateDateIso))+'</td><td>'+escapeHtml(fmt(row.certifiedAmount))+'</td><td>'+escapeHtml(fmt(row.paidAmount))+'</td><td>'+escapeHtml(fmt(row.retentionAmount))+'</td><td>'+escapeHtml(fmt(row.advanceRecoveryAmount))+'</td><td>'+escapeHtml(fmt(row.advanceBalance))+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml(planningShortDate(row.paymentDateIso))+'</td></tr>');
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Certificate and payment source register</h4><p>Source certificate rows remain available beneath the confirmed payment lifecycle; values are not re-summed in the browser.</p></div></div><div class="planning-panel-body">'+table(["Certificate","Certificate date","Certified","Paid","Retention","Advance recovery","Advance balance","Currency","Payment date"],rows,"Certificate amounts are not yet confirmed. The complete register is retained below.")+'</div></section>';
  }
  if(key==="commercial-claims-notices"){
    const cn=position.claimsNotices||p.focus?.claimsNotices||{};
    const stateCounts=(cn.claims||[]).reduce((counts,c)=>{const state=c.sourceRegister?.state||c.state;counts[state]=(counts[state]||0)+1;return counts;},{});
    const timeliness=cn.noticeTimelinessCounts||{};
    const kindCounts=cn.noticeKindCounts||{};
    const lifecyclePopulationEstablished=Array.isArray(cn.claims)&&cn.claims.length>0;
    const noticeAssessmentPopulationEstablished=Array.isArray(cn.noticeAssessments)&&cn.noticeAssessments.length>0;
    const noticePopulationEstablished=Array.isArray(cn.notices)&&cn.notices.length>0;
    const noticeEvidenceGapCount=(timeliness.requirement_conflicted??0)+(timeliness.requirement_missing??0)+(timeliness.event_date_missing??0)+(timeliness.notice_date_missing??0);
    const claimLifecycleVisual=renderVisualPanel(
      "Source claim lifecycle distribution",
      "Source final stages are retained. Current lifecycle state requires dated stage history; future decisions cannot backdate a claim.",
      lifecyclePopulationEstablished?renderVisualBars([
        {label:"Draft",value:stateCounts.draft??0,tone:"neutral"},
        {label:"Submitted",value:stateCounts.submitted??0,tone:"accent"},
        {label:"Under review",value:stateCounts.under_review??0,tone:"warning"},
        {label:"Determined",value:stateCounts.determined??0,tone:"success"},
        {label:"Rejected",value:stateCounts.rejected??0,tone:"danger"},
        {label:"Withdrawn",value:stateCounts.withdrawn??0,tone:"graphite"},
        {label:"Unknown",value:stateCounts.unknown??0,tone:"neutral"}
      ],"claims"):'<div class="empty-visual">No confirmed claim lifecycle population is established. Lifecycle counts are not confirmed.</div>'
    );
    const assessableNoticeCount=(timeliness.timely??0)+(timeliness.late??0)+(timeliness.not_issued??0);
    const noticeTimelinessVisual=renderVisualPanel(
      "Notice timeliness position",
      "Compliance outcomes and independent evidence gaps are separate. Missing requirement, event-date and notice-date counts can overlap.",
      noticeAssessmentPopulationEstablished?(assessableNoticeCount===0?'<div class="empty-visual">No event has an assessable notice outcome. Timely, late and not-issued counts are not confirmed; the bars below identify evidence gaps.</div>':'')+renderVisualBars([
        ...(assessableNoticeCount>0?[{label:"Timely",value:timeliness.timely??0,tone:"success"},
        {label:"Late",value:timeliness.late??0,tone:"danger"},
        {label:"Not issued",value:timeliness.not_issued??0,tone:"warning"}]:[]),
        {label:"Requirement missing",value:cn.dimensionalEvidenceGaps?.requirementMissing??timeliness.requirement_missing??0,tone:"neutral"},
        {label:"Event date missing",value:cn.dimensionalEvidenceGaps?.eventDateMissing??timeliness.event_date_missing??0,tone:"neutral"},
        {label:"Notice date missing",value:cn.dimensionalEvidenceGaps?.noticeDateMissing??timeliness.notice_date_missing??0,tone:"neutral"}
      ],"events"):'<div class="empty-visual">Notice timeliness is not assessable until confirmed event, requirement and notice-date evidence is established.</div>'
    );
    const noticeKindVisual=renderVisualPanel(
      "Notice / correspondence lifecycle",
      "Correspondence evidenced by the Data Date. Future notices remain in the excluded source register. Notices and determinations retain separate identities.",
      noticePopulationEstablished?renderVisualBars([
        {label:"Notice",value:kindCounts.notice??0,tone:"graphite"},
        {label:"Early warning",value:kindCounts.early_warning??0,tone:"accent"},
        {label:"EOT notice",value:kindCounts.eot_notice??0,tone:"warning"},
        {label:"Claim notice",value:kindCounts.claim_notice??0,tone:"purple"},
        {label:"Detailed claim",value:kindCounts.detailed_claim??0,tone:"danger"},
        {label:"Response",value:kindCounts.response??0,tone:"accent"},
        {label:"Determination",value:kindCounts.determination??0,tone:"success"}
      ],"records"):'<div class="empty-visual">No confirmed notice/correspondence register is established. Type counts are not confirmed.</div>'
    );
    const financialRows=(registers.claims||[]).map(row=>'<tr><td><b>'+escapeHtml(row.claimId)+'</b></td><td>'+escapeHtml(row.claimedAmount===null||row.claimedAmount===undefined?"Unresolved":fmt(row.claimedAmount))+'</td><td>'+escapeHtml(row.assessedAmount===null||row.assessedAmount===undefined?"Unresolved":fmt(row.assessedAmount))+'</td><td>'+escapeHtml(row.currency||"Unresolved")+'</td></tr>');
    const lifecycleRows=(cn.claims||[]).map(row=>({...row,...(row.sourceRegister||{}),state:row.sourceRegister?.sourceStatus||row.state})).map(row=>'<tr><td><b>'+escapeHtml(row.claimId)+'</b></td><td>'+escapeHtml(row.title||"")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(planningShortDate(row.submittedAt))+'</td><td>'+escapeHtml(row.claimedDays===null||row.claimedDays===undefined?"Unresolved":fmt(row.claimedDays)+" d")+'</td><td>'+escapeHtml(row.assessedDays===null||row.assessedDays===undefined?"Unresolved":fmt(row.assessedDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.assessedDaysState||"missing"))+'</td><td>'+escapeHtml((row.eventIds||[]).join(", ")||"Not linked")+'</td><td>'+escapeHtml((row.clauseIdentifiers||[]).join(", ")||"—")+'</td></tr>');
    const assessmentRows=(cn.noticeAssessments||[]).map(row=>'<tr><td><b>'+escapeHtml(row.eventId)+'</b></td><td>'+escapeHtml(row.eventTitle||"")+'</td><td>'+escapeHtml(row.requirementId||"Unresolved")+'</td><td>'+escapeHtml(row.requiredNoticeDays===null||row.requiredNoticeDays===undefined?"Unresolved":fmt(row.requiredNoticeDays)+" d")+'</td><td>'+escapeHtml(planningShortDate(row.eventStartIso))+'</td><td>'+escapeHtml(row.noticeId||"Not issued")+'</td><td>'+escapeHtml(planningShortDate(row.noticeIssuedAt))+'</td><td>'+escapeHtml(row.elapsedDays===null||row.elapsedDays===undefined?"Unresolved":fmt(row.elapsedDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.timeliness))+'</td><td>'+escapeHtml(humanizeKey(row.requirementState||"missing"))+'</td></tr>');
    const noticeRows=(cn.notices||[]).map(row=>'<tr><td><b>'+escapeHtml(row.noticeId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(row.eventId||"—")+'</td><td>'+escapeHtml(row.claimId||"—")+'</td><td>'+escapeHtml(planningShortDate(row.actualIssuedAt))+'</td><td>'+escapeHtml(planningShortDate(row.actualReceivedAt))+'</td><td>'+escapeHtml(row.subject||"")+'</td><td>'+escapeHtml((row.clauseIdentifiers||[]).join(", ")||"—")+'</td></tr>');
    const evidenceTraceRows=[
      ...(registers.claims||[]).map(row=>({type:"Commercial claim",id:row.claimId,refs:row.sourceRefs||[]})),
      ...(cn.claims||[]).map(row=>({type:"Claim lifecycle",id:row.claimId,refs:row.sourceRefs||[]})),
      ...(cn.notices||[]).map(row=>({type:"Notice",id:row.noticeId,refs:row.sourceRefs||[]}))
    ].filter(row=>row.refs.length).map(row=>'<tr><td>'+escapeHtml(row.type)+'</td><td><b>'+escapeHtml(row.id)+'</b></td><td>'+escapeHtml(row.refs.join(", "))+'</td></tr>');
    const evidenceTrace='<details class="management-detail"><summary>Evidence & technical trace <span>'+escapeHtml(fmt(evidenceTraceRows.length))+' linked records</span></summary><div class="planning-panel-body">'+table(["Record type","Record","Evidence references"],evidenceTraceRows,"No technical evidence references are attached.")+'</div></details>';
    detail='<section class="planning-panel primary commercial-claims-management"><div class="planning-panel-head"><div><h4>Financial claim review</h4><p>This is the financial view of the same claim identities used in Delay & Time Entitlement. Counts are shared, not additional claims; reported register amounts and dated decisions remain separate.</p></div></div><div class="planning-panel-body">'+
      planningKpis([
        ["Lifecycle claims by Data Date",countPosition(cn.state,cn.lifecycleClaimCount,"claims"),"current population; historical stage dates incomplete"],
        ["Commercial claim rows",countPosition(cn.state,cn.commercialClaimCount,"rows"),"currency-specific money register"],
        ["Events",countPosition(cn.state,cn.eventCount,"events"),"recorded delay events"],
        ["Notices by Data Date",cn.asOfNoticeCount??"Unresolved","full source: "+fmt(cn.sourceNoticeCount)+" · determinations separate"],["Future / undated notices",fmt(cn.futureNoticeCount??0)+" / "+fmt(cn.undatedNoticeCount??0),"excluded from current notice assessment"],["Event dates missing",cn.dimensionalEvidenceGaps?.eventDateMissing??"Unresolved","overlaps other evidence gaps"],
        ["Notice evidence gaps",noticeAssessmentPopulationEstablished?noticeEvidenceGapCount:"Not assessable","requirement / event date / notice date",noticeEvidenceGapCount?"warning":""],
        ["Money ↔ lifecycle linkage",cn.commercialLifecycleLinkCoveragePercent===null||cn.commercialLifecycleLinkCoveragePercent===undefined?"Unresolved":fmt(cn.commercialLifecycleLinkCoveragePercent)+"%","claim ID correspondence"],
        ["Financial exposure",position.currencies.some(r=>r.claimedAmount?.value!=null)?"See currency positions":"Unresolved","claim amounts and cost linkage required"],["Determination records",kindCounts.determination??0,"separate from notice count"]
      ])+
      '<div class="notice info"><b>Latest extracted notice period: '+escapeHtml(foundation?.commercialTerms?.noticePeriodDays?.value==null?'Unresolved':fmt(foundation.commercialTerms.noticePeriodDays.value)+' days')+'</b>. Earlier contract versions can have different periods. Review the dated rule groups above; event or awareness dates, day basis and retrospective effect remain to be confirmed. Evidence gaps are independent and can overlap. Source claim final stages and determination records have different identities and dates. Final source stages are not reconstructed historical stages at the Data Date.</div>'+
      (noticeEvidenceGapCount?'<div class="notice warn"><b>Notice compliance requires evidence review.</b> '+escapeHtml(fmt(noticeEvidenceGapCount))+' event assessment(s) are missing the applicable requirement, event date or notice date. These remain evidence gaps rather than zero or compliant outcomes.</div>':'')+
      '<div class="commercial-visual-grid claims-lifecycle-grid">'+claimLifecycleVisual+noticeTimelinessVisual+noticeKindVisual+'</div>'+
      '<div class="section-heading compact"><div><h5>Commercial claim money register</h5><p>Amounts are shown from the controlled currency register; partial coverage is not promoted to a complete total.</p></div><span class="badge">'+escapeHtml(fmt((registers.claims||[]).length))+' records</span></div>'+
      table(["Claim","Claimed","Assessed","Currency"],financialRows,"No confirmed commercial claim money rows are established.")+
      '<p>Time-claim amounts, statuses and notice evidence above refer to the same identities used in the time assessment. '+managementModuleLink('notices-claims','Open claim and notice records')+'</p>'+
      evidenceTrace+
      ((cn.diagnostics||[]).length?'<div class="notice info">Claim amounts are linked to claim history by claim ID. Notice timing uses the applicable contract period and actual event and notice dates. Claims without matching financial records remain listed with amounts unconfirmed.</div>'+experienceDisclosure("Calculation notes",'<p>'+escapeHtml(cn.diagnostics.map(humanizeKey).join("; "))+'</p>',"Original checks and matching rules"):"")+
      '</div></section>';
  }
  if(key==="contract-particulars-bonds"&&!contractControls){
    const bondStates=(registers.bonds||[]).reduce((map,row)=>{const state=humanizeKey(row.status||"unknown");map.set(state,(map.get(state)||0)+1);return map},new Map());
    if(bondStates.size)registerVisual=renderVisualPanel(
      "Security status",
      "Performance, advance-payment and retention securities by status.",
      renderDonutChart([...bondStates.entries()].map(([label,value])=>({label,value,tone:/active|valid/i.test(label)?"success":/expired|called/i.test(label)?"danger":"warning"})),"Securities")
    );
    const rows=(registers.bonds||[]).map(row=>'<tr><td><b>'+escapeHtml(row.bondId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(fmt(row.amount))+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(planningShortDate(row.expiryIso))+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Security register</h4><p>Performance, advance-payment and retention securities remain distinct from cash balances.</p></div></div><div class="planning-panel-body">'+table(["Bond / guarantee","Type","Amount","Currency","Status","Expiry","Source"],rows,"No confirmed bond/security register is established.")+'</div></section>';
  }
  const cashEstablished=key==="cash-flow"&&Array.isArray(p.focus?.transactions)&&p.focus.transactions.length>0;
  const cashNote=key==="cash-flow"
    ? '<div class="notice '+(cashEstablished?'info':'warn')+'"><b>Cash-flow time series '+(cashEstablished?'uses explicit dated transactions.':'is evidence-gated.')+'</b> '+(cashEstablished?'Certificate and payment dates are retained for the transaction series.':'CMeng will not invent a time series from cumulative certificate totals. Dated certificate/payment transactions are required.')+'</div>'
    : "";
  const ledger=position.sourceLedger;
  let ledgerDetail="";
  const ledgerIssues=ledger?(ledger.costPosition||[]).flatMap(row=>row.diagnostics||[]).filter(issue=>/CONFLICT|UNRESOLVED/.test(issue)):[];
  const temporalScope=["variations-change","cash-flow"].includes(key)?experienceDisclosure("Full reporting scope",renderCommercialTemporalPosition(ledger),"Dated, future and undated populations"):"";
  const temporalWarning=renderCommercialExceptions(position,key,data);
  if(ledger){
    const section=(moduleKey,rows,summary={})=>renderCommercialLedgerVisual({projectionKey:"commercial_canonical",moduleKey,rows,summary,dataDateIso:ledger.dataDateIso,diagnostics:ledger.diagnostics});
    if(key==="cost-forecast"||key==="commercial-overview") ledgerDetail=section("commercial-cost-position",ledger.costPosition)+section("commercial-cost-register",ledger.costMetrics);
    if(key==="payments"||key==="cash-flow") ledgerDetail=section("commercial-payment-register",ledger.payments,{effectiveRecordCount:ledger.payments.filter(r=>r.periodEnd&&ledger.dataDateIso&&r.periodEnd<=ledger.dataDateIso).length});
    if(key==="variations-change") ledgerDetail=experienceDisclosure("Variation source evidence",section("commercial-variations",ledger.variations),"Current, future and undated records");
  }
  if((key==='payments'||key==='cash-flow')&&ledger?.advancePayments?.length){
    ledgerDetail+='<section class="planning-panel"><h4>Advance payments</h4><p>These rows are retained separately and excluded from interim certificate totals.</p>'+table(['Reference','Period','Recorded advance','Currency','Recorded status'],ledger.advancePayments.map(r=>'<tr><td>'+escapeHtml(r.paymentId)+'</td><td>'+escapeHtml(planningShortDate(r.periodEnd))+'</td><td>'+escapeHtml(r.amounts.netCertifiedAmount.value===null?'Unresolved: amount not read':fmt(r.amounts.netCertifiedAmount.value))+'</td><td>'+escapeHtml(r.amounts.netCertifiedAmount.currency||'Unresolved: currency not stated')+'</td><td>'+escapeHtml(r.sourceStatus||'Unresolved: status not stated')+'</td></tr>'),'No advance rows were recognised.')+'</section>';
  }
  const evidencePanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Available records</h4><p>Source availability is separate from current lifecycle, reconciliation and analytical readiness shown above.</p></div></div><div class="planning-panel-body">'+gates+'</div></section>';
  if(key==="commercial-overview"){
    return '<section class="planning-view commercial-view commercial-overview-enterprise">'+
      commercialSummaryPanel('Executive Commercial Position','Contract, change, certification, cash and claim exposure are shown first, by currency, without cross-currency arithmetic.')+
      commercialCharts+
      time+
      temporalWarning+temporalScope+
      registerVisual+
      experienceDisclosure('Supporting commercial information',foundationDetail+performanceDetail+contractControlDetail,'Documents, amounts and dates to confirm')+
      detail+
      experienceDisclosure('Commercial source ledger',ledgerDetail,'Source values and references')+
      evidencePanel+
      '</section>';
  }
  if(key==="cost-forecast"){
    return '<section class="planning-view commercial-view cost-forecast-enterprise">'+temporalWarning+temporalScope+
      performanceDetail+
      commercialSummaryPanel('Cost outlook summary','Original and current contract sums are not procurement commitments. Valued purchase orders or subcontracts are needed for a commitment position. Currency and source status remain separate.')+
      time+
      registerVisual+
      experienceDisclosure('Cost register and work breakdown',foundationDetail,'Review source mapping')+
      detail+
      experienceDisclosure('Cost source ledger',ledgerDetail,'Reported values and source status')+
      evidencePanel+
      '</section>';
  }
  if(key==="variations-change"){
    return '<section class="planning-view commercial-view variations-enterprise">'+temporalWarning+temporalScope+
      contractControlDetail+
      commercialSummaryPanel('Change Exposure by Currency','Approved and pending change remain separate and are never cross-summed between currencies.')+
      commercialCharts+
      time+
      detail+
      ledgerDetail+
      evidencePanel+
      '</section>';
  }
  if(key==="payments"){
    return '<section class="planning-view commercial-view payments-enterprise">'+experienceCertificatePanels(position)+temporalWarning+temporalScope+
      commercialSummaryPanel('Payment Value Position by Currency','Certified, paid, unpaid, retention and advance positions come from the confirmed Commercial position.')+
      experienceDisclosure('Payment dates and lifecycle',foundationDetail,'Application, assessment, certification and receipt evidence')+
      experienceDisclosure('Certificate and payment source records',detail+ledgerDetail,'Components, balances and excluded periods')+
      time+
      evidencePanel+
      '</section>';
  }
  if(key==="cash-flow"){
    return '<section class="planning-view commercial-view cash-flow-enterprise">'+
      performanceDetail+experienceDisclosure("Source payment register and reporting scope",temporalScope+ledgerDetail,"Current, future and undated records")+
      '<details class="cash-flow-evidence-detail"><summary><div><b>Documents and approvals</b><span>References and approval status</span></div></summary><div class="cash-flow-evidence-body">'+gates+'</div></details>'+
      '</section>';
  }
  if(key==="commercial-claims-notices"){
    return '<section class="planning-view commercial-view commercial-claims-enterprise">'+
      commercialSummaryPanel('Claim Financial Exposure by Currency','Known claimed and assessed values come from the controlled financial register. Partial amount coverage remains explicitly partial.')+
      commercialCharts+temporalWarning+temporalScope+detail+
      time+
      evidencePanel+
      '</section>';
  }
  if(key==="contract-particulars-bonds"){
    const bi=contractControls?.bondsInsurance;
    return '<section class="planning-view commercial-view contract-particulars-enterprise">'+planningKpis([["Active bonds",bi?.activeBondCount,"security register"],["Expired bonds",bi?.expiredBondCount,"at the Data Date"],["Expiring bonds",bi?.expiringBondCount,"security register"],["Active insurance policies",bi?.activeInsuranceCount,"insurance register"]])+temporalWarning+temporalScope+
      commercialSummaryPanel('Contract Value & Security Position by Currency','Contract and security amounts are shown by currency, with the status of each supporting record.')+
      '<div class="notice info"><b>'+fmt(contractControls?.contractObligations?.candidateCount??contractControls?.contractObligations?.rows?.filter(r=>r.origin==='contract_clause_candidate').length??0)+' requirement wording groups</b><p>Source wording is available for review. Obligation owners, due dates, compliance and security instruments require their own records.</p></div>'+
      experienceDisclosure('Contract wording, obligations and securities',contractControlDetail+foundationDetail+detail+renderContractSourceContext(data.contractSourceContext),'Complete wording, document references and missing records')+
      time+
      evidencePanel+
      '</section>';
  }
  return '<section class="planning-view commercial-view">'+temporalWarning+temporalScope+time+cashNote+commercialCharts+registerVisual+foundationDetail+performanceDetail+contractControlDetail+ledgerDetail+
    commercialSummaryPanel(names[key]||"Commercial position",'Values remain isolated by currency and every missing value retains its evidence state.')+
    detail+
    evidencePanel+
    '</section>';
}

function managementAuthorityBadge(authority){
  const label=humanizeKey(authority||"unavailable");
  const cls=["official","submitted","governed","source","source_current","calculated"].includes(authority)?"ready":["provisional","partial","conflicted","stale","candidate"].includes(authority)?"partial":"blocked";
  return '<span class="badge '+cls+'">'+escapeHtml(label)+'</span>';
}
function managementHealthBadge(health){
  const label=humanizeKey(health||"unavailable");
  const cls=health==="good"?"ready":health==="attention"?"partial":health==="critical"?"blocked":"blocked";
  return '<span class="badge '+cls+'">'+escapeHtml(label)+'</span>';
}
function managementModuleLink(key,label="Open owning module"){
  if(!key)key="documents";
  if(!names[key]&&key!=="documents")return '<span class="muted">Correction route requires review</span>';
  return '<button type="button" class="management-module-link" data-module="'+escapeHtml(key)+'">'+escapeHtml(label)+'</button>';
}
function managementPanel(title,description,body,primary=false){
  return '<section class="planning-panel '+(primary?'primary ':'')+'management-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';
}
function managementMetricDisplay(metric){
  const value=metric?.value;
  if(value===null||value===undefined)return{text:"Unresolved",kind:"missing"};
  if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)){
    return{text:planningShortDate(value),kind:"date"};
  }
  if(typeof value==="number"){
    return{text:(metric?.unit==="calendar days"?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value):fmtExecutive(value))+(metric?.unit?" "+metric.unit:""),kind:"number"};
  }
  return{text:String(value)+(metric?.unit?" "+metric.unit:""),kind:"text"};
}
function managementMetricBadges(metric){
  const state=metric?.state||"unavailable";
  const authority=metric?.authority||"unavailable";
  if(state===authority)return managementAuthorityBadge(state);
  if(["source_current","governed","calculated"].includes(state)&&authority!=="unavailable")return managementAuthorityBadge(authority);
  const badge=(prefix,value)=>{
    const label=humanizeKey(value||"unavailable");
    const cls=["official","submitted","governed","source","source_current","calculated"].includes(value)?"ready":["provisional","partial","conflicted","stale","candidate"].includes(value)?"partial":"blocked";
    return '<span class="badge '+cls+'">'+escapeHtml(prefix+" · "+label)+'</span>';
  };
  return badge("State",state)+badge("Authority",authority);
}
function renderManagementMetricGrid(metrics){
  if(!Array.isArray(metrics)||!metrics.length)return'<div class="empty">No management figures are available yet.</div>';
  const cards=metrics.map(m=>{const display=managementMetricDisplay(m);return '<article class="management-metric-card '+escapeHtml(m.health||"unavailable")+'" title="'+escapeHtml(m.basis||"")+'">'+
      '<div class="management-metric-head"><span>'+escapeHtml(m.key==='independent-forecast-finish'&&['provisional','scenario'].includes(m.authority)?'Programme calendar recalculation':m.label)+'</span>'+((m.health==="unavailable"&&display.kind!=="missing")?"":managementHealthBadge(m.health))+'</div>'+
      '<div class="management-metric-value '+escapeHtml(display.kind)+'">'+escapeHtml(display.text)+'</div>'+
      '<div class="management-metric-badges">'+managementMetricBadges(m)+'</div>'+
      (m.key==='near-critical'?'<p class="management-metric-note">'+escapeHtml(m.consequence||m.basis||'')+'</p>':'')+'</article>';}).join("");
  const detailRows=metrics.filter(m=>m.basis||m.consequence||m.action||m.owningModule).map(m=>'<tr><td><b>'+escapeHtml(m.label)+'</b></td><td>'+escapeHtml(m.basis||'Not established')+'</td><td>'+escapeHtml(m.consequence||'—')+'</td><td>'+escapeHtml(m.action||'—')+'</td><td>'+managementModuleLink(m.owningModule,'Open')+'</td></tr>').join("");
  return '<div class="management-metric-grid">'+cards+'</div>'+(detailRows?'<details class="metric-interpretation"><summary>Figure definitions and supporting analysis</summary><div class="table-wrap"><table><thead><tr><th>Figure</th><th>Basis</th><th>Consequence</th><th>Action</th><th>Detail</th></tr></thead><tbody>'+detailRows+'</tbody></table></div></details>':'');
}
function commercialFindingText(metric){
  if(metric==null)return"Unresolved: amount not established";
  if(typeof metric!=="object")return typeof metric==="number"?fmtExecutive(metric):fmt(metric);
  if(metric.value===null||metric.value===undefined)return"Unresolved: "+(metric.reason||(metric.state==='conflicted'?'records disagree':'amount not established in the supplied records'));
  return fmtExecutive(metric.value)+((metric.diagnostics||[]).includes('EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS')?' · '+commercialSourceState(metric):metric.state&&metric.state!=="established"?" · "+humanizeKey(metric.state):"");
}
function commercialFindingTitle(metric){
  if(!metric||typeof metric!=="object")return"";
  return "State: "+commercialSourceState(metric)+(metric.diagnostics?.length?" · "+metric.diagnostics.join(" · "):"");
}
function renderManagementCommercial(rows){
  if(!Array.isArray(rows)||!rows.length)return '<div class="empty">No confirmed commercial currency position is established.</div>';
  const fields=[
    ['pendingVariationAmount','Pending variations'],['approvedVariationAmount','Approved variations'],['certifiedUnpaidAmount','Certified unpaid'],
    ['retentionDeductedAmount','Retention deducted through DD'],['retentionHeldAmount','Held balance'],['activeBondAmount','Active bonds'],
    ['claimClaimedAmount','Claimed'],['claimAssessedAmount','Assessed'],['ldScenarioAmount','LD scenario']
  ];
  const established=(m)=>m!==null&&m!==undefined&&(typeof m!=='object'||(m.value!==null&&m.value!==undefined));
  const visible=fields.filter(([key])=>rows.some(r=>established(r[key])));
  const missing=rows.flatMap(r=>fields.filter(([key])=>!established(r[key])).map(([key,label])=>({currency:r.currency,label,detail:commercialFindingText(r[key])})));
  if(!visible.length)return '<div class="notice info">No commercial amount is established from the supplied records.</div>'+(missing.length?'<details><summary>'+fmt(missing.length)+' commercial measures need more information</summary><ul>'+missing.map(x=>'<li>'+escapeHtml(x.currency+' · '+x.label+': '+x.detail)+'</li>').join('')+'</ul></details>':'');
  const head=visible.map(([,label])=>'<th>'+escapeHtml(label)+'</th>').join('');
  const body=rows.map(r=>'<tr><td><b>'+escapeHtml(r.currency)+'</b></td>'+visible.map(([key])=>'<td title="'+escapeHtml(commercialFindingTitle(r[key]))+'">'+(established(r[key])?escapeHtml(commercialFindingText(r[key])):'—')+'</td>').join('')+'</tr>').join('');
  return '<div class="table-wrap"><table><thead><tr><th>Currency</th>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>'+(missing.length?'<details><summary>'+fmt(missing.length)+' additional commercial measures need more information</summary><ul>'+missing.map(x=>'<li>'+escapeHtml(x.currency+' · '+x.label+': '+x.detail)+'</li>').join('')+'</ul></details>':'');
}
function renderManagementAlerts(alerts){
  if(!Array.isArray(alerts)||!alerts.length)return '<div class="notice info">No current management alert is generated from the confirmed project position.</div>';
  return '<div class="management-alert-list">'+alerts.map(a=>'<article class="management-alert '+escapeHtml(a.severity)+'"><div class="management-alert-head"><b>'+escapeHtml(a.title)+'</b><span>'+escapeHtml(a.severity)+'</span></div><p>'+escapeHtml(a.consequence)+'</p><div class="management-alert-action"><strong>Required action</strong><span>'+escapeHtml(a.action)+'</span></div><div>'+managementModuleLink(a.owningModule,"Review action")+'</div></article>').join("")+'</div>';
}
function renderManagementEvidenceGaps(gaps){
  if(!Array.isArray(gaps)||!gaps.length)return '<div class="notice info">No evidence gap is identified by the current management projection.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Evidence domain</th><th>State</th><th>Required correction</th><th>Owning source</th></tr></thead><tbody>'+gaps.map(g=>'<tr><td><b>'+escapeHtml(g.label)+'</b></td><td>'+managementAuthorityBadge(g.state)+'</td><td>'+escapeHtml(g.action)+'</td><td>'+managementModuleLink(g.owningModule,"Open")+'</td></tr>').join("")+'</tbody></table></div>';
}
function renderManagementConsistency(c){
  if(!c)return '<div class="notice warn">Cross-module consistency has not been checked.</div>';
  return '<div class="notice '+(c.state==="pass"?"info":"warn")+'"><b>Cross-module consistency: '+escapeHtml(humanizeKey(c.state))+'</b><p>'+escapeHtml(c.scope||"")+'</p><span>'+escapeHtml(c.checkCount||0)+' checks'+(c.failedCheckIds?.length?' · Review: '+escapeHtml(c.failedCheckIds.length+" failed checks; open Information & Actions for details"):"")+'</span></div>';
}
function renderManagementVariationReconciliation(rows){
  if(!rows.length)return "";
  return '<div class="notice info"><b>Reported variations versus dated approvals</b><p>Compare the reported total with approvals dated by the reporting date. Later approvals are listed separately; confirm the difference before using the total as approved value.</p></div><div class="table-wrap"><table><thead><tr><th>Currency / tax basis</th><th>Reported total / status</th><th>Dated approvals through DD</th><th>Current / future / undated records</th><th>Reconciliation</th><th>Review</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+escapeHtml(r.currency+' / '+r.taxBasis)+'</td><td>'+escapeHtml(fmtExecutive(r.sourceAggregate)+' · '+humanizeKey(r.sourceState))+'</td><td>'+escapeHtml(fmtExecutive(r.datedApprovedAmount))+'</td><td>'+escapeHtml(r.datedApprovedCount+' / '+r.futureCount+' / '+r.undatedCount)+'</td><td>'+escapeHtml(humanizeKey(r.state))+'</td><td>'+managementModuleLink("variations-change","Open dated ledger")+'</td></tr>').join("")+'</tbody></table></div>';
}
function renderOperationalReporting(report){
  if(!report)return "";
  const groups=[["NCR",report.quality],["RFI",report.rfi],["Risk",report.risk]];
  const rows=groups.map(([name,g])=>'<tr><td>'+escapeHtml(name)+'</td><td>'+escapeHtml(fmt(g.sourceRecordCount))+'</td><td>'+escapeHtml(fmt(g.currentRecordCount))+'</td><td>'+escapeHtml(fmt(g.futureRecordCount))+'</td><td>'+escapeHtml(fmt(g.undatedRecordCount))+'</td><td>'+escapeHtml(fmt(g.unknownStatusCount))+'</td><td>'+escapeHtml(humanizeKey(g.state))+'</td></tr>').join("");
  const risks=report.risk.sourceRows||[];const riskStates={};risks.forEach(r=>{const key=r.sourceStatus||r.status||"Unknown";riskStates[key]=(riskStates[key]||0)+1});
  return '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Operational register date coverage</h4><p>Raised dates and closure/response dates reconstruct the position at '+escapeHtml(planningShortDate(report.dataDateIso))+'. Later closures cannot close earlier records.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Major / critical NCRs open at DD",report.counts.openCriticalMajorNcrCount??(report.knownCounts?.openCriticalMajorNcrCount!==undefined?fmt(report.knownCounts.openCriticalMajorNcrCount)+" confirmed":"Unresolved"),report.counts.openCriticalMajorNcrCount===null?fmt(report.knownCounts?.uncertainCriticalMajorNcrCount??0)+" current records uncertain; full count not confirmed":"dated NCR lifecycle"],
    ["RFIs open at DD",report.counts.openRfiCount??"Unresolved","dated RFI lifecycle"],
    ["RFIs overdue at DD",report.counts.overdueRfiCount??"Unresolved","open with due date before DD"],
    ["Risks open at DD",report.counts.openRiskCount??"Unresolved","dated risk lifecycle or status snapshot"]
  ])+'<div class="table-wrap"><table><thead><tr><th>Register</th><th>Programme records</th><th>Known by DD</th><th>Future</th><th>Date missing</th><th>Status unresolved at DD</th><th>Evidence state</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(report.risk.undatedRecordCount?'<p>Undated risk snapshot, excluded from current totals: '+escapeHtml(Object.entries(riskStates).map(([key,n])=>key+' '+fmt(n)).join(' · '))+'. A due date does not establish when a risk was raised or its historical status.</p>':'')+'</div></section>';
}

function pmcDefined(value){return value!==null&&value!==undefined&&!(typeof value==="number"&&!Number.isFinite(value));}
function pmcFirst(){for(const value of arguments)if(pmcDefined(value))return value;return null;}
function pmcMetric(data,key){return (data?.metrics||[]).find(metric=>metric.key===key)||null;}
function pmcSource(data,domain){return data?.visualControl?.sourceInventory?.domains?.find(row=>row.domain===domain)||null;}
function pmcMoney(value,currency){return pmcDefined(value)?fmtExecutive(value)+(currency?" "+currency:""):"Unresolved";}
function pmcDays(value){if(!pmcDefined(value))return"Unresolved";const n=Number(value);return Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:0})+" days "+(n>0?"behind":n<0?"ahead":"on");}
function pmcCard({title,value,state="Unresolved",tone="unresolved",sub="",meta=[],module}){
 const rows=meta.filter(row=>pmcDefined(row?.[1])&&String(row[1]).length).map(row=>'<span><em>'+escapeHtml(row[0])+'</em><b>'+escapeHtml(row[1])+'</b></span>').join("");
 return '<article class="pmc-domain-card '+escapeHtml(tone)+'"><div class="pmc-domain-head"><b>'+escapeHtml(title)+'</b><span class="pmc-domain-state">'+escapeHtml(state)+'</span></div><div class="pmc-domain-value">'+escapeHtml(value)+'</div><div class="pmc-domain-sub">'+escapeHtml(sub)+'</div>'+(rows?'<div class="pmc-domain-meta">'+rows+'</div>':'')+(module?managementModuleLink(module,"Open control"):"")+'</article>';
}
function pmcSourceValue(source){
 if(!source)return null;
 if(pmcDefined(source.readableRowCount))return source.readableRowCount+" source rows";
 if(source.documentCount)return source.documentCount+" source document"+(source.documentCount===1?"":"s");
 return null;
}
function renderPmcControlRoom(data){
 const vc=data.visualControl||{},ops=data.operationalReporting||{},metrics=data.metrics||[];
 const contract=pmcMetric(data,"contract-finish"),submitted=pmcMetric(data,"submitted-programme-finish"),independent=pmcMetric(data,"independent-forecast-finish");
 const submittedVar=pmcMetric(data,"submitted-vs-contract")?.value,independentVar=pmcMetric(data,"independent-vs-contract")?.value,progressGap=pmcMetric(data,"progress-position")?.value;
 const scheduleTone=pmcDefined(submittedVar)?Number(submittedVar)>0?"danger":"good":submitted?.value?"source":"unresolved";
 const scheduleValue=pmcDefined(submittedVar)?pmcDays(submittedVar):submitted?.value?planningShortDate(submitted.value):"Unresolved";
 const progress=vc.progress||{},scope=progress.scopeComparison||{},progressTone=pmcDefined(progressGap)?Number(progressGap)<0?"warning":"good":progress.progressBases?"source":"unresolved";
 const progressValue=pmcDefined(progressGap)?(Math.abs(Number(progressGap)).toFixed(2)+" pp "+(Number(progressGap)<0?"behind":Number(progressGap)>0?"ahead":"level")):
   pmcDefined(scope.snapshotPercent)?fmt(scope.snapshotPercent)+"% schedule snapshot":"Unresolved";
 const cost=(vc.commercial?.cost||[])[0]||null,commercial=(vc.commercial?.positions||[]).find(row=>!cost||row.currency===cost.currency)||(vc.commercial?.positions||[])[0]||null;
 const currency=cost?.currency||commercial?.currency||"";
 const vac=cost?.calculatedVac,cpi=cost?.cpi,bestEac=cost?.bestEac,currentContract=commercial?.currentContractValue?.value,originalContract=commercial?.originalContractValue?.value;
 const costTone=pmcDefined(vac)&&Number(vac)<0?"danger":pmcDefined(cpi)&&Number(cpi)<1?"warning":pmcDefined(bestEac)||pmcDefined(currentContract)||pmcDefined(originalContract)?"source":"unresolved";
 const costValue=pmcDefined(vac)&&Number(vac)<0?pmcMoney(Math.abs(Number(vac)),currency)+" forecast overrun":
   pmcDefined(currentContract)?pmcMoney(currentContract,currency)+" current contract":
   pmcDefined(originalContract)?pmcMoney(originalContract,currency)+" source contract":"Unresolved";
 const vr=(data.variationReconciliation||[])[0]||null;
 const changeGap=pmcDefined(vr?.sourceAggregate)&&pmcDefined(vr?.datedApprovedAmount)?Number(vr.sourceAggregate)-Number(vr.datedApprovedAmount):null;
 const changeTone=vr?.state==="conflicted"||pmcDefined(changeGap)&&Math.abs(changeGap)>.01?"danger":pmcDefined(vr?.datedApprovedAmount)||pmcDefined(vr?.sourceAggregate)?"source":"unresolved";
 const changeValue=pmcDefined(changeGap)&&Math.abs(changeGap)>.01?pmcMoney(Math.abs(changeGap),vr?.currency)+" to reconcile":
   pmcDefined(vr?.datedApprovedAmount)?pmcMoney(vr.datedApprovedAmount,vr?.currency)+" dated approvals":
   pmcDefined(vr?.sourceAggregate)?pmcMoney(vr.sourceAggregate,vr?.currency)+" source reported":"Unresolved";
 const delivery=data.delivery||{},procSource=delivery.sourceAvailability?.procurement||pmcSource(data,"procurement");
 const sourceLongLead=procSource?.signals?.longLeadMarkedCount;
 const boqLongLead=vc.boqScope?.boqCandidateLongLeadCount;
 const scheduleLongLead=vc.boqScope?.scheduleCandidateLongLeadCount;
 const governedLongLead=delivery.candidateLongLeadCount;
 const longLead=[sourceLongLead,boqLongLead,scheduleLongLead,governedLongLead].find(value=>pmcDefined(value)&&Number(value)>0)??null;
 const packagePopulationEstablished=delivery.packagePopulationState==="established";
 const packageEvidence=[delivery.knownPackageRecordCount,delivery.candidatePackageCount,vc.boqScope?.candidatePackageCount,procSource?.readableRowCount].find(value=>pmcDefined(value)&&Number(value)>0);
 const packageAvailable=pmcDefined(packageEvidence)?packageEvidence:(packagePopulationEstablished?delivery.confirmedPackageCount:null);
 const procurementEvidence=pmcDefined(longLead)||pmcDefined(packageEvidence)||Boolean(procSource?.documentCount);
 const procurementTone=pmcDefined(delivery.latePackageKnownCount)&&Number(delivery.latePackageKnownCount)>0?"danger":packagePopulationEstablished?"good":procurementEvidence?"source":"unresolved";
 const longLeadLabel=pmcDefined(sourceLongLead)&&Number(sourceLongLead)>0?" source-marked long-lead items":pmcDefined(boqLongLead)&&Number(boqLongLead)>0?" BOQ-screened long-lead candidates":pmcDefined(scheduleLongLead)&&Number(scheduleLongLead)>0?" schedule/WBS long-lead candidates":" long-lead candidates";
 const procurementValue=pmcDefined(delivery.latePackageKnownCount)&&Number(delivery.latePackageKnownCount)>0?fmt(delivery.latePackageKnownCount)+" known late packages":pmcDefined(longLead)&&Number(longLead)>0?fmt(longLead)+longLeadLabel:pmcDefined(packageEvidence)?fmt(packageEvidence)+" procurement source / scope items":packagePopulationEstablished&&pmcDefined(delivery.confirmedPackageCount)?fmt(delivery.confirmedPackageCount)+" confirmed packages":"Not established";
 const designSource=delivery.sourceAvailability?.design||pmcSource(data,"design"),submittalSource=delivery.sourceAvailability?.submittal||pmcSource(data,"submittal");
 const overdueRfi=ops.counts?.overdueRfiCount,openRfi=ops.counts?.openRfiCount;
 const designTone=pmcDefined(overdueRfi)&&Number(overdueRfi)>0?"danger":pmcDefined(openRfi)?"warning":designSource?.documentCount||submittalSource?.documentCount?"source":"unresolved";
 const designValue=pmcDefined(overdueRfi)&&Number(overdueRfi)>0?fmt(overdueRfi)+" overdue RFIs":pmcDefined(openRfi)?fmt(openRfi)+" open RFIs":pmcSourceValue(designSource)||pmcSourceValue(submittalSource)||"Unresolved";
 const qualitySource=delivery.sourceAvailability?.quality||pmcSource(data,"quality"),hseSource=delivery.sourceAvailability?.hse||pmcSource(data,"hse");
 const criticalNcr=ops.counts?.openCriticalMajorNcrCount,hse= data.sourceInterpretation?.hse?.metrics||{};
 const qualityTone=pmcDefined(criticalNcr)&&Number(criticalNcr)>0?"danger":pmcDefined(hse.lostTimeInjuries)&&Number(hse.lostTimeInjuries)>0?"danger":qualitySource?.documentCount||hseSource?.documentCount?"source":"unresolved";
 const qualityValue=pmcDefined(criticalNcr)?fmt(criticalNcr)+" major / critical NCR":pmcDefined(hse.lostTimeInjuries)?fmt(hse.lostTimeInjuries)+" reported LTI":pmcSourceValue(qualitySource)||pmcSourceValue(hseSource)||"Unresolved";
 const claims=vc.claims||{},claimsSource=pmcSource(data,"claims");
 const currentClaims=claims.currentClaimCount,sourceClaims=claims.sourceClaimCount,currentEvents=claims.currentEventCount,sourceEvents=claims.sourceEventCount;
 const claimsQuarantined=claims.integrityState==="quarantined";
 const retainedClaimRows=pmcFirst(claims.quarantinedClaimCount,sourceClaims,claims.sourceEvidenceRowCount,claimsSource?.readableRowCount);
 const claimsTone=claimsQuarantined?"warning":
   pmcDefined(claims.incompleteChainCount)&&Number(claims.incompleteChainCount)>0?"warning":
   pmcDefined(currentClaims)||pmcDefined(sourceClaims)||pmcDefined(currentEvents)||pmcDefined(sourceEvents)||claimsSource?.documentCount?"source":"unresolved";
 const claimsValue=pmcDefined(claims.officialApprovedEotDays)?fmt(claims.officialApprovedEotDays)+" d approved EOT":
   claimsQuarantined&&pmcDefined(retainedClaimRows)?fmt(retainedClaimRows)+" source claim rows retained":
   pmcDefined(currentClaims)&&Number(currentClaims)>0?fmt(currentClaims)+" current claims":
   pmcDefined(currentClaims)&&Number(currentClaims)===0&&pmcDefined(sourceClaims)&&Number(sourceClaims)>0?fmt(sourceClaims)+" source claims · 0 current by DD":
   pmcDefined(sourceClaims)&&Number(sourceClaims)>0?fmt(sourceClaims)+" source claims available":
   pmcDefined(currentEvents)&&Number(currentEvents)>0?fmt(currentEvents)+" current delay events":
   pmcDefined(currentEvents)&&Number(currentEvents)===0&&pmcDefined(sourceEvents)&&Number(sourceEvents)>0?fmt(sourceEvents)+" source delay events · 0 current by DD":
   pmcDefined(sourceEvents)&&Number(sourceEvents)>0?fmt(sourceEvents)+" source delay events available":
   pmcSourceValue(claimsSource)||"Unresolved";
 const claimsState=claimsQuarantined?"Source evidence under review":claimsTone==="warning"?"Chain incomplete":"Available evidence";
 const claimsSub=claimsQuarantined
   ?"Source population is retained for audit but quarantined from management truth. Governed claims and delay events remain not established."
   :"Claim, event, notice, time-impact and determination authorities remain separate.";
 const claimsMeta=claimsQuarantined?[
   ["Source claim rows retained",retainedClaimRows],
   ["Current governed claims","Not established"],
   ["Current governed delay events","Not established"],
   ["Source population","Quarantined from management truth"],
   ["Supporting documents",pmcFirst(claims.sourceDocumentCount,claimsSource?.documentCount)]
 ]:[
   ["Current events",currentEvents],
   ["Canonical source events",pmcDefined(sourceEvents)&&Number(sourceEvents)>0?sourceEvents:claimsSource?.documentCount?"Not established":sourceEvents],
   ["Current claims",currentClaims],
   ["Canonical source claims",pmcDefined(sourceClaims)&&Number(sourceClaims)>0?sourceClaims:claimsSource?.documentCount?"Not established":sourceClaims],
   ["Source evidence",pmcSourceValue(claimsSource)],
   ["Timely notices",claims.timelyNoticeCount],["Late notices",claims.lateNoticeCount],
   ["Time-impact candidate",pmcDefined(claims.analyticalTimeImpactCandidateDays)?fmt(claims.analyticalTimeImpactCandidateDays)+" d":null]
 ];
 const riskSource=delivery.sourceAvailability?.risk||pmcSource(data,"risk"),openRisk=ops.counts?.openRiskCount;
 const riskTone=pmcDefined(openRisk)?"warning":riskSource?.documentCount?"source":"unresolved";
 const riskValue=pmcDefined(openRisk)?fmt(openRisk)+" open risks":pmcSourceValue(riskSource)||"Unresolved";
 const dashboardPriority={
   time:scheduleTone==="danger"?0:(pmcDefined(submittedVar)||submitted?.value||contract?.value?2:4),
   progress:progressTone==="warning"?0:(pmcDefined(progressGap)?2:progress.progressBases?3:4),
   cost:costTone==="danger"||costTone==="warning"?0:(pmcDefined(bestEac)||pmcDefined(currentContract)||pmcDefined(originalContract)?2:4),
   change:changeTone==="danger"?0:(pmcDefined(vr?.datedApprovedAmount)||pmcDefined(vr?.sourceAggregate)?2:4),
   procurement:pmcDefined(delivery.latePackageKnownCount)&&Number(delivery.latePackageKnownCount)>0?0:
     pmcDefined(longLead)&&Number(longLead)>0?1:packagePopulationEstablished?2:procurementEvidence?3:4,
   design:pmcDefined(overdueRfi)&&Number(overdueRfi)>0?0:pmcDefined(openRfi)&&Number(openRfi)>0?1:
     pmcDefined(openRfi)?2:(designSource?.documentCount||submittalSource?.documentCount?3:4),
   quality:(pmcDefined(criticalNcr)&&Number(criticalNcr)>0)||(pmcDefined(hse.lostTimeInjuries)&&Number(hse.lostTimeInjuries)>0)?0:
     pmcDefined(criticalNcr)||pmcDefined(hse.lostTimeInjuries)?2:(qualitySource?.documentCount||hseSource?.documentCount?3:4),
   claims:claimsQuarantined||(pmcDefined(claims.incompleteChainCount)&&Number(claims.incompleteChainCount)>0)?1:
     (pmcDefined(currentClaims)&&Number(currentClaims)>0)||(pmcDefined(currentEvents)&&Number(currentEvents)>0)?1:
     pmcDefined(claims.officialApprovedEotDays)?2:
     pmcDefined(sourceClaims)||pmcDefined(sourceEvents)||claimsSource?.documentCount?3:4,
   risk:pmcDefined(openRisk)&&Number(openRisk)>0?1:pmcDefined(openRisk)?2:riskSource?.documentCount?3:4
 };
 const cards=[
  {domain:"time",priority:dashboardPriority.time,tone:scheduleTone,html:pmcCard({title:"Time",value:scheduleValue,state:scheduleTone==="danger"?"Behind contract":scheduleTone==="good"?"On / ahead":scheduleTone==="unresolved"?"Information gap":"Available position",tone:scheduleTone,sub:"Contract, submitted and programme recalculation positions remain separate.",meta:[["Contract",contract?.value?planningShortDate(contract.value):null],["Submitted",submitted?.value?planningShortDate(submitted.value):null],["Programme recalculation",independent?.value?planningShortDate(independent.value):null],["Recalculation vs contract",pmcDefined(independentVar)?pmcDays(independentVar):null]],module:"independent-forecast"})},
  {domain:"progress",priority:dashboardPriority.progress,tone:progressTone,html:pmcCard({title:"Progress",value:progressValue,state:progressTone==="warning"?"Behind":progressTone==="unresolved"?"Information gap":"Available position",tone:progressTone,sub:"Same-scope progress first; separate progress authorities remain visible.",meta:[["Baseline",pmcDefined(scope.baselinePlannedPercent)?fmt(scope.baselinePlannedPercent)+"%":null],["Schedule snapshot",pmcDefined(scope.snapshotPercent)?fmt(scope.snapshotPercent)+"%":null],["EVM SPI",pmcMetric(data,"schedule-spi")?.value]],module:"progress-report"})},
  {domain:"cost",priority:dashboardPriority.cost,tone:costTone,html:pmcCard({title:"Cost",value:costValue,state:costTone==="danger"?"Adverse forecast":costTone==="warning"?"Efficiency pressure":costTone==="unresolved"?"Information gap":"Available position",tone:costTone,sub:"No cross-currency aggregation; source forecast stays separate from CMeng scenarios.",meta:[["BAC",pmcDefined(cost?.bac)?pmcMoney(cost.bac,currency):null],["EAC",pmcDefined(bestEac)?pmcMoney(bestEac,currency):null],["CPI",cost?.cpi],["SPI",cost?.spi]],module:"cost-forecast"})},
  {domain:"change",priority:dashboardPriority.change,tone:changeTone,html:pmcCard({title:"Change / VO",value:changeValue,state:changeTone==="danger"?"Records disagree":changeTone==="unresolved"?"Information gap":"Available position",tone:changeTone,sub:"Reported variation totals and dated approvals stay separate.",meta:[["Reported",pmcDefined(vr?.sourceAggregate)?pmcMoney(vr.sourceAggregate,vr.currency):null],["Approved by DD",pmcDefined(vr?.datedApprovedAmount)?pmcMoney(vr.datedApprovedAmount,vr.currency):null],["Future approvals",vr?.futureCount]],module:"variations-change"})},
  {domain:"procurement",priority:dashboardPriority.procurement,tone:procurementTone,html:pmcCard({title:"Procurement / Long Lead",value:procurementValue,state:procurementTone==="danger"?"Delivery threat":procurementTone==="unresolved"?"Information gap":"Best available scope",tone:procurementTone,sub:"Confirmed lifecycle position when available; otherwise source, BOQ or schedule/WBS candidates are shown without inventing procurement status or lateness.",meta:[["Confirmed packages",packagePopulationEstablished?delivery.confirmedPackageCount:null],["Source-marked long lead",sourceLongLead],["BOQ-screened long lead",boqLongLead],["Schedule / WBS long lead",scheduleLongLead],["Source rows",procSource?.readableRowCount],["Known late",delivery.latePackageKnownCount]],module:"long-lead"})},
  {domain:"design",priority:dashboardPriority.design,tone:designTone,html:pmcCard({title:"Design / RFI",value:designValue,state:designTone==="danger"?"Overdue design response":designTone==="unresolved"?"Information gap":"Available evidence",tone:designTone,sub:"Dated RFI position when governed; design/submittal source evidence remains visible underneath.",meta:[["Open RFIs",openRfi],["Overdue RFIs",overdueRfi],["Design rows",designSource?.readableRowCount],["Submittal rows",submittalSource?.readableRowCount]],module:"delivery-design"})},
  {domain:"quality",priority:dashboardPriority.quality,tone:qualityTone,html:pmcCard({title:"Quality / HSE",value:qualityValue,state:qualityTone==="danger"?"Intervention required":qualityTone==="unresolved"?"Information gap":"Available evidence",tone:qualityTone,sub:"Quality and safety are not reduced to a composite score.",meta:[["Major / critical NCR",criticalNcr],["LTIFR",hse.ltifr],["TRIR",hse.trir],["Exposure hours",hse.exposureHours]],module:"delivery-quality"})},
  {domain:"claims",priority:dashboardPriority.claims,tone:claimsTone,html:pmcCard({title:"Claims / EOT",value:claimsValue,state:claimsTone==="unresolved"?"Information gap":claimsState,tone:claimsTone,sub:claimsSub,meta:claimsMeta,module:"eot-assessment"})},
  {domain:"risk",priority:dashboardPriority.risk,tone:riskTone,html:pmcCard({title:"Risk",value:riskValue,state:riskTone==="warning"?"Open risk position":riskTone==="unresolved"?"Information gap":"Source available",tone:riskTone,sub:"Confirmed ratings only; source registers remain visible even when scoring/date completeness is unresolved.",meta:[["Source rows",riskSource?.readableRowCount],["Documents",riskSource?.documentCount]],module:"risk-register"})}
 ];
 const rank={danger:0,warning:1,good:2,source:3,unresolved:4};
 const availableCards=cards.filter(card=>card.priority<4).sort((a,b)=>a.priority-b.priority||(rank[a.tone]??3)-(rank[b.tone]??3)||a.domain.localeCompare(b.domain));
 const gapCards=cards.filter(card=>card.priority===4);
 const availableHtml=availableCards.length?'<div class="pmc-domain-grid">'+availableCards.map(card=>card.html).join("")+'</div>':'<div class="notice info">No management domain has an established or qualified position yet.</div>';
 const gapHtml=gapCards.length?'<details class="management-detail"><summary>Control gaps · '+gapCards.length+' domain'+(gapCards.length===1?"":"s")+'</summary><p>These gaps are shown after the useful Project position. They do not replace information that is already available from another source.</p><div class="pmc-domain-grid">'+gapCards.map(card=>card.html).join("")+'</div></details>':"";
 return '<section class="pmc-control-room"><div class="pmc-control-head"><div><h3>PMC Control Room</h3><p>Best available project position first. Established, source and qualified candidate evidence is shown before missing higher-authority conclusions.</p></div><span class="badge">Data Date '+escapeHtml(planningShortDate(data.reportingContract?.dataDateIso||overview?.latestDataDateIso))+'</span></div>'+availableHtml+gapHtml+'</section>';
}
function renderPmcControlCharts(data){
 const vc=data.visualControl||{},scheduleRows=[],submitted=pmcMetric(data,"submitted-vs-contract")?.value,independent=pmcMetric(data,"independent-vs-contract")?.value,diff=pmcMetric(data,"independent-vs-submitted")?.value;
 if(pmcDefined(submitted))scheduleRows.push({label:"Submitted vs contract",value:Number(submitted)});
 if(pmcDefined(independent))scheduleRows.push({label:"Independent vs contract",value:Number(independent)});
 if(pmcDefined(diff))scheduleRows.push({label:"Independent vs submitted",value:Number(diff)});
 const scope=vc.progress?.scopeComparison||{},progressRows=[
   {label:"Baseline plan",value:scope.baselinePlannedPercent,tone:"graphite"},
   {label:"Schedule snapshot",value:scope.snapshotPercent,tone:"accent"},
   {label:"Current plan",value:scope.currentPlanCurrentWeightsPercent,tone:"purple"}
 ].filter(row=>pmcDefined(row.value));
 const cost=(vc.commercial?.cost||[])[0],costRows=cost?[
   {label:"BAC",value:cost.bac,tone:"graphite"},{label:"PV",value:cost.pv,tone:"accent"},{label:"EV",value:cost.ev,tone:"success"},{label:"AC",value:cost.ac,tone:"danger"},{label:"EAC",value:cost.bestEac,tone:"warning"}
 ].filter(row=>pmcDefined(row.value)):[];
 const vr=(data.variationReconciliation||[])[0],changeRows=vr?[
   {label:"Reported variation total",value:vr.sourceAggregate,tone:"warning"},{label:"Dated approvals through DD",value:vr.datedApprovedAmount,tone:"accent"}
 ].filter(row=>pmcDefined(row.value)):[];
 const sourceRows=(vc.sourceInventory?.domains||[]).filter(row=>["procurement","design","submittal","quality","hse","claims"].includes(row.domain)&&pmcDefined(row.readableRowCount)).map(row=>({label:row.label,value:row.readableRowCount,tone:"accent"}));
 const claims=vc.claims||{},claimRows=claims.integrityState==="quarantined"?[
   {label:"Source claim rows retained",value:pmcFirst(claims.quarantinedClaimCount,claims.sourceClaimCount,claims.sourceEvidenceRowCount),tone:"accent"}
 ]:[
   {label:"Delay events",value:pmcFirst(claims.currentEventCount,claims.sourceEventCount),tone:"warning"},
   {label:"Claims",value:pmcFirst(claims.currentClaimCount,claims.sourceClaimCount),tone:"accent"},
   {label:"Timely notices",value:claims.timelyNoticeCount,tone:"success"},
   {label:"Late notices",value:claims.lateNoticeCount,tone:"danger"}
 ].filter(row=>pmcDefined(row.value));
 const panels=[];
 if(scheduleRows.length)panels.push(renderVisualPanel("Schedule exposure","Positive days are later than the stated comparison basis; date variance is not delay causation or EOT.",renderWaterfallChart(scheduleRows,"days")));
 if(progressRows.length)panels.push(renderVisualPanel("Progress position","Comparable source progress bases; missing physical/certified evidence is not invented.",renderVisualBars(progressRows,"%")));
 if(costRows.length)panels.push(renderVisualPanel((cost.currency||"")+" cost position","Source values and the best available EAC basis; CMeng scenarios remain labelled.",renderVisualBars(costRows,cost.currency||"")));
 if(changeRows.length)panels.push(renderVisualPanel("Variation reconciliation","Reported register total versus approvals dated through the Data Date.",renderVisualBars(changeRows,vr.currency||"")));
 if(sourceRows.length)panels.push(renderVisualPanel("Available execution evidence","Readable source rows currently available by domain. This is evidence volume, not a governed completion denominator.",renderVisualBars(sourceRows,"rows")));
 if(claimRows.length)panels.push(renderVisualPanel("Claims / notice position","Known source/current populations only.",renderVisualBars(claimRows,"records")));
 return panels.length?'<div class="pmc-chart-grid">'+panels.join("")+'</div>':"";
}
function renderPmcDriverBoards(data){
 const vc=data.visualControl||{},path=vc.schedule?.drivingActivities||[],priorityGroups=vc.schedule?.priorityGroups||[],wbs=vc.schedule?.delayedWbs||[],milestones=vc.milestones?.topRows||[],longLead=vc.boqScope?.topLongLead||[];
 const pathHtml=priorityGroups.length?'<div class="table-wrap"><table><thead><tr><th>Driver chain / WBS</th><th>Driving activities</th><th>Package candidates</th><th>Milestone consequence</th><th>Latest finish</th><th>Lowest float</th></tr></thead><tbody>'+priorityGroups.slice(0,12).map(group=>'<tr><td><b>'+escapeHtml(group.wbs||"Unclassified driving scope")+'</b></td><td>'+escapeHtml(fmt(group.activityCount))+'<br><span class="muted">'+escapeHtml((group.activityIds||[]).slice(0,8).join("; "))+((group.activityIds||[]).length>8?' · '+escapeHtml(fmt(group.activityIds.length-8))+' more':'')+'</span></td><td>'+escapeHtml((group.packageCandidates||[]).join("; ")||"No package candidate linked")+'</td><td>'+escapeHtml((group.milestoneIds||[]).join("; ")||group.consequence||"Milestone consequence not established")+'</td><td>'+escapeHtml(group.latestCurrentFinishIso?planningShortDate(group.latestCurrentFinishIso):"—")+'</td><td>'+escapeHtml(pmcDefined(group.lowestFloatHours)?fmt(group.lowestFloatHours)+" h":"—")+'</td></tr>').join("")+'</tbody></table></div>':
   path.length?'<div class="pmc-path-list">'+path.slice(0,10).map((row,index)=>'<div class="pmc-path-node"><i>'+(index+1)+'</i><div><b>'+escapeHtml(row.activityId+" · "+(row.name||""))+'</b><span>'+escapeHtml(row.wbs||"Driving network")+' · '+escapeHtml(planningShortDate(row.currentFinishIso))+'</span></div><strong>'+escapeHtml(pmcDefined(row.sourceFloatHours)?fmt(row.sourceFloatHours)+" h TF":"")+'</strong></div>').join("")+'</div>':'<div class="notice info">Independent driving network is not established. Source critical/float positions remain available in Programme Review.</div>';
 const wbsHtml=wbs.length?renderVisualBars(wbs.slice(0,8).map(row=>({label:row.label,value:row.count,tone:row.critical?"danger":"warning"})),"delayed activities"):'<div class="empty-visual">No WBS delay concentration is established from comparable current activity data.</div>';
 const milestoneHtml=milestones.length?'<div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Priority</th><th>Current</th><th>Vs baseline</th><th>Float</th></tr></thead><tbody>'+milestones.slice(0,8).map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br>'+escapeHtml(row.name||"")+'</td><td><span class="state-pill '+(row.priority==="critical"?"blocked":row.priority==="high"?"review":"ready")+'">'+escapeHtml(humanizeKey(row.priority))+'</span></td><td>'+escapeHtml(planningShortDate(row.currentDateIso))+'</td><td>'+escapeHtml(pmcDefined(row.varianceDays)?((row.varianceDays>0?"+":"")+fmt(row.varianceDays)+" d"):"Unresolved")+'</td><td>'+escapeHtml(pmcDefined(row.totalFloatHours)?fmt(row.totalFloatHours)+" h":"Unresolved")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty-visual">No open milestone priority population is established.</div>';
 const longLeadHtml=longLead.length?'<div class="table-wrap"><table><thead><tr><th>Scope / activity</th><th>System / discipline</th><th>Package / WBS</th><th>Priority</th><th>Available fact</th></tr></thead><tbody>'+longLead.slice(0,10).map(row=>'<tr><td><b>'+escapeHtml(row.itemNumber||row.itemId)+'</b><br>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(row.system||row.discipline||"Source scope")+'</td><td>'+escapeHtml(row.package||"Not grouped")+'</td><td><span class="state-pill '+(row.priority==="Critical"?"blocked":row.priority==="High"?"review":"not_applicable")+'">'+escapeHtml(row.priority||"Candidate")+'</span></td><td>'+escapeHtml(pmcDefined(row.amount)?pmcMoney(row.amount,row.currency):row.currentFinishIso?planningShortDate(row.currentFinishIso):"Source scope identified")+'</td></tr>').join("")+'</tbody></table><p class="muted">'+escapeHtml(vc.boqScope?.basis||"Best available long-lead scope; confirmed procurement lifecycle remains separate.")+'</p></div>':'<div class="empty-visual">No procurement, BOQ or schedule/WBS long-lead scope is identified.</div>';
 const change=vc.changes||{},changeHtml=planningKpis([
   ["Added activities",change.addedActivityCount,"latest comparison","accent"],["Removed",change.removedActivityCount,"latest comparison","neutral"],["Modified",change.modifiedActivityCount,"tracked fields","warning"],
   ["Logic links added",change.addedRelationshipCount,"relationships","accent"],["Logic links removed",change.removedRelationshipCount,"relationships","warning"],["Source target dates changed",change.sourceTargetDateChangeCount,"source fields","warning"]
 ]);
 return '<div class="pmc-chart-grid">'+
   managementPanel("Current driving priorities","Completion-driving activities are consolidated by driver/WBS group, package candidate and milestone consequence. Activity IDs remain visible underneath.",pathHtml)+
   managementPanel("Where delay is concentrated","Top WBS concentrations from the existing activity comparison.",wbsHtml)+
   managementPanel("Milestones requiring attention","Current milestone dates, baseline movement and float shown together.",milestoneHtml)+
   managementPanel("Long-lead scope to protect","Best available procurement, BOQ or schedule/WBS long-lead scope; confirmed procurement status remains separate.",longLeadHtml)+
   managementPanel("What changed in the programme","Latest revision change summary using the existing Programme Changes producer.",changeHtml)+
   '</div>';
}
function renderMcpGovernanceMatrix(data){
 const vc=data.visualControl||{},delivery=data.delivery||{},ops=data.operationalReporting||{},vr=(data.variationReconciliation||[])[0]||null;
 const src=domain=>vc.sourceInventory?.domains?.find(row=>row.domain===domain)||null;
 const rows=[];
 const add=(domain,signal,evidence,tone,module)=>rows.push({domain,signal,evidence,tone,module});
 const submitted=pmcMetric({metrics:data.programmePosition||[]},"submitted-vs-contract")?.value;
 add("Time",pmcDefined(submitted)?pmcDays(submitted):"Programme position available in specialist views",vc.schedule?.drivingActivityCount?vc.schedule.drivingActivityCount+" driving-network activities":"Source programme retained",pmcDefined(submitted)&&submitted>0?"danger":"source","independent-forecast");
 const gap=pmcMetric({metrics:data.programmePosition||[]},"progress-position")?.value;
 add("Progress",pmcDefined(gap)?Math.abs(gap).toFixed(2)+" pp "+(gap<0?"behind":gap>0?"ahead":"level"):"Progress bases retained",vc.progress?.scopeComparison?"Comparable activity basis available":"Scope comparison unresolved",pmcDefined(gap)&&gap<0?"warning":"source","progress-report");
 const cost=(vc.commercial?.cost||[])[0],commercial=(vc.commercial?.positions||[])[0];
 add("Cost",pmcDefined(cost?.calculatedVac)&&cost.calculatedVac<0?pmcMoney(Math.abs(cost.calculatedVac),cost.currency)+" forecast overrun":pmcDefined(commercial?.currentContractValue?.value)?pmcMoney(commercial.currentContractValue.value,commercial.currency)+" current contract":"Cost evidence available",pmcDefined(cost?.bac)?"EVM/cost position established":pmcSourceValue(src("cost"))||"Cost source incomplete",pmcDefined(cost?.calculatedVac)&&cost.calculatedVac<0?"danger":"source","cost-forecast");
 add("Change / VO",vr?.state==="conflicted"?"Reported total differs from dated approvals":pmcDefined(vr?.datedApprovedAmount)?pmcMoney(vr.datedApprovedAmount,vr.currency)+" approved by DD":"Variation evidence available",pmcSourceValue(src("variations"))||"Variation population unresolved",vr?.state==="conflicted"?"danger":"source","variations-change");
 add("Procurement",pmcDefined(delivery.latePackageKnownCount)&&delivery.latePackageKnownCount>0?delivery.latePackageKnownCount+" known late packages":pmcDefined(delivery.candidateLongLeadCount)?delivery.candidateLongLeadCount+" long-lead candidates":"Procurement evidence available",pmcSourceValue(delivery.sourceAvailability?.procurement||src("procurement"))||"Procurement population unresolved",pmcDefined(delivery.latePackageKnownCount)&&delivery.latePackageKnownCount>0?"danger":"source","long-lead");
 add("Design / RFI",pmcDefined(ops.counts?.overdueRfiCount)?ops.counts.overdueRfiCount+" overdue RFIs":"Design evidence available",pmcSourceValue(delivery.sourceAvailability?.design||src("design"))||pmcSourceValue(src("submittal"))||"Design population unresolved",pmcDefined(ops.counts?.overdueRfiCount)&&ops.counts.overdueRfiCount>0?"danger":"source","delivery-design");
 add("Quality / HSE",pmcDefined(ops.counts?.openCriticalMajorNcrCount)?ops.counts.openCriticalMajorNcrCount+" major / critical NCR":"Quality/HSE evidence available",pmcSourceValue(delivery.sourceAvailability?.quality||src("quality"))||pmcSourceValue(src("hse"))||"Quality population unresolved",pmcDefined(ops.counts?.openCriticalMajorNcrCount)&&ops.counts.openCriticalMajorNcrCount>0?"danger":"source","delivery-quality");
 const mcpClaims=vc.claims||{},mcpClaimsQuarantined=mcpClaims.integrityState==="quarantined";
 const mcpRetainedClaims=pmcFirst(mcpClaims.quarantinedClaimCount,mcpClaims.sourceClaimCount,mcpClaims.sourceEvidenceRowCount,src("claims")?.readableRowCount);
 add("Claims / EOT",
   pmcDefined(mcpClaims.officialApprovedEotDays)?mcpClaims.officialApprovedEotDays+" d approved EOT":
   mcpClaimsQuarantined&&pmcDefined(mcpRetainedClaims)?mcpRetainedClaims+" source claim rows retained":
   pmcDefined(mcpClaims.currentClaimCount)?mcpClaims.currentClaimCount+" current claims":"Claims evidence available",
   mcpClaimsQuarantined
     ?"Governed claims / delay events not established · source population quarantined for review"
     :pmcSourceValue(src("claims"))||"Claim chain completeness unresolved",
   mcpClaimsQuarantined||pmcDefined(mcpClaims.incompleteChainCount)&&mcpClaims.incompleteChainCount>0?"warning":"source",
   "eot-assessment");
 add("Risk",pmcDefined(ops.counts?.openRiskCount)?ops.counts.openRiskCount+" open risks":"Risk evidence available",pmcSourceValue(delivery.sourceAvailability?.risk||src("risk"))||"Rating/date completeness unresolved",pmcDefined(ops.counts?.openRiskCount)?"warning":"source","risk-register");
 return '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Control authority & evidence matrix</h4><p>Supporting governance view across scope, time, progress, cost, change, design, delivery, assurance and entitlement. It qualifies the integrated programme; it is not the Master Control Programme itself.</p></div></div><div class="planning-panel-body"><div class="table-wrap pmc-governance-table"><table><thead><tr><th>Control domain</th><th>Current signal</th><th>Evidence available</th><th>Control state</th><th>Drill-down</th></tr></thead><tbody>'+rows.map(row=>'<tr><td><b>'+escapeHtml(row.domain)+'</b></td><td>'+escapeHtml(row.signal)+'</td><td>'+escapeHtml(row.evidence)+'</td><td><span class="pmc-governance-state '+escapeHtml(row.tone)+'">'+escapeHtml(row.tone==="danger"?"Intervention":row.tone==="warning"?"Review":"Available")+'</span></td><td>'+managementModuleLink(row.module,"Open")+'</td></tr>').join("")+'</tbody></table></div></div></section>';
}
function commandActionItems(data){
 const canonical=Array.isArray(data.actions)?data.actions:[];
 if(canonical.length){
  const rank={critical:0,high:1,medium:2,low:3,information:4};
  return canonical.map(action=>({...action,module:action.owningModule??null}))
    .sort((a,b)=>(rank[a.severity]??2)-(rank[b.severity]??2)||(a.dueIso||"9999").localeCompare(b.dueIso||"9999"));
 }
 const rows=[];
 for(const action of data.accountability?.actions||[])rows.push({...action,module:"cross-domain-accountability"});
 for(const alert of data.alerts||[])rows.push({actionId:"alert:"+alert.alertId,issue:alert.title,consequence:alert.consequence,affectedScope:[],affectedMilestones:[],owner:null,organisation:null,requiredAction:alert.action,dueIso:null,escalation:null,severity:alert.severity==="critical"?"critical":alert.severity==="high"?"high":"medium",authority:"calculated",sourceRefs:[],module:alert.owningModule});
 for(const action of data.deliveryExceptions?.actions||[])rows.push({actionId:"delivery:"+String(action.recordId||action.type||rows.length),issue:action.action||"Delivery action required",consequence:action.overdueDays>0?"Required date is "+fmt(action.overdueDays)+" days overdue.":"Delivery control item requires review.",affectedScope:[action.recordId].filter(Boolean),affectedMilestones:[],owner:action.owner||null,organisation:null,requiredAction:action.action||"Review the delivery control item.",dueIso:action.dueIso||null,escalation:action.overdueDays>0?"Escalate overdue item.":null,severity:action.priority==="critical"?"critical":"high",authority:"source",sourceRefs:action.sourceRefs||[],module:"lookahead-schedule"});
 for(const decision of data.decisions||[])rows.push({actionId:"decision:"+decision.decisionId,issue:decision.description,consequence:"Management follow-up is required.",affectedScope:[],affectedMilestones:[],owner:decision.accountableOwner||null,organisation:decision.dependencyParty||null,requiredAction:decision.description,dueIso:decision.dueDate||null,escalation:null,severity:"medium",authority:"calculated",sourceRefs:[],module:null});
 const unique=new Map(),rank={critical:0,high:1,medium:2,low:3,information:4};
 for(const row of rows){
  const key=(String(row.issue||"")+"|"+String(row.requiredAction||"")+"|"+(row.affectedScope||[]).join("|")).toLowerCase().replace(/\s+/g," ").trim();
  if(!key||unique.has(key))continue;unique.set(key,row);
 }
 return [...unique.values()].sort((a,b)=>(rank[a.severity]??2)-(rank[b.severity]??2)||(a.dueIso||"9999").localeCompare(b.dueIso||"9999"));
}
function renderCommandAccountability(data){
 const actions=commandActionItems(data);
 if(!actions.length)return '<div class="notice info">No current accountable action population is established.</div>';
 const dd=String(data?.reportingContract?.dataDateIso||overview?.latestDataDateIso||'').slice(0,10);
 const groups=new Map();
 for(const action of actions){
  const recorded=action.owner||action.organisation||null;
  const key=recorded||'__UNASSIGNED__';
  const group=groups.get(key)||{party:recorded||'Unassigned',unassigned:!recorded,actions:0,overdue:0,material:0,milestones:new Set(),scopes:new Set(),nextDue:null,escalations:0};
  group.actions++;
  if(action.severity==='critical'||action.severity==='high')group.material++;
  for(const milestone of action.affectedMilestones||[])if(milestone)group.milestones.add(milestone);
  for(const scope of action.affectedScope||[])if(scope)group.scopes.add(scope);
  if(action.dueIso){
   const due=String(action.dueIso).slice(0,10);
   if(dd&&due<dd)group.overdue++;
   if(!group.nextDue||due<group.nextDue)group.nextDue=due;
  }
  if(action.escalation)group.escalations++;
  groups.set(key,group);
 }
 const rows=[...groups.values()].sort((a,b)=>(a.unassigned?0:1)-(b.unassigned?0:1)||b.overdue-a.overdue||b.material-a.material||b.actions-a.actions||a.party.localeCompare(b.party));
 return '<div class="table-wrap"><table><thead><tr><th>Owner / accountable party</th><th>Open actions</th><th>Overdue</th><th>High / critical</th><th>Threatened milestones</th><th>Affected scope</th><th>Next due</th><th>Escalations</th></tr></thead><tbody>'+rows.map(group=>'<tr><td><b>'+escapeHtml(group.party)+'</b>'+(group.unassigned?'<br><span class="state-pill review">Assignment required</span>':'')+'</td><td>'+escapeHtml(fmt(group.actions))+'</td><td>'+escapeHtml(fmt(group.overdue))+'</td><td>'+escapeHtml(fmt(group.material))+'</td><td>'+escapeHtml([...group.milestones].join('; ')||'Not linked')+'</td><td>'+escapeHtml([...group.scopes].slice(0,6).join('; ')||'Not classified')+'</td><td>'+escapeHtml(group.nextDue?planningShortDate(group.nextDue):'Not set')+'</td><td>'+escapeHtml(fmt(group.escalations))+'</td></tr>').join('')+'</tbody></table></div>';
}

function renderCommandActionTable(data){
 const actions=commandActionItems(data);
 if(!actions.length)return '<div class="notice info"><b>No current action is established from the available Project information.</b><p>Information gaps remain listed separately below.</p></div>';
 const rows=actions.slice(0,30).map(action=>'<tr><td><span class="state-pill '+(action.severity==="critical"?"blocked":action.severity==="high"?"review":"not_applicable")+'">'+escapeHtml(humanizeKey(action.severity))+'</span></td><td><b>'+escapeHtml(action.issue)+'</b></td><td>'+escapeHtml(action.consequence||"Consequence not yet established")+'</td><td>'+escapeHtml((action.affectedScope||[]).join("; ")||"Project / not classified")+'</td><td>'+escapeHtml(action.owner||action.organisation||"Not assigned")+'</td><td>'+escapeHtml(action.requiredAction||"Review required")+'</td><td>'+escapeHtml(action.dueIso?planningShortDate(action.dueIso):"Not set")+'</td><td>'+escapeHtml(action.escalation||"Not set")+'</td><td>'+managementModuleLink(action.module,"Open")+'</td></tr>').join("");
 return '<div class="table-wrap"><table><thead><tr><th>Priority</th><th>Issue</th><th>Consequence</th><th>Scope</th><th>Owner</th><th>Action</th><th>Due</th><th>Escalation</th><th>Control</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="muted">Showing '+fmt(Math.min(30,actions.length))+' of '+fmt(actions.length)+' distinct current actions. Missing owners, due dates and escalation are not invented.</p>';
}
function renderMcpProgrammeControl(data){
 const context=data.managementContext||{},stages=context.schedule?.programmeStages||[],vc=data.visualControl||{};
 const stageRows=stages.map(stage=>{
   const packages=(stage.wbsPaths||[]).slice(0,5).join("; ")+(stage.wbsPaths?.length>5?" · "+fmt(stage.wbsPaths.length-5)+" more":"");
   const milestones=(stage.controlMilestoneIds||[]).slice(0,6).join("; ")||"No control milestone identified in this stage";
   const dependencies=(stage.dependencyStages||[]).map(humanizeKey).join(" → ")||"No incoming cross-stage dependency identified";
   const float=pmcDefined(stage.lowestFloatHours)?fmt(stage.lowestFloatHours)+" h":"Not established";
   const blockers=stage.readinessBlockerCount>0
     ? fmt(stage.readinessBlockerCount)+" affected activities · "+(stage.readinessBlockerTypes||[]).map(humanizeKey).join(", ")
     : "No linked Look-Ahead blocker identified";
   const longLead=stage.longLeadExposure
     ?"Schedule candidates "+fmt(stage.longLeadExposure.scheduleCandidateCount)+" · BOQ candidates "+fmt(stage.longLeadExposure.boqCandidateCount)+" · procurement source rows "+(pmcDefined(stage.longLeadExposure.readableProcurementSourceRows)?fmt(stage.longLeadExposure.readableProcurementSourceRows):"Not established")
     :"";
   const owners=(stage.owners||[]).join("; ")||"Not recorded";
   const actions=(stage.actions||[]).slice(0,3).join("; ")||"No stage-specific action recorded";
   return '<tr><td><b>'+escapeHtml(stage.label)+'</b><br><span class="muted">'+escapeHtml(fmt(stage.openActivityCount))+' open / '+escapeHtml(fmt(stage.activityCount))+' activities</span></td>'+
     '<td>'+escapeHtml(packages||"Observed package/WBS not established")+'</td>'+
     '<td>'+escapeHtml(milestones)+'</td>'+
     '<td>'+escapeHtml(dependencies)+'</td>'+
     '<td>'+escapeHtml(stage.earliestCurrentStartIso?planningShortDate(stage.earliestCurrentStartIso):"—")+'</td>'+
     '<td>'+escapeHtml(stage.latestCurrentFinishIso?planningShortDate(stage.latestCurrentFinishIso):"—")+'</td>'+
     '<td>'+escapeHtml(stage.latestForecastFinishIso?planningShortDate(stage.latestForecastFinishIso):"Not established")+'</td>'+
     '<td>'+escapeHtml(float)+'<br><span class="muted">'+escapeHtml(fmt(stage.criticalOrNegativeFloatCount))+' critical / negative-float activities</span></td>'+
     '<td>'+escapeHtml(blockers)+(stage.readinessRequiredByIso?'<br><span class="muted">Required by '+escapeHtml(planningShortDate(stage.readinessRequiredByIso))+'</span>':'')+(longLead?'<br><span class="muted">'+escapeHtml(longLead)+'</span>':'')+'</td>'+
     '<td>'+escapeHtml(owners)+'</td>'+
     '<td>'+escapeHtml(actions)+'</td></tr>';
 }).join("");
 const stagesHtml=stageRows?'<div class="table-wrap"><table><thead><tr><th>Integrated stage</th><th>Work packages / WBS</th><th>Control milestones</th><th>Dependencies</th><th>Current start</th><th>Current finish</th><th>Forecast finish</th><th>Float</th><th>Readiness / long lead</th><th>Owner</th><th>Action</th></tr></thead><tbody>'+stageRows+'</tbody></table></div>':'<div class="notice info">A current programme is required to build the integrated design → procurement → construction → testing → handover sequence.</div>';
 const path=vc.schedule?.drivingActivities||[];
 const pathHtml=path.length?'<div class="table-wrap"><table><thead><tr><th>Driving activity</th><th>WBS</th><th>Current finish</th><th>Source float</th></tr></thead><tbody>'+path.slice(0,15).map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br>'+escapeHtml(row.name||"")+'</td><td>'+escapeHtml(row.wbs||"—")+'</td><td>'+escapeHtml(planningShortDate(row.currentFinishIso))+'</td><td>'+escapeHtml(pmcDefined(row.sourceFloatHours)?fmt(row.sourceFloatHours)+" h":"—")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="notice info">Independent completion-driving network is not established; source programme stages remain available above.</div>';
 const milestones=vc.milestones?.topRows||[];
 const milestoneHtml=milestones.length?'<div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Current</th><th>Vs baseline</th><th>Float</th><th>WBS</th></tr></thead><tbody>'+milestones.slice(0,12).map(row=>'<tr><td><b>'+escapeHtml(row.activityId)+'</b><br>'+escapeHtml(row.name||"")+'</td><td>'+escapeHtml(planningShortDate(row.currentDateIso))+'</td><td>'+escapeHtml(pmcDefined(row.varianceDays)?((row.varianceDays>0?"+":"")+fmt(row.varianceDays)+" d"):"—")+'</td><td>'+escapeHtml(pmcDefined(row.totalFloatHours)?fmt(row.totalFloatHours)+" h":"—")+'</td><td>'+escapeHtml(row.wbs||"—")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="notice info">No open priority milestone population is established.</div>';
 const longLead=vc.boqScope?.topLongLead||[],interfaces=(data.interfaces?.rows||[]).filter(row=>row.authority==="confirmed"&&row.state!=="closed");
 const dependencyRows=[...longLead.slice(0,10).map(row=>({type:"Long lead",reference:row.itemNumber||row.itemId,scope:row.package||row.description||"—",required:row.requiredOnSite||row.currentFinishIso||null,state:row.priority||"Candidate",action:"Confirm procurement lifecycle, need date and programme effect."})),...interfaces.slice(0,10).map(row=>({type:"Interface",reference:row.interfaceId,scope:row.package||row.linkedActivity||"—",required:row.requiredDate||null,state:row.state,action:row.escalation||"Resolve the interface before affected work proceeds."}))];
 const dependencyHtml=dependencyRows.length?'<div class="table-wrap"><table><thead><tr><th>Dependency</th><th>Reference</th><th>Package / activity</th><th>Required</th><th>State</th><th>Action</th></tr></thead><tbody>'+dependencyRows.map(row=>'<tr><td>'+escapeHtml(row.type)+'</td><td><b>'+escapeHtml(row.reference||"—")+'</b></td><td>'+escapeHtml(row.scope||"—")+'</td><td>'+escapeHtml(row.required?planningShortDate(row.required):"—")+'</td><td>'+escapeHtml(humanizeKey(row.state||"candidate"))+'</td><td>'+escapeHtml(row.action)+'</td></tr>').join("")+'</tbody></table></div>':'<div class="notice info">No long-lead or confirmed open interface dependency is identified from the available evidence.</div>';
 return managementPanel("Integrated programme control sequence","Observed current-programme structure across design, procurement, construction, testing/commissioning and handover. This is execution control; contractual work-package authority remains separately governed.",stagesHtml,true)+'<div class="management-two-column">'+managementPanel("Completion-driving chain","Current activities on the calculated completion-driving network.",pathHtml)+managementPanel("Milestones to protect","Priority current milestones and their movement/float.",milestoneHtml)+'</div>'+managementPanel("Long-lead & interface dependencies","Best available schedule/BOQ/procurement scope plus confirmed interfaces. Candidate scope never becomes confirmed procurement status automatically.",dependencyHtml);
}
function renderManagementControlVisual(key,data){
  if(key==="source-quality")return renderSourceQuality(data);
  if(key==="master-dashboard"){
    const r=data.readiness||{};
    const priorityKeys=['contract-finish','submitted-programme-finish','productivity-forecast-finish','critical-activities','progress-position','schedule-spi'];
    const priorityMetrics=priorityKeys.map(key=>(data.metrics||[]).find(m=>m.key===key)).filter(Boolean).map(m=>{
      const known=data.scheduleExceptions?.counts?.critical;
      return m.key==='critical-activities'&&m.value==null&&known?.knownCount!=null?{...m,value:known.knownCount+' known',state:'partial',authority:'source',basis:'Known critical activities from programme float. The full total is unconfirmed because '+known.unresolvedCount+' activities have no readable float.'}:m;
    });
    const mainMetrics=priorityMetrics.filter(m=>m.value!==null&&m.value!==undefined);
    const priorityGaps=priorityMetrics.filter(m=>m.value===null||m.value===undefined);
    const otherMetrics=(data.metrics||[]).filter(m=>!priorityKeys.includes(m.key)&&m.value!==null&&m.value!==undefined);
    const otherGaps=(data.metrics||[]).filter(m=>!priorityKeys.includes(m.key)&&(m.value===null||m.value===undefined));
    const readinessDonut=renderDonutChart([
      {label:"Fully defensible views",value:r.ready??0,tone:"success"},
      {label:"Views requiring review",value:r.partial??0,tone:"warning"},
      {label:"Blocked specialist views",value:r.blocked??0,tone:"danger"}
    ],"Control views");
    return '<div class="planning-view management-view master-dashboard-view">'+
      renderPmcControlRoom(data)+renderPmcControlCharts(data)+renderPmcDriverBoards(data)+
      (data.projectDiagnosis?renderProjectDashboardSummary(data.projectDiagnosis):renderCompletionPosition(data.completionPosition))+managementPanel("Executive Project Position","Established and qualified current programme/progress positions. Missing higher-authority measures are kept out of this primary block.",mainMetrics.length?renderManagementMetricGrid(mainMetrics):'<div class="notice info"><b>No additional executive metric is established from the current evidence.</b><p>The best available schedule and delivery positions remain visible above and below; missing higher-authority measures stay in Control Gaps.</p></div>',true)+renderDeliveryDashboard(data.delivery)+
      renderDashboardScheduleExceptions(data)+renderDashboardExceptions(data)+renderDashboardTrend(data)+renderDashboardDecisions(data)+
      managementPanel("Control Readiness","Calculation availability, evidence readiness and affected consistency checks are shown separately. A project-wide issue does not automatically make every specialist view defective.",readinessDonut+renderManagementConsistency(data.consistency))+
      managementPanel("Evidence Snapshot","Current evidence coverage. Missing or conflicted evidence remains explicit rather than being converted to zero.",planningKpis([
        ["Project documents",data.evidenceDocumentCount??0,"current evidence library"],
        ["Calculated specialist views",r.calculationAvailable??0,"a calculation is available"],
        ["Fully defensible views",r.ready??0,"calculation, evidence and affected consistency checks passed"],
        ["Review needed",r.partial??0,"usable positions with a stated evidence/review requirement","warning"],
        ["Blocked specialist views",r.blocked??0,"calculation unavailable","danger"],
        ["Evidence gaps",r.evidenceGapCount??0,"missing, partial, stale or conflicted evidence","warning"],
        ["Approvals outstanding",r.governanceGapCount??0,"reports and approval steps","warning"]
      ]))+
      experienceSourceContext(key,data)+
      (otherMetrics.length?experienceDisclosure("Additional available project measures",renderManagementMetricGrid(otherMetrics),fmt(otherMetrics.length)+" available measures"):"")+
      ((priorityGaps.length+otherGaps.length)?experienceDisclosure("Measure-level information gaps",renderManagementMetricGrid([...priorityGaps,...otherGaps]),fmt(priorityGaps.length+otherGaps.length)+" gaps · supporting information only"):"")+
      experienceDisclosure("Further analysis",'<div class="management-two-column">'+
        managementPanel("Analysis available","Open the specialist analysis that supports the executive position.",renderManagementConsistency(data.consistency))+
        managementPanel("Evidence review","Use Information & Actions for missing, conflicting or unread project evidence.",managementModuleLink("source-quality","Open Information & Actions"))+
      '</div>',"Available results and supporting documents")+
      experienceDisclosure("NCR, RFI and risk records",renderOperationalReporting(data.operationalReporting),"Quality, RFI and risk records")+
      managementPanel("Commercial Exposure by Currency","Amounts are shown separately for each currency.",renderManagementCommercial(data.commercialByCurrency||[])+renderManagementVariationReconciliation(data.variationReconciliation||[]))+
      '<div class="notice info"><b>Risk assessment:</b> Overall and contract risk require a documented assessment. Missing information remains unconfirmed.</div>'+
      '</div>';
  }
  if(key==="command-center"){
    const ctrl=data.controls||null;
    const controlsBody=ctrl?planningKpis([
      ["Open risks",ctrl.riskEvidenceState==="established"?ctrl.openRiskCount:"Not established","Risk register and rating method",ctrl.riskEvidenceState==="established"?"":"warning"],
      ["Major / critical NCR",ctrl.openCriticalMajorNcrCount??(data.operationalReporting?.knownCounts?.openCriticalMajorNcrCount!==undefined?fmt(data.operationalReporting.knownCounts.openCriticalMajorNcrCount)+" confirmed":"Not established"),ctrl.openCriticalMajorNcrCount===null?"Known subset; full total not confirmed":"quality evidence",ctrl.openCriticalMajorNcrCount?"danger":""],
      ["Overdue RFI",ctrl.rfiEvidenceState==="established"?ctrl.overdueRfiCount:"Not established","RFI evidence",ctrl.overdueRfiCount?"danger":""],
      ["Permit issues",ctrl.permitEvidenceState==="established"?ctrl.overduePermitCount:"Not established","permit evidence",ctrl.overduePermitCount?"danger":""],
      ["Expired bonds",ctrl.bondEvidenceState==="established"?ctrl.expiredBondCount:"Not established","security evidence",ctrl.expiredBondCount?"danger":""],
      ["Expiring bonds",ctrl.bondEvidenceState==="established"?ctrl.expiringBondCount30Days:"Not established","next 30 days",ctrl.expiringBondCount30Days?"warning":""]
    ]):'<div class="empty">Project Director control position is not confirmed.</div>';
    return '<div class="planning-view management-view command-center-view">'+
      managementPanel("Actions requiring management attention","Issue → consequence → affected scope → owner → action → due date → escalation. Missing ownership or dates are shown, never invented.",renderCommandActionTable(data),true)+
      managementPanel("Accountability & escalation","The same canonical action population grouped by recorded owner/accountable party. Unassigned actions remain visible and are not converted into 'no action'.",renderCommandAccountability(data))+
      experienceSourceContext(key,data)+
      managementPanel("Current Programme Position","Completion and programme facts that explain the actions above.",renderManagementMetricGrid((data.programmePosition||[]).filter(m=>m.value!==null&&m.value!==undefined)))+
      experienceDisclosure("Supporting control signals",controlsBody,"Risk, quality, RFI, permits and securities")+
      experienceDisclosure("Supporting management alerts",renderManagementAlerts(data.alerts||[]),fmt((data.alerts||[]).length)+" alert bases")+
      experienceDisclosure("NCR, RFI and risk records",renderOperationalReporting(data.operationalReporting||ctrl?.reporting),"Quality, RFI and risk records")+
      managementPanel("Information still required","Missing or incomplete evidence is shown after current actions and available facts.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      experienceDisclosure("Approvals and publication",renderManagementEvidenceGaps(data.governanceGaps||[])+renderManagementConsistency(data.consistency),"Governance follow-up")+
      experienceDisclosure("Commercial & Payment Position",renderManagementCommercial(data.commercialByCurrency||[])+renderManagementVariationReconciliation(data.variationReconciliation||[]),"Commercial supporting position")+
      '</div>';
  }
  if(key==="master-control-programme"){
    const r=data.revisionAuthority||{};
    const w=data.wbsControl||{};
    const s=data.scope||{};
    const positions=Array.isArray(data.specialistPositions)?data.specialistPositions:[];
    const candidates=Array.isArray(data.candidateInbox)?data.candidateInbox:[];
    const history=Array.isArray(data.controlHistory)?data.controlHistory:[];
    const positionSeverity=p=>{const counts=p.issueAssessment?.counts||{};if((counts.system_defect||0)+(counts.source_conflict||0)+(counts.data_quality||0)>0)return {label:'Material issue',tone:'blocked'};if((counts.missing_information||0)+(counts.comparison_difference||0)>0)return {label:'Qualified',tone:'review'};if((counts.governance_review||0)+(counts.verification_pending||0)>0)return {label:'Routine follow-up',tone:'not_applicable'};return {label:'Current',tone:'ready'};};
    const positionRows=positions.map(p=>{const severity=positionSeverity(p);return '<tr><td><b>'+escapeHtml(p.group)+'</b></td><td>'+escapeHtml(names[p.key]||p.label)+'</td><td><span class="state-pill '+severity.tone+'">'+severity.label+'</span><br>'+issueBadge(p.issueAssessment)+'</td><td>'+escapeHtml(readerModuleSummary(p.reason))+(p.reason?'<details><summary>Calculation notes</summary>'+escapeHtml(p.reason)+'</details>':'')+'</td><td>'+managementModuleLink(p.key,"Open page")+'</td></tr>';}).join("");
    const candidateRows=candidates.map(item=>'<tr><td><b>'+escapeHtml(item.label)+'</b></td><td>'+escapeHtml(humanizeKey(item.type))+'</td><td>'+managementAuthorityBadge(item.status)+'</td><td>'+escapeHtml(item.sourceRef)+'</td><td>'+managementModuleLink(item.owningModule,"Open owner")+'</td></tr>').join("");
    const historyRows=history.map(item=>'<tr><td>'+escapeHtml(formatDocumentTime(item.occurredAt))+'</td><td><b>'+escapeHtml(item.entity)+'</b></td><td>'+escapeHtml(item.action)+'</td><td>'+escapeHtml(item.actor||"System / not recorded")+'</td><td>'+managementAuthorityBadge(item.state)+'</td><td>'+escapeHtml(item.sourceRef||"—")+'</td></tr>').join("");
    return '<div class="planning-view management-view master-control-view">'+
      renderMcpProgrammeControl(data)+
      managementPanel("Programme basis","Current programme, controlled baseline and project structure supporting the integrated control sequence.",planningKpis([
        ["Project",s.project||data.projectId,"Current project"],
        ["Programme membership",humanizeKey(s.programmeMembershipState||"not_established"),s.programme||"Programme membership is not established in the supplied project records",s.programmeMembershipState==="established"?"":"warning"],
        ["Current programme",r.currentLabel?planningRevisionLabel(r.currentLabel):"Unresolved",r.currentDataDateIso?planningShortDate(r.currentDataDateIso):"no Data Date",r.currentRevisionId?"success":"warning"],
        ["Controlled baseline",r.baselineLabel?planningRevisionLabel(r.baselineLabel):"Unresolved",r.baselineRevisionId?"Baseline revision; full document reference in details":"no confirmed baseline",r.baselineRevisionId?"success":"warning"],
        ["Programme revisions",r.governedRevisionCount??0,"non-recovery revisions"],
        ["Recovery scenarios",r.recoveryScenarioCount??0,"Separate from the current programme"]
      ]),true)+
      experienceSourceContext(key,data)+
      managementPanel("WBS & Work-Package Control","Observed programme structure is shown first. Approval of an official contractual work-package structure remains a separate authority question.",planningKpis([
        ["Observed programme structure",w.observedCoveragePercent===null||w.observedCoveragePercent===undefined?"Coverage unavailable":fmt(w.observedCoveragePercent)+"% activity coverage",(w.activityCount??0)+" activities mapped against the observed programme WBS structure","accent"],
        ["Observed WBS",w.observedWbsCount??0,"programme labels"],
        ["Activities",w.activityCount??0,"current programme"],
        ["Approved / official work-package structure",w.officialWorkPackageState==="established"&&w.officialWorkPackageCoveragePercent!==null&&w.officialWorkPackageCoveragePercent!==undefined?fmt(w.officialWorkPackageCoveragePercent)+"% coverage":"Authority not established",w.officialWorkPackageState==="established"?humanizeKey(w.officialWorkPackageState):"Observed WBS coverage does not prove an approved contractual work-package structure.",w.officialWorkPackageState==="established"?"success":"warning"]
      ])+(w.observedWbsLabels?.length?'<details class="management-detail"><summary>Observed WBS labels <span>'+escapeHtml(fmt(w.observedWbsLabels.length))+' labels</span></summary><div class="management-tag-list">'+w.observedWbsLabels.map(label=>'<span>'+escapeHtml(label)+'</span>').join("")+'</div></details>':""))+
      experienceDisclosure("Control authority & evidence",renderMcpGovernanceMatrix(data)+managementPanel("Specialist positions","Supporting control/evidence status by workstream.",positionRows?'<div class="table-wrap"><table><thead><tr><th>Workstream</th><th>Position</th><th>Status</th><th>Reason</th><th>Correction source</th></tr></thead><tbody>'+positionRows+'</tbody></table></div>':'<div class="empty">No specialist positions are established.</div>'),"Governance and authority supporting the integrated programme")+
      managementPanel("Suggested updates for review","Review each suggested update with its supporting document. Use the relevant page to approve, reject or defer it before it changes the project position.",candidateRows?'<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Type</th><th>Status</th><th>Source evidence</th><th>Owning module</th></tr></thead><tbody>'+candidateRows+'</tbody></table></div>':'<div class="notice info">No current candidate is waiting for review.</div>')+
      managementPanel("Information to confirm","Confirm missing information, outdated records and conflicting values.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      managementPanel("Approvals and publication","A report awaiting publication does not change the recorded project figures.",renderManagementEvidenceGaps(data.governanceGaps||[])+renderManagementConsistency(data.consistency))+
      managementPanel("Control History","Audit history records evidence updates, board publications and the latest certified recalculation. It does not invent actors that were not recorded.",historyRows?'<div class="table-wrap"><table><thead><tr><th>Date/time</th><th>Entity</th><th>Action</th><th>Actor</th><th>State</th><th>Source</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty">No management-control history is available.</div>')+
      '</div>';
  }
  return"";
}

function renderRecoveryAccelerationVisual(data){
  const p=projectionFor(data,"recovery_acceleration");if(!p)return "";
  const scenarios=Array.isArray(p.scenarios)?p.scenarios:[],eligibility=p.eligibility||{};
  const assessment=p.eligibilityAssessmentState||(p.calculatedScenarioCount>0?"calculated_options_available":p.assumptionRequiredCount>0?"candidates_need_assumptions":"checked_no_eligible_basis");
  const basisAbsent=assessment==="supporting_basis_absent";
  const headline=assessment==="calculated_options_available"
    ?"Calculated recovery option(s) are available under the stated scenario assumptions."
    :assessment==="candidates_need_assumptions"
      ?"Recovery candidates exist, but quantified recovery needs additional assumptions."
      :assessment==="supporting_basis_absent"
        ?"No supporting recovery basis is established; eligibility counts are not presented as assessed zeros."
        :"No eligible quantified recovery scenario is available after the current eligibility checks.";
  const rows=scenarios.map(s=>'<tr><td><b>'+escapeHtml(humanizeKey(s.type))+'</b><br><span class="muted">'+escapeHtml(s.state==="calculated"?"Calculated scenario":"Needs assumption")+'</span></td><td>'+escapeHtml(s.subject)+'</td><td>'+escapeHtml(s.assumption)+'</td><td>'+escapeHtml(s.currentPosition)+'</td><td>'+escapeHtml(s.targetPosition)+'</td><td>'+escapeHtml(s.possibleDaysRecovered===null?"Not calculable":fmt(s.possibleDaysRecovered)+" d")+'</td><td>'+escapeHtml(s.additionalResources||"Not established")+'</td><td>'+escapeHtml(s.estimatedCost===null?"Not established":fmt(s.estimatedCost)+" "+(s.currency||""))+'<br><span class="muted">'+escapeHtml(s.costBasis)+'</span></td><td>'+escapeHtml((s.constraints||[]).join("; "))+'</td><td>'+escapeHtml((s.risks||[]).join("; "))+'</td></tr>').join("");
  const count=(value)=>basisAbsent?"Not assessable":fmt(value??0);
  const table=scenarios.length?'<div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Subject</th><th>Assumption</th><th>Current position</th><th>Target</th><th>Possible days recovered</th><th>Additional resources</th><th>Estimated cost</th><th>Constraints</th><th>Risks</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="notice info"><b>'+escapeHtml(headline)+'</b><p>'+escapeHtml(p.managementPosition||"")+'</p></div>';
  return '<section class="planning-view recovery-view"><div class="notice '+(assessment==="calculated_options_available"?"info":assessment==="supporting_basis_absent"?"warn":"info")+'"><h4>Recovery & acceleration position</h4><p>'+escapeHtml(headline)+'</p><p>'+escapeHtml(p.managementPosition||"")+'</p><p>Every option remains a scenario until separately approved/adopted.</p></div>'+planningKpis([
    ["Calculated recovery options",p.calculatedScenarioCount>0?p.calculatedScenarioCount:basisAbsent?"Not assessable":"None qualify","evidence-supported local scenarios"],
    ["Options needing assumptions",p.assumptionRequiredCount>0?p.assumptionRequiredCount:basisAbsent?"Not assessable":"None","not quantified until assumptions are established"],
    ["Eligibility checks performed",basisAbsent?"Not assessable":eligibility.actualEligibilityChecksPerformed??0,"true zero retained when checks were possible"],
    ["Data Date",planningShortDate(p.dataDateIso),"current project position"]
  ])+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Eligibility evidence</h4><p>Missing supporting basis is different from a checked zero.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Activity feasibility checks",count(eligibility.activityFeasibilityCheckCount),"quantity / productivity / resource checks"],
    ["Crew acceleration candidates",count(eligibility.crewAccelerationCandidateCount),"submitted crew below calculated need"],
    ["Late procurement packages",count(eligibility.lateProcurementPackageCount),"forecast delivery after programme need"],
    ["Checks needing basis",count(eligibility.unresolvedFeasibilityCheckCount),"working-time / productivity / resource input"],
    ["Resequencing-enabled workfronts",count(eligibility.governedResequencingWorkfrontCount),"explicit governed permission"]
  ])+'</div></section><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Recovery scenarios</h4><p>Days recovered remain local to the affected activity/package unless project-completion effect is separately proven.</p></div></div><div class="planning-panel-body">'+table+'</div></section><details class="source-scope"><summary>Calculation basis and limits</summary><p>'+escapeHtml(p.basis||"")+'</p></details></section>';
}
function interfaceDisplay(value,fallback='—'){if(value===null||value===undefined)return fallback;const text=String(value).trim();return !text||/^(?:undefined|null|nan)$/i.test(text)?fallback:text;}
function renderInterfaceIntelligenceVisual(data){
  const p=data?.interfaceProjectionKey==="interface_intelligence"?data:projectionFor(data,"interface_intelligence");if(!p)return "";
  const rows=(p.rows||[]).map(r=>'<tr><td><b>'+escapeHtml(interfaceDisplay(r.interfaceId,'Interface'))+'</b><br><span class="state-pill '+(r.authority==='confirmed'?(r.state==='blocked'||r.state==='overdue'?'blocked':r.state==='closed'?'ready':'review'):'not_applicable')+'">'+escapeHtml(r.authority==='confirmed'?humanizeKey(r.state):'Candidate')+'</span></td><td>'+escapeHtml(interfaceDisplay(r.givingParty,'Not established'))+'</td><td>'+escapeHtml(interfaceDisplay(r.receivingParty,'Not established'))+'</td><td>'+escapeHtml(interfaceDisplay(r.package))+'</td><td>'+escapeHtml(interfaceDisplay(r.discipline))+'</td><td>'+escapeHtml(interfaceDisplay(r.system))+'</td><td>'+escapeHtml(interfaceDisplay(r.location))+'</td><td>'+escapeHtml(interfaceDisplay(r.requiredDeliverable,'Not established'))+'</td><td>'+escapeHtml(r.requiredDate?planningShortDate(r.requiredDate):'Not established')+'</td><td>'+escapeHtml(interfaceDisplay(r.responsibleParty,'Not established'))+'</td><td>'+escapeHtml(interfaceDisplay(r.linkedActivity))+'</td><td>'+escapeHtml(interfaceDisplay(r.linkedRfi))+'</td><td>'+escapeHtml(interfaceDisplay(r.linkedSubmittal))+'</td><td>'+escapeHtml(interfaceDisplay(r.linkedRisk))+'</td><td>'+escapeHtml(interfaceDisplay(r.consequence))+'</td><td>'+escapeHtml(interfaceDisplay(r.escalation))+'</td></tr>').join('');
  return '<section class="planning-view interface-view"><div class="notice '+(p.blockerCount?'warn':'info')+'"><h4>Interface position</h4><p>'+escapeHtml(p.managementPosition)+'</p></div>'+planningKpis([
    ["Confirmed interfaces",p.confirmedCount??0,"governed / verified records"],["Blocked / overdue",p.blockerCount??0,"confirmed interfaces requiring action"],["Candidate interfaces",p.candidateCount??0,"derived for review, not confirmed"],["Linked activities",p.linkedActivityCount??0,"programme activities touched by interface records/candidates"]
  ])+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Interface register & candidates</h4><p>Confirmed records and professional candidates remain visibly separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Interface ID</th><th>Giving party</th><th>Receiving party</th><th>Package</th><th>Discipline</th><th>System</th><th>Location</th><th>Required deliverable</th><th>Required date</th><th>Responsible party</th><th>Activity</th><th>RFI</th><th>Submittal</th><th>Risk</th><th>Consequence</th><th>Escalation</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section><details class="source-scope"><summary>Interface derivation basis</summary><p>'+escapeHtml(p.basis||'')+'</p></details></section>';
}
function renderAccountabilityVisual(data){
 const p=projectionFor(data,"cross_domain_accountability");if(!p)return "";
 const actions=p.actions||[];
 const actionRows=actions.slice(0,100).map(action=>'<tr><td><span class="state-pill '+(action.severity==="critical"?"blocked":action.severity==="high"?"review":"not_applicable")+'">'+escapeHtml(humanizeKey(action.severity))+'</span></td><td><b>'+escapeHtml(action.issue)+'</b><br><span class="muted">'+escapeHtml(action.consequence||"")+'</span></td><td>'+escapeHtml((action.affectedScope||[]).join("; ")||"—")+'</td><td>'+escapeHtml(action.owner||action.organisation||"Not assigned")+'</td><td>'+escapeHtml(action.dueIso?planningShortDate(action.dueIso):"Not set")+'</td><td>'+escapeHtml(action.requiredAction)+(action.escalation?'<br><b>'+escapeHtml(action.escalation)+'</b>':'')+'</td></tr>').join("");
 const rows=(p.rows||[]).map(r=>'<tr><td>'+escapeHtml(humanizeKey(r.dimension))+'</td><td><b>'+escapeHtml(r.value)+'</b></td><td>'+fmt(r.openIssueCount)+'</td><td>'+fmt(r.domainCount)+'</td><td>'+fmt(r.overdueCount)+'</td><td>'+fmt(r.openNcrCount)+'</td><td>'+fmt(r.overdueRfiCount)+'</td><td>'+fmt(r.latePackageCount)+'</td><td>'+fmt(r.openRiskCount)+'</td><td>'+fmt(r.affectedActivityCount)+'</td></tr>').join('');
 const detail=(p.details||[]).map(r=>'<tr><td>'+escapeHtml(humanizeKey(r.dimension))+'</td><td>'+escapeHtml(r.value)+'</td><td>'+escapeHtml(r.domain)+'</td><td><b>'+escapeHtml(r.reference||r.recordId)+'</b></td><td>'+escapeHtml(r.issue)+'</td><td>'+escapeHtml(r.dueDate?planningShortDate(r.dueDate):'—')+'</td><td>'+escapeHtml(r.overdueDays===null?'—':fmt(r.overdueDays)+' d')+'</td><td>'+escapeHtml((r.activityIds||[]).join('; ')||'—')+'</td></tr>').join('');
 const primary=actions.length?'<div class="table-wrap"><table><thead><tr><th>Priority</th><th>Issue & consequence</th><th>Affected scope</th><th>Accountable party</th><th>Due</th><th>Required action</th></tr></thead><tbody>'+actionRows+'</tbody></table></div>':'<div class="notice info">No actionable ownership chain is established from the current open records.</div>';
 const concentration=rows?'<div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Party / scope</th><th>Open / pressure</th><th>Domains</th><th>Overdue</th><th>Open NCR</th><th>Overdue RFI</th><th>Late package</th><th>Risk</th><th>Affected activities</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>No supporting concentration roll-up is available.</p>';
 return '<section class="planning-view accountability-view"><div class="notice info"><h4>Who owns the current actions?</h4><p>'+escapeHtml(p.managementPosition)+'</p></div><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Accountability action register</h4><p>Ownership means responsibility for the current action; it does not by itself establish contractual delay liability.</p></div></div><div class="planning-panel-body">'+primary+'</div></section><details class="planning-panel"><summary>Supporting workload concentration</summary><div class="planning-panel-body">'+concentration+'</div></details><details class="planning-panel"><summary>Drill back to underlying items · '+fmt((p.details||[]).length)+' records</summary><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Party / scope</th><th>Domain</th><th>Record</th><th>Issue</th><th>Due</th><th>Overdue</th><th>Activities</th></tr></thead><tbody>'+detail+'</tbody></table></div><p>'+escapeHtml(p.basis||'')+'</p></div></details></section>';
}
function renderSpecializedModule(key,data){
  if(key==="source-quality")return renderSourceQuality(data);
  if(key==="cross-domain-accountability")return renderAccountabilityVisual(data);
  if(["master-dashboard","command-center","master-control-programme","source-quality"].includes(key))return renderManagementControlVisual(key,data);
  if(key==="pmo-analysis")return renderPmoVisual(data);
  if(key==="schedule-analytics")return renderScheduleAnalyticsVisual(data);
  if(key==="activity-analytics")return renderActivityAnalyticsVisual(data);
  if(key==="scope-classification")return renderScopeClassificationVisual(data);
  if(key==="resource-utilization")return renderResourceVisual(data);
  if(key==="lookahead-schedule")return renderLookAheadVisual(data);
  if(key==="progress-report")return renderProgressReportVisual(data);
  if(key==="schedule-change-report")return renderScheduleChangeVisual(data);
  if(key==="revision-trend")return renderRevisionTrendVisual(data);
  if(key==="variance-trends")return renderVarianceTrendVisual(data);
  if(key==="progress-scurve")return renderProgressScurveVisual(data);
  if(key==="quantity-scurve")return renderQuantityScurveVisual(data);
  if(key==="progress-breakdown")return renderProgressBreakdownVisual(data);
  if(key==="milestones")return renderMilestonesVisual(data);
  if(key==="near-critical")return renderNearCriticalVisual(data);
  if(key==="manhour-scurve")return renderManhourVisual(data);
  if(key==="forecast-history")return renderForecastHistoryVisual(data);
  if(key==="independent-forecast")return renderForecastVisual(data);
  if(key==="recovery-acceleration")return renderRecoveryAccelerationVisual(data);
  if(key==="monte-carlo-risk")return renderMonteCarloRiskVisual(data);
  if(key==="earned-schedule")return renderEarnedScheduleVisual(data);
  if(key==="evm-by-wbs")return renderEvmByWbsVisual(data);
  if(key==="risk-register")return renderRiskRegisterVisual(data);
  if(key==="contract-risk")return renderContractRiskVisual(data);
  if(key==="final-account")return renderFinalAccountVisual(data);
  if(key==="tender-readiness")return renderTenderReadinessVisual(data);
  if(key==="delay-claims")return renderDelayClaimsVisual(data);
  if(key==="notices-claims")return renderNoticesClaimsVisual(data);
  if(key==="windows-analysis")return renderWindowsVisual(data);
  if(key==="eot-assessment")return renderEotVisual(data);
  if(key==="delivery-interfaces")return renderInterfaceIntelligenceVisual(data);
  if(["commercial-overview","cost-forecast","variations-change","payments","cash-flow","commercial-claims-notices","contract-particulars-bonds"].includes(key))return renderCommercialVisual(key,data);
  if(["commercial-terms","cost-register","payment-register","cbs-breakdown","cost-control","evm-performance","cash-flow-register","cost-scurve","site-instructions","contract-obligations","liquidated-damages","bonds-insurance","retention-calendar"].includes(key))return renderCommercialCapabilityVisual(key,data);
  return"";
}
function findProjectionRoot(data){
  if(!data||typeof data!=="object")return data||{};
  if(data.projectionKey)return data;
  const direct=Object.values(data).find(value=>value&&typeof value==="object"&&!Array.isArray(value)&&value.projectionKey);
  return direct||data;
}
function renderClaimsReporting(r,key){
  if(!r)return "";
  const reported=r.reported;
  const sourceSummary=reported?'<div class="notice info"><b>Register position for '+fmt(reported.recordCount)+' claims recorded through DD</b><p>'+escapeHtml(fmt(reported.claimedDays.value)+' days claimed · '+fmt(reported.assessedDays.value)+' assessed ('+fmt(reported.employerDelayDays.value)+' employer / '+fmt(reported.contractorDelayDays.value)+' contractor).')+'</p><p>'+escapeHtml(reported.states.map(x=>x.count+' '+x.status).join(' · '))+'</p><p>'+escapeHtml(reported.basis)+'</p></div>':'';
  const conflicts=reported?.conflictingRows?.length?'<details open><summary>Register conflicts requiring review · '+fmt(reported.conflictingRows.length)+'</summary><ul>'+reported.conflictingRows.map(c=>'<li><b>'+escapeHtml(c.claimId)+'</b>: '+escapeHtml(c.sourceStatus)+'; claimed '+fmt(c.claimedDays)+' d; assessed '+fmt(c.assessedDays)+' d; source-register granted '+fmt(c.registerGrantedDays)+' d (separate from assessment). '+escapeHtml(c.diagnostics.filter(d=>/CONFLICT|DIFFER|NOT_IN_DETERMINATION_REGISTER/.test(d)).map(humanizeKey).join('; '))+'</li>').join('')+'</ul></details>':'';
  const versions=r.noticeRuleVersions?.length?'<div class="notice info"><b>Notice rules in the contract</b><ul>'+r.noticeRuleVersions.map(v=>'<li>'+fmt(v.noticePeriodDays)+' days · '+escapeHtml(v.effectiveFromIso?'from '+planningShortDate(v.effectiveFromIso):'original contract')+escapeHtml(v.effectiveToIso?' until '+planningShortDate(v.effectiveToIso):'')+' · '+fmt(v.noticeCount)+' notices dated in this period.</li>').join('')+'</ul><p>These are notice-date cohorts, not confirmed compliance groups. Supply event/awareness dates and confirm amendment applicability and any retrospective effect.</p></div>':'';
  const cr=r.correspondenceReview;
  const letters=cr?'<div class="notice warn"><b>Check the letters behind the register references</b><p>'+fmt(cr.registerNoticeCount)+' register notice references; '+fmt(cr.documentIdentityCount)+' matching letter identities in extracted pages; '+fmt(cr.noticeContentLinkedCount)+' contents explicitly linked to the event and notice date. '+escapeHtml(cr.interpretation)+'</p>'+basisTable(['Document','Pages','Native text pages','OCR pages','OCR failed pages'],(cr.documentCoverage||[]).map(d=>[d.sourceFilename,d.totalPages,d.nativePages,d.ocrPages,d.ocrFailedPages]))+'<p>Unread pages must be checked before an unconfirmed reference is called missing.</p><details><summary>Determination letters and register awards</summary>'+basisTable(['Determination','Claim','Register award','Register date','DD scope','Letter','Letter review'],cr.determinations.map(d=>[d.determinationId,d.claimId,fmt(d.awardedDays)+' d',planningShortDate(d.determinationDate),humanizeKey(d.reportingScope),d.sourceLetter,d.correspondenceReview?.basis||'Letter content not checked']))+'</details></div>':'';
  const countNotices=(rows,determination)=>rows.filter(n=>(n.kind==="determination")===determination).length;
  const counts=planningKpis([["Claims known by Data Date",r.claims.asOf.length,fmt(r.claims.future.length)+" future · "+fmt(r.claims.undated.length)+" undated"],["Claim notices by Data Date",countNotices(r.notices.asOf,false),fmt(countNotices(r.notices.future,false))+" future · "+fmt(countNotices(r.notices.undated,false))+" undated · determinations excluded"],["Determinations by Data Date",countNotices(r.notices.asOf,true),fmt(countNotices(r.notices.future,true))+" future · "+fmt(countNotices(r.notices.undated,true))+" undated"],["Events evidenced by Data Date",r.events.asOf.length,"Notice dates establish existence, never event start or causation"]]);
  const details=(label,rows)=>'<details><summary>'+escapeHtml(label)+' · '+fmt(rows.length)+' records</summary><div class="table-wrap"><table><thead><tr><th>Record</th><th>Subject</th><th>Source date</th><th>Source state</th></tr></thead><tbody>'+rows.map(n=>'<tr><td>'+escapeHtml(n.noticeId||n.claimId||n.eventId)+'</td><td>'+escapeHtml(n.subject||n.title||"")+'</td><td>'+escapeHtml(planningShortDate(n.actualIssuedAt||n.submittedAt||n.startIso))+'</td><td>'+escapeHtml(humanizeKey(n.state||n.kind||"source"))+'</td></tr>').join("")+'</tbody></table></div></details>';
  const full='<section class="planning-panel reporting-scope"><div class="planning-panel-head"><div><h4>Claims through the reporting date and later records</h4><p>Only dated evidence available by the programme Data Date enters current totals. Source final statuses do not establish historical decisions.</p></div></div><div class="planning-panel-body">'+sourceSummary+conflicts+versions+letters+counts+details("Notices after Data Date",r.notices.future)+details("Undated notices",r.notices.undated)+details("Claims after Data Date",r.claims.future)+details("Undated claims",r.claims.undated)+'</div></section>';
  if(!key||key==='delay-claims')return full;
  return '<div class="notice info"><b>'+fmt(r.claims.asOf.length)+' claims known by Data Date'+(reported?' · '+fmt(reported.claimedDays.value)+' days claimed · '+fmt(reported.assessedDays.value)+' assessed':'')+'</b><p>Claim-day totals are separate from programme movement and EOT. '+fmt(reported?.conflictingRows?.length??0)+' register conflicts need review.</p>'+experienceDisclosure('Claim records, notice versions and letter evidence',full,'Claim amounts, dates and letters')+'</div>';
}
function issueLabel(kind){return humanizeKey(kind||'verification_pending')}
function issueBadge(assessment){const kind=assessment?.primaryKind||"verification_pending";return '<span class="issue-badge '+escapeHtml(kind)+'">'+escapeHtml(issueLabel(kind))+'</span>'}
function renderIssueAssessment(a,management=false){
  if(!a)return '<p>Review classification is not yet available.</p>';
  const descriptions={system_defect:"A CMeng calculation or same-basis check failed.",source_conflict:"Supplied sources make incompatible assertions.",data_quality:"A supplied field or link needs correction.",missing_information:"An input required for this conclusion is unavailable.",comparison_difference:"Two positions differ on the stated comparison basis.",governance_review:"An approval or authority is not confirmed.",verification_pending:"CMeng verification coverage is incomplete."};
  const counts=management?a.affectedModuleCounts:a.counts;
  const countRows=Object.entries(descriptions).map(([kind,description])=>'<tr><td>'+issueBadge({primaryKind:kind})+'</td><td>'+fmt(counts?.[kind]??0)+'</td><td>'+escapeHtml(description)+'</td></tr>').join('');
  const rows=(a.issues||[]).map(i=>{const r=readerIssue(i);return '<tr><td>'+issueBadge({primaryKind:i.kind})+'</td><td><b>'+escapeHtml(r.title)+'</b></td><td>'+escapeHtml(r.owner)+'<br>'+escapeHtml(r.action)+'</td><td>'+escapeHtml((i.moduleKeys||[]).map(k=>names[k]||k).join(', '))+'<details><summary>Document references and calculation details</summary>'+escapeHtml([i.summary,i.detail,...(i.evidencePaths||[]),...(i.checkIds||[]),...(i.sourceRefs||[])].join(' · '))+'</details></td></tr>';}).join('');
  const scope=a.systemCheckState==='failed'?'Calculation failures require correction before reliance.':a.systemCheckState==='unverified'?'Verification coverage is incomplete.':'The listed checks passed. Other calculations may remain outside their scope.';
  return '<section class="issue-assessment"><h4>Review findings</h4><p>'+escapeHtml(scope)+'</p><p>'+escapeHtml(management?'A page may have more than one type of follow-up.':'Each item below has its own action and supporting records.')+'</p>'+(rows?'<div class="table-wrap"><table><thead><tr><th>Type</th><th>Finding</th><th>Owner and next step</th><th>Source</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>No issues identified by the listed checks.</p>')+experienceDisclosure('Classification counts','<div class="table-wrap"><table><thead><tr><th>Type</th><th>Count</th><th>Meaning</th></tr></thead><tbody>'+countRows+'</tbody></table></div>')+'<small>'+escapeHtml(a.scope||'')+'</small></section>';
}
function renderModuleReadiness(data,reason=''){
  const r=data?.moduleReadiness;
  const classification=renderIssueAssessment(data?.issueAssessment,['master_dashboard','command_center','master_control_programme'].includes(data?.projectionKey));
  const checks=r?'<p>Calculation: '+escapeHtml(r.calculation)+' · Evidence: '+escapeHtml(humanizeKey(r.evidence))+' · Consistency: '+escapeHtml(r.consistency)+' · Comparison: '+escapeHtml(humanizeKey(r.reconciliation))+'</p><p>'+escapeHtml(r.scope)+'</p>':'';
  const notes=reason?'<p>'+escapeHtml(reason)+'</p>':'';
  return '<details id="moduleReviewDetail" class="experience-disclosure experience-audit"><summary>Actions and supporting details<span>Documents, date rules and calculation checks</span></summary><div class="experience-disclosure-body">'+classification+checks+notes+(data?.positionVerdict?.specific===false?renderPositionVerdict(data,true):'')+renderRegisterScope(data,true)+renderModuleBasis(data,true)+'<p><a href="'+escapeHtml(reportDownloadUrl('json'))+'" download>Download complete calculation data</a> · <a href="'+escapeHtml(reportDownloadUrl('xlsx'))+'" download>Download the full register</a></p></div></details>';
}
function renderModuleBasis(data,detail=false,contextOnly=false){
  const root=findProjectionRoot(data);
  const revision=root.sourceRevisionId||root.evidenceRevisionId||root.scheduleRevisionId||root.boqRevisionId||root.basisRevisionId||root.forecast?.basisRevisionId||null;
  const asOf=data?.reportingContract?.dataDateIso||root.dataDateIso||root.asOfIso||overview?.latestDataDateIso||null;
  const overviewProgramme=data?.reportingContract?.programmeLabel|| (overview?.latestRevisionLabel?planningRevisionLabel(overview.latestRevisionLabel):null);
  const revisionText=(overviewProgramme?planningRevisionLabel(overviewProgramme):null)||(revision&&(String(revision).length>28||String(revision).includes("rev_")||String(revision).includes("schedrev_"))?"Current programme":revision);
  const values=[
    ["Programme basis",revisionText],
    ["Data date",asOf?planningShortDate(asOf):asOf]
  ].filter(([,value])=>value!==null&&value!==undefined&&String(value).length>0);
  if(!values.length)return"";
  const scopeHtml=renderClaimsReporting(data?.claimsReporting);
  const contract=data?.reportingContract;
  const populations=contract?uniqueReportingPopulations(Object.values(contract.populations||{})).map(p=>[p.populationId,p]):[];
  const populationHtml=populations.length?'<details class="planning-panel reporting-populations"><summary>Reporting populations · '+populations.length+' defined groups</summary><div class="planning-panel-body"><p>Denominators use eligible source records, independently of table display limits. Future planned work remains visible as forecast work.</p><div class="table-wrap"><table><thead><tr><th>Population</th><th>Included / source</th><th>Excluded</th><th>Date basis</th><th>Authority</th><th>Population ID</th></tr></thead><tbody>'+populations.map(([key,p])=>'<tr><td>'+escapeHtml(p.name)+'</td><td>'+fmt(p.denominator)+' / '+fmt(p.sourceCount)+'</td><td>'+fmt(p.exclusions.length)+'</td><td>'+escapeHtml(p.dateBasis)+'</td><td>'+escapeHtml(humanizeKey(p.authority))+'</td><td>'+escapeHtml(p.populationId)+'</td></tr>').join('')+'</tbody></table></div></div></details>':'';
  const baselineHeadline=data?.baselineComparison?.state==='unresolved'&&['schedule_analytics','activity_analytics','milestones','near_critical','progress_report','progress_scurve','variance_trends','lookahead_schedule','challenge_contract'].includes(root.projectionKey)?'<p class="source-scope-summary">Baseline comparisons unresolved: no confirmed baseline.</p>':'';
  const completion=contract?.completionAuthority;
  const completionHeadline=completion&&!completion.governedContractualFinish&&['master_dashboard','command_center','pmo_analysis','independent_forecast','eot_assessment','notices_claims','milestones','commercial_claims_notices','contract_particulars_bonds','challenge_contract'].includes(root.projectionKey)?'<div class="notice warn"><b>Contract completion: unresolved.</b> '+escapeHtml(completion.reason||completion.explanation)+'</div>':'';
  const excludedActuals=[...(contract?.excludedScheduleActualEvents?.future||[]),...(contract?.excludedScheduleActualEvents?.undated||[])];
  const actualScopeHtml=excludedActuals.length?'<details class="notice warn"><summary>'+fmt(excludedActuals.length)+' schedule actual events excluded from the Data Date position</summary><p>Historical completion and progress are withheld for affected records. Source evidence and planned dates are retained.</p><table><thead><tr><th>Activity</th><th>Actual event</th><th>Source date</th></tr></thead><tbody>'+excludedActuals.map(r=>'<tr><td>'+escapeHtml(r.activityId)+'</td><td>'+escapeHtml(humanizeKey(r.event))+'</td><td>'+escapeHtml(r.dateIso)+'</td></tr>').join('')+'</tbody></table></details>':'';
  const authorityHtml=completion&&['eot_assessment','commercial_claims_notices','contract_particulars_bonds'].includes(root.projectionKey)?'<div class="notice info"><b>Completion authority.</b> Contract completion: '+escapeHtml(planningShortDate(completion.governedContractualFinish))+' ('+escapeHtml(humanizeKey(completion.authority))+'). '+escapeHtml(completion.explanation)+'</div>':'';
  if(detail)return completionHeadline+authorityHtml+actualScopeHtml+populationHtml;
  const newer=contract?.newerUnadoptedSchedules||[];
  const screening=['near_critical','pmo_analysis','schedule_analytics','activity_analytics'].includes(root.projectionKey)?root.nearCriticalScreening||root.sourceInterpretation?.nearCriticalScreening:null;
  const screeningHeadline=screening?'<div class="notice '+(screening.broadScreening?'warn':'info')+'"><b>Near-critical screening:</b> '+escapeHtml(screening.basis)+'. '+escapeHtml(screening.explanation)+(screening.broadScreening?'<p>'+escapeHtml(screening.action)+'</p>':'')+'</div>':'';
  const unresolvedCalendar=contract?.calendarResolution?.unresolvedActivityCount||0;
  const calendarHeadline=unresolvedCalendar&&['independent_forecast','near_critical','pmo_analysis','master_dashboard','command_center','project_director','schedule_analytics'].includes(root.projectionKey)?'<div class="notice warn"><b>Unresolved: '+fmt(unresolvedCalendar)+' activities.</b> Their working calendars could not be read. Programme calendar recalculation, its comparison with the contract, and the near-critical count are unresolved.</div>':'';
  const adoptionReview=data?.scheduleAuthorityReview;
  const adoptionHeadline=adoptionReview&&adoptionReview.state!=="established"?'<div class="notice warn">'+escapeHtml(adoptionReview.explanation)+'</div>':"";
  const newerHeadline=newer.length?'<div class="notice warn"><b>Newer programme supplied, not adopted.</b> '+newer.map(r=>escapeHtml(planningShortDate(r.dataDateIso))+' · '+escapeHtml(r.filename||'Programme')).join('; ')+'</div>':'';
  const chips='<div class="module-basis">'+values.map(([label,value])=>'<span class="basis-chip"><b>'+escapeHtml(label)+'</b><strong title="'+escapeHtml(label==="Programme basis"&&revision?revision:value)+'">'+escapeHtml(value)+'</strong></span>').join("")+'</div>';
  return contextOnly?chips:baselineHeadline+completionHeadline+calendarHeadline+screeningHeadline+chips;
}
function renderStructuredSections(data){
  if(!data||typeof data!=="object")return"";
  const hiddenKeys=new Set(["challenge","projectionKey","generatedAt","producerVersion","dependencyReceipts","sourceManifestId","evidenceReceiptIds"]);
  const complex=Object.entries(data).filter(([key,value])=>!hiddenKeys.has(key)&&!isScalarValue(value));
  return complex.map(([key,value])=>{
    const count=Array.isArray(value)?value.length:null;
    return '<section class="data-section"><div class="data-section-head"><h4>'+escapeHtml(humanizeKey(key))+'</h4>'+(count===null?'':'<span class="badge">'+escapeHtml(count)+' records</span>')+'</div><div class="data-section-body">'+renderStructuredValue(value,0)+'</div></section>';
  }).join("");
}
function userFacingModuleReason(key,reason){
  if(!reason)return"";
  return String(reason)
    .replace(/independent CPM/gi,"independent path check")
    .replace(/driving-path/gi,"driving path")
    .replace(/projection/gi,"analysis")
    .replace(/evidence/gi,"project information");
}
${programmeReviewScript()}
${deliveryScript()}
function advancedControlsHtml(parentKey){
  const views=advancedSubviewMap[parentKey]||[];
  if(!views.length)return"";
  return '<section class="planning-panel advanced-controls"><div class="planning-panel-head"><div><h4>Additional controls</h4><p>Specialist analyses are kept inside the relevant page so the main navigation stays concise.</p></div></div><div class="planning-panel-body"><div class="advanced-control-tabs">'+views.map(([key,label])=>'<button type="button" class="btn small" data-advanced-control="'+escapeHtml(key)+'">'+escapeHtml(label)+'</button>').join("")+'</div><div id="advancedControlHost"></div></div></section>';
}
function bindAdvancedControls(parentKey){
  const views=advancedSubviewMap[parentKey]||[];if(!views.length)return;
  document.querySelectorAll("[data-advanced-control]").forEach(button=>button.onclick=async()=>{
    const key=button.dataset.advancedControl,label=advancedSubviewTitles[key]||humanizeKey(key),host=el("advancedControlHost");
    if(!host)return;document.querySelectorAll("[data-advanced-control]").forEach(b=>b.classList.toggle("primary",b===button));
    host.innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Preparing '+escapeHtml(label)+'</strong></div>';
    try{
      const result=await api("/api/projects/"+encodeURIComponent(project())+"/advanced/"+encodeURIComponent(key));
      const data=result.data||{},specialized=renderSpecializedModule(key,data);
      const fallback='<div class="scalar-grid">'+scalarPairs(data).map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("")+'</div>'+renderStructuredSections(data);
      host.innerHTML='<div class="advanced-control-head"><div><h3>'+escapeHtml(label)+'</h3><p>'+escapeHtml(userFacingModuleReason(key,result.reason)||"Current project position.")+'</p></div><div class="ask-export-bar"><a class="btn small" href="/api/projects/'+encodeURIComponent(project())+'/advanced/'+encodeURIComponent(key)+'/report.xlsx">Excel</a><a class="btn small" href="/api/projects/'+encodeURIComponent(project())+'/advanced/'+encodeURIComponent(key)+'/report.json">JSON</a></div></div>'+(specialized||fallback)+renderModuleReadiness(data,result.reason||"");
    }catch(e){const d=e.data||{};host.innerHTML='<div class="notice warn"><b>'+escapeHtml(label)+' is not established.</b><p>'+escapeHtml(d.reason||d.message||e.message||"The current project evidence does not support this analysis.")+'</p></div>';}
  });
}
function renderModuleResult(result){
  renderModuleResultBody(result);
  const container=el('moduleContent');
  const review=result.scheduleAuthorityReview||result.data?.scheduleAuthorityReview;
  const pageKey=result.legacyKey||result.key;
  if(pageKey==='source-quality'){const panel=el('projectActionPanel');if(panel)bindProjectActions(panel);}
  else if(pageKey!=='progress-breakdown'&&review&&(review.state!=='established'||review.pendingSchedules?.length)){
    container.insertAdjacentHTML('beforeend','<p class="action-notification">'+(review.state==='missing'?'Select a schedule to enable programme reporting.':review.state==='pending_review'?'Confirm the schedule used for reporting.':'A newly uploaded schedule needs your review.')+' <button class="btn small" id="programmeActionLink">Open project review</button></p>');
    el('programmeActionLink').onclick=()=>openProjectActions();
  }
}
function progressBreakdownSystemFailures(data){
  const failures=(data?.issueAssessment?.issues||[]).filter(issue=>issue.kind==='system_defect');
  if(!failures.length)return '';
  return '<details class="experience-disclosure experience-audit" open><summary>Calculation errors<span>'+escapeHtml(fmt(failures.length))+' system failure'+(failures.length===1?'':'s')+'</span></summary><div class="experience-disclosure-body"><p>CMeng must correct these calculation failures. They do not require you to confirm or invent project data.</p><div class="table-wrap"><table><thead><tr><th>Check</th><th>Problem</th></tr></thead><tbody>'+failures.map(issue=>{const item=readerIssue(issue);return '<tr><td>'+escapeHtml(item.title)+'</td><td>'+escapeHtml(readerText(issue.detail||issue.summary||''))+'</td></tr>';}).join('')+'</tbody></table></div></div></details>';
}
function renderModuleResultBody(result){
  result={...result,key:result.legacyKey||result.key};
  currentModuleResult=result;
  el("moduleReport").disabled=false;
  el("moduleContent").classList.remove("empty");
  renderRoleViewSelector();
  const managementSurface=managementSurfaceKeysForApi.has(result.key);
  el("roleViewSelector").style.display=managementSurface?"none":"";
  const moduleName=names[result.key]||result.key;
  const roleLabel=managementSurface?"Management Control":(roleViews[selectedRoleView]?.label||roleViews.overall.label);
  el("moduleTitle").textContent=moduleName;
  el("moduleSubtitle").textContent=(descriptions[result.key]||"Current position, key changes and actions requiring attention.")+(managementSurface?"":" · "+roleLabel);
  if(appView!=="ai")el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="issue-badge "+(result.issueAssessment?.primaryKind||"verification_pending");
  el("moduleBadge").textContent=result.issueAssessment?.counts?.system_defect>0?"Calculation error":"";
  if(renderDelivery(result)){el('roleViewSelector').style.display='none';return;}
  el('moduleContent').oninput=null;el('moduleContent').onchange=null;el('moduleContent').onclick=null;
  if(result.key==='challenge-contract'&&result.data?.suppliedBoq?.rows?.length&&renderDeliveryChallenge(result.data,result.reason,result.status))return;
  const hasUsefulPayload=!!result.data&&typeof result.data==="object"&&Object.keys(result.data).some(key=>!["projectionKey","schemaVersion","projectId","projectVersion","producerVersion","generatedAt"].includes(key));
  if(result.status==="blocked"&&!hasUsefulPayload){
    const blockedBody='<div class="view-state-bar"><strong>'+escapeHtml(moduleName)+'</strong><span>There is not enough Project information for this calculation yet.</span></div><div class="notice warn">'+escapeHtml(userFacingModuleReason(result.key,result.reason)||"More Project information is needed for this view.")+'</div>';
    el("moduleContent").innerHTML=blockedBody+renderModuleReadiness({issueAssessment:result.issueAssessment},result.reason);
    return;
  }
  const data=result.data||{};
  el("directorDrawer").open=false;
  el("directorDrawer").hidden=result.key!=="pmo-analysis";
  if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason,result.status))return;
  const basisHtml=result.key==='source-quality'?'':renderPositionVerdict(data)+renderModuleBasis(data)+renderRegisterScope(data);
  const challengeBody=result.key==='progress-breakdown'?'':renderUniversalChallenge(data.challenge);
  const challengeHtml=challengeBody?'<details class="reconciliation-panel"><summary><span>Comparison with the submitted position</span><b>'+escapeHtml(reconciliationSummary(data.challenge))+'</b></summary><div class="reconciliation-body">'+challengeBody+'</div></details>':'';
  const specialized=renderSpecializedModule(result.key,data);
  const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");
  const structured=specialized?"":renderStructuredSections(data);
  const genericView=(scalars?'<div class="scalar-grid">'+scalars+'</div>':'')+structured;
  const sourceBasis=result.key==='progress-breakdown'?'':renderBasisReviews(data,result.key);
  // Every analytical page leads with its answer. Review and source administration
  // are supporting context, never a per-page opt-in presentation rule.
  const primaryView=(specialized||genericView);

  el("directorDrawer").open=false;
  el("directorDrawer").hidden=result.key!=="pmo-analysis";
  const userReason=userFacingModuleReason(result.key,result.reason);
  const context=renderModuleBasis(data,false,true);
  const readWarnings=(data.registerReadIssues||[]).map(r=>'<p>'+escapeHtml(r.filename)+': '+escapeHtml(r.message)+'</p>').join('');
  const progressBreakdown=result.key==='progress-breakdown';
  const supporting=progressBreakdown?'':experienceDisclosure("Evidence limits and supporting information",readWarnings+basisHtml+renderClaimsReporting(data.claimsReporting,result.key)+sourceBasis,"Dates, records and calculation qualifications");
  const review=progressBreakdown?progressBreakdownSystemFailures(data):experienceReviewSummary(data.issueAssessment,managementSurface)+renderModuleReadiness(data,userReason);
  el("moduleContent").innerHTML=context+(managementSurface?primaryView:renderRoleContent(result.key,data,primaryView,challengeHtml,Boolean(specialized)))+
    (typeof advancedControlsHtml==="function"?advancedControlsHtml(result.key):"")+
    supporting+review;
  if(typeof bindAdvancedControls==="function")bindAdvancedControls(result.key);
  if(result.key==="activity-analytics"&&typeof restoreActivityFilters==="function")restoreActivityFilters();

}
let moduleRequestSeq=0;
const managementSurfaceKeysForApi=new Set(["master-dashboard","command-center","master-control-programme","source-quality","cross-domain-accountability"]);
const commercialModuleKeysForApi=new Set([
  "commercial-overview",
  "cost-forecast",
  "variations-change",
  "payments",
  "cash-flow",
  "commercial-claims-notices",
  "contract-particulars-bonds"
]);
async function loadModule(key){
  document.body.classList.remove("visual-panel-open","chart-canvas-open");
  document.querySelectorAll(".visual-focus,.chart-focus").forEach(node=>node.classList.remove("visual-focus","chart-focus"));
  if(el("directorDrawer"))el("directorDrawer").open=false;
  if(projectLoadState==="updating"){showProjectUpdating(project());return;}
  if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}
  const moduleName=names[key]||key;
  const requestSeq=++moduleRequestSeq;
  const projectId=project(),projectSeq=projectRequestSeq;
  const current=()=>requestSeq===moduleRequestSeq&&projectRequestIsCurrent(projectId,projectSeq);
  currentModuleResult=null;
  el("moduleReport").disabled=true;
  el("moduleContent").classList.remove("empty");
  el("moduleTitle").textContent=moduleName;
  el("moduleSubtitle").textContent=descriptions[key]||"Current position, key changes and actions requiring attention.";
  if(appView!=="ai")el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="badge";
  el("moduleBadge").textContent="Updating";
  setBusy("Updating "+moduleName);
  el("moduleContent").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Updating '+escapeHtml(moduleName)+'</strong><span>Preparing the latest project position.</span></div>';
  try{
    let result;
    if(managementSurfaceKeysForApi.has(key)){
      result=await api("/api/projects/"+encodeURIComponent(project())+"/management/"+encodeURIComponent(apiKeys[key]||key));
    }else{
      const moduleArea=moduleRegistry.find(m=>m.key===key)?.area||"schedule";
      result=await api("/api/projects/"+encodeURIComponent(project())+"/"+moduleArea+"/modules/"+encodeURIComponent(apiKeys[key]||key));
    }
    if(!current())return;
    renderModuleResult(result);
  }catch(e){
    if(!current())return;
    const d=e.data||{};
    const structuredPosition=d.data&&typeof d.data==="object"&&!Array.isArray(d.data)&&typeof d.data.projectionKey==="string"&&d.data.projectionKey.trim().length>0;
    const assessedPosition=d.issueAssessment&&typeof d.issueAssessment==="object"&&!Array.isArray(d.issueAssessment);
    const sameProject=(!d.projectId||d.projectId===projectId)&&(!d.data?.projectId||d.data.projectId===projectId);
    if(e.status===409&&(d.legacyKey||d.key)===key&&d.status==="blocked"&&sameProject&&(assessedPosition||(Array.isArray(d.dependencies)&&structuredPosition))){
      renderModuleResult(d);
    }else{
      el("moduleBadge").className="badge";
      el("moduleBadge").textContent="Not loaded";
      el("moduleContent").innerHTML='<section class="notice error" role="alert"><h4>Unable to load '+escapeHtml(moduleName)+'</h4><p>The latest position has not been retrieved. Try this view again.</p><button class="btn" id="retryModule">Try again</button><details><summary>Request details</summary><p>'+escapeHtml(d.reason||d.error||e.message||"The request did not complete.")+'</p></details></section>';
      el("retryModule").onclick=()=>loadModule(key);
    }
  }finally{
    if(current())setBusy("");
  }
}
function kpi(label,value,sub=""){if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=planningShortDate(value);return'<div class="card kpi-card"><div class="kpi-label">'+escapeHtml(label)+'</div><div class="kpi-value">'+escapeHtml(fmt(value))+'</div><div class="kpi-sub">'+escapeHtml(sub)+'</div></div>'}
function evidenceCount(state,value,knownSubset){if(state==="established"&&value!==null&&value!==undefined)return fmt(value);if(typeof knownSubset==="number")return fmt(knownSubset)+" confirmed; full total not confirmed";if(state==="submitted_unparsed")return"Source submitted · count not confirmed";return"Unresolved"}
function renderDirector(d){
  if(!d){el("director").innerHTML='<div class="card"><div class="empty">Open a project to load its management detail.</div></div>';return}
  const s=d.schedule,c=d.claims,ctrl=d.controls;
  const programmeKpis=planningKpis([
    ["Data Date",s.dataDateIso,"current reporting programme"],
    ["Contract Completion",s.contractualCompletionIso||"Unresolved","governed contract date"],
    ["Further Adjusted Completion",s.officialAdjustedCompletionIso||"Unresolved","additional adjustment after the current contract basis"],
    ["Submitted Programme Finish",s.submittedProgrammeCompletionIso||"Unresolved","current programme"],
    ["Programme calendar recalculation",s.independentForecastCompletionIso||"Unresolved","submitted logic on its own calendars; not attributable delay"],
    ["Positive submitted window movement",c.observedProgrammeMovementDays===null||c.observedProgrammeMovementDays===undefined?"Unresolved":c.observedProgrammeMovementDays,"sum of positive submitted project-finish changes; not EOT"],
    ["Time-impact candidate",c.analyticalTimeImpactCandidateDays===null||c.analyticalTimeImpactCandidateDays===undefined?"Unresolved":c.analyticalTimeImpactCandidateDays,"analytical, not entitlement"],
    ["Attributable EOT candidate",c.attributableCandidateEotDays===null||c.attributableCandidateEotDays===undefined?"Unresolved":c.attributableCandidateEotDays,"analytical, not awarded"],
    ["Gross source-approved EOT",c.officialApprovedEotDays===null||c.officialApprovedEotDays===undefined?"Unresolved":c.officialApprovedEotDays,"dated determinations through DD; overlap and further adjustment require reconciliation"],
    ["Network calculation",s.independentCpmState==="established"?"Computed":"Unavailable","graph/calculation coverage only; source float and calendars require reconciliation"],
    ["Claims linked",c.claimCount===null||c.claimCount===undefined?"Unresolved":fmt(c.fullyLinkedClaimCount??0)+" / "+fmt(c.claimCount),"claim → event → activity"],
    ["LD Scenario",d.ld.cappedAmount===null||d.ld.cappedAmount===undefined?"Unresolved":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),humanizeKey(d.ld.state)]
  ]);
  let html='<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Available management position</h4><p>Established information is shown first. Measures needing more evidence are grouped separately and are never converted to zero.</p></div></div><div class="planning-panel-body">'+programmeKpis+'</div></section>';
  html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';
  (d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations · source aggregate",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention deducted through DD",r.retentionDeductedAmount],["Held balance",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line" title="'+escapeHtml(commercialFindingTitle(x[1]))+'"><span>'+x[0]+'</span><strong>'+escapeHtml(commercialFindingText(x[1]))+'</strong></div>').join("")+'</div>'});
  if(!(d.commercialByCurrency||[]).length)html+='<div class="empty">No governed commercial currency position is established.</div>';
  html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+
    '<div class="scalar"><b>Open HSE</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openHseIncidentCount))+'</span></div>'+
    '<div class="scalar"><b>Reported lost-time injuries</b><span>'+escapeHtml(d.sourceInterpretation?.hse?.metrics?.lostTimeInjuries??"Unresolved")+'</span></div>'+
    '<div class="scalar"><b>Major / critical NCR</b><span>'+escapeHtml(evidenceCount(ctrl.qualityEvidenceState,ctrl.openCriticalMajorNcrCount,ctrl.reporting?.knownCounts?.openCriticalMajorNcrCount))+'</span></div>'+
    '<div class="scalar"><b>Overdue RFI</b><span>'+escapeHtml(evidenceCount(ctrl.rfiEvidenceState,ctrl.overdueRfiCount))+'</span></div>'+
    '<div class="scalar"><b>Permit issues</b><span>'+escapeHtml(evidenceCount(ctrl.permitEvidenceState,ctrl.overduePermitCount))+'</span></div>'+
    '<div class="scalar"><b>Expiring bonds</b><span>'+escapeHtml(evidenceCount(ctrl.bondEvidenceState,ctrl.expiringBondCount30Days))+'</span></div>'+
    '<div class="scalar"><b>Open risks</b><span>'+escapeHtml(evidenceCount(ctrl.riskEvidenceState,ctrl.openRiskCount))+'</span></div>'+
    '</div></div></div>';
  el("director").innerHTML=html;
}
function renderStatus(o){
  const ready=o.moduleStates.filter(x=>x.status==="ready").length;
  const partial=o.moduleStates.filter(x=>x.status==="partial").length;
  const blocked=o.moduleStates.filter(x=>x.status==="blocked").length;
  const total=o.moduleStates.length;
  el("projectBadge").className="badge "+(o.demo?"partial":"");
  el("projectBadge").textContent=o.demo?"DEMONSTRATION PROJECT":"CURRENT PROJECT";
  el("projectStatus").innerHTML='<div class="scalar-grid">'+
    '<div class="scalar"><b>Baseline / revised baseline</b><span>'+fmt(o.baselineRevisionCount)+'</span></div>'+
    '<div class="scalar"><b>Updates</b><span>'+fmt(o.updateRevisionCount)+'</span></div>'+
    '<div class="scalar"><b>Recovery scenarios</b><span>'+fmt(o.recoveryRevisionCount)+'</span></div>'+
    '<div class="scalar"><b>Current Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+
    '<div class="scalar"><b>Project documents</b><span>'+fmt(o.evidenceDocumentCount)+'</span></div>'+
    '<div class="scalar"><b>Modules live</b><span>'+fmt(total)+' / '+fmt(total)+'</span></div>'+
    '<div class="scalar"><b>Listed readiness checks passed</b><span>'+ready+'</span></div>'+
    '<div class="scalar"><b>Views requiring review</b><span>'+partial+'</span></div>'+
    '<div class="scalar"><b>Blocked specialist views</b><span>'+blocked+'</span></div>'+
  '</div>';
}
function bindQueueRemoval(){
  document.querySelectorAll(".queue-remove").forEach(button=>{
    button.onclick=()=>{
      const type=button.dataset.type;
      const index=Number(button.dataset.index);
      if(!Number.isInteger(index)||index<0)return;
      if(type==="schedule"){scheduleSelection.splice(index,1);renderScheduleQueue()}
      if(type==="contract"){contractSelection.splice(index,1);renderContractQueue()}
      if(type==="boq"){boqSelection.splice(index,1);renderSimpleQueue("boqQueue",boqSelection,"boq")}
      if(type==="evidence"){evidenceSelection.splice(index,1);renderSimpleQueue("evidenceQueue",evidenceSelection,"evidence")}
    };
  });
}
function queueFileHtml(file){
  const full=fileDisplayName(file);
  const relative=file.webkitRelativePath&&file.webkitRelativePath!==file.name?file.webkitRelativePath:"";
  return '<div class="queue-file" title="'+escapeHtml(full)+'"><span class="queue-name">'+escapeHtml(file.name)+'</span>'+(relative?'<span class="queue-path">'+escapeHtml(relative)+'</span>':'')+'</div>';
}
function renderScheduleQueue(){
  el("scheduleQueue").innerHTML=scheduleSelection.map((file,i)=>{
    const full=fileDisplayName(file);
    const role=inferScheduleRole(file.name);
    return '<div class="queue-row">'+queueFileHtml(file)+'<div class="queue-role-control"><label>This programme is</label><select class="schedule-role" data-index="'+i+'" title="Select role for '+escapeHtml(full)+'"><option value="" selected>Choose programme purpose</option><option value="baseline" >Baseline</option><option value="update" >Update</option><option value="revised_baseline" >Revised baseline</option><option value="recovery" >Recovery</option><option value="scenario" >Draft / scenario</option></select></div><button class="queue-remove" data-type="schedule" data-index="'+i+'">Remove</button></div>';
  }).join("");
  bindQueueRemoval();
}
function renderContractQueue(){
  el("contractQueue").innerHTML=contractSelection.map((file,i)=>{
    const full=fileDisplayName(file);
    const role=inferContractRole(file.name);
    return '<div class="queue-row">'+queueFileHtml(file)+'<div class="queue-role-control"><label>This contract document is</label><select class="contract-role" data-index="'+i+'" title="Select role for '+escapeHtml(full)+'"><option value="main" '+(role==="main"?"selected":"")+'>Main contract</option><option value="amendment" '+(role==="amendment"?"selected":"")+'>Amendment</option><option value="appendix" '+(role==="appendix"?"selected":"")+'>Appendix</option><option value="tender" '+(role==="tender"?"selected":"")+'>Tender / Employer Requirements</option><option value="replacement" '+(role==="replacement"?"selected":"")+'>Replacement / Restated contract</option><option value="other" '+(role==="other"?"selected":"")+'>Other supporting document</option></select></div><button class="queue-remove" data-type="contract" data-index="'+i+'">Remove</button></div>';
  }).join("");
  bindQueueRemoval();
}
function renderSimpleQueue(target,files,type){
  el(target).innerHTML=files.map((file,i)=>'<div class="queue-row" style="grid-template-columns:minmax(260px,1fr) auto">'+queueFileHtml(file)+'<button class="queue-remove" data-type="'+type+'" data-index="'+i+'">Remove</button></div>').join("");
  bindQueueRemoval();
}
function markProjectPositionNeedsRefresh(message){
  if(overview){
    overview.lastRerunReceipt=null;
    updateActiveProjectShell();
  }
  el("globalStatus").textContent=message+" · project position needs refresh";
  if(el("projectBadge")){
    el("projectBadge").className="badge partial";
    el("projectBadge").textContent="POSITION NEEDS REFRESH";
  }
  if(el("projectStatus")){
    const existing=el("projectStatus").querySelector(".delete-refresh-warning");
    if(!existing){
      el("projectStatus").insertAdjacentHTML("afterbegin",'<div class="notice warn delete-refresh-warning">Project documents were changed. Choose <b>Update project position</b> when you are ready to recalculate the project.</div>');
    }
  }
}
async function deleteProjectDocument(documentId,filename){
  const ok=confirm('Delete "'+filename+'"?\n\nNothing is deleted unless you confirm this message. The document will be removed immediately; the full project position will refresh only when you choose Update project position.');
  if(!ok)return;
  setBusy("Deleting document");
  try{
    const result=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/documents/"+encodeURIComponent(documentId),{method:"DELETE"});
    selectedEvidenceDocuments.delete(documentId);
    if(overview){
      overview.evidenceDocumentCount=Math.max(0,(overview.evidenceDocumentCount||0)-1);
    }
    await loadEvidence();
    markProjectPositionNeedsRefresh('Deleted '+filename+(result.deleted?.replacementDocumentId?" · previous document restored as current":""));
  }catch(e){
    el("globalStatus").textContent="Document could not be deleted · "+e.message;
    await loadEvidence();
  }finally{setBusy("")}
}
function bindDocumentDeletion(){
  document.querySelectorAll(".document-delete-single").forEach(button=>{
    button.onclick=()=>deleteProjectDocument(button.dataset.documentId,button.dataset.filename);
  });
}
function syncEvidenceSelection(){
  const boxes=[...document.querySelectorAll(".evidence-select")];
  boxes.forEach(box=>{
    box.checked=selectedEvidenceDocuments.has(box.dataset.documentId);
  });
  const checked=boxes.filter(box=>box.checked);
  const selectAll=el("evidenceSelectAll");
  if(selectAll){
    selectAll.checked=boxes.length>0&&checked.length===boxes.length;
    selectAll.indeterminate=checked.length>0&&checked.length<boxes.length;
  }
  if(el("evidenceSelectedCount")){
    el("evidenceSelectedCount").textContent=checked.length+" selected";
  }
  if(el("deleteSelectedButton")){
    el("deleteSelectedButton").disabled=checked.length===0;
    el("deleteSelectedButton").textContent=checked.length?"Delete selected ("+checked.length+")":"Delete selected";
  }
}
function bindEvidenceSelection(){
  document.querySelectorAll(".evidence-select").forEach(box=>{
    box.onchange=()=>{
      if(box.checked)selectedEvidenceDocuments.add(box.dataset.documentId);
      else selectedEvidenceDocuments.delete(box.dataset.documentId);
      syncEvidenceSelection();
    };
  });
  if(el("evidenceSelectAll")){
    el("evidenceSelectAll").onchange=()=>{
      const checked=el("evidenceSelectAll").checked;
      document.querySelectorAll(".evidence-select").forEach(box=>{
        box.checked=checked;
        if(checked)selectedEvidenceDocuments.add(box.dataset.documentId);
        else selectedEvidenceDocuments.delete(box.dataset.documentId);
      });
      syncEvidenceSelection();
    };
  }
  if(el("deleteSelectedButton")){
    el("deleteSelectedButton").onclick=deleteSelectedDocuments;
  }
  syncEvidenceSelection();
}
async function deleteSelectedDocuments(){
  const selected=[...document.querySelectorAll(".evidence-select:checked")];
  if(!selected.length)return;
  const ids=selected.map(box=>box.dataset.documentId);
  const names=selected.map(box=>box.dataset.filename);
  const preview=names.slice(0,6).map(name=>"• "+name).join("\n");
  const more=names.length>6?"\n• … and "+(names.length-6)+" more":"";
  const ok=confirm("Delete "+names.length+" selected document"+(names.length===1?"":"s")+"?\n\n"+preview+more+"\n\nThe documents will be removed in one action. The full project position will refresh only when you choose Update project position.");
  if(!ok)return;
  setBusy("Deleting "+names.length+" documents");
  try{
    const result=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/documents/delete",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({documentIds:ids})
    });
    selectedEvidenceDocuments.clear();
    if(overview){
      overview.evidenceDocumentCount=Math.max(0,(overview.evidenceDocumentCount||0)-(result.deletedCount||ids.length));
    }
    await loadEvidence();
    markProjectPositionNeedsRefresh((result.deletedCount||ids.length)+" documents deleted");
  }catch(e){
    el("globalStatus").textContent="Selected documents could not be deleted · "+e.message;
    await loadEvidence();
  }finally{setBusy("")}
}
async function loadEvidence(){
  const requestSeq=++evidenceRequestSeq,projectId=project(),projectSeq=projectRequestSeq;
  const current=()=>requestSeq===evidenceRequestSeq&&projectRequestIsCurrent(projectId,projectSeq);
  if(!projectId){
    selectedEvidenceDocuments.clear();
    el("evidenceBadge").textContent="Documents not loaded";
    el("evidenceLibrary").innerHTML='<div class="empty">Open a project to load its documents.</div>';
    return;
  }
  try{
    const data=await api("/api/projects/"+encodeURIComponent(projectId)+"/evidence/documents",{headers:{"x-cmeng-async-view":"1"}});
    if(!current())return;
    if(data.processing){el("evidenceBadge").textContent="Updating documents";el("evidenceLibrary").innerHTML='<div class="notice info" role="status">'+escapeHtml(data.message)+'</div>';return;}
    if(projectLoadState==="updating")el("activeProjectMeta").textContent=data.documentCount+" saved documents · Calculating project position";
    const liveIds=new Set((data.documents||[]).map(document=>document.documentId));
    selectedEvidenceDocuments=new Set([...selectedEvidenceDocuments].filter(id=>liveIds.has(id)));
    el("evidenceBadge").className="badge "+(data.documentCount?"ready":"");
    el("evidenceBadge").textContent=data.documentCount+" documents";
    if(!data.documentCount){
      selectedEvidenceDocuments.clear();
      el("evidenceLibrary").innerHTML='<div class="empty">No project documents have been added yet.</div>';
      return;
    }
    const guide='<div class="document-state-guide"><h4>How to read these document statuses</h4><div class="document-state-grid">'+
      '<div class="document-state-item"><b>Current / used now</b><span>This is the current controlling document for its document family. Schedule support registers are labelled separately as supporting records.</span></div>'+
      '<div class="document-state-item"><b>Previous version</b><span>Retained for audit and comparison, but no longer current.</span></div>'+
      '<div class="document-state-item"><b>Needs review before current</b><span>CMeng retained it, but has not promoted it to the current basis.</span></div>'+
      '<div class="document-state-item"><b>Adds to current record</b><span>It supplements the current base, such as an amendment or variation; it does not replace it.</span></div>'+
      '<div class="document-state-item"><b>Reference only</b><span>Retained as background/history and not used as the current controlling basis.</span></div>'+
      '<div class="document-state-item"><b>Scenario only</b><span>Used for an alternative scenario, such as a recovery programme, without replacing the current programme.</span></div>'+
      '<div class="document-state-item"><b>Reading result</b><span>Page, row and summary receipts show what has been read. Reading is separate from validation, mapping and adoption. Pages need review means some pages remain unresolved. Full OCR required means no completed full-page receipt is available yet.</span></div>'+
    '</div></div>';
    const bulkBar='<div class="evidence-bulk-bar"><label><input type="checkbox" class="evidence-select-all" id="evidenceSelectAll"> Select all</label><span class="evidence-bulk-count" id="evidenceSelectedCount">0 selected</span><span class="bulk-spacer"></span><button class="document-delete" id="deleteSelectedButton" disabled>Delete selected</button></div>';
    el("evidenceLibrary").innerHTML=guide+bulkBar+'<div class="table-wrap"><table><thead><tr><th class="select-col"></th><th>Full document name</th><th>Last uploaded / updated</th><th>Document type</th><th>How CMeng uses it</th><th>Effect on current record</th><th>CMeng confidence</th><th>Read from</th><th>Document conflict</th><th>Reading result</th><th>Programme role</th><th>Activity links</th><th></th></tr></thead><tbody>'+data.documents.map(d=>{
      const m=d.mapping;
      const i=d.identification||{};
      const mapping=m?.message||(!m||m.linkedActivityCount===null?"No linkage column supplied":fmt(m.mappedActivityCount)+" / "+fmt(m.linkedActivityCount)+(m.coveragePercent===null?"":" ("+fmt(m.coveragePercent)+"%)"));
      const confidence=i.confidence===undefined?"—":fmt(i.confidence*100)+"%";
      const conflict=i.classificationConflict||d.classificationReview?.reviewRequired?"Review required":"No";
      const method=d.readReview?.method||(i.method||"—")+(i.ocrUsed?" / OCR":"");
      const title=i.detectedTitle?'<br><span class="muted">'+escapeHtml(i.detectedTitle)+'</span>':"";
      const full=d.sourceRelativePath||d.sourceFilename;
      const position=documentUseLabel(d.basisState||"historical",d);
      const positionClass=d.basisState==="active"?"ready":d.basisState==="candidate"?"partial":"";
      const readLabel=d.readReview?.label||documentReadLabel(d.parserState);
      const readNote=d.readReview?.note||documentReadNote(d.parserState);
      const checked=selectedEvidenceDocuments.has(d.documentId)?" checked":"";
      const adopt=d.category==="schedule"&&d.linkedArtifactId&&!["recovery","scenario"].includes(d.scheduleRole)&&!(d.basisState==="active"&&d.scheduleAdoption?.method==="explicit")?'<button class="btn small adopt-programme" data-revision="'+escapeHtml(d.linkedArtifactId)+'">'+(['baseline','revised_baseline'].includes(d.scheduleRole)?'Adopt as baseline':'Adopt as current')+'</button>':"";
      return '<tr><td class="select-col"><input type="checkbox" class="evidence-select" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'"'+checked+'></td><td class="document-file" title="'+escapeHtml(full)+'"><b>'+escapeHtml(d.sourceFilename)+'</b><span class="muted">'+escapeHtml(full)+'</span></td><td class="document-updated" title="'+escapeHtml(d.uploadedAt||"")+'"><b>'+escapeHtml(formatDocumentTime(d.uploadedAt))+'</b><small>'+escapeHtml(d.uploadedAt||"—")+'</small></td><td><b>'+escapeHtml(humanizeKey(d.classificationReview?.category||d.category))+'</b><br>'+escapeHtml(humanizeKey(d.classificationReview?.documentType||d.documentType))+(d.classificationReview?.reviewRequired?'<br><span class="badge partial">Stored as '+escapeHtml(humanizeKey(d.documentType))+' · mapping review required</span>':'')+title+'</td><td class="document-position"><span class="badge '+positionClass+'">'+escapeHtml(position)+'</span></td><td>'+escapeHtml(humanizeKey(d.lineage?.effect||"unknown"))+(d.lineage?.replacesEntireBasis?'<br><span class="badge partial">replaces current document</span>':d.lineage?.appliesAsDelta?'<br><span class="badge">additional record</span>':'')+'</td><td>'+escapeHtml(confidence)+(i.needsReview?'<br><span class="badge partial">review</span>':'')+'</td><td>'+escapeHtml(humanizeKey(method))+'</td><td>'+escapeHtml(conflict)+'</td><td title="'+escapeHtml(readNote)+'"><b>'+escapeHtml(readLabel)+'</b><br><span class="muted">'+escapeHtml(readNote)+'</span></td><td>'+escapeHtml(d.scheduleRole?humanizeKey(d.scheduleRole):"—")+'</td><td>'+escapeHtml(mapping)+'</td><td>'+adopt+(d.category==='schedule'&&!d.scheduleAdoption&&!['active','superseded'].includes(d.basisState)?'<button class="btn small programme-purpose" data-document-id="'+escapeHtml(d.documentId)+'">Review programme purpose</button>':'')+(d.category!=='schedule'?'<button class="btn small document-relationship" data-document-id="'+escapeHtml(d.documentId)+'">Review relationship</button>':'')+'<button class="document-delete document-delete-single" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'">Delete</button></td></tr>';
    }).join("")+'</tbody></table></div>';
    el('evidenceLibrary').querySelectorAll('.document-relationship').forEach(button=>button.onclick=()=>{
      const d=data.documents.find(d=>d.documentId===button.dataset.documentId),container=button.parentElement;
      const targets=data.documents.filter(x=>x.documentId!==d.documentId&&['active','additive'].includes(x.basisState));
      container.innerHTML='<label>Document relationship<select class="relationship-kind"><option value="new_record">New independent record</option><option value="replacement">Corrects / replaces an existing record</option><option value="amendment">Amends the base contract</option></select></label><label>Previous / parent document<select class="relationship-target"><option value="">No parent for a new record</option>'+targets.map(x=>'<option value="'+escapeHtml(x.documentId)+'">'+escapeHtml(x.sourceFilename)+' · '+escapeHtml(x.documentType)+'</option>').join('')+'</select></label><label>Reason / source reference<input class="relationship-note"></label><button class="btn small relationship-save">Save relationship and refresh</button><div class="relationship-error" role="status"></div>';
      container.querySelector('.relationship-save').onclick=async()=>{try{await api('/api/projects/'+encodeURIComponent(projectId)+'/evidence/documents/'+encodeURIComponent(d.documentId)+'/relationship',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:data.projectVersion??overview.version,sourceHash:d.sourceHashSha256,kind:container.querySelector('.relationship-kind').value,targetDocumentId:container.querySelector('.relationship-target').value||null,note:container.querySelector('.relationship-note').value})});if(project()===projectId)await refresh(false);}catch(e){container.querySelector('.relationship-error').textContent=e.message;}};
    });
    el('evidenceLibrary').querySelectorAll('.programme-purpose').forEach(button=>button.onclick=()=>{const d=data.documents.find(d=>d.documentId===button.dataset.documentId);editProgrammePurpose(button.parentElement,projectId,d.linkedArtifactId,d.sourceHashSha256,data.projectVersion,d.scheduleRole,d.scheduleApprovalReference);});
    bindDocumentDeletion();
    bindEvidenceSelection();
    el("evidenceLibrary").querySelectorAll(".adopt-programme").forEach(button=>button.onclick=async()=>{
      const selectedProject=projectId,revision=button.dataset.revision;button.disabled=true;
      try{await api("/api/projects/"+encodeURIComponent(selectedProject)+"/schedule/revisions/"+encodeURIComponent(revision)+"/adopt",{method:"POST"});if(project()===selectedProject)await refresh(false);}
      catch(error){button.disabled=false;button.title=error.message;el("evidenceBadge").textContent="Programme not adopted: "+error.message;}
    });
  }catch(e){
    if(!current())return;
    el("evidenceLibrary").innerHTML='<div class="notice warn">Document register could not be loaded: '+escapeHtml(e.message)+'</div>';
  }
}
function positionText(p){
  if(p.positionState==="updating")return["review","Updating project position"];
  if(p.positionState==="checking")return["review","Checking current position"];
  if(p.positionState==="current")return["current","Current position"];
  if(p.positionState==="needs_review")return["review","Review required"];
  return["missing","Needs project records"];
}
function projectCard(p){
  const [positionClass,positionLabel]=positionText(p);
  const forecast=p.forecastCompletionIso?planningShortDate(p.forecastCompletionIso):"Unresolved";
  const official=p.officialCompletionIso?planningShortDate(p.officialCompletionIso):"Unresolved";
  const movement=p.programmeMovementDays===null||p.programmeMovementDays===undefined?"Unresolved":fmt(p.programmeMovementDays)+" days";
  const claims=p.claimCount===null||p.claimCount===undefined?"Unresolved":fmt(p.claimCount)+" claim"+(p.claimCount===1?"":"s");
  const eot=p.approvedEotDays===null||p.approvedEotDays===undefined?"Source-approved EOT not confirmed":fmt(p.approvedEotDays)+" gross source-approved days through DD; further adjustment not inferred";
  const forecastLabel=p.forecastLabel||"Productivity forecast";
  const contractLabel=p.officialCompletionIso?(p.contractualCompletionState==="established"?"Official contract: ":"Contract source / review: ")+official:"Contract completion unresolved";
  const adjustmentLabel=p.furtherAdjustedCompletionIso?"Further adjusted: "+planningShortDate(p.furtherAdjustedCompletionIso):"Further adjustment not confirmed";
  const managementCount=p.managementActionCount===null||p.managementActionCount===undefined?null:p.managementActionCount;
  const attention=p.analysisError||(p.managementActions||[])[0]||(
    p.positionState==="needs_information"
      ?"Add the core programme and BOQ records to establish the current position."
      :p.positionState==="needs_review"
        ?"Update the project position using the latest project records."
        :"No immediate management action identified."
  );
  const attentionClass=(managementCount||0)>0||p.positionState!=="current"?"project-attention":"project-attention no-action";
  return '<article class="portfolio-project">'+
    '<div class="portfolio-project-main">'+
      '<div class="portfolio-project-title"><h3>'+escapeHtml(p.projectId)+'</h3>'+
        '<div class="project-meta">'+escapeHtml(p.latestDataDateIso?planningShortDate(p.latestDataDateIso):"No current data date")+' · '+escapeHtml(p.revisionCount??"Unresolved")+' programme revision'+(p.revisionCount===1?"":"s")+' · '+escapeHtml(p.evidenceDocumentCount??"Unresolved")+' documents</div>'+
        '<span class="position-chip '+positionClass+'">'+positionLabel+'</span></div>'+
      '<div class="portfolio-project-metric"><span>'+escapeHtml(forecastLabel)+'</span><strong>'+escapeHtml(forecast)+'</strong><small>'+escapeHtml(contractLabel)+'</small><small>'+escapeHtml(adjustmentLabel)+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Project completion movement</span><strong>'+escapeHtml(movement)+'</strong><small>Net first-to-latest controlled completion movement</small></div>'+
      '<div class="portfolio-project-metric"><span>Claims / EOT</span><strong>'+escapeHtml(claims)+'</strong><small>'+escapeHtml(eot)+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Management</span><strong>'+escapeHtml(managementCount===null?"Unresolved":fmt(managementCount)+" action"+(managementCount===1?"":"s"))+'</strong><small>'+escapeHtml(p.commercialCurrencyCount===null||p.commercialCurrencyCount===undefined?"Commercial position unresolved":p.commercialCurrencyCount?fmt(p.commercialCurrencyCount)+" commercial currenc"+(p.commercialCurrencyCount===1?"y":"ies"):"No commercial position")+'</small></div>'+
      '<div class="portfolio-project-open"><button class="btn small open-project" data-project="'+escapeHtml(p.projectId)+'">Open project</button></div>'+
    '</div>'+
    '<div class="'+attentionClass+'"><b>Attention</b><span>'+escapeHtml(attention)+'</span></div>'+
  '</article>';
}
function bindProjectOpeners(){
  document.querySelectorAll(".open-project").forEach(button=>button.onclick=()=>openProject(button.dataset.project));
}
function bindPortfolioEmptyActions(){
  document.querySelectorAll(".portfolio-create-project").forEach(button=>button.onclick=()=>setAppView("projects"));
  document.querySelectorAll(".portfolio-open-sample").forEach(button=>button.onclick=()=>{setAppView("projects");loadDemo()});
}
function renderPortfolio(){
  const data=portfolioData||{projects:[],projectCount:0};
  const projects=data.projects||[];
  const current=projects.filter(p=>p.positionState==="current").length;
  const checking=projects.filter(p=>p.positionState==="checking"||p.positionState==="updating").length;
  const attention=projects.filter(p=>p.positionState!=="current"||(p.managementActionCount||0)>0).length;
  const docs=projects.some(p=>p.evidenceDocumentCount===null||p.evidenceDocumentCount===undefined)?"Unresolved":projects.reduce((sum,p)=>sum+p.evidenceDocumentCount,0);

  el("portfolioStats").innerHTML=[
    ["▣",data.projectCount||0,"Live projects","User projects in this portfolio"],
    ["▥",current,"Current positions",checking?checking+" project"+(checking===1?"":"s")+" being checked or updated":"Position updated and certified"],
    ["△",attention,"Need attention","Projects requiring management review"],
    ["▤",docs,"Project documents","Documents registered across live projects"]
  ].map(x=>'<div class="summary-metric"><span class="summary-icon">'+escapeHtml(x[0])+'</span><b>'+escapeHtml(x[1])+'</b><span>'+escapeHtml(x[2])+'</span><small>'+escapeHtml(x[3])+'</small></div>').join("");

  if(!projects.length){
    el("portfolioProjects").innerHTML=
      '<div class="portfolio-empty"><div class="portfolio-empty-mark">+</div><div><h3>No live projects yet</h3><p>Create your first project, add the programme and BOQ, then update the project position. The sample project remains available separately for familiarisation.</p></div><div class="portfolio-empty-actions"><button class="btn primary portfolio-create-project">Create project</button><button class="btn portfolio-open-sample">Open sample</button></div></div>';
    el("portfolioAttention").innerHTML="";
    el("projectRegister").innerHTML='<div class="empty">No live projects have been created.</div>';
    bindPortfolioEmptyActions();
    return;
  }

  el("portfolioProjects").innerHTML=projects.map(projectCard).join("");

  const attentionRows=projects.flatMap(p=>(p.managementActions||[]).slice(0,2).map(action=>({projectId:p.projectId,action})));
  el("portfolioAttention").innerHTML=attentionRows.length
    ?'<section class="portfolio-attention"><div class="portfolio-attention-head"><h3>Portfolio attention</h3><span class="badge partial">'+escapeHtml(attentionRows.length)+' action'+(attentionRows.length===1?"":"s")+'</span></div>'+attentionRows.map(item=>'<div class="attention-row"><b>'+escapeHtml(item.projectId)+'</b><span>'+escapeHtml(item.action)+'</span><button class="btn small open-project" data-project="'+escapeHtml(item.projectId)+'">Open</button></div>').join("")+'</section>'
    :"";

  el("projectRegister").innerHTML='<div class="table-wrap"><table><thead><tr><th>Project</th><th>Data date</th><th>Documents</th><th>Programme revisions</th><th>Current position</th><th>Management actions</th><th></th></tr></thead><tbody>'+projects.map(p=>{const position=positionText(p)[1];return'<tr><td><b>'+escapeHtml(p.projectId)+'</b></td><td>'+escapeHtml(p.latestDataDateIso?planningShortDate(p.latestDataDateIso):"—")+'</td><td>'+escapeHtml(p.evidenceDocumentCount??"Unresolved")+'</td><td>'+escapeHtml(p.revisionCount??"Unresolved")+'</td><td>'+escapeHtml(position)+'</td><td>'+escapeHtml(p.managementActionCount??"Unresolved")+'</td><td><button class="btn small open-project" data-project="'+escapeHtml(p.projectId)+'">Open</button></td></tr>'}).join("")+'</tbody></table></div>';

  bindProjectOpeners();
}
async function loadPortfolio(){
  try{portfolioData=await api("/api/portfolio");renderPortfolio()}catch(e){el("portfolioProjects").innerHTML='<div class="notice error">Projects could not be loaded: '+escapeHtml(e.message)+'</div>'}
}
function updateActiveProjectShell(){
  const id=overview?.projectId||project();
  const pending=projectLoadState==="loading"||projectLoadState==="updating";
  const unloaded=pending?"Loading project information…":id?"Project information could not be loaded":"Open a project from Portfolio or Projects";
  const displayDataDate=overview?.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"No data date";
  if(appView==="project"||appView==="ai")el("platformContextTitle").textContent=id;
  el("topbarModule").textContent=appView==="ai"?"Ask CMeng":names[selected]||"Project Controls";
  el("activeProjectName").textContent=id||"No project selected";
  el("activeProjectMeta").textContent=overview?(displayDataDate+" · "+overview.evidenceDocumentCount+" project documents"+(overview.releaseCommitSha?" · Release "+overview.releaseCommitSha.slice(0,7):"")):unloaded;
  el("workspaceProjectMeta").textContent=overview?(id+" · Data Date "+displayDataDate+(overview.releaseCommitSha?" · Release "+overview.releaseCommitSha.slice(0,7):" · Release not supplied")):id+" · "+unloaded;
  el("aiProjectBadge").className="badge";
  el("aiProjectBadge").textContent=id||"No active project";
  el("aiProjectInfo").innerHTML=overview?'<b>'+escapeHtml(id)+'</b><br>'+escapeHtml(overview.evidenceDocumentCount)+' evidence documents<br>'+escapeHtml(overview.revisionCount)+' schedule revisions<br>'+escapeHtml(overview.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"No current data date"):escapeHtml(unloaded);
  ["runAnalysisTop","askAi","openAiTop"].forEach(key=>{el(key).disabled=!overview});
  el("openLibraryQuick").disabled=!project();el("openEvidenceTop").disabled=!overview;
}
function setAppView(view){
  if(view==="ai"&&(!overview||overview.projectId!==project())){view="projects";el("createProjectMessage").textContent="Open a project to ask about its documents, calculations and current position.";}
  appView=view;
  ["portfolio","projects","ai"].forEach(name=>{el(name+"View").hidden=view!==name});
  const projectView=view==="project"||view==="ai";
  el("projectWorkspace").hidden=!projectView;
  el("projectModulePanel").hidden=view!=="project";
  document.body.classList.toggle("project-active",projectView&&!!project());
  const titles={portfolio:"Portfolio",projects:"Projects",ai:project(),project:project()||"Project Controls"};
  el("platformContextTitle").textContent=titles[view]||"CMeng";
  renderPlatformNav();
  renderNav();
  if(view==="portfolio"||view==="projects")loadPortfolio();
  if(projectView)updateActiveProjectShell();
  if(view==="ai")loadAskHome();
  window.scrollTo({top:0,behavior:"smooth"});
}
function projectRequestIsCurrent(projectId,requestSeq){
  return projectId===project()&&requestSeq===projectRequestSeq;
}
function clearProjectWorkspace(projectId){
  // Invalidate every read before changing the visible project. An older response
  // must remain obsolete even if the user switches A → B → A.
  projectRequestSeq++;moduleRequestSeq++;directorRequestSeq++;evidenceRequestSeq++;aiRequestSeq++;
  resetAskWorkspace();
  if(el('phaseProgrammesPanel'))el('phaseProgrammesPanel').innerHTML='';
  for(const id of ['schedulePhase','scheduleApproval'])if(el(id))el(id).value='';
  if(el('scheduleScope'))el('scheduleScope').value='project';
  overview=null;currentModuleResult=null;projectLoadState="loading";
  resetProjectActions();
  if(el('projectReviewDrawer')){el('projectReviewDrawer').open=false;el('projectReviewDrawer').hidden=true;}
  if(el('projectReviewPanel'))el('projectReviewPanel').innerHTML='';
  selectedEvidenceDocuments.clear();
  scheduleSelection=[];boqSelection=[];contractSelection=[];evidenceSelection=[];
  ["scheduleFiles","boqFiles","contractFiles","evidenceFiles","aiQuestion"].forEach(id=>{el(id).value=""});
  ["scheduleQueue","boqQueue","contractQueue","evidenceQueue","uploadMessage"].forEach(id=>{el(id).innerHTML=""});
  ["evidenceControlDrawer","evidenceLibraryDrawer","directorDrawer"].forEach(id=>{el(id).open=false});
  el("directorDrawer").hidden=true;
  document.body.classList.remove("visual-panel-open","chart-canvas-open");
  document.querySelectorAll(".visual-focus,.chart-focus").forEach(node=>node.classList.remove("visual-focus","chart-focus"));
  el("projectStatus").textContent="Loading project information…";
  el("director").textContent="Loading management detail…";
  el("evidenceBadge").className="badge";
  el("evidenceBadge").textContent="Documents not loaded";
  el("evidenceLibrary").textContent="Loading project documents…";
  el("aiAnswer").textContent="Wait for this project to finish loading, then ask about its position.";
  el("roleViewSelector").style.display="none";
  el("moduleReport").disabled=true;
  el("moduleBadge").className="badge";
  el("moduleBadge").textContent="Opening project";
  el("moduleTitle").textContent=names[selected]||"Project Controls";
  el("moduleSubtitle").textContent=descriptions[selected]||"Current position, key changes and actions requiring attention.";
  el("topbarModule").textContent=names[selected]||"Project Controls";
  el("moduleContent").innerHTML='<div class="view-state-bar" role="status"><span class="spinner"></span><strong>Opening '+escapeHtml(projectId)+'</strong><span>Loading the current project position.</span></div>';
  updateActiveProjectShell();
}
async function openProject(projectId){
  projectId=String(projectId||"").trim();
  if(!projectId)return;
  el("projectId").value=projectId;
  localStorage.setItem("cmeng-project",projectId);
  clearProjectWorkspace(projectId);
  appView="project";
  setAppView("project");
  el("projectBadge").className="badge";
  el("projectBadge").textContent="OPENING PROJECT";
  await refresh(false);
}
async function createProject(){
  const projectId=el("newProjectId").value.trim();
  if(!projectId){el("createProjectMessage").innerHTML='<div class="notice warn">Enter a project ID or code.</div>';return}
  setBusy("Creating project");
  try{
    const created=await api("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId})});
    el("newProjectId").value=created.projectId;
    el("createProjectMessage").innerHTML='<div class="notice info">Project '+escapeHtml(created.projectId)+' created. Opening project controls...</div>';
    await loadPortfolio();
    await openProject(created.projectId);
  }catch(e){
    const duplicate=e.status===409&&e.data?.error==="project_code_already_exists";
    el("createProjectMessage").innerHTML='<div class="notice '+(duplicate?"warn":"error")+'">'+escapeHtml(e.message)+'</div>';
  }finally{setBusy("")}
}
async function runAnalysis(){
  if(!overview){setAppView("projects");return}
  const projectId=project(),projectSeq=projectRequestSeq;
  const current=()=>projectRequestIsCurrent(projectId,projectSeq);
  setBusy("Updating project position");
  try{
    const receipt=await api("/api/projects/"+encodeURIComponent(projectId)+"/evidence/rerun",{method:"POST"});
    if(!current())return;
    el("globalStatus").textContent=receipt.certification.state==="pass"?"Project position updated":"Project position needs review";
    await refresh(false);
  }catch(e){
    if(!current())return;
    const d=e.data||{};
    el("globalStatus").textContent=d.certification?"Project position needs review":"Project position could not be updated · "+e.message;
    if(d.certification){await refresh(false)}
  }finally{if(project()===projectId)setBusy("")}
}
function editProgrammePurpose(container,projectId,revisionId,sourceHash,version,role,approval,phaseId){
  container.innerHTML='<label>Programme purpose<select class="purpose-role">'+[['baseline','Approved baseline'],['update','Progress update'],['revised_baseline','Approved revised baseline'],['recovery','Recovery plan'],['scenario','Draft / scenario']].map(r=>'<option value="'+r[0]+'" '+(r[0]===role?'selected':'')+'>'+r[1]+'</option>').join('')+'</select></label><label>Baseline approval reference<input class="purpose-approval" value="'+escapeHtml(approval||'')+'"></label><button class="btn small purpose-save">Save purpose</button><p class="purpose-message" role="status">Saving the purpose leaves the programme awaiting adoption.</p>';
  container.querySelector('.purpose-save').onclick=async()=>{try{await api('/api/projects/'+encodeURIComponent(projectId)+(phaseId?'/phases/'+encodeURIComponent(phaseId):'')+'/schedule/revisions/'+encodeURIComponent(revisionId)+'/purpose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,sourceHash,role:container.querySelector('.purpose-role').value,approvalReference:container.querySelector('.purpose-approval').value})});if(project()===projectId)await refresh(false);}catch(e){container.querySelector('.purpose-message').textContent=e.message;}};
}
async function loadPhaseProgrammes(){
  const target=el('phaseProgrammesPanel');if(!target)return;const id=project(),seq=projectRequestSeq;const current=()=>projectRequestIsCurrent(id,seq);
  try{const data=await api('/api/projects/'+encodeURIComponent(id)+'/phases');if(!current())return;
    target.innerHTML=data.phases.map(p=>'<details class="ask-evidence"><summary>'+escapeHtml(p.phaseId)+' · '+escapeHtml(p.review.state)+'</summary><p>Phase Data Date: '+escapeHtml(p.programme?.dataDate||'Not established')+'. Whole-project authority is unchanged.</p>'+p.revisions.map(r=>'<p>'+escapeHtml(r.filename)+' · '+escapeHtml(r.role)+' · '+escapeHtml(r.dataDate||'No Data Date')+(r.adopted?' · adopted':'')+(r.canReview?'<button class="btn small phase-purpose" data-phase="'+escapeHtml(p.phaseId)+'" data-revision="'+escapeHtml(r.revisionId)+'">Review purpose</button>':'')+'</p>').join('')+p.review.pendingSchedules.map(r=>'<button class="btn small phase-adopt" data-action="'+escapeHtml(r.actionPath)+'" '+(r.canAdopt?'':'disabled')+'>Adopt '+escapeHtml(r.filename)+' for '+escapeHtml(p.phaseId)+'</button>').join('')+'</details>').join('');
    target.querySelectorAll('.phase-purpose').forEach(button=>button.onclick=()=>{const p=data.phases.find(p=>p.phaseId===button.dataset.phase),r=p.revisions.find(r=>r.revisionId===button.dataset.revision);editProgrammePurpose(button.parentElement,id,r.revisionId,r.sourceHash,p.projectVersion,r.role,r.approvalReference,p.phaseId);});
    target.querySelectorAll('.phase-adopt').forEach(button=>button.onclick=async()=>{try{await api(button.dataset.action,{method:'POST'});if(project()===id)await refresh(false);}catch(e){if(project()===id)el('uploadMessage').textContent=e.message;}});
  }catch(e){if(current())target.textContent='Phase programmes could not be loaded: '+e.message;}
}
async function afterEvidenceChange(){
  selected='master-dashboard';localStorage.setItem('cmeng-module',selected);setAppView('project');
  if(el("runAfterUpload")?.checked){await runAnalysis()}else{await refresh(false)}
}
${askAiScript}
let directorRequestSeq=0;
async function loadDirector(projectId=project(),attempt=0){
  const requestSeq=++directorRequestSeq;
  const projectSeq=projectRequestSeq;
  const current=()=>requestSeq===directorRequestSeq&&projectRequestIsCurrent(projectId,projectSeq);
  el("director").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Loading management detail</strong></div>';
  try{
    const position=await api("/api/projects/"+encodeURIComponent(projectId)+"/director-position");
    if(!current())return;
    renderDirector(position);
  }catch(e){
    if(!current())return;
    const currentOverview=typeof overview!=="undefined"?overview:null;
    const programmeEstablished=currentOverview?.minimumEvidenceBasis?.schedule?.established===true;
    if(e.status===404&&programmeEstablished&&attempt<4){
      el("director").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Updating management position</strong><span>The project documents are loaded; the management position is being rebuilt from the current evidence.</span></div>';
      setTimeout(()=>{if(current())loadDirector(projectId,attempt+1)},600);
      return;
    }
    if(e.status===404&&!programmeEstablished){
      el("director").innerHTML='<div class="notice warn"><b>Management position not established.</b> A current programme must be established before CMeng can calculate the integrated management position.</div>';
      return;
    }
    el("director").innerHTML='<div class="notice error">CMeng could not load management detail: '+escapeHtml(e.message)+'. This is a loading failure; it does not establish missing project evidence. <button class="btn small" id="retryDirector">Retry management detail</button></div>';
    el("retryDirector").onclick=()=>loadDirector(projectId);
  }
}
function showProjectUpdating(projectId,documentCount=null,message="Documents saved · calculating the project position"){
  if(project()!==projectId)return;
  overview=null;currentModuleResult=null;projectLoadState="updating";
  updateActiveProjectShell();renderNav();
  el("projectStatus").textContent=message;
  el("projectBadge").className="badge partial";el("projectBadge").textContent="UPDATING";
  el("moduleBadge").textContent="Calculating";el("moduleReport").disabled=true;
  el("moduleContent").innerHTML='<div class="view-state-bar" role="status"><span class="spinner"></span><strong>'+escapeHtml(message)+'</strong><span>You can review Documents or work in another project. This page updates automatically when the calculation finishes.</span></div>';
  el("director").textContent="Management calculations are updating.";
  el("activeProjectMeta").textContent=(documentCount===null?"Document count updating":documentCount+" saved documents")+" · Calculating project position";
  setBusy("Calculating project position");
}
async function refresh(bootstrapDemo=true){
  setBusy("Refreshing project");
  const projectId=project();
  const requestSeq=++projectRequestSeq;
  const current=()=>projectRequestIsCurrent(projectId,requestSeq);
  try{
    let loadedOverview;
    do{
      loadedOverview=await api("/api/projects/"+encodeURIComponent(projectId)+"/overview",{headers:{"x-cmeng-async-view":"1"}});
      if(!current())return;
      if(loadedOverview.state!=="updating")break;
      showProjectUpdating(projectId,loadedOverview.documentCount,loadedOverview.message);
      await loadEvidence();
      if(!current())return;
      await new Promise(resolve=>setTimeout(resolve,2000));
      if(!current())return;
    }while(true);
    if(!current())return;
    if(loadedOverview.projectId!==projectId)throw new Error("The returned information belongs to a different project.");
    overview=loadedOverview;
    projectLoadState="ready";
    localStorage.setItem("cmeng-project",projectId);
    try{renderStatus(overview)}catch{}
    updateActiveProjectShell();
    renderNav();
    await Promise.allSettled([
      loadModule(selected),
      loadEvidence(),
      loadPhaseProgrammes(),
      loadDirector(projectId)
    ]);
    if(current())await loadProjectActions();
  }catch(e){
    if(!current())return;
    if(bootstrapDemo&&e.status===404&&projectId==="UAT-DEMO"){
      try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});return await refresh(false)}catch{}
    }
    overview=null;
    currentModuleResult=null;projectLoadState="error";
    updateActiveProjectShell();
    renderNav();
    try{renderDirector(null)}catch{}
    el("projectStatus").textContent="Project information could not be loaded. Try opening the project again.";
    el("projectBadge").className="badge blocked";
    el("projectBadge").textContent="NOT LOADED";
    el("moduleBadge").textContent="Not loaded";
    el("moduleReport").disabled=true;
    el("moduleContent").innerHTML='<section class="notice error" role="alert"><h4>Unable to open '+escapeHtml(projectId)+'</h4><p>Project information could not be loaded. Try again.</p><button class="btn" id="retryProject">Try again</button></section>';
    el("retryProject").onclick=()=>openProject(projectId);
    el("evidenceBadge").textContent="Documents not loaded";
    el("evidenceLibrary").textContent="Project documents could not be loaded.";
  }finally{
    if(current())setBusy("");
  }
}
async function loadDemo(){setBusy("Loading demonstration project");try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});selected="pmo-analysis";await openProject("UAT-DEMO");el("uploadMessage").innerHTML='<div class="notice info">Demonstration project loaded. Your own projects are not changed.</div>'}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
${uploadWorkScript}
function uploadEvidenceFileWithProgress(file,fileIndex,fileTotal,job){
  return new Promise((resolve,reject)=>{
    const id=uploadId();
    const url="/api/projects/"+encodeURIComponent(job.projectId)+(job.kind==="schedule"?(job.programmeScope==="phase"?"/phases/"+encodeURIComponent(job.phaseId)+"/schedule/uploads":"/schedule/uploads"):"/evidence/uploads");
    const xhr=new XMLHttpRequest();
    let lastServerProgress=null;
    let pollBusy=false;
    xhr.open("POST",url,true);
    xhr.setRequestHeader("content-type",fileType(file));
    // HTTP header values are ByteString-only in browsers. Send Unicode names in
    // percent-encoded ASCII headers; the server restores the exact filename/path.
    xhr.setRequestHeader("x-source-filename-encoded",encodeURIComponent(file.name));
    xhr.setRequestHeader("x-source-relative-path-encoded",encodeURIComponent(file.webkitRelativePath||file.name));
    xhr.setRequestHeader("x-upload-intent",job.intent);
    xhr.setRequestHeader("x-upload-id",id);
    if(job.kind==="schedule"){xhr.setRequestHeader("x-evidence-category","schedule");xhr.setRequestHeader("x-schedule-role",job.roles[fileIndex]);xhr.setRequestHeader("x-schedule-role-confirmed","1");if(job.approvalReference)xhr.setRequestHeader("x-approval-reference",job.approvalReference);}
    if(job.kind==="boq"){xhr.setRequestHeader("x-evidence-category","boq_cost");xhr.setRequestHeader("x-document-type","boq");}
    if(job.kind==="contract"){
      const role=job.roles[fileIndex]||inferContractRole(file.name);
      const types={main:"main_contract",amendment:"contract_amendment",appendix:"contract_appendix",tender:"tender_employer_requirements",replacement:"contract_replacement"};
      xhr.setRequestHeader("x-evidence-category","contract");xhr.setRequestHeader("x-document-type",types[role]||"contract_supporting_document");
    }

    xhr.upload.onprogress=event=>{
      if(!event.lengthComputable)return;
      const transferPercent=Math.max(0,Math.min(100,Math.round((event.loaded/event.total)*100)));
      const serverPercent=Math.max(0,Math.round(transferPercent*0.24));
      updateUploadJob(job,{
        state:"receiving",
        percent:serverPercent,
        message:"Uploading "+file.name,
        documentTotal:null,
        currentDocument:file.name
      },fileIndex,fileTotal,"Upload "+transferPercent+"% · "+humanBytes(event.loaded)+" / "+humanBytes(event.total));
    };

    const poll=async()=>{
      if(pollBusy)return;
      pollBusy=true;
      try{
        const response=await fetch("/api/projects/"+encodeURIComponent(job.projectId)+"/evidence/upload-progress/"+encodeURIComponent(id),{cache:"no-store"});
        if(response.ok){
          lastServerProgress=await response.json();
          const transferDetail=lastServerProgress.totalBytes
            ? humanBytes(lastServerProgress.receivedBytes)+" / "+humanBytes(lastServerProgress.totalBytes)
            : "";
          updateUploadJob(job,lastServerProgress,fileIndex,fileTotal,transferDetail);
        }
      }catch{}
      finally{pollBusy=false}
    };
    const timer=setInterval(poll,650);
    void poll();

    const finish=()=>clearInterval(timer);
    xhr.onerror=()=>{
      finish();
      reject(new Error("Upload connection failed"));
    };
    xhr.onabort=()=>{
      finish();
      reject(new Error("Upload cancelled"));
    };
    xhr.onload=async()=>{
      finish();
      await poll();
      let data=null;
      try{data=JSON.parse(xhr.responseText||"null")}catch{}
      if(xhr.status<200||xhr.status>=300){
        reject(Object.assign(new Error(data?.message||data?.reason||data?.error||("HTTP "+xhr.status)),{status:xhr.status,data}));
        return;
      }
      updateUploadJob(job,{
        ...(lastServerProgress||{}),
        state:"complete",
        percent:100,
        message:"File processed · check Documents for the reading result",
        documentTotal:data?.documentCount??(data?.documentId?1:null),
        currentDocument:null
      },fileIndex,fileTotal,"");
      resolve(data);
    };
    xhr.send(file);
  });
}
bindAskWorkspace();
el("loadDemo").onclick=loadDemo;el("refresh").onclick=()=>refresh(false);el("runAnalysisTop").onclick=runAnalysis;el("openAiTop").onclick=()=>setAppView("ai");el("askAi").onclick=askCmeng;el("createProject").onclick=createProject;el("portfolioNewProject").onclick=()=>setAppView("projects");
el('openProjectActions').onclick=()=>openProjectActions();
window.addEventListener('focus',()=>{if(overview&&['project','ai'].includes(appView))void loadProjectActions();});
function openEvidenceWorkspace(){
  if(!overview){setAppView("projects");el("createProjectMessage").innerHTML='<div class="notice info">Create or open a project before adding documents.</div>';return}
  setAppView("project");
  el("evidenceLibraryDrawer").open=false;
  const drawer=el("evidenceControlDrawer");
  drawer.open=true;
}
function openEvidenceLibrary(){
  void loadEvidence();
  el("evidenceControlDrawer").open=false;
  const drawer=el("evidenceLibraryDrawer");
  drawer.open=true;
}
function setProjectDrawerExpanded(id,enabled){
  const isLibrary=id==="evidenceLibraryDrawer";
  if(!isLibrary&&id!=="evidenceControlDrawer")return;
  el(id).classList.toggle("drawer-expanded",enabled);
  const button=el(isLibrary?"expandEvidenceLibrary":"expandEvidenceControl");
  button.textContent=enabled?"Restore":"Expand";
  button.setAttribute("aria-pressed",String(enabled));
  const label=isLibrary?"documents":"add documents";
  button.setAttribute("aria-label",enabled?"Restore "+label+" view":"Expand "+label);
}
function toggleProjectDrawerExpansion(id,event){
  event.preventDefault();
  event.stopPropagation();
  setProjectDrawerExpanded(id,!el(id).classList.contains("drawer-expanded"));
}
function closeProjectDrawer(id){
  const opener=id==="evidenceLibraryDrawer"?"openLibraryQuick":id==="evidenceControlDrawer"?"openEvidenceTop":null;
  if(!opener)return;
  el(id).open=false;
  setProjectDrawerExpanded(id,false);
  el(opener).focus();
}
function handleProjectDrawerEscape(event){
  if(event.key!=="Escape")return;
  const id=["evidenceLibraryDrawer","evidenceControlDrawer"].find(id=>el(id).open);
  if(!id)return;
  event.preventDefault();
  closeProjectDrawer(id);
}
el("expandEvidenceLibrary").onclick=event=>toggleProjectDrawerExpansion("evidenceLibraryDrawer",event);
el("expandEvidenceControl").onclick=event=>toggleProjectDrawerExpansion("evidenceControlDrawer",event);
el("closeEvidenceLibrary").onclick=event=>{event.preventDefault();event.stopPropagation();closeProjectDrawer("evidenceLibraryDrawer")};
el("closeEvidenceControl").onclick=event=>{event.preventDefault();event.stopPropagation();closeProjectDrawer("evidenceControlDrawer")};
document.addEventListener("keydown",handleProjectDrawerEscape);
el("openEvidenceTop").onclick=openEvidenceWorkspace;
el("openLibraryQuick").onclick=openEvidenceLibrary;
function setFocusMode(enabled){document.body.classList.toggle("focus-module",enabled);el("focusMode").classList.toggle("active",enabled);el("focusMode").setAttribute("aria-pressed",String(enabled));el("focusMode").textContent=enabled?"Restore page":"Expand page";el("focusMode").title=enabled?"Restore navigation and normal width":"Use the full window width";localStorage.setItem("cmeng-focus",enabled?"1":"0")}
el("focusMode").onclick=()=>setFocusMode(!document.body.classList.contains("focus-module"));
function handlePageExpansionEscape(event){
  if(event.defaultPrevented||event.key!=="Escape"||!document.body.classList.contains("focus-module"))return;
  if(document.querySelector(".visual-focus,.chart-focus"))return;
  event.preventDefault();
  setFocusMode(false);
  el("focusMode").focus();
}
document.addEventListener("keydown",handlePageExpansionEscape);
function setVisualPanelFocus(panel,enabled){
  if(!panel)return;
  document.querySelectorAll(".visual-chart.visual-focus").forEach(node=>{
    if(node!==panel){
      node.classList.remove("visual-focus");
      const other=node.querySelector(".visual-focus-button");
      if(other)other.textContent="Expand";
    }
  });
  panel.classList.toggle("visual-focus",enabled);
  document.body.classList.toggle("visual-panel-open",enabled);
  const button=panel.querySelector(".visual-focus-button");
  if(button){
    button.textContent=enabled?"Close":"Expand";
    if(!button.dataset.expandLabel)button.dataset.expandLabel=button.getAttribute("aria-label")||"Expand chart";
    button.setAttribute("aria-label",enabled?"Close chart":button.dataset.expandLabel);
    button.setAttribute("aria-expanded",String(enabled));
  }
}

function applyProgressBreakdownFilters(root){
  if(!root)return;
  const active=root.dataset.activeDimension||"wbs";
  const panel=root.querySelector('[data-progress-breakdown-view="'+active+'"]');if(!panel)return;
  const query=(panel.querySelector('[data-progress-filter]')?.value||"").trim().toLowerCase();
  const mode=panel.querySelector('[data-progress-attention]')?.value||"all";
  let visible=0;
  panel.querySelectorAll('[data-progress-row]').forEach(row=>{
    const text=row.dataset.progressSearch||"";
    const modeMatch=mode==="all"||(mode==="open"&&row.dataset.progressOpen==="1")||(mode==="critical"&&row.dataset.progressCritical==="1")||(mode==="negative"&&row.dataset.progressNegative==="1")||(mode==="unclassified"&&row.dataset.progressUnclassified==="1");
    row.hidden=Boolean((query&&!text.includes(query))||!modeMatch);
    if(!row.hidden)visible++;
  });
  const count=panel.querySelector('[data-progress-count]');if(count)count.textContent=visible+' groups';
}
document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-progress-dimension]");if(!button)return;
  const root=button.closest("[data-progress-breakdown-root]");if(!root)return;
  const dimension=button.dataset.progressDimension;root.dataset.activeDimension=dimension;
  root.querySelectorAll("[data-progress-dimension]").forEach(node=>node.classList.toggle("primary",node===button));
  root.querySelectorAll("[data-progress-breakdown-view]").forEach(node=>node.hidden=node.dataset.progressBreakdownView!==dimension);
  applyProgressBreakdownFilters(root);
});
document.addEventListener("input",event=>{
  const input=event.target;if(!input.matches?.("[data-progress-filter]"))return;
  applyProgressBreakdownFilters(input.closest("[data-progress-breakdown-root]"));
});
document.addEventListener("change",event=>{
  const select=event.target;if(!select.matches?.("[data-progress-attention]"))return;
  applyProgressBreakdownFilters(select.closest("[data-progress-breakdown-root]"));
});

document.addEventListener('input',event=>{
  const input=event.target;if(!input.matches?.('[data-register-filter]'))return;
  const panel=input.closest('.planning-panel');if(!panel)return;
  const query=input.value.trim().toLowerCase();let visible=0;
  panel.querySelectorAll('tbody tr').forEach(row=>{row.hidden=Boolean(query&&!row.textContent.toLowerCase().includes(query));if(!row.hidden)visible++;});
  const count=panel.querySelector('.register-search-count');if(count)count.textContent=visible+' matching activities';
});
document.addEventListener("click",event=>{
  const button=event.target.closest?.(".visual-focus-button");
  if(!button)return;
  const panel=button.closest("[data-visual-panel]");
  setVisualPanelFocus(panel,!panel?.classList.contains("visual-focus"));
});
document.addEventListener("keydown",event=>{
  if(event.defaultPrevented||event.key!=="Escape")return;
  const panel=document.querySelector(".visual-chart.visual-focus");
  if(panel)setVisualPanelFocus(panel,false);
});
function setChartCanvasFocus(canvas,enabled){
  if(!canvas)return;
  document.querySelectorAll(".chart-canvas.chart-focus").forEach(node=>{
    if(node!==canvas){
      node.classList.remove("chart-focus");
      const other=node.querySelector(".chart-canvas-focus-button");
      if(other)other.textContent="Expand chart";
    }
  });
  canvas.classList.toggle("chart-focus",enabled);
  document.body.classList.toggle("chart-canvas-open",enabled);
  const button=canvas.querySelector(".chart-canvas-focus-button");
  if(button){
    button.textContent=enabled?"Close chart":"Expand chart";
    button.setAttribute("aria-label",enabled?"Close chart":"Expand chart");
    button.setAttribute("aria-expanded",String(enabled));
  }
}
document.addEventListener("click",event=>{
  const button=event.target.closest?.(".chart-canvas-focus-button");
  if(!button)return;
  const canvas=button.closest("[data-chart-canvas]");
  setChartCanvasFocus(canvas,!canvas?.classList.contains("chart-focus"));
});
document.addEventListener("keydown",event=>{
  if(event.defaultPrevented||event.key!=="Escape")return;
  const canvas=document.querySelector(".chart-canvas.chart-focus");
  if(canvas)setChartCanvasFocus(canvas,false);
});
document.addEventListener("click",event=>{
  const button=event.target.closest?.(".management-module-link");
  if(!button)return;
  const key=button.dataset.module;
  if(key==="documents"){openEvidenceLibrary();return;}
  if(!key||!names[key])return;
  selected=key;
  localStorage.setItem("cmeng-module",selected);
  renderNav();
  loadModule(selected);
});
function encodeModuleReportView(view){
  const bytes=new TextEncoder().encode(JSON.stringify(view));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function currentModuleReportView(){
  return {filters:typeof currentProjectScopeContext==="function"?currentProjectScopeContext():{},selectedRole:typeof selectedRoleView==="string"?selectedRoleView:null,grouping:[],sort:null,topN:null,layout:document.body.classList.contains("focus-module")?"expanded":"standard",detailLevel:"normal"};
}
function reportPrimitive(value){
  if(value===null||value===undefined)return null;
  if(["string","number","boolean"].includes(typeof value))return value;
  return String(value);
}
function reportFlatten(value,prefix="",out={},depth=0){
  if(depth>6){if(prefix)out[prefix]="[nested data]";return out;}
  if(value===null||value===undefined||typeof value!=="object"){if(prefix)out[prefix]=reportPrimitive(value);return out;}
  if(Array.isArray(value)){
    if(prefix){
      if(value.every(item=>item===null||item===undefined||typeof item!=="object")){
        const joined=value.map(item=>item===null||item===undefined?"":String(item)).join("; ");
        out[prefix]=joined.length<=32000?joined:"["+value.length+" records; complete values are in the array table]";
      }else out[prefix]="["+value.length+" records]";
    }
    return out;
  }
  const entries=Object.entries(value);if(!entries.length){if(prefix)out[prefix]="";return out;}
  for(const [key,child] of entries){
    const next=prefix?prefix+"."+key:key;
    if(Array.isArray(child)){
      if(child.every(item=>item===null||item===undefined||typeof item!=="object")){
        const joined=child.map(item=>item===null||item===undefined?"":String(item)).join("; ");
        out[next]=joined.length<=32000?joined:"["+child.length+" records; complete values are in the array table]";
      }else out[next]="["+child.length+" records]";
    }else if(child!==null&&typeof child==="object")reportFlatten(child,next,out,depth+1);
    else out[next]=reportPrimitive(child);
  }
  return out;
}
function reportCollectArrays(value,prefix="",out=[],depth=0){
  if(depth>6||value===null||value===undefined||typeof value!=="object")return out;
  if(Array.isArray(value)){out.push({path:prefix||"records",rows:value});return out;}
  for(const [key,child] of Object.entries(value)){
    const next=prefix?prefix+"."+key:key;
    if(Array.isArray(child)){
      out.push({path:next,rows:child});
      child.slice(0,20).forEach(row=>{if(row&&typeof row==="object"&&!Array.isArray(row))reportCollectArrays(row,next,out,depth+1);});
    }else reportCollectArrays(child,next,out,depth+1);
  }
  const seen=new Set();return out.filter(section=>{if(seen.has(section.path))return false;seen.add(section.path);return true;});
}
function reportLabel(value){
  return String(value||"").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[._-]+/g," ").replace(/^./,x=>x.toUpperCase());
}
function moduleReportSemanticModel(data){
  const source=data&&typeof data==="object"?data:{},flat=reportFlatten(source),metrics=Object.entries(flat).slice(0,1000).map(([key,value])=>({id:"module."+key,label:reportLabel(key),value}));
  const sections=reportCollectArrays(source).map((section,index)=>{
    const rows=section.rows.map(row=>row&&typeof row==="object"&&!Array.isArray(row)?reportFlatten(row):{value:reportPrimitive(row)});
    const keys=[];const seen=new Set();rows.forEach(row=>Object.keys(row).forEach(key=>{if(!seen.has(key)){seen.add(key);keys.push(key);}}));
    const textKey=keys.find(key=>rows.some(row=>typeof row[key]==="string"&&!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(String(row[key]))));
    const numeric=keys.filter(key=>rows.some(row=>typeof row[key]==="number"&&Number.isFinite(row[key]))).slice(0,3);
    return {authorityId:"table-"+index,tableId:"module-table-"+index,chartId:textKey&&numeric.length&&rows.length?"module-chart-"+index:null,path:section.path,title:reportLabel(section.path),rows,keys,textKey,numeric};
  });
  return {metrics,sections};
}
function moduleReportSemanticHtml(model){
  const display=value=>value===null||value===undefined?"Not established":String(value);
  let html='<section class="planning-panel report-semantic-section" data-report-authority="summary"><h3>Key facts</h3><div class="report-semantic-metrics">';
  for(const metric of model.metrics)html+='<div class="report-config-row report-semantic-metric" data-report-metric="'+escapeHtml(metric.id)+'"><b>'+escapeHtml(metric.label)+'</b><span>'+escapeHtml(display(metric.value))+'</span></div>';
  html+='</div></section>';
  for(const section of model.sections){
    html+='<section class="planning-panel report-semantic-section" data-report-authority="'+escapeHtml(section.authorityId)+'"><h3>'+escapeHtml(section.title)+'</h3>';
    html+='<div class="table-wrap" data-report-table="'+escapeHtml(section.tableId)+'"><table><thead><tr>'+section.keys.map(key=>'<th>'+escapeHtml(reportLabel(key))+'</th>').join('')+'</tr></thead><tbody>';
    for(const row of section.rows.slice(0,100))html+='<tr>'+section.keys.map(key=>'<td>'+escapeHtml(display(row[key]))+'</td>').join('')+'</tr>';
    html+='</tbody></table><small>Showing '+Math.min(100,section.rows.length)+' of '+section.rows.length+' rows in preview. Downloads retain the selected table population.</small></div>';
    if(section.chartId)html+='<div class="chart-card report-semantic-chart" data-report-chart="'+escapeHtml(section.chartId)+'"><h4>'+escapeHtml(section.title)+' chart</h4><p>Chart uses '+escapeHtml(section.textKey)+' against '+escapeHtml(section.numeric.map(reportLabel).join(", "))+'. The downloaded chart is rendered from these same selected table rows.</p></div>';
    html+='</section>';
  }
  return html;
}
function reportDownloadUrl(format,view=null){
  let base;if(managementSurfaceKeysForApi.has(selected))base="/api/projects/"+encodeURIComponent(project())+"/management/"+encodeURIComponent(selected)+"/report."+format;
  else{const moduleArea=moduleRegistry.find(m=>m.key===selected)?.area||"schedule";base="/api/projects/"+encodeURIComponent(project())+"/"+moduleArea+"/modules/"+encodeURIComponent(selected)+"/report."+format;}
  return base+(view?"?view="+encodeURIComponent(encodeModuleReportView(view)):"");
}
function reportSafeFilename(value){
  return String(value||"report").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,120)||"report";
}
function openModuleReport(){
  if(!overview||!currentModuleResult||currentModuleResult.key!==selected){
    alert("Wait for the selected view to finish loading, then generate the report.");
    return;
  }
  const hasUsefulData=!!currentModuleResult.data&&typeof currentModuleResult.data==="object"&&Object.keys(currentModuleResult.data).some(key=>!["projectionKey","schemaVersion","projectId","projectVersion","producerVersion","generatedAt"].includes(key));
  if(currentModuleResult.status==="blocked"&&!hasUsefulData){
    alert("This report needs more Project information before it can be prepared.");
    return;
  }
  const reportWindow=window.open("","_blank");
  if(!reportWindow){alert("Allow pop-ups for CMeng to open the report preview.");return;}
  const moduleName=names[selected]||selected;
  const roleLabel=managementSurfaceKeysForApi.has(selected)?"Management Control":(roleViews[selectedRoleView]?.label||roleViews.overall.label);
  const subtitle=(descriptions[selected]||"CMeng project-control analysis.")+(managementSurfaceKeysForApi.has(selected)?"":" · "+roleLabel);
  const programme=overview?.latestRevisionLabel?planningRevisionLabel(overview.latestRevisionLabel):"—";
  const dataDate=overview?.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"—";
  const generated=new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date());
  const status=currentModuleResult.issueAssessment?.counts?.system_defect>0?"CMeng calculation needs correction":currentModuleResult.status==="ready"?"Current Project position":"Available position with qualifications";
  const styles=[...document.querySelectorAll("style")].map(node=>node.textContent||"").join("\n");
  const reportModel=moduleReportSemanticModel(currentModuleResult.data),body=moduleReportSemanticHtml(reportModel);
  const baseReportView=currentModuleReportView();
  const filename=reportSafeFilename(project()+"_"+moduleName+"_"+roleLabel+"_"+new Date().toISOString().slice(0,10));
  const report='<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHtml(project()+" · "+moduleName)+'</title><style>'+styles+
    '.report-layout{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:100vh;background:#f4f6f8}.report-config{position:sticky;top:0;height:100vh;overflow:auto;padding:18px;background:#fff;border-right:1px solid #dce5ef}.report-shell{max-width:1180px;width:100%;margin:0 auto;padding:28px;background:#fff}.report-header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #315f8a;padding-bottom:16px;margin-bottom:16px}.report-brand{font-size:13px;font-weight:900;letter-spacing:.08em;color:#315f8a}.report-header h1{font-size:26px;margin:5px 0 4px;color:#22364d}.report-header p{margin:0;color:#667085}.report-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0 20px}.report-meta div{padding:10px 12px;border:1px solid #dce5ef;border-radius:8px;background:#f8fbff}.report-meta span{display:block;font-size:9px;text-transform:uppercase;font-weight:800;letter-spacing:.05em;color:#7b8795}.report-meta b{display:block;margin-top:3px;font-size:12px;color:#22364d}.report-config-actions{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.report-config-actions a,.report-config-actions button{border:1px solid #bfd0e1;background:#fff;color:#22364d;border-radius:7px;padding:7px 10px;font:600 11px Arial;cursor:pointer;text-decoration:none}.report-config-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #edf1f5;font-size:11px}.report-config-row span{display:flex;gap:3px}.report-config-row button{width:27px;height:27px}.report-config input[type=text]{width:100%;box-sizing:border-box;padding:8px}.report-config small{display:block;line-height:1.45;color:#667085}.visual-focus-button,.chart-canvas-focus-button{display:none!important}.module-workspace,.module-panel{box-shadow:none!important;border:0!important}.planning-panel,.chart-card,.card,.completion-position{break-inside:avoid}@media print{.report-config{display:none!important}.report-layout{display:block;background:#fff}.report-shell{max-width:none;padding:0}.planning-view .table-wrap{max-height:none!important;overflow:visible!important}.lookahead-timeline,.milestone-timeline{max-height:none!important;overflow:visible!important}.auxiliary-drawer{display:none!important}}</style></head><body><div class="report-layout"><aside class="report-config"><h2>Adjust report</h2><label>Report title<input id="reportTitle" type="text" value="'+escapeHtml(moduleName)+'"></label><label>Subtitle<input id="reportSubtitle" type="text" value="'+escapeHtml(subtitle)+'"></label><h3>Sections</h3><div id="reportSectionControls"></div><h3>KPIs</h3><div id="reportMetricControls"></div><h3>Tables</h3><div id="reportTableControls"></div><h3>Charts</h3><div id="reportChartControls"></div><div class="report-config-actions"><button id="reportApply">Update preview</button><button id="reportPrint">Save PDF / Print</button></div><div class="report-config-actions"><a href="#" data-report-format="xlsx" download>Excel</a><a href="#" data-report-format="pdf" download>PDF</a><a href="#" data-report-format="docx" download>Word</a><a href="#" data-report-format="csv" download>CSV</a><a href="#" data-report-format="powerbi" download>Power BI data</a><a href="#" data-report-format="json" download>JSON</a></div><small>The preview and every download use this same section/KPI/table/chart definition, order and current page scope. Presentation choices do not change Project facts.</small></aside><div class="report-shell"><header class="report-header"><div><div class="report-brand">CMENG · PROJECT CONTROL INTELLIGENCE</div><h1 id="reportHeading">'+escapeHtml(moduleName)+'</h1><p id="reportSubheading">'+escapeHtml(subtitle)+'</p></div><div><b>'+escapeHtml(project())+'</b></div></header><div class="report-meta"><div><span>Project</span><b>'+escapeHtml(project())+'</b></div><div><span>Review lens</span><b>'+escapeHtml(roleLabel)+'</b></div><div><span>Programme</span><b>'+escapeHtml(programme)+'</b></div><div><span>Data Date</span><b>'+escapeHtml(dataDate)+'</b></div><div><span>Prepared</span><b>'+escapeHtml(generated)+'</b></div><div><span>Position</span><b>'+escapeHtml(status)+'</b></div></div><main id="reportBody">'+body+'</main><footer style="margin-top:22px;padding-top:10px;border-top:1px solid #dce5ef;font-size:10px;color:#7b8795">Prepared from the current CMeng Project position. Missing, provisional, calculated and confirmed values remain distinct.</footer></div></div></body></html>';
  reportWindow.document.open();reportWindow.document.write(report);reportWindow.document.close();
  const doc=reportWindow.document,root=doc.getElementById("reportBody"),sectionHost=doc.getElementById("reportSectionControls"),metricHost=doc.getElementById("reportMetricControls"),tableHost=doc.getElementById("reportTableControls"),chartHost=doc.getElementById("reportChartControls");
  const findByData=(name,value)=>[...root.querySelectorAll("[data-"+name+"]")].find(node=>node.dataset[name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]===value);
  const sections=[...root.querySelectorAll("[data-report-authority]")];
  sections.forEach((node,index)=>{const id=node.dataset.reportAuthority,label=(node.querySelector("h4,h3,summary")?.textContent||"Section "+(index+1)).trim();const row=doc.createElement("div");row.className="report-config-row";row.dataset.configSection=id;row.innerHTML='<label><input type="checkbox" data-section-check="'+escapeHtml(id)+'" checked> '+escapeHtml(label)+'</label><span><button type="button" data-section-up="'+escapeHtml(id)+'">↑</button><button type="button" data-section-down="'+escapeHtml(id)+'">↓</button></span>';sectionHost.appendChild(row);});
  reportModel.metrics.forEach(metric=>{const row=doc.createElement("div");row.className="report-config-row";row.innerHTML='<label><input type="checkbox" data-metric-check="'+escapeHtml(metric.id)+'" checked> '+escapeHtml(metric.label)+'</label>';metricHost.appendChild(row);});
  reportModel.sections.forEach(section=>{const row=doc.createElement("div");row.className="report-config-row";row.innerHTML='<label><input type="checkbox" data-table-check="'+escapeHtml(section.tableId)+'" checked> '+escapeHtml(section.title)+'</label>';tableHost.appendChild(row);});
  reportModel.sections.filter(section=>section.chartId).forEach(section=>{const row=doc.createElement("div");row.className="report-config-row";row.innerHTML='<label><input type="checkbox" data-chart-check="'+escapeHtml(section.chartId)+'" checked> '+escapeHtml(section.title)+'</label>';chartHost.appendChild(row);});
  const checkedValues=selector=>[...doc.querySelectorAll(selector)].filter(input=>input.checked).map(input=>input.value||input.dataset.sectionCheck||input.dataset.metricCheck||input.dataset.tableCheck||input.dataset.chartCheck).filter(Boolean);
  const currentPreviewView=()=>{
    const order=[...sectionHost.querySelectorAll("[data-config-section]")].map(row=>row.dataset.configSection).filter(Boolean);
    const includeAuthorities=[...sectionHost.querySelectorAll("[data-config-section]")].filter(row=>row.querySelector("[data-section-check]")?.checked).map(row=>row.dataset.configSection).filter(Boolean);
    return {...baseReportView,title:doc.getElementById("reportTitle").value.trim()||moduleName,subtitle:doc.getElementById("reportSubtitle").value.trim()||null,
      includeAuthorities,sectionOrder:order,includeMetrics:checkedValues("[data-metric-check]"),includeTables:checkedValues("[data-table-check]"),includeCharts:checkedValues("[data-chart-check]")};
  };
  const updateDownloadLinks=()=>doc.querySelectorAll("[data-report-format]").forEach(link=>{link.href=reportDownloadUrl(link.dataset.reportFormat,currentPreviewView());});
  const apply=()=>{
    doc.getElementById("reportHeading").textContent=doc.getElementById("reportTitle").value.trim()||moduleName;
    doc.getElementById("reportSubheading").textContent=doc.getElementById("reportSubtitle").value.trim()||"";
    doc.querySelectorAll("[data-section-check]").forEach(input=>{const node=findByData("report-authority",input.dataset.sectionCheck);if(node)node.hidden=!input.checked;});
    doc.querySelectorAll("[data-metric-check]").forEach(input=>{const node=findByData("report-metric",input.dataset.metricCheck);if(node)node.hidden=!input.checked;});
    doc.querySelectorAll("[data-table-check]").forEach(input=>{const node=findByData("report-table",input.dataset.tableCheck);if(node)node.hidden=!input.checked;});
    doc.querySelectorAll("[data-chart-check]").forEach(input=>{const node=findByData("report-chart",input.dataset.chartCheck);if(node)node.hidden=!input.checked;});
    updateDownloadLinks();
  };
  doc.querySelectorAll("[data-section-up]").forEach(button=>button.onclick=()=>{const row=button.closest("[data-config-section]"),prev=row.previousElementSibling;if(!prev)return;const node=findByData("report-authority",button.dataset.sectionUp),prevNode=findByData("report-authority",prev.dataset.configSection);if(node&&prevNode&&node.parentElement===prevNode.parentElement){node.parentElement.insertBefore(node,prevNode);row.parentElement.insertBefore(row,prev);apply();}});
  doc.querySelectorAll("[data-section-down]").forEach(button=>button.onclick=()=>{const row=button.closest("[data-config-section]"),next=row.nextElementSibling;if(!next)return;const node=findByData("report-authority",button.dataset.sectionDown),nextNode=findByData("report-authority",next.dataset.configSection);if(node&&nextNode&&node.parentElement===nextNode.parentElement){node.parentElement.insertBefore(nextNode,node);row.parentElement.insertBefore(next,row);apply();}});
  doc.getElementById("reportApply").onclick=apply;doc.getElementById("reportPrint").onclick=()=>{apply();reportWindow.print();};
  doc.querySelectorAll("#reportTitle,#reportSubtitle,[data-section-check],[data-metric-check],[data-table-check],[data-chart-check]").forEach(input=>input.oninput=apply);apply();
  const reportBoq=currentModuleResult.data?.suppliedBoq;if(reportBoq)reportWindow.updateSuppliedBoq=(page,query)=>{const target=doc.getElementById('suppliedBoqRows');if(target)target.innerHTML=renderSuppliedBoqRows(reportBoq,page,query??doc.getElementById('suppliedBoqSearch')?.value??'');};
  reportWindow.document.title=filename;
}

document.addEventListener('click',event=>{
  if(event.target.closest?.('a[href="#moduleReviewDetail"]')){const detail=el('moduleReviewDetail');if(detail)detail.open=true;}
});
el("moduleReport").onclick=openModuleReport;
async function loadRelease(){try{await api("/health");el("releaseStatus").textContent="Live"}catch{el("releaseStatus").textContent="Connection issue"}}

el("scheduleFiles").onchange=e=>{scheduleSelection=[...e.target.files];renderScheduleQueue()};
el("boqFiles").onchange=e=>{boqSelection=[...e.target.files];renderSimpleQueue("boqQueue",boqSelection,"boq")};
el("contractFiles").onchange=e=>{contractSelection=[...e.target.files];renderContractQueue()};
el("evidenceFiles").onchange=e=>{evidenceSelection=[...e.target.files];renderSimpleQueue("evidenceQueue",evidenceSelection,"evidence")};
el("uploadSchedules").onclick=uploadSchedules;el("uploadBoqs").onclick=uploadBoqs;el("uploadContracts").onclick=uploadContracts;el("uploadEvidence").onclick=uploadEvidence;
const storedProject=localStorage.getItem("cmeng-project");const storedModule=localStorage.getItem("cmeng-module");if(storedModule&&names[storedModule])selected=storedModule;el("projectId").value=storedProject||"";el("projectId").addEventListener("change",()=>openProject(project()));setFocusMode(localStorage.getItem("cmeng-focus")==="1");renderRoleViewSelector();renderAiSuggestions();renderPlatformNav();renderNav();
async function bootstrapWorkspace(){
  loadRelease();
  if(storedProject){
    try{
      await openProject(storedProject);
      loadPortfolio();
      return;
    }catch{}
  }
  setAppView("portfolio");
  loadPortfolio();
}
bootstrapWorkspace().catch(()=>setAppView("portfolio"));
</script>
</body>
</html>`;
}
