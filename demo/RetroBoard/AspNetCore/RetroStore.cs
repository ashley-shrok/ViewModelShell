namespace RetroBoard.Services;

public record RetroCard(string Id, string Text, int Votes, bool Resolved, DateTimeOffset CreatedAt);

public class RetroStore
{
    private readonly Dictionary<string, List<RetroCard>> _sections = new()
    {
        ["went-well"]     = [new("s1", "Great team communication",   0, false, DateTimeOffset.UtcNow.AddHours(-2))],
        ["didnt-go-well"] = [new("s2", "Scope creep during sprint",  0, false, DateTimeOffset.UtcNow.AddHours(-1))],
        ["action-items"]  = [new("s3", "Define DoD for features",    0, false, DateTimeOffset.UtcNow.AddMinutes(-30))],
    };
    private readonly object _lock = new();

    public IReadOnlyList<RetroCard> GetCards(string section)
    {
        lock (_lock)
            return _sections.TryGetValue(section, out var list) ? list.ToList() : [];
    }

    public void AddCard(string section, string text)
    {
        lock (_lock)
        {
            if (!_sections.TryGetValue(section, out var list)) return;
            list.Add(new RetroCard(
                Id:        Guid.NewGuid().ToString("N")[..8],
                Text:      text,
                Votes:     0,
                Resolved:  false,
                CreatedAt: DateTimeOffset.UtcNow
            ));
        }
    }

    public void DeleteCard(string id)
    {
        lock (_lock)
            foreach (var list in _sections.Values)
                list.RemoveAll(c => c.Id == id);
    }

    public void UpvoteCard(string id)
    {
        lock (_lock)
            foreach (var list in _sections.Values)
            {
                var idx = list.FindIndex(c => c.Id == id);
                if (idx < 0) continue;
                list[idx] = list[idx] with { Votes = list[idx].Votes + 1 };
                return;
            }
    }

    public void ResolveCard(string id, bool resolved)
    {
        lock (_lock)
        {
            var list = _sections["action-items"];
            var idx  = list.FindIndex(c => c.Id == id);
            if (idx >= 0) list[idx] = list[idx] with { Resolved = resolved };
        }
    }
}
