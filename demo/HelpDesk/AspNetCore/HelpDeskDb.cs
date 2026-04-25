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
