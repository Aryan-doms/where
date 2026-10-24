/**
 * WHERE? Studio CMS — Production Admin Engine
 */

const state = {
  token: "",
  user: null,
  data: null,
  currentView: "cafes", // 'cafes' | 'cafe-editor' | 'homepage' | 'media'
  editingCafeId: null,
  isSlugAuto: true,
  editorCuisines: [],
  editorGalleryImages: [], // array of { image_id, image_url, is_cover, restaurant_name }
  editorCoverId: 0,
  filterSearch: "",
  filterArea: "",
  filterStatus: "",
  currentPage: 1,
  pageSize: 25,
  catalogSearch: "",
  mediaSearch: "",
  areaSearch: "",
  isAreaSlugAuto: true,
  pickerSearch: "",
  pickerFilter: "all",
  tableUploadCafeId: null
};

/* -------------------------------------------------------------
   UTILITIES & TOAST SYSTEM
------------------------------------------------------------- */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function showToast(message, type = "success") {
  const container = document.querySelector("#toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast is-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✓" : "✕"}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function apiRequest(action, data = null, method = "GET") {
  const url = `api/admin.php?action=${encodeURIComponent(action)}`;
  const options = { method, credentials: "same-origin", headers: {} };
  if (data) {
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = state.token;
    options.body = JSON.stringify({ ...data, action });
  }
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The CMS request failed.");
  if (result.csrf_token) state.token = result.csrf_token;
  return result;
}

async function apiUpload(action, formData) {
  const url = `api/admin.php?action=${encodeURIComponent(action)}`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "X-CSRF-Token": state.token
    },
    body: formData
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    throw new Error(text.slice(0, 150) || "The server returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || "The upload request failed.");
  if (result.csrf_token) state.token = result.csrf_token;
  return result;
}

async function uploadLocalPhoto(file, cafeId = null, restaurantName = "") {
  if (!file) return null;
  const formData = new FormData();
  formData.append("image", file);
  if (cafeId) formData.append("cafe_id", cafeId);
  if (restaurantName) formData.append("restaurant_name", restaurantName);

  const res = await apiUpload("upload_image", formData);
  if (res.image && state.data?.images) {
    if (!state.data.images.some((img) => Number(img.image_id) === Number(res.image.image_id))) {
      state.data.images.unshift(res.image);
    }
  }
  return res.image;
}

/* -------------------------------------------------------------
   VIEW ROUTING & BREADCRUMBS
------------------------------------------------------------- */
function showAdminApp() {
  const loginView = document.querySelector("#view-login");
  const appView = document.querySelector("#view-app");
  if (loginView) {
    loginView.hidden = true;
    loginView.style.display = "none";
  }
  if (appView) {
    appView.hidden = false;
    appView.style.display = "flex";
  }
}

function showLoginScreen() {
  const loginView = document.querySelector("#view-login");
  const appView = document.querySelector("#view-app");
  if (loginView) {
    loginView.hidden = false;
    loginView.style.display = "flex";
  }
  if (appView) {
    appView.hidden = true;
    appView.style.display = "none";
  }
}

function switchView(viewName, meta = {}) {
  state.currentView = viewName;

  // Toggle active view container
  document.querySelectorAll(".admin-view").forEach((v) => {
    v.classList.toggle("is-active", v.id === `stage-${viewName}`);
  });

  // Toggle sidebar active item
  document.querySelectorAll(".sidebar-nav .nav-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === viewName || (viewName === "cafe-editor" && btn.dataset.view === "cafes"));
  });

  // Update Breadcrumbs
  const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
  if (viewName === "cafes") {
    breadcrumbCurrent.textContent = "Cafes Directory";
  } else if (viewName === "cafe-editor") {
    breadcrumbCurrent.textContent = meta.cafeName ? `Cafes / ${meta.cafeName}` : "Cafes / New Spot";
  } else if (viewName === "homepage") {
    breadcrumbCurrent.textContent = "Homepage Curation";
  } else if (viewName === "media") {
    breadcrumbCurrent.textContent = "Media Library";
  } else if (viewName === "areas") {
    breadcrumbCurrent.textContent = "Areas Manager";
  }

  // Toggle Save Homepage button in topbar
  const btnSaveHomepage = document.querySelector("#btn-save-homepage");
  if (btnSaveHomepage) {
    btnSaveHomepage.hidden = (viewName !== "homepage");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* -------------------------------------------------------------
   DASHBOARD STATS & OVERVIEW
------------------------------------------------------------- */
function updateDashboardStats() {
  if (!state.data) return;
  const cafes = state.data.cafes || [];
  const published = cafes.filter((c) => c.status === "published").length;
  const drafts = cafes.filter((c) => c.status === "draft").length;
  const archived = cafes.filter((c) => c.status === "archived").length;
  const areas = state.data.areas || [];
  const images = state.data.images || [];

  // Topbar KPIs (guarded if present)
  const elTotal = document.querySelector("#topbar-kpi-total");
  if (elTotal) elTotal.textContent = cafes.length;
  const elPublished = document.querySelector("#topbar-kpi-published");
  if (elPublished) elPublished.textContent = published;
  const elAreas = document.querySelector("#topbar-kpi-areas");
  if (elAreas) elAreas.textContent = areas.length;

  // Sidebar Count Badges (guarded if present)
  const elSidebarCafes = document.querySelector("#sidebar-cafes-count");
  if (elSidebarCafes) elSidebarCafes.textContent = cafes.length;
  const elSidebarMedia = document.querySelector("#sidebar-media-count");
  if (elSidebarMedia) elSidebarMedia.textContent = images.length;
  const elSidebarAreas = document.querySelector("#sidebar-areas-count");
  if (elSidebarAreas) elSidebarAreas.textContent = areas.length;

  // Status Tab Counts
  document.querySelector("#count-status-all").textContent = cafes.length;
  document.querySelector("#count-status-published").textContent = published;
  document.querySelector("#count-status-draft").textContent = drafts;
  document.querySelector("#count-status-archived").textContent = archived;
}

/* -------------------------------------------------------------
   CAFES TABLE DIRECTORY
------------------------------------------------------------- */
function renderCafesTable() {
  const query = state.filterSearch.trim().toLowerCase();
  const areaFilter = state.filterArea;
  const statusFilter = state.filterStatus;

  const allCafes = state.data?.cafes || [];
  const filtered = allCafes.filter((cafe) => {
    const searchHaystack = `${cafe.name} ${cafe.area} ${cafe.cuisine} ${cafe.niche} ${cafe.slug || ""}`.toLowerCase();
    const matchSearch = !query || searchHaystack.includes(query);
    const matchArea = !areaFilter || String(cafe.area_id) === String(areaFilter) || cafe.area_slug === areaFilter;
    const matchStatus = !statusFilter || cafe.status === statusFilter;
    return matchSearch && matchArea && matchStatus;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / state.pageSize) || 1;
  state.currentPage = Math.min(state.currentPage, totalPages);

  const startIdx = (state.currentPage - 1) * state.pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + state.pageSize);

  // Pagination info
  const paginationInfo = document.querySelector("#table-pagination-info");
  paginationInfo.textContent = total
    ? `Showing ${startIdx + 1}–${Math.min(startIdx + state.pageSize, total)} of ${total} spots`
    : "No spots match your filter criteria";

  document.querySelector("#btn-page-prev").disabled = state.currentPage <= 1;
  document.querySelector("#btn-page-next").disabled = state.currentPage >= totalPages;

  const tbody = document.querySelector("#table-body-cafes");
  if (!pageItems.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted);">
          No cafes match the selected filters. <button type="button" class="btn btn-secondary" id="btn-reset-filters" style="margin-left: 8px;">Reset Filters</button>
        </td>
      </tr>
    `;
    const resetBtn = document.querySelector("#btn-reset-filters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.filterSearch = "";
        state.filterArea = "";
        state.filterStatus = "";
        document.querySelector("#input-search-cafes").value = "";
        document.querySelector("#select-filter-area").value = "";
        document.querySelectorAll(".status-tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.status === ""));
        renderCafesTable();
      });
    }
    return;
  }

  tbody.innerHTML = pageItems.map((cafe) => {
    const photoCount = (cafe.images || []).length;
    const coverUrl = cafe.cover_image || cafe.images?.[0]?.src || cafe.images?.[0]?.image_url;
    const statusClass = cafe.status === "published" ? "is-published" : cafe.status === "draft" ? "is-draft" : "is-archived";
    const statusLabel = cafe.status === "published" ? "Published" : cafe.status === "draft" ? "Draft" : "Archived";
    const cuisinesList = Array.isArray(cafe.cuisines) ? cafe.cuisines : (cafe.cuisine ? cafe.cuisine.split(",").map((c) => c.trim()) : []);
    const previewUrl = cafe.url_path ? `/${cafe.url_path}` : `/surat/${encodeURIComponent(cafe.area_slug || "all")}/${encodeURIComponent(cafe.slug || cafe.id)}`;

    return `
      <tr data-row-cafe-id="${escapeHtml(cafe.id)}">
        <td>
          <div class="cell-spot">
            ${coverUrl
              ? `<img src="${escapeHtml(coverUrl)}" alt="" class="cell-thumb" loading="lazy">`
              : `<div class="cell-thumb-fallback">${escapeHtml(cafe.name.slice(0, 2).toUpperCase())}</div>`}
            <div class="cell-spot-info">
              <span class="cell-spot-name">${escapeHtml(cafe.name)}</span>
              <span class="cell-spot-slug">/surat/${escapeHtml(cafe.area_slug || "area")}/${escapeHtml(cafe.slug || cafe.id)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="cell-area-badge">${escapeHtml(cafe.area)}</span>
        </td>
        <td>
          <div class="cell-cuisines">
            ${cuisinesList.slice(0, 2).map((c) => `<span class="cuisine-tag">${escapeHtml(c)}</span>`).join("")}
            ${cuisinesList.length > 2 ? `<span class="cuisine-tag">+${cuisinesList.length - 2}</span>` : ""}
          </div>
        </td>
        <td>
          <span class="cell-price">₹${Number(cafe.price_for_two || 0)}</span>
        </td>
        <td>
          <span class="cell-area-badge" style="font-weight: 500;">📷 ${photoCount}</span>
        </td>
        <td>
          <span class="status-indicator ${statusClass}">
            <span class="status-indicator-dot"></span>
            <span>${statusLabel}</span>
          </span>
        </td>
        <td>
          <div class="cell-actions" onclick="event.stopPropagation();">
            <button type="button" class="btn-action-icon" data-action="upload" data-id="${escapeHtml(cafe.id)}" title="Upload Local Photo to this Spot">📷</button>
            <button type="button" class="btn-action-icon" data-action="edit" data-id="${escapeHtml(cafe.id)}" title="Edit in Studio">✎</button>
            <a href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener" class="btn-action-icon" title="View on Live Website">↗</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Row click to edit
  tbody.querySelectorAll("tr[data-row-cafe-id]").forEach((row) => {
    row.addEventListener("click", () => {
      openCafeEditor(row.dataset.rowCafeId);
    });
  });

  // Action buttons
  tbody.querySelectorAll("[data-action='upload']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tableUploadCafeId = btn.dataset.id;
      const fileInput = document.querySelector("#input-table-cafe-file");
      if (fileInput) {
        fileInput.value = "";
        fileInput.click();
      }
    });
  });

  tbody.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCafeEditor(btn.dataset.id);
    });
  });
}

