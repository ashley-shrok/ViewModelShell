namespace ViewModelShell.State;

public record TaskRecord(string Id, string Title, bool Completed, DateTimeOffset CreatedAt);

public record TasksState(
    IReadOnlyList<TaskRecord> Items,
    string Filter,
    // Phase 6 (WIRE-07) — typed value of the inline add-task input. Lives in
    // state so the renderer's bind seam can read/write it; the "add" handler
    // reads it and resets to "" after appending the new task.
    string DraftTitle
)
{
    public static TasksState Initial() => new(
        Items:
        [
            new("1", "Set up the project",        true,  DateTimeOffset.UtcNow.AddHours(-3)),
            new("2", "Wire the ViewModel shell",  false, DateTimeOffset.UtcNow.AddHours(-1)),
            new("3", "Write the render function", false, DateTimeOffset.UtcNow.AddMinutes(-20)),
        ],
        Filter: "all",
        DraftTitle: ""
    );
}
