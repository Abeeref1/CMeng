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
.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status-dot{width:8px;height:8px;border-radius:50%;background:#9ba3ad;flex:0 0 auto;box-shadow:0 0 0 3px rgba(90,75,40,.035)}.status-dot.ready{background:#32d583}.status-dot.partial{background:#fdb022}.status-dot.blocked{background:#f97066}
.main{min-width:0}.topbar{min-height:64px;background:rgba(248,247,244,.96);backdrop-filter:blur(12px);border-bottom:1px solid #dfdbd4;display:none;align-items:center;gap:9px;padding:10px 26px;position:sticky;top:0;z-index:10;flex-wrap:wrap;box-shadow:0 1px 0 rgba(15,23,42,.02)}.topbar-context{display:flex;flex-direction:column;gap:1px;padding-left:14px;margin-left:2px;border-left:1px solid var(--line);min-width:150px}.topbar-context b{font-size:12px;color:var(--slate)}.topbar-context span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;font-weight:750}.topbar-spacer{flex:1}.release-state{display:none!important}.release-state:before{content:"";width:7px;height:7px;border-radius:50%;background:#32d583;box-shadow:0 0 0 3px #ecfdf3}.platform-context{display:flex;flex-direction:column;min-width:160px}.platform-context span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:800}.platform-context b{font-size:13px;color:var(--slate)}.project-only{display:none!important}.project-active .topbar{display:flex}.project-active .project-only{display:flex!important}.project-active button.project-only{display:inline-flex!important}.project-active .topbar-context.project-only{display:flex!important}.auto-run-toggle{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted);font-weight:650}.auto-run-toggle input{width:auto}
.project-input{display:flex;align-items:center;gap:9px;min-width:350px}.project-input label{font-size:12px;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}.project-input input{height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px;min-width:220px;background:#fff;color:var(--ink);font-weight:650;outline:none}.project-input input:focus{border-color:#6f96bd;box-shadow:0 0 0 3px rgba(79,127,180,.16)}
.btn{border:1px solid #cbd7e3;background:#fff;border-radius:9px;padding:9px 14px;font-weight:650;font-size:13px;color:var(--slate);min-height:40px;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}.btn:hover{background:#f6f3ee;border-color:#9eb6cf}.btn:active{transform:translateY(1px)}.btn.primary{background:#4f7fb4;border-color:#4f7fb4;color:#fff;box-shadow:0 4px 12px rgba(50,86,125,.16)}.btn.primary:hover{background:#3d6897;border-color:#3d6897}.btn.small{padding:7px 11px;font-size:12px;min-height:34px}.btn.active{background:#ece6de;border-color:#4f7fb4;color:var(--slate)}
.content{padding:30px 34px 66px;width:100%;max-width:none;margin:0}
.workspace-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.workspace-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}.quick-upload-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:11px 14px;border:1px solid #e6e0d4;border-left:3px solid var(--accent);border-radius:9px;background:#fcfbf8;color:var(--ink)}.quick-upload-copy{min-width:0}.quick-upload-copy b{display:block;font-size:14px;margin-bottom:2px}.quick-upload-copy span{font-size:12px;color:var(--muted)}.quick-upload-actions{display:flex;gap:8px;flex:0 0 auto}.btn.upload-cta{background:#fff;color:#3f3525;border-color:#d9cfbd;box-shadow:none}.btn.upload-cta:hover{background:var(--accent-strong);border-color:var(--accent-strong)}.btn.ghost-dark{background:#fff;color:#334155;border-color:#cbd5e1}.btn.ghost-dark:hover{background:#fbfdff;border-color:#b8c4d1}.page-title{margin:0}.page-title .eyebrow,.section-kicker{display:block;font-size:11px;color:#617086;text-transform:uppercase;letter-spacing:.095em;font-weight:800;margin-bottom:6px}.page-title h2{font-size:29px;line-height:1.15;letter-spacing:-.035em;margin:0 0 7px}.page-title p{margin:0;color:var(--muted);font-size:14px;max-width:780px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px}.grid.two{grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr)}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:18px}.card h3{font-size:16px;line-height:1.25;margin:0 0 13px;letter-spacing:-.01em}.kpi-card{padding:17px 18px;min-height:112px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;margin-bottom:9px;font-weight:750}.kpi-value{font-size:25px;font-weight:780;letter-spacing:-.035em;line-height:1.08}.kpi-sub{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.35}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.045em;background:#ece9e4;color:#55616d;white-space:nowrap}.badge.ready{background:#edf7f1;color:var(--ok)}.badge.partial{background:#fff5df;color:var(--warn)}.badge.blocked{background:#fbeeed;color:var(--danger)}
.module-panel{padding:0;margin:0;overflow:hidden;border-radius:12px;box-shadow:var(--shadow-strong);min-height:560px;border-color:#dfdbd4}.module-panel>.module-head{padding:20px 22px 18px;border-bottom:1px solid var(--line);margin:0;background:linear-gradient(180deg,#fff,#faf9f7)}.module-workspace-head>div{min-width:0}.module-workspace-head h3{font-size:24px;margin:0 0 4px;letter-spacing:-.025em}.module-workspace-head p{margin:0;color:var(--muted);font-size:13px}.module-panel #moduleContent{padding:22px;min-height:470px;background:#faf9f7}
.module-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.module-head-actions{display:flex;align-items:center;gap:8px}.module-head-actions #moduleReport{white-space:nowrap}.module-head h3{font-size:18px;margin:0}.role-view-selector{display:flex;align-items:center;gap:7px;padding:11px 18px;border-bottom:1px solid #dce5ef;background:#f7f9fc;overflow-x:auto;scrollbar-width:thin}.role-view-selector-label{flex:0 0 auto;font-size:9.5px;font-weight:850;letter-spacing:.075em;text-transform:uppercase;color:#7b8795;margin-right:4px}.role-view-button{flex:0 0 auto;border:1px solid #ced9e5;background:#fff;color:#506579;border-radius:8px;padding:7px 10px;font-size:10.5px;font-weight:760;white-space:nowrap;transition:.15s ease}.role-view-button:hover{border-color:#9fb7ce;color:#2f5f8d}.role-view-button.active{background:#315f8a;color:#fff;border-color:#315f8a;box-shadow:0 3px 10px rgba(49,95,138,.14)}.role-view-button small{display:none}.role-lens{margin:0 0 14px;border:1px solid #d7e2ed;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(34,54,77,.035)}.role-lens-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;padding:14px 16px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.role-lens-head .section-kicker{margin-bottom:4px}.role-lens-head h4{margin:0;font-size:17px;color:#22364d;letter-spacing:-.015em}.role-lens-head p{margin:5px 0 0;font-size:12px;color:#667085;max-width:900px}.role-lens-badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#edf4fb;color:#315f8a;font-size:9.5px;font-weight:850;text-transform:uppercase;letter-spacing:.045em;white-space:nowrap}.role-lens-body{padding:14px 16px}.role-focus-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}.role-focus-card{border:1px solid #e0e7ef;border-radius:9px;padding:11px 12px;background:#fff}.role-focus-card span{display:block;font-size:9px;color:#8a97a7;text-transform:uppercase;letter-spacing:.055em;font-weight:850}.role-focus-card b{display:block;margin-top:4px;font-size:11.5px;line-height:1.35;color:#344054}.role-signal-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.role-signal{min-width:0;border:1px solid #e1e7ee;border-radius:9px;padding:10px 11px;background:#f9fbfd}.role-signal.danger{border-top:3px solid #b4483e;background:#fff8f7}.role-signal.warning{border-top:3px solid #b57922;background:#fffaf2}.role-signal.success{border-top:3px solid #2c7a57;background:#f7fbf8}.role-signal span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.045em;color:#8491a2;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-signal b{display:block;margin-top:5px;font-size:14px;color:#22364d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.role-action-panel{margin-top:12px;border-top:1px solid #edf1f5;padding-top:11px}.role-action-panel>strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7b8795;margin-bottom:7px}.role-action-list{display:grid;gap:6px}.role-action-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;align-items:start;padding:7px 9px;border-radius:7px;background:#fff8ed;font-size:11px;color:#596777}.role-action-row i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#f4e6c7;color:#8a5a14;font-size:9px;font-weight:850}.role-review-layers{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.role-review-layer{padding:10px;border:1px solid #dfe7ef;border-radius:9px;background:#f9fbfd;min-width:0}.role-review-layer b{display:block;font-size:10.5px;color:#344054}.role-review-layer span{display:block;margin-top:3px;font-size:9.5px;color:#7b8795;line-height:1.3}.role-lens-compact .role-lens-head{border-bottom:0;padding-bottom:10px}.role-lens-compact-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid #edf1f5;background:#fbfcfe}.role-lens-compact-strip>div{padding:9px 14px;border-right:1px solid #edf1f5}.role-lens-compact-strip>div:last-child{border-right:0}.role-lens-compact-strip b{display:block;font-size:10px;color:#344054}.role-lens-compact-strip span{display:block;margin-top:2px;font-size:9.5px;color:#7b8795}.role-primary-analysis{min-width:0}.role-supporting-detail{margin-top:14px;border:1px solid #dce5ef;border-radius:11px;background:#fff;overflow:hidden}.role-supporting-detail>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#fbfdff;cursor:pointer;font-size:11px;font-weight:800;color:#344054}.role-supporting-detail>summary::-webkit-details-marker{display:none}.role-supporting-detail>summary span{font-weight:600;color:#7b8795}.role-supporting-detail-body{padding:14px}.role-view-project-director .role-primary-analysis .table-wrap,.role-view-program-director .role-primary-analysis .table-wrap,.role-view-executive .role-primary-analysis .table-wrap{display:none}.role-view-project-director .role-primary-analysis .technical-payload,.role-view-program-director .role-primary-analysis .technical-payload,.role-view-executive .role-primary-analysis .technical-payload{display:none}.role-view-executive .role-primary-analysis details,.role-view-executive .role-primary-analysis .reconciliation-panel{display:none}.role-view-executive .role-primary-analysis .planning-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.role-view-executive .role-primary-analysis .planning-panel:has(.table-wrap){display:none}.role-view-project-director .role-primary-analysis .planning-panel:has(.table-wrap),.role-view-program-director .role-primary-analysis .planning-panel:has(.table-wrap){display:none}.role-view-planning .role-lens{border-left:4px solid #566e99}.role-view-controls .role-lens{border-left:4px solid #4f7fb4}.role-view-project-director .role-lens{border-left:4px solid #3f7f76}.role-view-program-director .role-lens{border-left:4px solid #6d628e}.role-view-executive .role-lens{border-left:4px solid #315f8a}.role-view-overall .role-lens{border-left:4px solid #22364d}@media(max-width:1280px){.role-signal-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.role-review-layers{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:900px){.role-focus-grid{grid-template-columns:1fr}.role-signal-grid{grid-template-columns:1fr 1fr}.role-review-layers{grid-template-columns:1fr 1fr}.role-lens-compact-strip{grid-template-columns:1fr}.role-lens-compact-strip>div{border-right:0;border-bottom:1px solid #edf1f5}.role-lens-compact-strip>div:last-child{border-bottom:0}.role-lens-head{grid-template-columns:1fr}.role-view-selector{padding:9px 12px}}
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
.planning-view{display:grid;gap:14px;--module-accent:#4f7fb4}.resource-view{--module-accent:#3f7f76}.contract-challenge-view{--module-accent:#8b6b35}.forecast-history-view,.independent-forecast-view{--module-accent:#6d628e}.delay-claims-view,.notices-view,.windows-view,.eot-view{--module-accent:#8b6b35}.window-card.clean{grid-template-columns:minmax(280px,1.2fr) minmax(220px,.8fr) minmax(220px,.8fr)}.movement-value.small{font-size:14px;line-height:1.3}.progress-position-view{--module-accent:#4f7fb4}.variance-view{--module-accent:#8b6b35}.progress-scurve-view{--module-accent:#4f7fb4}.quantity-view{--module-accent:#6f7d4c}.wbs-view{--module-accent:#566e99}.manhour-view{--module-accent:#6d628e}.module-bar-list{display:grid;gap:8px}.module-bar-row{display:grid;grid-template-columns:minmax(150px,.9fr) minmax(180px,1.7fr) 80px;gap:10px;align-items:center}.module-bar-row>span{font-size:11px;color:#506579;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.module-bar-row>div{height:11px;border-radius:999px;background:#edf1f5;overflow:hidden}.module-bar-row i{display:block;height:100%;border-radius:999px;background:#4f7fb4}.module-bar-row i.warning{background:#b57922}.module-bar-row i.danger{background:#b4483e}.module-bar-row i.success{background:#2c7a57}.module-bar-row b{text-align:right;font-size:11px;color:#344054}.progress-basis-bars{display:grid;gap:11px}.progress-basis-row{display:grid;grid-template-columns:minmax(190px,.9fr) minmax(260px,1.6fr) 70px;gap:12px;align-items:center}.progress-basis-row>div:first-child b{display:block;font-size:12px;color:#344054}.progress-basis-row>div:first-child span{display:block;font-size:10px;color:#7b8795;margin-top:2px}.progress-track{height:16px;background:#edf1f5;border-radius:999px;overflow:hidden}.progress-track i{display:block;height:100%;background:#4f7fb4;border-radius:999px}.progress-basis-row strong{text-align:right;font-size:13px}.evidence-gates{display:grid;gap:8px}.evidence-gate{display:flex;justify-content:space-between;gap:12px;padding:10px 11px;border-left:3px solid #98a2b3;border-radius:7px;background:#f8fafc}.evidence-gate.ready{border-left-color:#2c7a57;background:#f4fbf7}.evidence-gate.missing{border-left-color:#b57922;background:#fffaf0}.evidence-gate span{font-size:11px;color:#667085}.evidence-gate b{font-size:11px;color:#344054}.pressure-matrix{display:grid;gap:6px}.pressure-matrix-head,.pressure-matrix-row{display:grid;grid-template-columns:140px repeat(5,minmax(82px,1fr));gap:6px;align-items:stretch}.pressure-matrix-head span,.pressure-matrix-head b{font-size:10.5px;color:#667085;text-align:center;padding:5px}.pressure-matrix-head span{text-align:left}.pressure-matrix-row>strong{display:flex;align-items:center;font-size:11px;color:#344054}.pressure-cell{min-height:48px;border-radius:7px;display:grid;place-items:center;border:1px solid #e3e8ef;background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell.danger{background:rgba(180,72,62,var(--cell-alpha))}.pressure-cell.danger-soft{background:rgba(196,96,79,var(--cell-alpha))}.pressure-cell.warning{background:rgba(181,121,34,var(--cell-alpha))}.pressure-cell.accent{background:rgba(79,127,180,var(--cell-alpha))}.pressure-cell b{font-size:12px;color:#1f3349}.pressure-note,.float-distribution-note{margin-top:9px;font-size:10.5px;color:#7b8795}.constraint-bars,.finish-period-bars{display:grid;gap:8px}.constraint-row,.finish-period-row{display:grid;grid-template-columns:minmax(140px,.9fr) minmax(160px,1.7fr) 54px;gap:10px;align-items:center}.constraint-row span,.finish-period-row span{font-size:11px;color:#506579}.constraint-row>div,.finish-period-row>div{height:10px;background:#eef2f6;border-radius:999px;overflow:hidden}.constraint-row i,.finish-period-row i{display:block;height:100%;background:#b4483e;border-radius:999px}.finish-period-row i{background:#b57922}.constraint-row b,.finish-period-row b{text-align:right;font-size:11px;color:#344054}.revision-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.revision-value-card{border:1px solid #dde5ee;border-radius:9px;padding:11px;background:#fbfdff}.revision-value-head{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e8edf3;padding-bottom:7px}.revision-value-head b{font-size:11.5px;color:#22364d}.revision-value-head span{font-size:10px;color:#7b8795}.revision-value-lines{display:grid;gap:5px;margin-top:8px}.revision-value-lines span{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:#667085}.revision-value-lines b{color:#22364d}.milestone-context{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;padding:7px 9px;border-radius:7px;background:#f6f8fb;font-size:10.5px;color:#667085}.milestone-label small{display:block;margin-top:3px;font-size:9.5px;color:#8a96a6}.lookahead-state{white-space:normal;line-height:1.1}.float-histogram{overflow-x:auto}.management-view{--module-accent:#315f8a}.management-view{display:grid;gap:16px}.management-two-column{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.management-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.management-metric-card{border:1px solid #dce5ef;border-radius:14px;background:#fff;padding:17px 18px;min-height:0;box-shadow:0 7px 20px rgba(34,54,77,.035)}.management-metric-card.attention{border-top:3px solid #b57922}.management-metric-card.critical{border-top:3px solid #b4483e}.management-metric-card.good{border-top:3px solid #2c7a57}.management-metric-card.unavailable{border-top:3px solid #91a0b0}.management-metric-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.management-metric-head>span{font-size:11px;font-weight:820;text-transform:uppercase;letter-spacing:.05em;color:#718096;max-width:72%}.management-metric-value{margin-top:14px;font-family:"Montserrat","Avenir Next","Segoe UI",sans-serif;font-size:28px;line-height:1.12;font-weight:780;letter-spacing:-.035em;color:#22364d;word-break:normal;overflow-wrap:normal}.management-metric-value.date{font-size:27px;white-space:nowrap}.management-metric-value.missing{font-size:21px;color:#667085;letter-spacing:-.015em}.management-metric-badges{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0 13px}.management-metric-basis{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;padding-top:11px;border-top:1px solid #edf1f5;font-size:11.5px}.management-metric-basis span,.management-metric-note span{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:820;color:#8a96a6}.management-metric-basis b{color:#506579;font-weight:700}.management-metric-note{margin-top:10px}.management-metric-note p{font-size:11.5px;line-height:1.45;color:#506579;margin:3px 0 0}.management-metric-note.action p{color:#315f8a;font-weight:650}.management-metric-owner{margin-top:13px}.management-module-link{border:1px solid #bfd0e1;background:#fff;color:#315f8a;border-radius:7px;padding:6px 9px;font-size:10.5px;font-weight:800;cursor:pointer}.management-module-link:hover{background:#f3f7fb}.management-alert-list{display:grid;gap:10px}.management-alert{border:1px solid #dce5ef;border-left:4px solid #91a0b0;border-radius:9px;padding:12px;background:#fff}.management-alert.critical{border-left-color:#b4483e}.management-alert.high{border-left-color:#c67d2e}.management-alert.medium{border-left-color:#b59c4a}.management-alert.information{border-left-color:#4f7fb4}.management-alert-head{display:flex;justify-content:space-between;gap:12px}.management-alert-head b{color:#22364d}.management-alert-head span{text-transform:uppercase;font-size:9px;font-weight:900;color:#7b8795}.management-alert p{font-size:12px;color:#5f6f80}.management-alert-action{display:grid;grid-template-columns:110px 1fr;gap:10px;margin:9px 0;font-size:11.5px}.management-alert-action strong{color:#344054}.management-alert-action span{color:#506579}.management-decision-list{display:grid;gap:10px}.management-decision{display:grid;grid-template-columns:30px 1fr;gap:10px;border:1px solid #dce5ef;border-radius:9px;padding:12px}.management-decision>i{width:26px;height:26px;border-radius:50%;background:#315f8a;color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800}.management-decision b{color:#22364d}.management-decision-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin:7px 0;color:#667085;font-size:10.5px}.management-decision small{color:#8a96a6}.management-detail{margin-top:14px;border:1px solid #e0e7ef;border-radius:8px}.management-detail summary{padding:10px 12px;cursor:pointer;font-weight:800;color:#344054}.management-detail summary span{float:right;color:#7b8795;font-weight:600}.management-tag-list{display:flex;flex-wrap:wrap;gap:7px;padding:12px;border-top:1px solid #e7edf3}.management-tag-list span{padding:5px 8px;border-radius:999px;background:#f3f6f9;color:#506579;font-size:10.5px}.programme-review{--module-accent:#4f7fb4}.activity-review{--module-accent:#566e99}.lookahead-view{--module-accent:#3f7f76}.changes-view{--module-accent:#8b6b35}.revision-view{--module-accent:#6d628e}.milestone-view{--module-accent:#44759c}.nearcritical-view{--module-accent:#9b6a24}.planning-view .planning-panel.primary{border-top:3px solid var(--module-accent)}.planning-view .planning-panel-head h4{letter-spacing:-.01em}.planning-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.planning-kpi{min-height:94px;padding:14px 15px;border:1px solid #dce5ef;border-radius:11px;background:#fff;box-shadow:0 5px 16px rgba(34,54,77,.035)}.planning-kpi span{display:block;font-size:11.5px;color:#718096;font-weight:800;text-transform:uppercase;letter-spacing:.045em}.planning-kpi strong{display:block;margin-top:7px;font-size:24px;line-height:1.1;color:#22364d;letter-spacing:-.025em}.planning-kpi small{display:block;margin-top:6px;font-size:12px;color:#7b8795}.planning-kpi.danger{border-top:3px solid #b4483e}.planning-kpi.warning{border-top:3px solid #b57922}.planning-kpi.success{border-top:3px solid #2c7a57}.planning-kpi.accent{border-top:3px solid #4f7fb4}
.planning-primary-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.85fr);gap:14px}.comparison-ribbon{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:12px 14px;border:1px solid #dce5ef;border-radius:11px;background:#f8fbff}.comparison-ribbon div{min-width:0}.comparison-ribbon span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:#7b8795}.comparison-ribbon b{display:block;margin-top:3px;font-size:14px;color:#22364d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.comparison-ribbon i{font-style:normal;color:#4f7fb4;font-size:18px}.planning-panel{border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(34,54,77,.035)}.planning-panel.primary{box-shadow:0 9px 26px rgba(34,54,77,.055)}.planning-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px 12px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.planning-panel-head h4{margin:0;font-size:16px;color:#22364d}.planning-panel-head p{margin:4px 0 0;font-size:12.5px;color:#718096}.planning-panel-body{padding:15px 16px}.planning-view .table-wrap{max-height:620px;overflow:auto}.planning-view .table-wrap thead th{position:sticky;top:0;z-index:2;background:#f8fafc}.planning-view .table-wrap tbody tr:hover{background:#f8fbff}.planning-split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.planning-split h5{margin:0 0 10px;font-size:13.5px;color:#506579}
.status-band{height:42px;display:flex;overflow:hidden;border-radius:9px;border:1px solid #dce5ef;background:#f6f8fb}.status-band-segment{min-width:28px;display:flex;flex-direction:column;justify-content:center;padding:0 8px;color:#fff;overflow:hidden}.status-band-segment span{font-size:10.5px;font-weight:800;white-space:nowrap}.status-band-segment b{font-size:13px}.status-band-segment.danger{background:#b4483e}.status-band-segment.warning{background:#b57922}.status-band-segment.success{background:#2c7a57}.status-band-segment.accent{background:#4f7fb4}.status-band-segment.neutral{background:#91a0b0}.status-band-legend{display:flex;flex-wrap:wrap;gap:9px 14px;margin-top:9px}.status-band-legend span{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#667085}.status-band-legend i{width:8px;height:8px;border-radius:2px;background:#91a0b0}.status-band-legend i.danger{background:#b4483e}.status-band-legend i.warning{background:#b57922}.status-band-legend i.success{background:#2c7a57}.status-band-legend i.accent{background:#4f7fb4}.status-band-legend b{color:#344054}
.coverage-line{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f5;font-size:11.5px;color:#667085}.coverage-line b{color:#22364d}.coverage-stack{display:grid;gap:7px;margin-top:12px}.coverage-stack span{display:flex;justify-content:space-between;font-size:11.5px;color:#667085}.coverage-stack b{color:#22364d}
.date-ladder{display:grid;gap:10px}.date-ladder-row{display:grid;grid-template-columns:165px minmax(0,1fr);gap:12px;align-items:center}.date-ladder-label b{display:block;font-size:12.5px;color:#344054}.date-ladder-label span{display:block;font-size:11.5px;color:#7b8795;margin-top:2px}.date-ladder-track{position:relative;height:20px;border-radius:999px;background:#f1f4f8;border:1px solid #e2e8f0}.date-marker{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 0 0 1px rgba(45,55,72,.12)}.date-marker.baseline{background:#68788b}.date-marker.current{background:#4f7fb4}.date-marker.cmeng{background:#5055a8}.date-marker.scenario{background:#7c5ca8}.date-marker.actual{background:#2c7a57}.date-data-line{position:absolute;top:-5px;bottom:-5px;width:1px;background:#1f2937;opacity:.35}.date-ladder-key,.milestone-key{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:10.5px;color:#667085}.date-ladder-key span,.milestone-key span{display:inline-flex;align-items:center;gap:5px}.date-ladder-key i,.milestone-key i{width:9px;height:9px;border-radius:50%;background:#68788b}.date-ladder-key i.current,.milestone-key i.current{background:#4f7fb4}.date-ladder-key i.cmeng{background:#5055a8}.date-ladder-key i.scenario{background:#7c5ca8}.milestone-key i.actual{background:#2c7a57}.milestone-key i.data{width:1px;height:12px;border-radius:0;background:#1f2937}
.management-attention{display:grid;gap:8px}.management-attention-row{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;border-left:3px solid #b57922;background:#fffaf0;border-radius:7px}.management-attention-row.danger{border-left-color:#b4483e;background:#fff6f5}.management-attention-row b{display:block;font-size:12.5px;color:#344054}.management-attention-row span{display:block;margin-top:3px;font-size:11.5px;color:#667085;line-height:1.35}.management-attention-row strong{flex:0 0 auto;font-size:14px;color:#22364d}.attention-clear{padding:13px;border:1px solid #d7eadf;background:#f4fbf7;border-radius:9px;font-size:11.5px;color:#2c6a4c}
.management-health-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.integrity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.integrity-card{padding:12px;border:1px solid #dce5ef;border-radius:9px;background:#fff}.integrity-card span{display:block;font-size:10.5px;color:#667085}.integrity-card b{display:block;margin-top:4px;font-size:18px;color:#22364d}.integrity-card.danger{border-left:3px solid #b4483e}.integrity-card.warning{border-left:3px solid #b57922}.integrity-card.success{border-left:3px solid #2c7a57}
.signed-bars{display:grid;gap:7px}.signed-row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(220px,1.7fr) 86px;gap:10px;align-items:center}.signed-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:#506579}.signed-track{height:14px;position:relative;background:#f3f6f9;border-radius:4px}.signed-zero{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#98a2b3}.signed-bar{position:absolute;top:2px;height:10px;border-radius:3px;background:#91a0b0}.signed-bar.late{background:#b4483e}.signed-bar.early{background:#2c7a57}.signed-row>b{text-align:right;font-size:10.5px;color:#475467}.late-text{color:#b42318!important}.early-text{color:#067647!important}.date-trend-note{font-size:10.5px;color:#7b8795;margin-top:5px}
.lookahead-axis,.lookahead-row{display:grid;grid-template-columns:220px minmax(430px,1fr) 92px;gap:10px;align-items:center}.lookahead-weeks{position:relative;height:20px}.lookahead-weeks span{position:absolute;transform:translateX(-50%);font-size:10.5px;color:#7b8795}.lookahead-timeline{display:grid;gap:6px;max-height:620px;overflow-y:auto;padding-right:4px}.lookahead-label{min-width:0}.lookahead-label b{display:block;font-size:11.5px;color:#344054}.lookahead-label span{display:block;font-size:10.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lookahead-track{position:relative;height:17px;border-radius:4px;background:repeating-linear-gradient(90deg,#f5f7fa 0,#f5f7fa calc(16.666% - 1px),#e4e7ec calc(16.666% - 1px),#e4e7ec 16.666%)}.lookahead-bar{position:absolute;top:3px;height:11px;border-radius:4px;background:#4f7fb4;min-width:3px}.lookahead-bar.ready{background:#2c7a57}.lookahead-bar.conditional{background:#b57922}.lookahead-bar.blocked{background:#b4483e}.lookahead-state{font-size:10.5px;text-transform:uppercase;color:#667085}.lookahead-state.ready{color:#067647}.lookahead-state.conditional{color:#b54708}.lookahead-state.blocked{color:#b42318}
.readiness-cell{display:inline-grid;place-items:center;width:23px;height:23px;border-radius:6px;font-size:11px;font-weight:900}.readiness-cell.ready{background:#ecfdf3;color:#067647}.readiness-cell.blocked{background:#fef3f2;color:#b42318}.readiness-cell.unknown{background:#fffaeb;color:#b54708}.readiness-cell.not_applicable{background:#f2f4f7;color:#667085}
.milestone-timeline{display:grid;gap:8px;max-height:680px;overflow-y:auto;padding-right:4px}.milestone-row{display:grid;grid-template-columns:285px minmax(420px,1fr) 92px;gap:10px;align-items:center;padding:5px 6px;border-radius:8px}.milestone-row.priority-critical{background:#fff7f6}.milestone-row.priority-high{background:#fffbf2}.milestone-label{min-width:0}.milestone-label-line{display:flex;align-items:center;gap:7px;min-width:0}.milestone-label b{font-size:11.5px;color:#344054;white-space:nowrap}.milestone-label>span{display:block;font-size:10.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone-label small{display:block;font-size:9.8px;color:#8793a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone-priority-pill{display:inline-flex!important;align-items:center;width:max-content;padding:2px 6px;border-radius:999px;font-size:8.8px!important;font-weight:850;text-transform:uppercase;letter-spacing:.045em;line-height:1.4}.milestone-priority-pill.critical{background:#fef0ef;color:#b42318}.milestone-priority-pill.high{background:#fff4d8;color:#a15c00}.milestone-priority-pill.watch{background:#edf4fb;color:#3d6897}.milestone-priority-pill.normal{background:#f2f4f7;color:#667085}.milestone-track{position:relative;height:22px;background:#f6f8fb;border:1px solid #e5eaf0;border-radius:5px}.milestone-row.priority-critical .milestone-track{border-color:#efb5b0}.milestone-row.priority-high .milestone-track{border-color:#e6cf9c}.milestone-point{position:absolute;top:50%;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;z-index:2}.milestone-point.baseline{background:#68788b}.milestone-point.current{background:#4f7fb4}.milestone-point.actual{background:#2c7a57}.milestone-shift{position:absolute;top:9px;height:3px;background:#9aa7b5}.milestone-shift.late{background:#b4483e}.milestone-dd{position:absolute;top:-4px;bottom:-4px;width:1px;background:#1f2937;opacity:.35}.milestone-row-meta{text-align:right;min-width:0}.milestone-row-meta b{display:block;font-size:11px}.milestone-row-meta small{display:block;font-size:9.5px;color:#7b8795;margin-top:2px}.milestone-basis-note{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid #dce5ef;border-radius:9px;background:#f8fbff;margin-bottom:12px;font-size:11px;color:#667085}.milestone-basis-note b{color:#344054}.milestone-priority-board{display:grid;gap:8px}.milestone-priority-row{display:grid;grid-template-columns:78px minmax(205px,1.25fr) 105px 112px 92px 90px minmax(235px,1.35fr);gap:10px;align-items:center;padding:10px 11px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}.milestone-priority-row.critical{border-left:4px solid #b4483e;background:#fff8f7}.milestone-priority-row.high{border-left:4px solid #b57922;background:#fffaf2}.milestone-priority-row.watch{border-left:4px solid #4f7fb4}.milestone-priority-main{min-width:0}.milestone-priority-main b{display:block;font-size:11.5px;color:#344054}.milestone-priority-main span{display:block;font-size:10.5px;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.milestone-priority-main small{display:block;font-size:9.5px;color:#98a2b3;margin-top:2px}.milestone-priority-metric span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.045em;color:#98a2b3;font-weight:800}.milestone-priority-metric b{display:block;margin-top:2px;font-size:11px;color:#344054}.milestone-priority-action{font-size:10.5px;color:#475467;line-height:1.35}.milestone-flags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.milestone-flag{display:inline-flex;padding:2px 5px;border-radius:999px;background:#eef3f8;color:#596b7f;font-size:8.7px;font-weight:750;text-transform:uppercase;letter-spacing:.025em}.milestone-flag.danger{background:#fef0ef;color:#b42318}.milestone-flag.warning{background:#fff4d8;color:#a15c00}.milestone-criticality{font-weight:800}.milestone-criticality.critical{color:#b42318}.milestone-criticality.near_critical{color:#b54708}.milestone-criticality.positive_float{color:#2f6b57}.milestone-criticality.unknown{color:#667085}.milestone-chart-shell{border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden}.milestone-chart-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;padding:13px 15px 11px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.milestone-chart-head h5{margin:0;font-size:13px;color:#22364d}.milestone-chart-head p{margin:4px 0 0;font-size:11px;color:#6f7f92}.milestone-chart-legend{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;font-size:10px;color:#667085}.milestone-chart-legend span{display:inline-flex;align-items:center;gap:5px}.milestone-chart-legend i{display:inline-block;width:9px;height:9px}.milestone-chart-legend i.baseline{border:2px solid #68788b;border-radius:50%;background:#fff}.milestone-chart-legend i.current{background:#4f7fb4;transform:rotate(45deg);border-radius:2px}.milestone-chart-legend i.actual{background:#2c7a57;border-radius:2px}.milestone-chart-legend i.data{width:2px;height:12px;background:#344054}.milestone-chart-scroll{overflow-x:auto}.milestone-control-svg{display:block;width:100%;min-width:1080px;height:auto;background:#fff}.milestone-control-svg text{font-family:Inter,"Segoe UI",sans-serif}.milestone-control-svg .axis-label{fill:#7b8795;font-size:10px}.milestone-control-svg .axis-title{fill:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.milestone-control-svg .row-id{fill:#344054;font-size:10.5px;font-weight:800}.milestone-control-svg .row-name{fill:#667085;font-size:9.5px}.milestone-control-svg .row-meta{fill:#7b8795;font-size:8.8px}.milestone-control-svg .priority-text{font-size:8.5px;font-weight:850;text-transform:uppercase}.milestone-control-svg .value-main{fill:#344054;font-size:10.5px;font-weight:800}.milestone-control-svg .value-sub{fill:#7b8795;font-size:9px}.milestone-control-svg .late-value{fill:#b42318}.milestone-control-svg .early-value{fill:#067647}.milestone-control-svg .critical-value{fill:#b42318}.milestone-control-svg .near-value{fill:#b54708}.milestone-control-svg .grid-line{stroke:#e7edf3;stroke-width:1}.milestone-control-svg .row-line{stroke:#eef2f6;stroke-width:1}.milestone-control-svg .data-line{stroke:#344054;stroke-width:1.4;stroke-dasharray:5 4;opacity:.75}.milestone-control-svg .movement-late{stroke:#c35d54;stroke-width:3;stroke-linecap:round}.milestone-control-svg .movement-early{stroke:#4a8a6d;stroke-width:3;stroke-linecap:round}.milestone-control-svg .movement-neutral{stroke:#9aa7b5;stroke-width:2.5;stroke-linecap:round}.milestone-control-svg .baseline-point{fill:#fff;stroke:#68788b;stroke-width:2}.milestone-control-svg .current-point{fill:#4f7fb4;stroke:#fff;stroke-width:1.5}.milestone-control-svg .actual-point{fill:#2c7a57;stroke:#fff;stroke-width:1.5}.milestone-control-svg .critical-ring{fill:none;stroke:#b42318;stroke-width:2}.milestone-control-svg .near-ring{fill:none;stroke:#b57922;stroke-width:2}.milestone-chart-foot{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-top:1px solid #edf1f5;background:#fbfdff;font-size:10px;color:#7b8795}
.float-histogram{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:230px;align-items:end}.float-bin{height:100%;display:grid;grid-template-rows:1fr auto auto;gap:4px;text-align:center}.float-bar-wrap{display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #d0d5dd}.float-bar{width:65%;min-height:2px;background:#b57922;border-radius:5px 5px 0 0}.float-bin b{font-size:11px;color:#344054}.float-bin small{font-size:10.5px;color:#7b8795}
.empty-visual{padding:28px;text-align:center;color:#7b8795;background:#f8fafc;border:1px dashed #dce5ef;border-radius:9px}.reconciliation-panel{margin-top:14px;border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden}.reconciliation-panel>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:13px 15px;cursor:pointer;font-size:12px;font-weight:750;color:#344054;background:#fbfdff}.reconciliation-panel>summary::-webkit-details-marker{display:none}.reconciliation-panel>summary b{font-size:10.5px;color:#7b8795}.reconciliation-body{padding:0 0 2px}.reconciliation-body>.challenge-card{border:0!important;border-radius:0!important;margin:0!important;box-shadow:none!important}
.chart-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#faf9f6}.chart-card-head h4{margin:0;font-size:14px}.chart-card-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.chart-body{padding:14px 16px}.svg-chart{width:100%;min-width:620px;height:auto;display:block}.chart-scroll{overflow-x:auto}.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 10px}.legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#506579}.legend-dot{width:9px;height:9px;border-radius:50%}.domain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px}.domain-card{border:1px solid var(--line);border-radius:11px;background:#fff;padding:14px}.domain-card h5{margin:0 0 10px;font-size:14px}.domain-metric{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #edf1f5;font-size:12px;color:#5a687b}.domain-metric:last-child{border-bottom:0}.domain-metric strong{color:#2e3a46;text-align:right}.position-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.position-card{border:1px solid #dfe7ef;border-radius:10px;background:#fff;padding:13px}.position-card .position-label{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.position-card .position-value{font-size:19px;font-weight:780;margin:5px 0 3px;letter-spacing:-.02em}.position-card .position-sub{font-size:11.5px;color:var(--muted)}.readiness-table td{vertical-align:middle}.state-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.state-pill.ready,.state-pill.included{background:#ecfdf3;color:#067647}.state-pill.blocked,.state-pill.excluded{background:#fef3f2;color:#b42318}.state-pill.conditional,.state-pill.review,.state-pill.unknown{background:#fffaeb;color:#b54708}.state-pill.not_applicable{background:#f2f4f7;color:#667085}.window-strip{display:grid;gap:10px}.window-card{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1fr) minmax(180px,.6fr);gap:13px;border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.window-id{font-size:13px;font-weight:800}.window-dates{font-size:11.5px;color:var(--muted);margin-top:4px}.movement-value{font-size:22px;font-weight:780;letter-spacing:-.03em}.movement-label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:750}.event-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.event-tag{font-size:10.5px;border:1px solid #ded8cf;border-radius:999px;padding:3px 6px;background:#fbfdff;color:#506579}.data-section{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.data-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#fbfdff}.data-section-head h4{margin:0;font-size:14px;letter-spacing:-.01em}.data-section-body{padding:14px 16px}.value-list{display:flex;flex-wrap:wrap;gap:7px}.value-chip{display:inline-flex;padding:6px 9px;border:1px solid #ded8cf;border-radius:8px;background:#fbfdff;font-size:12px;color:#506579}.nested-block{margin-top:12px}.nested-block:first-child{margin-top:0}.nested-title{font-size:12px;font-weight:800;color:#506579;margin:0 0 8px;text-transform:uppercase;letter-spacing:.045em}.cell-details summary{padding:4px 0!important;border:0!important;background:transparent!important}.cell-details pre{max-height:320px}.technical-payload{margin-top:16px}.footer-note{font-size:12px;color:var(--muted);margin-top:22px;padding:0 2px}.muted{color:var(--muted)}
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
.svg-chart{width:100%!important;min-width:760px!important;max-height:360px!important;background:#fff;border-radius:10px}
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
.module-bar-row>div{height:17px!important;border-radius:999px!important;background:#eef3f8!important;overflow:hidden}
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
      <div class="topbar-context project-only"><span>Current view</span><b id="topbarModule">Management Position</b></div>
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
          <h2>Project Controls</h2>
          <p>Current programme, progress, resources, forecast, claims and commercial position based on the latest project records. Choose a project-control view from the left.</p>
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

      <div class="footer-note">CMeng keeps every project document traceable, treats missing information separately from zero, keeps recovery programmes separate from the current programme, and requires approval before changing the adopted project position.</div>
      </div>
    </div>
  </main>
</div>
<script>
const groups={
  "Management Control":["master-dashboard","command-center","master-control-programme"],
  "Programme & Planning":["pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule","schedule-change-report","revision-trend","milestones","near-critical"],
  "Progress & Resources":["resource-utilization","progress-report","variance-trends","progress-scurve","quantity-scurve","progress-breakdown","manhour-scurve"],
  "Forecast & Finish":["forecast-history","independent-forecast"],
  "Claims & Commercial":["delay-claims","notices-claims","windows-analysis","eot-assessment","challenge-contract"],
  "Commercial":["commercial-overview","cost-forecast","variations-change","payments","cash-flow","commercial-claims-notices","contract-particulars-bonds"]
};
const names={
"master-dashboard":"Master Dashboard","command-center":"Command Center","master-control-programme":"Master Control Programme",
"pmo-analysis":"Management Position","schedule-analytics":"Programme Review","activity-analytics":"Activity Review","resource-utilization":"Resources","lookahead-schedule":"Look-Ahead","progress-report":"Progress Position","schedule-change-report":"Programme Changes","revision-trend":"Revision History","variance-trends":"Variance Trend","progress-scurve":"Progress S-Curve","quantity-scurve":"Installed Quantities","progress-breakdown":"WBS Progress","milestones":"Milestones","near-critical":"Near-Critical & Float Risk","manhour-scurve":"Man-Hour S-Curve","forecast-history":"Forecast History","independent-forecast":"Independent Forecast","delay-claims":"Delay Events & Claims","notices-claims":"Notices, EOT & Claims","windows-analysis":"Delay Windows","eot-assessment":"EOT Position","challenge-contract":"Challenge the Contract","commercial-overview":"Commercial Overview","cost-forecast":"Cost & Forecast","variations-change":"Variations & Change","payments":"Payments","cash-flow":"Cash Flow","commercial-claims-notices":"Claims & Notices","contract-particulars-bonds":"Contract Particulars & Bonds"
};
const descriptions={
"master-dashboard":"Executive KPI position with authority, owning module and evidence-safe status.",
"command-center":"Operational control room for current programme position, priorities, evidence gaps and immediate management action.",
"master-control-programme":"Integrated governance view for revision authority, evidence basis, specialist positions and official control status.",
"pmo-analysis":"Finish-date outlook, schedule pressure and decisions requiring management attention.",
"schedule-analytics":"Programme health, logic quality, float and finish dates.",
"activity-analytics":"Activities driving delay, float pressure and logic exceptions.",
"lookahead-schedule":"The next six weeks, readiness blockers and overdue work.",
"schedule-change-report":"What changed between the latest controlled programme submissions.",
"revision-trend":"How progress, forecast finish and schedule pressure have moved over time.",
"milestones":"Critical-path milestones, status, float, due dates, baseline movement and required management action.",
"near-critical":"Strict near-critical activities and the wider float-risk watchlist, kept separate and reconciled to the submitted source position.",
"resource-utilization":"Resource demand, capacity and overload position. Missing capacity is never treated as zero.",
"progress-report":"Baseline, current schedule, physical, contractor-reported and certified progress kept separate.",
"variance-trends":"Activity finish movement and schedule pressure across controlled programme revisions.",
"progress-scurve":"Baseline plan, current forecast and actual progress history on one time axis.",
"quantity-scurve":"Installed quantities by unit, shown only where BOQ-to-programme mapping is defensible.",
"progress-breakdown":"Duration-weighted progress and schedule pressure by WBS.",
"manhour-scurve":"Planned, actual and forecast labor hours, with history coverage stated explicitly.",
"forecast-history":"How submitted and independently calculated finish dates move across controlled revisions.",
"independent-forecast":"Submitted finish compared with CMeng CPM, with reconciliation warnings before management use.",
"delay-claims":"Claim records linked to governed delay events and observed programme movement.",
"notices-claims":"Notice timeliness and claim assessment authority, only where the required evidence exists.",
"windows-analysis":"Revision-to-revision programme movement kept separate from causation and entitlement.",
"eot-assessment":"Observed movement, time impact, contractual entitlement and official EOT award kept separate.",
"challenge-contract":"Contract clause intelligence and delivery assumptions reviewed against the available project evidence.",
"commercial-overview":"Integrated contract value, change, payment, retention, bond, claim and time position by currency.",
"cost-forecast":"Committed and current contract value, approved/pending change and claim exposure without cross-currency arithmetic.",
"variations-change":"Approved and pending variation exposure with governed source state.",
"payments":"Interim certificates, certified value, payments, unpaid certified balance, retention and advance evidence.",
"cash-flow":"Certified, paid and retained cash position. Time-series cash flow appears only when dated transactions are established.",
"commercial-claims-notices":"Commercial claim exposure reconciled with contractual time and EOT position.",
"contract-particulars-bonds":"Contract value, contractual completion, approved EOT and active security position."
}
const roleViews={
  overall:{
    label:"Overall Detailed",
    short:"Overall",
    eyebrow:"Authoritative master review",
    question:"What is the complete governed project-control position, from management signal through technical detail and source evidence?"
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
const fmt=v=>v===null||v===undefined?"—":typeof v==="number"?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v):String(v);
const fmtExecutive=v=>{
  if(v===null||v===undefined)return"—";
  if(typeof v!=="number"||!Number.isFinite(v))return String(v);
  const a=Math.abs(v);
  if(a>=1000000000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v/1000000000)+"B";
  if(a>=1000000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v/1000000)+"M";
  if(a>=1000)return new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(v/1000)+"k";
  if(a>=100)return new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(v);
  if(a>=10)return new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(v);
  return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v);
};
const statusClass=s=>s==="ready"?"ready":s==="partial"?"partial":"blocked";
const statusLabel=s=>s==="ready"?"Ready":s==="partial"?"Review needed":"More information needed";
function moduleGroupForRole(key){
  for(const [group,keys] of Object.entries(groups)){
    if(keys.includes(key))return group;
  }
  return "Project Controls";
}
function rolePrimaryQuestion(key,role){
  const moduleName=names[key]||humanizeKey(key);
  const group=moduleGroupForRole(key);
  const specific={
    milestones:{
      overall:"What is the complete milestone position, including criticality, movement, due status, recovery priority, full register and evidence?",
      planning:"Which milestones are truly critical or near-critical, what is driving their dates and how have they moved across revisions?",
      controls:"Which milestone commitments are deteriorating, overdue or consuming float, and what control action is required?",
      "project-director":"Which milestone commitments can prevent delivery, who owns them and what recovery decision is required now?",
      "program-director":"Which project milestones threaten programme interfaces, downstream packages, handovers or strategic dates?",
      executive:"Which strategic commitments are at risk and does any milestone require executive intervention?"
    },
    "lookahead-schedule":{
      planning:"Which activities enter the next six weeks, what readiness evidence exists and which constraints are technically driving non-readiness?",
      controls:"Which near-term activities are blocked, conditional or overdue, and are owners clearing constraints fast enough?",
      "project-director":"What can stop execution in the next six weeks and which blockers require leadership intervention?",
      "program-director":"Which near-term constraints can disrupt interfaces, shared resources or downstream programme commitments?",
      executive:"Are any near-term blockers capable of moving a strategic commitment?"
    },
    "independent-forecast":{
      planning:"How does the independent CPM result differ from the submitted programme and which activities create the difference?",
      controls:"Is the submitted finish credible, what assumptions remain, and what forecast variance needs control action?",
      "project-director":"What completion date should delivery leadership plan against and what recovery is required?",
      "program-director":"How does the project forecast affect downstream programme dates and contingency?",
      executive:"Is the committed completion date still credible and what is the exposure if it is not?"
    },
    "eot-assessment":{
      planning:"What schedule movement is analytically established and which windows/events support or weaken the time-impact case?",
      controls:"What is observed movement versus attributable time impact, entitlement and officially approved EOT?",
      "project-director":"What time exposure exists, what is defensible and what management action is required on the EOT position?",
      "program-director":"How does the time-entitlement position affect programme commitments, interfaces and commercial strategy?",
      executive:"What is the material time/commercial exposure and is an executive decision required?"
    }
  };
  if(specific[key]?.[role])return specific[key][role];
  const generic={
    overall:"What is the complete governed "+moduleName+" position, including current status, exceptions, trends, consequences, full register and evidence?",
    planning:"What technical detail in "+moduleName+" explains the current position and what source or calculation needs validation?",
    controls:"Where is "+moduleName+" outside the controlled position, how material is the variance and what requires reconciliation?",
    "project-director":"What in "+moduleName+" can threaten delivery, who needs to act and what leadership decision is required?",
    "program-director":"How can "+moduleName+" affect strategic interfaces, downstream packages and the wider programme?",
    executive:"Does "+moduleName+" threaten a strategic commitment, material exposure or require executive intervention?"
  };
  if(group==="Progress & Resources"&&role==="planning")return "What do the time-phased progress/resource records actually establish, where is coverage incomplete and what explains the variance?";
  if(group==="Forecast & Finish"&&role==="controls")return "How credible is the completion outlook, how has it moved and which assumptions or drivers require control action?";
  if(group==="Claims & Commercial"&&role==="project-director")return "What contractual, delay or claim exposure can affect delivery, entitlement or negotiation strategy and what decision is required?";
  return generic[role]||roleViews[role]?.question||generic.overall;
}
function roleFocusItems(key,role){
  const group=moduleGroupForRole(key);
  const byGroup={
    "Programme & Planning":{
      overall:["Current governed position","Critical exceptions and date movement","Cause, consequence and required action"],
      planning:["Logic, dates, float and path","Revision movement and schedule integrity","Driving activities, assumptions and evidence"],
      controls:["Baseline/current variance and trend","Critical/near-critical pressure and coverage","Cross-control consistency and escalation"],
      "project-director":["Delivery threats and recovery","Accountable owner and decision date","Impact on completion and key commitments"],
      "program-director":["Strategic milestones and interfaces","Cascading downstream impact","Programme buffer and cross-project exposure"],
      executive:["Strategic commitment status","Material delivery exposure","Executive intervention / decision"]
    },
    "Progress & Resources":{
      overall:["Progress/resource position and source authority","Variance, productivity and coverage","Full time-phased records and evidence"],
      planning:["Time phasing and assignment basis","Coverage, units and source history","Schedule/resource consistency"],
      controls:["Plan vs actual/certified position","Resource overload/productivity exception","Forecast consequence and recovery"],
      "project-director":["Delivery output versus plan","Resource constraint requiring intervention","Recovery capacity and owner"],
      "program-director":["Shared resource / package pressure","Interface and downstream production impact","Programme-level capacity risk"],
      executive:["Delivery performance","Material capacity or progress exposure","Strategic recovery requirement"]
    },
    "Forecast & Finish":{
      overall:["Submitted and independent finish position","Forecast movement, assumptions and confidence","Activity-level basis and evidence"],
      planning:["CPM logic and calendars","Driving activities and float","Assumptions, unresolved activities and reconciliation"],
      controls:["Forecast credibility and variance","Trend and change since prior updates","Required recovery / governance"],
      "project-director":["Likely delivery date","Main drivers and recovery options","Leadership decision required"],
      "program-director":["Impact on programme milestones","Contingency / interface consumption","Downstream exposure"],
      executive:["Commitment credibility","Schedule exposure","Executive recovery or stakeholder decision"]
    },
    "Claims & Commercial":{
      overall:["Governed contractual/claim position","Time and commercial exposure","Event, notice, entitlement and evidence chain"],
      planning:["Schedule-event linkage","Window movement and time impact","Causation evidence and chronology"],
      controls:["Claim status, notice and authority","Observed vs attributable movement","Exposure, gaps and required response"],
      "project-director":["Delivery / entitlement exposure","Negotiation and response priority","Decision, owner and deadline"],
      "program-director":["Cross-project/contract interface exposure","Programme time and commercial consequence","Strategic claim coordination"],
      executive:["Material time/commercial exposure","Stakeholder / contractual risk","Executive decision or escalation"]
    },
    "Project Controls":{
      overall:["Complete current position","Exceptions and consequences","Full evidence and calculation basis"],
      planning:["Technical basis","Data quality and calculations","Detailed reconciliation"],
      controls:["Variance and trend","Control integrity","Required corrective action"],
      "project-director":["Delivery threat","Accountability","Decision / recovery"],
      "program-director":["Programme interface","Cascading impact","Strategic coordination"],
      executive:["Commitment","Exposure","Executive intervention"]
    }
  };
  const items=byGroup[group]||byGroup["Project Controls"];
  return items[role]||items.overall;
}
function flattenRoleScalars(value,path=[],depth=0,out=[]){
  if(out.length>220||depth>4||value===undefined)return out;
  if(value===null||["string","number","boolean"].includes(typeof value)){
    if(path.length)out.push({path:[...path],key:path.at(-1),value});
    return out;
  }
  if(Array.isArray(value)){
    if(value.length&&value.length<=6&&value.every(v=>v===null||["string","number","boolean"].includes(typeof v))){
      out.push({path:[...path],key:path.at(-1),value:value.join(", ")});
    }
    return out;
  }
  if(typeof value!=="object")return out;
  for(const [key,child] of Object.entries(value)){
    flattenRoleScalars(child,[...path,key],depth+1,out);
    if(out.length>220)break;
  }
  return out;
}
function roleSignalScore(item,role){
  const key=(item.path||[]).join(" ").toLowerCase().replace(/[_-]/g," ");
  const skip=["schema","producer","generated","source revision","project id","revision id","manifest","receipt","fingerprint","hash","method","diagnostic","assumption"];
  if(skip.some(word=>key.includes(word)))return -100;
  const common=["critical","overdue","variance","forecast","finish","completion","progress","delay","claim","float","coverage","due","open","risk","movement","blocked","unmapped","exposure","amount","count","state","status"];
  const roleWords={
    overall:["critical","overdue","variance","forecast","completion","progress","delay","claim","float","coverage","movement","amount"],
    planning:["activity","relationship","logic","float","critical","calendar","duration","finish","start","variance","coverage","milestone","revision","progress"],
    controls:["variance","progress","forecast","critical","near critical","negative float","coverage","overdue","resource","claim","delay","mapping","amount","movement"],
    "project-director":["forecast","critical","overdue","delay","completion","due","variance","risk","negative float","progress","blocked","claim"],
    "program-director":["completion","milestone","forecast","delay","interface","critical","due","handover","opening","program","claim","movement"],
    executive:["completion","forecast","overdue","critical","claim","amount","exposure","progress","delay","milestone","risk","movement"]
  };
  let score=0;
  for(const word of common)if(key.includes(word))score+=1;
  for(const word of (roleWords[role]||roleWords.overall))if(key.includes(word))score+=3;
  if(typeof item.value==="number"&&Number.isFinite(item.value))score+=1;
  if(typeof item.value==="string"&&/\d{4}-\d{2}-\d{2}/.test(item.value))score+=1;
  if(key.includes("count")&&item.value===0)score-=1;
  if(key.includes("coverage"))score+=role==="planning"||role==="controls"?2:0;
  return score;
}
function roleSignalLabel(item){
  const meaningful=(item.path||[]).filter(key=>!["result","data","schedule","progress","forecast"].includes(String(key).toLowerCase()));
  return meaningful.slice(-2).map(humanizeKey).join(" · ")||humanizeKey(item.key||"Value");
}
function roleSignalValue(item){
  const key=(item.path||[]).join(" ").toLowerCase();
  const value=item.value;
  if(typeof value==="string"&&/\d{4}-\d{2}-\d{2}/.test(value)&&/(date|finish|start|completion|submitted|actual|forecast)/.test(key)){
    return planningShortDate(value);
  }
  return fmt(value);
}
function roleSignalTone(item){
  const key=(item.path||[]).join(" ").toLowerCase().replace(/[_-]/g," ");
  const numeric=typeof item.value==="number"?item.value:null;
  const text=String(item.value??"").toLowerCase();
  if((/(critical|overdue|negative float|late|blocked|failed|unmapped|delay)/.test(key)&&numeric!==0)||(text.includes("critical")&&!text.includes("noncritical"))||text.includes("blocked")||text.includes("overdue"))return"danger";
  if((/(near critical|due|variance|risk|partial|review|movement)/.test(key)&&numeric!==0)||text.includes("partial")||text.includes("review"))return"warning";
  if(text.includes("complete")||text.includes("ready")||text.includes("established"))return"success";
  return"";
}
function roleTopSignals(data,role){
  const seen=new Set();
  return flattenRoleScalars(data).map(item=>({...item,score:roleSignalScore(item,role)}))
    .filter(item=>item.score>0&&item.value!==null&&item.value!==undefined&&String(item.value)!=="")
    .sort((a,b)=>b.score-a.score)
    .filter(item=>{const label=roleSignalLabel(item);if(seen.has(label))return false;seen.add(label);return true})
    .slice(0,6);
}
function collectRoleActions(data,role){
  const actions=[];
  const add=(text,kind="Action")=>{const clean=String(text||"").trim();if(clean&&clean!=="—"&&!actions.some(x=>x.text===clean))actions.push({text:clean,kind})};
  const challenge=data?.challenge;
  for(const item of challenge?.items||[]){
    if(item.action)add(item.action,"Control action");
    else if(item.consequence&&(role==="project-director"||role==="program-director"||role==="executive"))add(item.consequence,"Consequence");
  }
  const walk=(value,depth=0)=>{
    if(depth>4||actions.length>=8||!value)return;
    if(Array.isArray(value)){for(const child of value.slice(0,40))walk(child,depth+1);return}
    if(typeof value!=="object")return;
    for(const [key,child] of Object.entries(value)){
      const k=key.toLowerCase();
      if(typeof child==="string"&&(/action|requiredresponse|managementaction|recommendation|consequence|mitigation/.test(k)))add(child,/consequence/.test(k)?"Consequence":/mitigation/.test(k)?"Mitigation":"Action");
      else if(Array.isArray(child)&&(/actions|recommendations/.test(k)))child.slice(0,6).forEach(x=>typeof x==="string"&&add(x,"Action"));
      else if(typeof child==="object")walk(child,depth+1);
      if(actions.length>=8)break;
    }
  };
  walk(data);
  return actions.slice(0,role==="executive"?3:role==="project-director"||role==="program-director"?5:6);
}
function renderRoleViewSelector(){
  const host=el("roleViewSelector");
  if(!host)return;
  host.innerHTML='<span class="role-view-selector-label">Review as</span>'+roleViewOrder.map(key=>'<button class="role-view-button '+(selectedRoleView===key?"active":"")+'" data-role-view="'+key+'" aria-pressed="'+String(selectedRoleView===key)+'">'+escapeHtml(roleViews[key].label)+'</button>').join("");
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
function renderRoleLens(key,data,role){
  const profile=roleViews[role]||roleViews.overall;
  const focus=roleFocusItems(key,role);
  const question=rolePrimaryQuestion(key,role);
  if(role==="overall"){
    const layers=[
      ["Position","Current governed position"],
      ["Exceptions","Variance, gaps and exposure"],
      ["Decision path","Consequence, action and evidence"]
    ];
    return '<section class="role-lens role-lens-compact"><div class="role-lens-head"><div><span class="section-kicker">'+escapeHtml(profile.eyebrow)+'</span><h4>'+escapeHtml(names[key]||humanizeKey(key))+' · Overall Detailed Review</h4><p>'+escapeHtml(question)+'</p></div><span class="role-lens-badge">Complete truth · same governed calculations</span></div><div class="role-lens-compact-strip">'+layers.map(([title,text])=>'<div><b>'+escapeHtml(title)+'</b><span>'+escapeHtml(text)+'</span></div>').join("")+'</div></section>';
  }
  const signals=roleTopSignals(data,role);
  const actions=collectRoleActions(data,role);
  return '<section class="role-lens"><div class="role-lens-head"><div><span class="section-kicker">'+escapeHtml(profile.eyebrow)+'</span><h4>'+escapeHtml(profile.label)+' lens · '+escapeHtml(names[key]||humanizeKey(key))+'</h4><p>'+escapeHtml(question)+'</p></div><span class="role-lens-badge">Same governed project position</span></div><div class="role-lens-body"><div class="role-focus-grid">'+focus.map((text,index)=>'<div class="role-focus-card"><span>Focus '+(index+1)+'</span><b>'+escapeHtml(text)+'</b></div>').join("")+'</div>'+(signals.length?'<div class="role-signal-grid">'+signals.map(item=>'<div class="role-signal '+escapeHtml(roleSignalTone(item))+'" title="'+escapeHtml((item.path||[]).join(" · "))+'"><span>'+escapeHtml(roleSignalLabel(item))+'</span><b>'+escapeHtml(roleSignalValue(item))+'</b></div>').join("")+'</div>':'')+(actions.length?'<div class="role-action-panel"><strong>'+(role==="executive"?"Executive attention":role==="project-director"?"Leadership actions":role==="program-director"?"Programme actions":"Control actions")+'</strong><div class="role-action-list">'+actions.map((item,index)=>'<div class="role-action-row"><i>'+(index+1)+'</i><span><b>'+escapeHtml(item.kind)+':</b> '+escapeHtml(item.text)+'</span></div>').join("")+'</div></div>':'')+'</div></section>';
}
function renderRoleContent(key,data,primaryView,challengeHtml="",includeTechnical=false){
  const role=selectedRoleView;
  const lens=renderRoleLens(key,data,role);
  const className="role-view-"+role;
  const technical=includeTechnical?renderStructuredSections(data):"";
  if(role==="overall"){
    return '<div class="'+className+'">'+lens+'<div class="role-primary-analysis">'+primaryView+'</div>'+challengeHtml+(technical?'<details class="role-supporting-detail"><summary><b>Full calculation & evidence detail</b><span>Open the complete structured module payload</span></summary><div class="role-supporting-detail-body">'+technical+'</div></details>':'')+'</div>';
  }
  if(role==="planning"){
    return '<div class="'+className+'">'+lens+'<div class="role-primary-analysis">'+primaryView+'</div>'+challengeHtml+(technical?'<details class="role-supporting-detail"><summary><b>Technical calculation & source detail</b><span>Fields, coverage and supporting records</span></summary><div class="role-supporting-detail-body">'+technical+'</div></details>':'')+'</div>';
  }
  if(role==="controls"){
    return '<div class="'+className+'">'+lens+'<div class="role-primary-analysis">'+primaryView+'</div>'+challengeHtml+'</div>';
  }
  const supporting=technical||challengeHtml;
  return '<div class="'+className+'">'+lens+'<div class="role-primary-analysis">'+primaryView+'</div>'+(challengeHtml?'<details class="role-supporting-detail"><summary><b>Submitted position reconciliation</b><span>Open detailed comparison</span></summary><div class="role-supporting-detail-body">'+challengeHtml+'</div></details>':'')+(supporting?'<details class="role-supporting-detail"><summary><b>Technical evidence detail</b><span>Open fields, coverage and source trace</span></summary><div class="role-supporting-detail-body">'+technical+'</div></details>':'')+'</div>';
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
  const states=new Map((overview?.moduleStates||[]).map(x=>[x.key,x]));
  let html='<div class="nav-group"><div class="nav-group-title">Project Controls</div>';
  Object.entries(groups).forEach(([group,keys])=>{
    html+='<div class="nav-group-title" style="padding-top:10px">'+group+'</div>';
    keys.forEach(key=>{
      const st=states.get(key)?.status||"blocked";
      html+='<button class="nav-item '+(selected===key?"active":"")+'" data-key="'+key+'" title="'+escapeHtml(names[key])+'"><span class="nav-label">'+names[key]+'</span><span class="status-dot '+statusClass(st)+'"></span></button>';
    });
  });
  html+='</div>';
  nav.innerHTML=html;
  nav.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{selected=b.dataset.key;localStorage.setItem("cmeng-module",selected);renderNav();loadModule(selected)});
}
function scalarPairs(obj){if(!obj||typeof obj!=="object")return[];return Object.entries(obj).filter(([k,v])=>["string","number","boolean"].includes(typeof v)||v===null).slice(0,12)}
function humanizeIsoText(value){
  if(value===null||value===undefined)return"";
  return String(value).replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g,match=>planningShortDate(match));
}
function renderUniversalChallenge(challenge){
  if(!challenge||!Array.isArray(challenge.items))return"";
  const show=v=>v===null||v===undefined?"—":typeof v==="string"?humanizeIsoText(v):fmt(v);
  const withUnit=(v,u)=>show(v)+(u?" "+u:"");
  const conflictPanel=(item)=>{
    const sub=item.submitted||{};
    const comparisons=Array.isArray(item.candidateComparisons)?item.candidateComparisons:[];
    const rec=item.conflictRecommendation||{};
    if(sub.state!=="conflicted"&&comparisons.length<2)return"";
    const assessed=Array.isArray(rec.candidates)?rec.candidates:[];
    const candidateCards=comparisons.map((candidate,index)=>{
      const score=assessed.find(x=>String(x.value)===String(candidate.submittedValue)&&String(x.unit||"")===String(candidate.submittedUnit||""))||assessed[index]||{};
      const sources=(candidate.sourceRefs||score.sourceRefs||[]).join(", ")||"Source records retained";
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
  return '<div class="card challenge-card" style="margin-bottom:14px"><div class="module-head challenge-head"><h3>Submitted position vs CMeng review</h3><span class="badge '+(challenge.challengedCount?"partial":"ready")+'">'+escapeHtml(challenge.challengedCount)+(challenge.challengedCount===1?" item needs attention":" items need attention")+'</span></div>'+
    '<div class="scalar-grid challenge-summary">'+
      '<div class="scalar"><b>Submitted position</b><span>'+escapeHtml(submittedState)+'</span></div>'+
      '<div class="scalar"><b>CMeng review</b><span>'+escapeHtml(independentState)+'</span></div>'+
      '<div class="scalar"><b>Missing comparisons</b><span>'+escapeHtml(challenge.notSubmittedCount)+'</span></div>'+
      '<div class="scalar"><b>Other scenarios</b><span>'+escapeHtml(challenge.scenarioCount)+'</span></div>'+
    '</div>'+attentionHtml+
    '<div class="table-wrap challenge-table-wrap"><table><thead><tr><th>Metric</th><th>Submitted</th><th>CMeng independent check</th><th>Gap</th><th>Consequence</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function renderDeliveryChallenge(data,reason){
  const d=data?.deliveryChallenge;
  if(!d)return false;
  const s=d.scheduleChallenge||{},m=d.manpowerChallenge||{},q=d.quantityChallenge||{},p=d.productivityChallenge||{};
  const contract=data.contractIntelligence||null;
  const independentDeferred=data.independentForecastState==="deferred";
  const submittedManpower=m.submittedAverageManpower!==null&&m.submittedAverageManpower!==undefined;
  const measuredHours=m.evidenceRemainingLaborHours!==null&&m.evidenceRemainingLaborHours!==undefined;
  const mappingCoverage=typeof q.mappingCoveragePercent==="number"?q.mappingCoveragePercent:null;
  const challengeBody=renderUniversalChallenge(data?.challenge);
  const gates=moduleEvidenceGate([
    {label:"Parsed contract clauses",value:contract?"Available":"Not established",state:contract?"ready":"missing"},
    {label:"Contractor manpower plan",value:submittedManpower?"Submitted":"Not submitted",state:submittedManpower?"ready":"missing"},
    {label:"Measured remaining labor hours",value:measuredHours?fmt(m.evidenceRemainingLaborHours)+" h":"Not established",state:measuredHours?"ready":"missing"},
    {label:"BOQ / programme mapping",value:mappingCoverage===null?"Not established":fmt(mappingCoverage)+"%",state:mappingCoverage!==null&&mappingCoverage>0?"ready":"missing"},
    {label:"Independent forecast",value:independentDeferred?"Reviewed in separate view":s.independentCompletionIso?planningShortDate(s.independentCompletionIso):"Not established",state:s.independentCompletionIso?"ready":"missing"}
  ]);
  const scheduleCards=planningKpis([
    ["Submitted finish",planningShortDate(s.contractorSubmittedCompletionIso),"current programme"],
    ["Contract finish",planningShortDate(s.contractualCompletionIso),"governed if established"],
    ["Independent finish",independentDeferred?"Separate review":planningShortDate(s.independentCompletionIso),independentDeferred?"not repeated here":"CMeng calculation",independentDeferred?"warning":""],
    ["Average work fronts",s.averageConcurrentWorkFronts,"programme-derived"],
    ["Peak work fronts",s.peakConcurrentWorkFronts,"programme-derived"]
  ]);
  const manpowerScenarioRows=m.scheduleDerivedScenarios||[];
  const manpowerScenarios=manpowerScenarioRows.map(x=>'<tr><td>'+escapeHtml(x.crewSize)+'</td><td>'+escapeHtml(fmt(x.averageManpower))+'</td><td>'+escapeHtml(fmt(x.peakManpower))+'</td><td><span class="state-pill review">Scenario</span></td></tr>').join("");
  const manpowerScenarioBars=moduleBarList(manpowerScenarioRows.map(x=>({label:fmt(x.crewSize)+" people / work front",value:typeof x.averageManpower==="number"?x.averageManpower:null,tone:"warning"})).filter(x=>x.value!==null),"warning","people");
  const manpower='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Manpower evidence and scenarios</h4><p>Submitted/measured values remain separate from programme-derived scenarios.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Submitted average",submittedManpower?fmt(m.submittedAverageManpower):"Not submitted","people",submittedManpower?"":"warning"],
    ["Submitted peak",m.submittedPeakManpower===null||m.submittedPeakManpower===undefined?"Not submitted":fmt(m.submittedPeakManpower),"people",m.submittedPeakManpower===null||m.submittedPeakManpower===undefined?"warning":""],
    ["Measured remaining hours",measuredHours?fmt(m.evidenceRemainingLaborHours)+" h":"Not established","",measuredHours?"":"warning"],
    ["Required average to contract",m.requiredAverageManpowerToContract===null||m.requiredAverageManpowerToContract===undefined?"Not derivable":fmt(m.requiredAverageManpowerToContract),"scenario unless measured basis supports it",m.requiredAverageManpowerToContract===null||m.requiredAverageManpowerToContract===undefined?"warning":"accent"]
  ])+(manpowerScenarios?'<div class="nested-title" style="margin-top:14px">Programme-based scenario comparison</div>'+manpowerScenarioBars+'<details style="margin-top:10px"><summary>Scenario detail</summary><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Crew / work front</th><th>Average manpower</th><th>Peak manpower</th><th>Authority</th></tr></thead><tbody>'+manpowerScenarios+'</tbody></table></div></details>':'')+'</div></section>';
  const quantityRows=(q.byUnit||[]).map(x=>'<tr><td>'+escapeHtml(x.unit)+'</td><td>'+escapeHtml(fmt(x.contractQuantity))+'</td><td>'+escapeHtml(fmt(x.mappedContractQuantity))+'</td><td>'+escapeHtml(fmt(x.installedQuantity))+'</td><td>'+escapeHtml(fmt(x.remainingQuantity))+'</td><td>'+escapeHtml(fmt(x.requiredPerDayToContract))+'</td><td>'+escapeHtml(x.mappingCoveragePercent===null?"—":fmt(x.mappingCoveragePercent)+"%")+'</td></tr>').join("");
  const quantity='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Quantity and productivity basis</h4><p>Productivity conclusions depend on governed mapping and measured installed quantities.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Mapping coverage",mappingCoverage===null?"Not established":fmt(mappingCoverage)+"%","BOQ to programme",mappingCoverage===null?"warning":""],
    ["Ambiguous BOQ items",q.ambiguousMappingItemCount,"items",q.ambiguousMappingItemCount?"warning":""],
    ["Unmapped BOQ items",q.unmappedItemCount,"items",q.unmappedItemCount?"warning":""],
    ["Productivity evidence",p.productivityEvidenceState?humanizeKey(p.productivityEvidenceState):"Not established",""]
  ])+(quantityRows?'<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Unit</th><th>Contract qty</th><th>Mapped qty</th><th>Installed</th><th>Remaining</th><th>Required/day</th><th>Map coverage</th></tr></thead><tbody>'+quantityRows+'</tbody></table></div>':'')+'</div></section>';
  const findings=(d.findings||[]).map(x=>'<tr><td>'+escapeHtml(x.topic)+'</td><td>'+escapeHtml(humanizeKey(x.state))+'</td><td>'+escapeHtml(humanizeIsoText(x.contractorAssumption||"—"))+'</td><td>'+escapeHtml(humanizeIsoText(x.independentCalculation||"—"))+'</td><td>'+escapeHtml(humanizeIsoText(x.difference||"—"))+'</td><td>'+escapeHtml(humanizeIsoText(x.milestoneConsequence||"—"))+'</td><td>'+escapeHtml(humanizeIsoText(x.requiredResponse||"—"))+'</td></tr>').join("");
  const contractCategoryCounts=contract?(contract.signals||[]).reduce((map,signal)=>{const label=humanizeKey(signal.category||"other");map.set(label,(map.get(label)||0)+1);return map},new Map()):new Map();
  const contractCategoryItems=[...contractCategoryCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value,tone:"accent"}));
  const contractCategoryBars=renderVisualBars(contractCategoryItems);
  const readyGateCount=[contract,submittedManpower,measuredHours,mappingCoverage!==null&&mappingCoverage>0,s.independentCompletionIso].filter(Boolean).length;
  const challengeVisuals='<div class="visual-chart-grid">'+
    renderVisualPanel("Evidence readiness","What is established before CMeng challenges the submitted delivery position.",renderDonutChart([
      {label:"Established",value:readyGateCount,tone:"success"},
      {label:"Missing / review",value:5-readyGateCount,tone:"warning"}
    ],"Evidence gates"))+
    renderVisualPanel("Contract review signals","Source-grounded contract topics requiring management review.",contractCategoryCounts.size?renderDonutChart(contractCategoryItems,"Signals"):'<div class="empty-visual">Contract review signals are not established.</div>')+
  '</div>';
  const contractSummary=contract?'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Contract review</h4><p>Clause intelligence is source-grounded; extracted candidates do not become official terms automatically.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Contract review signals",contract.signalCount??contract.signals?.length??0,"items"],
    ["Notice candidates",contract.noticeRequirementCandidates?.length??0,"candidate clauses"],
    ["Categories",(contract.categoriesPresent||[]).length,"identified"]
  ])+(contractCategoryCounts.size?'<div class="nested-title" style="margin-top:14px">Signals by contract topic</div>'+contractCategoryBars:'')+'</div></section>':'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Contract review</h4></div></div><div class="planning-panel-body"><div class="notice warn">A parsed contract is required before CMeng can challenge clauses, notice obligations or contractual time provisions.</div></div></section>';
  const reconciliation=challengeBody?'<details class="reconciliation-panel"><summary><span>Reconciliation with submitted position</span><b>'+escapeHtml(data.challenge?.challengedCount||0)+' needs attention</b></summary><div class="reconciliation-body">'+challengeBody+'</div></details>':'';
  let html='<section class="planning-view contract-challenge-view">'+(reason?'<div class="notice info">'+escapeHtml(reason)+'</div>':'')+challengeVisuals+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Evidence readiness</h4><p>CMeng does not present a scenario as an official project fact.</p></div><span class="badge '+(d.position==="challenged"||d.position==="material_delivery_gap"?"partial":"")+'">'+escapeHtml(humanizeKey(d.position))+'</span></div><div class="planning-panel-body">'+gates+'</div></section>'+scheduleCards+'<div class="planning-primary-grid">'+contractSummary+manpower+'</div>'+quantity;
  if(findings)html+='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Delivery challenge findings</h4><p>Management issues, consequence and required response.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Topic</th><th>State</th><th>Contractor position</th><th>CMeng analysis</th><th>Gap</th><th>Consequence</th><th>Required response</th></tr></thead><tbody>'+findings+'</tbody></table></div></div></section>';
  if(data.contractValueEvidence){
    const cv=data.contractValueEvidence,governed=cv.governed,candidate=cv.extraction?.value;
    html+='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Contract value</h4><p>Governed value is separate from extracted candidates.</p></div></div><div class="planning-panel-body">'+planningKpis([
      ["State",humanizeKey(cv.state||"missing"),""],
      ["Governed value",governed?fmt(governed.amount)+" "+(governed.currency||""):"Not established",""],
      ["Extracted candidate",candidate?fmt(candidate.amount)+" "+(candidate.currency||""):"—","candidate only"]
    ])+'</div></section>';
  }
  html+=reconciliation+'</section>';
  const basisHtml=renderModuleBasis(data);
  el("moduleContent").innerHTML=basisHtml+renderRoleContent("challenge-contract",data,html,"",true);
  return true;
}
function humanizeKey(key){
  return String(key)
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
    ocr_pending:"CMeng sampled/identified the file, but full OCR has not been completed. This does not mean it is still running in the background.",
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
  let cursor=0;
  const stops=[];
  known.forEach(item=>{
    const from=(cursor/total)*100;
    cursor+=item.value;
    const to=(cursor/total)*100;
    const color=chartToneColor(item.tone||"neutral");
    stops.push(color+" "+from.toFixed(3)+"% "+to.toFixed(3)+"%");
  });
  const legend=known.map(item=>'<div class="donut-legend-row"><i style="background:'+chartToneColor(item.tone||"neutral")+'"></i><span>'+escapeHtml(item.label)+'</span><b>'+escapeHtml(fmt(item.value))+'</b></div>').join("");
  return '<div class="donut-layout"><div class="donut-ring" style="background:conic-gradient('+stops.join(",")+')"><div class="donut-center"><b>'+escapeHtml(fmt(total))+'</b><span>'+escapeHtml(centerLabel)+'</span></div></div><div class="donut-legend">'+legend+'</div></div>';
}
function renderVisualBars(items,unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)&&item.value>=0);
  if(!rows.length)return '<div class="empty-visual">No comparable values are established for this chart.</div>';
  const max=Math.max(1,...rows.map(item=>item.value));
  return '<div class="visual-bars">'+rows.map(item=>{
    const width=Math.max(item.value===0?0:1,(item.value/max)*100);
    const tone=item.tone||"accent";
    return '<div class="visual-bar-row"><div class="visual-bar-label" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div><div class="visual-bar-track"><div class="visual-bar-fill '+escapeHtml(tone)+'" style="width:'+width.toFixed(2)+'%"></div></div><div class="visual-bar-value">'+escapeHtml(fmt(item.value)+(unit?" "+unit:""))+'</div></div>';
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
  const cell=(label,metric,tone)=>{
    const value=metricValue(metric);
    const state=metric?.state?humanizeKey(metric.state):value===null?"Missing":"Established";
    return '<div class="value-bridge-cell '+escapeHtml(tone)+'"><span>'+escapeHtml(label)+'</span><b>'+escapeHtml(value===null?"Not established":fmt(value)+(unit?" "+unit:""))+'</b><small>'+escapeHtml(state)+'</small></div>';
  };
  return '<div class="value-bridge">'+
    cell("Committed contract",base,"base")+
    '<div class="value-bridge-op">+</div>'+
    cell("Approved changes",approved,"change")+
    '<div class="value-bridge-op">=</div>'+
    cell("Current contract",current,"current")+
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
function renderLineChart(points,series,yMaxHint=null){
  if(!Array.isArray(points)||!points.length)return '<div class="empty-visual">No series points available.</div>';
  const numeric=[];
  points.forEach(point=>series.forEach(item=>{const value=point?.[item.key];if(typeof value==="number"&&Number.isFinite(value))numeric.push(value)}));
  if(!numeric.length)return '<div class="empty-visual">No numeric series points available.</div>';
  const width=1080,height=330,left=66,right=28,top=24,bottom=54;
  const plotW=width-left-right,plotH=height-top-bottom;
  const observedMin=Math.min(...numeric),observedMax=Math.max(...numeric);
  const rawMin=Math.min(observedMin,0),rawMax=Math.max(observedMax,1);
  const signed=observedMin<0;
  const range=Math.max(1,observedMax-observedMin);
  const minY=yMaxHint!==null?0:signed?Math.min(0,observedMin-range*.08):0;
  const maxY=yMaxHint!==null?yMaxHint:Math.max(1,observedMax+range*.1);
  const span=Math.max(.0001,maxY-minY);
  const x=index=>left+(points.length===1?plotW/2:(index/(points.length-1))*plotW);
  const y=value=>top+plotH-((Math.max(minY,Math.min(maxY,value))-minY)/span)*plotH;
  const segments=key=>{
    const result=[];let current=[];
    points.forEach((point,index)=>{
      const value=point?.[key];
      if(typeof value==="number"&&Number.isFinite(value))current.push({x:x(index),y:y(value),value,index});
      else if(current.length){result.push(current);current=[]}
    });
    if(current.length)result.push(current);
    return result;
  };
  const grid=[0,.25,.5,.75,1].map(ratio=>{
    const value=minY+(span*ratio),yy=y(value);
    return '<line x1="'+left+'" y1="'+yy.toFixed(1)+'" x2="'+(width-right)+'" y2="'+yy.toFixed(1)+'" stroke="#e6edf4" stroke-width="1"/><text x="'+(left-10)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="#738399">'+escapeHtml(fmtExecutive(value))+'</text>';
  }).join("");
  const zero=minY<0&&maxY>0?'<line x1="'+left+'" y1="'+y(0).toFixed(1)+'" x2="'+(width-right)+'" y2="'+y(0).toFixed(1)+'" stroke="#98a2b3" stroke-width="1.2" stroke-dasharray="4 4"/>':'';
  const plots=series.map((item,seriesIndex)=>{
    const color=item.color||chartToneColor(item.tone||"accent");
    const segs=segments(item.key);
    return segs.map(seg=>{
      const poly='<polyline points="'+seg.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+'" fill="none" stroke="'+color+'" stroke-width="'+(seriesIndex===0?3:2.4)+'" stroke-linecap="round" stroke-linejoin="round"/>';
      const area=seriesIndex===0&&minY>=0&&seg.length>1
        ? '<polygon points="'+seg[0].x.toFixed(1)+","+y(minY).toFixed(1)+" "+seg.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+" "+seg.at(-1).x.toFixed(1)+","+y(minY).toFixed(1)+'" fill="'+color+'" fill-opacity=".07"/>'
        : '';
      const dots=seg.length<=36?seg.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="#fff" stroke="'+color+'" stroke-width="2"><title>'+escapeHtml(item.label+": "+fmtExecutive(p.value))+'</title></circle>').join(""):'';
      return area+poly+dots;
    }).join("");
  }).join("");
  const labelIndexes=[0,Math.floor((points.length-1)/4),Math.floor((points.length-1)/2),Math.floor(((points.length-1)*3)/4),points.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndexes.map(index=>'<text x="'+x(index).toFixed(1)+'" y="'+(height-18)+'" text-anchor="'+(index===0?"start":index===points.length-1?"end":"middle")+'" font-size="10" fill="#738399">'+escapeHtml(planningShortDate(points[index]?.dateIso)||points[index]?.dateIso||String(index+1))+'</text>').join("");
  const legend='<div class="chart-legend">'+series.map(item=>{
    const values=points.map(point=>point?.[item.key]).filter(value=>typeof value==="number"&&Number.isFinite(value));
    const latest=values.length?values.at(-1):null;
    return '<span class="legend-item"><span class="legend-dot" style="background:'+(item.color||chartToneColor(item.tone||"accent"))+'"></span>'+escapeHtml(item.label)+(latest===null?'':' · '+escapeHtml(fmt(latest)))+'</span>';
  }).join("")+'</div>';
  return legend+'<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Trend chart">'+grid+zero+plots+labels+'</svg></div>';
}
function renderProgressScurveVisual(data){
  const p=projectionFor(data,"progress_scurve");
  if(!Array.isArray(p.points))return"";
  const snapshotLabel=p.actualHistoryMode==="snapshot_history"?"Schedule snapshot progress":p.actualHistoryMode==="current_snapshot_only"?"Current schedule snapshot":"Progress snapshot";
  const note=p.actualHistoryMode==="snapshot_history"
    ? '<div class="notice info"><b>The orange series is schedule-revision progress history.</b> It is not contractor-certified or independently measured physical progress unless separate source evidence establishes that authority.</div>'
    : p.actualHistoryMode==="current_snapshot_only"
      ? '<div class="notice warn">Only one schedule progress snapshot is available. CMeng does not fabricate an earlier actual history from that single point.</div>'
      : '<div class="notice warn">No historical progress snapshots are established. Baseline and current planned curves can still be compared.</div>';
  const latest=[...p.points].filter(point=>point.dateIso&&p.dataDateIso&&Date.parse(point.dateIso)<=Date.parse(p.dataDateIso)).at(-1)||null;
  const kpis=planningKpis([
    ["Baseline planned",latest?.baselinePlannedPercent===null||latest?.baselinePlannedPercent===undefined?"—":fmt(latest.baselinePlannedPercent)+"%","at data date"],
    ["Current forecast",latest?.currentForecastPercent===null||latest?.currentForecastPercent===undefined?"—":fmt(latest.currentForecastPercent)+"%","at data date"],
    ["Schedule snapshot",latest?.actualProgressPercent===null||latest?.actualProgressPercent===undefined?"—":fmt(latest.actualProgressPercent)+"%","not certified physical"],
    ["Baseline coverage",p.baselineCoveragePercent===null?"—":fmt(p.baselineCoveragePercent)+"%","eligible baseline activities"],
    ["Current coverage",p.currentCoveragePercent===null?"—":fmt(p.currentCoveragePercent)+"%","eligible current activities"],
    ["Snapshot coverage",p.actualSnapshotCoveragePercent===null?"—":fmt(p.actualSnapshotCoveragePercent)+"%","schedule progress fields"]
  ]);
  return '<section class="planning-view progress-scurve-view">'+kpis+note+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Progress S-Curve</h4><p>Controlled baseline plan, current forecast and schedule-revision progress snapshots on the same time axis.</p></div><span class="badge '+(p.actualHistoryMode==="snapshot_history"?"ready":"partial")+'">'+escapeHtml(humanizeKey(p.actualHistoryMode||"missing"))+'</span></div><div class="planning-panel-body">'+
    renderLineChart(p.points,[
      {key:"baselinePlannedPercent",label:"Controlled baseline planned",color:"#506579"},
      {key:"currentForecastPercent",label:"Current forecast",color:"#4f7fb4"},
      {key:"actualProgressPercent",label:snapshotLabel,color:"#d97706"}
    ],100)+
  '</div></section></section>';
}
function renderQuantityScurveVisual(data){
  const p=projectionFor(data,"quantity_scurve");
  if(!Array.isArray(p.series))return"";
  const mappingLabel=p.mappingBasis==="governed"?"Governed mapping":p.mappingBasis==="candidate_scenario"?"Candidate links only":"Mapping not established";
  const mappedSeries=p.series.filter(series=>(series.points||[]).length>0);
  const top=planningKpis([
    ["BOQ items",p.inferredMapping?.itemCount??p.unmappedItemIds?.length??"—","quantity basis"],
    ["Mapping basis",mappingLabel,""],
    ["Unit series",p.series.length,"units kept separate"],
    ["Unmapped items",(p.unmappedItemIds||[]).length,"items",p.unmappedItemIds?.length?"warning":""],
    ["Partially mapped",(p.partiallyAllocatedItemIds||[]).length,"items",p.partiallyAllocatedItemIds?.length?"warning":""],
    ["Over-allocated",(p.overAllocatedItemIds||[]).length,"items",p.overAllocatedItemIds?.length?"danger":""]
  ]);
  if(mappedSeries.length===0){
    const candidates=p.inferredMapping?.selectedScenarioLinks?.length||0;
    return '<section class="planning-view quantity-view">'+top+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Installed Quantities</h4><p>A quantity S-curve is not drawn until BOQ quantities are linked to programme activities on a governed basis.</p></div></div><div class="planning-panel-body"><div class="notice warn"><b>No governed quantity curve is available.</b> '+escapeHtml(candidates?candidates+" candidate link(s) were found, but they remain scenarios and are not used as project facts.":"No defensible BOQ-to-activity crosswalk is established.")+'</div>'+moduleEvidenceGate([
      {label:"BOQ quantity basis",value:p.boqRevisionId?"Loaded":"Not established",state:p.boqRevisionId?"ready":"missing"},
      {label:"Governed BOQ/activity mapping",value:p.mappingBasis==="governed"?"Established":"Not established",state:p.mappingBasis==="governed"?"ready":"missing"},
      {label:"Installed quantity history",value:"Cannot be time-phased until mapping is governed",state:"missing"}
    ])+'</div></section></section>';
  }
  const charts=mappedSeries.map(series=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(series.unit||series.unitKey||"Unit")+' quantity curve</h4><p>'+escapeHtml(fmt(series.itemCount))+' BOQ item(s) in this unit · mapping coverage '+escapeHtml(series.mappingCoveragePercent===null?"—":fmt(series.mappingCoveragePercent)+"%")+'</p></div><span class="badge '+(series.authority==="governed_mapping"?"ready":"partial")+'">'+escapeHtml(series.authority==="governed_mapping"?"Governed":"Scenario")+'</span></div><div class="planning-panel-body">'+renderLineChart(series.points||[],[
    {key:"baselinePlannedQuantity",label:"Baseline planned",color:"#506579"},
    {key:"currentForecastQuantity",label:"Current forecast",color:"#4f7fb4"},
    {key:"actualInstalledQuantity",label:"Actual installed",color:"#2c7a57"}
  ])+'</div></section>').join("");
  return '<section class="planning-view quantity-view">'+top+charts+'</section>';
}
function renderLookAheadVisual(data){
  const p=projectionFor(data,"lookahead_schedule");
  if(!Array.isArray(p.rows))return"";
  const inWindow=p.rows.length;
  const kpis=planningKpis([
    ["Look-ahead",p.windowDays+" days",planningShortDate(p.dataDateIso)+" → "+planningShortDate(p.windowEndIso)],
    ["Activities",inWindow,"in look-ahead"],
    ["Overdue",p.overdueCount,"activities","danger"],
    ["Ready to proceed",p.readyCount,"all known requirements ready","success"],
    ["Evidence gaps",p.conditionalCount,"no known blocker, information incomplete","warning"],
    ["Known blocker",p.blockedCount,"at least one explicit blocker","danger"]
  ]);
  const timeline=planningLookAheadTimeline(p);
  const dimensions=["predecessor","procurement_material","design_submittal","permit","resource","quality","commercial","risk","access"];
  const labels={predecessor:"Predecessors",procurement_material:"Materials",design_submittal:"Design",permit:"Permit",resource:"Resources",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const watch=[...p.rows].sort((a,b)=>{
    const ar=a.readiness?.state==="blocked"?0:a.classification==="overdue"?1:a.readiness?.state==="conditional"?2:3;
    const br=b.readiness?.state==="blocked"?0:b.classification==="overdue"?1:b.readiness?.state==="conditional"?2:3;
    return ar-br||String(a.startIso||"").localeCompare(String(b.startIso||""));
  }).slice(0,80);
  const rows=watch.map(row=>{
    const map=new Map((row.readiness?.dimensions||[]).map(d=>[d.key,d]));
    const overall=row.readiness?.state==="blocked"?"Known blocker":row.readiness?.state==="conditional"?"Evidence gaps":"Ready";
    return '<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(planningShortDate(row.startIso))+'</td><td>'+escapeHtml(planningShortDate(row.finishIso))+'</td><td><span class="state-pill '+escapeHtml(row.readiness?.state||"unknown")+'">'+escapeHtml(overall)+'</span></td>'+dimensions.map(key=>{const dim=map.get(key);const state=dim?.state||"unknown";return '<td><span class="readiness-cell '+escapeHtml(state)+'" title="'+escapeHtml(dim?.note||planningStateLabel(state))+'">'+escapeHtml(state==="ready"?"✓":state==="blocked"?"!":state==="not_applicable"?"—":"?")+'</span></td>'}).join("")+'</tr>';
  }).join("");
  const readiness=planningStatusBand([["Ready",p.readyCount,"success"],["Evidence gaps",p.conditionalCount,"warning"],["Known blocker",p.blockedCount,"danger"]]);
  const blockers=planningLookAheadBlockers(p.rows);
  return '<section class="planning-view lookahead-view">'+kpis+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>6-week execution view</h4><p>Showing the 36 highest-priority activities from '+escapeHtml(fmt(inWindow))+' activities. The label at right states the actual blocker or whether evidence is still missing.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness position</h4><p>A known blocker is different from missing readiness evidence.</p></div></div><div class="planning-panel-body">'+readiness+'<div class="coverage-line"><span>Date coverage</span><b>'+escapeHtml(p.currentDateCoveragePercent===null?"—":fmt(p.currentDateCoveragePercent)+"%")+'</b></div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Why work is blocked</h4><p>Counts by explicit blocker. An incomplete predecessor is a sequencing blocker.</p></div></div><div class="planning-panel-body">'+blockers+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness matrix</h4><p>Showing the 80 highest-attention activities. ✓ ready · ! explicit blocker · ? evidence missing · — not applicable.</p></div></div><div class="planning-panel-body"><div class="table-wrap readiness-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Overall</th>'+dimensions.map(key=>'<th>'+escapeHtml(labels[key])+'</th>').join("")+'</tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderForecastVisual(data){
  const p=projectionFor(data,"independent_forecast");
  if(!("independentForecastCompletionIso" in p))return"";
  const prob=p.probabilistic||{};
  const review=p.managementReviewState==="review_required"||!p.complete;
  const variance=p.forecastVarianceDays;
  const kpis=planningKpis([
    ["Contractor Programme Forecast",planningShortDate(p.sourceForecastCompletionIso),"submitted programme"],
    ["Source Productivity Forecast",planningShortDate(p.sourceProductivityForecastCompletionIso),humanizeKey(p.sourceProductivityForecastState||"missing"),p.sourceProductivityForecastState==="conflicted"?"danger":p.sourceProductivityForecastState==="candidate"?"warning":""],
    ["CMeng Independent CPM Forecast",planningShortDate(p.independentForecastCompletionIso),review?"requires reconciliation":"deterministic CMeng calculation",review?"warning":"accent"],
    ["CMeng vs Contractor",variance===null?"—":(variance>0?"+":"")+fmt(variance)+" days","independent CPM minus contractor programme",variance!==null&&Math.abs(variance)>180?"danger":""],
    ["Activity coverage",p.activityCoveragePercent===null?"—":fmt(p.activityCoveragePercent)+"%","CMeng CPM"],
    ["Required finish",planningShortDate(p.requiredFinishIso),"contract/target if established"]
  ]);
  const warning=review?'<div class="notice warn"><b>Independent forecast requires reconciliation before management use.</b><br>'+escapeHtml(p.managementReviewReason||"The deterministic CPM basis contains unresolved evidence.")+'</div>':'';
  const forecastDistance=[
    {label:"Contractor Programme Forecast",value:planningDaysBetween(p.dataDateIso,p.sourceForecastCompletionIso),tone:"graphite"},
    {label:"Source Productivity Forecast",value:planningDaysBetween(p.dataDateIso,p.sourceProductivityForecastCompletionIso),tone:"warning"},
    {label:"CMeng Independent CPM Forecast",value:planningDaysBetween(p.dataDateIso,p.independentForecastCompletionIso),tone:"accent"},
    {label:"P50 probabilistic forecast",value:planningDaysBetween(p.dataDateIso,prob.p50CompletionIso),tone:"teal"},
    {label:"P80 probabilistic forecast",value:planningDaysBetween(p.dataDateIso,prob.p80CompletionIso),tone:"purple"},
    {label:"P90 probabilistic forecast",value:planningDaysBetween(p.dataDateIso,prob.p90CompletionIso),tone:"danger"}
  ].filter(item=>typeof item.value==="number"&&Number.isFinite(item.value)&&item.value>=0);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Forecast distance from Data Date","All forecast positions translated to a common time distance without merging their authority.",renderVisualBars(forecastDistance,"d"))+
    renderVisualPanel("Forecast variance bridge","Deterministic, source-productivity and probabilistic differences remain distinct.",renderWaterfallChart([
      {label:"CMeng vs Contractor",value:typeof variance==="number"?variance:0},
      {label:"Source productivity vs Contractor",value:(p.sourceProductivityForecastCompletionIso&&p.sourceForecastCompletionIso)?planningDaysBetween(p.sourceForecastCompletionIso,p.sourceProductivityForecastCompletionIso):0},
      {label:"P80 vs CMeng CPM",value:(prob.p80CompletionIso&&p.independentForecastCompletionIso)?planningDaysBetween(p.independentForecastCompletionIso,prob.p80CompletionIso):0}
    ],"d"))+
  '</div>';
  const dateLadder=planningDateLadder([
    {label:"Contractor Programme Forecast",date:p.sourceForecastCompletionIso,tone:"current"},
    {label:"Source Productivity Forecast",date:p.sourceProductivityForecastCompletionIso,tone:"scenario"},
    {label:"CMeng Independent CPM Forecast",date:p.independentForecastCompletionIso,tone:"cmeng"},
    {label:"Required finish",date:p.requiredFinishIso,tone:"baseline"}
  ],p.dataDateIso);
  const probPanel='<div class="position-grid">'+[
      ["P50 probabilistic forecast",review?"Suppressed":planningShortDate(prob.p50CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"],
      ["P80 probabilistic forecast",review?"Suppressed":planningShortDate(prob.p80CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"],
      ["P90 probabilistic forecast",review?"Suppressed":planningShortDate(prob.p90CompletionIso),review?"Deterministic basis requires reconciliation":"CMeng non-official comparator"]
    ].map(c=>'<div class="position-card '+(review?"review":"")+'"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1])+'</div><div class="position-sub">'+escapeHtml(c[2])+'</div></div>').join("")+'</div>'+
    (review?'<div class="notice info" style="margin-top:12px">P50/P80/P90 values are intentionally suppressed while the deterministic independent finish is under reconciliation. The forecast taxonomy remains visible without publishing unsupported dates.</div>':'');
  return '<section class="planning-view independent-forecast-view">'+kpis+warning+visualOverview+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Four distinct forecast positions</h4><p>Contractor programme, source productivity, CMeng deterministic CPM and CMeng probabilistic forecasts remain separate. No position silently replaces another.</p></div><span class="badge '+(review?"partial":"ready")+'">'+escapeHtml(review?"Reconciliation required":"Calculated")+'</span></div><div class="planning-panel-body">'+dateLadder+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Probabilistic comparators</h4><p>Non-official comparators are only useful after the deterministic basis is credible.</p></div></div><div class="planning-panel-body">'+probPanel+'</div></section></section>';
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
    return '<div class="window-card clean"><div><div class="window-id">Window '+escapeHtml(w.sequence)+' · '+escapeHtml(from)+' → '+escapeHtml(to)+'</div><div class="window-dates">'+escapeHtml(planningShortDate(w.windowStartIso))+' → '+escapeHtml(planningShortDate(w.windowEndIso))+'</div></div><div><div class="movement-label">Submitted forecast movement</div><div class="movement-value">'+escapeHtml(sourceMove===null?"—":(sourceMove>0?"+":"")+fmt(sourceMove)+" days")+'</div><div class="muted">Progress movement '+escapeHtml(w.progressMovementPercent===null?"—":(w.progressMovementPercent>0?"+":"")+fmt(w.progressMovementPercent)+" pp")+'</div></div><div><div class="movement-label">Independent CPM movement</div><div class="movement-value small">'+escapeHtml(independent===null?"Not calculated in this view":(independent>0?"+":"")+fmt(independent)+" days")+'</div><div class="muted">'+escapeHtml((w.delayEvents||[]).length+" linked event(s)")+'</div></div></div>';
  }).join("");
  const note='<div class="notice info"><b>Window movement and Project Completion movement are different measures.</b> Gross positive window movement sums only positive revision-to-revision shifts. Project Completion movement is the net first-to-latest submitted completion shift. Neither is automatically delay entitlement or EOT.</div>'+(p.windows.some(w=>w.independentForecastMovementDays===null)?'<div class="notice info">Independent CPM is not silently substituted where it has not been calculated.</div>':'');
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Window movement waterfall","Every revision-to-revision submitted finish movement is signed. Right is later; left is earlier.",renderWaterfallChart(bars,"d"))+
    renderVisualPanel("Window completeness","Complete and partial analytical windows remain visibly separate.",renderDonutChart([
      {label:"Complete",value:p.completeWindowCount||0,tone:"success"},
      {label:"Partial",value:p.partialWindowCount||0,tone:"warning"},
      {label:"Other",value:Math.max(0,(p.windowCount||0)-(p.completeWindowCount||0)-(p.partialWindowCount||0)),tone:"neutral"}
    ],"Windows"))+
  '</div>';
  return '<section class="planning-view windows-view">'+planningKpis([
    ["Windows",p.windowCount,"revision intervals"],
    ["Complete windows",p.completeWindowCount,""],
    ["Partial windows",p.partialWindowCount,"",p.partialWindowCount?"warning":""],
    ["Gross positive window movement",fmt(p.positiveProgrammeMovementDays)+" d","sum of positive windows; not project delay or EOT",p.positiveProgrammeMovementDays>0?"warning":""],
    ["Project Completion movement",p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"—":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","first controlled → latest controlled · "+humanizeKey(p.projectCompletionMovementBasis||"unavailable"),p.projectCompletionMovementDays>0?"danger":""],
    ["Linked delay events",p.windows.reduce((sum,w)=>sum+(w.delayEvents||[]).length,0),"window references"]
  ])+note+visualOverview+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme movement by window</h4><p>Source forecast movement is shown first. It is schedule movement, not automatic delay entitlement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(bars,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window detail</h4></div></div><div class="planning-panel-body"><div class="window-strip">'+cards+'</div></div></section></section>';
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
  const events=Array.isArray(p.events)?p.events:[];
  const linked=p.linkedClaimCount??p.claimLinkedEventCount??0,unlinked=p.unlinkedClaimCount??Math.max(0,(p.claimCount||0)-linked);
  const activityGapCount=p.activityEvidenceInsufficientEventCount??events.filter(e=>(e.relatedActivityIds||[]).length===0).length;
  const incompleteDeterminationCount=p.determinationChainIncompleteEventCount??events.filter(e=>e.evidenceChainState==="determination_chain_incomplete").length;
  const kpis=planningKpis([
    ["Delay events",p.eventCount,"governed events",p.eventCount?"":"warning"],
    ["Claims",p.claimCount,"claim records"],
    ["Claims linked to events",linked,"causal linkage",linked?"success":"warning"],
    ["Unlinked claims",unlinked,"cannot be attributed",unlinked?"warning":""],
    ["Events linked to activities",p.activityLinkedEventCount??0,"schedule linkage"],
    ["Activity evidence gaps",activityGapCount,"fail-closed source gaps",activityGapCount?"warning":""],
    ["Events linked to windows",p.windowLinkedEventCount??0,"time-window linkage"],
    ["Notice-linked events",p.noticeLinkedEventCount??0,"notice evidence"],
    ["Determined events",p.determinationLinkedEventCount??0,"Engineer determination linkage"],
    ["Incomplete determination chains",incompleteDeterminationCount,"required links missing",incompleteDeterminationCount?"warning":""],
    ["Gross positive window movement",fmt(p.observedPositiveProgrammeMovementDays)+" d","analytical window sum; not entitlement",p.observedPositiveProgrammeMovementDays?"warning":""],
    ["Project Completion movement",p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"—":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net submitted completion movement"]
  ]);
  const noEventWarning=p.eventCount===0&&p.claimCount>0?'<div class="notice warn"><b>'+escapeHtml(fmt(p.claimCount))+' claim records are present, but no governed delay events are established.</b> CMeng will not attribute schedule movement, responsibility or EOT entitlement to those claims until event linkage exists.</div>':'';
  const activityEvidenceWarning=activityGapCount>0?'<div class="notice warn"><b>Activity evidence not established for '+escapeHtml(fmt(activityGapCount))+' delay event'+(activityGapCount===1?'':'s')+'.</b> The available claim/correspondence sources do not establish a defensible activity-level relationship for these events. CMeng fails closed and does not invent activity links. Determination chains remain explicitly incomplete where the activity link is required.</div>':'';
  const warning=noEventWarning+activityEvidenceWarning;
  const linkage=planningStatusBand([
    ["Linked to delay events",linked,"success"],
    ["Not linked to delay events",unlinked,"warning"]
  ]);
  const chainChart=renderVisualBars([
    {label:"Claim-linked events",value:p.claimLinkedEventCount??0,tone:"success"},
    {label:"Activity-linked events",value:p.activityLinkedEventCount??0,tone:"accent"},
    {label:"Window-linked events",value:p.windowLinkedEventCount??0,tone:"warning"},
    {label:"Notice-linked events",value:p.noticeLinkedEventCount??0,tone:"teal"},
    {label:"Determination-linked events",value:p.determinationLinkedEventCount??0,tone:"purple"}
  ],"events");
  const movementChart=renderWaterfallChart([
    {label:"Gross positive window movement",value:typeof p.observedPositiveProgrammeMovementDays==="number"?p.observedPositiveProgrammeMovementDays:0},
    {label:"Net Project Completion movement",value:typeof p.projectCompletionMovementDays==="number"?p.projectCompletionMovementDays:0}
  ],"d");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Evidence-chain coverage","How far the governed claim/event population is connected into schedule, windows, notices and determinations.",chainChart)+
    renderVisualPanel("Schedule movement semantics","Gross positive window movement and net Project Completion movement are shown as different analytical measures.",movementChart)+
  '</div>';
  const classes=claimStateCounts(events.map(e=>({state:e.candidateClass})));
  const rows=events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(humanizeKey(e.responsibility))+'</td><td>'+escapeHtml(humanizeKey(e.noticeTimeliness))+'</td><td>'+escapeHtml(fmt(e.observedPositiveProgrammeMovementDays))+'</td><td>'+escapeHtml(humanizeKey(e.programmeMovementBasis))+'</td><td><span class="state-pill '+(e.concurrencyCandidate?"review":"ready")+'">'+escapeHtml(humanizeKey(e.evidenceChainState||e.candidateClass))+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.relatedActivityIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.overlappingWindowIds||[]).map(id=>readableWindow(id,p.revisionLabels||{})).join(", ")||"—")+'</td><td>'+escapeHtml((e.noticeIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.determinationIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.evidenceChainMissingLinks||[]).map(humanizeKey).join(", ")||"—")+'</td></tr>').join("");
  const detail=events.length?'<div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Notice status</th><th>Gross positive movement d</th><th>Movement basis</th><th>Evidence chain</th><th>Claims</th><th>Activities</th><th>Windows</th><th>Notices</th><th>Determinations</th><th>Missing links</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty-visual">No delay-event population is established. Claim records alone are not converted into delay events.</div>';
  const classVisual=events.length?moduleBarList(classes,"warning"):'<div class="empty-visual">Event responsibility cannot be classified until delay events are established.</div>';
  return '<section class="planning-view delay-claims-view">'+kpis+warning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Claim-event linkage</h4><p>Claims without a governed delay-event link remain un-attributed.</p></div></div><div class="planning-panel-body">'+linkage+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Event assessment classes</h4><p>Responsibility classification is shown only for established delay events.</p></div></div><div class="planning-panel-body">'+classVisual+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Delay-event detail</h4></div></div><div class="planning-panel-body">'+detail+'</div></section></section>';
}
function renderEotVisual(data){
  const p=projectionFor(data,"eot_assessment");
  if(!Array.isArray(p.windowCandidates))return"";
  const contractReady=p.contractTimeBasisEstablished===true;
  const causalReady=p.eligibleCausalEventEvidenceEstablished===true;
  const analytical=p.analyticalTimeImpactCandidateDays;
  const kpis=planningKpis([
    ["Contract finish",planningShortDate(p.contractualCompletionIso),p.contractualCompletionState,contractReady?"":"warning"],
    ["Determinations by Data Date",p.officialApprovedEotDays===null?"—":fmt(p.officialApprovedEotDays)+" d",p.officialApprovedEotState],
    ["Official adjusted finish",planningShortDate(p.officialAdjustedCompletionIso),"governed only"],
    ["Gross positive window movement",fmt(p.observedProgrammeMovementDays)+" d","schedule observation only; not EOT",p.observedProgrammeMovementDays>0?"warning":""],
    ["Project Completion movement",p.projectCompletionMovementDays===null||p.projectCompletionMovementDays===undefined?"—":(p.projectCompletionMovementDays>0?"+":"")+fmt(p.projectCompletionMovementDays)+" d","net first-to-latest submitted completion"],
    ["Time-impact candidate",analytical===null?"Not established":fmt(analytical)+" d","requires causation",analytical===null?"warning":"accent"],
    ["Attributable EOT candidate",p.attributableCandidateEotDays===null?"Not established":fmt(p.attributableCandidateEotDays)+" d","not an award",p.attributableCandidateEotDays===null?"warning":"accent"]
  ]);
  const warning=analytical===null&&p.observedProgrammeMovementDays>0?'<div class="notice warn"><b>Gross positive window movement is not project delay and is not EOT.</b> Schedule movement is not an EOT time-impact assessment. CMeng observes '+escapeHtml(fmt(p.observedProgrammeMovementDays))+' days when positive window shifts are summed, while net Project Completion movement is shown separately. No entitlement is stated until causation, notice and the contract time basis support it.</div>':'';
  const labels=p.revisionLabels||{};
  const movementBars=p.windowCandidates.map((w,index)=>({
    label:"Window "+(index+1)+" · "+readableWindow(w.windowId,labels),
    value:typeof w.positiveProgrammeMovementDays==="number"?w.positiveProgrammeMovementDays:0,
    tone:"warning"
  }));
  const rows=p.windowCandidates.map(w=>'<tr><td><b>'+escapeHtml(readableWindow(w.windowId,labels))+'</b></td><td>'+escapeHtml(fmt(w.positiveProgrammeMovementDays))+'</td><td>'+escapeHtml(humanizeKey(w.programmeMovementBasis))+'</td><td>'+escapeHtml(w.analyticalTimeImpactCandidateDays===null?"—":fmt(w.analyticalTimeImpactCandidateDays))+'</td><td>'+escapeHtml(humanizeKey(w.state))+'</td><td>'+escapeHtml(fmt(w.includedCandidateDays))+'</td><td>'+escapeHtml((w.reasons||[]).map(managementReason).join("; ")||"—")+'</td></tr>').join("");
  const recon=p.timeBasisReconciliation;
  const determinationVisual=recon?renderDonutChart([
    {label:"Effective by Data Date",value:recon.effectiveDeterminationCount||0,tone:"success"},
    {label:"After Data Date",value:Math.max(0,(recon.registerDeterminationCount||0)-(recon.effectiveDeterminationCount||0)),tone:"neutral"}
  ],"Determinations"):'<div class="empty-visual">Determination population is not established.</div>';
  const movementVisual=renderWaterfallChart([
    {label:"Gross positive window movement",value:typeof p.observedProgrammeMovementDays==="number"?p.observedProgrammeMovementDays:0},
    {label:"Net Project Completion movement",value:typeof p.projectCompletionMovementDays==="number"?p.projectCompletionMovementDays:0},
    {label:"Analytical time-impact candidate",value:typeof analytical==="number"?analytical:0},
    {label:"Attributable EOT candidate",value:typeof p.attributableCandidateEotDays==="number"?p.attributableCandidateEotDays:0}
  ],"d");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Time-position bridge","Schedule movement, time-impact analysis and EOT candidate remain separate measures.",movementVisual)+
    renderVisualPanel("Determination timing","Engineer determinations split by the current programme Data Date.",determinationVisual)+
  '</div>';
  const reconciliation=recon?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Amendment and determination reconciliation</h4><p>As-of date: '+escapeHtml(planningShortDate(recon.dataDateIso))+'.</p></div></div><div class="planning-panel-body">'+planningKpis([["EOT incorporated in amendment",fmt(recon.incorporatedEotDays)+" d","already inside revised completion"],["Full determination register",fmt(recon.registerDeterminationDays)+" d",(recon.registerDeterminationCount===null||recon.registerDeterminationCount===undefined?"population not stated":fmt(recon.registerDeterminationCount)+" immutable determination(s)")],["Determinations by Data Date",recon.effectiveDeterminationCount===null||recon.effectiveDeterminationCount===undefined?"—":fmt(recon.effectiveDeterminationCount),"cutoff-controlled population"],["Additional approved EOT",recon.additionalApprovedEotDays===null?"Unresolved":fmt(recon.additionalApprovedEotDays)+" d","never register total plus amendment"]])+'<div class="notice warn">'+(recon.overlapResolution==="unresolved"?"Amendment incorporation has not been reconciled to the determination register. No additional days are applied to the revised contractual completion.":"Additional awards have an explicit incorporation reconciliation.")+'</div></div></section>':"";
  return '<section class="planning-view eot-view">'+kpis+reconciliation+warning+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Observed movement by window</h4><p>This chart shows programme movement only. It does not represent EOT entitlement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(movementBars,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>EOT evidence gates</h4><p>All gates remain distinct before schedule movement can become an entitlement position.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Contract time basis",value:contractReady?"Established":"Not established",state:contractReady?"ready":"missing"},
    {label:"Causal delay events",value:causalReady?"Established":"Not established",state:causalReady?"ready":"missing"},
    {label:"Official EOT award",value:p.officialApprovedEotState==="official"?"Established":"Not established",state:p.officialApprovedEotState==="official"?"ready":"missing"}
  ])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Window assessment</h4><p>Observed movement, candidate time impact and included entitlement days remain separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Window</th><th>Observed movement d</th><th>Movement basis</th><th>Time-impact candidate d</th><th>State</th><th>Included days</th><th>Reason</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function visualSection(title,description,badge,body){
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div>'+(badge?'<span class="badge">'+escapeHtml(badge)+'</span>':'')+'</div><div class="chart-body">'+body+'</div></section>';
}
function metricLine(label,value){
  return '<div class="domain-metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"—":fmt(value))+'</strong></div>';
}

function planningDateMs(value){
  if(!value)return null;
  const n=Date.parse(value);
  return Number.isFinite(n)?n:null;
}
function planningShortDate(value){
  if(!value)return "—";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short",year:"numeric"}).format(d);
}
function planningDaysBetween(a,b){
  const am=planningDateMs(a),bm=planningDateMs(b);
  if(am===null||bm===null)return null;
  return Number(((bm-am)/86400000).toFixed(1));
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
  const labels={
    ready:"Ready",partial:"Review needed",blocked:"Blocked",
    completed:"Completed",in_progress:"In progress",not_started:"Not started",unknown:"Unknown",
    critical:"Critical",near_critical:"Near-critical",noncritical:"Other",
    available:"Available",missing:"Not provided",conditional:"Conditional",
    true:"Yes",false:"No",established:"Confirmed",not_established:"Not confirmed",
    deterministic:"Calculated",scenario:"Scenario",unresolved:"Needs review"
  };
  const key=String(value);
  return labels[key]||humanizeKey(key);
}
function planningKpis(items){
  return '<div class="planning-kpi-grid">'+items.map(item=>{
    const label=item[0],value=item[1],sub=item[2]||"",tone=item[3]||"";
    return '<div class="planning-kpi '+escapeHtml(tone)+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"—":fmt(value))+'</strong>'+(sub?'<small>'+escapeHtml(sub)+'</small>':'')+'</div>';
  }).join("")+'</div>';
}
function planningStatusBand(items){
  const known=(items||[]).filter(item=>typeof item[1]==="number"&&Number.isFinite(item[1])&&item[1]>=0);
  const total=known.reduce((sum,item)=>sum+item[1],0);
  if(!known.length)return '<div class="empty-visual">This distribution is not established from the available project information.</div>';
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
  const width=960,height=290,left=112,right=24,top=22,bottom=48;
  const prepared=points.map((point,index)=>{
    const result={label:point.dateIso||("Revision "+(index+1)),values:{}};
    series.forEach(s=>{result.values[s.key]=planningDateMs(point[s.key]);});
    return result;
  });
  const vals=[];
  prepared.forEach(p=>series.forEach(s=>{const v=p.values[s.key];if(typeof v==="number")vals.push(v)}));
  if(!vals.length)return '<div class="empty-visual">No completion-date trend is available.</div>';
  let min=Math.min(...vals),max=Math.max(...vals);
  if(min===max){min-=14*86400000;max+=14*86400000}
  const pad=Math.max(7*86400000,(max-min)*.08);min-=pad;max+=pad;
  const pw=width-left-right,ph=height-top-bottom;
  const x=i=>left+(prepared.length===1?pw/2:(i/(prepared.length-1))*pw);
  const y=v=>top+ph-((v-min)/(max-min))*ph;
  const ticks=[0,.25,.5,.75,1].map(r=>{
    const ms=min+r*(max-min),yy=y(ms);
    return '<line x1="'+left+'" y1="'+yy.toFixed(1)+'" x2="'+(width-right)+'" y2="'+yy.toFixed(1)+'" stroke="#e4eaf1"/><text x="'+(left-9)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="#75849a">'+escapeHtml(planningShortDate(new Date(ms).toISOString()))+'</text>';
  }).join("");
  const paths=series.map(s=>{
    let segments=[],current=[];
    prepared.forEach((p,i)=>{
      const v=p.values[s.key];
      if(typeof v==="number"){current.push(x(i).toFixed(1)+","+y(v).toFixed(1))}
      else if(current.length){segments.push(current);current=[]}
    });
    if(current.length)segments.push(current);
    return segments.map(seg=>'<polyline points="'+seg.join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>').join("");
  }).join("");
  const pointsSvg=series.map(s=>prepared.map((p,i)=>{
    const v=p.values[s.key];if(typeof v!=="number")return"";
    return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="3.5" fill="'+s.color+'"><title>'+escapeHtml(s.label+" · "+planningShortDate(new Date(v).toISOString())+" · "+p.label)+'</title></circle>';
  }).join("")).join("");
  const labelIndexes=[0,Math.floor((prepared.length-1)/2),prepared.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndexes.map(i=>{const raw=prepared[i].label;const label=planningDateMs(raw)!==null?planningShortDate(raw):planningRevisionLabel(raw);return'<text x="'+x(i).toFixed(1)+'" y="'+(height-15)+'" text-anchor="'+(i===0?"start":i===prepared.length-1?"end":"middle")+'" font-size="10" fill="#75849a">'+escapeHtml(label)+'</text>'}).join("");
  const legend='<div class="chart-legend">'+series.map(s=>'<span class="legend-item"><span class="legend-dot" style="background:'+s.color+'"></span>'+escapeHtml(s.label)+'</span>').join("")+'</div>';
  return legend+'<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'">'+ticks+paths+pointsSvg+labels+'</svg></div>';
}
function planningActivityPressure(rows){
  const candidates=(rows||[]).filter(r=>typeof r.finishVarianceDays==="number"&&Number.isFinite(r.finishVarianceDays)&&typeof r.totalFloatHours==="number"&&Number.isFinite(r.totalFloatHours));
  if(!candidates.length)return '<div class="empty-visual">Baseline variance and float are not both available for enough activities.</div>';
  const columns=[
    {label:"On / early",match:v=>v<=0},
    {label:"1–30 d late",match:v=>v>0&&v<=30},
    {label:"31–90 d late",match:v=>v>30&&v<=90},
    {label:"91–180 d late",match:v=>v>90&&v<=180},
    {label:">180 d late",match:v=>v>180}
  ];
  const bands=[
    {label:"Negative float",tone:"danger",match:r=>r.totalFloatHours<0},
    {label:"Zero float",tone:"danger-soft",match:r=>r.totalFloatHours===0},
    {label:"Near-critical",tone:"warning",match:r=>r.totalFloatHours>0&&r.totalFloatHours<=40},
    {label:"Other positive",tone:"accent",match:r=>r.totalFloatHours>40}
  ];
  const counts=bands.map(band=>columns.map(col=>candidates.filter(r=>band.match(r)&&col.match(r.finishVarianceDays)).length));
  const max=Math.max(1,...counts.flat());
  const head='<div class="pressure-matrix-head"><span>Float position</span>'+columns.map(col=>'<b>'+escapeHtml(col.label)+'</b>').join("")+'</div>';
  const body=bands.map((band,rowIndex)=>'<div class="pressure-matrix-row"><strong>'+escapeHtml(band.label)+'</strong>'+counts[rowIndex].map(count=>{
    const intensity=count/max;
    return '<span class="pressure-cell '+escapeHtml(band.tone)+'" style="--cell-alpha:'+Math.max(.08,intensity).toFixed(3)+'" title="'+escapeHtml(band.label+" · "+fmt(count))+'"><b>'+escapeHtml(fmt(count))+'</b></span>';
  }).join("")+'</div>').join("");
  return '<div class="pressure-matrix">'+head+body+'</div><div class="pressure-note">Counts use the controlled-baseline finish movement and submitted programme total float. Missing values are excluded, not treated as zero.</div>';
}
function planningLookAheadTimeline(p){
  const labelMap={predecessor:"Predecessor",procurement_material:"Material",design_submittal:"Design",permit:"Permit",resource:"Resource",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const rows=[...(p.rows||[])].sort((a,b)=>{
    const ar=a.readiness?.state==="blocked"?0:a.classification==="overdue"?1:a.readiness?.state==="conditional"?2:3;
    const br=b.readiness?.state==="blocked"?0:b.classification==="overdue"?1:b.readiness?.state==="conditional"?2:3;
    return ar-br||String(a.startIso||"").localeCompare(String(b.startIso||""));
  }).slice(0,36);
  const start=planningDateMs(p.dataDateIso),end=planningDateMs(p.windowEndIso);
  if(start===null||end===null||end<=start)return '<div class="empty-visual">The look-ahead date window is not established.</div>';
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
    let stateText="Ready";
    if(blocked.length===1) stateText=labelMap[blocked[0].key]||"Known blocker";
    else if(blocked.length>1) stateText=(labelMap[blocked[0].key]||"Blocker")+" +"+(blocked.length-1);
    else if(unknown.length>0) stateText="Evidence gaps";
    const notes=blocked.map(d=>(labelMap[d.key]||d.key)+(d.note?": "+d.note:"")).join(" · ")||unknown.map(d=>labelMap[d.key]||d.key).join(", ");
    const title=planningShortDate(r.startIso)+" → "+planningShortDate(r.finishIso)+" · "+stateText+(notes?" · "+notes:"");
    return '<div class="lookahead-row"><div class="lookahead-label"><b>'+escapeHtml(r.activityId)+'</b><span>'+escapeHtml(r.name||"")+'</span></div><div class="lookahead-track"><span class="lookahead-bar '+escapeHtml(state)+'" style="left:'+l.toFixed(2)+'%;width:'+w.toFixed(2)+'%" title="'+escapeHtml(title)+'"></span></div><b class="lookahead-state '+escapeHtml(state)+'" title="'+escapeHtml(notes||stateText)+'">'+escapeHtml(stateText)+'</b></div>';
  }).join("");
  return '<div class="lookahead-axis"><div></div><div class="lookahead-weeks">'+weekMarks.join("")+'</div><div></div></div><div class="lookahead-timeline">'+body+'</div>';
}
function planningMilestonePriorityRank(value){
  return value==="critical"?0:value==="high"?1:value==="watch"?2:3;
}
function planningMilestoneCriticalityLabel(row){
  if(row.criticality==="critical")return row.negativeFloat?"Critical · negative float":"Critical path";
  if(row.criticality==="near_critical")return "Near-critical";
  if(row.criticality==="positive_float")return "Positive float";
  return "Float not established";
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
    CRITICAL_PATH:"Critical path",
    NEGATIVE_FLOAT:"Negative float",
    NEAR_CRITICAL:"Near-critical",
    OVERDUE:"Overdue",
    DUE_WITHIN_30_DAYS:"Due ≤30d",
    DUE_WITHIN_90_DAYS:"Due ≤90d",
    LATER_THAN_BASELINE:"Later than baseline",
    FLOAT_NOT_ESTABLISHED:"Float missing",
    TERMINAL_CRITICAL_MILESTONE:"Critical finish"
  };
  return labels[flag]||humanizeKey(flag);
}
function planningMilestoneFlagTone(flag){
  return ["NEGATIVE_FLOAT","OVERDUE","CRITICAL_PATH","TERMINAL_CRITICAL_MILESTONE"].includes(flag)?"danger":["NEAR_CRITICAL","DUE_WITHIN_30_DAYS","DUE_WITHIN_90_DAYS","LATER_THAN_BASELINE"].includes(flag)?"warning":"";
}
function planningMilestonePriorityBoard(p){
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
  if(!source.length)return '<div class="empty-visual">No open milestone dates are available for the control chart.</div>';
  const rows=[...source].sort((a,b)=>planningMilestoneChartPriority(b)-planningMilestoneChartPriority(a)||planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER))||((b.varianceDays||0)-(a.varianceDays||0))).slice(0,18);
  const dates=[];
  rows.forEach(r=>[r.baselineDateIso,r.currentDateIso].forEach(v=>{const m=planningDateMs(v);if(m!==null)dates.push(m)}));
  if(!dates.length)return '<div class="empty-visual">No comparable baseline/current milestone dates are available.</div>';
  let min=Math.min(...dates),max=Math.max(...dates);
  if(min===max){min-=30*86400000;max+=30*86400000}
  const span0=max-min;
  const pad=Math.max(14*86400000,span0*.07);
  min-=pad;max+=pad;
  const span=max-min;
  const width=1180,left=310,right=172,top=68,bottom=48,rowH=49;
  const plotW=width-left-right;
  const height=top+rows.length*rowH+bottom;
  const xMs=ms=>left+((ms-min)/span)*plotW;
  const xIso=value=>{const ms=planningDateMs(value);return ms===null?null:xMs(ms)};
  const ticks=7;
  const tickSvg=Array.from({length:ticks},(_,i)=>{
    const ms=min+(span*(i/(ticks-1)));
    const x=xMs(ms);
    return '<line class="grid-line" x1="'+x.toFixed(1)+'" y1="'+top+'" x2="'+x.toFixed(1)+'" y2="'+(height-bottom+6)+'"></line><text class="axis-label" x="'+x.toFixed(1)+'" y="48" text-anchor="'+(i===0?"start":i===ticks-1?"end":"middle")+'">'+escapeHtml(planningMilestoneChartDateLabel(ms,span))+'</text>';
  }).join("");
  const dd=planningDateMs(p.dataDateIso);
  const ddInRange=dd!==null&&dd>=min&&dd<=max;
  const ddSvg=ddInRange?'<line class="data-line" x1="'+xMs(dd).toFixed(1)+'" y1="55" x2="'+xMs(dd).toFixed(1)+'" y2="'+(height-bottom+6)+'"></line><rect x="'+(xMs(dd)-34).toFixed(1)+'" y="16" width="68" height="20" rx="10" fill="#344054"></rect><text x="'+xMs(dd).toFixed(1)+'" y="30" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">DATA DATE</text>':'';
  const rowSvg=rows.map((r,index)=>{
    const y=top+index*rowH;
    const cy=y+rowH/2;
    const bx=xIso(r.baselineDateIso),cx=xIso(r.currentDateIso);
    const priority=r.managementPriority||"normal";
    const rowFill=priority==="critical"?"#fff8f7":priority==="high"?"#fffaf2":index%2===0?"#ffffff":"#fbfdff";
    const pillFill=priority==="critical"?"#fef0ef":priority==="high"?"#fff4d8":priority==="watch"?"#edf4fb":"#f2f4f7";
    const pillText=priority==="critical"?"#b42318":priority==="high"?"#a15c00":priority==="watch"?"#3d6897":"#667085";
    const movementClass=(r.varianceDays||0)>0?"movement-late":(r.varianceDays||0)<0?"movement-early":"movement-neutral";
    const slipClass=(r.varianceDays||0)>0?"late-value":(r.varianceDays||0)<0?"early-value":"";
    const criticalClass=r.criticality==="critical"?"critical-value":r.criticality==="near_critical"?"near-value":"";
    const variance=r.varianceDays===null||r.varianceDays===undefined?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)+" d");
    const float=r.totalFloatHours===null||r.totalFloatHours===undefined?"—":fmt(r.totalFloatHours)+" h";
    const due=planningMilestoneDueLabel(r);
    const status=planningStateLabel(r.status);
    const criticality=planningMilestoneCriticalityLabel(r);
    const line=bx!==null&&cx!==null?'<line class="'+movementClass+'" x1="'+bx.toFixed(1)+'" y1="'+cy+'" x2="'+cx.toFixed(1)+'" y2="'+cy+'"></line>':'';
    const baseline=bx===null?'':'<circle class="baseline-point" cx="'+bx.toFixed(1)+'" cy="'+cy+'" r="5"></circle>';
    const diamond=cx===null?'':'<rect class="current-point" x="'+(cx-5).toFixed(1)+'" y="'+(cy-5).toFixed(1)+'" width="10" height="10" rx="1" transform="rotate(45 '+cx.toFixed(1)+' '+cy+')"></rect>';
    const ring=cx===null?'':r.criticality==="critical"?'<circle class="critical-ring" cx="'+cx.toFixed(1)+'" cy="'+cy+'" r="9"></circle>':r.criticality==="near_critical"?'<circle class="near-ring" cx="'+cx.toFixed(1)+'" cy="'+cy+'" r="9"></circle>':'';
    const terminal=r.terminalMilestone?' · terminal milestone':'';
    return '<g>'+
      '<rect x="0" y="'+y+'" width="'+width+'" height="'+rowH+'" fill="'+rowFill+'"></rect>'+
      '<line class="row-line" x1="0" y1="'+(y+rowH)+'" x2="'+width+'" y2="'+(y+rowH)+'"></line>'+
      '<rect x="14" y="'+(cy-9)+'" width="58" height="18" rx="9" fill="'+pillFill+'"></rect>'+
      '<text class="priority-text" x="43" y="'+(cy+3)+'" text-anchor="middle" fill="'+pillText+'">'+escapeHtml(priority.toUpperCase())+'</text>'+
      '<text class="row-id" x="84" y="'+(cy-7)+'">'+escapeHtml(r.activityId)+'</text>'+
      '<text class="row-name" x="84" y="'+(cy+7)+'">'+escapeHtml(planningMilestoneChartName(r.name||"",31))+'</text>'+
      '<text class="row-meta" x="84" y="'+(cy+20)+'">'+escapeHtml(criticality+" · "+status+terminal)+'</text>'+
      line+baseline+diamond+ring+
      '<text class="value-main '+slipClass+'" x="'+(width-right+24)+'" y="'+(cy-5)+'">'+escapeHtml(variance)+'</text>'+
      '<text class="value-sub" x="'+(width-right+24)+'" y="'+(cy+9)+'">'+escapeHtml("vs baseline")+'</text>'+
      '<text class="value-main '+criticalClass+'" x="'+(width-76)+'" y="'+(cy-5)+'" text-anchor="middle">'+escapeHtml(float)+'</text>'+
      '<text class="value-sub" x="'+(width-76)+'" y="'+(cy+9)+'" text-anchor="middle">'+escapeHtml(due)+'</text>'+
      '<title>'+escapeHtml(r.activityId+" · "+(r.name||"")+" · "+criticality+" · "+due+" · "+variance+" vs baseline · "+float+" total float")+'</title>'+
    '</g>';
  }).join("");
  const headers='<text class="axis-title" x="14" y="48">PRIORITY / MILESTONE</text><text class="axis-title" x="'+left+'" y="18">MILESTONE DATE SCALE</text><text class="axis-title" x="'+(width-right+24)+'" y="48">MOVEMENT</text><text class="axis-title" x="'+(width-76)+'" y="48" text-anchor="middle">FLOAT / DUE</text>';
  const chart='<div class="milestone-chart-shell"><div class="milestone-chart-head"><div><h5>Milestone movement & criticality control chart</h5><p>Top open milestones ranked by criticality, negative float, date urgency, terminal importance and baseline movement. The horizontal axis is a true calendar-date scale.</p></div><div class="milestone-chart-legend"><span><i class="baseline"></i>Controlled baseline</span><span><i class="current"></i>Current forecast</span><span><i class="actual"></i>Actual when completed</span><span><i class="data"></i>Data date</span></div></div><div class="milestone-chart-scroll"><svg class="milestone-control-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Milestone movement and criticality control chart">'+headers+tickSvg+ddSvg+rowSvg+'</svg></div><div class="milestone-chart-foot"><span>Red ring = critical path · amber ring = near-critical · movement line shows baseline to current forecast.</span><span>'+escapeHtml(rows.length)+' of '+escapeHtml(source.length)+' open milestones shown by management priority.</span></div></div>';
  return chart;
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


function planningLookAheadBlockers(rows){
  const labels={predecessor:"Predecessor not complete",procurement_material:"Material / procurement",design_submittal:"Design / submittal",permit:"Permit",resource:"Resource",quality:"Quality",commercial:"Commercial",risk:"Risk",access:"Access"};
  const counts=new Map();
  for(const row of rows||[]){
    for(const dim of row.readiness?.dimensions||[]){
      if(dim.state==="blocked")counts.set(dim.key,(counts.get(dim.key)||0)+1);
    }
  }
  const entries=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  if(!entries.length)return '<div class="attention-clear"><b>No explicit blocker has been recorded in the look-ahead.</b></div>';
  const max=Math.max(...entries.map(x=>x[1]),1);
  return '<div class="constraint-bars">'+entries.map(([key,count])=>'<div class="constraint-row"><span>'+escapeHtml(labels[key]||humanizeKey(key))+'</span><div><i style="width:'+((count/max)*100).toFixed(2)+'%"></i></div><b>'+escapeHtml(fmt(count))+'</b></div>').join("")+'</div>';
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
  const entries=[...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(0,12);
  if(!entries.length)return '<div class="empty-visual">Current finish dates are not available.</div>';
  const max=Math.max(1,...entries.map(x=>x[1]));
  return '<div class="finish-period-bars">'+entries.map(([month,count])=>'<div class="finish-period-row"><span>'+escapeHtml(new Intl.DateTimeFormat(undefined,{month:"short",year:"numeric"}).format(new Date(month+"-01T00:00:00Z")))+'</span><div><i style="width:'+((count/max)*100).toFixed(2)+'%"></i></div><b>'+escapeHtml(fmt(count))+'</b></div>').join("")+'</div>';
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
    ["Overdue milestones",p.progress.lateMilestoneCount,"past the data date","danger"]
  ]);
  const completion=planningDateLadder([
    {label:"Controlled baseline finish",date:p.programmeBaselineCompletionIso,tone:"baseline"},
    {label:"Submitted finish",date:p.forecast.sourceCompletionIso,tone:"current"},
    {label:"Independent forecast finish",date:p.forecast.independentCompletionIso,tone:"cmeng"},
    {label:"Approved finish date",date:p.claims?.officialAdjustedCompletionIso,tone:"baseline"},
    {label:"Scenario finish date",date:p.claims?.scenarioAdjustedCompletionIso,tone:"scenario"}
  ],null);
  const attention=planningAttention([
    variance!==null&&variance>0?{title:"Independent forecast is later than the submitted finish date",text:"Review remaining durations, logic and delivery assumptions.",value:new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(variance)+" days",tone:"danger"}:null,
    p.schedule.negativeFloatCount>0?{title:"Negative float requires attention",text:"Activities are carrying schedule pressure against the current dates.",value:p.schedule.negativeFloatCount,tone:"danger"}:null,
    p.progress.lateMilestoneCount>0?{title:"Milestones are overdue",text:"Open milestone commitments have passed the current data date.",value:p.progress.lateMilestoneCount,tone:"danger"}:null,
    p.progress.lookAheadOverdueCount>0?{title:"Look-ahead contains overdue work",text:"Review overdue activities and immediate recovery actions.",value:p.progress.lookAheadOverdueCount,tone:"watch"}:null,
    p.resources.overloadedResourceCount>0?{title:"Weekly resource capacity exceedance identified",text:"Weekly source evidence shows demand above known capacity for these distinct resources. This is separate from P6 per-hour overload assessment.",value:p.resources.overloadedResourceCount,tone:"watch"}:null,
    p.contract.challengeSignalCount>0?{title:"Contract items need review",text:"CMeng found contract points that may affect the programme position.",value:p.contract.challengeSignalCount,tone:"watch"}:null
  ]);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Activity status","Current programme population by execution state.",renderDonutChart([
      {label:"Completed",value:p.progress.completedCount||0,tone:"success"},
      {label:"In progress",value:p.progress.inProgressCount||0,tone:"accent"},
      {label:"Not started",value:p.progress.notStartedCount||0,tone:"neutral"},
      {label:"Unknown",value:p.progress.unknownStatusCount||0,tone:"neutral"}
    ],"Activities"))+
    renderVisualPanel("Schedule pressure","Criticality and negative-float populations that require management attention.",renderDonutChart([
      {label:"Critical",value:p.schedule.criticalCount||0,tone:"danger"},
      {label:"Near-critical",value:p.schedule.nearCriticalCount||0,tone:"warning"},
      {label:"Negative float",value:p.schedule.negativeFloatCount||0,tone:"purple"}
    ],"Pressure signals"))+
  '</div>';
  const health='<div class="management-health-grid">'+[
    ["Programme",[
      ["Source activities",p.schedule.sourceActivityCount??p.schedule.activityCount],["Execution population",p.schedule.executableActivityCount??p.schedule.activityCount],["Excluded",p.schedule.excludedActivityCount??0],["Relationships",p.schedule.relationshipCount],["Logic density",p.schedule.logicDensity],["Path check",planningStateLabel(p.schedule.independentCpmState)]
    ]],
    ["Progress",[
      ["Weighted progress",p.progress.durationWeightedProgressPercent===null?"—":fmt(p.progress.durationWeightedProgressPercent)+"%"],["Progress coverage",p.progress.progressCoveragePercent===null?"—":fmt(p.progress.progressCoveragePercent)+"%"],["Completed",p.progress.completedCount],["In progress",p.progress.inProgressCount]
    ]],
    ["Delivery",[
      ["Assigned resources",p.resources.assignedResourceCount],["Capacity coverage",p.resources.capacityCoveragePercent===null?"—":fmt(p.resources.capacityCoveragePercent)+"%"],["Resources with weekly exceedance",p.resources.overloadedResourceCount],["BOQ/activity link",planningStateLabel(p.quantities.allocationState)]
    ]],
    ["Claims & time",[
      ["Delay events",p.claims.eventCount],["Claims",p.claims.claimCount],["Programme movement",fmt(p.claims.observedProgrammeMovementDays)+" days"],["Approved EOT",p.claims.officialApprovedEotDays===null?"—":fmt(p.claims.officialApprovedEotDays)+" days"]
    ]]
  ].map(group=>'<div class="domain-card"><h5>'+escapeHtml(group[0])+'</h5>'+group[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return '<section class="planning-view management-view">'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date position</h4><p>Controlled baseline, submitted finish date and any independently calculated, approved or scenario finish dates.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel attention"><div class="planning-panel-head"><div><h4>What needs attention</h4><p>Items that can change the current programme position.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Schedule, progress, delivery and time position at a glance.</p></div></div><div class="planning-panel-body">'+health+'</div></section></section>';
}
function renderScheduleAnalyticsVisual(data){
  const p=projectionFor(data,"schedule_analytics");
  const r=p.result||p;
  if(!r.graph||!r.float)return"";
  const openStarts=(r.graph.openStartActivityIds||[]).length,openFinishes=(r.graph.openFinishActivityIds||[]).length;
  const broken=(r.graph.brokenPredecessorActivityIds||[]).length+(r.graph.brokenSuccessorActivityIds||[]).length;
  const cycles=(r.graph.cyclicActivityIds||[]).length,isolated=(r.graph.isolatedActivityIds||[]).length;
  const kpis=planningKpis([
    ["Activities",r.activityCount,"current programme"],
    ["Relationships",r.relationshipCount,"logic links"],
    ["Logic density",r.graph.logicDensity,"links per activity"],
    ["Open starts",openStarts,"activities","warning"],
    ["Open finishes",openFinishes,"activities","warning"],
    ["Negative float",r.float.negativeFloatCount,"activities","danger"]
  ]);
  const pressure='<div class="planning-split"><div><h5>Schedule pressure</h5>'+planningStatusBand([
    ["Negative float",r.float.negativeFloatCount,"danger"],
    ["Zero float",Math.max(0,r.float.criticalCount-r.float.negativeFloatCount),"danger"],
    ["Near-critical",r.float.nearCriticalCount,"warning"],
    ["Other positive",Math.max(0,r.float.positiveFloatCount-r.float.nearCriticalCount),"accent"],
    ["Float unknown",r.float.unknownFloatCount,"neutral"]
  ])+'<div class="coverage-line"><span>Float coverage</span><b>'+escapeHtml(r.float.coveragePercent===null?"—":fmt(r.float.coveragePercent)+"%")+'</b></div></div><div><h5>Activity status</h5>'+planningStatusBand([
    ["Completed",r.status.completed,"success"],["In progress",r.status.inProgress,"accent"],["Not started",r.status.notStarted,"neutral"],["Unknown",r.status.unknown,"warning"]
  ])+'</div></div>';
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Activity status mix","Execution status across the full programme population.",renderDonutChart([
      {label:"Completed",value:r.status.completed||0,tone:"success"},
      {label:"In progress",value:r.status.inProgress||0,tone:"accent"},
      {label:"Not started",value:r.status.notStarted||0,tone:"neutral"},
      {label:"Unknown",value:r.status.unknown||0,tone:"warning"}
    ],"Activities"))+
    renderVisualPanel("Float classification","Submitted programme float separated into critical, near-critical and other populations.",renderDonutChart([
      {label:"Negative float",value:r.float.negativeFloatCount||0,tone:"danger"},
      {label:"Zero float",value:Math.max(0,(r.float.criticalCount||0)-(r.float.negativeFloatCount||0)),tone:"purple"},
      {label:"Near-critical",value:r.float.nearCriticalCount||0,tone:"warning"},
      {label:"Other positive",value:Math.max(0,(r.float.positiveFloatCount||0)-(r.float.nearCriticalCount||0)),tone:"accent"},
      {label:"Unknown",value:r.float.unknownFloatCount||0,tone:"neutral"}
    ],"Float population"))+
  '</div>';
  const integrity='<div class="integrity-grid">'+[
    ["Cycles",cycles,cycles?"danger":"success"],["Broken links",broken,broken?"danger":"success"],["Open starts",openStarts,openStarts?"warning":"success"],["Open finishes",openFinishes,openFinishes?"warning":"success"],["Isolated activities",isolated,isolated?"warning":"success"],["Programme logic",r.graph.complete?"Complete":"Review needed",r.graph.complete?"success":"danger"]
  ].map(x=>'<div class="integrity-card '+escapeHtml(x[2])+'"><span>'+escapeHtml(x[0])+'</span><b>'+escapeHtml(fmt(x[1]))+'</b></div>').join("")+'</div>';
  const completion=planningDateLadder((r.completionBases||[]).map(b=>({
    label:b.basis==="programme"?"Controlled baseline finish":b.basis==="forecast"?"Current forecast finish":"Actual finish",
    date:b.dateIso,
    tone:b.basis==="forecast"?"cmeng":b.basis==="actual"?"actual":"current"
  })),r.dataDateIso);
  const variance=r.finishVariance||{};
  const varianceBand=planningStatusBand([
    ["Late",variance.lateActivities||0,"danger"],["On time",variance.onTimeActivities||0,"success"],["Early",variance.earlyActivities||0,"accent"],["Unknown",variance.unknownActivities||0,"neutral"]
  ]);
  return '<section class="planning-view programme-review">'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Float, progress and logic quality across the current programme.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic checks</h4><p>Issues that reduce confidence in schedule sequencing.</p></div></div><div class="planning-panel-body">'+integrity+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish dates</h4><p>Baseline, current forecast and actual finish dates are kept separate so one is not mistaken for another.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish variance</h4><p>Activities finishing later, on time or earlier than their comparison date.</p></div></div><div class="planning-panel-body">'+varianceBand+'<div class="coverage-line"><span>Variance coverage</span><b>'+escapeHtml(variance.coveragePercent===null||variance.coveragePercent===undefined?"—":fmt(variance.coveragePercent)+"%")+'</b></div></div></section></div></section>';
}
function renderActivityAnalyticsVisual(data){
  const p=projectionFor(data,"activity_analytics");
  if(!Array.isArray(p.rows))return"";
  const status={completed:0,in_progress:0,not_started:0,unknown:0};
  p.rows.forEach(r=>{status[r.status]=(status[r.status]||0)+1});
  const critical=p.rows.filter(r=>r.criticality==="critical").length;
  const near=p.rows.filter(r=>r.criticality==="near_critical").length;
  const floatRisk=p.rows.filter(r=>r.floatRiskWatchlist===true).length;
  const late=p.rows.filter(r=>typeof r.finishVarianceDays==="number"&&r.finishVarianceDays>0).length;
  const openLogic=p.rows.filter(r=>r.openStart||r.openFinish||r.isolated).length;
  const kpis=planningKpis([
    ["Activities",p.activityCount,"current programme"],
    ["Completed",status.completed,"activities","success"],
    ["In progress",status.in_progress,"activities","accent"],
    ["Critical",critical,"activities","danger"],
    ["Near-critical",near,"strict taxonomy","warning"],
    ["Float-risk watchlist",floatRisk,"includes critical boundary","accent"],
    ["Later than baseline",late,"activities","danger"]
  ]);
  const topLate=[...p.rows].filter(r=>typeof r.finishVarianceDays==="number").sort((a,b)=>b.finishVarianceDays-a.finishVarianceDays).slice(0,15).map(r=>({label:r.activityId+" · "+(r.name||""),value:r.finishVarianceDays}));
  const pressure=planningActivityPressure(p.rows);
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Execution status","Activity population by current execution state.",renderDonutChart([
      {label:"Completed",value:status.completed||0,tone:"success"},
      {label:"In progress",value:status.in_progress||0,tone:"accent"},
      {label:"Not started",value:status.not_started||0,tone:"neutral"},
      {label:"Unknown",value:status.unknown||0,tone:"warning"}
    ],"Activities"))+
    renderVisualPanel("Criticality classification","Mutually exclusive critical and near-critical classifications. Float-risk watchlist membership is tracked separately.",renderDonutChart([
      {label:"Critical",value:critical,tone:"danger"},
      {label:"Near-critical",value:near,tone:"warning"},
      {label:"Other",value:Math.max(0,p.activityCount-critical-near),tone:"neutral"}
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
  const rows=ranked.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span></td><td>'+escapeHtml(planningStateLabel(a.status))+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(planningStateLabel(a.criticality))+'</span></td><td>'+escapeHtml(planningShortDate(a.currentFinishIso))+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td><td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(a.finishVarianceDays===null?"—":fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.openStart||a.openFinish||a.isolated?"Check":"—")+'</td></tr>').join("");
  return '<section class="planning-view activity-review">'+kpis+visualOverview+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Delay & float matrix</h4><p>Activity counts by controlled-baseline finish movement and submitted programme total float.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>'+escapeHtml(fmt(openLogic))+' activities also have an open or isolated logic condition.</p></div></div><div class="planning-panel-body">'+statusBand+'<div class="coverage-stack"><span>Progress coverage <b>'+escapeHtml(p.percentCompleteCoveragePercent===null?"—":fmt(p.percentCompleteCoveragePercent)+"%")+'</b></span><span>Float coverage <b>'+escapeHtml(p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%")+'</b></span><span>Baseline comparison coverage <b>'+escapeHtml(p.finishVarianceCoveragePercent===null?"—":fmt(p.finishVarianceCoveragePercent)+"%")+'</b></span></div></div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest finish movements</h4><p>Activities furthest later than the controlled baseline finish.</p></div></div><div class="planning-panel-body">'+planningSignedBars(topLate,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity watchlist</h4><p>Highest-attention activities first. Showing '+escapeHtml(fmt(ranked.length))+' of '+escapeHtml(fmt(p.activityCount))+'.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Criticality</th><th>Current finish</th><th>Progress</th><th>Total float h</th><th>Vs baseline d</th><th>Logic</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}

function moduleBarList(items,tone="accent",unit=""){
  const rows=(items||[]).filter(item=>typeof item.value==="number"&&Number.isFinite(item.value));
  if(!rows.length)return '<div class="empty-visual">No comparable values are established for this chart.</div>';
  const max=Math.max(1,...rows.map(item=>Math.max(0,item.value)));
  return '<div class="module-bar-list">'+rows.map(item=>'<div class="module-bar-row"><span title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</span><div><i class="'+escapeHtml(item.tone||tone)+'" style="width:'+Math.max(1,(Math.max(0,item.value)/max)*100).toFixed(2)+'%"></i></div><b>'+escapeHtml(fmt(item.value)+(unit?" "+unit:""))+'</b></div>').join("")+'</div>';
}
function progressBasisDisplay(key,basis){
  if(key==="baselinePlanned")return "Baseline planned";
  if(key==="currentSchedule")return "Current programme plan";
  if(key==="physical")return basis?.authority==="progress_snapshot"?"Schedule progress snapshot":"Physical progress";
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
    return '<div class="progress-basis-row"><div><b>'+escapeHtml(label)+'</b><span>'+escapeHtml(authority)+(basis?.asOfIso?" · "+planningShortDate(basis.asOfIso):"")+'</span></div><div class="progress-track"><i style="width:'+(value===null?0:Math.max(0,Math.min(100,value))).toFixed(2)+'%"></i></div><strong>'+escapeHtml(value===null?"—":fmt(value)+"%")+'</strong></div>';
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

function renderResourceVisual(data){
  const p=projectionFor(data,"resource_utilization");
  if(!Array.isArray(p.rows)){
    return visualSection("Resources","Resource demand and capacity are kept separate so missing capacity is never treated as zero.","Review needed",'<div class="notice warn">Resource assignments or capacity evidence are not established for the current programme.</div>');
  }
  const weekly=p.weeklyCapacityEvidence||null;
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
  const perHourCapacityText=capacityKnown>0?fmt(capacityKnown)+" / "+fmt(p.assignedResourceCount):"Not established";
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
    ["Resources",p.resourceCount,"current programme"],
    ["Assigned",p.assignedResourceCount,"with schedule assignments"],
    ["Weekly capacity coverage",weekly?.capacityCoveragePercent==null?"Not established":fmt(weekly.capacityCoveragePercent)+"%","applicable resource-week rows"],
    ["Planned utilization",weekly?.plannedAverageToDataDate==null?"Not established":fmt(weekly.plannedAverageToDataDate)+"%","mean resource-week ratio to Data Date"],
    ["Actual utilization",weekly?.actualAverageToDataDate==null?"Not established":fmt(weekly.actualAverageToDataDate)+"%","approved usage to Data Date"],
    ["Per-hour capacity",perHourCapacityText,"resources with comparable rate",capacityKnown?"accent":"warning"],
    ["Weekly capacity checks",weeklyComparable||weeklyRows,"source rows with capacity and demand",weeklyComparable?"accent":"warning"],
    ["Weekly demand > capacity",weeklyComparable?weeklyOver:"Not assessable",weeklyComparable?"source-row checks":"weekly evidence required",weeklyOver?"danger":weeklyComparable?"success":"warning"],
    ["Capacity units",weeklyUnits.length?weeklyUnits.join(" / "):"Not established","kept separate by source unit",weeklyUnits.length?"":"warning"]
  ]);

  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(r.resourceType)+'</td><td>'+escapeHtml(r.assignmentCount)+'</td><td>'+escapeHtml(fmt(r.capacityUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakPlannedUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakRemainingUnitsPerHour))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"—":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.remainingUtilizationPercent===null?"—":fmt(r.remainingUtilizationPercent)+"%")+'</td><td><span class="state-pill '+(r.overloaded===true?"blocked":r.state==="capacity_based"?"ready":"review")+'">'+escapeHtml(r.overloaded===true?"Overloaded":r.state==="capacity_based"?"Capacity assessed":"Capacity not set")+'</span></td></tr>').join("");

  const perHourNote=capacityKnown===0
    ? '<div class="notice warn"><b>Per-hour overload is not 0; it is not assessable.</b> The XER contains resource assignments but no usable max-units-per-hour capacity for the assigned resources. CMeng therefore leaves utilization blank instead of assuming zero or unlimited capacity.</div>'
    : p.capacityCoveragePercent<100
      ? '<div class="notice info">Per-hour utilization is calculated only for resources with established capacity. The remaining resources stay unassessed.</div>'
      : '';

  const weeklyNote=weeklyComparable
    ? '<div class="notice info"><b>Separate weekly capacity evidence is available.</b> CMeng found '+escapeHtml(fmt(weeklyOver))+' demand-above-capacity row checks out of '+escapeHtml(fmt(weeklyComparable))+' comparable weekly rows. These checks remain in their original units and are not converted into P6 per-hour utilization.</div>'
    : '';

  const weeklyChart=weeklyGroups.size
    ? [...weeklyGroups.entries()].map(([unit,points])=>'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Weekly capacity vs demand · '+escapeHtml(unit)+'</h4><p>Available capacity, planned demand and approved usage from the source register. Different units are never added together.</p></div><span class="badge '+(weekly?.state==="available"?"ready":"partial")+'">'+escapeHtml(weekly?.state==="candidate"?"Source candidate":humanizeKey(weekly?.state||"partial"))+'</span></div><div class="planning-panel-body">'+renderLineChart(points,[
        {key:"availableCapacity",label:"Available capacity",color:"#506579"},
        {key:"plannedDemand",label:"Planned demand",color:"#b57922"},
        {key:"actualApprovedUsage",label:"Approved actual usage",color:"#2c7a57"}
      ])+'</div></section>').join("")
    : '';

  const demandPanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Per-hour demand concentration</h4><p>Only resources with an established planned or remaining demand rate are charted. Assignment counts are not used as a substitute for demand.</p></div></div><div class="planning-panel-body">'+moduleBarList(comparableDemand)+'</div></section>';

  const weeklyDetail=weekly?.resourceSummaries?.length?'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Weekly resource utilization detail</h4><p>Means of comparable resource-week ratios on or before '+escapeHtml(planningShortDate(weekly.dataDateIso))+'. Source units and resource classes stay separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Class</th><th>Unit</th><th>Periods</th><th>Planned utilization</th><th>Actual utilization</th></tr></thead><tbody>'+weekly.resourceSummaries.map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br>'+escapeHtml(r.resourceName||"")+'</td><td>'+escapeHtml(r.resourceClass)+'</td><td>'+escapeHtml(r.unit||"Not established")+'</td><td>'+escapeHtml(fmt(r.periodCount))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"Not established":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.actualUtilizationPercent===null?"Not established":fmt(r.actualUtilizationPercent)+"%")+'</td></tr>').join("")+'</tbody></table></div></div></section>':"";
  return '<section class="planning-view resource-view">'+kpis+perHourNote+weeklyNote+weeklyChart+weeklyDetail+'<div class="planning-primary-grid">'+demandPanel+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Capacity evidence</h4><p>Per-hour schedule capacity and weekly register capacity are shown as separate evidence bases.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Schedule assignments",value:p.assignedResourceCount+" resources",state:p.assignedResourceCount>0?"ready":"missing"},
    {label:"P6 max-units/hour capacity",value:capacityKnown>0?capacityKnown+" resources":"Not established",state:capacityKnown>0?"ready":"missing"},
    {label:"Weekly capacity register",value:weeklyComparable?fmt(weeklyComparable)+" comparable rows":"Not established",state:weeklyComparable?"ready":"missing"},
    {label:"Per-hour overload assessment",value:overloadValue,state:assessed>0?"ready":"missing"}
  ])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Resource detail</h4><p>Capacity and utilization remain blank when they are not established.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Assignments</th><th>Capacity/hr</th><th>Peak planned/hr</th><th>Peak remaining/hr</th><th>Planned util.</th><th>Remaining util.</th><th>Assessment</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderProgressReportVisual(data){
  const p=projectionFor(data,"progress_report");
  if(!p.progressBases)return"";
  const current=p.progressBases.currentSchedule;
  const baseline=p.progressBases.baselinePlanned;
  const physical=p.progressBases.physical;
  const contractor=p.progressBases.contractorReported;
  const certified=p.progressBases.certified;
  const planMovement=typeof current?.valuePercent==="number"&&typeof baseline?.valuePercent==="number"?Number((current.valuePercent-baseline.valuePercent).toFixed(2)):null;
  const progressMovement=typeof physical?.valuePercent==="number"&&typeof baseline?.valuePercent==="number"?Number((physical.valuePercent-baseline.valuePercent).toFixed(2)):null;
  const sourceProgressEstablished=contractor?.valuePercent!==null||certified?.valuePercent!==null||(physical?.authority==="source_evidence"&&physical?.valuePercent!==null);
  const physicalLabel=physical?.authority==="source_evidence"?"Physical progress":"Schedule % complete";
  const kpis=planningKpis([
    ["Baseline planned",baseline?.valuePercent===null?"—":fmt(baseline?.valuePercent)+"%","planned by data date"],
    ["Current programme plan",current?.valuePercent===null?"—":fmt(current?.valuePercent)+"%","re-phased programme expectation","accent"],
    [physicalLabel,physical?.valuePercent===null?"—":fmt(physical?.valuePercent)+"%",physical?.authority==="source_evidence"?"source physical record":"activity percentage-complete snapshot",physical?.valuePercent===null?"warning":"accent"],
    ["Progress vs baseline",progressMovement===null?"—":(progressMovement>0?"+":"")+fmt(progressMovement)+" pp","percentage-complete snapshot minus baseline",progressMovement!==null&&progressMovement<0?"danger":progressMovement!==null&&progressMovement>0?"success":""],
    ["Contractor reported",contractor?.valuePercent===null?"Not provided":fmt(contractor.valuePercent)+"%","source record",contractor?.valuePercent===null?"warning":"accent"],
    ["Certified progress",certified?.valuePercent===null?"Not provided":fmt(certified.valuePercent)+"%","source record",certified?.valuePercent===null?"warning":"success"]
  ]);
  const warning=!sourceProgressEstablished?'<div class="notice warn"><b>The programme contains a percentage-complete snapshot, but certified/contractor physical progress is not established.</b> CMeng keeps the schedule snapshot separate from certified or independently sourced physical progress.</div>':'';
  const status=planningStatusBand([
    ["Completed",p.progress?.completedCount||0,"success"],
    ["In progress",p.progress?.inProgressCount||0,"accent"],
    ["Not started",p.progress?.notStartedCount||0,"neutral"],
    ["Unknown",p.progress?.unknownStatusCount||0,"warning"]
  ]);
  const pressure=planningStatusBand([
    ["Critical",p.schedule?.criticalCount||0,"danger"],
    ["Near-critical",p.schedule?.nearCriticalCount||0,"warning"],
    ["Negative float",p.schedule?.negativeFloatCount||0,"danger-soft"]
  ]);
  const progressChart=renderVisualBars([
    {label:"Baseline planned",value:typeof baseline?.valuePercent==="number"?baseline.valuePercent:null,tone:"graphite"},
    {label:"Current programme plan",value:typeof current?.valuePercent==="number"?current.valuePercent:null,tone:"accent"},
    {label:physicalLabel,value:typeof physical?.valuePercent==="number"?physical.valuePercent:null,tone:"teal"},
    {label:"Contractor reported",value:typeof contractor?.valuePercent==="number"?contractor.valuePercent:null,tone:"warning"},
    {label:"Certified progress",value:typeof certified?.valuePercent==="number"?certified.valuePercent:null,tone:"success"}
  ].filter(item=>item.value!==null),"%");
  const visualOverview='<div class="visual-chart-grid">'+
    renderVisualPanel("Progress basis comparison","Five progress positions remain visually separate so schedule progress cannot be mistaken for certified progress.",progressChart)+
    renderVisualPanel("Activity status","Current programme execution status.",renderDonutChart([
      {label:"Completed",value:p.progress?.completedCount||0,tone:"success"},
      {label:"In progress",value:p.progress?.inProgressCount||0,tone:"accent"},
      {label:"Not started",value:p.progress?.notStartedCount||0,tone:"neutral"},
      {label:"Unknown",value:p.progress?.unknownStatusCount||0,tone:"warning"}
    ],"Activities"))+
  '</div>';
  return '<section class="planning-view progress-position-view">'+kpis+warning+visualOverview+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Progress bases</h4><p>Baseline plan, current re-phased plan, activity percentage-complete snapshot, contractor-reported and certified values remain separate.</p></div></div><div class="planning-panel-body">'+progressBasisBars(p.progressBases)+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>Current programme population.</p></div></div><div class="planning-panel-body">'+status+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure</h4><p>Float classifications are schedule indicators, not progress evidence.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Near-term delivery</h4><p>Milestones and look-ahead indicators tied to the current data date.</p></div></div><div class="planning-panel-body">'+planningKpis([
    ["Milestones",p.milestones?.milestoneCount,"total"],
    ["Open milestones",p.milestones?.openCount,"open"],
    ["Overdue milestones",p.milestones?.lateOpenCount,"past data date",p.milestones?.lateOpenCount?"danger":""],
    ["Look-ahead incomplete",p.lookAhead?.incompleteActivityCount,p.lookAhead?.windowDays+" day horizon"],
    ["Look-ahead overdue",p.lookAhead?.overdueCount,"activities",p.lookAhead?.overdueCount?"danger":""],
    ["Date coverage",p.lookAhead?.currentDateCoveragePercent===null?"—":fmt(p.lookAhead?.currentDateCoveragePercent)+"%","look-ahead"]
  ])+'</div></section></section>';
}
function renderScheduleChangeVisual(data){
  const p=projectionFor(data,"schedule_change_report");
  if(!Array.isArray(p.changedActivities))return"";
  const comparisonRibbon='<div class="comparison-ribbon"><div><span>From</span><b>'+escapeHtml(planningRevisionLabel(p.fromRevisionLabel||p.fromRevisionId))+'</b></div><i>→</i><div><span>To</span><b>'+escapeHtml(planningRevisionLabel(p.toRevisionLabel||p.toRevisionId))+'</b></div></div>';
  const kpis=planningKpis([
    ["Activities compared",p.matchedActivityCount,"matched between revisions"],
    ["Population match",p.populationMatchPercent===null?"—":fmt(p.populationMatchPercent)+"%","comparison coverage"],
    ["Added",p.addedActivityCount,"activities","accent"],
    ["Removed",p.removedActivityCount,"activities","neutral"],
    ["Modified",p.modifiedActivityCount,"activities","warning"],
    ["Logic changes",(p.addedRelationshipCount||0)+(p.removedRelationshipCount||0),"relationships","warning"]
  ]);
  const composition=planningStatusBand([
    ["Added",p.addedActivityCount,"accent"],["Removed",p.removedActivityCount,"neutral"],["Modified",p.modifiedActivityCount,"warning"],["Unchanged",p.unchangedActivityCount,"success"]
  ]);
  const movements=[...p.changedActivities].filter(a=>typeof a.finishShiftDays==="number"&&a.finishShiftDays!==0).sort((a,b)=>Math.abs(b.finishShiftDays)-Math.abs(a.finishShiftDays)).slice(0,15).map(a=>({label:a.activityId,value:a.finishShiftDays}));
  const floatMoves=[...p.changedActivities].filter(a=>typeof a.floatShiftHours==="number"&&a.floatShiftHours!==0).sort((a,b)=>Math.abs(b.floatShiftHours)-Math.abs(a.floatShiftHours)).slice(0,15).map(a=>({label:a.activityId,value:-a.floatShiftHours}));
  const detail=[...p.changedActivities].sort((a,b)=>Math.abs(b.finishShiftDays||0)-Math.abs(a.finishShiftDays||0)).slice(0,250);
  const rows=detail.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b></td><td>'+escapeHtml(planningStateLabel(a.changeKind))+'</td><td class="'+((a.finishShiftDays||0)>0?"late-text":(a.finishShiftDays||0)<0?"early-text":"")+'">'+escapeHtml(a.finishShiftDays===null?"—":((a.finishShiftDays>0?"+":"")+fmt(a.finishShiftDays)))+'</td><td>'+escapeHtml(fmt(a.floatShiftHours))+'</td><td>'+escapeHtml(fmt(a.progressShiftPercent))+'</td><td>'+escapeHtml((a.fieldChanges||[]).length)+'</td></tr>').join("");
  return '<section class="planning-view changes-view">'+comparisonRibbon+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>What changed</h4><p>Activity changes between the two controlled programme revisions.</p></div></div><div class="planning-panel-body">'+composition+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic changes</h4><p>Relationships added or removed between the revisions.</p></div></div><div class="planning-panel-body">'+planningKpis([["Added links",p.addedRelationshipCount,"relationships","accent"],["Removed links",p.removedRelationshipCount,"relationships","warning"]])+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest finish movements</h4><p>Left means earlier. Right means later.</p></div></div><div class="planning-panel-body">'+planningSignedBars(movements,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest float deterioration</h4><p>Bars to the right indicate the largest loss of float.</p></div></div><div class="planning-panel-body">'+planningSignedBars(floatMoves,"hours lost")+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Changed activity detail</h4><p>Largest finish movements first. Showing '+escapeHtml(fmt(detail.length))+' changed activities.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Change</th><th>Finish shift d</th><th>Float shift h</th><th>Progress shift pp</th><th>Fields changed</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderRevisionTrendVisual(data){
  const p=projectionFor(data,"revision_trend");
  if(!Array.isArray(p.points))return"";
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||planningRevisionLabel(x.label)||("Revision "+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const kpis=planningKpis([
    ["Revisions",p.revisionCount,"controlled programmes"],
    ["Latest progress",latest.durationWeightedProgressPercent===null||latest.durationWeightedProgressPercent===undefined?"—":fmt(latest.durationWeightedProgressPercent)+"%","weighted"],
    ["Latest critical",latest.criticalCount,"activities","danger"],
    ["Latest near-critical",latest.nearCriticalCount,"activities","warning"],
    ["Latest negative float",latest.negativeFloatCount,"activities","danger"],
    ["Latest forecast finish",planningShortDate(latest.forecastCompletionIso),"date"]
  ]);
  const values=planningRevisionValues(p.points);
  const progress=renderLineChart(points,[{key:"durationWeightedProgressPercent",label:"Weighted progress %",color:"#4f7fb4"}],100);
  const completion=planningDateTrend(points,[
    {key:"programmeCompletionIso",label:"Programme finish",color:"#506579"},
    {key:"forecastCompletionIso",label:"Forecast finish",color:"#4f7fb4"}
  ]);
  const pressure=renderLineChart(points,[
    {key:"criticalCount",label:"Critical",color:"#b4483e"},
    {key:"nearCriticalCount",label:"Near-critical",color:"#b57922"},
    {key:"negativeFloatCount",label:"Negative float",color:"#7a4b46"}
  ]);
  const changeBars=planningStatusBand([
    ["Added",latest.addedVsPrevious||0,"accent"],["Removed",latest.removedVsPrevious||0,"neutral"],["Modified",latest.modifiedVsPrevious||0,"warning"]
  ]);
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(planningRevisionLabel(x.label)||("Revision "+x.sequence))+'</b><br><span class="muted">'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></td><td>'+escapeHtml(x.durationWeightedProgressPercent===null?"—":fmt(x.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(x.activityCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.nearCriticalCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(planningShortDate(x.forecastCompletionIso))+'</td><td>'+escapeHtml(fmt((x.addedVsPrevious||0)+(x.removedVsPrevious||0)+(x.modifiedVsPrevious||0)))+'</td></tr>').join("");
  return '<section class="planning-view revision-view">'+kpis+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Exact values are shown here so the trend charts do not require guessing from a line.</p></div></div><div class="planning-panel-body">'+values+'</div></section><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish-date movement</h4><p>How the programme and forecast finish dates have moved across revisions.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Progress evolution</h4><p>Weighted schedule progress by revision.</p></div></div><div class="planning-panel-body">'+progress+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure trend</h4><p>Critical, near-critical and negative-float activity counts by revision.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Latest revision change volume</h4><p>Activity additions, removals and modifications in the latest revision.</p></div></div><div class="planning-panel-body">'+changeBars+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision history</h4><p>Controlled programme revisions in chronological order.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Progress</th><th>Activities</th><th>Critical</th><th>Near-critical</th><th>Negative float</th><th>Forecast finish</th><th>Change volume</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderVarianceTrendVisual(data){
  const p=projectionFor(data,"variance_trends");
  if(!Array.isArray(p.points))return"";
  const labels=p.revisionLabels||{};
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||("R"+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const averageMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.averageFinishVarianceDays==="number"?x.averageFinishVarianceDays:null})),"days");
  const projectMovement=planningSignedBars(p.points.map(x=>({label:shortRevision(x.revisionId,labels),value:typeof x.projectCompletionVarianceDays==="number"?x.projectCompletionVarianceDays:null})),"days");
  const pressure=renderLineChart(points,[
    {key:"negativeFloatCount",label:"Negative float",color:"#b4483e"},
    {key:"criticalCount",label:"Critical",color:"#7a4b46"}
  ]);
  const cards=p.points.map(x=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b><span>'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Average vs baseline <b>'+escapeHtml(x.averageFinishVarianceDays===null?"—":fmt(x.averageFinishVarianceDays)+" d")+'</b></span><span>Maximum delay <b>'+escapeHtml(x.maximumDelayDays===null?"—":fmt(x.maximumDelayDays)+" d")+'</b></span><span>Late activities <b>'+escapeHtml(fmt(x.lateActivityCount))+'</b></span><span>Project finish vs baseline <b>'+escapeHtml(x.projectCompletionVarianceDays===null?"—":fmt(x.projectCompletionVarianceDays)+" d")+'</b></span></div></div>').join("");
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(shortRevision(x.revisionId,labels))+'</b></td><td>'+escapeHtml(planningShortDate(x.dataDateIso))+'</td><td>'+escapeHtml(x.averageFinishVarianceDays===null?"—":fmt(x.averageFinishVarianceDays))+'</td><td>'+escapeHtml(x.maximumDelayDays===null?"—":fmt(x.maximumDelayDays))+'</td><td>'+escapeHtml(x.lateActivityCount)+'</td><td>'+escapeHtml(x.earlyActivityCount)+'</td><td>'+escapeHtml(x.onTimeActivityCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.projectCompletionVarianceDays===null?"—":fmt(x.projectCompletionVarianceDays))+'</td></tr>').join("");
  return '<section class="planning-view variance-view">'+planningKpis([
    ["Revisions",p.revisionCount,"controlled"],
    ["Latest avg movement",latest.averageFinishVarianceDays===null?"—":fmt(latest.averageFinishVarianceDays)+" d","vs controlled baseline",latest.averageFinishVarianceDays>0?"warning":""],
    ["Latest max delay",latest.maximumDelayDays===null?"—":fmt(latest.maximumDelayDays)+" d","activity level",latest.maximumDelayDays>0?"danger":""],
    ["Late activities",latest.lateActivityCount,"vs controlled baseline",latest.lateActivityCount?"danger":""],
    ["Project finish movement",latest.projectCompletionVarianceDays===null?"—":fmt(latest.projectCompletionVarianceDays)+" d","vs controlled baseline",latest.projectCompletionVarianceDays>0?"danger":""]
  ])+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision values</h4><p>Exact controlled-baseline movements, so zero is only shown when the values are actually equal.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div></div></section><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Finish movement by revision</h4><p>Signed movement from the controlled baseline. Left means earlier, right means later.</p></div></div><div class="planning-panel-body"><div class="nested-title">Average activity finish movement</div>'+averageMovement+'<div class="nested-title" style="margin-top:16px">Project finish movement</div>'+projectMovement+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float pressure trend</h4><p>Negative-float and critical populations by revision.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Avg vs baseline d</th><th>Max delay d</th><th>Late</th><th>Early</th><th>On time</th><th>Neg. float</th><th>Critical</th><th>Project finish vs baseline d</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderProgressBreakdownVisual(data){
  const p=projectionFor(data,"progress_breakdown");
  if(!Array.isArray(p.rows))return"";
  const ranked=[...p.rows].sort((a,b)=>(b.activityCount||0)-(a.activityCount||0)).slice(0,15);
  const progressBars=ranked.map(r=>({label:(r.wbsName||r.wbsId),value:typeof r.durationWeightedProgressPercent==="number"?r.durationWeightedProgressPercent:null,tone:(r.negativeFloatCount||0)>0?"warning":"accent"})).filter(r=>r.value!==null);
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.wbsId)+'</b><br><span class="muted">'+escapeHtml(r.wbsName||"")+'</span></td><td>'+escapeHtml(r.activityCount)+'</td><td>'+escapeHtml(r.completedCount)+'</td><td>'+escapeHtml(r.inProgressCount)+'</td><td>'+escapeHtml(r.notStartedCount)+'</td><td>'+escapeHtml(r.durationWeightedProgressPercent===null?"—":fmt(r.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(r.durationWeightedCoveragePercent===null?"—":fmt(r.durationWeightedCoveragePercent)+"%")+'</td><td>'+escapeHtml(r.criticalCount)+'</td><td>'+escapeHtml(r.nearCriticalCount)+'</td><td>'+escapeHtml(r.negativeFloatCount)+'</td></tr>').join("");
  return '<section class="planning-view wbs-view">'+planningKpis([
    ["Activities",p.totalActivityCount,"current programme"],
    ["WBS groups",p.rows.length,"groups"]
  ])+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>WBS progress</h4><p>Largest WBS groups by activity population. Bars show duration-weighted progress.</p></div></div><div class="planning-panel-body">'+moduleBarList(progressBars,"accent","%")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure by WBS</h4><p>Highest negative-float populations.</p></div></div><div class="planning-panel-body">'+moduleBarList([...p.rows].sort((a,b)=>(b.negativeFloatCount||0)-(a.negativeFloatCount||0)).slice(0,12).map(r=>({label:r.wbsName||r.wbsId,value:r.negativeFloatCount||0,tone:"danger"})))+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>WBS detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>WBS</th><th>Activities</th><th>Complete</th><th>In progress</th><th>Not started</th><th>Weighted progress</th><th>Coverage</th><th>Critical</th><th>Near-critical</th><th>Neg. float</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderMilestonesVisual(data){
  const p=projectionFor(data,"milestones");
  if(!Array.isArray(p.rows))return"";
  const dd=planningDateMs(p.dataDateIso);
  const due30=p.due30Count??p.rows.filter(r=>r.status!=="completed"&&planningDateMs(r.currentDateIso)!==null&&dd!==null&&planningDateMs(r.currentDateIso)>=dd&&planningDateMs(r.currentDateIso)<=dd+30*86400000).length;
  const slippedOpen=p.rows.filter(r=>r.status!=="completed"&&typeof r.varianceDays==="number"&&r.varianceDays>0).length;
  const criticalCount=p.criticalMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&typeof r.totalFloatHours==="number"&&r.totalFloatHours<=0).length;
  const nearCriticalCount=p.nearCriticalMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&typeof r.totalFloatHours==="number"&&r.totalFloatHours>0&&r.totalFloatHours<=40).length;
  const negativeFloatCount=p.negativeFloatMilestoneCount??p.rows.filter(r=>r.status!=="completed"&&typeof r.totalFloatHours==="number"&&r.totalFloatHours<0).length;
  const largest=Math.max(0,...p.rows.map(r=>typeof r.varianceDays==="number"?r.varianceDays:0));
  const urgentDates=(p.lateOpenCount||0)+due30;
  const priorityRows=[...p.rows].filter(r=>r.status!=="completed").sort((a,b)=>planningMilestonePriorityRank(a.managementPriority)-planningMilestonePriorityRank(b.managementPriority)||((a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER))||((b.varianceDays||0)-(a.varianceDays||0)));
  const topPriority=priorityRows[0]||null;
  const kpis=planningKpis([
    ["Open milestones",p.openCount,"of "+fmt(p.milestoneCount)+" total"],
    ["Critical path",criticalCount,"open milestones · submitted float",criticalCount?"danger":""],
    ["Negative float",negativeFloatCount,"open milestones",negativeFloatCount?"danger":""],
    ["Near-critical",nearCriticalCount,"open milestones",nearCriticalCount?"warning":""],
    ["Urgent dates",urgentDates,(p.lateOpenCount||0)+" overdue · "+due30+" due ≤30d",urgentDates?"warning":""],
    ["Largest movement",largest?fmt(largest)+" days":"—","vs controlled baseline",largest?"danger":""]
  ]);
  const basisState=p.criticalPathState==="source_float_established"
    ?"Float coverage complete for milestone population"
    : p.criticalPathState==="source_float_partial"
      ?"Float coverage is partial; milestones without float are not silently treated as non-critical"
      :"Critical-path status is not established because milestone float is unavailable";
  const basis='<div class="milestone-basis-note"><span><b>Critical-path basis:</b> current submitted programme total float. Critical ≤ '+escapeHtml(fmt(p.criticalFloatThresholdHours??0))+' h; near-critical > '+escapeHtml(fmt(p.criticalFloatThresholdHours??0))+' h to '+escapeHtml(fmt(p.nearCriticalFloatThresholdHours??40))+' h.</span><span><b>'+escapeHtml(basisState)+'</b>'+(p.floatCoveragePercent===null||p.floatCoveragePercent===undefined?'':' · '+escapeHtml(fmt(p.floatCoveragePercent))+'% coverage')+'</span></div>';
  const attention=planningAttention([
    negativeFloatCount?{title:"Negative-float milestones require immediate recovery",text:"These milestones have already consumed available float on the submitted programme.",value:negativeFloatCount,tone:"danger"}:null,
    criticalCount?{title:"Critical-path milestones need protection",text:"Any further delay to these open milestones can move programme completion or another critical commitment.",value:criticalCount,tone:"danger"}:null,
    p.lateOpenCount?{title:"Overdue milestone commitments",text:"Current milestone dates are before the data date and need status/recovery confirmation.",value:p.lateOpenCount,tone:"danger"}:null,
    due30?{title:"Milestones due within 30 days",text:"Confirm predecessor completion, approvals, access, materials and responsible owner now.",value:due30,tone:"watch"}:null,
    nearCriticalCount?{title:"Near-critical milestones",text:"These milestones retain limited float and should be protected before they become critical.",value:nearCriticalCount,tone:"watch"}:null,
    slippedOpen?{title:"Open milestones later than baseline",text:"Current milestone commitments are later than the controlled baseline.",value:slippedOpen,tone:"watch"}:null,
    topPriority?{title:"Highest-priority milestone",text:topPriority.activityId+" · "+(topPriority.name||"")+" · "+planningShortDate(topPriority.currentDateIso),value:topPriority.managementPriority?humanizeKey(topPriority.managementPriority):undefined,tone:topPriority.managementPriority==="critical"?"danger":"watch"}:null
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
      '<td>'+escapeHtml(floatText)+'</td>'+
      '<td>'+flags+'</td>'+
      '<td>'+escapeHtml(r.managementAction||"Monitor against the current programme and controlled baseline.")+'</td>'+
    '</tr>';
  }).join("");
  return '<section class="planning-view milestone-view">'+kpis+basis+
    '<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Milestone movement & criticality</h4><p>Professional milestone control chart with a true calendar axis, controlled-baseline movement, current forecast, float, due position and criticality.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section>'+
    '<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Critical path & key milestone watchlist</h4><p>Open milestones are ranked by criticality, negative float, date urgency and baseline movement so management sees what requires action first.</p></div></div><div class="planning-panel-body">'+priorityBoard+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management alerts</h4><p>Exceptions requiring intervention or protection.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div>'+
    '<div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone status</h4><p>Completed, open and overdue commitments.</p></div></div><div class="planning-panel-body">'+statusBand+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Management priority</h4><p>Open milestones grouped by required level of attention.</p></div></div><div class="planning-panel-body">'+priorityBand+'</div></section></div>'+
    '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone control register</h4><p>Criticality, status, due position, baseline movement, float, flags and required management action for each milestone.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Priority</th><th>Milestone / WBS</th><th>Status</th><th>Criticality</th><th>Baseline</th><th>Current / actual</th><th>Vs baseline d</th><th>Total float h</th><th>Flags</th><th>Required attention</th></tr></thead><tbody>'+detail+'</tbody></table></div></div></section></section>';
}
function renderNearCriticalVisual(data){
  const p=projectionFor(data,"near_critical");
  if(!Array.isArray(p.rows))return"";
  const strictRows=p.rows||[];
  const riskRows=Array.isArray(p.watchlistRows)?p.watchlistRows:strictRows;
  const inProgress=riskRows.filter(r=>r.status==="in_progress").length;
  const notStarted=riskRows.filter(r=>r.status==="not_started").length;
  const slipped=riskRows.filter(r=>planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)>0).length;
  const workingDays=p.nearCriticalThresholdWorkingDays??p.nearCriticalWorkingDays??null;
  const calendarBasis=p.thresholdBasis==="activity_calendar_working_days"||p.nearCriticalThresholdBasis==="activity_working_days";
  const limitValue=calendarBasis&&workingDays!==null?fmt(workingDays)+" working days":p.nearCriticalThresholdHours===null||p.nearCriticalThresholdHours===undefined?"Not established":fmt(p.nearCriticalThresholdHours)+" h";
  const limitSub=calendarBasis?"each activity calendar":"explicit hour threshold";
  const unresolved=p.thresholdUnresolvedActivityCount??Math.max(0,riskRows.filter(r=>r.nearCriticalThresholdHours===null).length);
  const sourceCount=p.sourceReportedNearCriticalLabelCount??p.reconciliation?.sourceReportedCount??null;
  const sourceMatch=p.reconciliation?.sourceLabelReconcilesTo??null;
  const reconciliationText=sourceCount===null
    ?"No submitted Near Critical population is available for reconciliation."
    : sourceMatch==="float_risk_watchlist"
      ?"The submitted label “Near Critical” reconciles to CMeng's Float-Risk Watchlist, not to strict Near-Critical."
      : sourceMatch==="strict_near_critical"
        ?"The submitted label “Near Critical” reconciles to CMeng's strict Near-Critical classification."
        :"The submitted population does not reconcile to either CMeng classification and remains a visible gap.";

  const kpis=planningKpis([
    ["Near-critical",p.nearCriticalCount,"0 < TF ≤ "+limitValue,"warning"],
    ["Float-risk watchlist",p.floatRiskWatchlistCount,"0 ≤ TF ≤ "+limitValue,"accent"],
    ["Zero float",p.zeroFloatCount??"—","critical boundary","danger"],
    ["Negative float",p.negativeFloatCount??"—","TF < 0","danger"],
    ["Source reported",sourceCount===null?"—":sourceCount,p.sourceReportedLabel||"Near Critical"],
    ["Float coverage",p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%","current programme"],
    ["Classification coverage",p.classificationCoveragePercent===null||p.classificationCoveragePercent===undefined?"—":fmt(p.classificationCoveragePercent)+"%","calendar-aware",unresolved?"warning":""]
  ]);

  const maxThreshold=Math.max(1,...riskRows.map(r=>typeof r.nearCriticalThresholdHours==="number"?r.nearCriticalThresholdHours:0));
  const histogram=planningFloatHistogram(riskRows,maxThreshold);
  const finishPeriods=planningFinishPeriodBars(riskRows);
  const watch=[...riskRows].map(r=>({...r,varianceDays:planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)})).sort((a,b)=>a.totalFloatHours-b.totalFloatHours||((b.varianceDays||0)-(a.varianceDays||0))).slice(0,150);
  const criticalThreshold=p.criticalThresholdHours??0;
  const rows=watch.map(r=>{
    const classLabel=r.totalFloatHours===criticalThreshold?"Zero-float boundary":"Near-critical";
    return '<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(classLabel)+'</td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(r.nearCriticalThresholdHours===null||r.nearCriticalThresholdHours===undefined?"—":fmt(r.nearCriticalThresholdHours))+'</td><td>'+escapeHtml(r.calendarId||"—")+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)))+'</td><td>'+escapeHtml(r.percentComplete===null?"—":fmt(r.percentComplete)+"%")+'</td></tr>';
  }).join("");
  const basis='<div class="notice info"><b>CMeng schedule taxonomy:</b> Critical = TF ≤ '+escapeHtml(fmt(criticalThreshold))+' h; Near-Critical = TF > '+escapeHtml(fmt(criticalThreshold))+' h and ≤ '+escapeHtml(limitValue)+'; Float-Risk Watchlist also includes the zero-float boundary. Working-day limits use each activity\'s own programme calendar.</div>';
  const reconciliation='<div class="notice '+(sourceMatch==="float_risk_watchlist"||sourceMatch==="strict_near_critical"?"good":"warn")+'"><b>Submitted vs independent:</b> '+escapeHtml(reconciliationText)+'</div>';
  return '<section class="planning-view nearcritical-view">'+kpis+basis+reconciliation+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Float-risk distribution</h4><p>Submitted total float is assessed independently against CMeng/project-control taxonomy using each activity calendar.</p></div></div><div class="planning-panel-body">'+histogram+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Where float-risk work finishes</h4><p>Current finish-month concentration for the full float-risk watchlist.</p></div></div><div class="planning-panel-body">'+finishPeriods+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Float-Risk Watchlist</h4><p>Zero-float boundary activities and strict near-critical activities are shown together for management attention, while their taxonomy remains separate.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Risk class</th><th>Status</th><th>Total float h</th><th>Threshold h</th><th>Calendar</th><th>Baseline finish</th><th>Current finish</th><th>Vs baseline d</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderManhourVisual(data){
  const p=projectionFor(data,"manhour_scurve");
  if(!Array.isArray(p.points)){
    const scenarios=Array.isArray(p.scenarios)?p.scenarios:[];
    const scenarioTable=scenarios.length?'<div class="table-wrap"><table><thead><tr><th>Crew size</th><th>Average manpower</th><th>Peak manpower</th><th>Remaining scenario hours</th><th>Basis</th></tr></thead><tbody>'+scenarios.map(s=>'<tr><td>'+escapeHtml(fmt(s.crewSize))+'</td><td>'+escapeHtml(fmt(s.averageManpower))+'</td><td>'+escapeHtml(fmt(s.peakManpower))+'</td><td>'+escapeHtml(fmt(s.remainingScenarioHours))+'</td><td>'+escapeHtml(s.basis||"—")+'</td></tr>').join("")+'</tbody></table></div>':'';
    return '<section class="planning-view manhour-view"><div class="notice warn"><b>Measured labor-assignment history is not established.</b> Any values below are programme-derived scenarios and are not presented as actual man-hours.</div>'+scenarioTable+'</section>';
  }
  const actualEstablished=typeof p.actualHoursKnownCurrent==="number"&&Number.isFinite(p.actualHoursKnownCurrent);
  const actualHistoryEstablished=["stored_financial_period_actuals","source_approved_weekly_usage"].includes(p.actualHistoryMethod);
  const top=planningKpis([
    ["Planned labor hours",p.plannedHoursKnown===null?"—":fmt(p.plannedHoursKnown)+" h","assignment plan"],
    ["Planned coverage",p.plannedAssignmentCoveragePercent===null?"—":fmt(p.plannedAssignmentCoveragePercent)+"%","labor assignments"],
    ["Actual labor hours",p.actualHoursKnownCurrent===null?"Not provided":fmt(p.actualHoursKnownCurrent)+" h",p.actualHoursKnownCurrent===null?"missing, not zero":"current known total",p.actualHoursKnownCurrent===null?"warning":"success"],
    ["Actual coverage",p.actualAssignmentCoveragePercent===null||p.actualAssignmentCoveragePercent===undefined?"Not established":fmt(p.actualAssignmentCoveragePercent)+"%","assignment coverage if available",p.actualAssignmentCoveragePercent!==null&&p.actualAssignmentCoveragePercent!==undefined&&p.actualAssignmentCoveragePercent<100?"warning":""],
    ["Remaining labor hours",p.remainingHoursKnown===null?"—":fmt(p.remainingHoursKnown)+" h","assignment remainder"],
    ["Actual history",actualHistoryEstablished?"Financial-period history":"Not established",actualHistoryEstablished?"stored periods":"no fabricated history",actualHistoryEstablished?"success":"warning"]
  ]);
  const note=!actualEstablished
    ? '<div class="notice warn"><b>Actual man-hours are not established.</b> Planned and remaining labor hours may exist, but no current actual-hours total is evidenced. CMeng therefore withholds the actual curve.</div>'
    : !actualHistoryEstablished
      ? '<div class="notice warn"><b>Actual total is established but periodized actual history is not.</b> CMeng keeps the known total and withholds a historical actual curve instead of fabricating time phasing.</div>'
      : '';
  const series=[
    {key:"plannedCumulativeHours",label:"Planned labor hours",color:"#506579"},
    ...(actualEstablished?[{key:"actualCumulativeHours",label:"Actual labor hours",color:"#2c7a57"}]:[]),
    ...(actualEstablished?[{key:"forecastCumulativeHours",label:"Forecast labor hours",color:"#4f7fb4"}]:[])
  ];
  return '<section class="planning-view manhour-view">'+top+note+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Man-Hour S-Curve</h4><p>Labor only. Missing actual history never becomes a zero line.</p></div></div><div class="planning-panel-body">'+renderLineChart(p.points,series)+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Evidence coverage</h4><p>The curve only uses hours that are actually present in the resource assignments/financial periods.</p></div></div><div class="planning-panel-body">'+moduleEvidenceGate([
    {label:"Labor resources",value:fmt(p.laborResourceCount),state:p.laborResourceCount>0?"ready":"missing"},
    {label:"Labor assignments",value:fmt(p.laborAssignmentCount),state:p.laborAssignmentCount>0?"ready":"missing"},
    {label:"Planned hours",value:p.plannedHoursKnown===null?"Not established":fmt(p.plannedHoursKnown)+" h",state:p.plannedHoursKnown===null?"missing":"ready"},
    {label:"Actual hours",value:p.actualHoursKnownCurrent===null?"Not established":fmt(p.actualHoursKnownCurrent)+" h",state:p.actualHoursKnownCurrent===null?"missing":"ready"},
    {label:"Period actual history",value:actualHistoryEstablished?"Established":"Not established",state:actualHistoryEstablished?"ready":"missing"}
  ])+'</div></section></section>';
}

