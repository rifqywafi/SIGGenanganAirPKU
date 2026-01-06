let map;
let floodLayer;
let floodData;
let osmLayer, satelliteLayer;
let kecamatanLayer;
let kecamatanData;
let waterwayLayer;
let waterwayData;

const KECAMATAN = ["Sukajadi", "Sail", "Lima Puluh", "Pekanbaru Kota"];
const KECAMATAN_COLORS = {
  Sukajadi: "#4848b4ff",
  Sail: "#416c93ff",
  "Lima Puluh": "#6dc1b3ff",
  "Pekanbaru Kota": "#c088ebff",
};
const PEKANBARU_BBOX = {
  minLat: 0.45,
  maxLat: 0.62,
  minLng: 101.35,
  maxLng: 101.55,
};
const API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmJreHNvdXVsYWhmbWdkaHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4ODkzOTEsImV4cCI6MjA4MTQ2NTM5MX0.F26b2HaXUScZ2oBdsKtk7Xryi4gyDKPjYyp6VejTm-0";
const SUPABASE_URL = "https://izvbkxsouulahfmgdhzf.supabase.co";
// ===============================
// NAVIGASI PAGE
// ===============================
function showMap() {
  document.getElementById("homePage").classList.add("page-hidden");
  document.getElementById("homePage").classList.remove("page-active");

  const mapPage = document.getElementById("mapPage");
  mapPage.classList.remove("page-hidden");
  mapPage.classList.add("page-active");

  setTimeout(() => {
    if (!map) initMap();
    else map.invalidateSize();
  }, 300);
}

function showHome() {
  document.getElementById("mapPage").classList.add("page-hidden");
  document.getElementById("mapPage").classList.remove("page-active");

  const home = document.getElementById("homePage");
  home.classList.remove("page-hidden");
  home.classList.add("page-active");

  setTimeout(() => {
    loadHomeCharts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 300);
}

function goHome() {
  showHome();
}

function toggleDataPanel() {
  const panel = document.getElementById("dataPanel");
  panel.classList.toggle("show");
}

// ===============================
// TOGGLE LAYERS
// ===============================
function toggleLayer(layerName) {
  if (layerName === "flood") {
    if (map.hasLayer(floodLayer)) {
      map.removeLayer(floodLayer);
    } else {
      map.addLayer(floodLayer);
    }
  } else if (layerName === "kecamatan") {
    if (map.hasLayer(kecamatanLayer)) {
      map.removeLayer(kecamatanLayer);
    } else {
      map.addLayer(kecamatanLayer);
    }
  } else if (layerName === "waterway") {
    if (map.hasLayer(waterwayLayer)) {
      map.removeLayer(waterwayLayer);
    } else {
      map.addLayer(waterwayLayer);
    }
  }
}

function changeBaseMap(mapType) {
  // Remove both layers first
  if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
  if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);

  // Add the selected one
  if (mapType === "osm") {
    osmLayer.addTo(map);
  } else if (mapType === "satellite") {
    satelliteLayer.addTo(map);
  }
}

// ===============================
// FLOOD LAYER FILTERS
// ===============================
function populateFloodFilters(features) {
  const kecamatan = new Set();
  const drainase = new Set();
  const kemiringan = new Set();

  features.forEach((f) => {
    if (f.properties.kecamatan) kecamatan.add(f.properties.kecamatan);
    if (f.properties.kondisi_drainase)
      drainase.add(f.properties.kondisi_drainase);
    if (f.properties.kemiringan_lahan)
      kemiringan.add(f.properties.kemiringan_lahan);
  });

  const kSel = document.getElementById("filterFloodKecamatan");
  const dSel = document.getElementById("filterFloodDrainase");
  const kmSel = document.getElementById("filterFloodKemiringan");

  function fill(sel, items) {
    sel.innerHTML =
      '<option value="">Semua</option>' +
      Array.from(items)
        .sort()
        .map((v) => `<option value="${v}">${v}</option>`)
        .join("");
  }

  fill(kSel, kecamatan);
  fill(dSel, drainase);
  fill(kmSel, kemiringan);
}

