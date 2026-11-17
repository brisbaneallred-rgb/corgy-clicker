(function (root) {
  "use strict";

  var RATE = 1.15;
  var SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];

  function costOf(baseCost, owned, qty) {
    if (qty <= 0) return 0;
    var start = baseCost * Math.pow(RATE, owned);
    if (qty === 1) return start;
    return (start * (Math.pow(RATE, qty) - 1)) / (RATE - 1);
  }

  function maxBuy(baseCost, owned, money) {
    var start = baseCost * Math.pow(RATE, owned);
    if (!(money + 1e-6 >= start)) return 0;
    var raw = Math.log(1 + (money * (RATE - 1)) / start) / Math.log(RATE);
    var n = Math.max(0, Math.floor(raw + 1e-9));
    while (n > 0 && costOf(baseCost, owned, n) > money + 1e-6) n -= 1;
    while (costOf(baseCost, owned, n + 1) <= money + 1e-6) n += 1;
    return n;
  }

  function formatAmount(n) {
    if (!Number.isFinite(n)) return "0";
    var neg = n < 0;
    n = Math.abs(n);
    var body;
    if (n < 1000) {
      if (n < 100) {
        body = String(Math.round(n * 10) / 10);
      } else {
        body = Math.floor(n).toLocaleString("en-US");
      }
    } else {
      var tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
      var scaled = n / Math.pow(1000, tier);
      var digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      body = trimZeros(scaled.toFixed(digits)) + SUFFIX[tier];
    }
    return neg ? "-" + body : body;
  }

  function trimZeros(s) {
    if (s.indexOf(".") === -1) return s;
    return s.replace(/\.?0+$/, "");
  }

  root.CorgiEconomy = {
    RATE: RATE,
    costOf: costOf,
    maxBuy: maxBuy,
    formatAmount: formatAmount,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
