const chapter = (title, explanation, actions, example, note) => ({
    title,
    blocks: [
        { type: "paragraph", text: explanation },
        { type: "heading", text: "Was im Arbeitsalltag hilft" },
        { type: "list", text: actions.join("\n") },
        { type: "example", text: example },
        ...(note ? [{ type: "note", text: note }] : [])
    ]
});

const single = (prompt, right, a, b, c) => ({
    prompt, type: "single", options: [[right, true], [a, false], [b, false], [c, false]]
});
const multiple = (prompt, a, b, c, d) => ({
    prompt, type: "multiple", options: [[a, true], [b, false], [c, true], [d, false]]
});

function course(metadata, chapters, questions) {
    return {
        category: "Pflichtunterweisung", mandatory: true, audience: "all", dueDays: 30,
        validityMonths: 12, renewalDays: 30, passPercent: 80, maxAttempts: 0, retryMinutes: 0,
        ...metadata, chapters,
        questions: questions.map(({ prompt, type, options }, index) => {
            const offset = index % options.length;
            return { prompt, type, options: [...options.slice(offset), ...options.slice(0, offset)]
                .map(([text, correct]) => ({ text, correct })) };
        })
    };
}

const privacy = course({
    id: "privacy", purpose: "privacy", title: "Datenschutz und DSGVO", category: "Datenschutz",
    description: "Musterunterweisung für den verantwortungsvollen Umgang mit Mitarbeiter- und Kundendaten. Von zulässiger Verarbeitung bis zur Meldung eines Datenschutzvorfalls.",
    objectives: "Personenbezogene Daten erkennen. Zweck, Rechtsgrundlage und Datenumfang unterscheiden. Auskunftsersuchen und Vorfälle an die zuständige Stelle geben. Sichere Übermittlungswege im Alltag wählen.",
    summary: "Vor jeder Verarbeitung Zweck, Rechtsgrundlage, Datenumfang und Zugriff prüfen. Betroffenenanfragen sicher an die zuständige Stelle weiterleiten. Verdächtige Offenlegungen sofort intern melden. Die zuständigen Rollen entscheiden über Auskünfte und externe Meldungen."
}, [
    chapter("Grundlagen des Datenschutzes",
        "Die DSGVO schützt natürliche Personen bei der Verarbeitung personenbezogener Daten. Verarbeiten umfasst unter anderem Erheben, Speichern, Nutzen, Weitergeben und Löschen. Im Betrieb verantwortet die zuständige Organisation die Entscheidung über Zwecke und Mittel. Beschäftigte handeln im Rahmen ihrer Aufgaben und schützen die ihnen anvertrauten Informationen.",
        ["Vor einer neuen Verarbeitung Zweck und zuständige Stelle klären.", "Nur zugelassene betriebliche Werkzeuge und Zugriffswege verwenden.", "Früh klären, welche personenspezifischen Angaben überhaupt benötigt werden."],
        "Ein Team möchte eine Liste der Abwesenheiten veröffentlichen. Für die Planung reicht möglicherweise die Information, ob jemand verfügbar ist. Diagnosen wären dafür weder erforderlich noch angemessen.",
        "Diese Musterunterweisung verweist auf die DSGVO. Betriebliche Kontakte und freigegebene Werkzeuge werden vor Ort festgelegt."),
    chapter("Personenbezogene Daten und Rechtsgrundlagen",
        "Daten sind personenbezogen, wenn sie sich auf eine identifizierte oder identifizierbare Person beziehen. Auch Personalnummern oder Kombinationen mehrerer harmloser Merkmale können eine Zuordnung ermöglichen. Pseudonymisierte Daten bleiben personenbezogen, sofern die Person mit Zusatzinformationen bestimmbar ist. Eine Verarbeitung benötigt eine passende Rechtsgrundlage nach Artikel 6 DSGVO. Für besondere Daten wie Gesundheitsdaten gelten zusätzlich die Anforderungen aus Artikel 9.",
        ["Zwischen Datenminimierung und Anonymisierung unterscheiden.", "Für neue Zwecke eine zulässige Grundlage prüfen lassen.", "Gesundheitsdaten nur in dafür vorgesehenen, zugriffsbeschränkten Prozessen verarbeiten."],
        "Eine Personalnummer ersetzt den Namen in einer Tabelle. Da eine andere Liste die Zuordnung ermöglicht, bleibt die Tabelle schutzbedürftig. Die Zuordnungsliste wird getrennt und mit engeren Berechtigungen verwaltet."),
    chapter("Datenschutzgrundsätze",
        "Artikel 5 DSGVO verlangt unter anderem rechtmäßige, faire und transparente Verarbeitung, festgelegte Zwecke, Datenminimierung, Richtigkeit, Speicherbegrenzung sowie Vertraulichkeit und Integrität. Die verantwortliche Stelle muss die Einhaltung nachweisen können. Für einen anderen Zweck dürfen vorhandene Daten nur unter den jeweils geltenden Voraussetzungen erneut verwendet werden.",
        ["Nur notwendige Felder in Listen aufnehmen.", "Fehler in verlässlichen Systemen korrigieren lassen.", "Aufbewahrung und Löschung am vorgesehenen Zweck und an geltenden Pflichten ausrichten."],
        "Eine Versandliste enthält zusätzlich Geburtsdaten aus einem früheren Export. Für den Versand sind diese Angaben entbehrlich. Erstellen Sie eine zweckgebundene Liste mit den notwendigen Adressdaten."),
    chapter("Rechte betroffener Personen",
        "Die DSGVO sieht unter bestimmten Voraussetzungen beispielsweise Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch vor. Eine Anfrage kann ohne besondere Formulierung eingehen. Die verantwortliche Stelle prüft Identität und Umfang, wahrt die Fristen und berücksichtigt Rechte anderer Personen. Beschäftigte sollten Anfragen rasch über den freigegebenen Weg weiterleiten.",
        ["Anfragen unverzüglich intern weitergeben.", "Identität über den vorgesehenen Prozess klären lassen.", "Daten Dritter vor einer Herausgabe prüfen lassen."],
        "Ein ehemaliger Kollege bittet per E-Mail um alle gespeicherten Informationen. Geben Sie keine Personalakte direkt heraus. Übermitteln Sie die Anfrage geschützt an die zuständige Stelle."),
    chapter("Datenschutz am Arbeitsplatz",
        "Daten bleiben auch beim Ausdruck, in einer Videokonferenz und bei der Zusammenarbeit in freigegebenen Dokumenten geschützt. Fehlversand und unnötig große Freigabekreise sind häufige Ursachen unbeabsichtigter Offenlegung. Die Prüfung von Empfängern, Berechtigungen und Anhängen gehört daher zum Arbeitsablauf.",
        ["Empfänger und Anhänge vor dem Versand prüfen.", "Bildschirm beim Verlassen sperren und Ausdrucke abholen.", "Freigaben auf Beteiligte beschränken und bei Ende der Zusammenarbeit überprüfen."],
        "Bei einer Bildschirmfreigabe ist eine Liste mit Gehaltsdaten geöffnet. Schließen Sie vertrauliche Fenster und teilen Sie nur das benötigte Anwendungsfenster."),
    chapter("Datenschutzvorfälle und Schutzmaßnahmen",
        "Ein Datenschutzvorfall kann Vertraulichkeit, Integrität oder Verfügbarkeit betreffen. Beispiele sind ein falscher Empfänger, eine versehentlich öffentliche Datei oder ein verlorenes Gerät. Interne Sofortmeldung schafft Zeit für die Risikobewertung. Die DSGVO sieht für die verantwortliche Stelle bei meldepflichtigen Verletzungen grundsätzlich eine Meldung möglichst innerhalb von 72 Stunden nach Bekanntwerden vor. Die externe Entscheidung gehört in den zuständigen Prozess.",
        ["Zeitpunkt, betroffene Daten und den erkannten Umfang festhalten.", "Unsichere Freigaben nach dem vorgesehenen Prozess begrenzen.", "Weitere Kommunikation mit der zuständigen Stelle abstimmen."],
        "Ein Export wurde an eine fremde Adresse gesendet. Melden Sie den Vorfall sofort und dokumentieren Sie Empfänger, Zeitpunkt und Datenkategorien. Löschen Sie keine Spuren, die zur Bewertung erforderlich sind.")
], [
    single("Wann ist eine Personalnummer personenbezogen?", "Wenn sie einer identifizierbaren Person zugeordnet werden kann.", "Erst wenn ein Foto beiliegt.", "Ausschließlich bei öffentlichen Listen.", "Eine Personalnummer ist stets anonym."),
    single("Was muss vor einer neuen Verarbeitung geklärt sein?", "Welcher Zweck verfolgt wird und welche Rechtsgrundlage passt.", "Nur wer einen Export erstellen kann.", "Ob Excel oder PDF verwendet wird.", "Nur die Größe des Datensatzes."),
    multiple("Welche Schritte unterstützen Datenminimierung?", "Für einen Versand nur benötigte Felder exportieren.", "Für spätere Zwecke alle verfügbaren Daten übernehmen.", "Nicht benötigte Geburtsdaten aus der Versandliste weglassen.", "Sicherheitshalber eine vollständige Kopie privat ablegen."),
    single("Wann bleibt ein pseudonymisierter Datensatz personenbezogen?", "Wenn eine Zuordnung über Zusatzinformationen möglich ist.", "Nur wenn der Name im selben Feld steht.", "Sobald eine PDF-Datei daraus erstellt wird.", "Pseudonyme entfernen jeden Personenbezug."),
    single("Wer sollte ein Auskunftsersuchen bearbeiten?", "Die nach dem betrieblichen Prozess zuständige Stelle.", "Jede Person, die die Anfrage zuerst sieht.", "Ausschließlich der E-Mail-Anbieter.", "Nur die angefragte betroffene Person selbst."),
    single("Welche Aussage zu Gesundheitsdaten ist richtig?", "Für sie gelten zusätzliche Anforderungen für besondere Datenkategorien.", "Sie dürfen stets in Teamlisten stehen.", "Ein dienstliches Postfach macht jede Verarbeitung zulässig.", "Sie fallen grundsätzlich nicht unter Datenschutz."),
    multiple("Welche Maßnahmen reduzieren Fehlfreigaben?", "Empfänger und Anhang vor dem Versand prüfen.", "Freigaben standardmäßig für alle öffnen.", "Bei einer Präsentation nur das notwendige Fenster teilen.", "Vertrauliche Ausdrucke bis zum Feierabend liegen lassen."),
    single("Was tun Sie bei einer öffentlichen Freigabe mit Personaldaten?", "Sofort intern melden und die bekannten Fakten sichern.", "Erst am Ende der Woche reagieren.", "Unkoordiniert jede Aufzeichnung löschen.", "Extern ohne Abstimmung eine Meldung veröffentlichen."),
    single("Was bedeutet Speicherbegrenzung?", "Daten nur so lange personenbezogen halten, wie Zweck und Pflichten es erfordern.", "Alle Daten immer nach einem Kalendertag löschen.", "Archive unbegrenzt kopieren.", "Ausschließlich die Dateigröße begrenzen."),
    multiple("Welche Informationen helfen der internen Vorfallsbewertung?", "Zeitpunkt der Feststellung und Art des Vorfalls.", "Vermutungen über private Motive beteiligter Personen.", "Bekannte Empfänger und betroffene Datenkategorien.", "Eine Weiterleitung des vertraulichen Anhangs an Unbeteiligte.")
]);

