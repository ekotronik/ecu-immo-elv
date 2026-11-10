/* Wspólna warstwa symulacji LAB. Wszystko to SYMULACJA – sprzęt i pojazd niesprawdzone. */
(function(){
  const LAB={};
  LAB.canvas=function(el,ratio){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const o={ctx:el.getContext('2d'),dpr,ratio,el};
    o.fit=function(){const w=el.parentElement.clientWidth-14;if(w<=0)return;o.ratio=typeof ratio==='function'?ratio(w):ratio;el.style.width=w+'px';el.style.height=(w*o.ratio)+'px';el.width=Math.round(w*dpr);el.height=Math.round(w*o.ratio*dpr)};
    Object.defineProperty(o,'W',{get(){return el.width}});Object.defineProperty(o,'H',{get(){return el.height}});
    o.fit();return o;
  };
  LAB.rng=function(seed){let s=(Math.imul((seed>>>0)+1,2654435761)>>>0)||1;const f=function(){s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296};for(let i=0;i<8;i++)f();return f};
  LAB._rngOld=function(seed){let s=seed>>>0||1;return function(){s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}};
  LAB.gauss=function(r){return Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r())};
  LAB.loop=function(fn){let last=performance.now();function f(t){const dt=Math.min(.1,(t-last)/1000);last=t;fn(dt);requestAnimationFrame(f)}requestAnimationFrame(f)};
  LAB.set=function(id,txt){const e=document.getElementById(id);if(e)e.textContent=txt};
  LAB.html=function(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h};
  LAB.pad=function(n){return String(n).padStart(2,'0')};
  LAB.mmss=function(min){const s=Math.floor(min*60);return LAB.pad(Math.floor(s/60))+':'+LAB.pad(s%60)};
  LAB.ICONS={
   prad:'<svg viewBox="0 0 54 44" fill="none" stroke="#d6a852" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="36" height="22" rx="3"/><path d="M42 18h4v10h-4M13 12V9h6v3M29 12V9h6v3"/><path d="M25 16l-5 7h7l-5 7" stroke="#5adce8"/></svg>',
   can:'<svg viewBox="0 0 54 44" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h10v-6h10v6h10v-6h10" stroke="#4de3f5"/><path d="M4 32h10v6h10v-6h10v6h10" stroke="#6be36b"/><path d="M44 8v30" stroke="#d6a852" stroke-dasharray="2 4"/></svg>',
   komp:'<svg viewBox="0 0 54 44" fill="none" stroke="#d6a852" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="6" width="26" height="16" rx="2"/><path d="M18 22v6h18v-6M24 28v8M30 28v8M20 36h14"/><path d="M4 40c4 0 4-6 7-6s3 6 6 6" stroke="#5adce8"/></svg>',
   roz:'<svg viewBox="0 0 54 44" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="22" r="13" stroke="#d6a852"/><circle cx="19" cy="22" r="4" stroke="#d6a852"/><path d="M19 9v-4M31 14l3-3M7 14l-3-3M32 22h4M6 22H2M31 30l3 3M7 30l-3 3" stroke="#d6a852"/><path d="M38 38h4V26h5V14" stroke="#5adce8"/></svg>'
  };
  /* nagłówek aplikacji: logo EKOTRONIK + symbol analizatora + status symulacji */
  LAB.header=function(o){
    document.body.dataset.theme=o.icon;
    document.getElementById('hdr').innerHTML=
     '<a class="brand" href="../index.html#galeria" aria-label="EKOTRONIK SYSTEM – wróć do LAB"><img src="img/logo-emblem.png" alt="Logo EKOTRONIK SYSTEM"><div><div class="w1">EKOTRONIK</div><div class="w2">SYSTEM</div></div></a>'+
     '<div class="symbox" role="img" aria-label="Symbol: '+o.sym+'">'+LAB.ICONS[o.icon]+'<div><div class="st">'+o.sym+'</div><div class="sd">'+o.symd+'</div></div></div>'+
     '<div class="pill"><b>● SYMULACJA · emulator</b><br><span>Sprzęt i pojazd: niesprawdzone</span></div>';
    var art=LAB.ART[o.icon];document.getElementById('crumb').innerHTML='<a class="btn back" href="../index.html#galeria">← Powrót do LAB</a><div class="path">LAB › ANALIZATORY › <b>'+o.title+'</b></div>'+(art?'<a class="btn" style="margin-left:auto" href="../artykuly/'+art[0]+'.html">📖 Artykuł: '+art[1]+'</a>':'')+'<a class="btn" href="../artykuly/">Wszystkie artykuły</a>';
  };
  LAB.ART={prad:['prad-spoczynkowy','prąd spoczynkowy'],can:['magistrala-can','magistrala CAN'],komp:['kompresja-wzgledna','kompresja względna']};
  window.LAB=LAB;
})();
/* kanwa wypełniająca rodzica (ekrany pomiaru na pełny ekran) */
(function(){
  LAB.fillCanvas=function(el){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const o={ctx:el.getContext('2d'),dpr,el};
    o.fit=function(){const p=el.parentElement,w=p.clientWidth,h=p.clientHeight;if(w<=0||h<=0)return false;const tw=Math.round(w*dpr),th=Math.round(h*dpr);if(el.width===tw&&el.height===th)return true;el.style.width=w+'px';el.style.height=h+'px';el.width=tw;el.height=th;return true};
    Object.defineProperty(o,'W',{get(){return el.width}});Object.defineProperty(o,'H',{get(){return el.height}});
    o.fit();return o;
  };
  LAB.f1=function(x,n){return (n===undefined?x.toFixed(1):x.toFixed(n)).replace('.',',')};
  LAB.sg=function(x,n){return (x>=0?'+':'−')+LAB.f1(Math.abs(x),n)};
})();
/* Suwaki na żywo dla scenariusza „Własny”. Przycisk SUWAKI jest nad ekranem pomiaru, więc działa też w trybie pełnoekranowym. */
(function(){
  LAB.live=function(cfg){
    const vals={};cfg.defs.forEach(d=>vals[d.id]=d.val);
    const fab=document.createElement('button');fab.className='lv-fab hidden';fab.type='button';fab.textContent='⚙ SUWAKI';
    const sh=document.createElement('div');sh.className='lv-sheet hidden';sh.setAttribute('role','dialog');sh.setAttribute('aria-label','Suwaki symulacji');
    let h='<div class="lv-h"><b>'+(cfg.title||'Scenariusz własny')+'</b><button type="button" class="lv-x" aria-label="Zamknij">✕</button></div><div class="lv-sub">'+(cfg.sub||'Przesuń suwak – symulacja reaguje od razu.')+'</div><div class="lv-b">';
    cfg.defs.forEach(d=>{h+='<div class="lv-r"><div class="lv-t"><span>'+d.label+'</span><b id="lvv_'+d.id+'"></b></div><input type="range" id="lvi_'+d.id+'" min="'+d.min+'" max="'+d.max+'" step="'+d.step+'" value="'+d.val+'" aria-label="'+d.label+'"><div class="lv-hint" id="lvh_'+d.id+'"></div></div>'});
    h+='</div>'+(cfg.presets?'<div class="lv-p">'+cfg.presets.map((p,i)=>'<button type="button" class="btn" data-pi="'+i+'">'+p.n+'</button>').join('')+'</div>':'');
    sh.innerHTML=h;document.body.appendChild(fab);document.body.appendChild(sh);
    const fmt=(d,v)=>LAB.f1(v,d.dec===undefined?(d.step<1?1:0):d.dec)+(d.unit?' '+d.unit:'');
    function paint(d){const v=vals[d.id],e=document.getElementById('lvv_'+d.id);e.textContent=fmt(d,v);const hh=document.getElementById('lvh_'+d.id);hh.textContent=d.hint?d.hint(v):''}
    function set(id,v,fin){vals[id]=+v;document.getElementById('lvi_'+id).value=v;cfg.onChange(vals,!!fin,id);cfg.defs.forEach(paint)}
    cfg.defs.forEach(d=>{paint(d);const r=document.getElementById('lvi_'+d.id);r.addEventListener('input',()=>set(d.id,r.value,false));r.addEventListener('change',()=>set(d.id,r.value,true))});
    fab.onclick=()=>{cfg.defs.forEach(paint);sh.classList.toggle('hidden')};sh.querySelector('.lv-x').onclick=()=>sh.classList.add('hidden');
    if(cfg.presets)sh.querySelector('.lv-p').addEventListener('click',e=>{const b=e.target.closest('[data-pi]');if(!b)return;const p=cfg.presets[+b.dataset.pi];Object.keys(p.v).forEach(k=>set(k,p.v[k],false));cfg.onChange(vals,true,null);cfg.defs.forEach(paint)});
    return{vals,show:function(on){fab.classList.toggle('hidden',!on);if(!on)sh.classList.add('hidden')},open:function(){cfg.defs.forEach(paint);sh.classList.remove('hidden')}};
  };
})();
