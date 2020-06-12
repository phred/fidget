import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

import { Lexer, parseLine } from "./interpreter.ts";

Deno.test("simple string parsing", () => {
  const program = "forth love if honk then";
  let cursor = Lexer(program);
  assertEquals(cursor.tokens.length, 5);
});

Deno.test("walking a cursor", () => {
  const program = "2 3 +";
  let cursor = Lexer(program);
  assertEquals(cursor.nextToken(), "2");
  assertEquals(cursor.curToken(), "3");
  assertEquals(cursor.nextToken(), "3");
  assertEquals(cursor.nextToken(), "+");
  assertEquals(cursor.hasTokens(), false);
});

Deno.test("parsing some words", () => {
  const input = "2 3 +";
  const {program, state} = parseLine(input, new Map());

  assertEquals(program.length, 3);
  assertEquals(program[0].name, "Numeric")
  assertEquals(program[1].name, "Numeric")
  assertEquals(program[2].name, "String")

  assertEquals(program[0].impl(), 2);
});

Deno.test("parsing some maths", () => {
  const input = "2 3 +";
  const {program, state} = parseLine(input, new Map([["+", {name: "+", impl: (a: number, b: number) => a+b}]]));

  console.log(program);
  assertEquals(program.length, 3);
  assertEquals(program[0].name, "Numeric")
  assertEquals(program[1].name, "Numeric")
  assertEquals(program[2].name, "+")

  assertEquals(program[0].impl(), 2);
});