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
    niche: source["Niche Type of Cafe"]
  };
}

function cafeCard(cafe) {
  const saved = window.WhereUser.hasFavorite(cafe.id);
  return `
    <article class="explore-card">
      <div class="explore-card__topline">
        <span>${escapeExploreHtml(cafe.area)}</span>
        <button class="explore-card__heart" data-favorite-id="${cafe.id}" type="button" aria-label="${saved ? "Remove" : "Save"} ${escapeExploreHtml(cafe.name)}" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
      </div>
      <h2><a href="cafe.html?id=${encodeURIComponent(cafe.id)}">${escapeExploreHtml(cafe.name)}</a></h2>
      <p>${escapeExploreHtml(cafe.niche)}</p>
      <small>${escapeExploreHtml(cafe.cuisine)}</small>
    </article>
  `;
}

async function setupExplore() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load cafes (HTTP ${response.status}).`);
  const [headers, ...rows] = parseExploreCsv(await response.text());
  const cafes = rows.filter((row) => row.some((value) => value.trim())).map((row, index) => makeExploreCafe(row, headers, index));
  const search = document.querySelector("#cafe-search");
  const area = document.querySelector("#area-filter");
  const cuisine = document.querySelector("#cuisine-filter");
  const grid = document.querySelector("#explore-grid");
  const count = document.querySelector("#explore-count");
  [...new Set(cafes.map((cafe) => cafe.area))].sort().forEach((item) => area.insertAdjacentHTML("beforeend", `<option value="${escapeExploreHtml(item)}">${escapeExploreHtml(item)}</option>`));
  [...new Set(cafes.flatMap((cafe) => cafe.cuisine.split(",").map((item) => item.trim())))].sort().forEach((item) => cuisine.insertAdjacentHTML("beforeend", `<option value="${escapeExploreHtml(item)}">${escapeExploreHtml(item)}</option>`));
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = cafes.filter((cafe) => {
      const haystack = `${cafe.name} ${cafe.area} ${cafe.cuisine} ${cafe.niche}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!area.value || cafe.area === area.value) && (!cuisine.value || cafe.cuisine.split(",").map((item) => item.trim()).includes(cuisine.value));
    });
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "spot" : "spots"}`;
    grid.innerHTML = filtered.length ? filtered.map(cafeCard).join("") : "<p>No spots match that search yet.</p>";
    grid.querySelectorAll("[data-favorite-id]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.favoriteId;
      const saved = window.WhereUser.current();
      if (!saved) { window.location.href = "login.html"; return; }
      window.WhereUser.toggleFavorite(id);
      render();
    }));
  };
  document.querySelector("#explore-filters").addEventListener("input", render);
  render();
}

setupExplore().catch((error) => {
  console.error("Explore list could not be loaded.", error);
  document.querySelector("#explore-grid").textContent = error.message;
});
