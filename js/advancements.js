(function (root) {
  "use strict";

  var DISCOUNT_CAP = 0.2;
  var BONUS_MIN = 0.1;
  var BONUS_MAX = 0.25;

  function plural(name) {
    if (name === "Fish") return "Fish";
    if (name === "Blue Yeti") return "Blue Yetis";
    return name + "s";
  }

  function roundCost(n) {
    var cost = Math.round(n);
    if (!Number.isFinite(cost)) return null;
    return Math.max(1, cost);
  }

  function create(roster) {
    var list = [];

    list.push({
      id: "lucky-paw",
      name: "Lucky Paw",
      short: "Paw",
      tag: "Tap",
      kind: "lucky",
      blurb: "Sometimes a tap shakes loose extra coins.",
      unlockTotal: 0,
      baseCost: 250,
      growth: 3.5,
      maxLevel: 5,
      bonus: 0.25,
    });
    list.push({
      id: "happy-hour",
      name: "Happy Hour",
      short: "Sale",
      tag: "Timed",
      kind: "happy",
      blurb: "Every squishmallow is 20% off for 20 seconds.",
      unlockTotal: 10,
      baseCost: 800,
      growth: 4,
      duration: 20000,
      cooldown: 120000,
      discount: DISCOUNT_CAP,
    });
    list.push({
      id: "party-mode",
      name: "Party Mode",
      short: "Party",
      tag: "Timed",
      kind: "party",
      blurb: "All helpers earn 25% more for 30 seconds.",
      unlockTotal: 25,
      baseCost: 5000,
      growth: 4,
      duration: 30000,
      cooldown: 180000,
      bonus: 0.25,
    });
    list.push({
      id: "cozy-pile",
      name: "Cozy Pile",
      short: "Pile",
      tag: "Everyone",
      kind: "global-cps",
      blurb: "The whole crew earns 10% more coins per second.",
      unlockTotal: 25,
      baseCost: 7500,
      growth: 4.5,
      maxLevel: 6,
      bonus: 0.1,
    });
    list.push({
      id: "heavy-paws",
      name: "Heavy Paws",
      short: "Paws",
      tag: "Clicks",
      kind: "global-click",
      blurb: "Helpers add 10% more to each of your clicks.",
      unlockTotal: 50,
      baseCost: 80000,
      growth: 4.5,
      maxLevel: 5,
      bonus: 0.1,
    });

    roster.forEach(function (s) {
      var many = plural(s.name);
      list.push({
        id: s.id + "-earn",
        name: many + " earn more",
        short: s.name,
        tag: "One helper",
        kind: "cps",
        target: s.id,
        who: s.name,
        plural: many,
        blurb: many + " earn 15% more coins each second.",
        unlockId: s.id,
        unlockCount: 1,
        baseCost: roundCost(s.baseCost * 2),
        growth: 3.4,
        maxLevel: 4,
        bonus: 0.15,
        portrait: s.id,
      });
      list.push({
        id: s.id + "-sale",
        name: many + " are 10% off",
        short: s.name,
        tag: "Discount",
        kind: "discount",
        target: s.id,
        who: s.name,
        plural: many,
        blurb: "A price cut for " + many + ". It stops at 20% off.",
        unlockId: s.id,
        unlockCount: 1,
        baseCost: roundCost(s.baseCost * 1.5),
        growth: 3,
        maxLevel: 2,
        step: 0.1,
        cap: DISCOUNT_CAP,
        portrait: s.id,
      });
      list.push({
        id: s.id + "-drive",
        name: many + " earn much more",
        short: s.name,
        tag: "One helper",
        kind: "cps",
        target: s.id,
        who: s.name,
        plural: many,
        blurb: many + " earn 25% more coins each second.",
        unlockId: s.id,
        unlockCount: 10,
        baseCost: roundCost(s.baseCost * 12),
        growth: 4,
        maxLevel: 2,
        bonus: 0.25,
        portrait: s.id,
      });
    });

    check(list);

    function find(id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    function clampLevel(def, level) {
      var lvl = Math.max(0, Math.floor(level || 0));
      var cap = def.maxLevel || 40;
      return Math.min(cap, lvl);
    }

    function costOf(def, level) {
      var lvl = Math.max(0, Math.floor(level || 0));
      if (def.maxLevel && lvl >= def.maxLevel) return null;
      return roundCost(def.baseCost * Math.pow(def.growth, lvl));
    }

    function isUnlocked(def, owned, total) {
      if (def.unlockId) return (owned[def.unlockId] || 0) >= (def.unlockCount || 1);
      return (total || 0) >= (def.unlockTotal || 0);
    }

    function requirement(def) {
      if (def.unlockId) {
        var n = def.unlockCount || 1;
        var noun = n === 1 ? def.who : def.plural;
        return "Own " + n + " " + noun;
      }
      if (def.unlockTotal) return "Own " + def.unlockTotal + " squishmollows";
      return "";
    }

    function luckyChance(level) {
      var lvl = Math.max(0, Math.floor(level || 0));
      if (lvl <= 0) return 0;
      var lucky = find("lucky-paw");
      lvl = Math.min(lucky.maxLevel, lvl);
      return Math.min(0.2, 0.1 + (lvl - 1) * 0.025);
    }

    // Helper discounts and Happy Hour both stop at 20% off. They do not stack past that.
    function effects(levels, flags) {
      var cpsAdd = {};
      var discount = {};
      roster.forEach(function (s) {
        cpsAdd[s.id] = 0;
        discount[s.id] = 0;
      });
      var globalCps = 0;
      var globalClick = 0;
      var chance = 0;
      list.forEach(function (def) {
        var lvl = clampLevel(def, levels && levels[def.id]);
        if (lvl <= 0) return;
        if (def.kind === "cps") cpsAdd[def.target] += def.bonus * lvl;
        else if (def.kind === "discount") discount[def.target] = Math.min(def.cap, def.step * lvl);
        else if (def.kind === "global-cps") globalCps += def.bonus * lvl;
        else if (def.kind === "global-click") globalClick += def.bonus * lvl;
        else if (def.kind === "lucky") chance = luckyChance(lvl);
      });
      var happy = Boolean(flags && flags.happy);
      roster.forEach(function (s) {
        var off = discount[s.id];
        if (happy) off = Math.max(off, DISCOUNT_CAP);
        discount[s.id] = Math.min(DISCOUNT_CAP, off);
      });
      return {
        cpsMult: function (id) {
          return (1 + (cpsAdd[id] || 0)) * (1 + globalCps);
        },
        clickMult: 1 + globalClick,
        discount: function (id) {
          return discount[id] || 0;
        },
        priceFactor: function (id) {
          return 1 - (discount[id] || 0);
        },
        luckyChance: chance,
        luckyBonus: 0.25,
      };
    }

    function displayName(def, level) {
      if (def.kind === "discount") {
        var lvl = clampLevel(def, level);
        var shown = lvl >= def.maxLevel ? def.maxLevel : lvl + 1;
        var pct = Math.round(Math.min(def.cap, def.step * shown) * 100);
        return def.plural + " are " + pct + "% off";
      }
      return def.name;
    }

    function detail(def, level) {
      var lvl = clampLevel(def, level);
      if (def.kind === "cps" || def.kind === "global-cps" || def.kind === "global-click") {
        var step = Math.round(def.bonus * 100);
        var now = Math.round(def.bonus * lvl * 100);
        if (lvl <= 0) return "+" + step + "% each time you buy it";
        if (def.maxLevel && lvl >= def.maxLevel) return "Now +" + now + "%";
        return "Now +" + now + "% · next buy +" + step + "%";
      }
      if (def.kind === "discount") {
        var pct = Math.round(Math.min(def.cap, def.step * lvl) * 100);
        if (lvl <= 0) return "10% off, then 20% off";
        if (lvl >= def.maxLevel) return "Now " + pct + "% off";
        return "Now " + pct + "% off · next buy makes it 20%";
      }
      if (def.kind === "lucky") {
        if (lvl <= 0) return "10% chance of +25% coins";
        var shown = Math.round(luckyChance(lvl) * 1000) / 10;
        return shown + "% chance of +25% coins";
      }
      if (def.kind === "happy") return "20 seconds · 2 min cooldown";
      if (def.kind === "party") return "30 seconds · 3 min cooldown";
      return "";
    }

    return {
      list: list,
      DISCOUNT_CAP: DISCOUNT_CAP,
      HAPPY_MS: 20000,
      HAPPY_COOLDOWN: 120000,
      PARTY_MS: 30000,
      PARTY_COOLDOWN: 180000,
      PARTY_MULT: 1.25,
      costOf: costOf,
      isUnlocked: isUnlocked,
      requirement: requirement,
      luckyChance: luckyChance,
      effects: effects,
      displayName: displayName,
      detail: detail,
      clampLevel: clampLevel,
      plural: plural,
    };
  }

  function check(list) {
    list.forEach(function (def) {
      if (!(def.growth > 1)) throw new Error(def.id + " must cost more each buy");
      if (!(def.baseCost >= 1)) throw new Error(def.id + " needs a price");
      if (def.kind === "discount") {
        if (def.step < BONUS_MIN || def.step > BONUS_MAX) throw new Error(def.id + " discount step");
        if (def.step * def.maxLevel > DISCOUNT_CAP + 1e-9) throw new Error(def.id + " discount cap");
      }
      if (def.kind === "cps" || def.kind === "global-cps" || def.kind === "global-click" || def.kind === "party") {
        if (!(def.bonus >= BONUS_MIN && def.bonus <= BONUS_MAX)) throw new Error(def.id + " bonus");
      }
      if (def.kind === "lucky" && !(def.bonus >= BONUS_MIN && def.bonus <= BONUS_MAX)) {
        throw new Error(def.id + " bonus");
      }
      if (def.kind === "party") {
        if (def.duration !== 30000) throw new Error("Party Mode must last 30 seconds");
        if (!(def.cooldown >= def.duration * 4)) throw new Error("Party Mode cooldown is too short");
        if (!(def.unlockTotal >= 25)) throw new Error("Party Mode unlocks too early");
      }
      if (def.kind === "happy") {
        if (def.discount > DISCOUNT_CAP) throw new Error("Happy Hour discount");
        if (!(def.duration <= 20000 && def.duration > 0)) throw new Error("Happy Hour length");
        if (!(def.cooldown >= def.duration * 4)) throw new Error("Happy Hour cooldown is too short");
      }
      if (def.kind === "global-cps" && !(def.unlockTotal >= 25)) throw new Error(def.id + " unlocks too early");
      if (def.kind === "cps" && def.bonus >= 0.25 && !(def.unlockCount >= 10)) {
        throw new Error(def.id + " unlocks too early");
      }
    });
  }

  root.CorgiAdvancements = { create: create, plural: plural };
})(typeof globalThis !== "undefined" ? globalThis : this);
