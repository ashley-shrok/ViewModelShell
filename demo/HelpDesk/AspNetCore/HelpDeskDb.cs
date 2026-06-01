namespace HelpDesk;

using Microsoft.Data.Sqlite;

public class HelpDeskDb
{
    private readonly string _connectionString;

    public HelpDeskDb(string connectionString)
    {
        _connectionString = connectionString;
        using var conn = Connect();
        EnsureSchema(conn);
        // 0.15.1 — seed demo data so the canonical "filter narrows under the cap"
        // workflow actually fires when you run the app locally. Idempotent (skips
        // if the table already has rows). Disable in parity (HELPDESK_SEED=0) so
        // the IDs stay stable for the fixture.
        if (Environment.GetEnvironmentVariable("HELPDESK_SEED") != "0")
            SeedDemoData(conn);
    }

    private SqliteConnection Connect()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    private static void EnsureSchema(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS tickets (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT NOT NULL,
                type         TEXT NOT NULL,
                priority     TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'open',
                description  TEXT,
                due_date     TEXT,
                device_model TEXT,
                application  TEXT,
                system_name  TEXT,
                access_level TEXT,
                created_at   TEXT NOT NULL,
                resolved_at  TEXT,
                agent_notes  TEXT
            )";
        cmd.ExecuteNonQuery();
    }

