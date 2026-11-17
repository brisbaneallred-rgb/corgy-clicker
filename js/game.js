(function () {
  "use strict";

  var economy = globalThis.CorgiEconomy;
  var SAVE_KEY = "corgi-coin-v1";
  var OFFLINE_CAP = 8 * 60 * 60;

  var SQUISH = [
    {
      id: "biscuit",
      name: "Biscuit",
      tag: "Corgi",
      cps: 1,
      click: 0,
      baseCost: 15,
      blurb: "Boops the coin with a stubby paw.",
    },
    {
      id: "mochi",
      name: "Mochi",
      tag: "Cat",
      cps: 4,
      click: 0,
      baseCost: 100,
      blurb: "Bats the coin whenever it glints.",
    },
    {
      id: "bunbun",
      name: "Bunbun",
      tag: "Bunny",
      cps: 16,
      click: 1,
      baseCost: 1100,
      blurb: "Thumps the coin, and your clicks land harder.",
    },
    {
      id: "nugget",
      name: "Nugget",
      tag: "Chick",
      cps: 70,
      click: 0,
      baseCost: 12000,
      blurb: "Pecks the coin in a happy little frenzy.",
    },
    {
      id: "bubbles",
      name: "Bubbles",
      tag: "Axolotl",
      cps: 320,
      click: 5,
      baseCost: 140000,
      blurb: "Shakes coins loose and sweetens every click.",
    },
    {
      id: "flare",
      name: "Flare",
      tag: "Dragon",
      cps: 1500,
      click: 25,
      baseCost: 1600000,
      blurb: "Taps the coin with both wings.",
    },
  ];

  var state = {
    doge: 0,
    owned: {},
    muted: false,
    qty: 1,
    hinted: false,
  };

  SQUISH.forEach(function (s) {
    state.owned[s.id] = 0;
  });

  var lastTs = Date.now();
  var saveTimer = 0;
  var audioCtx = null;
  var heard = false;
  var shineLater = 0;
  var shopBuilt = false;

  var el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function findSquish(id) {
    for (var i = 0; i < SQUISH.length; i++) {
      if (SQUISH[i].id === id) return SQUISH[i];
    }
    return null;
  }

  function cps() {
    var total = 0;
    SQUISH.forEach(function (s) {
      total += state.owned[s.id] * s.cps;
    });
    return total;
  }

  function clickPower() {
    var power = 1;
    SQUISH.forEach(function (s) {
      power += state.owned[s.id] * s.click;
    });
    return power;
  }

  function ownedTotal() {
    var total = 0;
    SQUISH.forEach(function (s) {
      total += state.owned[s.id];
    });
    return total;
  }

  function qtyMode() {
    return state.qty === "max" ? "max" : state.qty;
  }

  function qtyFor(def) {
    if (qtyMode() === "max") return economy.maxBuy(def.baseCost, state.owned[def.id], state.doge);
    return state.qty;
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function save() {
    var payload = {
      doge: state.doge,
      owned: state.owned,
      muted: state.muted,
      qty: state.qty,
      hinted: state.hinted,
      last: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* private mode or a full disk; the game still runs */
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 400);
  }

  function toast(message) {
    var node = $("toast");
    node.textContent = message;
    node.hidden = false;
    node.classList.add("show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () {
      node.classList.remove("show");
      window.setTimeout(function () {
        node.hidden = true;
      }, 280);
    }, 4600);
  }

  function applySave(data) {
    if (!data || typeof data !== "object") return;
    if (typeof data.doge === "number" && data.doge >= 0) state.doge = data.doge;
    if (data.owned && typeof data.owned === "object") {
      SQUISH.forEach(function (s) {
        var n = data.owned[s.id];
        if (typeof n === "number" && n >= 0) state.owned[s.id] = Math.floor(n);
      });
    }
    state.muted = Boolean(data.muted);
    if (data.qty === "max" || data.qty === 10 || data.qty === 1) state.qty = data.qty;
    state.hinted = Boolean(data.hinted);
    var away = 0;
    if (typeof data.last === "number") {
      away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - data.last) / 1000));
    }
    var rate = cps();
    if (away > 8 && rate > 0) {
      var gained = away * rate;
      state.doge += gained;
      var mins = Math.round(away / 60);
      toast(
        "Your squishmollows coined " +
          economy.formatAmount(gained) +
          " doge while you were away (" +
          mins +
          " min)."
      );
    }
  }

  function ensureAudio() {
    if (state.muted) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, dur, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
    } catch (err) {
      /* audio can be blocked until a gesture, or missing in some browsers */
    }
  }

  function spawnFloater(text, x, y, kind) {
    var layer = $("floaters");
    var node = document.createElement("span");
    node.className = "floater " + kind;
    node.textContent = text;
    node.style.left = x + "px";
    node.style.top = y + "px";
    layer.appendChild(node);
    while (layer.childElementCount > 24) layer.removeChild(layer.firstChild);
    node.addEventListener("animationend", function () {
      node.remove();
    });
  }

  function burst(x, y) {
    var layer = $("floaters");
    for (var i = 0; i < 7; i++) {
      var spark = document.createElement("i");
      spark.className = "spark";
      spark.style.left = x + "px";
      spark.style.top = y + "px";
      spark.style.setProperty("--a", (i / 7) * 360 + Math.random() * 24 + "deg");
      spark.style.setProperty("--r", 28 + Math.random() * 36 + "px");
      layer.appendChild(spark);
      spark.addEventListener("animationend", function () {
        spark.remove();
      });
    }
  }

  function layerPoint(clientX, clientY) {
    var rect = $("floaters").getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function coinCenter() {
    var layer = $("floaters").getBoundingClientRect();
    var coin = $("coin").getBoundingClientRect();
    return {
      x: coin.left - layer.left + coin.width / 2,
      y: coin.top - layer.top + coin.height * 0.42,
    };
  }

  function clickCoin(clientX, clientY) {
    var gain = clickPower();
    state.doge += gain;
    state.hinted = true;
    heard = true;
    $("hint").hidden = true;
    var fromKeyboard = clientX == null;
    var point = fromKeyboard ? coinCenter() : layerPoint(clientX, clientY);
    spawnFloater("+" + economy.formatAmount(gain), point.x, point.y, "player");
    burst(point.x, point.y);
    var wrap = $("coin-wrap");
    wrap.classList.remove("shining");
    void wrap.offsetWidth;
    wrap.classList.add("shining");
    window.clearTimeout(shineLater);
    shineLater = window.setTimeout(function () {
      wrap.classList.remove("shining");
    }, 720);
    playTone(740 + Math.random() * 80, 0.09, 0.045);
    scheduleSave();
    paint();
  }

  function buy(id) {
    var def = findSquish(id);
    if (!def) return;
    var qty = qtyFor(def);
    var cost = economy.costOf(def.baseCost, state.owned[def.id], qty);
    if (qty < 1 || state.doge + 1e-6 < cost) return;
    state.doge = Math.max(0, state.doge - cost);
    state.owned[def.id] += qty;
    playTone(520, 0.12, 0.04);
    var card = document.querySelector('.card[data-id="' + id + '"]');
    if (card) {
      card.classList.remove("bought");
      void card.offsetWidth;
      card.classList.add("bought");
    }
    buildCrew();
    scheduleSave();
    paint();
  }

  function buildShop() {
    var list = $("shop-list");
    list.innerHTML = "";
    SQUISH.forEach(function (def) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      btn.dataset.id = def.id;
      var rates = "+" + economy.formatAmount(def.cps) + "/s";
      if (def.click) rates += " · +" + def.click + " per click";
      btn.innerHTML =
        '<span class="portrait"><img alt="" width="512" height="512" src="assets/' +
        def.id +
        '.png"><span class="count">0</span></span>' +
        '<span class="info"><span class="name-row"><span class="name"></span><span class="tag"></span></span>' +
        '<span class="blurb"></span><span class="rates"></span></span>' +
        '<span class="price"><span class="cost"></span><span class="mult"></span></span>' +
        '<span class="meter" aria-hidden="true"><span class="meter-fill"></span></span>';
      btn.querySelector(".name").textContent = def.name;
      btn.querySelector(".tag").textContent = def.tag;
      btn.querySelector(".blurb").textContent = def.blurb;
      btn.querySelector(".rates").textContent = rates;
      btn.querySelector("img").alt = def.name + ", a " + def.tag.toLowerCase() + " squishmollow";
      btn.addEventListener("click", function () {
        buy(def.id);
      });
      list.appendChild(btn);
    });
    shopBuilt = true;
  }

  function paintShop() {
    if (!shopBuilt) return;
    SQUISH.forEach(function (def) {
      var card = document.querySelector('.card[data-id="' + def.id + '"]');
      var owned = state.owned[def.id];
      var qty = qtyFor(def);
      var showQty = qtyMode() === "max" ? Math.max(qty, 1) : state.qty;
      var cost = economy.costOf(def.baseCost, owned, showQty);
      var afford = state.doge + 1e-6 >= cost && (qtyMode() !== "max" || qty >= 1);
      card.disabled = !afford;
      card.classList.toggle("afford", afford);
      card.querySelector(".count").textContent = economy.formatAmount(owned);
      card.querySelector(".count").classList.toggle("zero", owned === 0);
      card.querySelector(".cost").textContent = economy.formatAmount(cost);
      card.querySelector(".mult").textContent =
        qtyMode() === "max" ? (qty >= 1 ? "×" + economy.formatAmount(qty) : "next") : "×" + state.qty;
      var next = economy.costOf(def.baseCost, owned, 1);
      var pct = next <= 0 ? 0 : Math.max(0, Math.min(1, state.doge / next));
      card.querySelector(".meter-fill").style.width = pct * 100 + "%";
      card.setAttribute(
        "aria-label",
        "Buy " + showQty + " " + def.name + " for " + economy.formatAmount(cost) + " doge. You own " + owned + "."
      );
    });
  }

  function paintHud() {
    $("doge").textContent = economy.formatAmount(state.doge);
    $("cps").textContent = economy.formatAmount(cps());
    $("cpc").textContent = economy.formatAmount(clickPower());
    $("owned-total").textContent = economy.formatAmount(ownedTotal());
    var mute = $("mute");
    mute.textContent = state.muted ? "Sound off" : "Sound on";
    mute.setAttribute("aria-pressed", state.muted ? "true" : "false");
    document.querySelectorAll(".qty").forEach(function (btn) {
      var on = String(state.qty) === btn.dataset.qty;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function paint() {
    paintHud();
    paintShop();
  }

  function buildCrew() {
    var crew = $("crew");
    var empty = $("crew-empty");
    crew.innerHTML = "";
    var any = false;
    SQUISH.forEach(function (def) {
      var n = state.owned[def.id];
      if (!n) return;
      any = true;
      var copies = Math.min(n, 6);
      for (var i = 0; i < copies; i++) {
        var fig = document.createElement("figure");
        fig.className = "pal";
        fig.dataset.id = def.id;
        fig.style.setProperty("--bob", (i * 0.17 + SQUISH.indexOf(def) * 0.13).toFixed(2) + "s");
        var img = document.createElement("img");
        img.src = "assets/" + def.id + ".png";
        img.alt = "";
        img.width = 512;
        img.height = 512;
        img.addEventListener("animationend", function (event) {
          if (event.animationName === "hop") img.classList.remove("tap");
        });
        fig.appendChild(img);
        if (i === copies - 1 && n > copies) {
          var badge = document.createElement("span");
          badge.className = "more";
          badge.textContent = "×" + economy.formatAmount(n);
          fig.appendChild(badge);
        }
        crew.appendChild(fig);
      }
    });
    empty.hidden = any;
  }

  function hopSomeone() {
    if (ownedTotal() <= 0) return;
    var pals = document.querySelectorAll("#crew .pal");
    if (!pals.length) return;
    var pal = pals[Math.floor(Math.random() * pals.length)];
    var img = pal.querySelector("img");
    img.classList.remove("tap");
    void img.offsetWidth;
    img.classList.add("tap");
    var coin = $("coin");
    coin.classList.add("boop");
    window.setTimeout(function () {
      coin.classList.remove("boop");
    }, 140);
    if (heard && !state.muted && Math.random() < 0.55) playTone(480 + Math.random() * 40, 0.05, 0.012);
  }

  function frame() {
    var now = Date.now();
    var dt = Math.min(OFFLINE_CAP, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    var rate = cps();
    if (rate > 0 && dt > 0) state.doge += rate * dt;
    paint();
    requestAnimationFrame(frame);
  }

  function bind() {
    var coin = $("coin");
    coin.addEventListener("click", function (event) {
      if (event.detail === 0) clickCoin(null, null);
      else clickCoin(event.clientX, event.clientY);
    });

    document.querySelectorAll(".qty").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var q = btn.dataset.qty;
        state.qty = q === "max" ? "max" : Number(q);
        scheduleSave();
        paint();
      });
    });

    $("mute").addEventListener("click", function () {
      state.muted = !state.muted;
      if (state.muted && audioCtx && audioCtx.state === "running") audioCtx.suspend();
      scheduleSave();
      paint();
    });

    $("reset").addEventListener("click", function () {
      var ok = window.confirm("Reset your doge and send the squishmollows home?");
      if (!ok) return;
      state.doge = 0;
      SQUISH.forEach(function (s) {
        state.owned[s.id] = 0;
      });
      state.hinted = false;
      $("hint").hidden = false;
      buildCrew();
      save();
      paint();
    });

    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") save();
    });
  }

  function init() {
    el.ready = true;
    buildShop();
    var data = load();
    applySave(data);
    $("hint").hidden = state.hinted;
    buildCrew();
    bind();
    paint();
    lastTs = Date.now();
    requestAnimationFrame(frame);
    window.setInterval(hopSomeone, 650);
    window.setInterval(save, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
