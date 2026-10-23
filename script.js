document.addEventListener("where:layout-ready", () => {
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
let featuredCafeIds = [];

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
  nicheTrack.innerHTML = cafeTypes.filter((type) => type.name !== excludedNiche).map((type, index) => {
    const typeCafe = cafes.find((cafe) => cafe.niche === type.name && cafe.cover_image);
    return `
    <button class="niche-card niche-card--${nicheStyles[index % nicheStyles.length]}" type="button" data-type="${escapeHtml(type.name)}" aria-label="Show cafes in ${escapeHtml(type.name)}">
      ${typeCafe ? `<img class="niche-card__image" src="${escapeHtml(typeCafe.cover_image)}" alt="" loading="lazy">` : ""}
      <span class="niche-card__content">
        <span class="niche-card__count">${type.count} ${type.count === 1 ? "cafe" : "cafes"}</span>
        <span class="niche-card__title">${escapeHtml(type.name)}</span>
      </span>
    </button>`;
  }).join("");
}

function renderFeaturedCafes() {
  const featured = featuredCafeIds
    .map((id) => cafes.find((cafe) => cafe.id === id))
    .filter(Boolean)
    .slice(0, 6);
  featuredGrid.innerHTML = featured.map((cafe) => `
    <a class="featured-card" href="cafe.html?id=${encodeURIComponent(cafe.id)}" aria-label="View details for ${escapeHtml(cafe.name)}">
      ${cafe.cover_image ? `
        <div class="featured-card__media">
          <img class="featured-card__image featured-card__image--primary" src="${escapeHtml(cafe.cover_image)}" alt="" loading="lazy">
          ${cafe.images[1] ? `<img class="featured-card__image featured-card__image--hover" src="${escapeHtml(cafe.images[1].src || cafe.images[1].image_url)}" alt="" loading="lazy">` : ""}
          <span class="featured-card__area">${escapeHtml(cafe.area)}</span>
          <h3>${escapeHtml(cafe.name)}</h3>
        </div>` : `
        <div class="featured-card__fallback">
          <span>${escapeHtml(cafe.area)}</span>
          <h3>${escapeHtml(cafe.name)}</h3>
        </div>`}
    </a>`).join("");
}

function renderAreaDirectory() {
  areaList.innerHTML = areas.map((area, areaIndex) => `
    <button class="area-row" type="button" data-area-index="${areaIndex}">
      <span class="area-row__name">${escapeHtml(area.name)}</span>
    </button>
  `).join("");

  const updateAreaImages = (areaIndex) => {
    const areaName = areas[areaIndex]?.name;
    const images = cafes
      .filter((cafe) => cafe.area === areaName)
      .flatMap((cafe) => cafe.images.map((image) => image.src || image.image_url))
      .filter(Boolean)
      .slice(0, 3);
    areaGallery.innerHTML = images.map((image, imageIndex) => `
      <img class="area-gallery__image area-gallery__image--${imageIndex + 1}" src="${escapeHtml(image)}" alt="" loading="lazy">
    `).join("");
  };
  if (areas.length) updateAreaImages(0);

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

async function loadCafeDataset() {
  const response = await fetch("api/home-data.php");
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || `Could not load cafe data (HTTP ${response.status}).`);
  }
  return response.json();
}

async function loadHomepage() {
  try {
    const data = await loadCafeDataset();
    cafes = data.cafes;
    featuredCafeIds = data.featured;
    cafeTypes = data.types;
    areas = data.areas;
    const sections = new Map(data.sections.map((section) => [section.section_key, section]));
    const poster = sections.get("poster");
    if (poster) {
      document.querySelector("#poster-title").textContent = poster.title;
      document.querySelector("#poster-title").nextElementSibling.textContent = poster.body;
      document.querySelector(".poster").hidden = !Number(poster.is_published ?? 1);
    }
    const hero = sections.get("hero");
    if (hero) {
      const heroLink = document.querySelector(".hero__content a");
      const videoSource = document.querySelector(".hero__video source");
      heroLink.textContent = hero.link_label;
      heroLink.href = hero.link_url;
      if (hero.title.trim()) {
        document.querySelector(".hero__content h1").textContent = hero.title;
      }
      if (hero.media_path) {
        configuredHeroSource = hero.media_path;
        setHeroVideoSource();
      }
      document.querySelector(".hero").hidden = !Number(hero.is_published ?? 1);
    }
    renderNicheCards();
    setupSlider();
    renderFeaturedCafes();
    renderAreaDirectory();
  } catch (error) {
    console.error("Homepage cafe data could not be loaded.", error);
  }
}
loadHomepage();

const heroVideo = document.querySelector(".hero__video");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileViewport = window.matchMedia("(max-width: 560px)");
let configuredHeroSource = "assets/where.mp4";
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
  const nextSource = mobileViewport.matches && configuredHeroSource === "assets/where.mp4"
    ? "assets/hero-vertical.MP4"
    : configuredHeroSource;
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

mobileViewport.addEventListener("change", setHeroVideoSource);
heroVideo.addEventListener("loadeddata", setHeroVideoMotion);
heroVideo.addEventListener("loadedmetadata", setHeroVideoMotion);
heroVideo.addEventListener("canplay", setHeroVideoMotion);
heroVideo.addEventListener("canplaythrough", setHeroVideoMotion);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) setHeroVideoMotion();
});
window.addEventListener("pageshow", setHeroVideoMotion);
setHeroVideoSource();
setHeroVideoMotion();
reduceMotion.addEventListener("change", setHeroVideoMotion);
});
