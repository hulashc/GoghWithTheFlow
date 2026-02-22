# GoghWithTheFlow

Embeddable static widget (v1) for “Van Gogh vs contemporaries” analysis + three.js compare viewer.

## Embed (static website)
After building, copy everything from `dist/` to your static site and embed the viewer page with an iframe:

```html
<iframe
  src="/goghwiththeflow/index.html"
  style="width:100%;height:760px;border:0"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
```

Or host `dist/` somewhere else and point the iframe `src` at that URL.

## Local dev
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
```

## Data pipeline (v1)
- `npm run collect:met` → writes `public/data/artworks.json`
- `npm run download:images` → downloads into `public/data/images/`
- `npm run compute:features` → writes `public/data/features.json` and overlays into `public/data/overlays/`

## Notes
- Keep everything under `public/` so the built widget stays fully static.
