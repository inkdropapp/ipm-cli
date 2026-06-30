# __package-name__

A short description of your Inkdrop **theme** — a single theme that styles the app UI, the editor syntax, and the Markdown preview.

![Screenshot of __package-name__](./docs/screenshot.png)

<!-- Add your screenshot at docs/screenshot.png and reference it with a RELATIVE path
     (./docs/screenshot.png), not an absolute URL. The Inkdrop plugins website renders
     this README, and a relative path ships the image inside your package instead of
     loading it from a third-party server. -->

## How to install

```sh
ipm install __package-name__
```

Then enable it in **Preferences → Themes**.

## Development

```sh
npm install
ipm link   # symlink into your Inkdrop data dir for local testing
```

Edit the stylesheets in `styles/` — `ui.css` (app chrome), `syntax.css` (editor),
and `preview.css` (Markdown preview), each wrapped in its `@layer` — then reload
Inkdrop to see your changes.

`palette.json` is generated automatically on publish — `ipm publish` runs
`generate-palette` via the `prepublishOnly` script, so you don't commit it by hand.
