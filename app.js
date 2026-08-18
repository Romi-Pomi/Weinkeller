const $ = id => document.getElementById(id);
const fieldIds = ["ean","winery","vintage","type","grapes","country","region","appellation","predicate","alcohol","size","qty","price","shelf","slot","notes"];
let currentImage = null;

const GRAPES = [
  "Riesling","Chardonnay","Sauvignon Blanc","Grauburgunder","Pinot Gris","Pinot Grigio","Weißburgunder","Weissburgunder","Pinot Blanc",
  "Chenin Blanc","Gewürztraminer","Gewurztraminer","Silvaner","Müller-Thurgau","Muller-Thurgau","Grüner Veltliner","Gruner Veltliner",
  "Pinot Noir","Spätburgunder","Spaetburgunder","Cabernet Sauvignon","Merlot","Cabernet Franc","Syrah","Shiraz","Grenache","Tempranillo",
  "Sangiovese","Nebbiolo","Barbera","Malbec","Carménère","Carmenere","Zinfandel","Primitivo","Gamay","Mourvèdre","Mourvedre"
];

const REGIONS = [
  ["Mosel","Deutschland"],["Rheingau","Deutschland"],["Pfalz","Deutschland"],["Nahe","Deutschland"],["Ahr","Deutschland"],
  ["Rheinhessen","Deutschland"],["Baden","Deutschland"],["Franken","Deutschland"],["Württemberg","Deutschland"],["Wurttemberg","Deutschland"],
  ["Bordeaux","Frankreich"],["Burgund","Frankreich"],["Bourgogne","Frankreich"],["Champagne","Frankreich"],["Rhône","Frankreich"],["Rhone","Frankreich"],
  ["Loire","Frankreich"],["Elsass","Frankreich"],["Alsace","Frankreich"],["Provence","Frankreich"],
  ["Rioja","Spanien"],["Ribera del Duero","Spanien"],["Priorat","Spanien"],["Rías Baixas","Spanien"],["Rias Baixas","Spanien"],
  ["Toskana","Italien"],["Toscana","Italien"],["Piemont","Italien"],["Piemonte","Italien"],["Veneto","Italien"],["Sizilien","Italien"],["Sicilia","Italien"],
  ["Napa Valley","USA"],["Sonoma","USA"],["Mendoza","Argentinien"],["Barossa","Australien"],["Marlborough","Neuseeland"]
];

const PREDICATES = ["Kabinett","Spätlese","Spaetlese","Auslese","Beerenauslese","Trockenbeerenauslese","Eiswein","Grosses Gewächs","Großes Gewächs","GG"];
const APPELLATION_WORDS = /(appellation|grand cru|premier cru|1er cru|classico|riserva|reserva|gran reserva|docg|doc\b|dop\b|aoc\b|ava\b|cru\b|trocken\b|feinherb\b|treppchen|sonnenuhr|würzgarten|wuerzgarten|himmelreich|goldtröpfchen|goldtroepfchen|kastanienbusch|morstein|kirchspiel|pechstein)/i;
const NOISE = /(weingut|wein|wine|mis en bouteille|abgefüllt|abgefullt|erzeugerabfüllung|erzeugerabfullung|contains sulfites|enthält sulfite|produkt|product of|alc\.?|vol\.?|750\s*ml|75\s*cl)/i;

