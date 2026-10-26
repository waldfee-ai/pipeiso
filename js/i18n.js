/* PipeIso – translations (English / German). */
(function () {
  'use strict';
  const ISO = (window.ISO = window.ISO || {});

  const en = {
    'app.title': 'PipeIso – Piping Isometric Editor',
    'btn.new': 'New', 'tip.new': 'New drawing',
    'btn.open': 'Open…', 'tip.open': 'Open a drawing file (.bpi)',
    'btn.save': 'Save', 'tip.save': 'Save drawing as file (Ctrl+S)',
    'btn.undo': 'Undo', 'tip.undo': 'Undo (Ctrl+Z)',
    'btn.redo': 'Redo', 'tip.redo': 'Redo (Ctrl+Y)',
    'btn.fit': 'Fit', 'tip.fit': 'Zoom to fit (Home)',
    'lbl.export': 'Export',
    'tip.dxf': 'Download the sheet as a DXF file for CAD (paper size in Settings)',
    'btn.print': 'Print / PDF', 'tip.print': 'Print the sheet (Ctrl+P)',
    'tip.lang': 'Language',

    'grp.draw': 'Draw', 'grp.Valves': 'Valves', 'grp.Fittings': 'Fittings',
    'tool.select': 'Select', 'tool.pipe': 'Pipe', 'tool.label': 'Label', 'tool.pan': 'Pan',

    'fit.gate': 'Gate valve', 'fits.gate': 'Gate',
    'fit.globe': 'Globe valve', 'fits.globe': 'Globe',
    'fit.ball': 'Ball valve', 'fits.ball': 'Ball',
    'fit.check': 'Check valve', 'fits.check': 'Check',
    'fit.butterfly': 'Butterfly valve', 'fits.butterfly': 'Butterfly',
    'fit.flange': 'Flange pair', 'fits.flange': 'Flange',
    'fit.reducer': 'Concentric reducer', 'fits.reducer': 'Reducer',
    'fit.bellows': 'Bellows (expansion joint)', 'fits.bellows': 'Bellows',
    'fit.hose': 'Flexible hose', 'fits.hose': 'Hose',
    'fit.weld': 'Shop weld', 'fits.weld': 'Weld',
    'fit.fieldweld': 'Field weld', 'fits.fieldweld': 'Field weld',
    'fit.flow': 'Flow arrow', 'fits.flow': 'Flow',

    'dir.E': 'East', 'dir.W': 'West', 'dir.N': 'North', 'dir.S': 'South', 'dir.U': 'Up', 'dir.D': 'Down',
    'cmp.E': 'E', 'cmp.N': 'N', 'cmp.U': 'Up',
    'coord': 'E {e}  N {n}  EL {z}',

    'plane.axes': '90°', 'plane.h': '45° horizontal', 'plane.xz': '45° vertical E–W', 'plane.yz': '45° vertical N–S',
    'tip.plane': 'Plane for 45° pipes (Tab switches)',

    'st.select': 'Click to select · X / C flip a selected component · double-click a pipe end to continue drawing · drag fittings and labels to move them · <b>Del</b> deletes · wheel zooms · middle-drag or Space+drag pans',
    'st.pipeStart': 'Click or tap a start point: empty space, an existing point (snaps), or on a pipe (makes a tee)',
    'st.pipeRun': '<b>{dir} {len} mm</b> — click to place, or type a length and press <b>Enter</b> · <b>Esc</b>, right-click or double-click ends the run',
    'st.pipeRoute': '<b>Connect to point with {n} pipes</b> (elbows added automatically) — click to connect',
    'st.snap': ' · snap: <b>{s}</b>',
    'st.plane': ' · <b>{p}</b> (Tab switches)',
    'st.label': 'Click on a pipe to attach a label',
    'st.pan': 'Drag to pan · wheel to zoom',
    'st.fitting': 'Click on a pipe to place: <b>{name}</b>',
    'snap.end': 'Endpoint', 'snap.tee': 'On pipe – tee', 'snap.align': 'Aligned', 'snap.route': 'Endpoint – auto route',
    'tag.pipes': '{n} pipes',

    'sb.drawing': 'Drawing', 'sb.titleBlock': 'Title block', 'sb.notes': 'Notes', 'sb.settings': 'Settings',
    'sb.grid': 'Grid (mm)', 'sb.snap': 'Snap (mm)', 'sb.background': 'Background',
    'bg.lines': 'Isometric paper (lines)', 'bg.dots': 'Isometric paper (dots)', 'bg.none': 'Plain white',
    'sb.paperOnSheet': 'Show grid lines in the export (PDF, DXF and print)',
    'sb.defaultSize': 'Default pipe size', 'sb.showDims': 'Show dimensions', 'sb.showWelds': 'Show welds at elbows and tees',
    'sb.angles': 'Pipe angles', 'ang.90': '90° only', 'ang.45': '45° and 90°',
    'sb.autoFlange': 'Flanges at section ends', 'af.off': 'Off', 'af.ends': 'Start and end of each run', 'af.all': 'Both ends of every pipe section',
    'sb.help': 'Help',
    'sb.pipe': 'Pipe', 'sb.direction': 'Direction', 'sb.from': 'From', 'sb.to': 'To', 'sb.oblique': 'oblique',
    'sb.length': 'Length (mm)', 'sb.size': 'Pipe size', 'sb.showDim': 'Show dimension', 'sb.dimFlip': 'Dimension on other side',
    'sb.delPipe': 'Delete pipe', 'sb.type': 'Type', 'sb.pos': 'Position along pipe (%)', 'sb.reverse': 'Reverse direction',
    'sb.delete': 'Delete', 'sb.label': 'Label', 'sb.text': 'Text (Enter for a new line)',
    'sb.dragLabel': 'Drag the label on the drawing to move it.', 'sb.delLabel': 'Delete label',
    'sb.point': 'Point', 'kind.0': 'Free point', 'kind.1': 'Open end', 'kind.2': 'Elbow / bend', 'kind.3': 'Tee', 'kind.4': 'Cross',
    'sb.delNodeHelp': 'Deleting a point also deletes the pipes connected to it.', 'sb.delPoint': 'Delete point',
    'sb.continue': 'Continue drawing from here',
    'lbl.default': 'Label',

    'err.min': 'Min. {n}', 'err.pos': 'Between 1 and 99', 'err.len': 'Length must be greater than 0.',
    'err.loop': 'This pipe is part of a closed loop, so its length can\'t be changed on its own.',
    'err.open': 'Could not open file: {m}', 'err.notPipeIso': 'This file is not a PipeIso drawing.', 'err.render': 'Could not create the sheet.',
    'confirm.new': 'Start a new drawing? The current drawing is cleared (you can still undo).',

    'tf.project': 'Project', 'tf.client': 'Client', 'tf.lineNo': 'Line no.', 'tf.drawingNo': 'Drawing no.',
    'tf.spec': 'Pipe spec', 'tf.material': 'Material', 'tf.insulation': 'Insulation', 'tf.testPressure': 'Test pressure',
    'tf.rev': 'Revision', 'tf.sheet': 'Sheet', 'tf.drawnBy': 'Drawn by', 'tf.checkedBy': 'Checked by', 'tf.date': 'Date', 'tf.units': 'Units',
    'sh.title': 'PIPING ISOMETRIC', 'sh.notes': 'NOTES', 'sh.nts': 'DRAWING NOT TO SCALE',

    'tool.edit': 'Edit', 'tip.edit': 'Edit length, angle, diameter and orientation (E)',
    'tool.pipeKF': 'KF pipe', 'tool.pipeK': 'ISO-K pipe',
    'cat.draw': 'Draw', 'cat.pipes': 'Pipes', 'cat.valves': 'Valves', 'cat.flanges': 'Flanges', 'cat.reducers': 'Reducers',
    'cat.flex': 'Compensators & hoses', 'cat.marks': 'Welds & marks',
    'fit.flange1': 'Single flange', 'fits.flange1': 'Single',
    'fit.blind': 'Blank flange', 'fits.blind': 'Blank',
    'fit.reducerEcc': 'Eccentric reducer', 'fits.reducerEcc': 'Eccentric',
    'sb.side': 'Side', 'sb.dirOut': 'Direction', 'o.out': 'outward', 'o.in': 'inward', 'btn.flip': 'Flip',
    'tip.flipKeys': 'X flips the side, C flips the direction.',
    'sb.standard': 'Standard', 'sb.dn': 'Nominal size', 'sb.defaultKF': 'Default size ISO-KF', 'sb.defaultK': 'Default size ISO-K',
    'pp.angle': 'Direction / angle', 'pp.apply': 'Apply', 'pp.close': 'Close', 'pp.bend': 'Add bend here',
    'pp.bendDone': 'Bend added. Now set the direction of this part.', 'pp.hint45': 'Switch on 45° in Settings for diagonal directions.',
    'pp.position': 'Position (%)',
    'st.edit': 'Tap or click a pipe or component to edit its length, angle, diameter or orientation',
    'btn.finish': 'Finish run', 'btn.props': 'Properties', 'btn.closeSheet': 'Close',
    'err.short': 'This pipe is too short to add a bend.',
    'snap.grid': 'Grid point', 'sb.gridSnap': 'Snap to the intersections of the isometric paper',
    'sb.component': 'Component', 'sb.ftf': 'Face-to-face length (mm)', 'sb.dnMain': 'Size', 'sb.dnSmall': 'Small end',
    'sb.showCompSizes': 'Show sizes at valves, reducers and bellows',
    'st.insert': 'Click or tap on a pipe to add a <b>{name}</b> ({len} mm). The pipe gets longer by that length.',
    'bar.len': 'Length of new {name} (mm)', 'bar.auto': 'auto',
    'err.insertLoop': 'Can\'t add it here: this pipe is part of a closed loop.', 'err.insertComp': 'Components can only be added to a pipe.',
    'tag.insert': '+{len} mm',
    'btn.pdf': 'PDF', 'tip.pdf': 'Download the sheet as a PDF file (paper size in Settings)',
    'btn.printOnly': 'Print', 'btn.share': 'Share', 'tip.share': 'Share or send the drawing (PDF, DXF or drawing file)',
    'btn.settings': 'Settings', 'tip.settings': 'Settings: company logo, website, creator, paper size, drawing options',
    'btn.install': 'Install app', 'tip.install': 'Add PipeIso to your home screen or desktop',
    'set.title': 'Settings', 'set.company': 'Company', 'set.logo': 'Company logo (SVG)', 'set.logoUpload': 'Upload SVG…',
    'set.logoHint': 'The logo is printed in the title block of the PDF and appears as lines on its own layer (LOGO) in the DXF. Tip: convert texts to paths in your graphics program before saving the SVG.',
    'set.logoOldPng': 'Your earlier PNG logo is no longer used. Please upload your logo as an SVG file.',
    'err.logoBig': 'This SVG file is too large (max. 1.5 MB).', 'err.logoEmpty': 'This SVG file contains nothing that can be drawn.',
    'set.logoRemove': 'Remove', 'set.noLogo': 'No logo', 'set.site': 'Company website', 'set.creator': 'Creator name',
    'set.creatorHint': 'Printed in the title block and used as "Drawn by" for new drawings.',
    'set.profileNote': 'Company details are saved in this browser and printed in the title block of every sheet.',
    'set.export': 'Export', 'set.paper': 'Paper size for PDF and print', 'set.drawing': 'Drawing', 'set.app': 'App',
    'set.language': 'Language', 'set.close': 'Done', 'set.installHow': 'Use as an app',
    'set.installText': 'PipeIso can be added to the home screen and then works offline. Chrome / Edge: “Install app”. iPhone / iPad (Safari): Share → “Add to Home Screen”. Android: menu ⋮ → “Add to Home screen”. This needs the app to be opened from a web address (https), for example GitHub Pages – not as a file from your computer.',
    'set.installed': 'PipeIso is running as an installed app.',
    'err.logoType': 'Please choose an SVG file.', 'err.logoSave': 'The logo could not be saved (the file is too large).',
    'sh2.title': 'Share', 'sh2.pdf': 'PDF ({paper})', 'sh2.pdfSub': 'For email, chat and printing',
    'sh2.dxf': 'CAD drawing (DXF, {paper})', 'sh2.dxfSub': 'For AutoCAD, LibreCAD and other CAD programs', 'sh2.json': 'Drawing file (.bpi)',
    'sh2.jsonSub': 'Can be opened and edited again in PipeIso', 'sh2.noShare': 'This browser can\'t share files directly, so the file is downloaded instead.',
    'sh2.done': 'Shared.', 'sh2.downloaded': 'Downloaded: {name}', 'sh2.working': 'Preparing…',
    'sh.creator': 'Creator',
    'cat.favs': 'Favorites', 'fav.hint': 'Click ☆ on any item (or long-press it) to add it here.',
    'fav.toggle': 'Add to / remove from favorites (or long-press)',
    'grp.shutoff': 'Shut-off', 'grp.control': 'Control', 'grp.nonreturn': 'Non-return', 'grp.safety': 'Safety',
    'cat.other': 'Silencers & more',
    'fit.needle': 'Needle valve', 'fits.needle': 'Needle', 'fit.relief': 'Pressure relief valve', 'fits.relief': 'Relief',
    'fit.silencer': 'Silencer', 'fits.silencer': 'Silencer',
    'set.lengths': 'Standard lengths (face-to-face, mm)', 'set.lenType': 'Component',
    'set.lenHint': 'Empty fields use the typical length shown in grey. These lengths are used for new components; components already drawn keep their length.',
    'set.lenReset': 'Reset this component to typical lengths', 'set.redStep': 'Small end of new reducers',
    'set.red1': 'One size smaller', 'set.red2': 'Two sizes smaller',
    'prj.ph': 'Project name', 'set.version': 'Version',
    'sb.showAngles': 'Show the angle between the pipes at elbows',
    'tip.scale': 'Scale on screen (at the standard 96 dpi). The mouse wheel, pinch, + and − step through the standard scales.',
    'cats.pipes': 'Pipes', 'cats.valves': 'Valves', 'cats.flanges': 'Flanges', 'cats.reducers': 'Reducers',
    'cats.flex': 'Flex', 'cats.other': 'Silencers', 'cats.marks': 'Marks',
    'tip.catBtn': 'tap to open, long-press to move', 'fav.hintShort': 'Long-press a part to add it to Favorites.',
    'set.display': 'Display', 'set.gridColor': 'Colour of the isometric paper lines', 'set.default': 'Default',
    'set.gridColorHint': 'Used on screen and when the paper is printed on the sheet.',
    'set.showCompass': 'Show compass (on screen and as north arrow in the export)',
    'set.tpl': 'Title block template',
    'set.tplHint': 'New drawings start with these values. Empty fields keep the usual default. The project name is entered per drawing (next to the compass); the date is always today.',
    'set.tplFromDoc': 'Take values from current drawing', 'set.tplApply': 'Fill current drawing from template', 'set.tplClear': 'Clear template',
    'set.tplApplied': 'Title block of the current drawing filled in.',
    'set.backup': 'Back up settings', 'set.exportSettings': 'Export settings…', 'set.importSettings': 'Import settings…',
    'set.backupHint': 'Saves company details and logo, title block template, standard lengths, favorites, display, language and drawing options in one file. Import it in another browser or on another device.',
    'set.imported': 'Settings imported.', 'err.settingsFile': 'This file is not a PipeIso settings file.',
    'help': `<p><b>Quick start</b></p>
      <p>1. Pick <b>KF pipe</b> or <b>ISO-K pipe</b> and click or tap a start point. Existing points snap (green ring).</p>
      <p>2. Move in the direction you want and click or tap, or type a length (mm) and press <kbd>Enter</kbd>. Each point continues the run and makes an elbow.</p>
      <p>3. <kbd>Esc</kbd>, right-click, double-click or <b>Finish run</b> ends the run. Start on a pipe to make a tee. Double-click a pipe end to continue it.</p>
      <p>4. Use <b>Edit</b> <kbd>E</kbd> on a pipe to change its length, angle or nominal size, or to add a bend.</p>
      <p>5. Pick a component and click on a pipe. Valves, reducers, bellows and hoses are added into the pipe with their own length (the pipe gets longer); set the length in the bar above the drawing. Components face the side and end you clicked nearest to. <kbd>X</kbd> flips the side, <kbd>C</kbd> the direction.</p>
      <p>6. For 45° pipes, set <b>Pipe angles</b> to 45° and 90°, then switch the plane with <kbd>Tab</kbd>.</p>
      <p>7. Fill in the title block, then use <b>PDF</b> or <b>Share</b>. Company logo, website, creator and paper size (A4 / A3) are in <b>Settings</b>.</p>
      <p>Click ☆ on any palette item (or long-press it) to add it to Favorites. Valves are grouped – click a group to open it.</p>
      <p>On a phone: drag with one finger to pan, pinch to zoom. Long-press a pipe or component to change its length, size or type. The parts are grouped in the bottom bar: tap a group to open it, long-press a group to move it.</p>
      <p>Zooming uses the standard scales 1:1 … 1:2000 (mouse wheel, pinch, <kbd>+</kbd> / <kbd>−</kbd>, or the scale box at the bottom left).</p>
      <p>Undo <kbd>Ctrl+Z</kbd> · Redo <kbd>Ctrl+Y</kbd> · Fit <kbd>Home</kbd> · Delete <kbd>Del</kbd></p>`,
  };

  const de = {
    'app.title': 'PipeIso – Editor für Rohrleitungsisometrien',
    'btn.new': 'Neu', 'tip.new': 'Neue Zeichnung',
    'btn.open': 'Öffnen…', 'tip.open': 'Eine Zeichnungsdatei (.bpi) öffnen',
    'btn.save': 'Speichern', 'tip.save': 'Zeichnung als Datei speichern (Strg+S)',
    'btn.undo': 'Rückgängig', 'tip.undo': 'Rückgängig (Strg+Z)',
    'btn.redo': 'Wiederholen', 'tip.redo': 'Wiederholen (Strg+Y)',
    'btn.fit': 'Einpassen', 'tip.fit': 'Alles anzeigen (Pos1)',
    'lbl.export': 'Export',
    'tip.dxf': 'Blatt als DXF-Datei für CAD herunterladen (Papierformat in den Einstellungen)',
    'btn.print': 'Drucken / PDF', 'tip.print': 'Blatt drucken (Strg+P)',
    'tip.lang': 'Sprache',

    'grp.draw': 'Zeichnen', 'grp.Valves': 'Armaturen', 'grp.Fittings': 'Formteile',
    'tool.select': 'Auswahl', 'tool.pipe': 'Rohr', 'tool.label': 'Text', 'tool.pan': 'Verschieben',

    'fit.gate': 'Absperrschieber', 'fits.gate': 'Schieber',
    'fit.globe': 'Durchgangsventil', 'fits.globe': 'Ventil',
    'fit.ball': 'Kugelhahn', 'fits.ball': 'Kugelhahn',
    'fit.check': 'Rückschlagventil', 'fits.check': 'Rückschl.',
    'fit.butterfly': 'Absperrklappe', 'fits.butterfly': 'Klappe',
    'fit.flange': 'Flanschverbindung', 'fits.flange': 'Flansch',
    'fit.reducer': 'Reduzierstück', 'fits.reducer': 'Reduzier.',
    'fit.bellows': 'Kompensator (Balg)', 'fits.bellows': 'Kompens.',
    'fit.hose': 'Flexibler Schlauch', 'fits.hose': 'Schlauch',
    'fit.weld': 'Werkstattnaht', 'fits.weld': 'Naht',
    'fit.fieldweld': 'Baustellennaht', 'fits.fieldweld': 'Baust.-Naht',
    'fit.flow': 'Fließrichtung', 'fits.flow': 'Fließr.',

    'dir.E': 'Ost', 'dir.W': 'West', 'dir.N': 'Nord', 'dir.S': 'Süd', 'dir.U': 'Auf', 'dir.D': 'Ab',
    'cmp.E': 'O', 'cmp.N': 'N', 'cmp.U': 'Auf',
    'coord': 'O {e}  N {n}  H {z}',

    'plane.axes': '90°', 'plane.h': '45° waagerecht', 'plane.xz': '45° senkrecht O–W', 'plane.yz': '45° senkrecht N–S',
    'tip.plane': 'Ebene für 45°-Rohre (Tab wechselt)',

    'st.select': 'Klicken zum Auswählen · X / C kehren ein gewähltes Bauteil um · Doppelklick auf ein Rohrende zeichnet weiter · Armaturen und Texte per Ziehen verschieben · <b>Entf</b> löscht · Mausrad zoomt · mittlere Maustaste oder Leertaste+Ziehen verschiebt',
    'st.pipeStart': 'Startpunkt klicken oder antippen: freie Fläche, vorhandener Punkt (fängt) oder auf ein Rohr (ergibt ein T-Stück)',
    'st.pipeRun': '<b>{dir} {len} mm</b> — klicken zum Setzen oder Länge eintippen und <b>Enter</b> · <b>Esc</b>, Rechtsklick oder Doppelklick beendet den Strang',
    'st.pipeRoute': '<b>Mit {n} Rohren zum Punkt verbinden</b> (Bögen werden automatisch gesetzt) — klicken zum Verbinden',
    'st.snap': ' · Fang: <b>{s}</b>',
    'st.plane': ' · <b>{p}</b> (Tab wechselt)',
    'st.label': 'Auf ein Rohr klicken, um einen Text anzuhängen',
    'st.pan': 'Ziehen zum Verschieben · Mausrad zum Zoomen',
    'st.fitting': 'Auf ein Rohr klicken zum Setzen: <b>{name}</b>',
    'snap.end': 'Endpunkt', 'snap.tee': 'Auf Rohr – T-Stück', 'snap.align': 'Ausgerichtet', 'snap.route': 'Endpunkt – automatische Führung',
    'tag.pipes': '{n} Rohre',

    'sb.drawing': 'Zeichnung', 'sb.titleBlock': 'Schriftfeld', 'sb.notes': 'Bemerkungen', 'sb.settings': 'Einstellungen',
    'sb.grid': 'Raster (mm)', 'sb.snap': 'Fang (mm)', 'sb.background': 'Hintergrund',
    'bg.lines': 'Isometriepapier (Linien)', 'bg.dots': 'Isometriepapier (Punkte)', 'bg.none': 'Weiß',
    'sb.paperOnSheet': 'Rasterlinien im Export anzeigen (PDF, DXF und Druck)',
    'sb.defaultSize': 'Standard-Nennweite', 'sb.showDims': 'Bemaßung anzeigen', 'sb.showWelds': 'Schweißnähte an Bögen und T-Stücken anzeigen',
    'sb.angles': 'Rohrwinkel', 'ang.90': 'nur 90°', 'ang.45': '45° und 90°',
    'sb.autoFlange': 'Flansche an Abschnittsenden', 'af.off': 'Aus', 'af.ends': 'Anfang und Ende jedes Strangs', 'af.all': 'Beide Enden jedes Rohrabschnitts',
    'sb.help': 'Hilfe',
    'sb.pipe': 'Rohr', 'sb.direction': 'Richtung', 'sb.from': 'Von', 'sb.to': 'Bis', 'sb.oblique': 'schräg',
    'sb.length': 'Länge (mm)', 'sb.size': 'Nennweite', 'sb.showDim': 'Bemaßung anzeigen', 'sb.dimFlip': 'Bemaßung auf der anderen Seite',
    'sb.delPipe': 'Rohr löschen', 'sb.type': 'Typ', 'sb.pos': 'Position auf dem Rohr (%)', 'sb.reverse': 'Richtung umkehren',
    'sb.delete': 'Löschen', 'sb.label': 'Text', 'sb.text': 'Text (Enter für neue Zeile)',
    'sb.dragLabel': 'Den Text in der Zeichnung ziehen, um ihn zu verschieben.', 'sb.delLabel': 'Text löschen',
    'sb.point': 'Punkt', 'kind.0': 'Freier Punkt', 'kind.1': 'Offenes Ende', 'kind.2': 'Bogen', 'kind.3': 'T-Stück', 'kind.4': 'Kreuzstück',
    'sb.delNodeHelp': 'Beim Löschen eines Punktes werden die angeschlossenen Rohre mitgelöscht.', 'sb.delPoint': 'Punkt löschen',
    'sb.continue': 'Von hier weiterzeichnen',
    'lbl.default': 'Text',

    'err.min': 'Min. {n}', 'err.pos': 'Zwischen 1 und 99', 'err.len': 'Die Länge muss größer als 0 sein.',
    'err.loop': 'Dieses Rohr ist Teil eines geschlossenen Rings, daher kann seine Länge nicht allein geändert werden.',
    'err.open': 'Datei konnte nicht geöffnet werden: {m}', 'err.notPipeIso': 'Diese Datei ist keine PipeIso-Zeichnung.', 'err.render': 'Das Blatt konnte nicht erstellt werden.',
    'confirm.new': 'Neue Zeichnung beginnen? Die aktuelle Zeichnung wird geleert (Rückgängig ist weiterhin möglich).',

    'tf.project': 'Projekt', 'tf.client': 'Kunde', 'tf.lineNo': 'Leitungs-Nr.', 'tf.drawingNo': 'Zeichnungs-Nr.',
    'tf.spec': 'Rohrklasse', 'tf.material': 'Werkstoff', 'tf.insulation': 'Isolierung', 'tf.testPressure': 'Prüfdruck',
    'tf.rev': 'Revision', 'tf.sheet': 'Blatt', 'tf.drawnBy': 'Gezeichnet', 'tf.checkedBy': 'Geprüft', 'tf.date': 'Datum', 'tf.units': 'Einheit',
    'sh.title': 'ROHRLEITUNGSISOMETRIE', 'sh.notes': 'BEMERKUNGEN', 'sh.nts': 'NICHT MASSSTÄBLICH',

    'tool.edit': 'Bearbeiten', 'tip.edit': 'Länge, Winkel, Durchmesser und Ausrichtung bearbeiten (E)',
    'tool.pipeKF': 'KF-Rohr', 'tool.pipeK': 'ISO-K-Rohr',
    'cat.draw': 'Zeichnen', 'cat.pipes': 'Rohre', 'cat.valves': 'Armaturen', 'cat.flanges': 'Flansche', 'cat.reducers': 'Reduzierungen',
    'cat.flex': 'Kompensatoren & Schläuche', 'cat.marks': 'Nähte & Symbole',
    'fit.flange1': 'Einzelflansch', 'fits.flange1': 'Einzel',
    'fit.blind': 'Blindflansch', 'fits.blind': 'Blind',
    'fit.reducerEcc': 'Exzentrische Reduzierung', 'fits.reducerEcc': 'Exzentr.',
    'fit.reducer': 'Konzentrische Reduzierung',
    'sb.side': 'Seite', 'sb.dirOut': 'Richtung', 'o.out': 'nach außen', 'o.in': 'nach innen', 'btn.flip': 'Umkehren',
    'tip.flipKeys': 'X kehrt die Seite um, C die Richtung.',
    'sb.standard': 'Norm', 'sb.dn': 'Nennweite', 'sb.defaultKF': 'Standard-Nennweite ISO-KF', 'sb.defaultK': 'Standard-Nennweite ISO-K',
    'pp.angle': 'Richtung / Winkel', 'pp.apply': 'Übernehmen', 'pp.close': 'Schließen', 'pp.bend': 'Hier Bogen einfügen',
    'pp.bendDone': 'Bogen eingefügt. Jetzt die Richtung dieses Teils festlegen.', 'pp.hint45': 'Für Diagonalen 45° in den Einstellungen einschalten.',
    'pp.position': 'Position (%)',
    'st.edit': 'Rohr oder Bauteil antippen oder anklicken, um Länge, Winkel, Durchmesser oder Ausrichtung zu ändern',
    'btn.finish': 'Strang beenden', 'btn.props': 'Eigenschaften', 'btn.closeSheet': 'Schließen',
    'err.short': 'Dieses Rohr ist zu kurz für einen Bogen.',
    'snap.grid': 'Rasterpunkt', 'sb.gridSnap': 'An den Schnittpunkten des Isometriepapiers fangen',
    'sb.component': 'Bauteil', 'sb.ftf': 'Baulänge (mm)', 'sb.dnMain': 'Nennweite', 'sb.dnSmall': 'Kleines Ende',
    'sb.showCompSizes': 'Nennweiten an Armaturen, Reduzierungen und Kompensatoren anzeigen',
    'st.insert': 'Auf ein Rohr klicken oder tippen, um <b>{name}</b> ({len} mm) einzufügen. Das Rohr wird um diese Länge länger.',
    'bar.len': 'Baulänge {name} (mm)', 'bar.auto': 'auto',
    'err.insertLoop': 'Hier nicht möglich: Dieses Rohr ist Teil eines geschlossenen Rings.', 'err.insertComp': 'Bauteile können nur in ein Rohr eingefügt werden.',
    'tag.insert': '+{len} mm',
    'btn.pdf': 'PDF', 'tip.pdf': 'Blatt als PDF-Datei herunterladen (Papierformat in den Einstellungen)',
    'btn.printOnly': 'Drucken', 'btn.share': 'Teilen', 'tip.share': 'Zeichnung teilen oder senden (PDF, DXF oder Zeichnungsdatei)',
    'btn.settings': 'Einstellungen', 'tip.settings': 'Einstellungen: Firmenlogo, Website, Ersteller, Papierformat, Zeichnungsoptionen',
    'btn.install': 'App installieren', 'tip.install': 'PipeIso zum Startbildschirm oder Desktop hinzufügen',
    'set.title': 'Einstellungen', 'set.company': 'Firma', 'set.logo': 'Firmenlogo (SVG)', 'set.logoUpload': 'SVG hochladen…',
    'set.logoHint': 'Das Logo wird im Schriftfeld der PDF gedruckt und erscheint in der DXF als Linien auf einem eigenen Layer (LOGO). Tipp: Texte im Grafikprogramm vor dem Speichern als SVG in Pfade umwandeln.',
    'set.logoOldPng': 'Das bisherige PNG-Logo wird nicht mehr verwendet. Bitte das Logo als SVG-Datei hochladen.',
    'err.logoBig': 'Diese SVG-Datei ist zu groß (max. 1,5 MB).', 'err.logoEmpty': 'Diese SVG-Datei enthält nichts, was gezeichnet werden kann.',
    'set.logoRemove': 'Entfernen', 'set.noLogo': 'Kein Logo', 'set.site': 'Firmen-Website', 'set.creator': 'Name des Erstellers',
    'set.creatorHint': 'Wird im Schriftfeld gedruckt und bei neuen Zeichnungen als „Gezeichnet“ eingetragen.',
    'set.profileNote': 'Firmendaten werden in diesem Browser gespeichert und im Schriftfeld jedes Blatts gedruckt.',
    'set.export': 'Export', 'set.paper': 'Papierformat für PDF und Druck', 'set.drawing': 'Zeichnung', 'set.app': 'App',
    'set.language': 'Sprache', 'set.close': 'Fertig', 'set.installHow': 'Als App verwenden',
    'set.installText': 'PipeIso lässt sich zum Startbildschirm hinzufügen und funktioniert dann auch offline. Chrome / Edge: „App installieren“. iPhone / iPad (Safari): Teilen → „Zum Home-Bildschirm“. Android: Menü ⋮ → „Zum Startbildschirm hinzufügen“. Dazu muss die App über eine Webadresse (https) geöffnet werden, z. B. GitHub Pages – nicht als Datei vom Computer.',
    'set.installed': 'PipeIso läuft als installierte App.',
    'err.logoType': 'Bitte eine SVG-Datei wählen.', 'err.logoSave': 'Das Logo konnte nicht gespeichert werden (Datei zu groß).',
    'sh2.title': 'Teilen', 'sh2.pdf': 'PDF ({paper})', 'sh2.pdfSub': 'Für E-Mail, Chat und Druck',
    'sh2.dxf': 'CAD-Zeichnung (DXF, {paper})', 'sh2.dxfSub': 'Für AutoCAD, LibreCAD und andere CAD-Programme', 'sh2.json': 'Zeichnungsdatei (.bpi)',
    'sh2.jsonSub': 'Kann in PipeIso wieder geöffnet und bearbeitet werden', 'sh2.noShare': 'Dieser Browser kann Dateien nicht direkt teilen, daher wird die Datei heruntergeladen.',
    'sh2.done': 'Geteilt.', 'sh2.downloaded': 'Heruntergeladen: {name}', 'sh2.working': 'Wird vorbereitet…',
    'sh.creator': 'Ersteller',
    'cat.favs': 'Favoriten', 'fav.hint': '☆ an einem Element anklicken (oder lange drücken), um es hier abzulegen.',
    'fav.toggle': 'Zu Favoriten hinzufügen / entfernen (oder lange drücken)',
    'grp.shutoff': 'Absperren', 'grp.control': 'Regeln', 'grp.nonreturn': 'Rückschlag', 'grp.safety': 'Sicherheit',
    'cat.other': 'Schalldämpfer & mehr',
    'fit.needle': 'Nadelventil', 'fits.needle': 'Nadel', 'fit.relief': 'Sicherheitsventil', 'fits.relief': 'Sicherh.',
    'fit.silencer': 'Schalldämpfer', 'fits.silencer': 'Schalldpf.',
    'set.lengths': 'Standard-Baulängen (mm)', 'set.lenType': 'Bauteil',
    'set.lenHint': 'Leere Felder verwenden die grau angezeigte typische Länge. Die Längen gelten für neue Bauteile; bereits gezeichnete behalten ihre Länge.',
    'set.lenReset': 'Dieses Bauteil auf typische Längen zurücksetzen', 'set.redStep': 'Kleines Ende neuer Reduzierungen',
    'set.red1': 'Eine Nennweite kleiner', 'set.red2': 'Zwei Nennweiten kleiner',
    'prj.ph': 'Projektname', 'set.version': 'Version',
    'sb.showAngles': 'Winkel zwischen den Rohren an Bögen anzeigen',
    'tip.scale': 'Maßstab am Bildschirm (bei Standard-96-dpi). Mausrad, Zwei-Finger-Zoom, + und − springen von Normmaßstab zu Normmaßstab.',
    'cats.pipes': 'Rohre', 'cats.valves': 'Armaturen', 'cats.flanges': 'Flansche', 'cats.reducers': 'Reduzier.',
    'cats.flex': 'Kompens.', 'cats.other': 'Dämpfer', 'cats.marks': 'Symbole',
    'tip.catBtn': 'antippen zum Öffnen, lange drücken zum Verschieben', 'fav.hintShort': 'Ein Teil lange drücken, um es zu den Favoriten hinzuzufügen.',
    'set.display': 'Anzeige', 'set.gridColor': 'Farbe der Linien des Isometriepapiers', 'set.default': 'Standard',
    'set.gridColorHint': 'Gilt am Bildschirm und wenn das Papier auf dem Blatt gedruckt wird.',
    'set.showCompass': 'Kompass anzeigen (am Bildschirm und als Nordpfeil im Export)',
    'set.tpl': 'Vorlage für das Schriftfeld',
    'set.tplHint': 'Neue Zeichnungen beginnen mit diesen Werten. Leere Felder behalten den üblichen Standard. Der Projektname wird je Zeichnung eingetragen (neben dem Kompass); das Datum ist immer heute.',
    'set.tplFromDoc': 'Werte aus aktueller Zeichnung übernehmen', 'set.tplApply': 'Aktuelle Zeichnung aus Vorlage füllen', 'set.tplClear': 'Vorlage leeren',
    'set.tplApplied': 'Schriftfeld der aktuellen Zeichnung ausgefüllt.',
    'set.backup': 'Einstellungen sichern', 'set.exportSettings': 'Einstellungen exportieren…', 'set.importSettings': 'Einstellungen importieren…',
    'set.backupHint': 'Speichert Firmendaten und Logo, Schriftfeld-Vorlage, Standard-Baulängen, Favoriten, Anzeige, Sprache und Zeichnungsoptionen in einer Datei. In einem anderen Browser oder auf einem anderen Gerät wieder importieren.',
    'set.imported': 'Einstellungen importiert.', 'err.settingsFile': 'Diese Datei ist keine PipeIso-Einstellungsdatei.',
    'help': `<p><b>Schnellstart</b></p>
      <p>1. <b>KF-Rohr</b> oder <b>ISO-K-Rohr</b> wählen und einen Startpunkt anklicken oder antippen. Vorhandene Punkte werden gefangen (grüner Ring).</p>
      <p>2. In die gewünschte Richtung bewegen und klicken bzw. tippen, oder eine Länge (mm) eintippen und <kbd>Enter</kbd> drücken. Jeder Punkt setzt den Strang fort und erzeugt einen Bogen.</p>
      <p>3. <kbd>Esc</kbd>, Rechtsklick, Doppelklick oder <b>Strang beenden</b> beendet den Strang. Auf einem Rohr beginnen ergibt ein T-Stück. Doppelklick auf ein Rohrende zeichnet dort weiter.</p>
      <p>4. Mit <b>Bearbeiten</b> <kbd>E</kbd> auf einem Rohr Länge, Winkel oder Nennweite ändern oder einen Bogen einfügen.</p>
      <p>5. Ein Bauteil wählen und auf ein Rohr klicken. Armaturen, Reduzierungen, Kompensatoren und Schläuche werden mit ihrer Baulänge eingefügt (das Rohr wird länger); die Länge steht in der Leiste über der Zeichnung. Bauteile zeigen zur Seite und zum Ende, die dem Klick am nächsten sind. <kbd>X</kbd> kehrt die Seite um, <kbd>C</kbd> die Richtung.</p>
      <p>6. Für 45°-Rohre <b>Rohrwinkel</b> auf 45° und 90° stellen und die Ebene mit <kbd>Tab</kbd> wechseln.</p>
      <p>7. Das Schriftfeld ausfüllen, dann <b>PDF</b> oder <b>Teilen</b> wählen. Firmenlogo, Website, Ersteller und Papierformat (A4 / A3) stehen in den <b>Einstellungen</b>.</p>
      <p>☆ an einem Element anklicken (oder lange drücken), um es zu den Favoriten hinzuzufügen. Armaturen sind gruppiert – eine Gruppe anklicken, um sie zu öffnen.</p>
      <p>Auf dem Smartphone: mit einem Finger verschieben, mit zwei Fingern zoomen. Ein Rohr oder Bauteil lange drücken, um Länge, Nennweite oder Typ zu ändern. Die Teile sind in der unteren Leiste gruppiert: eine Gruppe antippen zum Öffnen, lange drücken zum Verschieben.</p>
      <p>Gezoomt wird in Normmaßstäben 1:1 … 1:2000 (Mausrad, Zwei-Finger-Zoom, <kbd>+</kbd> / <kbd>−</kbd> oder das Maßstabsfeld unten links).</p>
      <p>Rückgängig <kbd>Strg+Z</kbd> · Wiederholen <kbd>Strg+Y</kbd> · Einpassen <kbd>Pos1</kbd> · Löschen <kbd>Entf</kbd></p>`,
  };

  const DICT = { en, de };
  ISO.LANGS = [['en', 'English'], ['de', 'Deutsch']];

  let lang = 'en';
  try {
    const s = localStorage.getItem('pipeiso.lang');
    if (s && DICT[s]) lang = s;
    else if ((navigator.language || '').toLowerCase().startsWith('de')) lang = 'de';
  } catch (e) {
    if ((navigator.language || '').toLowerCase().startsWith('de')) lang = 'de';
  }

  /** Translate a key; {name} placeholders are filled from params. */
  ISO.t = (key, params) => {
    let s = DICT[lang][key];
    if (s === undefined) s = en[key];
    if (s === undefined) return key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  };
  ISO.getLang = () => lang;
  ISO.setLang = (l) => {
    if (!DICT[l]) return;
    lang = l;
    try { localStorage.setItem('pipeiso.lang', l); } catch (e) { /* ignore */ }
    ISO.applyStatic();
  };
  /** Translate static markup: elements with data-i18n (text) and data-i18n-title (tooltip). */
  ISO.applyStatic = () => {
    document.documentElement.lang = lang;
    document.title = ISO.t('app.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = ISO.t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = ISO.t(el.dataset.i18nTitle)));
  };
})();
