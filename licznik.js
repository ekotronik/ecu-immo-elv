/* Widoczny licznik z GoatCounter (publiczny endpoint). Przy braku danych element pozostaje ukryty.
   Diagnostyka: dopisz do adresu strony ?licznik=test, a pod stopką pojawi się powód braku licznika. */
(function(){
  var el=document.getElementById('eko-licznik'); if(!el||!window.fetch) return;
  var dbg=/[?&]licznik=test/.test(location.search);
  function pokaz(t){var s=el.style;s.display='block';s.fontSize='clamp(18px,2.4vw,24px)';s.fontWeight='700';s.lineHeight='1.4';s.margin='12px 0 4px';s.opacity='1';el.textContent=t;el.hidden=false;}
  fetch('https://ekotronik.goatcounter.com/counter/TOTAL.json',{cache:'no-store'})
    .then(function(r){ if(!r.ok){ var e=new Error('HTTP '+r.status); e.http=r.status; throw e; } return r.json(); })
    .then(function(d){
      if(!d||d.count==null) throw new Error('brak pola count');
      var u=(d.count_unique!=null)?' • Odwiedzający: '+d.count_unique:'';
      pokaz('Wyświetlenia strony: '+d.count+u);
    }).catch(function(e){
      if(dbg) pokaz('Licznik niedostępny: '+(e&&e.message||e)+(e&&e.http===403?' (włącz „Allow adding visitor counts” w ustawieniach GoatCounter)':'')+(e&&e.http===404?' (brak zapisanych wejść lub zła nazwa konta)':''));
    });
})();