function applyFloodFilters() {
  const kecamatan = document.getElementById("filterFloodKecamatan").value;
  const kedalaman = document.getElementById("filterFloodKedalaman").value;
  const drainase = document.getElementById("filterFloodDrainase").value;
  const kemiringan = document.getElementById("filterFloodKemiringan").value;

  let filteredFeatures = floodData.features.slice();

  if (kecamatan) {
    filteredFeatures = filteredFeatures.filter(
      (f) => f.properties.kecamatan === kecamatan
    );
  }

  // Filter by depth range
  if (kedalaman) {
    filteredFeatures = filteredFeatures.filter((f) => {
      const depth = Number(f.properties.kedalaman_cm) || 0;
      if (kedalaman === "1-3") return depth >= 1 && depth <= 3;
      if (kedalaman === "4-6") return depth >= 4 && depth <= 6;
      if (kedalaman === "7-9") return depth >= 7 && depth <= 9;
      if (kedalaman === "10+") return depth >= 10;
      return true;
    });
  }

  if (drainase) {
    filteredFeatures = filteredFeatures.filter(
      (f) => f.properties.kondisi_drainase === drainase
    );
  }

  if (kemiringan) {
    filteredFeatures = filteredFeatures.filter(
      (f) => f.properties.kemiringan_lahan === kemiringan
    );
  }

  renderFloodLayer(filteredFeatures);
  updateStats(filteredFeatures);
}

// ===============================
// INIT MAP
// ===============================
function initMap() {
  map = L.map("map").setView([0.527694, 101.445667], 13);

  osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  );

  map.createPane("kecamatanPane");
  map.getPane("kecamatanPane").style.zIndex = 400;

map.createPane("waterwayPane");
map.getPane("waterwayPane").style.zIndex = 300;

  map.createPane("genanganPane");
  map.getPane("genanganPane").style.zIndex = 650;
  
  loadFloodData();
  loadKecamatanLayer();
  loadWaterwayLayer();
  loadInteractiveData();
}

// ===============================
// MARKER STYLE
// ===============================
function getColor(d) {
  if (d >= 10) return "#dc2626";
  if (d >= 7) return "#f97316";
  if (d >= 4) return "#facc15";
  return "#3b82f6";
}

function getRadius(d) {
  return 6 + (d || 1);
}

async function loadWaterwayLayer() {
  try {
    const res = await fetch("data/sumatra_waterways.json");
    const geojson = await res.json();

    // Filter hanya yang masuk bbox Pekanbaru
    const filtered = {
      type: "FeatureCollection",
      features: geojson.features.filter((f) => {
        if (!f.geometry) return false;

        const coords = f.geometry.coordinates.flat(Infinity);

        for (let i = 0; i < coords.length; i += 2) {
          const lng = coords[i];
          const lat = coords[i + 1];

          if (
            lat >= PEKANBARU_BBOX.minLat &&
            lat <= PEKANBARU_BBOX.maxLat &&
            lng >= PEKANBARU_BBOX.minLng &&
            lng <= PEKANBARU_BBOX.maxLng
          ) {
            return true;
          }
        }
        return false;
      }),
    };

    waterwayData = filtered;
    renderWaterwayLayer(waterwayData);
  } catch (e) {
    console.error("Waterway layer error:", e);
  }
}

function renderWaterwayLayer(geojson) {
  if (waterwayLayer) map.removeLayer(waterwayLayer);

  const baseLine = L.geoJSON(geojson, {
    pane: "waterwayPane",
    style: {
      color: "#2563eb", // biru
      weight: 4,
      opacity: 0.9,
    },
  });

  const dashLine = L.geoJSON(geojson, {
    pane: "waterwayPane",
    style: {
      color: "#ffffff",
      weight: 2,
      dashArray: "6 6",
      opacity: 0.9,
    },
  });

  waterwayLayer = L.layerGroup([baseLine, dashLine]);
  // ⛔ jangan addTo(map)
}

// ===============================
// LOAD KECAMATAN LAYER
// ===============================
async function loadKecamatanLayer() {
  try {
    const res = await fetch("data/wilayah.json");
    const geojson = await res.json();

    kecamatanData = geojson;
    renderKecamatanLayer(kecamatanData);
  } catch (e) {
    console.error("Kecamatan layer error:", e);
  }
}

