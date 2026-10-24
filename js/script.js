document.addEventListener("where:layout-ready", () => {
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

function nicheSlug(name) {
  return String(name || "").toLowerCase().trim().replace(/[^\w\d]+/g, "-").replace(/^-+|-+$/g, "");
}

function renderNicheCards() {
  nicheTrack.innerHTML = cafeTypes.map((type) => {
    const typeCafe = cafes.find((cafe) => (cafe.niche === type.name || cafe.niche_type === type.name) && cafe.cover_image);
    const slug = nicheSlug(type.name);
    const countText = `${type.count} ${type.count === 1 ? "spot" : "spots"}`;
    const exploreUrl = `explore.html?niche=${encodeURIComponent(type.name)}`;
    return `
    <a class="niche-card niche-card--${slug}" href="${exploreUrl}" aria-label="Explore ${escapeHtml(type.name)} spots">
      ${typeCafe ? `<img class="niche-card__image" src="${escapeHtml(typeCafe.cover_image)}" alt="" loading="lazy">` : ""}
      <span class="niche-card__content">
        <span class="niche-card__count">${countText}</span>
        <span class="niche-card__title">${escapeHtml(type.name)}</span>
      </span>
    </a>`;
  }).join("");
}

function renderFeaturedCafes() {
  const featured = featuredCafeIds
    .map((id) => cafes.find((cafe) => cafe.id === id))
    .filter(Boolean)
    .slice(0, 6);
  featuredGrid.innerHTML = featured.map((cafe) => {
    const cafeUrl = cafe.url_path ? `/${cafe.url_path}` : `/surat/${encodeURIComponent(cafe.area_slug || 'all')}/${encodeURIComponent(cafe.slug || cafe.id)}`;
    return `
    <a class="featured-card" href="${cafeUrl}" aria-label="View details for ${escapeHtml(cafe.name)}">
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
    </a>`;
  }).join("");
}

function renderAreaDirectory() {
  areaList.innerHTML = areas.map((area, areaIndex) => {
    return `
      <button class="area-row ${areaIndex === 0 ? "is-active" : ""}" type="button" data-area-index="${areaIndex}" data-area-slug="${escapeHtml(area.slug || area.name)}" aria-label="Explore spots in ${escapeHtml(area.name)}">
        <span class="area-row__name">${escapeHtml(area.name)}</span>
      </button>
    `;
  }).join("");

  const updateAreaImages = (areaIndex) => {
    const area = areas[areaIndex];
    if (!area) return;

    // Highlight active row
    areaList.querySelectorAll(".area-row").forEach((r, idx) => {
      r.classList.toggle("is-active", idx === areaIndex);
    });

    const areaCafes = cafes.filter((cafe) => cafe.area === area.name || cafe.area_slug === area.slug);

    // Collect all available photos from cafes in this area
    const areaPhotos = areaCafes
      .flatMap((cafe) => (cafe.images || []).map((image) => image.src || image.image_url))
      .filter(Boolean);

    let chosenPhotos = [];
    if (area.images && Array.isArray(area.images) && area.images.length > 0) {
      chosenPhotos = [...area.images].filter(Boolean).slice(0, 3);
    }

    if (chosenPhotos.length < 3 && areaPhotos.length > 0) {
      const rest = areaPhotos.filter((p) => !chosenPhotos.includes(p));
      const shuffled = [...rest].sort(() => 0.5 - Math.random());
      while (chosenPhotos.length < 3 && shuffled.length) {
        chosenPhotos.push(shuffled.pop());
      }
    }

    if (chosenPhotos.length < 3) {
      // Area has no photos yet: shuffle random photos from cafes across Surat
      const fallbackPhotos = cafes.flatMap((c) => c.images?.map((i) => i.src || i.image_url) || []).filter(Boolean);
      const shuffledFallback = [...fallbackPhotos].sort(() => 0.5 - Math.random());
      while (chosenPhotos.length < 3 && shuffledFallback.length) {
        const next = shuffledFallback.pop();
        if (!chosenPhotos.includes(next)) chosenPhotos.push(next);
      }
    }

    areaGallery.innerHTML = chosenPhotos.map((image, imageIndex) => `
      <img class="area-gallery__image area-gallery__image--${imageIndex + 1}" src="${escapeHtml(image)}" alt="Photo from ${escapeHtml(area.name)}" loading="lazy">
    `).join("");
  };

  if (areas.length) updateAreaImages(0);

  areaList.querySelectorAll(".area-row").forEach((row) => {
    const areaIndex = Number(row.dataset.areaIndex);
    row.addEventListener("mouseenter", () => updateAreaImages(areaIndex));
    row.addEventListener("focus", () => updateAreaImages(areaIndex));
    row.addEventListener("click", () => {
      const area = areas[areaIndex];
      window.location.href = `explore.html?area=${encodeURIComponent(area.slug || area.name)}`;
    });
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
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView({ behavior: "auto" });
    }
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
