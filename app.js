
const $=id=>document.getElementById(id);
const fields=["ean","producer","wine","vintage","type","grape","country","region","appellation","alcohol","size","qty","price","rack","bin","notes"];
let stream=null,scanTimer=null,labelFile=null;

function db(){return JSON.parse(localStorage.getItem("winecellar")||"[]")}
function setDb(v){localStorage.setItem("winecellar",JSON.stringify(v));render()}
function val(id){return $(id).value.trim()}
function set(id,v){if(v!==undefined&&v!==null)$(id).value=v}

function environmentCheck(){
  const secure=window.isSecureContext;
  const media=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
  const detector=("BarcodeDetector" in window);
  const ocr=("Tesseract" in window);
  $("envStatus").innerHTML=[
    secure?"✅ HTTPS/sicherer Kontext":"❌ Kein sicherer Kontext",
    media?"✅ Kamera-API verfügbar":"❌ Kamera-API nicht verfügbar",
    detector?"✅ Barcode-Erkennung verfügbar":"⚠️ BarcodeDetector fehlt",
    ocr?"✅ Lokale Etikett-OCR geladen":"⚠️ OCR-Bibliothek noch nicht geladen"
  ].join("<br>");
}

async function lookup(code){
  code=(code||"").replace(/\D/g,"");
  if(!code)return;
  set("ean",code);
  const existing=db().find(x=>x.ean===code);
  if(existing){
    Object.entries(existing).forEach(([k,v])=>{if(fields.includes(k)&&k!=="qty")set(k,v)});
    $("lookupStatus").className="status good";
    $("lookupStatus").textContent="Barcode lokal gefunden. Jahrgang bitte prüfen.";
    return;
  }
  $("lookupStatus").className="status warn";
  $("lookupStatus").textContent="Barcode unbekannt. Fotografiere jetzt am besten das Etikett.";
}

async function startScan(){
  $("scannerBox").classList.remove("hidden");
  if(!window.isSecureContext){$("scanStatus").className="status err";$("scanStatus").textContent="Kamera braucht HTTPS.";return}
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){$("scanStatus").className="status err";$("scanStatus").textContent="Kamera-API nicht verfügbar.";return}
  if(!("BarcodeDetector" in window)){$("scanStatus").className="status warn";$("scanStatus").textContent="BarcodeDetector fehlt. Bitte Chrome/Edge auf Android nutzen.";return}
  try{
    const supported=await BarcodeDetector.getSupportedFormats();
    const wanted=["ean_13","ean_8","upc_a","upc_e"];
    const formats=wanted.filter(f=>supported.includes(f));
    const detector=new BarcodeDetector({formats:formats.length?formats:undefined});
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
    $("video").srcObject=stream;await $("video").play();
    $("scanStatus").className="status good";$("scanStatus").textContent="Barcode in die Kamera halten …";
    scanTimer=setInterval(async()=>{
      try{
        const codes=await detector.detect($("video"));
        if(codes.length){
          const code=codes[0].rawValue;
          if(navigator.vibrate)navigator.vibrate(80);
          stopScan();$("manualCode").value=code;lookup(code);
        }
      }catch(_){}
    },350);
  }catch(e){$("scanStatus").className="status err";$("scanStatus").textContent="Kamera konnte nicht geöffnet werden: "+e.message}
}
function stopScan(){
  if(scanTimer)clearInterval(scanTimer);scanTimer=null;
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;
  $("video").srcObject=null;$("scannerBox").classList.add("hidden");
}

$("labelPhoto").addEventListener("change",e=>{
  labelFile=e.target.files&&e.target.files[0];
  if(!labelFile)return;
  const url=URL.createObjectURL(labelFile);
  $("preview").src=url;$("preview").classList.remove("hidden");
  $("analyzeBtn").classList.remove("hidden");
  $("ocrStatus").className="status";$("ocrStatus").textContent="Foto bereit. Tippe auf „Etikett lokal analysieren“.";
});

