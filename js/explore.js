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
  const cleanName = escapeExploreHtml((cafe.name || "").replace(/\ufffd/g, "'"));
  const priceNum = Math.round(Number(cafe.price_for_two || 0));
  const cleanPrice = priceNum > 0 ? `₹${priceNum.toLocaleString("en-IN")}` : escapeExploreHtml((cafe.price || "").replace(/^\?/, "₹").replace(" for two people (approx.)", "").replace(" for two", ""));
  const timing = (cafe.timing || "").replace(/\ufffd/g, "–");
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
  const hoverImage = cafe.images && cafe.images[1] ? (cafe.images[1].src || cafe.images[1].image_url) : "";

  return `
    <article class="explore-card">
      <div class="explore-card__media">
        <a class="explore-card__media-link" href="${cafeUrl}" aria-label="View details for ${cleanName}">
          ${cafe.image ? `
            <img class="explore-card__image explore-card__image--primary" src="${escapeExploreHtml(cafe.image)}" alt="" loading="lazy">
            ${hoverImage ? `<img class="explore-card__image explore-card__image--hover" src="${escapeExploreHtml(hoverImage)}" alt="" loading="lazy">` : ""}
          ` : `<div class="explore-card__media-placeholder"><span>${cleanName}</span></div>`}
        </a>
        <span class="explore-card__area">${escapeExploreHtml(cafe.area)}</span>
        <button class="explore-card__heart" data-favorite-id="${cafe.id}" type="button" aria-label="${saved ? "Remove" : "Save"} ${cleanName}" aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
          </svg>
        </button>
      </div>
      <div class="explore-card__body">
        <div class="explore-card__topline">
          <h2><a href="${cafeUrl}">${cleanName}</a></h2>
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
  let response = await fetch("/api/cafes.php");
  if (!response.ok) {
    response = await fetch("/api/cafes.json");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Could not load cafes (HTTP ${response.status}).`);
  const cafes = result.cafes.map((cafe) => ({
    ...cafe,
    timing: fixedTiming(cafe.timing),
    image: cafe.cover_image
  }));
  const search = document.querySelector("#cafe-search");
  const grid = document.querySelector("#explore-grid");
  const count = document.querySelector("#explore-count");
  const showMore = document.querySelector("#show-more");
  const filterDialog = document.querySelector("#filter-dialog");
  const filterForm = document.querySelector("#filter-form");
  const filterCount = document.querySelector("#filter-count");
  let visibleCount = 15;

  const areas = [...new Set(cafes.map((cafe) => cafe.area).filter(Boolean))].sort();
  const cuisines = [...new Set(cafes.flatMap((cafe) => (cafe.cuisine || "").split(",").map((item) => item.trim()).filter(Boolean)))].sort();
  const niches = [...new Set(cafes.map((cafe) => cafe.niche || cafe.niche_type).filter(Boolean))].sort();

  // Populate Area Checkboxes
  const listArea = document.querySelector("#filter-list-area");
  if (listArea) {
    listArea.innerHTML = areas.map((item) => `
      <label class="filter-option-row">
        <input type="checkbox" name="filter-area" value="${escapeExploreHtml(item)}">
        <span class="filter-option-text">${escapeExploreHtml(item)}</span>
      </label>
    `).join("");
  }

  // Populate Cuisine Checkboxes
  const listCuisine = document.querySelector("#filter-list-cuisine");
  if (listCuisine) {
    listCuisine.innerHTML = cuisines.map((item) => `
      <label class="filter-option-row">
        <input type="checkbox" name="filter-cuisine" value="${escapeExploreHtml(item)}">
        <span class="filter-option-text">${escapeExploreHtml(item)}</span>
      </label>
    `).join("");
  }

  // Populate Category (Niche) Checkboxes
  const listNiche = document.querySelector("#filter-list-niche");
  if (listNiche) {
    listNiche.innerHTML = niches.map((item) => `
      <label class="filter-option-row">
        <input type="checkbox" name="filter-niche" value="${escapeExploreHtml(item)}">
        <span class="filter-option-text">${escapeExploreHtml(item)}</span>
      </label>
    `).join("");
  }

  // Tab switching on the left
  document.querySelectorAll(".filter-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab-btn").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".filter-tab-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      const targetPanel = document.querySelector(`#panel-${btn.dataset.tab}`);
      if (targetPanel) targetPanel.classList.add("is-active");
    });
  });

  function getFilterSelections() {
    const selectedAreas = [...document.querySelectorAll('input[name="filter-area"]:checked')].map((i) => i.value);
    const selectedPrices = [...document.querySelectorAll('input[name="filter-price"]:checked')].map((i) => i.value);
    const selectedCuisines = [...document.querySelectorAll('input[name="filter-cuisine"]:checked')].map((i) => i.value);
    const selectedNiches = [...document.querySelectorAll('input[name="filter-niche"]:checked')].map((i) => i.value);
    const ratingRadio = document.querySelector('input[name="filter-rating"]:checked');
    const selectedRating = ratingRadio && ratingRadio.value !== "" ? ratingRadio.value : "";
    return { selectedAreas, selectedPrices, selectedCuisines, selectedNiches, selectedRating };
  }

  function updateBadges() {
    const { selectedAreas, selectedPrices, selectedCuisines, selectedNiches, selectedRating } = getFilterSelections();

    const setBadge = (id, num) => {
      const el = document.querySelector(id);
      if (el) {
        el.textContent = num;
        el.hidden = num === 0;
      }
    };

    setBadge("#tab-badge-area", selectedAreas.length);
    setBadge("#tab-badge-price", selectedPrices.length);
    setBadge("#tab-badge-cuisine", selectedCuisines.length);
    setBadge("#tab-badge-niche", selectedNiches.length);
    setBadge("#tab-badge-rating", selectedRating ? 1 : 0);

    const total = selectedAreas.length + selectedPrices.length + selectedCuisines.length + selectedNiches.length + (selectedRating ? 1 : 0);
    filterCount.textContent = total;
    filterCount.hidden = total === 0;
  }

  // Price range labels
  const priceLabels = {
    "under-600": "Under ₹600",
    "600-1000": "₹600–₹1,000",
    "1000-1500": "₹1,000–₹1,500",
    "above-1500": "Above ₹1,500"
  };

  // 1. Calculate top 5 areas with most cafes 
  const areaCounts = {};
  cafes.forEach((c) => {
    if (c.area) {
      areaCounts[c.area] = (areaCounts[c.area] || 0) + 1;
    }
  });
  const top5Areas = Object.keys(areaCounts)
    .sort((a, b) => areaCounts[b] - areaCounts[a])
    .slice(0, 5);

  // 2. Calculate top 3 niches with most cafes 
  const nicheCounts = {};
  cafes.forEach((c) => {
    const n = c.niche || c.niche_type;
    if (n) {
      nicheCounts[n] = (nicheCounts[n] || 0) + 1;
    }
  });
  const top3Niches = Object.keys(nicheCounts)
    .sort((a, b) => nicheCounts[b] - nicheCounts[a])
    .slice(0, 3);

  const chipsContainer = document.querySelector("#explore-chips");
  const dialogCurrent = document.querySelector("#filter-dialog-current");

  function removeFilter(type, val) {
    if (type === "area") {
      [...document.querySelectorAll('input[name="filter-area"]')].forEach((cb) => {
        if (cb.value.toLowerCase() === val.toLowerCase()) cb.checked = false;
      });
    } else if (type === "price") {
      [...document.querySelectorAll('input[name="filter-price"]')].forEach((cb) => {
        if (cb.value === val) cb.checked = false;
      });
    } else if (type === "cuisine") {
      [...document.querySelectorAll('input[name="filter-cuisine"]')].forEach((cb) => {
        if (cb.value.toLowerCase() === val.toLowerCase()) cb.checked = false;
      });
    } else if (type === "niche") {
      [...document.querySelectorAll('input[name="filter-niche"]')].forEach((cb) => {
        if (cb.value.toLowerCase() === val.toLowerCase()) cb.checked = false;
      });
    } else if (type === "rating") {
      const anyRating = document.querySelector('input[name="filter-rating"][value=""]');
      if (anyRating) anyRating.checked = true;
    }
    updateBadges();
    syncQuickChips();
    render(true);
  }

  function toggleFilter(type, val) {
    if (type === "all") {
      clearAllFilters();
      return;
    }
    if (type === "area") {
      const cb = [...document.querySelectorAll('input[name="filter-area"]')].find((c) => c.value.toLowerCase() === val.toLowerCase());
      if (cb) cb.checked = !cb.checked;
    } else if (type === "niche") {
      const cb = [...document.querySelectorAll('input[name="filter-niche"]')].find((c) => c.value.toLowerCase() === val.toLowerCase());
      if (cb) cb.checked = !cb.checked;
    } else if (type === "rating") {
      const current = document.querySelector('input[name="filter-rating"]:checked');
      if (current && current.value === val) {
        const anyRating = document.querySelector('input[name="filter-rating"][value=""]');
        if (anyRating) anyRating.checked = true;
      } else {
        const target = document.querySelector(`input[name="filter-rating"][value="${val}"]`);
        if (target) target.checked = true;
      }
    } else if (type === "cuisine") {
      const cb = [...document.querySelectorAll('input[name="filter-cuisine"]')].find((c) => c.value.toLowerCase() === val.toLowerCase());
      if (cb) cb.checked = !cb.checked;
    } else if (type === "price") {
      const cb = [...document.querySelectorAll('input[name="filter-price"]')].find((c) => c.value === val);
      if (cb) cb.checked = !cb.checked;
    }
    updateBadges();
    syncQuickChips();
    render(true);
  }

  function syncQuickChips() {
    const { selectedAreas, selectedPrices, selectedCuisines, selectedNiches, selectedRating } = getFilterSelections();

    // 1. Compile all active filter selections
    const currentSelections = [];
    selectedAreas.forEach((a) => currentSelections.push({ type: "area", label: a, val: a }));
    selectedPrices.forEach((p) => currentSelections.push({ type: "price", label: priceLabels[p] || p, val: p }));
    selectedCuisines.forEach((c) => currentSelections.push({ type: "cuisine", label: c, val: c }));
    selectedNiches.forEach((n) => currentSelections.push({ type: "niche", label: n, val: n }));
    if (selectedRating) {
      currentSelections.push({ type: "rating", label: `★ ${selectedRating}+`, val: selectedRating });
    }

    // 2. Sync to popup dialog header
    if (dialogCurrent) {
      if (currentSelections.length > 0) {
        dialogCurrent.innerHTML = currentSelections.map((sel) => `
          <button type="button" class="filter-dialog__tag" data-remove-type="${sel.type}" data-remove-val="${escapeExploreHtml(sel.val)}" title="Remove ${escapeExploreHtml(sel.label)}">
            <span>${escapeExploreHtml(sel.label)}</span>
            <span class="filter-dialog__tag-x" aria-hidden="true">×</span>
          </button>
        `).join("");
        dialogCurrent.hidden = false;
        dialogCurrent.querySelectorAll(".filter-dialog__tag").forEach((btn) => {
          btn.addEventListener("click", () => {
            removeFilter(btn.dataset.removeType, btn.dataset.removeVal);
          });
        });
      } else {
        dialogCurrent.innerHTML = "";
        dialogCurrent.hidden = true;
      }
    }

    // 3.  quick filters row
    const standardKeys = new Set([
      ...top5Areas.map((a) => `area:${a.toLowerCase()}`),
      ...top3Niches.map((n) => `niche:${n.toLowerCase()}`),
      "rating:4.0"
    ]);

    // Extra selections from modal dialog 
    const extraSelections = currentSelections.filter((sel) => {
      const key = `${sel.type}:${sel.val.toLowerCase()}`;
      return !standardKeys.has(key);
    });

    const isAllActive = currentSelections.length === 0;

    let html = `
      <button class="explore-chip ${isAllActive ? "is-active" : ""}" type="button" data-chip-action="all">
        <span>All spots</span>
      </button>
    `;

    // Show extra active selections with '×'
    extraSelections.forEach((sel) => {
      html += `
        <button class="explore-chip is-active" type="button" data-chip-type="${sel.type}" data-chip-val="${escapeExploreHtml(sel.val)}" title="Remove ${escapeExploreHtml(sel.label)}">
          <span>${escapeExploreHtml(sel.label)}</span>
          <span class="explore-chip__remove" aria-hidden="true">×</span>
        </button>
      `;
    });

    // Top 5 Areas
    top5Areas.forEach((area) => {
      const isActive = selectedAreas.map((a) => a.toLowerCase()).includes(area.toLowerCase());
      html += `
        <button class="explore-chip ${isActive ? "is-active" : ""}" type="button" data-chip-type="area" data-chip-val="${escapeExploreHtml(area)}" title="${isActive ? "Remove" : "Filter by"} ${escapeExploreHtml(area)}">
          <span>${escapeExploreHtml(area)}</span>
          ${isActive ? `<span class="explore-chip__remove" aria-hidden="true">×</span>` : ""}
        </button>
      `;
    });

    // Top 3 Niches
    top3Niches.forEach((niche) => {
      const isActive = selectedNiches.map((n) => n.toLowerCase()).includes(niche.toLowerCase());
      html += `
        <button class="explore-chip ${isActive ? "is-active" : ""}" type="button" data-chip-type="niche" data-chip-val="${escapeExploreHtml(niche)}" title="${isActive ? "Remove" : "Filter by"} ${escapeExploreHtml(niche)}">
          <span>${escapeExploreHtml(niche)}</span>
          ${isActive ? `<span class="explore-chip__remove" aria-hidden="true">×</span>` : ""}
        </button>
      `;
    });

    // Rating 4.0+
    const isRatingActive = selectedRating === "4.0";
    html += `
      <button class="explore-chip ${isRatingActive ? "is-active" : ""}" type="button" data-chip-type="rating" data-chip-val="4.0" title="${isRatingActive ? "Remove" : "Filter by"} 4.0+">
        <span>★ 4.0+</span>
        ${isRatingActive ? `<span class="explore-chip__remove" aria-hidden="true">×</span>` : ""}
      </button>
    `;

    chipsContainer.innerHTML = html;

    chipsContainer.querySelectorAll(".explore-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.dataset.chipAction === "all") {
          clearAllFilters();
        } else {
          toggleFilter(chip.dataset.chipType, chip.dataset.chipVal);
        }
      });
    });
  }

  // URL Query Params
  let urlAreaParam = new URLSearchParams(window.location.search).get("area");
  const pathParts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (!urlAreaParam && pathParts[0] === "surat" && pathParts.length >= 2 && pathParts[1] !== "all" && pathParts[1] !== "all-spots") {
    urlAreaParam = decodeURIComponent(pathParts[1]);
  }
  if (urlAreaParam) {
    const matched = cafes.find((c) => (c.area_slug && c.area_slug.toLowerCase() === urlAreaParam.toLowerCase()) || c.area.toLowerCase() === urlAreaParam.toLowerCase());
    if (matched) {
      const cb = [...document.querySelectorAll('input[name="filter-area"]')].find((i) => i.value.toLowerCase() === matched.area.toLowerCase());
      if (cb) cb.checked = true;
    }
  }

  const urlNicheParam = new URLSearchParams(window.location.search).get("niche");
  if (urlNicheParam) {
    const matchedNiche = niches.find((n) => n.toLowerCase() === urlNicheParam.toLowerCase());
    if (matchedNiche) {
      const cb = [...document.querySelectorAll('input[name="filter-niche"]')].find((i) => i.value.toLowerCase() === matchedNiche.toLowerCase());
      if (cb) cb.checked = true;
    } else {
      search.value = urlNicheParam;
    }
  }

  syncQuickChips();

  const render = (resetVisible = false) => {
    if (resetVisible) visibleCount = 15;
    const query = search.value.trim().toLowerCase();
    const { selectedAreas, selectedPrices, selectedCuisines, selectedNiches, selectedRating } = getFilterSelections();

    const filtered = cafes.filter((cafe) => {
      const haystack = `${cafe.name} ${cafe.area} ${cafe.cuisine} ${cafe.niche || ""}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;

      // 1. Area Filter (Checkboxes)
      if (selectedAreas.length > 0 && !selectedAreas.includes(cafe.area)) return false;

      // 2. Cuisine Filter (Checkboxes)
      if (selectedCuisines.length > 0) {
        const cafeCuisines = (cafe.cuisine || "").split(",").map((item) => item.trim().toLowerCase());
        const matchesAnyCuisine = selectedCuisines.some((c) => cafeCuisines.includes(c.toLowerCase()));
        if (!matchesAnyCuisine) return false;
      }

      // 3. Category / Niche Filter (Checkboxes)
      if (selectedNiches.length > 0) {
        const cafeNiche = (cafe.niche || cafe.niche_type || "").toLowerCase();
        const matchesAnyNiche = selectedNiches.some((n) => cafeNiche === n.toLowerCase());
        if (!matchesAnyNiche) return false;
      }

      // 4. Price Range Filter (Checkboxes)
      if (selectedPrices.length > 0) {
        const p = Number(cafe.price_for_two) || 0;
        const matchesAnyPrice = selectedPrices.some((range) => {
          if (range === "under-600") return p > 0 && p < 600;
          if (range === "600-1000") return p >= 600 && p <= 1000;
          if (range === "1000-1500") return p >= 1000 && p <= 1500;
          if (range === "above-1500") return p > 1500;
          return false;
        });
        if (!matchesAnyPrice) return false;
      }

      // 5. Rating Filter (Radio: Above XX)
      if (selectedRating) {
        const r = Number(cafe.rating) || 0;
        const minRating = Number(selectedRating);
        if (r < minRating) return false;
      }

      return true;
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? "spot" : "spots"}`;
    grid.innerHTML = filtered.length ? filtered.slice(0, visibleCount).map(cafeCard).join("") : `
      <div class="empty-state">
        <div class="empty-state__card">
          <span class="empty-state__icon" aria-hidden="true">☕</span>
          <h2>No spots match that vibe<span class="title-period">.</span></h2>
          <p>Try clearing your filters or searching for another area, niche, or cuisine.</p>
          <button class="pill-link pill-link--dark" id="empty-clear-filters" type="button">Reset all filters</button>
        </div>
      </div>
    `;
    const emptyClear = grid.querySelector("#empty-clear-filters");
    if (emptyClear) {
      emptyClear.addEventListener("click", () => {
        search.value = "";
        clearAllFilters();
      });
    }
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

  function clearAllFilters() {
    document.querySelectorAll('input[name="filter-area"]:checked').forEach((i) => i.checked = false);
    document.querySelectorAll('input[name="filter-price"]:checked').forEach((i) => i.checked = false);
    document.querySelectorAll('input[name="filter-cuisine"]:checked').forEach((i) => i.checked = false);
    document.querySelectorAll('input[name="filter-niche"]:checked').forEach((i) => i.checked = false);
    const anyRating = document.querySelector('input[name="filter-rating"][value=""]');
    if (anyRating) anyRating.checked = true;
    updateBadges();
    syncQuickChips();
    filterDialog.close();
    render(true);
  }

  document.querySelector("#explore-filters").addEventListener("input", () => render(true));
  document.querySelector("#filter-button").addEventListener("click", () => filterDialog.showModal());
  document.querySelector("#close-filter").addEventListener("click", () => filterDialog.close());

  filterForm.addEventListener("change", () => {
    updateBadges();
    syncQuickChips();
  });

  document.querySelector("#clear-filters").addEventListener("click", clearAllFilters);

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBadges();
    syncQuickChips();
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
