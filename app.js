const $=id=>document.getElementById(id);
let frontImage=null, backImage=null;

const GRAPES=["Riesling","Chardonnay","Sauvignon Blanc","Grauburgunder","Weißburgunder","Pinot Blanc","Pinot Gris","Gewürztraminer","Silvaner","Müller-Thurgau","Grüner Veltliner","Pinot Noir","Spätburgunder","Cabernet Sauvignon","Merlot","Cabernet Franc","Syrah","Shiraz","Grenache","Tempranillo","Sangiovese","Nebbiolo","Barbera","Malbec","Primitivo","Gamay"];
const REGIONS=[["Mosel","Deutschland"],["Rheingau","Deutschland"],["Pfalz","Deutschland"],["Nahe","Deutschland"],["Ahr","Deutschland"],["Rheinhessen","Deutschland"],["Baden","Deutschland"],["Franken","Deutschland"],["Württemberg","Deutschland"],["Bordeaux","Frankreich"],["Burgund","Frankreich"],["Bourgogne","Frankreich"],["Champagne","Frankreich"],["Rhône","Frankreich"],["Loire","Frankreich"],["Alsace","Frankreich"],["Rioja","Spanien"],["Ribera del Duero","Spanien"],["Priorat","Spanien"],["Toskana","Italien"],["Toscana","Italien"],["Piemont","Italien"],["Piemonte","Italien"],["Veneto","Italien"],["Napa Valley","USA"],["Sonoma","USA"],["Mendoza","Argentinien"],["Barossa","Australien"],["Marlborough","Neuseeland"]];
const PREDS=["Kabinett","Spätlese","Auslese","Beerenauslese","Trockenbeerenauslese","Eiswein","Großes Gewächs","Grosses Gewächs"];
const WINERIES=["Markus Molitor","Dr. Loosen","Joh. Jos. Prüm","Egon Müller","Dönnhoff","Robert Weil","Keller","Wittmann","Fritz Haag","Schloss Lieser","Clemens Busch","Van Volxem"];

function debug(msg){ $("debug").textContent += "\n" + msg; }
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[^a-z0-9]+/g," ").trim();

function lev(a,b){
  a=norm(a);b=norm(b);
  if(!a||!b)return 0;
  let d=Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let p=d;d=[i];
    for(let j=1;j<=b.length;j++)d[j]=Math.min(d[j-1]+1,p[j]+1,p[j-1]+(a[i-1]!==b[j-1]));
  }
  return 1-d[b.length]/Math.max(a.length,b.length,1);
}
const contains=(t,q)=>norm(t).includes(norm(q));

function repairVintageToken(token){
  let s=String(token).toUpperCase().replace(/\s/g,"");
  s=s.replace(/[OQ]/g,"0").replace(/[IL|]/g,"1").replace(/S/g,"5").replace(/B/g,"8");
  const m=s.match(/(19\d{2}|20\d{2})/);
  if(!m)return "";
  const y=Number(m[1]);
  return y>=1950 && y<=new Date().getFullYear()+1 ? String(y) : "";
}

function extractVintage(text){
  const direct=[...text.matchAll(/\b(19[5-9]\d|20\d{2})\b/g)].map(m=>m[0]);
  if(direct.length)return direct[0];

  const candidates=text.match(/[2ZOQ][0OQ][0-9OQILSB|]{2}|1[9OQ][0-9OQILSB|]{2}/gi)||[];
  for(const c of candidates){
    const y=repairVintageToken(c);
    if(y)return y;
  }
  return "";
}

