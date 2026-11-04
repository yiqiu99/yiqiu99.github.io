/**
 * Visitor beacon + Visitors page for yiqiu99.github.io.
 * Backend: visitor-worker/ (Cloudflare Worker + D1). Endpoint comes from
 * theme _config.yml -> visitor_stats.endpoint (exposed as window.VISITOR_ENDPOINT).
 */
(function () {
  "use strict";

  var ENDPOINT = (window.VISITOR_ENDPOINT || "").replace(/\/+$/, "");
  var OPTOUT_KEY = "visitor-optout";
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

  function isStatsPage(path) {
    return /^\/Visitors\/?$/i.test(path);
  }

  function shouldCount(path) {
    if (!ENDPOINT || isStatsPage(path)) return false;
    if (localStorage.getItem(OPTOUT_KEY) === "1") return false;
    // Previews on localhost only count when pointed at a local worker (for testing)
    if (LOCAL.test(location.hostname) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(ENDPOINT)) return false;
    return true;
  }

  function pageTitle() {
    var h = document.querySelector(".page-title");
    return (h && h.textContent.trim()) || document.title;
  }

  function beacon(ref) {
    var path = location.pathname;
    if (!shouldCount(path)) return;
    var url = ENDPOINT + "/hit?page=" + encodeURIComponent(path.slice(0, 200)) +
      "&title=" + encodeURIComponent(pageTitle().slice(0, 120));
    if (ref) url += "&ref=" + encodeURIComponent(ref.slice(0, 500));
    fetch(url, { method: "POST", keepalive: true }).catch(function () {});
  }

  // ---------- Visitors page ----------

  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
  function countryName(code) {
    try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
  }
  function flag(code) {
    if (!code || code.length !== 2) return "";
    return String.fromCodePoint.apply(null, code.toUpperCase().split("").map(function (c) {
      return 0x1f1e6 + c.charCodeAt(0) - 65;
    }));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return (n || 0).toLocaleString("en-US"); }
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var land = null;
  function loadLand() {
    if (land) return Promise.resolve(land);
    return loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js")
      .then(function () { return fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"); })
      .then(function (r) { return r.json(); })
      .then(function (topo) { land = window.topojson.feature(topo, topo.objects.land); return land; });
  }

  // Equirectangular projection, cropped to inhabited latitudes
  var LAT_TOP = 84, LAT_BOTTOM = -58;
  function project(lon, lat, w, h) {
    return [(lon + 180) / 360 * w, (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM) * h];
  }

  function drawMap(canvas, cities) {
    var w = canvas.parentNode.clientWidth;
    var h = Math.round(w * (LAT_TOP - LAT_BOTTOM) / 360);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (land) {
      ctx.fillStyle = isDark() ? "#2b3036" : "#e3e6e8";
      ctx.beginPath();
      land.features.forEach(function (f) {
        var polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        polys.forEach(function (poly) {
          poly.forEach(function (ring) {
            // Skip Antarctica (outside the cropped latitudes)
            if (ring.every(function (pt) { return pt[1] < LAT_BOTTOM; })) return;
            var prevLon = null;
            ring.forEach(function (pt, i) {
              var p = project(pt[0], pt[1], w, h);
              // Rings that cross the antimeridian would draw a line across the whole map
              if (i === 0 || Math.abs(pt[0] - prevLon) > 180) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
              prevLon = pt[0];
            });
            ctx.closePath();
          });
        });
      });
      ctx.fill();
    }

    var max = cities.reduce(function (m, c) { return Math.max(m, c.n); }, 1);
    cities.slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (c) {
      var p = project(c.lon, c.lat, w, h);
      var r = 2.5 + 7 * Math.sqrt(c.n / max);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
      ctx.fillStyle = isDark() ? "rgba(138,180,248,0.55)" : "rgba(19,83,215,0.45)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark() ? "#8ab4f8" : "#1353d7";
      ctx.stroke();
      c._x = p[0]; c._y = p[1]; c._r = r;
    });
  }

  function table(title, rows, cols) {
    if (!rows.length) return "";
    return '<div class="vs-table"><h3>' + title + "</h3><table>" + rows.map(function (r) {
      return "<tr>" + cols.map(function (c) { return "<td>" + c(r) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</table></div>";
  }

  function bars(days) {
    var map = {}; days.forEach(function (d) { map[d.day] = d.n; });
    var out = [], max = 1;
    for (var i = 59; i >= 0; i--) {
      var k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ day: k, n: map[k] || 0 }); max = Math.max(max, map[k] || 0);
    }
    return '<div class="vs-bars">' + out.map(function (d) {
      return '<span title="' + d.day + ": " + d.n + '" style="height:' + Math.max(2, 100 * d.n / max) + '%"></span>';
    }).join("") + "</div>";
  }

  function render(root, data) {
    var t = data.totals || {};
    var cards = [["page views", t.views], ["countries", t.countries], ["cities", t.cities],
                 ["today", t.today], ["last 7 days", t.last7], ["last 30 days", t.last30]];
    root.innerHTML =
      '<div class="vs-cards">' + cards.map(function (c) {
        return '<div class="vs-card"><b>' + fmt(c[1]) + "</b><span>" + c[0] + "</span></div>";
      }).join("") + "</div>" +
      (t.since ? '<p class="vs-note">Counting since ' + esc(t.since) + ". Times are UTC.</p>" : "") +
      '<h3>Where visitors come from</h3><div class="vs-map"><canvas></canvas><div class="vs-tip" hidden></div></div>' +
      '<p class="vs-note">One dot per city, sized by number of views. Hover a dot for details.</p>' +
      "<h3>Last 60 days</h3>" + bars(data.days || []) +
      '<div class="vs-grid">' +
      table("Countries", data.countries || [], [
        function (r) { return flag(r.country) + " " + esc(countryName(r.country)); },
        function (r) { return fmt(r.n); }]) +
      table("Cities", (data.cities || []).slice(0, 20), [
        function (r) { return esc(r.city) + ", " + esc(r.country); },
        function (r) { return fmt(r.n); }]) +
      table("Pages", data.pages || [], [
        function (r) { return '<a href="' + esc(r.page) + '">' + esc(r.title || decodeURIComponent(r.page)) + "</a>"; },
        function (r) { return fmt(r.n); }]) +
      table("Referrers", data.referrers || [], [
        function (r) { return esc(r.ref_host); },
        function (r) { return fmt(r.n); }]) +
      "</div>" +
      '<p class="vs-note">Only the page, the referring site, and an approximate city and country are recorded. No IP addresses or personal data are stored. ' +
      '<button type="button" class="vs-optout"></button></p>';

    var canvas = root.querySelector(".vs-map canvas");
    var tip = root.querySelector(".vs-tip");
    var cities = data.cities || [];
    var redraw = function () { drawMap(canvas, cities); };
    redraw();
    loadLand().then(redraw).catch(function () {});
    window.addEventListener("resize", redraw);
    // Redraw on any theme change (toggle or browser setting)
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      var hit = cities.find(function (c) { return Math.hypot(c._x - x, c._y - y) <= c._r + 2; });
      if (!hit) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = hit.city + ", " + countryName(hit.country) + " — " + fmt(hit.n) + (hit.n === 1 ? " view" : " views");
      tip.style.left = x + 12 + "px"; tip.style.top = y + 12 + "px";
    });
    canvas.addEventListener("mouseleave", function () { tip.hidden = true; });

    var optout = root.querySelector(".vs-optout");
    var label = function () {
      optout.textContent = localStorage.getItem(OPTOUT_KEY) === "1"
        ? "Your visits from this browser are not counted (click to count them)."
        : "Don't count my visits from this browser.";
    };
    label();
    optout.addEventListener("click", function () {
      if (localStorage.getItem(OPTOUT_KEY) === "1") localStorage.removeItem(OPTOUT_KEY);
      else localStorage.setItem(OPTOUT_KEY, "1");
      label();
    });
  }

  function initStatsPage() {
    var root = document.getElementById("visitor-stats");
    if (!root || root.dataset.loaded) return;
    root.dataset.loaded = "1";
    if (!ENDPOINT) {
      root.innerHTML = '<p class="vs-note">Visitor statistics are not set up yet.</p>';
      return;
    }
    root.innerHTML = '<p class="vs-note">Loading visitor statistics…</p>';
    fetch(ENDPOINT + "/stats")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { render(root, data); })
      .catch(function () { root.innerHTML = '<p class="vs-note">Visitor statistics are unavailable right now.</p>'; });
  }

  beacon(document.referrer);
  initStatsPage();

  // The theme navigates with pjax, so count and render again after each swap
  if (window.jQuery) {
    window.jQuery(document).on("pjax:end", function () {
      beacon(null);
      initStatsPage();
    });
  }
})();
