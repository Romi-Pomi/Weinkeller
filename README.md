# Weinkeller Scanner V5.3

Diese ZIP enthält alle Dateien für GitHub Pages:

- index.html
- app.js
- manifest.webmanifest
- sw.js

Für GitHub Pages alle vier Dateien direkt in den Root-Ordner des Repository hochladen und vorhandene Dateien ersetzen.

Wichtig:
- `index.html` zeigt oben „Weinkeller Scanner V5.3“.
- `app.js` ist mit `?v=5.3` eingebunden, damit alte Cache-Versionen vermieden werden.
- V5.3 registriert keinen neuen Service Worker.
- Ein eventuell noch vorhandener alter Service Worker wird entfernt.
- Bereits gespeicherte Daten aus V5.1/V5.2 werden weiter eingelesen.
