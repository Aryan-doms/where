function renderUniversalFooter() {
  if (document.querySelector(".site-footer")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <footer class="site-footer" id="about">
      <div class="footer-panel">
        <div class="footer-stickers" aria-hidden="true">
          <img src="assets/tenis.png" alt="">
          <img src="assets/crossiont.png" alt="">
        </div>
        <span class="footer-star-mark" aria-hidden="true">✦</span>
        <div class="footer-mark" aria-hidden="true">WHERE?</div>
        <div class="footer-contact">
          <img src="assets/contact-script.gif" alt="Contact WHERE?">
          <a href="mailto:query@where.com">query@where.com</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span id="current-year"></span> WHERE?</span>
        <span>for da cool gng</span>
      </div>
    </footer>
  `);
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();
}

renderUniversalFooter();
