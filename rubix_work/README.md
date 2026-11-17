# Simple Rubix Cube

An interactive, responsive Three.js cube experiment with 1–10 layers, slice rotations, drag gestures, history, undo/redo, and scrambling.

## Run

Serve this directory over HTTP because browser ES modules do not run reliably from `file://` URLs. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. You can also use VS Code Live Server or `npm start` (requires Node.js and access to `serve`). Three.js is loaded from a CDN, so internet access is required.

## Structure

```text
index.html                 HTML structure and the Three.js import map
styles/style.css           Page layout, controls, and responsive styles
src/main.js               App coordination, cube state, gestures, animations, UI
src/config.js             Shared cube settings, axes, and sticker colors
src/scene/createScene.js  Scene, camera, orbit controls, lights, WebGL assets
src/cube/cubeMath.js      Pure grid/orientation rotation algorithms
tests/cubeMath.test.js     Unit tests for reversible cube transformations
```

## Test

```bash
npm test
```

## Architectural decisions

- **No build step or framework:** native ES modules keep the experiment easy to run and integrate elsewhere.
- **Pure cube math:** rotation rules can be tested independently of rendering.
- **Scene factory:** Three.js renderer setup stays out of the main interaction code.
- **Single application coordinator:** UI wiring and gesture/animation state currently remain in one place to avoid premature layers of abstractions.
- **Future extension:** when the portfolio cards are implemented, add a `src/data/projects.js` module and a `src/ui/` folder rather than overloading cube geometry.

The existing cube interactions and visual design are retained. The refactor does not add a storefront, routing system, or project database.
