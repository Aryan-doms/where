document.addEventListener("where:layout-ready", () => {
function escapeExploreHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function fixedTiming(timing) {
  return timing.split(/\r?\n/)
    .map((segment) => segment.trim().replace(/12midnight/gi, "12:00am").replace(/12noon/gi, "12:00pm"))
    .filter(Boolean)
    .slice(0, 2)
    .join("\n");
}

function cafeCard(cafe) {
  const saved = window.WhereUser.hasFavorite(cafe.id);
  return `
    <article class="explore-card">
      <div class="explore-card__media">
        ${cafe.image ? `<img src="${escapeExploreHtml(cafe.image)}" alt="" loading="lazy">` : ""}
        <span class="explore-card__area">${escapeExploreHtml(cafe.area)}</span>
        <button class="explore-card__heart" data-favorite-id="${cafe.id}" type="button" aria-label="${saved ? "Remove" : "Save"} ${escapeExploreHtml(cafe.name)}" aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
          </svg>
        </button>
      </div>
      <div class="explore-card__body">
        <div class="explore-card__topline">
          <h2><a href="cafe.html?id=${encodeURIComponent(cafe.id)}">${escapeExploreHtml(cafe.name)}</a></h2>
          <p class="explore-card__hours"><span aria-hidden="true">·</span> ${escapeExploreHtml(cafe.timing)}</p>
        </div>
        <div class="explore-card__bottomline">
          <p class="explore-card__cuisine">${escapeExploreHtml(cafe.cuisine)}</p>
          <p class="explore-card__price">${escapeExploreHtml(cafe.price.replace(" for two people (approx.)", "").replace(" for two", ""))} for two</p>
        </div>
      </div>
    </article>
  `;
}

async function setupExplore() {
  await window.WhereUser.ready;
  const response = await fetch("api/cafes.php");
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
