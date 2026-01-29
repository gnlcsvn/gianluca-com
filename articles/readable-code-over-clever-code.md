Clever code is tempting. A one-liner that replaces ten lines feels like a win. But every time I revisit clever code after a few months, I spend more time understanding it than I saved writing it.

## What readable code looks like

Readable code is not about comments or documentation (though those help). It's about structure:

- **Clear names.** `getUsersByRole(role)` instead of `get(r, type=2)`.
- **Short functions.** Each function does one thing. If you need a comment to explain what a section does, it should probably be its own function.
- **Linear flow.** Code reads top to bottom. Minimal jumping between files, minimal indirection.
- **Obvious types.** You can look at a variable and know what it contains without tracing it back through three function calls.

## A concrete example

Clever:

```javascript
const r = d.filter(x => x.s > 2).reduce((a, x) => ({...a, [x.id]: x}), {});
```

Readable:

```javascript
const activeItems = data.filter(item => item.score > 2);

const itemsById = {};
for (const item of activeItems) {
  itemsById[item.id] = item;
}
```

The second version is longer but immediately understandable. Anyone on the team can read it, modify it, and debug it without mental overhead.

## The performance argument

"But the clever version is faster!" — Almost never true in a way that matters. Modern JavaScript engines optimize both versions similarly. And even if there's a measurable difference, it only matters if this code runs in a hot loop processing millions of items.

Optimize for readability first. Profile second. Optimize third — and only where the profiler points you.

## When clever is okay

There are situations where a concise, idiomatic expression is actually more readable than the verbose alternative. A well-known pattern like `array.map(fn)` is both concise and clear. The problem isn't conciseness — it's obscurity.

The test: would a new team member understand this code without asking for an explanation?

## Code review as a readability check

Code review is the best readability test. If a reviewer asks "what does this do?", that's a signal. Not that the reviewer is inexperienced, but that the code is too clever.

I've started writing code with the reviewer in mind. Not dumbing it down, but structuring it so the intent is obvious. This usually means:

- Named intermediate variables instead of chained expressions
- Guard clauses instead of nested conditionals
- Explicit iteration instead of complex reduce operations

## The maintenance multiplier

You write code once. You read it dozens of times — during debugging, during reviews, during refactoring, during onboarding. Every minute spent making code clearer saves multiples of that time later.

---

Readable code isn't slower to write. It's slower to type, maybe. But writing code is thinking, and clear code comes from clear thinking.
