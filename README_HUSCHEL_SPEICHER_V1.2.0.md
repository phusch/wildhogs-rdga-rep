# Wildhogs – Route des Grandes Alpes
## V1.2.0 Test · Huschel App Speicher

**Basis:** Ausschließlich die vom Nutzer neu hochgeladene `wildhogs-rdga-rep.zip`.
Die bisherige App bleibt der funktionierende Ausgangsstand; V1.2.0 ist bis zur Freigabe eine separate Testversion.

### Was geändert wurde

- `index.html`: nur neuer, deutlich sichtbarer 💾-Speicherbutton (unten rechts), separate Speicheransicht mit Zurück-Button, Einbindung der beiden neuen Moduldateien.
- `huschel-wildhogs-speicher.css`: CSS ausschließlich für neue Speicher-Bedienelemente, ohne bestehende Farben, Inhalte oder Tageskarten zu ändern.
- `huschel-wildhogs-speicher.js`: neue, gekapselte Speicherfunktion.
- Diese README ist neu. Die bisherige `README.md` blieb erhalten.

**Alle anderen Dateien aus dem hochgeladenen Repository sind unverändert**, darunter das Manifest und sämtliche Bild- und SVG-Assets. `.git`-Verwaltungsdaten und macOS-Dateien (`__MACOSX`, `.DS_Store`) gehören nicht in das Deployment-Paket.

### Welche Daten tatsächlich gesichert werden

Der Wildhogs-Reiseplaner ist ein weitgehend statischer Reiseführer (9 Tage plus Hilfe). Die einzigen vom Benutzer veränderbaren Anwendungsdaten sind **60 Checklisten-Häkchen**. Schon vorher wurden sie unter `wildhogs_<data-key>` im lokalen Browser gespeichert.

- Huschel App Speicher liest exakt diese 60 Werte, ohne die Original-Speicherung zu ersetzen.
- Über GitHub werden **nicht** das feste HTML, Bilder, Tourkarten, GPX-Links, Tagesabläufe oder der Reiseführer selbst gespeichert. Diese bleiben im öffentlichen App-Repository.
- GitHub-Speicherziel: privates Repository `phusch/huschel-app-data`, Datei `wildhogs-reiseplaner/data.json`.
- JSON-Format der Nutzdaten: `{ "schemaVersion": 1, "app": "wildhogs-reiseplaner", "checks": { ... } }` mit 60 booleschen Werten.
- Unbekannte oder unvollständige Checklisten-Backups werden **nicht** eingespielt. Ladeaktionen benötigen eine Bestätigung, falls die Daten abweichen.

### Standardfunktionen

1. Separate Speicheransicht, erreichbar über fest sichtbares 💾-Symbol; Zurück führt ohne Neuladen zur vorigen Reiseansicht.
2. Speicherampel für GitHub-Status mit getrennter, grün hinterlegter Supabase-Anzeige **Angemeldet**.
3. Supabase Auth mit `persistSession: true`, `autoRefreshToken: true`, beim Appstart geprüfte Sitzung, explizite Abmeldung.
4. **GitHub Laden** und **GitHub Speichern** inklusive SHA-/Revision-Konfliktschutz. Bei identischen Daten kein unnötiger neuer Commit.
5. **Lokal speichern / laden** als zusätzliche Sicherung der 60 automatisch lokal gespeicherten Häkchen.
6. **JSON exportieren / importieren** als unabhängiges Datei-Backup.
7. Eindeutige Statusmeldungen für erfolgreich, identisch, abgebrochen, Konflikt oder technische Fehler.

### Einmalige Voraussetzungen / Supabase

Die bestehende Infrastruktur weiterverwenden:

- Projekt: `huschel-speicher-pilot`
- URL: `https://qijordwpbwwbizfcslrv.supabase.co`
- Edge Function: `github-app-storage`
- `GITHUB_TOKEN` bleibt ausschließlich als **Supabase Secret**; niemals im App-Code.

**App-Freigabe prüfen:** In der Edge Function, im serverseitigen `APPS`-Objekt, muss folgender Eintrag vorhanden sein:

```typescript
"wildhogs-reiseplaner": "wildhogs-reiseplaner/data.json",
```

Dieser Eintrag war im zuvor gemeinsam erstellten Supabase-Servercode schon vorgesehen. Wenn er in deiner aktuell deployten Funktion noch enthalten ist, ist **kein Supabase-Update notwendig**. Falls `App nicht freigeschaltet` erscheint: Nur diese Zeile ergänzen und deployen; bestehende andere App-Freigaben, Token und Benutzer-ID nicht verändern.

### GitHub-Pages-Installation

1. Bestehenden funktionierenden Repository-Stand sicher aufbewahren.
2. Die ZIP entpacken und **die Inhalte des Versionsordners** in den **Root** des Wildhogs-App-Repositories kopieren, nicht den Versionsordner als neuen Unterordner deployen.
3. Damit insbesondere `index.html`, `huschel-wildhogs-speicher.js` und `huschel-wildhogs-speicher.css` hochladen. Die bestehenden Assets dürfen unverändert bleiben.
4. GitHub Pages neu laden (bei Bedarf Safari-Cache aktualisieren).
5. Über den deutlich sichtbaren **💾 Speicher**-Button die neue Speicherseite öffnen.
6. Falls nötig einmalig Supabase Publishable Key und E-Mail/Passwort eingeben. Nur den `sb_publishable_...`-Key verwenden, keinen Secret Key.
7. Zuerst **GitHub Laden**: Bei der allerersten Verwendung sollte noch keine private `data.json` existieren.
8. Danach **GitHub Speichern**: Der erste sichere GitHub-Stand wird erstellt.
9. Zurück zu den Checklisten, einen Haken ändern; nach **GitHub Laden** sollte nach bestätigtem Wiederherstellen wieder der gespeicherte Zustand zu sehen sein.
10. App schließen, erneut öffnen, **automatische Anmeldung** und lokale Checklisten überprüfen.

> GitHub Laden kann die aktuellen Häkchen ersetzen. Bei abweichendem Stand vorher auf Wunsch ein JSON-Backup erstellen. Ohne Bestätigung werden lokale Daten nicht überschrieben.

### Technische Tests und Grenzen

- Original: 60 eindeutige Checkbox-Datenschlüssel; alle 9 Tage, Hilfe und Assets unverändert.
- JavaScript mit `node --check` geprüft.
- Anmeldung, Cloud Speichern/Laden, SHA/Revision, Übernahme der Häkchen, lokaler Snapshot, JSON Export und Abmeldung mit simulierten Browser- und Supabase-Antworten geprüft.
- Ein echter Browser- und GitHub-Lauf konnte hier nicht durchgeführt werden (Testumgebung blockiert lokale Browseraufrufe). **Dein Test mit GitHub Pages bleibt entscheidend.**
- Die normale Reiseführer-/Checkbox-Funktion läuft lokal weiter. Nur der Supabase-/GitHub-Zugriff benötigt Internet.

### Unbedingt unverändert

Neun Tagesberichte, enthaltene Bilder, Karten, Links, Tourlogo, originale Navigation/Tags, alte lokale `wildhogs_`-Speicherung und Druckansicht. Andere Apps und das große separate Skipper Cockpit bleiben unangetastet.
