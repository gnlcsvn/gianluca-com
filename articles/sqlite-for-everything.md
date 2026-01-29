I use SQLite in almost every side project. Not because it's the best database for every situation, but because it removes an entire category of decisions and setup from the early stages of a project.

## No server, no configuration

SQLite is a library, not a service. There's no daemon to start, no port to configure, no connection string to manage. Your database is a single file. You can copy it, back it up, or inspect it with the `sqlite3` CLI.

```bash
sqlite3 myapp.db ".tables"
sqlite3 myapp.db "SELECT * FROM tasks LIMIT 10"
```

This makes development and debugging dramatically simpler.

## It scales further than you think

SQLite handles reads at extraordinary speed. For write-heavy workloads it's limited by its single-writer model, but most side projects and internal tools are read-heavy. A personal blog, a task manager, a local analytics collector — SQLite handles all of these without breaking a sweat.

The common wisdom that SQLite is "only for prototypes" is outdated. It powers production systems serving millions of requests.

## The schema is your documentation

When the entire database is one file and you define the schema in a few `CREATE TABLE` statements, the schema becomes self-documenting. I keep a `schema.sql` file in every project:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    name TEXT NOT NULL
);
```

That's the entire data model, readable at a glance.

## When not to use it

SQLite isn't the right choice when you need:

- Multiple processes writing concurrently at high volume
- Network access from multiple machines
- Built-in replication

For those cases, PostgreSQL is my go-to. But I reach for it far less often than I used to.

## Practical tip

Enable WAL mode for better concurrent read performance:

```sql
PRAGMA journal_mode=WAL;
```

One line, measurable improvement.

---

SQLite is boring technology in the best sense. It works, it's reliable, and it gets out of your way.
