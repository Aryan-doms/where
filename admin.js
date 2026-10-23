const cmsState = {
  token: "",
  data: null,
  cafeId: "",
  pendingCafeId: ""
};

function cmsEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function cmsShowMessage(message, isError = false) {
  const element = document.querySelector("#cms-message");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function cmsRequest(action, data = null, method = "GET") {
  const url = `api/admin.php?action=${encodeURIComponent(action)}`;
  const options = { method, credentials: "same-origin", headers: {} };
  if (data) {
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = cmsState.token;
    options.body = JSON.stringify({ ...data, action });
  }
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The CMS request failed.");
  if (result.csrf_token) cmsState.token = result.csrf_token;
  return result;
}

function cmsCafeList() {
  const search = document.querySelector("#cms-cafe-search").value.trim().toLowerCase();
  const cafes = cmsState.data.cafes.filter((cafe) =>
    `${cafe.name} ${cafe.area} ${cafe.id}`.toLowerCase().includes(search)
  );
  document.querySelector("#cms-cafe-list").innerHTML = cafes.map((cafe) => `
    <button class="cms-cafe-item ${cafe.id === cmsState.cafeId ? "is-active" : ""}" type="button" data-cafe-id="${cmsEscape(cafe.id)}">
      <span>${cmsEscape(cafe.name)}</span>
      <small>${cmsEscape(cafe.area)} · ${cmsEscape(cafe.status)}</small>
    </button>`).join("") || '<p class="cms-help">No cafes match that search.</p>';
  document.querySelectorAll("[data-cafe-id]").forEach((button) => {
    button.addEventListener("click", () => cmsSelectCafe(button.dataset.cafeId));
  });
}

function cmsRenderAmenities(cafe = null) {
  const availableNames = new Set(cafe?.amenities || []);
  document.querySelector("#cms-amenities").innerHTML = cmsState.data.amenities.map((amenity) => `
    <label class="cms-amenity">
      <input type="checkbox" data-amenity-name="${cmsEscape(amenity.display_name)}" ${availableNames.has(amenity.display_name) ? "checked" : ""}>
      <span>${cmsEscape(amenity.display_name)}</span>
    </label>`).join("");
}

function cmsRenderGallery(cafe = null) {
  const selected = new Set((cafe?.images || []).map((image) => Number(image.image_id)));
  document.querySelector("#cms-gallery-picker").innerHTML = cmsState.data.images.map((image) => `
    <label class="cms-gallery-choice">
      <input type="checkbox" name="gallery-image" value="${Number(image.image_id)}" ${selected.has(Number(image.image_id)) ? "checked" : ""}>
      <img src="${cmsEscape(image.src || image.image_url)}" alt="" loading="lazy">
      <span>${cmsEscape(image.restaurant_name)}</span>
    </label>`).join("");
}

function cmsPopulateForm(cafe = null) {
  const form = document.querySelector("#cms-cafe-form");
  form.reset();
  const fields = form.elements;
  fields.id.value = cafe?.id || "";
  fields.name.value = cafe?.name || "";
  fields.area_id.value = cafe?.area_id || "";
  fields.niche_type.value = cafe?.niche || "";
  fields.cuisines.value = (cafe?.cuisines || []).join(", ");
  fields.price_for_two.value = cafe?.price_for_two || "";
  fields.price_range.value = cafe?.price || "";
  fields.contact.value = cafe?.contact || "";
  fields.maps_url.value = cafe?.maps_url || "";
  fields.address.value = cafe?.location || "";
  fields.vibe.value = cafe?.vibe || "";
  fields.weekday_hours.value = cafe?.weekday_hours || "";
  fields.weekend_hours.value = cafe?.weekend_hours || "";
  fields.hours_note.value = cafe?.hours_note || "";
  fields.more_info.value = cafe?.moreInfo || "";
  fields.timing.value = cafe?.timing || "";
  fields.status.value = cafe?.status || "draft";
  document.querySelector("#cms-cafe-heading").textContent = cafe ? "Edit cafe." : "Add a cafe.";
  document.querySelector("#archive-cafe").hidden = !cafe || cafe.status === "archived";
  cmsRenderAmenities(cafe);
  cmsRenderGallery(cafe);
}

function cmsSelectCafe(id) {
  const cafe = cmsState.data.cafes.find((item) => item.id === id);
  if (!cafe) return;
  cmsState.cafeId = cafe.id;
  cmsState.pendingCafeId = cafe.id;
  cmsCafeList();
  cmsPopulateForm(cafe);
}

function cmsRenderHomepage() {
  const sectionValues = new Map(cmsState.data.sections.map((section) => [section.section_key, section]));
  const sections = [
    { section_key: "hero", label: "Hero", title: "", body: "", media_path: "assets/where.mp4", link_label: "Find your somewhere", link_url: "#cafe-types" },
    { section_key: "poster", label: "Poster", title: "Not your typical map.", body: "Find your niche place.", media_path: "", link_label: "", link_url: "" }
  ];
  document.querySelector("#cms-home-sections").innerHTML = sections.map((defaults, index) => {
    const section = sectionValues.get(defaults.section_key) || defaults;
    return `
      <fieldset class="cms-home-section">
        <legend>${cmsEscape(defaults.label)}</legend>
        <input type="hidden" name="section_key" value="${cmsEscape(defaults.section_key)}">
        <label>Title<input name="title" value="${cmsEscape(section.title || "")}"></label>
        <label>Text<textarea name="body" rows="2">${cmsEscape(section.body || "")}</textarea></label>
        ${index === 0 ? `<label>Hero video path<input name="media_path" value="${cmsEscape(section.media_path || "")}"></label>` : `<input type="hidden" name="media_path" value="">`}
        ${index === 0 ? `<label>Button label<input name="link_label" value="${cmsEscape(section.link_label || "")}"></label><label>Button link<input name="link_url" value="${cmsEscape(section.link_url || "")}"></label>` : `<input type="hidden" name="link_label" value=""><input type="hidden" name="link_url" value="">`}
        <label class="cms-check-line"><input type="checkbox" name="is_published" ${Number(section.is_published ?? 1) ? "checked" : ""}> Visible</label>
      </fieldset>`;
  }).join("");

  const currentFeatured = cmsState.data.featured;
  const currentFeaturedSet = new Set(currentFeatured);
  document.querySelector("#cms-featured-list").innerHTML = cmsState.data.cafes
    .filter((cafe) => cafe.status === "published")
    .map((cafe) => `
      <label class="cms-featured-choice">
        <input type="checkbox" value="${cmsEscape(cafe.id)}" ${currentFeaturedSet.has(cafe.id) ? "checked" : ""}>
        <span>${cmsEscape(cafe.name)}<small>${cmsEscape(cafe.area)}</small></span>
        <input class="cms-featured-position" type="number" min="1" max="12"
          value="${currentFeaturedSet.has(cafe.id) ? currentFeatured.indexOf(cafe.id) + 1 : Math.min(currentFeatured.length + 1, 12)}"
          aria-label="Featured position for ${cmsEscape(cafe.name)}"
          ${currentFeaturedSet.has(cafe.id) ? "" : "disabled"}>
      </label>`).join("");
  document.querySelectorAll("#cms-featured-list .cms-featured-choice > input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      checkbox.parentElement.querySelector(".cms-featured-position").disabled = !checkbox.checked;
    });
  });
}