function renderKecamatanLayer(geojson) {
  kecamatanLayer = L.geoJSON(geojson, {
    pane: "kecamatanPane",

    filter: (feature) => KECAMATAN.includes(feature.properties?.Kecamatan),

    style: (feature) => {
      const kec = feature.properties?.Kecamatan;
      const color = KECAMATAN_COLORS[kec] || "#64748b";

      return {
        color: color,
        weight: 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.25,
      };
    },

    onEachFeature: (feature, layer) => {
      const kelurahan = feature.properties?.Kelurahan || "Kelurahan";
      const kecamatan = feature.properties?.Kecamatan || "";
      layer.bindTooltip(`<b>${kelurahan}</b><br><small>${kecamatan}</small>`, {
        sticky: true,
        direction: "center",
      });

      layer.on({
        mouseover: (e) => {
          const kec = feature.properties?.Kecamatan;
          const c = KECAMATAN_COLORS[kec] || "#64748b";
          e.target.setStyle({ fillOpacity: 0.45, weight: 3, color: c });
        },
        mouseout: (e) => {
          const kec = feature.properties?.Kecamatan;
          const c = KECAMATAN_COLORS[kec] || "#64748b";
          e.target.setStyle({ fillOpacity: 0.25, weight: 2, color: c });
        },
      });
    },
  });
}

// ===============================
// LOAD MAP DATA
// ===============================
async function loadFloodData() {
  try {
    const res = await axios.get(
      SUPABASE_URL + "/rest/v1/genangan_air_geojson",
      {
        headers: {
          apikey: API_KEY,
          Authorization: API_KEY,
        },
        params: { select: "geojson" },
      }
    );

    floodData = res.data[0].geojson;
    renderFloodLayer(floodData.features);
    updateStats(floodData.features);
    populateFloodFilters(floodData.features);
  } catch (e) {
    console.error(e);
  }
}

function renderFloodLayer(features) {
  if (floodLayer) map.removeLayer(floodLayer);

  floodLayer = L.geoJSON(features, {
    pane: "genanganPane",
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: getRadius(f.properties.kedalaman_cm),
        fillColor: getColor(f.properties.kedalaman_cm),
        color: "#111",
        weight: 1,
        fillOpacity: 0.85,
      }),

    onEachFeature: (f, layer) => {
      const p = f.properties;

      layer.bindTooltip(
        `<b>${p.kecamatan}</b><br>Kedalaman: ${p.kedalaman_cm} cm`,
        { sticky: true }
      );

      layer.bindPopup(`
        <div style="font-size: 13px; min-width: 250px;">
          <b style="color: #647FBC; display: block; margin-bottom: 8px;">${
            p.kecamatan || "-"
          }</b>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kedalaman</td><td style="padding: 6px;">${
              p.kedalaman_cm || "-"
            } cm</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Lama Genangan</td><td style="padding: 6px;">${
              p.lama_genangan || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Jenis Permukaan</td><td style="padding: 6px;">${
              p.jenis_permukaan || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kondisi Drainase</td><td style="padding: 6px;">${
              p.kondisi_drainase || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kemiringan Lahan</td><td style="padding: 6px;">${
              p.kemiringan_lahan || "-"
            }</td></tr>
            <tr><td style="padding: 6px; font-weight: 500;">Surveyor</td><td style="padding: 6px;">${
              p.surveyor || "-"
            }</td></tr>
          </table>
        </div>
      `);
    },
  }).addTo(map);
}

// ===============================
// STATISTIK
// ===============================
function updateStats(features) {
  const valid = features.filter((f) => f.properties.kedalaman_cm != null);
  const total = valid.length;
  const avg = total
    ? valid.reduce((s, f) => s + f.properties.kedalaman_cm, 0) / total
    : 0;

  document.getElementById("totalPoints").innerText = total;
  document.getElementById("avgDepth").innerText = avg.toFixed(1) + " cm";
}

// ===============================
// HOME CHART
// ===============================
let depthChart = null;
let kecamatanChart = null;

async function loadHomeData() {
  try {
    const res = await axios.get(SUPABASE_URL + "/rest/v1/genangan_air", {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
      params: {
        select: "kedalaman_cm,kecamatan",
      },
    });

    const data = res.data;

    /* =========================
       TOTAL TITIK
    ========================= */
    document.getElementById("homeTotal").innerText = data.length;

    /* =========================
       RATA-RATA KEDALAMAN
    ========================= */
    const validDepth = data.filter((d) => d.kedalaman_cm != null);

    const avg =
      validDepth.length > 0
        ? validDepth.reduce((sum, d) => sum + Number(d.kedalaman_cm), 0) /
          validDepth.length
        : 0;

    document.getElementById("homeAvg").innerText = avg.toFixed(1) + " cm";

    /* =========================
       JUMLAH KECAMATAN UNIK
    ========================= */
    const kecamatanSet = new Set(
      data.map((d) => d.kecamatan).filter((k) => k && k !== "")
    );

    document.getElementById("homeKecamatan").innerText = kecamatanSet.size;
  } catch (e) {
    console.error("Home data error:", e);
  }
}

