let map;
let floodLayer;
let floodData;
let osmLayer, satelliteLayer;

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmJreHNvdXVsYWhmbWdkaHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4ODkzOTEsImV4cCI6MjA4MTQ2NTM5MX0.F26b2HaXUScZ2oBdsKtk7Xryi4gyDKPjYyp6VejTm-0"
const SUPABASE_URL = "https://izvbkxsouulahfmgdhzf.supabase.co"
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

// ===============================
// INIT MAP
// ===============================
function initMap() {
  map = L.map("map").setView([0.527694, 101.445667], 13);

  osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap" }
  ).addTo(map);

  satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  );

  loadFloodData();
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

  } catch (e) {
    console.error(e);
  }
}

function renderFloodLayer(features) {
  if (floodLayer) map.removeLayer(floodLayer);

  floodLayer = L.geoJSON(features, {
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
        <b>Kecamatan:</b> ${p.kecamatan}<br>
        <b>Kedalaman:</b> ${p.kedalaman_cm} cm<br>
        <b>Lama:</b> ${p.lama_genangan}
      `);
    },
  }).addTo(map);
}

// ===============================
// STATISTIK
// ===============================
function updateStats(features) {
  const valid = features.filter(f => f.properties.kedalaman_cm != null);
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
    const res = await axios.get(
      SUPABASE_URL + "/rest/v1/genangan_air",
      {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
        },
        params: {
          select: "kedalaman_cm,kecamatan",
        },
      }
    );

    const data = res.data;

    /* =========================
       TOTAL TITIK
    ========================= */
    document.getElementById("homeTotal").innerText = data.length;

    /* =========================
       RATA-RATA KEDALAMAN
    ========================= */
    const validDepth = data.filter(d => d.kedalaman_cm != null);

    const avg =
      validDepth.length > 0
        ? validDepth.reduce(
            (sum, d) => sum + Number(d.kedalaman_cm),
            0
          ) / validDepth.length
        : 0;

    document.getElementById("homeAvg").innerText =
      avg.toFixed(1) + " cm";

    /* =========================
       JUMLAH KECAMATAN UNIK
    ========================= */
    const kecamatanSet = new Set(
      data
        .map(d => d.kecamatan)
        .filter(k => k && k !== "")
    );

    document.getElementById("homeKecamatan").innerText =
      kecamatanSet.size;

  } catch (e) {
    console.error("Home data error:", e);
  }
}


function drawDepthChart(data) {
  if (depthChart) depthChart.destroy();

  const bucket = { "1–3": 0, "4–6": 0, "7–9": 0, "≥10": 0 };
  data.forEach(d => {
    if (d.kedalaman_cm >= 10) bucket["≥10"]++;
    else if (d.kedalaman_cm >= 7) bucket["7–9"]++;
    else if (d.kedalaman_cm >= 4) bucket["4–6"]++;
    else if (d.kedalaman_cm >= 1) bucket["1–3"]++;
  });

  depthChart = new Chart(
    document.getElementById("depthChart"),
    {
      type: "bar",
      data: {
        labels: Object.keys(bucket),
        datasets: [{
          data: Object.values(bucket),
          backgroundColor: ["#3b82f6","#facc15","#f97316","#dc2626"]
        }]
      },
      options: { responsive: true, plugins:{legend:{display:false}} }
    }
  );
}

function drawKecamatanChart(data) {
  if (kecamatanChart) kecamatanChart.destroy();

  const count = {};
  data.forEach(d => {
    if (d.kecamatan)
      count[d.kecamatan] = (count[d.kecamatan] || 0) + 1;
  });

  kecamatanChart = new Chart(
    document.getElementById("kecamatanChart"),
    {
      type: "pie",
      data: {
        labels: Object.keys(count),
        datasets: [{
          data: Object.values(count),
          backgroundColor: [
            "#2563eb","#16a34a","#f97316",
            "#dc2626","#9333ea","#0ea5e9"
          ]
        }]
      },
      options: { responsive: true }
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  loadHomeData();
});