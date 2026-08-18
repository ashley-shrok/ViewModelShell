// Phase 32 — `matchesFilter` reference truth function — NASA-level vitest suite.
//
// Coverage targets (SPEC Requirement 8):
//   (1) 1-rule EXHAUSTIVE — every operator × every applicable value-kind ×
//       representative value-shape set: null, empty string, whitespace-only,
//       unicode multi-byte + combining marks, very-long (≥1000 chars),
//       type-specifics (negative integers, decimals, negative decimals for
//       number; four ISO date shapes from D-03 for date).
//   (2) 2-rule representative — per value-kind, both joiners × 2–3 rule pairs
//       including at least one case where the two rules disagree (proves the
//       joiner actually chooses).
//   (3) 3-rule diagonal — per value-kind, per joiner, covering: all match /
//       some match / one matches (no short-circuit proven by flat evaluation).
//   (4) Both joiners ("all-of" and "any-of") proven.
//   (5) Table-driven: per-case names auto-derived from (kind/operator/valueShape).
//
// Date shapes (D-03 from 32-CONTEXT.md):
//   - date-only: "2026-08-15"
//   - datetime with offset: "2026-08-15T09:00:00-04:00"
//   - datetime UTC-Z: "2026-08-15T13:00:00Z"
//   - datetime naive: "2026-08-15T09:00:00"
//
// Mutation-verify notes (documented in 32-01-SUMMARY.md):
//   Reverting each operator's implementation to a constant stub (false/true)
//   causes at least one test in this suite to fail.

import { describe, it, expect } from "vitest";
import { matchesFilter } from "../src/server.js";
import type { FilterDescriptor, FilterRule, ValueKind, MatchingHint } from "../src/index.js";

// ─── Test-case type ───────────────────────────────────────────────────────────

interface Case {
  name: string;
  descriptor: FilterDescriptor;
  rawValue: unknown;
  displayString: string;
  kind: ValueKind;
  matchingHints?: MatchingHint[];
  expected: boolean;
}

// ─── Helpers to build descriptors ────────────────────────────────────────────

function rule(operator: FilterRule["operator"], value?: unknown): FilterRule {
  return value !== undefined ? { operator, value } : { operator };
}

function allOf(...rules: FilterRule[]): FilterDescriptor {
  return { rules, joiner: "all-of" };
}

function anyOf(...rules: FilterRule[]): FilterDescriptor {
  return { rules, joiner: "any-of" };
}

// ─── Very-long string (≥1000 chars) ──────────────────────────────────────────
const LONG_STRING = "a".repeat(990) + "needle";
const LONG_DISPLAY = "x".repeat(990) + "needle";

// ─── TEXT kind cases ──────────────────────────────────────────────────────────

