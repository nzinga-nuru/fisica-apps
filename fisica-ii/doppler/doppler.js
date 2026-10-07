(function(){
  "use strict";

  // ---------------- utilidades ----------------
  function $(id){ return document.getElementById(id); }
  function fmt(x, d){ return x.toFixed(d).replace(".", ","); }
  function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function setupCanvas(cv){
    var o = { cv: cv, ctx: cv.getContext("2d"), w: 0, h: 0 };
    function fit(){
      var r = cv.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      o.w = r.width; o.h = r.height;
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(cv); else window.addEventListener("resize", fit);
    return o;
  }

  // ---------------- áudio (compartilhado) ----------------
  var audioCtx = null, osc = null, master = null;
  var listening = false;
  var volume = 0.4;
  function ensureAudio(){
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain(); master.gain.value = 0; master.connect(audioCtx.destination);
    osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.value = 440;
    osc.connect(master); osc.start();
  }
  var wantFreq = 440, wantMute = false;
  function applyAudio(){
    if (!audioCtx) return;
    var now = audioCtx.currentTime;
    osc.frequency.setTargetAtTime(Math.min(4000, Math.max(30, wantFreq)), now, 0.03);
    master.gain.setTargetAtTime(listening && !wantMute ? volume * 0.35 : 0, now, 0.05);
  }
  function setListening(v){
    listening = v;
    if (v){ ensureAudio(); if (audioCtx.state === "suspended") audioCtx.resume(); }
    ["listenLabel", "listenLabel2"].forEach(function(id){ $(id).textContent = v ? "Parar som" : "Ouvir"; });
    applyAudio();
  }
  $("listenBtn").addEventListener("click", function(){ setListening(!listening); });
  $("listenBtn2").addEventListener("click", function(){ setListening(!listening); });
  function bindVolume(sliderId, labelId){
    var s = $(sliderId), l = $(labelId);
    s.addEventListener("input", function(){
      volume = parseFloat(s.value) / 100;
      $("volSlider").value = s.value; $("volSlider2").value = s.value;
      $("vVal").textContent = s.value + "%"; $("vVal2").textContent = s.value + "%";
      applyAudio();
    });
  }
  bindVolume("volSlider", "vVal"); bindVolume("volSlider2", "vVal2");

  // ---------------- abas ----------------
  var active = 1;
  function showTab(n){
    active = n;
    $("sc1").hidden = n !== 1; $("sc2").hidden = n !== 2;
    $("tab1").classList.toggle("on", n === 1); $("tab2").classList.toggle("on", n === 2);
    $("tab1").setAttribute("aria-selected", n === 1); $("tab2").setAttribute("aria-selected", n === 2);
    if (n === 1) reset1(); else reset2();
  }
  $("tab1").addEventListener("click", function(){ showTab(1); });
  $("tab2").addEventListener("click", function(){ showTab(2); });

  // =====================================================================
  //  CENÁRIO 1: fonte e dois ouvintes na mesma linha
  // =====================================================================
  var C1 = setupCanvas($("cv1"));
  var V = 24;            // velocidade do som no modelo (unidades/s)
  var FS = 3;            // frentes por segundo no modelo (representam 440 Hz)
  var T = 1 / FS;
  var F0 = 440;
  var WX = 100, WY = 50; // meio-tamanho do mundo
  var PRE = 6;           // segundos de frentes já em voo ao reiniciar
  var s1 = { t: 0, M: 0.5, dr: 0, running: true, xs0: -20, xA0: 60, xB0: -85 };

  function reset1(){ s1.t = 0; }
  function xs(te){ return s1.xs0 + s1.M * V * te; }
  function xo(o, t){ return (o === "A" ? s1.xA0 : s1.xB0) + s1.dr * V * t; }

  // instante em que a frente emitida em te alcança o ouvinte o (analítico); null se não alcança
  function arrival(o, te){
    var vD = s1.dr * V, xe = xs(te), x0 = (o === "A" ? s1.xA0 : s1.xB0), ta;
    if (o === "A"){ ta = (x0 - xe + V * te) / (V - vD); if (xo("A", ta) <= xe) return null; }
    else { ta = (xe - x0 + V * te) / (V + vD); if (xo("B", ta) >= xe) return null; }
    return ta < te ? null : ta;
  }
  function arrivals(o, t){
    var out = [], n0 = -Math.ceil(PRE * FS * 3), n1 = Math.floor(t / T);
    for (var n = n0; n <= n1; n++){
      var ta = arrival(o, n * T);
      if (ta !== null && ta <= t) out.push(ta);
    }
    out.sort(function(a, b){ return b - a; });
    return out;
  }

  function theory(o){
    var dr = s1.dr, M = s1.M;
    if (o === "A"){ if (M >= 1) return null; return (1 - dr) / (1 - M); }
    return (1 + dr) / (1 + M);
  }

  function lambdaRatio(o){ // λ′/λ no ar, no referencial do ar
    return o === "A" ? (1 - s1.M) : (1 + s1.M);
  }

  function updateReadouts1(){
    $("mVal").textContent = fmt(s1.M, 2);
    $("dVal").textContent = (s1.dr > 0 ? "+" : s1.dr < 0 ? "−" : "") + fmt(Math.abs(s1.dr), 2);
    $("mSub").textContent = s1.M < 1 ? "subsônica" + (s1.M === 0 ? " (fonte parada)" : "")
      : s1.M === 1 ? "Mach 1: as frentes se empilham na frente da fonte"
      : "supersônica: cone com θ = " + fmt(Math.asin(1 / s1.M) * 180 / Math.PI, 1) + "°";
    $("dSub").textContent = s1.dr === 0 ? "ouvintes parados" : "ambos se movem " + (s1.dr > 0 ? "para a direita" : "para a esquerda");
    ["A", "B"].forEach(function(o){
      var th = theory(o), arr = arrivals(o, s1.t), me = null;
      if (arr.length >= 2){ var dt = arr[0] - arr[1]; if (dt > 1e-6) me = (1 / dt) / FS; }
      $("th" + o).textContent = th === null ? "choque" : fmt(F0 * th, 0) + " Hz";
      var cell = $("me" + o);
      if (th === null){ cell.textContent = "silêncio até o cone"; cell.className = ""; }
      else if (me === null){ cell.textContent = "medindo…"; cell.className = ""; }
      else { cell.textContent = fmt(F0 * me, 0) + " Hz"; cell.className = Math.abs(me - th) / th < 0.03 ? "ok" : ""; }
      $("la" + o).textContent = (o === "A" && s1.M >= 1) ? "—" : fmt(lambdaRatio(o), 2) + " λ";
    });
    var cal = $("listener").value, thc = theory(cal);
    wantMute = thc === null;
    wantFreq = thc === null ? 440 : F0 * thc;
    applyAudio();
    var s = "";
    if (s1.M === 0 && s1.dr === 0) s = "Tudo parado: as frentes são círculos concêntricos e os dois ouvintes medem <b>440&nbsp;Hz</b>.";
    else if (s1.M > 0 && s1.dr === 0) s = "<b>Só a fonte se move:</b> muda o comprimento de onda no ar. À frente (A) as frentes ficam mais próximas, atrás (B) mais afastadas.";
    else if (s1.M === 0) s = "<b>Só os ouvintes se movem:</b> o λ no ar não muda, mas a velocidade da onda <i>relativa a cada ouvinte</i> muda. Em A e B os desvios têm sentidos opostos.";
    else if (Math.abs(s1.M - s1.dr) < 1e-9) s = "<b>Mesma velocidade e mesmo sentido:</b> não há movimento relativo entre fonte e ouvintes, então ambos medem <b>440&nbsp;Hz</b>, embora tudo se mova em relação ao ar.";
    else s = "<b>Os dois se movem:</b> os efeitos se combinam, <i>f′</i> = <i>f</i>(<i>v</i> − <i>v<sub>D</sub></i>)/(<i>v</i> − <i>v<sub>F</sub></i>) em A e com + em B. Só dá 440&nbsp;Hz quando não há movimento relativo.";
    if (s1.M >= 1) s += " <b>Supersônica:</b> a fonte passa suas próprias frentes e A fica sem som até o cone chegar.";
    $("story1").innerHTML = s;
  }

  function draw1(){
    var c = C1, ctx = c.ctx, w = c.w, h = c.h;
    if (!w) return;
    var k = w / (2 * WX), ox = w / 2, oy = h / 2;
    function X(x){ return ox + x * k; }
    function Y(y){ return oy - y * k; }
    var cInk = css("--ink"), cW1 = css("--wave1"), cW2 = css("--wave2"), cDim = css("--ink-dim"), cGrid = css("--grid"), cRes = css("--resultant");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--panel"); ctx.fillRect(0, 0, w, h);
    // eixo
    ctx.strokeStyle = cGrid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    // frentes
    var t = s1.t, n0 = -Math.ceil(PRE * FS), n1 = Math.floor(t / T);
    ctx.lineWidth = 1.8;
    for (var n = n0; n <= n1; n++){
      var te = n * T, r = V * (t - te);
      if (r <= 0 || r > 300) continue;
      var a = Math.max(0.18, 1 - r / 170);
      ctx.strokeStyle = cW1; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(X(xs(te)), oy, r * k, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    var sx = xs(t);
    // cone de Mach
    if (s1.M > 1){
      var th = Math.asin(1 / s1.M), L = 260;
      ctx.strokeStyle = cW2; ctx.lineWidth = 2.6; ctx.setLineDash([7, 5]);
      [1, -1].forEach(function(sg){
        ctx.beginPath(); ctx.moveTo(X(sx), oy);
        ctx.lineTo(X(sx - L * Math.cos(th)), oy - sg * L * Math.sin(th) * k); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.fillStyle = cW2; ctx.font = "600 13px IBM Plex Sans, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("cone de Mach  θ = " + fmt(th * 180 / Math.PI, 1) + "°", 10, 20);
    }
    // fonte
    ctx.fillStyle = cW2; ctx.beginPath(); ctx.arc(X(sx), oy, 7, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = cW2; ctx.lineWidth = 3;
    if (s1.M > 0){ var al = 12 + 22 * s1.M; ctx.beginPath(); ctx.moveTo(X(sx) + 10, oy); ctx.lineTo(X(sx) + 10 + al, oy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(sx) + 10 + al, oy); ctx.lineTo(X(sx) + 4 + al, oy - 4); ctx.lineTo(X(sx) + 4 + al, oy + 4); ctx.closePath(); ctx.fillStyle = cW2; ctx.fill(); }
    ctx.fillStyle = cDim; ctx.font = "600 13px IBM Plex Sans, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("fonte", X(sx), oy + 24);
    // ouvintes
    ["A", "B"].forEach(function(o){
      var x = xo(o, t), px = X(x);
      var arr = arrivals(o, t);
      if (arr.length && t - arr[0] < 0.14){
        ctx.strokeStyle = cRes; ctx.lineWidth = 3; ctx.globalAlpha = 1 - (t - arr[0]) / 0.14;
        ctx.beginPath(); ctx.arc(px, oy, 16 + 40 * (t - arr[0]), 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = cInk; ctx.fillRect(px - 7, oy - 7, 14, 14);
      ctx.font = "700 15px IBM Plex Sans, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = cInk;
      ctx.fillText(o, px, oy - 16);
      if (Math.abs(s1.dr) > 0){
        ctx.strokeStyle = cInk; ctx.lineWidth = 2; var d = s1.dr > 0 ? 1 : -1, len = 14 + 30 * Math.abs(s1.dr);
        ctx.beginPath(); ctx.moveTo(px, oy + 20); ctx.lineTo(px + d * len, oy + 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + d * len, oy + 20); ctx.lineTo(px + d * (len - 6), oy + 16); ctx.lineTo(px + d * (len - 6), oy + 24); ctx.closePath(); ctx.fillStyle = cInk; ctx.fill();
      }
    });
  }

  var last = null;
  function tick1(ts, dtReal){
    if (s1.running) s1.t += dtReal * 0.55;
    var sx = xs(s1.t), a = xo("A", s1.t), b = xo("B", s1.t);
    var out = (s1.M > 0 && sx > 30) || a < sx + 8 || b > sx - 8 || a > 98 || b < -98 || s1.t > 24;
    if (out) reset1();
    draw1();
    if (!tick1.n || ts - tick1.n > 120){ updateReadouts1(); tick1.n = ts; }
  }

  function apply1(){ s1.M = parseFloat($("mSlider").value); s1.dr = parseFloat($("dSlider").value); reset1(); updateReadouts1(); }
  $("mSlider").addEventListener("input", apply1);
  $("dSlider").addEventListener("input", apply1);
  $("listener").addEventListener("change", updateReadouts1);
  $("restartBtn").addEventListener("click", reset1);
  $("freezeBtn").addEventListener("click", function(){ s1.running = !s1.running; $("freezeBtn").textContent = s1.running ? "Pausar" : "Continuar"; });
  Array.prototype.forEach.call(document.querySelectorAll(".presets .nudge-btn"), function(b){
    b.addEventListener("click", function(){
      $("mSlider").value = b.getAttribute("data-m"); $("dSlider").value = b.getAttribute("data-d"); apply1();
    });
  });

  // =====================================================================
  //  CENÁRIO 2: a ambulância que passa
  // =====================================================================
  var C2a = setupCanvas($("cv2a")), C2b = setupCanvas($("cv2b"));
  var VS = 343, XM = 100;
  var s2 = { u: 25, d: 10, x: -XM, running: true, hold: 0 };
  function reset2(){ s2.x = -XM; s2.hold = 0; }
  function fObs(x){ var r = Math.sqrt(x * x + s2.d * s2.d); return F0 * VS / (VS - s2.u * (-x) / r); }

  function draw2(){
    var cInk = css("--ink"), cW1 = css("--wave1"), cW2 = css("--wave2"), cDim = css("--ink-dim"), cGrid = css("--grid"), cRes = css("--resultant"), cPanel = css("--panel");
    // mapa
    var c = C2a, ctx = c.ctx, w = c.w, h = c.h;
    if (w){
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = cPanel; ctx.fillRect(0, 0, w, h);
      var k = (w - 60) / (2 * XM), ox = w / 2, py = h * 0.30, oyy = py + Math.min(h * 0.55, s2.d * k * 1.0 + 24);
      // pista (fonte) em py, ouvinte abaixo a distância proporcional (mín. visível)
      var dpx = Math.max(26, Math.min(h * 0.62, s2.d * k)), by = py + dpx;
      ctx.strokeStyle = cGrid; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(10, py); ctx.lineTo(w - 10, py); ctx.stroke();
      ctx.setLineDash([10, 8]); ctx.strokeStyle = cDim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, py); ctx.lineTo(w - 10, py); ctx.stroke(); ctx.setLineDash([]);
      var sxp = ox + s2.x * k;
      ctx.strokeStyle = cRes; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(sxp, py); ctx.lineTo(ox, by); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = cDim; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox, by); ctx.stroke();
      ctx.fillStyle = cDim; ctx.font = "600 12px IBM Plex Sans, sans-serif"; ctx.textAlign = "left"; ctx.fillText("d = " + s2.d + " m", ox + 8, (py + by) / 2);
      ctx.fillStyle = cW2; ctx.beginPath(); ctx.arc(sxp, py, 9, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = cInk; ctx.fillRect(ox - 8, by - 8, 16, 16);
      ctx.textAlign = "center"; ctx.font = "700 14px IBM Plex Sans, sans-serif"; ctx.fillText("ouvinte", ox, by + 26);
      ctx.fillStyle = cW2; ctx.fillText("fonte", sxp, py - 16);
    }
    // gráfico
    c = C2b; ctx = c.ctx; w = c.w; h = c.h;
    if (w){
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = cPanel; ctx.fillRect(0, 0, w, h);
      var fmax = F0 * VS / (VS - s2.u), fmin = F0 * VS / (VS + s2.u);
      var pad = { l: 56, r: 16, t: 14, b: 26 };
      var gx = function(x){ return pad.l + (x + XM) / (2 * XM) * (w - pad.l - pad.r); };
      var gy = function(f){ return pad.t + (fmax + 4 - f) / (fmax - fmin + 8) * (h - pad.t - pad.b); };
      ctx.strokeStyle = cGrid; ctx.lineWidth = 1; ctx.font = "11px IBM Plex Mono, monospace"; ctx.fillStyle = cDim; ctx.textAlign = "right";
      [fmax, F0, fmin].forEach(function(f){ ctx.beginPath(); ctx.moveTo(pad.l, gy(f)); ctx.lineTo(w - pad.r, gy(f)); ctx.stroke(); ctx.fillText(fmt(f, 0), pad.l - 6, gy(f) + 4); });
      ctx.setLineDash([5, 5]); ctx.strokeStyle = cDim; ctx.beginPath(); ctx.moveTo(pad.l, gy(F0)); ctx.lineTo(w - pad.r, gy(F0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(gx(0), pad.t); ctx.lineTo(gx(0), h - pad.b); ctx.strokeStyle = cGrid; ctx.stroke();
      ctx.strokeStyle = cW1; ctx.lineWidth = 3; ctx.beginPath();
      for (var i = 0; i <= 240; i++){ var x = -XM + 2 * XM * i / 240, f = fObs(x); if (i) ctx.lineTo(gx(x), gy(f)); else ctx.moveTo(gx(x), gy(f)); }
      ctx.stroke();
      ctx.fillStyle = cRes; ctx.beginPath(); ctx.arc(gx(s2.x), gy(fObs(s2.x)), 7, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = cDim; ctx.textAlign = "center"; ctx.font = "12px IBM Plex Sans, sans-serif";
      ctx.fillText("posição da fonte (m)", w / 2, h - 6);
      ctx.textAlign = "left"; ctx.fillText("Hz", 6, 14);
    }
  }

  function updateReadouts2(){
    var u = s2.u, r = Math.sqrt(s2.x * s2.x + s2.d * s2.d), rad = u * (-s2.x) / r;
    $("uVal").textContent = u + " m/s"; $("uSub").textContent = fmt(u * 3.6, 0) + " km/h";
    $("dlVal").textContent = s2.d + " m";
    var f = fObs(s2.x);
    $("o2now").textContent = fmt(f, 1) + " Hz"; $("o2cos").textContent = fmt(rad, 1) + " m/s";
    $("o2max").textContent = fmt(F0 * VS / (VS - u), 1) + " Hz"; $("o2min").textContent = fmt(F0 * VS / (VS + u), 1) + " Hz";
    wantMute = false; wantFreq = f; applyAudio();
  }

  function tick2(ts, dtReal){
    if (s2.running){
      if (s2.hold > 0) s2.hold -= dtReal;
      else { s2.x += s2.u * dtReal; if (s2.x > XM){ s2.x = XM; s2.hold = 0.7; setTimeout(function(){ if (active === 2) reset2(); }, 700); } }
    }
    draw2();
    if (!tick2.n || ts - tick2.n > 80){ updateReadouts2(); tick2.n = ts; }
  }
  $("uSlider").addEventListener("input", function(){ s2.u = parseFloat(this.value); updateReadouts2(); });
  $("dlSlider").addEventListener("input", function(){ s2.d = parseFloat(this.value); updateReadouts2(); });
  $("restartBtn2").addEventListener("click", reset2);
  $("freezeBtn2").addEventListener("click", function(){ s2.running = !s2.running; $("freezeBtn2").textContent = s2.running ? "Pausar" : "Continuar"; });

  // ---------------- laço principal ----------------
  function frame(ts){
    var dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000); last = ts;
    if (active === 1) tick1(ts, dt); else tick2(ts, dt);
    requestAnimationFrame(frame);
  }
  apply1();
  requestAnimationFrame(frame);
})();
