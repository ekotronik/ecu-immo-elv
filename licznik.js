/* Widoczny licznik z GoatCounter (publiczny endpoint). Przy braku danych element pozostaje ukryty. */
(function(){
  var el=document.getElementById('eko-licznik'); if(!el||!window.fetch) return;
  fetch('https://ekotronik.goatcounter.com/counter/TOTAL.json',{cache:'no-store'})
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(d){
      if(!d||d.count==null||d.count_unique==null) throw 0;
      el.textContent='Wyświetlenia strony: '+d.count+' • Odwiedzający: '+d.count_unique;
      el.hidden=false;
    }).catch(function(){});
})();
