namespace ViewModelShell.Services;

public record TaskRecord(string Id, string Title, bool Completed, DateTimeOffset CreatedAt);

public class TaskStore
{
    private readonly List<TaskRecord> _tasks = new()
    {
        new("1", "Set up the project",        true,  DateTimeOffset.UtcNow.AddHours(-3)),
        new("2", "Wire the ViewModel shell",  false, DateTimeOffset.UtcNow.AddHours(-1)),
        new("3", "Write the render function", false, DateTimeOffset.UtcNow.AddMinutes(-20)),
    };
    private string _filter = "all";
    private readonly object _lock = new();

    public IReadOnlyList<TaskRecord> GetAll()
    {
        lock (_lock) return _tasks.ToList();
    }

    public string GetFilter()
    {
        lock (_lock) return _filter;
    }

    public void SetFilter(string filter)
    {
        lock (_lock) _filter = filter;
    }

    public void Add(string title)
    {
        lock (_lock)
        {
            _tasks.Add(new TaskRecord(
                Id: Guid.NewGuid().ToString("N")[..8],
                Title: title,
                Completed: false,
                CreatedAt: DateTimeOffset.UtcNow
            ));
        }
    }

    public void SetCompleted(string id, bool completed)
    {
        lock (_lock)
        {
            var idx = _tasks.FindIndex(t => t.Id == id);
            if (idx >= 0)
                _tasks[idx] = _tasks[idx] with { Completed = completed };
        }
    }

    public void Delete(string id)
    {
        lock (_lock) _tasks.RemoveAll(t => t.Id == id);
    }
}
