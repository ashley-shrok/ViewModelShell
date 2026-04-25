namespace ViewModelShell.Services;

using System.Collections.Concurrent;

public class TaskStoreRegistry
{
    private readonly ConcurrentDictionary<string, TaskStore> _stores = new();

    public TaskStore GetOrCreate(string tabId) =>
        _stores.GetOrAdd(tabId, _ => new TaskStore());
}
