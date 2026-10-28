# PipeIso – Piping Isometric Editor

A lightweight, browser-based editor for drawing **piping isometrics** and exporting them as print-ready A3 sheets.

No installation, no build step, no internet connection needed: just open `index.html` in Chrome, Edge, Firefox or Safari. Works on PCs and on phones and tablets.

## Features

- **Isometric drawing** on isometric paper (lines or dots, or a plain background): East, West, North, South, Up and Down. The colour of the paper lines can be chosen in Settings
- **Project name** field next to the compass; it goes into the title block of the exported sheet. The compass can be switched off in Settings; then the north arrow is also left out of the PDF, DXF and print
- **Snapping** to existing points, shown with a green marker and a tag:
  - *Endpoint*: start or finish exactly on an existing pipe end, elbow or tee
  - *On pipe – tee*: start on, or run into, an existing pipe
  - *Aligned*: line the end up with another point
  - *Auto route*: finish on a point that isn't in line, and the connecting pipes and elbows are added for you
- Grid lines (isometric paper) are shown in the export (PDF, DXF and print); they can be switched off in Settings → Export
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
  - Supports: pipe clamp (ring with bolt lugs), weld-on pipe clamp (ring with base plate and fillet welds); flip the side of the lugs / plate with `X`. Each support takes up a width on the pipe (typical: pipe clamp 50 mm, weld-on clamp 20 mm; your own standard widths in Settings → Standard lengths, or per support). Position and width are dimensioned in a chain dimension on the side opposite the pipe's length (e.g. 975 | 50 | 1975); click a number of that chain to change it, or type distance and width in the panel or the edit / long-press box. Supports snap to the snap step like reducers and bellows. Placed near a pipe end (e.g. at an elbow), a support is added into the line there, like a reducer or bellows: the line gets longer by its width, everything beyond moves along, and deleting it closes the gap again. The width of new supports can be set in the bar above the drawing
  - Welds & marks: shop weld, field weld, flow arrow
