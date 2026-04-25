namespace ExpenseTracker.Services;

using System.Collections.Concurrent;

public class ExpenseStoreRegistry
{
    private readonly ConcurrentDictionary<string, ExpenseStore> _stores = new();

    public ExpenseStore GetOrCreate(string tabId) =>
        _stores.GetOrAdd(tabId, _ => new ExpenseStore());
}