const textCases: Case[] = [
  // contains — null rawValue → display string used, null display→no match
  {
    name: "text/contains/null-rawValue/all-of",
    descriptor: allOf(rule("contains", "hello")),
    rawValue: null,
    displayString: "",
    kind: "text",
    expected: false,
  },
  // contains — empty string display → no match
  {
    name: "text/contains/empty-display/all-of",
    descriptor: allOf(rule("contains", "hello")),
    rawValue: "",
    displayString: "",
    kind: "text",
    expected: false,
  },
  // contains — whitespace-only display → no match against non-whitespace term
  {
    name: "text/contains/whitespace-only/all-of",
    descriptor: allOf(rule("contains", "hello")),
    rawValue: "   ",
    displayString: "   ",
    kind: "text",
    expected: false,
  },
  // contains — basic match
  {
    name: "text/contains/basic-match/all-of",
    descriptor: allOf(rule("contains", "world")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },
  // contains — case-insensitive
  {
    name: "text/contains/case-insensitive/all-of",
    descriptor: allOf(rule("contains", "hello")),
    rawValue: "HELLO",
    displayString: "HELLO",
    kind: "text",
    expected: true,
  },
  // contains — unicode multi-byte (match on the ASCII portion)
  {
    name: "text/contains/unicode-multibyte/all-of",
    descriptor: allOf(rule("contains", "sum")),
    rawValue: "résumé",
    displayString: "résumé",
    kind: "text",
    expected: true,
  },
  // contains — unicode combining marks (e + combining acute accent = é)
  {
    name: "text/contains/unicode-combining-marks/all-of",
    descriptor: allOf(rule("contains", "caf")),
    rawValue: "café",
    displayString: "café",
    kind: "text",
    expected: true,
  },
  // contains — RTL text (Hebrew)
  {
    name: "text/contains/rtl-unicode/all-of",
    descriptor: allOf(rule("contains", "שלום")),
    rawValue: "שלום",
    displayString: "שלום",
    kind: "text",
    expected: true,
  },
  // contains — very-long string (≥1000 chars), match on last 6 chars
  {
    name: "text/contains/very-long/all-of",
    descriptor: allOf(rule("contains", "needle")),
    rawValue: LONG_STRING,
    displayString: LONG_DISPLAY,
    kind: "text",
    expected: true,
  },
  // contains — very-long string, no match
  {
    name: "text/contains/very-long-no-match/all-of",
    descriptor: allOf(rule("contains", "nothere")),
    rawValue: LONG_STRING,
    displayString: LONG_DISPLAY,
    kind: "text",
    expected: false,
  },
  // contains with ignore-punctuation — "$1,500.00" contains "1500"
  {
    name: "text/contains/ignore-punctuation-currency/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: "$1,500.00",
    displayString: "$1,500.00",
    kind: "text",
    matchingHints: ["ignore-punctuation"],
    expected: true,
  },
  // contains with ignore-punctuation — "1,500" contains "1500"
  {
    name: "text/contains/ignore-punctuation-comma/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: "1,500",
    displayString: "1,500",
    kind: "text",
    matchingHints: ["ignore-punctuation"],
    expected: true,
  },
  // contains with ignore-punctuation — pound £
  {
    name: "text/contains/ignore-punctuation-pound/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: "£1,500.00",
    displayString: "£1,500.00",
    kind: "text",
    matchingHints: ["ignore-punctuation"],
    expected: true,
  },
  // contains with ignore-punctuation — euro €
  {
    name: "text/contains/ignore-punctuation-euro/all-of",
    descriptor: allOf(rule("contains", "2000")),
    rawValue: "€2,000.50",
    displayString: "€2,000.50",
    kind: "text",
    matchingHints: ["ignore-punctuation"],
    expected: true,
  },
  // contains with no punctuation hint — no match without hint
  {
    name: "text/contains/no-punctuation-hint-no-match/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: "$1,500.00",
    displayString: "$1,500.00",
    kind: "text",
    expected: false,
  },

  // equals — case-sensitive match
  {
    name: "text/equals/match/all-of",
    descriptor: allOf(rule("equals", "hello")),
    rawValue: "hello",
    displayString: "hello",
    kind: "text",
    expected: true,
  },
  // equals — case-sensitive no-match (HELLO ≠ hello)
  {
    name: "text/equals/case-sensitive-no-match/all-of",
    descriptor: allOf(rule("equals", "hello")),
    rawValue: "HELLO",
    displayString: "HELLO",
    kind: "text",
    expected: false,
  },
  // equals — null rawValue no match
  {
    name: "text/equals/null/all-of",
    descriptor: allOf(rule("equals", "hello")),
    rawValue: null,
    displayString: "",
    kind: "text",
    expected: false,
  },

  // starts-with — match
  {
    name: "text/starts-with/match/all-of",
    descriptor: allOf(rule("starts-with", "hello")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },
  // starts-with — no match (starts with "world", not "hello")
  {
    name: "text/starts-with/no-match/all-of",
    descriptor: allOf(rule("starts-with", "world")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: false,
  },
  // starts-with — case-insensitive
  {
    name: "text/starts-with/case-insensitive/all-of",
    descriptor: allOf(rule("starts-with", "HELLO")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },
  // starts-with — null rawValue
  {
    name: "text/starts-with/null/all-of",
    descriptor: allOf(rule("starts-with", "hello")),
    rawValue: null,
    displayString: "",
    kind: "text",
    expected: false,
  },

  // ends-with — match
  {
    name: "text/ends-with/match/all-of",
    descriptor: allOf(rule("ends-with", "world")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },
  // ends-with — no match
  {
    name: "text/ends-with/no-match/all-of",
    descriptor: allOf(rule("ends-with", "hello")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: false,
  },
  // ends-with — case-insensitive
  {
    name: "text/ends-with/case-insensitive/all-of",
    descriptor: allOf(rule("ends-with", "WORLD")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },

  // is-empty — null → match
  {
    name: "text/is-empty/null/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: null,
    displayString: "",
    kind: "text",
    expected: true,
  },
  // is-empty — empty string → match
  {
    name: "text/is-empty/empty-string/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "",
    displayString: "",
    kind: "text",
    expected: true,
  },
  // is-empty — undefined → match
  {
    name: "text/is-empty/undefined/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: undefined,
    displayString: "",
    kind: "text",
    expected: true,
  },
  // is-empty — whitespace-only → NO match (whitespace is NOT empty)
  {
    name: "text/is-empty/whitespace-only-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "   ",
    displayString: "   ",
    kind: "text",
    expected: false,
  },
  // is-empty — "hello" → no match
  {
    name: "text/is-empty/non-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "hello",
    displayString: "hello",
    kind: "text",
    expected: false,
  },

  // is-not-empty — null → no match
  {
    name: "text/is-not-empty/null/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: null,
    displayString: "",
    kind: "text",
    expected: false,
  },
  // is-not-empty — empty string → no match
  {
    name: "text/is-not-empty/empty-string/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: "",
    displayString: "",
    kind: "text",
    expected: false,
  },
  // is-not-empty — "hello" → match
  {
    name: "text/is-not-empty/non-empty/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: "hello",
    displayString: "hello",
    kind: "text",
    expected: true,
  },
  // is-not-empty — whitespace-only → match (whitespace is not empty)
  {
    name: "text/is-not-empty/whitespace-only/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: "   ",
    displayString: "   ",
    kind: "text",
    expected: true,
  },
];

// ─── NUMBER kind cases ─────────────────────────────────────────────────────────

const numberCases: Case[] = [
  // contains — display-based; without ignore-punctuation hint → no match
  {
    name: "number/contains/no-punct-hint-no-match/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: 1500,
    displayString: "$1,500",
    kind: "number",
    expected: false,
  },
  // contains — with ignore-punctuation hint → match against display
  {
    name: "number/contains/ignore-punctuation/all-of",
    descriptor: allOf(rule("contains", "1500")),
    rawValue: 1500,
    displayString: "$1,500",
    kind: "number",
    matchingHints: ["ignore-punctuation"],
    expected: true,
  },
  // contains — no value, just display string match
  {
    name: "number/contains/display-match/all-of",
    descriptor: allOf(rule("contains", "42")),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: true,
  },

  // equals — match
  {
    name: "number/equals/match/all-of",
    descriptor: allOf(rule("equals", 42)),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: true,
  },
  // equals — no match
  {
    name: "number/equals/no-match/all-of",
    descriptor: allOf(rule("equals", 43)),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: false,
  },
  // equals — null rawValue → no match
  {
    name: "number/equals/null/all-of",
    descriptor: allOf(rule("equals", 42)),
    rawValue: null,
    displayString: "",
    kind: "number",
    expected: false,
  },

  // does-not-equal — match
  {
    name: "number/does-not-equal/match/all-of",
    descriptor: allOf(rule("does-not-equal", 43)),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: true,
  },
  // does-not-equal — no match (equal values)
  {
    name: "number/does-not-equal/no-match/all-of",
    descriptor: allOf(rule("does-not-equal", 42)),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: false,
  },

  // greater-than — match
  {
    name: "number/greater-than/match/all-of",
    descriptor: allOf(rule("greater-than", 5)),
    rawValue: 10,
    displayString: "10",
    kind: "number",
    expected: true,
  },
  // greater-than — no match (less than)
  {
    name: "number/greater-than/no-match/all-of",
    descriptor: allOf(rule("greater-than", 10)),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: false,
  },
  // greater-than — no match (equal — strict GT)
  {
    name: "number/greater-than/equal-no-match/all-of",
    descriptor: allOf(rule("greater-than", 5)),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: false,
  },

  // greater-than-or-equal — match at boundary
  {
    name: "number/greater-than-or-equal/boundary/all-of",
    descriptor: allOf(rule("greater-than-or-equal", 5)),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: true,
  },
  // greater-than-or-equal — match above boundary
  {
    name: "number/greater-than-or-equal/above-boundary/all-of",
    descriptor: allOf(rule("greater-than-or-equal", 5)),
    rawValue: 10,
    displayString: "10",
    kind: "number",
    expected: true,
  },
  // greater-than-or-equal — no match below boundary
  {
    name: "number/greater-than-or-equal/no-match/all-of",
    descriptor: allOf(rule("greater-than-or-equal", 5)),
    rawValue: 4,
    displayString: "4",
    kind: "number",
    expected: false,
  },

  // less-than — match
  {
    name: "number/less-than/match/all-of",
    descriptor: allOf(rule("less-than", 5)),
    rawValue: 3,
    displayString: "3",
    kind: "number",
    expected: true,
  },
  // less-than — no match (greater than)
  {
    name: "number/less-than/no-match/all-of",
    descriptor: allOf(rule("less-than", 5)),
    rawValue: 10,
    displayString: "10",
    kind: "number",
    expected: false,
  },
  // less-than — no match (equal — strict LT)
  {
    name: "number/less-than/equal-no-match/all-of",
    descriptor: allOf(rule("less-than", 5)),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: false,
  },

  // less-than-or-equal — match at boundary
  {
    name: "number/less-than-or-equal/boundary/all-of",
    descriptor: allOf(rule("less-than-or-equal", 5)),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: true,
  },
  // less-than-or-equal — no match above boundary
  {
    name: "number/less-than-or-equal/no-match/all-of",
    descriptor: allOf(rule("less-than-or-equal", 5)),
    rawValue: 6,
    displayString: "6",
    kind: "number",
    expected: false,
  },

  // between — match (inclusive on both ends)
  {
    name: "number/between/in-range/all-of",
    descriptor: allOf(rule("between", [3, 7])),
    rawValue: 5,
    displayString: "5",
    kind: "number",
    expected: true,
  },
  // between — match at lower boundary (inclusive)
  {
    name: "number/between/lower-boundary/all-of",
    descriptor: allOf(rule("between", [3, 7])),
    rawValue: 3,
    displayString: "3",
    kind: "number",
    expected: true,
  },
  // between — match at upper boundary (inclusive)
  {
    name: "number/between/upper-boundary/all-of",
    descriptor: allOf(rule("between", [3, 7])),
    rawValue: 7,
    displayString: "7",
    kind: "number",
    expected: true,
  },
  // between — no match (above range)
  {
    name: "number/between/no-match-above/all-of",
    descriptor: allOf(rule("between", [3, 7])),
    rawValue: 10,
    displayString: "10",
    kind: "number",
    expected: false,
  },
  // between — no match (below range)
  {
    name: "number/between/no-match-below/all-of",
    descriptor: allOf(rule("between", [3, 7])),
    rawValue: 2,
    displayString: "2",
    kind: "number",
    expected: false,
  },

  // is-empty — null → match
  {
    name: "number/is-empty/null/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: null,
    displayString: "",
    kind: "number",
    expected: true,
  },
  // is-empty — 0 is NOT empty (0 is a valid numeric value)
  {
    name: "number/is-empty/zero-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: 0,
    displayString: "0",
    kind: "number",
    expected: false,
  },
  // is-empty — empty string → match
  {
    name: "number/is-empty/empty-string/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "",
    displayString: "",
    kind: "number",
    expected: true,
  },

  // is-not-empty — null → no match
  {
    name: "number/is-not-empty/null/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: null,
    displayString: "",
    kind: "number",
    expected: false,
  },
  // is-not-empty — 0 is NOT empty → match
  {
    name: "number/is-not-empty/zero/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: 0,
    displayString: "0",
    kind: "number",
    expected: true,
  },
  // is-not-empty — valid number → match
  {
    name: "number/is-not-empty/valid/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: true,
  },

  // ─── Negative integer cases ────────────────────────────────────────────────
  {
    name: "number/less-than/negative-match/all-of",
    descriptor: allOf(rule("less-than", 0)),
    rawValue: -5,
    displayString: "-5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/less-than/negative-no-match/all-of",
    descriptor: allOf(rule("less-than", -10)),
    rawValue: -5,
    displayString: "-5",
    kind: "number",
    expected: false,
  },
  {
    name: "number/does-not-equal/negative/all-of",
    descriptor: allOf(rule("does-not-equal", 0)),
    rawValue: -5,
    displayString: "-5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/greater-than/negative/all-of",
    descriptor: allOf(rule("greater-than", -5)),
    rawValue: -3,
    displayString: "-3",
    kind: "number",
    expected: true,
  },
  {
    name: "number/is-empty/negative-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: -5,
    displayString: "-5",
    kind: "number",
    expected: false,
  },
  {
    name: "number/is-not-empty/negative/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: -5,
    displayString: "-5",
    kind: "number",
    expected: true,
  },

  // ─── Decimal cases ────────────────────────────────────────────────────────
  {
    name: "number/equals/decimal-match/all-of",
    descriptor: allOf(rule("equals", 3.14)),
    rawValue: 3.14,
    displayString: "3.14",
    kind: "number",
    expected: true,
  },
  {
    name: "number/equals/decimal-no-match/all-of",
    descriptor: allOf(rule("equals", 3.15)),
    rawValue: 3.14,
    displayString: "3.14",
    kind: "number",
    expected: false,
  },
  {
    name: "number/between/decimal-in-range/all-of",
    descriptor: allOf(rule("between", [3.0, 4.0])),
    rawValue: 3.14,
    displayString: "3.14",
    kind: "number",
    expected: true,
  },
  {
    name: "number/greater-than/decimal/all-of",
    descriptor: allOf(rule("greater-than", 3.0)),
    rawValue: 3.14,
    displayString: "3.14",
    kind: "number",
    expected: true,
  },

  // ─── Negative-decimal cases ───────────────────────────────────────────────
  {
    name: "number/greater-than/negative-decimal/all-of",
    descriptor: allOf(rule("greater-than", -5)),
    rawValue: -2.5,
    displayString: "-2.5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/less-than/negative-decimal/all-of",
    descriptor: allOf(rule("less-than", 0)),
    rawValue: -2.5,
    displayString: "-2.5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/equals/negative-decimal/all-of",
    descriptor: allOf(rule("equals", -2.5)),
    rawValue: -2.5,
    displayString: "-2.5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/does-not-equal/negative-decimal/all-of",
    descriptor: allOf(rule("does-not-equal", -2.5)),
    rawValue: -3.5,
    displayString: "-3.5",
    kind: "number",
    expected: true,
  },
  {
    name: "number/is-empty/negative-decimal-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: -2.5,
    displayString: "-2.5",
    kind: "number",
    expected: false,
  },
];

// ─── DATE kind cases (D-03 four ISO shapes) ────────────────────────────────────

// Reference dates for comparison
const DATE_ONLY = "2026-08-15";
const DATE_ONLY_BEFORE = "2026-08-14";
const DATE_ONLY_AFTER = "2026-08-16";
const DATETIME_OFFSET = "2026-08-15T09:00:00-04:00";
const DATETIME_UTC_Z = "2026-08-15T13:00:00Z";
const DATETIME_NAIVE = "2026-08-15T09:00:00";
const DATE_RANGE_FROM = "2026-08-01";
const DATE_RANGE_TO = "2026-08-31";

const dateCases: Case[] = [
  // ─── date-only shape ──────────────────────────────────────────────────────
  // is — match
  {
    name: "date/is/date-only-match/all-of",
    descriptor: allOf(rule("is", DATE_ONLY)),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: true,
  },
  // is — no match
  {
    name: "date/is/date-only-no-match/all-of",
    descriptor: allOf(rule("is", DATE_ONLY)),
    rawValue: DATE_ONLY_BEFORE,
    displayString: "Aug 14, 2026",
    kind: "date",
    expected: false,
  },
  // before — match
  {
    name: "date/before/date-only-match/all-of",
    descriptor: allOf(rule("before", DATE_ONLY)),
    rawValue: DATE_ONLY_BEFORE,
    displayString: "Aug 14, 2026",
    kind: "date",
    expected: true,
  },
  // before — no match (value is after)
  {
    name: "date/before/date-only-no-match/all-of",
    descriptor: allOf(rule("before", DATE_ONLY)),
    rawValue: DATE_ONLY_AFTER,
    displayString: "Aug 16, 2026",
    kind: "date",
    expected: false,
  },
  // before — no match (equal — strict before)
  {
    name: "date/before/date-only-equal-no-match/all-of",
    descriptor: allOf(rule("before", DATE_ONLY)),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: false,
  },
  // after — match
  {
    name: "date/after/date-only-match/all-of",
    descriptor: allOf(rule("after", DATE_ONLY)),
    rawValue: DATE_ONLY_AFTER,
    displayString: "Aug 16, 2026",
    kind: "date",
    expected: true,
  },
  // after — no match (value is before)
  {
    name: "date/after/date-only-no-match/all-of",
    descriptor: allOf(rule("after", DATE_ONLY)),
    rawValue: DATE_ONLY_BEFORE,
    displayString: "Aug 14, 2026",
    kind: "date",
    expected: false,
  },
  // after — no match (equal — strict after)
  {
    name: "date/after/date-only-equal-no-match/all-of",
    descriptor: allOf(rule("after", DATE_ONLY)),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: false,
  },
  // in-range — match (inclusive on both ends)
  {
    name: "date/in-range/date-only-match/all-of",
    descriptor: allOf(rule("in-range", [DATE_RANGE_FROM, DATE_RANGE_TO])),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: true,
  },
  // in-range — match at lower boundary (inclusive)
  {
    name: "date/in-range/date-only-lower-boundary/all-of",
    descriptor: allOf(rule("in-range", [DATE_RANGE_FROM, DATE_RANGE_TO])),
    rawValue: DATE_RANGE_FROM,
    displayString: "Aug 1, 2026",
    kind: "date",
    expected: true,
  },
  // in-range — match at upper boundary (inclusive)
  {
    name: "date/in-range/date-only-upper-boundary/all-of",
    descriptor: allOf(rule("in-range", [DATE_RANGE_FROM, DATE_RANGE_TO])),
    rawValue: DATE_RANGE_TO,
    displayString: "Aug 31, 2026",
    kind: "date",
    expected: true,
  },
  // in-range — no match (out of range)
  {
    name: "date/in-range/date-only-no-match/all-of",
    descriptor: allOf(rule("in-range", [DATE_RANGE_FROM, DATE_RANGE_TO])),
    rawValue: "2026-09-01",
    displayString: "Sep 1, 2026",
    kind: "date",
    expected: false,
  },
  // contains — match on display string
  {
    name: "date/contains/date-only/all-of",
    descriptor: allOf(rule("contains", "Aug")),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: true,
  },
  // is-empty — null → match
  {
    name: "date/is-empty/null/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: null,
    displayString: "",
    kind: "date",
    expected: true,
  },
  // is-empty — valid date → no match
  {
    name: "date/is-empty/non-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: false,
  },
  // is-not-empty — valid date → match
  {
    name: "date/is-not-empty/non-empty/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: true,
  },
  // is-not-empty — null → no match
  {
    name: "date/is-not-empty/null/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: null,
    displayString: "",
    kind: "date",
    expected: false,
  },

  // ─── datetime with offset shape ───────────────────────────────────────────
  {
    name: "date/is/datetime-offset-match/all-of",
    descriptor: allOf(rule("is", DATETIME_OFFSET)),
    rawValue: DATETIME_OFFSET,
    displayString: "Aug 15, 2026 9:00 AM EDT",
    kind: "date",
    expected: true,
  },
  {
    name: "date/before/datetime-offset-match/all-of",
    descriptor: allOf(rule("before", DATETIME_OFFSET)),
    rawValue: "2026-08-15T08:59:00-04:00",
    displayString: "Aug 15, 2026 8:59 AM EDT",
    kind: "date",
    expected: true,
  },
  {
    name: "date/before/datetime-offset-no-match/all-of",
    descriptor: allOf(rule("before", DATETIME_OFFSET)),
    rawValue: "2026-08-15T09:01:00-04:00",
    displayString: "Aug 15, 2026 9:01 AM EDT",
    kind: "date",
    expected: false,
  },
  {
    name: "date/after/datetime-offset-match/all-of",
    descriptor: allOf(rule("after", DATETIME_OFFSET)),
    rawValue: "2026-08-15T09:01:00-04:00",
    displayString: "Aug 15, 2026 9:01 AM EDT",
    kind: "date",
    expected: true,
  },
  {
    name: "date/in-range/datetime-offset/all-of",
    descriptor: allOf(rule("in-range", ["2026-08-15T09:00:00-04:00", "2026-08-15T17:00:00-04:00"])),
    rawValue: "2026-08-15T12:00:00-04:00",
    displayString: "Aug 15, 2026 12:00 PM EDT",
    kind: "date",
    expected: true,
  },

  // ─── datetime UTC-Z shape ─────────────────────────────────────────────────
  {
    name: "date/is/datetime-utcz-match/all-of",
    descriptor: allOf(rule("is", DATETIME_UTC_Z)),
    rawValue: DATETIME_UTC_Z,
    displayString: "Aug 15, 2026 1:00 PM UTC",
    kind: "date",
    expected: true,
  },
  {
    name: "date/before/datetime-utcz-match/all-of",
    descriptor: allOf(rule("before", DATETIME_UTC_Z)),
    rawValue: "2026-08-15T12:59:00Z",
    displayString: "Aug 15, 2026 12:59 PM UTC",
    kind: "date",
    expected: true,
  },
  {
    name: "date/after/datetime-utcz-match/all-of",
    descriptor: allOf(rule("after", DATETIME_UTC_Z)),
    rawValue: "2026-08-15T13:01:00Z",
    displayString: "Aug 15, 2026 1:01 PM UTC",
    kind: "date",
    expected: true,
  },
  {
    name: "date/in-range/datetime-utcz/all-of",
    descriptor: allOf(rule("in-range", ["2026-08-15T00:00:00Z", "2026-08-15T23:59:59Z"])),
    rawValue: DATETIME_UTC_Z,
    displayString: "Aug 15, 2026 1:00 PM UTC",
    kind: "date",
    expected: true,
  },

  // ─── datetime naive shape ─────────────────────────────────────────────────
  {
    name: "date/is/datetime-naive-match/all-of",
    descriptor: allOf(rule("is", DATETIME_NAIVE)),
    rawValue: DATETIME_NAIVE,
    displayString: "Aug 15, 2026 9:00 AM",
    kind: "date",
    expected: true,
  },
  {
    name: "date/before/datetime-naive-match/all-of",
    descriptor: allOf(rule("before", DATETIME_NAIVE)),
    rawValue: "2026-08-15T08:59:00",
    displayString: "Aug 15, 2026 8:59 AM",
    kind: "date",
    expected: true,
  },
  {
    name: "date/after/datetime-naive-no-match/all-of",
    descriptor: allOf(rule("after", DATETIME_NAIVE)),
    rawValue: "2026-08-15T08:59:00",
    displayString: "Aug 15, 2026 8:59 AM",
    kind: "date",
    expected: false,
  },
  {
    name: "date/in-range/datetime-naive/all-of",
    descriptor: allOf(rule("in-range", ["2026-08-15T00:00:00", "2026-08-15T23:59:59"])),
    rawValue: DATETIME_NAIVE,
    displayString: "Aug 15, 2026 9:00 AM",
    kind: "date",
    expected: true,
  },
];

// ─── FIXED-SET kind cases ─────────────────────────────────────────────────────

const fixedSetCases: Case[] = [
  // contains — case-insensitive on display string
  {
    name: "fixed-set/contains/case-insensitive/all-of",
    descriptor: allOf(rule("contains", "act")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: true,
  },
  // contains — no match
  {
    name: "fixed-set/contains/no-match/all-of",
    descriptor: allOf(rule("contains", "inactive")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: false,
  },
  // is — match (string equality on rawValue)
  {
    name: "fixed-set/is/match/all-of",
    descriptor: allOf(rule("is", "active")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: true,
  },
  // is — no match
  {
    name: "fixed-set/is/no-match/all-of",
    descriptor: allOf(rule("is", "inactive")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: false,
  },
  // is-not — match (rawValue ≠ ruleValue)
  {
    name: "fixed-set/is-not/match/all-of",
    descriptor: allOf(rule("is-not", "inactive")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: true,
  },
  // is-not — no match (rawValue = ruleValue)
  {
    name: "fixed-set/is-not/no-match/all-of",
    descriptor: allOf(rule("is-not", "active")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: false,
  },
  // is-empty — null → match
  {
    name: "fixed-set/is-empty/null/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: null,
    displayString: "",
    kind: "fixed-set",
    expected: true,
  },
  // is-empty — empty string → match
  {
    name: "fixed-set/is-empty/empty-string/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "",
    displayString: "",
    kind: "fixed-set",
    expected: true,
  },
  // is-empty — "active" → no match
  {
    name: "fixed-set/is-empty/non-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: false,
  },
  // is-not-empty — "active" → match
  {
    name: "fixed-set/is-not-empty/non-empty/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: "active",
    displayString: "Active",
    kind: "fixed-set",
    expected: true,
  },
  // is-not-empty — null → no match
  {
    name: "fixed-set/is-not-empty/null/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: null,
    displayString: "",
    kind: "fixed-set",
    expected: false,
  },
  // is-not-empty — empty string → no match
  {
    name: "fixed-set/is-not-empty/empty-string/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: "",
    displayString: "",
    kind: "fixed-set",
    expected: false,
  },
];

// ─── YES-NO kind cases ─────────────────────────────────────────────────────────

const yesNoCases: Case[] = [
  // contains — display "Yes" with "ye" → match
  {
    name: "yes-no/contains/yes-match/all-of",
    descriptor: allOf(rule("contains", "ye")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: true,
  },
  // contains — display "No" with "ye" → no match
  {
    name: "yes-no/contains/no-no-match/all-of",
    descriptor: allOf(rule("contains", "ye")),
    rawValue: false,
    displayString: "No",
    kind: "yes-no",
    expected: false,
  },
  // is-true — true → match
  {
    name: "yes-no/is-true/true/all-of",
    descriptor: allOf(rule("is-true")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: true,
  },
  // is-true — false → no match
  {
    name: "yes-no/is-true/false/all-of",
    descriptor: allOf(rule("is-true")),
    rawValue: false,
    displayString: "No",
    kind: "yes-no",
    expected: false,
  },
  // is-true — null → no match
  {
    name: "yes-no/is-true/null/all-of",
    descriptor: allOf(rule("is-true")),
    rawValue: null,
    displayString: "",
    kind: "yes-no",
    expected: false,
  },
  // is-false — false → match
  {
    name: "yes-no/is-false/false/all-of",
    descriptor: allOf(rule("is-false")),
    rawValue: false,
    displayString: "No",
    kind: "yes-no",
    expected: true,
  },
  // is-false — true → no match
  {
    name: "yes-no/is-false/true/all-of",
    descriptor: allOf(rule("is-false")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: false,
  },
  // is-false — null → no match
  {
    name: "yes-no/is-false/null/all-of",
    descriptor: allOf(rule("is-false")),
    rawValue: null,
    displayString: "",
    kind: "yes-no",
    expected: false,
  },
  // is-empty — null → match
  {
    name: "yes-no/is-empty/null/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: null,
    displayString: "",
    kind: "yes-no",
    expected: true,
  },
  // is-empty — undefined → match
  {
    name: "yes-no/is-empty/undefined/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: undefined,
    displayString: "",
    kind: "yes-no",
    expected: true,
  },
  // is-empty — false is NOT empty (false is a valid boolean value)
  {
    name: "yes-no/is-empty/false-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: false,
    displayString: "No",
    kind: "yes-no",
    expected: false,
  },
  // is-empty — true is NOT empty
  {
    name: "yes-no/is-empty/true-not-empty/all-of",
    descriptor: allOf(rule("is-empty")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: false,
  },
  // is-not-empty — false → match (false is a real value)
  {
    name: "yes-no/is-not-empty/false/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: false,
    displayString: "No",
    kind: "yes-no",
    expected: true,
  },
  // is-not-empty — null → no match
  {
    name: "yes-no/is-not-empty/null/all-of",
    descriptor: allOf(rule("is-not-empty")),
    rawValue: null,
    displayString: "",
    kind: "yes-no",
    expected: false,
  },
];

// ─── MULTI-RULE cases (2-rule representative + 3-rule diagonal) ───────────────

const multiRuleCases: Case[] = [
  // ─── all-of: both rules must match ────────────────────────────────────────
  {
    name: "text/all-of/2-rule-both-match/all-of",
    descriptor: allOf(rule("contains", "hello"), rule("contains", "world")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },
  {
    name: "text/all-of/2-rule-second-fails/all-of",
    descriptor: allOf(rule("contains", "hello"), rule("contains", "world")),
    rawValue: "hello only",
    displayString: "hello only",
    kind: "text",
    expected: false,
  },

  // ─── any-of: at least one rule must match ─────────────────────────────────
  {
    name: "text/any-of/2-rule-second-matches/any-of",
    descriptor: anyOf(rule("contains", "hello"), rule("contains", "world")),
    rawValue: "just world",
    displayString: "just world",
    kind: "text",
    expected: true,
  },
  {
    name: "text/any-of/2-rule-neither-matches/any-of",
    descriptor: anyOf(rule("contains", "hello"), rule("contains", "world")),
    rawValue: "nothing here",
    displayString: "nothing here",
    kind: "text",
    expected: false,
  },
  {
    name: "text/any-of/2-rule-both-match/any-of",
    descriptor: anyOf(rule("contains", "hello"), rule("contains", "world")),
    rawValue: "hello world",
    displayString: "hello world",
    kind: "text",
    expected: true,
  },

  // ─── 2-rule disagreement proves joiner ────────────────────────────────────
  // all-of [is "a", is "b"] against rawValue "a" → no match (second rule fails)
  {
    name: "fixed-set/all-of/disagreement-first-matches/all-of",
    descriptor: allOf(rule("is", "a"), rule("is", "b")),
    rawValue: "a",
    displayString: "A",
    kind: "fixed-set",
    expected: false,
  },
  // any-of [is "a", is "b"] against rawValue "a" → match (first rule passes)
  {
    name: "fixed-set/any-of/disagreement-first-matches/any-of",
    descriptor: anyOf(rule("is", "a"), rule("is", "b")),
    rawValue: "a",
    displayString: "A",
    kind: "fixed-set",
    expected: true,
  },

  // ─── Number 2-rule representative ─────────────────────────────────────────
  {
    name: "number/all-of/2-rule-range/all-of",
    descriptor: allOf(rule("greater-than-or-equal", 0), rule("less-than-or-equal", 100)),
    rawValue: 50,
    displayString: "50",
    kind: "number",
    expected: true,
  },
  {
    name: "number/all-of/2-rule-range-out/all-of",
    descriptor: allOf(rule("greater-than-or-equal", 0), rule("less-than-or-equal", 100)),
    rawValue: 150,
    displayString: "150",
    kind: "number",
    expected: false,
  },
  {
    name: "number/any-of/2-rule-either-end/any-of",
    descriptor: anyOf(rule("less-than", 0), rule("greater-than", 100)),
    rawValue: 150,
    displayString: "150",
    kind: "number",
    expected: true,
  },
  {
    name: "number/any-of/2-rule-middle-no-match/any-of",
    descriptor: anyOf(rule("less-than", 0), rule("greater-than", 100)),
    rawValue: 50,
    displayString: "50",
    kind: "number",
    expected: false,
  },

  // ─── Date 2-rule representative ───────────────────────────────────────────
  {
    name: "date/all-of/2-rule-range/all-of",
    descriptor: allOf(
      rule("after", "2026-08-01"),
      rule("before", "2026-08-31"),
    ),
    rawValue: DATE_ONLY,
    displayString: "Aug 15, 2026",
    kind: "date",
    expected: true,
  },
  {
    name: "date/all-of/2-rule-range-out/all-of",
    descriptor: allOf(
      rule("after", "2026-08-01"),
      rule("before", "2026-08-31"),
    ),
    rawValue: "2026-09-01",
    displayString: "Sep 1, 2026",
    kind: "date",
    expected: false,
  },

  // ─── 3-rule diagonal — all-of ─────────────────────────────────────────────
  // all 3 match → match
  {
    name: "text/all-of/3-rule-all-match/all-of",
    descriptor: allOf(rule("contains", "a"), rule("contains", "b"), rule("contains", "c")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: true,
  },
  // 2 match, 1 doesn't → no match
  {
    name: "text/all-of/3-rule-one-fails/all-of",
    descriptor: allOf(rule("contains", "a"), rule("contains", "b"), rule("contains", "d")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: false,
  },
  // none match → no match
  {
    name: "text/all-of/3-rule-none-match/all-of",
    descriptor: allOf(rule("contains", "x"), rule("contains", "y"), rule("contains", "z")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: false,
  },

  // ─── 3-rule diagonal — any-of ─────────────────────────────────────────────
  // only last matches → match
  {
    name: "text/any-of/3-rule-last-matches/any-of",
    descriptor: anyOf(rule("contains", "x"), rule("contains", "y"), rule("contains", "c")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: true,
  },
  // none match → no match
  {
    name: "text/any-of/3-rule-none-match/any-of",
    descriptor: anyOf(rule("contains", "x"), rule("contains", "y"), rule("contains", "z")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: false,
  },
  // all match → match
  {
    name: "text/any-of/3-rule-all-match/any-of",
    descriptor: anyOf(rule("contains", "a"), rule("contains", "b"), rule("contains", "c")),
    rawValue: "abc",
    displayString: "abc",
    kind: "text",
    expected: true,
  },

  // ─── Number 3-rule diagonal ───────────────────────────────────────────────
  // all-of: all match
  {
    name: "number/all-of/3-rule-all-match/all-of",
    descriptor: allOf(
      rule("greater-than-or-equal", 0),
      rule("less-than-or-equal", 100),
      rule("does-not-equal", 50),
    ),
    rawValue: 75,
    displayString: "75",
    kind: "number",
    expected: true,
  },
  // all-of: one fails (value = 50 fails does-not-equal 50)
  {
    name: "number/all-of/3-rule-one-fails/all-of",
    descriptor: allOf(
      rule("greater-than-or-equal", 0),
      rule("less-than-or-equal", 100),
      rule("does-not-equal", 50),
    ),
    rawValue: 50,
    displayString: "50",
    kind: "number",
    expected: false,
  },
  // any-of: only last matches
  {
    name: "number/any-of/3-rule-last-matches/any-of",
    descriptor: anyOf(
      rule("less-than", 0),
      rule("greater-than", 1000),
      rule("equals", 42),
    ),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: true,
  },
  // any-of: none match
  {
    name: "number/any-of/3-rule-none-match/any-of",
    descriptor: anyOf(
      rule("less-than", 0),
      rule("greater-than", 1000),
      rule("equals", 99),
    ),
    rawValue: 42,
    displayString: "42",
    kind: "number",
    expected: false,
  },

  // ─── Yes-no 3-rule diagonal ───────────────────────────────────────────────
  {
    name: "yes-no/all-of/3-rule-inconsistent/all-of",
    descriptor: allOf(rule("is-true"), rule("is-false"), rule("is-not-empty")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: false, // is-false fails for true
  },
  {
    name: "yes-no/any-of/3-rule-first-matches/any-of",
    descriptor: anyOf(rule("is-true"), rule("is-false"), rule("is-empty")),
    rawValue: true,
    displayString: "Yes",
    kind: "yes-no",
    expected: true, // is-true matches
  },

  // ─── Unknown operator returns false (security: tampering T-32-01-01) ──────
  {
    name: "text/unknown-operator/returns-false/all-of",
    descriptor: allOf({ operator: "not-a-real-operator" as FilterRule["operator"], value: "x" }),
    rawValue: "hello",
    displayString: "hello",
    kind: "text",
    expected: false,
  },
];

// ─── Test runner ─────────────────────────────────────────────────────────────

const allCases: Case[] = [
  ...textCases,
  ...numberCases,
  ...dateCases,
  ...fixedSetCases,
  ...yesNoCases,
  ...multiRuleCases,
];

describe("matchesFilter — NASA-level exhaustive suite (Phase 32)", () => {
  describe("TEXT kind", () => {
    it.each(textCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  describe("NUMBER kind", () => {
    it.each(numberCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  describe("DATE kind (four ISO shapes — D-03)", () => {
    it.each(dateCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  describe("FIXED-SET kind", () => {
    it.each(fixedSetCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  describe("YES-NO kind", () => {
    it.each(yesNoCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  describe("MULTI-RULE (2-rule representative + 3-rule diagonal + both joiners)", () => {
    it.each(multiRuleCases)("$name", ({ descriptor, rawValue, displayString, kind, matchingHints, expected }) => {
      expect(matchesFilter(descriptor, rawValue, displayString, kind, matchingHints)).toBe(expected);
    });
  });

  it("total test-case count is at least 120", () => {
    expect(allCases.length).toBeGreaterThanOrEqual(120);
  });
});
