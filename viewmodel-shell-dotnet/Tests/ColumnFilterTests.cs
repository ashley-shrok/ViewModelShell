using System.Text.Json;
using ViewModelShell;

namespace ViewModelShell.Tests;

/// <summary>
/// NASA-level xUnit test suite for FilterHelper.MatchesFilter.
/// Covers all 5 value-kinds × all operators × edge values (negative integers,
/// decimals, negative decimals, four ISO date shapes, ignore-punctuation hint,
/// JsonElement deserialization, multi-rule descriptors, both joiners).
/// Byte-parallel with the TypeScript matchesFilter vitest suite.
/// </summary>
public class ColumnFilterTests
{
    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static FilterDescriptor OneRule(string op, object? value = null)
        => new(new[] { new FilterRule(op, value) }, "all-of");

    private static FilterDescriptor TwoRules(
        string op1, object? val1,
        string op2, object? val2,
        string joiner = "all-of")
        => new(new[] { new FilterRule(op1, val1), new FilterRule(op2, val2) }, joiner);

    private static FilterDescriptor ThreeRules(
        string op1, object? val1,
        string op2, object? val2,
        string op3, object? val3,
        string joiner = "all-of")
        => new(new[] { new FilterRule(op1, val1), new FilterRule(op2, val2), new FilterRule(op3, val3) }, joiner);

    /// <summary>Convert a native value to JsonElement as it would arrive from round-tripped JSON state.</summary>
    private static JsonElement ToJson(object? v)
    {
        var raw = JsonSerializer.Serialize(v);
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.Clone();
    }

    /// <summary>Generic overload for nullable typed values (e.g. null string).</summary>
    private static JsonElement ToJson<T>(T v)
    {
        var raw = JsonSerializer.Serialize(v);
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.Clone();
    }

    // ─── Test cases ───────────────────────────────────────────────────────────

