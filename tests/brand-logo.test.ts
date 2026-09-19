import test from "node:test";
import assert from "node:assert/strict";

import {
  cmengLogoDataUri,
} from "../packages/runtime-api/src/brand-logo";

test("CMeng portal logo is a valid transparent PNG asset", () => {
  assert.match(
    cmengLogoDataUri,
    /^data:image\/png;base64,/,
  );

  const encoded =
    cmengLogoDataUri.split(",")[1] ?? "";
  const bytes =
    Buffer.from(
      encoded,
      "base64",
    );

  assert.ok(
    bytes.length > 12000,
    "CMeng logo must contain the full emblem, not a truncated asset",
  );
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ],
    "CMeng logo must decode to a PNG",
  );
});
