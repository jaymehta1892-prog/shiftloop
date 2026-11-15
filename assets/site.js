/* Shiftloop site: the moving parts. Every page works without this file; it adds the calendar,
   the feature demos at the top of the home page, the reveal-on-scroll and the price switch. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("js");

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function money(n, decimals) {
    return "$" + n.toLocaleString("en", { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
  }

  /* Numbers that count up to their value. */
  function countUp(el) {
    var target = Number(el.dataset.count), decimals = Number(el.dataset.decimals || 0);
    if (calm) { el.textContent = money(target, decimals); return; }
    var start = null, length = 1300;
    function step(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / length), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = money(target * eased, decimals);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Rise into place when scrolled into view. */
  var revealed = doc.querySelectorAll("[data-reveal]");
  function show(el) {
    el.classList.add("in");
    each(el.querySelectorAll("[data-count]"), countUp);
  }
  if ("IntersectionObserver" in window && !calm) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); seen.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    each(revealed, function (el) { seen.observe(el); });
  } else {
    each(revealed, show);
  }

  /* A soft shadow under the top bar once the page has moved. */
  var bar = doc.querySelector(".top");
  if (bar) {
    var onScroll = function () { bar.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Calendar ----------
     A month filled from a repeating cycle (D day, N night, L 24 hours, O off). Each day is a
     button that steps through the kinds of shift, so the totals follow what the visitor taps. */
  var NAMES = { D: "day shift", N: "night shift", L: "24-hour shift", "": "off" };
  var LETTER = { D: "D", N: "N", L: "24", "": "" };
  function dayNumber(date) { return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000); }
  function iso(date) {
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return date.getFullYear() + "-" + two(date.getMonth() + 1) + "-" + two(date.getDate());
  }

  function calendar(box) {
    var grid = box.querySelector(".days");
    if (!grid) return null;
    var today = new Date();
    var view = { y: today.getFullYear(), m: today.getMonth() };
    var picks = box.querySelectorAll(".picks button");
    var startField = box.querySelector("[data-cal-start]");
    var rateField = box.querySelector("[data-cal-rate]");
    var hoursField = box.querySelector("[data-cal-hours]");
    var state = { cycle: box.dataset.cycle || "DDDDOOOO", hours: Number(box.dataset.hours || 12), rate: Number(box.dataset.rate || 30),
                  anchor: null, pinned: false, edits: {} };
    var cells = [];

    /* Cycles that are whole weeks long are drawn the usual way round, starting on a Monday. */
    function defaultAnchor(cycle) {
      var first = new Date(today.getFullYear(), today.getMonth(), 1);
      if (cycle.length % 7 === 0) first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
      return first;
    }
    function kindOn(date) {
      var key = iso(date);
      if (key in state.edits) return state.edits[key];
      var len = state.cycle.length;
      var at = ((dayNumber(date) - dayNumber(state.anchor)) % len + len) % len;
      var ch = state.cycle.charAt(at);
      return ch === "O" ? "" : ch;
    }
    function hoursOf(kind) { return kind === "L" ? 24 : kind ? state.hours : 0; }
    function paint(cell) {
      var kind = kindOn(cell.date);
      cell.dataset.s = kind;
      cell.lastChild.textContent = LETTER[kind];
      cell.setAttribute("aria-label", cell.date.toLocaleDateString("en", { day: "numeric", month: "long" }) + ", " + NAMES[kind]);
    }
    function totals() {
      var shifts = 0, hours = 0;
      cells.forEach(function (cell) { var k = cell.dataset.s; if (k) { shifts += 1; hours += hoursOf(k); } });
      each(box.querySelectorAll("[data-t]"), function (el) {
        el.textContent = el.dataset.t === "shifts" ? shifts : el.dataset.t === "hours" ? hours : money(hours * state.rate);
      });
    }
    function render(stagger) {
      var count = new Date(view.y, view.m + 1, 0).getDate();
      var lead = new Date(view.y, view.m, 1).getDay();
      grid.textContent = "";
      cells = [];
      for (var i = 0; i < lead; i++) grid.appendChild(doc.createElement("i"));
      for (var d = 1; d <= count; d++) {
        var cell = doc.createElement("button");
        cell.type = "button";
        cell.date = new Date(view.y, view.m, d);
        if (iso(cell.date) === iso(today)) cell.className = "today";
        cell.appendChild(doc.createTextNode(d));
        cell.appendChild(doc.createElement("b"));
        grid.appendChild(cell);
        cells.push(cell);
      }
      repaint(stagger);
      var label = new Date(view.y, view.m, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
      each(box.querySelectorAll("[data-cal-month]"), function (el) { el.textContent = label; });
    }
    /* Colour the days in, one after another when a new rotation is chosen. */
    function repaint(stagger) {
      cells.forEach(function (cell, i) {
        cell.style.setProperty("--d", stagger && !calm ? i * 14 + "ms" : "0ms");
        paint(cell);
      });
      totals();
      if (stagger && !calm) setTimeout(function () { cells.forEach(function (c) { c.style.setProperty("--d", "0ms"); }); }, 900);
    }
    function setCycle(cycle, hours) {
      state.cycle = cycle;
      state.hours = hours;
      state.edits = {};
      if (!state.pinned) state.anchor = defaultAnchor(cycle);
      if (startField && !state.pinned) startField.value = iso(state.anchor);
      if (hoursField) hoursField.value = hours;
      repaint(true);
    }

    grid.addEventListener("click", function (event) {
      var cell = event.target.closest("button");
      if (!cell) return;
      var order = state.cycle.indexOf("L") >= 0 ? ["", "L"] : ["", "D", "N"];
      var next = order[(order.indexOf(cell.dataset.s) + 1) % order.length];
      state.edits[iso(cell.date)] = next;
      paint(cell);
      totals();
      box.dispatchEvent(new CustomEvent("cal:touch", { bubbles: true }));
    });
    each(picks, function (button) {
      button.addEventListener("click", function () {
        each(picks, function (b) { b.setAttribute("aria-pressed", String(b === button)); });
        setCycle(button.dataset.cycle, Number(button.dataset.hours || state.hours));
        box.dispatchEvent(new CustomEvent("cal:touch", { bubbles: true }));
      });
    });
    each(box.querySelectorAll("[data-cal-prev], [data-cal-next]"), function (button) {
      button.addEventListener("click", function () {
        var moved = new Date(view.y, view.m + (button.hasAttribute("data-cal-next") ? 1 : -1), 1);
        view = { y: moved.getFullYear(), m: moved.getMonth() };
        render(false);
      });
    });
    if (startField) startField.addEventListener("change", function () {
      var parts = startField.value.split("-");
      if (parts.length !== 3) return;
      state.anchor = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      state.pinned = true;
      state.edits = {};
      repaint(true);
    });
    if (rateField) rateField.addEventListener("input", function () { state.rate = Math.max(0, Number(rateField.value) || 0); totals(); });
    if (hoursField) hoursField.addEventListener("input", function () {
      state.hours = Math.min(24, Math.max(1, Number(hoursField.value) || 0));
      totals();
    });

    state.anchor = defaultAnchor(state.cycle);
    if (startField) startField.value = iso(state.anchor);
    render(true);
    return { setCycle: setCycle, picks: picks };
  }
  each(doc.querySelectorAll("[data-cal]"), calendar);

  /* ---------- The stage at the top of the home page ----------
     Four key features, each a tab with its own small demo. It moves on by itself until the
     visitor touches it, and waits while it is off screen or under the pointer. */
  var stage = doc.querySelector("[data-stage]");
  if (stage) {
    var tabs = stage.querySelectorAll('[role="tab"]');
    var scenes = [];
    var current = 0, ticking = null;
    each(tabs, function (tab) { scenes.push(doc.getElementById(tab.getAttribute("aria-controls"))); });

    var play = function (scene) {
      scene.classList.remove("play");
      void scene.offsetWidth;
      scene.classList.add("play");
      each(scene.querySelectorAll("[data-count]"), countUp);
      clearInterval(ticking);
      var clock = scene.querySelector("[data-countdown]");
      if (clock) {
        var left = 59 * 60 + 59;
        var draw = function () {
          var m = Math.floor(left / 60), s = left % 60;
          clock.textContent = m + ":" + (s < 10 ? "0" : "") + s;
        };
        draw();
        if (!calm) ticking = setInterval(function () { left = left > 0 ? left - 1 : 3599; draw(); }, 1000);
      }
    };
    var select = function (index) {
      current = index;
      each(tabs, function (tab, i) {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        scenes[i].hidden = i !== index;
      });
      play(scenes[index]);
    };
    var stop = function () { stage.classList.remove("auto"); };

    each(tabs, function (tab, i) {
      tab.addEventListener("click", function () { stop(); select(i); });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        var to = (i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        stop(); select(to); tabs[to].focus();
      });
    });
    stage.addEventListener("cal:touch", stop);
    stage.addEventListener("animationend", function (event) {
      if (event.animationName === "fill" && stage.classList.contains("auto")) select((current + 1) % tabs.length);
    });
    stage.addEventListener("pointerenter", function () { stage.classList.add("hold"); });
    stage.addEventListener("pointerleave", function () { stage.classList.remove("hold"); });
    stage.addEventListener("focusin", function () { stage.classList.add("hold"); });
    stage.addEventListener("focusout", function () { stage.classList.remove("hold"); });

    /* Every scene takes the height of the tallest, so the page below doesn't jump as they change. */
    var fit = function () {
      var tallest = 0;
      stage.style.removeProperty("--scene-h");
      scenes.forEach(function (scene) {
        var was = scene.hidden;
        scene.hidden = false;
        scene.style.minHeight = "0";
        tallest = Math.max(tallest, scene.getBoundingClientRect().height);
        scene.style.minHeight = "";
        scene.hidden = was;
      });
      if (tallest) stage.style.setProperty("--scene-h", Math.ceil(tallest) + "px");
    };
    var refit = null;
    window.addEventListener("resize", function () { clearTimeout(refit); refit = setTimeout(fit, 150); });

    var day = stage.querySelector("[data-today]");
    if (day) day.textContent = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });

    select(0);
    fit();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    if (!calm && "IntersectionObserver" in window) {
      stage.classList.add("auto");
      new IntersectionObserver(function (entries) {
        stage.classList.toggle("away", !entries[0].isIntersecting);
        stage.classList.toggle("hold", !entries[0].isIntersecting);
      }, { threshold: 0.35 }).observe(stage);
    }
  }

  /* ---------- Pro prices for the visitor's country ----------
     Every App Store country's price is on the page (scripts/site/prices.json). The country is
     guessed from settings the browser already has, its region and its time zone, so nothing is
     looked up or sent anywhere. The menu lets anyone change it. */
  var priceData = doc.getElementById("prices-data");
  var menu = doc.getElementById("price-country");
  if (priceData && menu) {
    var prices = JSON.parse(priceData.textContent);
    var names = null;
    try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (error) { names = null; }
    var nameOf = function (code) {
      var name = null;
      try { name = names && names.of(code); } catch (error) { name = null; }
      return name && name !== code ? name : code;
    };
    /* Time zones of the countries most visitors come from. A device sets its time zone by itself,
       so it says where someone is more reliably than the language they picked. */
    var ZONES = {
      "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US",
      "America/Anchorage": "US", "America/Detroit": "US", "Pacific/Honolulu": "US",
      "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
      "America/St_Johns": "CA", "America/Regina": "CA", "America/Montreal": "CA", "America/Moncton": "CA",
      "Europe/London": "GB", "Europe/Dublin": "IE", "Pacific/Auckland": "NZ", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
      "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Singapore": "SG", "Asia/Manila": "PH",
      "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Karachi": "PK", "Asia/Dhaka": "BD",
      "Asia/Colombo": "LK", "Asia/Jakarta": "ID", "Asia/Bangkok": "TH", "Asia/Kuala_Lumpur": "MY", "Asia/Ho_Chi_Minh": "VN",
      "Asia/Saigon": "VN", "Asia/Taipei": "TW", "Asia/Jerusalem": "IL", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES",
      "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Lisbon": "PT", "Europe/Warsaw": "PL",
      "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Zurich": "CH",
      "Europe/Vienna": "AT", "Europe/Prague": "CZ", "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Europe/Athens": "GR",
      "Europe/Istanbul": "TR", "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
      "Africa/Nairobi": "KE", "Africa/Cairo": "EG", "Africa/Accra": "GH", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
      "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO", "America/Santiago": "CL", "America/Lima": "PE"
    };
    var guess = function () {
      var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en-US"];
      var fromLanguage = null, zone = "";
      for (var i = 0; i < langs.length && !fromLanguage; i++) {
        var parts = String(langs[i]).split("-");
        var region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
        if (region.length === 2 && prices[region]) fromLanguage = region;
      }
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (error) { zone = ""; }
      var fromZone = ZONES[zone] || (zone.indexOf("Australia/") === 0 ? "AU" : null);
      /* The time zone decides where it is one we know; otherwise the region in the language setting. */
      if (fromZone && prices[fromZone]) return fromZone;
      if (fromLanguage) return fromLanguage;
      try {
        var likely = new Intl.Locale(langs[0]).maximize().region;
        if (likely && prices[likely]) return likely;
      } catch (error) { /* older browsers */ }
      return "US";
    };
    var rest = " Tax may be added at checkout in some countries. Subscriptions renew automatically until cancelled, and you can cancel any time in your Apple Account settings.";
    var tags = doc.querySelector(".tags");
    /* Three across when the prices fit; a row each when one of them is too wide for its box. */
    var fitPrices = function () {
      if (!tags) return;
      tags.classList.remove("long");
      var tight = false;
      each(tags.querySelectorAll("b"), function (b) { if (b.scrollWidth > b.clientWidth + 1) tight = true; });
      tags.classList.toggle("long", tight);
    };
    var refitPrices = null;
    window.addEventListener("resize", function () { clearTimeout(refitPrices); refitPrices = setTimeout(fitPrices, 150); });
    var showCountry = function (code) {
      var row = prices[code] || prices.US;
      each(doc.querySelectorAll("[data-plan]"), function (el) {
        el.textContent = row[{ yearly: 0, monthly: 1, lifetime: 2 }[el.dataset.plan]];
      });
      fitPrices();
      doc.getElementById("price-note").textContent = "Prices as shown on the App Store in " + nameOf(code) + "." + rest;
    };
    var list = Object.keys(prices).map(function (code) { return { code: code, name: nameOf(code) }; });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    menu.textContent = "";
    list.forEach(function (item) {
      var option = doc.createElement("option");
      option.value = item.code;
      option.textContent = item.name;
      menu.appendChild(option);
    });
    var chosen = guess();
    menu.value = chosen;
    showCountry(chosen);
    menu.addEventListener("change", function () { showCountry(menu.value); });
  }
})();
