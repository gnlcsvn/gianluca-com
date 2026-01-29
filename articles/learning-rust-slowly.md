I've been learning Rust on and off for about a year. My approach is deliberately slow: I build small, self-contained programs and throw most of them away. Here's why that works for me.

## Why slow

Rust has a steep learning curve. Ownership, borrowing, lifetimes — these concepts don't exist in most other languages I use. Trying to learn them all at once while building something ambitious leads to frustration.

Instead, I pick one concept per project. A DNS lookup tool to learn networking and error handling. A file search utility to understand iterators and pattern matching. A small HTTP server to work with async.

Each project is small enough to finish in a weekend.

## What I've built

Most of these are throwaway programs. They work, but they're not polished:

- **A word counter** — my first Rust program. Reads stdin, counts words. Learned basic I/O and string handling.
- **A file deduplicator** — walks a directory tree, hashes files, reports duplicates. Learned the standard library's filesystem APIs.
- **A DNS client** — sends raw DNS queries over UDP. Learned byte-level protocol handling and `Result` patterns.
- **A Markdown linter** — checks Markdown files for common issues. Learned string parsing without regex.

## The borrow checker

The borrow checker is Rust's most talked-about feature and the biggest hurdle for newcomers. My advice: don't fight it. When the compiler rejects your code, it's usually telling you about a genuine design problem.

Early on, I used `.clone()` everywhere to make the compiler happy. Over time, I've learned to structure data so cloning isn't needed. That progression felt natural and didn't require reading a textbook.

## What I like about Rust

- **Pattern matching** with `match` is excellent. It's exhaustive, so the compiler tells you when you've missed a case.
- **The type system** catches entire categories of bugs at compile time.
- **Cargo** is the best build tool and package manager I've used in any language.
- **The compiled binary** is fast and has no runtime dependencies.

## What's still hard

- **Async Rust** is significantly more complex than sync Rust. The ecosystem is powerful but the learning curve is steep.
- **Lifetimes** still trip me up in complex data structures. I avoid them when possible by using owned types.
- **Compile times** are slow compared to Go. For small projects it doesn't matter much, but it's noticeable.

## My recommendation

If you're curious about Rust, start with a command-line tool that processes text or files. Don't start with a web server or anything async. Get comfortable with ownership and the standard library first. The rest follows.

---

There's no rush to learn everything. Small programs, repeated practice, and patience get you further than any tutorial.