const security = course({
    id: "security", title: "Informationssicherheit und Cybersecurity", category: "Informationssicherheit",
    description: "Musterunterweisung zum Schutz von Konten, Informationen und Geräten im Büro und unterwegs. Trainiert das Erkennen verdächtiger Nachrichten und die richtige Reaktion.",
    objectives: "Vertraulichkeit, Integrität und Verfügbarkeit unterscheiden. Konten mit starken, einzigartigen Zugangsdaten und MFA schützen. Phishing erkennen und Vorfälle über den vorgesehenen Weg melden.",
    summary: "Zugänge individuell absichern. Unerwartete Aufforderungen über einen unabhängigen Kanal verifizieren. Geräte und Daten bei Ortswechsel schützen. Verdächtige Ereignisse umgehend intern melden."
}, [
    chapter("Schutzziele und Verantwortung",
        "Vertraulichkeit beschränkt den Zugriff auf Berechtigte. Integrität bedeutet, dass Daten vollständig und unverfälscht bleiben. Verfügbarkeit sichert den Zugang, wenn er gebraucht wird. Ein Datenträger kann beispielsweise verschlüsselt sein und trotzdem ausfallen. Mehrere Schutzmaßnahmen wirken zusammen und decken unterschiedliche Risiken ab.",
        ["Daten und Zugriffe nach dem konkreten Arbeitsbedarf behandeln.", "Mit freigegebenen Systemen arbeiten und Kopien überschaubar halten.", "Veränderungen an wichtigen Daten nachvollziehbar vornehmen."],
        "Eine gemeinsam bearbeitete Liste enthält plötzlich andere Bankdaten. Prüfen Sie die Änderung über einen unabhängigen Kanal, bevor die Liste für eine Auszahlung verwendet wird."),
    chapter("Passwörter und Mehrfaktor-Anmeldung",
        "Einzigartige Passwörter reduzieren das Risiko, dass ein bekannt gewordenes Passwort weitere Konten öffnet. Ein freigegebener Passwortmanager kann lange, unterschiedliche Passwörter komfortabel verwalten. MFA ergänzt das Passwort um einen weiteren Faktor, etwa einen Sicherheitsschlüssel. Eine unerwartete Freigabeanforderung kann auf einen unbefugten Anmeldeversuch hinweisen.",
        ["Für jeden Dienst eigene Zugangsdaten verwenden.", "Zweiten Faktor aktivieren und Wiederherstellungscodes nach dem vorgesehenen Verfahren schützen.", "Unaufgeforderte Anfragen ablehnen und den Fall melden."],
        "Auf dem Smartphone erscheinen mehrere Freigabeaufforderungen, obwohl Sie sich nicht anmelden. Bestätigen Sie keine davon und klären Sie den Vorfall über den bekannten Supportweg."),
    chapter("Phishing, Social Engineering und E-Mail",
        "Angreifer können glaubwürdige Namen und bekannte Themen nutzen. Zeitdruck, Geheimhaltung und unerwartete Anhänge sind Warnsignale. Ein bekannter Anzeigename allein beweist die Herkunft nicht. Bei sensiblen Aufträgen führt ein bereits bekannter Kontaktweg zur verlässlicheren Überprüfung.",
        ["Absender, Kontext und konkrete Bitte zusammen prüfen.", "Unverlangte Links und Anhänge bis zur Klärung ungeöffnet lassen.", "Änderungen bei Zahlungs- oder Zugangsdaten unabhängig bestätigen."],
        "Eine angebliche Führungskraft verlangt vertraulich und kurzfristig eine Überweisung. Rufen Sie sie über die gespeicherte Nummer an. Verwenden Sie keine Nummer aus der fraglichen Nachricht."),
    chapter("Sichere Geräte und mobiles Arbeiten",
        "Ein mobiles Gerät ist sowohl ein Computer als auch ein möglicher Zugang zu betrieblichen Daten. Physischer Schutz, Bildschirmsperre, aktuelle Software und zugelassene Verbindungen verringern Risiken. Sensible Gespräche und offene Anzeigen sind in gemeinsam genutzten Umgebungen oft mitlesbar.",
        ["Gerät bei Unterbrechungen sperren und unterwegs beaufsichtigen.", "Vorgesehene Updates und freigegebene Arbeitsverbindungen nutzen.", "Daten weder über private Konten weiterleiten noch auf ungeprüften Datenträgern speichern."],
        "Im Zug möchten Sie eine Personaldatei bearbeiten. Prüfen Sie, ob der Arbeitsort geeignet ist, schützen Sie die Anzeige und verwenden Sie ausschließlich zugelassene Systeme."),
    chapter("Sicherheitsvorfälle erkennen und melden",
        "Ein verdächtiger Anmeldehinweis, ein verlorenes Gerät oder ein ungewöhnliches Systemverhalten sollte rasch eingeordnet werden. Zuständige Teams können Konten schützen, Schäden eingrenzen und relevante Spuren erhalten. Eigenmächtige Eingriffe erschweren die Bewertung. Handeln Sie nach der betrieblichen Incident-Anweisung.",
        ["Unverzüglich über den bekannten Sicherheitskanal melden.", "Zeitpunkt, Anwendung und beobachtetes Verhalten beschreiben.", "Nachweise über den freigegebenen Meldeweg übermitteln und technische Maßnahmen abstimmen."],
        "Nach Eingabe des Passworts auf einer verdächtigen Seite fällt Ihnen die ungewöhnliche Adresse auf. Informieren Sie sofort den Support über die Eingabe und folgen Sie den Anweisungen zur Absicherung des Kontos.")
], [
    single("Welches Schutzziel betrifft unveränderte Zahlungsdaten?", "Integrität.", "Verfügbarkeit.", "Vertraulichkeit allein.", "Bedienkomfort."),
    single("Wie reagieren Sie auf eine unerwartete MFA-Freigabe?", "Ablehnen und über den bekannten Supportweg melden.", "Bestätigen, um weitere Anfragen zu stoppen.", "Code an den Absender senden.", "Das Gerät an einen Unbekannten weitergeben."),
    multiple("Was schützt Konten verlässlich?", "Lange und dienstspezifische Passwörter.", "Ein gemeinsames Passwort für mehrere Dienste.", "Mehrfaktor-Anmeldung.", "Versand von Zugangsdaten über gewöhnliche E-Mail."),
    single("Wie prüfen Sie eine überraschende Zahlungsanweisung?", "Über unabhängig bekannte Kontaktdaten bestätigen lassen.", "Direkt dem Link aus der Nachricht folgen.", "Nur auf das Logo achten.", "Sofort ausführen, wenn Zeitdruck besteht."),
    single("Was hilft gegen Einblick beim mobilen Arbeiten?", "Arbeitsumgebung beurteilen und die Anzeige schützen.", "Den Bildschirm heller stellen.", "Sensible Daten auf ein Privatkonto kopieren.", "Andere Fahrgäste um Prüfung bitten."),
    multiple("Welche Anzeichen verdienen besondere Aufmerksamkeit?", "Ungewöhnlicher Zeitdruck bei einer vertraulichen Bitte.", "Eine erwartete Nachricht ohne Abweichung.", "Eine unaufgeforderte Änderung der Zahlungsdaten.", "Ein wie vereinbart verschickter Kalendereintrag."),
    single("Was tun Sie unmittelbar nach bemerkt verdächtiger Passworteingabe?", "Den Vorfall rasch an den zuständigen Support melden.", "Die Seite für Kollegen weiterleiten.", "Erst auf eine weitere Aufforderung warten.", "Eigenständig alle Geräte neu installieren."),
    single("Was ist beim Verlassen eines Arbeitsplatzes sinnvoll?", "Bildschirm sperren.", "Vertrauliche Unterlagen offen liegen lassen.", "Einen privaten Fernzugriff aktivieren.", "Zugangsdaten auf dem Bildschirm anzeigen."),
    multiple("Was gehört in eine sachliche Vorfallsmeldung?", "Zeitpunkt des beobachteten Ereignisses.", "Unbelegte Schuldzuweisungen.", "Betroffene Anwendung und beobachtetes Verhalten.", "Passwörter oder MFA-Codes."),
    single("Warum werden Software-Updates über vorgesehene Wege eingespielt?", "Sie schließen bekannte Schwachstellen, ohne unkontrollierte Quellen zu nutzen.", "Sie ersetzen alle übrigen Schutzmaßnahmen.", "Sie ermöglichen beliebige Softwareinstallation.", "Ein Update verhindert jedes Phishing.")
]);

