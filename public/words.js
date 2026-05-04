const WORDS = {

  4: [
    "aard","adem","aker","arts","auto","baas","band","bank","beeld","been",
    "bier","blad","blok","boer","boom","boot","bord","brok","daad","dakje",
    "dans","deur","dier","doel","doek","doen","dorp","duel","duim","echt",
    "egel","eind","elft","eten","fiets","film","flap","gast","geel","geld",
    "glas","goud","gras","hart","heer","hond","hoop","jaar","kaas","kind",
    "koud","lach","land","lamp","leven","lied","lijn","maal","maan","meer",
    "mens","merk","moed","mooi","naam","neus","noot","ogen","paal","paard",
    "plan","plek","prijs","raad","reis","rood","rook","ruim","scha","slag",
    "snee","stad","stem","stok","taal","team","tijd","toon","trap","trek",
    "tuin","uur","veld","vier","voet","vorm","wand","warm","water","werk",
    "wind","wolf","zaak","zand","zeep","zien","zout","zwem"
  ],

  5: [
    "aarde","adres","actie","appel","avond","baard","basis","beeld","bezig",
    "beter","beurt","bloed","boord","brand","brief","broek","buurt","dacht",
    "dagen","dicht","dienst","droom","einde","extra","fiets","fout","fruit",
    "geest","geldt","geluk","gezin","grond","groep","groot","haard","handy",
    "harde","hemel","hobby","hotel","index","jacht","kader","kamer","kassa",
    "koken","kracht","krant","kruis","kunst","laser","later","leven","licht",
    "lunch","maand","markt","media","meter","model","motor","nacht","nieuw",
    "onder","orde","ouder","paard","piano","plaats","plein","prijs","radio",
    "reden","regel","ritme","rondt","samen","scherp","shirt","smaak","spoor",
    "sport","staat","stand","steen","stoel","straat","tafel","tekst","tempo",
    "thema","trots","vloer","vraag","vrede","waarde","water","wegen","wereld",
    "werk","winst","woord","zacht","zeker","zicht","zomer","zwaar"
  ],

  6: [
    "aantal","advies","afspraak","agenda","arbeid","artikel","bedrijf",
    "bezoek","bezigheid","beweging","budget","bureau","camera","centra",
    "contact","credit","detail","direct","effect","energie","functie",
    "gebruik","geheel","gevoel","gezicht","handel","herstel","ideeën",
    "impact","inkoop","invoer","kantoor","kennis","kosten","kracht",
    "leider","lengte","letter","leiding","logica","manager","markt",
    "middel","modelle","module","niveau","online","oploss","order",
    "pakket","periode","positie","proces","product","profiel","project",
    "public","reactie","result","risico","sector","service","signaal",
    "systeem","taakje","theorie","toegang","traject","unieke","update",
    "waarde","verhaal","versie","volume","werking","winkel","zekerheid"
  ]
};

if (typeof window !== "undefined") {
  window.WORDS = WORDS;
}

if (typeof module !== "undefined") {
  module.exports = WORDS;
}