/* -------------------------------------------------------------
   CAFE STUDIO EDITOR
------------------------------------------------------------- */
function updateUrlPreviewBar() {
  const areaSelect = document.querySelector("#field-area");
  const areaId = areaSelect.value;
  const areaObj = state.data?.areas?.find((a) => String(a.area_id) === String(areaId));
  const areaSlug = areaObj?.slug || "area";
  const cafeSlug = slugify(document.querySelector("#field-slug").value || "spot-name");

  const path = `/surat/${areaSlug}/${cafeSlug}`;
  document.querySelector("#editor-live-path").textContent = path;

  const cafeId = document.querySelector("#editor-field-id").value;
  const previewLink = document.querySelector("#editor-preview-link");
  if (cafeId && cafeSlug) {
    previewLink.href = path;
    previewLink.hidden = false;
  } else {
    previewLink.hidden = true;
  }
}

function updateEditorStatusDot() {
  const select = document.querySelector("#editor-status-select");
  const dot = document.querySelector("#editor-status-dot");
  if (!select || !dot) return;
  dot.setAttribute("data-status", select.value || "draft");
}

function renderEditorCuisineTags() {
  const container = document.querySelector("#cuisines-tag-list");
  container.innerHTML = state.editorCuisines.map((tag, idx) => `
    <span class="tag-pill">
      <span>${escapeHtml(tag)}</span>
      <button type="button" class="tag-pill-btn" data-index="${idx}" aria-label="Remove ${escapeHtml(tag)}">×</button>
    </span>
  `).join("");

  container.querySelectorAll(".tag-pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      state.editorCuisines.splice(idx, 1);
      renderEditorCuisineTags();
    });
  });
}

function addEditorCuisineTag(value) {
  const clean = value.trim().replace(/^,+|,+$/g, "");
  if (!clean) return;
  const parts = clean.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (!state.editorCuisines.some((c) => c.toLowerCase() === part.toLowerCase())) {
      state.editorCuisines.push(part);
    }
  }
  renderEditorCuisineTags();
}

function renderEditorAmenities(cafe = null) {
  const availableNames = new Set(cafe?.amenities || []);
  const amenities = state.data?.amenities || [];
  const container = document.querySelector("#editor-amenities-grid");

  container.innerHTML = amenities.map((a) => {
    const isChecked = availableNames.has(a.display_name);
    return `
      <label class="amenity-toggle-card ${isChecked ? "is-active" : ""}">
        <input type="checkbox" data-amenity-name="${escapeHtml(a.display_name)}" ${isChecked ? "checked" : ""}>
        <span class="amenity-icon-check">${isChecked ? "✓" : ""}</span>
        <span class="amenity-label">${escapeHtml(a.display_name)}</span>
      </label>
    `;
  }).join("");

  container.querySelectorAll(".amenity-toggle-card input").forEach((input) => {
    input.addEventListener("change", () => {
      const card = input.closest(".amenity-toggle-card");
      card.classList.toggle("is-active", input.checked);
      card.querySelector(".amenity-icon-check").textContent = input.checked ? "✓" : "";
    });
  });
}

