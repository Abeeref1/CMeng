import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomInt,randomUUID,createHash} from 'node:crypto';

import { parseBoqPdf } from "../packages/boq-pdf-parser/src";
import type { OcrPageResult, OcrProvider } from "../packages/pdf-document-parser/src";

test('a merged native description header retains rows with an empty leading subdivision',async()=>{
 const parsed=await parseBoqPdf(readFileSync(resolve('tests/fixtures/boq-scanned-regressions/native-leading-blank-column.pdf')));
 const items=parsed.items.filter(item=>item.rowKind==='line_item');assert.equal(items.length,17);
 for(const [description,quantity,amount] of [['Project Billboard',1,9329.47],['Common Excavation',13677.49,2699799.75],['Demolition',188.7,104232.22]] as const){
  const item=items.find(item=>item.description.includes(description));assert.ok(item,description);
  assert.equal(item.quantity,quantity);assert.equal(item.rate,null);assert.equal(item.amount,amount);
  assert.equal(item.sourceCells.quantity!.column,3,'Keep the original extracted cell coordinate');
  assert.ok(!item.diagnostics.includes('BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED'),'Aligned native values need no repeated numeric review');
 }
 assert.equal(parsed.items.find(item=>item.description.includes('APPROVED BUDGET'))!.rowKind,'total_or_summary');
});

test('Items of Work is a native BOQ description header and its contract budget is not an item',async()=>{
 const parsed=await parseBoqPdf(readFileSync(resolve('tests/fixtures/boq-scanned-regressions/native-items-of-work.pdf')));
 const items=parsed.items.filter(item=>item.rowKind==='line_item');assert.equal(items.length,13);
 const first=items.find(item=>item.description.includes('Common Excavation'))!;assert.ok(first);
 assert.equal(first.quantity,204.71);assert.equal(first.amount,17095.9);assert.equal(first.unit,'cu.m');
 assert.equal(parsed.items.find(item=>item.description.includes('APPROVED BUDGET'))!.rowKind,'total_or_summary');
 assert.equal(parsed.items.find(item=>item.description.includes('APPROVED BUDGET'))!.amount,3851975.04);
});

test('ten fresh native projects preserve merged headers, shuffled commercial columns, zero and signs',async t=>{
 for(let n=0;n<10;n++){
  const id=randomUUID(),pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([650,500]);
  const names=n%2?['Description','Unit','Amount','Quantities']:['Items of Work','Quantity','Unit','Amount'];
  const xs=[30,320,410,500,620],top=430,h=40,divisions=1+n%2;
  for(let row=0;row<=5;row++)page.drawLine({start:{x:30,y:top-row*h},end:{x:620,y:top-row*h},thickness:1});
  for(const x of xs)page.drawLine({start:{x,y:top},end:{x,y:top-5*h},thickness:1});
  for(let d=1;d<=divisions;d++)page.drawLine({start:{x:30+d*14,y:top-h},end:{x:30+d*14,y:top-5*h},thickness:1});
  names.forEach((name,col)=>page.drawText(name,{x:xs[col]!+4,y:top-22,size:10,font}));
  const expected=[0,randomInt(1,10000)/100,-randomInt(1,1000)/100,randomInt(1000,9000)];
  const amounts=expected.map(q=>Number((q*randomInt(10,100)).toFixed(2)));
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const name=names[col]!,value=col===0?'Work '+id.slice(0,8)+' '+row:name==='Unit'?'m3':name==='Amount'?amounts[row]!.toFixed(2):expected[row]!.toFixed(2);
   page.drawText(value,{x:xs[col]!+4+(col===0?divisions*14:0),y:top-(row+1)*h-22,size:10,font});
  }
  const bytes=Buffer.from(await pdf.save()),parsed=await parseBoqPdf(bytes),items=parsed.items.filter(i=>i.rowKind==='line_item');
  assert.equal(items.length,4,id);
  items.forEach((item,row)=>{assert.equal(item.quantity,expected[row],id);assert.equal(item.amount,amounts[row],id);assert.equal(item.unit,'m3');assert.equal(item.rate,null);assert.equal(item.status,'verified');assert.equal(item.sourceCells.quantity!.column,n%2?4+divisions:2+divisions);});
  t.diagnostic(JSON.stringify({projectId:id,sourceHash:createHash('sha256').update(bytes).digest('hex'),quantities:expected,amounts}));
 }
});

