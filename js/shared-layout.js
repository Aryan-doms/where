async function loadSharedLayout() {
  const [headerResponse, footerResponse] = await Promise.all([
    fetch("/header.html"),
    fetch("/footer.html")
  ]);
  if (!headerResponse.ok || !footerResponse.ok) {
    throw new Error("The shared WHERE? layout could not be loaded.");
  }
  const header = document.querySelector("[data-where-header]") || document.querySelector(".site-header");
  const footer = document.querySelector("[data-where-footer]") || document.querySelector(".site-footer");
  const headerMarkup = await headerResponse.text();
  const footerMarkup = await footerResponse.text();
  if (header) {
    if (header.matches(".site-header")) header.outerHTML = headerMarkup;
    else header.innerHTML = headerMarkup;
  }
  if (footer) {
    if (footer.matches(".site-footer")) footer.outerHTML = footerMarkup;
    else footer.innerHTML = footerMarkup;
  }
  setupSharedHeader();
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent("where:layout-ready"));
  }, 0);
}

function setupSharedHeader() {
  const siteHeader = document.querySelector(".site-header");
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector("#main-nav");
  if (!siteHeader || !menuToggle || !mainNav) return;

  const updateHeader = () => {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  let lastScrollY = window.scrollY;
  const handleHeaderScroll = () => {
    const currentScrollY = window.scrollY;
    const movingDown = currentScrollY > lastScrollY;
    siteHeader.classList.toggle("is-hidden", movingDown && currentScrollY > 80);
    updateHeader();
    lastScrollY = currentScrollY;
  };
  const closeMenu = () => {
    mainNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    const label = menuToggle.querySelector(".visually-hidden");
    if (label) label.textContent = "Open menu";
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    const label = menuToggle.querySelector(".visually-hidden");
    if (label) label.textContent = isOpen ? "Close menu" : "Open menu";
  });
  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  window.addEventListener("scroll", handleHeaderScroll, { passive: true });
  updateHeader();
}

loadSharedLayout().catch((error) => {
  console.error(error);
});