    public List<Ticket> GetAll(string? status = null)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        if (status != null)
        {
            cmd.CommandText = "SELECT * FROM tickets WHERE status = @status ORDER BY created_at DESC";
            cmd.Parameters.AddWithValue("@status", status);
        }
        else
        {
            cmd.CommandText = "SELECT * FROM tickets ORDER BY created_at DESC";
        }
        using var reader = cmd.ExecuteReader();
        var list = new List<Ticket>();
        while (reader.Read()) list.Add(Map(reader));
        return list;
    }

    // 0.12.0/#16: server-side pagination for the agent queue. Ordered by
    // created_at DESC then id DESC (a total order, so the page boundaries are
    // deterministic and match the bun twin row-for-row).
    public List<Ticket> GetPage(string? status, int limit, int offset)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = status != null
            ? "SELECT * FROM tickets WHERE status = @status ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset"
            : "SELECT * FROM tickets ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset";
        if (status != null) cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@limit",  limit);
        cmd.Parameters.AddWithValue("@offset", offset);
        using var reader = cmd.ExecuteReader();
        var list = new List<Ticket>();
        while (reader.Read()) list.Add(Map(reader));
        return list;
    }

    public int Count(string? status)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = status != null
            ? "SELECT COUNT(*) FROM tickets WHERE status = @status"
            : "SELECT COUNT(*) FROM tickets";
        if (status != null) cmd.Parameters.AddWithValue("@status", status);
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    // 0.15.1 — canonical workflow pattern: combined status + title-text filter.
    // Used by AgentController to (a) count for the cap check and (b) fetch the
    // matching rows when count <= cap.
    public int CountMatching(string? status, string titleFilter)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        var where = BuildWhere(status, titleFilter, cmd);
        cmd.CommandText = $"SELECT COUNT(*) FROM tickets{where}";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public List<Ticket> GetMatching(string? status, string titleFilter, int limit)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        var where = BuildWhere(status, titleFilter, cmd);
        cmd.CommandText = $"SELECT * FROM tickets{where} ORDER BY created_at DESC, id DESC LIMIT @limit";
        cmd.Parameters.AddWithValue("@limit", limit);
        using var reader = cmd.ExecuteReader();
        var list = new List<Ticket>();
        while (reader.Read()) list.Add(Map(reader));
        return list;
    }

    // Shared WHERE construction. Title filter uses LIKE %text% (case-insensitive
    // because SQLite's LIKE is by default; same semantic as JS includes() so the
    // bun twin matches row-for-row when seeded identically).
    private static string BuildWhere(string? status, string titleFilter, SqliteCommand cmd)
    {
        var clauses = new List<string>();
        if (status != null) { clauses.Add("status = @status"); cmd.Parameters.AddWithValue("@status", status); }
        if (!string.IsNullOrEmpty(titleFilter)) { clauses.Add("title LIKE @titleFilter"); cmd.Parameters.AddWithValue("@titleFilter", $"%{titleFilter}%"); }
        return clauses.Count == 0 ? "" : " WHERE " + string.Join(" AND ", clauses);
    }

    private static void SeedDemoData(SqliteConnection conn)
    {
        using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT COUNT(*) FROM tickets";
            if (Convert.ToInt32(check.ExecuteScalar()) > 0) return;  // idempotent
        }

        // ~80 demo tickets: 35 open / 22 in-progress / 23 resolved. Distribution
        // chosen so the "All" tab and "Open" tab both exceed a cap of 25
        // (forcing the narrow-your-filter message), while "In Progress" and
        // "Resolved" fit under the cap (forcing the filter-then-select flow).
        string[] titles = [
            "Laptop won't boot",          "VPN client crashes on login",  "Email rules not applying",
            "Outlook search index corrupt", "Slow file server response",  "Printer driver missing",
            "Monitor displays artifacts", "Keyboard keys stuck",          "Webcam not detected",
            "Headset audio cutting out",  "Excel macros disabled",        "Teams meetings drop randomly",
            "OneDrive sync stuck",        "Browser bookmarks lost",       "Disk space low warning",
            "New laptop request",         "Add user to billing group",    "Reset password — Salesforce",
            "Increase file share quota",  "Mobile device enrollment",     "Two-factor enrollment failing",
            "Software install — Figma",   "License renewal — Adobe CC",   "Software update fails — Office",
            "Hardware refresh — desktop", "Phone hand-off issue",         "Bluetooth pairing fails",
        ];
        string[] types = ["hardware", "software", "access"];
        string[] priorities = ["low", "medium", "medium", "high", "critical"];
        (int count, string status)[] distribution = [(35, "open"), (22, "in-progress"), (23, "resolved")];

        using var tx = conn.BeginTransaction();
        using var ins = conn.CreateCommand();
        ins.Transaction = tx;
        ins.CommandText = @"
            INSERT INTO tickets (title, type, priority, status, created_at)
            VALUES (@title, @type, @priority, @status, @createdAt)";
        var pTitle    = ins.Parameters.Add("@title",     Microsoft.Data.Sqlite.SqliteType.Text);
        var pType     = ins.Parameters.Add("@type",      Microsoft.Data.Sqlite.SqliteType.Text);
        var pPriority = ins.Parameters.Add("@priority",  Microsoft.Data.Sqlite.SqliteType.Text);
        var pStatus   = ins.Parameters.Add("@status",    Microsoft.Data.Sqlite.SqliteType.Text);
        var pCreated  = ins.Parameters.Add("@createdAt", Microsoft.Data.Sqlite.SqliteType.Text);

        var now = DateTime.UtcNow;
        var idx = 0;
        foreach (var (count, status) in distribution)
        {
            for (var i = 0; i < count; i++)
            {
                var baseTitle = titles[idx % titles.Length];
                pTitle.Value    = idx < titles.Length ? baseTitle : $"{baseTitle} (#{idx - titles.Length + 2})";
                pType.Value     = types[idx % types.Length];
                pPriority.Value = priorities[idx % priorities.Length];
                pStatus.Value   = status;
                pCreated.Value  = now.AddHours(-idx).ToString("o");
                ins.ExecuteNonQuery();
                idx++;
            }
        }
        tx.Commit();
    }

    public Ticket? GetById(long id)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM tickets WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? Map(reader) : null;
    }

    public long Create(string title, string type, string priority, string? description,
        string? dueDate, string? deviceModel, string? application, string? systemName, string? accessLevel)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO tickets
                (title, type, priority, status, description, due_date,
                 device_model, application, system_name, access_level, created_at)
            VALUES
                (@title, @type, @priority, 'open', @description, @due_date,
                 @device_model, @application, @system_name, @access_level, @created_at);
            SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@title",        title);
        cmd.Parameters.AddWithValue("@type",         type);
        cmd.Parameters.AddWithValue("@priority",     priority);
        cmd.Parameters.AddWithValue("@description",  (object?)description  ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@due_date",     (object?)dueDate      ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@device_model", (object?)deviceModel  ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@application",  (object?)application  ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@system_name",  (object?)systemName   ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@access_level", (object?)accessLevel  ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@created_at",   DateTime.UtcNow.ToString("o"));
        return (long)cmd.ExecuteScalar()!;
    }

    public void UpdateStatus(long id, string status)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        if (status == "resolved")
        {
            cmd.CommandText = "UPDATE tickets SET status = @status, resolved_at = @now WHERE id = @id";
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
        }
        else
        {
            cmd.CommandText = "UPDATE tickets SET status = @status, resolved_at = NULL WHERE id = @id";
        }
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@id",     id);
        cmd.ExecuteNonQuery();
    }

    public void UpdateAgentNotes(long id, string? notes)
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE tickets SET agent_notes = @notes WHERE id = @id";
        cmd.Parameters.AddWithValue("@notes", (object?)notes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@id",    id);
        cmd.ExecuteNonQuery();
    }

    public (int open, int inProgress, int resolved) GetCounts()
    {
        using var conn = Connect();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT
                COALESCE(SUM(CASE WHEN status = 'open'        THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status = 'resolved'    THEN 1 ELSE 0 END), 0)
            FROM tickets";
        using var reader = cmd.ExecuteReader();
        reader.Read();
        return (reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2));
    }

    private static Ticket Map(SqliteDataReader r)
    {
        string? Opt(string col) => r.IsDBNull(r.GetOrdinal(col)) ? null : r.GetString(r.GetOrdinal(col));
        return new Ticket(
            Id:          r.GetInt64(r.GetOrdinal("id")),
            Title:       r.GetString(r.GetOrdinal("title")),
            Type:        r.GetString(r.GetOrdinal("type")),
            Priority:    r.GetString(r.GetOrdinal("priority")),
            Status:      r.GetString(r.GetOrdinal("status")),
            Description: Opt("description"),
            DueDate:     Opt("due_date"),
            DeviceModel: Opt("device_model"),
            Application: Opt("application"),
            SystemName:  Opt("system_name"),
            AccessLevel: Opt("access_level"),
            CreatedAt:   r.GetString(r.GetOrdinal("created_at")),
            ResolvedAt:  Opt("resolved_at"),
            AgentNotes:  Opt("agent_notes")
        );
    }
}