function renderEditorGallery() {
  const grid = document.querySelector("#editor-gallery-grid");
  document.querySelector("#editor-gallery-count").textContent = state.editorGalleryImages.length;

  if (!state.editorGalleryImages.length) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 32px 16px; text-align: center; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.85rem;">
        No photos attached to this cafe yet. Click "Select Photos", "Upload Local Photo", or paste an image URL.
      </div>
    `;
  } else {
    grid.innerHTML = state.editorGalleryImages.map((img, idx) => {
      const isCover = Number(img.image_id) === Number(state.editorCoverId) || (idx === 0 && !state.editorCoverId);
      return `
        <div class="gallery-card ${isCover ? "is-cover" : ""}" data-image-id="${img.image_id}">
          <div class="gallery-card-thumb">
            <img src="${escapeHtml(img.image_url)}" alt="" loading="lazy">
            ${isCover ? '<span class="cover-badge">★ COVER</span>' : ""}
          </div>
          <div class="gallery-card-actions">
            <button type="button" class="btn-gallery-action is-cover-btn ${isCover ? "is-active" : ""}" data-action="set-cover" data-image-id="${img.image_id}">
              ${isCover ? "✓ Cover Photo" : "Set as Cover"}
            </button>
            <div class="gallery-order-btns">
              <button type="button" class="btn-gallery-action" data-action="move-left" data-index="${idx}" ${idx === 0 ? "disabled" : ""} title="Move Left">←</button>
              <button type="button" class="btn-gallery-action" data-action="move-right" data-index="${idx}" ${idx === state.editorGalleryImages.length - 1 ? "disabled" : ""} title="Move Right">→</button>
            </div>
            <button type="button" class="btn-gallery-action btn-gallery-delete" data-action="remove" data-index="${idx}">Remove</button>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll("[data-action='set-cover']").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editorCoverId = Number(btn.dataset.imageId);
        renderEditorGallery();
      });
    });

    grid.querySelectorAll("[data-action='move-left']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        if (idx > 0) {
          const item = state.editorGalleryImages.splice(idx, 1)[0];
          state.editorGalleryImages.splice(idx - 1, 0, item);
          renderEditorGallery();
        }
      });
    });

    grid.querySelectorAll("[data-action='move-right']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        if (idx < state.editorGalleryImages.length - 1) {
          const item = state.editorGalleryImages.splice(idx, 1)[0];
          state.editorGalleryImages.splice(idx + 1, 0, item);
          renderEditorGallery();
        }
      });
    });

    grid.querySelectorAll("[data-action='remove']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        const removed = state.editorGalleryImages.splice(idx, 1)[0];
        if (Number(removed.image_id) === Number(state.editorCoverId)) {
          state.editorCoverId = state.editorGalleryImages[0]?.image_id || 0;
        }
        renderEditorGallery();
      });
    });
  }

  const pickerDialog = document.querySelector("#dialog-photo-picker");
  if (pickerDialog && pickerDialog.open) {
    renderPhotoPickerGrid();
  }
}

function openPhotoPicker() {
  const dialog = document.querySelector("#dialog-photo-picker");
  if (!dialog) return;
  state.pickerSearch = "";
  state.pickerFilter = "all";
  const searchInput = document.querySelector("#input-modal-photo-search");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".picker-tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === "all");
  });
  renderPhotoPickerGrid();
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closePhotoPicker() {
  const dialog = document.querySelector("#dialog-photo-picker");
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function renderPhotoPickerGrid() {
  const grid = document.querySelector("#modal-photos-grid");
  if (!grid) return;

  const allImages = state.data?.images || [];
  const selectedIds = new Set(state.editorGalleryImages.map((img) => Number(img.image_id)));

  const isImageLocal = (img) => {
    const url = String(img.image_url || "");
    const local = String(img.local_file || "");
    const status = String(img.source_status || "");
    return url.startsWith("assets/") || local.startsWith("assets/") || status === "local_upload" || status === "local_file";
  };

  const localImages = allImages.filter(isImageLocal);
  const urlImages = allImages.filter((img) => !isImageLocal(img));

  const countAll = document.querySelector("#count-picker-all");
  const countLocal = document.querySelector("#count-picker-local");
  const countUrl = document.querySelector("#count-picker-url");
  if (countAll) countAll.textContent = allImages.length;
  if (countLocal) countLocal.textContent = localImages.length;
  if (countUrl) countUrl.textContent = urlImages.length;

  let filtered = allImages;
  if (state.pickerFilter === "local") {
    filtered = localImages;
  } else if (state.pickerFilter === "url") {
    filtered = urlImages;
  }

  const query = state.pickerSearch.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter((img) => {
      const name = String(img.restaurant_name || "").toLowerCase();
      const url = String(img.image_url || "").toLowerCase();
      return name.includes(query) || url.includes(query);
    });
  }

  const summary = document.querySelector("#modal-selected-summary");
  if (summary) {
    summary.textContent = `${state.editorGalleryImages.length} of 24 photos selected for this spot`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="modal-picker-empty">
        <p>No photos found matching your criteria.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-empty-upload" style="margin-top: 10px;">
          📁 Upload a New Photo
        </button>
      </div>
    `;
    grid.querySelector("#btn-empty-upload")?.addEventListener("click", () => {
      document.querySelector("#input-modal-local-file")?.click();
    });
    return;
  }

  grid.innerHTML = filtered.map((img) => {
    const isAttached = selectedIds.has(Number(img.image_id));
    const isLocal = isImageLocal(img);
    const badgeText = isLocal ? "📁 Local" : "🌐 URL";
    const badgeClass = isLocal ? "badge-source-local" : "badge-source-url";
    const displayName = img.restaurant_name || (isLocal ? "Local Photo" : "Web Photo");

    return `
      <div class="modal-photo-card ${isAttached ? "is-selected" : ""}" data-image-id="${img.image_id}" title="${escapeHtml(displayName)}">
        <div class="modal-photo-thumb">
          <img src="${escapeHtml(img.image_url)}" alt="" loading="lazy">
          <span class="modal-photo-badge ${badgeClass}">${badgeText}</span>
          <span class="modal-photo-check" aria-hidden="true">✓</span>
        </div>
        <div class="modal-photo-info" title="${escapeHtml(displayName)}">
          ${escapeHtml(displayName)}
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".modal-photo-card").forEach((card) => {
    card.addEventListener("click", () => {
      const imgId = Number(card.dataset.imageId);
      const isAttached = selectedIds.has(imgId);

      if (isAttached) {
        state.editorGalleryImages = state.editorGalleryImages.filter((img) => Number(img.image_id) !== imgId);
        if (Number(state.editorCoverId) === imgId) {
          state.editorCoverId = state.editorGalleryImages[0]?.image_id || 0;
        }
      } else {
        if (state.editorGalleryImages.length >= 24) {
          showToast("Maximum 24 gallery photos allowed per spot.", "error");
          return;
        }
        const found = allImages.find((img) => Number(img.image_id) === imgId);
        if (found) {
          state.editorGalleryImages.push(found);
          if (!state.editorCoverId) state.editorCoverId = imgId;
        }
      }

      renderEditorGallery();
      renderPhotoPickerGrid();
    });
  });
}

