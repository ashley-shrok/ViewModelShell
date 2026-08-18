using System.Text.Json;
using System.Text.RegularExpressions;

namespace ViewModelShell;

/// <summary>
/// Reference truth function for column filtering. Evaluates a FilterDescriptor against a row's
/// cell value. Call from your action handler after reading the current FilterDescriptor from
/// state at the path declared in TableNode.FilterDescriptorBinds.
///
/// Kind must match the column's declared FilterSpec.Kind: one of "text", "number", "date",
/// "fixed-set", or "yes-no" (closed union — the TS twin is the source of truth per
/// AGENTS.md closed-unions-enforced-on-ONE-side-only invariant).
///
/// MatchingHints optionally specifies matching-behavior modifiers: currently the only member
/// is "ignore-punctuation", which strips $, £, €, commas, and periods from both the display
/// string and the rule value before a contains comparison. Useful for currency columns.
///
/// This helper is byte-parallel with the TypeScript matchesFilter function exported from
/// @ashley-shrok/viewmodel-shell/server. Both backends implement the same operator semantics
/// and return identical results for identical inputs — proven by Plan 32-03's parity fixture.
///
/// Thread-safe: all state is stack-local; this class holds no mutable state.
/// </summary>
public static class FilterHelper
{
    // Pre-compiled regex for ignore-punctuation hint: strips $, £, €, commas, periods.
    private static readonly Regex PunctuationRegex = new(@"[$£€,.]", RegexOptions.Compiled);

    /// <summary>
    /// Evaluates a FilterDescriptor against a single row cell's value.
    ///
    /// Returns true if the cell matches the descriptor according to the joiner semantics:
    ///   - "all-of": every rule must match (logical AND).
    ///   - "any-of": at least one rule must match (logical OR).
    ///   - Unknown joiner: treated as "all-of" (fail-safe, matches TS behavior).
    ///
    /// No short-circuit: every rule is evaluated regardless of intermediate results.
    /// This is deliberate (simpler semantics, easier to test — see CONTEXT D-06).
    /// </summary>
    /// <param name="descriptor">The filter descriptor (rules + joiner) from state.</param>
    /// <param name="rawValue">The raw cell value. May be null, bool, int, long, double,
    /// string, or JsonElement (when deserialized from round-tripped state).</param>
    /// <param name="displayString">The display-formatted string for the cell (what the
    /// user sees). Used by "contains" on every kind.</param>
    /// <param name="kind">The value-kind for this column. Must be one of "text",
    /// "number", "date", "fixed-set", or "yes-no".</param>
    /// <param name="matchingHints">Optional matching hints. Currently the only recognized
    /// value is "ignore-punctuation". Null or empty means no hints.</param>
    /// <returns>True if the cell matches the descriptor.</returns>
    public static bool MatchesFilter(
        FilterDescriptor descriptor,
        object? rawValue,
        string displayString,
        string kind,
        IReadOnlyList<string>? matchingHints = null)
    {
        var results = new bool[descriptor.Rules.Count];
        for (int i = 0; i < descriptor.Rules.Count; i++)
        {
            results[i] = EvaluateRule(descriptor.Rules[i], rawValue, displayString, kind, matchingHints);
        }

        return descriptor.Joiner switch
        {
            "any-of" => results.Any(r => r),
            _ => results.All(r => r), // "all-of" and unknown joiners — fail-safe is all-of
        };
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private static bool EvaluateRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        string kind,
        IReadOnlyList<string>? matchingHints)
    {
        return kind switch
        {
            "text" => EvaluateTextRule(rule, rawValue, displayString, matchingHints),
            "number" => EvaluateNumberRule(rule, rawValue, displayString, matchingHints),
            "date" => EvaluateDateRule(rule, rawValue, displayString, matchingHints),
            "fixed-set" => EvaluateFixedSetRule(rule, rawValue, displayString, matchingHints),
            "yes-no" => EvaluateYesNoRule(rule, rawValue, displayString, matchingHints),
            _ => false, // unknown kind — fail-safe
        };
    }

    // ─── Text operators ───────────────────────────────────────────────────────
    // Text: contains, equals, starts-with, ends-with, is-empty, is-not-empty

