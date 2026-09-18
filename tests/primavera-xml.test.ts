import test from "node:test";
import assert from "node:assert/strict";

import { parsePrimaveraXml } from "../packages/primavera-xml-parser/src";

test("Primavera XML reads projects activities WBS calendars and relationships", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V1">
    <Project>
      <ObjectId>10</ObjectId>
      <Id>P88</Id>
      <Name>Project 88</Name>
    </Project>
    <WBS><ObjectId>100</ObjectId><ProjectObjectId>10</ProjectObjectId><Code>1.1</Code></WBS>
    <Calendar><ObjectId>500</ObjectId><Name>5 Day</Name></Calendar>
    <Activity>
      <ProjectObjectId>10</ProjectObjectId>
      <ObjectId>1000</ObjectId>
      <Id>A100</Id>
      <Name>Excavation</Name>
      <WBSObjectId>100</WBSObjectId>
      <CalendarObjectId>500</CalendarObjectId>
      <OriginalDuration>80</OriginalDuration>
      <RemainingDuration>40</RemainingDuration>
      <TotalFloat>16</TotalFloat>
    </Activity>
    <Activity>
      <ProjectObjectId>10</ProjectObjectId>
      <ObjectId>1001</ObjectId>
      <Id>A200</Id>
      <Name>Foundation</Name>
      <WBSObjectId>100</WBSObjectId>
      <CalendarObjectId>500</CalendarObjectId>
      <OriginalDuration>120</OriginalDuration>
      <RemainingDuration>120</RemainingDuration>
      <TotalFloat>0</TotalFloat>
    </Activity>
    <Relationship>
      <PredecessorProjectObjectId>10</PredecessorProjectObjectId>
      <SuccessorProjectObjectId>10</SuccessorProjectObjectId>
      <PredecessorActivityObjectId>1000</PredecessorActivityObjectId>
      <SuccessorActivityObjectId>1001</SuccessorActivityObjectId>
      <Type>Finish to Start</Type>
      <Lag>8</Lag>
    </Relationship>
  </APIBusinessObjects>`;

  const parsed = parsePrimaveraXml(Buffer.from(xml, "utf8"));
  assert.equal(parsed.activityCount, 2);
  assert.equal(parsed.relationshipCount, 1);
  assert.equal(parsed.calendarsSeen, 1);
  assert.equal(parsed.wbsSeen, 1);
  assert.equal(parsed.activities[0]!.id, "A100");
  assert.equal(parsed.activities[0]!.originalDurationHours, 80);
  assert.equal(parsed.relationships[0]!.lagHours, 8);
  assert.equal(parsed.sourceComplete, true);
  assert.equal(parsed.graphComplete, true);
  assert.equal(parsed.complete, true);
});

test("external Primavera XML relationship is preserved and blocks graph completeness only", () => {
  const xml = `
  <APIBusinessObjects>
    <Project><ObjectId>10</ObjectId><Id>P88</Id></Project>
    <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1001</ObjectId><Id>A200</Id></Activity>
    <Relationship>
      <PredecessorProjectObjectId>99</PredecessorProjectObjectId>
      <SuccessorProjectObjectId>10</SuccessorProjectObjectId>
      <PredecessorActivityObjectId>9000</PredecessorActivityObjectId>
      <SuccessorActivityObjectId>1001</SuccessorActivityObjectId>
      <Type>Finish to Start</Type>
      <Lag>0</Lag>
    </Relationship>
  </APIBusinessObjects>`;

  const parsed = parsePrimaveraXml(Buffer.from(xml, "utf8"));
  assert.equal(parsed.externalRelationships, 1);
  assert.equal(parsed.sourceComplete, true);
  assert.equal(parsed.graphComplete, false);
  assert.equal(parsed.complete, false);
});

test("unresolved internal XML relationship cannot be certified", () => {
  const xml = `
  <APIBusinessObjects>
    <Project><ObjectId>10</ObjectId><Id>P88</Id></Project>
    <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1001</ObjectId><Id>A200</Id></Activity>
    <Relationship>
      <PredecessorProjectObjectId>10</PredecessorProjectObjectId>
      <SuccessorProjectObjectId>10</SuccessorProjectObjectId>
      <PredecessorActivityObjectId>9999</PredecessorActivityObjectId>
      <SuccessorActivityObjectId>1001</SuccessorActivityObjectId>
    </Relationship>
  </APIBusinessObjects>`;

  const parsed = parsePrimaveraXml(Buffer.from(xml, "utf8"));
  assert.equal(parsed.unresolvedRelationships, 1);
  assert.equal(parsed.sourceComplete, false);
  assert.ok(parsed.relationships[0]!.diagnostics.includes("P6XML_PREDECESSOR_REFERENCE_UNRESOLVED"));
});

test("duplicate Primavera XML activity identity is explicit", () => {
  const xml = `
  <APIBusinessObjects>
    <Project><ObjectId>10</ObjectId><Id>P88</Id></Project>
    <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1001</ObjectId><Id>A1</Id></Activity>
    <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1001</ObjectId><Id>A2</Id></Activity>
  </APIBusinessObjects>`;

  const parsed = parsePrimaveraXml(Buffer.from(xml, "utf8"));
  assert.equal(parsed.sourceComplete, false);
  assert.ok(parsed.diagnostics.some(d=>d.startsWith("P6XML_DUPLICATE_ACTIVITY_IDENTITIES")));
});
