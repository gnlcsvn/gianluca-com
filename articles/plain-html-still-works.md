Every few months a new framework appears, and the discourse restarts: is it finally time to abandon plain HTML? I don't think so. For a large class of projects — personal sites, documentation, internal tools — vanilla HTML, CSS, and JavaScript remain the best choice.

## The case for no framework

Frameworks solve real problems: state management, component reuse, routing. But those problems only matter at a certain scale. A personal website with five pages and a JSON data file doesn't need a virtual DOM.

When you write plain HTML:

- There is no build step. You edit a file and refresh the browser.
- There are no dependencies to update or audit.
- The output is exactly what you wrote. No generated code, no runtime overhead.
- It will still work in ten years.

## Where it breaks down

If your project has complex interactive state — a drag-and-drop editor, a real-time dashboard, a multi-step form with validation — you'll want a framework. The line is usually around the point where you start managing more than two or three pieces of related state.

## A middle ground

You can use plain HTML for structure and sprinkle in small libraries where needed. A Markdown parser here, a chart library there. This gives you the simplicity of static HTML with targeted interactivity.

```html
<script src="/lib/marked.min.js"></script>
<script>
  const content = await fetch('/articles/my-post.md');
  const html = marked.parse(await content.text());
  document.getElementById('article').innerHTML = html;
</script>
```

No bundler required.

## The real benefit

The real benefit isn't performance or bundle size — it's cognitive overhead. When I open a plain HTML project after six months, I understand it immediately. There's nothing to remember about configuration, project structure conventions, or lifecycle hooks.

Plain HTML still works. For many projects, it works better than the alternative.
