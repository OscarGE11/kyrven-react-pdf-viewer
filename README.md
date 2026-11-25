# Kyrven React PDF Viewer

[Website & live demo](https://kyrven-pdf.pages.dev) · [Documentation](https://kyrven-pdf.pages.dev/docs/)

A React component for viewing PDFs in the browser. Hayro parses and rasterizes pages in a web worker using a precompiled Rust/WebAssembly engine. Local documents are processed in the browser.

## Install and render a PDF

Install the viewer in your React or Next.js application:

```sh
npm install @kyrven/react-pdf-viewer
```

Place a PDF at `public/invoice.pdf`, then render the component:

```tsx
import { PdfViewer } from '@kyrven/react-pdf-viewer'

export default function Invoice() {
  return <PdfViewer src="/invoice.pdf" options={{ height: '75vh' }} />
}
```

The main entry point uses static `new URL(..., import.meta.url)` references so Next.js and compatible bundlers can emit the worker and WASM automatically. Use a browser with module workers, WebAssembly SIMD and Canvas 2D. The WASM must be served from the application origin with the `application/wasm` content type.

For Vite 7 development, exclude the viewer from dependency pre-bundling so Vite resolves the URLs relative to the installed package:

```js
export default {
  optimizeDeps: {
    exclude: ['@kyrven/react-pdf-viewer'],
    include: ['react/jsx-runtime'],
  },
}
```

## Component API

`src` accepts a URL string, URL object, File, Blob or Uint8Array. Cross-origin PDF servers must allow CORS. Changing the source or unmounting the component cancels an active download. Downloads have a 60-second deadline and enforce the configured byte limit while reading.

| Option | Purpose |
| --- | --- |
| `layout` | Initial reading mode, either `continuous` (default) or `single`. |
| `initialZoom` | Initial zoom factor from 0.25 to 3, or `"fit-width"` / `"fit-page"`. Fit follows viewport size and page orientation. |
| `initialRotation` | Initial clockwise rotation in degrees. Accepts 0, 90, 180 or 270. |
| `height` | Viewport height as a CSS length or a number of pixels. |
| `toolbar` | Visible controls. The default includes `page`, `zoom`, `fit`, `rotate`, `settings` and `download`. |
| `maxCachedPages` | Maximum number of cached canvases, from 1 to 6. |
| `maxFileBytes`, `maxPages` | Reduce the default limits of 64 MiB and 2,000 pages per document. |
| `theme` | Use `light` (default), `dark`, `system` or `custom`. A saved reader preference takes precedence unless the application sets `custom`. |
| `rememberTheme` | Defaults to `true`. Set to `false` to use the application's `theme` without the stored preference or the reader's theme controls. |
| `accentColor` | Initial custom accent in hexadecimal, for example `#7464D8`. Accepts three or six digits. |
| `downloadName` | Optional filename for the downloaded PDF. Defaults to the source filename or `documento.pdf`. |

Pass these fields in the `options` prop. Readers can change the layout from the Options button and choose light, dark or system appearance when the application allows it. The viewer remembers the preference for the current site in the browser. System appearance follows the browser color scheme and updates when it changes. Set `theme: "custom"` and `accentColor` in code to use your own palette. The download button saves the original PDF bytes. The component also accepts `onLoad(pageCount)`, `onPageChange(page)` and `onError(error)`. It displays rasterized pages with zoom and navigation. Text selection, search and interactive forms are outside the current feature set.

## PDF and image viewer

Use `DocumentViewer` for PDFs, JPEG, PNG, WebP and GIF. It detects the format from the file header or MIME type and uses the browser to decode images, including EXIF orientation. Images use the same rotation, zoom, fit and download controls as PDFs. Animated GIFs display a still frame. The download preserves the original file.

```tsx
import { DocumentViewer } from '@kyrven/react-pdf-viewer'

<DocumentViewer
  src={file}
  options={{ initialZoom: 'fit-page', theme: 'light', rememberTheme: false }}
  labels={{
    openingDocument: 'Opening document…',
    downloadPdf: 'Download PDF',
    downloadImage: 'Download image',
    rotateRight: 'Rotate clockwise',
    pageImage: page => `Page ${page}`,
  }}
/>
```

Both viewers accept partial `ViewerLabels` overrides, including button and accessibility labels. Omitted labels use the Spanish defaults. Pass an `error` formatter to customize the alert text. The original error remains available through `onError`. In the Next.js App Router, provide formatter functions from a Client Component.

## Self-hosted engine assets

If you manage static assets yourself, import either component from `@kyrven/react-pdf-viewer/static` and run `npx hayro-pdf-assets public/hayro` during deployment. To use a different public directory, pass the target path to the command and its URL to the component as `assetsUrl`.

## Develop and package

Use Node.js 22.13 or later. From the project root:

```sh
npm ci
npm run build
npm pack
```

The React component and its TypeScript adapter live in `src/viewer/`. The Rust adapter is in `engine/src/lib.rs`, the pinned Hayro dependency is in `engine/Cargo.toml`, and the worker is in `engine/web/pdf.worker.mjs`. The npm build copies the checked-in binary from `engine/prebuilt/hayro.wasm` into the generated `dist-lib/engine/` directory. Contributors working only on React do not need a Rust toolchain.

After changing Rust code or dependencies, install the WebAssembly target and put [Binaryen's `wasm-opt`](https://github.com/WebAssembly/binaryen/releases/tag/version_132) on your PATH (the checked-in binary was optimized with version 132). The engine build runs the optimizer before replacing the checked-in WASM. Set `WASM_OPT` to use a specific executable.

```sh
rustup target add wasm32-unknown-unknown
npm run build:engine
npm pack
```

Commit the regenerated binary alongside its source changes. Review the dependency inventory and third-party notices when updating Cargo.lock.

## License

The project is distributed under the [MIT License](LICENSE). Third-party licenses and attributions are included in [THIRD-PARTY](THIRD-PARTY/).

## Publish a release to npm

Prepare the release from an up-to-date main branch. Choose a patch, minor or major version according to the changes. If the Rust engine changed, rebuild it and include the updated WASM.

Install the dependencies, update the version and run `npm pack`. Install the resulting tarball in a separate React application and check the viewer in Vite development and production.

Commit the version and source changes, then create and push the matching Git tag. Publish the tested tarball with `npm publish <tarball> --access public --tag latest` and confirm the public version with `npm view @kyrven/react-pdf-viewer@latest version`.
