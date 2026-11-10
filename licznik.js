/* Licznik odwiedzin z GoatCounter (konto: ekotronik). ZAWSZE widoczny w stopce: liczba albo krótki komunikat z przyczyną.
   Dane: https://ekotronik.goatcounter.com/counter/TOTAL.json (suma serwisu), zapas: ścieżka bieżącej strony.
   Wymaga w GoatCounter: Settings → Site → „Allow adding visitor counts on your website”. */
(function(){
  var el=document.getElementById('eko-licznik'); if(!el) return;
  var HOST='https://ekotronik.goatcounter.com';
  var KEY='eko_licznik_ost';
  function pokaz(t,blad){
    var s=el.style;s.display='block';s.fontSize=blad?'clamp(13px,1.8vw,16px)':'clamp(18px,2.4vw,24px)';
    s.fontWeight=blad?'500':'700';s.lineHeight='1.4';s.margin='12px 0 4px';s.opacity='1';
    el.textContent=t;el.hidden=false;
  }
  function ost(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function zapisz(t){try{localStorage.setItem(KEY,t)}catch(e){}}
  function liczba(v){ if(v==null) return null; var n=String(v).replace(/[\s ,.]/g,''); return /^\d+$/.test(n)?n:null; }
  function opis(e){
    var h=e&&e.http;
    if(h===403) return 'brak zgody w GoatCounter (Settings → Site → „Allow adding visitor counts on your website”)';
    if(h===404) return 'GoatCounter nie zna tej ścieżki lub konta „ekotronik”';
    if(h===429) return 'zbyt wiele zapytań (spróbuj za chwilę)';
    if(h) return 'serwer GoatCounter odpowiedział HTTP '+h;
    return 'brak połączenia z GoatCounter lub blokada przeglądarki/AdBlock';
  }
  function pobierz(sciezka){
    var url=HOST+'/counter/'+sciezka+'.json?'+Date.now();
    var ctl=window.AbortController?new AbortController():null, t=ctl&&setTimeout(function(){ctl.abort()},8000);
    return fetch(url,{cache:'no-store',mode:'cors',signal:ctl?ctl.signal:undefined}).then(function(r){
      if(t) clearTimeout(t);
      if(!r.ok){var e=new Error('HTTP '+r.status);e.http=r.status;throw e;}
      return r.json();
    });
  }
  function wynik(d){
    var c=d&&liczba(d.count); if(c==null){ var e=new Error('nieoczekiwana odpowiedź'); throw e; }
    var u=liczba(d.count_unique);
    var t='Wyświetlenia strony: '+c+(u!=null?' • Odwiedzający: '+u:'');
    zapisz(t); pokaz(t,false);
  }
  pokaz('Licznik odwiedzin: ładowanie…',true);
  if(!window.fetch){ pokaz('Licznik odwiedzin: przeglądarka nie obsługuje pobierania danych',true); return; }
  var sciezka=encodeURIComponent((location.pathname||'/').replace(/index\.html$/,''));
  pobierz('TOTAL').then(wynik).catch(function(e1){
    if(e1&&e1.http===403) throw e1;
    return pobierz(sciezka).then(wynik);
  }).catch(function(e){
    var o=ost();
    if(o) pokaz(o+' (ostatnio zapamiętane)',false);
    else pokaz('Licznik odwiedzin niedostępny: '+opis(e),true);
  });
  /* diagnostyka skryptu zliczającego: czy count.js się załadował */
  setTimeout(function(){
    if(!window.goatcounter && /^Licznik odwiedzin niedostępny/.test(el.textContent||''))
      el.textContent+=' • skrypt zliczający gc.zgo.at/count.js nie załadował się (AdBlock lub brak sieci)';
  },4000);
})();
