namespace ViewModelShell.State;

public record TaskRecord(string Id, string Title, bool Completed, DateTimeOffset CreatedAt);

public record TasksState(
    IReadOnlyList<TaskRecord> Items,
    string Filter
)
{
    public static TasksState Initial() => new(
        Items:
        [
            new("1", "Set up the project",        true,  DateTimeOffset.UtcNow.AddHours(-3)),
            new("2", "Wire the ViewModel shell",  false, DateTimeOffset.UtcNow.AddHours(-1)),
            new("3", "Write the render function", false, DateTimeOffset.UtcNow.AddMinutes(-20)),
        ],
        Filter: "all"
    );
}
