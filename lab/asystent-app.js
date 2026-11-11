/* EKOTRONIK AI ASYSTENT: symulacja aplikacji (panel główny, START/diagnoza, Live Data/Wykresy, Analiza i raporty,
   Kalibracja EKO-SCAN, Ustawienia). Funkcje prowadzone są w asystent.html (silnik w głównym skrypcie).
   Dane pojazdów i przebiegi: port emulatora aplikacji (EmuScenarios.kt, cykl jazdy 30 s). Analizatory (prąd, CAN,
   kompresja, rozrząd) są osobnymi oknami LAB i nie są tu powielane. To symulacja: bez sprzętu i bez pojazdu. */
(function(){
'use strict';
var C=window.__core,$=C.$,fm=C.fm,cl=C.cl;
var APP=$('app'),TOAST=C.toast;

/* ================= EMULATOR: cykl jazdy i parametry ================= */
var DR={ov:null};
function dem(t){if(DR.ov!=null)return DR.ov;var p=((t%30)+30)%30;return p<8?0:p<11?(p-8)/3:p<20?1:p<23?1-(p-20)/3:0}
function nz(s){return (Math.random()-.5)*2*s}
var ATM=101;
function P(n,u,d,f){return {n:n,u:u,d:d||0,f:f}}
var rpm=function(){return P('Prędkość obrotowa silnika','obr/min',0,function(t){return 820+2380*dem(t-.3)+nz(12)})};
var load=function(){return P('Obciążenie silnika','%',0,function(t){return 17+71*dem(t)+nz(1)})};
var coolant=function(){return P('Temperatura cieczy chłodzącej','°C',0,function(t){return 86+Math.min(t,120)/60})};
var voltage=function(dips){return P('Napięcie zasilania','V',1,function(t){var d=dem(t);if(!dips)return 14.2+nz(.05)-.2*d;if(d>.5&&Math.random()<1/6)return null;return 14.1-3.6*d+nz(.08)})};
var boostSet=function(){return P('Ciśnienie doładowania zadane','kPa',0,function(t){return ATM+140*dem(t)})};
var boostAct=function(g,l,sc){sc=sc||1;return P('Ciśnienie doładowania rzeczywiste','kPa',0,function(t){return (ATM+g*dem(t-l))*sc+nz(1.5)})};
var vnt=function(b,g,w){w=w||0;return P('Wysterowanie turbosprężarki (VNT)','%',0,function(t){return Math.min(95,b+g*dem(t)+w*Math.sin(t*2.4)+nz(.8))})};
var maf=function(f){return P('Masa powietrza (MAF)','mg/skok',0,function(t){return (330+600*dem(t-.6))*f+nz(6)})};
var atm=function(){return P('Ciśnienie atmosferyczne','kPa',0,function(){return ATM+nz(.3)})};
var speed=function(){return P('Prędkość pojazdu','km/h',0,function(t){return 20+60*dem(t-2)})};
var intakeT=function(){return P('Temperatura powietrza zasysanego','°C',0,function(){return 24+nz(.5)})};
var railSet=function(){return P('Ciśnienie paliwa zadane','bar',0,function(t){return 300+1300*dem(t)})};
var railAct=function(mx,dead){mx=mx||1600;return P('Ciśnienie paliwa rzeczywiste','bar',0,function(t){return dead?2+nz(1):Math.min(300+1300*dem(t-.4),mx)+nz(8)})};
var fuelReg=function(st){return P('Zawór regulacji ilości paliwa (N290) wysterowanie','%',0,function(t){var d=dem(t);return (st?30+66*d:28+30*d)+nz(.6)})};
var egrSet=function(){return P('Zawór EGR wartość zadana','%',0,function(t){return 55*(1-dem(t))})};
var egrAct=function(stuck){return P('Zawór EGR położenie rzeczywiste','%',0,function(t){return (stuck!=null?stuck:55*(1-dem(t-.3)))+nz(.7)})};
var mafSet=function(){return P('Masa powietrza zadana','mg/skok',0,function(t){return 330+600*dem(t)})};
var mafEgr=function(stuck){return P('Masa powietrza (MAF)','mg/skok',0,function(t){var eo=(stuck!=null?stuck:55*(1-dem(t-.3)))/100,ex=.55*(1-dem(t));return (330+600*dem(t-.6))*(1-.9*Math.max(0,eo-ex))+nz(6)})};
var pedal=function(low){return P('Położenie pedału przyspieszenia','%',0,function(t){return low?0:100*dem(t)+nz(.3)})};
var inj=function(c,o){return P('Korekta dawki wtrysku cylinder '+c,'mg/skok',2,function(t){return o*(1-.3*dem(t))+nz(.25)})};
var idleRough=function(){return P('Prędkość obrotowa silnika','obr/min',0,function(t){return 820+35*Math.sin(t*6)+nz(10)})};
function ecu(a,n,pn,dtc,pids){return {a:a,n:n,pn:pn,dtc:dtc||[],pids:pids}}
function gearbox(){return ecu('02','Elektronika skrzyni biegów','0CK927156',[],[P('Temperatura oleju skrzyni','°C',0,function(t){return 72+Math.min(t,120)/40}),P('Prędkość obrotowa wałka wejściowego','obr/min',0,function(t){return Math.max(0,820+2380*dem(t-.3)-60+nz(10))})])}
function gateway(dtc,dips){return ecu('19','Gateway (magistrala CAN)','3Q0907530',dtc||[],[voltage(dips),P('Stan magistrali CAN napędu','%',0,function(){return 100})])}
var AKT='Aktualny',SPO='Sporadyczny',HIS='Historyczny';
var D0299=['P0299','Ciśnienie doładowania: wartość regulacji nie osiągnięta',AKT];
/* pids: lista nazw proponowanych przez asystenta; h: hipotezy; nx: następne kroki (bez wskazywania wymiany) */
var VEH=[
 {id:'audi-a4-p0299-nieszczelnosc',make:'AUDI',model:'A4 B9 2.0 TDI (2018)',vin:'WAUZZZF40JA012345',scen:'P0299 utrata mocy pod obciążeniem',sym:'utrata mocy pod obciążeniem',
  ecus:[ecu('01','Elektronika silnika','04L906026JC',[D0299],[rpm(),load(),boostSet(),boostAct(70,1.2),vnt(32,58),maf(.82),coolant(),voltage()]),gearbox(),gateway()],
  lv:'PR',why:'Ciśnienie doładowania rzeczywiste nie osiąga zadanego mimo wysokiego wysterowania VNT, a masa powietrza (MAF) jest niższa: ślad nieszczelności po stronie doładowania.',
  h:['Nieszczelność układu doładowania (przewód, intercooler, opaski)','Regulacja turbiny (mniej prawdopodobna: wysterowanie VNT jest wysokie)'],nx:['Próba szczelności układu doładowania','Oględziny przewodów, intercoolera i opasek','Regulacja turbiny dopiero po wykluczeniu nieszczelności'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Wysterowanie turbosprężarki (VNT)','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'audi-a4-p0299-vnt',make:'AUDI',model:'A4 Avant B8 2.0 TDI (2014)',vin:'WAUZZZ8K2EA067891',scen:'P0299 brak reakcji doładowania',sym:'brak mocy, turbo nie łapie',
  ecus:[ecu('01','Elektronika silnika','03L906018NM',[D0299,['P2563','Czujnik położenia sterowania turbosprężarki: zakres/działanie',SPO]],[rpm(),load(),boostSet(),boostAct(16,1),vnt(30,62,6),maf(.9),coolant(),voltage()]),gateway()],
  lv:'PR',why:'Wysterowanie turbiny się zmienia, a ciśnienie doładowania prawie nie reaguje: ślad problemu w sterowaniu doładowaniem (siłownik VNT, zawór N75, czujnik położenia).',
  h:['Siłownik VNT lub zawór sterujący N75','Czujnik położenia VNT (P2563 sporadyczny)'],nx:['Test ruchu siłownika i podciśnienia','Sprawdzenie czujnika położenia i okablowania'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Wysterowanie turbosprężarki (VNT)','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'vw-golf-map',make:'VOLKSWAGEN',model:'Golf VII 1.6 TDI (2016)',vin:'WVWZZZAUZGW123456',scen:'P0299 i zaniżony odczyt MAP',sym:'słabe przyspieszanie',
  ecus:[ecu('01','Elektronika silnika','04L906021DT',[D0299,['P0069','Korelacja ciśnienia w kolektorze i ciśnienia atmosferycznego',SPO]],[rpm(),load(),boostSet(),boostAct(140,1,.85),vnt(30,50),maf(1),atm(),coolant(),voltage()]),gearbox(),gateway()],
  lv:'PR',why:'Czujnik ciśnienia w kolektorze zaniża odczyt także na postoju (ok. 86 kPa przy 101 kPa atmosferycznego): to błąd pomiaru, a nie brak doładowania.',
  h:['Zaniżony odczyt czujnika MAP','Zasilanie lub złącze czujnika'],nx:['Porównanie MAP z ciśnieniem atmosferycznym przy zapłonie bez silnika','Sprawdzenie zasilania 5 V i złącza czujnika'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Ciśnienie atmosferyczne','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'skoda-octavia-zasilanie',make:'SKODA',model:'Octavia III 2.0 TDI (2017)',vin:'TMBZZZAAZHB123456',scen:'kody komunikacji i spadki napięcia',sym:'gasną kontrolki, chwilowy brak komunikacji',
  ecus:[ecu('01','Elektronika silnika','04L906056HT',[['P0562','Napięcie zasilania za niskie',SPO],['U0121','Utrata komunikacji ze sterownikiem ABS',HIS]],[rpm(),load(),voltage(true),coolant()]),ecu('03','ABS / ESP','5Q0907379',[['U0100','Utrata komunikacji ze sterownikiem silnika (ECM)',HIS]],[voltage(true),P('Prędkość koła przednie lewe','km/h',0,function(t){return 45*dem(t-2)})]),gateway([['U0100','Utrata komunikacji ze sterownikiem silnika (ECM)',HIS]],true)],
  lv:'PR',why:'Kilka kodów utraty komunikacji i P0562 mają wspólną przyczynę: napięcie spada pod obciążeniem, a odczyty zanikają. Ślad zasilania lub masy.',
  h:['Zasilanie lub masa (spadek napięcia pod obciążeniem)','Akumulator lub klemy'],nx:['Pomiar spadku napięcia na zasilaniu i masie pod obciążeniem','Sprawdzenie akumulatora, klem i mas silnika i nadwozia'],
  pids:['Napięcie zasilania','Obciążenie silnika','Prędkość obrotowa silnika','Temperatura cieczy chłodzącej']},
 {id:'audi-a6-maf',make:'AUDI',model:'A6 C7 3.0 TDI (2015)',vin:'WAUZZZ4G1FN012345',scen:'P0101 przepływomierz',sym:'słabe osiągi, dymi przy przyspieszaniu',
  ecus:[ecu('01','Elektronika silnika','4G0907401',[['P0101','Przepływomierz powietrza: zakres/działanie',AKT]],[rpm(),load(),boostSet(),boostAct(138,1),maf(.55),coolant(),voltage()]),gateway()],
  lv:'PR',why:'Przepływomierz zaniża masę powietrza pod obciążeniem (ok. 55% wartości oczekiwanej), a doładowanie jest poprawne: ślad błędnego pomiaru przepływu.',
  h:['Przepływomierz (zanieczyszczenie lub uszkodzenie)','Dolot za przepływomierzem'],nx:['Oględziny i sprawdzenie przepływomierza oraz dolotu za nim','Porównanie z obliczonym przepływem'],
  pids:['Masa powietrza (MAF)','Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'vw-passat-sprawny',make:'VOLKSWAGEN',model:'Passat B8 2.0 TDI (2019)',vin:'WVWZZZ3CZKE123456',scen:'bez kodów usterek',sym:'',
  ecus:[ecu('01','Elektronika silnika','04L907309R',[],[rpm(),load(),boostSet(),boostAct(138,.9),vnt(30,45),maf(1),coolant(),voltage()]),gearbox(),gateway()],
  lv:'OB',why:'Brak kodów usterek. Pusta lista kodów nie potwierdza braku usterki. Live Data w normie.',
  h:['Brak śladu usterki w zarejestrowanym przebiegu'],nx:['Jazda próbna w warunkach, w których występuje objaw','Powtórzenie pomiaru, gdy objaw się pojawi'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'seat-leon-objaw-bez-kodow',make:'SEAT',model:'Leon III 2.0 TDI (2016)',vin:'VSSZZZ5FZGR123456',scen:'utrata mocy i gwizd, brak kodów',sym:'utrata mocy i gwizd przy przyspieszaniu, brak kodów',
  ecus:[ecu('01','Elektronika silnika','04L906021AH',[],[rpm(),load(),speed(),coolant(),intakeT(),boostSet(),boostAct(75,1.2),vnt(32,58),maf(.84),railSet(),railAct(),voltage()]),gearbox(),gateway()],
  lv:'PR',why:'Nieszczelność dolotu bez zapisanego kodu: asystent dobrał parametry z samego objawu. Ciśnienie doładowania nie nadąża, a MAF jest niższy.',
  h:['Nieszczelność układu doładowania','Regulacja turbiny'],nx:['Próba szczelności układu doładowania','Oględziny przewodów i intercoolera'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Wysterowanie turbosprężarki (VNT)','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'skoda-superb-p0087',make:'SKODA',model:'Superb II 2.0 TDI CR (2012)',vin:'TMBZZZ3TZC9012345',scen:'P0087 ciśnienie paliwa za niskie',sym:'przerywa i traci moc pod obciążeniem',
  ecus:[ecu('01','Elektronika silnika','03L906022G',[['P0087','Ciśnienie paliwa w szynie za niskie',AKT]],[rpm(),load(),speed(),coolant(),railSet(),railAct(1080),fuelReg(true),boostSet(),boostAct(132,1),voltage()]),gateway()],
  lv:'PR',why:'Regulator ilości paliwa jest wysterowany do maksimum, a ciśnienie w szynie nie osiąga zadanego pod obciążeniem: ślad niedoboru paliwa po stronie zasilania.',
  h:['Niedobór paliwa na zasilaniu (filtr, pompa wstępna)','Pompa wysokiego ciśnienia'],nx:['Sprawdzenie filtra paliwa, pompy wstępnej i ciśnienia zasilania niskiego','Wysokie ciśnienie dopiero po wykluczeniu zasilania'],
  pids:['Ciśnienie paliwa zadane','Ciśnienie paliwa rzeczywiste','Zawór regulacji ilości paliwa (N290) wysterowanie','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'vw-tiguan-egr-mylacy-maf',make:'VOLKSWAGEN',model:'Tiguan 2.0 TDI (2013)',vin:'WVGZZZ5NZDW012345',scen:'P0101 historyczny, czarny dym',sym:'utrata mocy i czarny dym',
  ecus:[ecu('01','Elektronika silnika','03L906018JL',[['P0101','Przepływomierz powietrza: zakres/działanie',HIS]],[rpm(),load(),coolant(),mafSet(),mafEgr(45),egrSet(),egrAct(45),boostSet(),boostAct(136,1),voltage()]),gearbox(),gateway()],
  lv:'PR',why:'Kod mylący: zapisany P0101 (przepływomierz) jest historyczny, a przebiegi wskazują zawór EGR zawieszony w położeniu otwartym (ok. 45%), który zaniża przepływ powietrza.',
  h:['Zawór EGR zawieszony w położeniu otwartym','Przepływomierz (kod historyczny, mało prawdopodobny)'],nx:['Sprawdzenie ruchu zaworu EGR i jego sterowania','Nie zakładać usterki przepływomierza z samego kodu historycznego'],
  pids:['Zawór EGR wartość zadana','Zawór EGR położenie rzeczywiste','Masa powietrza zadana','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']},
 {id:'audi-a3-ref5v',make:'AUDI',model:'A3 8V 2.0 TDI (2015)',vin:'WAUZZZ8V5FA012345',scen:'kilka kodów czujników, tryb awaryjny',sym:'tryb awaryjny, nie reaguje na gaz',
  ecus:[ecu('01','Elektronika silnika','04L907309B',[['P0237','Czujnik ciśnienia doładowania: obwód sygnał niski',AKT],['P0192','Czujnik ciśnienia paliwa w szynie: obwód sygnał niski',AKT],['P2122','Czujnik położenia pedału przyspieszenia D: obwód sygnał niski',SPO]],[P('Prędkość obrotowa silnika','obr/min',0,function(){return 1150+nz(10)}),load(),coolant(),P('Ciśnienie doładowania rzeczywiste','kPa',0,function(){return 8+nz(.5)}),railSet(),railAct(1600,true),pedal(true),voltage()]),gateway()],
  lv:'PR',why:'Kilka kodów czujników w jednym sterowniku i niskie sygnały ciśnienia i pedału mają wspólną przyczynę: ślad zwarcia napięcia referencyjnego 5 V.',
  h:['Zwarcie lub spadek napięcia referencyjnego 5 V czujników','Pojedyncze czujniki (mało prawdopodobne przy wspólnych objawach)'],nx:['Pomiar napięcia referencyjnego 5 V na czujnikach','Odłączanie kolejnych czujników z obserwacją powrotu napięcia'],
  pids:['Ciśnienie doładowania rzeczywiste','Ciśnienie paliwa zadane','Ciśnienie paliwa rzeczywiste','Położenie pedału przyspieszenia','Napięcie zasilania']},
 {id:'ford-focus-cyl2',make:'FORD',model:'Focus III 1.6 TDCi (2014)',vin:'WF0LXXGCBLEA12345',scen:'P0302 nierówna praca',sym:'nierówna praca na biegu jałowym, trzęsie',
  ecus:[ecu('01','Elektronika silnika','BV61-12A650',[['P0302','Wykryto wypadanie zapłonów cylinder 2',AKT],['P0300','Wykryto losowe wypadanie zapłonów',SPO]],[idleRough(),load(),coolant(),inj(1,.4),inj(2,4.6),inj(3,-.6),inj(4,.3),railSet(),railAct(),voltage()])],
  lv:'PR',why:'Korekta dawki cylindra 2 wyraźnie odstaje od pozostałych. To przesłanka dotycząca cylindra 2, a nie decyzja o wtryskiwaczu: najpierw wyklucza się zasilanie, ciśnienie, elektrykę i mechanikę cylindra.',
  h:['Wtryskiwacz lub układ cylindra 2','Elektryka obwodu wtryskiwacza, zasilanie, mechanika cylindra'],nx:['Wykluczenie zasilania, ciśnienia i elektryki cylindra 2','Test zamiany wtryskiwaczy dopiero po wykluczeniu reszty'],
  pids:['Korekta dawki wtrysku cylinder 1','Korekta dawki wtrysku cylinder 2','Korekta dawki wtrysku cylinder 3','Korekta dawki wtrysku cylinder 4','Prędkość obrotowa silnika']},
 {id:'opel-astra-p0128',make:'OPEL',model:'Astra J 1.7 CDTI (2013)',vin:'W0LPD6EA1DG012345',scen:'P0128 słabo grzeje',sym:'słabo grzeje, duże spalanie',
  ecus:[ecu('01','Elektronika silnika','55581635',[['P0128','Temperatura cieczy chłodzącej poniżej temperatury regulacji termostatu',AKT]],[rpm(),load(),speed(),P('Temperatura cieczy chłodzącej','°C',0,function(t){return 58+Math.min(t,60)/30+nz(.2)}),intakeT(),voltage()])],
  lv:'PR',why:'Temperatura cieczy nie dochodzi do temperatury pracy mimo obciążenia: ślad termostatu otwartego lub błędnego pomiaru temperatury.',
  h:['Termostat otwarty','Czujnik temperatury cieczy'],nx:['Sprawdzenie termostatu i porównanie odczytu czujnika z pomiarem zewnętrznym'],
  pids:['Temperatura cieczy chłodzącej','Temperatura powietrza zasysanego','Obciążenie silnika','Prędkość pojazdu']},
 {id:'vw-sharan-p0299-u-historyczny',make:'VOLKSWAGEN',model:'Sharan 2.0 TDI (2017)',vin:'WVWZZZ7NZHV012345',scen:'P0299 i historyczny U0121',sym:'utrata mocy na autostradzie',
  ecus:[ecu('01','Elektronika silnika','04L906021ED',[D0299,['U0121','Utrata komunikacji ze sterownikiem ABS',HIS]],[rpm(),load(),speed(),boostSet(),boostAct(72,1.2),vnt(32,60),maf(.83),coolant(),voltage(),P('Stan magistrali CAN napędu','%',0,function(){return 100})]),gearbox(),gateway()],
  lv:'PR',why:'Nieszczelność po stronie doładowania (ciśnienie nie nadąża, MAF niższy). Historyczny kod U0121 nie ma związku z utratą mocy.',
  h:['Nieszczelność układu doładowania','Kod historyczny U0121: bez związku z objawem'],nx:['Próba szczelności układu doładowania','Kod U0121 pozostawić bez działań dla tego objawu'],
  pids:['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste','Wysterowanie turbosprężarki (VNT)','Masa powietrza (MAF)','Obciążenie silnika','Prędkość obrotowa silnika']}
];
var MAKES=['AUDI','VOLKSWAGEN','SKODA','SEAT','FORD','OPEL'];
var ENGINE_LIST=[P('Temperatura oleju silnika','°C',0,function(t){return 84+Math.min(t,120)/40+nz(.3)}),P('Temperatura paliwa','°C',0,function(t){return 31+Math.min(t,120)/60+nz(.2)}),P('Ilość wtrysku','mg/skok',1,function(t){return 6.5+38*dem(t)+nz(.3)}),P('Początek wtrysku','°KW',1,function(t){return 1.5+6*dem(t)+nz(.1)}),P('Temperatura spalin przed DPF','°C',0,function(t){return 230+320*dem(t-1.5)+nz(3)}),P('Różnica ciśnień filtra DPF','hPa',1,function(t){return 4+55*dem(t)+nz(.4)}),P('Zapełnienie filtra DPF','%',0,function(){return 22}),P('Wysterowanie wentylatora chłodnicy','%',0,function(){return 0}),P('Temperatura powietrza zasysanego','°C',0,function(){return 24+nz(.5)}),P('Prędkość pojazdu','km/h',0,function(t){return 20+60*dem(t-2)}),P('Położenie pedału przyspieszenia','%',0,function(t){return 100*dem(t)+nz(.3)}),P('Moment obrotowy rzeczywisty','Nm',0,function(t){return 40+300*dem(t-.5)+nz(3)})];
function lvsList(e){if(e.a!=='01')return e.pids;return e.pids.concat(ENGINE_LIST.filter(function(f){return !e.pids.some(function(p){return p.n===f.n})}))}
var PAIRS=[['Ciśnienie doładowania zadane','Ciśnienie doładowania rzeczywiste'],['Ciśnienie paliwa zadane','Ciśnienie paliwa rzeczywiste'],['Zawór EGR wartość zadana','Zawór EGR położenie rzeczywiste'],['Masa powietrza zadana','Masa powietrza (MAF)']];
var COLORS=['#f0d078','#ef5350','#5adce8','#8cf080','#c792ea','#ffa94d'];

/* ================= stan sesji ================= */
var SESS={v:null,npids:0,dtc:[],steps:[],answer:'',reports:[],net:true,mistral:true,src:'EKO-SCAN'};
window.__sess=SESS;
function engineEcu(v){return v.ecus[0]}
function setSession(v){SESS.v=v;SESS.npids=lvsList(engineEcu(v)).length;SESS.dtc=engineEcu(v).dtc.slice()}

/* ================= pomocnicze UI ================= */
function mk(id,html,cls){var s=document.createElement('section');s.className='scr '+(cls||'');s.id='s-'+id;s.innerHTML=html;APP.appendChild(s);return s}
function on(el,ev,f){if(el)el.addEventListener(ev,f)}
function qs(root,sel){return root.querySelector(sel)}
var SIM='<div class="sim">SYMULACJA · TRYB TESTOWY: dane testowe, nie z pojazdu</div>';
var ICON={an:'<svg viewBox="0 0 40 40"><rect x="6" y="12" width="28" height="18" rx="3"/><path d="M14 12V8h12v4M20 16l-4 6h6l-4 6"/></svg>',live:'<svg viewBox="0 0 40 40"><path d="M5 31l8-9 6 5 8-13 8 6"/><path d="M5 35h30"/></svg>',rap:'<svg viewBox="0 0 40 40"><path d="M10 5h14l8 8v22H10z"/><path d="M24 5v8h8M15 20h12M15 26h12M15 32h8"/></svg>',fun:'<svg viewBox="0 0 40 40"><path d="M10 10h4M10 20h4M10 30h4M18 10h14M18 20h14M18 30h14"/></svg>',cal:'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="2"/><path d="M20 4v8M20 28v8M4 20h8M28 20h8"/></svg>',set:'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="6"/><path d="M20 4v6M20 30v6M4 20h6M30 20h6M9 9l4 4M27 27l4 4M31 9l-4 4M13 27l-4 4"/></svg>'};

/* ---------- ekran HUB (lista opcji jak w aplikacji) ---------- */
var HUB=mk('hub','<div class="tbh"></div><div class="bar"><b id="hubT"></b><span id="hubS"></span></div><div class="rows" id="hubR"></div><button class="bigbtn hubback" id="hubB">←  POWRÓT DO PANELU</button>');
function hub(title,sub,rows,back){
  $('hubT').textContent=title;$('hubS').textContent=sub;
  var h='';rows.forEach(function(r,i){h+='<button class="rw" data-i="'+i+'"><div><b>'+r.t+'</b><span>'+r.d+'</span></div><i>›</i></button>'});
  $('hubR').innerHTML=h;
  HUB.querySelectorAll('.rw').forEach(function(b){b.onclick=function(){rows[+b.dataset.i].go()}});
  $('hubB').onclick=back||function(){C.show('home')};
  fillTb();C.show('hub');
}
C.register('hub',HUB);C.register('menu',document.getElementById('s-menu'),{on:fillTb});

/* ---------- wybór scenariusza pojazdu ---------- */
var VS=mk('veh','<div class="tbh"></div><div class="bar"><b id="vehT"></b><span>wybór scenariusza symulacji</span></div><div class="tabs2" id="vehM"></div><div class="scs" id="vehL"></div><div class="sdesc" id="vehD"></div><div class="row2"><button class="bigbtn" id="vehBack">←  POWRÓT</button><button class="bigbtn gold" id="vehGo">START SYMULACJI  ▶</button></div>');
var VEHCB=null,VEHSEL=0,VEHMAKE='';
function pickVehicle(title,cb,back){
  VEHCB=cb;VEHSEL=0;VEHMAKE='';$('vehT').textContent=title;
  var m='<button class="on" data-m="">WSZYSTKIE</button>'+MAKES.map(function(x){return '<button data-m="'+x+'">'+x+'</button>'}).join('');
  $('vehM').innerHTML=m;
  $('vehM').querySelectorAll('button').forEach(function(b){b.onclick=function(){VEHMAKE=b.dataset.m;$('vehM').querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});renderVeh()}});
  $('vehBack').onclick=back||function(){C.show('home')};
  renderVeh();C.show('veh');
}
function vehList(){return VEH.filter(function(v){return !VEHMAKE||v.make===VEHMAKE})}
function renderVeh(){
  var L=vehList(),h='';if(VEHSEL>=L.length)VEHSEL=0;
  L.forEach(function(v,i){var n=engineEcu(v).dtc.length;h+='<button class="sc'+(i===VEHSEL?' sel':'')+'" data-i="'+i+'"><span class="k '+(n?'USTERKA':'SPRAWNY')+'">'+v.make+(n?' · '+n+' DTC':' · BEZ KODÓW')+'</span><b>'+v.model+'</b><span>'+v.scen+'</span></button>'});
  $('vehL').innerHTML=h;
  $('vehL').querySelectorAll('.sc').forEach(function(b){b.onclick=function(){VEHSEL=+b.dataset.i;renderVeh()}});
  var v=L[VEHSEL];$('vehD').innerHTML='<b style="color:#ffcc66">'+v.model+'.</b> Objaw zgłoszony przez klienta: '+(v.sym||'brak (pojazd bez zgłoszonej usterki)')+'. Pojazd i sterowniki są emulowane; asystent nie zna przyczyny.';
}
$('vehGo').onclick=function(){var v=vehList()[VEHSEL];if(VEHCB)VEHCB(v)};
C.register('veh',VS);

/* ---------- rysowanie wykresu wielokanałowego ---------- */
function plot(cv,series,o){
  var dpr=Math.min(2,window.devicePixelRatio||1),r=cv.getBoundingClientRect(),W=Math.max(10,r.width),H=Math.max(10,r.height);
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  var x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#06091a';x.fillRect(0,0,W,H);
  var L=40,R=8,T=8,B=16,w=W-L-R,t1=o.t,t0=t1-o.win;
  x.strokeStyle='#18244a';x.lineWidth=1;x.font='10px Roboto,Arial';x.fillStyle='#6f7fae';
  for(var i=0;i<=4;i++){var yy=T+(H-T-B)*i/4;x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke()}
  for(var g=Math.ceil(t0/5)*5;g<=t1;g+=5){var gx=L+(g-t0)/o.win*w;x.beginPath();x.moveTo(gx,T);x.lineTo(gx,H-B);x.stroke()}
  x.fillText('−'+o.win+' s',L,H-3);x.fillText('teraz',W-R-28,H-3);
  var n=series.length,lanes=o.mode==='lanes',lh=(H-T-B)/(lanes?Math.max(1,n):1);
  series.forEach(function(s,k){
    var pts=s.pts.filter(function(q){return q.t>=t0-1&&q.v!=null});if(pts.length<2)return;
    var mn=Infinity,mx=-Infinity;pts.forEach(function(q){mn=Math.min(mn,q.v);mx=Math.max(mx,q.v)});if(mx-mn<1e-6){mx=mn+1}
    var pad=(mx-mn)*.08;mn-=pad;mx+=pad;s.mn=mn;s.mx=mx;
    var top=lanes?T+k*lh:T,hh=lanes?lh-4:H-T-B;
    x.strokeStyle=s.color;x.lineWidth=2;x.setLineDash(s.dash?[7,5]:[]);x.beginPath();
    pts.forEach(function(q,j){var px=L+(q.t-t0)/o.win*w,py=top+hh-(q.v-mn)/(mx-mn)*hh;j?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();x.setLineDash([]);
    if(lanes){x.fillStyle=s.color;x.fillText(s.n+' ['+s.u+']  '+fm(mn,1)+'…'+fm(mx,1),L+4,top+11)}
  });
  (o.marks||[]).forEach(function(m){if(m>=t0&&m<=t1){var mx2=L+(m-t0)/o.win*w;x.strokeStyle='#ffd24a';x.setLineDash([3,3]);x.beginPath();x.moveTo(mx2,T);x.lineTo(mx2,H-B);x.stroke();x.setLineDash([])}});
  if(!lanes){x.font='11px Roboto,Arial';series.forEach(function(s,k){x.fillStyle=s.color;x.fillText(s.n.length>26?s.n.slice(0,25)+'…':s.n,L+4+(k%3)*Math.floor(w/3),T+11+Math.floor(k/3)*12)})}
}
function sparkline(cv,pts,color){var x=cv.getContext('2d'),W=cv.width,H=cv.height;x.clearRect(0,0,W,H);var a=pts.filter(function(p){return p!=null});if(a.length<2)return;var mn=Math.min.apply(null,a),mx=Math.max.apply(null,a);if(mx-mn<1e-6)mx=mn+1;x.strokeStyle=color;x.lineWidth=1.5;x.beginPath();a.forEach(function(v,i){var px=i/(a.length-1)*W,py=H-2-(v-mn)/(mx-mn)*(H-4);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}

/* ---------- silnik emulacji pomiaru (wspólny dla Live Data, Wykresów, Pomiaru, Jazdy, START) ---------- */
function Meas(v,ecuIdx){this.v=v;this.ecu=v.ecus[ecuIdx||0];this.t=0;this.acc=0;this.hist={};this.last={};this.marks=[];this.paused=false;this.list=lvsList(this.ecu);}
Meas.prototype.setEcu=function(i){this.ecu=this.v.ecus[i];this.list=lvsList(this.ecu);this.hist={};this.last={};};
Meas.prototype.step=function(dt){
  if(this.paused)return;var self=this;this.acc+=dt;
  while(this.acc>=.1){this.acc-=.1;this.t+=.1;
    this.list.forEach(function(p){var val=p.f(self.t);self.last[p.n]=val;var h=self.hist[p.n]||(self.hist[p.n]=[]);h.push({t:self.t,v:val});if(h.length>900)h.shift()})}
};
Meas.prototype.series=function(names){var self=this;return names.map(function(n,i){var p=self.list.filter(function(x){return x.n===n})[0];return {n:n,u:p?p.u:'',color:COLORS[i%COLORS.length],dash:/rzeczywist|MAF\)|położenie rzeczyw/.test(n)&&!/zadan/.test(n)&&names.some(function(m){return /zadan/.test(m)}),pts:self.hist[n]||[]}})};
function phaseText(t){var p=((t%30)+30)%30;return p<8?['POSTÓJ NA JAŁOWYM','Nie dotykaj pedału gazu. Zapis punktu odniesienia na biegu jałowym.']:p<11?['PRZYSPIESZANIE','Dodawaj gazu płynnie do pełnego obciążenia.']:p<20?['OBCIĄŻENIE','Utrzymaj pełne obciążenie. Asystent mierzy zadane i rzeczywiste.']:p<23?['ZWALNIANIE','Zdejmij gaz i zwolnij do jałowego.']:['POSTÓJ NA JAŁOWYM','Nie dotykaj pedału gazu. Zapis punktu odniesienia po cyklu.']}
function deviation(M){
  var out=[];PAIRS.forEach(function(pr){var a=M.hist[pr[0]],b=M.hist[pr[1]];if(!a||!b||a.length<30)return;
    var d=[],mx=0;a.forEach(function(q,i){if(b[i]&&q.v!=null&&b[i].v!=null){d.push(Math.abs(b[i].v-q.v));mx=Math.max(mx,Math.abs(q.v))}});if(!d.length)return;
    d.sort(function(x,y){return x-y});var p90=d[Math.floor(d.length*.9)];out.push({n:pr[1],p90:p90,pct:p90/Math.max(1,mx)*100})});return out}
/* ================= EKRAN: LIVE (Live Data / Wykresy / Pomiar / Jazda próbna) ================= */
var LV=mk('live','<div class="bar"><b id="lvT"></b><span id="lvS"></span></div>'+
 '<div class="ride"><div class="step" id="lvStep"><div class="k" id="lvK"></div><div class="c" id="lvC"></div><div class="w" id="lvW"></div><div class="pg" id="lvP"></div></div>'+
 '<div class="chartp" id="lvMain"><canvas id="lvCv"></canvas><div class="tbl" id="lvTbl" style="display:none"></div><div class="rd" id="lvRd"></div></div>'+
 '<div class="ctl" id="lvCtl"></div></div>'+
 '<div class="btns" id="lvBtn"></div><div class="ov" id="lvOv"><div class="card" id="lvOvC"></div></div>');
var L={mode:'',M:null,sel:[],view:'overlay',win:30,auto:true,gas:0,rec:false,tempo:2,raf:0,last:0,fin:false,qual:0};
function lvOpen(mode,v){
  L.mode=mode;L.M=new Meas(v,0);L.view=(mode==='wykresy'||mode==='pomiar')?'lanes':'overlay';L.win=30;L.auto=true;L.gas=0;L.rec=(mode==='pomiar'||mode==='jazda');L.fin=false;DR.ov=null;
  var ps=L.M.list.map(function(p){return p.n});
  L.sel=v.pids.filter(function(n){return ps.indexOf(n)>=0}).slice(0,6);if(!L.sel.length)L.sel=ps.slice(0,4);
  L.manual=(mode==='pomiar')?false:true;
  var T={live:'Live Data: parametry na żywo',wykresy:'Wykresy na żywo (szybkie próbkowanie)',pomiar:'Pomiar AUTO / MANUAL i wykres sesji',jazda:'Jazda próbna z asystentem'}[mode];
  $('lvT').textContent=T;$('lvS').textContent=v.make+' '+v.model+' · SYMULACJA';
  $('ovLvHide');$('lvOv').classList.remove('on');
  buildLvCtl();buildLvBtn();C.show('live');
}
function buildLvCtl(){
  var v=L.M.v,h='<h4>STEROWANIE POMIAREM (symulowane)</h4>';
  h+='<input class="inp" id="lvQ" placeholder="🔍  Szukaj parametru…" style="min-height:36px;margin-bottom:6px" value="'+(L.q||'')+'"><div class="small">Sterownik</div><select id="lvEcu" class="inp" style="min-height:36px">'+v.ecus.map(function(e,i){return '<option value="'+i+'">'+e.a+' '+e.n+'</option>'}).join('')+'</select>';
  h+='<div class="seg" style="margin-top:6px"><button id="lvAuto" class="'+(L.auto?'on':'')+'">JAZDA AUTO</button><button id="lvMan" class="'+(L.auto?'':'on')+'">GAZ RĘCZNIE</button></div>';
  h+='<div class="sl"><div class="lb"><span>Gaz</span><em id="lvGV" class="gd">0 %</em></div><input type="range" id="lvGas" min="0" max="100" value="0"></div>';
  if(L.mode==='pomiar')h+='<div class="seg"><button id="pmA" class="'+(L.manual?'':'on')+'">POMIAR AUTO</button><button id="pmM" class="'+(L.manual?'on':'')+'">MANUAL</button></div><div class="small" id="pmH"></div>';
  if(L.mode!=='live'&&L.mode!=='jazda'){h+='<div class="seg"><button id="vwO" class="'+(L.view==='overlay'?'on':'')+'">NAŁOŻONE</button><button id="vwL" class="'+(L.view==='lanes'?'on':'')+'">OSOBNE PASY</button></div><div class="seg" id="winS"><button data-w="15">15 s</button><button data-w="30" class="on">30 s</button><button data-w="60">60 s</button></div>'}
  if(L.mode!=='live'&&L.mode!=='jazda'){h+='<div class="small">PARAMETRY (maks. 6)</div><div class="plist" id="lvPl"></div>'}
  if(L.mode==='jazda')h+='<div class="small">Asystent dobrał parametry: '+L.sel.join(', ')+'.</div>';
  h+='<div class="seg" id="lvTempo" style="margin-top:6px"><button data-t="1">×1</button><button data-t="2" class="on">×2</button><button data-t="4">×4</button><button data-t="8">×8</button></div>';
  $('lvCtl').innerHTML=h;
  $('lvQ').oninput=function(){L.q=this.value.trim().toLowerCase();buildPl()};
  $('lvEcu').onchange=function(){L.M.setEcu(+$('lvEcu').value);var ps=L.M.list.map(function(p){return p.n});L.sel=L.sel.filter(function(n){return ps.indexOf(n)>=0});if(!L.sel.length)L.sel=ps.slice(0,4);buildPl()};
  $('lvAuto').onclick=function(){L.auto=true;DR.ov=null;$('lvAuto').classList.add('on');$('lvMan').classList.remove('on')};
  $('lvMan').onclick=function(){L.auto=false;DR.ov=$('lvGas').value/100;$('lvMan').classList.add('on');$('lvAuto').classList.remove('on')};
  $('lvGas').oninput=function(){L.auto=false;DR.ov=$('lvGas').value/100;$('lvGV').textContent=$('lvGas').value+' %';$('lvMan').classList.add('on');$('lvAuto').classList.remove('on')};
  if($('vwO')){$('vwO').onclick=function(){L.view='overlay';$('vwO').classList.add('on');$('vwL').classList.remove('on')};$('vwL').onclick=function(){L.view='lanes';$('vwL').classList.add('on');$('vwO').classList.remove('on')};
   $('winS').querySelectorAll('button').forEach(function(b){b.onclick=function(){L.win=+b.dataset.w;$('winS').querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)})}})}
  if($('pmA')){$('pmA').onclick=function(){L.manual=false;var ps=L.M.list.map(function(p){return p.n});L.sel=L.M.v.pids.filter(function(n){return ps.indexOf(n)>=0}).slice(0,6);$('pmA').classList.add('on');$('pmM').classList.remove('on');buildPl();pmHint()};$('pmM').onclick=function(){L.manual=true;$('pmM').classList.add('on');$('pmA').classList.remove('on');pmHint()};pmHint()}
  $('lvTempo').querySelectorAll('button').forEach(function(b){b.onclick=function(){L.tempo=+b.dataset.t;$('lvTempo').querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)})}});
  buildPl();
  var tb=L.mode==='live';$('lvCv').style.display=tb?'none':'block';$('lvTbl').style.display=tb?'block':'none';
}
function pmHint(){if($('pmH'))$('pmH').textContent=L.manual?'MANUAL: wybierasz parametry do pomiaru.':'AUTO: asystent dobiera parametry do przypadku (jak w START).'}
function buildPl(){
  var el=$('lvPl');if(!el)return;
  el.innerHTML=L.M.list.filter(function(p){return !L.q||p.n.toLowerCase().indexOf(L.q)>=0}).map(function(p){return '<label><input type="checkbox" data-n="'+p.n.replace(/"/g,'&quot;')+'"'+(L.sel.indexOf(p.n)>=0?' checked':'')+'>'+p.n+'</label>'}).join('');
  el.querySelectorAll('input').forEach(function(c){c.onchange=function(){var n=c.dataset.n;if(c.checked){if(L.sel.length>=6){c.checked=false;TOAST('Najwyżej 6 parametrów naraz.');return}L.sel.push(n)}else L.sel=L.sel.filter(function(x){return x!==n})}});
}
function buildLvBtn(){
  var b=$('lvBtn');b.className='btns';
  b.innerHTML='<button class="bigbtn gold" id="bMark">ZNACZNIK</button><button class="bigbtn" id="bFreeze">ZATRZYMAJ OBRAZ</button><button class="bigbtn" id="bClear">WYCZYŚĆ</button><button class="bigbtn red" id="bEnd">■ STOP</button><button class="bigbtn" id="bAsk">ZAPYTAJ</button><button class="bigbtn" id="bBk">←  POWRÓT</button>';
  b.style.gridTemplateColumns='1.3fr 1.3fr 1fr 1fr 1fr 1.2fr';
  $('bMark').onclick=function(){L.M.marks.push(L.M.t);TOAST('Znacznik na '+fm(L.M.t,1)+' s')};
  $('bFreeze').onclick=function(){L.M.paused=!L.M.paused;this.textContent=L.M.paused?'WZNÓW OBRAZ':'ZATRZYMAJ OBRAZ'};
  $('bClear').onclick=function(){L.M.hist={};L.M.t=0;L.M.marks=[]};
  $('bEnd').onclick=function(){lvFinish()};
  $('bAsk').onclick=function(){lvAsk()};
  $('bBk').onclick=function(){C.show('home')};
}
function lvAsk(){var v=L.M.v;$('lvOvC').innerHTML='<h3>Zapytaj asystenta</h3><p><b>Co wynika z bieżącego pomiaru dla tego przypadku?</b></p><p>'+answerFor(v)+'</p><div class="row2"><button class="bigbtn gold" id="ovOk">ZAMKNIJ</button></div>';$('lvOv').classList.add('on');$('ovOk').onclick=function(){$('lvOv').classList.remove('on')}}
function answerFor(v){return '<b>Odpowiedź asystenta (symulacja, bez modelu językowego):</b> '+v.why+' To przesłanka z pomiaru, nie wskazanie części do wymiany. Dalsze kroki: '+v.nx.join('; ')+'.'}
function lvFinish(){
  var M=L.M,v=M.v,dv=deviation(M),h;
  if(L.mode==='live'||L.mode==='wykresy'){L.M.paused=true;h='<h3>Pomiar zakończony</h3><p>Pomiar trwał '+fm(M.t,0)+' s. Znaczników: '+M.marks.length+'. Wrócić na panel?</p><div class="row2"><button class="bigbtn" id="ovA">ZOSTAŃ</button><button class="bigbtn gold" id="ovB">NA PANEL</button></div>';$('lvOvC').innerHTML=h;$('lvOv').classList.add('on');$('ovA').onclick=function(){$('lvOv').classList.remove('on');M.paused=false};$('ovB').onclick=function(){$('lvOv').classList.remove('on');C.show('home')};return}
  var rep={t:(L.mode==='jazda'?'Jazda próbna':'Pomiar sesji')+' · '+v.model,d:fm(M.t,0)+' s, odchylenia: '+(dv.length?dv.map(function(x){return x.n+' '+fm(x.pct,1)+'%'}).join('; '):'brak par zadana-rzeczywista')};
  SESS.reports.push(rep);setSession(v);SESS.answer=answerFor(v);
  h='<h3>'+(L.mode==='jazda'?'Jazda próbna zakończona':'Pomiar zapisany w sesji z wykresem i znacznikami')+'</h3>';
  h+='<div class="lvbadge '+(v.lv==='OB'?'cy':'warn')+'">'+(v.lv==='OB'?'OBSERWACJA (bez werdyktu)':'PRZESŁANKA USTERKI')+'</div><p style="margin-top:8px">'+v.why+'</p>';
  h+='<div class="nums">'+(dv.length?dv.map(function(x){return '<div><b>'+fm(x.pct,1)+' %</b><span>Odchylenie: '+x.n+' (p90)</span></div>'}).join(''):'<div><b>—</b><span>Odchylenie: brak par zadana/rzeczywista</span></div>')+'<div><b>'+M.marks.length+'</b><span>znaczników</span></div><div><b>'+fm(M.t,0)+' s</b><span>czas pomiaru</span></div></div>';
  h+='<ul>'+v.nx.map(function(n){return '<li>'+n+'</li>'}).join('')+'</ul><p class="small" style="color:#9fb0d8">Asystent ocenia z pomiaru, nie zna usterki i nie wskazuje części do wymiany.</p><div class="row2"><button class="bigbtn" id="ovA">POWTÓRZ</button><button class="bigbtn gold" id="ovB">NA PANEL</button></div>';
  $('lvOvC').innerHTML=h;$('lvOv').classList.add('on');M.paused=true;
  $('ovA').onclick=function(){$('lvOv').classList.remove('on');lvOpen(L.mode,v)};$('ovB').onclick=function(){$('lvOv').classList.remove('on');C.show('home')};
}
function lvFrame(ts){
  L.raf=requestAnimationFrame(lvFrame);var dt=Math.min(.1,(ts-L.last)/1000);L.last=ts;if(!(dt>0))return;
  var M=L.M;M.step(dt*L.tempo);
  var cv=$('lvCv');
  if(L.mode==='live'){
    var rows='<table><tr><th>PARAMETR</th><th>WARTOŚĆ</th><th>JEDNOSTKA</th><th>WYKRES (TREND)</th></tr>';
    M.list.forEach(function(p,i){if(L.q&&p.n.toLowerCase().indexOf(L.q)<0)return;var v=M.last[p.n];rows+='<tr><td>'+p.n+'</td><td class="v">'+(v==null?'---':fm(v,p.d))+'</td><td>'+p.u+'</td><td><canvas width="90" height="20" data-i="'+i+'"></canvas></td></tr>'});rows+='</table>';
    var sy=$('lvTbl').scrollTop;$('lvTbl').innerHTML=rows;$('lvTbl').scrollTop=sy;
    $('lvTbl').querySelectorAll('canvas').forEach(function(c){var p=M.list[+c.dataset.i],h=M.hist[p.n]||[];sparkline(c,h.slice(-60).map(function(q){return q.v}),'#5adce8')});
    $('lvRd').innerHTML='';
  }else{
    plot(cv,M.series(L.sel),{mode:L.view,win:L.win,t:M.t,marks:M.marks});
    $('lvRd').innerHTML=L.sel.slice(0,6).map(function(n,i){var p=M.list.filter(function(x){return x.n===n})[0],v=M.last[n];return '<div><div class="l" style="color:'+COLORS[i%6]+'">'+n+'</div><div class="v">'+(v==null?'---':fm(v,p?p.d:0))+' <small>'+(p?p.u:'')+'</small></div></div>'}).join('');
  }
  var ph=phaseText(M.t);
  if(L.mode==='jazda'){
    var tot=60;$('lvK').textContent='JAZDA PRÓBNA Z ASYSTENTEM · '+fm(M.t,0)+' z '+tot+' s';$('lvC').textContent=ph[0]+': '+ph[1];$('lvW').textContent='Asystent mierzy podczas jazdy i analizuje. Pojazd emulowany: ';$('lvP').style.width=cl(M.t/tot,0,1)*100+'%';
    if(M.t>=tot&&!L.fin){L.fin=true;lvFinish()}
  }else if(L.mode==='pomiar'){$('lvK').textContent=(L.rec?'● NAGRYWANIE':'POMIAR')+' · '+(L.manual?'MANUAL':'AUTO')+' · '+fm(M.t,0)+' s';$('lvC').textContent=ph[0]+': '+ph[1];$('lvW').textContent='Pomiar zapisany w sesji z wykresem i znacznikami. ■ STOP kończy pomiar.';$('lvP').style.width='0'}
  else{$('lvK').textContent=L.mode==='live'?'LIVE DATA · ODCZYT AKTYWNY · '+fm(10,0)+' Hz':'WYKRESY NA ŻYWO · SZYBKIE PRÓBKOWANIE';$('lvC').textContent=ph[0]+': '+ph[1];$('lvW').textContent='Gaz: '+(L.auto?'cykl jazdy auto (30 s)':'ręcznie '+$('lvGas').value+' %')+' · SYMULACJA · '+L.M.ecu.a+' '+L.M.ecu.n;$('lvP').style.width='0'}
}
C.register('live',LV,{on:function(){L.last=performance.now();if(!L.raf)L.raf=requestAnimationFrame(lvFrame)},off:function(){if(L.raf){cancelAnimationFrame(L.raf);L.raf=0}DR.ov=null}});

/* ================= EKRAN: START / DIAGNOSTYKA (DEMO: od zgłoszenia do wniosku) ================= */
var PH=['Zgłoszenie i START','EKO-SCAN: pojazd, sterownik, kody','Lista parametrów i dobór','Diagnosta zatwierdza','Pomiar w czasie rzeczywistym','Analiza: wniosek i test','Naprawa i pomiar kontrolny'];
var DG=mk('diag','<div class="bar"><b id="dgT"></b><span id="dgS"></span></div><div class="diag"><div class="stg" id="dgStg"></div><div class="card2" id="dgCard"></div><div class="ekos" id="dgEko"></div></div><div class="btns" id="dgBtn"></div>');
var DS=null,dgRaf=0,dgLast=0;
function diagStart(v){DS={v:v,st:1,M:null,sel:[],nav:0,tn:0,fin:false,repaired:false,sym:v.sym};setSession(v);SESS.steps=[];dgRender();C.show('diag')}
function eko(lines){return lines.map(function(l){return l}).join('<br>')}
function dgRender(){
  var v=DS.v,e=engineEcu(v);$('dgT').textContent='START / DIAGNOSTYKA';$('dgS').textContent=v.make+' '+v.model+' · SYMULACJA';
  $('dgStg').innerHTML=PH.map(function(p,i){return '<span class="'+(i+1===DS.st?'on':(i+1<DS.st?'ok':''))+'">'+(i+1)+'. '+p+'</span>'}).join('');
  var c='',ek='',btn='';
  if(DS.st===1){c='<h4>1. Zgłoszenie klienta i START</h4><p>Pojazd: <b>'+v.make+' '+v.model+'</b> · VIN '+v.vin+'</p><p>Objaw zgłoszony przez klienta:</p><input class="inp" id="dgSym" value="'+(v.sym||'').replace(/"/g,'&quot;')+'" placeholder="Brak objawu (pojazd bez zgłoszonej usterki)"><p class="small" style="color:#9fb0d8">Asystent prowadzi EKO-SCAN dotykiem: tylko odczyt i nawigacja, bez kasowania kodów, programowania i adaptacji.</p>';ek='<span class="hl">EKO-SCAN</span> · oczekiwanie na START<br>Łącznik VCI: połączony (symulacja)<br>Zapłon: włączony';btn='<button class="bigbtn gold" id="dgNext">START  ▶</button>'}
  else if(DS.st===2){var steps=['Pojazd: '+v.make+' '+v.model,'Wybór sterownika: '+e.a+' '+e.n,'Informacje o sterowniku: '+e.pn,'Kody usterek: odczyt'],n=Math.min(DS.nav,steps.length);
    c='<h4>2. Asystent prowadzi EKO-SCAN</h4>'+steps.slice(0,n).map(function(s){return '<p>✔ '+s+'</p>'}).join('');
    if(n>=steps.length){c+='<h4>Kody usterek ('+e.dtc.length+')</h4>'+(e.dtc.length?e.dtc.map(function(d){return '<div class="dtc"><b>'+d[0]+'</b> · '+d[1]+' · '+d[2]+'</div>'}).join(''):'<p>Brak kodów. Pusta lista nie potwierdza braku usterki.</p>')}else c+='<p class="small">Asystent dotyka ekranu EKO-SCAN…</p>';
    ek=steps.slice(0,n).map(function(s,i){return '<span class="hl">&gt; dotyk '+(i+1)+'</span> '+s}).join('<br>');btn='<button class="bigbtn gold" id="dgNext"'+(n<steps.length?' disabled':'')+'>DALEJ  ▶</button>'}
  else if(DS.st===3){var all=lvsList(e);c='<h4>3. Lista parametrów i dobór</h4><p>Sterownik podaje pełną listę ('+all.length+' parametrów). Asystent proponuje dobór z uzasadnieniem:</p>'+v.pids.filter(function(n){return all.some(function(p){return p.n===n})}).map(function(n){return '<p>• <b>'+n+'</b></p>'}).join('')+'<p class="small" style="color:#9fb0d8">Uzasadnienie: dobór wynika z objawu'+(e.dtc.length?' i zapisanych kodów ('+e.dtc.map(function(d){return d[0]}).join(', ')+')':' (brak kodów, tylko objaw)')+'; pary „zadane–zmierzone” pozwalają ocenić regulację.</p>';ek='<span class="hl">Strumień danych</span> · '+all.length+' parametrów<br>'+all.slice(0,12).map(function(p){return p.n}).join('<br>')+'<br>…';btn='<button class="bigbtn gold" id="dgNext">DALEJ  ▶</button>'}
  else if(DS.st===4){var all2=lvsList(e);if(!DS.sel.length)DS.sel=v.pids.filter(function(n){return all2.some(function(p){return p.n===n})}).slice(0,6);
    c='<h4>4. Diagnosta zatwierdza albo zmienia wybór</h4><div class="plist" style="max-height:none">'+all2.map(function(p){return '<label><input type="checkbox" data-n="'+p.n.replace(/"/g,'&quot;')+'"'+(DS.sel.indexOf(p.n)>=0?' checked':'')+'>'+p.n+'</label>'}).join('')+'</div>';ek='<span class="hl">Zaznaczanie w EKO-SCAN</span><br>Wybrane: '+DS.sel.length+' z '+all2.length;btn='<button class="bigbtn gold" id="dgNext">ZATWIERDZAM WYBÓR  ▶</button>'}
  else if(DS.st===5){c='<h4>5. Pomiar w czasie rzeczywistym</h4><div class="lgd" id="dgLg"></div><canvas id="dgCv"></canvas><p class="small" id="dgPh"></p>';ek='<span class="hl">Pomiar</span> na żywo z EKO-SCAN<br>Cykl jazdy 30 s (emulacja)';btn='<button class="bigbtn" id="dgPause">PAUZA</button><button class="bigbtn gold" id="dgNext" disabled>DALEJ  ▶</button>'}
  else if(DS.st===6){var dv=deviation(DS.M);c='<h4>6. Analiza: wniosek i test</h4><div class="lvbadge '+(v.lv==='OB'?'cy':'warn')+'">'+(v.lv==='OB'?'OBSERWACJA (bez werdyktu)':'PRZESŁANKA USTERKI')+'</div><p>'+v.why+'</p><p><b>Hipotezy (bez procentowej pewności):</b></p><ul>'+v.h.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul><p><b>Test dla diagnosty:</b></p><ul>'+v.nx.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'+(dv.length?'<p class="small">Odchylenie zadana–rzeczywista (p90): '+dv.map(function(x){return x.n+' '+fm(x.pct,1)+'%'}).join('; ')+'</p>':'')+'<p class="small" style="color:#9fb0d8">Asystent nie zna usterki z góry i nie wskazuje części do wymiany. Nie kasuje kodów ani adaptacji.</p>';
    ek='<span class="hl">Analiza</span><br>Przebiegi skonfrontowane z kodami i objawem.';SESS.answer=answerFor(v);btn='<button class="bigbtn gold" id="dgNext">DALEJ  ▶</button>'}
  else{var hasRep=v.id==='audi-a4-p0299-nieszczelnosc';c='<h4>7. Naprawa i pomiar kontrolny</h4>'+(hasRep?'<p>Scenariusz z naprawą: wymiana pękniętego węża intercoolera po stronie doładowania, kody skasowane przez diagnostę.</p>'+(DS.repaired?'<div class="lvbadge ok">KONTROLA POTWIERDZIŁA USTĄPIENIE OBJAWU</div><p>Po naprawie ciśnienie rzeczywiste nadąża za zadanym, MAF w normie, brak kodów.</p>':'<p>Wykonaj pomiar kontrolny po naprawie.</p>'):'<p>Dla tego scenariusza symulacja nie zawiera wariantu po naprawie. Raport z wnioskiem został zapisany; kontrolę po naprawie wykonuje diagnosta w pojeździe.</p>')+'<p class="small" style="color:#9fb0d8">Raport zapisany w „Analiza i raporty”.</p>';
    ek='<span class="hl">Zakończenie</span><br>Raport DEMO zapisany.';btn=(hasRep&&!DS.repaired?'<button class="bigbtn gold" id="dgRep">POMIAR KONTROLNY PO NAPRAWIE</button>':'')+'<button class="bigbtn gold" id="dgFin">ZAKOŃCZ I WYNIKI</button>'}
  $('dgCard').innerHTML=c;$('dgEko').innerHTML=ek;
  $('dgBtn').className='btns';$('dgBtn').style.gridTemplateColumns='1fr 2fr 1fr 1fr';$('dgBtn').innerHTML='<button class="bigbtn" id="dgBack">←  WSTECZ</button>'+btn+'<button class="bigbtn red" id="dgStop">STOP</button><button class="bigbtn" id="dgExit">NA PANEL</button>';
  $('dgBack').onclick=function(){if(DS.st>1){DS.st--;if(DS.st===2)DS.nav=4;dgRender()}else C.show('home')};
  $('dgStop').onclick=function(){TOAST('STOP: sesja zatrzymana; nowy START otwiera nową sesję.');C.show('home')};
  $('dgExit').onclick=function(){C.show('home')};
  if($('dgSym'))$('dgSym').oninput=function(){DS.sym=$('dgSym').value};
  if($('dgNext'))$('dgNext').onclick=function(){if(DS.st===4){DS.sel=[].slice.call(document.querySelectorAll('#dgCard input:checked')).map(function(c){return c.dataset.n});if(!DS.sel.length){TOAST('Zaznacz co najmniej jeden parametr.');return}if(DS.sel.length>6){TOAST('Najwyżej 6 parametrów naraz.');return}}
    if(DS.st===4){DS.M=new Meas(v,0);DS.fin=false}DS.st++;if(DS.st===2){DS.nav=0;DS.tn=0}dgRender()};
  document.querySelectorAll('#dgCard .plist input').forEach(function(c){c.onchange=function(){}});
  if($('dgPause'))$('dgPause').onclick=function(){DS.M.paused=!DS.M.paused;this.textContent=DS.M.paused?'WZNÓW':'PAUZA'};
  if($('dgRep'))$('dgRep').onclick=function(){DS.repaired=true;dgRender()};
  if($('dgFin'))$('dgFin').onclick=function(){SESS.reports.push({t:'START / diagnoza · '+v.model,d:v.scen+' · '+(v.lv==='OB'?'obserwacja':'przesłanka usterki')+(DS.repaired?' · kontrola po naprawie: ustąpienie objawu':'')});TOAST('Raport zapisany w „Analiza i raporty”.');C.show('home')};
  if(DS.st===5&&DS.M){var ser=DS.M.series(DS.sel);$('dgLg').innerHTML=ser.map(function(s){return '<span><i style="background:'+s.color+'"></i>'+s.n+'</span>'}).join('')}
}
function dgFrame(ts){
  dgRaf=requestAnimationFrame(dgFrame);var dt=Math.min(.1,(ts-dgLast)/1000);dgLast=ts;if(!(dt>0)||!DS)return;
  if(DS.st===2){DS.tn+=dt*2;var n=Math.floor(DS.tn/.9);if(n!==DS.nav&&DS.nav<4){DS.nav=Math.min(4,n);dgRender()}}
  if(DS.st===5&&DS.M){DS.M.step(dt*3);plot($('dgCv'),DS.M.series(DS.sel),{mode:'lanes',win:30,t:DS.M.t,marks:[]});var ph=phaseText(DS.M.t);$('dgPh').textContent=ph[0]+': '+ph[1]+' · '+fm(DS.M.t,0)+' z 30 s';
    if(DS.M.t>=30&&!DS.fin){DS.fin=true;var nb=$('dgNext');if(nb)nb.disabled=false}}
}
C.register('diag',DG,{on:function(){dgLast=performance.now();if(!dgRaf)dgRaf=requestAnimationFrame(dgFrame)},off:function(){if(dgRaf){cancelAnimationFrame(dgRaf);dgRaf=0}}});

/* ================= EKRAN: ANALIZA I RAPORTY ================= */
var AN=mk('an','<div class="tbh"></div><div class="bar"><b id="anT">Analiza i konsultacja</b><span id="anS"></span></div><div class="tabs2" id="anTabs"></div><div class="card2" id="anBody" style="flex:1"></div><div class="btns" id="anBtn"></div>');
var ANT='analiza',ANV=null;
function openAnaliza(tab,v){ANT=tab||'analiza';ANV=v||ANV||SESS.v;anRender();C.show('an')}
function anRender(){
  var tabs=[['analiza','Analiza i raport'],['rap','Raporty i historia'],['model','Konsultacja z modelem']];
  $('anTabs').innerHTML=tabs.map(function(t){return '<button data-t="'+t[0]+'" class="'+(ANT===t[0]?'on':'')+'">'+t[1]+'</button>'}).join('');
  $('anTabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){ANT=b.dataset.t;anRender()}});
  var v=ANV,h='';$('anS').textContent=v?v.make+' '+v.model+' · SYMULACJA':'brak sesji · SYMULACJA';
  if(ANT==='analiza'){
    if(!v)h='<h4>Analizuj sesję</h4><p>Brak potwierdzonego pojazdu. Wybierz scenariusz pojazdu, a asystent przeanalizuje jego sesję.</p>';
    else{var e=engineEcu(v);h='<h4>Analiza i raport</h4><div class="lvbadge '+(v.lv==='OB'?'cy':'warn')+'">'+(v.lv==='OB'?'OBSERWACJA (bez werdyktu)':'PRZESŁANKA USTERKI')+'</div><p><b>Objaw zgłoszony przez klienta:</b> '+(v.sym||'brak')+'</p><p><b>Kody ('+e.dtc.length+'):</b> '+(e.dtc.length?e.dtc.map(function(d){return d[0]+' ('+d[2]+')'}).join(', '):'brak; pusta lista nie potwierdza braku usterki')+'</p><p><b>Wniosek:</b> '+v.why+'</p><p><b>Hipotezy (obserwacje oddzielone od hipotez, bez procentowej pewności):</b></p><ul>'+v.h.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul><p><b>Kontrole na przebiegach / kolejne kroki:</b></p><ul>'+v.nx.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul><p><b>Parametry dobrane:</b> '+v.pids.join(', ')+'.</p><p class="small" style="color:#9fb0d8">Raport nie wskazuje części do wymiany. Brakujące pomiary: nie dotyczy w symulacji.</p>'}
  }else if(ANT==='rap'){h='<h4>Raporty i historia</h4>'+(SESS.reports.length?SESS.reports.map(function(r,i){return '<div class="dtc"><b>'+(i+1)+'. '+r.t+'</b><br>'+r.d+' <span style="float:right;color:#8cf080">symulacja</span></div>'}).join(''):'<p>Brak raportów. Zapisz raport w „Analiza i raport” albo zakończ pomiar lub START.</p>')+'<p class="small" style="color:#9fb0d8">Dane symulowane; oznaczone i oddzielone od pracy rzeczywistej.</p>'}
  else{h='<h4>Konsultacja z modelem</h4><p>Model dostaje raport jako DANE; odpowiedź pojawia się w panelu „Odpowiedź asystenta”.</p>'+(v?'<p>'+answerFor(v)+'</p>':'<p>Najpierw wybierz pojazd.</p>')+'<p class="small" style="color:#9fb0d8">W symulacji model językowy nie działa; to odpowiedź przygotowana z wyniku analizy.</p>'}
  $('anBody').innerHTML=h;
  var b='<button class="bigbtn" id="anVeh">WYBIERZ POJAZD</button>';if(ANT==='analiza'&&v)b+='<button class="bigbtn gold" id="anSave">ZAPISZ RAPORT</button>';if(ANT==='rap'&&SESS.reports.length)b+='<button class="bigbtn red" id="anDel">USUŃ RAPORTY</button>';b+='<button class="bigbtn" id="anBk">←  POWRÓT DO PANELU</button>';
  $('anBtn').className='btns';$('anBtn').style.gridTemplateColumns='repeat(auto-fit,minmax(150px,1fr))';$('anBtn').innerHTML=b;
  $('anBk').onclick=function(){C.show('home')};
  $('anVeh').onclick=function(){pickVehicle('Analiza i raport: wybór pojazdu',function(x){ANV=x;setSession(x);anRender();C.show('an')},function(){C.show('an')})};
  if($('anSave'))$('anSave').onclick=function(){SESS.reports.push({t:'Raport analizy · '+v.model,d:v.scen+' · '+(v.lv==='OB'?'obserwacja':'przesłanka usterki')});SESS.answer=answerFor(v);TOAST('Raport zapisany i sprawdzony.')};
  if($('anDel'))$('anDel').onclick=function(){SESS.reports=[];anRender()};
}
C.register('an',AN);

/* ================= EKRAN: KALIBRACJA EKO-SCAN ================= */
var KB=mk('kal','<div class="tbh"></div><div class="bar"><b>KALIBRACJA EKO-SCAN</b><span>test, zapis ekranów · SYMULACJA</span></div><div class="scs" id="kalS" style="flex:0 0 auto;grid-auto-rows:auto"></div><div class="card2" id="kalC" style="flex:1"></div><div class="btns" id="kalBtn"></div>');
var KSC=[{t:'EKO-SCAN reaguje poprawnie',d:'Wszystkie ekrany rozpoznane, dotyk bez opóźnień.',k:'SPRAWNY',lag:0,miss:0},{t:'Opóźniona reakcja dotyku',d:'Ekran odpowiada po ok. 1,5 s: asystent czeka dłużej na każdy ekran.',k:'GRANICZNY',lag:1.6,miss:0},{t:'Nierozpoznany ekran',d:'Jeden ekran (Strumień danych) nie jest rozpoznany: zapis ekranów pomaga to poprawić.',k:'USTERKA',lag:.4,miss:1}];
var KS=0,KRUN=null,KTIMER=0,KSCREENS=['Menu główne EKO-SCAN','Wybór pojazdu','Wybór sterownika','Informacje o sterowniku','Kody usterek','Strumień danych'];
function openKal(){KS=0;KRUN=null;kalRender();C.show('kal')}
function kalRender(){
  $('kalS').innerHTML=KSC.map(function(s,i){return '<button class="sc'+(i===KS?' sel':'')+'" data-i="'+i+'"><span class="k '+s.k+'">'+({SPRAWNY:'SPRAWNY',GRANICZNY:'OPÓŹNIENIE',USTERKA:'USTERKA'})[s.k]+'</span><b>'+s.t+'</b><span>'+s.d+'</span></button>'}).join('');
  $('kalS').querySelectorAll('.sc').forEach(function(b){b.onclick=function(){if(KRUN)return;KS=+b.dataset.i;kalRender()}});
  var c='<h4>Przygotowanie i start</h4><p>Przed testem: łącznik VCI w gnieździe OBD, zapłon włączony, Bluetooth w tablecie włączony.</p><p>Tylko odczyt i nawigacja: bez kasowania kodów, programowania i adaptacji.</p>';
  if(KRUN){c='<h4>Przebieg testu</h4>'+KRUN.log.map(function(l){return '<p>'+l+'</p>'}).join('')+(KRUN.done?'<h4>Co asystent widzi i jak rozpoznaje każdy ekran</h4><p>Odczytane ekrany: '+KRUN.ok+' z '+KSCREENS.length+'.'+(KRUN.miss?' Nierozpoznany: Strumień danych. Włącz „Zapis ekranów”, aby zebrać materiał do poprawy rozpoznawania menu, kodów i listy parametrów.':'')+'</p><div class="lvbadge '+(KRUN.miss?'warn':'ok')+'">'+(KRUN.miss?'CZĘŚCIOWO ROZPOZNANE':'WSZYSTKIE EKRANY ROZPOZNANE')+'</div>':'<p class="small">Każde dotknięcie potwierdza następny ekran.</p>')}
  $('kalC').innerHTML=c;
  $('kalBtn').className='btns';$('kalBtn').style.gridTemplateColumns='repeat(auto-fit,minmax(150px,1fr))';
  $('kalBtn').innerHTML='<button class="bigbtn gold" id="kalGo"'+(KRUN&&!KRUN.done?' disabled':'')+'>'+(KRUN&&KRUN.done?'POWTÓRZ TEST':'TAK, ROZPOCZNIJ')+'</button><button class="bigbtn red" id="kalStop">STOP TESTU</button><button class="bigbtn" id="kalRec">ZAPISUJ EKRANY</button><button class="bigbtn" id="kalBk">←  POWRÓT DO PANELU</button>';
  $('kalBk').onclick=function(){clearTimeout(KTIMER);KRUN=null;C.show('home')};
  $('kalStop').onclick=function(){clearTimeout(KTIMER);KRUN=null;kalRender()};
  $('kalRec').onclick=function(){TOAST('Zapis ekranów włączony: udostępnij zapis po teście (w symulacji bez pliku).')};
  $('kalGo').onclick=function(){var s=KSC[KS];KRUN={log:[],ok:0,miss:s.miss,done:false};var i=0;(function nxt(){if(!KRUN)return;if(i>=KSCREENS.length){KRUN.done=true;kalRender();return}var nm=KSCREENS[i],bad=s.miss&&nm==='Strumień danych';KRUN.log.push((bad?'✖ ':'✔ ')+nm+(bad?': nie rozpoznano':': rozpoznano'+(s.lag?' (po '+fm(s.lag,1)+' s)':'')));if(!bad)KRUN.ok++;i++;kalRender();KTIMER=setTimeout(nxt,(500+s.lag*500)/Math.max(1,window.__tempoK||1))})()};
}
C.register('kal',KB,{off:function(){clearTimeout(KTIMER)}});

/* ================= EKRAN: USTAWIENIA I SYSTEM ================= */
var THEMES=[['CZARNO-ZŁOTY','#f0a030','#0b1a3c'],['NIEBIESKI','#2cc4ff','#08224a'],['ZIELONY','#4caf50','#0b2a1b'],['CZERWONY','#ef5350','#2a0e12'],['FIOLETOWY','#b388ff','#1d1240'],['POMARAŃCZOWY','#ff8a3d','#2a1608'],['SZARY','#b0b8c4','#1c2230']];
var CFG={theme:0,size:100};
var SE=mk('set','<div class="tbh"></div><div class="bar"><b>Ustawienia i system</b><span>zgody, model, tablet · SYMULACJA</span></div><div class="setg" id="setG"></div><button class="bigbtn gold" id="setBk">←  POWRÓT DO PANELU</button>');
function swt(id,on,t,s){return '<div class="setr"><div><b>'+t+'</b><small>'+s+'</small></div><div class="sw'+(on?' on':'')+'" id="'+id+'" role="switch" aria-checked="'+on+'"></div></div>'}
function openSet(){
  var g='<div class="pn"><h5>Wygląd panelu</h5><div class="setr"><div><b>Motyw kolorów</b><small>Motyw kolorów całego panelu, razem z nagłówkiem i banerem</small></div></div><div class="thm" id="thm">'+THEMES.map(function(t,i){return '<button title="'+t[0]+'" data-i="'+i+'" class="'+(i===CFG.theme?'on':'')+'" style="background:linear-gradient(135deg,'+t[2]+' 50%,'+t[1]+' 50%)"></button>'}).join('')+'</div><div class="setr"><div><b>Wielkość panelu</b><small>100 % (cały ekran)</small></div></div><div class="seg" id="szS"><button data-z="100" class="'+(CFG.size===100?'on':'')+'">100 %</button><button data-z="90" class="'+(CFG.size===90?'on':'')+'">90 %</button><button data-z="80" class="'+(CFG.size===80?'on':'')+'">80 %</button></div></div>';
  g+='<div class="pn"><h5>Praca asystenta</h5>'+swt('swNet',SESS.net,'Dostęp do sieci','Wyszukiwanie w internecie, wiedza zewnętrzna')+swt('swMis',SESS.mistral,'Konsultant AI: Mistral','Darmowi konsultanci, bez płatności; błąd klucza nie blokuje pracy')+'<div class="setr"><div><b>Model lokalny (Qwen, llama.cpp)</b><small>Pobierz albo wybierz model lokalny (Qwen GGUF)</small></div><button class="sm" id="mdl">WYBIERZ</button></div></div>';
  g+='<div class="pn"><h5>Źródło danych</h5><div class="seg" id="srcS"><button data-s="EKO-SCAN" class="'+(SESS.src==='EKO-SCAN'?'on':'')+'">EKO-SCAN</button><button data-s="EMULATOR" class="'+(SESS.src==='EMULATOR'?'on':'')+'">EMULATOR (SYMULACJA)</button></div><div class="small">Głowica EKO: firmware, test, kalibracja — osobne okno w menu ANALIZATORY.</div><div class="setr"><div><b>Przygotowanie tabletu</b><small>Włącz usługę EKOTRONIK AI ASYSTENT w Dostępności Androida</small></div><button class="sm" id="prep">OTWÓRZ</button></div></div>';
  g+='<div class="pn"><h5>Czyszczenie</h5><div class="setr"><div><b>Wyczyść odpowiedzi asystenta</b><small>Dzienniki sesji i ślad audytu zostają</small></div><button class="sm" id="clA">WYCZYŚĆ</button></div><div class="setr"><div><b>Usuń raporty sesji</b><small>Raport DEMO / SYMULACJA</small></div><button class="sm" id="clR">USUŃ</button></div></div>';
  $('setG').innerHTML=g;
  $('thm').querySelectorAll('button').forEach(function(b){b.onclick=function(){CFG.theme=+b.dataset.i;applyCfg();openSet()}});
  $('szS').querySelectorAll('button').forEach(function(b){b.onclick=function(){CFG.size=+b.dataset.z;applyCfg();openSet()}});
  $('swNet').onclick=function(){SESS.net=!SESS.net;openSet();homeRender()};$('swMis').onclick=function(){SESS.mistral=!SESS.mistral;openSet();homeRender()};
  $('srcS').querySelectorAll('button').forEach(function(b){b.onclick=function(){SESS.src=b.dataset.s;openSet();homeRender()}});
  $('mdl').onclick=function(){TOAST('Model lokalny: w symulacji bez pobierania.')};$('prep').onclick=function(){TOAST('Usługa Dostępności: tylko na tablecie z aplikacją.')};
  $('clA').onclick=function(){SESS.answer='';homeRender();TOAST('Wyczyszczono odpowiedzi asystenta.')};$('clR').onclick=function(){SESS.reports=[];TOAST('Usunięto raporty sesji.')};
  C.show('set');
}
function applyCfg(){var t=THEMES[CFG.theme];APP.style.setProperty('--ap',t[1]);APP.style.setProperty('--border',t[1]);APP.style.zoom=CFG.size/100;APP.style.height=CFG.size<100?(Math.round(100/CFG.size*1000)/10)+'%':''}
$('setBk').onclick=function(){C.show('home')};
C.register('set',SE);

/* ================= PANEL GŁÓWNY (jak na zdjęciu tabletu) ================= */
var HM=$('s-home');
function wp(kind,ic,extra){return '<div class="tw wp"><img class="ic" src="img/'+ic+'" alt="">'+(extra||'')+'<canvas class="wv" data-w="'+kind+'"></canvas><small class="vl">'+({can:'4.0V<br>2.5V<br>1.0V',pwm:'15V<br>0V<br>-15V',inj:'200V<br>100V<br>0V'})[kind]+'</small></div>'}
function topBar(sec){
  var id=function(x){return sec?'':' id="'+x+'"'},on=SESS.v;
  return '<div class="tb"><div class="lg"><img src="img/logo_eko.png" alt=""><div><b>EKOTRONIK AI</b><small>A S Y S T E N T</small></div></div><div class="wvs">'+
  wp('can','ikona_can.png','<small class="cn"><i style="color:#4DE3F5">CAN-H</i><i style="color:#6BE36B">CAN-L</i></small>')+wp('pwm','ikona_pwm.png')+wp('inj','ikona_wtrysk.png')+'</div>'+
  '<div class="tw st"><b><u class="dot'+(on||SESS.src!=='EKO-SCAN'?' g':'')+'"></u>'+(SESS.src==='EKO-SCAN'?'EKO-SCAN: '+(on?'odczyt ekranu':'niepołączony'):'EMULATOR (SYMULACJA)')+'  ▾</b><span>Model: załadowany</span><span>Pojazd: '+(on?'potwierdzono':'nie potwierdzono')+'</span></div>'+
  '<button class="ib"'+id('hMic')+' title="Mikrofon">'+MICSVG+'</button><button class="ib"'+id('hSet')+' title="Ustawienia">⚙</button></div>';
}
/* przebiegi banera: kształty i skale z Brand.kt (CAN-H/L, PWM ±15 V, wtryskiwacz do 200 V) */
var CANB='000000000110100110100100000000000000011010110101101010000000';
function wPwm(u){var b=(u*3)%1;if(b>.62)return -10;return ((b/.62)*5%1)<.5?15:-10}
function wInj(u){var base=8;if(u<.12)return base;if(u<.135)return base+(200-base)*(u-.12)/.015;if(u<.55){var d=(u-.135)/.415;return 100+100*Math.exp(-d*18)+7*Math.exp(-d*9)*Math.sin(d*120)}if(u<.565)return 100-(100-base)*(u-.55)/.015;var e=(u-.565)/.435;return base+9*Math.exp(-e*14)*Math.sin(e*150)}
function canD(u){return CANB.charAt(Math.max(0,Math.min(CANB.length-1,Math.floor(u*CANB.length))))==='1'}
var WV={can:[.5,4.5],pwm:[-20,20],inj:[-15,225]};
function drawWaves(ts){
  var ph=((ts||0)%6000)/6000;
  document.querySelectorAll('canvas.wv').forEach(function(c){
    var r=c.getBoundingClientRect();if(r.width<4)return;var d=Math.min(2,window.devicePixelRatio||1),w=Math.round(r.width*d),h=Math.round(r.height*d);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h}
    var x=c.getContext('2d');x.clearRect(0,0,w,h);x.strokeStyle='rgba(142,107,44,.22)';x.lineWidth=1;
    for(var i=1;i<8;i++){x.beginPath();x.moveTo(w*i/8,0);x.lineTo(w*i/8,h);x.stroke()}for(i=1;i<3;i++){x.beginPath();x.moveTo(0,h*i/3);x.lineTo(w,h*i/3);x.stroke()}
    var k=c.dataset.w,mn=WV[k][0],mx=WV[k][1];
    function tr(col,f){x.beginPath();var n=Math.max(60,Math.min(300,Math.round(w/2)));for(var i=0;i<=n;i++){var u=((i/n)+ph)%1,y=h-(f(u)-mn)/(mx-mn)*h;i?x.lineTo(w*i/n,y):x.moveTo(0,y)}x.strokeStyle=col;x.globalAlpha=.25;x.lineWidth=5*d/1.5;x.stroke();x.globalAlpha=1;x.lineWidth=1.8*d/1.2;x.stroke()}
    if(k==='can'){tr('#4DE3F5',function(u){return canD(u)?3.5:2.6});tr('#6BE36B',function(u){return canD(u)?1.5:2.4})}
    else if(k==='pwm')tr('#D6A852',wPwm);else tr('#F4D89A',wInj);
  });
  requestAnimationFrame(drawWaves);
}
requestAnimationFrame(drawWaves);
var MICSVG='<svg viewBox="0 0 24 24" width="26" height="26"><rect x="9" y="3" width="6" height="12" rx="3" fill="#4aa8ff"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="#4aa8ff" fill="none" stroke-width="2"/></svg>';
var GEARSVG_UNUSED='<svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#5db7ff" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#5db7ff" stroke-width="2.4"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#5db7ff" stroke-width="2"/></svg>';
var _cs=C.show;C.show=function(){fillTb();return _cs.apply(this,arguments)};
function fillTb(){document.querySelectorAll('.tbh').forEach(function(e){e.innerHTML=topBar(true)})}
function homeRender(){
  var v=SESS.v,e=v?engineEcu(v):null;
  var h=topBar()+'<div class="mp"><div class="col">'+
   '<div class="pn" style="flex:0 0 auto"><h5>01 / STAN ASYSTENTA <button class="sm" id="hDet">SZCZEGÓŁY ›</button></h5><div class="chips"><div><b>Model</b><span>załadowany (qwen2.5-…)</span></div><div><b>EKO-SCAN</b><span>'+(v?'sesja aktywna':'czeka na EKO-SCAN')+'</span></div></div><div class="kv"><span>Pojazd</span><span>'+(v?v.make+' '+v.model:'nie potwierdzono')+'</span><span>Ekran</span><span>'+(v?'inny ekran EKO-SCAN · 14 s temu':'brak obserwacji')+'</span><span>DTC · Live</span><span>'+(v?e.dtc.length+' DTC · '+SESS.npids+' parametrów':'brak · brak pomiarów')+'</span></div><div class="small" style="font-size:.7rem">STOP aktywny: sesja zatrzymana; nowy START otwiera nową sesję</div></div>'+
   '<div class="pn" style="flex:1"><h5>PODGLĄD BIEŻĄCEJ SESJI</h5><div class="tabs2" id="pvT"><button data-t="dtc" class="on">DTC</button><button data-t="par">Parametry</button><button data-t="prz">Przebieg</button></div><div class="strip">EKO-SCAN · obserwacja ekranu · odtworzone z dziennika</div><div class="pv" id="pvB"></div></div></div>'+
  '<div class="col"><div class="pn" style="flex:0 0 auto"><h5>02 / ZADANIE '+(SESS.net?'<em>DOSTĘP DO SIECI</em>':'<em style="background:#b71c1c;color:#fff">BEZ SIECI</em>')+'</h5>'+(SESS.mistral?'<div><span class="chip">AI: MISTRAL WŁ.</span></div>':'<div><span class="chip cy">AI: WYŁ.</span></div>')+'<input class="inp" id="hQ" placeholder="Wpisz pytanie lub opisz objaw..."><button class="mb" id="hPdf">ZAŁĄCZ RAPORT EKO-SCAN (PDF)</button><button class="mb go" id="hStart">▶  START / DIAGNOSTYKA</button><div class="two"><button class="mb" id="hStop">STOP / WSTRZYMAJ</button><button class="mb" id="hAsk">ZAPYTAJ ASYSTENTA</button></div></div>'+
   '<div class="pn" style="flex:1"><h5>04 / ODPOWIEDŹ ASYSTENTA</h5><div class="ans" id="hAns"></div></div></div>'+
  '<div class="col"><div class="pn" style="flex:1"><h5>FUNKCJE</h5><div class="ft2">'+
   '<button class="fb cy" id="fAn">'+ICON.an+'<b>ANALIZATORY</b><small>prąd · CAN/LIN · silnik</small></button>'+
   '<button class="fb" id="fLive">'+ICON.live+'<b>LIVE DATA / WYKRESY ▶</b><small>pomiar, jazda, wykresy</small></button>'+
   '<button class="fb" id="fRap">'+ICON.rap+'<b>ANALIZA I RAPORTY ▶</b><small>PDF, hipotezy, historia</small></button>'+
   '<button class="fb cy" id="fFun">'+ICON.fun+'<b>FUNKCJE PROWADZONE ▶</b><small>paliwo · EGR · DPF · SCR</small></button>'+
   '<button class="fb yl" id="fCal">'+ICON.cal+'<b>KALIBRACJA<br>EKO-SCAN</b><small>test, zapis ekranów</small></button>'+
   '<button class="fb" id="fSet">'+ICON.set+'<b>USTAWIENIA</b><small>motyw, zgody, system</small></button></div><button class="sm" id="fExit" style="align-self:flex-end;border-color:#ef5350;color:#ff8a86">ZAMKNIJ APLIKACJĘ</button></div></div></div>';
  HM.innerHTML=h;
  pvRender('dtc');
  $('hAns').textContent=SESS.answer?SESS.answer.replace(/<[^>]+>/g,''):'Brak odpowiedzi. START prowadzi sesję z EKO-SCAN; ZAPYTAJ ASYSTENTA odpowiada na pytanie.';
  $('pvT').querySelectorAll('button').forEach(function(b){b.onclick=function(){$('pvT').querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});pvRender(b.dataset.t)}});
  $('hSet').onclick=function(){_offFn()};$('hMic').onclick=function(){TOAST('Mikrofon: dyktowanie pytania działa na tablecie.')};
  $('hDet').onclick=function(){TOAST('Szczegóły: model załadowany, źródło danych: '+SESS.src+', sieć: '+(SESS.net?'tak':'nie')+'.')};
  $('hPdf').onclick=function(){TOAST(v?'Załączono raport EKO-SCAN (PDF): raport_'+v.id+'.pdf (symulacja)':'Najpierw wykonaj START, żeby powstał raport EKO-SCAN.')};
  $('hStart').onclick=function(){pickVehicle('START / DIAGNOSTYKA: wybór scenariusza',diagStart)};
  $('hStop').onclick=function(){TOAST('STOP: sesja zatrzymana; nowy START otwiera nową sesję.')};
  $('hAsk').onclick=function(){var q=$('hQ').value.trim();SESS.answer=v?(q?'Pytanie: „'+q+'”. ':'')+answerFor(v):'Brak sesji pojazdu. Naciśnij START w Diagnostyce i wybierz scenariusz, a asystent odpowie na podstawie pomiaru.';$('hAns').textContent=SESS.answer.replace(/<[^>]+>/g,'')};
  var _offFn=function(){TOAST('To okno symulacji nie obejmuje tej funkcji: tu działają START / Diagnostyka, Live Data / Wykresy i Funkcje prowadzone.')};
  $('fAn').onclick=_offFn;var _unusedAn=function(){hub('ANALIZATORY','wybierz analizator',[
    {t:'Analizator prądu spoczynkowego',d:'pobór prądu przez samochód w uśpieniu, cęgi prądowe (osobne okno LAB)',go:function(){location.href='prad-spoczynkowy.html'}},
    {t:'Analizator CAN (EKO-CAN)',d:'sygnał i dane magistrali (osobne okno LAB)',go:function(){location.href='analizator-can.html'}},
    {t:'Tester kompresji względnej',d:'porównanie cylindrów z prądu rozrusznika (osobne okno LAB)',go:function(){location.href='kompresja-wzgledna.html'}},
    {t:'Kontrola rozrządu',d:'synchronizacja wału i rozrządu w pracy silnika (osobne okno LAB)',go:function(){location.href='kontrola-rozrzadu.html'}},
    {t:'Głowica EKO: programowanie i obsługa',d:'wgranie firmware przez USB-OTG, test, kalibracja (tylko w aplikacji)',go:function(){TOAST('Głowica EKO: obsługa dostępna w aplikacji na tablecie.')}}])};
  $('fLive').onclick=function(){hub('LIVE DATA / WYKRESY','wybierz funkcję',[
    {t:'Jazda próbna z asystentem',d:'Asystent mierzy podczas jazdy i analizuje',go:function(){pickVehicle('Jazda próbna z asystentem',function(x){setSession(x);lvOpen('jazda',x)},function(){$('fLive').onclick()})}},
    {t:'Live Data: parametry na żywo',d:'Parametry z otwartego ekranu Live Data',go:function(){pickVehicle('Live Data: parametry na żywo',function(x){setSession(x);lvOpen('live',x)},function(){$('fLive').onclick()})}},
    {t:'Pomiar AUTO / MANUAL i wykres sesji',d:'Pomiar AUTO lub MANUAL z wykresem sesji',go:function(){pickVehicle('Pomiar AUTO / MANUAL',function(x){setSession(x);lvOpen('pomiar',x)},function(){$('fLive').onclick()})}},
    {t:'Wykresy na żywo (szybkie próbkowanie)',d:'Szybkie próbkowanie kilku parametrów naraz',go:function(){pickVehicle('Wykresy na żywo',function(x){setSession(x);lvOpen('wykresy',x)},function(){$('fLive').onclick()})}}])};
  $('fRap').onclick=_offFn;var _unusedRap=function(){hub('ANALIZA I RAPORTY','wybierz funkcję',[
    {t:'Analiza, hipotezy i raport',d:'Wniosek, hipotezy i kontrole na przebiegach dla wybranego przypadku',go:function(){if(SESS.v)openAnaliza('analiza',SESS.v);else pickVehicle('Analiza i raport: wybór pojazdu',function(x){setSession(x);openAnaliza('analiza',x)},function(){$('fRap').onclick()})}},
    {t:'Raporty i historia',d:'Raporty sesji, historia odpowiedzi',go:function(){openAnaliza('rap',SESS.v)}},
    {t:'Konsultacja z modelem',d:'Komentarz modelu do raportu (w symulacji: odpowiedź z wyniku analizy)',go:function(){if(SESS.v)openAnaliza('model',SESS.v);else pickVehicle('Konsultacja: wybór pojazdu',function(x){setSession(x);openAnaliza('model',x)},function(){$('fRap').onclick()})}}])};
  $('fFun').onclick=function(){C.show('menu')};
  $('fCal').onclick=_offFn;$('fSet').onclick=_offFn;
  $('fExit').onclick=function(){TOAST('To symulacja: aplikacji nie zamykasz. Wróć do LAB przyciskiem u góry strony.')};
}
function pvRender(t){
  var v=SESS.v,e=v?engineEcu(v):null,h='';
  if(!v)h=t==='dtc'?'Potwierdź pojazd i ECU z ekranu EKO-SCAN, potem odczytaj kody.':t==='par'?'Brak parametrów. Wykonaj START.':'Brak przebiegu.';
  else if(t==='dtc')h=e.dtc.length?e.dtc.map(function(d){return '<div class="it"><b>'+d[0]+'</b><span>'+d[2]+'</span></div><div style="margin-bottom:3px">'+d[1]+'</div>'}).join(''):'Brak kodów (pusta lista nie potwierdza braku usterki).';
  else if(t==='par')h=lvsList(e).slice(0,14).map(function(p){return '<div class="it"><span>'+p.n+'</span><b>'+p.u+'</b></div>'}).join('');
  else h=(SESS.reports.length?SESS.reports.slice(-4).map(function(r){return '<div class="it"><span>'+r.t+'</span></div>'}).join(''):'Brak zapisanych etapów sesji.');
  $('pvB').innerHTML=h;
}
C.register('home',HM,{on:function(){homeRender()}});
homeRender();

/* tryb testowy */
window.__app={SESS:SESS,VEH:VEH,Meas:Meas,lvsList:lvsList,deviation:deviation,diagStart:diagStart,lvOpen:lvOpen,pickVehicle:pickVehicle,dem:dem,DR:DR,L:L,get DS(){return DS},openSet:openSet,openKal:openKal,openAnaliza:openAnaliza,dgRender:dgRender,get KRUN(){return KRUN}};
})();
