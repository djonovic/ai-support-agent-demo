// In-browser retrieval: BM25 over the knowledge base. No server, no API key.
(function(){
  const STOP = new Set("a an the and or but if of to in on at for with is are was were be been do does did i you we it my me your our this that what which how can could would should will there their they about from as by have has had please hi hello hey want need like know tell much many any some get who whom whose s m t ll re ve d".split(" "));
  // Words that match many docs but say nothing about the topic on their own.
  const GENERIC = new Set("price day time today tomorrow week month year good best new work people help thing way take accept offer available really much treat located locate come fix go make use give see find".split(" "));
  const SYN = {cost:"price",costs:"price",fee:"price",fees:"price",expensive:"price",cheap:"price",pricing:"price",
    toothache:"pain",hurt:"pain",hurts:"pain",ache:"pain",kid:"child",kids:"child",son:"child",daughter:"child",
    braces:"aligner",straighten:"aligner",invisalign:"aligner",whiten:"whitening",reschedule:"cancel",
    instalment:"installment",finance:"installment",open:"hours",close:"hours",closed:"hours",weekend:"saturday",
    scared:"anxiety",nervous:"anxiety",afraid:"anxiety",fear:"anxiety",clean:"cleaning",checkup:"check"};
  function stem(w){
    if (SYN[w]) return SYN[w];
    let s = w;
    if (s.length>5 && s.endsWith("ing")) s = s.slice(0,-3);
    else if (s.length>4 && s.endsWith("ies")) s = s.slice(0,-3)+"y";
    else if (s.length>4 && s.endsWith("es") && !s.endsWith("ses")) s = s.slice(0,-2);
    else if (s.length>3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0,-1);
    return SYN[s] || s;
  }
  function tokenize(t){
    return (t.toLowerCase().normalize("NFKD").replace(/['’]s\b/g,"").replace(/[^a-z0-9€ ]+/g," ").split(/\s+/))
      .filter(w=>w && w.length>1 && !STOP.has(w)).map(stem).filter(w=>!STOP.has(w));
  }
  const docs = window.KB.map(d=>{
    // title and tags are weighted x2 (field boost)
    const toks = [...tokenize(d.title),...tokenize(d.title),...tokenize(d.tags),...tokenize(d.tags),...tokenize(d.text)];
    const tf = {}; toks.forEach(t=>tf[t]=(tf[t]||0)+1);
    return {doc:d, tf, len:toks.length};
  });
  const N = docs.length, avgdl = docs.reduce((a,d)=>a+d.len,0)/N;
  const df = {}; docs.forEach(d=>Object.keys(d.tf).forEach(t=>df[t]=(df[t]||0)+1));
  const k1=1.4, b=0.75;
  function search(q, k=3){
    const qt = [...new Set(tokenize(q))];
    const res = docs.map(d=>{
      let s=0;
      qt.forEach(t=>{ const f=d.tf[t]; if(!f) return;
        const idf=Math.log(1+(N-df[t]+0.5)/(df[t]+0.5));
        s += idf*(f*(k1+1))/(f+k1*(1-b+b*d.len/avgdl)); });
      return {id:d.doc.id, title:d.doc.title, text:d.doc.text, score:s};
    }).sort((a,b)=>b.score-a.score);
    return {terms:qt, hits:res.slice(0,k)};
  }
  // Compose a grounded answer: pick the sentences of the top passages that best match the query.
  // Returns null ("I won't guess") unless the top doc is a real topical match:
  //  - BM25 score of at least MIN_SCORE, and
  //  - it matches at least one non-generic query term, and
  //  - if some query words appear nowhere in the KB (e.g. "bitcoin", "australia"),
  //    the doc must still match a non-generic term; those words are returned in
  //    parts.missing so the UI can say what it could not find.
  const MIN_SCORE = 2.0;
  function compose(q, hits){
    const terms = [...new Set(tokenize(q))];
    const qt = new Set(terms);
    const top = hits.filter(h=>h.score>0);
    if (!top.length || top[0].score < MIN_SCORE) return null;
    const d0 = docs.find(d=>d.doc.id===top[0].id);
    const matched = terms.filter(t=>d0.tf[t]);
    const topical = matched.filter(t=>!GENERIC.has(t));
    const missing = terms.filter(t=>!df[t] && !GENERIC.has(t));
    if (!topical.length) return null;
    if (missing.length && missing.length >= topical.length + 1) return null;
    const use = [top[0]];
    if (top[1] && top[1].score > top[0].score*0.75) use.push(top[1]);
    const parts = use.map((h,i)=>{
      const sents = h.text.match(/[^.!?]+[.!?]+/g) || [h.text];
      const scored = sents.map((s,idx)=>({s:s.trim(),idx,sc:tokenize(s).filter(t=>qt.has(t)).length}));
      const n = i===0 ? 2 : 1;
      let pick = scored.slice().sort((a,b)=>b.sc-a.sc||a.idx-b.idx).slice(0,n);
      if (pick.every(p=>p.sc===0)) pick = scored.slice(0,n);
      pick.sort((a,b)=>a.idx-b.idx);
      return {id:h.id, text:pick.map(p=>p.s).join(" ")};
    });
    parts.missing = missing;
    return parts;
  }
  window.RAG = {search, compose, tokenize};
})();