function managementReason(value){
  const labels={
    CONTRACT_TIME_BASIS_NOT_SUBMITTED:"Contract time basis not established",
    CONTRACT_TIME_BASIS_NOT_ESTABLISHED:"Contract finish and EOT day basis are not established",
    CAUSAL_DELAY_EVENT_BASIS_NOT_ESTABLISHED:"Causal delay-event basis not established",
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
    {key:"independentForecastCompletionIso",label:"Independent forecast finish",color:"#4f7fb4"}
  ]);
  const cards=p.points.map(x=>'<div class="revision-value-card"><div class="revision-value-head"><b>'+escapeHtml(shortRevision(x.sourceRevisionId,labels))+'</b><span>'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></div><div class="revision-value-lines"><span>Submitted finish <b>'+escapeHtml(planningShortDate(x.sourceForecastCompletionIso))+'</b></span><span>Independent finish <b>'+escapeHtml(planningShortDate(x.independentForecastCompletionIso))+'</b></span><span>Independent move vs prior <b>'+escapeHtml(x.movementDaysVsPrevious===null?"—":fmt(x.movementDaysVsPrevious)+" d")+'</b></span></div></div>').join("");
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(planningShortDate(x.dataDateIso))+'</td><td><b>'+escapeHtml(shortRevision(x.sourceRevisionId,labels))+'</b></td><td>'+escapeHtml(planningShortDate(x.sourceForecastCompletionIso))+'</td><td>'+escapeHtml(planningShortDate(x.independentForecastCompletionIso))+'</td><td>'+escapeHtml(x.movementDaysVsPrevious===null?"—":fmt(x.movementDaysVsPrevious))+'</td><td>'+escapeHtml(x.movementDaysVsFirst===null?"—":fmt(x.movementDaysVsFirst))+'</td><td>'+escapeHtml(x.independentForecastCompletionIso?humanizeKey(x.origin):"Not calculated in history view")+'</td></tr>').join("");
  const note=independentCount===0?'<div class="notice info"><b>Source forecast history is available.</b> Independent CPM is not recalculated across every historical revision just to open this view. Open Independent Forecast for a governed current-revision calculation.</div>':'';
  return '<section class="planning-view forecast-history-view">'+planningKpis([
    ["Revisions",p.snapshotCount,"controlled"],
    ["Source forecasts",sourceCount,"established"],
    ["Independent forecasts",independentCount,"calculated snapshots",independentCount?"accent":"warning"]
  ])+note+'<section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast values by revision</h4><p>Exact dates first; source and independent forecasts remain separate.</p></div></div><div class="planning-panel-body"><div class="revision-value-grid">'+cards+'</div></div></section><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Forecast movement</h4><p>Later vertical position means a later finish date.</p></div></div><div class="planning-panel-body">'+trend+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Forecast history detail</h4></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Data date</th><th>Revision</th><th>Submitted finish</th><th>Independent finish</th><th>Move vs previous d</th><th>Move vs first d</th><th>Basis</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderNoticesClaimsVisual(data){
  const p=projectionFor(data,"notices_claims");
  if(!Array.isArray(p.events)||!Array.isArray(p.claims))return"";
  const assessable=p.noticeAssessmentState==="assessed";
  const kpis=planningKpis([
    ["Claims",p.claimCount,"records"],
    ["Delay events",p.eventCount,"notice assessment basis",p.eventCount?"":"warning"],
    ["Timely notices",assessable?p.timelyNoticeCount:"Not assessed",assessable?"events":"event + requirement needed"],
    ["Late notices",assessable?p.lateNoticeCount:"Not assessed",assessable?"events":"event + requirement needed"],
    ["Missing notices",assessable?p.missingNoticeCount:"Not assessed",assessable?"events":"event + requirement needed"],
    ["Requirements missing",assessable?p.noticeRequirementMissingCount:"Not assessed",assessable?"events":"governed requirement needed"]
  ]);
  const warning=!assessable?'<div class="notice warn"><b>Notice performance is not zero; it is not assessable.</b> A claim row or notice date by itself does not prove notice compliance. CMeng needs a governed delay event and the applicable contractual notice requirement before classifying notice as timely, late or missing.</div>':'';
  const noticeBand=assessable?planningStatusBand([
    ["Timely",p.timelyNoticeCount,"success"],
    ["Late",p.lateNoticeCount,"danger"],
    ["Missing",p.missingNoticeCount,"warning"],
    ["Requirement missing",p.noticeRequirementMissingCount,"neutral"]
  ]):'<div class="empty-visual">Notice timeliness cannot be assessed until governed delay events and applicable notice requirements are linked.</div>';
  const claimStateItems=claimStateCounts(p.claims).map(item=>({label:item.label,value:item.value,tone:"accent"}));
  const claimBars=renderDonutChart(claimStateItems,"Claims");
  const noticeVisual=assessable?renderDonutChart([
    {label:"Timely",value:p.timelyNoticeCount||0,tone:"success"},
    {label:"Late",value:p.lateNoticeCount||0,tone:"danger"},
    {label:"Missing",value:p.missingNoticeCount||0,tone:"warning"},
    {label:"Requirement missing",value:p.noticeRequirementMissingCount||0,tone:"neutral"}
  ],"Events"):'<div class="empty-visual">Notice timeliness is not assessable from the governed evidence.</div>';
  const events=p.events.length?'<div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Start</th><th>Notice</th><th>Required days</th><th>Elapsed days</th><th>Timeliness</th><th>Claims</th></tr></thead><tbody>'+
    p.events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(humanizeKey(e.responsibility))+'</td><td>'+escapeHtml(planningShortDate(e.eventStartIso))+'</td><td>'+escapeHtml(planningShortDate(e.noticeIssuedAt))+'</td><td>'+escapeHtml(fmt(e.requiredNoticeDays))+'</td><td>'+escapeHtml(fmt(e.elapsedNoticeDays))+'</td><td>'+escapeHtml(humanizeKey(e.noticeTimeliness))+'</td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty-visual">No governed delay events are available for notice assessment.</div>';
  const claims='<div class="table-wrap"><table><thead><tr><th>Claim</th><th>State</th><th>Submitted</th><th>Claimed days</th><th>Assessed days</th><th>Days authority</th><th>Claimed amount</th><th>Assessed amount</th><th>Amount authority</th></tr></thead><tbody>'+
    p.claims.map(c=>'<tr><td><b>'+escapeHtml(c.claimId)+'</b><br><span class="muted">'+escapeHtml(c.title||"")+'</span></td><td>'+escapeHtml(humanizeKey(c.state))+'</td><td>'+escapeHtml(planningShortDate(c.submittedAt))+'</td><td>'+escapeHtml(fmt(c.claimedDays))+'</td><td>'+escapeHtml(fmt(c.assessedDays))+'</td><td>'+escapeHtml(humanizeKey(c.assessedDaysState))+'</td><td>'+escapeHtml(fmt(c.claimedAmount))+'</td><td>'+escapeHtml(fmt(c.assessedAmount))+'</td><td>'+escapeHtml(humanizeKey(c.assessedAmountState))+'</td></tr>').join("")+'</tbody></table></div>';
  return '<section class="planning-view notices-view">'+kpis+warning+'<div class="visual-chart-grid">'+renderVisualPanel("Notice compliance","Timeliness distribution is only shown where the contractual requirement and event basis are governed.",noticeVisual)+renderVisualPanel("Claim states","Claim status is independent from notice timeliness and assessment authority.",claimBars)+'</div><div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Notice assessment</h4><p>Timeliness is calculated only where an event and applicable contractual notice requirement exist.</p></div></div><div class="planning-panel-body">'+noticeBand+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Claim state detail</h4><p>Counts remain visible below the visual distribution.</p></div></div><div class="planning-panel-body">'+planningStatusBand(claimStateCounts(p.claims).map(item=>[item.label,item.value,"accent"]))+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Notice compliance by event</h4></div></div><div class="planning-panel-body">'+events+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Claim records</h4></div></div><div class="planning-panel-body">'+claims+'</div></section></section>';
}
function commercialMetricHtml(metric,currency=""){
  if(!metric)return'<span class="muted">Not established</span>';
  const state=humanizeKey(metric.state||"not_submitted");
  const value=metric.value===null||metric.value===undefined
    ? "Not established"
    : (typeof metric.value==="number"?fmt(metric.value)+(currency?" "+currency:""):planningShortDate(metric.value));
  return '<b>'+escapeHtml(value)+'</b><br><span class="muted">'+escapeHtml(state)+'</span>';
}
function renderCommercialLedgerVisual(data){
  const p=projectionFor(data,"commercial_canonical"), rows=Array.isArray(p.rows)?p.rows:[], key=p.moduleKey;
  const num=v=>v===null||v===undefined?"Not established":new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(v);
  const amount=a=>a?'<b>'+escapeHtml(num(a.value))+'</b>'+(a.value===null?"":' <small>'+escapeHtml(a.currency||"Currency unresolved")+'</small>'):"Not established";
  const period=d=>escapeHtml(planningShortDate(d))+(d&&p.dataDateIso&&d>p.dataDateIso?'<br><span class="state-pill review">After Data Date</span>':"");
  const table=(heads,body)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+body.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  const evidence=list=>'<details><summary>Source evidence ('+(list||[]).length+')</summary>'+table(["Document","Location","Revision / hash","Basis"],(list||[]).map(r=>[escapeHtml(r.documentId),escapeHtml(r.locator),escapeHtml(r.revision||r.sourceHash),escapeHtml(r.basisState)]))+'</details>';
  const panel=(title,description,body)=>'<section class="planning-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';
  let content="";
  if(key==="commercial-cost-position"){
    content=rows.map(r=>{
      const v=r.values||{}, money=k=>v[k]==null?"Not established":num(v[k])+" "+r.currency;
      const metrics=planningKpis([["Control budget / BAC",money("bac"),"source control budget"],["Source EAC",money("eac"),"source forecast, not CPI scenario"],["Variance at completion",money("calculated vac"),"BAC minus source EAC",v["calculated vac"]<0?"danger":""],["SPI",num(v.spi),"EV / PV"],["CPI",num(v.cpi),"EV / AC"],["CPI scenario EAC",money("cpi scenario eac"),"separate scenario; BAC / CPI"]]);
      const bars=moduleBarList([["PV · planned value","pv"],["EV · earned value","ev"],["AC · actual cost","ac"]].map(([label,k])=>({label,value:v[k]})),"accent",r.currency);
      const changes=planningSignedBars([["Schedule variance","calculated sv"],["Cost variance","calculated cv"],["Variance at completion","calculated vac"]].map(([label,k])=>({label,value:v[k]})),r.currency);
      return panel(r.currency+" · "+planningShortDate(r.asOf),"Tax basis: "+r.taxBasis+". Values from this reporting period only.",metrics+'<div class="planning-primary-grid">'+panel("Earned value position","Comparable values in one currency and tax basis.",bars)+panel("Variance position","Negative values are adverse; missing values are not zero.",changes)+'</div>'+table(["Original contract","Approved variations","Current contract","Remaining cost / ETC"],[[money("original contract value"),money("approved variations"),money("current contract value"),money("etc")]])+(r.diagnostics?.length?'<div class="notice warn">'+escapeHtml(r.diagnostics.map(humanizeKey).join("; "))+'</div>':"")+evidence(r.receipts));
    }).join("");
  } else if(key==="commercial-cost-register"){
    content=panel("Cost evidence register","Source values retain their reporting period, tax basis, approval description and provenance.",table(["Metric","Value","As of","Tax basis","Source status","CBS / WBS","Evidence"],rows.map(r=>[escapeHtml(r.metric),amount(r.amount),period(r.amount.asOf),escapeHtml(r.amount.taxBasis),escapeHtml(r.sourceStatus||"Not established"),escapeHtml([r.cbsId,r.wbsId].filter(Boolean).join(" / ")||"Not allocated"),evidence(r.amount.receipts)])));
  } else if(key==="commercial-payment-register"){
    content=planningKpis([["Certificate records",rows.length,"full source register"],["On / before Data Date",p.summary?.effectiveRecordCount,"dated certificate periods"],["Recorded paid amounts",rows.filter(r=>r.amounts.paidAmount.value!==null).length,"source figures, not verified receipt count"],["Reconciled balances",rows.filter(r=>r.calculatedOutstandingAmount?.state==="official").length,"dated, governed cash allocations"]])+panel("Payment stages and certificates","A certificate does not prove an employer approval or a bank receipt. No payment stage is copied into another.",table(["Certificate","Period","Source status","Application","Engineer assessment","Employer certification","Net certified","Paid","Outstanding","Evidence"],rows.map(r=>[escapeHtml(r.paymentId),period(r.periodEnd),escapeHtml(r.sourceStatus),amount(r.amounts.applicationAmount),amount(r.amounts.engineerAssessedAmount),amount(r.amounts.employerCertifiedAmount),amount(r.amounts.netCertifiedAmount),amount(r.amounts.paidAmount),amount(r.amounts.outstandingAmount),evidence(r.amounts.netCertifiedAmount.receipts)])))+panel("Certificate component checks","Gross work plus variations less retention, advance recovery and other deductions. All required components and money bases must be explicit; tax is added only for an evidenced exclusive-to-inclusive transition.",table(["Certificate","Gross work","Variations","Retention","Advance recovery","Other deductions","Tax","Component check"],rows.map(r=>[escapeHtml(r.paymentId),amount(r.amounts.grossWork),amount(r.amounts.variations),amount(r.amounts.retentionDeduction),amount(r.amounts.advanceRecovery),amount(r.amounts.otherDeduction),amount(r.amounts.taxAmount),escapeHtml(humanizeKey(r.reconciliation))])));
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

function renderCommercialVisual(key,data){
  const p=projectionFor(data,data?.projectionKey||"");
  const position=p.position||data.position||data;
  if(!position||!Array.isArray(position.currencies))return"";
  const foundation=position.foundation||null;
  const t=position.timeExposure||{};
  const time=planningKpis([
    ["Contract completion",t.contractualCompletion?.value?planningShortDate(t.contractualCompletion.value):"Not established",humanizeKey(t.contractualCompletion?.state||"not_submitted")],
    ["Approved EOT",t.approvedEotDays?.value===null||t.approvedEotDays?.value===undefined?"Not established":fmt(t.approvedEotDays.value)+" d",humanizeKey(t.approvedEotDays?.state||"not_submitted")],
    ["Adjusted completion",t.officialAdjustedCompletion?.value?planningShortDate(t.officialAdjustedCompletion.value):"Not established",humanizeKey(t.officialAdjustedCompletion?.state||"not_submitted")],
    ["Variations",position.variationCount,"records"],
    ["Payment / IPC rows",foundation?.paymentRegister?.recordCount??0,"source register rows"],
    ["Commercial claims",position.claimCommercialCount,"money-linked claim rows"]
  ]);
  const colsByKey={
    "commercial-overview":[["Committed","committedContractValue"],["Current contract","currentContractValue"],["Pending variations","pendingVariationAmount"],["Certified","grossCertifiedAmount"],["Paid","paidAmount"],["Retention deducted","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Claims","claimedAmount"],["Active bonds","activeBondAmount"]],
    "cost-forecast":[["Committed","committedContractValue"],["Approved variations","approvedVariationAmount"],["Pending variations","pendingVariationAmount"],["Current contract","currentContractValue"],["Claimed","claimedAmount"],["Assessed claims","assessedClaimAmount"]],
    "variations-change":[["Approved variations","approvedVariationAmount"],["Pending variations","pendingVariationAmount"],["Current contract","currentContractValue"]],
    "payments":[["Certificates","interimCertificateCount"],["Gross certified","grossCertifiedAmount"],["Paid","paidAmount"],["Certified unpaid","certifiedUnpaidAmount"],["Retention deducted","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Advance balance","advanceBalance"]],
    "cash-flow":[["Gross certified","grossCertifiedAmount"],["Paid","paidAmount"],["Certified unpaid","certifiedUnpaidAmount"],["Retention deducted","retentionDeductedAmount"],["Held balance","retentionHeldAmount"],["Advance balance","advanceBalance"]],
    "commercial-claims-notices":[["Claimed","claimedAmount"],["Assessed","assessedClaimAmount"],["Pending variations","pendingVariationAmount"]],
    "contract-particulars-bonds":[["Committed","committedContractValue"],["Current contract","currentContractValue"],["Active bonds","activeBondAmount"]]
  };
  const cols=colsByKey[key]||colsByKey["commercial-overview"];
  const chartFieldsByKey={
    "commercial-overview":[["Committed","committedContractValue","graphite"],["Current contract","currentContractValue","accent"],["Pending variations","pendingVariationAmount","warning"],["Certified","grossCertifiedAmount","teal"],["Paid","paidAmount","success"],["Claims","claimedAmount","danger"]],
    "cost-forecast":[["Committed","committedContractValue","graphite"],["Current contract","currentContractValue","accent"],["Approved variations","approvedVariationAmount","success"],["Pending variations","pendingVariationAmount","warning"],["Claimed","claimedAmount","danger"],["Assessed claims","assessedClaimAmount","purple"]],
    "variations-change":[["Approved variations","approvedVariationAmount","success"],["Pending variations","pendingVariationAmount","warning"],["Current contract","currentContractValue","accent"]],
    "payments":[["Gross certified","grossCertifiedAmount","accent"],["Paid","paidAmount","success"],["Certified unpaid","certifiedUnpaidAmount","danger"],["Retention held","retentionHeldAmount","warning"],["Advance balance","advanceBalance","purple"]],
    "cash-flow":[["Gross certified","grossCertifiedAmount","accent"],["Paid","paidAmount","success"],["Certified unpaid","certifiedUnpaidAmount","danger"],["Retention held","retentionHeldAmount","warning"],["Advance balance","advanceBalance","purple"]],
    "commercial-claims-notices":[["Claimed","claimedAmount","danger"],["Assessed","assessedClaimAmount","purple"],["Pending variations","pendingVariationAmount","warning"]],
    "contract-particulars-bonds":[["Committed","committedContractValue","graphite"],["Current contract","currentContractValue","accent"],["Active bonds","activeBondAmount","warning"]]
  };
  const chartFields=chartFieldsByKey[key]||chartFieldsByKey["commercial-overview"];
  const cards=position.currencies.length
    ? position.currencies.map(row=>{
        const lines=cols.map(([label,field])=>'<div class="currency-line"><span>'+escapeHtml(label)+'</span><strong>'+commercialMetricHtml(row[field],field==="interimCertificateCount"?"":row.currency)+'</strong></div>').join("");
        return '<div class="currency-card"><div class="currency-code">'+escapeHtml(row.currency)+'</div>'+lines+'</div>';
      }).join("")
    : '<div class="empty-visual">No established commercial currency position. Submitted-but-unparsed and missing evidence remain distinct from zero.</div>';
  const commercialCharts=position.currencies.length
    ? '<div class="commercial-visual-grid">'+position.currencies.map(row=>renderVisualPanel(
        row.currency+" · "+(names[key]||"Commercial position"),
        "Values are compared only within this currency. Missing values remain absent, not zero.",
        renderCommercialMetricBars(row,chartFields)
      )).join("")+'</div>'
    : "";
  const evidence=position.evidence||{};
  const gates=moduleEvidenceGate([
    {label:"Commercial basis",value:humanizeKey(evidence.commercial||"not_submitted"),state:evidence.commercial==="established"?"ready":"missing"},
    {label:"Variations",value:humanizeKey(evidence.variations||"not_submitted"),state:evidence.variations==="established"?"ready":"missing"},
    {label:"Payments",value:humanizeKey(evidence.payments||"not_submitted"),state:evidence.payments==="established"?"ready":"missing"},
    {label:"Bonds",value:humanizeKey(evidence.bonds||"not_submitted"),state:evidence.bonds==="established"?"ready":"missing"},
    {label:"Claims",value:humanizeKey(evidence.claims||"not_submitted"),state:evidence.claims==="established"?"ready":"missing"}
  ]);
  const registers=position.registers||{};
  const table=(headers,rows,emptyMessage)=>rows.length
    ? '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+escapeHtml(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>'
    : '<div class="empty-visual">'+escapeHtml(emptyMessage)+'</div>';
  const findingValue=(finding,unit="")=>{
    if(!finding||finding.value===null||finding.value===undefined)return"Not established";
    return fmt(finding.value)+(unit?" "+unit:"");
  };
  const findingMeta=(finding)=>{
    if(!finding)return"Missing";
    const bits=[humanizeKey(finding.state||"missing"),humanizeKey(finding.authority||"missing")];
    if(finding.coverage?.percent!==null&&finding.coverage?.percent!==undefined)bits.push(fmt(finding.coverage.percent)+"% coverage");
    return bits.join(" · ");
  };
  let foundationDetail="";
  if(foundation){
    const terms=foundation.commercialTerms||{};
    if(key==="commercial-overview"){
      foundationDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Commercial foundation readiness</h4><p>Tier 1 capabilities share one governed evidence-safe contract. Missing evidence stays distinct from zero.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Commercial Terms",humanizeKey(terms.state||"missing"),"contract facts, clauses and amendments"],
          ["Cost Register",humanizeKey(foundation.costRegister?.state||"missing"),fmt(foundation.costRegister?.recordCount||0)+" records"],
          ["Payment Register",humanizeKey(foundation.paymentRegister?.state||"missing"),fmt(foundation.paymentRegister?.recordCount||0)+" records"],
          ["CBS Breakdown",humanizeKey(foundation.cbsBreakdown?.state||"missing"),fmt(foundation.cbsBreakdown?.nodeCount||0)+" nodes"]
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
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Cost Register</h4><p>CBS/WBS/currency/tax/date/source authority remain explicit. Unmapped rows are retained, never discarded.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Cost records",foundation.costRegister?.recordCount||0,"canonical grouped records"],
          ["CBS mapping",foundation.costRegister?.mappingCoveragePercent==null?"Not established":fmt(foundation.costRegister.mappingCoveragePercent)+"%","source rows mapped"],
          ["CBS nodes",foundation.cbsBreakdown?.nodeCount||0,"hierarchy nodes"],
          ["Unmapped",foundation.cbsBreakdown?.unmappedCostMetricCount||0,"retained for correction"]
        ])+
        table(["Cost code","Description","Parent","WBS","Currency","Tax basis","Current metrics","State"],costRows,"No cost-register source metrics are established.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>CBS Breakdown</h4><p>Parent-child structure, WBS/BOQ/payment mappings and currency-isolated metric positions.</p></div></div><div class="planning-panel-body">'+
        table(["CBS","Description","Parent","Children","WBS","BOQ links","Payment links"],cbsRows,"No CBS hierarchy is established.")+
        '</div></section>';
    }
    if(key==="payments"||key==="cash-flow"){
      const paymentRegister=foundation.paymentRegister||{};
      const lifecycleCounts=paymentRegister.lifecycleCounts||{};
      const slaCounts=paymentRegister.slaCounts||{};
      const paymentRows=(paymentRegister.rows||[]).map(row=>{
        const amounts=row.amounts||{};
        return '<tr><td><b>'+escapeHtml(row.paymentId)+'</b></td><td>'+escapeHtml(row.paymentType||"Not stated")+'</td><td>'+escapeHtml(planningShortDate(row.periodEnd))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.applicationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.assessmentDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDate))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.certificationDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.lifecycle?.paymentDate))+'</td><td>'+escapeHtml(humanizeKey(row.lifecycle?.slaState||"not_established"))+'</td><td>'+escapeHtml(findingValue(amounts.applicationAmount))+'</td><td>'+escapeHtml(findingValue(amounts.engineerAssessedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.employerCertifiedAmount))+'</td><td>'+escapeHtml(findingValue(amounts.paidAmount))+'</td></tr>';
      });
      const lifecycleVisual=renderVisualPanel(
        "IPC lifecycle completion",
        "Counts come from governed application, assessment, certification and payment event dates. Missing stages are not copied from another stage.",
        renderVisualBars([
          {label:"Applied",value:lifecycleCounts.applied??0,tone:"graphite"},
          {label:"Assessed",value:lifecycleCounts.assessed??0,tone:"purple"},
          {label:"Certified",value:lifecycleCounts.certified??0,tone:"accent"},
          {label:"Paid",value:lifecycleCounts.paid??0,tone:"success"}
        ],"records")
      );
      const slaAssessable=paymentRegister.slaAssessmentState==="established";
      const slaVisual=renderVisualPanel(
        "Payment SLA & aging position",
        slaAssessable
          ?"Paid-late, overdue-unpaid and open-not-due positions use governed actual/due dates."
          :"Payment SLA outcomes are withheld because due/payment date coverage is incomplete.",
        slaAssessable
          ?renderDonutChart([
              {label:"Paid on time",value:slaCounts.paidOnTime??0,tone:"success"},
              {label:"Paid late",value:slaCounts.paidLate??0,tone:"warning"},
              {label:"Overdue unpaid",value:slaCounts.overdueUnpaid??0,tone:"danger"},
              {label:"Open · not due",value:slaCounts.openUnpaid??0,tone:"accent"}
            ],"Assessable payments")
          :'<div class="notice warning"><b>Not assessable</b><p>'+escapeHtml(fmt(slaCounts.notEstablished??0))+' payment record(s) do not have sufficient governed SLA event dates.</p></div>'
      );
      foundationDetail='<section class="planning-panel primary payment-management-position"><div class="planning-panel-head"><div><h4>Payments & IPC Management Position</h4><p>Application, assessment, certification and payment remain separate. Due dates and SLA states come from evidenced event dates and contractual periods.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Payment records",paymentRegister.recordCount||0,"source register"],
          ["Stage coverage",paymentRegister.stageCoveragePercent==null?"Not established":fmt(paymentRegister.stageCoveragePercent)+"%","application / assessment / certification / payment dates"],
          ["Overdue unpaid",slaCounts.overdueUnpaid===null||slaCounts.overdueUnpaid===undefined?"Not assessable":slaCounts.overdueUnpaid,"past governed payment due date"],
          ["Paid late",slaCounts.paidLate===null||slaCounts.paidLate===undefined?"Not assessable":slaCounts.paidLate,"actual payment after due date"],
          ["SLA not established",slaCounts.notEstablished??0,"records without assessable due/payment dates",slaCounts.notEstablished?"warning":""],
          ["Payment period",findingValue(terms.paymentPeriodDays,"days"),findingMeta(terms.paymentPeriodDays)],
          ["Certification period",findingValue(terms.certificationPeriodDays,"days"),findingMeta(terms.certificationPeriodDays)]
        ])+
        '<div class="commercial-visual-grid payment-lifecycle-grid">'+lifecycleVisual+slaVisual+'</div>'+
        '<div class="section-heading compact"><div><h5>Payment register / IPC lifecycle</h5><p>Full governed register; no presentation-only row cap.</p></div><span class="badge">'+escapeHtml(fmt((paymentRegister.rows||[]).length))+' records</span></div>'+
        table(["Payment","Type","Period","Applied","Assessed","Certified","Certification due","Payment due","Paid","SLA","Applied amount","Assessed amount","Certified amount","Paid amount"],paymentRows,"No payment register is established.")+
        '</div></section>';
    }
    if(key==="contract-particulars-bonds"){
      const clauseRows=(terms.clauses||[]).map(row=>'<tr><td><b>'+escapeHtml(row.identifier||row.clauseKey)+'</b></td><td>'+escapeHtml(row.heading||"")+'</td><td>'+escapeHtml(row.documentRole)+'</td><td>'+escapeHtml(humanizeKey(row.governanceState))+'</td><td>'+escapeHtml(row.startPage||"—")+'</td><td>'+escapeHtml(row.textPreview||"")+'</td></tr>');
      const amendmentRows=(terms.amendments||[]).map(row=>'<tr><td><b>'+escapeHtml(row.documentId)+'</b></td><td>'+escapeHtml(planningShortDate(row.effectiveDate))+'</td><td>'+escapeHtml(planningShortDate(row.completionIso))+'</td><td>'+escapeHtml(row.incorporatedEotDays===null?"Not established":fmt(row.incorporatedEotDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml((row.actions||[]).map(a=>a.action+" "+a.targetIdentifier).join("; ")||"No parsed clause actions")+'</td></tr>');
      foundationDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Commercial Terms</h4><p>Contract facts, clauses, amendments and candidate terms remain source-backed and are never auto-promoted.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Contract currency",findingValue(terms.contractCurrency),findingMeta(terms.contractCurrency)],
          ["Contract completion",terms.contractualCompletionDate?.value?planningShortDate(terms.contractualCompletionDate.value):"Not established",findingMeta(terms.contractualCompletionDate)],
          ["Retention",findingValue(terms.retentionPercent,"%"),findingMeta(terms.retentionPercent)],
          ["Retention cap",findingValue(terms.retentionCapPercent,"%"),findingMeta(terms.retentionCapPercent)],
          ["Payment period",findingValue(terms.paymentPeriodDays,"days"),findingMeta(terms.paymentPeriodDays)],
          ["Notice period",findingValue(terms.noticePeriodDays,"days"),findingMeta(terms.noticePeriodDays)],
          ["LD rate",findingValue(terms.ldRate),findingMeta(terms.ldRate)],
          ["LD cap",findingValue(terms.ldCap),findingMeta(terms.ldCap)]
        ])+
        '<div class="notice info"><b>Performance security:</b> '+escapeHtml(findingValue(terms.performanceBondRequirement))+' · '+escapeHtml(findingMeta(terms.performanceBondRequirement))+'<br><b>Advance-payment security:</b> '+escapeHtml(findingValue(terms.advancePaymentBondRequirement))+' · '+escapeHtml(findingMeta(terms.advancePaymentBondRequirement))+'<br><b>Insurance clauses:</b> '+escapeHtml((terms.insuranceRequirements||[]).length)+' · <b>Precedence clauses:</b> '+escapeHtml((terms.hierarchyAndPrecedenceClauses||[]).length)+'</div>'+
        table(["Clause","Heading","Document role","Governance","Page","Source text"],clauseRows,"No parsed contract clauses are established.")+
        table(["Amendment","Effective","Revised completion","Incorporated EOT","State","Clause actions"],amendmentRows,"No contract amendments are established.")+
        '</div></section>';
    }
  }
  const performance=position.performance||null;
  let performanceDetail="";
  if(performance){
    if(key==="commercial-overview"){
      performanceDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Tier 2 performance readiness</h4><p>Cost, EVM, cash and curve consumers reuse one canonical Commercial performance producer.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Cost Control",humanizeKey(performance.costControl?.state||"missing"),fmt(performance.costControl?.positions?.length||0)+" currency/tax positions"],
          ["EVM Curves",humanizeKey(performance.evmPerformance?.state||"missing"),fmt(performance.evmPerformance?.series?.length||0)+" series"],
          ["Cash Flow",humanizeKey(performance.cashFlow?.state||"missing"),fmt(performance.cashFlow?.currencies?.length||0)+" currencies"],
          ["Cost S-Curve",humanizeKey(performance.costScurve?.state||"missing"),fmt(performance.costScurve?.series?.length||0)+" series"]
        ])+'</div></section>';
    }
    if(key==="cost-forecast"){
      const controlSections=(performance.costControl?.positions||[]).map(row=>{
        const scenarioRows=(row.eacScenarios||[]).map(s=>'<tr><td><b>'+escapeHtml(humanizeKey(s.method))+'</b></td><td>'+escapeHtml(findingValue(s.value,row.currency))+'</td><td>'+escapeHtml(s.official?"Source / governed":"Scenario only")+'</td><td>'+escapeHtml(s.methodology||"")+'</td></tr>');
        const varianceRows=[
          ["Price",row.varianceDecomposition?.price],
          ["Quantity",row.varianceDecomposition?.quantity],
          ["Productivity",row.varianceDecomposition?.productivity]
        ].map(([label,value])=>'<tr><td><b>'+escapeHtml(label)+'</b></td><td>'+escapeHtml(findingValue(value,row.currency))+'</td><td>'+escapeHtml(findingMeta(value))+'</td></tr>');
        const scenarioVisual=renderVisualPanel(
          row.currency+' · EAC scenario range',
          'Source-reported EAC stays visibly separate from CMeng calculation scenarios.',
          renderVisualBars((row.eacScenarios||[]).map(s=>({
            label:(s.official?'Source · ':'Scenario · ')+humanizeKey(s.method),
            value:metricValue(s.value),
            tone:s.official?'accent':'purple'
          })),row.currency)
        );
        const varianceVisual=renderVisualPanel(
          row.currency+' · Variance decomposition',
          'Source price, quantity and productivity drivers remain separate. Negative values are adverse; positive values are favorable.',
          renderCashMovementBars([
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
            ["SPI",findingValue(row.spi),findingMeta(row.spi)],
            ["CPI",findingValue(row.cpi),findingMeta(row.cpi)],
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
            ])
          )+
          renderVisualPanel(
            series.currency+' · SPI / CPI',
            'Calculated performance indices remain separate from documented source values.',
            renderLineChart(points,[
              {key:"spi",label:"SPI",tone:"accent"},
              {key:"cpi",label:"CPI",tone:"success"}
            ])
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
          series.currency+' · Cost S-Curve',
          'PV, EV, AC and source EAC remain partitioned by currency and tax basis.',
          renderLineChart(points,[
            {key:"planned",label:"Planned cost / PV",tone:"graphite"},
            {key:"earned",label:"Earned value",tone:"accent"},
            {key:"actual",label:"Actual cost",tone:"danger"},
            {key:"eac",label:"Source EAC",tone:"purple"}
          ])
        );
      }).join("");
      performanceDetail='<section class="planning-panel primary cost-forecast-primary"><div class="planning-panel-head"><div><h4>Cost S-Curve & Forecast Position</h4><p>PV, EV, AC and source EAC are the primary cost-control view. Source and calculated positions remain explicitly separated.</p></div></div><div class="planning-panel-body"><div class="commercial-visual-grid">'+costCurveSections+'</div></div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>EVM Curves & Performance Indices</h4><p>Time-phased PV / EV / AC and calculated SPI / CPI provide the supporting trend view.</p></div></div><div class="planning-panel-body">'+evmSections+'</div></section>'+
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
          ? fmt(sourceReadiness.paymentRecordCount)+' payment records · '+
            fmt(sourceReadiness.certification.observedCount)+' certified values · '+
            fmt(sourceReadiness.receipts.observedCount)+' paid amounts · '+
            fmt(sourceReadiness.receipts.paymentDateCount)+' payment dates · '+
            fmt(sourceReadiness.expenditure.observedCount)+' actual cash-expenditure rows'
          : null;
        const actualCostContext=sourceReadiness&&sourceReadiness.expenditure.actualCostRecordCount>0&&sourceReadiness.expenditure.observedCount===0
          ? ' '+fmt(sourceReadiness.expenditure.actualCostRecordCount)+' Actual Cost row(s) exist, but AC/accrual cost is not relabelled as cash expenditure.'
          : '';
        const hero=netReady
          ? '<div class="cash-flow-hero established"><div><span>Current evidenced net cash</span><strong>'+escapeHtml(fmt(netValue)+" "+row.currency)+'</strong><p>Paid income less actual cash expenditure. Certification is not treated as cash.</p></div><div class="cash-flow-hero-stats"><div><span>Peak funding need</span><b>'+escapeHtml(peakValue===null?"Not established":fmt(peakValue)+" "+row.currency)+'</b></div><div><span>Paid cash</span><b>'+escapeHtml(fmt(paidValue)+" "+row.currency)+'</b></div><div><span>Actual cash expenditure</span><b>'+escapeHtml(fmt(actualValue)+" "+row.currency)+'</b></div><div><span>Certified unpaid</span><b>'+escapeHtml(unpaidValue===null?"Not established":fmt(unpaidValue)+" "+row.currency)+'</b></div></div></div>'
          : '<div class="cash-flow-hero withheld"><div><span>Current cash position</span><strong>Withheld</strong><p>'+escapeHtml(sourceSummary?sourceSummary+".":"The required dated cash series is incomplete.")+escapeHtml(actualCostContext)+'</p></div><div class="cash-flow-hero-rule"><b>Why CMeng withholds the total</b><p>Net cash requires both actual paid cash and actual cash expenditure on defensible dated series. Missing cash is never treated as zero, and certified value or AC is never silently converted into cash.</p></div></div>';
        const readinessGrid=sourceReadiness
          ? '<div class="cash-readiness-grid">'+
              readinessDomain(
                "Certification series",
                sourceReadiness.certification,
                fmt(sourceReadiness.certification.observedCount)+" / "+fmt(sourceReadiness.certification.totalCount)+" amounts",
                "payments"
              )+
              readinessDomain(
                "Actual cash receipts",
                sourceReadiness.receipts,
                fmt(sourceReadiness.receipts.observedCount)+" / "+fmt(sourceReadiness.receipts.totalCount)+" paid",
                "payments"
              )+
              readinessDomain(
                "Actual cash expenditure",
                sourceReadiness.expenditure,
                fmt(sourceReadiness.expenditure.observedCount)+" cash rows",
                "cost-forecast"
              )+
              '<div class="cash-readiness-item '+escapeHtml(sourceReadiness.forwardPlan.state==="ready"?"established":"missing")+'">'+
                '<div><span>Forward cash plan</span><b>'+escapeHtml(readinessStateLabel(sourceReadiness.forwardPlan.state))+'</b></div>'+
                '<span class="badge '+readinessTone(sourceReadiness.forwardPlan.state)+'">'+escapeHtml(fmt(sourceReadiness.forwardPlan.budgetRecordCount)+" budget · "+fmt(sourceReadiness.forwardPlan.forecastRecordCount)+" forecast")+'</span>'+
                '<small>'+escapeHtml(sourceReadiness.forwardPlan.consequence||"")+'</small>'+
                '<div class="cash-readiness-basis"><span>Budget / forecast basis</span><b>'+escapeHtml(basisLabel(sourceReadiness.forwardPlan.budgetBasis)+" / "+basisLabel(sourceReadiness.forwardPlan.forecastBasis))+'</b></div>'+
                managementModuleLink("cost-forecast",sourceReadiness.forwardPlan.state==="ready"?"Open source":"Resolve source")+
              '</div>'+
            '</div>'
          : '';
        const curve=hasCurve
          ? '<div class="cash-flow-primary">'+renderVisualPanel(
              row.currency+' · Cash-flow S-curve & funding position',
              'Cumulative certified and paid income are separated from budget, forecast and actual expenditure. Net cash uses paid income less actual expenditure only.',
              renderLineChart(points,[
                {key:"budget",label:"Expenditure budget",tone:"graphite"},
                {key:"forecast",label:"Expenditure forecast",tone:"purple"},
                {key:"actual",label:"Actual expenditure",tone:"danger"},
                {key:"certified",label:"Certified income",tone:"warning"},
                {key:"paid",label:"Paid income",tone:"success"},
                {key:"net",label:"Net cash",tone:"accent"}
              ])
            )+'</div>'
          : '<div class="cash-flow-curve-withheld"><div><span>Funding S-curve</span><b>Not plotted</b></div><p>A funding curve requires at least two producer-certified net-cash points. Certification-only, planned-cost or missing-cash data cannot create a funding curve.</p></div>';
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
          ? '<details class="cash-flow-register-detail"><summary><div><b>Governed dated cash-flow register</b><span>'+escapeHtml(fmt(entries.length))+' entries</span></div><small>Open source-level cash movements and evidence trace</small></summary><div class="cash-flow-register-body">'+table(["Date","Entry","Amount","Evidence state","Source"],entryRows,"No dated cash-flow entries are established.")+'</div></details>'
          : '';
        const diagnostics=(row.diagnostics||[]).length
          ? '<details class="cash-flow-trace"><summary><b>Calculation trace</b><span>'+escapeHtml(fmt(row.diagnostics.length))+' controls</span></summary><div>'+row.diagnostics.map(code=>'<div class="cash-trace-row">'+escapeHtml(humanizeKey(code))+'</div>').join("")+'</div></details>'
          : '';
        return '<section class="planning-panel primary cash-flow-position"><div class="planning-panel-head"><div><h4>'+escapeHtml(row.currency)+' · Cash Flow & Funding</h4><p>Only cash-supported positions appear as cash. Certification, expenditure plans and missing evidence remain separate.</p></div><span class="badge '+(netReady?"ready":"partial")+'">'+escapeHtml(netReady?"Cash established":"Cash incomplete")+'</span></div><div class="planning-panel-body">'+
          hero+
          readinessGrid+
          curve+
          (secondary.length?'<div class="commercial-visual-grid cash-flow-secondary">'+secondary.join("")+'</div>':'')+
          register+
          diagnostics+
          '</div></section>';
      }).join("");
      performanceDetail=cashSections||'<section class="planning-panel primary cash-flow-position"><div class="planning-panel-body"><div class="cash-flow-hero withheld"><div><span>Cash Flow</span><strong>Not established</strong><p>No governed cash-flow currency position can be produced from the current evidence. CMeng will not manufacture a cash curve from payment or cost values without a defensible dated cash basis.</p></div></div><div class="cash-flow-related-actions">'+managementModuleLink("payments","Open Payments")+managementModuleLink("cost-forecast","Open Cost & Forecast")+'</div></div></section>';
    }

  }
  const contractControls=position.contractControls||null;
  let contractControlDetail="";
  if(contractControls){
    if(key==="commercial-overview"){
      contractControlDetail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Tier 2 contract-control readiness</h4><p>Change, obligations, LD, security/insurance and retention reuse Schedule, Claims/EOT and canonical Commercial evidence.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Variations",humanizeKey(contractControls.variations?.state||"missing"),fmt(contractControls.variations?.recordCount||0)+" records"],
          ["Site Instructions",humanizeKey(contractControls.siteInstructions?.state||"missing"),fmt(contractControls.siteInstructions?.recordCount||0)+" records"],
          ["Obligations",humanizeKey(contractControls.contractObligations?.state||"missing"),fmt(contractControls.contractObligations?.recordCount||0)+" controls"],
          ["LD",humanizeKey(contractControls.liquidatedDamages?.state||"missing"),fmt(contractControls.liquidatedDamages?.scenarios?.length||0)+" scenarios"],
          ["Bonds & Insurance",humanizeKey(contractControls.bondsInsurance?.state||"missing"),fmt((contractControls.bondsInsurance?.bonds?.length||0)+(contractControls.bondsInsurance?.insurances?.length||0))+" instruments"],
          ["Retention",humanizeKey(contractControls.retentionCalendar?.state||"missing"),fmt(contractControls.retentionCalendar?.recordCount||0)+" records"]
        ])+'</div></section>';
    }
    if(key==="variations-change"){
      const vo=contractControls.variations||{};
      const stageCounts=vo.lifecycleStageCounts||{};
      const ageBands=vo.pendingAgeBands||{};
      const lifecycleVisual=renderVisualPanel(
        "Variation lifecycle distribution",
        "Current controlled lifecycle stage for every variation. Instruction, submission, quotation, assessment, agreement, approval and rejection stay distinct.",
        renderVisualBars([
          {label:"Instruction",value:stageCounts.instruction??0,tone:"graphite"},
          {label:"Submitted",value:stageCounts.submitted??0,tone:"accent"},
          {label:"Quoted",value:stageCounts.quoted??0,tone:"purple"},
          {label:"Assessed",value:stageCounts.assessed??0,tone:"warning"},
          {label:"Agreed",value:stageCounts.agreed??0,tone:"accent"},
          {label:"Approved",value:stageCounts.approved??0,tone:"success"},
          {label:"Rejected",value:stageCounts.rejected??0,tone:"danger"},
          {label:"Unknown",value:stageCounts.unknown??0,tone:"neutral"}
        ],"items")
      );
      const agingVisual=renderVisualPanel(
        "Pending variation aging",
        "Age bands use the latest evidenced open lifecycle date to the project Data Date. Closed variations are excluded.",
        renderVisualBars([
          {label:"0–30 days",value:ageBands.upTo30Days??0,tone:"success"},
          {label:"31–60 days",value:ageBands.days31To60??0,tone:"accent"},
          {label:"61–90 days",value:ageBands.days61To90??0,tone:"warning"},
          {label:">90 days",value:ageBands.over90Days??0,tone:"danger"},
          {label:"Age not established",value:ageBands.unknown??0,tone:"neutral"}
        ],"items")
      );
      const bridgeVisuals=(position.currencies||[]).map(row=>renderVisualPanel(
        row.currency+" · Contract value & change bridge",
        "Approved changes may move the governed contract value. Pending change remains outside the current contract value until approved.",
        renderCommercialValueBridge(
          row.committedContractValue,
          row.approvedVariationAmount,
          row.currentContractValue,
          row.pendingVariationAmount,
          row.currency
        )
      )).join("");
      const voRows=(vo.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.variationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.lifecycleStage))+'</td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(planningShortDate(row.dates?.instruction))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.submitted))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.assessed))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.agreed))+'</td><td>'+escapeHtml(planningShortDate(row.dates?.approved))+'</td><td>'+escapeHtml(findingValue(row.ageDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.cost?.claimed))+'</td><td>'+escapeHtml(findingValue(row.cost?.assessed))+'</td><td>'+escapeHtml(findingValue(row.cost?.agreed))+'</td><td>'+escapeHtml(findingValue(row.cost?.approved))+'</td><td>'+escapeHtml(findingValue(row.scheduleImpactDays,"d"))+'</td><td>'+escapeHtml([row.instructionId,row.claimId,row.paymentId,(row.activityIds||[]).join("; ")].filter(Boolean).join(" · ")||"No cross-domain link")+'</td></tr>');
      const si=contractControls.siteInstructions||{};
      const instructionPressure=renderVisualPanel(
        "Site Instruction conversion & quotation pressure",
        "An instruction is not automatically a variation. Overdue quotation and explicit VO conversion are shown separately.",
        renderVisualBars([
          {label:"Instructions",value:si.recordCount||0,tone:"graphite"},
          {label:"Unquoted",value:si.unquotedCount||0,tone:"warning"},
          {label:"Overdue quotations",value:si.overdueQuotationCount||0,tone:"danger"},
          {label:"Converted to VO",value:si.convertedVariationCount||0,tone:"success"}
        ],"items")
      );
      const siRows=(si.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.instructionId)+'</b></td><td>'+escapeHtml(planningShortDate(row.issueDate))+'</td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(planningShortDate(row.quotationDueDate?.value))+'</td><td>'+escapeHtml(planningShortDate(row.quotationDate))+'</td><td>'+escapeHtml(humanizeKey(row.quotationTimeliness))+'</td><td>'+escapeHtml(findingValue(row.openAgeDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.estimatedAmount))+'</td><td>'+escapeHtml(row.variationId||"Not linked")+'</td><td>'+escapeHtml([row.claimId,row.paymentId,(row.activityIds||[]).join("; ")].filter(Boolean).join(" · ")||"—")+'</td></tr>');
      contractControlDetail=
        '<section class="planning-panel primary variation-management-position"><div class="planning-panel-head"><div><h4>Variations & Change Management Position</h4><p>Lifecycle, aging, contract-value effect and schedule/claim/payment links remain controlled separately.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Variations",vo.recordCount||0,"full lifecycle records"],
          ["Approved",vo.approvedCount||0,"governed approval"],
          ["Pending",vo.pendingCount||0,"not approved"],
          ["Rejected",vo.rejectedCount||0,"closed without approval"],
          ["Final-stage coverage",vo.finalStageCoveragePercent==null?"Not established":fmt(vo.finalStageCoveragePercent)+"%","current/final stage identified"],
          ["Full lifecycle coverage",vo.fullLifecycleCoveragePercent==null?"Not established":fmt(vo.fullLifecycleCoveragePercent)+"%","instruction / submission / assessment / closure dates"],
          ["Schedule linkage",vo.scheduleLinkCoveragePercent==null?"Not established":fmt(vo.scheduleLinkCoveragePercent)+"%","time/activity evidence"],
          ["Claim linkage",vo.claimLinkCoveragePercent==null?"Not established":fmt(vo.claimLinkCoveragePercent)+"%","claim IDs"],
          ["Payment linkage",vo.paymentLinkCoveragePercent==null?"Not established":fmt(vo.paymentLinkCoveragePercent)+"%","certificate/payment IDs"]
        ])+
        '<div class="commercial-visual-grid variation-control-grid">'+lifecycleVisual+agingVisual+'</div>'+
        (bridgeVisuals?'<div class="commercial-visual-grid change-bridge-grid">'+bridgeVisuals+'</div>':"")+
        '<div class="section-heading compact"><div><h5>Variation register</h5><p>Full governed lifecycle and cross-domain linkage.</p></div><span class="badge">'+escapeHtml(fmt((vo.rows||[]).length))+' records</span></div>'+
        table(["Variation","Stage","Description","Instruction","Submitted","Assessed","Agreed","Approved","Open age","Claimed","Assessed value","Agreed value","Approved value","Time impact","Cross-domain links"],voRows,"No governed variation lifecycle records are established.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Site Instructions</h4><p>An instruction is not automatically a variation or entitlement. Quotation aging uses actual issue and due dates.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Instructions",si.recordCount||0,"source records"],
          ["Unquoted",si.unquotedCount||0,"quotation missing"],
          ["Overdue quotations",si.overdueQuotationCount||0,"past due"],
          ["Converted to VO",si.convertedVariationCount||0,"explicit link only"]
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
      const obligationVisual=renderVisualPanel(
        "Contract obligation control",
        "Only explicit controlled obligations receive compliance status. Clause-derived requirements stay candidates until mapped.",
        renderVisualBars([
          {label:"Open",value:obl.openCount??0,tone:"accent"},
          {label:"Overdue",value:obl.overdueCount??0,tone:"danger"},
          {label:"Complete",value:obl.completeCount??0,tone:"success"},
          {label:"Clause candidates",value:obl.clauseCandidateCount??0,tone:"warning"}
        ],"items")
      );
      const securityVisual=renderVisualPanel(
        "Security & insurance monitoring",
        "Active, expiring and expired counts are monitoring indicators; expiring instruments may also be active.",
        renderVisualBars([
          {label:"Active bonds",value:bi.activeBondCount??0,tone:"success"},
          {label:"Expiring bonds",value:bi.expiringBondCount??0,tone:"warning"},
          {label:"Expired bonds",value:bi.expiredBondCount??0,tone:"danger"},
          {label:"Active policies",value:bi.activeInsuranceCount??0,tone:"accent"},
          {label:"Expiring policies",value:bi.expiringInsuranceCount??0,tone:"warning"},
          {label:"Expired policies",value:bi.expiredInsuranceCount??0,tone:"danger"}
        ],"instruments")
      );
      const retentionVisual=renderVisualPanel(
        "Retention release control",
        "Held, released, dated and overdue positions remain distinct; overdue may be a subset of held.",
        renderVisualBars([
          {label:"Held",value:ret.heldCount??0,tone:"warning"},
          {label:"Released",value:ret.releasedCount??0,tone:"success"},
          {label:"Release date established",value:ret.dueCount??0,tone:"accent"},
          {label:"Overdue unreleased",value:ret.overdueCount??0,tone:"danger"}
        ],"records")
      );
      const ldCurrencies=[...new Set((ld.scenarios||[]).map(row=>row.currency).filter(Boolean))];
      const ldVisuals=ldCurrencies.map(currency=>renderVisualPanel(
        currency+" · LD scenario exposure",
        "Only no-EOT and governed awarded-EOT scenarios may adjust project completion. Claim-register day totals never become project EOT. This is exposure analysis, not an automatic deduction.",
        renderVisualBars((ld.scenarios||[]).filter(row=>row.currency===currency).map(row=>({
          label:humanizeKey(row.scenario),
          value:metricValue(row.cappedExposure),
          tone:row.scenario==="awarded_eot"?"success":row.scenario==="no_eot"?"danger":"warning"
        })),currency)
      )).join("");
      const contractBridgeVisuals=(position.currencies||[]).map(row=>renderVisualPanel(
        row.currency+" · Contract value bridge",
        "Current contract value changes only through governed approved variation value. Pending variation remains outside the current contract value.",
        renderCommercialValueBridge(
          row.committedContractValue,
          row.approvedVariationAmount,
          row.currentContractValue,
          row.pendingVariationAmount,
          row.currency
        )
      )).join("");
      const obligationRows=(obl.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.obligationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.origin))+'</td><td>'+escapeHtml(row.clauseIdentifier||"—")+'</td><td>'+escapeHtml(row.description||"")+'</td><td>'+escapeHtml(row.responsibleParty||"Not mapped")+'</td><td>'+escapeHtml(planningShortDate(row.dueDate))+'</td><td>'+escapeHtml(planningShortDate(row.completedDate))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.daysToDue,"d"))+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
      const ldRows=(ld.scenarios||[]).map(row=>'<tr><td><b>'+escapeHtml(humanizeKey(row.scenario))+'</b></td><td>'+escapeHtml(findingValue(row.eotDays,"d"))+'</td><td>'+escapeHtml(row.adjustedCompletion?.value?planningShortDate(row.adjustedCompletion.value):"Not established")+'</td><td>'+escapeHtml(row.forecastCompletion?.value?planningShortDate(row.forecastCompletion.value):"Not established")+'</td><td>'+escapeHtml(findingValue(row.exposureDays,"d"))+'</td><td>'+escapeHtml(findingValue(row.uncappedExposure,row.currency||""))+'</td><td>'+escapeHtml(findingValue(row.capAmount,row.currency||""))+'</td><td>'+escapeHtml(findingValue(row.cappedExposure,row.currency||""))+'</td><td>'+escapeHtml(findingMeta(row.cappedExposure))+'</td></tr>');
      const bondRows=(bi.bonds||[]).map(row=>'<tr><td><b>'+escapeHtml(row.bondId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.amount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td></tr>');
      const insuranceRows=(bi.insurances||[]).map(row=>'<tr><td><b>'+escapeHtml(row.policyId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(row.insurer||"Not stated")+'</td><td>'+escapeHtml(humanizeKey(row.status))+'</td><td>'+escapeHtml(findingValue(row.coverageAmount))+'</td><td>'+escapeHtml(planningShortDate(row.expiryDate))+'</td><td>'+escapeHtml(findingValue(row.daysToExpiry,"d"))+'</td><td>'+escapeHtml(humanizeKey(row.expiryState))+'</td><td>'+escapeHtml(row.sourceRequirement||"Not linked")+'</td></tr>');
      const retentionRows=(ret.rows||[]).map(row=>'<tr><td><b>'+escapeHtml(row.retentionId)+'</b></td><td>'+escapeHtml(humanizeKey(row.origin))+'</td><td>'+escapeHtml(row.certificateNo||"—")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(row.trigger||"Not established")+'</td><td>'+escapeHtml(findingValue(row.amount))+'</td><td>'+escapeHtml(row.dueDate?.value?planningShortDate(row.dueDate.value):"Not established")+'</td><td>'+escapeHtml(planningShortDate(row.releaseDate))+'</td><td>'+escapeHtml(findingValue(row.daysToDue,"d"))+'</td></tr>');
      contractControlDetail=
        '<section class="planning-panel primary contract-particulars-management"><div class="planning-panel-head"><div><h4>Contract Particulars, Securities & Obligations Management Position</h4><p>Contract value, obligations, LD scenarios, securities, insurance and retention are controlled as separate evidence-backed positions.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Controlled obligation records",obl.state==="missing"?"Not established":(obl.explicitRecordCount??0),"explicit register"],
          ["Open obligations",obl.state==="missing"?"Not assessable":(obl.openCount??0),"not overdue / not complete"],
          ["Overdue obligations",obl.state==="missing"?"Not assessable":(obl.overdueCount??0),"requires attention"],
          ["Active bonds",bi.state==="missing"?"Not established":(bi.activeBondCount??0),"security register instruments"],
          ["Expiring bonds",bi.state==="missing"?"Not assessable":(bi.expiringBondCount??0),"within 90 days"],
          ["Expired bonds",bi.state==="missing"?"Not assessable":(bi.expiredBondCount??0),"requires attention"],
          ["Retention held",ret.heldCount||0,"explicit held state"],
          ["Retention overdue",ret.overdueCount||0,"past due and unreleased"]
        ])+
        (contractBridgeVisuals?'<div class="commercial-visual-grid contract-bridge-grid">'+contractBridgeVisuals+'</div>':"")+
        '<div class="commercial-visual-grid contract-control-grid">'+obligationVisual+securityVisual+retentionVisual+ldVisuals+'</div>'+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Contract Obligations</h4><p>Explicit obligation controls remain separate from clause-derived candidates. A clause does not invent compliance status.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Controlled obligation records",obl.state==="missing"?"Not established":(obl.explicitRecordCount??0),"explicit register"],
          ["Clause candidates",obl.clauseCandidateCount||0,"not yet mapped"],
          ["Open",obl.state==="missing"?"Not assessable":(obl.openCount??0),"controlled and not overdue"],
          ["Overdue",obl.state==="missing"?"Not assessable":(obl.overdueCount??0),"explicit dated obligations"],
          ["Complete",obl.state==="missing"?"Not assessable":(obl.completeCount??0),"evidenced completion"]
        ])+
        table(["Obligation","Origin","Clause","Requirement","Responsible","Due","Completed","Status","Days to due","Evidence"],obligationRows,"No obligation controls or clause candidates are established.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Liquidated Damages Scenarios</h4><p>Only no-EOT and governed awarded-EOT time bases may adjust project completion. Claim-register day totals are statistics only and never become project EOT.</p></div></div><div class="planning-panel-body">'+
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
          ["Active bonds",bi.state==="missing"?"Not established":(bi.activeBondCount??0),"security register records"],
          ["Expired bonds",bi.state==="missing"?"Not assessable":(bi.expiredBondCount??0),"requires action"],
          ["Expiring bonds",bi.state==="missing"?"Not assessable":(bi.expiringBondCount??0),"within 90 days"],
          ["Active policies",bi.state==="missing"?"Not established":(bi.activeInsuranceCount??0),"insurance register records"],
          ["Expired policies",bi.state==="missing"?"Not assessable":(bi.expiredInsuranceCount??0),"requires action"],
          ["Expiring policies",bi.state==="missing"?"Not assessable":(bi.expiringInsuranceCount??0),"within 90 days"]
        ])+
        '<div class="notice info"><b>Performance requirement:</b> '+escapeHtml(findingValue(bi.performanceBondRequirement))+' · '+escapeHtml(findingMeta(bi.performanceBondRequirement))+'<br><b>Advance-payment requirement:</b> '+escapeHtml(findingValue(bi.advancePaymentBondRequirement))+' · '+escapeHtml(findingMeta(bi.advancePaymentBondRequirement))+'<br><b>Contract insurance requirements:</b> '+escapeHtml(bi.insuranceRequirementCount||0)+'</div>'+
        table(["Bond","Type","Status","Amount","Expiry","Days","Expiry state"],bondRows,"No bond/security register is established.")+
        table(["Policy","Type","Insurer","Status","Coverage","Expiry","Days","Expiry state","Requirement"],insuranceRows,"No insurance-policy register is established.")+
        '</div></section>'+
        '<section class="planning-panel"><div class="planning-panel-head"><div><h4>Retention Calendar</h4><p>Percentage, cap, deduction, held balance, release due date and actual release are not interchangeable.</p></div></div><div class="planning-panel-body">'+
        planningKpis([
          ["Retention rate",findingValue(ret.retentionPercent,"%"),findingMeta(ret.retentionPercent)],
          ["Retention cap",findingValue(ret.retentionCapPercent,"%"),findingMeta(ret.retentionCapPercent)],
          ["Records",ret.recordCount||0,"all evidence origins"],
          ["Held",ret.heldCount||0,"explicit held state"],
          ["Released",ret.releasedCount||0,"explicit release state"],
          ["Dated",ret.dueCount||0,"release date/trigger established"],
          ["Overdue",ret.overdueCount||0,"past due and unreleased"]
        ])+
        table(["Retention","Origin","Certificate","State","Trigger","Amount","Due","Released","Days to due"],retentionRows,"No retention calendar records are established.")+
        '</div></section>';
    }
  }
  const commercialSummaryPanel=(heading,copy)=>
    '<section class="planning-panel primary commercial-management-summary"><div class="planning-panel-head"><div><h4>'+escapeHtml(heading)+'</h4><p>'+escapeHtml(copy)+'</p></div></div><div class="planning-panel-body"><div class="grid three">'+cards+'</div></div></section>';
  let detail="";
  let registerVisual="";
  if((key==="variations-change"&&!contractControls)||key==="cost-forecast"||key==="commercial-overview"){
    const variationStates=(registers.variations||[]).reduce((map,row)=>{const state=humanizeKey(row.state||"unknown");map.set(state,(map.get(state)||0)+1);return map},new Map());
    if(variationStates.size)registerVisual=renderVisualPanel(
      "Variation status distribution",
      "Variation counts by governed state. Amounts are not cross-summed across currency.",
      renderDonutChart([...variationStates.entries()].map(([label,value])=>({label,value,tone:/approved/i.test(label)?"success":/pending|review/i.test(label)?"warning":"neutral"})),"Variations")
    );
    const rows=(registers.variations||[]).map(row=>'<tr><td><b>'+escapeHtml(row.variationId)+'</b></td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(fmt(row.amount))+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Variation register</h4><p>Approved and pending change remain separate and retain source lineage.</p></div></div><div class="planning-panel-body">'+table(["Variation","State","Amount","Currency","Source"],rows,"No governed variation records are established.")+'</div></section>';
  }
  if(key==="payments"){
    const rows=(registers.invoices||[]).map(row=>'<tr><td><b>'+escapeHtml(row.invoiceId)+'</b></td><td>'+escapeHtml(planningShortDate(row.certificateDateIso))+'</td><td>'+escapeHtml(fmt(row.certifiedAmount))+'</td><td>'+escapeHtml(fmt(row.paidAmount))+'</td><td>'+escapeHtml(fmt(row.retentionAmount))+'</td><td>'+escapeHtml(fmt(row.advanceRecoveryAmount))+'</td><td>'+escapeHtml(fmt(row.advanceBalance))+'</td><td>'+escapeHtml(row.currency)+'</td><td>'+escapeHtml(planningShortDate(row.paymentDateIso))+'</td></tr>');
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Certificate and payment source register</h4><p>Source certificate rows remain available beneath the governed payment lifecycle; values are not re-summed in the browser.</p></div></div><div class="planning-panel-body">'+table(["Certificate","Certificate date","Certified","Paid","Retention","Advance recovery","Advance balance","Currency","Payment date"],rows,"No governed certificate/payment records are established.")+'</div></section>';
  }
  if(key==="commercial-claims-notices"){
    const cn=position.claimsNotices||p.focus?.claimsNotices||{};
    const stateCounts=cn.claimStateCounts||{};
    const timeliness=cn.noticeTimelinessCounts||{};
    const kindCounts=cn.noticeKindCounts||{};
    const claimLifecycleVisual=renderVisualPanel(
      "Claim lifecycle distribution",
      "Lifecycle state comes from the governed Delay / Claims model. Commercial amount status does not invent claim status.",
      renderVisualBars([
        {label:"Draft",value:stateCounts.draft??0,tone:"neutral"},
        {label:"Submitted",value:stateCounts.submitted??0,tone:"accent"},
        {label:"Under review",value:stateCounts.under_review??0,tone:"warning"},
        {label:"Determined",value:stateCounts.determined??0,tone:"success"},
        {label:"Rejected",value:stateCounts.rejected??0,tone:"danger"},
        {label:"Withdrawn",value:stateCounts.withdrawn??0,tone:"graphite"},
        {label:"Unknown",value:stateCounts.unknown??0,tone:"neutral"}
      ],"claims")
    );
    const noticeTimelinessVisual=renderVisualPanel(
      "Notice timeliness position",
      "Timeliness reuses governed contract notice requirements, event dates and actual notice issue dates. Missing requirements or dates remain explicit.",
      renderVisualBars([
        {label:"Timely",value:timeliness.timely??0,tone:"success"},
        {label:"Late",value:timeliness.late??0,tone:"danger"},
        {label:"Not issued",value:timeliness.not_issued??0,tone:"warning"},
        {label:"Requirement missing",value:timeliness.requirement_missing??0,tone:"neutral"},
        {label:"Event date missing",value:timeliness.event_date_missing??0,tone:"neutral"},
        {label:"Notice date missing",value:timeliness.notice_date_missing??0,tone:"neutral"}
      ],"events")
    );
    const noticeKindVisual=renderVisualPanel(
      "Notice / correspondence lifecycle",
      "Notice types stay distinct from claims and determinations.",
      renderVisualBars([
        {label:"Notice",value:kindCounts.notice??0,tone:"graphite"},
        {label:"Early warning",value:kindCounts.early_warning??0,tone:"accent"},
        {label:"EOT notice",value:kindCounts.eot_notice??0,tone:"warning"},
        {label:"Claim notice",value:kindCounts.claim_notice??0,tone:"purple"},
        {label:"Detailed claim",value:kindCounts.detailed_claim??0,tone:"danger"},
        {label:"Response",value:kindCounts.response??0,tone:"accent"},
        {label:"Determination",value:kindCounts.determination??0,tone:"success"}
      ],"records")
    );
    const financialRows=(registers.claims||[]).map(row=>'<tr><td><b>'+escapeHtml(row.claimId)+'</b></td><td>'+escapeHtml(row.claimedAmount===null||row.claimedAmount===undefined?"Not established":fmt(row.claimedAmount))+'</td><td>'+escapeHtml(row.assessedAmount===null||row.assessedAmount===undefined?"Not established":fmt(row.assessedAmount))+'</td><td>'+escapeHtml(row.currency||"Not established")+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    const lifecycleRows=(cn.claims||[]).map(row=>'<tr><td><b>'+escapeHtml(row.claimId)+'</b></td><td>'+escapeHtml(row.title||"")+'</td><td>'+escapeHtml(humanizeKey(row.state))+'</td><td>'+escapeHtml(planningShortDate(row.submittedAt))+'</td><td>'+escapeHtml(row.claimedDays===null||row.claimedDays===undefined?"Not established":fmt(row.claimedDays)+" d")+'</td><td>'+escapeHtml(row.assessedDays===null||row.assessedDays===undefined?"Not established":fmt(row.assessedDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.assessedDaysState||"missing"))+'</td><td>'+escapeHtml((row.eventIds||[]).join(", ")||"Not linked")+'</td><td>'+escapeHtml((row.clauseIdentifiers||[]).join(", ")||"—")+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    const assessmentRows=(cn.noticeAssessments||[]).map(row=>'<tr><td><b>'+escapeHtml(row.eventId)+'</b></td><td>'+escapeHtml(row.eventTitle||"")+'</td><td>'+escapeHtml(row.requirementId||"Not established")+'</td><td>'+escapeHtml(row.requiredNoticeDays===null||row.requiredNoticeDays===undefined?"Not established":fmt(row.requiredNoticeDays)+" d")+'</td><td>'+escapeHtml(planningShortDate(row.eventStartIso))+'</td><td>'+escapeHtml(row.noticeId||"Not issued")+'</td><td>'+escapeHtml(planningShortDate(row.noticeIssuedAt))+'</td><td>'+escapeHtml(row.elapsedDays===null||row.elapsedDays===undefined?"Not established":fmt(row.elapsedDays)+" d")+'</td><td>'+escapeHtml(humanizeKey(row.timeliness))+'</td><td>'+escapeHtml(humanizeKey(row.requirementState||"missing"))+'</td></tr>');
    const noticeRows=(cn.notices||[]).map(row=>'<tr><td><b>'+escapeHtml(row.noticeId)+'</b></td><td>'+escapeHtml(humanizeKey(row.kind))+'</td><td>'+escapeHtml(row.eventId||"—")+'</td><td>'+escapeHtml(row.claimId||"—")+'</td><td>'+escapeHtml(planningShortDate(row.actualIssuedAt))+'</td><td>'+escapeHtml(planningShortDate(row.actualReceivedAt))+'</td><td>'+escapeHtml(row.subject||"")+'</td><td>'+escapeHtml((row.clauseIdentifiers||[]).join(", ")||"—")+'</td><td>'+escapeHtml((row.sourceRefs||[]).join(", "))+'</td></tr>');
    detail='<section class="planning-panel primary commercial-claims-management"><div class="planning-panel-head"><div><h4>Commercial Claims & Notices Management Position</h4><p>Claim lifecycle, contractual notice compliance and financial exposure reuse governed identities. Missing amounts or links remain unknown rather than zero.</p></div></div><div class="planning-panel-body">'+
      planningKpis([
        ["Lifecycle claims",cn.lifecycleClaimCount||0,"governed claims model"],
        ["Commercial claim rows",cn.commercialClaimCount||0,"currency-specific money register"],
        ["Events",cn.eventCount||0,"governed delay events"],
        ["Notices",cn.noticeCount||0,"governed notice records"],
        ["Money ↔ lifecycle linkage",cn.commercialLifecycleLinkCoveragePercent===null||cn.commercialLifecycleLinkCoveragePercent===undefined?"Not established":fmt(cn.commercialLifecycleLinkCoveragePercent)+"%","claim ID correspondence"],
        ["Evidence revision",cn.evidenceRevisionId||"Not established",humanizeKey(cn.state||"not_submitted")]
      ])+
      '<div class="commercial-visual-grid claims-lifecycle-grid">'+claimLifecycleVisual+noticeTimelinessVisual+noticeKindVisual+'</div>'+
      '<div class="section-heading compact"><div><h5>Commercial claim money register</h5><p>Amounts are shown from the controlled currency register; partial coverage is not promoted to a complete total.</p></div><span class="badge">'+escapeHtml(fmt((registers.claims||[]).length))+' records</span></div>'+
      table(["Claim","Claimed","Assessed","Currency","Source"],financialRows,"No governed commercial claim money rows are established.")+
      '<div class="section-heading compact"><div><h5>Claim lifecycle</h5><p>Claim state and time entitlement evidence remain distinct from financial valuation.</p></div><span class="badge">'+escapeHtml(fmt((cn.claims||[]).length))+' claims</span></div>'+
      table(["Claim","Title","State","Submitted","Claimed days","Assessed days","Assessment authority","Events","Clauses","Evidence"],lifecycleRows,"No governed claim lifecycle is established.")+
      '<div class="section-heading compact"><div><h5>Notice compliance assessment</h5><p>One governed assessment per delay event using the applicable requirement and earliest qualifying notice.</p></div><span class="badge">'+escapeHtml(fmt((cn.noticeAssessments||[]).length))+' events</span></div>'+
      table(["Event","Title","Requirement","Required","Event start","Notice","Issued","Elapsed","Timeliness","Requirement authority"],assessmentRows,"No governed notice compliance assessments are established.")+
      '<div class="section-heading compact"><div><h5>Notice register</h5><p>Actual issue/receipt timestamps and claim/event links remain traceable.</p></div><span class="badge">'+escapeHtml(fmt((cn.notices||[]).length))+' notices</span></div>'+
      table(["Notice","Type","Event","Claim","Issued","Received","Subject","Clauses","Evidence"],noticeRows,"No governed notice register is established.")+
      ((cn.diagnostics||[]).length?'<div class="notice info">'+escapeHtml(cn.diagnostics.map(humanizeKey).join("; "))+'</div>':"")+
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
    detail='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Security register</h4><p>Performance, advance-payment and retention securities remain distinct from cash balances.</p></div></div><div class="planning-panel-body">'+table(["Bond / guarantee","Type","Amount","Currency","Status","Expiry","Source"],rows,"No governed bond/security register is established.")+'</div></section>';
  }
  const cashEstablished=key==="cash-flow"&&Array.isArray(p.focus?.transactions)&&p.focus.transactions.length>0;
  const cashNote=key==="cash-flow"
    ? '<div class="notice '+(cashEstablished?'info':'warn')+'"><b>Cash-flow time series '+(cashEstablished?'uses explicit dated transactions.':'is evidence-gated.')+'</b> '+(cashEstablished?'Certificate and payment dates are retained for the transaction series.':'CMeng will not invent a time series from cumulative certificate totals. Dated certificate/payment transactions are required.')+'</div>'
    : "";
  const ledger=position.sourceLedger;
  let ledgerDetail="";
  if(ledger){
    const section=(moduleKey,rows,summary={})=>renderCommercialLedgerVisual({projectionKey:"commercial_canonical",moduleKey,rows,summary,dataDateIso:ledger.dataDateIso,diagnostics:ledger.diagnostics});
    if(key==="cost-forecast"||key==="commercial-overview") ledgerDetail=section("commercial-cost-position",ledger.costPosition)+section("commercial-cost-register",ledger.costMetrics);
    if(key==="payments"||key==="cash-flow") ledgerDetail=section("commercial-payment-register",ledger.payments,{effectiveRecordCount:ledger.payments.filter(r=>r.periodEnd&&ledger.dataDateIso&&r.periodEnd<=ledger.dataDateIso).length});
    if(key==="variations-change") ledgerDetail=section("commercial-variations",ledger.variations);
  }
  const evidencePanel='<section class="planning-panel"><div class="planning-panel-head"><div><h4>Evidence coverage</h4><p>Missing, submitted-but-unparsed and established positions are not interchangeable.</p></div></div><div class="planning-panel-body">'+gates+'</div></section>';
  if(key==="commercial-overview"){
    return '<section class="planning-view commercial-view commercial-overview-enterprise">'+
      commercialSummaryPanel('Executive Commercial Position','Contract, change, certification, cash and claim exposure are shown first, by currency, without cross-currency arithmetic.')+
      commercialCharts+
      time+
      registerVisual+
      foundationDetail+
      performanceDetail+
      contractControlDetail+
      detail+
      ledgerDetail+
      evidencePanel+
      '</section>';
  }
  if(key==="cost-forecast"){
    return '<section class="planning-view commercial-view cost-forecast-enterprise">'+
      performanceDetail+
      commercialSummaryPanel('Cost & Forecast Executive Position','Current contract, change and claim exposure stay isolated by currency while EAC scenarios remain authority-labelled.')+
      time+
      registerVisual+
      foundationDetail+
      detail+
      ledgerDetail+
      evidencePanel+
      '</section>';
  }
  if(key==="variations-change"){
    return '<section class="planning-view commercial-view variations-enterprise">'+
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
    return '<section class="planning-view commercial-view payments-enterprise">'+
      foundationDetail+
      commercialSummaryPanel('Payment Value Position by Currency','Certified, paid, unpaid, retention and advance positions come from the governed Commercial position.')+
      commercialCharts+
      time+
      detail+
      ledgerDetail+
      evidencePanel+
      '</section>';
  }
  if(key==="cash-flow"){
    return '<section class="planning-view commercial-view cash-flow-enterprise">'+
      performanceDetail+
      '<details class="cash-flow-evidence-detail"><summary><div><b>Evidence & governance</b><span>Source coverage and authority</span></div></summary><div class="cash-flow-evidence-body">'+gates+'</div></details>'+
      '</section>';
  }
  if(key==="commercial-claims-notices"){
    return '<section class="planning-view commercial-view commercial-claims-enterprise">'+
      detail+
      commercialSummaryPanel('Claim Financial Exposure by Currency','Known claimed and assessed values come from the controlled financial register. Partial amount coverage remains explicitly partial.')+
      commercialCharts+
      time+
      evidencePanel+
      '</section>';
  }
  if(key==="contract-particulars-bonds"){
    return '<section class="planning-view commercial-view contract-particulars-enterprise">'+
      contractControlDetail+
      foundationDetail+
      commercialSummaryPanel('Contract Value & Security Position by Currency','Contract and security values remain currency-isolated and source-authority labelled.')+
      commercialCharts+
      time+
      registerVisual+
      detail+
      evidencePanel+
      '</section>';
  }
  return '<section class="planning-view commercial-view">'+time+cashNote+commercialCharts+registerVisual+foundationDetail+performanceDetail+contractControlDetail+ledgerDetail+
    commercialSummaryPanel(names[key]||"Commercial position",'Values remain isolated by currency and every missing value retains its evidence state.')+
    detail+
    evidencePanel+
    '</section>';
}

function managementAuthorityBadge(authority){
  const label=String(authority||"unavailable").replaceAll("_"," ");
  const cls=["governed","source","source_current","calculated"].includes(authority)?"ready":["provisional","partial","conflicted","stale","candidate"].includes(authority)?"partial":"blocked";
  return '<span class="badge '+cls+'">'+escapeHtml(label)+'</span>';
}
function managementHealthBadge(health){
  const label=String(health||"unavailable").replaceAll("_"," ");
  const cls=health==="good"?"ready":health==="attention"?"partial":health==="critical"?"blocked":"blocked";
  return '<span class="badge '+cls+'">'+escapeHtml(label)+'</span>';
}
function managementModuleLink(key,label="Open owning module"){
  if(!key||!names[key])return '<span class="muted">No specialist correction route</span>';
  return '<button type="button" class="management-module-link" data-module="'+escapeHtml(key)+'">'+escapeHtml(label)+'</button>';
}
function managementPanel(title,description,body,primary=false){
  return '<section class="planning-panel '+(primary?'primary ':'')+'management-panel"><div class="planning-panel-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div></div><div class="planning-panel-body">'+body+'</div></section>';
}
function managementMetricDisplay(metric){
  const value=metric?.value;
  if(value===null||value===undefined)return{text:"Not established",kind:"missing"};
  if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)){
    return{text:planningShortDate(value),kind:"date"};
  }
  if(typeof value==="number"){
    return{text:fmtExecutive(value)+(metric?.unit?" "+metric.unit:""),kind:"number"};
  }
  return{text:String(value)+(metric?.unit?" "+metric.unit:""),kind:"text"};
}
function managementMetricBadges(metric){
  const state=metric?.state||"unavailable";
  const authority=metric?.authority||"unavailable";
  if(state===authority)return managementAuthorityBadge(state);
  const badge=(prefix,value)=>{
    const label=String(value||"unavailable").replaceAll("_"," ");
    const cls=["governed","source","source_current","calculated"].includes(value)?"ready":["provisional","partial","conflicted","stale","candidate"].includes(value)?"partial":"blocked";
    return '<span class="badge '+cls+'">'+escapeHtml(prefix+" · "+label)+'</span>';
  };
  return badge("State",state)+badge("Authority",authority);
}
function renderManagementMetricGrid(metrics){
  if(!Array.isArray(metrics)||!metrics.length)return'<div class="empty">No governed management metrics are available yet.</div>';
  return '<div class="management-metric-grid">'+metrics.map(m=>{
    const display=managementMetricDisplay(m);
    return '<article class="management-metric-card '+escapeHtml(m.health||"unavailable")+'">'+
      '<div class="management-metric-head"><span>'+escapeHtml(m.label)+'</span>'+((m.health==="unavailable"&&display.kind!=="missing")?"":managementHealthBadge(m.health))+'</div>'+
      '<div class="management-metric-value '+escapeHtml(display.kind)+'">'+escapeHtml(display.text)+'</div>'+
      '<div class="management-metric-badges">'+managementMetricBadges(m)+'</div>'+
      '<div class="management-metric-basis"><span>Basis</span><b>'+escapeHtml(m.basis||"Not established")+'</b></div>'+
      (m.consequence?'<div class="management-metric-note"><span>Consequence</span><p>'+escapeHtml(m.consequence)+'</p></div>':'')+
      (m.action?'<div class="management-metric-note action"><span>Action</span><p>'+escapeHtml(m.action)+'</p></div>':'')+
      '<div class="management-metric-owner">'+managementModuleLink(m.owningModule)+'</div>'+
      '</article>';
  }).join("")+'</div>';
}
function commercialFindingText(metric){
  if(metric==null)return"Not established";
  if(typeof metric!=="object")return typeof metric==="number"?fmtExecutive(metric):fmt(metric);
  if(metric.value===null||metric.value===undefined)return"Not established";
  return fmtExecutive(metric.value);
}
function commercialFindingTitle(metric){
  if(!metric||typeof metric!=="object")return"";
  return "State: "+humanizeKey(metric.state||"not_established")+(metric.diagnostics?.length?" · "+metric.diagnostics.join(" · "):"");
}
function renderManagementCommercial(rows){
  if(!Array.isArray(rows)||!rows.length)return '<div class="empty">No governed commercial currency position is established.</div>';
  const cell=m=>'<td title="'+escapeHtml(commercialFindingTitle(m))+'">'+escapeHtml(commercialFindingText(m))+'</td>';
  return '<div class="table-wrap"><table><thead><tr><th>Currency</th><th>Pending variations</th><th>Approved variations</th><th>Certified unpaid</th><th>Retention deducted</th><th>Held balance</th><th>Active bonds</th><th>Claimed</th><th>Assessed</th><th>LD scenario</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+escapeHtml(r.currency)+'</b></td>'+cell(r.pendingVariationAmount)+cell(r.approvedVariationAmount)+cell(r.certifiedUnpaidAmount)+cell(r.retentionDeductedAmount)+cell(r.retentionHeldAmount)+cell(r.activeBondAmount)+cell(r.claimClaimedAmount)+cell(r.claimAssessedAmount)+cell(r.ldScenarioAmount)+'</tr>').join("")+'</tbody></table></div>';
}
function renderManagementAlerts(alerts){
  if(!Array.isArray(alerts)||!alerts.length)return '<div class="notice info">No current management alert is generated from the governed project position.</div>';
  return '<div class="management-alert-list">'+alerts.map(a=>'<article class="management-alert '+escapeHtml(a.severity)+'"><div class="management-alert-head"><b>'+escapeHtml(a.title)+'</b><span>'+escapeHtml(a.severity)+'</span></div><p>'+escapeHtml(a.consequence)+'</p><div class="management-alert-action"><strong>Required action</strong><span>'+escapeHtml(a.action)+'</span></div><div>'+managementModuleLink(a.owningModule,"Open correction source")+'</div></article>').join("")+'</div>';
}
function renderManagementEvidenceGaps(gaps){
  if(!Array.isArray(gaps)||!gaps.length)return '<div class="notice info">No evidence gap is identified by the current management projection.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Evidence domain</th><th>State</th><th>Required correction</th><th>Owning source</th></tr></thead><tbody>'+gaps.map(g=>'<tr><td><b>'+escapeHtml(g.label)+'</b></td><td>'+managementAuthorityBadge(g.state)+'</td><td>'+escapeHtml(g.action)+'</td><td>'+managementModuleLink(g.owningModule,"Open")+'</td></tr>').join("")+'</tbody></table></div>';
}
function renderManagementControlVisual(key,data){
  if(key==="master-dashboard"){
    const r=data.readiness||{};
    const readinessDonut=renderDonutChart([
      {label:"Ready",value:r.ready??0,tone:"success"},
      {label:"Review needed",value:r.partial??0,tone:"warning"},
      {label:"Needs information",value:r.blocked??0,tone:"danger"}
    ],"Control views");
    return '<div class="planning-view management-view master-dashboard-view">'+
      managementPanel("Executive Project Position","Compact management position only. Every KPI retains state, authority, basis and an owning specialist route.",renderManagementMetricGrid(data.metrics||[]),true)+
      '<div class="management-two-column">'+
        managementPanel("Control Readiness","Readiness is based on specialist module state; missing evidence is not counted as a healthy zero.",readinessDonut)+
        managementPanel("Evidence Snapshot","The dashboard is a view of the current governed project evidence, not an independent data store.",planningKpis([
          ["Project documents",data.evidenceDocumentCount??0,"current evidence library"],
          ["Ready views",r.ready??0,"specialist positions"],
          ["Review needed",r.partial??0,"partial positions","warning"],
          ["Needs information",r.blocked??0,"blocked positions","danger"]
        ]))+
      '</div>'+
      managementPanel("Commercial Exposure by Currency","Currency values are never cross-summed without a governed FX basis.",renderManagementCommercial(data.commercialByCurrency||[]))+
      '<div class="notice info"><b>Dashboard rule:</b> a missing or ungoverned KPI remains unavailable. CMeng does not manufacture Overall Risk or Contract Risk scores from unrelated signals.</div>'+
      '</div>';
  }
  if(key==="command-center"){
    const d=data.decisions||[];
    const ctrl=data.controls||null;
    const decisionBody=d.length?'<div class="management-decision-list">'+d.map((item,i)=>'<article class="management-decision"><i>'+escapeHtml(i+1)+'</i><div><b>'+escapeHtml(item.description)+'</b><div class="management-decision-meta"><span>Owner: '+escapeHtml(item.accountableOwner||"Not assigned")+'</span><span>Due: '+escapeHtml(item.dueDate||"Not assigned")+'</span><span>Authority: '+escapeHtml(item.requiredAuthority||"Not assigned")+'</span><span>Dependency: '+escapeHtml(item.dependencyParty||"Not assigned")+'</span></div><small>Displayed for management review only. CMeng has not approved this action.</small></div></article>').join("")+'</div>':'<div class="notice info">No management decision/action is currently generated.</div>';
    const controlsBody=ctrl?planningKpis([
      ["Open risks",ctrl.riskEvidenceState==="established"?ctrl.openRiskCount:"Not established","governed risk source",ctrl.riskEvidenceState==="established"?"":"warning"],
      ["Major / critical NCR",ctrl.qualityEvidenceState==="established"?ctrl.openCriticalMajorNcrCount:"Not established","quality evidence",ctrl.openCriticalMajorNcrCount?"danger":""],
      ["Overdue RFI",ctrl.rfiEvidenceState==="established"?ctrl.overdueRfiCount:"Not established","RFI evidence",ctrl.overdueRfiCount?"danger":""],
      ["Permit issues",ctrl.permitEvidenceState==="established"?ctrl.overduePermitCount:"Not established","permit evidence",ctrl.overduePermitCount?"danger":""],
      ["Expired bonds",ctrl.bondEvidenceState==="established"?ctrl.expiredBondCount:"Not established","security evidence",ctrl.expiredBondCount?"danger":""],
      ["Expiring bonds",ctrl.bondEvidenceState==="established"?ctrl.expiringBondCount30Days:"Not established","next 30 days",ctrl.expiringBondCount30Days?"warning":""]
    ]):'<div class="empty">Project Director control position is not established.</div>';
    return '<div class="planning-view management-view command-center-view">'+
      managementPanel("Decisions Required","Decisions and accountable actions are the first operational control surface. Recommendations remain unapproved until responsible authority acts.",decisionBody,true)+
      managementPanel("Management Priorities","Current blockers and escalations from governed specialist positions, ordered before supporting KPIs.",renderManagementAlerts(data.alerts||[]))+
      managementPanel("Immediate Control Signals","Only established source populations are counted. Unavailable source domains remain explicitly unavailable.",controlsBody)+
      managementPanel("Current Programme Position","Supporting completion and programme facts used to understand the actions above.",renderManagementMetricGrid(data.programmePosition||[]))+
      managementPanel("Evidence Gaps","Each gap states what is missing and routes directly to the correction source.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      managementPanel("Commercial & Payment Position","Compact exposure only; detailed valuation remains in Commercial.",renderManagementCommercial(data.commercialByCurrency||[]))+
      '</div>';
  }
  if(key==="master-control-programme"){
    const r=data.revisionAuthority||{};
    const w=data.wbsControl||{};
    const s=data.scope||{};
    const positions=Array.isArray(data.specialistPositions)?data.specialistPositions:[];
    const candidates=Array.isArray(data.candidateInbox)?data.candidateInbox:[];
    const history=Array.isArray(data.controlHistory)?data.controlHistory:[];
    const positionRows=positions.map(p=>'<tr><td><b>'+escapeHtml(p.group)+'</b></td><td>'+escapeHtml(p.label)+'</td><td><span class="badge '+statusClass(p.status)+'">'+escapeHtml(statusLabel(p.status))+'</span></td><td>'+escapeHtml(p.reason||(p.status==="ready"?"Current governed position established.":"Current position requires review."))+'</td><td>'+managementModuleLink(p.key,"Open owner")+'</td></tr>').join("");
    const candidateRows=candidates.map(item=>'<tr><td><b>'+escapeHtml(item.label)+'</b></td><td>'+escapeHtml(humanizeKey(item.type))+'</td><td>'+managementAuthorityBadge(item.status)+'</td><td>'+escapeHtml(item.sourceRef)+'</td><td>'+managementModuleLink(item.owningModule,"Open owner")+'</td></tr>').join("");
    const historyRows=history.map(item=>'<tr><td>'+escapeHtml(formatDocumentTime(item.occurredAt))+'</td><td><b>'+escapeHtml(item.entity)+'</b></td><td>'+escapeHtml(item.action)+'</td><td>'+escapeHtml(item.actor||"System / not recorded")+'</td><td>'+managementAuthorityBadge(item.state)+'</td><td>'+escapeHtml(item.sourceRef||"—")+'</td></tr>').join("");
    return '<div class="planning-view management-view master-control-view">'+
      managementPanel("Integrated Governance Position","MCP is the control layer joining revision authority, observed structure, specialist positions, evidence gaps and review history. It is not a second source of truth.",planningKpis([
        ["Project",s.project||data.projectId,"selected management scope"],
        ["Programme membership",humanizeKey(s.programmeMembershipState||"not_established"),s.programme||"not established",s.programmeMembershipState==="established"?"":"warning"],
        ["Current programme",r.currentLabel||"Not established",r.currentDataDateIso?planningShortDate(r.currentDataDateIso):"no Data Date",r.currentRevisionId?"success":"warning"],
        ["Controlled baseline",r.baselineLabel||"Not established",r.baselineRevisionId||"no governed baseline",r.baselineRevisionId?"success":"warning"],
        ["Governed revisions",r.governedRevisionCount??0,"non-recovery revisions"],
        ["Recovery scenarios",r.recoveryScenarioCount??0,"never auto-promoted"]
      ]),true)+
      managementPanel("WBS & Work-Package Control","Observed WBS labels are schedule evidence. They do not become approved work packages unless a governed package hierarchy establishes them.",planningKpis([
        ["Observed WBS",w.observedWbsCount??0,"source labels"],
        ["Activities",w.activityCount??0,"current programme"],
        ["WBS activity coverage",w.observedCoveragePercent===null||w.observedCoveragePercent===undefined?"Not established":fmt(w.observedCoveragePercent)+"%","observed mapping"],
        ["Official package coverage",w.officialWorkPackageCoveragePercent===null||w.officialWorkPackageCoveragePercent===undefined?"Not established":fmt(w.officialWorkPackageCoveragePercent)+"%",humanizeKey(w.officialWorkPackageState||"not_established"),w.officialWorkPackageState==="established"?"success":"warning"]
      ])+(w.observedWbsLabels?.length?'<details class="management-detail"><summary>Observed WBS labels <span>'+escapeHtml(fmt(w.observedWbsLabels.length))+' labels</span></summary><div class="management-tag-list">'+w.observedWbsLabels.map(label=>'<span>'+escapeHtml(label)+'</span>').join("")+'</div></details>':""))+
      managementPanel("Specialist Positions","MCP displays the current specialist position and correction route. Users correct the owning source, not the MCP row.",positionRows?'<div class="table-wrap"><table><thead><tr><th>Workstream</th><th>Position</th><th>Status</th><th>Reason</th><th>Correction source</th></tr></thead><tbody>'+positionRows+'</tbody></table></div>':'<div class="empty">No specialist positions are established.</div>')+
      managementPanel("Live Alert Feed","The same governed alert set used by Command Center is shown here for integrated control.",renderManagementAlerts(data.alerts||[]))+
      managementPanel("AI / Extracted Candidate Review Inbox","Candidates are visible with their source evidence, but this release is read-only: no candidate can directly author the official MCP position. Promotion/rejection/defer must use the controlled owning-module workflow.",candidateRows?'<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Type</th><th>Status</th><th>Source evidence</th><th>Owning module</th></tr></thead><tbody>'+candidateRows+'</tbody></table></div>':'<div class="notice info">No current candidate is waiting for review.</div>')+
      managementPanel("Evidence Gaps","Integrated governance is only as strong as its specialist evidence. Missing, stale, partial and conflicted states stay visible.",renderManagementEvidenceGaps(data.evidenceGaps||[]))+
      managementPanel("Control History","Audit history records evidence updates, board publications and the latest certified recalculation. It does not invent actors that were not recorded.",historyRows?'<div class="table-wrap"><table><thead><tr><th>Date/time</th><th>Entity</th><th>Action</th><th>Actor</th><th>State</th><th>Source</th></tr></thead><tbody>'+historyRows+'</tbody></table></div>':'<div class="empty">No management-control history is available.</div>')+
      '</div>';
  }
  return"";
}

function renderSpecializedModule(key,data){
  if(["master-dashboard","command-center","master-control-programme"].includes(key))return renderManagementControlVisual(key,data);
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
function renderModuleBasis(data){
  const root=findProjectionRoot(data);
  const revision=root.sourceRevisionId||root.evidenceRevisionId||root.scheduleRevisionId||root.boqRevisionId||root.basisRevisionId||root.forecast?.basisRevisionId||null;
  const asOf=root.dataDateIso||root.asOfIso||overview?.latestDataDateIso||null;
  const coverage=root.activityCoveragePercent??root.currentDateCoveragePercent??root.coveragePercent??root.floatCoveragePercent??root.progress?.durationWeightedProgressCoveragePercent??root.schedule?.floatCoveragePercent??null;
  const overviewProgramme=overview?.latestRevisionLabel?planningRevisionLabel(overview.latestRevisionLabel):null;
  const revisionText=overviewProgramme||(revision&&(String(revision).length>28||String(revision).includes("rev_")||String(revision).includes("schedrev_"))?"Current programme":revision);
  const values=[
    ["Programme basis",revisionText],
    ["Data date",asOf?planningShortDate(asOf):asOf],
    ["Coverage",typeof coverage==="number"?fmt(coverage)+"%":coverage]
  ].filter(([,value])=>value!==null&&value!==undefined&&String(value).length>0);
  if(!values.length)return"";
  return '<div class="module-basis">'+values.map(([label,value])=>'<span class="basis-chip"><b>'+escapeHtml(label)+'</b><strong title="'+escapeHtml(label==="Programme basis"&&revision?revision:value)+'">'+escapeHtml(value)+'</strong></span>').join("")+'</div>';
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
  const messages={
    "schedule-analytics":"Programme health is available from the submitted schedule. The independent path check still needs review before it can be confirmed.",
    "activity-analytics":"Activity dates, progress and float are available. The independent path check still needs review.",
    "near-critical":"The near-critical watchlist is based on the submitted programme float while the independent path check is still under review.",
    "revision-trend":"Only one controlled programme revision is available, so movement over time cannot yet be compared.",
    "schedule-change-report":"A second controlled programme revision is needed before CMeng can compare programme changes.",
    "forecast-history":"Only one controlled forecast point is available, so a trend cannot yet be shown."
  };
  return messages[key]||String(reason)
    .replace(/independent CPM/gi,"independent path check")
    .replace(/driving-path/gi,"driving path")
    .replace(/projection/gi,"analysis")
    .replace(/evidence/gi,"project information");
}
function renderModuleResult(result){
  currentModuleResult=result;
  renderRoleViewSelector();
  const managementSurface=managementSurfaceKeysForApi.has(result.key);
  el("roleViewSelector").style.display=managementSurface?"none":"";
  const moduleName=names[result.key]||result.key;
  const roleLabel=managementSurface?"Management Control":(roleViews[selectedRoleView]?.label||roleViews.overall.label);
  el("moduleTitle").textContent=moduleName;
  el("moduleSubtitle").textContent=(descriptions[result.key]||"Current position, key changes and actions requiring attention.")+(managementSurface?"":" · "+roleLabel);
  el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="badge "+statusClass(result.status);
  el("moduleBadge").textContent=statusLabel(result.status);
  if(result.status==="blocked"){
    const blockedBody='<div class="view-state-bar"><span class="view-state-review">Calculation stopped</span><strong>'+escapeHtml(moduleName)+'</strong><span>More project information is required before this view can be calculated.</span></div><div class="notice warn"><b>This view needs additional project information</b><br>'+escapeHtml(result.reason||"Required project information is not yet available.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required information</b><span>'+escapeHtml(humanizeKey(x))+'</span></div>').join("")+'</div>';
    el("moduleContent").innerHTML=renderRoleContent(result.key,{},blockedBody,"",false);
    return;
  }
  const data=result.data||{};
  if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason))return;
  const basisHtml=renderModuleBasis(data);
  const challengeBody=renderUniversalChallenge(data.challenge);
  const challengeHtml=challengeBody?'<details class="reconciliation-panel"><summary><span>Reconciliation with submitted position</span><b>'+(data.challenge?.challengedCount?escapeHtml(data.challenge.challengedCount)+' needs attention':'No material difference')+'</b></summary><div class="reconciliation-body">'+challengeBody+'</div></details>':'';
  const specialized=renderSpecializedModule(result.key,data);
  const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");
  const structured=specialized?"":renderStructuredSections(data);
  const genericView=(scalars?'<div class="scalar-grid">'+scalars+'</div>':'')+structured;
  const primaryView=specialized||genericView;
  const generated=data.challenge?.generatedAt||findProjectionRoot(data)?.generatedAt||data.generatedAt||null;
  const viewState=result.status==="ready"?"":'<div class="view-state-bar"><span class="view-state-review">Review needed</span><strong>'+escapeHtml(moduleName)+'</strong>'+(generated?'<span>Updated '+escapeHtml(formatDocumentTime(generated))+'</span>':'')+'</div>';
  el("directorDrawer").open=false;
  const userReason=userFacingModuleReason(result.key,result.reason);
  const context=viewState+basisHtml+(userReason?'<div class="notice info">'+escapeHtml(userReason)+'</div>':'');
  el("moduleContent").innerHTML=managementSurface?context+primaryView:context+renderRoleContent(result.key,data,primaryView,challengeHtml,Boolean(specialized));
}
let moduleRequestSeq=0;
const managementSurfaceKeysForApi=new Set(["master-dashboard","command-center","master-control-programme"]);
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
  if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}
  const moduleName=names[key]||key;
  const requestSeq=++moduleRequestSeq;
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
      result=await api("/api/projects/"+encodeURIComponent(project())+"/management/"+encodeURIComponent(key));
    }else{
      const moduleArea=commercialModuleKeysForApi.has(key)?"commercial":"schedule";
      result=await api("/api/projects/"+encodeURIComponent(project())+"/"+moduleArea+"/modules/"+encodeURIComponent(key));
    }
    if(requestSeq!==moduleRequestSeq)return;
    renderModuleResult(result);
  }catch(e){
    if(requestSeq!==moduleRequestSeq)return;
    const d=e.data||{};
    renderModuleResult({key,status:"blocked",reason:d.reason||d.error||e.message,dependencies:d.dependencies||[]});
  }finally{
    if(requestSeq===moduleRequestSeq)setBusy("");
  }
}
function kpi(label,value,sub=""){return'<div class="card kpi-card"><div class="kpi-label">'+escapeHtml(label)+'</div><div class="kpi-value">'+escapeHtml(fmt(value))+'</div><div class="kpi-sub">'+escapeHtml(sub)+'</div></div>'}
function evidenceCount(state,value){if(state==="established")return fmt(value);if(state==="submitted_unparsed")return"Source submitted · count not established";return"Not provided"}
function renderDirector(d){if(!d){el("director").innerHTML='<div class="card"><div class="empty">Director position will populate only when its governed schedule, contract, claims/EOT and commercial dependencies are available.</div></div>';return}const s=d.schedule,c=d.claims,ctrl=d.controls;let html='<div class="grid kpi">'+kpi("Data Date",s.dataDateIso)+kpi("Contract Completion",s.contractualCompletionIso||"Not established")+kpi("Official Adjusted Completion",s.officialAdjustedCompletionIso||"Not established")+kpi("Submitted Programme Finish",s.submittedProgrammeCompletionIso||"Not established")+kpi("Independent Forecast",s.independentForecastCompletionIso||"Not established")+kpi("Programme movement",c.observedProgrammeMovementDays,"days carried from schedule windows")+kpi("Time-impact candidate",c.analyticalTimeImpactCandidateDays,"analytical, not entitlement")+kpi("Attributable EOT candidate",c.attributableCandidateEotDays,"analytical, not awarded")+kpi("Official EOT",c.officialApprovedEotDays,"governed award only")+kpi("CPM integrity",s.independentCpmState,s.drivingPathState)+kpi("Claims linked",c.fullyLinkedClaimCount+" / "+c.claimCount,"claim → event → activity")+kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),d.ld.state)+'</div>';html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';(d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention deducted",r.retentionDeductedAmount],["Held balance",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line" title="'+escapeHtml(commercialFindingTitle(x[1]))+'"><span>'+x[0]+'</span><strong>'+escapeHtml(commercialFindingText(x[1]))+'</strong></div>').join("")+'</div>'});html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+'<div class="scalar"><b>Open HSE</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openHseIncidentCount))+'</span></div>'+'<div class="scalar"><b>LTI or worse</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openLtiOrWorseCount))+'</span></div>'+'<div class="scalar"><b>Major / critical NCR</b><span>'+escapeHtml(evidenceCount(ctrl.qualityEvidenceState,ctrl.openCriticalMajorNcrCount))+'</span></div>'+'<div class="scalar"><b>Overdue RFI</b><span>'+escapeHtml(evidenceCount(ctrl.rfiEvidenceState,ctrl.overdueRfiCount))+'</span></div>'+'<div class="scalar"><b>Permit issues</b><span>'+escapeHtml(evidenceCount(ctrl.permitEvidenceState,ctrl.overduePermitCount))+'</span></div>'+'<div class="scalar"><b>Expiring bonds</b><span>'+escapeHtml(evidenceCount(ctrl.bondEvidenceState,ctrl.expiringBondCount30Days))+'</span></div>'+'<div class="scalar"><b>Open risks</b><span>'+escapeHtml(evidenceCount(ctrl.riskEvidenceState,ctrl.openRiskCount))+'</span></div>'+'</div></div></div>';el("director").innerHTML=html}
function renderStatus(o){const ready=o.moduleStates.filter(x=>x.status==="ready").length,partial=o.moduleStates.filter(x=>x.status==="partial").length,blocked=o.moduleStates.filter(x=>x.status==="blocked").length;el("projectBadge").className="badge "+(o.demo?"partial":"ready");el("projectBadge").textContent=o.demo?"DEMONSTRATION PROJECT":"CURRENT PROJECT";el("projectStatus").innerHTML='<div class="scalar-grid">'+'<div class="scalar"><b>Baseline / revised baseline</b><span>'+fmt(o.baselineRevisionCount)+'</span></div>'+'<div class="scalar"><b>Updates</b><span>'+fmt(o.updateRevisionCount)+'</span></div>'+'<div class="scalar"><b>Recovery scenarios</b><span>'+fmt(o.recoveryRevisionCount)+'</span></div>'+'<div class="scalar"><b>Current Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+'<div class="scalar"><b>Project documents</b><span>'+fmt(o.evidenceDocumentCount)+'</span></div>'+'<div class="scalar"><b>Available views</b><span>'+ready+' / '+fmt(o.moduleStates.length)+'</span></div>'+'<div class="scalar"><b>Needs review</b><span>'+partial+'</span></div>'+'<div class="scalar"><b>Needs information</b><span>'+blocked+'</span></div>'+'</div>'}
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
      '<div class="document-state-item"><b>Reading result</b><span>Read complete means the current extraction pass finished. Read partial/Identified only means the pass finished but less structured information was obtained. Full OCR required means full OCR has not completed; it is not a live background job.</span></div>'+
    '</div></div>';
    const bulkBar='<div class="evidence-bulk-bar"><label><input type="checkbox" class="evidence-select-all" id="evidenceSelectAll"> Select all</label><span class="evidence-bulk-count" id="evidenceSelectedCount">0 selected</span><span class="bulk-spacer"></span><button class="document-delete" id="deleteSelectedButton" disabled>Delete selected</button></div>';
    el("evidenceLibrary").innerHTML=guide+bulkBar+'<div class="table-wrap"><table><thead><tr><th class="select-col"></th><th>Full document name</th><th>Last uploaded / updated</th><th>Document type</th><th>How CMeng uses it</th><th>Effect on current record</th><th>CMeng confidence</th><th>Read from</th><th>Document conflict</th><th>Reading result</th><th>Programme role</th><th>Activity links</th><th></th></tr></thead><tbody>'+data.documents.map(d=>{
      const m=d.mapping;
      const i=d.identification||{};
      const mapping=!m||m.linkedActivityCount===null?"—":fmt(m.mappedActivityCount)+" / "+fmt(m.linkedActivityCount)+(m.coveragePercent===null?"":" ("+fmt(m.coveragePercent)+"%)");
      const confidence=i.confidence===undefined?"—":fmt(i.confidence*100)+"%";
      const conflict=i.classificationConflict?"YES":"No";
      const method=(i.method||"—")+(i.ocrUsed?" / OCR":"");
      const title=i.detectedTitle?'<br><span class="muted">'+escapeHtml(i.detectedTitle)+'</span>':"";
      const full=d.sourceRelativePath||d.sourceFilename;
      const position=documentUseLabel(d.basisState||"historical",d);
      const positionClass=d.basisState==="active"?"ready":d.basisState==="candidate"?"partial":"";
      const readLabel=documentReadLabel(d.parserState);
      const readNote=documentReadNote(d.parserState);
      const checked=selectedEvidenceDocuments.has(d.documentId)?" checked":"";
      return '<tr><td class="select-col"><input type="checkbox" class="evidence-select" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'"'+checked+'></td><td class="document-file" title="'+escapeHtml(full)+'"><b>'+escapeHtml(d.sourceFilename)+'</b><span class="muted">'+escapeHtml(full)+'</span></td><td class="document-updated" title="'+escapeHtml(d.uploadedAt||"")+'"><b>'+escapeHtml(formatDocumentTime(d.uploadedAt))+'</b><small>'+escapeHtml(d.uploadedAt||"—")+'</small></td><td><b>'+escapeHtml(humanizeKey(d.category))+'</b><br>'+escapeHtml(humanizeKey(d.documentType))+title+'</td><td class="document-position"><span class="badge '+positionClass+'">'+escapeHtml(position)+'</span></td><td>'+escapeHtml(humanizeKey(d.lineage?.effect||"unknown"))+(d.lineage?.replacesEntireBasis?'<br><span class="badge partial">replaces current document</span>':d.lineage?.appliesAsDelta?'<br><span class="badge">additional record</span>':'')+'</td><td>'+escapeHtml(confidence)+(i.needsReview?'<br><span class="badge partial">review</span>':'')+'</td><td>'+escapeHtml(humanizeKey(method))+'</td><td>'+escapeHtml(conflict)+'</td><td title="'+escapeHtml(readNote)+'"><b>'+escapeHtml(readLabel)+'</b><br><span class="muted">'+escapeHtml(readNote)+'</span></td><td>'+escapeHtml(d.scheduleRole?humanizeKey(d.scheduleRole):"—")+'</td><td>'+escapeHtml(mapping)+'</td><td><button class="document-delete document-delete-single" data-document-id="'+escapeHtml(d.documentId)+'" data-filename="'+escapeHtml(d.sourceFilename)+'">Delete</button></td></tr>';
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
  const forecast=p.forecastCompletionIso||"Not established";
  const movement=p.programmeMovementDays===null||p.programmeMovementDays===undefined?"—":fmt(p.programmeMovementDays)+" days";
  const claims=p.claimCount===null||p.claimCount===undefined?"—":fmt(p.claimCount)+" claim"+(p.claimCount===1?"":"s");
  const eot=p.approvedEotDays===null||p.approvedEotDays===undefined?"No approved EOT":fmt(p.approvedEotDays)+" days approved EOT";
  const attention=(p.managementActions||[])[0]||(
    p.positionState==="needs_information"
      ?"Add the core programme and BOQ records to establish the current position."
      :p.positionState==="needs_review"
        ?"Update the project position using the latest project records."
        :"No immediate management action identified."
  );
  const attentionClass=p.managementActionCount||p.positionState!=="current"?"project-attention":"project-attention no-action";
  return '<article class="portfolio-project">'+
    '<div class="portfolio-project-main">'+
      '<div class="portfolio-project-title"><h3>'+escapeHtml(p.projectId)+'</h3>'+
        '<div class="project-meta">'+escapeHtml(p.latestDataDateIso||"No current data date")+' · '+escapeHtml(p.revisionCount)+' programme revision'+(p.revisionCount===1?"":"s")+' · '+escapeHtml(p.evidenceDocumentCount)+' documents</div>'+
        '<span class="position-chip '+positionClass+'">'+positionLabel+'</span></div>'+
      '<div class="portfolio-project-metric"><span>CMeng forecast</span><strong>'+escapeHtml(forecast)+'</strong><small>'+escapeHtml(p.officialCompletionIso?"Official: "+p.officialCompletionIso:"No official completion established")+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Programme movement</span><strong>'+escapeHtml(movement)+'</strong><small>Observed from programme updates</small></div>'+
      '<div class="portfolio-project-metric"><span>Claims / EOT</span><strong>'+escapeHtml(claims)+'</strong><small>'+escapeHtml(eot)+'</small></div>'+
      '<div class="portfolio-project-metric"><span>Management</span><strong>'+escapeHtml(p.managementActionCount||0)+' action'+((p.managementActionCount||0)===1?"":"s")+'</strong><small>'+escapeHtml(p.commercialCurrencyCount?fmt(p.commercialCurrencyCount)+" commercial currenc"+(p.commercialCurrencyCount===1?"y":"ies"):"No commercial position")+'</small></div>'+
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

  el("projectRegister").innerHTML='<div class="table-wrap"><table><thead><tr><th>Project</th><th>Data date</th><th>Documents</th><th>Programme revisions</th><th>Current position</th><th>Management actions</th><th></th></tr></thead><tbody>'+projects.map(p=>{const position=positionText(p)[1];return'<tr><td><b>'+escapeHtml(p.projectId)+'</b></td><td>'+escapeHtml(p.latestDataDateIso||"—")+'</td><td>'+escapeHtml(p.evidenceDocumentCount)+'</td><td>'+escapeHtml(p.revisionCount)+'</td><td>'+escapeHtml(position)+'</td><td>'+escapeHtml(p.managementActionCount||0)+'</td><td><button class="btn small open-project" data-project="'+escapeHtml(p.projectId)+'">Open</button></td></tr>'}).join("")+'</tbody></table></div>';

  bindProjectOpeners();
}
async function loadPortfolio(){
  try{portfolioData=await api("/api/portfolio");renderPortfolio()}catch(e){el("portfolioProjects").innerHTML='<div class="notice error">Projects could not be loaded: '+escapeHtml(e.message)+'</div>'}
}
function updateActiveProjectShell(){
  const id=overview?.projectId||project();
  el("activeProjectName").textContent=overview?id:"No project selected";
  el("activeProjectMeta").textContent=overview?((overview.latestDataDateIso||"No data date")+" · "+overview.evidenceDocumentCount+" project documents"):"Open a project from Portfolio or Projects";
  el("aiProjectBadge").className="badge "+(overview?"ready":"");
  el("aiProjectBadge").textContent=overview?id:"No active project";
  el("aiProjectInfo").innerHTML=overview?'<b>'+escapeHtml(id)+'</b><br>'+escapeHtml(overview.evidenceDocumentCount)+' evidence documents<br>'+escapeHtml(overview.revisionCount)+' schedule revisions<br>'+escapeHtml(overview.latestDataDateIso||"No current data date"):'No project selected.';
}
function setAppView(view){
  appView=view;
  ["portfolio","projects","ai"].forEach(name=>{el(name+"View").hidden=view!==name});
  el("projectWorkspace").hidden=view!=="project";
  document.body.classList.toggle("project-active",view==="project"&&!!overview);
  const titles={portfolio:"Portfolio",projects:"Projects",ai:"Ask CMeng",project:overview?.projectId||"Project Controls"};
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
    try{renderDirector(null)}catch{}

    await Promise.allSettled([
      loadModule(selected),
      loadEvidence()
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
    button.setAttribute("aria-expanded",String(enabled));
  }
}
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
document.addEventListener("click",event=>{
  const button=event.target.closest?.(".management-module-link");
  if(!button)return;
  const key=button.dataset.module;
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
  const status=statusLabel(currentModuleResult.status);
  const styles=[...document.querySelectorAll("style")].map(node=>node.textContent||"").join("\n");
  const body=el("moduleContent").innerHTML;
  const excelUrl=reportDownloadUrl("xlsx");
  const jsonUrl=reportDownloadUrl("json");
  const filename=reportSafeFilename(project()+"_"+moduleName+"_"+roleLabel+"_"+new Date().toISOString().slice(0,10));
  const report='<html><head><meta charset="utf-8"><title>'+escapeHtml(project()+" · "+moduleName)+'</title><style>'+styles+
    '.report-shell{max-width:1180px;margin:0 auto;padding:28px;background:#fff}.report-header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #315f8a;padding-bottom:16px;margin-bottom:16px}.report-brand{font-size:13px;font-weight:900;letter-spacing:.08em;color:#315f8a}.report-header h1{font-size:26px;margin:5px 0 4px;color:#22364d}.report-header p{margin:0;color:#667085}.report-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0 20px}.report-meta div{padding:10px 12px;border:1px solid #dce5ef;border-radius:8px;background:#f8fbff}.report-meta span{display:block;font-size:9px;text-transform:uppercase;font-weight:800;letter-spacing:.05em;color:#7b8795}.report-meta b{display:block;margin-top:3px;font-size:12px;color:#22364d}.report-toolbar{position:sticky;top:0;z-index:100;display:flex;gap:8px;justify-content:flex-end;padding:10px 0 14px;background:#fff}.report-toolbar a,.report-toolbar button{border:1px solid #bfd0e1;background:#fff;color:#22364d;border-radius:7px;padding:8px 12px;font:600 12px Arial;cursor:pointer;text-decoration:none}.report-toolbar .primary{background:#315f8a;color:#fff;border-color:#315f8a}.visual-focus-button{display:none!important}.module-workspace,.module-panel{box-shadow:none!important;border:0!important}.reconciliation-panel{break-inside:avoid}.planning-panel,.chart-card,.card{break-inside:avoid}@media print{body{background:#fff!important}.report-shell{max-width:none;padding:0}.report-toolbar{display:none!important}.planning-view .table-wrap{max-height:none!important;overflow:visible!important}.lookahead-timeline,.milestone-timeline{max-height:none!important;overflow:visible!important}.auxiliary-drawer{display:none!important}}'+
    '</style></head><body><div class="report-shell"><div class="report-toolbar"><button id="reportPrint" class="primary">Save PDF / Print</button><a href="'+escapeHtml(excelUrl)+'" download>Download Excel</a><a href="'+escapeHtml(jsonUrl)+'" download>Download data</a></div>'+
    '<header class="report-header"><div><div class="report-brand">CMENG · PROJECT CONTROL INTELLIGENCE</div><h1>'+escapeHtml(moduleName)+'</h1><p>'+escapeHtml(subtitle)+'</p></div><div><b>'+escapeHtml(project())+'</b></div></header>'+
    '<div class="report-meta"><div><span>Project</span><b>'+escapeHtml(project())+'</b></div><div><span>Review lens</span><b>'+escapeHtml(roleLabel)+'</b></div><div><span>Programme basis</span><b>'+escapeHtml(programme)+'</b></div><div><span>Data date</span><b>'+escapeHtml(dataDate)+'</b></div><div><span>Report generated</span><b>'+escapeHtml(generated)+'</b></div><div><span>View status</span><b>'+escapeHtml(status)+'</b></div></div>'+
    '<main>'+body+'</main><footer style="margin-top:22px;padding-top:10px;border-top:1px solid #dce5ef;font-size:10px;color:#7b8795">Generated from the current CMeng project position. Missing, partial, provisional and official values remain distinct.</footer></div></body></html>';
  reportWindow.document.open();
  reportWindow.document.write(report);
  reportWindow.document.close();
  if(["overall","planning","controls"].includes(selectedRoleView))reportWindow.document.querySelectorAll("details").forEach(node=>node.open=true);else reportWindow.document.querySelectorAll("details:not(.role-supporting-detail)").forEach(node=>node.open=true);
  const printButton=reportWindow.document.getElementById("reportPrint");
  if(printButton)printButton.onclick=()=>reportWindow.print();
  reportWindow.document.title=filename;
}

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
