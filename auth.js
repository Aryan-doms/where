document.addEventListener("where:layout-ready", async () => {
  function showAuthMessage(message, type = "error") {
    const messageElement = document.querySelector("#auth-message");
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.className = `auth-message auth-message--${type}`;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("The profile image could not be read.")));
      reader.readAsDataURL(file);
    });
  }

  async function submitAccountForm(event, action) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      await window.WhereUser.ready;
      const result = await window.WhereUser.request(action, {
        username: String(formData.get("username") || "").trim().toLowerCase(),
        phone: String(formData.get("phone") || "").trim(),
        password: String(formData.get("password") || "")
      });
      await window.WhereUser.refresh();
      if (action === "signup") {
        const picture = formData.get("profile-picture");
        if (picture && picture.size) {
          window.WhereUser.saveProfileImage(result.user?.username || window.WhereUser.current().username, await readImage(picture));
        }
      }
      window.location.href = "profile.html";
    } catch (error) {
      showAuthMessage(error.message);
    } finally {
      submitButton.disabled = false;
    }
  }

  async function renderMySpots() {
    const list = document.querySelector("#my-spots-list");
    const favorites = window.WhereUser.favorites();
    if (!favorites.length) {
      list.innerHTML = '<p class="detail-muted">Your saved spots will show up here.</p>';
      return;
    }
    const response = await fetch("api/cafes.php");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Could not load saved spots (HTTP ${response.status}).`);
    const cafes = result.cafes.filter((cafe) => favorites.includes(cafe.id));
    list.innerHTML = cafes.length
      ? cafes.map((cafe) => `
        <a class="my-spot" href="cafe.html?id=${encodeURIComponent(cafe.id)}">
          <span><strong>${escapeHtml(cafe.name)}</strong><small>${escapeHtml(cafe.area)}</small></span>
          <span aria-hidden="true">↗</span>
        </a>`).join("")
      : '<p class="detail-muted">Your saved spots will show up here.</p>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  async function setupProfile() {
    await window.WhereUser.ready;
    const user = window.WhereUser.current();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const memberSince = user.created_at ? new Date(user.created_at) : new Date();
    const elapsedDays = Math.max(0, Math.floor((Date.now() - memberSince.getTime()) / 86400000));
    document.querySelector("#profile-member-days").textContent = elapsedDays;
    document.querySelector("#profile-username").textContent = user.username;
    document.querySelector("#profile-phone").textContent = user.phone;
    const image = document.querySelector("#profile-image");
    const localImage = localStorage.getItem(`whereProfileImage:${user.username}`);
    if (localImage || user.profile_image) {
      image.src = localImage || user.profile_image;
      image.classList.add("has-image");
    }

    document.querySelector("#profile-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = new FormData(event.currentTarget).get("profile-picture");
      if (!file?.size) return;
      try {
        const profileImage = await readImage(file);
        window.WhereUser.saveProfileImage(user.username, profileImage);
        image.src = profileImage;
        image.classList.add("has-image");
        showAuthMessage("Profile picture updated on this device.", "success");
      } catch (error) {
        showAuthMessage(error.message);
      }
    });
    document.querySelector("#logout-button").addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      try {
        await window.WhereUser.request("logout");
        await window.WhereUser.refresh();
        window.location.href = "login.html";
      } catch (error) {
        event.currentTarget.disabled = false;
        showAuthMessage(error.message);
      }
    });
    renderMySpots().catch((error) => {
      console.error("Saved spots could not be loaded.", error);
      document.querySelector("#my-spots-list").textContent = error.message;
    });
  }

  const signup = document.querySelector("#signup-form");
  const login = document.querySelector("#login-form");
  signup?.addEventListener("submit", (event) => submitAccountForm(event, "signup"));
  login?.addEventListener("submit", (event) => submitAccountForm(event, "login"));

  try {
    await window.WhereUser.ready;
    if (document.body.dataset.page === "auth" && window.WhereUser.current()) {
      window.location.href = "profile.html";
      return;
    }
    if (document.body.dataset.page === "profile") await setupProfile();
  } catch (error) {
    console.error("Account page could not be initialized.", error);
    showAuthMessage(error.message);
  }
});