async function cmsLoadDashboard() {
  const data = await cmsRequest("dashboard");
  cmsState.data = data;
  const area = document.querySelector("#cms-area");
  area.innerHTML = '<option value="">Choose an area</option>' + data.areas
    .map((item) => `<option value="${Number(item.area_id)}">${cmsEscape(item.display_name)}</option>`).join("");
  cmsCafeList();
  cmsRenderHomepage();
  if (cmsState.pendingCafeId) {
    cmsSelectCafe(cmsState.pendingCafeId);
    cmsState.pendingCafeId = "";
  } else {
    cmsPopulateForm(null);
  }
  document.querySelector("#cms-login").hidden = true;
  document.querySelector("#cms-workspace").hidden = false;
  document.querySelector("#cms-logout").hidden = false;
}

document.querySelector("#cms-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  cmsShowMessage("");
  const form = new FormData(event.currentTarget);
  try {
    const result = await cmsRequest("login", {
      username: form.get("username"),
      password: form.get("password")
    }, "POST");
    cmsState.token = result.csrf_token;
    await cmsLoadDashboard();
    cmsShowMessage("Signed in.");
  } catch (error) {
    cmsShowMessage(error.message, true);
  }
});

document.querySelector("#cms-logout").addEventListener("click", async () => {
  try {
    await cmsRequest("logout", {}, "POST");
    window.location.reload();
  } catch (error) {
    cmsShowMessage(error.message, true);
  }
});

document.querySelectorAll("[data-cms-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-cms-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    document.querySelectorAll(".cms-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === `cms-${button.dataset.cmsTab}`));
  });
});

document.querySelector("#cms-cafe-search").addEventListener("input", cmsCafeList);
document.querySelector("#new-cafe").addEventListener("click", () => {
  cmsState.cafeId = "";
  cmsCafeList();
  cmsPopulateForm(null);
});

