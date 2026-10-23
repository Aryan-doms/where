const nicheStyles = ["coffee", "bistro", "dessert", "healthy", "travel", "work", "play", "garden", "rooftop"];
const excludedNiche = "Artisanal Sourdough Pizzeria & European Bistro Cafe";
const nicheTrack = document.querySelector("#niche-track");
const nicheSlider = document.querySelector("#niche-slider");
const featuredGrid = document.querySelector("#featured-grid");
const areaGallery = document.querySelector("#area-gallery");
const areaList = document.querySelector("#area-list");

let cafes = [];
let cafeTypes = [];
let areas = [];
let referenceImages = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderNicheCards() {
  nicheTrack.innerHTML = cafeTypes.filter((type) => type.name !== excludedNiche).map((type, index) => `
    <button class="niche-card niche-card--${nicheStyles[index % nicheStyles.length]}" type="button" data-type="${escapeHtml(type.name)}" aria-label="Show cafes in ${escapeHtml(type.name)}">
      ${referenceImages[index % referenceImages.length] ? `<img class="niche-card__image" src="${escapeHtml(referenceImages[index % referenceImages.length])}" alt="" loading="lazy">` : ""}
      <span class="niche-card__content">
        <span class="niche-card__count">${type.count} ${type.count === 1 ? "cafe" : "cafes"}</span>
        <span class="niche-card__title">${escapeHtml(type.name)}</span>
      </span>
    </button>`).join("");
}

function renderFeaturedCafes() {
  featuredGrid.innerHTML = cafes.slice(0, 6).map((cafe, index) => `
    <article class="featured-card">
      ${referenceImages.length ? `
        <div class="featured-card__media">
          <img class="featured-card__image featured-card__image--primary" src="${escapeHtml(referenceImages[(index * 2) % referenceImages.length])}" alt="" loading="lazy">
          <img class="featured-card__image featured-card__image--hover" src="${escapeHtml(referenceImages[(index * 2 + 1) % referenceImages.length])}" alt="" loading="lazy">
          <span class="featured-card__area">${escapeHtml(cafe.area)}</span>
          <h3>${escapeHtml(cafe.name)}</h3>
        </div>` : ""}
    </article>`).join("");
}

function renderAreaDirectory() {
  if (referenceImages.length) {
    areaGallery.innerHTML = [0, 1, 2].map((imageIndex) => `
      <img class="area-gallery__image area-gallery__image--${imageIndex + 1}" src="${escapeHtml(referenceImages[imageIndex % referenceImages.length])}" alt="" loading="lazy">
    `).join("");
  }
  areaList.innerHTML = areas.map((area, areaIndex) => `
    <button class="area-row" type="button" data-area-index="${areaIndex}">
      <span class="area-row__name">${escapeHtml(area.name)}</span>
    </button>
  `).join("");

  const updateAreaImages = (areaIndex) => {
    if (!referenceImages.length) return;
    const startIndex = (areaIndex * 3) % referenceImages.length;
    areaGallery.querySelectorAll(".area-gallery__image").forEach((image, imageIndex) => {
      image.src = referenceImages[(startIndex + imageIndex) % referenceImages.length];
    });
  };

  areaList.querySelectorAll(".area-row").forEach((row) => {
    const areaIndex = Number(row.dataset.areaIndex);
    row.addEventListener("mouseenter", () => updateAreaImages(areaIndex));
    row.addEventListener("focus", () => updateAreaImages(areaIndex));
  });
}

function setupSlider() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer = null;
  let paused = false;

  const stop = () => {
    paused = true;
    if (timer) window.clearInterval(timer);
    timer = null;
  };
  const start = () => {
    if (paused || reduceMotion.matches || timer) return;
    timer = window.setInterval(() => {
      const end = nicheSlider.scrollWidth - nicheSlider.clientWidth;
      if (end <= 0) return;
      const behavior = reduceMotion.matches ? "auto" : "smooth";
      if (nicheSlider.scrollLeft >= end - 8) {
        nicheSlider.scrollTo({ left: 0, behavior });
      } else {
        const card = nicheTrack.querySelector(".niche-card");
        nicheSlider.scrollBy({ left: card ? card.getBoundingClientRect().width + 17 : 220, behavior });
      }
    }, 4800);
  };

  nicheSlider.addEventListener("mouseenter", stop);
  nicheSlider.addEventListener("mouseleave", () => { paused = false; start(); });
  nicheSlider.addEventListener("focusin", stop);
  nicheSlider.addEventListener("focusout", (event) => {
    if (!nicheSlider.contains(event.relatedTarget)) { paused = false; start(); }
  });
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches && timer) {
      window.clearInterval(timer);
      timer = null;
    } else if (!reduceMotion.matches) {
      start();
    }
  });
  start();
}

function parseCsvRow(row) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

