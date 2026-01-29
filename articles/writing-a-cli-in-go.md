I recently built a small CLI task manager in Go. The goal was simple: a `todo` command that could add, list, complete, and delete tasks stored in a local SQLite database. Here's what I learned along the way.

## Why Go for CLIs

Go compiles to a single static binary. No runtime, no interpreter, no dependency installation on the target machine. You build it, copy it, and run it. For command-line tools that you want to install on multiple machines, this is hard to beat.

The standard library also covers most of what a CLI needs: flag parsing, file I/O, string formatting, HTTP if you need it.

## Project structure

I kept things flat:

```
task-cli/
├── main.go
├── db.go
├── commands.go
└── go.mod
```

Three files plus a module definition. `main.go` handles argument parsing and dispatching, `db.go` manages the SQLite connection, and `commands.go` implements each subcommand.

## Flag parsing without a library

Go's `flag` package is basic but sufficient for simple tools. For subcommands, I used `os.Args` directly:

```go
if len(os.Args) < 2 {
    printUsage()
    os.Exit(1)
}

switch os.Args[1] {
case "add":
    handleAdd(os.Args[2:])
case "list":
    handleList()
case "done":
    handleDone(os.Args[2:])
default:
    printUsage()
    os.Exit(1)
}
```

For more complex CLIs with nested flags, a library like `cobra` makes sense. For four subcommands, a switch statement is fine.

## SQLite in Go

The `modernc.org/sqlite` package provides a pure-Go SQLite driver, which means no CGo and no cross-compilation headaches. The database file lives at `~/.task-cli/tasks.db` and gets created on first run.

## Error handling

Go's explicit error handling felt verbose at first, but it made the CLI more robust. Every database call, every file operation has a clear error path. When something goes wrong, the user gets a useful message instead of a stack trace.

## What I'd do differently

I'd add `--json` output from the start. It's trivial to implement and makes the tool composable with `jq` and other Unix utilities. I only thought of it after the fact.

---

Building small CLIs is a good way to learn a language. The scope is limited, the feedback loop is fast, and you end up with something you actually use.
