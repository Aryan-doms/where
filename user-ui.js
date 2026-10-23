const WHERE_USERS_KEY = "whereUsers";
const WHERE_SESSION_KEY = "whereSession";
const WHERE_FAVORITES_KEY = "whereFavorites";

function whereReadUsers() {
  try {
    return JSON.parse(localStorage.getItem(WHERE_USERS_KEY) || "[]");
  } catch (error) {
    console.error("Stored WHERE? users could not be read.", error);
    return [];
  }
}

function whereCurrentUser() {
  const username = localStorage.getItem(WHERE_SESSION_KEY);
  return whereReadUsers().find((user) => user.username === username) || null;
}

function whereFavorites() {
  try {
    return JSON.parse(localStorage.getItem(WHERE_FAVORITES_KEY) || "[]");
  } catch (error) {
    console.error("Stored WHERE? favorites could not be read.", error);
    return [];
  }
}

function whereHasFavorite(id) {
  return whereFavorites().includes(id);
}

function whereToggleFavorite(id) {
  const favorites = whereFavorites();
  const next = favorites.includes(id)
    ? favorites.filter((favoriteId) => favoriteId !== id)
    : [...favorites, id];
  localStorage.setItem(WHERE_FAVORITES_KEY, JSON.stringify(next));
  return next.includes(id);
}

function whereEscapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function whereRenderAccountNav() {
  document.querySelectorAll("[data-account-nav]").forEach((element) => {
    const user = whereCurrentUser();
    element.href = user ? "profile.html" : "login.html";
    element.className = "profile-nav";
    element.innerHTML = user
      ? `<img src="${user.profileImage || "where.png"}" alt=""> <span>${whereEscapeHtml(user.username)}</span>`
      : "Log in";
    element.setAttribute("aria-label", user ? `Open ${user.username}'s profile` : "Log in");
  });
}

window.WhereUser = {
  current: whereCurrentUser,
  favorites: whereFavorites,
  hasFavorite: whereHasFavorite,
  toggleFavorite: whereToggleFavorite,
  renderAccountNav: whereRenderAccountNav
};

whereRenderAccountNav();