async function loadLocalCafes() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load local cafe data (HTTP ${response.status}).`);

  const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
  return rows.slice(0, 6).map((row) => {
    const values = parseCsvRow(row);
    return {
      name: values[0],
      area: values[1].replace(/^Surat\s*\/\s*/, ""),
      niche_type: values[4],
      price_range: values[7]
    };
  });
}

async function loadLocalCafeTypes() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load local cafe data (HTTP ${response.status}).`);

  const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
  const counts = new Map();
  rows.forEach((row) => {
    const type = parseCsvRow(row)[4];
    if (type) counts.set(type, (counts.get(type) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([name, count]) => ({ name, count }));
}

async function loadLocalAreas() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load local cafe data (HTTP ${response.status}).`);

  const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
  const counts = new Map();
  rows.forEach((row) => {
    const area = parseCsvRow(row)[1].replace(/^Surat\s*\/\s*/, "").trim();
    if (area) counts.set(area, (counts.get(area) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([name, count]) => ({ name, count }));
}

async function loadCatalogImages() {
  const response = await fetch("catalog.csv");
  if (!response.ok) throw new Error(`Could not load catalog images (HTTP ${response.status}).`);

  const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
  const images = rows
    .map((row) => parseCsvRow(row)[5])
    .filter(Boolean)
    .flatMap((value) => value.split(" | "))
    .filter((url, index, values) => values.indexOf(url) === index);

  return images.sort(() => Math.random() - 0.5);
}

async function loadHomepage() {
  try {
    referenceImages = await loadCatalogImages();
  } catch (error) {
    console.error("The catalog images could not be loaded.", error);
  }

  try {
    const response = await fetch("api/home-data.php");
    if (!response.ok) throw new Error(`Could not load cafe data (HTTP ${response.status}).`);

    const data = await response.json();
    if (!Array.isArray(data.cafes) || !Array.isArray(data.types) || !Array.isArray(data.areas)) {
      throw new Error("Cafe data response is not in the expected format.");
    }

    cafes = data.cafes;
    cafeTypes = data.types;
    areas = data.areas;
    renderNicheCards();
    setupSlider();
  } catch (error) {
    console.error("Homepage cafe data could not be loaded.", error);
    try {
      cafes = await loadLocalCafes();
      cafeTypes = await loadLocalCafeTypes();
      areas = await loadLocalAreas();
      renderNicheCards();
      setupSlider();
    } catch (fallbackError) {
      console.error("The local cafe category data could not be loaded.", fallbackError);
    }
  }

  if (cafes.length) renderFeaturedCafes();
  if (areas.length) renderAreaDirectory();
}
loadHomepage();

const heroVideo = document.querySelector(".hero__video");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 560px)");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");
document.querySelector("#current-year").textContent = new Date().getFullYear();

const footerStickers = document.querySelector(".footer-stickers");
if (footerStickers) {
  [...footerStickers.children]
    .sort(() => Math.random() - 0.5)
    .forEach((sticker) => footerStickers.appendChild(sticker));
}

heroVideo.muted = true;
heroVideo.defaultMuted = true;
heroVideo.volume = 0;
heroVideo.autoplay = true;
heroVideo.loop = true;
heroVideo.playsInline = true;

function setHeroVideoSource() {
  const source = heroVideo.querySelector("source");
  const nextSource = mobileViewport.matches ? "assets/hero-vertical.MP4" : "assets/where.mp4";
  if (source.getAttribute("src") === nextSource && heroVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
    setHeroVideoMotion();
    return;
  }

  heroVideo.pause();
  source.setAttribute("src", nextSource);
  heroVideo.load();
}

function setHeroVideoMotion() {
  heroVideo.muted = true;
  heroVideo.volume = 0;

  if (heroVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const playback = heroVideo.play();
  if (playback) {
    playback.catch((error) => {
      if (error.name !== "AbortError") {
        console.error("The hero video could not start playing.", error);
      }
    });
  }
}

function updateHeader() {
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
}

let lastScrollY = window.scrollY;
function handleHeaderScroll() {
  const currentScrollY = window.scrollY;
  const movingDown = currentScrollY > lastScrollY;

  siteHeader.classList.toggle("is-hidden", movingDown && currentScrollY > 80);
  updateHeader();
  lastScrollY = currentScrollY;
}

function closeMenu() {
  mainNav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.querySelector(".visually-hidden").textContent = "Open menu";
}

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.querySelector(".visually-hidden").textContent = isOpen ? "Close menu" : "Open menu";
});
mainNav.addEventListener("click", (event) => {
  if (event.target.matches("a")) closeMenu();
});
window.addEventListener("scroll", handleHeaderScroll, { passive: true });
mobileViewport.addEventListener("change", setHeroVideoSource);
heroVideo.addEventListener("loadeddata", setHeroVideoMotion);
heroVideo.addEventListener("loadedmetadata", setHeroVideoMotion);
heroVideo.addEventListener("canplay", setHeroVideoMotion);
heroVideo.addEventListener("canplaythrough", setHeroVideoMotion);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) setHeroVideoMotion();
});
window.addEventListener("pageshow", setHeroVideoMotion);
siteHeader.classList.remove("is-hidden");
handleHeaderScroll();
setHeroVideoSource();
setHeroVideoMotion();
reduceMotion.addEventListener("change", setHeroVideoMotion);
