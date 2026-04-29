namespace RetroBoard.State;

public record RetroCard(string Id, string Text, int Votes, bool Resolved, DateTimeOffset CreatedAt);

public record RetroState(
    IReadOnlyList<RetroCard> WentWell,
    IReadOnlyList<RetroCard> DidntGoWell,
    IReadOnlyList<RetroCard> ActionItems
)
{
    public static RetroState Initial() => new(
        WentWell:    [new("s1", "Great team communication",   0, false, DateTimeOffset.UtcNow.AddHours(-2))],
        DidntGoWell: [new("s2", "Scope creep during sprint",  0, false, DateTimeOffset.UtcNow.AddHours(-1))],
        ActionItems: [new("s3", "Define DoD for features",    0, false, DateTimeOffset.UtcNow.AddMinutes(-30))]
    );
}
