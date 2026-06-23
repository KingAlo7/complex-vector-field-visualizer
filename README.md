# Complex Vector Field Visualizer

An interactive React + Canvas tool for exploring complex functions f(z) as vector fields, with three different ways of mapping a complex plane onto a 2D picture:

- **Mixed-Axis (x, u → y, v)** — position is `(Re(z), Re(f(z)))`; the vector drawn at each point is `(Im(z), Im(f(z)))` for every valid branch. This reveals **voids** (points with no real solution) and **multi-valued regions** (multiple branches landing on the same `(x, u)` point).
- **Pólya Vector Field (x, y → u, -v)** — the classic construction that turns a holomorphic function into a divergence-free, curl-free ideal fluid flow.
- **Direct Field (x, y → u, v)** — the naive mapping of input position to output vector.

Includes a live particle-flow animation mode and a custom function parser (supports `z`, `i`, `+ - * / ^`, and `sin`, `cos`, `exp`).

## Built-in functions

- `f(z) = z²`
- `f(z) = z³`
- `f(z) = eᶻ`
- Custom expressions, e.g. `z^2 + i*z`

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

### Build for production

```bash
npm run build
npm run preview
```

## Stack

- React 18
- Vite 6
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Canvas 2D API for rendering (no charting library — all vector math and drawing is hand-rolled)

## Notes

- The custom function parser is a small shunting-yard expression evaluator over a hand-written `Complex` number class — it is intentionally minimal and not meant to handle arbitrary malformed input gracefully.
- For "Mixed-Axis" mode with built-in functions, branch solutions are found analytically. For custom functions, branches are found numerically via root-finding over `y ∈ [-10, 10]`, so highly oscillatory custom functions may miss roots or run slower.
