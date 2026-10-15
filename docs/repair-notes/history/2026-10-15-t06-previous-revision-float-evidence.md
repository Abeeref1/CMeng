# 2026-10-15: T06 earlier-float evidence
Parent: 2a8fbe6cb6e8fa328aca8e9282a1185b358f214e.
Source: packages/near-critical-analysis/src/projector.ts.
Root defect: unread, NaN and infinite earlier total-float values generated invalid float-erosion figures in specialist rows, while management aggregates filtered them.
Correction: only finite earlier float is comparable; genuine zero remains valid. Original source objects are unchanged.
Independent test: tests/t06-activity-float-working-days-truth.test.ts (two isolated calendars, signed erosion, zero, missing and invalid previous values, completed work, group counts and unchanged inputs).
Parent CI: acceptance PASS, independent PASS, raster PASS, concurrency PASS, regression FAIL (27), operations FAIL (four-cold maximum 8918.494ms > 5000ms).
This is not completion of any owner finish-list item. T01–T12 and original seven-stage acceptance remain open.
Next: verify new commit CI and continue source-supported shared repairs and remaining original inventory.