const safety = course({
    id: "safety", title: "Arbeitssicherheit und Gesundheitsschutz", category: "Arbeitsschutz",
    description: "Allgemeine Musterunterweisung für Büro und vergleichbare Tätigkeiten. Behandelt ergonomisches Arbeiten, Gefährdungen sowie Grundsätze für Notfall und Brandschutz.",
    objectives: "Gefahren erkennen und melden. Einen Bildschirmarbeitsplatz ergonomisch organisieren. Bei einem Notfall die örtlichen Abläufe anwenden. Belastungen frühzeitig ansprechen.",
    summary: "Gefahren früh melden, Schutzmaßnahmen einhalten und keine ungesicherten Eingriffe vornehmen. Arbeitsplatz und Arbeitsweise regelmäßig anpassen. Notruf, Fluchtwege und Zuständigkeiten vor Ort kennen.",
}, [
    chapter("Verantwortung und Gefährdungen",
        "Arbeitsbedingungen müssen entsprechend der Tätigkeit beurteilt werden. Der Arbeitgeber organisiert Schutzmaßnahmen und eine auf Arbeitsplatz und Aufgabe bezogene Unterweisung. Beschäftigte folgen der Unterweisung, nutzen vorgesehene Schutzmittel und melden erhebliche unmittelbare Gefahren oder Defekte unverzüglich. Das frühzeitige Melden eines Beinaheunfalls kann spätere Unfälle verhindern.",
        ["Vor neuen Aufgaben örtliche Risiken und Schutzmaßnahmen klären.", "Schutzeinrichtungen erhalten und Defekte melden.", "Meldewege für Gefährdungen und Beinaheereignisse kennen."],
        "Ein beschädigtes Stromkabel liegt im Durchgang. Warnen Sie gefährdete Personen, nutzen Sie das Gerät nicht und informieren Sie die zuständige Stelle.",
        "Diese Musterunterweisung ergänzt die Einführung vor Ort. Die konkreten Risiken, Sammelstellen und Zuständigkeiten müssen am Arbeitsplatz erklärt werden."),
    chapter("Ergonomie am Bildschirmarbeitsplatz",
        "Ein angepasster Arbeitsplatz erleichtert Haltungswechsel und reduziert unnötige Belastung. Sitztiefe und -höhe richten sich nach der Person. Füße brauchen sicheren Halt, die Schultern bleiben möglichst locker. Bildschirm, Tastatur und Maus stehen so, dass häufige Bewegungen und längeres Arbeiten ohne verdrehte Haltung möglich sind. Blendung und ungünstige Beleuchtung können anstrengend sein.",
        ["Sitzhöhe und Rückenlehne anpassen.", "Bildschirm günstig zu Blickrichtung, Beleuchtung und Reflexionen ausrichten.", "Längere statische Arbeit durch Haltungswechsel und geeignete Tätigkeitswechsel unterbrechen."],
        "Bei Videokonferenzen am Laptop führt der niedrige Bildschirm zu einer dauerhaft geneigten Kopfhaltung. Ein externer Bildschirm oder eine geeignete Erhöhung mit externer Eingabe kann die Haltung verbessern."),
    chapter("Unfälle und gesundheitliche Belastungen vorbeugen",
        "Freie Verkehrswege, intakte Arbeitsmittel und übersichtliche Abläufe verhindern viele Unfälle. Belastung kann auch aus Zeitdruck, anhaltender Unterbrechung und fehlender Erholung entstehen. Sprechen Sie wiederkehrende Beschwerden oder Überlastung früh an, damit Arbeitsplatz und Arbeitsorganisation überprüft werden können.",
        ["Stolperstellen, nasse Böden und beschädigte Geräte melden.", "Passende Hilfsmittel für Transport oder Ablage nutzen.", "Anhaltende Belastungen sachlich mit Führungskraft oder zuständiger Ansprechperson klären."],
        "Ein Karton blockiert jeden Morgen den Gang. Beseitigen Sie die konkrete Gefahr, soweit gefahrlos möglich, und klären Sie eine dauerhafte Ablagelösung."),
    chapter("Notfall und Brandschutz",
        "Bei Gefahr zählen Orientierung, Alarmierung und Schutz der Beteiligten. Nutzen Sie den örtlichen Alarm- und Notfallplan, halten Sie Fluchtwege frei und begeben Sie sich zur vorgesehenen Sammelstelle. Leisten Sie Hilfe nur, soweit dies ohne Eigengefährdung möglich ist. Löschversuche kommen nur bei einem Entstehungsbrand und geeigneten Bedingungen in Betracht.",
        ["Vorab Fluchtwege, Notrufinformationen und Sammelstellen am Standort kennenlernen.", "Bei Alarm den ausgewiesenen Fluchtweg benutzen.", "Fakten für den Notruf nennen und Rückfragen abwarten."],
        "Rauch tritt aus einem Technikraum aus. Alarmieren Sie nach dem Notfallplan, warnen Sie andere soweit möglich und verlassen Sie den Gefahrenbereich über den ausgewiesenen Weg."),
    chapter("Melden, nachbereiten und lernen",
        "Eine Meldung sollte Beobachtung und Bewertung trennen. Ort, Zeit, betroffene Arbeitsmittel und beobachtete Folgen helfen bei der Untersuchung. Die Nachbereitung soll Ursachen beseitigen und Wiederholungen verhindern. Nach einem Vorfall sind die betrieblichen Prozesse für Hilfe, Dokumentation und Maßnahmen maßgeblich.",
        ["Beobachtungen, Zeit und Ort klar notieren.", "Bei unmittelbarer erheblicher Gefahr unverzüglich informieren.", "Maßnahmen und Rückmeldung mit der zuständigen Stelle klären."],
        "Ein Regal ist beinahe umgekippt. Auch ohne Verletzung lohnt sich die Meldung, etwa damit Befestigung und Lagerungsystem überprüft werden.")
], [
    single("Wer organisiert die arbeitsplatzbezogene Unterweisung?", "Der Arbeitgeber.", "Ausschließlich einzelne Beschäftigte privat.", "Nur die Hausverwaltung für alle Tätigkeiten.", "Die Regelung entfällt am Bildschirmarbeitsplatz."),
    single("Was tun Sie bei einer unmittelbaren erheblichen Gefahr?", "Unverzüglich melden und Eigengefährdung vermeiden.", "Erst am Monatsende berichten.", "Die Gefahr allein und ungeübt beseitigen.", "Sie als normalen Bestandteil der Arbeit ignorieren."),
    multiple("Was unterstützt ergonomische Bildschirmarbeit?", "Sitz und Eingabegeräte an die Person anpassen.", "Den Kopf über lange Zeit verdreht halten.", "Reflexionen reduzieren und Haltung regelmäßig wechseln.", "Anhaltende Beschwerden grundsätzlich ignorieren."),
    single("Warum sind auch Beinaheunfälle wichtig?", "Sie zeigen Gefährdungen, bevor jemand verletzt wird.", "Nur Sachschäden gelten als relevant.", "Sie erfordern grundsätzlich keine Aufmerksamkeit.", "Sie ersetzen die örtliche Unterweisung."),
    single("Was ist bei einem Brandalarm richtig?", "Den örtlichen Ablauf und ausgewiesene Fluchtwege nutzen.", "Zuerst nach persönlichen Gegenständen suchen.", "Den Aufzug als Standardfluchtweg wählen.", "Bis zu einer E-Mail im Raum bleiben."),
    multiple("Welche Angaben helfen bei der Gefahrenmeldung?", "Ort und Zeitpunkt.", "Gerüchte über Unbeteiligte.", "Betroffenes Arbeitsmittel und beobachteter Defekt.", "Ein erfundenes Ergebnis der Untersuchung."),
    single("Wie gehen Sie mit wiederkehrender Belastung um?", "Früh ansprechen und geeignete Maßnahmen prüfen lassen.", "Einfach immer weiterarbeiten.", "Erst bei einem Unfall dokumentieren.", "Die Belastung anderer Personen als Maßstab verwenden."),
    single("Was gilt für beschädigte Arbeitsmittel?", "Nicht weiter nutzen und den Defekt melden.", "Kurz weiterverwenden, solange ein Termin naht.", "Immer selbst reparieren.", "Nur die Farbe der Markierung prüfen."),
    multiple("Was sollte man vor einem Notfall kennen?", "Ausgewiesene Fluchtwege.", "Private Nummern aller Kollegen.", "Sammelstelle und örtliche Alarmwege.", "Den Standort persönlicher Gegenstände als Priorität."),
    single("Warum braucht es eine Unterweisung vor Ort zusätzlich?", "Gefahren, Aufgaben und Notfallwege unterscheiden sich je nach Arbeitsplatz.", "Eine allgemeine Lerneinheit gilt automatisch für alle Arbeitsplätze.", "Die Frage betrifft nur neue Büromöbel.", "Eine Einweisung ist nur nach einem Unfall sinnvoll.")
]);

