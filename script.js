const nicheStyles = ["coffee", "bistro", "dessert", "healthy", "travel", "work", "play", "garden", "rooftop"];
const nicheTrack = document.querySelector("#niche-track");
const cafeGrid = document.querySelector("#cafe-grid");
const nicheSlider = document.querySelector("#niche-slider");
const filterStatus = document.querySelector("#filter-status");

let cafes = [];
let cafeTypes = [];
let areas = [];
let activeFilter = null;

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
  nicheTrack.innerHTML = cafeTypes.map((type, index) => `
    <button class="niche-card niche-card--${nicheStyles[index % nicheStyles.length]}" type="button" data-type="${escapeHtml(type.name)}" aria-label="Show cafes in ${escapeHtml(type.name)}">
      <span class="niche-card__content">
        <span class="niche-card__count">${type.count} ${type.count === 1 ? "cafe" : "cafes"}</span>
        <span class="niche-card__title">${escapeHtml(type.name)}</span>
      </span>
    </button>`).join("");
}

function renderCafes() {
  const selectedCafes = activeFilter
    ? cafes.filter((cafe) => cafe[activeFilter.key] === activeFilter.value)
    : cafeTypes.map((type) => cafes.find((cafe) => cafe.niche_type === type.name)).filter(Boolean);

  cafeGrid.innerHTML = selectedCafes.length
    ? selectedCafes.map((cafe, index) => `
        <article class="cafe-card">
          <div class="cafe-card__details">
            <div class="cafe-card__meta"><span>${escapeHtml(cafe.area)}, Surat</span><span>${escapeHtml(cafe.id)}</span></div>
            <h3>${escapeHtml(cafe.name)}</h3>
            <p class="cafe-card__type">${escapeHtml(cafe.niche_type)}</p>
            <p class="cafe-card__price">${escapeHtml(cafe.price_range)}</p>
          </div>
        </article>`).join("")
    : '<p class="empty-state">There are no cafes in this selection.</p>';

  filterStatus.textContent = activeFilter
    ? `Showing cafes for ${activeFilter.value}.`
    : "";
}

function renderAreas() {
  document.querySelector("#area-list").innerHTML = areas.map((area) => `
    <button class="area-row" type="button" data-area="${escapeHtml(area.name)}" aria-label="Show cafes in ${escapeHtml(area.name)}">
      <span class="area-row__name">${escapeHtml(area.name)}</span>
      <span class="area-row__count">${area.count}</span>
    </button>`).join("");
}

function selectFilter(key, value) {
  activeFilter = { key, value };
  renderCafes();
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  document.querySelector("#featured").scrollIntoView({ behavior, block: "start" });
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
  document.querySelector("#niche-prev").addEventListener("click", () => {
    const behavior = reduceMotion.matches ? "auto" : "smooth";
    nicheSlider.scrollBy({ left: -nicheSlider.clientWidth * .75, behavior });
  });
  document.querySelector("#niche-next").addEventListener("click", () => {
    const behavior = reduceMotion.matches ? "auto" : "smooth";
    nicheSlider.scrollBy({ left: nicheSlider.clientWidth * .75, behavior });
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

async function loadHomepage() {
  try {
    const response = await fetch("api/home-data.php");
    if (!response.ok) throw new Error(`Could not load cafe data (HTTP ${response.status}).`);

    const data = await response.json();
    if (!Array.isArray(data.cafes) || !Array.isArray(data.types) || !Array.isArray(data.areas)) {
      throw new Error("Cafe data response is not in the expected format.");
    }

    cafes = data.cafes;
    cafeTypes = data.types;
    areas = data.areas.slice(0, 10);
    renderNicheCards();
    renderCafes();
    renderAreas();
    setupSlider();
  } catch (error) {
    console.error("Homepage cafe data could not be loaded.", error);
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Cafe data could not be loaded. Check that MySQL is running and api/config.php is set up.";
    nicheTrack.replaceChildren();
    cafeGrid.replaceChildren(message);
    document.querySelector("#area-list").replaceChildren();
    filterStatus.textContent = "Database connection unavailable.";
  }
}

document.addEventListener("click", (event) => {
  const typeButton = event.target.closest("[data-type]");
  const areaButton = event.target.closest("[data-area]");
  if (typeButton) selectFilter("niche_type", typeButton.dataset.type);
  if (areaButton) selectFilter("area", areaButton.dataset.area);
});

document.querySelector("#clear-filter").addEventListener("click", (event) => {
  event.preventDefault();
  activeFilter = null;
  renderCafes();
});

document.querySelector("#current-year").textContent = new Date().getFullYear();
loadHomepage();

const heroVideo = document.querySelector(".hero__video");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setHeroVideoMotion() {
  if (reduceMotion.matches) {
    heroVideo.pause();
    return;
  }

  heroVideo.play().catch((error) => {
    console.error("The hero video could not start playing.", error);
  });
}

setHeroVideoMotion();
reduceMotion.addEventListener("change", setHeroVideoMotion);
