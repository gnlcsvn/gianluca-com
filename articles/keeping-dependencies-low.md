Every dependency you add to a project is a trade-off. You gain functionality and save development time, but you take on maintenance burden, security surface area, and cognitive overhead. For small projects, the costs often outweigh the benefits.

## The hidden costs

When you install a package, you're not just adding that package. You're adding:

- Its transitive dependencies (and their dependencies)
- Its release schedule and breaking changes
- Its security vulnerabilities
- Its opinions about how things should work

A `node_modules` folder with 800 packages for a project with 10 direct dependencies is not unusual. Each of those 800 packages is a potential point of failure.

## What I actually need

For most side projects, I need very little from external code:

- **HTTP routing** — the standard library usually handles this
- **Database access** — one driver package
- **Markdown parsing** — one library
- **Date formatting** — built-in language features

That's typically three to four dependencies, not thirty.

## The audit question

A useful heuristic: if I can't read and understand a dependency's source code in an afternoon, it's probably too big for what I need. Small, focused libraries are almost always better than large, feature-rich ones.

## Vendoring and pinning

When I do take on a dependency, I pin the exact version. In Go, this happens automatically with `go.sum`. In JavaScript, I use a lockfile and occasionally vendor critical dependencies directly into the project.

## Writing it yourself

Sometimes the best option is to write the functionality yourself. A simple Markdown-to-HTML converter for a limited subset of Markdown is a few hundred lines of code. A basic HTTP router is even less. You end up with code you fully understand and can modify without waiting for an upstream release.

This isn't about reinventing wheels. It's about honestly evaluating whether the wheel you're importing is the right size for your cart.

---

Fewer dependencies means fewer surprises. For small projects, that trade-off is almost always worth it.
