async function loadSharedLayout() {
  const [headerResponse, footerResponse] = await Promise.all([
    fetch("header.html"),
    fetch("footer.html")
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
  document.dispatchEvent(new CustomEvent("where:layout-ready"));
}

loadSharedLayout().catch((error) => {
  console.error(error);
});
