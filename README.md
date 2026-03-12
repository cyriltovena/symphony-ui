# Symphony UI

Standalone React observability UI for Symphony, using the Halo theme and a repo-local Pencil design source.

## Stack

- React 19
- TypeScript
- Vite
- `react-router-dom`
- `lucide-react`
- Vitest + Testing Library
- Pencil `.pen` document in [`design/symphony-observability.pen`](/Users/cyriltovena/work/symphony-ui/design/symphony-observability.pen)

## Local development

1. Start the Symphony runtime so the API is available on `http://127.0.0.1:4041`.
2. Install the repo toolchain with `mise install`.
3. Install project dependencies with `mise run install`.
4. Start the frontend with `mise run dev`.

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:4041`, so no extra CORS setup is needed for local work.

## Mise tasks

- `mise run install`
- `mise run dev`
- `mise run lint`
- `mise run test`
- `mise run build`
- `mise run check`

If you want the raw npm equivalents, the underlying scripts still exist in `package.json`.

## Implemented views

- `/` overview dashboard
- `/issues/:issueIdentifier` issue detail

Both views poll the current Symphony API and respond to the shared manual refresh action in the app shell.

## Design source

The project keeps a repo-local Pencil document at [`design/symphony-observability.pen`](/Users/cyriltovena/work/symphony-ui/design/symphony-observability.pen).

Current design coverage:

- Overview dashboard shell
- Issue detail shell
- Halo Light/Dark token mapping

The React token layer in [`src/styles/tokens.css`](/Users/cyriltovena/work/symphony-ui/src/styles/tokens.css) mirrors the Halo values used by the UI.