function openCafeEditor(cafeId = null) {
  const form = document.querySelector("#form-cafe-editor");
  form.reset();

  const cafe = cafeId ? state.data?.cafes?.find((c) => c.id === cafeId) : null;
  state.editingCafeId = cafe?.id || "";
  state.isSlugAuto = !cafe;

  // Header Title
  document.querySelector("#editor-cafe-heading").textContent = cafe ? cafe.name : "Create New Spot";
  document.querySelector("#btn-editor-archive").hidden = !cafe || cafe.status === "archived";

  // Form Fields
  document.querySelector("#editor-field-id").value = cafe?.id || "";
  document.querySelector("#field-name").value = cafe?.name || "";
  document.querySelector("#field-slug").value = cafe?.slug || (cafe ? slugify(cafe.name) : "");
  document.querySelector("#field-area").value = cafe?.area_id || "";
  document.querySelector("#field-niche").value = cafe?.niche || "";
  document.querySelector("#field-price-num").value = cafe?.price_for_two || "";
  document.querySelector("#field-price-text").value = cafe?.price || "";
  document.querySelector("#field-address").value = cafe?.address || cafe?.location || "";
  document.querySelector("#field-contact").value = cafe?.contact || "";
  document.querySelector("#field-maps").value = cafe?.maps_url || "";
  document.querySelector("#field-weekday-hours").value = cafe?.weekday_hours || "";
  document.querySelector("#field-weekend-hours").value = cafe?.weekend_hours || "";
  document.querySelector("#field-hours-note").value = cafe?.hours_note || "";
  document.querySelector("#field-vibe").value = cafe?.vibe || "";
  document.querySelector("#field-more-info").value = cafe?.moreInfo || "";
  document.querySelector("#editor-status-select").value = cafe?.status || "draft";
  updateEditorStatusDot();

  // Cuisines
  state.editorCuisines = Array.isArray(cafe?.cuisines) && cafe.cuisines.length
    ? [...cafe.cuisines]
    : (cafe?.cuisine ? cafe.cuisine.split(",").map((c) => c.trim()).filter(Boolean) : []);
  renderEditorCuisineTags();

  // Amenities
  renderEditorAmenities(cafe);

  // Gallery
  state.editorGalleryImages = (cafe?.images || []).map((img) => ({
    image_id: img.image_id,
    image_url: img.src || img.image_url,
    restaurant_name: cafe.name
  }));
  state.editorCoverId = cafe?.images?.[0]?.image_id || 0;
  renderEditorGallery();

  updateUrlPreviewBar();
  switchView("cafe-editor", { cafeName: cafe?.name });
}

/* -------------------------------------------------------------
   HOMEPAGE CURATION VIEW (SIMPLE & UNCLUTTERED)
------------------------------------------------------------- */
function initHomepageCurationState() {
  if (!state.homepageCuratedSpots || !state.homepageCuratedSpots.length) {
    state.homepageCuratedSpots = [...(state.data?.featured || [])].slice(0, 6);
  }

  const allAreas = state.data?.areas || [];
  const savedHomepageAreas = state.data?.homepage_areas || [];

  if (!state.homepageCuratedAreas || !state.homepageCuratedAreas.length) {
    state.homepageCuratedAreas = [];
    for (let i = 1; i <= 11; i++) {
      const existing = savedHomepageAreas.find((ha) => Number(ha.position) === i) || savedHomepageAreas[i - 1];
      const defaultArea = existing || allAreas[i - 1] || null;
      state.homepageCuratedAreas.push({
        position: i,
        area_id: defaultArea ? Number(defaultArea.area_id) : "",
        image_1: existing?.image_1 || "",
        image_2: existing?.image_2 || "",
        image_3: existing?.image_3 || ""
      });
    }
  }
}

function renderHomepageCuration() {
  initHomepageCurationState();
  renderCuratedSpots();
  renderCuratedAreas();
}

/* Helper: Format Rating Badge (matches explore/cafe-details style) */
function getCafeRatingBadge(rating) {
  if (!rating) return "";
  const numRating = Number(rating) || 0;
  let ratingTier = "low";
  if (numRating >= 4.0) {
    ratingTier = "high";
  } else if (numRating >= 3.5) {
    ratingTier = "good";
  } else if (numRating >= 3.0) {
    ratingTier = "mid";
  }
  return `<span class="explore-card__rating explore-card__rating--${ratingTier}"><span class="explore-card__star" aria-hidden="true">★</span> ${escapeHtml(rating)}</span>`;
}

/* 1. SPOTS WE LOVE (MAX 6 SPOTS ONLY) */
function renderCuratedSpots() {
  const container = document.querySelector("#curated-spots-list");
  const countPill = document.querySelector("#hp-featured-count-pill");
  if (!container) return;

  const spots = state.homepageCuratedSpots || [];
  if (countPill) {
    countPill.textContent = `${spots.length} / 6 spots selected`;
  }

  let html = "";
  // Render exact 6 slots
  for (let i = 0; i < 6; i++) {
    const cafeId = spots[i];
    if (cafeId) {
      const cafe = (state.data?.cafes || []).find((c) => c.id === cafeId);
      const name = cafe ? cafe.name : cafeId;
      const area = cafe ? cafe.area : "Surat";
      const ratingBadge = getCafeRatingBadge(cafe?.rating);
      const thumb = cafe?.cover_image || cafe?.images?.[0]?.src || "where.png";

      html += `
        <div class="curated-spot-row" data-id="${escapeHtml(cafeId)}" data-idx="${i}">
          <div class="curated-spot-pos">${i + 1}</div>
          <img class="curated-spot-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(name)}" onerror="this.src='where.png'">
          <div class="curated-spot-info">
            <div class="curated-spot-name">${escapeHtml(name)}</div>
            <div class="curated-spot-meta" style="display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(area)}</span>
              ${ratingBadge ? `<span>·</span>${ratingBadge}` : ""}
            </div>
          </div>
          <div class="curated-spot-actions">
            <button type="button" class="btn-spot-action btn-move-spot" data-idx="${i}" data-dir="-1" title="Move Up" ${i === 0 ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>▲</button>
            <button type="button" class="btn-spot-action btn-move-spot" data-idx="${i}" data-dir="1" title="Move Down" ${i === spots.length - 1 ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>▼</button>
            <button type="button" class="btn-spot-action btn-spot-remove" data-idx="${i}" title="Remove from Spots We Love">✕</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="curated-spot-row is-empty">
          <div class="curated-spot-pos" style="color: var(--text-subtle);">${i + 1}</div>
          <div class="curated-empty-text">Empty slot — search above to add a cafe</div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // Reorder handlers
  container.querySelectorAll(".btn-move-spot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const dir = Number(btn.dataset.dir);
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= spots.length) return;
      const temp = spots[idx];
      spots[idx] = spots[targetIdx];
      spots[targetIdx] = temp;
      renderCuratedSpots();
    });
  });

  // Remove handler
  container.querySelectorAll(".btn-spot-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      spots.splice(idx, 1);
      renderCuratedSpots();
    });
  });
}

// Search dropdown for Spots We Love
function setupFeaturedSearch() {
  const searchInput = document.querySelector("#hp-search-spots");
  const dropdown = document.querySelector("#hp-search-dropdown");
  if (!searchInput || !dropdown) return;

  const handleSearch = () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      dropdown.hidden = true;
      dropdown.innerHTML = "";
      return;
    }

    const currentSpots = new Set(state.homepageCuratedSpots || []);
    const publishedCafes = (state.data?.cafes || []).filter((c) => c.status === "published" && !currentSpots.has(c.id));

    const matches = publishedCafes.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.area || "").toLowerCase().includes(q) ||
        (c.niche || "").toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q)
      );
    }).slice(0, 8);

    if (!matches.length) {
      dropdown.innerHTML = `<div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">No matching published cafes found</div>`;
      dropdown.hidden = false;
      return;
    }

    dropdown.innerHTML = matches.map((c) => {
      const thumb = c.cover_image || c.images?.[0]?.src || "where.png";
      const ratingBadge = getCafeRatingBadge(c.rating);
      return `
        <div class="hp-search-item" data-id="${escapeHtml(c.id)}">
          <div class="hp-search-item-info">
            <img class="hp-search-item-thumb" src="${escapeHtml(thumb)}" alt="" onerror="this.src='where.png'">
            <div class="hp-search-item-text">
              <div class="hp-search-item-title">${escapeHtml(c.name)}</div>
              <div class="hp-search-item-meta" style="display: flex; align-items: center; gap: 6px;">
                <span>${escapeHtml(c.area || "Surat")}</span>
                ${ratingBadge ? `<span>·</span>${ratingBadge}` : ""}
              </div>
            </div>
          </div>
          <button type="button" class="hp-search-btn-add">+ Add</button>
        </div>
      `;
    }).join("");

    dropdown.hidden = false;

    dropdown.querySelectorAll(".hp-search-item").forEach((item) => {
      item.addEventListener("click", () => {
        const cafeId = item.dataset.id;
        if ((state.homepageCuratedSpots || []).length >= 6) {
          showToast("Maximum 6 spots reached. Remove a spot to add this one.", "error");
          return;
        }
        state.homepageCuratedSpots.push(cafeId);
        searchInput.value = "";
        dropdown.hidden = true;
        renderCuratedSpots();
        showToast("Spot added to Spots We Love!");
      });
    });
  };

  searchInput.addEventListener("input", handleSearch);
  searchInput.addEventListener("focus", handleSearch);

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
    }
  });
}

