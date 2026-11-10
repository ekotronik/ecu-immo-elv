/* Licznik odwiedzin z GoatCounter (konto: ekotronik). ZAWSZE widoczny w stopce: liczba albo krótki komunikat z przyczyną.
   Zapis wejść robi count.js (w stopce strony). Odczyt: suma /counter/<ścieżka>.json po znanych podstronach
   (ścieżka kodowana %2F, 404 = 0), z zapasem w postaci /counter/TOTAL.json; pokazywana jest większa z wartości.
   Z dopiskiem ?licznik=test w adresie stopka pokazuje szczegóły. */
(function(){
  var el=document.getElementById('eko-licznik'); if(!el) return;
  var HOST='https://ekotronik.goatcounter.com', KEY='eko_licznik_ost';
  var dbg=/[?&]licznik=test/.test(location.search);
  var ROOT=/^\/ecu-immo-elv(\/|$)/.test(location.pathname)?'/ecu-immo-elv':'';
  var SCIEZKI=['','/ecu','/immobilizer','/elv-escl','/artykuly','/artykuly/prad-spoczynkowy.html','/artykuly/magistrala-can.html','/artykuly/kompresja-wzgledna.html','/artykuly/cegi-dryf-zera.html','/lab/asystent.html','/lab/prad-spoczynkowy.html','/lab/analizator-can.html','/lab/kompresja-wzgledna.html','/lab/kontrola-rozrzadu.html'].map(function(p){return ROOT+p||'/'});
  var ZUKOS={'':1,'/ecu':1,'/immobilizer':1,'/elv-escl':1,'/artykuly':1};
  SCIEZKI=SCIEZKI.reduce(function(a,p){a.push(p);var b=p.replace(ROOT,'');if(ZUKOS[b]!==undefined&&p!=='/')a.push(p+'/');return a},[]);
  function pokaz(t,blad){
    var s=el.style;s.display='block';s.fontSize=blad?'clamp(13px,1.8vw,16px)':'clamp(18px,2.4vw,24px)';
    s.fontWeight=blad?'500':'700';s.lineHeight='1.4';s.margin='12px 0 4px';s.opacity='1';el.textContent=t;el.hidden=false;
  }
  function ost(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function zapisz(t){try{localStorage.setItem(KEY,t)}catch(e){}}
  function liczba(v){ if(v==null) return null; var n=String(v).replace(/[\s ,.]/g,''); return /^\d+$/.test(n)?parseInt(n,10):null; }
  function opis(e){
    var h=e&&e.http;
    if(h===403) return 'brak zgody w GoatCounter (Settings → Site → „Allow adding visitor counts on your website”)';
    if(h===429) return 'zbyt wiele zapytań (spróbuj za chwilę)';
    if(h) return 'serwer GoatCounter odpowiedział HTTP '+h;
    return 'brak połączenia z GoatCounter lub blokada przeglądarki/AdBlock';
  }
  /* zwraca {c,u} albo {c:0,u:0} dla 404; inne błędy rzuca */
  function pobierz(sciezka){
    var url=HOST+'/counter/'+encodeURIComponent(sciezka)+'.json?start=2020-01-01&t='+Date.now();
    var ctl=window.AbortController?new AbortController():null, t=ctl&&setTimeout(function(){ctl.abort()},8000);
    return fetch(url,{cache:'no-store',mode:'cors',signal:ctl?ctl.signal:undefined}).then(function(r){
      if(t) clearTimeout(t);
      if(r.status===404) return {c:0,u:0,sc:sciezka};
      if(!r.ok){var e=new Error('HTTP '+r.status);e.http=r.status;throw e;}
      return r.json().then(function(d){return {c:liczba(d&&d.count)||0,u:liczba(d&&d.count_unique)||0,sc:sciezka,raw:JSON.stringify(d)}});
    });
  }
  function kolejno(lista){ /* po jednym zapytaniu, by nie przekroczyć limitu GoatCounter */
    var wyn=[],p=Promise.resolve();
    lista.forEach(function(s){p=p.then(function(){return pobierz(s)}).then(function(x){wyn.push(x)})});
    return p.then(function(){return wyn});
  }
  function koniec(t,blad,szcz){ pokaz(t+(dbg&&szcz?' • '+szcz:''),blad); }
  pokaz('Licznik odwiedzin: ładowanie…',true);
  if(!window.fetch){ pokaz('Licznik odwiedzin: przeglądarka nie obsługuje pobierania danych',true); return; }
  pobierz('TOTAL').catch(function(e){ if(e&&e.http===403) throw e; return {c:0,u:0,sc:'TOTAL',blad:e}; })
  .then(function(tot){
    return kolejno(SCIEZKI).then(function(w){
      var sc=0,mu=0,zn=[];
      w.forEach(function(x){sc+=x.c;mu=Math.max(mu,x.u);if(x.c)zn.push(x.sc+'='+x.c)});
      var c=Math.max(tot.c,sc), u=Math.max(tot.u,mu);
      var t=c>0?'Wyświetlenia strony: '+c+' • Odwiedzający: '+u:'Wyświetlenia strony: — • Odwiedzający: — (GoatCounter aktualizuje liczniki z opóźnieniem)';
      if(c>0) zapisz(t);
      koniec(t,c===0,'v3, TOTAL='+(tot.raw||'brak')+', suma ścieżek='+sc+(zn.length?' ('+zn.join(', ')+')':'')+', zapytań='+(w.length+1));
    });
  }).catch(function(e){
    var o=ost();
    if(o) koniec(o+' (ostatnio zapamiętane)',false,'błąd: '+opis(e));
    else koniec('Licznik odwiedzin niedostępny: '+opis(e),true);
  });
})();
