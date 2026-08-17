WEINKELLER SCANNER – PWA VERSION 2

Diese Version ist für HTTPS-Hosting gedacht und kann dann die Kamera auf Android verwenden.

Dateien:
- index.html
- app.js
- manifest.webmanifest
- sw.js

Wichtig:
Die Kamera funktioniert in mobilen Browsern zuverlässig nur über HTTPS oder localhost.
Eine lokal geöffnete Datei (file://...) reicht nicht.

Empfohlen:
1. Dateien in ein GitHub-Repository hochladen.
2. GitHub Pages aktivieren.
3. Die dadurch erzeugte HTTPS-Adresse auf dem Android-Handy in Chrome öffnen.
4. Kamerazugriff erlauben.
5. Optional über Chrome „Zum Startbildschirm hinzufügen“ / App installieren.

Die App speichert Kellerdaten zunächst lokal im Browser (localStorage).
CSV-Export für Excel ist eingebaut.

Hinweis:
EAN/UPC identifiziert einen Wein nicht zwingend jahrgangsscharf.
Darum bleibt der Jahrgang separat und muss geprüft werden.
