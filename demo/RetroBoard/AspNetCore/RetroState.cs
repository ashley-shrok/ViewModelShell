namespace RetroBoard.State;

public record RetroCard(string Id, string Text, int Votes, bool Resolved, DateTimeOffset CreatedAt);

// Phase 6 (WIRE-07) — per-lane draft text bound by the FieldNodes in each
// Add form. Reset to "" after a successful add-card-{section}.
public record RetroDrafts(string WentWell, string DidntGoWell, string ActionItems)
{
    public static RetroDrafts Empty() => new("", "", "");
}

public record RetroState(
    IReadOnlyList<RetroCard> WentWell,
    IReadOnlyList<RetroCard> DidntGoWell,
    IReadOnlyList<RetroCard> ActionItems,
    RetroDrafts Drafts
)
{
    public static RetroState Initial() => new(
        WentWell:    [new("s1", "Great team communication",   0, false, DateTimeOffset.UtcNow.AddHours(-2))],
        DidntGoWell: [new("s2", "Scope creep during sprint",  0, false, DateTimeOffset.UtcNow.AddHours(-1))],
        ActionItems: [new("s3", "Define DoD for features",    0, false, DateTimeOffset.UtcNow.AddMinutes(-30))],
        Drafts: RetroDrafts.Empty()
    );
}