/* 2. AREA DISCOVERY (11 HOMEPAGE AREAS) */
function renderCuratedAreas() {
  const container = document.querySelector("#curated-areas-list");
  if (!container) return;

  const allAreas = state.data?.areas || [];
  const areas = state.homepageCuratedAreas || [];

  container.innerHTML = areas.map((slot, idx) => {
    const areaOptions = allAreas.map((a) => {
      const selected = Number(a.area_id) === Number(slot.area_id) ? "selected" : "";
      return `<option value="${escapeHtml(a.area_id)}" ${selected}>${escapeHtml(a.display_name)} (${a.cafe_count || 0} spots)</option>`;
    }).join("");

    return `
      <div class="curated-area-row" data-idx="${idx}">
        <span class="curated-area-pos">${idx + 1}</span>
        <select class="curated-area-select" data-idx="${idx}" aria-label="Select Area for slot #${idx + 1}">
          <option value="">-- Choose Area --</option>
          ${areaOptions}
        </select>

        <div class="curated-area-photos">
          ${[1, 2, 3].map((num) => {
            const imgKey = `image_${num}`;
            const imgVal = slot[imgKey] || "";
            return `
              <div class="curated-photo-chip">
                <img class="curated-photo-thumb" id="hp-area-thumb-${idx}-${num}" src="${escapeHtml(imgVal || 'where.png')}" alt="Img ${num}" onerror="this.src='where.png'">
                <input type="url" class="curated-photo-input" data-idx="${idx}" data-img="${num}" value="${escapeHtml(imgVal)}" placeholder="Photo ${num} URL...">
              </div>
            `;
          }).join("")}
          <button type="button" class="btn-auto-photos" data-idx="${idx}" title="Auto-fill 3 photos from cafes in this area">Auto ⟳</button>
        </div>

        <div class="curated-area-reorder">
          <button type="button" class="btn-spot-action btn-move-area" data-idx="${idx}" data-dir="-1" title="Move Up" ${idx === 0 ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>▲</button>
          <button type="button" class="btn-spot-action btn-move-area" data-idx="${idx}" data-dir="1" title="Move Down" ${idx === areas.length - 1 ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>▼</button>
        </div>
      </div>
    `;
  }).join("");

  // Area select changes
  container.querySelectorAll(".curated-area-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.idx);
      areas[idx].area_id = sel.value ? Number(sel.value) : "";
    });
  });

  // Photo URL input changes
  container.querySelectorAll(".curated-photo-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      const num = Number(inp.dataset.img);
      const val = inp.value.trim();
      areas[idx][`image_${num}`] = val;
      const thumb = document.querySelector(`#hp-area-thumb-${idx}-${num}`);
      if (thumb) {
        thumb.src = val || "where.png";
      }
    });
  });

  // Auto ⟳ button: auto-fill 3 cafe photos from that area
  container.querySelectorAll(".btn-auto-photos").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const areaId = Number(areas[idx].area_id);
      if (!areaId) {
        showToast("Please select an area first.", "info");
        return;
      }

      const areaCafes = (state.data?.cafes || []).filter((c) => Number(c.area_id) === areaId);
      const areaPhotos = areaCafes.flatMap((c) => (c.images || []).map((img) => img.src || img.image_url)).filter(Boolean);
      const pool = areaPhotos.length > 0 ? areaPhotos : (state.data?.images || []).map((i) => i.image_url).filter(Boolean);

      if (!pool.length) {
        showToast("No photos found for this area in catalog.", "info");
        return;
      }

      // Shuffle and pick 3
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      areas[idx].image_1 = shuffled[0] || "";
      areas[idx].image_2 = shuffled[1] || shuffled[0] || "";
      areas[idx].image_3 = shuffled[2] || shuffled[1] || shuffled[0] || "";

      renderCuratedAreas();
      showToast(`Auto-filled 3 photos from ${areaCafes[0]?.name || "area"}!`);
    });
  });

  // Move up/down handlers
  container.querySelectorAll(".btn-move-area").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const dir = Number(btn.dataset.dir);
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= areas.length) return;
      const temp = areas[idx];
      areas[idx] = areas[targetIdx];
      areas[targetIdx] = temp;
      areas.forEach((a, i) => { a.position = i + 1; });
      renderCuratedAreas();
    });
  });
}

/* -------------------------------------------------------------
   MEDIA LIBRARY VIEW
------------------------------------------------------------- */
function renderMediaLibrary() {
  const container = document.querySelector("#media-gallery-container");
  const query = state.mediaSearch.trim().toLowerCase();
  const images = (state.data?.images || []).filter((img) => {
    return !query || (img.restaurant_name || "").toLowerCase().includes(query) || (img.image_url || "").toLowerCase().includes(query);
  });

  const countInfo = document.querySelector("#media-library-count-info");
  if (countInfo) countInfo.textContent = `Showing ${images.length} of ${state.data?.images?.length || 0} photos`;

  container.innerHTML = images.slice(0, 120).map((img) => `
    <div class="media-catalog-card">
      <img src="${escapeHtml(img.image_url)}" alt="" loading="lazy">
      <div class="media-catalog-info">
        <strong>${escapeHtml(img.restaurant_name || "Catalog Photo")}</strong>
        <small>${escapeHtml(img.source_status || "Remote CDN")}</small>
      </div>
    </div>
  `).join("");
}

