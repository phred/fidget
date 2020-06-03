import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

import { Parser } from "./interpreter.ts";

Deno.test("simple string parsing", () => {
  const program = "forth love if honk then";
  let cursor = Parser(program);
  assertEquals(cursor.tokens.length, 5);
});

Deno.test("walking a cursor", () => {
  const program = "2 3 +";
  let cursor = Parser(program);
  assertEquals(cursor.nextToken(), "2");
  assertEquals(cursor.curToken(), "3");
  assertEquals(cursor.nextToken(), "3");
  assertEquals(cursor.nextToken(), "+");
  assertEquals(cursor.hasTokens(), false);
});
