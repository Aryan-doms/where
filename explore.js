document.addEventListener("where:layout-ready", () => {
function escapeExploreHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function fixedTiming(timing) {
  if (!timing) return "";
  const cleaned = timing.replace(/12midnight/gi, "12am").replace(/12noon/gi, "12pm");
  const match = cleaned.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (match) {
    return match[1].trim();
  }
  return "";
}

function cafeCard(cafe) {
  const saved = window.WhereUser.hasFavorite(cafe.id);
  const cleanPrice = escapeExploreHtml(cafe.price.replace(" for two people (approx.)", "").replace(" for two", ""));
  const timing = cafe.timing || "";
  const numRating = Number(cafe.rating) || 0;
  let ratingTier = "low";
  if (numRating >= 4.0) {
    ratingTier = "high";
  } else if (numRating >= 3.5) {
    ratingTier = "good";
  } else if (numRating >= 3.0) {
    ratingTier = "mid";
  }
  const ratingBadge = cafe.rating ? `<span class="explore-card__rating explore-card__rating--${ratingTier}" aria-label="Rated ${escapeExploreHtml(cafe.rating)} out of 5"><span class="explore-card__star" aria-hidden="true">★</span> ${escapeExploreHtml(cafe.rating)}</span>` : "";

  const cafeUrl = cafe.url_path ? `/${cafe.url_path}` : `/surat/${encodeURIComponent(cafe.area_slug || 'all')}/${encodeURIComponent(cafe.slug || cafe.id)}`;

  return `
    <article class="explore-card">
      <div class="explore-card__media">
        <a class="explore-card__media-link" href="${cafeUrl}" aria-label="View details for ${escapeExploreHtml(cafe.name)}">
          ${cafe.image ? `<img src="${escapeExploreHtml(cafe.image)}" alt="" loading="lazy">` : ""}
        </a>
        <span class="explore-card__area">${escapeExploreHtml(cafe.area)}</span>
        <button class="explore-card__heart" data-favorite-id="${cafe.id}" type="button" aria-label="${saved ? "Remove" : "Save"} ${escapeExploreHtml(cafe.name)}" aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
          </svg>
        </button>
      </div>
      <div class="explore-card__body">
        <div class="explore-card__topline">
          <h2><a href="${cafeUrl}">${escapeExploreHtml(cafe.name)}</a></h2>
          ${ratingBadge}
        </div>
        <div class="explore-card__subline">
          <div class="explore-card__subline-left">
            <span class="explore-card__cuisine">${escapeExploreHtml(cafe.cuisine)}</span>
            ${timing ? `<span class="explore-card__dot" aria-hidden="true">·</span><span class="explore-card__time">${escapeExploreHtml(timing)}</span>` : ""}
          </div>
          <span class="explore-card__price">${cleanPrice} for two</span>
        </div>
      </div>
    </article>
  `;
}

async function setupExplore() {
  await window.WhereUser.ready;
  const response = await fetch("/api/cafes.php");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Could not load cafes (HTTP ${response.status}).`);
  const cafes = result.cafes.map((cafe) => ({
    ...cafe,
    timing: fixedTiming(cafe.timing),
    image: cafe.cover_image
  }));
  const search = document.querySelector("#cafe-search");
  const area = document.querySelector("#area-filter");
  const cuisine = document.querySelector("#cuisine-filter");
  const grid = document.querySelector("#explore-grid");
  const count = document.querySelector("#explore-count");
  const showMore = document.querySelector("#show-more");
  const filterDialog = document.querySelector("#filter-dialog");
  const filterForm = document.querySelector("#filter-form");
  const filterCount = document.querySelector("#filter-count");
  let visibleCount = 15;
  const areas = [...new Set(cafes.map((cafe) => cafe.area))].sort();
  areas.forEach((item) => area.insertAdjacentHTML("beforeend", `<option value="${escapeExploreHtml(item)}">${escapeExploreHtml(item)}</option>`));
  [...new Set(cafes.flatMap((cafe) => cafe.cuisine.split(",").map((item) => item.trim())))].sort().forEach((item) => cuisine.insertAdjacentHTML("beforeend", `<option value="${escapeExploreHtml(item)}">${escapeExploreHtml(item)}</option>`));
  document.querySelector("#explore-chips").innerHTML = [
    '<button class="explore-chip is-active" type="button" data-area="">All spots</button>',
    ...areas.slice(0, 7).map((item) => `<button class="explore-chip" type="button" data-area="${escapeExploreHtml(item)}">${escapeExploreHtml(item)}</button>`)
  ].join("");
  document.querySelectorAll(".explore-chip").forEach((chip) => chip.addEventListener("click", () => {
    area.value = chip.dataset.area;
    document.querySelectorAll(".explore-chip").forEach((item) => item.classList.toggle("is-active", item === chip));
    render();
  }));

  let urlAreaParam = new URLSearchParams(window.location.search).get("area");
  const pathParts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (!urlAreaParam && pathParts[0] === "surat" && pathParts.length >= 2 && pathParts[1] !== "all" && pathParts[1] !== "all-spots") {
    urlAreaParam = decodeURIComponent(pathParts[1]);
  }
  if (urlAreaParam) {
    const matched = cafes.find((c) => (c.area_slug && c.area_slug.toLowerCase() === urlAreaParam.toLowerCase()) || c.area.toLowerCase() === urlAreaParam.toLowerCase());
    if (matched) {
      area.value = matched.area;
      document.querySelectorAll(".explore-chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip.dataset.area === matched.area);
      });
    }
  }

  const urlNicheParam = new URLSearchParams(window.location.search).get("niche");
  if (urlNicheParam) {
    search.value = urlNicheParam;
  }
  const render = (resetVisible = false) => {
    if (resetVisible) visibleCount = 15;
    const query = search.value.trim().toLowerCase();
    const filtered = cafes.filter((cafe) => {
      const haystack = `${cafe.name} ${cafe.area} ${cafe.cuisine} ${cafe.niche}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!area.value || cafe.area === area.value) && (!cuisine.value || cafe.cuisine.split(",").map((item) => item.trim()).includes(cuisine.value));
    });
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "spot" : "spots"}`;
    grid.innerHTML = filtered.length ? filtered.slice(0, visibleCount).map(cafeCard).join("") : "<p>No spots match that search yet.</p>";
    showMore.hidden = filtered.length <= visibleCount;
    grid.querySelectorAll("[data-favorite-id]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.favoriteId;
      if (!window.WhereUser.current()) { window.location.href = "login.html"; return; }
      button.disabled = true;
      try {
        const isSaved = await window.WhereUser.toggleFavorite(id);
        button.setAttribute("aria-pressed", String(isSaved));
        button.setAttribute("aria-label", `${isSaved ? "Remove" : "Save"} ${cafes.find((cafe) => cafe.id === id).name}`);
      } catch (error) {
        count.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }));
  };
  document.querySelector("#explore-filters").addEventListener("input", () => render(true));
  document.querySelector("#filter-button").addEventListener("click", () => filterDialog.showModal());
  document.querySelector("#close-filter").addEventListener("click", () => filterDialog.close());
  document.querySelector("#clear-filters").addEventListener("click", () => {
    area.value = "";
    cuisine.value = "";
    filterForm.reset();
    filterCount.hidden = true;
    filterDialog.close();
    render(true);
  });
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const activeFilters = [area.value, cuisine.value].filter(Boolean).length;
    filterCount.textContent = activeFilters;
    filterCount.hidden = !activeFilters;
    document.querySelectorAll(".explore-chip").forEach((item) => item.classList.toggle("is-active", item.dataset.area === area.value));
    filterDialog.close();
    render(true);
  });
  showMore.addEventListener("click", () => {
    visibleCount += 15;
    render();
  });
  render(true);
}

setupExplore().catch((error) => {
  console.error("Explore list could not be loaded.", error);
  document.querySelector("#explore-grid").textContent = error.message;
});
});
