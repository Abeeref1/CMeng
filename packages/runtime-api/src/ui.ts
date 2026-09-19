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
.module-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.module-head-actions{display:flex;align-items:center;gap:8px}.module-head h3{font-size:18px;margin:0}
.director-section{margin-top:24px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:14px;margin:0 0 12px}.section-heading h3{font-size:20px;margin:0 0 3px;letter-spacing:-.02em}.section-heading p{font-size:13px;color:var(--muted);margin:0}
.scalar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:11px;margin-bottom:14px}.scalar{background:#f7f5f1;padding:13px 14px;border-radius:9px;border:1px solid #e8e3db;min-width:0}.scalar b{display:block;font-size:11.5px;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;font-weight:750}.scalar span{font-size:15px;font-weight:680;word-break:break-word}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:min(66vh,680px);background:#fff;scrollbar-color:#c7d2df transparent;scrollbar-width:thin}table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f1eee9;color:#55616d;font-weight:780;position:sticky;top:0;z-index:2;font-size:11.5px;letter-spacing:.025em;white-space:nowrap;text-transform:none}td{color:#27364a}tbody tr:nth-child(even) td{background:#fbfaf8}tbody tr:hover td{background:#f5f2ed}tr:last-child td{border-bottom:0}.kpi-value,.position-value,.scalar span,.currency-line strong,.movement-value,.candidate-value{font-variant-numeric:tabular-nums}.module-panel{position:relative}.module-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#4f7fb4,#a9c1da);z-index:3}.module-basis{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.basis-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 9px;border:1px solid #dbe4ee;border-radius:9px;background:#fff;font-size:11.5px;color:#506579}.basis-chip b{font-size:10px;color:#738198;text-transform:uppercase;letter-spacing:.05em}.basis-chip strong{font-size:11.5px;color:#2e3a46;font-weight:780}.focus-module .director-section,.focus-module .workspace-drawer,.focus-module .footer-note,.focus-module .workspace-header,.focus-module .quick-upload-bar{display:none}.focus-module .content{padding-top:18px}.focus-module .module-panel{min-height:calc(100vh - 112px)}.focus-module .module-panel #moduleContent{min-height:calc(100vh - 190px)}
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
.planning-view{display:grid;gap:14px}.planning-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.planning-kpi{min-height:94px;padding:14px 15px;border:1px solid #dce5ef;border-radius:11px;background:#fff;box-shadow:0 5px 16px rgba(34,54,77,.035)}.planning-kpi span{display:block;font-size:10.5px;color:#718096;font-weight:800;text-transform:uppercase;letter-spacing:.045em}.planning-kpi strong{display:block;margin-top:7px;font-size:21px;line-height:1.1;color:#22364d;letter-spacing:-.025em}.planning-kpi small{display:block;margin-top:6px;font-size:11px;color:#7b8795}.planning-kpi.danger{border-top:3px solid #b4483e}.planning-kpi.warning{border-top:3px solid #b57922}.planning-kpi.success{border-top:3px solid #2c7a57}.planning-kpi.accent{border-top:3px solid #4f7fb4}
.planning-primary-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.85fr);gap:14px}.planning-panel{border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(34,54,77,.035)}.planning-panel.primary{box-shadow:0 9px 26px rgba(34,54,77,.055)}.planning-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px 12px;border-bottom:1px solid #e5ebf2;background:#fbfdff}.planning-panel-head h4{margin:0;font-size:15px;color:#22364d}.planning-panel-head p{margin:3px 0 0;font-size:11.5px;color:#718096}.planning-panel-body{padding:15px 16px}.planning-split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.planning-split h5{margin:0 0 10px;font-size:12.5px;color:#506579}
.status-band{height:42px;display:flex;overflow:hidden;border-radius:9px;border:1px solid #dce5ef;background:#f6f8fb}.status-band-segment{min-width:28px;display:flex;flex-direction:column;justify-content:center;padding:0 8px;color:#fff;overflow:hidden}.status-band-segment span{font-size:9.5px;font-weight:800;white-space:nowrap}.status-band-segment b{font-size:12px}.status-band-segment.danger{background:#b4483e}.status-band-segment.warning{background:#b57922}.status-band-segment.success{background:#2c7a57}.status-band-segment.accent{background:#4f7fb4}.status-band-segment.neutral{background:#91a0b0}.status-band-legend{display:flex;flex-wrap:wrap;gap:9px 14px;margin-top:9px}.status-band-legend span{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#667085}.status-band-legend i{width:8px;height:8px;border-radius:2px;background:#91a0b0}.status-band-legend i.danger{background:#b4483e}.status-band-legend i.warning{background:#b57922}.status-band-legend i.success{background:#2c7a57}.status-band-legend i.accent{background:#4f7fb4}.status-band-legend b{color:#344054}
.coverage-line{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f5;font-size:11.5px;color:#667085}.coverage-line b{color:#22364d}.coverage-stack{display:grid;gap:7px;margin-top:12px}.coverage-stack span{display:flex;justify-content:space-between;font-size:11.5px;color:#667085}.coverage-stack b{color:#22364d}
.date-ladder{display:grid;gap:10px}.date-ladder-row{display:grid;grid-template-columns:165px minmax(0,1fr);gap:12px;align-items:center}.date-ladder-label b{display:block;font-size:11.5px;color:#344054}.date-ladder-label span{display:block;font-size:10.5px;color:#7b8795;margin-top:2px}.date-ladder-track{position:relative;height:20px;border-radius:999px;background:#f1f4f8;border:1px solid #e2e8f0}.date-marker{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 0 0 1px rgba(45,55,72,.12)}.date-marker.baseline{background:#68788b}.date-marker.current{background:#4f7fb4}.date-marker.cmeng{background:#5055a8}.date-marker.scenario{background:#7c5ca8}.date-marker.actual{background:#2c7a57}.date-data-line{position:absolute;top:-5px;bottom:-5px;width:1px;background:#1f2937;opacity:.35}.date-ladder-key,.milestone-key{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:10.5px;color:#667085}.date-ladder-key span,.milestone-key span{display:inline-flex;align-items:center;gap:5px}.date-ladder-key i,.milestone-key i{width:9px;height:9px;border-radius:50%;background:#68788b}.date-ladder-key i.current,.milestone-key i.current{background:#4f7fb4}.date-ladder-key i.cmeng{background:#5055a8}.date-ladder-key i.scenario{background:#7c5ca8}.milestone-key i.actual{background:#2c7a57}.milestone-key i.data{width:1px;height:12px;border-radius:0;background:#1f2937}
.management-attention{display:grid;gap:8px}.management-attention-row{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;border-left:3px solid #b57922;background:#fffaf0;border-radius:7px}.management-attention-row.danger{border-left-color:#b4483e;background:#fff6f5}.management-attention-row b{display:block;font-size:11.5px;color:#344054}.management-attention-row span{display:block;margin-top:3px;font-size:10.5px;color:#667085;line-height:1.35}.management-attention-row strong{flex:0 0 auto;font-size:13px;color:#22364d}.attention-clear{padding:13px;border:1px solid #d7eadf;background:#f4fbf7;border-radius:9px;font-size:11.5px;color:#2c6a4c}
.management-health-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.integrity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.integrity-card{padding:12px;border:1px solid #dce5ef;border-radius:9px;background:#fff}.integrity-card span{display:block;font-size:10.5px;color:#667085}.integrity-card b{display:block;margin-top:4px;font-size:18px;color:#22364d}.integrity-card.danger{border-left:3px solid #b4483e}.integrity-card.warning{border-left:3px solid #b57922}.integrity-card.success{border-left:3px solid #2c7a57}
.signed-bars{display:grid;gap:7px}.signed-row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(220px,1.7fr) 86px;gap:10px;align-items:center}.signed-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:#506579}.signed-track{height:14px;position:relative;background:#f3f6f9;border-radius:4px}.signed-zero{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#98a2b3}.signed-bar{position:absolute;top:2px;height:10px;border-radius:3px;background:#91a0b0}.signed-bar.late{background:#b4483e}.signed-bar.early{background:#2c7a57}.signed-row>b{text-align:right;font-size:10.5px;color:#475467}.late-text{color:#b42318!important}.early-text{color:#067647!important}.date-trend-note{font-size:10.5px;color:#7b8795;margin-top:5px}
.lookahead-axis,.lookahead-row{display:grid;grid-template-columns:220px minmax(430px,1fr) 92px;gap:10px;align-items:center}.lookahead-weeks{position:relative;height:20px}.lookahead-weeks span{position:absolute;transform:translateX(-50%);font-size:9.5px;color:#7b8795}.lookahead-timeline{display:grid;gap:6px}.lookahead-label{min-width:0}.lookahead-label b{display:block;font-size:10.5px;color:#344054}.lookahead-label span{display:block;font-size:9.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lookahead-track{position:relative;height:17px;border-radius:4px;background:repeating-linear-gradient(90deg,#f5f7fa 0,#f5f7fa calc(16.666% - 1px),#e4e7ec calc(16.666% - 1px),#e4e7ec 16.666%)}.lookahead-bar{position:absolute;top:3px;height:11px;border-radius:4px;background:#4f7fb4;min-width:3px}.lookahead-bar.ready{background:#2c7a57}.lookahead-bar.conditional{background:#b57922}.lookahead-bar.blocked{background:#b4483e}.lookahead-state{font-size:9.5px;text-transform:uppercase;color:#667085}.lookahead-state.ready{color:#067647}.lookahead-state.conditional{color:#b54708}.lookahead-state.blocked{color:#b42318}
.readiness-cell{display:inline-grid;place-items:center;width:23px;height:23px;border-radius:6px;font-size:11px;font-weight:900}.readiness-cell.ready{background:#ecfdf3;color:#067647}.readiness-cell.blocked{background:#fef3f2;color:#b42318}.readiness-cell.unknown{background:#fffaeb;color:#b54708}.readiness-cell.not_applicable{background:#f2f4f7;color:#667085}
.milestone-timeline{display:grid;gap:7px}.milestone-row{display:grid;grid-template-columns:235px minmax(430px,1fr) 70px;gap:10px;align-items:center}.milestone-label{min-width:0}.milestone-label b{display:block;font-size:10.5px;color:#344054}.milestone-label span{display:block;font-size:9.5px;color:#7b8795;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.milestone-track{position:relative;height:22px;background:#f6f8fb;border:1px solid #e5eaf0;border-radius:5px}.milestone-point{position:absolute;top:50%;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;z-index:2}.milestone-point.baseline{background:#68788b}.milestone-point.current{background:#4f7fb4}.milestone-point.actual{background:#2c7a57}.milestone-shift{position:absolute;top:9px;height:3px;background:#9aa7b5}.milestone-shift.late{background:#b4483e}.milestone-dd{position:absolute;top:-4px;bottom:-4px;width:1px;background:#1f2937;opacity:.35}
.float-histogram{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:230px;align-items:end}.float-bin{height:100%;display:grid;grid-template-rows:1fr auto auto;gap:4px;text-align:center}.float-bar-wrap{display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #d0d5dd}.float-bar{width:65%;min-height:2px;background:#b57922;border-radius:5px 5px 0 0}.float-bin b{font-size:11px;color:#344054}.float-bin small{font-size:9.5px;color:#7b8795}
.empty-visual{padding:28px;text-align:center;color:#7b8795;background:#f8fafc;border:1px dashed #dce5ef;border-radius:9px}.reconciliation-panel{margin-top:14px;border:1px solid #dce5ef;border-radius:12px;background:#fff;overflow:hidden}.reconciliation-panel>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;padding:13px 15px;cursor:pointer;font-size:12px;font-weight:750;color:#344054;background:#fbfdff}.reconciliation-panel>summary::-webkit-details-marker{display:none}.reconciliation-panel>summary b{font-size:10.5px;color:#7b8795}.reconciliation-body{padding:0 0 2px}.reconciliation-body>.challenge-card{border:0!important;border-radius:0!important;margin:0!important;box-shadow:none!important}
.chart-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#faf9f6}.chart-card-head h4{margin:0;font-size:14px}.chart-card-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.chart-body{padding:14px 16px}.svg-chart{width:100%;min-width:620px;height:auto;display:block}.chart-scroll{overflow-x:auto}.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 10px}.legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#506579}.legend-dot{width:9px;height:9px;border-radius:50%}.domain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px}.domain-card{border:1px solid var(--line);border-radius:11px;background:#fff;padding:14px}.domain-card h5{margin:0 0 10px;font-size:14px}.domain-metric{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #edf1f5;font-size:12px;color:#5a687b}.domain-metric:last-child{border-bottom:0}.domain-metric strong{color:#2e3a46;text-align:right}.position-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.position-card{border:1px solid #dfe7ef;border-radius:10px;background:#fff;padding:13px}.position-card .position-label{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.position-card .position-value{font-size:19px;font-weight:780;margin:5px 0 3px;letter-spacing:-.02em}.position-card .position-sub{font-size:11.5px;color:var(--muted)}.readiness-table td{vertical-align:middle}.state-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.state-pill.ready,.state-pill.included{background:#ecfdf3;color:#067647}.state-pill.blocked,.state-pill.excluded{background:#fef3f2;color:#b42318}.state-pill.conditional,.state-pill.review,.state-pill.unknown{background:#fffaeb;color:#b54708}.state-pill.not_applicable{background:#f2f4f7;color:#667085}.window-strip{display:grid;gap:10px}.window-card{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1fr) minmax(180px,.6fr);gap:13px;border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.window-id{font-size:13px;font-weight:800}.window-dates{font-size:11.5px;color:var(--muted);margin-top:4px}.movement-value{font-size:22px;font-weight:780;letter-spacing:-.03em}.movement-label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:750}.event-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.event-tag{font-size:10.5px;border:1px solid #ded8cf;border-radius:999px;padding:3px 6px;background:#fbfdff;color:#506579}.data-section{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.data-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#fbfdff}.data-section-head h4{margin:0;font-size:14px;letter-spacing:-.01em}.data-section-body{padding:14px 16px}.value-list{display:flex;flex-wrap:wrap;gap:7px}.value-chip{display:inline-flex;padding:6px 9px;border:1px solid #ded8cf;border-radius:8px;background:#fbfdff;font-size:12px;color:#506579}.nested-block{margin-top:12px}.nested-block:first-child{margin-top:0}.nested-title{font-size:12px;font-weight:800;color:#506579;margin:0 0 8px;text-transform:uppercase;letter-spacing:.045em}.cell-details summary{padding:4px 0!important;border:0!important;background:transparent!important}.cell-details pre{max-height:320px}.technical-payload{margin-top:16px}.footer-note{font-size:12px;color:var(--muted);margin-top:22px;padding:0 2px}.muted{color:var(--muted)}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1280px){.planning-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.planning-primary-grid{grid-template-columns:1fr}.management-health-grid{grid-template-columns:1fr 1fr}.app{grid-template-columns:238px minmax(0,1fr)}.grid.three{grid-template-columns:1fr 1fr}.upload-row{grid-template-columns:1fr}.evidence-control-grid{grid-template-columns:1fr}.evidence-status-card{position:static}}
@media(max-width:900px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;flex-wrap:wrap;padding:13px 18px}.content{padding:20px 18px 48px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.workspace-header{align-items:center}.grid.two,.grid.three{grid-template-columns:1fr}.module-panel #moduleContent{padding:16px}.module-panel>.module-head{padding:17px}.candidate-grid{grid-template-columns:1fr}.auxiliary-drawer{right:12px;top:12px;width:calc(100vw - 24px);max-height:calc(100vh - 24px)}}
@media(max-width:620px){.workspace-header{display:block}.queue-row{grid-template-columns:1fr}.queue-role-control{grid-template-columns:1fr}.queue-remove{justify-self:start}.quick-upload-bar{display:block}.quick-upload-actions{margin-top:10px}.quick-upload-actions .btn{width:100%}.workspace-actions{justify-content:flex-start;margin-top:10px}.workspace-header .badge{margin-top:10px}.grid.kpi{grid-template-columns:1fr 1fr}.scalar-grid{grid-template-columns:1fr}.wide-upload{grid-template-columns:1fr}.queue-row{grid-template-columns:1fr}.recommendation-card{display:block}.decision-pill{display:inline-flex;margin-top:10px}}
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
            <p>Current position, supporting records, variances, consequences and required management action.</p>
          </div>
          <div class="module-head-actions"><button class="btn small" id="focusMode" aria-pressed="false">Focus view</button><span id="moduleBadge" class="badge">Select a view</span></div>
        </div>
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
  "Programme & Planning":["pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule","schedule-change-report","revision-trend","milestones","near-critical"],
  "Progress & Resources":["resource-utilization","progress-report","variance-trends","progress-scurve","quantity-scurve","progress-breakdown","manhour-scurve"],
  "Forecast & Completion":["forecast-history","independent-forecast"],
  "Claims & Commercial":["delay-claims","notices-claims","windows-analysis","eot-assessment","challenge-contract"]
};
const names={
"pmo-analysis":"Management Position","schedule-analytics":"Programme Review","activity-analytics":"Activity Review","resource-utilization":"Resources","lookahead-schedule":"Look-Ahead","progress-report":"Progress Position","schedule-change-report":"Programme Changes","revision-trend":"Revision History","variance-trends":"Variance Trend","progress-scurve":"Progress S-Curve","quantity-scurve":"Installed Quantities","progress-breakdown":"WBS Progress","milestones":"Milestones","near-critical":"Near-Critical Activities","manhour-scurve":"Man-Hour S-Curve","forecast-history":"Completion Forecast History","independent-forecast":"CMeng Completion Forecast","delay-claims":"Delay Events & Claims","notices-claims":"Notices, EOT & Claims","windows-analysis":"Delay Windows","eot-assessment":"EOT Position","challenge-contract":"Challenge the Contract"
};
let overview=null,selected="pmo-analysis",portfolioData=null,appView="portfolio";
let scheduleSelection=[],boqSelection=[],contractSelection=[],evidenceSelection=[];
let selectedEvidenceDocuments=new Set();
const el=id=>document.getElementById(id);
const project=()=>el("projectId").value.trim();
const fmt=v=>v===null||v===undefined?"—":typeof v==="number"?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v):String(v);
const statusClass=s=>s==="ready"?"ready":s==="partial"?"partial":"blocked";
const statusLabel=s=>s==="ready"?"Ready":s==="partial"?"Review needed":"More information needed";
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
function renderUniversalChallenge(challenge){
  if(!challenge||!Array.isArray(challenge.items))return"";
  const show=v=>v===null||v===undefined?"—":fmt(v);
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
  let html=(reason?'<div class="notice info">'+escapeHtml(reason)+'</div>':'')+renderUniversalChallenge(data?.challenge);
  html+='<div class="notice '+(d.position==="material_delivery_gap"||d.position==="challenged"?"warn":"info")+'"><b>Delivery challenge position: '+escapeHtml(d.position)+'</b><br>'+escapeHtml(d.disclaimer||"")+'</div>';
  html+='<div class="grid kpi">'+
    kpi("Contractor forecast",s.contractorSubmittedCompletionIso)+
    kpi("Independent forecast",s.independentCompletionIso)+
    kpi("Contract completion",s.contractualCompletionIso)+
    kpi("Forecast gap",s.contractorVsIndependentDays,"days independent minus contractor")+
    kpi("Avg work fronts",s.averageConcurrentWorkFronts)+
    kpi("Peak work fronts",s.peakConcurrentWorkFronts)+
  '</div>';
  html+='<div class="grid two" style="margin-top:12px"><div class="card"><h3>Manpower plan review</h3><div class="scalar-grid">'+
    '<div class="scalar"><b>Submitted average manpower</b><span>'+escapeHtml(fmt(m.submittedAverageManpower))+'</span></div>'+
    '<div class="scalar"><b>Submitted peak manpower</b><span>'+escapeHtml(fmt(m.submittedPeakManpower))+'</span></div>'+
    '<div class="scalar"><b>Required avg to contract</b><span>'+escapeHtml(fmt(m.requiredAverageManpowerToContract))+'</span></div>'+
    '<div class="scalar"><b>Required avg to contractor forecast</b><span>'+escapeHtml(fmt(m.requiredAverageManpowerToContractorForecast))+'</span></div>'+
    '<div class="scalar"><b>Submitted vs required</b><span>'+escapeHtml(fmt(m.submittedVsRequiredToContract))+'%</span></div>'+
    '<div class="scalar"><b>Remaining labor hours</b><span>'+escapeHtml(fmt(m.evidenceRemainingLaborHours))+'</span></div>'+
    '</div><h3 style="margin-top:14px">Programme-based alternative scenarios</h3><div class="table-wrap"><table><thead><tr><th>Crew / work front</th><th>Average manpower</th><th>Peak manpower</th><th>Status</th></tr></thead><tbody>'+
    (m.scheduleDerivedScenarios||[]).map(x=>'<tr><td>'+escapeHtml(x.crewSize)+'</td><td>'+escapeHtml(fmt(x.averageManpower))+'</td><td>'+escapeHtml(fmt(x.peakManpower))+'</td><td>'+escapeHtml(x.authority)+'</td></tr>').join("")+
    '</tbody></table></div></div>';
  html+='<div class="card"><h3>Quantity, productivity & mapping</h3><div class="scalar-grid">'+
    '<div class="scalar"><b>Mapping coverage</b><span>'+escapeHtml(fmt(q.mappingCoveragePercent))+'%</span></div>'+
    '<div class="scalar"><b>Ambiguous BOQ items</b><span>'+escapeHtml(fmt(q.ambiguousMappingItemCount))+'</span></div>'+
    '<div class="scalar"><b>Unmapped BOQ items</b><span>'+escapeHtml(fmt(q.unmappedItemCount))+'</span></div>'+
    '<div class="scalar"><b>Productivity records</b><span>'+escapeHtml(p.productivityEvidenceState||"—")+'</span></div>'+
    '</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Unit</th><th>Contract qty</th><th>Mapped qty</th><th>Installed</th><th>Remaining</th><th>Req/day contract</th><th>Map coverage</th></tr></thead><tbody>'+
    (q.byUnit||[]).map(x=>'<tr><td>'+escapeHtml(x.unit)+'</td><td>'+escapeHtml(fmt(x.contractQuantity))+'</td><td>'+escapeHtml(fmt(x.mappedContractQuantity))+'</td><td>'+escapeHtml(fmt(x.installedQuantity))+'</td><td>'+escapeHtml(fmt(x.remainingQuantity))+'</td><td>'+escapeHtml(fmt(x.requiredPerDayToContract))+'</td><td>'+escapeHtml(fmt(x.mappingCoveragePercent))+'%</td></tr>').join("")+
    '</tbody></table></div></div></div>';
  html+='<div class="card" style="margin-top:12px"><h3>Combined delivery challenge findings</h3><div class="table-wrap"><table><thead><tr><th>Topic</th><th>State</th><th>Contractor assumption</th><th>Independent calculation</th><th>Gap</th><th>Milestone consequence</th><th>Required response</th></tr></thead><tbody>'+
    (d.findings||[]).map(x=>'<tr><td>'+escapeHtml(x.topic)+'</td><td>'+escapeHtml(x.state)+'</td><td>'+escapeHtml(x.contractorAssumption||"—")+'</td><td>'+escapeHtml(x.independentCalculation||"—")+'</td><td>'+escapeHtml(x.difference||"—")+'</td><td>'+escapeHtml(x.milestoneConsequence||"—")+'</td><td>'+escapeHtml(x.requiredResponse||"—")+'</td></tr>').join("")+
    '</tbody></table></div></div>';
  if(d.mapping){
    html+='<details style="margin-top:12px"><summary>BOQ ↔ Programme links and supporting records</summary><div style="padding:12px">'+renderStructuredValue(d.mapping,0)+'</div></details>';
  }
  if(data.contractValueEvidence){
    const cv=data.contractValueEvidence;
    const governed=cv.governed;
    const candidate=cv.extraction?.value;
    const display=governed?fmt(governed.amount)+" "+(governed.currency||""):candidate?fmt(candidate.amount)+" "+(candidate.currency||""):"—";
    html+='<div class="card" style="margin-top:12px"><h3>Contract value records</h3><div class="scalar-grid">'+
      '<div class="scalar"><b>State</b><span>'+escapeHtml(cv.state||"missing")+'</span></div>'+
      '<div class="scalar"><b>Value</b><span>'+escapeHtml(display)+'</span></div>'+
      '<div class="scalar"><b>Status</b><span>'+escapeHtml(governed?"governed":candidate?"candidate only":"not established")+'</span></div>'+
      '</div><div class="notice info">'+escapeHtml(cv.note||"")+'</div>'+
      (cv.extraction?.candidates?.length?'<details><summary>Contract value candidates and supporting records</summary><div style="padding:12px">'+renderStructuredValue(cv.extraction,0)+'</div></details>':'')+
      '</div>';
  }
  if(data.contractIntelligence){
    html+='<details style="margin-top:12px"><summary>Contract clauses supporting the review</summary><div style="padding:12px">'+renderStructuredValue(data.contractIntelligence,0)+'</div></details>';
  }
  el("moduleContent").innerHTML=html;
  return true;
}
function humanizeKey(key){
  return String(key)
    .replace(/[_-]+/g," ")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/\b\w/g,c=>c.toUpperCase());
}
function documentUseLabel(state){
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
function renderLineChart(points,series,yMaxHint=null){
  if(!Array.isArray(points)||!points.length)return '<div class="muted">No series points available.</div>';
  const numeric=[];
  points.forEach(point=>series.forEach(s=>{const v=point?.[s.key];if(typeof v==="number"&&Number.isFinite(v))numeric.push(v)}));
  if(!numeric.length)return '<div class="muted">No numeric series points available.</div>';
  const width=960,height=270,left=52,right=18,top=18,bottom=42;
  const plotW=width-left-right,plotH=height-top-bottom;
  const rawMax=Math.max(...numeric,1);
  const maxY=yMaxHint!==null?yMaxHint:Math.max(1,rawMax*1.08);
  const x=i=>left+(points.length===1?plotW/2:(i/(points.length-1))*plotW);
  const y=v=>top+plotH-(Math.max(0,Math.min(maxY,v))/maxY)*plotH;
  const segments=(key)=>{
    const result=[];let current=[];
    points.forEach((point,i)=>{
      const value=point?.[key];
      if(typeof value==="number"&&Number.isFinite(value)){current.push(x(i).toFixed(1)+","+y(value).toFixed(1))}
      else if(current.length){result.push(current);current=[]}
    });
    if(current.length)result.push(current);
    return result;
  };
  const grid=[0,.25,.5,.75,1].map(r=>{
    const yy=top+plotH-(r*plotH);
    return '<line x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'" stroke="#e4eaf1" stroke-width="1"/><text x="'+(left-9)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#75849a">'+escapeHtml(fmt(maxY*r))+'</text>';
  }).join("");
  const lines=series.map(s=>segments(s.key).map(seg=>'<polyline points="'+seg.join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>').join("")).join("");
  const labelIndexes=[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndexes.map(i=>'<text x="'+x(i)+'" y="'+(height-14)+'" text-anchor="'+(i===0?"start":i===points.length-1?"end":"middle")+'" font-size="10" fill="#75849a">'+escapeHtml(points[i]?.dateIso||String(i+1))+'</text>').join("");
  const legend='<div class="chart-legend">'+series.map(s=>'<span class="legend-item"><span class="legend-dot" style="background:'+s.color+'"></span>'+escapeHtml(s.label)+'</span>').join("")+'</div>';
  return legend+'<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'" role="img">'+grid+lines+labels+'</svg></div>';
}
function renderProgressScurveVisual(data){
  const p=projectionFor(data,"progress_scurve");
  if(!Array.isArray(p.points))return"";
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Progress S-Curve</h4><p>Baseline, current forecast and actual history remain separate.</p></div><span class="badge">'+escapeHtml(p.actualHistoryMode||"")+'</span></div><div class="chart-body">'+
    renderLineChart(p.points,[
      {key:"baselinePlannedPercent",label:"Baseline planned",color:"#506579"},
      {key:"currentForecastPercent",label:"Current forecast",color:"#4f7fb4"},
      {key:"actualProgressPercent",label:"Actual",color:"#d97706"}
    ],100)+
  '</div></section>';
}
function renderQuantityScurveVisual(data){
  const p=projectionFor(data,"quantity_scurve");
  if(!Array.isArray(p.series))return"";
  return p.series.map(series=>'<section class="chart-card"><div class="chart-card-head"><div><h4>Quantity S-Curve · '+escapeHtml(series.unitKey||series.unit||series.seriesKey)+'</h4><p>'+escapeHtml(series.itemCount)+' mapped item(s) · '+escapeHtml(fmt(series.mappingCoveragePercent))+'% mapping coverage</p></div><span class="badge '+(series.authority==="governed_mapping"?"ready":"partial")+'">'+escapeHtml(humanizeKey(series.authority))+'</span></div><div class="chart-body">'+
    renderLineChart(series.points||[],[
      {key:"baselinePlannedQuantity",label:"Baseline planned",color:"#506579"},
      {key:"currentForecastQuantity",label:"Current forecast",color:"#4f7fb4"},
      {key:"actualInstalledQuantity",label:"Actual installed",color:"#d97706"}
    ])+
  '</div></section>').join("");
}
function renderLookAheadVisual(data){
  const p=projectionFor(data,"lookahead_schedule");
  if(!Array.isArray(p.rows))return"";
  const inWindow=p.rows.length;
  const kpis=planningKpis([
    ["Look-ahead",p.windowDays+" days",planningShortDate(p.dataDateIso)+" → "+planningShortDate(p.windowEndIso)],
    ["Activities",inWindow,"in look-ahead"],
    ["Overdue",p.overdueCount,"activities","danger"],
    ["Ready",p.readyCount,"activities","success"],
    ["Conditional",p.conditionalCount,"activities","warning"],
    ["Blocked",p.blockedCount,"activities","danger"]
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
    return '<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(planningShortDate(row.startIso))+'</td><td>'+escapeHtml(planningShortDate(row.finishIso))+'</td><td><span class="state-pill '+escapeHtml(row.readiness?.state||"unknown")+'">'+escapeHtml(planningStateLabel(row.readiness?.state||"unknown"))+'</span></td>'+dimensions.map(key=>{const dim=map.get(key);const state=dim?.state||"unknown";return '<td><span class="readiness-cell '+escapeHtml(state)+'" title="'+escapeHtml(dim?.note||planningStateLabel(state))+'">'+escapeHtml(state==="ready"?"✓":state==="blocked"?"!":state==="not_applicable"?"—":"?")+'</span></td>'}).join("")+'</tr>';
  }).join("");
  const readiness=planningStatusBand([["Ready",p.readyCount,"success"],["Conditional",p.conditionalCount,"warning"],["Blocked",p.blockedCount,"danger"]]);
  return '<section class="planning-view lookahead-view">'+kpis+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>6-week execution view</h4><p>Work is ordered by immediate delivery risk. Red activities have a known blocker.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness position</h4><p>Ready, conditional and blocked work in the current look-ahead.</p></div></div><div class="planning-panel-body">'+readiness+'<div class="coverage-line"><span>Date coverage</span><b>'+escapeHtml(p.currentDateCoveragePercent===null?"—":fmt(p.currentDateCoveragePercent)+"%")+'</b></div></div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Immediate focus</h4><p>Overdue and blocked work should be resolved first.</p></div></div><div class="planning-panel-body">'+planningAttention([
    p.overdueCount?{title:"Overdue activities",text:"Activities have passed their current finish date.",value:p.overdueCount,tone:"danger"}:null,
    p.blockedCount?{title:"Blocked activities",text:"At least one readiness requirement is not ready.",value:p.blockedCount,tone:"danger"}:null,
    p.conditionalCount?{title:"Readiness gaps",text:"Some requirements are still unknown or incomplete.",value:p.conditionalCount,tone:"watch"}:null,
    (p.missingCurrentDateActivityIds||[]).length?{title:"Activities missing current dates",text:"They cannot be positioned reliably in the look-ahead.",value:(p.missingCurrentDateActivityIds||[]).length,tone:"watch"}:null
  ])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Readiness matrix</h4><p>✓ ready · ! blocked · ? information missing · — not applicable. Highest-attention activities are shown first.</p></div></div><div class="planning-panel-body"><div class="table-wrap readiness-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Overall</th>'+dimensions.map(key=>'<th>'+escapeHtml(labels[key])+'</th>').join("")+'</tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderForecastVisual(data){
  const p=projectionFor(data,"independent_forecast");
  if(!("independentForecastCompletionIso" in p))return"";
  const prob=p.probabilistic||{};
  const cards=[
    ["Source forecast",p.sourceForecastCompletionIso,p.sourceRevisionId||""],
    ["Independent forecast",p.independentForecastCompletionIso,(p.forecastVarianceDays===null||p.forecastVarianceDays===undefined)?"":fmt(p.forecastVarianceDays)+" days vs source"],
    ["Required finish",p.requiredFinishIso,(p.requiredFinishVarianceDays===null||p.requiredFinishVarianceDays===undefined)?"":fmt(p.requiredFinishVarianceDays)+" days variance"],
    ["P50 comparator",prob.p50CompletionIso,prob.authority||""],
    ["P80 comparator",prob.p80CompletionIso,prob.authority||""],
    ["P90 comparator",prob.p90CompletionIso,prob.authority||""]
  ];
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Forecast Position</h4><p>Source programme and independent calculation stay separate; probabilistic dates are non-official comparators.</p></div><span class="badge '+(p.complete?"ready":"partial")+'">'+escapeHtml(p.origin?humanizeKey(p.origin):"")+'</span></div><div class="chart-body"><div class="position-grid">'+cards.map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1]||"—")+'</div><div class="position-sub">'+escapeHtml(c[2]||"")+'</div></div>').join("")+'</div></div></section>';
}
function renderWindowsVisual(data){
  const p=projectionFor(data,"windows_analysis");
  if(!Array.isArray(p.windows))return"";
  const rows=p.windows.map(w=>'<div class="window-card"><div><div class="window-id">Window '+escapeHtml(w.sequence)+' · '+escapeHtml(w.windowId)+'</div><div class="window-dates">'+escapeHtml(w.windowStartIso||"—")+' → '+escapeHtml(w.windowEndIso||"—")+'</div><div class="event-tags">'+
      (w.delayEvents||[]).map(e=>'<span class="event-tag">'+escapeHtml(e.responsibility)+' · '+escapeHtml(e.eventId)+'</span>').join("")+
    '</div></div><div><div class="movement-label">Strongest programme movement</div><div class="movement-value">'+escapeHtml(fmt(w.strongestProgrammeMovementDays))+' days</div><div class="muted">'+escapeHtml(w.strongestProgrammeMovementBasis||"")+' · progress '+escapeHtml(fmt(w.progressMovementPercent))+'%</div></div><div><span class="state-pill '+escapeHtml(humanizeKey(w.state||"unknown"))+'">'+escapeHtml(w.state||"unknown")+'</span><div class="muted" style="margin-top:7px">'+escapeHtml(w.addedActivityCount)+' added · '+escapeHtml(w.removedActivityCount)+' removed · '+escapeHtml(w.modifiedActivityCount)+' modified</div>'+(w.concurrentEventCandidate?'<div class="event-tag" style="margin-top:7px">Concurrency review</div>':'')+'</div></div>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Schedule Windows</h4><p>Revision-to-revision programme movement with event population and concurrency visibility.</p></div><span class="badge">'+escapeHtml(p.windowCount||0)+' windows</span></div><div class="chart-body"><div class="window-strip">'+rows+'</div></div></section>';
}
function renderDelayClaimsVisual(data){
  const p=projectionFor(data,"delay_claims");
  if(!Array.isArray(p.events))return"";
  const rows=p.events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(e.responsibility)+'</td><td>'+escapeHtml(humanizeKey(e.noticeTimeliness))+'</td><td>'+escapeHtml(fmt(e.observedPositiveProgrammeMovementDays))+'</td><td>'+escapeHtml(e.programmeMovementBasis)+'</td><td><span class="state-pill '+(e.concurrencyCandidate?"review":"ready")+'">'+escapeHtml(humanizeKey(e.candidateClass))+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.relatedActivityIds||[]).join(", ")||"—")+'</td></tr>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Delay Event & Claim Linkage</h4><p>Observed programme movement remains separate from causal/contractual entitlement.</p></div><span class="badge">'+escapeHtml(p.eventCount||0)+' events · '+escapeHtml(p.claimCount||0)+' claims</span></div><div class="chart-body"><div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Notice</th><th>Positive movement days</th><th>Movement basis</th><th>Position class</th><th>Claims</th><th>Activities</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
}
function renderEotVisual(data){
  const p=projectionFor(data,"eot_assessment");
  if(!Array.isArray(p.windowCandidates))return"";
  const cards=[
    ["Contract completion",p.contractualCompletionIso,p.contractualCompletionState],
    ["Official approved EOT",p.officialApprovedEotDays===null?"—":fmt(p.officialApprovedEotDays)+" days",p.officialApprovedEotState],
    ["Official adjusted completion",p.officialAdjustedCompletionIso,"governed only"],
    ["Observed movement",fmt(p.observedProgrammeMovementDays)+" days","schedule observation"],
    ["Analytical time impact",fmt(p.analyticalTimeImpactCandidateDays)+" days","candidate, not entitlement"],
    ["Attributable EOT candidate",p.attributableCandidateEotDays===null?"—":fmt(p.attributableCandidateEotDays)+" days","candidate, not award"],
    ["Scenario adjusted completion",p.scenarioAdjustedCompletionIso,"analytical scenario"]
  ];
  const rows=p.windowCandidates.map(w=>'<tr><td>'+escapeHtml(w.windowId)+'</td><td>'+escapeHtml(fmt(w.positiveProgrammeMovementDays))+'</td><td>'+escapeHtml(w.programmeMovementBasis)+'</td><td>'+escapeHtml(fmt(w.analyticalTimeImpactCandidateDays))+'</td><td><span class="state-pill '+escapeHtml(humanizeKey(w.state))+'">'+escapeHtml(w.state)+'</span></td><td>'+escapeHtml(fmt(w.includedCandidateDays))+'</td><td>'+escapeHtml((w.reasons||[]).join("; ")||"—")+'</td></tr>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>EOT Position</h4><p>Official award, observed movement and analytical candidate remain explicitly separate.</p></div><span class="badge partial">Analytical candidate ≠ award</span></div><div class="chart-body"><div class="position-grid">'+cards.map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1]||"—")+'</div><div class="position-sub">'+escapeHtml(c[2]||"")+'</div></div>').join("")+'</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Window</th><th>Programme movement</th><th>Basis</th><th>Time impact</th><th>State</th><th>Included days</th><th>Reason</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
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
  const total=items.reduce((sum,item)=>sum+Math.max(0,Number(item[1]||0)),0);
  if(total<=0)return '<div class="empty-visual">No distribution is available for this view.</div>';
  return '<div class="status-band">'+items.filter(item=>Number(item[1]||0)>0).map(item=>{
    const value=Math.max(0,Number(item[1]||0));
    const width=(value/total)*100;
    return '<div class="status-band-segment '+escapeHtml(item[2]||"neutral")+'" style="width:'+width.toFixed(3)+'%" title="'+escapeHtml(item[0]+": "+fmt(value))+'"><span>'+escapeHtml(item[0])+'</span><b>'+escapeHtml(fmt(value))+'</b></div>';
  }).join("")+'</div><div class="status-band-legend">'+items.map(item=>'<span><i class="'+escapeHtml(item[2]||"neutral")+'"></i>'+escapeHtml(item[0])+' <b>'+escapeHtml(fmt(item[1]))+'</b></span>').join("")+'</div>';
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
  const usable=points.map((point,index)=>{
    const out={...point,dateIso:point.dateIso||("R"+(index+1))};
    series.forEach(s=>{out[s.key+"__n"]=planningDateMs(point[s.key]);});
    return out;
  });
  const vals=[];
  usable.forEach(p=>series.forEach(s=>{const v=p[s.key+"__n"];if(typeof v==="number")vals.push(v)}));
  if(!vals.length)return '<div class="empty-visual">No completion-date trend is available.</div>';
  const min=Math.min(...vals),max=Math.max(...vals),span=Math.max(86400000,max-min),base=min-span*.1,top=max+span*.1;
  const normalized=usable.map(p=>{const n={...p};series.forEach(s=>{const v=p[s.key+"__n"];n[s.key]=typeof v==="number"?((v-base)/(top-base))*100:null});return n;});
  return renderLineChart(normalized,series.map(s=>({key:s.key,label:s.label,color:s.color})),100)+'<div class="date-trend-note">Vertical position represents the forecast date. Higher means a later completion date.</div>';
}
function planningActivityPressure(rows){
  const candidates=rows.filter(r=>typeof r.finishVarianceDays==="number"&&typeof r.totalFloatHours==="number");
  if(!candidates.length)return '<div class="empty-visual">Finish variance and float are not both available for enough activities.</div>';
  const sorted=[...candidates].sort((a,b)=>(Math.abs(b.finishVarianceDays)+(b.totalFloatHours<0?40:0))-(Math.abs(a.finishVarianceDays)+(a.totalFloatHours<0?40:0))).slice(0,500);
  const xs=sorted.map(r=>r.finishVarianceDays),ys=sorted.map(r=>r.totalFloatHours);
  const xmin=Math.min(0,...xs),xmax=Math.max(0,...xs),ymin=Math.min(0,...ys),ymax=Math.max(0,...ys);
  const width=960,height=330,left=58,right=24,top=22,bottom=44,pw=width-left-right,ph=height-top-bottom;
  const x=v=>left+((v-xmin)/(Math.max(1e-9,xmax-xmin)))*pw;
  const y=v=>top+ph-((v-ymin)/(Math.max(1e-9,ymax-ymin)))*ph;
  const x0=x(0),y0=y(0);
  const points=sorted.map(r=>{
    const tone=r.criticality==="critical"?"#b4483e":r.criticality==="near_critical"?"#b57922":"#4f7fb4";
    return '<circle cx="'+x(r.finishVarianceDays).toFixed(1)+'" cy="'+y(r.totalFloatHours).toFixed(1)+'" r="3.3" fill="'+tone+'" opacity=".72"><title>'+escapeHtml(r.activityId+" · "+(r.name||"")+" · finish "+fmt(r.finishVarianceDays)+" d · float "+fmt(r.totalFloatHours)+" h")+'</title></circle>';
  }).join("");
  return '<div class="chart-legend"><span class="legend-item"><span class="legend-dot" style="background:#b4483e"></span>Critical</span><span class="legend-item"><span class="legend-dot" style="background:#b57922"></span>Near-critical</span><span class="legend-item"><span class="legend-dot" style="background:#4f7fb4"></span>Other</span></div><div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'"><rect x="'+left+'" y="'+top+'" width="'+pw+'" height="'+ph+'" fill="#fbfdff"/><line x1="'+x0+'" y1="'+top+'" x2="'+x0+'" y2="'+(top+ph)+'" stroke="#8291a3" stroke-dasharray="4 4"/><line x1="'+left+'" y1="'+y0+'" x2="'+(left+pw)+'" y2="'+y0+'" stroke="#8291a3" stroke-dasharray="4 4"/>'+points+'<text x="'+left+'" y="'+(height-13)+'" font-size="11" fill="#667085">Earlier finish</text><text x="'+(width-right)+'" y="'+(height-13)+'" text-anchor="end" font-size="11" fill="#667085">Later finish</text><text x="10" y="'+(top+12)+'" font-size="11" fill="#667085">More float</text><text x="10" y="'+(top+ph)+'" font-size="11" fill="#667085">Less float</text></svg></div>';
}
function planningLookAheadTimeline(p){
  const rows=[...(p.rows||[])].sort((a,b)=>{
    const ar=a.readiness?.state==="blocked"?0:a.classification==="overdue"?1:a.readiness?.state==="conditional"?2:3;
    const br=b.readiness?.state==="blocked"?0:b.classification==="overdue"?1:b.readiness?.state==="conditional"?2:3;
    return ar-br||String(a.startIso||"").localeCompare(String(b.startIso||""));
  }).slice(0,36);
  const start=planningDateMs(p.dataDateIso),end=planningDateMs(p.windowEndIso);
  if(start===null||end===null||end<=start)return '<div class="empty-visual">The look-ahead date window is not established.</div>';
  const x=ms=>Math.max(0,Math.min(100,((ms-start)/(end-start))*100));
  const weekMarks=[];
  for(let i=0;i<=6;i++)weekMarks.push('<span style="left:'+((i/6)*100).toFixed(2)+'%">'+(i===0?"DD":"W"+i)+'</span>');
  const body=rows.map(r=>{
    const s=planningDateMs(r.startIso),e=planningDateMs(r.finishIso);
    if(s===null||e===null)return "";
    const l=x(s),rr=x(e),w=Math.max(1,rr-l);
    const state=r.readiness?.state||"conditional";
    return '<div class="lookahead-row"><div class="lookahead-label"><b>'+escapeHtml(r.activityId)+'</b><span>'+escapeHtml(r.name||"")+'</span></div><div class="lookahead-track"><span class="lookahead-bar '+escapeHtml(state)+'" style="left:'+l.toFixed(2)+'%;width:'+w.toFixed(2)+'%" title="'+escapeHtml(planningShortDate(r.startIso)+" → "+planningShortDate(r.finishIso)+" · "+planningStateLabel(state))+'"></span></div><b class="lookahead-state '+escapeHtml(state)+'">'+escapeHtml(planningStateLabel(state))+'</b></div>';
  }).join("");
  return '<div class="lookahead-axis"><div></div><div class="lookahead-weeks">'+weekMarks.join("")+'</div><div></div></div><div class="lookahead-timeline">'+body+'</div>';
}
function planningMilestoneTimeline(p){
  const all=(p.rows||[]).filter(r=>planningDateMs(r.baselineDateIso)!==null||planningDateMs(r.currentDateIso)!==null||planningDateMs(r.actualDateIso)!==null);
  if(!all.length)return '<div class="empty-visual">No milestone dates are available.</div>';
  const sorted=[...all].sort((a,b)=>{
    const ad=planningDateMs(a.currentDateIso||a.actualDateIso||a.baselineDateIso)||0;
    const bd=planningDateMs(b.currentDateIso||b.actualDateIso||b.baselineDateIso)||0;
    const ar=(a.status!=="completed"&&typeof a.varianceDays==="number"&&a.varianceDays>0)?0:1;
    const br=(b.status!=="completed"&&typeof b.varianceDays==="number"&&b.varianceDays>0)?0:1;
    return ar-br||ad-bd;
  }).slice(0,40);
  const dates=[];
  sorted.forEach(r=>[r.baselineDateIso,r.currentDateIso,r.actualDateIso].forEach(v=>{const m=planningDateMs(v);if(m!==null)dates.push(m)}));
  const dd=planningDateMs(p.dataDateIso);if(dd!==null)dates.push(dd);
  let min=Math.min(...dates),max=Math.max(...dates);if(min===max){min-=86400000*14;max+=86400000*14}
  const pad=Math.max(86400000*7,(max-min)*.06);min-=pad;max+=pad;
  const x=v=>{const m=planningDateMs(v);return m===null?null:Math.max(1,Math.min(99,((m-min)/(max-min))*100));};
  const body=sorted.map(r=>{
    const b=x(r.baselineDateIso),cur=x(r.currentDateIso),act=x(r.actualDateIso),ddx=dd===null?null:Math.max(1,Math.min(99,((dd-min)/(max-min))*100));
    const vals=[b,cur,act].filter(v=>v!==null);
    const line=vals.length>1?'<span class="milestone-shift '+((r.varianceDays||0)>0?"late":"")+'" style="left:'+Math.min(...vals).toFixed(2)+'%;width:'+(Math.max(...vals)-Math.min(...vals)).toFixed(2)+'%"></span>':'';
    return '<div class="milestone-row"><div class="milestone-label"><b>'+escapeHtml(r.activityId)+'</b><span>'+escapeHtml(r.name||"")+'</span></div><div class="milestone-track">'+line+(ddx===null?'':'<span class="milestone-dd" style="left:'+ddx.toFixed(2)+'%"></span>')+(b===null?'':'<span class="milestone-point baseline" style="left:'+b.toFixed(2)+'%" title="Baseline · '+escapeHtml(planningShortDate(r.baselineDateIso))+'"></span>')+(cur===null?'':'<span class="milestone-point current" style="left:'+cur.toFixed(2)+'%" title="Current · '+escapeHtml(planningShortDate(r.currentDateIso))+'"></span>')+(act===null?'':'<span class="milestone-point actual" style="left:'+act.toFixed(2)+'%" title="Actual · '+escapeHtml(planningShortDate(r.actualDateIso))+'"></span>')+'</div><b class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null||r.varianceDays===undefined?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)+" d"))+'</b></div>';
  }).join("");
  return '<div class="milestone-key"><span><i class="baseline"></i>Baseline</span><span><i class="current"></i>Current</span><span><i class="actual"></i>Actual</span><span><i class="data"></i>Data date</span></div><div class="milestone-timeline">'+body+'</div>';
}
function planningFloatHistogram(rows,limitHours){
  const vals=(rows||[]).map(r=>Number(r.totalFloatHours)).filter(v=>Number.isFinite(v));
  if(!vals.length)return '<div class="empty-visual">Float information is not available.</div>';
  const max=Math.max(1,Number(limitHours)||Math.max(...vals));
  const bins=6,counts=Array.from({length:bins},()=>0);
  vals.forEach(v=>{const idx=Math.max(0,Math.min(bins-1,Math.floor((Math.max(0,v)/max)*bins)));counts[idx]++;});
  const peak=Math.max(1,...counts);
  return '<div class="float-histogram">'+counts.map((count,i)=>{
    const a=(i*max/bins),b=((i+1)*max/bins);
    return '<div class="float-bin"><div class="float-bar-wrap"><span class="float-bar" style="height:'+((count/peak)*100).toFixed(2)+'%"></span></div><b>'+escapeHtml(fmt(count))+'</b><small>'+escapeHtml(fmt(a))+'–'+escapeHtml(fmt(b))+' h</small></div>';
  }).join("")+'</div>';
}

function renderPmoVisual(data){
  const p=projectionFor(data,"pmo_analysis");
  if(!p.schedule||!p.progress||!p.forecast)return"";
  const variance=typeof p.forecast.varianceDays==="number"?p.forecast.varianceDays:null;
  const kpis=planningKpis([
    ["Programme completion",planningShortDate(p.forecast.sourceCompletionIso),"Submitted programme",""],
    ["CMeng completion",planningShortDate(p.forecast.independentCompletionIso),variance===null?"":((variance>0?"+":"")+fmt(variance)+" days vs submitted"),variance!==null&&variance>0?"danger":"accent"],
    ["Critical",p.schedule.criticalCount,"activities","danger"],
    ["Near-critical",p.schedule.nearCriticalCount,"activities","warning"],
    ["Negative float",p.schedule.negativeFloatCount,"activities","danger"],
    ["Late milestones",p.progress.lateMilestoneCount,"open milestones","danger"]
  ]);
  const completion=planningDateLadder([
    {label:"Submitted programme",date:p.forecast.sourceCompletionIso,tone:"current"},
    {label:"CMeng completion",date:p.forecast.independentCompletionIso,tone:"cmeng"},
    {label:"Approved completion",date:p.claims?.officialAdjustedCompletionIso,tone:"baseline"},
    {label:"Scenario completion",date:p.claims?.scenarioAdjustedCompletionIso,tone:"scenario"}
  ],null);
  const attention=planningAttention([
    variance!==null&&variance>0?{title:"CMeng completion is later than the submitted programme",text:"Review remaining durations, logic and delivery assumptions.",value:variance+" days",tone:"danger"}:null,
    p.schedule.negativeFloatCount>0?{title:"Negative float requires attention",text:"Activities are carrying schedule pressure against the current dates.",value:p.schedule.negativeFloatCount,tone:"danger"}:null,
    p.progress.lateMilestoneCount>0?{title:"Milestones are late",text:"Open milestone commitments have moved beyond their baseline or required dates.",value:p.progress.lateMilestoneCount,tone:"danger"}:null,
    p.progress.lookAheadOverdueCount>0?{title:"Look-ahead contains overdue work",text:"Review overdue activities and immediate recovery actions.",value:p.progress.lookAheadOverdueCount,tone:"watch"}:null,
    p.resources.overloadedResourceCount>0?{title:"Resource overload identified",text:"Assigned demand exceeds known capacity for some resources.",value:p.resources.overloadedResourceCount,tone:"watch"}:null,
    p.contract.challengeSignalCount>0?{title:"Contract items need review",text:"CMeng found contract points that may affect the programme position.",value:p.contract.challengeSignalCount,tone:"watch"}:null
  ]);
  const health='<div class="management-health-grid">'+[
    ["Programme",[
      ["Activities",p.schedule.activityCount],["Relationships",p.schedule.relationshipCount],["Logic density",p.schedule.logicDensity],["Path check",planningStateLabel(p.schedule.independentCpmState)]
    ]],
    ["Progress",[
      ["Weighted progress",p.progress.durationWeightedProgressPercent===null?"—":fmt(p.progress.durationWeightedProgressPercent)+"%"],["Progress coverage",p.progress.progressCoveragePercent===null?"—":fmt(p.progress.progressCoveragePercent)+"%"],["Completed",p.progress.completedCount],["In progress",p.progress.inProgressCount]
    ]],
    ["Delivery",[
      ["Assigned resources",p.resources.assignedResourceCount],["Capacity coverage",p.resources.capacityCoveragePercent===null?"—":fmt(p.resources.capacityCoveragePercent)+"%"],["Overloaded",p.resources.overloadedResourceCount],["BOQ/activity link",planningStateLabel(p.quantities.allocationState)]
    ]],
    ["Claims & time",[
      ["Delay events",p.claims.eventCount],["Claims",p.claims.claimCount],["Programme movement",fmt(p.claims.observedProgrammeMovementDays)+" days"],["Approved EOT",p.claims.officialApprovedEotDays===null?"—":fmt(p.claims.officialApprovedEotDays)+" days"]
    ]]
  ].map(group=>'<div class="domain-card"><h5>'+escapeHtml(group[0])+'</h5>'+group[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return '<section class="planning-view management-view">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Completion position</h4><p>Submitted programme, CMeng calculation and any approved or scenario completion dates.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel attention"><div class="planning-panel-head"><div><h4>What needs attention</h4><p>Items that can change the current programme position.</p></div></div><div class="planning-panel-body">'+attention+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Schedule, progress, delivery and time position at a glance.</p></div></div><div class="planning-panel-body">'+health+'</div></section></section>';
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
    ["Critical",r.float.criticalCount,"danger"],["Near-critical",r.float.nearCriticalCount,"warning"],["Positive float",r.float.positiveFloatCount,"accent"],["Float unknown",r.float.unknownFloatCount,"neutral"]
  ])+'<div class="coverage-line"><span>Float coverage</span><b>'+escapeHtml(r.float.coveragePercent===null?"—":fmt(r.float.coveragePercent)+"%")+'</b></div></div><div><h5>Activity status</h5>'+planningStatusBand([
    ["Completed",r.status.completed,"success"],["In progress",r.status.inProgress,"accent"],["Not started",r.status.notStarted,"neutral"],["Unknown",r.status.unknown,"warning"]
  ])+'</div></div>';
  const integrity='<div class="integrity-grid">'+[
    ["Cycles",cycles,cycles?"danger":"success"],["Broken links",broken,broken?"danger":"success"],["Open starts",openStarts,openStarts?"warning":"success"],["Open finishes",openFinishes,openFinishes?"warning":"success"],["Isolated activities",isolated,isolated?"warning":"success"],["Programme logic",r.graph.complete?"Complete":"Review needed",r.graph.complete?"success":"danger"]
  ].map(x=>'<div class="integrity-card '+escapeHtml(x[2])+'"><span>'+escapeHtml(x[0])+'</span><b>'+escapeHtml(fmt(x[1]))+'</b></div>').join("")+'</div>';
  const completion=planningDateLadder((r.completionBases||[]).map(b=>({
    label:b.basis==="programme"?"Programme completion":b.basis==="forecast"?"Forecast completion":"Actual completion",
    date:b.dateIso,
    tone:b.basis==="forecast"?"cmeng":b.basis==="actual"?"actual":"current"
  })),r.dataDateIso);
  const variance=r.finishVariance||{};
  const varianceBand=planningStatusBand([
    ["Late",variance.lateActivities||0,"danger"],["On time",variance.onTimeActivities||0,"success"],["Early",variance.earlyActivities||0,"accent"],["Unknown",variance.unknownActivities||0,"neutral"]
  ]);
  return '<section class="planning-view programme-review">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Programme health</h4><p>Float, progress and logic quality across the current programme.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic checks</h4><p>Issues that reduce confidence in schedule sequencing.</p></div></div><div class="planning-panel-body">'+integrity+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Completion dates</h4><p>The different completion dates are kept separate so forecast is not confused with actual completion.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish variance</h4><p>Activities finishing later, on time or earlier than their comparison date.</p></div></div><div class="planning-panel-body">'+varianceBand+'<div class="coverage-line"><span>Variance coverage</span><b>'+escapeHtml(variance.coveragePercent===null||variance.coveragePercent===undefined?"—":fmt(variance.coveragePercent)+"%")+'</b></div></div></section></div></section>';
}
function renderActivityAnalyticsVisual(data){
  const p=projectionFor(data,"activity_analytics");
  if(!Array.isArray(p.rows))return"";
  const status={completed:0,in_progress:0,not_started:0,unknown:0};
  p.rows.forEach(r=>{status[r.status]=(status[r.status]||0)+1});
  const critical=p.rows.filter(r=>r.criticality==="critical").length;
  const near=p.rows.filter(r=>r.criticality==="near_critical").length;
  const late=p.rows.filter(r=>typeof r.finishVarianceDays==="number"&&r.finishVarianceDays>0).length;
  const openLogic=p.rows.filter(r=>r.openStart||r.openFinish||r.isolated).length;
  const kpis=planningKpis([
    ["Activities",p.activityCount,"current programme"],
    ["Completed",status.completed,"activities","success"],
    ["In progress",status.in_progress,"activities","accent"],
    ["Critical",critical,"activities","danger"],
    ["Near-critical",near,"activities","warning"],
    ["Finishing late",late,"activities","danger"]
  ]);
  const topLate=[...p.rows].filter(r=>typeof r.finishVarianceDays==="number").sort((a,b)=>b.finishVarianceDays-a.finishVarianceDays).slice(0,15).map(r=>({label:r.activityId+" · "+(r.name||""),value:r.finishVarianceDays}));
  const pressure=planningActivityPressure(p.rows);
  const statusBand=planningStatusBand([
    ["Completed",status.completed,"success"],["In progress",status.in_progress,"accent"],["Not started",status.not_started,"neutral"],["Unknown",status.unknown,"warning"]
  ]);
  const ranked=[...p.rows].sort((a,b)=>{
    const as=(a.criticality==="critical"?1000:a.criticality==="near_critical"?500:0)+(a.finishVarianceDays>0?a.finishVarianceDays:0)+(a.totalFloatHours<0?200:0);
    const bs=(b.criticality==="critical"?1000:b.criticality==="near_critical"?500:0)+(b.finishVarianceDays>0?b.finishVarianceDays:0)+(b.totalFloatHours<0?200:0);
    return bs-as;
  }).slice(0,250);
  const rows=ranked.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span></td><td>'+escapeHtml(planningStateLabel(a.status))+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(planningStateLabel(a.criticality))+'</span></td><td>'+escapeHtml(planningShortDate(a.currentFinishIso))+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td><td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(a.finishVarianceDays===null?"—":fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.openStart||a.openFinish||a.isolated?"Check":"—")+'</td></tr>').join("");
  return '<section class="planning-view activity-review">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Schedule pressure map</h4><p>Activities farther right are finishing later; activities lower on the chart have less float.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity status</h4><p>'+escapeHtml(fmt(openLogic))+' activities also have an open or isolated logic condition.</p></div></div><div class="planning-panel-body">'+statusBand+'<div class="coverage-stack"><span>Progress coverage <b>'+escapeHtml(p.percentCompleteCoveragePercent===null?"—":fmt(p.percentCompleteCoveragePercent)+"%")+'</b></span><span>Float coverage <b>'+escapeHtml(p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%")+'</b></span><span>Finish variance coverage <b>'+escapeHtml(p.finishVarianceCoveragePercent===null?"—":fmt(p.finishVarianceCoveragePercent)+"%")+'</b></span></div></div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest finish delays</h4><p>Activities with the greatest positive finish movement.</p></div></div><div class="planning-panel-body">'+planningSignedBars(topLate,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Activity watchlist</h4><p>Highest-attention activities first. Showing '+escapeHtml(fmt(ranked.length))+' of '+escapeHtml(fmt(p.activityCount))+'.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Criticality</th><th>Current finish</th><th>Progress</th><th>Total float h</th><th>Finish variance d</th><th>Logic</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderResourceVisual(data){
  const p=projectionFor(data,"resource_utilization");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(r.resourceType)+'</td><td>'+escapeHtml(r.assignmentCount)+'</td><td>'+escapeHtml(fmt(r.capacityUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakPlannedUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakRemainingUnitsPerHour))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"—":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.remainingUtilizationPercent===null?"—":fmt(r.remainingUtilizationPercent)+"%")+'</td><td><span class="state-pill '+(r.overloaded===true?"blocked":r.state==="capacity_based"?"ready":"review")+'">'+escapeHtml(r.overloaded===true?"overloaded":r.state)+'</span></td></tr>').join("");
  return visualSection("Resource Utilization","Capacity-based utilization is separated from demand-only resources; unknown capacity is not assumed.",p.overloadedResourceCount+" overloaded",'<div class="position-grid" style="margin-bottom:14px">'+[
    ["Resources",p.resourceCount],["Assigned",p.assignedResourceCount],["Capacity based",p.capacityBasedResourceCount],["Capacity coverage",p.capacityCoveragePercent===null?"—":fmt(p.capacityCoveragePercent)+"%"]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Assignments</th><th>Capacity/hr</th><th>Peak planned/hr</th><th>Peak remaining/hr</th><th>Planned util.</th><th>Remaining util.</th><th>State</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderProgressReportVisual(data){
  const p=projectionFor(data,"progress_report");
  if(!p.progressBases)return"";
  const bases=Object.entries(p.progressBases).map(([key,b])=>'<div class="position-card"><div class="position-label">'+escapeHtml(humanizeKey(key))+'</div><div class="position-value">'+escapeHtml(b.valuePercent===null?"—":fmt(b.valuePercent)+"%")+'</div><div class="position-sub">'+escapeHtml(b.state)+' · '+escapeHtml(b.authority)+'<br>Coverage '+escapeHtml(b.coveragePercent===null?"—":fmt(b.coveragePercent)+"%")+' · as of '+escapeHtml(b.asOfIso||"—")+'<br>Variance to baseline '+escapeHtml(b.varianceToBaselinePercentagePoints===null?"—":fmt(b.varianceToBaselinePercentagePoints)+" pp")+'</div></div>').join("");
  const summary='<div class="domain-grid" style="margin-top:14px">'+[
    ["Schedule",[["Critical",p.schedule?.criticalCount],["Near-critical",p.schedule?.nearCriticalCount],["Negative float",p.schedule?.negativeFloatCount],["Float coverage",p.schedule?.floatCoveragePercent===null?"—":fmt(p.schedule?.floatCoveragePercent)+"%"]]],
    ["Forecast",[["Source",p.forecast?.sourceForecastCompletionIso],["Independent",p.forecast?.independentForecastCompletionIso],["Variance days",p.forecast?.forecastVarianceDays],["Status",p.forecast?.authority]]],
    ["Milestones",[["Total",p.milestones?.milestoneCount],["Open",p.milestones?.openCount],["Late open",p.milestones?.lateOpenCount]]],
    ["Look-Ahead",[["Window days",p.lookAhead?.windowDays],["Incomplete",p.lookAhead?.incompleteActivityCount],["Overdue",p.lookAhead?.overdueCount],["Date coverage",p.lookAhead?.currentDateCoveragePercent===null?"—":fmt(p.lookAhead?.currentDateCoveragePercent)+"%"]]]
  ].map(c=>'<div class="domain-card"><h5>'+escapeHtml(c[0])+'</h5>'+c[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return visualSection("Progress Bases","Baseline, current schedule, physical, contractor-reported and certified progress are kept as distinct authorities.",p.dataDateIso||"",'<div class="position-grid">'+bases+'</div>'+summary);
}
function renderScheduleChangeVisual(data){
  const p=projectionFor(data,"schedule_change_report");
  if(!Array.isArray(p.changedActivities))return"";
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
  return '<section class="planning-view changes-view">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>What changed</h4><p>Activity changes between the two controlled programme revisions.</p></div></div><div class="planning-panel-body">'+composition+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Logic changes</h4><p>Relationships added or removed between the revisions.</p></div></div><div class="planning-panel-body">'+planningKpis([["Added links",p.addedRelationshipCount,"relationships","accent"],["Removed links",p.removedRelationshipCount,"relationships","warning"]])+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest finish movements</h4><p>Left means earlier. Right means later.</p></div></div><div class="planning-panel-body">'+planningSignedBars(movements,"days")+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Largest float deterioration</h4><p>Bars to the right indicate the largest loss of float.</p></div></div><div class="planning-panel-body">'+planningSignedBars(floatMoves,"hours lost")+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Changed activity detail</h4><p>Largest finish movements first. Showing '+escapeHtml(fmt(detail.length))+' changed activities.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Change</th><th>Finish shift d</th><th>Float shift h</th><th>Progress shift pp</th><th>Fields changed</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderRevisionTrendVisual(data){
  const p=projectionFor(data,"revision_trend");
  if(!Array.isArray(p.points))return"";
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||("Revision "+x.sequence)}));
  const latest=p.points.at(-1)||{};
  const kpis=planningKpis([
    ["Revisions",p.revisionCount,"controlled programmes"],
    ["Latest progress",latest.durationWeightedProgressPercent===null||latest.durationWeightedProgressPercent===undefined?"—":fmt(latest.durationWeightedProgressPercent)+"%","weighted"],
    ["Latest critical",latest.criticalCount,"activities","danger"],
    ["Latest near-critical",latest.nearCriticalCount,"activities","warning"],
    ["Latest negative float",latest.negativeFloatCount,"activities","danger"],
    ["Latest forecast",planningShortDate(latest.forecastCompletionIso),"completion"]
  ]);
  const progress=renderLineChart(points,[{key:"durationWeightedProgressPercent",label:"Weighted progress %",color:"#4f7fb4"}],100);
  const completion=planningDateTrend(points,[
    {key:"programmeCompletionIso",label:"Programme completion",color:"#506579"},
    {key:"forecastCompletionIso",label:"Forecast completion",color:"#4f7fb4"}
  ]);
  const pressure=renderLineChart(points,[
    {key:"criticalCount",label:"Critical",color:"#b4483e"},
    {key:"nearCriticalCount",label:"Near-critical",color:"#b57922"},
    {key:"negativeFloatCount",label:"Negative float",color:"#7a4b46"}
  ]);
  const changeBars=planningStatusBand([
    ["Added",latest.addedVsPrevious||0,"accent"],["Removed",latest.removedVsPrevious||0,"neutral"],["Modified",latest.modifiedVsPrevious||0,"warning"]
  ]);
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td><b>'+escapeHtml(x.label||("Revision "+x.sequence))+'</b><br><span class="muted">'+escapeHtml(planningShortDate(x.dataDateIso))+'</span></td><td>'+escapeHtml(x.durationWeightedProgressPercent===null?"—":fmt(x.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(x.activityCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.nearCriticalCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(planningShortDate(x.forecastCompletionIso))+'</td><td>'+escapeHtml(fmt((x.addedVsPrevious||0)+(x.removedVsPrevious||0)+(x.modifiedVsPrevious||0)))+'</td></tr>').join("");
  return '<section class="planning-view revision-view">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Completion movement</h4><p>How the programme and forecast completion dates have moved across revisions.</p></div></div><div class="planning-panel-body">'+completion+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Progress evolution</h4><p>Weighted schedule progress by revision.</p></div></div><div class="planning-panel-body">'+progress+'</div></section></div><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>Schedule pressure trend</h4><p>Critical, near-critical and negative-float activity counts by revision.</p></div></div><div class="planning-panel-body">'+pressure+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Latest revision change volume</h4><p>Activity additions, removals and modifications in the latest revision.</p></div></div><div class="planning-panel-body">'+changeBars+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Revision history</h4><p>Controlled programme revisions in chronological order.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Progress</th><th>Activities</th><th>Critical</th><th>Near-critical</th><th>Negative float</th><th>Forecast completion</th><th>Change volume</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderVarianceTrendVisual(data){
  const p=projectionFor(data,"variance_trends");
  if(!Array.isArray(p.points))return"";
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td>'+escapeHtml(x.revisionId)+'</td><td>'+escapeHtml(x.dataDateIso||"—")+'</td><td>'+escapeHtml(fmt(x.averageFinishVarianceDays))+'</td><td>'+escapeHtml(fmt(x.maximumDelayDays))+'</td><td>'+escapeHtml(x.lateActivityCount)+'</td><td>'+escapeHtml(x.earlyActivityCount)+'</td><td>'+escapeHtml(x.onTimeActivityCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(fmt(x.projectCompletionVarianceDays))+'</td></tr>').join("");
  return visualSection("Variance Trend","Finish variance and project completion movement by revision, with comparable-population coverage retained.",p.revisionCount+" revisions",'<div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Avg finish variance d</th><th>Max delay d</th><th>Late</th><th>Early</th><th>On time</th><th>Neg. float</th><th>Critical</th><th>Completion variance d</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderProgressBreakdownVisual(data){
  const p=projectionFor(data,"progress_breakdown");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.wbsId)+'</b><br><span class="muted">'+escapeHtml(r.wbsName||"")+'</span></td><td>'+escapeHtml(r.activityCount)+'</td><td>'+escapeHtml(r.completedCount)+'</td><td>'+escapeHtml(r.inProgressCount)+'</td><td>'+escapeHtml(r.notStartedCount)+'</td><td>'+escapeHtml(r.durationWeightedProgressPercent===null?"—":fmt(r.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(r.durationWeightedCoveragePercent===null?"—":fmt(r.durationWeightedCoveragePercent)+"%")+'</td><td>'+escapeHtml(r.criticalCount)+'</td><td>'+escapeHtml(r.nearCriticalCount)+'</td><td>'+escapeHtml(r.negativeFloatCount)+'</td></tr>').join("");
  return visualSection("WBS Progress Breakdown","Duration-weighted progress, coverage and schedule pressure by WBS without averaging unknown values as zero.",p.totalActivityCount+" activities",'<div class="table-wrap"><table><thead><tr><th>WBS</th><th>Activities</th><th>Complete</th><th>In progress</th><th>Not started</th><th>Weighted progress</th><th>Coverage</th><th>Critical</th><th>Near-critical</th><th>Neg. float</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderMilestonesVisual(data){
  const p=projectionFor(data,"milestones");
  if(!Array.isArray(p.rows))return"";
  const dd=planningDateMs(p.dataDateIso);
  const due30=p.rows.filter(r=>r.status!=="completed"&&planningDateMs(r.currentDateIso)!==null&&dd!==null&&planningDateMs(r.currentDateIso)>=dd&&planningDateMs(r.currentDateIso)<=dd+30*86400000).length;
  const largest=Math.max(0,...p.rows.map(r=>typeof r.varianceDays==="number"?r.varianceDays:0));
  const kpis=planningKpis([
    ["Milestones",p.milestoneCount,"total"],
    ["Completed",p.completedCount,"milestones","success"],
    ["Open",p.openCount,"milestones"],
    ["Late open",p.lateOpenCount,"milestones","danger"],
    ["Due next 30 days",due30,"milestones","warning"],
    ["Largest slip",largest?fmt(largest)+" days":"—","vs baseline",largest?"danger":""]
  ]);
  const timeline=planningMilestoneTimeline(p);
  const late=[...p.rows].filter(r=>r.status!=="completed"&&typeof r.varianceDays==="number"&&r.varianceDays>0).sort((a,b)=>b.varianceDays-a.varianceDays).slice(0,20);
  const upcoming=[...p.rows].filter(r=>r.status!=="completed"&&planningDateMs(r.currentDateIso)!==null).sort((a,b)=>planningDateMs(a.currentDateIso)-planningDateMs(b.currentDateIso)).slice(0,20);
  const rows=[...p.rows].sort((a,b)=>(b.varianceDays||0)-(a.varianceDays||0)).slice(0,250).map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(planningShortDate(r.baselineDateIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentDateIso))+'</td><td>'+escapeHtml(planningShortDate(r.actualDateIso))+'</td><td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td></tr>').join("");
  const attention=planningAttention([
    p.lateOpenCount?{title:"Late open milestones",text:"Open milestone dates have moved beyond baseline.",value:p.lateOpenCount,tone:"danger"}:null,
    due30?{title:"Milestones due in the next 30 days",text:"These commitments need near-term management attention.",value:due30,tone:"watch"}:null,
    late[0]?{title:"Largest milestone slip",text:(late[0].activityId+" · "+(late[0].name||"")),value:fmt(late[0].varianceDays)+" days",tone:"danger"}:null,
    upcoming[0]?{title:"Next open milestone",text:(upcoming[0].activityId+" · "+planningShortDate(upcoming[0].currentDateIso)),tone:"watch"}:null
  ]);
  return '<section class="planning-view milestone-view">'+kpis+'<section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Milestone timeline</h4><p>Baseline, current and actual dates on one timeline. The line shows the movement between dates.</p></div></div><div class="planning-panel-body">'+timeline+'</div></section><div class="planning-primary-grid"><section class="planning-panel"><div class="planning-panel-head"><div><h4>What needs attention</h4><p>Late and upcoming milestone commitments.</p></div></div><div class="planning-panel-body">'+attention+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone position</h4><p>Completed, open and late commitments.</p></div></div><div class="planning-panel-body">'+planningStatusBand([["Completed",p.completedCount,"success"],["Open",Math.max(0,p.openCount-p.lateOpenCount),"accent"],["Late",p.lateOpenCount,"danger"]])+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Milestone detail</h4><p>Largest schedule slips first.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Status</th><th>Baseline</th><th>Current</th><th>Actual</th><th>Variance d</th><th>Total float h</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderNearCriticalVisual(data){
  const p=projectionFor(data,"near_critical");
  if(!Array.isArray(p.rows))return"";
  const inProgress=p.rows.filter(r=>r.status==="in_progress").length;
  const notStarted=p.rows.filter(r=>r.status==="not_started").length;
  const slipped=p.rows.filter(r=>planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)>0).length;
  const kpis=planningKpis([
    ["Near-critical",p.nearCriticalCount,"activities","warning"],
    ["Watch threshold",fmt(p.nearCriticalThresholdHours)+" h","total float"],
    ["Float coverage",p.floatCoveragePercent===null?"—":fmt(p.floatCoveragePercent)+"%","current programme"],
    ["In progress",inProgress,"near-critical"],
    ["Not started",notStarted,"near-critical","warning"],
    ["Finish slipped",slipped,"near-critical","danger"]
  ]);
  const histogram=planningFloatHistogram(p.rows,p.nearCriticalThresholdHours);
  const watch=[...p.rows].map(r=>({...r,varianceDays:planningDaysBetween(r.baselineFinishIso,r.currentFinishIso)})).sort((a,b)=>a.totalFloatHours-b.totalFloatHours||((b.varianceDays||0)-(a.varianceDays||0))).slice(0,150);
  const scatter=planningActivityPressure(watch.map(r=>({...r,criticality:"near_critical",finishVarianceDays:r.varianceDays})));
  const rows=watch.map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(planningStateLabel(r.status))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(planningShortDate(r.baselineFinishIso))+'</td><td>'+escapeHtml(planningShortDate(r.currentFinishIso))+'</td><td class="'+((r.varianceDays||0)>0?"late-text":(r.varianceDays||0)<0?"early-text":"")+'">'+escapeHtml(r.varianceDays===null?"—":((r.varianceDays>0?"+":"")+fmt(r.varianceDays)))+'</td><td>'+escapeHtml(r.percentComplete===null?"—":fmt(r.percentComplete)+"%")+'</td></tr>').join("");
  return '<section class="planning-view nearcritical-view">'+kpis+'<div class="planning-primary-grid"><section class="planning-panel primary"><div class="planning-panel-head"><div><h4>Float risk distribution</h4><p>Activities closest to zero float are closest to becoming critical.</p></div></div><div class="planning-panel-body">'+histogram+'</div></section><section class="planning-panel"><div class="planning-panel-head"><div><h4>Finish pressure</h4><p>Later finishes to the right; lower float toward the bottom.</p></div></div><div class="planning-panel-body">'+scatter+'</div></section></div><section class="planning-panel"><div class="planning-panel-head"><div><h4>Near-critical watchlist</h4><p>Lowest float first, then the largest finish slips.</p></div></div><div class="planning-panel-body"><div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Total float h</th><th>Baseline finish</th><th>Current finish</th><th>Variance d</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section></section>';
}
function renderManhourVisual(data){
  const p=projectionFor(data,"manhour_scurve");
  if(!Array.isArray(p.points))return"";
  const chart=renderLineChart(p.points,[
    {key:"plannedCumulativeHours",label:"Planned hours",color:"#506579"},
    {key:"actualCumulativeHours",label:"Actual hours",color:"#d97706"},
    {key:"forecastCumulativeHours",label:"Forecast hours",color:"#4f7fb4"}
  ]);
  const top='<div class="position-grid" style="margin-bottom:14px">'+[
    ["Planned known",p.plannedHoursKnown+" h"],["Planned coverage",p.plannedAssignmentCoveragePercent===null?"—":fmt(p.plannedAssignmentCoveragePercent)+"%"],["Actual known",p.actualHoursKnownCurrent+" h"],["Actual coverage",p.actualAssignmentCoveragePercent===null?"—":fmt(p.actualAssignmentCoveragePercent)+"%"],["Remaining known",p.remainingHoursKnown+" h"],["Actual history",p.actualHistoryMethod]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div>';
  return visualSection("Man-Hour S-Curve","Labor work units only; actual history uses stored periods when available and never fabricates missing history.",p.actualState,top+chart);
}
function renderForecastHistoryVisual(data){
  const p=projectionFor(data,"forecast_history");
  if(!Array.isArray(p.points))return"";
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.dataDateIso||"—")+'</td><td>'+escapeHtml(x.sourceRevisionId)+'</td><td>'+escapeHtml(x.sourceForecastCompletionIso||"—")+'</td><td>'+escapeHtml(x.independentForecastCompletionIso||"—")+'</td><td>'+escapeHtml(fmt(x.movementDaysVsPrevious))+'</td><td>'+escapeHtml(fmt(x.movementDaysVsFirst))+'</td><td>'+escapeHtml(x.origin)+'</td><td>'+escapeHtml((x.assumptions||[]).join("; ")||"—")+'</td></tr>').join("");
  return visualSection("Forecast History","Independent forecast movement across controlled snapshots; source and independent dates remain separate.",p.establishedForecastCount+" established",'<div class="table-wrap"><table><thead><tr><th>Data date</th><th>Revision</th><th>Source forecast</th><th>Independent forecast</th><th>Move vs previous d</th><th>Move vs first d</th><th>Origin</th><th>Assumptions</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderNoticesClaimsVisual(data){
  const p=projectionFor(data,"notices_claims");
  if(!Array.isArray(p.events)||!Array.isArray(p.claims))return"";
  const totals='<div class="position-grid" style="margin-bottom:14px">'+[
    ["Timely notices",p.timelyNoticeCount],["Late notices",p.lateNoticeCount],["Missing notices",p.missingNoticeCount],["Official assessed days",p.officialAssessedDaysTotal],["Candidate/provisional days",p.provisionalOrCandidateAssessedDaysTotal],["Official assessed amount",p.officialAssessedAmountTotal],["Candidate/provisional amount",p.provisionalOrCandidateAssessedAmountTotal]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div>';
  const events='<div class="nested-title">Notice compliance by event</div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Start</th><th>Notice</th><th>Required days</th><th>Elapsed days</th><th>Timeliness</th><th>Claims</th></tr></thead><tbody>'+
    p.events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(e.responsibility)+'</td><td>'+escapeHtml(e.eventStartIso||"—")+'</td><td>'+escapeHtml(e.noticeIssuedAt||"—")+'</td><td>'+escapeHtml(fmt(e.requiredNoticeDays))+'</td><td>'+escapeHtml(fmt(e.elapsedNoticeDays))+'</td><td><span class="state-pill '+(e.noticeTimeliness==="timely"?"ready":e.noticeTimeliness==="late"?"blocked":"review")+'">'+escapeHtml(e.noticeTimeliness)+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td></tr>').join("")+
    '</tbody></table></div>';
  const claims='<div class="nested-title" style="margin-top:14px">Claim state & assessment authority</div><div class="table-wrap"><table><thead><tr><th>Claim</th><th>State</th><th>Submitted</th><th>Claimed days</th><th>Assessed days</th><th>Days authority</th><th>Claimed amount</th><th>Assessed amount</th><th>Amount authority</th></tr></thead><tbody>'+
    p.claims.map(c=>'<tr><td><b>'+escapeHtml(c.claimId)+'</b><br><span class="muted">'+escapeHtml(c.title||"")+'</span></td><td>'+escapeHtml(humanizeKey(c.state))+'</td><td>'+escapeHtml(c.submittedAt||"—")+'</td><td>'+escapeHtml(fmt(c.claimedDays))+'</td><td>'+escapeHtml(fmt(c.assessedDays))+'</td><td>'+escapeHtml(c.assessedDaysState)+'</td><td>'+escapeHtml(fmt(c.claimedAmount))+'</td><td>'+escapeHtml(fmt(c.assessedAmount))+'</td><td>'+escapeHtml(c.assessedAmountState)+'</td></tr>').join("")+
    '</tbody></table></div>';
  return visualSection("Notices, EOT & Claims","Actual notice timestamps drive timeliness; claimed and assessed values stay separate by authority.",p.claimCount+" claims",totals+events+claims);
}
function renderSpecializedModule(key,data){
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
  const asOf=root.dataDateIso||root.asOfIso||root.generatedAt||null;
  const authority=root.authority||root.forecast?.authority||root.seriesContract?.authority||null;
  const coverage=root.activityCoveragePercent??root.currentDateCoveragePercent??root.coveragePercent??root.floatCoveragePercent??root.progress?.durationWeightedProgressCoveragePercent??root.schedule?.floatCoveragePercent??null;
  const projectId=root.projectId||null;
  const revisionText=revision&&(String(revision).length>28||String(revision).includes("rev_")||String(revision).includes("schedrev_"))?"Current programme":revision;
  const authorityLabels={deterministic:"Calculated",scenario:"Scenario",unresolved:"Needs review",schedule_derived_scenario:"Scenario",candidate:"For review",official:"Approved"};
  const authorityText=authority?(authorityLabels[authority]||humanizeKey(authority)):null;
  const values=[
    ["Project",projectId],
    ["Programme basis",revisionText],
    ["Data date",asOf],
    ["Position",authorityText],
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
function renderModuleResult(result){
  const moduleName=names[result.key]||result.key;
  el("moduleTitle").textContent=moduleName;
  el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="badge "+statusClass(result.status);
  el("moduleBadge").textContent=statusLabel(result.status);
  if(result.status==="blocked"){
    el("moduleContent").innerHTML='<div class="view-state-bar"><span class="view-state-review">Calculation stopped</span><strong>'+escapeHtml(moduleName)+'</strong><span>More project information is required before this view can be calculated.</span></div><div class="notice warn"><b>This view needs additional project information</b><br>'+escapeHtml(result.reason||"Required project information is not yet available.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required information</b><span>'+escapeHtml(humanizeKey(x))+'</span></div>').join("")+'</div>';
    return;
  }
  const data=result.data||{};
  if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason))return;
  const basisHtml=renderModuleBasis(data);
  const challengeBody=renderUniversalChallenge(data.challenge);
  const challengeHtml=challengeBody?'<details class="reconciliation-panel" '+(data.challenge?.challengedCount?'open':'')+'><summary><span>Reconciliation with submitted position</span><b>'+(data.challenge?.challengedCount?escapeHtml(data.challenge.challengedCount)+' needs attention':'No material difference')+'</b></summary><div class="reconciliation-body">'+challengeBody+'</div></details>':'';
  const specialized=renderSpecializedModule(result.key,data);
  const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");
  const structured=renderStructuredSections(data);
  const genericView=(scalars?'<div class="scalar-grid">'+scalars+'</div>':'')+structured;
  const primaryView=specialized||genericView;
  const evidenceDetail=specialized&&structured?'<details class="technical-payload"><summary>More detail</summary><div style="padding:0 12px 12px">'+structured+'</div></details>':'';
  const generated=data.challenge?.generatedAt||findProjectionRoot(data)?.generatedAt||data.generatedAt||null;
  const viewState='<div class="view-state-bar"><span class="'+(result.status==="ready"?"view-state-complete":"view-state-review")+'">'+(result.status==="ready"?"Updated":"Updated · review needed")+'</span><strong>'+escapeHtml(moduleName)+'</strong>'+(generated?'<span>Updated '+escapeHtml(formatDocumentTime(generated))+'</span>':'')+'<span>Current position and the items that need attention are shown below.</span></div>';
  el("directorDrawer").open=false;
  el("moduleContent").innerHTML=viewState+basisHtml+(result.reason?'<div class="notice info">'+escapeHtml(result.reason)+'</div>':'')+primaryView+challengeHtml+evidenceDetail;
}
let moduleRequestSeq=0;
async function loadModule(key){
  if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}
  const moduleName=names[key]||key;
  const requestSeq=++moduleRequestSeq;
  el("moduleTitle").textContent=moduleName;
  el("topbarModule").textContent=moduleName;
  el("moduleBadge").className="badge";
  el("moduleBadge").textContent="Updating";
  setBusy("Updating "+moduleName);
  el("moduleContent").innerHTML='<div class="view-state-bar"><span class="spinner"></span><strong>Updating '+escapeHtml(moduleName)+'</strong><span>Preparing the latest project position.</span></div>';
  try{
    const result=await api("/api/projects/"+encodeURIComponent(project())+"/schedule/modules/"+encodeURIComponent(key));
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
function renderDirector(d){if(!d){el("director").innerHTML='<div class="card"><div class="empty">Director position will populate only when its governed schedule, contract, claims/EOT and commercial dependencies are available.</div></div>';return}const s=d.schedule,c=d.claims,ctrl=d.controls;let html='<div class="grid kpi">'+kpi("Data Date",s.dataDateIso)+kpi("Independent Forecast",s.independentForecastCompletionIso)+kpi("Official Completion",s.officialAdjustedCompletionIso||s.contractualCompletionIso)+kpi("Programme movement",c.observedProgrammeMovementDays,"days carried from schedule windows")+kpi("Time-impact candidate",c.analyticalTimeImpactCandidateDays,"analytical, not entitlement")+kpi("Attributable EOT candidate",c.attributableCandidateEotDays,"analytical, not awarded")+kpi("Official EOT",c.officialApprovedEotDays,"governed award only")+kpi("CPM integrity",s.independentCpmState,s.drivingPathState)+kpi("Claims linked",c.fullyLinkedClaimCount+" / "+c.claimCount,"claim → event → activity")+kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),d.ld.state)+'</div>';html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';(d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention held",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line"><span>'+x[0]+'</span><strong>'+escapeHtml(fmt(x[1]))+'</strong></div>').join("")+'</div>'});html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+'<div class="scalar"><b>Open HSE</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openHseIncidentCount))+'</span></div>'+'<div class="scalar"><b>LTI or worse</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openLtiOrWorseCount))+'</span></div>'+'<div class="scalar"><b>Major / critical NCR</b><span>'+escapeHtml(evidenceCount(ctrl.qualityEvidenceState,ctrl.openCriticalMajorNcrCount))+'</span></div>'+'<div class="scalar"><b>Overdue RFI</b><span>'+escapeHtml(evidenceCount(ctrl.rfiEvidenceState,ctrl.overdueRfiCount))+'</span></div>'+'<div class="scalar"><b>Permit issues</b><span>'+escapeHtml(evidenceCount(ctrl.permitEvidenceState,ctrl.overduePermitCount))+'</span></div>'+'<div class="scalar"><b>Expiring bonds</b><span>'+escapeHtml(evidenceCount(ctrl.bondEvidenceState,ctrl.expiringBondCount30Days))+'</span></div>'+'<div class="scalar"><b>Open risks</b><span>'+escapeHtml(evidenceCount(ctrl.riskEvidenceState,ctrl.openRiskCount))+'</span></div>'+'</div></div></div>';el("director").innerHTML=html}
function renderStatus(o){const ready=o.moduleStates.filter(x=>x.status==="ready").length,partial=o.moduleStates.filter(x=>x.status==="partial").length,blocked=o.moduleStates.filter(x=>x.status==="blocked").length;el("projectBadge").className="badge "+(o.demo?"partial":"ready");el("projectBadge").textContent=o.demo?"DEMONSTRATION PROJECT":"CURRENT PROJECT";el("projectStatus").innerHTML='<div class="scalar-grid">'+'<div class="scalar"><b>Baseline / revised baseline</b><span>'+fmt(o.baselineRevisionCount)+'</span></div>'+'<div class="scalar"><b>Updates</b><span>'+fmt(o.updateRevisionCount)+'</span></div>'+'<div class="scalar"><b>Recovery scenarios</b><span>'+fmt(o.recoveryRevisionCount)+'</span></div>'+'<div class="scalar"><b>Current Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+'<div class="scalar"><b>Project documents</b><span>'+fmt(o.evidenceDocumentCount)+'</span></div>'+'<div class="scalar"><b>Available views</b><span>'+ready+' / 22</span></div>'+'<div class="scalar"><b>Needs review</b><span>'+partial+'</span></div>'+'<div class="scalar"><b>Needs information</b><span>'+blocked+'</span></div>'+'</div>'}
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
      '<div class="document-state-item"><b>Current / used now</b><span>This is the current controlling document for its document family.</span></div>'+
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
      const position=documentUseLabel(d.basisState||"historical");
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
  await refresh(false);
  setAppView("project");
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
async function refresh(bootstrapDemo=true){setBusy("Refreshing project");try{overview=await api("/api/projects/"+encodeURIComponent(project())+"/overview");renderStatus(overview);updateActiveProjectShell();renderNav();let director=null;try{director=await api("/api/projects/"+encodeURIComponent(project())+"/director-position")}catch{}renderDirector(director);await loadEvidence();await loadModule(selected);localStorage.setItem("cmeng-project",project())}catch(e){if(bootstrapDemo&&e.status===404&&project()==="UAT-DEMO"){try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});return await refresh(false)}catch{}}overview=null;updateActiveProjectShell();renderNav();renderDirector(null);el("projectStatus").innerHTML='<div class="notice warn">Open or create a project, then add project documents.</div>';el("projectBadge").className="badge blocked";el("projectBadge").textContent="NO PROJECT";await loadEvidence()}finally{setBusy("")}}
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
async function loadRelease(){try{await api("/health");el("releaseStatus").textContent="Live"}catch{el("releaseStatus").textContent="Connection issue"}}

el("scheduleFiles").onchange=e=>{scheduleSelection=[...e.target.files];renderScheduleQueue()};
el("boqFiles").onchange=e=>{boqSelection=[...e.target.files];renderSimpleQueue("boqQueue",boqSelection,"boq")};
el("contractFiles").onchange=e=>{contractSelection=[...e.target.files];renderContractQueue()};
el("evidenceFiles").onchange=e=>{evidenceSelection=[...e.target.files];renderSimpleQueue("evidenceQueue",evidenceSelection,"evidence")};
el("uploadSchedules").onclick=uploadSchedules;el("uploadBoqs").onclick=uploadBoqs;el("uploadContracts").onclick=uploadContracts;el("uploadEvidence").onclick=uploadEvidence;
const storedProject=localStorage.getItem("cmeng-project");const storedModule=localStorage.getItem("cmeng-module");if(storedModule&&names[storedModule])selected=storedModule;el("projectId").value=storedProject||"";el("projectId").addEventListener("change",()=>openProject(project()));setFocusMode(localStorage.getItem("cmeng-focus")==="1");renderAiSuggestions();renderPlatformNav();renderNav();loadRelease();loadPortfolio();if(storedProject){refresh(false).catch(()=>{})}setAppView("portfolio");
</script>
</body>
</html>`;
}