- **Valves, reducers, bellows and hoses are added into the line** with their own face-to-face length: clicking on a pipe splits it there and the pipe gets longer by the component's length (everything beyond moves along). Deleting a component closes the gap again. Set the length for new components in the bar above the drawing (empty = typical length for the size)
- **Component dimensions**: each of these components gets its own length dimension and a size label (e.g. `DN40`, or `DN40 × DN25` for a reducer). Edit length, nominal size and the reducer's small end with the Edit tool or in the panel
- **Grid snapping**: start points and pipe ends snap to the intersections of the isometric paper (can be switched off in Settings)
- **Outward / inward orientation** for components: the side (stem, lever, flat side, clamp, tie rod) and the direction along the pipe snap to where you click. Flip them with `X` (side) and `C` (direction), or in the panel
- **Edit tool** (`E`): tap or click a pipe to change its length, direction/angle and nominal size, or to add a bend; tap a component to change its type, position and orientation
- **Flanges at pipe ends** (ISO-KF and ISO-K): per pipe no flange, flange at the start, at the end or at both ends (pipe panel or edit / long-press box). The choice for new pipes is set per standard in Settings → Drawing or in the bar above the drawing while the pipe tool is active. Pipes without their own choice follow the automatic rule: off, start and end of each run, or both ends of every pipe section
- **Double-click** a pipe end to continue drawing from it. Double-click a label to edit it
- **English and German** interface. Pick the language at the top right; the exported sheet follows it
- **3D view** (button **3D** next to Settings): the drawing as real tubes with their outside diameter, valves, flanges, reducers, bellows, hoses and supports as simple 3D shapes. View only: drag to turn, wheel or pinch to zoom, right-drag or two fingers to pan; buttons for Iso, Top, Front, Side and Fit. A floor 300 mm below the lowest point with a 500 mm grid; from every elbow a dashed line drops to the floor and ends in a circle. Built with three.js (in `js/vendor`, MIT licence), loaded only when the 3D view is opened and available offline
- **Light and dark mode**: Settings → Display → Appearance (automatic follows the system). Buttons, active tools and the selection use an orange accent colour. The exported sheet (PDF, DXF, print) is always black on white
- **Labels** with leader lines (line numbers, elevations, notes) that you can drag into place
- **Automatic dimensions** for every pipe. One click (or tap) on a dimension moves it to the other side of the pipe; you can also hide it per pipe
- **Angles at elbows**: the true angle between the two pipes is shown with an arc at each elbow (right angles with the usual dot inside the arc, other angles with their value, e.g. 135°), on screen and in the PDF and DXF (layer `ANGLES`); can be switched off in Settings → Drawing
- **Pipe direction** can be changed in the pipe panel and in the Edit / long-press box; it applies at once and everything beyond the pipe moves along
- **Edit pipe lengths** after drawing: everything downstream moves with the pipe
- Undo/redo, zoom and pan, and autosave in the browser. Zooming steps through the standard scales 1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:250, 1:500, 1:1000 and 1:2000 (on screen, at the standard 96 dpi); the current scale is shown and can be picked at the bottom left of the drawing
- **Title block** (project, line no., spec, material, revision, drawn/checked by, notes)
- **Parts list (BOM) with legend** in the notes field of the exported sheet, as a table (Pos., symbol, item, size, quantity): total pipe length per size (and overall), elbows by angle, tees, all components and fittings per size, flanges at pipe ends, the number of flanges in total, supports with their width, welds, and the marks that are only explained (flow arrow, angle marks). Switch in Settings → Export
- **Settings** (gear button): company logo (SVG), company website and creator name for the title block; a **title block template** (client, spec, material, drawn/checked by, notes, …) that new drawings start with; paper size DIN A4 or A3; your own standard face-to-face lengths per component and nominal size; reducer small end (one or two sizes smaller); paper line colour and compass on/off; all drawing options. All settings belong to the app, not to a single drawing: they are kept in this browser and apply to every new drawing and to drawings you open (a drawing file still carries a copy)
- **Settings backup**: export all settings to a `pipeiso-settings.json` file and import them in another browser or on another device
- **Company logo as SVG**: printed sharp in the title block of the PDF and print, and converted to lines on its own layer `LOGO` in the DXF (curves become short straight pieces, filled areas become outlines). The uploaded file is cleaned first: scripts, links to other files and embedded pictures are removed. Tip: convert texts to paths before saving the SVG
- **Export**: PDF file (A4 or A3), DXF file for CAD (the same sheet, in mm, with layers for pipes, components, dimensions, labels, title block, logo and frame), or print
- **Share** button: send the sheet as PDF or DXF, or the drawing file, through the phone's or computer's share menu (falls back to a download where sharing isn't supported)
- **Installable web app**: add PipeIso to the home screen or desktop; it then also works offline (see below)
- Save and open drawings as `.bpi` files (older `.pipeiso.json` files still open)

## Getting started

1. Open `index.html` in your browser.
2. Press **P** (Pipe) and click a start point.
3. Move the mouse in the direction you want and click, or type a length such as `1500` and press **Enter**.
4. Press **Esc**, right-click, or double-click / double-tap to end the run.
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

- The tools sit in a bar at the bottom. The parts are grouped (Pipes, Valves, Flanges, …): tap a group to open its list. Long-press a group and drag it to change the order.
- Long-press a pipe or component to open its edit box (length, nominal size, type).
- Tap to place points and components. Drag with one finger to pan, pinch with two fingers to zoom.
- Use **Edit** to type exact lengths and angles, and double-tap (or **Finish run**) to end a pipe run.
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
| Mouse wheel / `+` / `−` | Zoom to the next standard scale |
| Middle-drag / `Space`+drag | Pan |

## Project structure

```
index.html        App shell
css/style.css     Styles
js/i18n.js        English and German translations
manifest.webmanifest, sw.js, icons/   Web app (install + offline)
js/core.js        Geometry, iso projection, document model
js/render.js      SVG rendering of the drawing and the A3 sheet
js/logo.js        Company logo: cleans uploaded SVG files
js/dxf.js         DXF export (AutoCAD R12) of the sheet
js/export.js      Save/open, PDF and DXF export, print, settings backup
js/editor.js      Tools, mouse/keyboard handling, properties panel
js/view3d.js      3D view (three.js)
js/vendor/        three.js r147 and OrbitControls (MIT, see three-LICENSE.txt)
```

Coordinates are stored in millimetres (x = East, y = North, z = Up).

## License

GPL-3.0. See [LICENSE](LICENSE).
