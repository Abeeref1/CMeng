import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectDocumentRegister} from '../packages/runtime-api/src/server';
import {overviewForProject} from '../packages/runtime-api/src/project-projections';

// SW-14 / R3: every uploaded document carries a visible reading state, and the
// documents page and the project overview give the same unread count. Deferred
// reading says what will read it and when, or why it will not be read.
const STATES=new Set(['read','reading','queued','partial','not_read']);

test('every uploaded document has a reading state, an unread count and a deferred list',async()=>{
  const priorOcr=process.env.CMENG_OCR_ENABLED;process.env.CMENG_OCR_ENABLED='0';
  try{
    const projectId='SW14-'+randomUUID();
    await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'site_notes.txt',
      bytes:Buffer.from('Site meeting notes. The pump room handover is planned after commissioning.\n'),mediaType:'text/plain',uploadedAt:'2032-02-01'});
    const pdf=await PDFDocument.create();pdf.addPage([200,200]);pdf.addPage([200,200]);
    await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'scanned_letter.pdf',bytes:Buffer.from(await pdf.save()),mediaType:'application/pdf',uploadedAt:'2032-02-01'});
    await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'site_photo_archive.bin',bytes:Buffer.from([0,1,2,3,4,5,6,7]),mediaType:'application/octet-stream',uploadedAt:'2032-02-01'});

    const register=projectDocumentRegister(projectId) as any;
    assert.equal(register.documentCount,3);
    for(const document of register.documents){
      assert.ok(document.readingStatus,'reading state missing for '+document.sourceFilename);
      assert.ok(STATES.has(document.readingStatus.state),document.sourceFilename+': '+document.readingStatus.state);
      assert.equal(typeof document.readingStatus.label,'string');
      // Anything not read must say why, or what will read it and when.
      if(document.readingStatus.state!=='read'){
        assert.ok(document.readingStatus.when,'no "when" for '+document.sourceFilename);
        assert.ok(document.readingStatus.readBy||document.readingStatus.reason,'no reader or reason for '+document.sourceFilename);
      }
      // Existing keys are kept.
      assert.ok('readReview' in document&&'parserState' in document);
    }
    const byName=(name:string)=>register.documents.find((d:any)=>d.sourceFilename===name).readingStatus;
    assert.equal(byName('site_notes.txt').state,'read');
    const binary=byName('site_photo_archive.bin');
    // Nothing was read from this file: it must not show as partly read.
    assert.equal(binary.state,'not_read');
    assert.equal(binary.reasonCode,'no_reader');
    assert.equal(binary.when,'Will not be read');
    const before=byName('scanned_letter.pdf');
    assert.equal(before.state,'queued');
    assert.match(before.readBy,/PDF reader/);
    assert.match(before.when,/server starts/);

    const summary=register.documentReading;
    assert.equal(summary.total,3);
    assert.equal(summary.read,1);
    assert.equal(summary.unreadCount,2);
    assert.equal(summary.read+summary.reading+summary.queued+summary.partial+summary.notRead,summary.total);
    assert.deepEqual(summary.unread.map((u:any)=>u.sourceFilename).sort(),['scanned_letter.pdf','site_photo_archive.bin']);
    assert.match(summary.statement,/^2 of 3 documents are not fully read/);

    // The project overview uses the same rule and gives the same count.
    const overview=overviewForProject(projectId) as any;
    assert.deepEqual(overview.documentReading,summary);

    // After the background reader has tried the PDF with OCR off, the PDF is no
    // longer "queued": it is read, or it says OCR is off and when it will be read.
    // The reader matches the stored (normalised) project id.
    await runtimeProjects.refreshDeferredPdfReads(runtimeProjects.get(projectId)!.projectId);
    const after=(projectDocumentRegister(projectId) as any).documents.find((d:any)=>d.sourceFilename==='scanned_letter.pdf').readingStatus;
    assert.notEqual(after.state,'queued');
    if(after.state!=='read'){
      assert.equal(after.reasonCode,'ocr_off');
      assert.match(after.reason,/OCR is turned off/);
      assert.match(after.when,/OCR is turned on/);
    }
  }finally{
    if(priorOcr===undefined)delete process.env.CMENG_OCR_ENABLED;else process.env.CMENG_OCR_ENABLED=priorOcr;
  }
});
