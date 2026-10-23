# PipeIso – Piping Isometric Editor

A lightweight, browser-based editor for drawing **piping isometrics** and exporting them as print-ready A3 sheets.

No installation, no build step, no internet connection needed: just open `index.html` in Chrome, Edge, Firefox or Safari. Works on PCs and on phones and tablets.

## Features

- **Isometric drawing** on isometric paper (lines or dots, or a plain background): East, West, North, South, Up and Down
- **Snapping** to existing points, shown with a green marker and a tag:
  - *Endpoint*: start or finish exactly on an existing pipe end, elbow or tee
  - *On pipe – tee*: start on, or run into, an existing pipe
  - *Aligned*: line the end up with another point
  - *Auto route*: finish on a point that isn't in line, and the connecting pipes and elbows are added for you
- Isometric paper can also be printed on the exported sheet
- **Pipe tool** that snaps to the six iso directions. You can click to place a pipe, or type an exact length in mm and press Enter
- Elbows are created automatically at each change of direction. Starting on an existing pipe creates a **tee**
- **Pipe angles**: 90° only, or 45° and 90°. 45° pipes are drawn in one plane at a time: horizontal, vertical East–West or vertical North–South. Switch the plane with `Tab` or the buttons above the drawing
- **Vacuum pipe standards**: ISO-KF (DN10–DN50) and ISO-K (DN63–DN630), each with its own pipe tool. Sizes are metric (DN); ISO-K pipes are drawn thicker
- **Component categories** in the palette (click a heading to collapse it):
  - Favorites: click ☆ on any item (or long-press it) to pin it here
  - Valves, in sub-groups that open in a slide-out menu: Shut-off (gate, ball, butterfly), Control (globe, needle), Non-return (check), Safety (pressure relief)
  - Flanges: flange pair, single flange, blank flange
  - Reducers: concentric, eccentric
  - Compensators & hoses: bellows, flexible hose
  - Silencers & more: silencer
  - Welds & marks: shop weld, field weld, flow arrow
- **Valves, reducers, bellows and hoses are added into the line** with their own face-to-face length: clicking on a pipe splits it there and the pipe gets longer by the component's length (everything beyond moves along). Deleting a component closes the gap again. Set the length for new components in the bar above the drawing (empty = typical length for the size)
- **Component dimensions**: each of these components gets its own length dimension and a size label (e.g. `DN40`, or `DN40 × DN25` for a reducer). Edit length, nominal size and the reducer's small end with the Edit tool or in the panel
- **Grid snapping**: start points and pipe ends snap to the intersections of the isometric paper (can be switched off in Settings)
- **Outward / inward orientation** for components: the side (stem, lever, flat side, clamp, tie rod) and the direction along the pipe snap to where you click. Flip them with `X` (side) and `C` (direction), or in the panel
- **Edit tool** (`E`): tap or click a pipe to change its length, direction/angle and nominal size, or to add a bend; tap a component to change its type, position and orientation
- **Automatic flanges** at section ends: off, one flange at the start and end of each run, or one flange at both ends of every pipe section
- **Double-click** a pipe end to continue drawing from it. Double-click a label to edit it
- **English and German** interface. Pick the language at the top right; the exported sheet follows it
- **Labels** with leader lines (line numbers, elevations, notes) that you can drag into place
- **Automatic dimensions** for every pipe. You can hide them or move them to the other side for each pipe
- **Edit pipe lengths** after drawing: everything downstream moves with the pipe
- Undo/redo, zoom and pan, and autosave in the browser
- **Title block** (project, line no., spec, material, revision, drawn/checked by, notes)
- **Settings** (gear button): company logo (PNG), company website and creator name for the title block; paper size DIN A4 or A3; your own standard face-to-face lengths per component and nominal size; reducer small end (one or two sizes smaller); all drawing options
- **Export**: PDF file (A4 or A3), PNG (300 dpi), SVG, or print
- **Share** button: send the sheet as PDF / PNG / SVG, or the drawing file, through the phone's or computer's share menu (falls back to a download where sharing isn't supported)
- **Installable web app**: add PipeIso to the home screen or desktop; it then also works offline (see below)
- Save and open drawings as `.pipeiso.json` files

## Getting started

1. Open `index.html` in your browser.
2. Press **P** (Pipe) and click a start point.
3. Move the mouse in the direction you want and click, or type a length such as `1500` and press **Enter**.
4. Press **Esc** or right-click to end the run.
5. Choose a valve or fitting from the left-hand palette and click on a pipe to place it.
6. Click an empty area to fill in the title block in the right-hand panel.
7. Click **Print / PDF** to get the A3 sheet.

## Install as an app (home screen)

Installing needs the app to be served from a web address (https). The easiest way is GitHub Pages:

1. Push this repository to GitHub.
2. On GitHub: *Settings → Pages → Build and deployment*: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
3. Open the address GitHub shows (e.g. `https://<user>.github.io/1st_Project/`).
4. Install it:
   - Chrome / Edge (PC, Android): click **Install app** in PipeIso's top bar, or the install icon in the address bar.
   - iPhone / iPad (Safari): Share → **Add to Home Screen**.

Opened as a file (`index.html` on your computer) the app works the same, but can't be installed.

## On a phone or tablet

- The tools sit in a bar at the bottom; swipe it sideways to see all categories.
- Tap to place points and components. Drag with one finger to pan, pinch with two fingers to zoom.
- Use **Edit** to type exact lengths and angles, and **Finish run** to end a pipe run.
- **Properties** (top bar) opens the title block, settings and the selected item.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` / `E` / `P` / `T` / `H` | Select / Edit / Pipe / Label / Pan |
| `X` / `C` | Flip the selected component's side / direction |
| `G` / `F` / `R` / `B` / `A` | Gate valve / Flange / Reducer / Bellows / Flow arrow |
| `Tab` | Switch the plane for 45° pipes (Pipe tool, 45° enabled) |
| Double-click | Continue from a pipe end / end the current run |
| digits + `Enter` | Exact pipe length while drawing |
| `Esc` | End the run / back to Select |
| `Del` | Delete the selected item |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+S` | Save the drawing file |
| `Ctrl+P` | Print / PDF |
| `Home` | Zoom to fit |
| Mouse wheel / middle-drag / `Space`+drag | Zoom / Pan |

## Project structure

```
index.html        App shell
css/style.css     Styles
js/i18n.js        English and German translations
manifest.webmanifest, sw.js, icons/   Web app (install + offline)
js/core.js        Geometry, iso projection, document model
js/render.js      SVG rendering of the drawing and the A3 sheet
js/export.js      Save/open, SVG/PNG export, print to PDF
js/editor.js      Tools, mouse/keyboard handling, properties panel
```

Coordinates are stored in millimetres (x = East, y = North, z = Up).

## License

GPL-3.0. See [LICENSE](LICENSE).
