namespace RetroBoard.Services;

using System.Collections.Concurrent;

public class RetroRegistry
{
    private readonly ConcurrentDictionary<string, RetroStore> _stores = new();

    public RetroStore GetOrCreate(string tabId) =>
        _stores.GetOrAdd(tabId, _ => new RetroStore());
}
