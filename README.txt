WEINKELLER SCANNER V3

Neu in V3:
- Barcode-Scanner wie bisher
- Etikett mit Handykamera fotografieren
- lokale OCR im Browser mit Tesseract.js
- automatische Vorschläge für:
  Weingut, Weinname, Jahrgang, Rebsorte, Region, Land, Weinart,
  Alkoholgehalt und Flaschengröße
- keine kostenpflichtige API
- keine InVintory-Anbindung
- keine API-Schlüssel

WICHTIG:
Die Bildanalyse erfolgt lokal im Browser. Tesseract.js und die Sprachmodelle
werden beim ersten Einsatz aus dem Internet geladen und danach üblicherweise
vom Browser zwischengespeichert. Dafür entstehen keine nutzungsabhängigen Kosten.

Die Erkennung ist absichtlich als Vorschlagssystem gebaut:
Bei dekorativen, gebogenen oder schlecht beleuchteten Etiketten kann OCR Fehler
machen. Vor „Einlagern“ sollten die erkannten Felder kurz geprüft werden.

GitHub:
Ersetze in deinem bestehenden Repository die bisherigen Dateien durch:
index.html
app.js
manifest.webmanifest
sw.js
README.txt

Die bestehende GitHub-Pages-Adresse kann unverändert bleiben.