document.querySelector("#add-amenity").addEventListener("click", () => {
  const name = window.prompt("New amenity name:");
  if (!name || !name.trim()) return;
  const container = document.querySelector("#cms-amenities");
  if ([...container.querySelectorAll("[data-amenity-name]")].some((input) => input.dataset.amenityName.toLowerCase() === name.trim().toLowerCase())) {
    cmsShowMessage("That amenity is already in the list.", true);
    return;
  }
  container.insertAdjacentHTML("beforeend", `
    <label class="cms-amenity">
      <input type="checkbox" data-amenity-name="${cmsEscape(name.trim())}" checked>
      <span>${cmsEscape(name.trim())}</span>
    </label>`);
});

document.querySelector("#cms-cafe-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  cmsShowMessage("Saving cafe...");
  const form = event.currentTarget;
  const values = new FormData(form);
  const cuisines = String(values.get("cuisines") || "").split(",").map((item) => item.trim()).filter(Boolean);
  const cafeData = {
    id: values.get("id"),
    name: values.get("name"),
    area_id: values.get("area_id"),
    niche_type: values.get("niche_type"),
    cuisines,
    cuisine_source: cuisines.join(", "),
    price_for_two: values.get("price_for_two"),
    price_range: values.get("price_range"),
    contact: values.get("contact"),
    maps_url: values.get("maps_url"),
    address: values.get("address"),
    vibe: values.get("vibe"),
    weekday_hours: values.get("weekday_hours"),
    weekend_hours: values.get("weekend_hours"),
    hours_note: values.get("hours_note"),
    more_info: values.get("more_info"),
    timing: values.get("timing"),
    status: values.get("status")
  };
  try {
    const saved = await cmsRequest("save_cafe", cafeData, "POST");
    const cafeId = saved.cafe_id;
    const amenities = [...document.querySelectorAll("#cms-amenities [data-amenity-name]")].map((input) => ({
      name: input.dataset.amenityName,
      available: input.checked
    }));
    await cmsRequest("save_amenities", { cafe_id: cafeId, amenities }, "POST");
    const imageIds = [...document.querySelectorAll('[name="gallery-image"]:checked')].map((input) => Number(input.value));
    await cmsRequest("save_gallery", { cafe_id: cafeId, image_ids: imageIds }, "POST");
    cmsState.pendingCafeId = cafeId;
    await cmsLoadDashboard();
    cmsShowMessage("Cafe saved.");
  } catch (error) {
    cmsShowMessage(error.message, true);
  }
});

document.querySelector("#archive-cafe").addEventListener("click", async () => {
  const cafeId = document.querySelector('#cms-cafe-form [name="id"]').value;
  if (!cafeId || !window.confirm("Archive this cafe? It will no longer appear on the public site.")) return;
  try {
    await cmsRequest("archive_cafe", { cafe_id: cafeId }, "POST");
    cmsState.pendingCafeId = cafeId;
    await cmsLoadDashboard();
    cmsShowMessage("Cafe archived.");
  } catch (error) {
    cmsShowMessage(error.message, true);
  }
});

document.querySelector("#cms-home-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const sections = [...document.querySelectorAll(".cms-home-section")].map((fieldset) => {
    const value = (name) => fieldset.querySelector(`[name="${name}"]`).value;
    return {
      section_key: value("section_key"),
      title: value("title"),
      body: value("body"),
      media_path: value("media_path"),
      link_label: value("link_label"),
      link_url: value("link_url"),
      is_published: fieldset.querySelector('[name="is_published"]').checked
    };
  });
  const featuredChoices = [...document.querySelectorAll("#cms-featured-list input[type=checkbox]:checked")]
    .map((input) => ({
      cafeId: input.value,
      position: Number(input.parentElement.querySelector(".cms-featured-position").value)
    }))
    .sort((first, second) => first.position - second.position);
  const positions = featuredChoices.map((choice) => choice.position);
  if (positions.some((position) => position < 1 || position > 12) || new Set(positions).size !== positions.length) {
    cmsShowMessage("Featured positions must be unique numbers from 1 to 12.", true);
    return;
  }
  const featured = featuredChoices.map((choice) => choice.cafeId);
  try {
    await cmsRequest("save_homepage", { sections, featured }, "POST");
    await cmsLoadDashboard();
    cmsShowMessage("Homepage content saved.");
  } catch (error) {
    cmsShowMessage(error.message, true);
  }
});

async function cmsStart() {
  try {
    const state = await cmsRequest("state");
    cmsState.token = state.csrf_token;
    if (state.user?.role === "admin") {
      await cmsLoadDashboard();
    } else {
      document.querySelector("#cms-login").hidden = false;
    }
  } catch (error) {
    cmsShowMessage(error.message, true);
    document.querySelector("#cms-login").hidden = false;
  }
}

cmsStart();