/* -------------------------------------------------------------
   AREAS MANAGER VIEW & MODAL
------------------------------------------------------------- */
function renderAreasManager() {
  const container = document.querySelector("#table-body-areas");
  if (!container) return;
  const query = (state.areaSearch || "").trim().toLowerCase();
  const areas = (state.data?.areas || []).filter((a) => {
    return !query || a.display_name.toLowerCase().includes(query) || (a.slug || "").toLowerCase().includes(query);
  });

  const countInfo = document.querySelector("#areas-manager-count-info");
  if (countInfo) countInfo.textContent = `${areas.length} Areas Configured`;

  if (!areas.length) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 48px; color: var(--text-muted);">
          No areas match your search.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = areas.map((a) => {
    const count = Number(a.cafe_count || 0);
    const livePath = `/surat/${escapeHtml(a.slug || "")}`;
    const liveUrl = `explore.html?area=${encodeURIComponent(a.slug || a.display_name)}`;
    return `
      <tr data-area-id="${escapeHtml(a.area_id)}">
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(a.display_name)}</div>
        </td>
        <td>
          <code style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-subtle); padding: 2px 6px; border-radius: var(--radius-sm);">${escapeHtml(a.slug || "")}</code>
        </td>
        <td>
          <a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-blue); text-decoration: none;">
            ${escapeHtml(livePath)} ↗
          </a>
        </td>
        <td>
          <span class="cell-badge ${count > 0 ? "has-spots" : ""}">${count} ${count === 1 ? "spot" : "spots"}</span>
        </td>
        <td>
          <div class="cell-actions">
            <button type="button" class="btn-action-icon btn-edit-area" data-area-id="${escapeHtml(a.area_id)}" title="Edit Area">✎</button>
            <button type="button" class="btn-action-icon btn-delete-area" data-area-id="${escapeHtml(a.area_id)}" data-count="${count}" title="Delete Area" style="color: var(--danger);">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Edit area buttons
  container.querySelectorAll(".btn-edit-area").forEach((btn) => {
    btn.addEventListener("click", () => {
      const areaId = Number(btn.dataset.areaId);
      const area = state.data?.areas?.find((a) => Number(a.area_id) === areaId);
      if (area) openAreaModal(area);
    });
  });

  // Delete area buttons
  container.querySelectorAll(".btn-delete-area").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const areaId = Number(btn.dataset.areaId);
      const count = Number(btn.dataset.count);
      const area = state.data?.areas?.find((a) => Number(a.area_id) === areaId);
      if (!area) return;

      if (count > 0) {
        showToast(`Cannot delete '${area.display_name}': ${count} cafe(s) are located in this area. Reassign or archive them first.`, "error");
        return;
      }

      if (!window.confirm(`Are you sure you want to delete the area '${area.display_name}'?`)) {
        return;
      }

      try {
        await apiRequest("delete_area", { area_id: areaId }, "POST");
        await loadStudioData();
        showToast(`Area '${area.display_name}' deleted successfully.`);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

function openAreaModal(area = null) {
  const dialog = document.querySelector("#dialog-area-editor");
  const form = document.querySelector("#form-area-editor");
  form.reset();

  state.isAreaSlugAuto = !area;
  document.querySelector("#area-field-id").value = area?.area_id || "";
  document.querySelector("#area-field-name").value = area?.display_name || "";
  document.querySelector("#area-field-slug").value = area?.slug || "";
  document.querySelector("#area-modal-title").textContent = area ? `Edit Area: ${area.display_name}` : "Create New Area";
  updateAreaSlugPreview();

  dialog.showModal();
}

function closeAreaModal() {
  const dialog = document.querySelector("#dialog-area-editor");
  dialog.close();
}

function updateAreaSlugPreview() {
  const slug = document.querySelector("#area-field-slug").value.trim() || "...";
  const previewSpan = document.querySelector("#area-slug-preview span");
  if (previewSpan) previewSpan.textContent = slug;
}

/* -------------------------------------------------------------
   APP INITIALIZATION & DATA LOADING
------------------------------------------------------------- */
async function loadStudioData() {
  const data = await apiRequest("dashboard");
  state.data = data;

  updateDashboardStats();

  // Populate area filter
  const filterArea = document.querySelector("#select-filter-area");
  filterArea.innerHTML = `<option value="">All Areas (${data.areas.length})</option>` + data.areas.map((a) => `
    <option value="${escapeHtml(a.slug)}">${escapeHtml(a.display_name)}</option>
  `).join("");

  // Populate editor area select
  const editorArea = document.querySelector("#field-area");
  editorArea.innerHTML = '<option value="">Select Area</option>' + data.areas.map((a) => `
    <option value="${Number(a.area_id)}">${escapeHtml(a.display_name)} (${escapeHtml(a.slug)})</option>
  `).join("");

  state.homepageCuratedSpots = [...(data.featured || [])].slice(0, 6);
  state.homepageCuratedAreas = null;

  renderCafesTable();
  renderHomepageCuration();
  renderMediaLibrary();
  renderAreasManager();

  // Transition to App UI
  showAdminApp();
}

/* -------------------------------------------------------------
   EVENT HANDLERS & LISTENERS
------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  // Login Submit
  document.querySelector("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.querySelector("#btn-login-submit");
    btn.disabled = true;
    btn.textContent = "Signing in...";
    const form = new FormData(e.currentTarget);

    try {
      const res = await apiRequest("login", {
        username: form.get("username"),
        password: form.get("password")
      }, "POST");
      state.token = res.csrf_token;
      state.user = res.user;

      document.querySelector("#sidebar-user-name").textContent = res.user?.username || "Admin";
      document.querySelector("#sidebar-user-avatar").textContent = (res.user?.username || "A").slice(0, 1).toUpperCase();

      await loadStudioData();
      showToast("Signed in to WHERE? Studio.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in to Studio";
    }
  });

  // Logout
  document.querySelector("#btn-logout").addEventListener("click", async () => {
    try {
      await apiRequest("logout", {}, "POST");
      window.location.reload();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Nav Switchers
  document.querySelectorAll(".sidebar-nav [data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  // Topbar New Spot & Main New Spot
  const handleNewSpot = () => openCafeEditor(null);
  document.querySelector("#btn-topbar-new-spot")?.addEventListener("click", handleNewSpot);
  document.querySelector("#btn-create-spot-main")?.addEventListener("click", handleNewSpot);

  // Back to directory from editor
  document.querySelector("#btn-editor-back").addEventListener("click", () => {
    switchView("cafes");
  });

  // Search & Filter Listeners on Table
  document.querySelector("#input-search-cafes").addEventListener("input", (e) => {
    state.filterSearch = e.target.value;
    state.currentPage = 1;
    renderCafesTable();
  });

  document.querySelector("#select-filter-area").addEventListener("change", (e) => {
    state.filterArea = e.target.value;
    state.currentPage = 1;
    renderCafesTable();
  });

  document.querySelectorAll(".status-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-tab-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      state.filterStatus = btn.dataset.status;
      state.currentPage = 1;
      renderCafesTable();
    });
  });

  // Pagination buttons
  document.querySelector("#btn-page-prev").addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderCafesTable();
    }
  });

  document.querySelector("#btn-page-next").addEventListener("click", () => {
    state.currentPage++;
    renderCafesTable();
  });

  // Slug Generation Listeners
  const nameInput = document.querySelector("#field-name");
  const slugInput = document.querySelector("#field-slug");
  const areaSelect = document.querySelector("#field-area");

  nameInput.addEventListener("input", () => {
    if (state.isSlugAuto) {
      slugInput.value = slugify(nameInput.value);
    }
    updateUrlPreviewBar();
  });

  slugInput.addEventListener("input", () => {
    state.isSlugAuto = false;
    updateUrlPreviewBar();
  });

  document.querySelector("#btn-sync-slug").addEventListener("click", () => {
    slugInput.value = slugify(nameInput.value);
    state.isSlugAuto = true;
    updateUrlPreviewBar();
    showToast("Slug updated from name.");
  });

  areaSelect.addEventListener("change", updateUrlPreviewBar);
  document.querySelector("#editor-status-select").addEventListener("change", updateEditorStatusDot);

  // Cuisines Tag Input Listeners
  const cuisineInput = document.querySelector("#input-new-cuisine");
  cuisineInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEditorCuisineTag(cuisineInput.value);
      cuisineInput.value = "";
    } else if (e.key === "Backspace" && !cuisineInput.value && state.editorCuisines.length) {
      state.editorCuisines.pop();
      renderEditorCuisineTags();
    }
  });

  document.querySelectorAll(".tag-suggestions .btn-suggest").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.nicheVal) {
        document.querySelector("#field-niche").value = btn.dataset.nicheVal;
      } else {
        addEditorCuisineTag(btn.textContent);
      }
    });
  });

  // Add Custom Amenity
  document.querySelector("#btn-add-amenity").addEventListener("click", () => {
    const input = document.querySelector("#input-new-amenity");
    const name = input.value.trim();
    if (!name) return;

    const exists = state.data?.amenities?.some((a) => a.display_name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast("That amenity already exists.", "error");
      return;
    }

    if (!state.data.amenities) state.data.amenities = [];
    state.data.amenities.push({ amenity_key: slugify(name), display_name: name });
    input.value = "";

    // Auto-check new amenity
    const currentlyChecked = new Set([...document.querySelectorAll("#editor-amenities-grid input:checked")].map((i) => i.dataset.amenityName));
    currentlyChecked.add(name);
    renderEditorAmenities({ amenities: [...currentlyChecked] });
    showToast(`Added amenity '${name}'.`);
  });

  // Add Gallery Remote URL
  document.querySelector("#btn-add-gallery-url").addEventListener("click", async () => {
    const input = document.querySelector("#input-gallery-url");
    const url = input.value.trim();
    if (!url || !url.startsWith("http")) {
      showToast("Please enter a valid http/https image URL.", "error");
      return;
    }
    const name = document.querySelector("#field-name").value.trim() || "Cafe Media";
    try {
      const res = await apiRequest("add_image_url", { image_url: url, restaurant_name: name }, "POST");
      input.value = "";
      if (res.image) {
        state.data.images.unshift(res.image);
        state.editorGalleryImages.push(res.image);
        if (!state.editorCoverId) state.editorCoverId = res.image.image_id;
        renderEditorGallery();
        updateDashboardStats();
        showToast("Photo added and attached.");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Open Photo Picker Dialog (Local & URLs)
  document.querySelector("#btn-open-photo-picker")?.addEventListener("click", () => {
    openPhotoPicker();
  });

  // Close Photo Picker Dialog
  document.querySelector("#btn-close-photo-picker")?.addEventListener("click", () => {
    closePhotoPicker();
  });

  document.querySelector("#btn-done-photo-picker")?.addEventListener("click", () => {
    closePhotoPicker();
  });

  // Close when clicking modal backdrop
  document.querySelector("#dialog-photo-picker")?.addEventListener("click", (e) => {
    if (e.target.id === "dialog-photo-picker") {
      closePhotoPicker();
    }
  });

  // Photo Picker Search
  document.querySelector("#input-modal-photo-search")?.addEventListener("input", (e) => {
    state.pickerSearch = e.target.value;
    renderPhotoPickerGrid();
  });

  // Photo Picker Filter Tabs (All / Local / URLs)
  document.querySelectorAll(".picker-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".picker-tab-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.pickerFilter = btn.dataset.filter || "all";
      renderPhotoPickerGrid();
    });
  });

  // Editor: Upload Local Photo Button
  document.querySelector("#btn-upload-local-photo")?.addEventListener("click", () => {
    const input = document.querySelector("#input-cafe-local-file");
    if (input) {
      input.value = "";
      input.click();
    }
  });

  document.querySelector("#input-cafe-local-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cafeName = document.querySelector("#field-name")?.value?.trim() || "Cafe Media";
    try {
      showToast("Uploading local photo...", "info");
      const image = await uploadLocalPhoto(file, state.editingCafeId, cafeName);
      if (image) {
        if (!state.editorGalleryImages.some((img) => Number(img.image_id) === Number(image.image_id))) {
          state.editorGalleryImages.push(image);
          if (!state.editorCoverId) state.editorCoverId = image.image_id;
        }
        renderEditorGallery();
        updateDashboardStats();
        showToast("Photo uploaded and added to gallery!");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      e.target.value = "";
    }
  });

  // Modal: Upload Local Photo Button
  document.querySelector("#btn-modal-upload-photo")?.addEventListener("click", () => {
    const input = document.querySelector("#input-modal-local-file");
    if (input) {
      input.value = "";
      input.click();
    }
  });

  document.querySelector("#input-modal-local-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cafeName = document.querySelector("#field-name")?.value?.trim() || "Cafe Media";
    try {
      showToast("Uploading local photo...", "info");
      const image = await uploadLocalPhoto(file, state.editingCafeId, cafeName);
      if (image) {
        if (!state.editorGalleryImages.some((img) => Number(img.image_id) === Number(image.image_id))) {
          state.editorGalleryImages.push(image);
          if (!state.editorCoverId) state.editorCoverId = image.image_id;
        }
        renderEditorGallery();
        renderPhotoPickerGrid();
        updateDashboardStats();
        showToast("Photo uploaded and selected!");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      e.target.value = "";
    }
  });

  // Cafes Directory Table: Upload Local Photo Button Listener
  document.querySelector("#input-table-cafe-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !state.tableUploadCafeId) return;
    const cafe = state.data?.cafes?.find((c) => c.id === state.tableUploadCafeId);
    try {
      showToast(`Uploading photo for ${cafe?.name || "spot"}...`, "info");
      await uploadLocalPhoto(file, state.tableUploadCafeId, cafe?.name || "Local Photo");
      await loadStudioData();
      showToast(`Photo uploaded and linked to ${cafe?.name || "spot"}!`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.tableUploadCafeId = null;
      e.target.value = "";
    }
  });

  // Media Library Search
  document.querySelector("#input-search-media").addEventListener("input", (e) => {
    state.mediaSearch = e.target.value;
    renderMediaLibrary();
  });

  // Add Standalone Media to Catalog
  document.querySelector("#btn-standalone-add-media").addEventListener("click", async () => {
    const urlInput = document.querySelector("#input-standalone-media-url");
    const nameInput = document.querySelector("#input-standalone-media-name");
    const url = urlInput.value.trim();
    const name = nameInput.value.trim() || "Catalog Photo";
    if (!url || !url.startsWith("http")) {
      showToast("Enter a valid http/https image URL.", "error");
      return;
    }
    try {
      const res = await apiRequest("add_image_url", { image_url: url, restaurant_name: name }, "POST");
      urlInput.value = "";
      nameInput.value = "";
      if (res.image) {
        state.data.images.unshift(res.image);
        renderMediaLibrary();
        updateDashboardStats();
        showToast("Image added to catalog.");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Save Cafe (Main Editor Action)
  document.querySelector("#btn-editor-save").addEventListener("click", async () => {
    const form = document.querySelector("#form-cafe-editor");
    const name = document.querySelector("#field-name").value.trim();
    const areaId = document.querySelector("#field-area").value;
    const address = document.querySelector("#field-address").value.trim();
    const niche = document.querySelector("#field-niche").value.trim();

    if (!name || !areaId || !address || !niche) {
      showToast("Please fill in Spot Name, Area, Category, and Address.", "error");
      return;
    }

    showToast("Saving spot details...", "info");

    const cafePayload = {
      id: document.querySelector("#editor-field-id").value,
      name,
      slug: document.querySelector("#field-slug").value,
      area_id: areaId,
      niche_type: niche,
      cuisines: state.editorCuisines,
      cuisine_source: state.editorCuisines.join(", "),
      price_for_two: document.querySelector("#field-price-num").value,
      price_range: document.querySelector("#field-price-text").value,
      contact: document.querySelector("#field-contact").value,
      maps_url: document.querySelector("#field-maps").value,
      address,
      vibe: document.querySelector("#field-vibe").value,
      weekday_hours: document.querySelector("#field-weekday-hours").value,
      weekend_hours: document.querySelector("#field-weekend-hours").value,
      hours_note: document.querySelector("#field-hours-note").value,
      more_info: document.querySelector("#field-more-info").value,
      status: document.querySelector("#editor-status-select").value
    };

    try {
      // 1. Save Cafe Record
      const saved = await apiRequest("save_cafe", cafePayload, "POST");
      const cafeId = saved.cafe_id;

      // 2. Save Amenities
      const amenities = [...document.querySelectorAll("#editor-amenities-grid input")].map((input) => ({
        name: input.dataset.amenityName,
        available: input.checked
      }));
      await apiRequest("save_amenities", { cafe_id: cafeId, amenities }, "POST");

      // 3. Save Gallery
      const imageIds = state.editorGalleryImages.map((img) => Number(img.image_id));
      await apiRequest("save_gallery", {
        cafe_id: cafeId,
        image_ids: imageIds,
        cover_image_id: state.editorCoverId
      }, "POST");

      await loadStudioData();
      showToast(`'${name}' saved successfully!`);
      openCafeEditor(cafeId);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Archive Cafe
  document.querySelector("#btn-editor-archive").addEventListener("click", async () => {
    const id = document.querySelector("#editor-field-id").value;
    if (!id || !window.confirm("Archive this spot? It will be hidden from public discovery.")) return;
    try {
      await apiRequest("archive_cafe", { cafe_id: id }, "POST");
      await loadStudioData();
      showToast("Spot archived.");
      switchView("cafes");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Initialize search for adding spots to Spots We Love
  setupFeaturedSearch();

  // Save Homepage
  document.querySelector("#btn-save-homepage").addEventListener("click", async () => {
    showToast("Saving homepage curation...", "info");

    // 1. Featured Choices (SPOTS WE LOVE. - Max 6)
    const featured = (state.homepageCuratedSpots || []).slice(0, 6);
    if (featured.length === 0) {
      showToast("Please add at least one spot to Spots We Love.", "error");
      return;
    }

    // 2. Area Discovery (11 Homepage Areas & Hover Images)
    const areas = (state.homepageCuratedAreas || []).map((slot, i) => ({
      area_id: Number(slot.area_id),
      position: i + 1,
      image_1: (slot.image_1 || "").trim(),
      image_2: (slot.image_2 || "").trim(),
      image_3: (slot.image_3 || "").trim()
    })).filter((a) => a.area_id > 0);

    const chosenAreaIds = new Set(areas.map((a) => a.area_id));
    if (chosenAreaIds.size !== areas.length) {
      showToast("Each homepage area slot must be a unique area.", "error");
      return;
    }

    if (areas.length === 0) {
      showToast("Please select at least one area for the homepage.", "error");
      return;
    }

    try {
      await apiRequest("save_homepage", {
        featured,
        areas
      }, "POST");
      await loadStudioData();
      showToast("Homepage curation saved successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Areas Manager Listeners
  const btnCreateArea = document.querySelector("#btn-create-area-main");
  if (btnCreateArea) {
    btnCreateArea.addEventListener("click", () => openAreaModal(null));
  }

  const btnCloseAreaModal = document.querySelector("#btn-close-area-modal");
  if (btnCloseAreaModal) {
    btnCloseAreaModal.addEventListener("click", closeAreaModal);
  }

  const btnCancelAreaModal = document.querySelector("#btn-cancel-area-modal");
  if (btnCancelAreaModal) {
    btnCancelAreaModal.addEventListener("click", closeAreaModal);
  }

  const inputSearchAreas = document.querySelector("#input-search-areas");
  if (inputSearchAreas) {
    inputSearchAreas.addEventListener("input", (e) => {
      state.areaSearch = e.target.value;
      renderAreasManager();
    });
  }

  const areaFieldName = document.querySelector("#area-field-name");
  const areaFieldSlug = document.querySelector("#area-field-slug");
  if (areaFieldName && areaFieldSlug) {
    areaFieldName.addEventListener("input", () => {
      if (state.isAreaSlugAuto) {
        areaFieldSlug.value = slugify(areaFieldName.value);
        updateAreaSlugPreview();
      }
    });

    areaFieldSlug.addEventListener("input", () => {
      state.isAreaSlugAuto = false;
      updateAreaSlugPreview();
    });

    const btnSyncAreaSlug = document.querySelector("#btn-sync-area-slug");
    if (btnSyncAreaSlug) {
      btnSyncAreaSlug.addEventListener("click", () => {
        areaFieldSlug.value = slugify(areaFieldName.value);
        state.isAreaSlugAuto = true;
        updateAreaSlugPreview();
      });
    }
  }

  const formAreaEditor = document.querySelector("#form-area-editor");
  if (formAreaEditor) {
    formAreaEditor.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.querySelector("#area-field-id").value;
      const displayName = document.querySelector("#area-field-name").value.trim();
      const slug = document.querySelector("#area-field-slug").value.trim();

      if (!displayName) {
        showToast("Please provide an Area Name.", "error");
        return;
      }

      const saveBtn = document.querySelector("#btn-save-area-submit");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        await apiRequest("save_area", {
          area_id: id ? Number(id) : null,
          display_name: displayName,
          slug
        }, "POST");

        await loadStudioData();
        closeAreaModal();
        showToast(`Area '${displayName}' saved successfully!`);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Area";
      }
    });
  }

  // Global Keybindings (e.g. Escape to return to directory)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const areaDialog = document.querySelector("#dialog-area-editor");
      if (areaDialog && areaDialog.open) {
        closeAreaModal();
        return;
      }
      if (state.currentView === "cafe-editor") {
        switchView("cafes");
      }
    }
  });

  // Initial State Check
  (async function init() {
    try {
      const stateRes = await apiRequest("state");
      state.token = stateRes.csrf_token;
      if (stateRes.user?.role === "admin") {
        state.user = stateRes.user;
        document.querySelector("#sidebar-user-name").textContent = stateRes.user.username || "Admin";
        document.querySelector("#sidebar-user-avatar").textContent = (stateRes.user.username || "A").slice(0, 1).toUpperCase();
        await loadStudioData();
        showAdminApp();
      } else {
        showLoginScreen();
      }
    } catch (err) {
      showLoginScreen();
    }
  })();
});
