// v7.0.0 (ICON-05) — .NET twin of the icon-only ButtonNode a11y walker rule.
//
// Mirrors the TS icon-wire.test.ts FAIL-before/PASS-after mutation coverage
// byte-identically. The error message string here is the same one Plan 22-01
// ships in server.ts — parity's cross-backend byte-diff will catch any drift,
// but the exact-message assertion in each backend's own test catches it FIRST.
//
// The walker under test is ViewTreeValidation.ValidateActionNames, whose
// ButtonNode arm carries the predicate:
//   Icon != null && string.IsNullOrEmpty(Label) && Tooltip == null → throw
//
// ShellExceptionFilter maps this InvalidOperationException → 500 +
// code:"invalid_tree" at the framework edge; the direct-walker tests here don't
// exercise the HTTP path (that's an integration concern) — they pin the walker
// contract itself.

namespace ViewModelShell.Tests;

using ViewModelShell;

public class IconOnlyButtonValidatorTests
{
    private const string ExpectedMessage =
        "icon-only ButtonNode requires tooltip (used as aria-label)";

    private static PageNode Page(params ViewNode[] children) =>
        new(Title: null, Children: children);

    // ─── FAIL-before / PASS-after by mutation ────────────────────────────────

    [Fact]
    public void Baseline_IconPlusLabel_DoesNotThrow()
    {
        // Baseline: an icon+label button is a valid button. If this throws,
        // the rule is over-firing and every FAIL branch below is dubious.
        var btn = new ButtonNode(
            Label: "Delete",
            Action: new ActionDescriptor("delete"),
            Icon: IconName.Trash2);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(Page(btn)));
        Assert.Null(ex);
    }

    [Fact]
    public void Mutation_IconOnlyNoTooltip_Throws_WithExactMessage()
    {
        // Same button as baseline, mutated to icon-only (empty label) and no
        // tooltip. MUST throw with the byte-identical error message that
        // Plan 22-01's TS twin throws — parity's cross-backend byte-diff
        // relies on exact-string agreement.
        var btn = new ButtonNode(
            Label: "",
            Action: new ActionDescriptor("delete-icon-only"),
            Icon: IconName.Trash2);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(Page(btn)));
        Assert.Equal(
            "icon-only ButtonNode requires tooltip (used as aria-label)",
            ex.Message);
    }

    [Fact]
    public void Inversion_IconOnlyWithTooltip_DoesNotThrow()
    {
        // The mutation from the previous test, but with tooltip set — the
        // walker rule's escape hatch. Proves the rule is precise (fires on
        // icon+empty-label+no-tooltip, not on icon+empty-label alone).
        var btn = new ButtonNode(
            Label: "",
            Action: new ActionDescriptor("delete-with-tooltip"),
            Icon: IconName.Trash2,
            Tooltip: "Delete");
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(Page(btn)));
        Assert.Null(ex);
    }

    // ─── Regression / precision guards ───────────────────────────────────────

    [Fact]
    public void PlainButtonNoIcon_DoesNotThrow_IconOnlyRule()
    {
        // A vanilla button (no icon) MUST NOT trip the icon-only rule.
        var btn = new ButtonNode(
            Label: "Save",
            Action: new ActionDescriptor("save"));
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(Page(btn)));
        Assert.Null(ex);
    }

    [Fact]
    public void PlainButtonEmptyLabelNoIcon_DoesNotThrowIconOnlyRule()
    {
        // Empty label alone (without an icon) is NOT the icon-only case; the
        // rule under test must not fire. (Whether an empty-label button is
        // otherwise valid is a separate concern.)
        var btn = new ButtonNode(
            Label: "",
            Action: new ActionDescriptor("empty-label"));
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(Page(btn)));
        // The rule should not throw. If any exception is thrown by an
        // unrelated rule, ensure it's not the icon-only message.
        Assert.True(ex is null || !ex.Message.Contains(ExpectedMessage));
    }

    [Fact]
    public void IconPlusLabelNoTooltip_DoesNotThrow()
    {
        // Label carries a11y — no tooltip needed. Same as the baseline but
        // named explicitly for coverage-tripwire clarity.
        var btn = new ButtonNode(
            Label: "Delete",
            Action: new ActionDescriptor("del-labeled"),
            Icon: IconName.Trash2);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(Page(btn)));
        Assert.Null(ex);
    }

    [Fact]
    public void NestedIconOnlyButtonInsideForm_StillThrows()
    {
        // The rule fires regardless of enclosing container — the walker
        // descends into forms/sections/lists. Pins that the icon-only-button
        // check is in the button ARM, not a top-level guard.
        var btn = new ButtonNode(
            Label: "",
            Action: new ActionDescriptor("nested-icon-only"),
            Icon: IconName.X);
        var form = new FormNode(
            SubmitAction: null,
            SubmitLabel: null,
            Children: new ViewNode[] { btn });
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(Page(form)));
        Assert.Contains("icon-only ButtonNode requires tooltip", ex.Message);
    }
}
