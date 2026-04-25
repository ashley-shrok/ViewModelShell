namespace ContactManager.Services;

using System.Collections.Concurrent;

public class ContactStoreRegistry
{
    private readonly ConcurrentDictionary<string, ContactStore> _stores = new();

    public ContactStore GetOrCreate(string tabId) =>
        _stores.GetOrAdd(tabId, _ => new ContactStore());
}