const compliance = course({
    id: "compliance", title: "Compliance und Verhaltenskodex", category: "Compliance",
    description: "Allgemeine Musterunterweisung zu Integrität, fairen Entscheidungen, vertraulichen Informationen und sicheren Meldewegen.",
    objectives: "Interessenkonflikte und unzulässige Einflussnahme erkennen. Informationen vertraulich behandeln. Respektvolles Verhalten fördern und Vorfälle über geeignete Wege melden.",
    summary: "Entscheidungen nachvollziehbar und unabhängig treffen. Interessenkonflikte früh offenlegen. Vertrauliche Daten nur aufgabenbezogen teilen. Sachliche Hinweise über geeignete Meldewege weitergeben."
}, [
    chapter("Compliance und Integrität",
        "Compliance bedeutet, Regeln und berechtigte Anforderungen im Arbeitsalltag einzuhalten. Integrität zeigt sich besonders dann, wenn Zeitdruck oder persönliche Vorteile Entscheidungen beeinflussen könnten. Eine nachvollziehbare Entscheidung hält Kriterien und Beteiligte fest und nutzt die vorgesehenen Freigaben.",
        ["Bei Unsicherheit geltende Vorgaben und zuständige Ansprechstelle klären.", "Entscheidungskriterien vor persönlicher Einflussnahme schützen.", "Abweichungen und Freigaben sachlich dokumentieren."],
        "Eine Bestellung ist dringend. Die vorgesehene Prüfung zu überspringen kann Folgekosten verursachen. Besprechen Sie mit der zuständigen Stelle, welche beschleunigte Freigabe möglich ist."),
    chapter("Interessenkonflikte und Vorteile",
        "Ein Interessenkonflikt entsteht, wenn private Beziehungen oder finanzielle Interessen dienstliche Entscheidungen beeinflussen könnten oder so wirken. Bereits der Anschein kann Vertrauen beschädigen. Geschenke und Einladungen sind besonders kritisch, wenn eine Vergabe oder Entscheidung unmittelbar ansteht. Schwellenwerte und Genehmigungsregeln richten sich nach den jeweiligen Organisationsvorgaben.",
        ["Relevante private Beziehungen vor Entscheidungen offenlegen.", "Bei unklaren Vorteilen die zuständige Stelle konsultieren.", "Bei einem Konflikt eine unabhängige Beteiligung oder Übernahme der Entscheidung ermöglichen."],
        "Ein Familienmitglied arbeitet bei einem Anbieter im laufenden Auswahlverfahren. Legen Sie die Beziehung offen und lassen Sie die Beteiligung an der Auswahl unabhängig entscheiden."),
    chapter("Vertrauliche Informationen",
        "Geschäftsinformationen können vertraulich sein, auch wenn sie keine personenbezogenen Daten enthalten. Preisangebote, Vertragsentwürfe oder interne Planungen können Beteiligte unfair beeinflussen, wenn sie unberechtigt geteilt werden. Zugriff richtet sich nach Rolle, Zweck und Freigabe.",
        ["Empfängerberechtigung vor einer Freigabe prüfen.", "Vertrauliches in zugelassenen Systemen speichern.", "Vertrauliche Themen nicht in öffentlich zugänglicher Umgebung besprechen."],
        "Ein Anbieter bittet um ein Angebot eines Mitbewerbers zum Vergleich. Geben Sie das Dokument ohne entsprechende Freigabe nicht weiter."),
    chapter("Gleichbehandlung und respektvolles Verhalten",
        "Ein professioneller Umgang wahrt Würde und respektiert Grenzen. Auswahl- und Leistungsentscheidungen sollen auf transparenten, aufgabenbezogenen Kriterien beruhen. Benachteiligungen und Belästigung müssen ernst genommen werden. Das AGG sieht für Beschäftigte ein Beschwerderecht vor. Der Arbeitgeber hat im gesetzlichen Anwendungsbereich Schutzmaßnahmen zu treffen.",
        ["Beobachtungen konkret und respektvoll benennen.", "Zuständige Beschwerde- oder Personalstelle nutzen.", "Betroffene unterstützen, ohne den Vorfall eigenmächtig zu verbreiten."],
        "Ein Teammitglied wird wiederholt wegen einer geschützten Eigenschaft herabgesetzt. Unterstützen Sie die betroffene Person und halten Sie sich an den vorgesehenen Beschwerdeweg."),
    chapter("Regelverstöße sicher ansprechen",
        "Für Hinweise auf Rechtsverstöße und für persönliche Beschwerden können unterschiedliche Meldestellen zuständig sein. Das Hinweisgeberschutzgesetz definiert seinen eigenen sachlichen Anwendungsbereich. Unabhängig davon sollten Meldungen Beobachtungen von Vermutungen trennen. Vertrauliche Angaben gehören in dafür vorgesehene Kanäle.",
        ["Geeigneten Kanal nach Sachverhalt wählen.", "Daten sparsam übermitteln und Fakten nachvollziehbar schildern.", "Hinweise vertraulich behandeln und den vorgesehenen Prozess nutzen."],
        "Sie stellen unerklärliche Änderungen an einer Freigabe fest. Halten Sie Datum und beobachtete Änderungen fest und melden Sie den Sachverhalt über den passenden Kanal.",
        "Diese Musterunterweisung legt keine betrieblichen Grenzwerte, Zuständigkeiten oder Meldekanäle fest.")
], [
    single("Wie reagieren Sie, wenn ein Familienmitglied bei einem Bieter arbeitet?", "Beziehung offenlegen und die eigene Mitwirkung klären lassen.", "Die Beziehung grundsätzlich verschweigen.", "Den Bieter ohne Prüfung bevorzugen.", "Dem Bieter interne Angebote zusenden."),
    single("Was gilt bei einem Geschenk kurz vor einer Vergabe?", "Vorgaben prüfen und den Vorteil zur Klärung offenlegen.", "Immer annehmen, wenn er persönlich übergeben wird.", "Nur nach dem Preisetikett entscheiden.", "Das Geschenk geheim halten."),
    multiple("Welche Maßnahmen fördern unabhängige Entscheidungen?", "Kriterien vorab festlegen.", "Private Beziehungen als Auswahlkriterium nutzen.", "Interessenkonflikte transparent machen.", "Freigaben bei Zeitdruck stillschweigend umgehen."),
    single("Wie behandeln Sie ein vertrauliches Wettbewerbsangebot?", "Nur für Berechtigte und entsprechend dem Zweck freigeben.", "Als unverbindliches Beispiel öffentlich teilen.", "Auf ein persönliches Konto senden.", "Mit dem Mitbewerber unkoordiniert besprechen."),
    single("Welche Grundlage ist für Personalentscheidungen sinnvoll?", "Transparente Kriterien mit Bezug zur Aufgabe.", "Persönliche Vorurteile.", "Informelle Gerüchte.", "Ein möglichst enger privater Bekanntenkreis."),
    multiple("Was gehört in eine sachliche Meldung?", "Beobachtetes Verhalten oder dokumentierte Änderung.", "Ungeprüfte Behauptungen als Tatsachen.", "Relevanter Zeitpunkt und Kontext.", "Eine vollständige Liste unbeteiligter Personen."),
    single("Wer kann eine Beschwerde wegen Benachteiligung im Beschäftigungskontext entgegennehmen?", "Die im Betrieb zuständige Beschwerdestelle.", "Ausschließlich ein beliebiger externer Anbieter.", "Nur der Absender einer Rundmail.", "Grundsätzlich niemand im Betrieb."),
    single("Welchen Zweck erfüllt eine dokumentierte Freigabe?", "Sie macht Entscheidung und Verantwortlichkeit nachvollziehbar.", "Sie ersetzt die Prüfung.", "Sie gewährleistet jede private Ausnahme.", "Sie dient nur der Ablage von Kontaktdaten."),
    multiple("Was schützt Vertraulichkeit bei Meldungen?", "Den vorgesehenen vertraulichen Kanal verwenden.", "Die Meldung in einem offenen Chat veröffentlichen.", "Daten auf relevante Angaben beschränken.", "Allen Beteiligten ungeprüft private Details weiterleiten."),
    single("Warum muss der passende Meldeweg geprüft werden?", "Beschwerden und Hinweise können unterschiedlichen Verfahren unterliegen.", "Jede Meldung gehört stets in einen öffentlichen Kanal.", "Rechtsverstöße dürfen nie angesprochen werden.", "Der Meldeweg hängt ausschließlich vom Dateiformat ab.")
]);

