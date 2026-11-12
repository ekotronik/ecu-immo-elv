/* EKOTRONIK CHARGER – symulacja: zastępuje bibliotekę Paho MQTT.
   Panel v2.1 działa bez zmian, a wiadomości idą do wirtualnego brokera na stronie symulacji. */
(function () {
  var client = null;
  function up(m) { try { parent.postMessage(m, '*'); } catch (e) {} }
  window.Paho = {
    Client: function (host, port, path, id) {
      var self = this;
      this.c = false; this.onMessageArrived = null; this.onConnectionLost = null;
      this.connect = function (o) { self._o = o; up({ eko: 'connect', id: id }); };
      this.isConnected = function () { return self.c; };
      this.disconnect = function () { self.c = false; up({ eko: 'disconnect' }); };
      this.subscribe = function (t) { up({ eko: 'sub', t: t }); };
      this.send = function (m) { up({ eko: 'pub', t: m.destinationName, p: m.payloadString, r: !!m.retained }); };
      client = this;
    },
    Message: function (p) { this.payloadString = p; this.destinationName = ''; this.qos = 0; this.retained = false; }
  };
  window.addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var d = e.data || {};
    if (!d.eko) return;
    if (d.eko === 'connack' && client) { client.c = true; if (client._o && client._o.onSuccess) client._o.onSuccess(); }
    else if (d.eko === 'msg' && client && client.onMessageArrived) {
      client.onMessageArrived({ destinationName: d.t, payloadString: d.p, retained: !!d.r });
    } else if (d.eko === 'click') {
      var b = document.getElementById(d.id); if (b) b.click();
    } else if (d.eko === 'query') {
      var out = {};
      (d.ids || []).forEach(function (i) { var el = document.getElementById(i); out[i] = el ? el.textContent : null; });
      out.__log = (document.getElementById('log') || {}).textContent || '';
      up({ eko: 'qres', q: d.q, out: out });
    }
  });
})();
