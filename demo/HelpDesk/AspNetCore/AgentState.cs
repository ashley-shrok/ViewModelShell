namespace HelpDesk;

using System.Collections.Concurrent;

public class AgentState
{
    public string View { get; set; } = "queue";  // queue | detail
    public long? SelectedTicketId { get; set; }
    public string Filter { get; set; } = "all";
    public bool NotesSaved { get; set; }
}

public class AgentStateRegistry
{
    private readonly ConcurrentDictionary<string, AgentState> _states = new();
    public AgentState GetOrCreate(string tabId) =>
        _states.GetOrAdd(tabId, _ => new AgentState());
}