async function fileToDataURL(file){
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function updatePhotoStatus(){
  if(frontImage&&backImage) $("status").textContent="✅ Vorder- und Rückseite übernommen. Bereit zur Analyse.";
  else if(frontImage) $("status").textContent="✅ Vorderseite übernommen. Rückseite ist optional.";
  else if(backImage) $("status").textContent="✅ Rückseite übernommen. Vorderseite ist optional.";
  else $("status").textContent="Noch kein Foto übernommen.";
  $("analyzeBtn").disabled=!(frontImage||backImage);
}

async function loadPhoto(input,side){
  try{
    const file=input.files?.[0];
    debug(side+": change ausgelöst");
    if(!file){ debug(side+": keine Datei erhalten"); return; }

    debug(side+": "+file.name+" | "+file.type+" | "+file.size+" Bytes");

    if(side==="front") frontImage=file;
    else backImage=file;

    const dataUrl=await fileToDataURL(file);
    const preview=side==="front"?$("frontPreview"):$("backPreview");
    const ok=side==="front"?$("frontOk"):$("backOk");

    preview.src=dataUrl;
    preview.style.display="block";
    ok.style.display="block";
    updatePhotoStatus();
    debug(side+": Vorschau erfolgreich geladen");
  }catch(e){
    console.error(e);
    debug(side+": FEHLER "+(e?.message||String(e)));
    $("status").textContent="❌ Foto konnte nicht übernommen werden.";
  }
}

$("frontInput").addEventListener("change",function(){loadPhoto(this,"front")});
$("backInput").addEventListener("change",function(){loadPhoto(this,"back")});

async function makeBitmap(file){
  if("createImageBitmap" in window) return await createImageBitmap(file);
  return await new Promise((resolve,reject)=>{
    const img=new Image();
    const u=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};
    img.onerror=e=>{URL.revokeObjectURL(u);reject(e)};
    img.src=u;
  });
}

function preprocess(bitmap,mode){
  const scale=Math.min(2.0,1600/bitmap.width);
  const w=Math.max(800,Math.round(bitmap.width*scale));
  const h=Math.round(bitmap.height*scale);
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,w,h);
  const im=ctx.getImageData(0,0,w,h),d=im.data;
  for(let i=0;i<d.length;i+=4){
    let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    if(mode===1)g=(g-128)*1.55+128;
    g=Math.max(0,Math.min(255,g));
    d[i]=d[i+1]=d[i+2]=g;
  }
  ctx.putImageData(im,0,0);
  return c;
}

async function ocrOne(file,label,start,span){
  const bm=await makeBitmap(file);
  const texts=[];
  for(let mode=0;mode<2;mode++){
    const src=preprocess(bm,mode);
    const r=await Tesseract.recognize(src,"deu+eng",{logger:m=>{
      if(m.status==="recognizing text"&&typeof m.progress==="number"){
        $("bar").style.width=(start+(mode/2)*span+(m.progress*span/2))+"%";
      }
    }});
    texts.push(`--- ${label} OCR ${mode+1} ---\n${r.data.text||""}`);
  }
  return texts;
}

function parse(text){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out={};

  out.vintage=extractVintage(text);
  out.grapes=GRAPES.find(g=>contains(text,g)||lines.some(l=>lev(l,g)>.65))||"";

  for(const [r,c] of REGIONS){
    if(contains(text,r)||lines.some(l=>lev(l,r)>.70)){out.region=r;out.country=c;break}
  }

  out.predicate=PREDS.find(p=>contains(text,p)||lines.some(l=>lev(l,p)>.65))||"";

  let best=["",0];
  for(const w of WINERIES){
    for(const l of lines){
      const s=lev(l,w);
      if(s>best[1])best=[w,s];
    }
  }
  out.winery=best[1]>.48?best[0]:"";

  if((contains(text,"erdener")||lines.some(l=>lev(l,"Erdener")>.50)) &&
     (contains(text,"treppchen")||lines.some(l=>lev(l,"Treppchen")>.45))){
    out.appellation="Erdener Treppchen";
  }else{
    out.appellation="";
  }

  const whites=["Riesling","Chardonnay","Sauvignon Blanc","Grauburgunder","Weißburgunder","Pinot Blanc","Pinot Gris","Gewürztraminer","Silvaner","Müller-Thurgau","Grüner Veltliner"];
  if(whites.includes(out.grapes))out.type="Weißwein";
  else if(out.grapes)out.type="Rotwein";

  let a=text.match(/(\d{1,2}(?:[.,]\d)?)\s*%?\s*(?:vol|alc)/i);
  if(!a)a=text.match(/(?:alc|alcohol)[^0-9]{0,6}(\d{1,2}(?:[.,]\d)?)/i);
  out.alcohol=a?a[1].replace(".",","):"";

  let sz=text.match(/\b(0[.,]75|0[.,]375|1[.,]5)\s*l\b/i);
  if(!sz&&/\b750\s*ml\b/i.test(text))out.size="0,75";
  else if(!sz&&/\b375\s*ml\b/i.test(text))out.size="0,375";
  else if(sz)out.size=sz[1].replace(".",",");

  const ean=(text.match(/\b\d{8,14}\b/g)||[]).find(x=>x.length>=8);
  out.ean=ean||"";

  return out;
}

