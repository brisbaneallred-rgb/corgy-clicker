(function () {
  "use strict";

  var economy = globalThis.CorgiEconomy;
  var SAVE_KEY = "corgi-coin-v1";
  var OFFLINE_CAP = 8 * 60 * 60;
  var BOOST_MULT = 1.5;
  var BOOST_MS = 3000;

  var SQUISH = [
    {
      id: "muffin",
      name: "Muffin",
      tag: "Octopus",
      cps: 1,
      click: 1,
      baseCost: 15,
      blurb: "Hugs the coin with too many arms.",
    },
    {
      id: "nevil",
      name: "Nevil",
      tag: "Devil",
      cps: 4,
      click: 2,
      baseCost: 100,
      blurb: "Pokes the coin in a tiny mischievous way.",
    },
    {
      id: "zeak",
      name: "Zeak",
      tag: "Zebra",
      cps: 16,
      click: 4,
      baseCost: 1100,
      blurb: "Stamps the coin in neat little stripes.",
    },
    {
      id: "floofina",
      name: "Floofina",
      tag: "Cheetah",
      cps: 64,
      click: 8,
      baseCost: 12000,
      blurb: "Zooms the coin, and your clicks land harder.",
    },
    {
      id: "aqua",
      name: "Aqua",
      tag: "Dolfin",
      cps: 256,
      click: 20,
      baseCost: 140000,
      blurb: "Nose-boops the coin and giggles.",
    },
    {
      id: "jeffry",
      name: "Jeffry",
      tag: "Pepermint Yeti",
      cps: 1000,
      click: 50,
      baseCost: 1600000,
      blurb: "Minty paws sweeten every click.",
    },
    {
      id: "walla",
      name: "Walla",
      tag: "Kwalla",
      cps: 4200,
      click: 100,
      baseCost: 20000000,
      blurb: "Clings to the coin and will not let go.",
    },
    {
      id: "blueyeti",
      name: "Blue Yeti",
      tag: "Blue Yeti",
      cps: 18000,
      click: 250,
      baseCost: 260000000,
      blurb: "Big blue paws make clicks count more.",
    },
    {
      id: "barry",
      name: "Barry",
      tag: "Brown Yeti",
      cps: 75000,
      click: 500,
      baseCost: 3400000000,
      blurb: "Leans on the coin until coins fall out.",
    },
    {
      id: "floof",
      name: "Floof",
      tag: "Fluff",
      cps: 155000,
      click: 1000,
      baseCost: 12000000000,
      blurb: "Fluffs the coin until extra doge shakes loose.",
    },
    {
      id: "fred",
      name: "Fred",
      tag: "Maple Donut",
      cps: 320000,
      click: 2000,
      baseCost: 45000000000,
      blurb: "Glazes the coin and fattens your clicks.",
    },
    {
      id: "theodo",
      name: "Theodo",
      tag: "Blue Monster Dragon",
      cps: 1400000,
      click: 4000,
      baseCost: 600000000000,
      blurb: "Flaps both wings at the coin.",
    },
    {
      id: "fish",
      name: "Fish",
      tag: "Red Grey White",
      cps: 6000000,
      click: 8000,
      baseCost: 8000000000000,
      blurb: "Flops the coin and charges every click.",
    },
    {
      id: "filaly",
      name: "Doge",
      tag: "Corgy",
      cps: 26000000,
      click: 20000,
      baseCost: 110000000000000,
      blurb: "The boss corgy. Every tap is a payday.",
    },
  ];

  var state = {
    doge: 0,
    owned: {},
    muted: false,
    qty: 1,
    selling: false,
    shopOpen: true,
    shopTab: "squish",
    hinted: false,
    adv: {},
  };

  SQUISH.forEach(function (s) {
    state.owned[s.id] = 0;
  });

  var advApi = globalThis.CorgiAdvancements.create(SQUISH);

  var lastTs = Date.now();
  var saveTimer = 0;
  var boostUntil = 0;
  var boostShown = false;
  var happyUntil = 0;
  var happyCooldownUntil = 0;
  var partyUntil = 0;
  var partyCooldownUntil = 0;
  var advKey = "";
  var hopBank = {};
  var hopAt = {};
  var lastHopSound = 0;
  var lastBoop = 0;
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

  function boostLeft(now) {
    return Math.max(0, boostUntil - (now || Date.now()));
  }

  function incomeMult(now) {
    return boostLeft(now) > 0 ? BOOST_MULT : 1;
  }

  function partyLeft(now) {
    return Math.max(0, partyUntil - (now || Date.now()));
  }

  function happyLeft(now) {
    return Math.max(0, happyUntil - (now || Date.now()));
  }

  function currentEffects() {
    return advApi.effects(state.adv, { happy: happyLeft() > 0, party: false });
  }

  function helperRate(def, opts) {
    var e = advApi.effects(state.adv, { happy: false, party: false });
    var rate = state.owned[def.id] * def.cps * e.cpsMult(def.id);
    var skipParty = opts && opts.party === false;
    var skipBoost = opts && opts.boost === false;
    if (!skipParty && partyLeft() > 0) rate *= advApi.PARTY_MULT;
    if (!skipBoost && boostLeft() > 0) rate *= BOOST_MULT;
    return rate;
  }

  function cps(opts) {
    var total = 0;
    SQUISH.forEach(function (s) {
      total += helperRate(s, opts);
    });
    return total;
  }

  function clickPower() {
    var e = advApi.effects(state.adv, { happy: false, party: false });
    var power = 1;
    SQUISH.forEach(function (s) {
      power += state.owned[s.id] * s.click * e.clickMult;
    });
    return power * incomeMult();
  }

  function scaledBase(def) {
    return def.baseCost * currentEffects().priceFactor(def.id);
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
    if (qtyMode() === "max") return economy.maxBuy(scaledBase(def), state.owned[def.id], state.doge);
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
      shopOpen: state.shopOpen,
      shopTab: state.shopTab,
      hinted: state.hinted,
      adv: state.adv,
      happyUntil: happyUntil,
      happyCooldownUntil: happyCooldownUntil,
      partyUntil: partyUntil,
      partyCooldownUntil: partyCooldownUntil,
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
    if (data.qty === "max" || data.qty === 100 || data.qty === 10 || data.qty === 1) state.qty = data.qty;
    if (typeof data.shopOpen === "boolean") state.shopOpen = data.shopOpen;
    state.shopTab = data.shopTab === "adv" ? "adv" : "squish";
    state.hinted = Boolean(data.hinted);
    state.adv = {};
    if (data.adv && typeof data.adv === "object") {
      advApi.list.forEach(function (def) {
        var n = data.adv[def.id];
        if (typeof n === "number" && n > 0) state.adv[def.id] = advApi.clampLevel(def, n);
      });
    }
    var away = 0;
    if (typeof data.last === "number") {
      away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - data.last) / 1000));
    }
    var rate = cps({ party: false, boost: false });
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
    partyUntil = restoreUntil(data.partyUntil, advApi.PARTY_MS + 5000);
    happyUntil = restoreUntil(data.happyUntil, advApi.HAPPY_MS + 5000);
    partyCooldownUntil = restoreUntil(data.partyCooldownUntil, advApi.PARTY_COOLDOWN + 60000);
    happyCooldownUntil = restoreUntil(data.happyCooldownUntil, advApi.HAPPY_COOLDOWN + 60000);
  }

  function restoreUntil(value, maxWindow) {
    if (typeof value !== "number") return 0;
    var now = Date.now();
    if (value > now && value < now + maxWindow) return value;
    return 0;
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
    boostUntil = Date.now() + BOOST_MS;
    var gain = clickPower();
    var fx = currentEffects();
    var lucky = fx.luckyChance > 0 && Math.random() < fx.luckyChance;
    if (lucky) gain *= 1 + fx.luckyBonus;
    state.doge += gain;
    dropClickCoins(gain);
    state.hinted = true;
    heard = true;
    $("hint").hidden = true;
    var fromKeyboard = clientX == null;
    var point = fromKeyboard ? coinCenter() : layerPoint(clientX, clientY);
    spawnFloater((lucky ? "Lucky +" : "+") + economy.formatAmount(gain), point.x, point.y, lucky ? "lucky" : "player");
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
    var cost = economy.costOf(scaledBase(def), state.owned[def.id], qty);
    if (qty < 1 || state.doge + 1e-6 < cost) return;
    state.doge = Math.max(0, state.doge - cost);
    state.owned[def.id] += qty;
    playTone(520, 0.12, 0.04);
    var card = document.querySelector('#shop-list .card[data-id="' + id + '"]');
    if (card) {
      card.classList.remove("bought");
      void card.offsetWidth;
      card.classList.add("bought");
    }
    buildCrew();
    scheduleSave();
    paint();
  }

  function sellQtyFor(def) {
    var owned = state.owned[def.id];
    if (qtyMode() === "max") return owned;
    return state.qty;
  }

  function sell(id) {
    var def = findSquish(id);
    if (!def) return;
    var owned = state.owned[def.id];
    var qty = sellQtyFor(def);
    var refund = economy.refundOf(def.baseCost, owned, qty);
    if (qty < 1 || qty > owned) return;
    state.owned[def.id] = owned - qty;
    state.doge += refund;
    playTone(320, 0.12, 0.04);
    var card = document.querySelector('#shop-list .card[data-id="' + id + '"]');
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
      if (def.click) rates += " · +" + economy.formatAmount(def.click) + " per click";
      btn.innerHTML =
        '<span class="portrait"><img alt="" width="512" height="512" src="assets/' +
        def.id +
        '.png"><span class="count">0</span></span>' +
        '<span class="info"><span class="name-row"><span class="name"></span><span class="tag"></span></span>' +
        '<span class="blurb"></span><span class="rates"></span></span>' +
        '<span class="price"><span class="cost"></span><span class="deal"></span><span class="mult"></span></span>' +
        '<span class="meter" aria-hidden="true"><span class="meter-fill"></span></span>';
      btn.querySelector(".name").textContent = def.name;
      btn.querySelector(".tag").textContent = def.tag;
      btn.querySelector(".blurb").textContent = def.blurb;
      btn.querySelector(".rates").textContent = rates;
      btn.querySelector("img").alt = def.name + ", a " + def.tag.toLowerCase() + " squishmollow";
      btn.addEventListener("click", function () {
        if (state.selling) sell(def.id);
        else buy(def.id);
      });
      list.appendChild(btn);
    });
    shopBuilt = true;
  }

  function paintShop() {
    if (!shopBuilt) return;
    var fx = currentEffects();
    SQUISH.forEach(function (def) {
      var card = document.querySelector('#shop-list .card[data-id="' + def.id + '"]');
      var owned = state.owned[def.id];
      card.classList.toggle("sell-mode", state.selling);
      card.querySelector(".count").textContent = economy.formatAmount(owned);
      card.querySelector(".count").classList.toggle("zero", owned === 0);
      var rates = "+" + economy.formatAmount(def.cps * fx.cpsMult(def.id)) + "/s";
      if (def.click) rates += " · +" + economy.formatAmount(def.click * fx.clickMult) + " per click";
      card.querySelector(".rates").textContent = rates;
      var off = state.selling ? 0 : fx.discount(def.id);
      card.querySelector(".deal").textContent = off > 0 ? Math.round(off * 100) + "% off" : "";
      if (state.selling) {
        var sellQty = sellQtyFor(def);
        var canSell = sellQty >= 1 && owned >= sellQty;
        var refund = canSell ? economy.refundOf(def.baseCost, owned, sellQty) : 0;
        card.disabled = !canSell;
        card.classList.toggle("afford", canSell);
        card.querySelector(".cost").textContent = canSell ? "+" + economy.formatAmount(refund) : "—";
        card.querySelector(".mult").textContent = "sell ×" + economy.formatAmount(Math.max(sellQty, 0));
        card.querySelector(".meter-fill").style.width = (canSell ? Math.min(1, sellQty / owned) : 0) * 100 + "%";
        card.setAttribute(
          "aria-label",
          "Sell " +
            sellQty +
            " " +
            def.name +
            " for " +
            economy.formatAmount(refund) +
            " doge back. You own " +
            owned +
            "."
        );
      } else {
        var qty = qtyFor(def);
        var showQty = qtyMode() === "max" ? Math.max(qty, 1) : state.qty;
        var cost = economy.costOf(scaledBase(def), owned, showQty);
        var afford = state.doge + 1e-6 >= cost && (qtyMode() !== "max" || qty >= 1);
        card.disabled = !afford;
        card.classList.toggle("afford", afford);
        card.querySelector(".cost").textContent = economy.formatAmount(cost);
        card.querySelector(".mult").textContent =
          qtyMode() === "max" ? (qty >= 1 ? "×" + economy.formatAmount(qty) : "next") : "×" + state.qty;
        var next = economy.costOf(scaledBase(def), owned, 1);
        var pct = next <= 0 ? 0 : Math.max(0, Math.min(1, state.doge / next));
        card.querySelector(".meter-fill").style.width = pct * 100 + "%";
        card.setAttribute(
          "aria-label",
          "Buy " + showQty + " " + def.name + " for " + economy.formatAmount(cost) + " doge. You own " + owned + "."
        );
      }
    });
  }

  function findAdv(id) {
    for (var i = 0; i < advApi.list.length; i++) {
      if (advApi.list[i].id === id) return advApi.list[i];
    }
    return null;
  }

  function advVisible(def) {
    if ((state.adv[def.id] || 0) > 0) return true;
    if (!def.unlockId) return true;
    return (state.owned[def.unlockId] || 0) >= 1;
  }

  function cooldownLeft(def, now) {
    var t = now || Date.now();
    if (def.kind === "happy") return Math.max(0, happyCooldownUntil - t);
    if (def.kind === "party") return Math.max(0, partyCooldownUntil - t);
    return 0;
  }

  function effectLeft(def, now) {
    if (def.kind === "happy") return happyLeft(now);
    if (def.kind === "party") return partyLeft(now);
    return 0;
  }

  function formatRemain(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    if (m <= 0) return s + "s";
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function buyAdv(id) {
    var def = findAdv(id);
    if (!def) return;
    var level = state.adv[def.id] || 0;
    if (!advApi.isUnlocked(def, state.owned, ownedTotal())) return;
    if (effectLeft(def) > 0 || cooldownLeft(def) > 0) return;
    var cost = advApi.costOf(def, level);
    if (cost == null || !(state.doge + 1e-6 >= cost)) return;
    state.doge = Math.max(0, state.doge - cost);
    state.adv[def.id] = advApi.clampLevel(def, level + 1);
    var now = Date.now();
    if (def.kind === "happy") {
      happyUntil = now + advApi.HAPPY_MS;
      happyCooldownUntil = now + advApi.HAPPY_COOLDOWN;
    }
    if (def.kind === "party") {
      partyUntil = now + advApi.PARTY_MS;
      partyCooldownUntil = now + advApi.PARTY_COOLDOWN;
    }
    playTone(640, 0.12, 0.04);
    var card = document.querySelector('#adv-list .card[data-id="' + id + '"]');
    if (card) {
      card.classList.remove("bought");
      void card.offsetWidth;
      card.classList.add("bought");
    }
    scheduleSave();
    paint();
  }

  function ensureAdv() {
    var key = advApi.list
      .filter(advVisible)
      .map(function (def) {
        return def.id;
      })
      .join("|");
    if (key === advKey) return;
    advKey = key;
    buildAdv();
  }

  function buildAdv() {
    var list = $("adv-list");
    list.innerHTML = "";
    advApi.list.forEach(function (def) {
      if (!advVisible(def)) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card adv-card";
      btn.dataset.id = def.id;
      var portrait = def.portrait
        ? '<span class="portrait"><img alt="" width="512" height="512" src="assets/' +
          def.portrait +
          '.png"><span class="count">0</span></span>'
        : '<span class="portrait"><span class="medallion ' +
          def.kind +
          '"></span><span class="count">0</span></span>';
      btn.innerHTML =
        portrait +
        '<span class="info"><span class="name-row"><span class="name"></span><span class="tag"></span></span>' +
        '<span class="blurb"></span><span class="rates"></span></span>' +
        '<span class="price"><span class="cost"></span><span class="mult"></span></span>' +
        '<span class="meter" aria-hidden="true"><span class="meter-fill"></span></span>';
      if (!def.portrait) btn.querySelector(".medallion").textContent = def.short;
      btn.querySelector(".blurb").textContent = def.blurb;
      btn.addEventListener("click", function () {
        buyAdv(def.id);
      });
      list.appendChild(btn);
    });
  }

  function paintAdv() {
    ensureAdv();
    var total = ownedTotal();
    advApi.list.forEach(function (def) {
      if (!advVisible(def)) return;
      var card = document.querySelector('#adv-list .card[data-id="' + def.id + '"]');
      if (!card) return;
      var level = state.adv[def.id] || 0;
      var unlocked = advApi.isUnlocked(def, state.owned, total);
      var cost = advApi.costOf(def, level);
      var maxed = cost == null;
      var wait = cooldownLeft(def);
      var live = effectLeft(def);
      var blocked = !unlocked || maxed || wait > 0 || live > 0;
      var afford = !blocked && state.doge + 1e-6 >= cost;
      card.disabled = blocked || !afford;
      card.classList.toggle("afford", afford);
      card.classList.toggle("locked", !unlocked);
      card.classList.toggle("maxed", maxed);
      card.classList.toggle("live", live > 0);
      card.classList.toggle("cooling", wait > 0 && live <= 0);
      card.querySelector(".name").textContent = advApi.displayName(def, level);
      card.querySelector(".tag").textContent = level > 0 ? def.tag + " · " + level : def.tag;
      card.querySelector(".blurb").textContent = def.blurb;
      var count = card.querySelector(".count");
      count.textContent = String(level);
      count.classList.toggle("zero", level === 0);
      var rates = card.querySelector(".rates");
      var costEl = card.querySelector(".cost");
      var mult = card.querySelector(".mult");
      if (!unlocked) {
        rates.textContent = advApi.requirement(def);
        costEl.textContent = "—";
        mult.textContent = "locked";
        card.querySelector(".meter-fill").style.width = "0%";
        card.setAttribute("aria-label", def.name + ". " + advApi.requirement(def) + ".");
        return;
      }
      if (maxed) {
        rates.textContent = advApi.detail(def, level);
        costEl.textContent = "Maxed";
        mult.textContent = "level " + level;
        card.querySelector(".meter-fill").style.width = "100%";
        card.setAttribute("aria-label", advApi.displayName(def, level) + " is maxed. " + advApi.detail(def, level) + ".");
        return;
      }
      if (live > 0) rates.textContent = "On for " + formatRemain(live);
      else if (wait > 0) rates.textContent = "Ready in " + formatRemain(wait);
      else rates.textContent = advApi.detail(def, level);
      costEl.textContent = economy.formatAmount(cost);
      mult.textContent = "level " + (level + 1);
      var pct = cost <= 0 ? 0 : Math.max(0, Math.min(1, state.doge / cost));
      card.querySelector(".meter-fill").style.width = pct * 100 + "%";
      var aria = "Buy " + advApi.displayName(def, level) + " for " + economy.formatAmount(cost) + " doge.";
      if (live > 0) aria = advApi.displayName(def, level) + " is on for " + formatRemain(live) + ".";
      else if (wait > 0) aria = advApi.displayName(def, level) + " is ready in " + formatRemain(wait) + ".";
      card.setAttribute("aria-label", aria);
    });
  }

  function paintHud() {
    $("doge").textContent = economy.formatAmount(state.doge);
    $("cps").textContent = economy.formatAmount(cps());
    $("cpc").textContent = economy.formatAmount(clickPower());
    paintBoost();
    paintBuffs();
    $("owned-total").textContent = economy.formatAmount(ownedTotal());
    var mute = $("mute");
    mute.textContent = state.muted ? "Sound off" : "Sound on";
    mute.setAttribute("aria-pressed", state.muted ? "true" : "false");
    document.querySelectorAll(".qty").forEach(function (btn) {
      var on = String(state.qty) === btn.dataset.qty;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var sellBtn = $("sell-mode");
    sellBtn.textContent = state.selling ? "Buy" : "Sell";
    sellBtn.setAttribute("aria-pressed", state.selling ? "true" : "false");
    sellBtn.setAttribute("aria-label", state.selling ? "Switch back to buying" : "Sell squishmollows");
    var advOn = state.shopTab === "adv";
    $("shop-heading").textContent = advOn ? "Advancements" : "Squishmollows";
    $("shop").setAttribute("aria-label", advOn ? "Advancements" : "Squishmollow shop");
    $("tab-squish").setAttribute("aria-selected", advOn ? "false" : "true");
    $("tab-adv").setAttribute("aria-selected", advOn ? "true" : "false");
    $("shop-list").hidden = advOn;
    $("adv-list").hidden = !advOn;
    $("qty-row").hidden = advOn;
    $("shop-note").textContent = advOn
      ? "Each one costs more the next time. Discounts never pass 20% off."
      : state.selling
        ? "Selling gives back a quarter of what those ones cost."
        : "Each one taps the coin and makes your own clicks heavier.";
    $("shop-list").classList.toggle("is-selling", state.selling);
    var open = state.shopOpen;
    $("layout").classList.toggle("shop-closed", !open);
    $("shop").hidden = !open;
    var toggle = $("shop-toggle");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close the shop" : "Open the shop");
    toggle.textContent = "Shop";
  }

  function paintBuffs() {
    var party = partyLeft();
    var happy = happyLeft();
    var partyNode = $("party-badge");
    var happyNode = $("happy-badge");
    partyNode.hidden = party <= 0;
    happyNode.hidden = happy <= 0;
    if (party > 0) partyNode.textContent = "Party · " + (party / 1000).toFixed(0) + "s";
    if (happy > 0) happyNode.textContent = "Sale · " + (happy / 1000).toFixed(0) + "s";
    $("coin-wrap").classList.toggle("partying", party > 0);
    $("shop").classList.toggle("happy-on", happy > 0);
  }

  function paintBoost() {
    var left = boostLeft();
    var on = left > 0;
    var badge = $("boost");
    badge.hidden = !on;
    if (on) badge.textContent = "1.5× · " + (left / 1000).toFixed(1) + "s";
    $("coin-wrap").classList.toggle("boosted", on);
    $("rates").classList.toggle("boosted", on);
    if (on !== boostShown) {
      boostShown = on;
      $("coin").setAttribute(
        "aria-label",
        on ? "Click the corgi coin. 1.5 times boost is on." : "Click the corgi coin"
      );
    }
  }

  function paint() {
    paintHud();
    paintShop();
    paintAdv();
  }

  function layoutCrew() {
    var orbit = $("orbit");
    if (!orbit) return;
    var pals = orbit.querySelectorAll(".pal");
    var n = pals.length;
    if (!n) return;
    var w = orbit.clientWidth;
    var h = orbit.clientHeight;
    if (w < 40 || h < 40) return;
    var coin = $("coin-wrap");
    var coinR = coin.offsetWidth / 2;
    var cx = w / 2;
    var cy = h * 0.48;
    var narrow = w < 520;
    var palSize = narrow ? 48 : n > 10 ? 58 : 68;
    var out = narrow ? palSize * 0.5 : palSize * 0.7;
    var edge = Math.min(cx, cy, w - cx, h - cy);
    var maxR = edge - (narrow ? 42 : 52);
    var radius = coinR + palSize * (narrow ? 0.42 : 0.44) + 8;
    if (radius > maxR) radius = Math.max(coinR * 0.62, maxR);
    for (var i = 0; i < n; i++) {
      var angle = Math.PI / 2 + (i / n) * Math.PI * 2;
      var x = cx + Math.cos(angle) * radius;
      var y = cy + Math.sin(angle) * radius;
      var pal = pals[i];
      pal.style.width = palSize + "px";
      pal.style.height = palSize + "px";
      pal.style.left = x - palSize / 2 + "px";
      pal.style.top = y - palSize / 2 + "px";
      pal.style.zIndex = String(10 + Math.round(y));
      pal.style.setProperty("--lx", Math.round(Math.cos(angle) * out) + "px");
      pal.style.setProperty("--ly", Math.round(Math.sin(angle) * out) + "px");
    }
  }

  function buildCrew() {
    var crew = $("crew");
    var empty = $("crew-empty");
    SQUISH.forEach(function (def) {
      var n = state.owned[def.id];
      var fig = crew.querySelector('.pal[data-id="' + def.id + '"]');
      if (!n) {
        if (fig) fig.remove();
        hopBank[def.id] = 0;
        return;
      }
      var label = n > 1 ? def.name + " x" + economy.formatAmount(n) : def.name;
      if (!fig) {
        fig = document.createElement("figure");
        fig.className = "pal";
        fig.dataset.id = def.id;
        fig.style.setProperty("--bob", (SQUISH.indexOf(def) * 0.17).toFixed(2) + "s");
        var img = document.createElement("img");
        img.src = "assets/" + def.id + ".png";
        img.alt = "";
        img.width = 512;
        img.height = 512;
        img.addEventListener("animationend", function (event) {
          if (event.animationName === "hop") img.classList.remove("tap");
        });
        fig.appendChild(img);
        var badge = document.createElement("span");
        badge.className = "more";
        fig.appendChild(badge);
      }
      fig.setAttribute("aria-label", label);
      fig.querySelector(".more").textContent = label;
      crew.appendChild(fig);
    });
    empty.hidden = crew.childElementCount > 0;
    layoutCrew();
  }

  function hopPal(id) {
    if (reduceMotion) return;
    var img = document.querySelector('#crew .pal[data-id="' + id + '"] img');
    if (!img) return;
    img.classList.remove("tap");
    void img.offsetWidth;
    img.classList.add("tap");
    var now = Date.now();
    if (now - lastBoop > 1100) {
      lastBoop = now;
      var coin = $("coin");
      coin.classList.add("boop");
      window.setTimeout(function () {
        coin.classList.remove("boop");
      }, 140);
    }
    if (heard && !state.muted && now - lastHopSound > 1400 && Math.random() < 0.45) {
      lastHopSound = now;
      playTone(480 + Math.random() * 40, 0.05, 0.012);
    }
  }

  function tickHops(dt) {
    if (!(dt > 0)) return;
    var now = Date.now();
    var step = Math.min(dt, 0.25);
    SQUISH.forEach(function (def) {
      if (!state.owned[def.id]) return;
      hopBank[def.id] = (hopBank[def.id] || 0) + helperRate(def) * step;
      if (now < (hopAt[def.id] || 0)) return;
      if (hopBank[def.id] < 1) return;
      hopBank[def.id] = 0;
      hopAt[def.id] = now + 480;
      hopPal(def.id);
    });
  }

  function frame() {
    var now = Date.now();
    var dt = Math.min(OFFLINE_CAP, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    var rate = cps();
    if (rate > 0 && dt > 0) state.doge += rate * dt;
    tickHops(dt);
    tickSky(dt, rate);
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

    $("sell-mode").addEventListener("click", function () {
      state.selling = !state.selling;
      paint();
    });

    $("tab-squish").addEventListener("click", function () {
      state.shopTab = "squish";
      scheduleSave();
      paint();
    });

    $("tab-adv").addEventListener("click", function () {
      state.shopTab = "adv";
      scheduleSave();
      paint();
    });

    $("shop-toggle").addEventListener("click", function () {
      state.shopOpen = !state.shopOpen;
      scheduleSave();
      paint();
    });

    $("shop-close").addEventListener("click", function () {
      state.shopOpen = false;
      scheduleSave();
      paint();
      $("shop-toggle").focus();
    });

    $("mute").addEventListener("click", function () {
      state.muted = !state.muted;
      if (state.muted && audioCtx && audioCtx.state === "running") audioCtx.suspend();
      scheduleSave();
      paint();
    });

    $("reset").addEventListener("click", function () {
      var ok = window.confirm("Reset your doge, advancements, and send the squishmollows home?");
      if (!ok) return;
      state.doge = 0;
      state.adv = {};
      SQUISH.forEach(function (s) {
        state.owned[s.id] = 0;
      });
      boostUntil = 0;
      happyUntil = 0;
      happyCooldownUntil = 0;
      partyUntil = 0;
      partyCooldownUntil = 0;
      hopBank = {};
      hopAt = {};
      advKey = "";
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

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SKY_CAP = 24;
  var SKY_PER_SEC = 12;
  var skyOwed = 0;

  function fallSeconds(rate) {
    if (rate <= 1) return 5.2;
    return Math.max(0.75, 5.2 / Math.sqrt(rate));
  }

  function spawnSkyCoin(duration) {
    if (reduceMotion || document.visibilityState === "hidden") return false;
    var sky = $("sky");
    if (!sky || sky.childElementCount >= SKY_CAP) return false;
    var coin = document.createElement("img");
    var size = 26 + Math.random() * 36;
    var drop = sky.clientHeight;
    if (drop < 40) drop = window.innerHeight;
    coin.className = "sky-coin";
    coin.src = "assets/coin.png";
    coin.alt = "";
    coin.draggable = false;
    coin.width = 128;
    coin.height = 128;
    coin.style.width = size + "px";
    coin.style.left = Math.random() * 94 + "%";
    coin.style.setProperty("--drop", drop + size + "px");
    coin.style.setProperty("--drift", Math.round(Math.random() * 100 - 50) + "px");
    coin.style.setProperty(
      "--spin",
      (Math.random() < 0.5 ? -1 : 1) * Math.round(240 + Math.random() * 480) + "deg"
    );
    coin.style.animationDuration = duration * (0.88 + Math.random() * 0.24) + "s";
    coin.addEventListener("animationend", function () {
      coin.remove();
    });
    sky.appendChild(coin);
    return true;
  }

  function dropClickCoins(gain) {
    if (gain <= 0) return;
    var n = gain < 6 ? Math.max(1, Math.round(gain)) : Math.min(6, 3 + Math.round(Math.log10(gain)));
    var duration = fallSeconds(Math.max(cps(), n));
    for (var i = 0; i < n; i++) {
      if (!spawnSkyCoin(duration)) break;
    }
  }

  function tickSky(dt, rate) {
    if (reduceMotion || document.visibilityState === "hidden" || !(dt > 0)) return;
    var visualDt = Math.min(dt, 0.1);
    if (rate > 0) skyOwed += rate * visualDt;
    var chunk = rate <= SKY_PER_SEC ? 1 : rate / SKY_PER_SEC;
    var sky = $("sky");
    if (!sky) return;
    var room = SKY_CAP - sky.childElementCount;
    var limit = Math.min(room, Math.max(1, Math.ceil(SKY_PER_SEC * visualDt)));
    var made = 0;
    while (skyOwed >= chunk && made < limit) {
      if (!spawnSkyCoin(fallSeconds(rate))) break;
      skyOwed -= chunk;
      made += 1;
    }
    if (room <= 0) skyOwed = Math.min(skyOwed, chunk);
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
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        layoutCrew();
      }).observe($("orbit"));
    }
    window.addEventListener("resize", layoutCrew);
    window.setInterval(save, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
