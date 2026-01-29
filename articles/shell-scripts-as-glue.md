I have a collection of small shell scripts that save me a few minutes each day. Individually they're trivial. Collectively, they automate away a significant amount of repetitive work.

## The philosophy

Shell scripts are glue. They connect existing tools in useful ways. A good shell script doesn't reimagine the wheel — it chains together `grep`, `awk`, `curl`, `jq`, and whatever else is already on the system.

The moment a shell script needs arrays, associative data structures, or error handling beyond `set -e`, it's time to rewrite it in Python or Go.

## Example: Project setup

I have a script that creates a new project directory with my standard structure:

```bash
#!/bin/bash
set -e

name="$1"
if [ -z "$name" ]; then
  echo "Usage: newproject <name>"
  exit 1
fi

mkdir -p "$name"/{src,tests,docs}
cd "$name"
git init
echo "# $name" > README.md
echo "node_modules/" > .gitignore
git add -A && git commit -m "Initial commit"
echo "Created project: $name"
```

It saves maybe two minutes. But I create new projects often enough that those minutes add up.

## Example: Quick server log search

```bash
#!/bin/bash
# Search recent logs for a pattern, showing context
journalctl --since "1 hour ago" | grep -i "$1" -C 3
```

## Example: Git cleanup

```bash
#!/bin/bash
# Delete local branches that have been merged into main
git branch --merged main | grep -v "main" | xargs -r git branch -d
```

## Where to put them

I keep scripts in `~/.local/bin/`, which is on my `PATH`. Each script is named descriptively: `newproject`, `loggrep`, `git-cleanup`. No file extensions — they behave like regular commands.

## Making them robust

A few habits that prevent headaches:

- Always start with `set -e` so the script stops on the first error
- Quote all variables: `"$name"` not `$name`
- Use `"$@"` to pass arguments through to other commands
- Add a usage message when required arguments are missing

## When to graduate to a real language

If the script:

- Is longer than ~50 lines
- Needs to parse JSON or YAML (beyond simple `jq` one-liners)
- Manages complex state
- Needs to handle errors gracefully

...then it's time for Python or Go. Shell scripts should stay short and simple. The moment they become clever, they become unmaintainable.

---

Shell scripts aren't glamorous, but they're one of the most practical things a developer can learn to write well.