const communication = course({
    id: "communication", title: "Feedback im Team", category: "Zusammenarbeit", mandatory: false,
    audience: "assigned", validityMonths: null, renewalDays: null,
    description: "Optionale Praxiswerkstatt für klare und konstruktive Rückmeldungen im Team.",
    objectives: "Beobachtung und Bewertung trennen, Wirkung erklären und gemeinsam einen nächsten Schritt vereinbaren.",
    summary: "Feedback konkret, zeitnah und respektvoll geben. Die Sicht des Gegenübers erfragen und die Vereinbarung später überprüfen."
}, [
    chapter("Beobachtung und Wirkung", "Nennen Sie eine konkrete Situation, beschreiben Sie beobachtbares Verhalten und erklären Sie die Wirkung. Allgemeine Urteile helfen selten dabei, Verhalten zu verändern.",
        ["Zeitpunkt und Situation eingrenzen.", "Wirkung aus eigener Sicht erklären."], "Die Entscheidung im Protokoll war für mich unklar. Können wir Zuständigkeit und Frist ergänzen?"),
    chapter("Gespräch führen", "Ein geeigneter Rahmen eröffnet ein Gespräch auf Augenhöhe. Fragen Sie nach der anderen Perspektive und vereinbaren Sie gemeinsam, was als Nächstes geschieht.",
        ["Rückfragen ermöglichen.", "Eine konkrete Vereinbarung treffen."], "Vereinbaren Sie, dass zu Beginn des nächsten Termins die offenen Entscheidungen kurz bestätigt werden.")
], [
    single("Was macht Feedback überprüfbar?", "Eine konkrete Beobachtung in einer benannten Situation.", "Ein pauschales Urteil.", "Eine Vermutung über Motive.", "Ein Vergleich mit Unbeteiligten."),
    single("Was folgt auf die Schilderung der Wirkung?", "Die Perspektive des Gegenübers erfragen.", "Das Gespräch sofort beenden.", "Die Person bewerten.", "Die Beobachtung öffentlich wiederholen."),
    multiple("Was gehört zu einer nutzbaren Vereinbarung?", "Ein konkreter nächster Schritt.", "Eine unklare pauschale Forderung.", "Eine Gelegenheit, die Wirkung zu überprüfen.", "Die Wiederholung einer Schuldzuweisung."),
    single("Wo besprechen Sie persönlich sensibles Feedback?", "In einem geeigneten, vertraulichen Rahmen.", "In einer öffentlichen Rundmail.", "Vor möglichst vielen Zuhörern.", "In einem anonymen Kommentar an alle."),
    single("Woran lässt sich Wirkung später beurteilen?", "An der gemeinsam vereinbarten beobachtbaren Änderung.", "An Gerüchten.", "An der Länge des Gesprächs.", "An der Anzahl der Empfänger.")
]);

module.exports = [privacy, security, safety, compliance, communication];
