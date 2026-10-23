const usersKey = "whereUsers";
const sessionKey = "whereSession";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(usersKey) || "[]");
  } catch (error) {
    console.error("Stored WHERE? users could not be read.", error);
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(usersKey, JSON.stringify(users));
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setSession(username) {
  localStorage.setItem(sessionKey, username);
}

function getCurrentUser() {
  const username = localStorage.getItem(sessionKey);
  return readUsers().find((user) => user.username === username) || null;
}

function redirectIfSignedIn() {
  if (getCurrentUser()) window.location.href = "profile.html";
}

function showAuthMessage(message, type = "error") {
  const messageElement = document.querySelector("#auth-message");
  messageElement.textContent = message;
  messageElement.className = `auth-message auth-message--${type}`;
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const username = formData.get("username").trim().toLowerCase();
  const phone = formData.get("phone").trim();
  const password = formData.get("password");
  const profilePicture = formData.get("profile-picture");
  const users = readUsers();

  if (users.some((user) => user.username === username)) {
    showAuthMessage("That username is already taken.");
    return;
  }
  if (users.some((user) => user.phone === phone)) {
    showAuthMessage("That phone number is already in use.");
    return;
  }

  const user = {
    username,
    phone,
    passwordHash: await hashPassword(password),
    profileImage: profilePicture?.size ? await readImage(profilePicture) : ""
  };
  users.push(user);
  writeUsers(users);
  setSession(username);
  window.location.href = "profile.html";
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const username = formData.get("username").trim().toLowerCase();
  const passwordHash = await hashPassword(formData.get("password"));
  const user = readUsers().find((entry) => entry.username === username && entry.passwordHash === passwordHash);

  if (!user) {
    showAuthMessage("Username or password is incorrect.");
    return;
  }
  setSession(user.username);
  window.location.href = "profile.html";
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("The profile image could not be read.")));
    reader.readAsDataURL(file);
  });
}

function setupProfile() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.querySelector("#profile-username").textContent = user.username;
  document.querySelector("#profile-username-copy").textContent = user.username;
  document.querySelector("#profile-phone").textContent = user.phone;
  const image = document.querySelector("#profile-image");
  if (user.profileImage) {
    image.src = user.profileImage;
    image.classList.add("has-image");
  }

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("profile-picture");
    if (!file?.size) return;
    const users = readUsers();
    const current = users.find((entry) => entry.username === user.username);
    current.profileImage = await readImage(file);
    writeUsers(users);
    image.src = current.profileImage;
    image.classList.add("has-image");
    showAuthMessage("Profile picture updated.", "success");
  });
  document.querySelector("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(sessionKey);
    window.location.href = "login.html";
  });
}

document.querySelector("#signup-form")?.addEventListener("submit", handleSignup);
document.querySelector("#login-form")?.addEventListener("submit", handleLogin);
if (document.body.dataset.page === "auth") redirectIfSignedIn();
if (document.body.dataset.page === "profile") setupProfile();