const DEFAULT_OCR =
  "Item Description Unit Qty Rate Amount\n1 Excavation m3 100 20 2000";

class FakeOcr implements OcrProvider {
  readonly name = "fake-ocr";
  constructor(private readonly text = DEFAULT_OCR) {}
  async recognize(_image: Uint8Array, _pageNumber: number): Promise<OcrPageResult> {
    return {
      text: this.text,
      confidence: 0.99,
      language: "eng",
      diagnostics: [],
    };
  }
}

function evidenceRows(
  ocrText: string,
  rows: string[][],
) {
  let cursor = 0;
  return rows.map((row) =>
    row.map((value) => {
      let start = ocrText.indexOf(value, cursor);
      if (start < 0) start = ocrText.indexOf(value);
      if (start < 0) {
        return {
          value,
          sourceStart: 0,
          sourceEnd: 1,
          sourceText: ocrText.slice(0, 1),
        };
      }
      const end = start + value.length;
      cursor = end;
      return {
        value,
        sourceStart: start,
        sourceEnd: end,
        sourceText: ocrText.slice(start, end),
      };
    }),
  );
}

async function nativeTextPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText("BOQ narrative page without a structured table", {
    x: 50,
    y: 780,
    size: 12,
    font,
  });
  return Buffer.from(await pdf.save());
}

async function blankScannedPlaceholderPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  return Buffer.from(await pdf.save());
}

async function nativeTablePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);

  const xs = [40, 95, 280, 345, 405, 465, 555];
  const top = 780;
  const rowHeight = 28;

  for (let row = 0; row <= 2; row += 1) {
    page.drawLine({
      start: { x: xs[0]!, y: top - row * rowHeight },
      end: { x: xs.at(-1)!, y: top - row * rowHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  for (const x of xs) {
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - 2 * rowHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  const header = ["Item", "Description", "Unit", "Qty", "Rate", "Amount"];
  const data = ["1", "Excavation", "m3", "100", "20", "2000"];

  header.forEach((value, index) => {
    page.drawText(value, {
      x: xs[index]! + 3,
      y: top - 18,
      size: 9,
      font,
    });
  });

  data.forEach((value, index) => {
    page.drawText(value, {
      x: xs[index]! + 3,
      y: top - rowHeight - 18,
      size: 9,
      font,
    });
  });

  return Buffer.from(await pdf.save());
}

test("native BOQ narrative page without structured table fails closed", async () => {
  const parsed = await parseBoqPdf(await nativeTextPdf());

  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.ok(
    parsed.diagnostics.some((d) =>
      d.includes("BOQ_PDF_NATIVE_PAGE_WITHOUT_STRUCTURED_TABLE"),
    ),
  );
});

test("OCR BOQ page requires structured extractor, not plain OCR text", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
  });

  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.ok(
    parsed.diagnostics.some((d) =>
      d.includes("BOQ_PDF_OCR_PAGE_REQUIRES_STRUCTURED_TABLE_EXTRACTOR"),
    ),
  );
});

test("balanced high-confidence OCR retains its readings without certifying numeric truth", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
    aiTableExtractor: {
      name: "fake-structured-ai",
      async extract() {
        return {
          confidence: 0.99,
          diagnostics: [],
          rows: evidenceRows(DEFAULT_OCR, [
            ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
            ["1", "Excavation", "m3", "100", "20", "2000"],
          ]),
        };
      },
    },
  });

  assert.equal(parsed.complete, false);
  assert.equal(parsed.ocrTablePages, 1);
  assert.equal(parsed.candidateRows, 1);
  assert.equal(parsed.verifiedRows, 0);
  assert.equal(parsed.unresolvedRows, 1);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.equal(parsed.items[0]!.quantity, 100);
  assert.equal(parsed.items[0]!.rate, 20);
  assert.equal(parsed.items[0]!.amount, 2000);
  assert.equal(parsed.items[0]!.sourceCells.amount!.page, 1);
  assert.ok(parsed.items[0]!.diagnostics.includes('BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED'));
  assert.ok(!parsed.items[0]!.diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH'),'The observed arithmetic still balances; that alone does not certify OCR');
});

