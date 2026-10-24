const WHERE_PROFILE_IMAGE_PREFIX = "whereProfileImage:";

let whereUser = null;
let whereFavoriteIds = [];
let whereCsrfToken = "";
let whereInitializationError = null;

async function whereJsonRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (HTTP ${response.status}).`);
  return result;
}

async function whereRefreshState() {
  const result = await whereJsonRequest("api/user.php?action=state");
  whereUser = result.user;
  whereCsrfToken = result.csrf_token;
  whereFavoriteIds = whereUser
    ? (await whereJsonRequest("api/user.php?action=favorites")).favorites
    : [];
  whereRenderAccountNav();
  return whereUser;
}

const whereReady = whereRefreshState().catch((error) => {
  whereInitializationError = error;
  console.error("Account state could not be loaded from MySQL.", error);
  whereRenderAccountNav();
  return null;
});

function whereProfileImage(user) {
  if (!user) return "where.png";
  try {
    return localStorage.getItem(`${WHERE_PROFILE_IMAGE_PREFIX}${user.username}`)
      || user.profile_image
      || "where.png";
  } catch (error) {
    console.error("The saved profile picture could not be read.", error);
    return user.profile_image || "where.png";
  }
}

function whereRenderAccountNav() {
  document.querySelectorAll("[data-account-nav]").forEach((element) => {
    element.href = whereUser ? "profile.html" : "login.html";
    element.className = "profile-nav";
    element.innerHTML = whereUser
      ? `<img src="${whereProfileImage(whereUser)}" alt="">`
      : "Log in";
    element.setAttribute("aria-label", whereUser ? `Open ${whereUser.username}'s profile` : "Log in");
  });
}

window.WhereUser = {
  ready: whereReady,
  current: () => whereUser,
  favorites: () => [...whereFavoriteIds],
  hasFavorite: (id) => whereFavoriteIds.includes(id),
  async refresh() {
    whereInitializationError = null;
    return whereRefreshState();
  },
  async request(action, data = {}) {
    await whereReady;
    if (whereInitializationError) throw whereInitializationError;
    return whereJsonRequest(`api/user.php?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers: { "X-CSRF-Token": whereCsrfToken },
      body: JSON.stringify({ ...data, action })
    });
  },
  async toggleFavorite(id) {
    const result = await this.request("toggle_favorite", { cafe_id: id });
    whereFavoriteIds = result.saved
      ? [...whereFavoriteIds.filter((favoriteId) => favoriteId !== id), id]
      : whereFavoriteIds.filter((favoriteId) => favoriteId !== id);
    return result.saved;
  },
  saveProfileImage(username, image) {
    try {
      localStorage.setItem(`${WHERE_PROFILE_IMAGE_PREFIX}${username}`, image);
      whereRenderAccountNav();
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) {
        throw new Error("This picture exceeds available browser storage space. Please try a different photo.");
      }
      throw e;
    }
  },
  renderAccountNav: whereRenderAccountNav
};

document.addEventListener("where:layout-ready", () => {
  whereRenderAccountNav();
  document.querySelectorAll("#current-year").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
});