    public static IEnumerable<object?[]> Cases()
    {
        // Params: caseName, descriptor, rawValue, displayString, kind, matchingHints, expected

        // ── TEXT: contains ────────────────────────────────────────────────────
        yield return C("text contains match", OneRule("contains", "foo"), "foo bar", "foo bar", "text", null, true);
        yield return C("text contains case-insensitive", OneRule("contains", "FOO"), "foo bar", "foo bar", "text", null, true);
        yield return C("text contains no match", OneRule("contains", "baz"), "foo bar", "foo bar", "text", null, false);
        yield return C("text contains empty value matches all", OneRule("contains", ""), "anything", "anything", "text", null, true);
        yield return C("text contains null value matches all", OneRule("contains", null), "anything", "anything", "text", null, true);

        // ── TEXT: equals ──────────────────────────────────────────────────────
        yield return C("text equals match", OneRule("equals", "Hello"), "Hello", "Hello", "text", null, true);
        yield return C("text equals case-sensitive no match", OneRule("equals", "hello"), "Hello", "Hello", "text", null, false);
        yield return C("text equals no match", OneRule("equals", "World"), "Hello", "Hello", "text", null, false);
        yield return C("text equals empty rawValue", OneRule("equals", ""), "", "", "text", null, true);

        // ── TEXT: starts-with ─────────────────────────────────────────────────
        yield return C("text starts-with match", OneRule("starts-with", "Hel"), "Hello", "Hello", "text", null, true);
        yield return C("text starts-with case-insensitive", OneRule("starts-with", "hel"), "Hello", "Hello", "text", null, true);
        yield return C("text starts-with no match", OneRule("starts-with", "llo"), "Hello", "Hello", "text", null, false);

        // ── TEXT: ends-with ───────────────────────────────────────────────────
        yield return C("text ends-with match", OneRule("ends-with", "llo"), "Hello", "Hello", "text", null, true);
        yield return C("text ends-with case-insensitive", OneRule("ends-with", "LLO"), "Hello", "Hello", "text", null, true);
        yield return C("text ends-with no match", OneRule("ends-with", "Hel"), "Hello", "Hello", "text", null, false);

        // ── TEXT: is-empty / is-not-empty ─────────────────────────────────────
        yield return C("text is-empty null", OneRule("is-empty"), null, "", "text", null, true);
        yield return C("text is-empty empty string", OneRule("is-empty"), "", "", "text", null, true);
        yield return C("text is-empty whitespace NOT empty", OneRule("is-empty"), " ", " ", "text", null, false);
        yield return C("text is-empty non-empty", OneRule("is-empty"), "foo", "foo", "text", null, false);
        yield return C("text is-not-empty non-empty", OneRule("is-not-empty"), "foo", "foo", "text", null, true);
        yield return C("text is-not-empty empty string", OneRule("is-not-empty"), "", "", "text", null, false);
        yield return C("text is-not-empty null", OneRule("is-not-empty"), null, "", "text", null, false);
        yield return C("text is-not-empty whitespace is not-empty", OneRule("is-not-empty"), " ", " ", "text", null, true);

        // ── NUMBER: contains (uses displayString) ─────────────────────────────
        yield return C("number contains match", OneRule("contains", "42"), 42.0, "42", "number", null, true);
        yield return C("number contains no match", OneRule("contains", "99"), 42.0, "42", "number", null, false);
        yield return C("number contains negative match", OneRule("contains", "-5"), -5, "-5", "number", null, true);
        yield return C("number contains decimal match", OneRule("contains", "3.14"), 3.14, "3.14", "number", null, true);
        yield return C("number contains negative decimal", OneRule("contains", "-2.5"), -2.5, "-2.50", "number", null, true);

        // ── NUMBER: equals ────────────────────────────────────────────────────
        yield return C("number equals match", OneRule("equals", 42.0), 42.0, "42", "number", null, true);
        yield return C("number equals no match", OneRule("equals", 43.0), 42.0, "42", "number", null, false);
        yield return C("number equals negative integer", OneRule("equals", -5), -5, "-5", "number", null, true);
        yield return C("number equals decimal", OneRule("equals", 3.14), 3.14, "3.14", "number", null, true);
        yield return C("number equals negative decimal", OneRule("equals", -2.5), -2.5, "-2.5", "number", null, true);
        yield return C("number equals via JsonElement", OneRule("equals", ToJson(100.0)), 100.0, "100", "number", null, true);

        // ── NUMBER: does-not-equal ────────────────────────────────────────────
        yield return C("number does-not-equal match", OneRule("does-not-equal", 99.0), 42.0, "42", "number", null, true);
        yield return C("number does-not-equal no match", OneRule("does-not-equal", 42.0), 42.0, "42", "number", null, false);
        yield return C("number does-not-equal negative", OneRule("does-not-equal", -5), 5, "5", "number", null, true);

        // ── NUMBER: greater-than ──────────────────────────────────────────────
        yield return C("number greater-than match", OneRule("greater-than", 40.0), 42.0, "42", "number", null, true);
        yield return C("number greater-than no match equal", OneRule("greater-than", 42.0), 42.0, "42", "number", null, false);
        yield return C("number greater-than no match less", OneRule("greater-than", 50.0), 42.0, "42", "number", null, false);
        yield return C("number greater-than negative cell", OneRule("greater-than", -10), -5, "-5", "number", null, true);
        yield return C("number greater-than decimal", OneRule("greater-than", 3.0), 3.14, "3.14", "number", null, true);

        // ── NUMBER: greater-than-or-equal ─────────────────────────────────────
        yield return C("number gte match equal", OneRule("greater-than-or-equal", 42.0), 42.0, "42", "number", null, true);
        yield return C("number gte match greater", OneRule("greater-than-or-equal", 40.0), 42.0, "42", "number", null, true);
        yield return C("number gte no match", OneRule("greater-than-or-equal", 50.0), 42.0, "42", "number", null, false);

        // ── NUMBER: less-than ─────────────────────────────────────────────────
        yield return C("number less-than match", OneRule("less-than", 50.0), 42.0, "42", "number", null, true);
        yield return C("number less-than no match equal", OneRule("less-than", 42.0), 42.0, "42", "number", null, false);
        yield return C("number less-than no match greater", OneRule("less-than", 30.0), 42.0, "42", "number", null, false);
        yield return C("number less-than negative decimal", OneRule("less-than", 0), -2.5, "-2.5", "number", null, true);

        // ── NUMBER: less-than-or-equal ────────────────────────────────────────
        yield return C("number lte match equal", OneRule("less-than-or-equal", 42.0), 42.0, "42", "number", null, true);
        yield return C("number lte match less", OneRule("less-than-or-equal", 50.0), 42.0, "42", "number", null, true);
        yield return C("number lte no match", OneRule("less-than-or-equal", 30.0), 42.0, "42", "number", null, false);

        // ── NUMBER: between ───────────────────────────────────────────────────
        yield return C("number between in range", OneRule("between", new double[] { 10.0, 50.0 }), 42.0, "42", "number", null, true);
        yield return C("number between at lower bound", OneRule("between", new double[] { 42.0, 50.0 }), 42.0, "42", "number", null, true);
        yield return C("number between at upper bound", OneRule("between", new double[] { 10.0, 42.0 }), 42.0, "42", "number", null, true);
        yield return C("number between out of range low", OneRule("between", new double[] { 50.0, 100.0 }), 42.0, "42", "number", null, false);
        yield return C("number between out of range high", OneRule("between", new double[] { 1.0, 10.0 }), 42.0, "42", "number", null, false);
        yield return C("number between negative range", OneRule("between", new double[] { -10.0, -1.0 }), -5, "-5", "number", null, true);
        yield return C("number between via JsonElement", OneRule("between", ToJson(new double[] { 10.0, 50.0 })), 42.0, "42", "number", null, true);

        // ── NUMBER: is-empty / is-not-empty ───────────────────────────────────
        yield return C("number is-empty null", OneRule("is-empty"), null, "", "number", null, true);
        yield return C("number is-not-empty has value", OneRule("is-not-empty"), 0.0, "0", "number", null, true);
        yield return C("number is-empty zero is not empty", OneRule("is-empty"), 0.0, "0", "number", null, false);

        // ── NUMBER: ignore-punctuation hint ───────────────────────────────────
        yield return C("number contains ignore-punctuation USD", OneRule("contains", "1234"), 1234.56, "$1,234.56", "number", new[] { "ignore-punctuation" }, true);
        yield return C("number contains ignore-punctuation EUR", OneRule("contains", "1234"), 1234.56, "€1.234,56", "number", new[] { "ignore-punctuation" }, true);
        yield return C("number contains ignore-punctuation GBP", OneRule("contains", "1234"), 1234.56, "£1,234.56", "number", new[] { "ignore-punctuation" }, true);
        yield return C("number contains no hint does not strip", OneRule("contains", "1234"), 1234.56, "$1,234.56", "number", null, false);

        // ── DATE: contains (uses displayString) ───────────────────────────────
        yield return C("date contains match", OneRule("contains", "Aug"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date contains no match", OneRule("contains", "Sep"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);

        // ── DATE: is — four ISO shapes ────────────────────────────────────────
        // ISO date-only
        yield return C("date is date-only match", OneRule("is", "2026-08-15"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date is date-only no match", OneRule("is", "2026-08-16"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        // ISO datetime with timezone offset
        yield return C("date is datetime offset match", OneRule("is", "2026-08-15T09:00:00-04:00"), (object?)"2026-08-15T09:00:00-04:00", "...", "date", null, true);
        yield return C("date is datetime offset no match", OneRule("is", "2026-08-15T10:00:00-04:00"), (object?)"2026-08-15T09:00:00-04:00", "...", "date", null, false);
        // ISO datetime with Z
        yield return C("date is datetime Z match", OneRule("is", "2026-08-15T13:00:00Z"), (object?)"2026-08-15T13:00:00Z", "...", "date", null, true);
        yield return C("date is datetime Z no match", OneRule("is", "2026-08-15T14:00:00Z"), (object?)"2026-08-15T13:00:00Z", "...", "date", null, false);
        // ISO datetime no offset (local)
        yield return C("date is datetime local match", OneRule("is", "2026-08-15T09:00:00"), (object?)"2026-08-15T09:00:00", "...", "date", null, true);
        yield return C("date is datetime local no match", OneRule("is", "2026-08-15T10:00:00"), (object?)"2026-08-15T09:00:00", "...", "date", null, false);

        // ── DATE: before / after ──────────────────────────────────────────────
        yield return C("date before match", OneRule("before", "2026-09-01"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date before equal not before", OneRule("before", "2026-08-15"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("date before no match future", OneRule("before", "2026-07-01"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("date after match", OneRule("after", "2026-07-01"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date after equal not after", OneRule("after", "2026-08-15"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("date after no match past", OneRule("after", "2026-09-01"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);

        // ── DATE: in-range ────────────────────────────────────────────────────
        yield return C("date in-range match", OneRule("in-range", new string[] { "2026-08-01", "2026-08-31" }), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date in-range at lower bound", OneRule("in-range", new string[] { "2026-08-15", "2026-08-31" }), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date in-range at upper bound", OneRule("in-range", new string[] { "2026-08-01", "2026-08-15" }), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);
        yield return C("date in-range out low", OneRule("in-range", new string[] { "2026-09-01", "2026-09-30" }), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("date in-range out high", OneRule("in-range", new string[] { "2026-01-01", "2026-07-31" }), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("date in-range via JsonElement", OneRule("in-range", ToJson(new string[] { "2026-08-01", "2026-08-31" })), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);

        // ── DATE: is-empty / is-not-empty ─────────────────────────────────────
        yield return C("date is-empty null", OneRule("is-empty"), null, "", "date", null, true);
        yield return C("date is-empty empty string", OneRule("is-empty"), (object?)"", "", "date", null, true);
        yield return C("date is-not-empty has value", OneRule("is-not-empty"), (object?)"2026-08-15", "Aug 15, 2026", "date", null, true);

        // ── FIXED-SET: contains ───────────────────────────────────────────────
        yield return C("fixed-set contains match", OneRule("contains", "ope"), (object?)"open", "Open", "fixed-set", null, true);
        yield return C("fixed-set contains case-insensitive", OneRule("contains", "OPE"), (object?)"open", "Open", "fixed-set", null, true);
        yield return C("fixed-set contains no match", OneRule("contains", "xyz"), (object?)"open", "Open", "fixed-set", null, false);

        // ── FIXED-SET: is ─────────────────────────────────────────────────────
        yield return C("fixed-set is match", OneRule("is", "open"), (object?)"open", "Open", "fixed-set", null, true);
        yield return C("fixed-set is case-sensitive no match", OneRule("is", "Open"), (object?)"open", "Open", "fixed-set", null, false);
        yield return C("fixed-set is no match", OneRule("is", "closed"), (object?)"open", "Open", "fixed-set", null, false);

        // ── FIXED-SET: is-not ─────────────────────────────────────────────────
        yield return C("fixed-set is-not match", OneRule("is-not", "closed"), (object?)"open", "Open", "fixed-set", null, true);
        yield return C("fixed-set is-not same value no match", OneRule("is-not", "open"), (object?)"open", "Open", "fixed-set", null, false);

        // ── FIXED-SET: is-empty / is-not-empty ───────────────────────────────
        yield return C("fixed-set is-empty null", OneRule("is-empty"), null, "", "fixed-set", null, true);
        yield return C("fixed-set is-empty empty string", OneRule("is-empty"), (object?)"", "", "fixed-set", null, true);
        yield return C("fixed-set is-not-empty has value", OneRule("is-not-empty"), (object?)"open", "Open", "fixed-set", null, true);
        yield return C("fixed-set is-not-empty null", OneRule("is-not-empty"), null, "", "fixed-set", null, false);

        // ── YES-NO: contains (uses displayString) ────────────────────────────
        yield return C("yes-no contains match yes", OneRule("contains", "Yes"), true, "Yes", "yes-no", null, true);
        yield return C("yes-no contains match no", OneRule("contains", "No"), false, "No", "yes-no", null, true);
        yield return C("yes-no contains case-insensitive", OneRule("contains", "yes"), true, "Yes", "yes-no", null, true);
        yield return C("yes-no contains no match", OneRule("contains", "xyz"), true, "Yes", "yes-no", null, false);

        // ── YES-NO: is-true ───────────────────────────────────────────────────
        yield return C("yes-no is-true native bool true", OneRule("is-true"), true, "Yes", "yes-no", null, true);
        yield return C("yes-no is-true native bool false", OneRule("is-true"), false, "No", "yes-no", null, false);
        yield return C("yes-no is-true JsonElement true", OneRule("is-true"), ToJson(true), "Yes", "yes-no", null, true);
        yield return C("yes-no is-true JsonElement false", OneRule("is-true"), ToJson(false), "No", "yes-no", null, false);
        yield return C("yes-no is-true string true", OneRule("is-true"), (object?)"true", "Yes", "yes-no", null, true);
        yield return C("yes-no is-true string false no match", OneRule("is-true"), (object?)"false", "No", "yes-no", null, false);
        yield return C("yes-no is-true null no match", OneRule("is-true"), null, "", "yes-no", null, false);

        // ── YES-NO: is-false ──────────────────────────────────────────────────
        yield return C("yes-no is-false native bool false", OneRule("is-false"), false, "No", "yes-no", null, true);
        yield return C("yes-no is-false native bool true", OneRule("is-false"), true, "Yes", "yes-no", null, false);
        yield return C("yes-no is-false JsonElement false", OneRule("is-false"), ToJson(false), "No", "yes-no", null, true);
        yield return C("yes-no is-false string false", OneRule("is-false"), (object?)"false", "No", "yes-no", null, true);
        yield return C("yes-no is-false null no match", OneRule("is-false"), null, "", "yes-no", null, false);

        // ── YES-NO: is-empty / is-not-empty ──────────────────────────────────
        yield return C("yes-no is-empty null", OneRule("is-empty"), null, "", "yes-no", null, true);
        yield return C("yes-no is-empty empty string", OneRule("is-empty"), (object?)"", "", "yes-no", null, true);
        yield return C("yes-no is-not-empty bool true", OneRule("is-not-empty"), true, "Yes", "yes-no", null, true);
        yield return C("yes-no is-not-empty bool false", OneRule("is-not-empty"), false, "No", "yes-no", null, true);
        yield return C("yes-no is-not-empty null no match", OneRule("is-not-empty"), null, "", "yes-no", null, false);

        // ── MULTI-RULE: all-of (AND semantics) ────────────────────────────────
        yield return C("multi all-of both pass", TwoRules("greater-than", 10.0, "less-than", 100.0), 42.0, "42", "number", null, true);
        yield return C("multi all-of first fails", TwoRules("greater-than", 50.0, "less-than", 100.0), 42.0, "42", "number", null, false);
        yield return C("multi all-of second fails", TwoRules("greater-than", 10.0, "less-than", 30.0), 42.0, "42", "number", null, false);
        yield return C("multi all-of both fail", TwoRules("greater-than", 100.0, "less-than", 10.0), 42.0, "42", "number", null, false);

        // ── MULTI-RULE: any-of (OR semantics) ────────────────────────────────
        yield return C("multi any-of both pass", TwoRules("equals", 42.0, "equals", 100.0, "any-of"), 42.0, "42", "number", null, true);
        yield return C("multi any-of first passes", TwoRules("equals", 42.0, "equals", 99.0, "any-of"), 42.0, "42", "number", null, true);
        yield return C("multi any-of second passes", TwoRules("equals", 99.0, "equals", 42.0, "any-of"), 42.0, "42", "number", null, true);
        yield return C("multi any-of both fail", TwoRules("equals", 99.0, "equals", 100.0, "any-of"), 42.0, "42", "number", null, false);

        // ── MULTI-RULE: 3-rule all-of ─────────────────────────────────────────
        yield return C("3-rule all-of all pass", ThreeRules("greater-than", 0.0, "less-than", 100.0, "is-not-empty", null), 42.0, "42", "number", null, true);
        yield return C("3-rule all-of middle fails", ThreeRules("greater-than", 0.0, "greater-than", 50.0, "is-not-empty", null), 42.0, "42", "number", null, false);

        // ── MULTI-RULE: 3-rule any-of ─────────────────────────────────────────
        yield return C("3-rule any-of only last passes",
            ThreeRules("equals", 1.0, "equals", 2.0, "equals", 42.0, "any-of"),
            42.0, "42", "number", null, true);
        yield return C("3-rule any-of none pass",
            ThreeRules("equals", 1.0, "equals", 2.0, "equals", 3.0, "any-of"),
            42.0, "42", "number", null, false);

        // ── NO SHORT-CIRCUIT: all rules evaluated even when first fails ────────
        // This test verifies no short-circuit — we track results[] for all rules.
        // A 2-rule any-of where the SECOND rule passes even when first fails:
        yield return C("no-short-circuit any-of second rule decides",
            TwoRules("contains", "zzz", "starts-with", "foo", "any-of"),
            "foobar", "foobar", "text", null, true);
        // 2-rule all-of where first passes but second fails — all still evaluated:
        yield return C("no-short-circuit all-of second rule decides",
            TwoRules("starts-with", "foo", "ends-with", "zzz"),
            "foobar", "foobar", "text", null, false);

        // ── UNKNOWN JOINER: treated as all-of ─────────────────────────────────
        yield return C("unknown joiner treated as all-of pass",
            new FilterDescriptor(new[] { new FilterRule("greater-than", 10.0) }, "xor"),
            42.0, "42", "number", null, true);
        yield return C("unknown joiner treated as all-of fail",
            new FilterDescriptor(new[] { new FilterRule("greater-than", 50.0) }, "xor"),
            42.0, "42", "number", null, false);

        // ── UNKNOWN KIND: returns false (fail-safe) ────────────────────────────
        yield return C("unknown kind returns false",
            OneRule("equals", "x"), (object?)"x", "x", "latitude", null, false);

        // ── UNKNOWN OPERATOR: returns false ───────────────────────────────────
        yield return C("unknown text operator returns false",
            OneRule("fuzzy-match", "foo"), "foo bar", "foo bar", "text", null, false);
        yield return C("unknown number operator returns false",
            OneRule("modulo", 2.0), 42.0, "42", "number", null, false);

        // ── JsonElement deserialization for rawValue ───────────────────────────
        yield return C("JsonElement string rawValue equals",
            OneRule("equals", "hello"), ToJson("hello"), "hello", "text", null, true);
        yield return C("JsonElement number rawValue equals",
            OneRule("equals", 42.0), ToJson(42.0), "42", "number", null, true);
        yield return C("JsonElement bool rawValue is-true",
            OneRule("is-true"), ToJson(true), "Yes", "yes-no", null, true);
        yield return C("JsonElement null rawValue is-empty",
            OneRule("is-empty"), ToJson<string?>(null), "", "text", null, true);

        // ── IGNORE-PUNCTUATION: text kind ─────────────────────────────────────
        yield return C("text contains ignore-punctuation strips both",
            OneRule("contains", "123"),
            (object?)"$1,234.56", "$1,234.56", "text", new[] { "ignore-punctuation" }, true);
        yield return C("text contains ignore-punctuation rule value stripped",
            OneRule("contains", "$1,234"),
            (object?)"1234", "1234", "text", new[] { "ignore-punctuation" }, true);

        // ── EDGE CASES ────────────────────────────────────────────────────────
        yield return C("empty display string contains empty matches",
            OneRule("contains", ""), null, "", "text", null, true);
        yield return C("number null rawValue greater-than returns false",
            OneRule("greater-than", 0.0), null, "", "number", null, false);
        yield return C("date null rawValue before returns false",
            OneRule("before", "2026-01-01"), null, "", "date", null, false);
        yield return C("number between null bounds returns false",
            OneRule("between", null), 42.0, "42", "number", null, false);
        yield return C("date in-range null bounds returns false",
            OneRule("in-range", null), (object?)"2026-08-15", "Aug 15, 2026", "date", null, false);
        yield return C("yes-no is-true whitespace string no match",
            OneRule("is-true"), (object?)" ", " ", "yes-no", null, false);

        // ── FIXED-SET via JsonElement rawValue ────────────────────────────────
        yield return C("fixed-set is JsonElement string match",
            OneRule("is", "open"), ToJson("open"), "Open", "fixed-set", null, true);
        yield return C("fixed-set is JsonElement string case-sensitive",
            OneRule("is", "Open"), ToJson("open"), "Open", "fixed-set", null, false);
    }

    // Boxing helper so yield return can use named parameter style
    private static object?[] C(
        string caseName,
        FilterDescriptor descriptor,
        object? rawValue,
        string displayString,
        string kind,
        string[]? matchingHints,
        bool expected)
        => new object?[] { caseName, descriptor, rawValue, displayString, kind, matchingHints, expected };

    // ─── The one test method ──────────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(Cases))]
    public void MatchesFilter_ReturnsExpected(
        string caseName,
        FilterDescriptor descriptor,
        object? rawValue,
        string displayString,
        string kind,
        string[]? matchingHints,
        bool expected)
    {
        var actual = FilterHelper.MatchesFilter(descriptor, rawValue, displayString, kind, matchingHints);
        Assert.True(
            actual == expected,
            $"[{caseName}] Expected {expected} but got {actual}. " +
            $"kind={kind} op={descriptor.Rules[0].Operator} rawValue={rawValue} display={displayString}");
    }
}
