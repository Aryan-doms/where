document.addEventListener("where:layout-ready", async () => {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (HTTP ${response.status}).`);
    return result;
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value || "";
  }

  function reviewMarkup(review) {
    return `
      <article class="review-bubble">
        <div>
          <p class="review-bubble__name">${escapeHtml(review.name)}</p>
          <p class="review-bubble__text">${escapeHtml(review.message)}</p>
        </div>
      </article>
    `;
  }

  async function renderReviews(cafe) {
    const result = await requestJson(`/api/user.php?action=reviews&cafe_id=${encodeURIComponent(cafe.id)}`);
    const reviews = result.reviews;
    const markup = reviews.length
      ? reviews.map(reviewMarkup).join("")
      : '<p class="detail-muted">No reviews yet.</p>';
    document.getElementById("review-list").innerHTML = reviews.length
      ? reviews.slice(0, 3).map(reviewMarkup).join("")
      : markup;
    document.getElementById("all-review-list").innerHTML = markup;
    document.getElementById("see-all-reviews").hidden = reviews.length <= 3;

    const user = window.WhereUser.current();
    document.getElementById("review-login-note").innerHTML = user
      ? `Posting as <strong>${escapeHtml(user.username)}</strong>`
      : 'Log in to add a review. <a href="/login.html">Log in</a>';
  }

  function setupReviews(cafe) {
    const allDialog = document.getElementById("all-reviews-dialog");
    document.getElementById("see-all-reviews").addEventListener("click", () => allDialog.showModal());
    document.getElementById("close-all-reviews").addEventListener("click", () => allDialog.close());
    const form = document.getElementById("review-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const user = window.WhereUser.current();
      if (!user) {
        window.location.href = "/login.html";
        return;
      }
      const button = document.getElementById("add-review");
      button.disabled = true;
      try {
        await window.WhereUser.request("add_review", {
          cafe_id: cafe.id,
          message: document.getElementById("review-message").value.trim()
        });
        form.reset();
        await renderReviews(cafe);
      } catch (error) {
        document.getElementById("review-login-note").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    renderReviews(cafe).catch((error) => {
      console.error("Cafe reviews could not be loaded.", error);
      document.getElementById("review-list").textContent = error.message;
    });
  }

  function renderCafe(cafe, allCafes) {
    document.title = `${cafe.name} — WHERE?`;
    document.querySelectorAll(".cafe-detail-main > section").forEach((section) => {
      section.hidden = false;
    });
    const breadcrumbArea = document.getElementById("breadcrumb-area");
    if (breadcrumbArea) {
      breadcrumbArea.innerHTML = `<a href="/surat/${encodeURIComponent(cafe.area_slug || '')}">${escapeHtml(cafe.area.toUpperCase())}</a>`;
    }
    setText("breadcrumb-id", cafe.name.toUpperCase());
    setText("cafe-name", cafe.name);
    setText("cafe-cuisine-summary", cafe.niche);
    setText("cafe-cuisines-list", cafe.cuisine || "");
    const priceNum = Math.round(Number(cafe.price_for_two || 0));
    const displayPrice = priceNum > 0 ? `₹${priceNum.toLocaleString("en-IN")}` : (cafe.price || "").replace(/^\?/, "₹").replace(/\s+for two people \(approx\.\)/i, "");
    setText("cafe-price", displayPrice);

    const ratingBadge = document.getElementById("cafe-rating-badge");
    const ratingDot = document.getElementById("cafe-rating-dot");
    if (ratingBadge) {
      if (cafe.rating) {
        const numRating = Number(cafe.rating) || 0;
        let tier = "low";
        if (numRating >= 4.0) {
          tier = "high";
        } else if (numRating >= 3.5) {
          tier = "good";
        } else if (numRating >= 3.0) {
          tier = "mid";
        }
        ratingBadge.className = `detail-hero__rating explore-card__rating--${tier}`;
        ratingBadge.innerHTML = `<span aria-hidden="true">★</span> ${escapeHtml(cafe.rating)}`;
        ratingBadge.hidden = false;
        if (ratingDot) ratingDot.hidden = false;
      } else {
        ratingBadge.hidden = true;
        if (ratingDot) ratingDot.hidden = true;
      }
    }

    const favoriteButton = document.getElementById("favorite-button");
    const updateFavoriteButton = () => {
      const saved = window.WhereUser.hasFavorite(cafe.id);
      favoriteButton.setAttribute("aria-pressed", String(saved));
      favoriteButton.setAttribute("aria-label", saved ? `Remove ${cafe.name} from saved spots` : `Save ${cafe.name}`);
      favoriteButton.innerHTML = `
        <svg class="favorite-heart-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path>
        </svg>
      `;
    };
    updateFavoriteButton();
    favoriteButton.addEventListener("click", async () => {
      if (!window.WhereUser.current()) {
        window.location.href = "/login.html";
        return;
      }
      favoriteButton.disabled = true;
      try {
        await window.WhereUser.toggleFavorite(cafe.id);
        updateFavoriteButton();
      } catch (error) {
        document.getElementById("detail-error").textContent = error.message;
        document.getElementById("detail-error").hidden = false;
      } finally {
        favoriteButton.disabled = false;
      }
    });

    setText("cafe-vibe", cafe.vibe);
    setText("cafe-timing", cafe.timing);
    setText("map-address", cafe.address || cafe.location);
    document.getElementById("cafe-map").setAttribute(
      "aria-label",
      `Decorative location grid for ${cafe.name}, not to scale. Address: ${cafe.address || cafe.location}`
    );

    const directions = document.getElementById("map-directions");
    const directionsUrl = cafe.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.address || cafe.location)}`;
    directions.href = directionsUrl;
    const heroDirections = document.getElementById("hero-directions-button");
    if (heroDirections) heroDirections.href = directionsUrl;

    const contact = document.getElementById("cafe-contact");
    const phone = (cafe.contact || "").split(/[,;/]/)[0].trim();
    if (phone) {
      const link = document.createElement("a");
      link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      link.textContent = phone;
      contact.replaceChildren(link);
    } else {
      contact.textContent = "Not listed";
    }

    const amenities = document.getElementById("cafe-amenities");
    amenities.innerHTML = cafe.amenities.length
      ? cafe.amenities.map((item) => `<span class="detail-tag">${escapeHtml(item)}</span>`).join("")
      : '<span class="detail-muted">No additional details listed.</span>';

    setupReviews(cafe);
    setText("related-area", `MORE IN ${cafe.area.toUpperCase()}`);
    const related = allCafes.filter((item) => item.area === cafe.area && item.id !== cafe.id).slice(0, 3);
    document.getElementById("related-cafes").innerHTML = related.length
      ? related.map((item) => {
        const itemUrl = `/surat/${encodeURIComponent(item.area_slug || 'all')}/${encodeURIComponent(item.slug || item.id)}`;
        return `
        <a class="detail-related__link" href="${itemUrl}">
          <span>${escapeHtml(item.name)}</span>
        </a>`;
      }).join("")
      : '<p class="detail-muted">No other cafes are listed for this area yet.</p>';
  }

  function renderGallery(cafe) {
    const gallery = document.getElementById("cafe-gallery");
    const images = cafe.images || [];
    if (!images.length) return;

    const slots = [
      document.getElementById("cafe-cover-image"),
      ...[1, 2, 3, 4].map((index) => document.getElementById(`cafe-gallery-image-${index}`))
    ];
    selected = images.slice(0, slots.length);
    selected.forEach((image, index) => {
      const element = slots[index];
      element.src = image.src || image.image_url;
      element.alt = image.alt_text || `${cafe.name} photo ${index + 1}`;
      element.addEventListener("error", () => {
        element.closest("figure").hidden = true;
      }, { once: true });
    });
    slots.slice(selected.length).forEach((element) => {
      element.closest("figure").hidden = true;
    });
    document.getElementById("all-photo-list").innerHTML = images.map((image, index) => `
      <img src="${escapeHtml(image.src || image.image_url)}"
        alt="${escapeHtml(image.alt_text || `${cafe.name} photo ${index + 1}`)}" loading="lazy">
    `).join("");
    const photoDialog = document.getElementById("all-photos-dialog");
    document.querySelector(".detail-gallery__all").addEventListener("click", () => photoDialog.showModal());
    document.getElementById("close-all-photos").addEventListener("click", () => photoDialog.close());
    gallery.hidden = false;
  }

  const error = document.getElementById("detail-error");
  try {
    await window.WhereUser.ready;
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");
    let slug = params.get("slug");
    let areaSlug = params.get("area");

    // Clean URL: /surat/{area}/{cafe_slug}
    const cleanSegments = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (cleanSegments[0] === "surat" && cleanSegments.length >= 3) {
      if (!areaSlug) areaSlug = decodeURIComponent(cleanSegments[1]);
      if (!slug) slug = decodeURIComponent(cleanSegments[2]);
    }

    if (!id && !slug) throw new Error("Choose a cafe from the WHERE? home page.");

    let result;
    try {
      result = await requestJson("/api/cafes.php");
    } catch (e) {
      result = await requestJson("/api/cafes.json");
    }
    const allCafes = result.cafes || [];
    const cafe = allCafes.find((item) => {
      if (slug && item.slug && item.slug.toLowerCase() === slug.toLowerCase()) return true;
      if (id && item.id && item.id.toLowerCase() === id.toLowerCase()) return true;
      return false;
    });
    if (!cafe) throw new Error("That cafe is not in the current cafe list.");

    // Clean address bar URL to /surat/{area}/{slug} without ugly parameters
    const cleanPath = `/surat/${encodeURIComponent(cafe.area_slug || 'all')}/${encodeURIComponent(cafe.slug || cafe.id)}`;
    if (window.location.pathname !== cleanPath || window.location.search) {
      window.history.replaceState(null, "", cleanPath);
    }

    renderCafe(cafe, allCafes);
    renderGallery(cafe);
  } catch (loadError) {
    console.error("Cafe details could not be loaded.", loadError);
    error.textContent = loadError.message;
    error.hidden = false;
  }
});