$("analyzeBtn").onclick=async()=>{
  if(!(frontImage||backImage))return;
  $("analyzeBtn").disabled=true;
  $("bar").style.width="1%";
  $("status").textContent="Analyse läuft …";
  try{
    let texts=[];
    if(frontImage)texts.push(...await ocrOne(frontImage,"VORDERSEITE",0,frontImage&&backImage?50:100));
    if(backImage)texts.push(...await ocrOne(backImage,"RÜCKSEITE",frontImage?50:0,frontImage?50:100));

    const merged=texts.join("\n\n");
    $("ocrText").textContent=merged;
    const o=parse(merged);

    for(const k of ["ean","winery","vintage","type","grapes","country","region","appellation","predicate","alcohol","size"]){
      if(o[k])$(k).value=o[k];
    }

    $("bar").style.width="100%";
    $("status").textContent="✅ Analyse abgeschlossen.";
  }catch(e){
    console.error(e);
    debug("OCR FEHLER: "+(e?.message||String(e)));
    $("status").textContent="❌ Analyse fehlgeschlagen. Technische Diagnose öffnen.";
  }finally{
    $("analyzeBtn").disabled=!(frontImage||backImage);
  }
};

const ids=["ean","winery","vintage","type","grapes","country","region","appellation","predicate","alcohol","size","qty","price","shelf","slot","notes"];
function formData(){let o={};ids.forEach(i=>o[i]=$(i).value);return o}
function all(){
  try{return JSON.parse(localStorage.winesV53||localStorage.winesV52||localStorage.winesV51||"[]")}
  catch{return[]}
}
function render(){
  const a=all();
  $("archive").innerHTML=a.map(w=>`<div class="archive-item"><b>${w.winery||""} ${w.vintage||""}</b><br>${w.appellation||""} · ${w.grapes||""} · ${w.predicate||""}<div class="muted">${w.region||""} ${w.alcohol?("· "+w.alcohol+" %"):""}</div></div>`).join("")||"Noch keine Weine gespeichert.";
}

$("saveBtn").onclick=()=>{
  let a=all();
  a.unshift(formData());
  localStorage.winesV53=JSON.stringify(a);
  render();
  $("status").textContent="✅ Wein gespeichert.";
};

$("clearBtn").onclick=()=>{
  ids.forEach(i=>$(i).value="");
  $("size").value="0,75";
  $("qty").value="1";

  frontImage=backImage=null;

  ["frontPreview","backPreview"].forEach(i=>{
    $(i).removeAttribute("src");
    $(i).style.display="none";
  });

  ["frontOk","backOk"].forEach(i=>$(i).style.display="none");

  $("frontInput").value="";
  $("backInput").value="";
  $("ocrText").textContent="";
  $("bar").style.width="0";
  updatePhotoStatus();
};

$("csvBtn").onclick=()=>{
  const a=all();
  if(!a.length)return;
  const q=v=>`"${String(v||"").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+ids.join(";")+"\n"+a.map(w=>ids.map(i=>q(w[i])).join(";")).join("\n");
  const u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const l=document.createElement("a");
  l.href=u;
  l.download="weinkeller-v5-3.csv";
  l.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
};

// Alte Service Worker und alte Cache-Versionen entfernen.
// V5.3 registriert bewusst KEINEN neuen Service Worker.
if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations()
    .then(rs=>Promise.all(rs.map(r=>r.unregister())))
    .then(()=>debug("Alte Service Worker entfernt."));
}
if("caches" in window){
  caches.keys()
    .then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
    .then(()=>debug("Alte App-Caches entfernt."));
}

render();