async function preprocessImage(file){
  const img=await createImageBitmap(file);
  const maxW=1600;
  const scale=Math.min(1,maxW/img.width);
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const d=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<d.data.length;i+=4){
    const g=0.299*d.data[i]+0.587*d.data[i+1]+0.114*d.data[i+2];
    const c=Math.max(0,Math.min(255,(g-128)*1.35+128));
    d.data[i]=d.data[i+1]=d.data[i+2]=c;
  }
  ctx.putImageData(d,0,0);
  return canvas;
}

const grapePatterns=[
 ["Riesling",/\briesling\b/i],["Spätburgunder",/\b(spätburgunder|pinot noir)\b/i],
 ["Chardonnay",/\bchardonnay\b/i],["Sauvignon Blanc",/\bsauvignon\s*blanc\b/i],
 ["Grauburgunder",/\b(grauburgunder|pinot grigio|pinot gris)\b/i],
 ["Weißburgunder",/\b(weißburgunder|weissburgunder|pinot blanc)\b/i],
 ["Silvaner",/\bsilvaner\b/i],["Gewürztraminer",/\bgew[uü]rztraminer\b/i],
 ["Merlot",/\bmerlot\b/i],["Cabernet Sauvignon",/\bcabernet\s+sauvignon\b/i],
 ["Cabernet Franc",/\bcabernet\s+franc\b/i],["Syrah",/\b(syrah|shiraz)\b/i],
 ["Grenache",/\b(grenache|garnacha)\b/i],["Tempranillo",/\btempranillo\b/i],
 ["Sangiovese",/\bsangiovese\b/i],["Nebbiolo",/\bnebbiolo\b/i],
 ["Barbera",/\bbarbera\b/i],["Malbec",/\bmalbec\b/i],["Pinotage",/\bpinotage\b/i]
];

const regionPatterns=[
 ["Mosel",/\bmosel\b/i],["Rheingau",/\brheingau\b/i],["Pfalz",/\bpfalz\b/i],
 ["Rheinhessen",/\brheinhessen\b/i],["Baden",/\bbaden\b/i],["Württemberg",/\bwürttemberg\b/i],
 ["Bordeaux",/\bbordeaux\b/i],["Burgund",/\b(bourgogne|burgundy|burgund)\b/i],
 ["Champagne",/\bchampagne\b/i],["Rioja",/\brioja\b/i],["Ribera del Duero",/\bribera\s+del\s+duero\b/i],
 ["Toscana",/\b(toscana|tuscany)\b/i],["Piemont",/\b(piemonte|piedmont)\b/i],
 ["Napa Valley",/\bnapa\s+valley\b/i],["Barossa Valley",/\bbarossa\s+valley\b/i]
];

const countryPatterns=[
 ["Deutschland",/\b(deutschland|germany|deutscher)\b/i],["Frankreich",/\b(france|frankreich)\b/i],
 ["Italien",/\b(italia|italy|italien)\b/i],["Spanien",/\b(españa|spain|spanien)\b/i],
 ["Portugal",/\b(portugal)\b/i],["USA",/\b(usa|united states|california)\b/i],
 ["Australien",/\b(australia|australien)\b/i],["Österreich",/\b(österreich|austria)\b/i]
];

function cleanLines(text){
  return text.split(/\r?\n/).map(s=>s.replace(/[|_]+/g," ").replace(/\s+/g," ").trim()).filter(s=>s.length>=2);
}
function detectVintage(text){
  const years=[...text.matchAll(/\b(19[6-9]\d|20[0-3]\d)\b/g)].map(m=>+m[1]);
  return years.length?String(years[0]):"";
}
function detectAlcohol(text){
  const m=text.match(/(\d{1,2}(?:[.,]\d)?)\s*%?\s*(?:vol|alc|alcohol)/i)||text.match(/(\d{1,2}(?:[.,]\d)?)\s*%\s*vol/i);
  return m?m[1].replace(",","."):"";
}
function detectSize(text){
  let m=text.match(/(\d(?:[.,]\d{1,3})?)\s*l\b/i);
  if(m)return m[1].replace(",",".");
  m=text.match(/(\d{2,4})\s*ml\b/i);
  if(m)return String(parseInt(m[1],10)/1000);
  return "";
}
function firstMatch(patterns,text){for(const [name,re] of patterns)if(re.test(text))return name;return""}

