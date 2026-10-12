/**
 * German for the short strings that arrive *with the data* -- rock names, source notes, sentence
 * patterns. Not an i18next resource: these translate values, not interface keys, and a pack may add
 * its own with its `de` map (see src/core/dataText.ts).
 *
 * Lifted out of the hand-written index.html unchanged.
 */

/** Exact matches, English -> German. */
export const DATA_DE: Readonly<Record<string, string>> = {
    "Bergfreunde blog": "Bergfreunde-Blog",
    "Commercial topo platform": "Kommerzielle Topo-Plattform",
    "Community database": "Community-Datenbank",
    "Community database / blog": "Community-Datenbank / Blog",
    "Community logbook": "Community-Logbuch",
    "Free topo by the bolters": "Gratis-Topo der Erschliesser",
    "GPS of crag and car park, orientation, approach":
        "GPS von Fels und Parkplatz, Ausrichtung, Zustieg",
    Gneiss: "Gneis",
    Granite: "Granit",
    High: "Hoch",
    "Local climbing association": "Lokaler Kletterverein",
    "Local climbing blog": "Lokaler Kletterblog",
    Low: "Tief",
    Medium: "Mittel",
    "Official destination body": "Offizielle Destinationsorganisation",
    Open: "Offen",
    Rain: "Regen",
    Sport: "Sport",
    "Sport (single-pitch and multi-pitch)": "Sport (Ein- und Mehrseillängen)",
    "Sport, multi-pitch": "Sport, Mehrseillängen",
    "Sport, single + multi-pitch": "Sport, Ein- und Mehrseillängen",
    "Sport, single and multi-pitch": "Sport, Einseillängen und Mehrseillängen",
    Unverified: "Ungeprüft",
    "Verezzi – Caprazoppa plateau": "Verezzi – Hochebene Caprazoppa",
    "Walking times": "Gehzeiten",
    "Web page": "Webseite",
    "access, parking, walking time, character": "Zufahrt, Parkplatz, Gehzeit, Charakter",
    "approximate coordinates": "ungefähre Koordinaten",
    "car park (the wall itself is not located)": "Parkplatz (die Wand selbst ist nicht verortet)",
    "car park GPS, walking time, orientation, grades": "Parkplatz-GPS, Gehzeit, Ausrichtung, Grade",
    "climbing site in OpenStreetMap": "Klettergebiet in OpenStreetMap",
    coordinates: "Koordinaten",
    "counted from the route list": "aus der Routenliste gezählt",
    "crag (GPS point of the crag page)": "Fels (GPS-Punkt der Felsseite)",
    east: "Ost",
    "east and west": "Ost und West",
    "existence, approach, character": "Existenz, Zustieg, Charakter",
    "existence, route count, typical height (area table only; the crag page itself could not be read)":
        "Existenz, Routenzahl, typische Höhe (nur Gebietstabelle; die Felsseite selbst konnte nicht gelesen werden)",
    gneiss: "Gneis",
    granite: "Granit",
    "independent listing of the crag; route count": "unabhängiger Eintrag des Felsens; Routenzahl",
    "independent listing of the crag; route count; typical height":
        "unabhängiger Eintrag des Felsens; Routenzahl; typische Höhe",
    limestone: "Kalk",
    "link only; the page would not open": "nur Link; die Seite liess sich nicht öffnen",
    "map pin, parking text, walking time, approach":
        "Kartenmarkierung, Parkplatztext, Gehzeit, Zustieg",
    "name, orientation, grades, route list, coordinates, parking, approach":
        "Name, Ausrichtung, Grade, Routenliste, Koordinaten, Parkplatz, Zustieg",
    "name, status, orientation, grades, route list, description, warnings":
        "Name, Status, Ausrichtung, Grade, Routenliste, Beschreibung, Warnhinweise",
    north: "Nord",
    "north, south, east, west": "Nord, Süd, Ost, West",
    "north, south, west, east": "Nord, Süd, West, Ost",
    "north-east": "Nordost",
    "north-west": "Nordwest",
    "one point for several sectors": "ein Punkt für mehrere Sektoren",
    "order of the routes from left to right": "Reihenfolge der Routen von links nach rechts",
    "order of the routes from left to right, lengths":
        "Reihenfolge der Routen von links nach rechts, Längen",
    "order of the routes from left to right, routes missing from the other lists":
        "Reihenfolge der Routen von links nach rechts, in den anderen Listen fehlende Routen",
    "order of the routes from left to right, routes missing from the other lists, lengths":
        "Reihenfolge der Routen von links nach rechts, in den anderen Listen fehlende Routen, Längen",
    "orientation, route length, approach, map point":
        "Ausrichtung, Routenlänge, Zustieg, Kartenpunkt",
    "partly verified": "teilweise geprüft",
    "route beauty stars (1–5) and number of logged ascents":
        "Schönheitssterne der Routen (1–5) und Anzahl eingetragener Begehungen",
    "route count; the page would not open": "Routenzahl; die Seite liess sich nicht öffnen",
    "route list in wall order, lengths, pitches, position":
        "Routenliste in Wandreihenfolge, Längen, Seillängen, Position",
    "route list with the order from left to right":
        "Routenliste mit der Reihenfolge von links nach rechts",
    "route list with the order from left to right, lengths":
        "Routenliste mit der Reihenfolge von links nach rechts, Längen",
    "route list, grades, community rating and logged ascents":
        "Routenliste, Grade, Community-Bewertung und eingetragene Begehungen",
    "route names and grades (sorted by ascents, not by the wall)":
        "Routennamen und Grade (nach Begehungen sortiert, nicht nach der Wand)",
    south: "Süd",
    "south, south-east and east": "Süd, Südost und Ost",
    "south-east": "Südost",
    "south-west": "Südwest",
    "sun and shade, rain": "Sonne und Schatten, Regen",
    "sun and shade, rain, families, walking time, parking":
        "Sonne und Schatten, Regen, Familien, Gehzeit, Parkplatz",
    unverified: "ungeprüft",
    verified: "geprüft",
    "web research, not checked on site": "Webrecherche, nicht vor Ort geprüft",
    west: "West",
};

/** Patterns, applied in order when no exact match was found. */
export const DATA_DE_RX: readonly (readonly [RegExp, string])[] = [
    [
        /^coordinates \((\d+) m from the official pin\)$/,
        "Koordinaten ($1 m von der offiziellen Markierung)",
    ],
    [/^(.+) places it (\d+) m away$/, "$1 setzt es $2 m entfernt"],
    [/^route list: (.+)$/, "Routenliste: $1"],
];
