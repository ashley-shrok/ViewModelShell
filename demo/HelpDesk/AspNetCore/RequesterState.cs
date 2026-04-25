namespace HelpDesk;

using System.Collections.Concurrent;

public class RequesterState
{
    public string View { get; set; } = "list";   // list | create | detail
    public long? SelectedTicketId { get; set; }
    public string Filter { get; set; } = "all";
    public string CreateType { get; set; } = "hardware";
    public string CreatePriority { get; set; } = "medium";
    public string CreateAccessLevel { get; set; } = "read";
    public string? ValidationError { get; set; }
}

public class RequesterStateRegistry
{
    private readonly ConcurrentDictionary<string, RequesterState> _states = new();
    public RequesterState GetOrCreate(string tabId) =>
        _states.GetOrAdd(tabId, _ => new RequesterState());
}