function guessProducerAndWine(lines, text){
  const junk=/(alc|vol|ml|cl|contains|enthält|abgefüllt|bottled|mis en bouteille|appellation|geschützte|erzeugerabfüllung|product of|wein aus|wine of)/i;
  const candidates=lines.filter(l=>!junk.test(l)&&!/\b\d{4}\b/.test(l)&&l.length>=3&&l.length<=60);
  const producerMarkers=/(weingut|winery|estate|domaine|château|chateau|bodega|cantina|azienda|tenuta|maison|casa|vini)/i;
  let producer="";
  const marked=candidates.find(l=>producerMarkers.test(l));
  if(marked)producer=marked;
  else if(candidates.length)producer=candidates[0];

  let wine=candidates.find(l=>l!==producer&&l.length>3) || "";
  return {producer,wine};
}

function detectType(text, grape){
  if(/\b(champagne|sekt|sparkling|prosecco|cava|crémant|cremant)\b/i.test(text))return"Schaumwein";
  if(/\b(rosé|rose wine|rosado)\b/i.test(text))return"Rosé";
  if(/\b(port|porto|sherry|madeira)\b/i.test(text))return"Likörwein";
  if(/\b(auslese|beerenauslese|trockenbeerenauslese|eiswein|vin santo|sauternes)\b/i.test(text))return"Süßwein";
  const white=["Riesling","Chardonnay","Sauvignon Blanc","Grauburgunder","Weißburgunder","Silvaner","Gewürztraminer"];
  const red=["Spätburgunder","Merlot","Cabernet Sauvignon","Cabernet Franc","Syrah","Grenache","Tempranillo","Sangiovese","Nebbiolo","Barbera","Malbec","Pinotage"];
  if(white.includes(grape))return"Weißwein";
  if(red.includes(grape))return"Rotwein";
  if(/\b(white wine|weißwein|weisswein|blanc|bianco)\b/i.test(text))return"Weißwein";
  if(/\b(red wine|rotwein|rouge|rosso|tinto)\b/i.test(text))return"Rotwein";
  return"";
}

function applyParsed(text){
  const lines=cleanLines(text);
  const grape=firstMatch(grapePatterns,text);
  const region=firstMatch(regionPatterns,text);
  const country=firstMatch(countryPatterns,text);
  const {producer,wine}=guessProducerAndWine(lines,text);
  const vintage=detectVintage(text);
  const alcohol=detectAlcohol(text);
  const size=detectSize(text);
  const type=detectType(text,grape);

  if(!val("producer"))set("producer",producer);
  if(!val("wine"))set("wine",wine);
  if(!val("vintage"))set("vintage",vintage);
  if(!val("grape"))set("grape",grape);
  if(!val("region"))set("region",region);
  if(!val("country"))set("country",country);
  if(!val("alcohol"))set("alcohol",alcohol);
  if(size)set("size",size);
  if(!val("type"))set("type",type);

  $("lookupStatus").className="status good";
  $("lookupStatus").textContent="Etikett ausgewertet. Bitte Vorschläge kontrollieren und bei Bedarf korrigieren.";
}

