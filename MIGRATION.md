# Migration Guide

## Table filters: global → per-column

**When:** If you have a `TableNode` that uses `filterValue` or `filterAction`.

### What changed

The single above-table filter input is replaced with per-column filter inputs rendered
inside the `<thead>`. Filter state moves from `TableNode` onto each `TableColumn`.

### TypeScript / JSON shape

**Before:**
```ts
{
  type: "table",
  columns: [{ key: "name", label: "Name" }],
  rows: [...],
  filterValue: "alice",              // ← removed
  filterAction: { name: "filter" },
}
```

**After:**
```ts
{
  type: "table",
  columns: [
    { key: "name", label: "Name", filterable: true, filterValue: "alice" },
  ],
  rows: [...],
  filterAction: { name: "filter" },  // stays on TableNode
}
```

`filterable: true` opts a column into rendering a filter input. `filterValue` on the
column populates the input on render (server is source of truth).

### Action context shape

**Before** — dispatched `{ value: "alice" }`.

**After** — dispatches `{ column: "name", value: "alice", filters: { name: "alice", status: "" } }`.

`column` is the key of the column whose input was submitted. `filters` contains the
current text of every filterable column's input at the moment Enter was pressed.

### C# record

**Before:**
```csharp
public record TableColumn(string Key, string Label, bool Sortable = false);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    string? SortColumn = null,
    string? SortDirection = null,
    ActionDescriptor? SortAction = null,
    string? FilterValue = null,       // ← removed
    ActionDescriptor? FilterAction = null
) : ViewNode;
```

**After:**
```csharp
public record TableColumn(
    string Key, string Label,
    bool Sortable = false,
    bool Filterable = false,          // ← new
    string? FilterValue = null        // ← new (per-column value)
);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    string? SortColumn = null,
    string? SortDirection = null,
    ActionDescriptor? SortAction = null,
    ActionDescriptor? FilterAction = null   // FilterValue removed
) : ViewNode;
```

### Controller handler

**Before:**
```csharp
case "filter":
    var filterText = Str("value");
    if (filterText != null) Store.SetFilter(filterText);
    break;
```

**After:**
```csharp
case "filter":
    var column = Str("column");
    var value  = Str("value");
    // or read all columns at once:
    // payload.Context["filters"] contains a JsonElement object with all column values
    if (column != null && value != null) Store.SetColumnFilter(column, value);
    break;
```

To read all filter values from the `filters` map:
```csharp
if (payload.Context?.TryGetValue("filters", out var filtersEl) == true
    && filtersEl.ValueKind == JsonValueKind.Object)
{
    foreach (var prop in filtersEl.EnumerateObject())
        Store.SetColumnFilter(prop.Name, prop.Value.GetString() ?? "");
}
```

### CSS

`.vms-table__filter` is gone. New classes:

| Class | Element |
|---|---|
| `.vms-table__filter-row` | `<tr>` inside `<thead>` holding filter inputs |
| `.vms-table__filter-input` | `<input>` inside each filterable column's header cell |

Non-filterable columns get an empty `<th>` in the filter row to keep column alignment.
