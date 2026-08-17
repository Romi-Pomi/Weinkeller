
const $ = id => document.getElementById(id);
const fields = ["ean","producer","wine","vintage","type","grape","country","region","appellation","alcohol","size","qty","price","rack","bin","notes"];
let stream=null, scanTimer=null;

function db(){ return JSON.parse(localStorage.getItem("winecellar")||"[]"); }
function setDb(v){ localStorage.setItem("winecellar", JSON.stringify(v)); render(); }
function val(id){ return $(id).value.trim(); }
function set(id,v){ if(v!==undefined && v!==null) $(id).value=v; }

function environmentCheck(){
  const secure = window.isSecureContext;
  const media = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const detector = "BarcodeDetector" in window;
  const parts=[];
  parts.push(secure ? "✅ HTTPS/sicherer Kontext" : "❌ Kein sicherer Kontext");
  parts.push(media ? "✅ Kamera-API verfügbar" : "❌ Kamera-API nicht verfügbar");
  parts.push(detector ? "✅ Barcode-Erkennung verfügbar" : "⚠️ BarcodeDetector fehlt");
  $("envStatus").innerHTML = parts.join("<br>");
  $("envStatus").className = "status " + (secure && media ? "good" : "err");
}

async function lookup(code){
  code=(code||"").replace(/\D/g,"");
  if(!code) return;
  set("ean",code);
  $("lookupStatus").className="status";
  $("lookupStatus").textContent="Suche …";

  const existing=db().find(x=>x.ean===code);
  if(existing){
    Object.entries(existing).forEach(([k,v])=>{ if(fields.includes(k) && k!=="qty") set(k,v); });
    $("lookupStatus").className="status good";
    $("lookupStatus").textContent="Barcode lokal gefunden. Jahrgang bitte prüfen.";
    return;
  }

  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const j=await r.json();
    if(j.status===1 && j.product){
      const p=j.product;
      set("producer", p.brands || "");
      set("wine", p.product_name_de || p.product_name || "");
      set("country", (p.countries_tags||[])[0]?.replace(/^..:/,"") || "");
      $("lookupStatus").className="status warn";
      $("lookupStatus").textContent="Produkt gefunden. Weinspezifische Angaben wie Jahrgang/Rebsorte bitte prüfen.";
    } else {
      $("lookupStatus").className="status warn";
      $("lookupStatus").textContent="Barcode online nicht gefunden. Daten einmal ergänzen; künftig wird er lokal erkannt.";
    }
  }catch(e){
    $("lookupStatus").className="status warn";
    $("lookupStatus").textContent="Online-Abfrage nicht möglich. Lokales Speichern funktioniert trotzdem.";
  }
}

async function startScan(){
  $("scannerBox").classList.remove("hidden");
  if(!window.isSecureContext){
    $("scanStatus").className="status err";
    $("scanStatus").textContent="Kamera braucht HTTPS. Bitte die PWA über eine HTTPS-Adresse öffnen.";
    return;
  }
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){
    $("scanStatus").className="status err";
    $("scanStatus").textContent="Kamera-API auf diesem Gerät/Browser nicht verfügbar.";
    return;
  }
  if(!("BarcodeDetector" in window)){
    $("scanStatus").className="status warn";
    $("scanStatus").textContent="BarcodeDetector wird von diesem Browser nicht unterstützt. Bitte Chrome oder Edge auf Android verwenden.";
    return;
  }
  try{
    const supported=await BarcodeDetector.getSupportedFormats();
    const wanted=["ean_13","ean_8","upc_a","upc_e"];
    const formats=wanted.filter(f=>supported.includes(f));
    const detector=new BarcodeDetector({formats: formats.length?formats:undefined});
    stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},
      audio:false
    });
    $("video").srcObject=stream;
    await $("video").play();
    $("scanStatus").className="status good";
    $("scanStatus").textContent="Barcode in die Kamera halten …";
    scanTimer=setInterval(async()=>{
      try{
        const codes=await detector.detect($("video"));
        if(codes.length){
          const code=codes[0].rawValue;
          if(navigator.vibrate) navigator.vibrate(80);
          stopScan();
          $("manualCode").value=code;
          lookup(code);
        }
      }catch(_){}
    },350);
  }catch(e){
    $("scanStatus").className="status err";
    $("scanStatus").textContent="Kamera konnte nicht geöffnet werden: "+e.message;
  }
}

function stopScan(){
  if(scanTimer) clearInterval(scanTimer);
  scanTimer=null;
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream=null;
  $("video").srcObject=null;
  $("scannerBox").classList.add("hidden");
}

function clearForm(){
  fields.forEach(f=>set(f,""));
  set("size","0.75"); set("qty","1");
  $("lookupStatus").className="status";
  $("lookupStatus").textContent="Noch kein Barcode gescannt.";
}

function save(){
  const item={};
  fields.forEach(f=>item[f]=val(f));
  if(!item.ean){ alert("Bitte zuerst einen Barcode scannen oder eingeben."); return; }
  if(!item.producer && !item.wine){ alert("Bitte mindestens Weingut oder Wein eintragen."); return; }
  item.qty=parseInt(item.qty||"1",10);
  const arr=db();
  const ix=arr.findIndex(x=>x.ean===item.ean && String(x.vintage||"")===String(item.vintage||""));
  if(ix>=0) arr[ix]={...arr[ix],...item,qty:(parseInt(arr[ix].qty||0,10)+item.qty)};
  else arr.push(item);
  setDb(arr);
  $("lookupStatus").className="status good";
  $("lookupStatus").textContent="Gespeichert. Bestand aktualisiert.";
}

function render(){
  const arr=db();
  $("rows").innerHTML="";
  let total=0;
  arr.forEach(x=>{
    total += parseInt(x.qty||0,10);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${esc([x.producer,x.wine].filter(Boolean).join(" – "))}</td>
      <td>${esc(x.vintage||"")}</td><td>${esc(x.ean||"")}</td>
      <td>${esc(String(x.qty||""))}</td><td>${esc([x.rack,x.bin].filter(Boolean).join("/"))}</td>`;
    $("rows").appendChild(tr);
  });
  $("summary").textContent=`${total} Flasche${total===1?"":"n"} · ${arr.length} Eintrag${arr.length===1?"":"e"}`;
}
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

function exportCsv(){
  const arr=db();
  if(!arr.length){ alert("Noch keine Daten vorhanden."); return; }
  const cols=["ean","producer","wine","vintage","type","grape","country","region","appellation","alcohol","size","qty","price","rack","bin","notes"];
  const names=["EAN / UPC","Weingut","Wein","Jahrgang","Weinart","Rebsorte(n)","Land","Region","Appellation","Alkohol %","Flaschengröße (l)","Bestand","Kaufpreis / Fl. (€)","Regal","Fach","Notizen"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+[names.map(q).join(";"),...arr.map(x=>cols.map(c=>q(x[c])).join(";"))].join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="Weinkeller_Export.csv"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

$("startBtn").onclick=startScan;
$("stopBtn").onclick=stopScan;
$("lookupBtn").onclick=()=>lookup($("manualCode").value);
$("manualCode").addEventListener("keydown",e=>{if(e.key==="Enter") lookup(e.target.value)});
$("saveBtn").onclick=save;
$("clearBtn").onclick=clearForm;
$("exportBtn").onclick=exportCsv;

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
environmentCheck();
render();
