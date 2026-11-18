# FreeWebWatch

Free, open source, fully customizable web clock with a visual theme editor. Built for [Wave Terminal](https://www.waveterm.dev/) widgets, works in any browser and on any website.

**Live:** https://freewebwatch.vercel.app

Online clocks I found were low quality, tasteless, and charged money for even basic customization. This one is better than all of them, and free.

## Features

- Drag and drop editor: move, resize, snap guides, 9 point anchoring, auto fit. Layouts stay correct at any block size or aspect ratio.
- Elements: digital clock, date, text with live tokens (`{HH:mm}`, `{Z}`), analog dial, shapes (frosted glass), images.
- A time zone per clock, so one scene can show Istanbul, New York and Tokyo side by side.
- Color wheel with alpha, eyedropper, recent colors.
- 1800+ free fonts (Fontsource, includes Google Fonts): search, preview on hover without downloading, download for offline use.
- Effects: glow, shadow, glare sweep, gradients, outline, blend modes, layers. Post processing: Matrix rain, bloom, scanlines, grain, vignette, chromatic aberration, CRT curve and flicker, color grading.
- Presets: Classic, Matrix, Neon, Paper, Analog, Retro CRT, World Clocks.
- Export: Wave Terminal widget entry, single file offline HTML with fonts embedded, iframe, one line script embed, share link, JSON.

## Wave Terminal

Open the editor, press **Export**, copy the `widgets.json` entry (run `wsh editconfig widgets.json` in Wave), save. Or download the offline HTML and point the widget at `file:///path/to/file.html`.

Keys in clock view: `e` editor, `s` seconds, `d` date, `t` next theme.

## Embed

```html
<script src="https://freewebwatch.vercel.app/embed.js" data-theme="THEME_CODE" data-ratio="16/9"></script>
```

`THEME_CODE` comes from the Export dialog. URL modes: `?view=1` clock with hover bar, `?embed=1` bare clock, `?edit=1` editor, `#t=CODE` theme.

## Develop

Everything is one file: `index.html`, no build step. Offline test (all network mocked):

```sh
node test/check.js
```

## License

MIT