$("analyzeBtn").onclick=async()=>{
  if(!labelFile)return;
  if(!window.Tesseract){
    $("ocrStatus").className="status err";
    $("ocrStatus").textContent="OCR-Bibliothek konnte nicht geladen werden. Internetverbindung prüfen.";
    return;
  }
  try{
    $("progress").classList.remove("hidden");$("progressBar").style.width="2%";
    $("ocrStatus").className="status";$("ocrStatus").textContent="Bild wird vorbereitet …";
    const canvas=await preprocessImage(labelFile);
    $("ocrStatus").textContent="Lokale Texterkennung läuft …";
    const worker=await Tesseract.createWorker("deu+eng",1,{
      logger:m=>{
        if(m.status==="recognizing text"){
          const p=Math.round((m.progress||0)*100);
          $("progressBar").style.width=p+"%";
          $("ocrStatus").textContent=`Lokale Texterkennung: ${p}%`;
        }
      }
    });
    const result=await worker.recognize(canvas);
    await worker.terminate();
    const text=(result.data.text||"").trim();
    $("ocrText").textContent=text;
    $("ocrDetails").classList.remove("hidden");
    $("progressBar").style.width="100%";
    $("ocrStatus").className="status good";
    $("ocrStatus").textContent="Etikett lokal erkannt. Daten wurden als Vorschläge übernommen.";
    applyParsed(text);
  }catch(e){
    $("ocrStatus").className="status err";
    $("ocrStatus").textContent="Etikettanalyse fehlgeschlagen: "+e.message;
  }
};

function clearForm(){
  fields.forEach(f=>set(f,""));set("size","0.75");set("qty","1");
  labelFile=null;$("preview").classList.add("hidden");$("analyzeBtn").classList.add("hidden");
  $("ocrDetails").classList.add("hidden");$("progress").classList.add("hidden");$("progressBar").style.width="0";
  $("lookupStatus").className="status";$("lookupStatus").textContent="Noch keine Flasche erkannt.";
}
function save(){
  const item={};fields.forEach(f=>item[f]=val(f));
  if(!item.ean&&!item.producer&&!item.wine){alert("Bitte Barcode scannen oder Etikett analysieren.");return}
  item.qty=parseInt(item.qty||"1",10);
  const arr=db();
  const ix=arr.findIndex(x=>(item.ean&&x.ean===item.ean)&&String(x.vintage||"")===String(item.vintage||""));
  if(ix>=0)arr[ix]={...arr[ix],...item,qty:(parseInt(arr[ix].qty||0,10)+item.qty)};
  else arr.push(item);
  setDb(arr);$("lookupStatus").className="status good";$("lookupStatus").textContent="Gespeichert. Bestand aktualisiert.";
}
function render(){
  const arr=db();$("rows").innerHTML="";let total=0;
  arr.forEach(x=>{total+=parseInt(x.qty||0,10);const tr=document.createElement("tr");
    tr.innerHTML=`<td>${esc([x.producer,x.wine].filter(Boolean).join(" – "))}</td><td>${esc(x.vintage||"")}</td><td>${esc(x.ean||"")}</td><td>${esc(String(x.qty||""))}</td><td>${esc([x.rack,x.bin].filter(Boolean).join("/"))}</td>`;
    $("rows").appendChild(tr);
  });
  $("summary").textContent=`${total} Flasche${total===1?"":"n"} · ${arr.length} Eintrag${arr.length===1?"":"e"}`;
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function exportCsv(){
  const arr=db();if(!arr.length){alert("Noch keine Daten vorhanden.");return}
  const cols=["ean","producer","wine","vintage","type","grape","country","region","appellation","alcohol","size","qty","price","rack","bin","notes"];
  const names=["EAN / UPC","Weingut","Wein","Jahrgang","Weinart","Rebsorte(n)","Land","Region","Appellation","Alkohol %","Flaschengröße (l)","Bestand","Kaufpreis / Fl. (€)","Regal","Fach","Notizen"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+[names.map(q).join(";"),...arr.map(x=>cols.map(c=>q(x[c])).join(";"))].join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="Weinkeller_Export.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

$("startBtn").onclick=startScan;$("stopBtn").onclick=stopScan;
$("lookupBtn").onclick=()=>lookup($("manualCode").value);
$("manualCode").addEventListener("keydown",e=>{if(e.key==="Enter")lookup(e.target.value)});
$("saveBtn").onclick=save;$("clearBtn").onclick=clearForm;$("exportBtn").onclick=exportCsv;

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}))}
environmentCheck();render();
