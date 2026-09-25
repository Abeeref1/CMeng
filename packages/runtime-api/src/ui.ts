import {moduleRegistry, titleForModule} from './registry';
import {STATUS_LABELS} from './position-review';
import {systemReviewScript,systemReviewStyles} from './ui-system-review';
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
.platform-view[hidden],#projectWorkspace[hidden]{display:none!important}.project-side-only{display:none}.project-active .project-side-only{display:block}
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
.main{min-width:0}.topbar{min-height:64px;background:rgba(248,247,244,.96);backdrop-filter:blur(12px);border-bottom:1px solid #dfdbd4;display:none;align-items:center;gap:9px;padding:10px 26px;position:sticky;top:0;z-index:10;flex-wrap:wrap;box-shadow:0 1px 0 rgba(15,23,42,.02)}.topbar-context{display:flex;flex-direction:column;gap:1px;padding-left:14px;margin-left:2px;border-left:1px solid var(--line);min-width:150px}.topbar-context b{font-size:12px;color:var(--slate)}.topbar-context span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;font-weight:750}.topbar-spacer{flex:1}.release-state{display:none!important}.release-state:before{content:"";width:7px;height:7px;border-radius:50%;background:#32d583;box-shadow:0 0 0 3px #ecfdf3}.platform-context{display:flex;flex-direction:column;min-width:160px}.platform-context span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:800}.platform-context b{font-size:13px;color:var(--slate)}.project-only{display:none!important}.project-active .topbar{display:flex}.project-active .project-only{display:flex!important}.project-active button.project-only{display:inline-flex!important}.project-active .topbar-context.project-only{display:flex!important}.auto-run-toggle{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted);font-weight:650}.auto-run-toggle input{width:auto}
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
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:min(66vh,680px);background:#fff;scrollbar-color:#c7d2df transparent;scrollbar-width:thin}table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f1eee9;color:#55616d;font-weight:780;position:sticky;top:0;z-index:2;font-size:11.5px;letter-spacing:.025em;white-space:nowrap;text-transform:none}td{color:#27364a}tbody tr:nth-child(even) td{background:#fbfaf8}tbody tr:hover td{background:#f5f2ed}tr:last-child td{border-bottom:0}.kpi-value,.position-value,.scalar span,.currency-line strong,.movement-value,.candidate-value{font-variant-numeric:tabular-nums}.module-panel{position:relative}.module-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#4f7fb4,#a9c1da);z-index:3}.module-basis{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.basis-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 9px;border:1px solid #dbe4ee;border-radius:9px;background:#fff;font-size:11.5px;color:#506579}.basis-chip b{font-size:10.5px;color:#738198;text-transform:uppercase;letter-spacing:.05em}.basis-chip strong{font-size:12.5px;color:#2e3a46;font-weight:780}.focus-module .director-section,.focus-module .workspace-drawer,.focus-module .footer-note,.focus-module .workspace-header,.focus-module .quick-upload-bar{display:none}.focus-module .content{padding-top:18px}.focus-module .module-panel{min-height:calc(100vh - 112px)}.focus-module .module-panel #moduleContent{min-height:calc(100vh - 190px)}
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
.planning-view{display:grid;gap:14px;--module-accent:#4f7fb4}.resource-view{--module-accent:#3f7f76}.contract-challenge-view{--module-accent:#8b6b35}.forecast-history-view,.independent-forecast-view{--module-accent:#6d628e}.delay-claims-view,.notices-view,.windows-view,.eot-view{--module-accent:#8b6b35}.window-card.clean{grid-template-columns:minmax(280px,1.2fr) minmax(220px,.8fr) minmax(220px,.8fr)}.movement-value.small{font-size:14px;line-height:1.3}.progress-position-view{--module-accent:#4f7fb4}.variance-view{--module-accent:#8b6b35}.progress-scurve-view{--module-accent:#4f7fb4}.quantity-view{--module-accent:#6f7d4c}.wbs-view{--module-accent:#566e99}.manhour-view{--module-accent:#6d628e}.module-bar-list{display:grid;gap:8px}.module-bar-row{display:grid;grid-template-columns:minmax(150px,.9fr) minmax(180px,1.7fr) 80px;gap:10px;align-items:center}.module-bar-row>span{font-size:11px;color:#506579;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.module-bar-row>div{height:11px;border-radius:999px;background:#edf1f5;overflow:hidden}.module-bar-row i{display:block;height:100%;border-radius:999px;background:#4f7fb4}.module-bar-row i.warning{background:#b57922}.module-bar-row i.danger{background:#b4483e}.module-bar-row i.success{background:#2c7a57}.module-bar-row b{text-align:right;font-size:11px;color:#344054}.progress-basis-bars{display:grid;gap:11px}.progress-basis-row{display:grid;grid-template-columns:minmax(190px,.9fr) minmax(260px,1.6fr) 70px;gap:12px;align-items:center}.progress-basis-row>div:first-child b{display:block;font-size:12px;color:#344054}.progress-basis-row>div:first-child span{display:block;font-size:10px;color:#7b8795;margin-top:2px}.progress-track{height:16px;background:#edf1f5;border-radius:999px;overflow:hidden}.progress-track i{display:block;height:100%;background:#4f7fb4;border-radius:999px}.progress-basis-row strong{text-align:right;font-size:13px}.evidence-gates{display:grid;gap:8px}.evidence-gate{display:flex;justify-content:space-between;gap:12px;padding:10px 11px;border-left:3px solid #98a2b3;border-radius:7px;background:#f8fafc}.evidence-gate.ready{border-left-color:#2c7a57;background:#f4fbf7}.evidence-gate.missing{border-left-color:#b57922;background:#fffaf0}.evidence-gate span{font-size:11px;color:#667085}.evidence-gate b{font-size:11px;color:#344054}.pressure-matrix{display:grid;gap:6px}.pressure-matrix-head,.pressure-matrix-row{display:grid;grid-template-columns:140px repeat(5,minmax(82px,1fr));gap:6px;align-items:stretch}.pressure-matrix-head span,.pressure-matrix-head b{font-size:10.5px;color:#667085;text-align:center;padding:5px}.pressure-matrix-head span{text-align:left}.pressure-matrix-row>strong{display:flex;align-items:center;font-size:11px;color:#344054}.pressure-cell{min-height:48px;border-radius:7px;display:grid;place-items:center;border:1px solid #e3e8ef;background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell.danger{background:rgba(180,72,62,var(--cell-alpha))}.pressure-cell.danger-soft{background:rgba(196,96,79,var(--cell-alpha))}.pressure-cell.warning{background:rgba(181,121,34,var(--cell-alpha))}.pressure-cell.accent{background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell b{font-size:12px;color:#1f3349}.pressure-note,.float-distribution-note{margin-top:9px;font-size:10.5px;color:#7b8795}.constraint-bars,.finish-period-bars{display:grid;gap:8px}.constraint-row,.finish-period-row{display:grid;grid-template-columns:minmax(140px,.9fr) minmax(160px,1.7fr) 54px;gap:10px;align-items:center}.constraint-row span,.finish-period-row span{font-size:11px;color:#506579}.constraint-row>div,.finish-period-row>div{height:10px;background:#eef2f6;border-radius:999px;overflow:hidden}.constraint-row i,.finish-period-row i{display:block;height:100%;background:#b4483e;border-radius:999px}.finish-period-row i{background:#b57922}.constraint-row b,.finish-period-row b{text-align:right;font-size:11px;color:#344054}.revision-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.revision-value-card{border:1px solid #dde5ee;border-radius:9px;padding:11px;background:#fbfdff}.revision-value-head{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e8edf3;padding-bottom:7px}.revision-value-head b{font-size:11.5px;color:#22364d}.revision-value-head span{font-size:10px;color:#7b8795}.revision-value-lines{display:grid;gap:5px;margin-top:8px}.revision-value-lines span{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:#667085}.revision-value-lines b{color:#22364d}.milestone-context{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;padding:7px 9px;border-radius:7px;background:#f6f8fb;font-size:10.5px;color:#667085}.milestone-label small{display:block;margin-top:3px;font-size:9.5px;color:#8a96a6}.lookahead-state{white-space:normal;line-height:1.1}.float-histogram{overflow-x:auto}.management-view{--module-accent:#315f8a}.management-view{display:grid;gap:16px}.management-two-column{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.management-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.management-metric-card{border:1px solid #dce5ef;border-radius:14px;background:#fff;padding:17px 18px;min-height:0;box-shadow:0 7px 20px rgba(34,54,77,.035)}.management-metric-card.attention{border-top:3px solid #b57922}.management-metric-card.critical{border-top:3px solid #b4483e}.management-metric-card.good{border-top:3px solid #2c7a57}.management-metric-card.unavailable{border-top:3px solid #91a0b0}.management-metric-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.management-metric-head>span{font-size:11px;font-weight:820;text-transform:uppercase;letter-spacing:.05em;color:#718096;max-width:72%}.management-metric-value{margin-top:14px;font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif;font-size:28px;line-height:1.12;font-weight:780;letter-spacing:-.035em;color:#22364d;word-break:normal;overflow-wrap:normal}.management-metric-value.date{font-size:27px;white-space:nowrap}.management-metric-value.missing{font-size:21px;color:#667085;letter-spacing:-.015em}.management-metric-badges{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0 13px}.management-metric-basis{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;padding-top:11px;border-top:1px solid #edf1f5;font-size:11.5px}.management-metric-basis span,.management-metric-note span{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:820;color:#8a96a6}.management-metric-basis b{color:#506579;font-weight:700}.management-metric-note{margin-top:10px}.management-metric-note p{font-size:11.5px;line-height:1.45;color:#506579;margin:3px 0 0}.management-metric-note.action p{color:#315f8a;font-weight:650}.management-metric-owner{margin-top:13px}.management-module-link{border:1px solid #bfd0e1;background:#fff;color:#315f8a;border-radius:7px;padding:6px 9px;font-size:10.5px;font-weight:800;cursor:pointer}.management-module-link:hover{background:#f3f7fb}.management-alert-list{display:grid;gap:10px}.management-alert{border:1px solid #dce5ef;border-left:4px solid #91a0b0;border-radius:9px;padding:12px;background:#fff}.management-alert.critical{border-left-color:#b4483e}.management-alert.high{border-left-color:#c67d2e}.management-alert.medium{border-left-color:#b59c4a}.management-alert.information{border-left-color:#4f7fb4}.management-alert-head{display:flex;justify-content:space-between;gap:12px}.management-alert-head b{color:#22364d}.management-alert-head span{text-transform:uppercase;font-size:9px;font-weight:900;color:#7b8795}.management-alert p{font-size:12px;color:#5f6f80}.management-alert-action{display:grid;grid-template-columns:110px 1fr;gap:10px;margin:9px 0;font-size:11.5px}.management-alert-action strong{color:#344054}.management-alert-action span{color:#506579}.management-decision-list{display:grid;gap:10px}.management-decision{display:grid;grid-template-columns:30px 1fr;gap:10px;border:1px solid #dce5ef;border-radius:9px;padding:12px}.management-decision>i{width:26px;height:26px;border-radius:50%;background:#315f8a;color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800}.management-decision b{color:#22364d}.management-decision-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin:7px 0;color:#667085;font-size:10.5px}.management-decision small{color:#8a96a6}.management-detail{margin-top:14px;border:1px solid #e0e7ef;border-radius:8px}.management-detail summary{padding:10px 12px;cursor:pointer;font-weight:800;color:#344054}.management-detail summary span{float:right;color:#7b8795;font-weight:600}.management-tag-list{display:flex;flex-wrap:wrap;gap:7px;padding:12px;border-top:1px solid #e7edf3}.management-tag-list span{padding:5px 8px;border-radius:999px;background:#f3f6f9;color:#506579;font-size:10.5px}.programme-review{--module-accent:#4f7fb4}.activity-review{--module-accent:#566e99}.lookahead-view{--module-accent:#3f7f76}.changes-view{--module-accent:#8b6b35}.revision-view{--module-accent:#6d628e}.milestone-view{--module-accent:#44759c}.nearcritical-view{--module-accent:#9b6a24}.planning-view .planning-panel.primary{border-top:3px solid var(--module-accent)}.planning-view .planning-panel-head h4{letter-spacing:-.01em}.planning-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.planning-kpi{min-height:94px;padding:14px 15px;border:1px solid #dce5ef;border-radius:11px;background:#fff;box-shadow:0 5px 16px rgba(34,54,77,.035)}.planning-kpi span{display:block;font-size:11.5px;color:#718096;font-weight:800;text-transform:uppercase;letter-spacing:.045em}.planning-kpi strong{display:block;margin-top:7px;font-size:24px;line-height:1.1;color:#22364d;letter-spacing:-.025em}.planning-kpi small{display:block;margin-top:6px;font-size:12px;color:#7b8795}.planning-kpi.danger{border-top:3px solid #b4483e}.planning-kpi.warning{border-top:3px solid #b57922}.planning-kpi.success{border-top:3px solid #2c7a57}.planning-kpi.accent{border-top:3px solid #4f7fb4}
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
${systemReviewStyles}
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
      <span id="releaseStatus" class="release-state">Production</span>
      <span id="globalStatus" style="font-size:12px;color:#667085"></span>
    </div>
    <div class="content">
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

      <section id="aiView" class="platform-view" hidden>
        <div class="portfolio-hero">
          <div><span class="section-kicker">CMeng AI</span><h2>Ask CMeng</h2><p>Ask about the current programme, progress, resources, forecast, claims, contract and project documents.</p></div>
          <span class="badge" id="aiProjectBadge">No active project</span>
        </div>
        <div class="ai-shell">
          <div class="ai-panel">
            <h3>Ask about this project</h3>
            <div class="ai-intro">CMeng AI answers from the current project records and calculated position. Recommendations do not change the current project position unless you approve them.</div>
            <div class="ai-composer"><textarea id="aiQuestion" placeholder="Ask: What changed since the last update? What is driving the forecast? Which claims have the strongest time impact?"></textarea><button class="btn primary" id="askAi">Ask</button></div>
            <div class="ai-suggestions" id="aiSuggestions"></div>
            <div id="aiAnswer" class="ai-answer">Open a project, then ask CMeng about its position.</div>
          </div>
          <div class="ai-context">
            <h3>Project information used</h3>
            <div id="aiProjectInfo" class="muted">No project selected.</div>
          </div>
        </div>
      </section>

      <div id="projectWorkspace" hidden>
      <div class="workspace-header">
        <div class="page-title">
          <span class="eyebrow">Current project</span>
          <h2>Project workspace</h2>
          <p id="workspaceProjectMeta">No project selected</p>
        </div>
        <div class="workspace-actions">
          <button class="btn" id="openLibraryQuick">Documents</button>
          <button class="btn primary" id="openEvidenceTop">Add documents</button>
          <button class="btn" id="runAnalysisTop">Update position</button>
          <button class="btn" id="openAiTop">Ask CMeng</button>
          <button class="btn small" id="refresh">Refresh</button>
          <span id="projectBadge" class="badge">No project</span>
        </div>
      </div>

      <section class="card module-panel module-workspace">
        <div class="module-head module-workspace-head">
          <div>
            <span class="section-kicker">Current view</span>
            <h3 id="moduleTitle">Project Controls</h3>
            <p id="moduleSubtitle">Current position, key changes and actions requiring attention.</p>
          </div>
          <div class="module-head-actions"><button class="btn small" id="moduleReport">Generate report</button><button class="btn small" id="focusMode" aria-pressed="false">Focus view</button><span id="moduleBadge" class="badge">Select a view</span></div>
        </div>
        <div id="roleViewSelector" class="role-view-selector" aria-label="Review view"></div>
        <div id="moduleContent" class="empty">Choose a project-control view from the left.</div>
      </section>

      <details class="workspace-drawer auxiliary-drawer" id="evidenceControlDrawer">
        <summary>
          <div><span class="section-kicker">Documents</span><strong>Add or update project documents</strong></div>
          <span class="drawer-hint">Open</span>
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
                  <small>Select baseline, updates, revised baseline and recovery files together. CMeng verifies content and chronology; filenames are only hints.</small>
                  <div class="intent-control"><span>Document action</span><select id="scheduleIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current document</option></select></div>
                  <input type="file" id="scheduleFiles" multiple accept=".xer,.xml,.xlsx,.xlsm,.csv">
                  <div id="scheduleQueue" class="queue"></div>
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
          <span id="evidenceBadge" class="badge">0 documents</span>
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
${experienceScript}
${systemReviewScript}
${basisReviewScript}
const moduleRegistry=${JSON.stringify(moduleRegistry).replace(/</g, '\u003c')};
const groups=moduleRegistry.reduce((groups,m)=>{(groups[m.group]??=[]).push(m.key);return groups},{});
const apiKeys=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.apiKey]));
const names=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.title]));
const descriptions=Object.fromEntries(moduleRegistry.map(m=>[m.key,m.description]));
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
let scheduleSelection=[],boqSelection=[],contractSelection=[],evidenceSelection=[];
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
async function api(path,opts={}){const r=await fetch(path,opts);let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data?.message||data?.reason||data?.error||("HTTP "+r.status));e.data=data;e.status=r.status;throw e}return data}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fileType(file){const n=file.name.toLowerCase();if(n.endsWith(".zip"))return"application/zip";if(n.endsWith(".xer"))return"text/plain";if(n.endsWith(".xml"))return"application/xml";if(n.endsWith(".csv"))return"text/csv";if(n.endsWith(".pdf"))return"application/pdf";if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(n.endsWith(".png"))return"image/png";if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return"image/jpeg";if(n.endsWith(".tif")||n.endsWith(".tiff"))return"image/tiff";if(n.endsWith(".bmp"))return"image/bmp";if(n.endsWith(".webp"))return"image/webp";if(n.endsWith(".xlsm"))return"application/vnd.ms-excel.sheet.macroEnabled.12";return file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
function inferScheduleRole(name){const n=name.toLowerCase();if(n.includes("revised")&&n.includes("baseline"))return"revised_baseline";if(n.includes("recovery"))return"recovery";if(n.includes("baseline")||n.includes("rev0")||n.startsWith("s01_"))return"baseline";return"update"}
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
  if(appView!=="project"||!overview){nav.innerHTML="";return}
  const states=new Map([...(overview?.moduleStates||[]),...(overview?.managementStates||[])].map(x=>[x.key,x]));
  const overall=states.get('master-dashboard')?.issueAssessment?.counts||{};
  const sourceTotal=(overall.source_conflict||0)+(overall.data_quality||0)+(overall.missing_information||0);
  let html='<div class="nav-review-totals"><div>Information items<b>'+fmt(sourceTotal)+'</b></div><div>System failures<b>'+fmt(overall.system_defect||0)+'</b></div></div><div class="nav-group">';
  Object.entries(groups).forEach(([group,keys])=>{
    html+='<div class="nav-group-title" style="padding-top:10px">'+group+'</div>';
    keys.forEach(key=>{
      const state=states.get(key)||{};
      const issues=state.issueAssessment?.counts||{};
      const errors=issues.system_defect||0,source=(issues.source_conflict||0)+(issues.data_quality||0)+(issues.missing_information||0),review=(issues.comparison_difference||0)+(issues.governance_review||0),pending=issues.verification_pending||0;
      const title=names[key]+' · Information items: '+source+' · System failures: '+errors+' · Reviews: '+review+' · Pending checks: '+pending;
      // Keep the full counts on Information & Actions. Repeating the same
      // propagated requests on every destination makes navigation look broken.
      const count='<span class="nav-counts">'+(errors?'<span class="nav-count error" aria-label="'+errors+' system failures">Error '+errors+'</span>':'')+'</span>';
      html+='<button class="nav-item '+(selected===key?"active":"")+'" data-key="'+key+'" title="'+escapeHtml(title)+'" aria-current="'+(selected===key?'page':'false')+'"><span class="nav-label">'+names[key]+'</span>'+count+'</button>';
    });
  });
  html+='</div>';
  nav.innerHTML=html;
  nav.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{selected=b.dataset.key;localStorage.setItem("cmeng-module",selected);renderNav();loadModule(selected)});
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
  const d=data?.deliveryChallenge||{};if(!data?.deliveryChallenge&&!data?.suppliedBoq?.rows?.length)return false;
  const f=data.boqFeasibility||{rows:[],activityChecks:[],overallStatus:"Unable to assess",reason:"Current quantity and productivity assessment is unresolved."};
  const pc=f.programmePc||{},s=d.scheduleChallenge||{};
  const value=x=>x===null||x===undefined?"Unresolved":fmt(x);
  const table=(heads,rows,empty)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+escapeHtml(v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+heads.length+'">'+escapeHtml(empty)+'</td></tr>')+'</tbody></table></div>';
  const panel=(title,copy,body)=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(copy)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';
  const activities=f.activityChecks||[];
  const sourceHours=data.sourceLaborEvidence;
  const hours=sourceHours?planningKpis([["Submitted planned labor hours",sourceHours.plannedHours,"supplied register period"],["Recorded hours through reporting date",sourceHours.actualHoursToDataDate,"labor source; not automatically certified utilization"]]):'';
  const manpower=panel('1. Challenge manpower plan','Remaining quantities × supported labor hours per unit, distributed over each activity’s source-calendar working time. Supplied resource loading is compared on that same basis.',
    planningKpis([["Independent remaining labor requirement",value(f.requiredLaborHours),"labor hours; requires quantities, productivity and scheduled working time"],["Manpower calculations unresolved",f.unresolvedCount??'Unresolved',f.reason]])+hours+
    table(['Activity','Required labor hours','Available working hours','Required average people','Submitted people','Submitted minus required','Assessment'],activities.slice(0,100).map(r=>[r.activityId,value(r.requiredLaborHours),value(r.availableWorkingHours),value(r.requiredAveragePeople),value(r.submittedPeople),value(r.manpowerGap),r.scheduleState==='exceeds'?'Insufficient for the planned period':r.scheduleState==='fits'?'Adequate for this activity calculation':'Unresolved: '+r.reason]),'Unresolved: confirm BOQ-to-activity links, remaining quantities, productivity and resource loading.'));
  const programme=panel('2. Challenge current schedule','Programme PC compares the same explicit milestone in baseline and current revisions. Quantity-driven finish checks use supported production rates and resource capacity.',
    planningKpis([["Baseline Programme PC",pc.baseline?.dateIso?planningShortDate(pc.baseline.dateIso):'Unresolved',pc.baseline?.reason||pc.reason||'Baseline milestone not established'],["Current Programme PC",pc.current?.dateIso?planningShortDate(pc.current.dateIso):'Unresolved',pc.current?.reason||'Current milestone not established'],["Baseline-to-current PC movement",pc.movementDays==null?'Unresolved':fmt(pc.movementDays)+' calendar days',pc.reason||'Comparable milestones not established'],["Submitted completion",s.contractorSubmittedCompletionIso?planningShortDate(s.contractorSubmittedCompletionIso):'Unresolved','separate from the Programme PC milestone comparison'],["Programme calendar recalculation",s.independentCompletionIso?planningShortDate(s.independentCompletionIso):'Unresolved',data.independentForecastReviewReason||'Uses the current programme logic and readable calendars']])+
    table(['Activity','Submitted finish','Quantity-driven finish','Assessment','Reason'],activities.slice(0,100).map(r=>[r.activityId,r.submittedFinishIso?planningShortDate(r.submittedFinishIso):'Unresolved',r.productionFinishIso?planningShortDate(r.productionFinishIso):'Unresolved',r.scheduleState==='exceeds'?'Exceeds planned period':r.scheduleState==='fits'?'Fits planned period':'Unresolved',r.reason]),'Unresolved: productivity and activity-linked resource capacity are required.'));
  const findings=activities.slice(0,100).map(r=>[r.activityId,r.submittedPeople==null?'Unresolved':fmt(r.submittedPeople)+' people',r.requiredAveragePeople==null?'Unresolved':fmt(r.requiredAveragePeople)+' required average people',r.manpowerGap==null?'Unresolved':fmt(r.manpowerGap)+' people',r.scheduleState==='exceeds'?'Quantity-driven finish exceeds the submitted activity finish':r.scheduleState==='fits'?'No contradiction in this activity calculation':'Unresolved: '+r.reason,r.scheduleState==='exceeds'?'Revise activity resources, productivity support or duration and assess the programme effect':r.scheduleState==='fits'?'Confirm trade availability, shared resources and sequencing':r.reason]);
  const combined=panel('3. Combined delivery challenge','Submitted → Independent → Gap → Consequence → Action. Whole-programme feasibility also depends on sequencing and resources shared between activities.',table(['Activity','Submitted','Independent','Gap','Consequence','Action'],findings,'Unable to assess: the evidence needed for an independent production comparison is not established.'));
  const calculations=panel('Quantity and productivity calculations','Each BOQ item retains its quantity unit and evidence basis. Inferred mappings, missing actual quantities and missing productivity are unresolved.',table(['BOQ item','Activity','Remaining quantity','Unit','Labor hours per unit','Rate basis','Required labor hours','Reason'],(f.rows||[]).slice(0,100).map(r=>[r.quantityItemId,r.activityId||'Unresolved',value(r.remainingQuantity),r.unit||'Unresolved',value(r.laborHoursPerUnit),humanizeKey(r.productivityBasis),value(r.requiredLaborHours),r.reason]),f.reason));
  const scope='<p>Showing up to 100 activity and BOQ rows in each table. All '+fmt(activities.length)+' activity checks and '+fmt((f.rows||[]).length)+' BOQ item records remain in the Excel and data downloads.</p>';
  const html='<section class="planning-view contract-challenge-view"><div class="notice info"><b>Manpower and duration check: '+escapeHtml(f.overallStatus)+'</b><p>'+escapeHtml(f.reason)+'</p><p>This tests delivery assumptions. It does not interpret legal clauses, establish causation or EOT, or create a replacement programme.</p></div>'+manpower+programme+combined+'<details class="management-detail"><summary>Calculation inputs and supporting detail</summary>'+scope+calculations+renderBasisReviews({...data,contractValueBasisReview:null},'challenge-contract')+'</details></section>';
  el('moduleContent').innerHTML=renderModuleBasis(data)+renderSuppliedBoq(data.suppliedBoq)+renderRoleContent('challenge-contract',data,html,'',true)+experienceReviewSummary(data.issueAssessment)+renderModuleReadiness(data,reason);
  return true;
}
function resourceUnitLabel(unit){
  return ({labor_hour:"Labor hours",labour_hour:"Labor hours",equipment_hour:"Equipment hours"})[unit]||unit;
}
function humanizeKey(key){
  const sharedLabels=${JSON.stringify(STATUS_LABELS)};if(sharedLabels[key])return sharedLabels[key];
  const labels={PARALLEL_ASSESSMENT_VALUES_DIFFER:"Claim assessments disagree",REGISTER_DETERMINED_STATUS_NOT_IN_DETERMINATION_REGISTER:"Reported determination is absent from the award register",labor_hour:"Labor hours",equipment_hour:"Equipment hours",rfi_register:"RFI",design_deliverables:"Design deliverable",submittal_register:"Submittal",governed:"Confirmed",established:"Confirmed",candidate:"Needs review",not_established:"Unresolved",not_submitted:"Not provided",submitted_unparsed:"Provided; not read",independent_cpm:"Calendar calculation",source_forecast:"Submitted forecast",event_date_missing:"Event / awareness date missing",requirement_missing:"Notice rule missing"};
  if(labels[key])return labels[key];
  const value=String(key);
  return (/^[A-Z][A-Z0-9_]+$/.test(value)&&value.includes("_")?value.toLowerCase():value)
    .replace(/[_-]+/g," ")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/\b\w/g,c=>c.toUpperCase());
}
function documentUseLabel(state,document=null){
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
  return '<section class="planning-view progress-scurve-view">'+renderProgressScope(p.scopeComparison)+note+renderVisualPanel("First 12 months · the small progress differences are visible","Source series retain their own revision populations. Use the matched comparison above for a performance gap.",renderLineChart(early,series,null,{...options,ariaLabel:"Progress first 12 months"}))+'<details class="source-scope"><summary>Full programme curve and source-population coverage</summary>'+kpis+renderLineChart(p.points,series,100,{...options,ariaLabel:"Full programme progress"})+'</details></section>';
}
function renderQuantityScurveVisual(data){
  const p=projectionFor(data,"quantity_scurve");
  if(!Array.isArray(p.series))return"";
  const mappingLabel=p.mappingBasis==="governed"?"Confirmed links":p.mappingBasis==="candidate_scenario"?"Suggested links for review":"Activities not yet linked";
  const mappedSeries=p.series.filter(series=>(series.points||[]).length>0);
  const seriesItemCount=p.series.reduce((sum,series)=>sum+(Number.isFinite(Number(series.itemCount))?Number(series.itemCount):0),0);
  const unmappedCount=(p.unmappedItemIds||[]).length;
  const boqItemCount=seriesItemCount>0?seriesItemCount:(unmappedCount>0?unmappedCount:null);
  const mappedItemCount=typeof p.allocatedItemCount==="number"?p.allocatedItemCount:null;
  const itemLinkCoverage=typeof p.itemLinkCoveragePercent==="number"?p.itemLinkCoveragePercent:null;
  const top=planningKpis([
    ["BOQ items",boqItemCount===null?"Unresolved":boqItemCount,"quantity basis"],
    ["Items with any allocation",mappedItemCount===null?"Unresolved":mappedItemCount,"confirmed or scenario links"],
    ["Item-link coverage",itemLinkCoverage===null?"Unresolved":fmt(itemLinkCoverage)+"%","BOQ items with an allocation"],
    ["Mapping basis",mappingLabel,""],
    ["Unit groups",p.series.length,"unknown units remain separate"],
    ["Unmapped items",(p.unmappedItemIds||[]).length,"items",p.unmappedItemIds?.length?"warning":""],
    ["Partially mapped",(p.partiallyAllocatedItemIds||[]).length,"items",p.partiallyAllocatedItemIds?.length?"warning":""],
    ["Over-allocated",(p.overAllocatedItemIds||[]).length,"items",p.overAllocatedItemIds?.length?"danger":""]
  ]);
  const diagnostics='<div class="notice info"><b>BOQ source: '+escapeHtml(p.boqSource?.sourceFilename||"Source reference in calculation detail")+'</b> · '+escapeHtml(humanizeKey(p.boqSource?.state||"source"))+'<p>'+escapeHtml(p.boqSource?.explanation||"")+'</p>BOQ loaded: '+escapeHtml(fmt(p.boqItemCount??boqItemCount))+' items; known contract quantities: '+escapeHtml(fmt(p.knownQuantityItemCount))+'. Candidate mapping: '+escapeHtml(humanizeKey(p.candidateMappingState||"not_established"))+'. Actual installations are independent of schedule mapping. Scenario plans do not become confirmed facts.</div>';
  if(mappedSeries.length===0){
    const candidates=p.inferredMapping?.selectedScenarioLinks?.length||0;
    const mappingSummary=boqItemCount===null?"BOQ item population is not confirmed.":fmt(mappedItemCount||0)+" of "+fmt(boqItemCount)+" BOQ items currently have an allocation.";
    return '<section class="planning-view quantity-view">'+top+diagnostics+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Installed Quantities</h4><p>BOQ quantities are shown by unit. Schedule mapping is required for planned curves; measured installed quantities require dated quantity evidence.</p></div></div><div class="planning-panel-body"><div class="notice warn"><b>No confirmed quantity curve is available.</b> '+escapeHtml(candidates?candidates+" candidate link(s) were found, but they remain scenarios and are not used as project facts.":"No defensible BOQ-to-activity crosswalk is established.")+" "+escapeHtml(mappingSummary)+'</div>'+moduleEvidenceGate([
      {label:"BOQ quantity basis",value:p.boqRevisionId?"Loaded":"Unresolved",state:p.boqRevisionId?"ready":"missing"},
      {label:"Confirmed BOQ-to-activity links",value:p.mappingBasis==="governed"?"Established":"Unresolved",state:p.mappingBasis==="governed"?"ready":"missing"},
      {label:"Installed quantity history",value:"Dated installed measurements not confirmed",state:"missing"}
    ])+'</div></section></section>';
  }

  const charts=mappedSeries.map(series=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(series.unit||series.unitKey||"Unit")+' quantity curve</h4><p>'+escapeHtml(fmt(series.itemCount))+' BOQ item(s) in this unit · mapping coverage '+escapeHtml(series.mappingCoveragePercent===null?"—":fmt(series.mappingCoveragePercent)+"%")+'</p></div><span class="badge '+(p.mappingBasis==="governed"?"ready":"partial")+'">'+escapeHtml(p.mappingBasis==="governed"?"Confirmed mapped plan":p.mappingBasis==="candidate_scenario"?"Scenario plan; measured actual separate":"Measured actual; plan mapping missing")+'</span></div><div class="planning-panel-body">'+renderLineChart(series.points||[],[
    {key:"baselinePlannedQuantity",label:series.authority==="scenario_mapping"?"Scenario baseline plan":"Mapped baseline plan",color:"#506579"},
    {key:"currentForecastQuantity",label:series.authority==="scenario_mapping"?"Scenario current plan":"Mapped current plan",color:"#4f7fb4"},
    {key:"actualInstalledQuantity",label:"Measured installed quantities",step:true,color:"#2c7a57"}
  ],null,{unit:series.unit||series.unitKey||"",yLabel:"Cumulative quantity",xLabel:"Reporting date",dataDateIso:p.dataDateIso,ariaLabel:(series.unit||series.unitKey||"Quantity")+" S-Curve"})+'</div></section>').join("");
  return '<section class="planning-view quantity-view">'+top+diagnostics+charts+'</section>';
}
function renderLookAheadVisual(data){
  const p=projectionFor(data,"lookahead_schedule");
  if(!Array.isArray(p.rows))return"";
  const inWindow=p.rows.length;
  const kpis=planningKpis([
    ["Look-ahead",p.windowDays+" calendar days",planningShortDate(p.dataDateIso)+" → "+planningShortDate(p.windowEndIso)],
    ["Activities",inWindow,"in look-ahead"],
    ["Finish overdue",p.overdueCount,"open execution activities","danger"],["Missed planned starts",p.missedStartCount,"not started by planned start","warning"],
    ["Readiness confirmed",p.readyCount,"evidence complete; other activities may have missing records","success"],
    ["Activities with evidence gaps",p.evidenceGapActivityCount,"includes blocked activities","warning"],["Blocked with evidence gaps",p.blockedWithEvidenceGapCount,"Also included in the blocked count","warning"],["Blocker occurrences",p.blockerOccurrenceCount,"may include several per activity","warning"],
    ["Known blocker",p.blockedCount,"at least one explicit blocker","danger"]
  ]);
  const coverageHtml=experienceDisclosure("Readiness evidence coverage",moduleBarList((p.readinessCoverage||[]).map(row=>({label:humanizeKey(row.key)+" · "+fmt(row.knownCount)+" known / "+fmt(row.denominator)+" · "+fmt(row.linkedActivityCount??0)+" linked activities / "+fmt(row.linkedSourceRecordCount??0)+" records",value:row.coveragePercent})),"accent","%"),"Linked records can still have unresolved timing or status");
  const timeline=planningLookAheadTimeline(p);
  const dimensions=["predecessor","procurement_material","design_submittal","permit","resource","quality","commercial","risk","access"];
  const labels={predecessor:"Predecessors",procurement_material:"Materials",design_submittal:"Design / RFIs / Submittals",permit:"Permit",resource:"Resources",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const watch=[...p.rows].sort((a,b)=>{
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
  return '<section class="planning-view lookahead-view">'+kpis+coverageHtml+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>6-week execution view</h4><p>Showing the 36 highest-priority activities from '+escapeHtml(fmt(inWindow))+' activities. The label at right states the actual blocker or whether evidence is still missing.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness position</h4><p>A known blocker is different from missing readiness evidence.</p></div></div><div class="planning-panel-body">'+readiness+'<div class="coverage-line"><span>Date coverage</span><b>'+escapeHtml(p.currentDateCoveragePercent===null?"—":fmt(p.currentDateCoveragePercent)+"%")+'</b></div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Why work is blocked</h4><p>Explicit blocker occurrences. Predecessor checks assess relationship anchors, working-calendar lag and submitted date fit; unfinished work alone is not a blocker.</p></div></div><div class="planning-panel-body">'+blockers+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness matrix</h4><p>All activities in the window. Search an activity, deliverable or package. Open a cell to read its source date and reason.</p></div></div><div class="planning-panel-body"><label class="register-search">Find a readiness record <input type="search" data-register-filter placeholder="Activity, deliverable, package or reason" aria-label="Filter readiness records"></label><span class="register-search-count" aria-live="polite">'+fmt(watch.length)+' activities</span><div class="table-wrap readiness-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Overall</th>'+dimensions.map(key=>'<th>'+escapeHtml(labels[key])+'</th>').join("")+'</tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderForecastVisual(data){
  const p=projectionFor(data,"independent_forecast");
  if(!("independentForecastCompletionIso" in p))return"";
  const rawProb=p.probabilistic||{};
  const review=p.managementReviewState==="review_required"||!p.complete;
  const prob=review?{}:rawProb;
  const variance=planningCalendarDaysBetween(p.sourceForecastCompletionIso,p.independentForecastCompletionIso);
  const kpis=planningKpis([
    ["Contractor Programme Forecast",planningShortDate(p.sourceForecastCompletionIso),"submitted programme"],
    ["Source Productivity Forecast",planningShortDate(p.sourceProductivityForecastCompletionIso),p.sourceProductivityForecastCompletionIso?"source evidence / derived forecast":"Unresolved",p.sourceProductivityForecastState==="conflicted"?"danger":p.sourceProductivityForecastState==="candidate"?"warning":""],
    ["Programme calendar recalculation",p.unresolvedActivityCount>0?"Unresolved: "+fmt(p.unresolvedActivityCount)+" activities":planningShortDate(p.independentForecastCompletionIso),review?"requires reconciliation":"deterministic CMeng calculation",review?"warning":"accent"],
    ["Programme calendar recalculation vs submitted",p.unresolvedActivityCount>0?"Unresolved: "+fmt(p.unresolvedActivityCount)+" activities":variance===null?"Unresolved":(variance>0?"+":"")+fmt(variance)+" days","model reconciliation; not delay",""],
    ["CPM activity coverage",p.activityCoveragePercent===null?"—":fmt(p.activityCoveragePercent)+"%",p.activityPopulation?fmt(p.calculatedActivityCount)+" / "+fmt(p.activityPopulation.denominator)+" execution activities; "+fmt(p.activityPopulation.excludedCount)+" LOE / WBS records excluded":"calculated schedule inputs; not resource or quantity coverage"],
    ["Required finish",planningShortDate(p.requiredFinishIso),"contract/target if established"]
  ]);
  const constraintTrace=p.sourceConstraints?.length?'<details class="notice info"><summary>'+escapeHtml(fmt(p.sourceConstraints.length))+' activities have source constraints · unconstrained calculation</summary><p>Retained source constraints have not been applied to this execution-network result. This is a calculation scope limitation requiring reconciliation, not a request for missing contractor documents.</p><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Source constraint</th><th>Date</th></tr></thead><tbody>'+p.sourceConstraints.flatMap(a=>(a.constraints||[]).map(c=>'<tr><td>'+escapeHtml(a.activityId)+'</td><td>'+escapeHtml(c.type)+'</td><td>'+escapeHtml(c.dateIso||'Unresolved')+'</td></tr>')).join('')+'</tbody></table></div></details>':'';
  const warning=constraintTrace+(review?'<div class="notice warn"><b>Independent forecast requires reconciliation before management use.</b><br>'+escapeHtml(p.managementReviewReason||"The deterministic CPM basis contains unresolved evidence.")+'</div>':'');
  const forecastDistance=[
    {label:"Contractor Programme Forecast",value:planningCalendarDaysBetween(p.dataDateIso,p.sourceForecastCompletionIso),tone:"graphite"},
    {label:"Source Productivity Forecast",value:planningCalendarDaysBetween(p.dataDateIso,p.sourceProductivityForecastCompletionIso),tone:"warning"},
    {label:"Programme calendar recalculation",value:planningCalendarDaysBetween(p.dataDateIso,p.independentForecastCompletionIso),tone:"accent"},
    {label:"P50 duration sensitivity",value:planningCalendarDaysBetween(p.dataDateIso,prob.p50CompletionIso),tone:"teal"},
    {label:"P80 duration sensitivity",value:planningCalendarDaysBetween(p.dataDateIso,prob.p80CompletionIso),tone:"purple"},
    {label:"P90 duration sensitivity",value:planningCalendarDaysBetween(p.dataDateIso,prob.p90CompletionIso),tone:"danger"}
  ].filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)&&item.value>=0);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Forecast distance from Data Date","All forecast positions translated to a common time distance without merging their authority.",renderVisualBars(forecastDistance,"d"))+
    renderVisualPanel("Forecast variance comparison","Deterministic and source-productivity differences retain their own basis.",renderWaterfallChart([
      {label:"CMeng vs Contractor",value:typeof variance==="number"?variance:null},
      {label:"Source productivity vs Contractor",value:(p.sourceProductivityForecastCompletionIso&&p.sourceForecastCompletionIso)?planningCalendarDaysBetween(p.sourceForecastCompletionIso,p.sourceProductivityForecastCompletionIso):null},
      {label:"P80 vs CMeng CPM",value:(prob.p80CompletionIso&&p.independentForecastCompletionIso)?planningCalendarDaysBetween(p.independentForecastCompletionIso,prob.p80CompletionIso):null}
    ],"d"))+
  '</div>';
  const dateLadder=planningDateLadder([
    {label:"Contractor Programme Forecast",date:p.sourceForecastCompletionIso,tone:"current"},
    {label:"Source Productivity Forecast",date:p.sourceProductivityForecastCompletionIso,tone:"scenario"},
    {label:"Programme calendar recalculation",date:p.independentForecastCompletionIso,tone:"cmeng"},
    {label:"Required finish",date:p.requiredFinishIso,tone:"baseline"}
  ],p.dataDateIso);
  const probPanel=review?'<p>P50, P80 and P90 are withheld until the calendar model is reconciled.</p>':'<div class="position-grid">'+[
      ["P50 duration sensitivity",review?"Suppressed":planningShortDate(prob.p50CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"],
      ["P80 duration sensitivity",review?"Suppressed":planningShortDate(prob.p80CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"],
      ["P90 duration sensitivity",review?"Suppressed":planningShortDate(prob.p90CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"]
    ].map(c=>'<div class="position-card '+(review?"review":"")+'"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1])+'</div><div class="position-sub">'+escapeHtml(c[2])+'</div></div>').join("")+'</div>'+
    (review?'<div class="notice info" style="margin-top:12px">P50/P80/P90 values are intentionally suppressed while the deterministic independent finish is under reconciliation. The forecast taxonomy remains visible without publishing unsupported dates.</div>':'');
  const forecastDrivers=(p.activities||[]).filter(r=>typeof r.finishVarianceDays==='number').sort((a,b)=>Math.abs(b.finishVarianceDays)-Math.abs(a.finishVarianceDays)).slice(0,10);
  const diagnostics='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Programme calendar recalculation evidence</h4><p>Largest calculated finish differences identify rows to investigate. They do not establish the cause of the project forecast gap.</p></div></div><div class="planning-panel-body"><div class="notice info">'+escapeHtml((p.diagnostics||[]).map(humanizeKey).join('; ')||'Review the calendar and constraint assumptions below.')+'<br>'+escapeHtml((p.assumptions||[]).map(humanizeKey).join('; '))+'</div><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Submitted finish</th><th>Programme calendar recalculation</th><th>Elapsed movement d</th><th>Calendar mode</th><th>Calculation state</th></tr></thead><tbody>'+forecastDrivers.map(r=>'<tr><td>'+escapeHtml(r.activityId)+'</td><td>'+escapeHtml(planningShortDate(r.sourceFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.independentEarlyFinishIso))+'</td><td>'+escapeHtml(fmt(r.finishVarianceDays))+'</td><td>'+escapeHtml(humanizeKey(r.calendarMode))+'</td><td>'+escapeHtml(humanizeKey(r.status))+'</td></tr>').join('')+'</tbody></table></div></div></section>';
  return '<section class="planning-view independent-forecast-view">'+kpis+warning+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Completion positions and contractual target</h4><p>Contractor programme, source productivity, CMeng deterministic CPM and the contractual target remain separate.</p></div><span class="badge '+(review?"partial":"ready")+'">'+escapeHtml(review?"Reconciliation required":"Calculated")+'</span></div><div class="planning-panel-body">'+dateLadder+'</div></section><details><summary>Alternative forecast-distance charts</summary>'+visualOverview+'</details><section class="planning-panel"><div class="planning-panel-head"><div><h4>Limited duration sensitivity</h4><p>Global triangular duration-factor sensitivity (0.9 / 1.0 / 1.25), not a network risk model. Requires a reconciled deterministic basis.</p></div></div><div class="planning-panel-body">'+probPanel+'</div></section>'+diagnostics+'</section>';
}
function renderWindowsVisual(data){
  const p=projectionFor(data,"windows_analysis");
  if(!Array.isArray(p.windows))return"";
  const labels=p.revisionLabels||{};
  const bars=p.windows.map(w=>{const value=w.sourceForecastMovementDays??w.scheduleBoundaryMovementDays??null;return {label:"Window "+w.sequence,value,tone:value===null?"neutral":value>0?"danger":value<0?"success":"neutral"}});
  const cards=p.windows.map(w=>{
    const sourceMove=w.sourceForecastMovementDays??w.scheduleBoundaryMovementDays;
    const independent=w.independentForecastMovementDays;
    const from=shortRevision(w.fromRevisionId,labels),to=shortRevision(w.toRevisionId,labels);
    return '<div class="window-card clean"><div><div class="window-id">Window '+escapeHtml(w.sequence)+' · '+escapeHtml(from)+' → '+escapeHtml(to)+'</div><div class="window-dates">'+escapeHtml(planningShortDate(w.windowStartIso))+' → '+escapeHtml(planningShortDate(w.windowEndIso))+'</div></div><div><div class="movement-label">Submitted forecast movement</div><div class="movement-value">'+escapeHtml(sourceMove===null?"—":(sourceMove>0?"+":"")+fmt(sourceMove)+" days")+'</div><div class="muted">Progress movement '+escapeHtml(w.progressMovementPercent===null?"—":(w.progressMovementPercent>0?"+":"")+fmt(w.progressMovementPercent)+" pp")+'</div></div><div><div class="movement-label">Programme calendar recalculation movement</div><div class="movement-value small">'+escapeHtml(independent===null?"Not calculated in this view":(independent>0?"+":"")+fmt(independent)+" days")+'</div><div class="muted">'+escapeHtml((w.delayEvents||[]).length+" temporally associated event(s)")+'</div></div></div>';
  }).join("");
  const note='<div class="notice info"><b>Analytical movement, submitted window movement and Project Completion movement are different measures.</b> Gross analytical movement comes from the independent recalculation. Positive submitted window movement sums positive revision-to-revision submitted completion shifts. Project Completion movement is the net first-to-latest submitted completion shift. None is automatically delay entitlement or EOT.</div>'+(p.windows.some(w=>w.independentForecastMovementDays===null)?'<div class="notice info">Programme calendar recalculation is unresolved where the calculation is unavailable.</div>':'');
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Window movement by interval","Every revision-to-revision submitted finish movement is signed. Right is later; left is earlier.",renderWaterfallChart(bars,"d"))+
    renderVisualPanel("Window completeness","Schedule-comparison completion is separate from event linkage, causation and entitlement.",renderDonutChart([
      {label:"Schedule comparison complete",value:p.completeWindowCount||0,tone:"success"},
      {label:"Partial",value:p.partialWindowCount||0,tone:"warning"},
      {label:"Other",value:Math.max(0,(p.windowCount||0)-(p.completeWindowCount||0)-(p.partialWindowCount||0)),tone:"neutral"}
    ],"Windows"))+
  '</div>';
  return '<section class="planning-view windows-view">'+planningKpis([
    ["Windows",p.windowCount,"revision intervals"],
    ["Schedule-comparison windows",p.completeWindowCount,"calculation complete; causation unproven"],
    ["Partial windows",p.partialWindowCount,"",p.partialWindowCount?"warning":""],
    ["Gross analytical movement",fmt(p.grossAnalyticalMovementDays)+" d","independent recalculation; not project delay or EOT",p.grossAnalyticalMovementDays>0?"warning":""],
    ["Positive submitted window movement",fmt(p.positiveProgrammeMovementDays)+" d","sum of positive submitted completion shifts; net Project Completion remains separate",p.positiveProgrammeMovementDays>0?"warning":""],
    ["Project Completion movement",p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"—":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","first controlled → latest controlled · "+humanizeKey(p.projectCompletionMovementBasis||"unavailable"),p.projectCompletionMovementDays>0?"danger":""],
    ["Window-associated events",p.windows.reduce((sum,w)=>sum+(w.delayEvents||[]).length,0),"window references"]
  ])+note+visualOverview+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme movement by window</h4><p>Source forecast movement is shown first. It is schedule movement, not automatic delay entitlement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(bars,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window detail</h4></div></div><div class="planning-panel-body"><div class="window-strip">'+cards+'</div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window comparison evidence</h4><p>Matching coverage and network edits qualify the schedule comparison. They do not establish causation or an approved materiality tolerance.</p></div></div><div class="planning-panel-body">'+p.windows.map(w=>'<details><summary>Window '+escapeHtml(w.sequence)+' · matched '+escapeHtml(fmt(w.matchedActivityCount))+' activities · comparable finishes '+escapeHtml(fmt(w.comparableActivityFinishShiftCount))+' ('+escapeHtml(w.activityFinishShiftCoveragePercent==null?'Unresolved':fmt(w.activityFinishShiftCoveragePercent)+'%')+')</summary><p>Activities added / removed / modified: '+escapeHtml(fmt(w.addedActivityCount)+' / '+fmt(w.removedActivityCount)+' / '+fmt(w.modifiedActivityCount))+'. Relationships added / removed: '+escapeHtml(fmt(w.addedRelationshipCount)+' / '+fmt(w.removedRelationshipCount))+'.</p><p>'+escapeHtml((w.diagnostics||[]).map(humanizeKey).join('; ')||'No calculation diagnostic was supplied.')+'</p><p>'+escapeHtml((w.assumptions||[]).join('; '))+'</p></details>').join('')+'</div></section></section>';
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
function renderDelayClaimsVisual(data){
  const p=delayClaimsProjectionFor(data);
  const reporting=data?.claimsReporting||null;
  const sourceEventCount=reporting?.events?.population?.sourceCount??reporting?.events?.source?.length??null;
  const currentEventCount=reporting?.events?.asOf?.length??p.eventCount??null;
  const futureEventCount=reporting?.events?.future?.length??null;
  const undatedEventCount=reporting?.events?.undated?.length??null;
  const events=Array.isArray(p.events)?p.events:[];
  const linkedClaimIds=new Set(events.flatMap(event=>event.linkedClaimIds||[]));
  const linked=p.linkedClaimCount??linkedClaimIds.size;
  const unlinked=p.unlinkedClaimCount??Math.max(0,(p.claimCount||0)-linked);
  const activityGapCount=p.activityEvidenceInsufficientEventCount??events.filter(e=>(e.relatedActivityIds||[]).length===0).length;
  const incompleteDeterminationCount=p.determinationChainIncompleteEventCount??events.filter(e=>e.evidenceChainState==="determination_chain_incomplete").length;
  const movementEstablished=p.windowCount>0&&typeof p.observedPositiveProgrammeMovementDays==="number";
  const kpis=planningKpis([
    ["Current delay events",currentEventCount,"evidenced by the Data Date",currentEventCount?"":"warning"],
    ["Source delay-event rows",sourceEventCount===null?"Unresolved":sourceEventCount,"full retained source population"],
    ["After Data Date",futureEventCount===null?"Unresolved":futureEventCount,"retained outside current position"],
    ["Event date missing",undatedEventCount===null?"Unresolved":undatedEventCount,"retained but excluded from current position",undatedEventCount?"warning":""],
    ["Claims",p.contractorClaimEvidenceSubmitted===false&&p.claimCount===0?"Unresolved":p.claimCount,"claim records"],
    ["Claims linked to events",linked,"identity association; causation unproven",linked?"accent":"warning"],
    ["Claims without event links",unlinked,"identity gap; linked claims still need causation",unlinked?"warning":""],
    ["Events linked to activities",p.activityLinkedEventCount??0,"schedule linkage"],
    ["Activity evidence gaps",activityGapCount,"fail-closed source gaps",activityGapCount?"warning":""],
    ["Events linked to windows",p.windowLinkedEventCount??0,"temporal association; not causation"],
    ["Events with register notice references",p.noticeLinkedEventCount??0,"letter identity and contents require separate checks"],
    ["Determined events",p.determinationLinkedEventCount??0,"Engineer determination linkage"],
    ["Incomplete determination chains",incompleteDeterminationCount,"required links missing",incompleteDeterminationCount?"warning":""],
    ["Gross analytical movement",movementEstablished?fmt(p.observedPositiveIndependentMovementDays)+" d":"Unresolved","independent window recalculation; not event attribution",movementEstablished&&p.observedPositiveIndependentMovementDays?"warning":""],
    ["Positive submitted window movement",movementEstablished?fmt(p.observedPositiveProgrammeMovementDays)+" d":"Unresolved","positive submitted programme shifts; not event attribution",movementEstablished&&p.observedPositiveProgrammeMovementDays?"warning":""],
    ["Project Completion movement",!movementEstablished||p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"Unresolved":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net submitted completion movement"]
  ]);
  const noEventWarning=p.eventCount===0&&p.claimCount>0?'<div class="notice warn"><b>'+escapeHtml(fmt(p.claimCount))+' claim records are present, but no recorded delay events are established.</b> CMeng will not attribute schedule movement, responsibility or EOT entitlement to those claims until event linkage exists.</div>':'';
  const activityEvidenceWarning=activityGapCount>0?'<div class="notice warn"><b>Activity evidence not confirmed for '+escapeHtml(fmt(activityGapCount))+' delay event'+(activityGapCount===1?'':'s')+'.</b> The available claim/correspondence sources do not establish a defensible activity-level relationship for these events. The affected activities must be identified before assigning delay responsibility. Determination chains remain explicitly incomplete where the activity link is required.</div>':'';
  const populationNote=reporting?'<div class="notice info"><b>Source population is preserved.</b> Current counts include only delay events evidenced by the project Data Date. Later and undated source rows remain visible as separate populations and are not discarded or promoted into the current position.</div>':'';
  const warning=populationNote+noEventWarning+activityEvidenceWarning;
  const linkage=planningStatusBand([
    ["Linked to delay events",linked,"success"],
    ["Not linked to delay events",unlinked,"warning"]
  ]);
  const chainChart=renderVisualBars([
    {label:"Claim-linked events",value:p.claimLinkedEventCount??0,tone:"success"},
    {label:"Activity-linked events",value:p.activityLinkedEventCount??0,tone:"accent"},
    {label:"Window-linked events",value:p.windowLinkedEventCount??0,tone:"warning"},
    {label:"Register notice references",value:p.noticeLinkedEventCount??0,tone:"teal"},
    {label:"Determination-linked events",value:p.determinationLinkedEventCount??0,tone:"purple"}
  ],"events");
  const movementChart=renderWaterfallChart([
    {label:"Gross analytical movement",value:movementEstablished&&typeof p.observedPositiveIndependentMovementDays==="number"?p.observedPositiveIndependentMovementDays:null},
    {label:"Positive submitted window movement",value:movementEstablished&&typeof p.observedPositiveProgrammeMovementDays==="number"?p.observedPositiveProgrammeMovementDays:null},
    {label:"Net Project Completion movement",value:movementEstablished&&typeof p.projectCompletionMovementDays==="number"?p.projectCompletionMovementDays:null}
  ],"d");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Evidence-chain coverage","How far the confirmed claim/event population is connected into schedule, windows, notices and determinations.",chainChart)+
    renderVisualPanel("Schedule movement semantics","Gross positive window movement and net Project Completion movement are shown as different analytical measures.",movementChart)+
  '</div>';
  const classes=claimStateCounts(events.map(e=>({state:e.candidateClass})));
  const rows=events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(humanizeKey(e.responsibility))+'</td><td>'+escapeHtml(humanizeKey(e.noticeTimeliness))+'</td><td>Not causally attributed</td><td><span class="state-pill '+(e.evidenceChainMissingLinks?.length||e.concurrencyCandidate?"review":"ready")+'">'+escapeHtml(humanizeKey(e.evidenceChainState||e.candidateClass))+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.relatedActivityIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.overlappingWindowIds||[]).map(id=>readableWindow(id,p.revisionLabels||{})).join(", ")||"—")+'</td><td>'+escapeHtml((e.noticeIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.determinationIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.evidenceChainMissingLinks||[]).map(humanizeKey).join(", ")||"—")+'</td></tr>').join("");
  const detail=events.length?'<div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Notice status</th><th>Schedule attribution</th><th>Evidence chain</th><th>Claims</th><th>Activities</th><th>Windows</th><th>Notices</th><th>Determinations</th><th>Missing links</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-visual">No delay-event population is established. Claim records alone are not converted into delay events.</div>';
  const classVisual=events.length?moduleBarList(classes,"warning"):'<div class="empty-visual">Event responsibility cannot be classified until delay events are established.</div>';
  return '<section class="planning-view delay-claims-view">'+kpis+warning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Claim-event linkage</h4><p>Claims without a confirmed delay-event link remain un-attributed.</p></div></div><div class="planning-panel-body">'+linkage+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Event assessment classes</h4><p>Responsibility classification is shown only for established delay events.</p></div></div><div class="planning-panel-body">'+classVisual+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Delay-event detail</h4></div></div><div class="planning-panel-body">'+'<details><summary>Review '+fmt(events.length)+' event records and missing links</summary><p>Window IDs identify temporal context. A window movement is not allocated to each event.</p>'+detail+'</details></div></section></section>';
}
function renderEotVisual(data){
  const p=projectionFor(data,"eot_assessment");
  if(!Array.isArray(p.windowCandidates))return"";
  const contractReady=p.contractTimeBasisEstablished===true;
  const causalReady=p.eligibleCausalEventEvidenceEstablished===true;
  const analytical=p.analyticalTimeImpactCandidateDays;
  const movementEstablished=p.windowCandidates.length>0;
  const kpis=planningKpis([
    ["Contract finish",p.contractualCompletionIso?planningShortDate(p.contractualCompletionIso):"Unresolved",p.contractualCompletionState,contractReady?"":"warning"],
    ["Submitted finish vs contract",planningCalendarDaysBetween(p.contractualCompletionIso,p.sourceForecastCompletionIso)===null?"Unresolved":fmt(planningCalendarDaysBetween(p.contractualCompletionIso,p.sourceForecastCompletionIso))+" calendar days","submitted programme minus current amended contract","warning"],
    ["Gross determinations by Data Date",p.officialApprovedEotDays===null?"Unresolved":fmt(p.officialApprovedEotDays)+" d","may already be incorporated in the amendment"],
    ["Further adjusted contractual completion",p.officialAdjustedCompletionIso?planningShortDate(p.officialAdjustedCompletionIso):"Unresolved","confirmed only"],
    ["Positive submitted window movement",movementEstablished?fmt(p.observedProgrammeMovementDays)+" d":"Unresolved","sum of positive submitted completion shifts; not EOT",movementEstablished&&p.observedProgrammeMovementDays>0?"warning":""],
    ["Project Completion movement",!movementEstablished||p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"Unresolved":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net first-to-latest submitted completion"],
    ["Time-impact candidate",analytical===null?"Unresolved":fmt(analytical)+" d","requires causation",analytical===null?"warning":"accent"],
    ["Attributable EOT candidate",p.attributableCandidateEotDays===null?"Unresolved":fmt(p.attributableCandidateEotDays)+" d","not an award",p.attributableCandidateEotDays===null?"warning":"accent"]
  ]);
  const warning=movementEstablished&&analytical===null&&p.observedProgrammeMovementDays>0?'<div class="notice warn"><b>Positive submitted window movement is not project delay and is not EOT.</b> Schedule movement is not an EOT time-impact assessment. CMeng observes '+escapeHtml(fmt(p.observedProgrammeMovementDays))+' days when positive window shifts are summed, while net Project Completion movement is shown separately. No entitlement is stated until causation, notice and the contract time basis support it.</div>':'';
  const labels=p.revisionLabels||{};
  const movementBars=p.windowCandidates.map((w,index)=>({
    label:"Window "+(index+1)+" · "+readableWindow(w.windowId,labels),
    value:typeof w.positiveIndependentMovementDays==="number"?w.positiveIndependentMovementDays:null,
    tone:"warning"
  }));
  const rows=p.windowCandidates.map(w=>'<tr><td><b>'+escapeHtml(readableWindow(w.windowId,labels))+'</b></td><td>'+escapeHtml(fmt(w.positiveProgrammeMovementDays))+'</td><td>'+escapeHtml(humanizeKey(w.programmeMovementBasis))+'</td><td>'+escapeHtml(w.analyticalTimeImpactCandidateDays===null?"—":fmt(w.analyticalTimeImpactCandidateDays))+'</td><td>'+escapeHtml(humanizeKey(w.state))+'</td><td>'+escapeHtml(fmt(w.includedCandidateDays))+'</td><td>'+escapeHtml((w.reasons||[]).map(managementReason).join("; ")||"—")+'</td></tr>').join("");
  const recon=p.timeBasisReconciliation;
  const determinationVisual=recon?renderDonutChart([
    {label:"Effective by Data Date",value:recon.effectiveDeterminationCount||0,tone:"success"},
    {label:"After Data Date",value:Math.max(0,(recon.registerDeterminationCount||0)-(recon.effectiveDeterminationCount||0)),tone:"neutral"}
  ],"Determinations"):'<div class="empty-visual">Determination population is not confirmed.</div>';
  const movementVisual=renderWaterfallChart([
    {label:"Positive submitted window movement",value:movementEstablished&&typeof p.observedProgrammeMovementDays==="number"?p.observedProgrammeMovementDays:null},
    {label:"Net Project Completion movement",value:movementEstablished&&typeof p.projectCompletionMovementDays==="number"?p.projectCompletionMovementDays:null},
    {label:"Analytical time-impact candidate",value:typeof analytical==="number"?analytical:null},
    {label:"Attributable EOT candidate",value:typeof p.attributableCandidateEotDays==="number"?p.attributableCandidateEotDays:null}
  ],"d");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Time-position comparison","Schedule movement, time-impact analysis and EOT candidate remain separate measures.",movementVisual)+
    renderVisualPanel("Determination timing","Engineer determinations split by the current programme Data Date.",determinationVisual)+
  '</div>';
  const reconciliation=recon?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Amendment and determination reconciliation</h4><p>As-of date: '+escapeHtml(planningShortDate(recon.dataDateIso))+'.</p></div></div><div class="planning-panel-body">'+planningKpis([["EOT incorporated in amendment",fmt(recon.incorporatedEotDays)+" d","already inside revised completion"],["Full determination register",fmt(recon.registerDeterminationDays)+" d",(recon.registerDeterminationCount===null||recon.registerDeterminationCount===undefined?"population not stated":fmt(recon.registerDeterminationCount)+" immutable determination(s)")],["Determinations by Data Date",recon.effectiveDeterminationCount===null||recon.effectiveDeterminationCount===undefined?"—":fmt(recon.effectiveDeterminationCount),"cutoff-controlled population"],["Additional approved EOT",recon.additionalApprovedEotDays===null?"Unresolved":fmt(recon.additionalApprovedEotDays)+" d","never register total plus amendment"]])+'<div class="notice warn">'+(recon.overlapResolution==="unresolved"?"Amendment incorporation has not been reconciled to the determination register. No additional days are applied to the revised contractual completion.":"Additional awards have an explicit incorporation reconciliation.")+'</div></div></section>':"";
  return '<section class="planning-view eot-view">'+kpis+reconciliation+warning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme calendar recalculation movement by window</h4><p>Analytical revision-to-revision CPM movement; not submitted movement or EOT entitlement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(movementBars,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>EOT assessment requirements</h4><p>Confirm the applicable clause, notice, responsibility and time impact before assessing an extension of time.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Contract time basis",value:contractReady?"Established":"Unresolved",state:contractReady?"ready":"missing"},
    {label:"Causally attributable EOT-eligible events",value:causalReady?"Established":"Unresolved",state:causalReady?"ready":"missing"},
    {label:"Gross determined days by Data Date",value:p.officialApprovedEotState==="official"?"Established":"Unresolved",state:p.officialApprovedEotState==="official"?"ready":"missing"}
  ])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window assessment</h4><p>Observed movement, candidate time impact and included entitlement days remain separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Window</th><th>Observed movement d</th><th>Movement basis</th><th>Time-impact candidate d</th><th>State</th><th>Included days</th><th>Reason</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
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
  const sharedLabels=${JSON.stringify(STATUS_LABELS)};if(sharedLabels[value])return sharedLabels[value];
  const labels={
    ready:"Ready",partial:"Review needed",blocked:"Blocked",
    completed:"Completed",in_progress:"In progress",not_started:"Not started",unknown:"Unknown",
    critical:"Critical",near_critical:"Near-critical",noncritical:"Other",
    available:"Available",missing:"Not provided",conditional:"Conditional",
    true:"Yes",false:"No",established:"Established",not_established:"Unresolved",
    deterministic:"Calculated",scenario:"Scenario",unresolved:"Needs review"
  };
  const key=String(value);
  return labels[key]||humanizeKey(key);
}
function planningKpis(items){
  return '<div class="planning-kpi-grid">'+items.map(item=>{
    const label=item[0],value=item[1],sub=item[2]||"",tone=item[3]||"";
    return '<div class="planning-kpi '+escapeHtml(tone)+(value==null||/^(Not |—|Suppressed|Missing|Mapping not)/i.test(String(value))?' unavailable':'')+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"Unresolved":fmt(value))+'</strong>'+(sub?'<small>'+escapeHtml(sub)+'</small>':'')+'</div>';
  }).join("")+'</div>';
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
  const kpis=planningKpis([
    ["Baseline finish",planningShortDate(p.programmeBaselineCompletionIso),"controlled baseline",""],
    ["Submitted finish",planningShortDate(p.forecast.sourceCompletionIso),"current programme",""],
    ["Critical",p.schedule.criticalCount,"activities","danger"],
    ["Near-critical",p.schedule.nearCriticalCount,"activities","warning"],
    ["Negative float",p.schedule.negativeFloatCount,"activities","danger"],
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
      {label:"Critical",value:p.schedule.criticalCount||0,tone:"danger"},
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
      ["Assigned resources",p.resources.assignedResourceCount],["Capacity field coverage · supplied resource-week rows",p.resources.weeklyCapacityCoveragePercent===null?"—":fmt(p.resources.weeklyCapacityCoveragePercent)+"%"],["Actual overloads through DD",p.resources.capacityChecksToDataDate?fmt(p.resources.capacityChecksToDataDate.actual.exceededCount)+" / "+fmt(p.resources.capacityChecksToDataDate.actual.comparableCount)+" resource-weeks":"Unresolved"],["BOQ/activity link",planningStateLabel(p.quantities.allocationState)]
    ]],
    ["Claims & time",[
      ["Delay events",p.claims.eventCount],["Claims",p.claims.claimCount],["Recalculated window movement",fmt(p.claims.grossPositiveAnalyticalMovementDays)+" days · "+(p.claims.windowMovementTrace||[]).map(w=>fmt(w.calculatedDays)).join(" + ")],["Net submitted finish movement",fmt(p.claims.netSubmittedFinishMovementDays)+" days"],["Effective approved determinations at Data Date",fmt(p.claims.effectiveDeterminationDays)+" days"],["EOT incorporated in amendment",fmt(p.claims.incorporatedEotDays)+" days"],["Determination register total",fmt(p.claims.registerDeterminationDays)+" days"]
    ]]
  ].map(group=>'<div class="domain-card"><h5>'+escapeHtml(group[0])+'</h5>'+group[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return '<section class="planning-view management-view">'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date position</h4><p>Controlled baseline, submitted finish date and any independently calculated, approved or scenario finish dates.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel attention"><div class="planning-panel-head"><div><h4>What needs attention</h4><p>Items that can change the current programme position.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Schedule coverage is field coverage, not physical progress. Gross and net time movements have different bases; their difference is not proven overlap.</p></div></div><div class="planning-panel-body">'+health+'</div></section></section>';
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
    {label:"Critical",value:r.float.criticalCount,tone:"danger"},
    {label:"Near-critical",value:r.float.nearCriticalCount,tone:"warning"},
    {label:"Non-critical",value:Math.max(0,r.float.totalActivities-r.float.criticalCount-r.float.nearCriticalCount-r.float.unknownFloatCount-(r.float.nearCriticalThresholdUnresolvedCount||0)),tone:"accent"},
    {label:"Classification unknown",value:r.float.unknownFloatCount+(r.float.nearCriticalThresholdUnresolvedCount||0),tone:"neutral"}
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
  return '<section class="planning-view programme-review">'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Float, progress and logic quality across the current programme.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic checks</h4><p>Issues that reduce confidence in schedule sequencing.</p></div></div><div class="planning-panel-body">'+integrity+quality+'<p>Submitted Near Critical label: '+escapeHtml(fmt(p.controlBasis?.sourceReportedNearCriticalLabelCount))+'; strict confirmed near-critical: '+escapeHtml(fmt(r.float.nearCriticalCount))+'; float-risk watchlist: '+escapeHtml(fmt(r.float.floatRiskWatchlistCount))+'. These definitions are reconciled separately.</p></div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish dates</h4><p>Baseline, current forecast and actual finish dates are kept separate so one is not mistaken for another.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish variance</h4><p>Controlled-baseline comparison by '+escapeHtml(humanizeKey(variance.populationBasis||'execution_control'))+'. Denominator: '+escapeHtml(fmt(variance.denominator??r.population?.executableActivityCount))+'.</p></div></div><div class="planning-panel-body">'+varianceBand+distributionSummary(variance.distribution)+'<div class="coverage-line"><span>Variance coverage</span><b>'+escapeHtml(variance.coveragePercent===null||variance.coveragePercent===undefined?"—":fmt(variance.coveragePercent)+"%")+'</b></div></div></section></div></section>';
}
function renderMovementConcentration(m,fallback){
  if(!m)return planningSignedBars(fallback,"calendar days");
  const signed=v=>v==null?"Unresolved":(v>0?"+":"")+fmt(v)+" d";
  const c=m.comparison||{},pop=m.population||{},all=m.maximumRows||[];
  const rows=all.map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br>'+escapeHtml(r.name||"")+'</td><td>'+escapeHtml(humanizeKey(r.activityType))+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.previousFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td>'+escapeHtml(signed(r.baselineMovementDays))+'</td><td>'+escapeHtml(signed(r.previousMovementDays))+'</td><td>'+escapeHtml(r.sourcePairVerified?"Date pair reconciles":"Review required")+'</td></tr>').join("");
  return '<div class="notice info"><b>Comparison: '+escapeHtml(c.baselineLabel||"Controlled baseline")+' → '+escapeHtml(c.currentLabel||"Current programme")+'</b><br>Baseline-comparable population: '+escapeHtml(fmt(pop.denominator))+' / '+escapeHtml(fmt(pop.sourceCount))+' source records · '+escapeHtml(fmt(m.coveragePercent))+'% coverage.</div>'+planningKpis([
    ["Maximum movement",signed(m.distribution?.maximum),"calendar days vs each activity baseline"],["Activities sharing maximum",all.length,fmt(m.distribution?.maximumPercent)+"% of baseline-comparable population"],["Verified date pairs",m.sourcePairVerifiedCount,fmt(all.length)+" maximum rows inspected"],["Causation","Unresolved","movement is not attributable delay or EOT"]
  ])+'<div class="notice warn">'+escapeHtml(m.interpretation)+'</div><p><b>Activity types:</b> '+escapeHtml((m.activityTypes||[]).map(t=>fmt(t.count)+" "+humanizeKey(t.value)).join("; "))+'. <b>Baseline date patterns:</b> '+escapeHtml(fmt((m.baselineDatePatterns||[]).length))+'. <b>Current date patterns:</b> '+escapeHtml(fmt((m.currentDatePatterns||[]).length))+'. <b>WBS groups:</b> '+escapeHtml(fmt((m.wbsPatterns||[]).length))+'. Systematic revision shift: review required.</p>'+planningSignedBars((m.representatives||[]).map(r=>({label:r.activityId+" · "+(r.name||""),value:r.baselineMovementDays})),"calendar days")+'<p>Showing '+escapeHtml(fmt((m.representatives||[]).length))+' representatives of '+escapeHtml(fmt(all.length))+' at the maximum. Previous-revision comparison: '+escapeHtml(c.previousLabel||"Unresolved")+' → '+escapeHtml(c.currentLabel||"Current programme")+'.</p><details class="movement-cohort"><summary>View all '+escapeHtml(fmt(all.length))+' maximum-movement activities and date pairs</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Type</th><th>Controlled baseline finish</th><th>Previous revision finish</th><th>Current finish</th><th>Vs baseline</th><th>Vs previous revision</th><th>Source dates</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
}
function renderActivityAnalyticsVisual(data){
  const p=projectionFor(data,"activity_analytics");
  if(!Array.isArray(p.rows))return"";
  const executionRows=p.rows.filter(row=>!["level_of_effort","wbs_summary"].includes(row.activityType));
  const status={completed:0,in_progress:0,not_started:0,unknown:0};
  executionRows.forEach(r=>{status[r.status]=(status[r.status]||0)+1});
  const critical=executionRows.filter(r=>r.criticality==="critical").length;
  const near=executionRows.filter(r=>r.criticality==="near_critical").length;
  const unknownCriticality=executionRows.filter(r=>r.criticality==="unknown").length;
  const noncritical=executionRows.filter(r=>r.criticality==="noncritical").length;
  const floatRisk=executionRows.filter(r=>r.floatRiskWatchlist===true).length;
  const late=executionRows.filter(r=>typeof r.finishVarianceDays==="number"&&r.finishVarianceDays>0).length;
  const openLogic=executionRows.filter(r=>r.openStart||r.openFinish||r.isolated).length;
  const kpis=planningKpis([
    ["Programme records",p.rows.length,"full auditable register"],["Execution activities",executionRows.length,"excludes LOE and WBS summaries"],["Excluded execution types",p.rows.length-executionRows.length,"retained in source register"],
    ["Completed",status.completed,"activities","success"],
    ["In progress",status.in_progress,"activities","accent"],
    ["Critical",critical,"activities","danger"],
    ["Near-critical",near,"Near-critical float band","warning"],
    ["Float-risk watchlist",floatRisk,"includes critical boundary","accent"],
    ["Later than baseline",late,"activities","danger"]
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
      {label:"Critical",value:critical,tone:"danger"},
      {label:"Near-critical",value:near,tone:"warning"},
      {label:"Non-critical",value:noncritical,tone:"neutral"},
      {label:"Unknown",value:unknownCriticality,tone:"graphite"}
    ],"Activities"))+
  '</div>';
  const statusBand=planningStatusBand([
    ["Completed",status.completed,"success"],["In progress",status.in_progress,"accent"],["Not started",status.not_started,"neutral"],["Unknown",status.unknown,"warning"]
  ]);
  const ranked=[...p.rows].sort((a,b)=>{
    const as=(a.criticality==="critical"?1000:a.criticality==="near_critical"?500:0)+(a.finishVarianceDays>0?a.finishVarianceDays:0)+(a.totalFloatHours<0?200:0);
    const bs=(b.criticality==="critical"?1000:b.criticality==="near_critical"?500:0)+(b.finishVarianceDays>0?b.finishVarianceDays:0)+(b.totalFloatHours<0?200:0);
    return bs-as;
  }).slice(0,250);
  const rows=ranked.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span></td><td>'+escapeHtml(planningStateLabel(a.status))+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(planningStateLabel(a.criticality))+'</span></td><td>'+escapeHtml(planningShortDate(a.currentFinishIso))+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td><td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(a.finishVarianceDays===null?"Unresolved":fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.openStart||a.openFinish||a.isolated?"Check":"—")+'</td></tr>').join("");
  return '<section class="planning-view activity-review">'+kpis+repeatedMovementWarning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish movement & float matrix</h4><p>Activity counts by controlled-baseline finish movement and submitted programme total float.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>'+escapeHtml(fmt(openLogic))+' activities also have an open or isolated logic condition.</p></div></div><div class="planning-panel-body">'+statusBand+'<div class="coverage-stack"><span>Source progress-field coverage <b>'+escapeHtml(p.percentCompleteCoveragePercent===null?"—":fmt(p.percentCompleteCoveragePercent)+"%")+'</b></span><span>Source float-field coverage <b>'+escapeHtml(p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%")+'</b></span><span>Source baseline-comparison coverage <b>'+escapeHtml(p.finishVarianceCoveragePercent===null?"—":fmt(p.finishVarianceCoveragePercent)+"%")+'</b></span></div></div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest activity finish movements vs controlled baseline</h4><p>Each activity is compared with its own controlled-baseline finish.</p></div></div><div class="planning-panel-body">'+renderMovementConcentration(p.movementAnalysis,topLate)+distributionSummary(p.movementDistribution)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity watchlist</h4><p>Source activity names do not establish contractual authority. Highest-attention source records first. Showing '+escapeHtml(fmt(ranked.length))+' of '+escapeHtml(fmt(p.activityCount))+'.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Criticality</th><th>Current finish</th><th>Progress</th><th>Total float h</th><th>Vs baseline d</th><th>Logic</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
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
  const assessed=Number(p.assessedOverloadResourceCount??capacityKnown);
  const weeklyRows=Number(weekly?.rowCount||0);
  const weeklyComparable=Number(weekly?.comparableRowCount||0);
  const weeklyOver=Number(weekly?.overloadedRowCount||0);
  const weeklyUnits=Array.isArray(weekly?.unitLabels)?weekly.unitLabels:[];
  const perHourCapacityText=capacityKnown>0?fmt(capacityKnown)+" / "+fmt(p.assignedResourceCount):"Unresolved";
  const overloadValue=assessed>0?fmt(p.perHourOverloadedResourceCount??p.overloadedResourceCount):"Not assessable";

  const comparableDemand=[...p.rows].map(r=>{
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

  const rows=[...p.rows].sort((a,b)=>(a.overloaded===true?0:a.state!=="capacity_based"?1:2)-(b.overloaded===true?0:b.state!=="capacity_based"?1:2)).map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(r.resourceType)+'</td><td>'+escapeHtml(r.assignmentCount)+'</td><td>'+escapeHtml(fmt(r.capacityUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakPlannedUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakRemainingUnitsPerHour))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"—":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.remainingUtilizationPercent===null?"—":fmt(r.remainingUtilizationPercent)+"%")+'</td><td><span class="state-pill '+(r.overloaded===true?"blocked":r.state==="capacity_based"?"ready":"review")+'">'+escapeHtml(r.overloaded===true?"Overloaded":r.state==="capacity_based"?"Capacity assessed":"Capacity not set")+'</span></td></tr>').join("");

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
  return '<section class="planning-view resource-view">'+kpis+renderResourceBasisReview(p.basisComparison)+perHourNote+weeklyNote+weeklyChart+weeklyDetail+'<div class="planning-primary-grid">'+demandPanel+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Capacity evidence</h4><p>Per-hour schedule capacity and weekly register capacity are shown as separate evidence bases.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Schedule assignments",value:p.assignedResourceCount+" resources",state:p.assignedResourceCount>0?"ready":"missing"},
    {label:"P6 max-units/hour capacity",value:capacityKnown>0?capacityKnown+" resources":"Unresolved",state:capacityKnown>0?"ready":"missing"},
    {label:"Weekly capacity register",value:weeklyComparable?fmt(weeklyComparable)+" comparable rows":"Unresolved",state:weeklyComparable?"ready":"missing"},
    {label:"Per-hour overload assessment",value:overloadValue,state:assessed>0?"ready":"missing"}
  ])+'</div></section></div><details class="planning-panel"><summary class="planning-panel-head"><div><h4>Complete P6 resource register</h4><p>Overloaded and unassessed resources appear first. Capacity and utilization remain blank when not confirmed; assignment, headcount and hour units are not interchangeable.</p></div></summary><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Assignments</th><th>Capacity/hr</th><th>Peak planned/hr</th><th>Peak remaining/hr</th><th>Planned util.</th><th>Remaining util.</th><th>Assessment</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></details></section>';
}
function renderProgressReportVisual(data){
  const p=projectionFor(data,"progress_report");
  if(!p.progressBases)return"";
  const snapshot=p.progressBases.scheduleSnapshot;
  const displayDifference=displayPercentDifference;
  const snapshotGap=displayDifference(snapshot?.valuePercent,p.progressBases.currentSchedule?.valuePercent);
  const current=p.progressBases.currentSchedule;
  const baseline=p.progressBases.baselinePlanned;
  const physical=p.progressBases.physical;
  const contractor=p.progressBases.contractorReported;
  const certified=p.progressBases.certified;
  const planMovement=displayDifference(current?.valuePercent,baseline?.valuePercent);
  const progressMovement=displayDifference(physical?.valuePercent,baseline?.valuePercent);
  const progressVarianceLabel="Physical progress vs baseline";
  const sourceProgressEstablished=typeof contractor?.valuePercent==="number"||typeof certified?.valuePercent==="number"||(physical?.authority==="source_evidence"&&typeof physical?.valuePercent==="number");
  const physicalLabel="Physical progress";
  const kpis=planningKpis([
    ["Baseline plan · original scope",baseline?.valuePercent==null?"Unresolved":percent2(baseline.valuePercent)+"%","baseline activity population"],
    ["Current plan · current scope",current?.valuePercent==null?"—":percent2(current.valuePercent)+"%","contains actual dates; not an independent comparator"],
    ["Snapshot · current scope",snapshot?.valuePercent==null?"—":percent2(snapshot.valuePercent)+"%","duration-weighted source percent complete"],
    ...[[physicalLabel,physical],["Contractor reported",contractor],["Certified progress",certified]].filter(x=>typeof x[1]?.valuePercent==="number").map(x=>[x[0],percent2(x[1].valuePercent)+"%","separate source basis"])
  ]);
  const warning=!sourceProgressEstablished?'<div class="notice warn"><b>The programme contains a percentage-complete snapshot, but certified/contractor physical progress is not confirmed.</b> CMeng keeps the schedule snapshot separate from certified or independently sourced physical progress.</div>':'';
  const status=planningStatusBand([
    ["Completed",p.progress?.completedCount||0,"success"],
    ["In progress",p.progress?.inProgressCount||0,"accent"],
    ["Not started",p.progress?.notStartedCount||0,"neutral"],
    ["Unknown",p.progress?.unknownStatusCount||0,"warning"]
  ]);
  const pressure=planningStatusBand([
    ["Critical",p.schedule?.criticalCount||0,"danger"],
    ["Near-critical",p.schedule?.nearCriticalCount,"warning"]
  ]);
  const progressChart=renderVisualBars([
    {label:"Baseline planned",value:typeof baseline?.valuePercent==="number"?baseline.valuePercent:null,tone:"graphite"},
    {label:"Current programme plan",value:typeof current?.valuePercent==="number"?current.valuePercent:null,tone:"accent"},
    {label:"Schedule snapshot",value:snapshot?.valuePercent??null,tone:"warning"},
    {label:physicalLabel,value:typeof physical?.valuePercent==="number"?physical.valuePercent:null,tone:"teal"},
    {label:"Contractor reported",value:typeof contractor?.valuePercent==="number"?contractor.valuePercent:null,tone:"warning"},
    {label:"Certified progress",value:typeof certified?.valuePercent==="number"?certified.valuePercent:null,tone:"success"}
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
  return '<section class="planning-view progress-position-view">'+renderProgressScope(p.scopeComparison)+kpis+warning+visualOverview+'<details class="source-scope"><summary>All progress bases and schedule pressure</summary><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Progress bases</h4><p>Baseline plan, current re-phased plan, activity percentage-complete snapshot, contractor-reported and certified values remain separate.</p></div></div><div class="planning-panel-body">'+progressBasisBars(p.progressBases)+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>Current programme population.</p></div></div><div class="planning-panel-body">'+status+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure</h4><p>Critical and near-critical are disjoint classes. Negative float is an Also included in the blocked count, not an additional population.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div></details><section class="planning-panel"><div class="planning-panel-head"><div><h4>Near-term delivery</h4><p>Milestones and look-ahead indicators tied to the current data date.</p></div></div><div class="planning-panel-body">'+planningKpis([
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
  const all=a.maximumRows||[],reps=all.slice(0,5),den=a.population?.denominator;
  return '<div class="notice info"><b>Common maximum movement: '+escapeHtml(fmt(a.maximumDays))+' elapsed days</b><p>'+escapeHtml(fmt(a.maximumCount))+' activities share the maximum · '+escapeHtml(fmt(a.maximumPercent))+'% of '+escapeHtml(fmt(den))+' matched activities with known finishes. Source population: '+escapeHtml(fmt(a.population?.sourceCount))+'.</p><p>'+escapeHtml(a.fromLabel)+' → '+escapeHtml(a.toLabel)+'. Date movement does not establish a shared cause, separate delays, project delay or entitlement.</p></div>'+planningSignedBars(reps.map(r=>({label:r.activityId,value:r.movementDays})),"days")+'<p>'+escapeHtml(fmt(reps.length))+' representatives of '+escapeHtml(fmt(all.length))+'. Verified source date pairs: '+escapeHtml(fmt(a.sourcePairVerifiedCount))+'.</p><details><summary>View all '+escapeHtml(fmt(all.length))+' maximum-movement source pairs</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Previous source finish</th><th>Current source finish</th><th>Elapsed days</th></tr></thead><tbody>'+all.map(r=>'<tr><td>'+escapeHtml(r.activityId)+'</td><td>'+escapeHtml(r.fromFinishIso)+'</td><td>'+escapeHtml(r.toFinishIso)+'</td><td>'+escapeHtml(fmt(r.movementDays))+'</td></tr>').join("")+'</tbody></table></div></details>';
}
function renderScheduleChangeVisual(data){
  const p=projectionFor(data,"schedule_change_report");
  if(!Array.isArray(p.changedActivities))return"";
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
  return '<section class="planning-view changes-view">'+comparisonRibbon+kpis+identityHtml+categoryHtml+repeatedMovementWarning+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>What changed</h4><p>Activity changes between the two controlled programme revisions.</p></div></div><div class="planning-panel-body">'+composition+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic changes</h4><p>Relationships added or removed between the revisions.</p></div></div><div class="planning-panel-body">'+planningKpis([["Added links",p.addedRelationshipCount,"relationships","accent"],["Removed links",p.removedRelationshipCount,"relationships","warning"]])+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest activity finish movements between these revisions</h4><p>'+escapeHtml(planningRevisionLabel(p.fromRevisionLabel||p.fromRevisionId))+' → '+escapeHtml(planningRevisionLabel(p.toRevisionLabel||p.toRevisionId))+'. Elapsed days (24 hours); this is separate from the controlled-baseline comparison in Activity Analytics. Date movement does not establish delay cause or entitlement.</p></div></div><div class="planning-panel-body">'+renderRevisionMovementConcentration(p.finishMovementAnalysis,movements)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest float deterioration</h4><p>Bars to the right indicate the largest loss of float.</p></div></div><div class="planning-panel-body">'+planningSignedBars(floatMoves,"hours lost")+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Changed activity detail</h4><p>Largest finish movements first. Showing '+escapeHtml(fmt(detail.length))+' of '+escapeHtml(fmt(p.changedActivities.length))+' changed activities. The complete confirmed population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body"><details><summary>Open the changed-activity register</summary><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Change</th><th>Finish shift d</th><th>Float shift h</th><th>Progress shift pp</th><th>Fields changed</th><th>Identity basis</th></tr></thead><tbody>'+rows+'</tbody></table></div></details></div></section></section>';
}
function renderFloatPressureTrend(points){
  const fields=[{key:"criticalCount",label:"Critical",color:"#b4483e"},{key:"nearCriticalCount",label:"Strict near-critical",color:"#b57922"},{key:"negativeFloatCount",label:"Negative float",color:"#7a4b46"}];
  return '<div class="float-small-multiples">'+fields.map(field=>{const values=points.map(p=>p[field.key]).filter(v=>typeof v==='number');return renderVisualPanel(field.label+' · '+fmt(values[0])+' → '+fmt(values.at(-1)),"Separate zoomed count axis; compare the stated values. Negative float can overlap criticality.",renderLineChart(points,[field],null,{unit:"activities",zeroBaseline:false,yLabel:field.label,xLabel:"Reporting date",ariaLabel:field.label+" count change"}));}).join('')+'</div>';
}
function renderRevisionTrendVisual(data){
  const p=projectionFor(data,"revision_trend");
  if(!Array.isArray(p.points))return"";
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
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(planningRevisionLabel(x.label)||("Revision "+x.sequence))+'</b><br><span class="muted">'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></td><td>'+escapeHtml(x.durationWeightedProgressPercent===null?"—":fmt(x.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(x.activityCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.nearCriticalCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(planningShortDate(x.forecastCompletionIso))+'</td><td>'+escapeHtml(x.addedVsPrevious===null||x.removedVsPrevious===null||x.modifiedVsPrevious===null?"N/A: first revision":fmt(x.addedVsPrevious+x.removedVsPrevious+x.modifiedVsPrevious))+'</td></tr>').join("");
  return '<section class="planning-view revision-view">'+kpis+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Exact values are shown here so the trend charts do not require guessing from a line.</p></div></div><div class="planning-panel-body">'+values+'</div></section><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date movement</h4><p>How the programme and forecast finish dates have moved across revisions.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Progress evolution</h4><p>Weighted schedule progress by revision.</p></div></div><div class="planning-panel-body">'+progress+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Submitted total-float trend</h4><p>Critical, near-critical and negative-float activity counts by revision.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Latest any-field record change volume</h4><p>Activity additions, removals and modifications in the latest revision.</p></div></div><div class="planning-panel-body">'+changeBars+moduleBarList((latest.changeCategories||[]).map(row=>({label:humanizeKey(row.category)+' (overlapping)',value:row.activityCount})))+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision history</h4><p>Controlled programme revisions in chronological order.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Schedule progress</th><th>Activities</th><th>Critical</th><th>Near-critical</th><th>Negative float</th><th>Submitted forecast finish</th><th>Added + removed + any-field modified</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderVarianceTrendVisual(data){
  const p=projectionFor(data,"variance_trends");
  if(!Array.isArray(p.points))return"";
  const labels=p.revisionLabels||{};
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||("R"+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const averageMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.averageFinishVarianceDays==="number"?x.averageFinishVarianceDays:null})),"days");
  const projectMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.projectCompletionVarianceDays==="number"?x.projectCompletionVarianceDays:null})),"days");
  const pressure=renderFloatPressureTrend(points);
  const cards=p.points.map((x,index)=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b><span>'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Source activities compared <b>'+escapeHtml(fmt(x.comparableActivities))+' / '+escapeHtml(fmt(x.sourceActivityCount))+'</b></span><span>Unknown or unmatched <b>'+escapeHtml(fmt(x.unmatchedActivityCount))+'</b></span><span>Average activity finish movement <b>'+escapeHtml(x.averageFinishVarianceDays===null?"Unresolved":fmt(x.averageFinishVarianceDays)+" d")+'</b></span><span>Maximum activity movement <b>'+escapeHtml(x.maximumDelayDays===null?"Unresolved":fmt(x.maximumDelayDays)+" d")+'</b></span><span>Late activities <b>'+escapeHtml(fmt(x.lateActivityCount))+'</b></span><span>Project finish vs baseline <b>'+escapeHtml(x.projectCompletionVarianceDays===null?"Unresolved":fmt(x.projectCompletionVarianceDays)+" d")+'</b></span></div></div>').join("");
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b></td><td>'+escapeHtml(planningShortDate(x.dataDateIso))+'</td><td>'+escapeHtml(x.averageFinishVarianceDays===null?"Unresolved":fmt(x.averageFinishVarianceDays))+'</td><td>'+escapeHtml(x.maximumDelayDays===null?"Unresolved":fmt(x.maximumDelayDays))+'</td><td>'+escapeHtml(fmt(x.lateActivityCount))+'</td><td>'+escapeHtml(fmt(x.earlyActivityCount))+'</td><td>'+escapeHtml(fmt(x.onTimeActivityCount))+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.projectCompletionVarianceDays===null?"Unresolved":fmt(x.projectCompletionVarianceDays))+'</td></tr>').join("");
  return '<section class="planning-view variance-view">'+planningKpis([
    ["Revisions",p.revisionCount,"controlled"],
    ["Latest avg movement",latest.averageFinishVarianceDays===null?"Unresolved":fmt(latest.averageFinishVarianceDays)+" d","vs controlled baseline",latest.averageFinishVarianceDays>0?"warning":""],
    ["Latest max activity movement",latest.maximumDelayDays===null?"Unresolved":fmt(latest.maximumDelayDays)+" d","activity level",latest.maximumDelayDays>0?"danger":""],
    ["Late activities",latest.lateActivityCount,"vs controlled baseline",latest.lateActivityCount?"danger":""],
    ["Project finish movement",latest.projectCompletionVarianceDays===null?"Unresolved":fmt(latest.projectCompletionVarianceDays)+" d","vs controlled baseline",latest.projectCompletionVarianceDays>0?"danger":""]
  ])+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Source activity finish movements use the shared activity matching. Unknown baseline and ambiguous identity remain visible. Movement alone does not establish delay causation.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div>'+distributionSummary(latest.movementDistribution)+'</div></section><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish movement by revision</h4><p>Signed movement from the controlled baseline. Left means earlier, right means later.</p></div></div><div class="planning-panel-body"><div class="nested-title">Average activity finish movement</div>'+averageMovement+'<div class="nested-title" style="margin-top:16px">Project finish movement</div>'+projectMovement+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float pressure trend</h4><p>Execution-population float indicators by revision. Negative float overlaps criticality; these lines are not additive.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Avg vs baseline d</th><th>Max movement d</th><th>Late</th><th>Early</th><th>On time</th><th>Neg. float</th><th>Critical</th><th>Project finish vs baseline d</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderProgressBreakdownVisual(data){
  const p=projectionFor(data,"progress_breakdown");
  if(!Array.isArray(p.rows))return "";
  const percent=value=>typeof value==="number"?percent2(value)+"%":"Unresolved";
  const delta=value=>typeof value==="number"?percent2(value)+" pp":"Unresolved";
  const hierarchy=p.hierarchyRows||p.rows;
  const ranked=[...p.rows].filter(r=>r.activityCount>0&&r.durationWeightedProgressPercent!=null).sort((a,b)=>a.durationWeightedProgressPercent-b.durationWeightedProgressPercent||String(a.wbsId).localeCompare(String(b.wbsId))).slice(0,15);
  const progressBars=ranked.map(r=>({label:r.wbsName||r.wbsId,value:r.durationWeightedProgressPercent}));
  const pressure=[...p.rows].filter(r=>r.negativeFloatCount>0).sort((a,b)=>b.negativeFloatCount-a.negativeFloatCount).slice(0,12).map(r=>({label:r.wbsName||r.wbsId,value:r.negativeFloatCount,tone:"danger"}));
  const rows=hierarchy.map(r=>'<tr><td style="min-width:220px;padding-left:'+((r.depth||0)*14+8)+'px"><b>'+escapeHtml(r.wbsName||r.wbsId)+'</b><br><span class="muted">'+escapeHtml(r.wbsId)+(r.parentWbsId?' · Parent '+escapeHtml(r.parentWbsId):' · Root')+'</span></td><td>'+escapeHtml(fmt(r.activityCount))+'</td><td>'+escapeHtml(fmt(r.directActivityCount??r.activityCount))+'</td><td>'+escapeHtml(percent(r.baselinePlannedPercent))+'<br><small>Coverage '+escapeHtml(percent(r.baselinePlanCoveragePercent))+'</small></td><td>'+escapeHtml(percent(r.currentPlanPercent))+'<br><small>Coverage '+escapeHtml(percent(r.currentPlanCoveragePercent))+'</small></td><td>'+escapeHtml(percent(r.durationWeightedProgressPercent))+'<br><small>Coverage '+escapeHtml(percent(r.durationWeightedCoveragePercent))+'</small></td><td>'+escapeHtml(delta(displayPercentDifference(r.durationWeightedProgressPercent,r.currentPlanPercent)))+'</td><td>'+escapeHtml(delta(r.scheduleProgressMovementPercentagePoints))+'</td><td>'+escapeHtml(percent(r.contractorReportedPercent))+'</td><td>'+escapeHtml(percent(r.certifiedPhysicalPercent))+'</td><td>'+escapeHtml(fmt(r.criticalCount))+'</td><td>'+escapeHtml(fmt(r.nearCriticalCount))+'</td><td>'+escapeHtml(fmt(r.negativeFloatCount))+'</td></tr>').join("");
  const compact=basisTable(['WBS','Activities','Baseline plan','Current plan','Snapshot','Critical','Near-critical','Negative float'],hierarchy.map(r=>[r.wbsName||r.wbsId,r.activityCount,percent(r.baselinePlannedPercent),percent(r.currentPlanPercent),percent(r.durationWeightedProgressPercent),r.criticalCount,r.nearCriticalCount,r.negativeFloatCount]));
  const unavailable=['contractorReportedPercent','certifiedPhysicalPercent','scheduleProgressMovementPercentagePoints'].filter(k=>hierarchy.every(r=>r[k]==null));
  return '<section class="planning-view wbs-view">' +planningKpis([
    ["Execution activities",p.totalActivityCount,"each counted once at project level"],["Direct WBS groups",p.rows.length,"direct assignments"],["Hierarchy rows",hierarchy.length,"Parent totals already include child activities"]
  ])+'<div class="notice info">LOE and summary rows are excluded from execution progress. Parent totals include their child activities; only direct assignments add to the project total. Programme progress, planned progress and certified physical progress are shown separately. Trends require the same activities to be identified across revisions.</div><div class="planning-primary-grid">'+renderVisualPanel("Lowest current snapshot progress","15 direct WBS groups ranked by current snapshot percentage; ties use WBS ID. Added scope remains included.",moduleBarList(progressBars,"accent","%"))+renderVisualPanel("WBS negative-float exceptions","Groups with a nonzero negative-float population",moduleBarList(pressure))+'</div><section class="planning-panel"><div class="planning-panel-head"><h4>WBS hierarchy and progress bases</h4></div><div class="planning-panel-body">'+compact+'<p>Plans and snapshot retain their source populations and weights. Current planned dates may contain actuals. '+escapeHtml(unavailable.length?unavailable.map(humanizeKey).join(", ")+" are not in the supplied dated evidence.":"")+'</p><details><summary>All source columns, coverage and historical comparisons</summary><div class="table-wrap"><table><thead><tr><th>WBS</th><th>Rollup activities</th><th>Direct activities</th><th>Baseline plan</th><th>Current plan</th><th>Schedule snapshot</th><th>Snapshot vs current</th><th>Snapshot vs previous</th><th>Contractor reported</th><th>Certified physical</th><th>Critical</th><th>Near-critical</th><th>Negative float</th></tr></thead><tbody>'+rows+'</tbody></table></div></details></div></section></section>';
}
function renderMilestonesVisual(data){
  const p=projectionFor(data,"milestones");
  if(!Array.isArray(p.rows))return"";
  const dd=planningDateMs(p.dataDateIso);
  const due30=p.due30Count??p.rows.filter(r=>r.status!=="completed"&&planningDateMs(r.currentDateIso)!==null&&dd!==null&&planningDateMs(r.currentDateIso)>=dd&&planningDateMs(r.currentDateIso)<=dd+30*86400000).length;
  const slippedOpen=p.rows.filter(r=>r.status!=="completed"&&typeof r.varianceDays==="number"&&r.varianceDays>0).length;
  const criticalCount=p.criticalMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&typeof r.totalFloatHours==="number"&&r.totalFloatHours<=0).length;
  const nearCriticalCount=p.nearCriticalMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&r.criticality==="near_critical").length;
  const negativeFloatCount=p.negativeFloatMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&typeof r.totalFloatHours==="number"&&r.totalFloatHours<0).length;
  const movements=p.rows.map(r=>r.varianceDays).filter(v=>typeof v==="number");
  const largest=movements.length?Math.max(...movements):null;
  const urgentDates=(p.lateOpenCount||0)+due30;
  const priorityRows=[...p.rows].filter(r=>r.status!=="completed").sort((a,b)=>planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER))||((b.varianceDays||0)-(a.varianceDays||0)));
  const topPriority=priorityRows[0]||null;
  const kpis=planningKpis([
    ["Open milestones",p.openCount,"of "+fmt(p.milestoneCount)+" total"],
    ["Submitted float critical",criticalCount,"open milestones · submitted float",criticalCount?"danger":""],
    ["Negative float",negativeFloatCount,"open milestones",negativeFloatCount?"danger":""],
    ["Near-critical",nearCriticalCount,"open milestones",nearCriticalCount?"warning":""],
    ["Urgent dates",urgentDates,(p.lateOpenCount||0)+" overdue · "+due30+" due ≤30d",urgentDates?"warning":""],
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
  const movementGroups='<section class="planning-panel"><div class="planning-panel-head"><h4>Open milestone movement groups</h4></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Movement vs baseline</th><th>Open milestones</th><th>Share of open population</th></tr></thead><tbody>'+[...movementClusters.entries()].sort((a,b)=>b[1]-a[1]).map(([value,count])=>'<tr><td>'+escapeHtml((value>0?'+':'')+fmt(value)+' d')+'</td><td>'+escapeHtml(fmt(count))+'</td><td>'+escapeHtml(fmt(count/Math.max(1,p.openCount)*100)+'%')+'</td></tr>').join('')+'</tbody></table></div><p>Equal date movements do not prove a shared cause. Completed milestones are excluded from these groups.</p></div></section>';
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
  return '<section class="planning-view milestone-view">'+kpis+authority+basis+repeatedMovementWarning+movementGroups+
    '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Milestone movement & criticality</h4><p>Priority milestones on a common calendar axis. Exact dates and float remain visible without horizontal scrolling.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section>'+
    '<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Source-float & key milestone watchlist</h4><p>Open milestones are ranked by urgency and submitted float. Repeated watch-level movements are represented once here; every record and its action remain in the full register below.</p></div></div><div class="planning-panel-body">'+priorityBoard+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management alerts</h4><p>Exceptions requiring intervention or protection.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div>'+
    '<div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone status</h4><p>Completed, open and overdue commitments.</p></div></div><div class="planning-panel-body">'+statusBand+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management priority</h4><p>Open milestones grouped by required level of attention.</p></div></div><div class="planning-panel-body">'+priorityBand+'</div></section></div>'+
    '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone control register</h4><p>Source activity names are descriptive and do not establish contractual authority. Current/actual dates, baseline movement and source-float classifications remain separate. Showing '+escapeHtml(fmt(Math.min(500,p.rows.length)))+' of '+escapeHtml(fmt(p.rows.length))+' milestones; the complete population is available through Download Excel / Download data.</p></div></div><div class="planning-panel-body"><details><summary>Open the complete milestone register</summary><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Milestone / WBS</th><th>Status</th><th>Criticality</th><th>Baseline</th><th>Current / actual</th><th>Vs baseline d</th><th>Total float h</th><th>Flags</th><th>Required attention</th></tr></thead><tbody>'+detail+'</tbody></table></div></details></div></section></section>';
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
    ?"Comparison unresolved: "+fmt(unresolved)+" activities need readable working calendars."
    :sourceCount===null
    ?"No submitted Near Critical population is available for reconciliation."
    : sourceMatch==="float_risk_watchlist"
      ?"The submitted label “Near Critical” reconciles to CMeng's Float-Risk Watchlist, not to strict Near-Critical."
      : sourceMatch==="strict_near_critical"
        ?"The submitted label “Near Critical” reconciles to CMeng's strict Near-Critical classification."
        :"The submitted population does not reconcile to either CMeng classification and remains a visible gap.";

  const criticalThreshold=p.criticalThresholdHours??0;
  const kpis=planningKpis([
    ["Strict near-critical",p.nearCriticalCount===null?"Unresolved: "+fmt(unresolved)+" activities":p.nearCriticalCount,"TF > "+fmt(criticalThreshold)+" h and ≤ "+limitValue,"warning"],
    ["Float-risk watchlist",p.floatRiskWatchlistCount===null?"Unresolved: "+fmt(unresolved)+" activities":p.floatRiskWatchlistCount,"critical boundary through "+limitValue,"accent"],
    ["Zero float",p.zeroFloatCount??"—","critical boundary","danger"],
    ["Negative float",p.negativeFloatCount??"—","TF < 0","danger"],
    ["Source reported",sourceCount===null?"—":sourceCount,p.sourceReportedLabel||"Near Critical"],
    ["Float coverage",p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%","execution activities"],
    ["Classification coverage",p.classificationCoveragePercent===null||p.classificationCoveragePercent===undefined?"—":fmt(p.classificationCoveragePercent)+"%","calendar-aware",unresolved?"warning":""]
  ]);

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
    return '<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(classLabel)+'</td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(r.nearCriticalThresholdHours===null||r.nearCriticalThresholdHours===undefined?"—":fmt(r.nearCriticalThresholdHours))+'</td><td>'+escapeHtml(r.calendarId||"—")+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null?"Unresolved":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)))+'</td><td>'+escapeHtml(r.percentComplete===null?"—":fmt(r.percentComplete)+"%")+'</td></tr>';
  }).join("");
  const thresholdAuthority=p.nearCriticalThresholdAuthority==="project_source"?"Project control basis":p.nearCriticalThresholdAuthority==="cmeng_screening_policy"?"CMeng screening policy":"Threshold authority unresolved";
  const thresholdExplanation=p.nearCriticalThresholdExplanation||"The source of the near-critical threshold is not established.";
  const basis='<div class="notice info"><b>Float screening basis:</b> '+escapeHtml(thresholdAuthority)+'. Critical = TF ≤ '+escapeHtml(fmt(criticalThreshold))+' h; Near-Critical screening = TF > '+escapeHtml(fmt(criticalThreshold))+' h and ≤ '+escapeHtml(limitValue)+'; Float-Risk Watchlist boundary inclusion: '+(p.floatRiskWatchlistIncludesCriticalThreshold?'Included':'Excluded')+'. Working-day limits use each activity\'s own programme calendar.<p>'+escapeHtml(thresholdExplanation)+'</p></div>';
  const reconciliation='<div class="notice '+(sourceMatch==="float_risk_watchlist"||sourceMatch==="strict_near_critical"?"good":"warn")+'"><b>Submitted label versus the float rules:</b> '+escapeHtml(reconciliationText)+'</div>';
  return '<section class="planning-view nearcritical-view">'+kpis+basis+reconciliation+floatConcentrationWarning+distributionSummary(p.floatDistribution,'hours','All execution activity float values')+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Float-risk distribution</h4><p>Submitted total float is classified against the disclosed screening basis using each activity calendar. A CMeng policy threshold is never presented as a client-approved project rule.</p></div></div><div class="planning-panel-body">'+histogram+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Where float-risk work finishes</h4><p>Current finish-month concentration for the full float-risk watchlist.</p></div></div><div class="planning-panel-body">'+finishPeriods+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float-Risk Watchlist</h4><p>Critical and near-critical activities are shown separately. Open activities appear before completed history. '+(p.floatRiskWatchlistCount===null?'Unresolved: '+escapeHtml(fmt(unresolved))+' activities need readable calendars. Any listed rows are only the confirmed subset.':'Showing '+escapeHtml(fmt(watch.length))+' of '+escapeHtml(fmt(riskRows.length))+' watchlist activities; the complete population is available through Download Excel / Download data.')+'</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Risk class</th><th>Status</th><th>Total float h</th><th>Threshold h</th><th>Calendar</th><th>Controlled baseline finish</th><th>Current finish</th><th>Vs controlled baseline d</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
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
  return '<section class="planning-view manhour-view">'+top+renderResourceBasisReview(p.basisComparison)+note+(weekly?'<div class="notice info">Weekly staffing hours describe input usage, not physical productivity. Periods are included by source week start. The planned total spans the Full register period; actuals stop at the Data Date. Remaining-hours forecast is not confirmed.</div>':'')+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Man-Hour S-Curve</h4><p>Labor only. Missing actual history never becomes a zero line.</p></div></div><div class="planning-panel-body">'+renderLineChart(p.points,series,null,{unit:"h",yLabel:"Labor hours",xLabel:"Reporting date",dataDateIso:p.dataDateIso,ariaLabel:"Man-Hour S-Curve"})+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Available records</h4><p>The curve uses weekly planned-demand and approved actual-usage evidence. Related P6 assignments are a separate supporting population.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Labor resources",value:fmt(p.laborResourceCount),state:p.laborResourceCount>0?"ready":"missing"},
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
  const note=independentCount===0?'<div class="notice info"><b>Source forecast history is available.</b> Programme calendar recalculation could not be established for these source revisions. Review the stated calculation diagnostics.</div>':'';
  return '<section class="planning-view forecast-history-view">'+planningKpis([
    ["Revisions",p.snapshotCount,"controlled"],
    ["Submitted forecasts",sourceCount,"Recorded in programme revisions"],
    ["Calendar calculations",independentCount,"calculated snapshots",independentCount?"accent":"warning"]
   ])+inherited+note+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast values by revision</h4><p>Exact dates first; source finishes and calendar recalculations remain separate.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div></div></section><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Forecast movement</h4><p>Later vertical position means a later finish date.</p></div></div><div class="planning-panel-body">'+trend+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast history detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Data date</th><th>Revision</th><th>Submitted finish</th><th>Programme calendar recalculation</th><th>Calendar movement vs previous d</th><th>Calendar movement vs first d</th><th>Basis</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderNoticesClaimsVisual(data){
  const p=projectionFor(data,"notices_claims");
  if(!Array.isArray(p.events)||!Array.isArray(p.claims))return"";
  const assessable=p.events.filter(e=>["timely","late","not_issued","notice_date_missing"].includes(e.noticeTimeliness));
  const summary=planningKpis([
    ["Claims known by Data Date",p.claimCount,"identities evidenced by a dated notice or submission"],
    ["Event / awareness dates missing",p.noticeEventDateMissingCount??p.events.filter(e=>e.noticeTimeliness==="event_date_missing").length,"supply the notice trigger dates","warning"],
    ["Notice rules missing",p.noticeRequirementMissingCount,"contract rule not read or linked"],
    ["Notice rules need review",p.noticeRequirementConflictCount??0,"resolve applicability or conflicting versions"],
    ["Determined days through DD",p.effectiveDeterminationDays==null?"Not in the dated evidence":fmt(p.effectiveDeterminationDays)+" d","determination register; amendment overlap unresolved"]
  ]);
  const table=(heads,rows)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+escapeHtml(v)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  const eventRows=table(["Event","Event start","Notice date","Required days","Elapsed days","Assessment"],p.events.map(e=>[e.eventId,planningShortDate(e.eventStartIso),planningShortDate(e.noticeIssuedAt),fmt(e.requiredNoticeDays),fmt(e.elapsedNoticeDays),humanizeKey(e.noticeTimeliness)]));
  const values=p.claims.map(c=>({...c,...(c.sourceRegister||{})}));
  const claimRows=table(["Claim","Register status","Claimed d","Assessed d","Employer d","Contractor d","Review"],values.map(c=>[c.claimId,c.sourceStatus||humanizeKey(c.state),fmt(c.claimedDays),fmt(c.assessedDays),fmt(c.employerDelayDays),fmt(c.contractorDelayDays),(c.diagnostics||[]).filter(x=>/CONFLICT|DIFFER|NOT_IN_DETERMINATION_REGISTER/.test(x)).map(humanizeKey).join("; ")||"Register values; dated decision not confirmed"]));
  return '<section class="planning-view notices-view">'+summary+'<div class="notice warn"><b>'+escapeHtml(assessable.length?fmt(assessable.length)+" events can be assessed on the stated rules.":"Notice performance is not zero; it is not assessable.")+'</b> Contract rules, event/awareness dates and notice evidence are separate inputs. Claim-day sums are register statistics, not project delay or an EOT award.</div>'+renderVisualPanel("What the claim register reports","Reported statuses for the current identity cohort. They are not backdated decisions.",renderDonutChart(claimStateCounts(values).map(r=>({...r,tone:"accent"})),"Claims"))+'<details class="source-scope"><summary>Review all '+fmt(p.events.length)+' notice assessments</summary>'+eventRows+'</details><details class="source-scope"><summary>Review all '+fmt(p.claims.length)+' source claim records</summary>'+claimRows+'</details></section>';
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
        return '<tr><td><b>'+escapeHtml(row.paymentId)+'</b></td><td>'+escapeHtml(row.paymentType||"Not stated")+'</td><td>'+escapeHtml(planningShortDate(row.periodEnd))+'<br><span class="muted">'+escapeHtml(humanizeKey(row.reportingScope||'undated'))+'</span></td><td>'+escapeHtml(planningShortDate(row.lifecycle?.applicationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.assessmentDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDate))+'</td><td>'+escapeHtml(humanizeKey(row.lifecycle?.slaState||"not_established"))+'</td><td>'+escapeHtml(findingValue(amounts.applicationAmount))+'</td><td>'+escapeHtml(findingValue(amounts.engineerAssessedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.employerCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.paidAmount))+'</td></tr>';
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
        table(["Payment","Type","Period","Applied","Assessed","Certified","Certification due","Payment due","Paid","SLA","Applied amount","Assessed amount","Certified amount","Paid amount"],paymentRows,"No payment register is established.")+
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
      const bondRows=(bi.bonds||[]).map(row=>'<tr><td><b>'+escapeHtml(row.bondId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.amount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td></tr>');
      const insuranceRows=(bi.insurances||[]).map(row=>'<tr><td><b>'+escapeHtml(row.policyId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(row.insurer||"Not stated")+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.coverageAmount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td><td>'+escapeHtml(row.sourceRequirement||"Not linked")+'</td></tr>');
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
        table(["Bond","Type","Status","Amount","Expiry","Days","Expiry state"],bondRows,"No bond/security register is established.")+
        table(["Policy","Type","Insurer","Status","Coverage","Expiry","Days","Expiry state","Requirement"],insuranceRows,"No insurance-policy register is established.")+'<div class="notice info">Policy records outside the current population: '+fmt(bi.futureInsurances?.length??0)+' future · '+fmt(bi.undatedInsurances?.length??0)+' undated. These remain in the source register.</div>'+
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
    return '<section class="planning-view commercial-view commercial-overview-enterprise">'+temporalWarning+temporalScope+
      commercialSummaryPanel('Executive Commercial Position','Contract, change, certification, cash and claim exposure are shown first, by currency, without cross-currency arithmetic.')+
      commercialCharts+
      time+
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
    return '<section class="planning-view commercial-view commercial-claims-enterprise">'+temporalWarning+temporalScope+
      detail+
      commercialSummaryPanel('Claim Financial Exposure by Currency','Known claimed and assessed values come from the controlled financial register. Partial amount coverage remains explicitly partial.')+
      commercialCharts+
      time+
      evidencePanel+
      '</section>';
  }
  if(key==="contract-particulars-bonds"){
    return '<section class="planning-view commercial-view contract-particulars-enterprise">'+temporalWarning+temporalScope+
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
  return '<div class="management-metric-grid">'+metrics.map(m=>{
    const display=managementMetricDisplay(m);
    return '<article class="management-metric-card '+escapeHtml(m.health||"unavailable")+'">'+
      '<div class="management-metric-head"><span>'+escapeHtml(m.key==='independent-forecast-finish'&&['provisional','scenario'].includes(m.authority)?'Programme calendar recalculation':m.label)+'</span>'+((m.health==="unavailable"&&display.kind!=="missing")?"":managementHealthBadge(m.health))+'</div>'+
      '<div class="management-metric-value '+escapeHtml(display.kind)+'">'+escapeHtml(display.text)+'</div>'+
      '<div class="management-metric-badges">'+managementMetricBadges(m)+'</div>'+
      '<details class="metric-interpretation"><summary>What this figure means</summary><div class="management-metric-basis"><span>Basis</span><b>'+escapeHtml(m.basis||"Unresolved")+'</b></div>'+
      (m.consequence?'<div class="management-metric-note"><span>Consequence</span><p>'+escapeHtml(m.consequence)+'</p></div>':'')+
      (m.action?'<div class="management-metric-note action"><span>Action</span><p>'+escapeHtml(m.action)+'</p></div>':'')+
      '</details><div class="management-metric-owner">'+managementModuleLink(m.owningModule,'Open analysis')+'</div>'+
      '</article>';
  }).join("")+'</div>';
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
  const cell=m=>'<td title="'+escapeHtml(commercialFindingTitle(m))+'">'+escapeHtml(commercialFindingText(m))+'</td>';
  return '<div class="table-wrap"><table><thead><tr><th>Currency</th><th>Pending variations</th><th>Approved variations in the report</th><th>Certified unpaid</th><th>Retention deducted through DD</th><th>Held balance</th><th>Active bonds</th><th>Claimed</th><th>Assessed</th><th>LD scenario</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+escapeHtml(r.currency)+'</b></td>'+cell(r.pendingVariationAmount)+cell(r.approvedVariationAmount)+cell(r.certifiedUnpaidAmount)+cell(r.retentionDeductedAmount)+cell(r.retentionHeldAmount)+cell(r.activeBondAmount)+cell(r.claimClaimedAmount)+cell(r.claimAssessedAmount)+cell(r.ldScenarioAmount)+'</tr>').join("")+'</tbody></table></div>';
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
function renderManagementControlVisual(key,data){
  if(key==="source-quality")return renderSourceQuality(data);
  if(key==="master-dashboard"){
    const r=data.readiness||{};
    const priorityKeys=['contract-finish','submitted-programme-finish','productivity-forecast-finish','critical-activities','progress-position','schedule-spi'];
    const mainMetrics=priorityKeys.map(key=>(data.metrics||[]).find(m=>m.key===key)).filter(Boolean);
    const otherMetrics=(data.metrics||[]).filter(m=>!priorityKeys.includes(m.key));
    const readinessDonut=renderDonutChart([
      {label:"Checked specialist views",value:r.ready??0,tone:"success"},
      {label:"Specialist views requiring review",value:r.partial??0,tone:"warning"},
      {label:"Blocked specialist views",value:r.blocked??0,tone:"danger"}
    ],"Control views");
    return '<div class="planning-view management-view master-dashboard-view">'+
      managementPanel("Executive Project Position","Current programme, progress and delivery exposure. Open a measure for its supporting analysis.",renderManagementMetricGrid(mainMetrics),true)+
      renderDashboardExceptions(data)+renderDashboardTrend(data)+renderDashboardDecisions(data)+
      managementPanel("Control Readiness","Calculation, document and comparison readiness for the specialist control views.",readinessDonut+renderManagementConsistency(data.consistency))+
      managementPanel("Evidence Snapshot","Current evidence coverage. Missing or conflicted evidence remains explicit rather than being converted to zero.",planningKpis([
        ["Project documents",data.evidenceDocumentCount??0,"current evidence library"],
        ["Checked specialist views",r.ready??0,"calculation, document and comparison checks"],
        ["Review needed",r.partial??0,"partial positions","warning"],
        ["Blocked specialist views",r.blocked??0,"calculation unavailable","danger"],
        ["Evidence gaps",r.evidenceGapCount??0,"missing, partial, stale or conflicted evidence","warning"],
        ["Approvals outstanding",r.governanceGapCount??0,"reports and approval steps","warning"]
      ]))+
      experienceSourceContext(key,data)+
      experienceDisclosure("Additional project measures",renderManagementMetricGrid(otherMetrics),fmt(otherMetrics.length)+" measures")+
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
    const d=data.decisions||[];
    const ctrl=data.controls||null;
    const decisionBody=d.length?'<div class="management-decision-list">'+d.map((item,i)=>{
      const meta=[['Owner',item.accountableOwner||'Not assigned'],['Due',item.dueDate?planningShortDate(item.dueDate):'Not set'],['Authority',item.requiredAuthority],['Dependency',item.dependencyParty]].filter(([,v])=>v);
      return '<article class="management-decision"><i>'+escapeHtml(i+1)+'</i><div><b>'+escapeHtml(item.description)+'</b>'+(meta.length?'<div class="management-decision-meta">'+meta.map(([label,value])=>'<span>'+escapeHtml(label+': '+value)+'</span>').join('')+'</div>':'')+'</div></article>';
    }).join("")+'</div>':'<div class="notice info">No suggested follow-up is currently generated.</div>';
    const controlsBody=ctrl?planningKpis([
      ["Open risks",ctrl.riskEvidenceState==="established"?ctrl.openRiskCount:"Unresolved","Risk register and rating method",ctrl.riskEvidenceState==="established"?"":"warning"],
      ["Major / critical NCR",ctrl.openCriticalMajorNcrCount??(data.operationalReporting?.knownCounts?.openCriticalMajorNcrCount!==undefined?fmt(data.operationalReporting.knownCounts.openCriticalMajorNcrCount)+" confirmed":"Unresolved"),ctrl.openCriticalMajorNcrCount===null?"Known subset; full total not confirmed":"quality evidence",ctrl.openCriticalMajorNcrCount?"danger":""],
      ["Overdue RFI",ctrl.rfiEvidenceState==="established"?ctrl.overdueRfiCount:"Unresolved","RFI evidence",ctrl.overdueRfiCount?"danger":""],
      ["Permit issues",ctrl.permitEvidenceState==="established"?ctrl.overduePermitCount:"Unresolved","permit evidence",ctrl.overduePermitCount?"danger":""],
      ["Expired bonds",ctrl.bondEvidenceState==="established"?ctrl.expiredBondCount:"Unresolved","security evidence",ctrl.expiredBondCount?"danger":""],
      ["Expiring bonds",ctrl.bondEvidenceState==="established"?ctrl.expiringBondCount30Days:"Unresolved","next 30 days",ctrl.expiringBondCount30Days?"warning":""]
    ]):'<div class="empty">Project Director control position is not confirmed.</div>';
    return '<div class="planning-view management-view command-center-view">'+
      managementPanel("Immediate Control Signals","Confirmed counts are shown below. Open the relevant record to resolve an incomplete count.",controlsBody,true)+
      experienceSourceContext(key,data)+
      ((data.sourceInterpretation?.actions||[]).length?"":managementPanel("Action Suggestions — Awaiting Assignment","Suggested follow-up only. Assignment, due dates and closure tracking are not yet established in CMeng.",decisionBody,true))+
      managementPanel("Management Priorities","Current blockers and escalations from confirmed specialist positions, ordered before supporting KPIs.",renderManagementAlerts(data.alerts||[]))+
      experienceDisclosure("NCR, RFI and risk records",renderOperationalReporting(data.operationalReporting||ctrl?.reporting),"Quality, RFI and risk records")+
      managementPanel("Current Programme Position","Supporting completion and programme facts used to understand the actions above.",renderManagementMetricGrid(data.programmePosition||[]))+
      managementPanel("Information to confirm","Confirm missing information, outdated records and conflicting values.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      managementPanel("Approvals and publication","Review outstanding approvals and report publication steps.",renderManagementEvidenceGaps(data.governanceGaps||[])+renderManagementConsistency(data.consistency))+
      managementPanel("Commercial & Payment Position","Compact exposure only; detailed valuation remains in Commercial.",renderManagementCommercial(data.commercialByCurrency||[])+renderManagementVariationReconciliation(data.variationReconciliation||[]))+
      '</div>';
  }
  if(key==="master-control-programme"){
    const r=data.revisionAuthority||{};
    const w=data.wbsControl||{};
    const s=data.scope||{};
    const positions=Array.isArray(data.specialistPositions)?data.specialistPositions:[];
    const candidates=Array.isArray(data.candidateInbox)?data.candidateInbox:[];
    const history=Array.isArray(data.controlHistory)?data.controlHistory:[];
    const positionRows=positions.map(p=>'<tr><td><b>'+escapeHtml(p.group)+'</b></td><td>'+escapeHtml(names[p.key]||p.label)+'</td><td>'+issueBadge(p.issueAssessment)+'</td><td>'+escapeHtml(readerModuleSummary(p.reason))+(p.reason?'<details><summary>Calculation notes</summary>'+escapeHtml(p.reason)+'</details>':'')+'</td><td>'+managementModuleLink(p.key,"Open page")+'</td></tr>').join("");
    const candidateRows=candidates.map(item=>'<tr><td><b>'+escapeHtml(item.label)+'</b></td><td>'+escapeHtml(humanizeKey(item.type))+'</td><td>'+managementAuthorityBadge(item.status)+'</td><td>'+escapeHtml(item.sourceRef)+'</td><td>'+managementModuleLink(item.owningModule,"Open owner")+'</td></tr>').join("");
    const historyRows=history.map(item=>'<tr><td>'+escapeHtml(formatDocumentTime(item.occurredAt))+'</td><td><b>'+escapeHtml(item.entity)+'</b></td><td>'+escapeHtml(item.action)+'</td><td>'+escapeHtml(item.actor||"System / not recorded")+'</td><td>'+managementAuthorityBadge(item.state)+'</td><td>'+escapeHtml(item.sourceRef||"—")+'</td></tr>').join("");
    return '<div class="planning-view management-view master-control-view">'+
      managementPanel("Programme control","Current programme, controlled baseline and project structure.",planningKpis([
        ["Project",s.project||data.projectId,"Current project"],
        ["Programme membership",humanizeKey(s.programmeMembershipState||"not_established"),s.programme||"Programme membership is not established in the supplied project records",s.programmeMembershipState==="established"?"":"warning"],
        ["Current programme",r.currentLabel?planningRevisionLabel(r.currentLabel):"Unresolved",r.currentDataDateIso?planningShortDate(r.currentDataDateIso):"no Data Date",r.currentRevisionId?"success":"warning"],
        ["Controlled baseline",r.baselineLabel?planningRevisionLabel(r.baselineLabel):"Unresolved",r.baselineRevisionId?"Baseline revision; full document reference in details":"no confirmed baseline",r.baselineRevisionId?"success":"warning"],
        ["Programme revisions",r.governedRevisionCount??0,"non-recovery revisions"],
        ["Recovery scenarios",r.recoveryScenarioCount??0,"Separate from the current programme"]
      ]),true)+
      experienceSourceContext(key,data)+
      managementPanel("WBS & Work-Package Control","WBS names come from the programme. Confirm them against the approved work-package structure.",planningKpis([
        ["Observed WBS",w.observedWbsCount??0,"Programme labels"],
        ["Activities",w.activityCount??0,"current programme"],
        ["WBS activity coverage",w.observedCoveragePercent===null||w.observedCoveragePercent===undefined?"Unresolved":fmt(w.observedCoveragePercent)+"%","observed mapping"],
        ["Official package coverage",w.officialWorkPackageCoveragePercent===null||w.officialWorkPackageCoveragePercent===undefined?"Unresolved":fmt(w.officialWorkPackageCoveragePercent)+"%",humanizeKey(w.officialWorkPackageState||"not_established"),w.officialWorkPackageState==="established"?"success":"warning"]
      ])+(w.observedWbsLabels?.length?'<details class="management-detail"><summary>Observed WBS labels <span>'+escapeHtml(fmt(w.observedWbsLabels.length))+' labels</span></summary><div class="management-tag-list">'+w.observedWbsLabels.map(label=>'<span>'+escapeHtml(label)+'</span>').join("")+'</div></details>':""))+
      managementPanel("Specialist positions","Open each module to review its current position and supporting evidence.",positionRows?'<div class="table-wrap"><table><thead><tr><th>Workstream</th><th>Position</th><th>Status</th><th>Reason</th><th>Correction source</th></tr></thead><tbody>'+positionRows+'</tbody></table></div>':'<div class="empty">No specialist positions are established.</div>')+
      managementPanel("Live Alert Feed","The same confirmed alert set used by Command Center is shown here for integrated control.",renderManagementAlerts(data.alerts||[]))+
      managementPanel("Suggested updates for review","Review each suggested update with its supporting document. Use the relevant page to approve, reject or defer it before it changes the project position.",candidateRows?'<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Type</th><th>Status</th><th>Source evidence</th><th>Owning module</th></tr></thead><tbody>'+candidateRows+'</tbody></table></div>':'<div class="notice info">No current candidate is waiting for review.</div>')+
      managementPanel("Information to confirm","Confirm missing information, outdated records and conflicting values.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      managementPanel("Approvals and publication","A report awaiting publication does not change the recorded project figures.",renderManagementEvidenceGaps(data.governanceGaps||[])+renderManagementConsistency(data.consistency))+
      managementPanel("Control History","Audit history records evidence updates, board publications and the latest certified recalculation. It does not invent actors that were not recorded.",historyRows?'<div class="table-wrap"><table><thead><tr><th>Date/time</th><th>Entity</th><th>Action</th><th>Actor</th><th>State</th><th>Source</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty">No management-control history is available.</div>')+
      '</div>';
  }
  return"";
}

function renderSpecializedModule(key,data){
  if(key==="source-quality")return renderSourceQuality(data);
  if(["master-dashboard","command-center","master-control-programme","source-quality"].includes(key))return renderManagementControlVisual(key,data);
  if(key==="pmo-analysis")return renderPmoVisual(data);
  if(key==="schedule-analytics")return renderScheduleAnalyticsVisual(data);
  if(key==="activity-analytics")return renderActivityAnalyticsVisual(data);
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
  if(key==="delay-claims")return renderDelayClaimsVisual(data);
  if(key==="notices-claims")return renderNoticesClaimsVisual(data);
  if(key==="windows-analysis")return renderWindowsVisual(data);
  if(key==="eot-assessment")return renderEotVisual(data);
  if(["commercial-overview","cost-forecast","variations-change","payments","cash-flow","commercial-claims-notices","contract-particulars-bonds"].includes(key))return renderCommercialVisual(key,data);
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
function renderModuleBasis(data,detail=false){
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
  const baselineHeadline=data?.baselineComparison?.state==='unresolved'&&['schedule_analytics','activity_analytics','milestones','near_critical','progress_report','progress_scurve','variance_trends','progress_breakdown','lookahead_schedule','challenge_contract'].includes(root.projectionKey)?'<p class="source-scope-summary">Baseline comparisons unresolved: no confirmed baseline.</p>':'';
  const completion=contract?.completionAuthority;
  const completionHeadline=completion&&!completion.governedContractualFinish&&['master_dashboard','command_center','pmo_analysis','independent_forecast','eot_assessment','notices_claims','milestones','commercial_claims_notices','contract_particulars_bonds','challenge_contract'].includes(root.projectionKey)?'<div class="notice warn"><b>Contract completion: unresolved.</b> '+escapeHtml(completion.reason||completion.explanation)+'</div>':'';
  const excludedActuals=[...(contract?.excludedScheduleActualEvents?.future||[]),...(contract?.excludedScheduleActualEvents?.undated||[])];
  const actualScopeHtml=excludedActuals.length?'<details class="notice warn"><summary>'+fmt(excludedActuals.length)+' schedule actual events excluded from the Data Date position</summary><p>Historical completion and progress are withheld for affected records. Source evidence and planned dates are retained.</p><table><thead><tr><th>Activity</th><th>Actual event</th><th>Source date</th></tr></thead><tbody>'+excludedActuals.map(r=>'<tr><td>'+escapeHtml(r.activityId)+'</td><td>'+escapeHtml(humanizeKey(r.event))+'</td><td>'+escapeHtml(r.dateIso)+'</td></tr>').join('')+'</tbody></table></details>':'';
  const authorityHtml=completion&&['eot_assessment','commercial_claims_notices','contract_particulars_bonds'].includes(root.projectionKey)?'<div class="notice info"><b>Completion authority.</b> Contract completion: '+escapeHtml(planningShortDate(completion.governedContractualFinish))+' ('+escapeHtml(humanizeKey(completion.authority))+'). '+escapeHtml(completion.explanation)+'</div>':'';
  if(detail)return completionHeadline+authorityHtml+actualScopeHtml+populationHtml;
  const newer=contract?.newerUnadoptedSchedules||[];
  const unresolvedCalendar=contract?.calendarResolution?.unresolvedActivityCount||0;
  const calendarHeadline=unresolvedCalendar&&['independent_forecast','near_critical','pmo_analysis','master_dashboard','command_center','project_director','schedule_analytics'].includes(root.projectionKey)?'<div class="notice warn"><b>Unresolved: '+fmt(unresolvedCalendar)+' activities.</b> Their working calendars could not be read. Programme calendar recalculation, its comparison with the contract, and the near-critical count are unresolved.</div>':'';
  const newerHeadline=newer.length?'<div class="notice warn"><b>Newer programme supplied, not adopted.</b> '+newer.map(r=>escapeHtml(planningShortDate(r.dataDateIso))+' · '+escapeHtml(r.filename||'Programme')).join('; ')+'</div>':'';
  return baselineHeadline+completionHeadline+newerHeadline+calendarHeadline+'<div class="module-basis">'+values.map(([label,value])=>'<span class="basis-chip"><b>'+escapeHtml(label)+'</b><strong title="'+escapeHtml(label==="Programme basis"&&revision?revision:value)+'">'+escapeHtml(value)+'</strong></span>').join("")+'</div>';
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
function renderModuleResult(result){
  result={...result,key:result.legacyKey||result.key};
  currentModuleResult=result;
  el("moduleContent").classList.remove("empty");
  renderRoleViewSelector();
  const managementSurface=managementSurfaceKeysForApi.has(result.key);
  el("roleViewSelector").style.display=managementSurface?"none":"";
  const moduleName=names[result.key]||result.key;
  const roleLabel=managementSurface?"Management Control":(roleViews[selectedRoleView]?.label||roleViews.overall.label);
  el("moduleTitle").textContent=moduleName;
  el("moduleSubtitle").textContent=(descriptions[result.key]||"Current position, key changes and actions requiring attention.")+(managementSurface?"":" · "+roleLabel);
  el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="issue-badge "+(result.issueAssessment?.primaryKind||"verification_pending");
  el("moduleBadge").textContent=result.issueAssessment?.counts?.system_defect>0?"Calculation error":"";
  if(result.key==='challenge-contract'&&result.data?.suppliedBoq?.rows?.length&&renderDeliveryChallenge(result.data,result.reason,result.status))return;
  if(result.status==="blocked"){
    const blockedBody='<div class="view-state-bar">'+issueBadge(result.issueAssessment)+'<strong>'+escapeHtml(moduleName)+'</strong><span>The calculation is unavailable. The classified findings identify the reason and responsible action.</span></div><div class="notice warn">'+escapeHtml(result.reason||"The required calculation is not confirmed.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Calculation dependency</b><span>'+escapeHtml(humanizeKey(x))+'</span></div>').join("")+'</div>';
    el("moduleContent").innerHTML=blockedBody+renderModuleReadiness({issueAssessment:result.issueAssessment},result.reason);
    return;
  }
  const data=result.data||{};
  if(data.registerReadIssues?.length){el('moduleContent').innerHTML='<div class="notice warn"><b>Unresolved register</b>'+data.registerReadIssues.map(r=>'<p>'+escapeHtml(r.filename)+': '+escapeHtml(r.message)+'</p>').join('')+'</div>';return;}
  el("directorDrawer").open=false;
  el("directorDrawer").hidden=result.key!=="pmo-analysis";
  if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason,result.status))return;
  const basisHtml=renderPositionVerdict(data)+renderModuleBasis(data)+renderRegisterScope(data);
  const challengeBody=renderUniversalChallenge(data.challenge);
  const challengeHtml=challengeBody?'<details class="reconciliation-panel"><summary><span>Comparison with the submitted position</span><b>'+escapeHtml(reconciliationSummary(data.challenge))+'</b></summary><div class="reconciliation-body">'+challengeBody+'</div></details>':'';
  const specialized=renderSpecializedModule(result.key,data);
  const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");
  const structured=specialized?"":renderStructuredSections(data);
  const genericView=(scalars?'<div class="scalar-grid">'+scalars+'</div>':'')+structured;
  const sourceBasis=renderBasisReviews(data,result.key);
  const commercialBasisDetails=['commercial-overview','cost-forecast','progress-report'].includes(result.key);
  const managementLead=['master-dashboard','command-center','pmo-analysis'].includes(result.key);
  const primaryView=renderClaimsReporting(data.claimsReporting,result.key)+(managementLead?(specialized||genericView)+(sourceBasis?experienceDisclosure('Supporting project analysis',sourceBasis,'Package, record and calculation detail'):''):commercialBasisDetails?(specialized||genericView)+(sourceBasis?'<details class="reconciliation-panel"><summary><span>Compare documents and contract versions</span><b>Amounts, dates and versions</b></summary><div class="reconciliation-body">'+sourceBasis+'</div></details>':''):sourceBasis+(specialized||genericView));
  const generated=data.challenge?.generatedAt||findProjectionRoot(data)?.generatedAt||data.generatedAt||null;
  const viewState=result.status==="ready"?"":'<div class="view-state-bar">'+issueBadge(result.issueAssessment)+'<strong>'+escapeHtml(moduleName)+'</strong>'+(generated?'<span>Updated '+escapeHtml(formatDocumentTime(generated))+'</span>':'')+'</div>';
  el("directorDrawer").open=false;
  el("directorDrawer").hidden=result.key!=="pmo-analysis";
  const userReason=userFacingModuleReason(result.key,result.reason);
  const context=basisHtml;
  el("moduleContent").innerHTML=context+(managementSurface?primaryView:renderRoleContent(result.key,data,primaryView,challengeHtml,Boolean(specialized)))+experienceReviewSummary(data.issueAssessment,managementSurface)+renderModuleReadiness(data,userReason);
}
let moduleRequestSeq=0;
const managementSurfaceKeysForApi=new Set(["master-dashboard","command-center","master-control-programme","source-quality"]);
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
  if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}
  const moduleName=names[key]||key;
  const requestSeq=++moduleRequestSeq;
  currentModuleResult=null;
  el("moduleContent").classList.remove("empty");
  el("moduleTitle").textContent=moduleName;
  el("moduleSubtitle").textContent=descriptions[key]||"Current position, key changes and actions requiring attention.";
  el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="badge";
  el("moduleBadge").textContent="Updating";
  setBusy("Updating "+moduleName);
  el("moduleContent").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Updating '+escapeHtml(moduleName)+'</strong><span>Preparing the latest project position.</span></div>';
  try{
    let result;
    if(managementSurfaceKeysForApi.has(key)){
      result=await api("/api/projects/"+encodeURIComponent(project())+"/management/"+encodeURIComponent(apiKeys[key]||key));
    }else{
      const moduleArea=commercialModuleKeysForApi.has(key)?"commercial":"schedule";
      result=await api("/api/projects/"+encodeURIComponent(project())+"/"+moduleArea+"/modules/"+encodeURIComponent(apiKeys[key]||key));
    }
    if(requestSeq!==moduleRequestSeq)return;
    renderModuleResult(result);
  }catch(e){
    if(requestSeq!==moduleRequestSeq)return;
    const d=e.data||{};
    if((d.legacyKey||d.key)===key&&d.status==="blocked"&&d.issueAssessment){
      renderModuleResult(d);
    }else{
      el("moduleBadge").className="badge";
      el("moduleBadge").textContent="Not loaded";
      el("moduleContent").innerHTML='<section class="notice error" role="alert"><h4>Unable to load '+escapeHtml(moduleName)+'</h4><p>The latest position has not been retrieved. Try this view again.</p><button class="btn" id="retryModule">Try again</button><details><summary>Request details</summary><p>'+escapeHtml(d.reason||d.error||e.message||"The request did not complete.")+'</p></details></section>';
      el("retryModule").onclick=()=>loadModule(key);
    }
  }finally{
    if(requestSeq===moduleRequestSeq)setBusy("");
  }
}
function kpi(label,value,sub=""){if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=planningShortDate(value);return'<div class="card kpi-card"><div class="kpi-label">'+escapeHtml(label)+'</div><div class="kpi-value">'+escapeHtml(fmt(value))+'</div><div class="kpi-sub">'+escapeHtml(sub)+'</div></div>'}
function evidenceCount(state,value,knownSubset){if(state==="established"&&value!==null&&value!==undefined)return fmt(value);if(typeof knownSubset==="number")return fmt(knownSubset)+" confirmed; full total not confirmed";if(state==="submitted_unparsed")return"Source submitted · count not confirmed";return"Unresolved"}
function renderDirector(d){if(!d){el("director").innerHTML='<div class="card"><div class="empty">Open a project to load its management detail.</div></div>';return}const s=d.schedule,c=d.claims,ctrl=d.controls;let html='<div class="grid kpi">'+kpi("Data Date",s.dataDateIso)+kpi("Contract Completion",s.contractualCompletionIso||"Unresolved")+kpi("Further Adjusted Completion",s.officialAdjustedCompletionIso||"Unresolved","additional adjustment after the current contract basis")+kpi("Submitted Programme Finish",s.submittedProgrammeCompletionIso||"Unresolved")+kpi("Programme calendar recalculation",s.independentForecastCompletionIso||"Unresolved","Submitted logic on its own calendars; not attributable delay")+kpi("Positive submitted window movement",c.observedProgrammeMovementDays,"sum of positive submitted project-finish changes; not EOT")+kpi("Time-impact candidate",c.analyticalTimeImpactCandidateDays,"analytical, not entitlement")+kpi("Attributable EOT candidate",c.attributableCandidateEotDays,"analytical, not awarded")+kpi("Gross source-approved EOT",c.officialApprovedEotDays,"dated determinations through DD; overlap and further adjustment require reconciliation")+kpi("Network calculation",s.independentCpmState==="established"?"Computed":"Unavailable","Graph/calculation coverage only; source float and calendars require reconciliation")+kpi("Claims linked",c.claimCount===null||c.claimCount===undefined?"Unresolved":fmt(c.fullyLinkedClaimCount??0)+" / "+fmt(c.claimCount),"claim → event → activity")+kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),humanizeKey(d.ld.state))+'</div>';html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';(d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations · source aggregate",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention deducted through DD",r.retentionDeductedAmount],["Held balance",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line" title="'+escapeHtml(commercialFindingTitle(x[1]))+'"><span>'+x[0]+'</span><strong>'+escapeHtml(commercialFindingText(x[1]))+'</strong></div>').join("")+'</div>'});html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+'<div class="scalar"><b>Open HSE</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openHseIncidentCount))+'</span></div>'+'<div class="scalar"><b>Reported lost-time injuries</b><span>'+escapeHtml(d.sourceInterpretation?.hse?.metrics?.lostTimeInjuries??"Unresolved")+'</span></div>'+'<div class="scalar"><b>Major / critical NCR</b><span>'+escapeHtml(evidenceCount(ctrl.qualityEvidenceState,ctrl.openCriticalMajorNcrCount,ctrl.reporting?.knownCounts?.openCriticalMajorNcrCount))+'</span></div>'+'<div class="scalar"><b>Overdue RFI</b><span>'+escapeHtml(evidenceCount(ctrl.rfiEvidenceState,ctrl.overdueRfiCount))+'</span></div>'+'<div class="scalar"><b>Permit issues</b><span>'+escapeHtml(evidenceCount(ctrl.permitEvidenceState,ctrl.overduePermitCount))+'</span></div>'+'<div class="scalar"><b>Expiring bonds</b><span>'+escapeHtml(evidenceCount(ctrl.bondEvidenceState,ctrl.expiringBondCount30Days))+'</span></div>'+'<div class="scalar"><b>Open risks</b><span>'+escapeHtml(evidenceCount(ctrl.riskEvidenceState,ctrl.openRiskCount))+'</span></div>'+'</div></div></div>';el("director").innerHTML=html}
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
    return '<div class="queue-row">'+queueFileHtml(file)+'<div class="queue-role-control"><label>This programme is</label><select class="schedule-role" data-index="'+i+'" title="Select role for '+escapeHtml(full)+'"><option value="baseline" '+(role==="baseline"?"selected":"")+'>Baseline</option><option value="update" '+(role==="update"?"selected":"")+'>Update</option><option value="revised_baseline" '+(role==="revised_baseline"?"selected":"")+'>Revised baseline</option><option value="recovery" '+(role==="recovery"?"selected":"")+'>Recovery</option></select></div><button class="queue-remove" data-type="schedule" data-index="'+i+'">Remove</button></div>';
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
  if(!overview){
    selectedEvidenceDocuments.clear();
    el("evidenceBadge").textContent="0 documents";
    el("evidenceLibrary").innerHTML='<div class="empty">No project documents have been added.</div>';
    return;
  }
  try{
    const data=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/documents");
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
      return '<tr><td class="select-col"><input type="checkbox" class="evidence-select" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'"'+checked+'></td><td class="document-file" title="'+escapeHtml(full)+'"><b>'+escapeHtml(d.sourceFilename)+'</b><span class="muted">'+escapeHtml(full)+'</span></td><td class="document-updated" title="'+escapeHtml(d.uploadedAt||"")+'"><b>'+escapeHtml(formatDocumentTime(d.uploadedAt))+'</b><small>'+escapeHtml(d.uploadedAt||"—")+'</small></td><td><b>'+escapeHtml(humanizeKey(d.classificationReview?.category||d.category))+'</b><br>'+escapeHtml(humanizeKey(d.classificationReview?.documentType||d.documentType))+(d.classificationReview?.reviewRequired?'<br><span class="badge partial">Stored as '+escapeHtml(humanizeKey(d.documentType))+' · mapping review required</span>':'')+title+'</td><td class="document-position"><span class="badge '+positionClass+'">'+escapeHtml(position)+'</span></td><td>'+escapeHtml(humanizeKey(d.lineage?.effect||"unknown"))+(d.lineage?.replacesEntireBasis?'<br><span class="badge partial">replaces current document</span>':d.lineage?.appliesAsDelta?'<br><span class="badge">additional record</span>':'')+'</td><td>'+escapeHtml(confidence)+(i.needsReview?'<br><span class="badge partial">review</span>':'')+'</td><td>'+escapeHtml(humanizeKey(method))+'</td><td>'+escapeHtml(conflict)+'</td><td title="'+escapeHtml(readNote)+'"><b>'+escapeHtml(readLabel)+'</b><br><span class="muted">'+escapeHtml(readNote)+'</span></td><td>'+escapeHtml(d.scheduleRole?humanizeKey(d.scheduleRole):"—")+'</td><td>'+escapeHtml(mapping)+'</td><td><button class="document-delete document-delete-single" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'">Delete</button></td></tr>';
    }).join("")+'</tbody></table></div>';
    bindDocumentDeletion();
    bindEvidenceSelection();
  }catch(e){
    el("evidenceLibrary").innerHTML='<div class="notice warn">Document register could not be loaded: '+escapeHtml(e.message)+'</div>';
  }
}
function positionText(p){
  if(p.positionState==="current")return["current","Current position"];
  if(p.positionState==="needs_review")return["review","Review required"];
  return["missing","Needs project records"];
}
function projectCard(p){
  const [positionClass,positionLabel]=positionText(p);
  const metadataOnly=p.summaryMode==="metadata_only";
  const forecast=p.forecastCompletionIso?planningShortDate(p.forecastCompletionIso):(metadataOnly?"Open project":"Unresolved");
  const official=p.officialCompletionIso?planningShortDate(p.officialCompletionIso):"Unresolved";
  const movement=p.programmeMovementDays===null||p.programmeMovementDays===undefined?(metadataOnly?"Open project":"Unresolved"):fmt(p.programmeMovementDays)+" days";
  const claims=p.claimCount===null||p.claimCount===undefined?(metadataOnly?"Open project":"Unresolved"):fmt(p.claimCount)+" claim"+(p.claimCount===1?"":"s");
  const eot=p.approvedEotDays===null||p.approvedEotDays===undefined
    ?(metadataOnly?"Open project for current EOT assessment":"Source-approved EOT not confirmed")
    :fmt(p.approvedEotDays)+" gross source-approved days through DD; open project for integrated assessment";
  const forecastLabel=p.forecastLabel||"Current forecast";
  const contractLabel=p.officialCompletionIso?(p.contractualCompletionState==="official"||p.contractualCompletionState==="established"?"Contract basis: ":"Contract source / review: ")+official:"Contract completion unresolved";
  const adjustmentLabel=metadataOnly?"Open project for further adjusted completion":p.furtherAdjustedCompletionIso?"Further adjusted: "+planningShortDate(p.furtherAdjustedCompletionIso):"Further adjustment not confirmed";
  const managementCount=p.managementActionCount===null||p.managementActionCount===undefined?null:p.managementActionCount;
  const attention=(p.managementActions||[])[0]||(
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
        '<div class="project-meta">'+escapeHtml(p.latestDataDateIso?planningShortDate(p.latestDataDateIso):"No current data date")+' · '+escapeHtml(p.revisionCount)+' programme revision'+(p.revisionCount===1?"":"s")+' · '+escapeHtml(p.evidenceDocumentCount)+' documents</div>'+
        '<span class="position-chip '+positionClass+'">'+positionLabel+'</span></div>'+
      '<div class="portfolio-project-metric"><span>'+escapeHtml(forecastLabel)+'</span><strong>'+escapeHtml(forecast)+'</strong><small>'+escapeHtml(contractLabel)+'</small><small>'+escapeHtml(adjustmentLabel)+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Project completion movement</span><strong>'+escapeHtml(movement)+'</strong><small>Net first-to-latest controlled completion movement</small></div>'+
      '<div class="portfolio-project-metric"><span>Claims / EOT</span><strong>'+escapeHtml(claims)+'</strong><small>'+escapeHtml(eot)+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Management</span><strong>'+escapeHtml(managementCount===null?(metadataOnly?"Open project":"Unresolved"):fmt(managementCount)+" action"+(managementCount===1?"":"s"))+'</strong><small>'+escapeHtml(p.commercialCurrencyCount===null||p.commercialCurrencyCount===undefined?(metadataOnly?"Open project for commercial position":"Commercial position unresolved"):p.commercialCurrencyCount?fmt(p.commercialCurrencyCount)+" commercial currenc"+(p.commercialCurrencyCount===1?"y":"ies"):"No commercial currencies established")+'</small></div>'+
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
  const attention=projects.filter(p=>p.positionState!=="current"||(p.managementActionCount||0)>0).length;
  const docs=projects.reduce((sum,p)=>sum+(p.evidenceDocumentCount||0),0);

  el("portfolioStats").innerHTML=[
    ["▣",data.projectCount||0,"Live projects","User projects in this portfolio"],
    ["▥",current,"Current positions","Position updated and certified"],
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

  el("projectRegister").innerHTML='<div class="table-wrap"><table><thead><tr><th>Project</th><th>Data date</th><th>Documents</th><th>Programme revisions</th><th>Current position</th><th>Management actions</th><th></th></tr></thead><tbody>'+projects.map(p=>{const position=positionText(p)[1];return'<tr><td><b>'+escapeHtml(p.projectId)+'</b></td><td>'+escapeHtml(p.latestDataDateIso?planningShortDate(p.latestDataDateIso):"—")+'</td><td>'+escapeHtml(p.evidenceDocumentCount)+'</td><td>'+escapeHtml(p.revisionCount)+'</td><td>'+escapeHtml(position)+'</td><td>'+escapeHtml(p.managementActionCount||0)+'</td><td><button class="btn small open-project" data-project="'+escapeHtml(p.projectId)+'">Open</button></td></tr>'}).join("")+'</tbody></table></div>';

  bindProjectOpeners();
}
async function loadPortfolio(){
  try{portfolioData=await api("/api/portfolio");renderPortfolio()}catch(e){el("portfolioProjects").innerHTML='<div class="notice error">Projects could not be loaded: '+escapeHtml(e.message)+'</div>'}
}
function updateActiveProjectShell(){
  const id=overview?.projectId||project();
  const displayDataDate=overview?.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"No data date";
  if(appView==="project")el("platformContextTitle").textContent=id;
  el("activeProjectName").textContent=overview?id:"No project selected";
  el("activeProjectMeta").textContent=overview?(displayDataDate+" · "+overview.evidenceDocumentCount+" project documents"+(overview.releaseCommitSha?" · Release "+overview.releaseCommitSha.slice(0,7):"")):"Open a project from Portfolio or Projects";
  el("workspaceProjectMeta").textContent=overview?(id+" · Data Date "+displayDataDate+(overview.releaseCommitSha?" · Release "+overview.releaseCommitSha.slice(0,7):" · Release not supplied")):"No project selected";
  el("aiProjectBadge").className="badge";
  el("aiProjectBadge").textContent=overview?id:"No active project";
  el("aiProjectInfo").innerHTML=overview?'<b>'+escapeHtml(id)+'</b><br>'+escapeHtml(overview.evidenceDocumentCount)+' evidence documents<br>'+escapeHtml(overview.revisionCount)+' schedule revisions<br>'+escapeHtml(overview.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"No current data date"):'No project selected.';
}
function setAppView(view){
  appView=view;
  ["portfolio","projects","ai"].forEach(name=>{el(name+"View").hidden=view!==name});
  el("projectWorkspace").hidden=view!=="project";
  document.body.classList.toggle("project-active",view==="project"&&!!overview);
  const titles={portfolio:"Portfolio",projects:"Projects",ai:"Ask CMeng",project:project()||"Project Controls"};
  el("platformContextTitle").textContent=titles[view]||"CMeng";
  renderPlatformNav();
  renderNav();
  if(view==="portfolio"||view==="projects")loadPortfolio();
  if(view==="ai")updateActiveProjectShell();
  window.scrollTo({top:0,behavior:"smooth"});
}
async function openProject(projectId){
  if(!projectId)return;
  el("projectId").value=projectId;
  localStorage.setItem("cmeng-project",projectId);
  appView="project";
  setAppView("project");
  el("projectBadge").className="badge";
  el("projectBadge").textContent="OPENING PROJECT";
  el("moduleContent").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Opening '+escapeHtml(projectId)+'</strong><span>Loading the current project position.</span></div>';
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
  setBusy("Updating project position");
  try{
    const receipt=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/rerun",{method:"POST"});
    el("globalStatus").textContent=receipt.certification.state==="pass"?"Project position updated":"Project position needs review";
    await refresh(false);
  }catch(e){
    const d=e.data||{};
    el("globalStatus").textContent=d.certification?"Project position needs review":"Project position could not be updated · "+e.message;
    if(d.certification){await refresh(false)}
  }finally{setBusy("")}
}
async function afterEvidenceChange(){
  if(el("runAfterUpload")?.checked){await runAnalysis()}else{await refresh(false)}
}
async function askCmeng(){
  if(!overview){el("aiAnswer").textContent="Open a project first.";return}
  const question=el("aiQuestion").value.trim();
  if(!question)return;
  el("aiAnswer").textContent="Reviewing the current project position...";
  try{
    const result=await api("/api/projects/"+encodeURIComponent(project())+"/intelligence/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question})});
    el("aiAnswer").textContent=result.answer+(result.managementActions?.length?"\n\nManagement actions:\n"+result.managementActions.map(x=>"• "+x).join("\n"):"")+(result.governance?"\n\n"+result.governance:"");
    el("aiProjectInfo").innerHTML='<b>'+escapeHtml(result.projectId)+'</b><br>'+result.relevantModules.map(x=>escapeHtml((names[x.key]||humanizeKey(x.key))+" · "+statusLabel(x.status))).join("<br>");
  }catch(e){el("aiAnswer").textContent="CMeng AI could not answer: "+e.message}
}
function renderAiSuggestions(){
  const qs=["What changed since the previous schedule update?","What is driving the current completion forecast?","Which delay events have the strongest time impact?","What project information is missing from the look-ahead?","What commercial exposure is linked to schedule delay?"];
  el("aiSuggestions").innerHTML=qs.map(q=>'<button class="ai-suggestion">'+escapeHtml(q)+'</button>').join("");
  document.querySelectorAll(".ai-suggestion").forEach(b=>b.onclick=()=>{el("aiQuestion").value=b.textContent;askCmeng()});
}
let directorRequestSeq=0;
async function loadDirector(projectId=project(),attempt=0){
  const requestSeq=++directorRequestSeq;
  el("director").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Loading management detail</strong></div>';
  try{
    const position=await api("/api/projects/"+encodeURIComponent(projectId)+"/director-position");
    if(requestSeq!==directorRequestSeq||projectId!==project())return;
    renderDirector(position);
  }catch(e){
    if(requestSeq!==directorRequestSeq||projectId!==project())return;
    const currentOverview=typeof overview!=="undefined"?overview:null;
    const programmeEstablished=currentOverview?.minimumEvidenceBasis?.schedule?.established===true;
    if(e.status===404&&programmeEstablished&&attempt<4){
      el("director").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Updating management position</strong><span>The project documents are loaded; the management position is being rebuilt from the current evidence.</span></div>';
      setTimeout(()=>{if(requestSeq===directorRequestSeq&&projectId===project())loadDirector(projectId,attempt+1)},600);
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
async function refresh(bootstrapDemo=true){
  setBusy("Refreshing project");
  const projectId=project();
  try{
    const loadedOverview=await api("/api/projects/"+encodeURIComponent(projectId)+"/overview");
    overview=loadedOverview;
    localStorage.setItem("cmeng-project",projectId);
    try{renderStatus(overview)}catch{}
    updateActiveProjectShell();
    renderNav();
    await Promise.allSettled([
      loadModule(selected),
      loadEvidence(),
      loadDirector(projectId)
    ]);
  }catch(e){
    if(bootstrapDemo&&e.status===404&&projectId==="UAT-DEMO"){
      try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});return await refresh(false)}catch{}
    }
    overview=null;
    updateActiveProjectShell();
    renderNav();
    try{renderDirector(null)}catch{}
    el("projectStatus").innerHTML='<div class="notice warn">Open or create a project, then add project documents.</div>';
    el("projectBadge").className="badge blocked";
    el("projectBadge").textContent="NO PROJECT";
    try{await loadEvidence()}catch{}
  }finally{
    setBusy("");
  }
}
async function loadDemo(){setBusy("Loading demonstration project");try{el("projectId").value="UAT-DEMO";localStorage.setItem("cmeng-project","UAT-DEMO");await api("/api/projects/UAT-DEMO/demo",{method:"POST"});selected="pmo-analysis";await refresh(false);el("uploadMessage").innerHTML='<div class="notice info">Demonstration project loaded. Your own projects are not changed.</div>'}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadSchedules(){if(!scheduleSelection.length)return;setBusy("Adding programme revisions");const roles=[...document.querySelectorAll(".schedule-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});const results=[];try{for(let i=0;i<scheduleSelection.length;i+=1){const file=scheduleSelection[i];const headers={"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"schedule","x-upload-intent":el("scheduleIntent").value,"x-schedule-role":roles[i]||inferScheduleRole(file.name)};results.push(await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers,body:file}))}el("uploadMessage").innerHTML='<div class="notice info">'+results.length+'  programme revision(s) added. Baselines and updates remain in the project history; recovery programmes remain separate.</div>';scheduleSelection=[];el("scheduleFiles").value="";renderScheduleQueue();await afterEvidenceChange()}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadBoqs(){if(!boqSelection.length)return;setBusy("Adding BOQ revisions");let count=0;try{for(const file of boqSelection){await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"boq_cost","x-document-type":"boq","x-upload-intent":el("boqIntent").value},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+'  BOQ revision(s) added and retained.</div>';boqSelection=[];el("boqFiles").value="";renderSimpleQueue("boqQueue",boqSelection,"boq");await afterEvidenceChange()}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadContracts(){if(!contractSelection.length)return;setBusy("Adding contract documents");const roles=[...document.querySelectorAll(".contract-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});let count=0;try{for(let i=0;i<contractSelection.length;i+=1){const file=contractSelection[i];const role=roles[i]||inferContractRole(file.name);const docType=role==="main"?"main_contract":role==="amendment"?"contract_amendment":role==="appendix"?"contract_appendix":role==="tender"?"tender_employer_requirements":role==="replacement"?"contract_replacement":"contract_supporting_document";await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"contract","x-document-type":docType,"x-upload-intent":el("contractIntent").value},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+'  contract document(s) added. Amendments remain separate from the main contract.</div>';contractSelection=[];el("contractFiles").value="";renderContractQueue();await afterEvidenceChange()}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
function uploadEvidenceFileWithProgress(file,fileIndex,fileTotal){
  return new Promise((resolve,reject)=>{
    const id=uploadId();
    const url="/api/projects/"+encodeURIComponent(project())+"/evidence/uploads";
    const xhr=new XMLHttpRequest();
    let lastServerProgress=null;
    let pollBusy=false;
    xhr.open("POST",url,true);
    xhr.setRequestHeader("content-type",fileType(file));
    xhr.setRequestHeader("x-source-filename",file.name);
    xhr.setRequestHeader("x-source-relative-path",file.webkitRelativePath||file.name);
    xhr.setRequestHeader("x-upload-intent",el("evidenceIntent").value);
    xhr.setRequestHeader("x-upload-id",id);

    xhr.upload.onprogress=event=>{
      if(!event.lengthComputable)return;
      const transferPercent=Math.max(0,Math.min(100,Math.round((event.loaded/event.total)*100)));
      const serverPercent=Math.max(0,Math.round(transferPercent*0.24));
      renderEvidenceUploadProgress({
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
        const response=await fetch("/api/projects/"+encodeURIComponent(project())+"/evidence/upload-progress/"+encodeURIComponent(id),{cache:"no-store"});
        if(response.ok){
          lastServerProgress=await response.json();
          const transferDetail=lastServerProgress.totalBytes
            ? humanBytes(lastServerProgress.receivedBytes)+" / "+humanBytes(lastServerProgress.totalBytes)
            : "";
          renderEvidenceUploadProgress(lastServerProgress,fileIndex,fileTotal,transferDetail);
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
      renderEvidenceUploadProgress(lastServerProgress||{
        state:"complete",
        percent:100,
        message:(data?.documentCount||1)+" documents loaded",
        documentTotal:data?.documentCount||1,
        currentDocument:null
      },fileIndex,fileTotal,"");
      resolve(data);
    };
    xhr.send(file);
  });
}
async function uploadEvidence(){
  if(!evidenceSelection.length)return;
  setBusy("Loading project package");
  let documentCount=0;
  try{
    const files=[...evidenceSelection];
    for(let i=0;i<files.length;i+=1){
      const result=await uploadEvidenceFileWithProgress(files[i],i,files.length);
      documentCount+=result.documentCount||1;
    }
    renderEvidenceUploadProgress({
      state:"complete",
      percent:100,
      message:documentCount+" project documents loaded",
      documentTotal:documentCount,
      identifiedDocuments:documentCount,
      processedDocuments:documentCount,
      currentDocument:null
    },0,1,"");
    evidenceSelection=[];
    el("evidenceFiles").value="";
    renderSimpleQueue("evidenceQueue",evidenceSelection,"evidence");
    if(el("runAfterUpload")?.checked){
      el("uploadMessage").insertAdjacentHTML("beforeend",'<div class="notice info" style="margin-top:9px">Package loading is complete. CMeng is now updating the project position.</div>');
    }
    await afterEvidenceChange();
    el("uploadMessage").insertAdjacentHTML("beforeend",'<div class="notice info" style="margin-top:9px">'+documentCount+' project document(s) loaded. The document register shows the upload/update time for every document.</div>');
  }catch(e){
    el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>';
  }finally{setBusy("")}
}
el("loadDemo").onclick=loadDemo;el("refresh").onclick=()=>refresh(false);el("runAnalysisTop").onclick=runAnalysis;el("openAiTop").onclick=()=>setAppView("ai");el("askAi").onclick=askCmeng;el("createProject").onclick=createProject;el("portfolioNewProject").onclick=()=>setAppView("projects");
function openEvidenceWorkspace(){
  if(!overview){setAppView("projects");el("createProjectMessage").innerHTML='<div class="notice info">Create or open a project before adding documents.</div>';return}
  setFocusMode(false);
  setAppView("project");
  el("evidenceLibraryDrawer").open=false;
  const drawer=el("evidenceControlDrawer");
  drawer.open=true;
}
function openEvidenceLibrary(){
  setFocusMode(false);
  el("evidenceControlDrawer").open=false;
  const drawer=el("evidenceLibraryDrawer");
  drawer.open=true;
}
el("openEvidenceTop").onclick=openEvidenceWorkspace;
el("openLibraryQuick").onclick=openEvidenceLibrary;
function setFocusMode(enabled){document.body.classList.toggle("focus-module",enabled);el("focusMode").classList.toggle("active",enabled);el("focusMode").setAttribute("aria-pressed",String(enabled));el("focusMode").textContent=enabled?"Exit focus":"Focus view";localStorage.setItem("cmeng-focus",enabled?"1":"0")}
el("focusMode").onclick=()=>setFocusMode(!document.body.classList.contains("focus-module"));
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
  if(event.key!=="Escape")return;
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
  if(event.key!=="Escape")return;
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
function reportDownloadUrl(format){
  if(managementSurfaceKeysForApi.has(selected)){
    return "/api/projects/"+encodeURIComponent(project())+"/management/"+encodeURIComponent(selected)+"/report."+format;
  }
  const moduleArea=commercialModuleKeysForApi.has(selected)?"commercial":"schedule";
  return "/api/projects/"+encodeURIComponent(project())+"/"+moduleArea+"/modules/"+encodeURIComponent(selected)+"/report."+format;
}
function reportSafeFilename(value){
  return String(value||"report").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,120)||"report";
}
function openModuleReport(){
  if(!overview||!currentModuleResult||currentModuleResult.key!==selected){
    alert("Wait for the selected view to finish loading, then generate the report.");
    return;
  }
  if(currentModuleResult.status==="blocked"){
    alert("This report cannot be generated until the view has enough project information.");
    return;
  }
  const reportWindow=window.open("","_blank");
  if(!reportWindow){
    alert("Allow pop-ups for CMeng to open the report preview.");
    return;
  }
  const moduleName=names[selected]||selected;
  const roleLabel=managementSurfaceKeysForApi.has(selected)?"Management Control":(roleViews[selectedRoleView]?.label||roleViews.overall.label);
  const subtitle=(descriptions[selected]||"CMeng project-control analysis.")+(managementSurfaceKeysForApi.has(selected)?"":" · "+roleLabel);
  const programme=overview?.latestRevisionLabel?planningRevisionLabel(overview.latestRevisionLabel):"—";
  const dataDate=overview?.latestDataDateIso?planningShortDate(overview.latestDataDateIso):"—";
  const generated=new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date());
  const status=currentModuleResult.issueAssessment?.counts?.system_defect>0?"Calculation correction required":"See figures and review notes";
  const styles=[...document.querySelectorAll("style")].map(node=>node.textContent||"").join("\n");
  const body=el("moduleContent").innerHTML;
  const excelUrl=reportDownloadUrl("xlsx");
  const jsonUrl=reportDownloadUrl("json");
  const filename=reportSafeFilename(project()+"_"+moduleName+"_"+roleLabel+"_"+new Date().toISOString().slice(0,10));
  const report='<html><head><meta charset="utf-8"><title>'+escapeHtml(project()+" · "+moduleName)+'</title><style>'+styles+
    '.report-shell{max-width:1180px;margin:0 auto;padding:28px;background:#fff}.report-header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #315f8a;padding-bottom:16px;margin-bottom:16px}.report-brand{font-size:13px;font-weight:900;letter-spacing:.08em;color:#315f8a}.report-header h1{font-size:26px;margin:5px 0 4px;color:#22364d}.report-header p{margin:0;color:#667085}.report-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0 20px}.report-meta div{padding:10px 12px;border:1px solid #dce5ef;border-radius:8px;background:#f8fbff}.report-meta span{display:block;font-size:9px;text-transform:uppercase;font-weight:800;letter-spacing:.05em;color:#7b8795}.report-meta b{display:block;margin-top:3px;font-size:12px;color:#22364d}.report-toolbar{position:sticky;top:0;z-index:100;display:flex;gap:8px;justify-content:flex-end;padding:10px 0 14px;background:#fff}.report-toolbar a,.report-toolbar button{border:1px solid #bfd0e1;background:#fff;color:#22364d;border-radius:7px;padding:8px 12px;font:600 12px Arial;cursor:pointer;text-decoration:none}.report-toolbar .primary{background:#315f8a;color:#fff;border-color:#315f8a}.visual-focus-button{display:none!important}.module-workspace,.module-panel{box-shadow:none!important;border:0!important}.reconciliation-panel{break-inside:avoid}.planning-panel,.chart-card,.card{break-inside:avoid}@media print{body{background:#fff!important}.report-shell{max-width:none;padding:0}.report-toolbar{display:none!important}.planning-view .table-wrap{max-height:none!important;overflow:visible!important}.lookahead-timeline,.milestone-timeline{max-height:none!important;overflow:visible!important}.auxiliary-drawer{display:none!important}}'+
    '.planning-kpi.unavailable strong{font-size:16px;font-weight:600;line-height:1.45}.planning-kpi.unavailable{background:#f8fafc}</style></head><body><div class="report-shell"><div class="report-toolbar"><button id="reportPrint" class="primary">Save PDF / Print</button><a href="'+escapeHtml(excelUrl)+'" download>Download Excel</a><a href="'+escapeHtml(jsonUrl)+'" download>Download data</a></div>'+
    '<header class="report-header"><div><div class="report-brand">CMENG · PROJECT CONTROL INTELLIGENCE</div><h1>'+escapeHtml(moduleName)+'</h1><p>'+escapeHtml(subtitle)+'</p></div><div><b>'+escapeHtml(project())+'</b></div></header>'+
    '<div class="report-meta"><div><span>Project</span><b>'+escapeHtml(project())+'</b></div><div><span>Review lens</span><b>'+escapeHtml(roleLabel)+'</b></div><div><span>Programme basis</span><b>'+escapeHtml(programme)+'</b></div><div><span>Data date</span><b>'+escapeHtml(dataDate)+'</b></div><div><span>Report generated</span><b>'+escapeHtml(generated)+'</b></div><div><span>View status</span><b>'+escapeHtml(status)+'</b></div></div>'+
    '<main>'+body+'</main><footer style="margin-top:22px;padding-top:10px;border-top:1px solid #dce5ef;font-size:10px;color:#7b8795">Generated from the current CMeng project position. Missing, partial, provisional and official values remain distinct.</footer></div></body></html>';
  reportWindow.document.open();
  reportWindow.document.write(report);
  reportWindow.document.close();
  const reportBoq=currentModuleResult.data?.suppliedBoq;
  if(reportBoq)reportWindow.updateSuppliedBoq=(page,query)=>{
    const target=reportWindow.document.getElementById('suppliedBoqRows');
    if(target)target.innerHTML=renderSuppliedBoqRows(reportBoq,page,query??reportWindow.document.getElementById('suppliedBoqSearch')?.value??'');
  };
  // Preserve the selected lens and open disclosures; do not expand every technical payload in reports.
  const printButton=reportWindow.document.getElementById("reportPrint");
  if(printButton)printButton.onclick=()=>reportWindow.print();
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
