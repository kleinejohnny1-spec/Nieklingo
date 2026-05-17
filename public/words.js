const WORDS = {

  4: [
  "aard","adem","aker","arts","auto","baas","band","bank","been",
  "bier","blad","blok","boer","boom","boot","bord","brok","daad",
  "dans","deur","dier","doel","doek","doen","dorp","duel","duim",
  "echt","egel","eind","eten","film","gast","geel","geld","glas",
  "goud","gras","hart","heer","hond","hoop","jaar","kaas","kind",
  "koud","lach","land","lamp","lied","lijn","maal","maan","meer",
  "mens","merk","moed","mooi","naam","neus","noot","ogen","paal",
  "plan","plek","raad","reis","rood","rook","ruim","slag","stad",
  "stem","stok","taal","team","tijd","toon","trap","trek","tuin",
  "uur","veld","vier","voet","vorm","wand","warm","werk","wind",
  "wolf","zaak","zand","zeep","zien","zout","zwem","anker","appel",
  "arend","baker","bende","bloem","breed","brief","brood","buik",
  "clown","deken","draad","droom","duif","engel","gamer","geit",
  "glim","grap","groef","haven","heks","joker","kaars","kerel",
  "kist","klap","klok","knaap","knoop","koker","kroon","kruis",
  "laden","laser","leger","links","maker","markt","meter","molen",
  "motor","nevel","noten","oever","olijf","panda","plant","plein",
  "prins","radio","regen","robot","roker","schip","sjaal","slang",
  "smaak","stoel","storm","strip","super","trein","truck","vader",
  "vlees","vloer","vogel","wagen","winst","zebra","zomer","zwaard"
],

  5: [
  "aarde","adres","actie","akker","album","alarm","ander","arena","avond",
  "baard","banen","basis","beeld","bezig","beter","beurt","bingo","blauw",
  "bloed","bonus","boord","brand","brief","broek","bruin","buurt","chaos",
  "dacht","dagen","daler","dames","dicht","dienst","draad","drank","drift",
  "droom","duwen","eigen","einde","extra","fiets","flora","forum","frame",
  "fruit","gamer","gaven","geest","geldt","geluk","gezin","glans","glimp",
  "groei","groep","groot","grond","haard","harde","haven","helder","hemel",
  "hobby","hotel","index","jacht","jaren","joker","juist","kabel","kader",
  "kamer","kaart","kassa","keuze","klimt","knoop","kogel","koken","koren",
  "kracht","krant","kruis","kunst","laser","later","leden","level","leven",
  "licht","links","lente","lunch","maand","maker","markt","media","meter",
  "model","motor","motto","muziek","nacht","nieuw","noord","oever","omweg",
  "onder","orde","ouder","paard","paden","peper","piano","plaats","plank",
  "plein","ploeg","poets","prins","prijs","quota","radio","raden","reden",
  "regen","regel","robot","route","ruzie","saldo","samen","scherp","shirt",
  "shift","skate","slang","smaak","snoep","spoor","sport","staat","stand",
  "steen","stoel","storm","straat","straf","super","sfeer","tafel","tekst",
  "tempo","thema","toast","trein","troep","trots","truck","typen","varen",
  "vegen","vloer","vlees","vogel","vraag","vrede","wagen","waren","water",
  "wegen","wereld","wezen","wilde","winst","woord","zacht","zebra","zeker",
  "zeven","zicht","zilver","zomer","zwaar","chaos","chaos","chaos","chaos"
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