function drawDepthChart(data) {
  if (depthChart) depthChart.destroy();

  const bucket = { "1–3": 0, "4–6": 0, "7–9": 0, "≥10": 0 };
  data.forEach((d) => {
    if (d.kedalaman_cm >= 10) bucket["≥10"]++;
    else if (d.kedalaman_cm >= 7) bucket["7–9"]++;
    else if (d.kedalaman_cm >= 4) bucket["4–6"]++;
    else if (d.kedalaman_cm >= 1) bucket["1–3"]++;
  });

  depthChart = new Chart(document.getElementById("depthChart"), {
    type: "bar",
    data: {
      labels: Object.keys(bucket),
      datasets: [
        {
          data: Object.values(bucket),
          backgroundColor: ["#3b82f6", "#facc15", "#f97316", "#dc2626"],
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function drawKecamatanChart(data) {
  if (kecamatanChart) kecamatanChart.destroy();

  const count = {};
  data.forEach((d) => {
    if (d.kecamatan) count[d.kecamatan] = (count[d.kecamatan] || 0) + 1;
  });

  kecamatanChart = new Chart(document.getElementById("kecamatanChart"), {
    type: "pie",
    data: {
      labels: Object.keys(count),
      datasets: [
        {
          data: Object.values(count),
          backgroundColor: [
            "#2563eb",
            "#16a34a",
            "#f97316",
            "#dc2626",
            "#9333ea",
            "#0ea5e9",
          ],
        },
      ],
    },
    options: { responsive: true },
  });
}

// ===============================
// INTERACTIVE DATA PANEL
// ===============================
let interactiveData = [];
let interactiveChart = null;
let interactiveLayer = null;
let activeChart = "depthChart"; // track which accordion is open

function toggleChart(chartName) {
  const items = document.querySelectorAll(".accordion-item");
  items.forEach((item) => item.classList.remove("active"));

  if (activeChart === chartName) {
    activeChart = null;
  } else {
    activeChart = chartName;
    // find and activate the matching accordion item by checking onclick attribute
    const btns = document.querySelectorAll(".accordion-btn");
    btns.forEach((btn) => {
      const onclick = btn.getAttribute("onclick");
      if (onclick && onclick.includes(`toggleChart('${chartName}')`)) {
        btn.closest(".accordion-item").classList.add("active");
      }
    });
  }
}

async function loadInteractiveData() {
  try {
    const res = await axios.get(SUPABASE_URL + "/rest/v1/genangan_air", {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
      params: { select: "*" },
    });

    interactiveData = res.data || [];
    populateFilters(interactiveData);
    applyFilters();
    updateAllCharts(interactiveData);
  } catch (e) {
    console.error("Interactive load error:", e);
  }
}

function populateFilters(data) {
  const kec = new Set();
  const surv = new Set();
  const jenis = new Set();
  const drainase = new Set();
  const kemiringan = new Set();

  data.forEach((d) => {
    if (d.kecamatan) kec.add(d.kecamatan);
    if (d.surveyor) surv.add(d.surveyor);
    if (d.jenis_permukaan) jenis.add(d.jenis_permukaan);
    if (d.kondisi_drainase) drainase.add(d.kondisi_drainase);
    if (d.kemiringan_lahan) kemiringan.add(d.kemiringan_lahan);
  });

  const kSel = document.getElementById("filterKecamatan");
  const sSel = document.getElementById("filterSurveyor");
  const jSel = document.getElementById("filterPermukaan");
  const dSel = document.getElementById("filterDrainase");
  const kmSel = document.getElementById("filterKemiringan");

  function fill(sel, items) {
    sel.innerHTML =
      '<option value="">Semua</option>' +
      Array.from(items)
        .sort()
        .map((v) => `<option value="${v}">${v}</option>`)
        .join("");
  }

  fill(kSel, kec);
  fill(sSel, surv);
  fill(jSel, jenis);
  fill(dSel, drainase);
  fill(kmSel, kemiringan);

  // Add kedalaman range filter
  const depthSel = document.getElementById("filterKedalaman");
  depthSel.innerHTML = `
    <option value="">Semua</option>
    <option value="1-3">1-3 cm</option>
    <option value="4-6">4-6 cm</option>
    <option value="7-9">7-9 cm</option>
    <option value="10+">≥10 cm</option>
  `;

  kSel.addEventListener("change", applyFilters);
  sSel.addEventListener("change", applyFilters);
  jSel.addEventListener("change", applyFilters);
  depthSel.addEventListener("change", applyFilters);
  dSel.addEventListener("change", applyFilters);
  kmSel.addEventListener("change", applyFilters);
}

function applyFilters() {
  const k = document.getElementById("filterKecamatan").value;
  const s = document.getElementById("filterSurveyor").value;
  const j = document.getElementById("filterPermukaan").value;
  const d = document.getElementById("filterKedalaman").value;
  const dr = document.getElementById("filterDrainase").value;
  const km = document.getElementById("filterKemiringan").value;

  let filtered = interactiveData.slice();
  if (k) filtered = filtered.filter((item) => item.kecamatan === k);
  if (s) filtered = filtered.filter((item) => item.surveyor === s);
  if (j) filtered = filtered.filter((item) => item.jenis_permukaan === j);
  if (dr) filtered = filtered.filter((item) => item.kondisi_drainase === dr);
  if (km) filtered = filtered.filter((item) => item.kemiringan_lahan === km);

  // Filter by depth range
  if (d) {
    filtered = filtered.filter((item) => {
      const depth = Number(item.kedalaman_cm) || 0;
      if (d === "1-3") return depth >= 1 && depth <= 3;
      if (d === "4-6") return depth >= 4 && depth <= 6;
      if (d === "7-9") return depth >= 7 && depth <= 9;
      if (d === "10+") return depth >= 10;
      return true;
    });
  }

  updateInteractiveLayer(filtered);
  updateAllCharts(filtered);
}

function updateInteractiveLayer(data) {
  if (!map) return;
  if (interactiveLayer) interactiveLayer.remove();

  const markers = L.layerGroup();

  data.forEach((d) => {
    let lat = null,
      lng = null;
    if (d.koordinat && Array.isArray(d.koordinat)) {
      if (d.koordinat.length >= 2) {
        lat = Number(d.koordinat[1]);
        lng = Number(d.koordinat[0]);
      }
    }
    if (!lat && d.lat) lat = Number(d.lat);
    if (!lng && d.lon) lng = Number(d.lon);
    if (!lat && d.latitude) lat = Number(d.latitude);
    if (!lng && d.longitude) lng = Number(d.longitude);

    if (lat && lng) {
      const km = Number(d.kedalaman_cm) || 0;
      const m = L.circleMarker([lat, lng], {
        radius: getRadius(km),
        fillColor: getColor(km),
        color: "#111",
        weight: 1,
        fillOpacity: 0.85,
      }).bindTooltip(
        `<b>${d.kecamatan || ""}</b><br>Kedalaman: ${d.kedalaman_cm || ""} cm`
      );

      m.bindPopup(`
        <div style="font-size: 13px; min-width: 250px;">
          <b style="color: #647FBC; display: block; margin-bottom: 8px;">${
            d.kecamatan || "-"
          }</b>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kedalaman</td><td style="padding: 6px;">${
              d.kedalaman_cm || "-"
            } cm</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Lama Genangan</td><td style="padding: 6px;">${
              d.lama_genangan || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Jenis Permukaan</td><td style="padding: 6px;">${
              d.jenis_permukaan || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kondisi Drainase</td><td style="padding: 6px;">${
              d.kondisi_drainase || "-"
            }</td></tr>
            <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 6px; font-weight: 500;">Kemiringan Lahan</td><td style="padding: 6px;">${
              d.kemiringan_lahan || "-"
            }</td></tr>
            <tr><td style="padding: 6px; font-weight: 500;">Surveyor</td><td style="padding: 6px;">${
              d.surveyor || "-"
            }</td></tr>
          </table>
        </div>
      `);

      markers.addLayer(m);
    }
  });

  interactiveLayer = markers.addTo(map);
}

function updateAllCharts(data) {
  drawInteractiveDepthChart(data);
  drawInteractiveKecamatanChart(data);
  drawInteractiveSurveyorChart(data);
  drawInteractivePermukaanChart(data);
  drawInteractiveDrainaseChart(data);
  drawInteractiveAvgDepthChart(data);
}

// Chart 1: Distribusi Kedalaman
let interactiveDepthChart = null;
function drawInteractiveDepthChart(data) {
  if (interactiveDepthChart) interactiveDepthChart.destroy();
  const bucket = { "1–3": 0, "4–6": 0, "7–9": 0, "≥10": 0 };
  data.forEach((d) => {
    const v = Number(d.kedalaman_cm) || 0;
    if (v >= 10) bucket["≥10"]++;
    else if (v >= 7) bucket["7–9"]++;
    else if (v >= 4) bucket["4–6"]++;
    else if (v >= 1) bucket["1–3"]++;
  });
  const ctx = document.getElementById("interactiveDepthChart");
  if (!ctx) return;
  interactiveDepthChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(bucket),
      datasets: [
        {
          data: Object.values(bucket),
          backgroundColor: ["#647FBC", "#91ADC8", "#AED6CF", "#FAFDD6"],
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

// Chart 2: Persebaran Kecamatan
let interactiveKecamatanChart = null;
function drawInteractiveKecamatanChart(data) {
  if (interactiveKecamatanChart) interactiveKecamatanChart.destroy();
  const count = {};
  data.forEach((d) => {
    if (d.kecamatan) count[d.kecamatan] = (count[d.kecamatan] || 0) + 1;
  });
  const ctx = document.getElementById("interactiveKecamatanChart");
  if (!ctx) return;
  interactiveKecamatanChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(count),
      datasets: [
        {
          data: Object.values(count),
          backgroundColor: [
            "#647FBC",
            "#91ADC8",
            "#AED6CF",
            "#FAFDD6",
            "#f97316",
            "#dc2626",
          ],
        },
      ],
    },
    options: { responsive: true },
  });
}

let interactiveSurveyorChart = null;
function drawInteractiveSurveyorChart(data) {
  if (interactiveSurveyorChart) interactiveSurveyorChart.destroy();
  const count = {};
  data.forEach((d) => {
    if (d.surveyor) count[d.surveyor] = (count[d.surveyor] || 0) + 1;
  });
  const ctx = document.getElementById("interactiveSurveyorChart");
  if (!ctx) return;
  interactiveSurveyorChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(count),
      datasets: [
        {
          data: Object.values(count),
          backgroundColor: "#647FBC",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

let interactivePermukaanChart = null;
function drawInteractivePermukaanChart(data) {
  if (interactivePermukaanChart) interactivePermukaanChart.destroy();
  const count = {};
  data.forEach((d) => {
    if (d.jenis_permukaan)
      count[d.jenis_permukaan] = (count[d.jenis_permukaan] || 0) + 1;
  });
  const ctx = document.getElementById("interactivePermukaanChart");
  if (!ctx) return;
  interactivePermukaanChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(count),
      datasets: [
        {
          data: Object.values(count),
          backgroundColor: [
            "#647FBC",
            "#91ADC8",
            "#AED6CF",
            "#FAFDD6",
            "#f97316",
          ],
        },
      ],
    },
    options: { responsive: true },
  });
}

// Chart 5: Kondisi Drainase
let interactiveDrainaseChart = null;
function drawInteractiveDrainaseChart(data) {
  if (interactiveDrainaseChart) interactiveDrainaseChart.destroy();
  const count = {};
  data.forEach((d) => {
    if (d.kondisi_drainase)
      count[d.kondisi_drainase] = (count[d.kondisi_drainase] || 0) + 1;
  });
  const ctx = document.getElementById("interactiveDrainaseChart");
  if (!ctx) return;
  interactiveDrainaseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(count),
      datasets: [
        {
          data: Object.values(count),
          backgroundColor: "#91ADC8",
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

// Chart 6: Rata-rata Kedalaman per Kecamatan
let interactiveAvgDepthChart = null;
function drawInteractiveAvgDepthChart(data) {
  if (interactiveAvgDepthChart) interactiveAvgDepthChart.destroy();
  const kecData = {};
  data.forEach((d) => {
    if (d.kecamatan && d.kedalaman_cm != null) {
      if (!kecData[d.kecamatan]) kecData[d.kecamatan] = { sum: 0, count: 0 };
      kecData[d.kecamatan].sum += Number(d.kedalaman_cm);
      kecData[d.kecamatan].count += 1;
    }
  });
  const avgData = {};
  Object.keys(kecData).forEach((k) => {
    avgData[k] = (kecData[k].sum / kecData[k].count).toFixed(1);
  });
  const ctx = document.getElementById("interactiveAvgDepthChart");
  if (!ctx) return;
  interactiveAvgDepthChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(avgData),
      datasets: [
        {
          data: Object.values(avgData),
          backgroundColor: "#AED6CF",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadHomeData();
});