    private static bool EvaluateTextRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        IReadOnlyList<string>? matchingHints)
    {
        return rule.Operator switch
        {
            "contains" => ApplyContains(displayString, rule.Value, matchingHints),
            "equals" => string.Equals(displayString, GetRuleString(rule.Value), StringComparison.Ordinal),
            "starts-with" => displayString.StartsWith(GetRuleString(rule.Value) ?? "", StringComparison.OrdinalIgnoreCase),
            "ends-with" => displayString.EndsWith(GetRuleString(rule.Value) ?? "", StringComparison.OrdinalIgnoreCase),
            "is-empty" => IsEmpty(rawValue),
            "is-not-empty" => !IsEmpty(rawValue),
            _ => false,
        };
    }

    // ─── Number operators ─────────────────────────────────────────────────────
    // Number: contains, equals, does-not-equal, greater-than, greater-than-or-equal,
    //         less-than, less-than-or-equal, between, is-empty, is-not-empty

    private static bool EvaluateNumberRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        IReadOnlyList<string>? matchingHints)
    {
        if (rule.Operator == "contains")
            return ApplyContains(displayString, rule.Value, matchingHints);
        if (rule.Operator == "is-empty")
            return IsEmpty(rawValue);
        if (rule.Operator == "is-not-empty")
            return !IsEmpty(rawValue);

        // Remaining operators require a numeric rawValue
        if (!TryGetDouble(rawValue, out double cellVal))
            return false;

        if (rule.Operator == "between")
        {
            // rule.Value is a two-element numeric array [low, high]
            var bounds = DeserializeDoubleArray(rule.Value);
            if (bounds == null || bounds.Length < 2) return false;
            return cellVal >= bounds[0] && cellVal <= bounds[1];
        }

        if (!TryGetDouble(rule.Value, out double ruleVal))
            return false;

        return rule.Operator switch
        {
            "equals" => cellVal == ruleVal,
            "does-not-equal" => cellVal != ruleVal,
            "greater-than" => cellVal > ruleVal,
            "greater-than-or-equal" => cellVal >= ruleVal,
            "less-than" => cellVal < ruleVal,
            "less-than-or-equal" => cellVal <= ruleVal,
            _ => false,
        };
    }

    // ─── Date operators ───────────────────────────────────────────────────────
    // Date: contains, is, before, after, in-range, is-empty, is-not-empty
    // Uses ISO-8601 string comparison (no parsing, no timezone math — D-03).

    private static bool EvaluateDateRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        IReadOnlyList<string>? matchingHints)
    {
        if (rule.Operator == "contains")
            return ApplyContains(displayString, rule.Value, matchingHints);
        if (rule.Operator == "is-empty")
            return IsEmpty(rawValue);
        if (rule.Operator == "is-not-empty")
            return !IsEmpty(rawValue);

        var cellStr = GetRuleString(rawValue);
        if (cellStr == null) return false;

        if (rule.Operator == "in-range")
        {
            // rule.Value is a two-element string array [low, high]
            var bounds = DeserializeStringArray(rule.Value);
            if (bounds == null || bounds.Length < 2) return false;
            return CompareIso(cellStr, bounds[0]) >= 0 && CompareIso(cellStr, bounds[1]) <= 0;
        }

        var ruleStr = GetRuleString(rule.Value);
        if (ruleStr == null) return false;

        return rule.Operator switch
        {
            "is" => CompareIso(cellStr, ruleStr) == 0,
            "before" => CompareIso(cellStr, ruleStr) < 0,
            "after" => CompareIso(cellStr, ruleStr) > 0,
            _ => false,
        };
    }

    // ─── Fixed-set operators ──────────────────────────────────────────────────
    // Fixed-set: contains, is, is-not, is-empty, is-not-empty

    private static bool EvaluateFixedSetRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        IReadOnlyList<string>? matchingHints)
    {
        return rule.Operator switch
        {
            "contains" => ApplyContains(displayString, rule.Value, matchingHints),
            "is" => string.Equals(GetRuleString(rawValue), GetRuleString(rule.Value), StringComparison.Ordinal),
            "is-not" => !string.Equals(GetRuleString(rawValue), GetRuleString(rule.Value), StringComparison.Ordinal),
            "is-empty" => IsEmpty(rawValue),
            "is-not-empty" => !IsEmpty(rawValue),
            _ => false,
        };
    }

    // ─── Yes-no operators ─────────────────────────────────────────────────────
    // Yes-no: contains, is-true, is-false, is-empty, is-not-empty

    private static bool EvaluateYesNoRule(
        FilterRule rule,
        object? rawValue,
        string displayString,
        IReadOnlyList<string>? matchingHints)
    {
        return rule.Operator switch
        {
            "contains" => ApplyContains(displayString, rule.Value, matchingHints),
            "is-true" => ToBool(rawValue) == true,
            "is-false" => ToBool(rawValue) == false,
            "is-empty" => IsEmpty(rawValue),
            "is-not-empty" => !IsEmpty(rawValue),
            _ => false,
        };
    }

    // ─── Shared helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Case-insensitive contains check on the display string against the rule value.
    /// When "ignore-punctuation" is in matchingHints, strips $, £, €, commas, and
    /// periods from both strings before comparing. Byte-parallel with TS matchesFilter.
    /// </summary>
    private static bool ApplyContains(
        string displayString,
        object? ruleValue,
        IReadOnlyList<string>? matchingHints)
    {
        var ruleStr = GetRuleString(ruleValue) ?? "";
        var display = displayString;

        if (matchingHints != null && matchingHints.Contains("ignore-punctuation"))
        {
            display = PunctuationRegex.Replace(display, "");
            ruleStr = PunctuationRegex.Replace(ruleStr, "");
        }

        return display.Contains(ruleStr, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Determines whether a value is "empty" per the VMS filter contract:
    /// null and empty string are empty; whitespace-only is NOT empty.
    /// Handles JsonElement values from round-tripped state.
    /// Byte-parallel with the TS isEmpty implementation.
    /// </summary>
    private static bool IsEmpty(object? v)
    {
        if (v is null) return true;
        if (v is string s) return s.Length == 0;
        if (v is JsonElement je)
        {
            return je.ValueKind == JsonValueKind.Null ||
                   (je.ValueKind == JsonValueKind.String && je.GetString()!.Length == 0) ||
                   je.ValueKind == JsonValueKind.Undefined;
        }
        return false;
    }

    /// <summary>
    /// Tries to extract a double from a value. Handles int, long, double, decimal,
    /// string-numeric, and JsonElement (via GetDouble or string parse).
    /// Covers negative integers (-5), decimals (3.14), and negative decimals (-2.5)
    /// via Convert.ToDouble — no special casing needed.
    /// </summary>
    private static bool TryGetDouble(object? v, out double d)
    {
        d = 0;
        if (v is null) return false;

        try
        {
            if (v is JsonElement je)
            {
                if (je.ValueKind == JsonValueKind.Number)
                {
                    d = je.GetDouble();
                    return true;
                }
                if (je.ValueKind == JsonValueKind.String)
                {
                    var str = je.GetString();
                    if (double.TryParse(str, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out d))
                        return true;
                    return false;
                }
                return false;
            }

            d = Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Ordinal ISO-8601 string comparison. ISO-8601 strings sort chronologically
    /// by ordinal comparison — the framework relies on this property directly
    /// (no parsing, no timezone math). Byte-parallel with the TS string comparison.
    /// </summary>
    private static int CompareIso(string? a, string? b)
        => string.Compare(a, b, StringComparison.Ordinal);

    /// <summary>
    /// Extracts a string from a value: string → as-is, JsonElement string → GetString(),
    /// null → null, anything else → ToString().
    /// </summary>
    private static string? GetRuleString(object? v)
    {
        if (v is null) return null;
        if (v is string s) return s;
        if (v is JsonElement je)
        {
            return je.ValueKind == JsonValueKind.String ? je.GetString() :
                   je.ValueKind == JsonValueKind.Null ? null :
                   je.ToString();
        }
        return v.ToString();
    }

    /// <summary>
    /// Converts a value to bool for yes-no operators.
    /// true-ish: bool true, JsonElement true, "true" string.
    /// false-ish: bool false, JsonElement false, "false" string.
    /// null/anything else: null (neither is-true nor is-false matches).
    /// </summary>
    private static bool? ToBool(object? v)
    {
        if (v is bool b) return b;
        if (v is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.True) return true;
            if (je.ValueKind == JsonValueKind.False) return false;
            if (je.ValueKind == JsonValueKind.String)
            {
                var str = je.GetString();
                if (str == "true") return true;
                if (str == "false") return false;
            }
            return null;
        }
        if (v is string s)
        {
            if (s == "true") return true;
            if (s == "false") return false;
        }
        return null;
    }

    /// <summary>
    /// Deserializes a value as a double[] for the "between" (number) operator.
    /// Handles JsonElement (array), double[], float[], long[], int[], and JSON string arrays.
    /// Returns null if deserialization fails (fail-safe — returns false from operator).
    /// </summary>
    private static double[]? DeserializeDoubleArray(object? v)
    {
        if (v is null) return null;
        if (v is double[] da) return da;
        if (v is float[] fa) return fa.Select(x => (double)x).ToArray();
        if (v is long[] la) return la.Select(x => (double)x).ToArray();
        if (v is int[] ia) return ia.Select(x => (double)x).ToArray();
        if (v is object[] oa)
        {
            try { return oa.Select(x => Convert.ToDouble(x, System.Globalization.CultureInfo.InvariantCulture)).ToArray(); }
            catch { return null; }
        }

        try
        {
            var json = v is JsonElement je ? je.GetRawText() : JsonSerializer.Serialize(v);
            return JsonSerializer.Deserialize<double[]>(json);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Deserializes a value as a string[] for the "in-range" (date) operator.
    /// Handles JsonElement (array), string[], and JSON serialized arrays.
    /// Returns null if deserialization fails (fail-safe).
    /// </summary>
    private static string[]? DeserializeStringArray(object? v)
    {
        if (v is null) return null;
        if (v is string[] sa) return sa;

        try
        {
            var json = v is JsonElement je ? je.GetRawText() : JsonSerializer.Serialize(v);
            return JsonSerializer.Deserialize<string[]>(json);
        }
        catch
        {
            return null;
        }
    }
}
