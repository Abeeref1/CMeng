import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';

// P0-A / C1 invariant. The same action list is rendered twice: in the page
// panel (Actions required) and in the Project review drawer. A save must read
// only the action block that holds the control the user clicked. This test
// drives every action kind through both copies, with the drawer copy first in
// the document (as in the real page), so a page-wide lookup fails here.

test('C1 mechanism: no action save path finds its form through a page-wide lookup', () => {
  const s = projectActionsScript;
  assert.doesNotMatch(s, /document\.querySelector(?:All)?\(\s*['"]\[data-action-id/, 'an action form is looked up page-wide');
  const count = (re: RegExp) => (s.match(re) || []).length;
  // Every call site (and each definition) carries the clicked control ("from").
  assert.equal(count(/\bactionNode\(/g), count(/\bactionNode\(id,from\)/g), 'actionNode called without the clicked control');
  assert.equal(count(/\bactionMessage\(/g), count(/\bactionMessage\(id,from,/g), 'actionMessage called without the clicked control');
  assert.equal(count(/\bsetActionBusy\(/g), count(/\bsetActionBusy\(id,from,/g), 'setActionBusy called without the clicked control');
  // Every bound save control hands itself to its resolver.
  const bindings = [...s.matchAll(/querySelectorAll\('\[data-(?:resolve|assign)-[a-z-]+\]'\)\.forEach\(b=>b\.onclick=\(\)=>(\w+)\(([^;]*?)\)\);/g)];
  assert.ok(bindings.length >= 10, 'expected every resolve and assign binding, found ' + bindings.length);
  for (const [, fn, args] of bindings) assert.match(args!, /,b$/, fn + ' is bound without the clicked control');
});

type Values = Record<string, string | {name: string}[]>;
function actionCopies(id: string, page: Values, drawer: Values) {
  const make = (values: Values) => {
    const message = {textContent: ''};
    const node: any = {
      getAttribute: (name: string) => (name === 'data-action-id' ? id : null),
      querySelector: (selector: string) => {
        if (selector === '.action-inline-message') return message;
        const value = values[selector];
        if (value === undefined) return null;
        return Array.isArray(value) ? {files: value} : {value, checked: false};
      },
      querySelectorAll: () => [],
    };
    return {node, message, button: {closest: () => node}};
  };
  return {page: make(page), drawer: make(drawer)};
}

test('C1 mechanism: every action kind saves the values of the copy that was clicked, page or drawer', async () => {
  const kinds: Array<{id: string; action: any; run: string; page: Values; drawer: Values; read: (call: any) => unknown; pageValue: unknown; drawerValue: unknown}> = [
    {id: 'review', action: {id: 'review', reviewFingerprint: 'fp', target: {kind: 'review-x'}},
      run: 'resolveReviewDecision', page: {'.review-choice': 'page_choice'}, drawer: {'.review-choice': 'drawer_choice'},
      read: c => c.body.choice, pageValue: 'page_choice', drawerValue: 'drawer_choice'},
    {id: 'assign', action: {id: 'assign', target: {}},
      run: 'saveActionAssignment', page: {'.action-assign-owner': 'Page Owner', '.action-assign-due': '2031-01-01'},
      drawer: {'.action-assign-owner': 'Drawer Owner', '.action-assign-due': '2032-02-02'},
      read: c => c.body.owner + '|' + c.body.dueIso, pageValue: 'Page Owner|2031-01-01', drawerValue: 'Drawer Owner|2032-02-02'},
    {id: 'schedule', action: {id: 'schedule', target: {needsPurpose: true, revisionId: 'R1', sourceHash: 'h'}},
      run: 'resolveScheduleAction', page: {'.action-schedule-role': 'baseline', '.action-schedule-approval': 'PAGE-REF'},
      drawer: {'.action-schedule-role': 'update', '.action-schedule-approval': 'DRAWER-REF'},
      read: c => c.body.role + '|' + c.body.approvalReference, pageValue: 'baseline|PAGE-REF', drawerValue: 'update|DRAWER-REF'},
    {id: 'document', action: {id: 'document', target: {documentId: 'D1', sourceHash: 'h'}},
      run: 'resolveDocumentAction', page: {'.action-document-kind': 'amends', '.action-document-target': 'DOC-PAGE'},
      drawer: {'.action-document-kind': 'replaces', '.action-document-target': 'DOC-DRAWER'},
      read: c => c.body.kind + '|' + c.body.targetDocumentId, pageValue: 'amends|DOC-PAGE', drawerValue: 'replaces|DOC-DRAWER'},
    {id: 'upload', action: {id: 'upload', target: {uploadMode: 'evidence'}},
      run: 'resolveUploadAction', page: {'.action-upload-file': [{name: 'page.pdf'}]}, drawer: {'.action-upload-file': [{name: 'drawer.pdf'}]},
      read: c => c.headers['x-source-filename'], pageValue: 'page.pdf', drawerValue: 'drawer.pdf'},
    {id: 'completion', action: {id: 'completion', target: {}},
      run: 'resolveContractCompletionAction', page: {'.action-contract-completion-date': '2031-03-03'}, drawer: {'.action-contract-completion-date': '2032-04-04'},
      read: c => c.body.dateIso, pageValue: '2031-03-03', drawerValue: '2032-04-04'},
    {id: 'value', action: {id: 'value', target: {kind: 'contract-value'}},
      run: 'resolveMissingValueAction', page: {'.action-missing-amount': '12345678', '.action-missing-currency': 'SAR'},
      drawer: {'.action-missing-amount': '87654321', '.action-missing-currency': 'AED'},
      read: c => c.body.amount + '|' + c.body.currency, pageValue: '12345678|SAR', drawerValue: '87654321|AED'},
    {id: 'days', action: {id: 'days', target: {kind: 'approved-eot-days'}},
      run: 'resolveMissingValueAction', page: {'.action-missing-days': '41'}, drawer: {'.action-missing-days': '97'},
      read: c => c.body.days, pageValue: '41', drawerValue: '97'},
  ];
  for (const kind of kinds) {
    const copies = actionCopies(kind.id, kind.page, kind.drawer);
    for (const clicked of ['page', 'drawer'] as const) {
      const calls: any[] = [];
      const ctx: any = {
        CSS: {escape: String}, fmt: String, escapeHtml: String, project: () => 'P',
        // The drawer comes first in the document, as on the real page.
        document: {querySelector: () => copies.drawer.node, querySelectorAll: () => [copies.drawer.node, copies.page.node]},
        fileType: () => 'application/pdf', refresh: async () => {},
        api: async (path: string, request: any) => {
          calls.push({path, headers: request?.headers || {}, body: typeof request?.body === 'string' ? JSON.parse(request.body) : {}});
          return {};
        },
        seed: {projectId: 'P', status: 'ready', data: {projectVersion: 3, actions: [kind.action], information: []}},
        from: copies[clicked].button,
      };
      runInNewContext(projectActionsScript + '\nprojectActionState=seed;', ctx);
      const args = kind.run === 'saveActionAssignment' ? "'" + kind.id + "',false,from" : kind.run === 'resolveUploadAction' ? "'" + kind.id + "',null,from" : "'" + kind.id + "',from";
      await runInNewContext(kind.run + '(' + args + ')', ctx);
      assert.ok(calls.length >= 1, kind.id + ' from the ' + clicked + ' copy sent no request');
      assert.equal(kind.read(calls[0]), clicked === 'page' ? kind.pageValue : kind.drawerValue,
        kind.id + ': the save from the ' + clicked + ' copy sent the other copy\'s values');
    }
  }
});