function normalizeText(text){
  return text
    .replace(/[|]/g,"I")
    .replace(/[“”„]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/\s+/g," ")
    .trim();
}
function linesFrom(text){
  return text.split(/\r?\n/).map(normalizeText).filter(x => x.length >= 2);
}
function esc(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function setIfEmpty(id,val){ if(val && !$(id).value.trim()) $(id).value = val; }
function fuzzyIncludes(text, target){
  const t = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  const q = target.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  return t.includes(q);
}

function classifyWineType(grapes, text){
  const white = ["Riesling","Chardonnay","Sauvignon Blanc","Grauburgunder","Pinot Gris","Pinot Grigio","Weißburgunder","Weissburgunder","Pinot Blanc","Chenin Blanc","Gewürztraminer","Gewurztraminer","Silvaner","Müller-Thurgau","Muller-Thurgau","Grüner Veltliner","Gruner Veltliner"];
  const red = ["Pinot Noir","Spätburgunder","Spaetburgunder","Cabernet Sauvignon","Merlot","Cabernet Franc","Syrah","Shiraz","Grenache","Tempranillo","Sangiovese","Nebbiolo","Barbera","Malbec","Carménère","Carmenere","Zinfandel","Primitivo","Gamay","Mourvèdre","Mourvedre"];
  if(/champagne|sekt|spumante|cava|cr[eé]mant/i.test(text)) return "Schaumwein";
  if(/ros[eé]/i.test(text)) return "Rosé";
  if(grapes.some(g=>white.includes(g))) return "Weißwein";
  if(grapes.some(g=>red.includes(g))) return "Rotwein";
  return "";
}

function likelyWinery(lines, knownTokens){
  // Prefer prominent-looking lines in the upper half, but reject years, regions, grapes and generic wine terms.
  const top = lines.slice(0, Math.min(8, lines.length));
  const candidates = top.filter(line => {
    if(line.length < 4 || line.length > 45) return false;
    if(/\b(19|20)\d{2}\b/.test(line)) return false;
    if(NOISE.test(line)) return false;
    if(knownTokens.some(t=>fuzzyIncludes(line,t))) return false;
    if(!/[A-Za-zÀ-ÿ]/.test(line)) return false;
    return true;
  });
  if(!candidates.length) return "";
  // Names tend to be two or more words and not dominated by punctuation.
  candidates.sort((a,b)=>{
    const score = s => (s.split(/\s+/).length>=2?3:0) + (/[A-ZÀ-Ý][a-zà-ÿ]+/.test(s)?2:0) + Math.min(s.length,24)/24;
    return score(b)-score(a);
  });
  return candidates[0].replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ0-9'.& -]+$/g,"").trim();
}

function likelyAppellation(lines, knownTokens, winery){
  // Prefer a non-generic line around vintage/predicate/grape/region.
  const vintageIndex = lines.findIndex(l=>/\b(19|20)\d{2}\b/.test(l));
  const predIndex = lines.findIndex(l=>PREDICATES.some(p=>fuzzyIncludes(l,p)));
  const regionIndex = lines.findIndex(l=>REGIONS.some(([r])=>fuzzyIncludes(l,r)));
  const anchors = [vintageIndex,predIndex,regionIndex].filter(i=>i>=0);
  let pool = [];
  if(anchors.length){
    const lo = Math.max(0, Math.min(...anchors)-2), hi = Math.min(lines.length, Math.max(...anchors)+2);
    pool = lines.slice(lo,hi);
  } else pool = lines.slice(1,10);

  const candidates = pool.filter(line=>{
    if(line === winery) return false;
    if(/\b(19|20)\d{2}\b/.test(line)) return false;
    if(NOISE.test(line)) return false;
    if(knownTokens.some(t=>fuzzyIncludes(line,t))) return false;
    if(line.length < 4 || line.length > 55) return false;
    return /[A-Za-zÀ-ÿ]/.test(line);
  });
  const explicit = candidates.find(c=>APPELLATION_WORDS.test(c));
  if(explicit) return explicit;
  // German vineyard names often sit immediately before Kabinett/Spätlese etc.
  if(predIndex > 0){
    const prev = lines[predIndex-1];
    if(prev && !knownTokens.some(t=>fuzzyIncludes(prev,t)) && !/\b(19|20)\d{2}\b/.test(prev)) return prev;
  }
  return candidates[0] || "";
}

function parseLabel(text){
  const lines = linesFrom(text);
  const flat = normalizeText(text);

  const vintage = (flat.match(/\b(19[5-9]\d|20[0-3]\d)\b/)||[])[0] || "";

  const grapes = GRAPES.filter(g=>fuzzyIncludes(flat,g));
  const grapeUnique = [...new Set(grapes.map(g => g==="Weissburgunder"?"Weißburgunder":g==="Spaetburgunder"?"Spätburgunder":g))];

  let region="", country="";
  for(const [r,c] of REGIONS){ if(fuzzyIncludes(flat,r)){ region=r; country=c; break; } }

  let predicate="";
  for(const p of PREDICATES){ if(fuzzyIncludes(flat,p)){ predicate = p.replace("Spaetlese","Spätlese"); break; } }

  let alcohol="";
  const am = flat.match(/(\d{1,2}(?:[.,]\d)?)\s*%?\s*(?:vol\.?|alc\.?)/i) || flat.match(/alc\.?\s*(\d{1,2}(?:[.,]\d)?)/i);
  if(am) alcohol=(am[1]||"").replace(".",",");

  let size="";
  if(/\b0[.,]75\s*l\b/i.test(flat) || /\b75\s*cl\b/i.test(flat) || /\b750\s*ml\b/i.test(flat)) size="0,75";
  else if(/\b1[.,]5\s*l\b/i.test(flat)) size="1,5";
  else if(/\b0[.,]375\s*l\b/i.test(flat) || /\b375\s*ml\b/i.test(flat)) size="0,375";

  const type = classifyWineType(grapeUnique, flat);
  const tokens = [...grapeUnique, region, country, predicate].filter(Boolean);
  const winery = likelyWinery(lines, tokens);
  const appellation = likelyAppellation(lines, tokens, winery);

  return {winery,vintage,type,grapes:grapeUnique.join(", "),country,region,appellation,predicate,alcohol,size,lines};
}

async function handleFile(file){
  if(!file) return;
  currentImage=file;
  const url=URL.createObjectURL(file);
  $("preview").src=url; $("preview").style.display="block";
  $("analyzeBtn").disabled=false;
  showStatus("Foto geladen. Tippe auf „Etikett lokal analysieren“.", true);
}
$("cameraInput").addEventListener("change",e=>handleFile(e.target.files[0]));
$("galleryInput").addEventListener("change",e=>handleFile(e.target.files[0]));

function showStatus(msg, ok=false){
  const s=$("status"); s.style.display="block"; s.className=ok?"ok":"warn"; s.textContent=msg;
}

$("analyzeBtn").addEventListener("click", async ()=>{
  if(!currentImage) return;
  if(typeof Tesseract==="undefined"){ showStatus("OCR-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen."); return; }
  $("analyzeBtn").disabled=true; $("progress").style.display="block"; $("bar").style.width="2%";
  showStatus("Etikett wird auf diesem Gerät gelesen …", true);
  try{
    const result = await Tesseract.recognize(currentImage, "deu+eng", {
      logger: m => {
        if(m.status==="recognizing text" && typeof m.progress==="number"){
          $("bar").style.width=Math.round(m.progress*100)+"%";
        }
      }
    });
    const text=result.data.text||"";
    $("ocrText").textContent=text;
    const p=parseLabel(text);
    setIfEmpty("winery",p.winery);
    setIfEmpty("vintage",p.vintage);
    setIfEmpty("type",p.type);
    setIfEmpty("grapes",p.grapes);
    setIfEmpty("country",p.country);
    setIfEmpty("region",p.region);
    setIfEmpty("appellation",p.appellation);
    setIfEmpty("predicate",p.predicate);
    setIfEmpty("alcohol",p.alcohol);
    if(p.size) $("size").value=p.size;
    showStatus("Etikett erkannt. Bitte die Felder kurz prüfen – unsichere Angaben werden lieber leer gelassen.", true);
  }catch(err){
    console.error(err);
    showStatus("Die Etiketterkennung ist fehlgeschlagen. Bitte Foto erneut aufnehmen oder ein schärferes Bild wählen.");
  }finally{
    $("analyzeBtn").disabled=false; $("bar").style.width="100%";
  }
});

function getForm(){
  const x={}; fieldIds.forEach(id=>x[id]=$(id).value.trim());
  x.savedAt=new Date().toISOString(); return x;
}
function clearForm(){
  fieldIds.forEach(id=>$(id).value="");
  $("size").value="0,75"; $("qty").value="1";
  $("preview").style.display="none"; $("preview").src=""; currentImage=null;
  $("ocrText").textContent=""; $("status").style.display="none"; $("progress").style.display="none"; $("bar").style.width="0";
  $("cameraInput").value=""; $("galleryInput").value="";
}
function loadArchive(){ try{return JSON.parse(localStorage.getItem("wineArchiveV4")||"[]")}catch{return []} }
function saveArchive(a){localStorage.setItem("wineArchiveV4",JSON.stringify(a));renderArchive();}
$("saveBtn").addEventListener("click",()=>{
  const item=getForm();
  if(!item.winery && !item.appellation){showStatus("Bitte mindestens Weingut oder Lage / Appellation eintragen.");return}
  const a=loadArchive(); a.unshift(item); saveArchive(a); showStatus("Wein wurde auf diesem Gerät gespeichert.",true);
});
$("clearBtn").addEventListener("click",clearForm);
$("wipeBtn").addEventListener("click",()=>{if(confirm("Wirklich das komplette lokale Archiv löschen?"))saveArchive([])});

function renderArchive(){
  const a=loadArchive(), el=$("archive");
  if(!a.length){el.innerHTML='<div class="muted">Noch keine Weine gespeichert.</div>';return}
  el.innerHTML=a.map((w,i)=>`<div class="archive-item">
    <strong>${esc([w.winery,w.vintage,w.appellation].filter(Boolean).join(" · "))}</strong><br>
    <span>${esc([w.grapes,w.region,w.predicate].filter(Boolean).join(" · "))}</span>
    <div class="muted">Menge: ${esc(w.qty||"1")} ${w.shelf?`· Regal ${esc(w.shelf)}`:""} ${w.slot?`· Fach ${esc(w.slot)}`:""}</div>
    <button class="ghost" style="padding:8px 12px;margin-top:6px;font-size:14px" onclick="removeWine(${i})">Entfernen</button>
  </div>`).join("");
}
window.removeWine=i=>{const a=loadArchive();a.splice(i,1);saveArchive(a)};

$("csvBtn").addEventListener("click",()=>{
  const a=loadArchive(); if(!a.length){showStatus("Das Archiv ist noch leer.");return}
  const headers=["EAN / UPC","Weingut","Jahrgang","Weinart","Rebsorte(n)","Land","Region","Lage / Appellation","Prädikat","Alkohol %","Flaschengröße (l)","Menge","Kaufpreis / Fl. (€)","Regal","Fach","Notizen","Gespeichert am"];
  const keys=["ean","winery","vintage","type","grapes","country","region","appellation","predicate","alcohol","size","qty","price","shelf","slot","notes","savedAt"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+headers.map(q).join(";")+"\n"+a.map(w=>keys.map(k=>q(w[k])).join(";")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob), link=document.createElement("a");
  link.href=url; link.download="weinkeller-archiv.csv"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});

if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(console.warn)}
renderArchive();
