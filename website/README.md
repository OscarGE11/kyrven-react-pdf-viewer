# Kyrven website

English product landing page and documentation for `@kyrven/react-pdf-viewer`.
Built with Astro, React, Tailwind CSS, Radix Tabs and Lucide icons. Fonts are self-hosted.

## Develop

```sh
cd website
npm ci
npm run dev
```

Open the URL printed by Astro. The homepage includes a working PDF demo and `/docs/` contains the integration guide and API reference.

The website includes a project-local Node.js runtime to support current Astro on machines with older Node installations. It does not change the system Node version or the library's runtime requirements.

## Build and deploy

```sh
npm run build
npm run preview
```

Deploy `dist/` to a static host at the domain root. The postinstall step copies the worker and WASM into `public/hayro/`; ensure the host serves `.wasm` as `application/wasm`. No server or upload service is required. Local files remain in the visitor's browser.

The website depends on the published viewer version 0.6.0. After updating that dependency, run `npm install` to refresh engine assets. Its dependencies and lockfile are independent from the library.

## Verification

Run `npm run build` and then `npm test`. The Playwright tests use an installed Google Chrome and start/stop the static preview automatically. They check WASM page rendering, navigation, rotation, zoom, local file loading, tabs, documentation and mobile overflow. Screenshots are written to the ignored `test-results/` directory.

## Sample document source

`public/sample.pdf` is an original three-page demonstration document. Regenerate it with `python scripts/create-sample.py` after installing Python's `reportlab` package. Python is not required to build or run the website.
