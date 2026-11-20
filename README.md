# Kyrven React PDF Viewer

A React component for viewing PDFs in the browser. Hayro parses and rasterizes pages in a web worker using a precompiled Rust/WebAssembly engine. Local documents are processed in the browser.

## Install and render a PDF

In a React application using Vite, install the beta from npm:

```sh
npm install @kyrven/react-pdf-viewer@beta
```

Place a PDF at `public/invoice.pdf`, then render the component:

```tsx
import { PdfViewer } from '@kyrven/react-pdf-viewer'

export default function Invoice() {
  return <PdfViewer src="/invoice.pdf" options={{ height: '75vh' }} />
}
```

Vite packages the worker and WASM automatically. Use a modern browser with module workers, WebAssembly SIMD and Canvas 2D. Serve the worker and WASM from the application origin and configure the server to serve WASM as `application/wasm`.

## Component API

`src` accepts a URL string, URL object, File, Blob or Uint8Array. Cross-origin PDF servers must allow CORS. Changing the source or unmounting the component cancels an active download. Downloads have a 60-second deadline and enforce the configured byte limit while reading.

| Option | Purpose |
| --- | --- |
| `layout` | Initial reading mode, either `continuous` (default) or `single`. |
| `initialZoom` | Initial zoom factor, from 0.25 to 3. |
| `height` | Viewport height as a CSS length or a number of pixels. |
| `toolbar` | Visible controls. Choose from `page`, `zoom` and `settings`. |
| `maxCachedPages` | Maximum number of cached canvases, from 1 to 6. |
| `maxFileBytes`, `maxPages` | Reduce the default limits of 64 MiB and 2,000 pages per document. |

Pass these fields in the `options` prop. The component also accepts `onLoad(pageCount)`, `onPageChange(page)` and `onError(error)`. It displays rasterized pages with zoom and navigation. Text selection, search and interactive forms are outside the current feature set.

## Other bundlers

Import the component from `@kyrven/react-pdf-viewer/static` and run `npx hayro-pdf-assets public/hayro` during deployment. To use a different public directory, pass the target path to the command and its URL to the component as `assetsUrl`.

## Develop and package

Use Node.js 22.13 or later. From the project root:

```sh
npm ci
npm run build
npm pack
```

The React component and its TypeScript adapter live in `src/viewer/`. The Rust adapter is in `engine/src/lib.rs`, the pinned Hayro dependency is in `engine/Cargo.toml`, and the worker is in `engine/web/pdf.worker.mjs`. The npm build copies the checked-in binary from `engine/prebuilt/hayro.wasm` into the generated `dist-lib/engine/` directory. Contributors working only on React do not need a Rust toolchain.

After changing Rust code or dependencies, install the WebAssembly target, rebuild the binary and regenerate the npm package:

```sh
rustup target add wasm32-unknown-unknown
npm run build:engine
npm pack
```

Commit the regenerated binary alongside its source changes. Review the dependency inventory and third-party notices when updating Cargo.lock.

## License

The project is distributed under the [MIT License](LICENSE). Third-party licenses and attributions are included in [THIRD-PARTY](THIRD-PARTY/).

## Publish a release to npm

Run the following commands from a clean, up-to-date main branch after committing and testing your changes. If the Rust engine changed, first rebuild it with `npm run build:engine` and include the updated WASM in your commit.

```sh
npm ci
npm run build
npm version prerelease --preid=beta
npm publish --access public --tag beta
git push origin main --follow-tags
npm view @kyrven/react-pdf-viewer@beta version
```

From 0.4.0-beta.1, this creates version 0.4.0-beta.2 and its Git tag. Complete the npm authentication prompt when publishing. The registry can take a few minutes to make the new version available. Verify it in a separate React application with `npm install @kyrven/react-pdf-viewer@beta`.

For the first stable release in this series, use `npm version 0.4.0` and `npm publish --access public --tag latest`, then push the release commit and tag. Choose patch, minor or major for subsequent stable releases according to the changes.
