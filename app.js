(function(){
const $ = s=>document.querySelector(s);
const chat = $("#chat"), input = $("#msg");
const lead = {name:null, email:null, need:null, budget:null, timeline:null, source:"website-chat", score:null, status:"collecting", booking:null};
let awaiting = null;          // which lead field the agent just asked for
let booked = false, slotsShown = false, lastAsked = null;
const NEEDS = [
  ["implant",/implant|missing tooth/], ["clear aligners",/invisalign|aligner|braces|straighten|crooked/],
  ["teeth whitening",/whiten|whitening|white teeth|stain/], ["emergency visit",/emergency|pain|toothache|broken|chipped|swell/],
  ["root canal",/root canal|abscess/], ["filling",/filling|cavity|cavities|decay/],
  ["check-up & cleaning",/check.?up|cleaning|clean my|hygien|exam/], ["children's check-up",/child|kid|son|daughter/],
];
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function add(role, html, extra){
  const el = document.createElement("div"); el.className = "msg "+role;
  el.innerHTML = `<div class="bubble">${html}</div>`;
  if (extra) el.appendChild(extra);
  chat.appendChild(el); chat.scrollTop = chat.scrollHeight; return el;
}
function step(n){ document.querySelectorAll(".pipe li").forEach(li=>{ const k=+li.dataset.step; li.classList.toggle("active",k===n); if(k<=n) li.classList.add("done"); }); }
function renderLead(){
  const filled = ["name","need","budget","timeline"].filter(k=>lead[k]).length;
  lead.score = scoreLead();
  $("#leadjson").textContent = JSON.stringify(lead,null,2);
  $("#leadprog").style.width = (filled/4*100)+"%";
  $("#leadcount").textContent = filled+"/4 qualified fields";
  $("#leadbadge").textContent = lead.score ? lead.score.toUpperCase() : "—";
  $("#leadbadge").className = "badge "+(lead.score||"");
}
function scoreLead(){
  if (!lead.need) return null;
  let s = 0;
  if (lead.budget && lead.budget.amount >= 500) s+=2; else if (lead.budget) s+=1;
  if (lead.timeline && /asap|today|tomorrow|this week|next week|urgent|now/i.test(lead.timeline)) s+=2; else if (lead.timeline) s+=1;
  if (lead.name) s+=1;
  return s>=4 ? "hot" : s>=2 ? "warm" : "cold";
}
function renderSources(r){
  const max = r.hits[0] ? r.hits[0].score || 1 : 1;
  $("#sources").innerHTML = r.hits.map((h,i)=>`<div class="src ${i===0&&h.score>=1.2?'top':''}">
    <div class="srch"><span class="kid">${h.id}</span> ${esc(h.title)} <span class="sc">BM25 ${h.score.toFixed(2)}</span></div>
    <div class="bar"><i style="width:${Math.max(3,h.score/max*100)}%"></i></div>
    <div class="srct">${esc(h.text)}</div></div>`).join("");
  $("#terms").textContent = r.terms.join(" · ") || "—";
}
// ---------- lead field extraction (deterministic, regex based) ----------
function extract(t, raw){
  let got = [];
  let m = raw.match(/\b(?:my name is|i am|i'm|im|this is|name's)\s+([A-Z][a-zà-ž]+(?:\s+[A-Z][a-zà-ž]+)?)/i);
  if (m && !/^(looking|interested|nervous|scared|in|a|not|new)$/i.test(m[1].split(" ")[0])) { lead.name = cap(m[1]); got.push("name"); }
  else if (awaiting==="name" && /^[a-zà-ž]+(\s+[a-zà-ž]+)?$/i.test(raw.trim()) && raw.trim().length<30) { lead.name = cap(raw.trim()); got.push("name"); }
  m = raw.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (m){ lead.email = m[0]; got.push("email"); }
  for (const [n,re] of NEEDS){ if (re.test(t)){ if(lead.need!==n){lead.need=n; got.push("need");} break; } }
  m = raw.match(/(?:€|eur|euro|\$|usd)\s?(\d[\d,.]*k?)|(\d[\d,.]*k?)\s?(?:€|eur|euros?|\$|usd|dollars)/i)
      || (awaiting==="budget" || /budget/i.test(t) ? raw.match(/(\d[\d,.]*k?)/i) : null);
  if (m){ let v=(m[1]||m[2]).toLowerCase().replace(/,/g,""); let amt = v.endsWith("k")?parseFloat(v)*1000:parseFloat(v);
    if (amt>0){ lead.budget = {amount:amt, currency:"EUR"}; got.push("budget"); } }
  else if (awaiting==="budget" && /flexible|not sure|no idea|depends/i.test(t)){ lead.budget={amount:0,currency:"EUR",note:"flexible"}; got.push("budget"); }
  m = t.match(/\b(asap|as soon as possible|today|tomorrow|this week|next week|this month|next month|in \d+ (?:days?|weeks?|months?)|within \d+ (?:days?|weeks?|months?)|urgent(?:ly)?|no rush|this year|january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (m){ lead.timeline = m[1]; got.push("timeline"); }
  return got;
}
function cap(s){return s.split(" ").map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(" ");}
const QUESTIONS = {
  need:"What would you like help with? (e.g. whitening, implants, aligners, a check-up)",
  name:"May I have your name for the booking?",
  budget:"Do you have a rough budget in mind? (e.g. €300, or \"flexible\")",
  timeline:"And when would you ideally like to start? (e.g. this week, next month)",
};
function nextMissing(){ return ["need","name","budget","timeline"].find(k=>!lead[k]); }
// ---------- booking ----------
function slots(){
  const out=[]; const d=new Date(); d.setHours(0,0,0,0);
  const times=[["09:30","14:00"],["11:00","16:30"],["10:15","17:45"]];
  let i=0; while(out.length<6){ d.setDate(d.getDate()+1); const wd=d.getDay(); if(wd===0) continue;
    const t = wd===6 ? ["10:00"] : times[i%3]; i++;
    t.forEach(h=>{ if(out.length<6) out.push({date:new Date(d), time:h}); }); }
  return out;
}
function fmt(s){ return s.date.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" · "+s.time; }
function offerSlots(){
  slotsShown = true; step(4);
  const wrap=document.createElement("div"); wrap.className="slots";
  slots().forEach(s=>{ const b=document.createElement("button"); b.className="slot"; b.textContent=fmt(s);
    b.onclick=()=>confirmSlot(s,wrap); wrap.appendChild(b); });
  add("bot", `Great, ${esc(lead.name||"thanks")} — you're qualified for ${/^[aeiou]/i.test(lead.need)?'an':'a'} <b>${esc(lead.need)}</b> consultation. Here are the next open slots <span class="muted">(fake demo calendar)</span>:`, wrap);
}
function confirmSlot(s, wrap){
  if (booked) return; booked = true;
  wrap.querySelectorAll("button").forEach(b=>{b.disabled=true; if(b.textContent===fmt(s)) b.classList.add("picked");});
  const id = "BK-"+Math.random().toString(36).slice(2,7).toUpperCase();
  lead.booking = {id, slot:fmt(s), iso:s.date.toISOString().slice(0,10)+"T"+s.time, type:lead.need+" consultation"};
  lead.status = "booked"; renderLead();
  add("user", esc(fmt(s)));
  add("bot", `✅ <b>Booked!</b> ${esc(lead.need)} consultation on <b>${esc(fmt(s))}</b>. Confirmation <code>${id}</code>. You can cancel free up to 24h before <span class="cite" data-id="KB-08">KB-08</span>.<br><span class="muted">Demo only: no real appointment was created.</span>`);
  bindCites();
  handoff();
}
function handoff(){
  step(5);
  const payload = {event:"lead.booked", received_at:new Date().toISOString(), lead:{...lead},
    actions:["append_row:Google Sheets › Leads","create_event:Calendar","send_email:confirmation","notify:Slack #front-desk"]};
  $("#webhook").textContent = "POST https://YOUR-N8N.example/webhook/dental-lead\n(simulated: nothing leaves your browser)\n\n"+JSON.stringify(payload,null,2);
  $("#webhookcard").classList.add("flash");
  showTab("handoff");
}
// ---------- main turn ----------
function turn(raw){
  if(!raw.trim()) return;
  add("user", esc(raw));
  const t = raw.toLowerCase();
  step(1);
  const r = RAG.search(raw, 3); renderSources(r);
  const got = extract(t, raw); renderLead();
  const wantsBook = /\b(book|appointment|schedule|slot|reserve|come in|visit)\b/.test(t);
  const isQuestion = /\?|^(what|how|when|where|do|does|can|is|are|which|who|why)\b|price|cost|how much|open|policy|insurance|pay/.test(t);
  setTimeout(()=>{
    step(2);
    let html = "";
    const parts = isQuestion || (!got.length && !wantsBook) ? RAG.compose(raw, r.hits) : null;
    if (parts){
      html += parts.map(p=>`${esc(p.text)} <span class="cite" data-id="${p.id}">${p.id}</span>`).join("<br>");
    } else if (isQuestion){
      html += `I couldn't find that in the clinic's knowledge base, so I won't guess. I've noted your question for the front desk.`;
    }
    if (got.length){
      const labels = got.filter(g=>g!=="email").map(g=>({name:"name",need:"treatment",budget:"budget",timeline:"timeline"}[g]));
      if (labels.length) html += (html?"<br><br>":"") + `<span class="muted">📝 Added to lead card: ${labels.join(", ")}.</span>`;
    }
    step(3);
    if (booked){ html += (html?"<br><br>":"") + "Anything else I can help with?"; add("bot",html); bindCites(); return; }
    const miss = nextMissing();
    if (!miss){ if(html) {add("bot",html); bindCites();} if(!slotsShown) offerSlots(); return; }
    if (isQuestion && !got.length && !wantsBook && lastAsked===miss){
      html += (html?"<br><br>":"") + "Anything else? Whenever you're ready, I can book you in.";
    } else if (wantsBook || got.length || awaiting || isQuestion){
      awaiting = miss; lastAsked = miss;
      html += (html?"<br><br>":"") + (wantsBook && !got.length ? "Happy to book you in. " : "") + QUESTIONS[miss];
    } else if (!html){
      html = "I can answer questions about prices, treatments, hours and policies, and book a visit. "+QUESTIONS.need;
      awaiting = "need";
    }
    add("bot", html); bindCites();
  }, 280);
}
function bindCites(){ document.querySelectorAll(".cite:not([data-b])").forEach(c=>{ c.dataset.b=1;
  c.title = (KB.find(d=>d.id===c.dataset.id)||{}).title || "";
  c.onclick=()=>{ showTab("sources"); const d=KB.find(x=>x.id===c.dataset.id);
    $("#sources").innerHTML = `<div class="src top"><div class="srch"><span class="kid">${d.id}</span> ${esc(d.title)}</div><div class="srct">${esc(d.text)}</div></div>`; }; }); }
function showTab(n){ document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===n));
  document.querySelectorAll(".pane").forEach(p=>p.classList.toggle("on",p.id==="pane-"+n)); }
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("#form").onsubmit = e=>{ e.preventDefault(); const v=input.value; input.value=""; turn(v); };
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>turn(c.dataset.q||c.textContent));
$("#reset").onclick=()=>location.reload();
$("#kbcount").textContent = KB.length;
$("#kblist").innerHTML = KB.map(d=>`<li><span class="kid">${d.id}</span> ${esc(d.title)}</li>`).join("");
renderLead();
add("bot", `Hi! I'm the BrightSmile virtual assistant 👋 <span class="muted">(demo, fictional clinic)</span><br>Ask me about prices, treatments, opening hours or policies — or tell me what you need and I'll book you in.`);
window.__demo = {turn, lead};
})();
