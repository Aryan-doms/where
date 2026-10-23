document.addEventListener("where:layout-ready", () => {
function parseExploreCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  if (rows.length) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}

function escapeExploreHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function makeExploreCafe(values, headers, index) {
  const source = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || ""]));
  return {
    id: `cafe-${String(index + 1).padStart(3, "0")}`,
    name: source.Name,
    area: source["Surat Area"].replace(/^Surat\s*\/\s*/, "").trim(),
    cuisine: source["Cuisine Served / Type of Cafe Cuisine"],
    niche: source["Niche Type of Cafe"],
    timing: source.Timing,
    price: source["Price Range"]
  };
}

async function loadExploreImages() {
  const response = await fetch("catalog.csv");
  if (!response.ok) return [];
  const [headers, ...rows] = parseExploreCsv(await response.text());
  const imageIndex = headers.indexOf("image_url");
  if (imageIndex < 0) return [];
  return rows.map((row) => row[imageIndex] || "").filter(Boolean);
}

function cafeCard(cafe) {
  const saved = window.WhereUser.hasFavorite(cafe.id);
  return `
    <article class="explore-card">
      <div class="explore-card__media">
        ${cafe.image ? `<img src="${escapeExploreHtml(cafe.image)}" alt="" loading="lazy">` : ""}
        <span class="explore-card__area">${escapeExploreHtml(cafe.area)}</span>
        <button class="explore-card__heart" data-favorite-id="${cafe.id}" type="button" aria-label="${saved ? "Remove" : "Save"} ${escapeExploreHtml(cafe.name)}" aria-pressed="${saved}">
          <span aria-hidden="true">${saved ? "♥" : "♡"}</span>
        </button>
        <div class="explore-card__overlay">
          <h2><a href="cafe.html?id=${encodeURIComponent(cafe.id)}">${escapeExploreHtml(cafe.name)}</a></h2>
          <p>${escapeExploreHtml(cafe.cuisine)}</p>
        </div>
      </div>
      <div class="explore-card__body">
        <p class="explore-card__niche">${escapeExploreHtml(cafe.niche)}</p>
        <dl class="explore-card__details">
          <div><dt>Hours</dt><dd>${escapeExploreHtml(cafe.timing)}</dd></div>
          <div><dt>Cost for two</dt><dd>${escapeExploreHtml(cafe.price.replace(" people (approx.)", ""))}</dd></div>
        </dl>
      </div>
    </article>
  `;
}

async function setupExplore() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load cafes (HTTP ${response.status}).`);
  const [headers, ...rows] = parseExploreCsv(await response.text());
  const cafes = rows.filter((row) => row.some((value) => value.trim())).map((row, index) => makeExploreCafe(row, headers, index));
  const images = await loadExploreImages();
  cafes.forEach((cafe, index) => { cafe.image = images[index % images.length] || ""; });
  const search = document.querySelector("#cafe-search");
  const area = document.querySelector("#area-filter");
  const cuisine = document.querySelector("#cuisine-filter");
  const grid = document.querySelector("#explore-grid");
  const count = document.querySelector("#explore-count");
  const showMore = document.querySelector("#show-more");
  const filterDialog = document.querySelector("#filter-dialog");
  const filterForm = document.querySelector("#filter-form");
  const filterCount = document.querySelector("#filter-count");
  let visibleCount = 6;
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
    if (resetVisible) visibleCount = 6;
    const query = search.value.trim().toLowerCase();
    const filtered = cafes.filter((cafe) => {
      const haystack = `${cafe.name} ${cafe.area} ${cafe.cuisine} ${cafe.niche}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!area.value || cafe.area === area.value) && (!cuisine.value || cafe.cuisine.split(",").map((item) => item.trim()).includes(cuisine.value));
    });
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "spot" : "spots"}`;
    grid.innerHTML = filtered.length ? filtered.slice(0, visibleCount).map(cafeCard).join("") : "<p>No spots match that search yet.</p>";
    showMore.hidden = filtered.length <= visibleCount;
    grid.querySelectorAll("[data-favorite-id]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.favoriteId;
      const saved = window.WhereUser.current();
      if (!saved) { window.location.href = "login.html"; return; }
      window.WhereUser.toggleFavorite(id);
      render();
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
    visibleCount += 5;
    render();
  });
  render(true);
}

setupExplore().catch((error) => {
  console.error("Explore list could not be loaded.", error);
  document.querySelector("#explore-grid").textContent = error.message;
});
});