test("AI-extracted OCR BOQ with wrong arithmetic remains unresolved", async () => {
  const wrongOcr =
    "Item Description Unit Qty Rate Amount\n1 Excavation m3 100 20 2500";
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(wrongOcr),
    aiTableExtractor: {
      name: "fake-structured-ai",
      async extract() {
        return {
          confidence: 0.99,
          diagnostics: [],
          rows: evidenceRows(wrongOcr, [
            ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
            ["1", "Excavation", "m3", "100", "20", "2500"],
          ]),
        };
      },
    },
  });

  assert.equal(parsed.complete, false);
  assert.equal(parsed.unresolvedRows, 1);
  assert.ok(
    parsed.items[0]!.diagnostics.includes("BOQ_AMOUNT_ARITHMETIC_MISMATCH"),
  );
});

test("native drawn BOQ table is structurally discovered when PDF table engine recognizes it", async () => {
  const parsed = await parseBoqPdf(await nativeTablePdf());

  if (parsed.nativeTablePages === 0) {
    assert.equal(parsed.complete, false);
    assert.deepEqual(parsed.unresolvedPages, [1]);
    return;
  }

  assert.equal(parsed.candidateRows, 1);
  assert.equal(parsed.items[0]!.quantity, 100);
  assert.equal(parsed.items[0]!.rate, 20);
  assert.equal(parsed.items[0]!.amount, 2000);
});

test("high-confidence AI BOQ cell without valid OCR source span is rejected", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
    aiTableExtractor: {
      name: "fake-structured-ai",
      async extract() {
        return {
          confidence: 0.9999,
          diagnostics: [],
          rows: [
            [
              { value: "Item", sourceStart: 0, sourceEnd: 4, sourceText: "Item" },
              { value: "Description", sourceStart: 5, sourceEnd: 16, sourceText: "Description" },
              { value: "Unit", sourceStart: 17, sourceEnd: 21, sourceText: "Unit" },
              { value: "Qty", sourceStart: 22, sourceEnd: 25, sourceText: "Qty" },
              { value: "Rate", sourceStart: 26, sourceEnd: 30, sourceText: "Rate" },
              { value: "Amount", sourceStart: 31, sourceEnd: 37, sourceText: "Amount" },
            ],
            [
              {
                value: "999999",
                sourceStart: 38,
                sourceEnd: 39,
                sourceText: DEFAULT_OCR.slice(38, 39),
              },
            ],
          ],
        };
      },
    },
  });

  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.ok(
    parsed.diagnostics.some((d) =>
      d.includes("BOQ_AI_VALUE_NOT_SUPPORTED_BY_SOURCE"),
    ),
  );
});

for (const attack of [
  { name: 'decimal point removed', source: ['3.00','2','6.00'], changed: ['300','2','600'] },
  { name: 'minus sign removed', source: ['-3','2','-6'], changed: ['3','2','6'] },
  { name: 'numeric prefix truncated', source: ['100','2','200'], changed: ['10','2','20'] },
] as const) test('AI source validation rejects '+attack.name+' even when changed arithmetic balances', async()=>{
  const sourceRows=[['Item','Description','Unit','Qty','Rate','Amount'],['1','Painting steel','m2',...attack.source]];
  const text=sourceRows.map(r=>r.join(' ')).join('\n');
  const rows=evidenceRows(text,sourceRows);
  attack.changed.forEach((value,index)=>{rows[1]![index+3]!.value=value;});
  const parsed=await parseBoqPdf(await blankScannedPlaceholderPdf(),{
    ocrProvider:new FakeOcr(text),
    aiTableExtractor:{name:'adversarial-source-mutation',async extract(){return {rows,confidence:1,diagnostics:[]};}},
  });
  assert.equal(parsed.complete,false);
  assert.equal(parsed.items.length,0,'A balancing AI rewrite is not source evidence');
  assert.ok(parsed.diagnostics.some(d=>d.includes('BOQ_AI_VALUE_NOT_SUPPORTED_BY_SOURCE')));
});
