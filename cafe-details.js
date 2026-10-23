function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}

async function loadCafeRows() {
  const response = await fetch("surat_cafes_data.csv");
  if (!response.ok) throw new Error(`Could not load the cafe list (HTTP ${response.status}).`);

  const [headers, ...rows] = parseCsv(await response.text());
  if (!headers?.includes("Name") || !headers.includes("Niche Type of Cafe")) {
    throw new Error("The cafe list is missing required columns.");
  }

  return rows
    .filter((row) => row.some((value) => value.trim()))
    .map((values, index) => {
      const source = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || ""]));
      return {
        id: `cafe-${String(index + 1).padStart(3, "0")}`,
        name: source.Name,
        area: source["Surat Area"].replace(/^Surat\s*\/\s*/, "").trim(),
        location: source.Location,
        cuisine: source["Cuisine Served / Type of Cafe Cuisine"],
        niche: source["Niche Type of Cafe"],
        timing: source.Timing,
        contact: source["Contact Details Number"],
        price: source["Price Range"],
        vibe: source["Vibe (Ambiance)"],
        moreInfo: source["More Info"],
        amenities: headers
          .filter((header) => !["Name", "Surat Area", "Location", "Cuisine Served / Type of Cafe Cuisine", "Niche Type of Cafe", "Timing", "Contact Details Number", "Price Range", "Vibe (Ambiance)", "More Info"].includes(header))
          .filter((header) => source[header].trim().toLowerCase() === "yes")
      };
    });
}

async function loadCatalogImages() {
  const response = await fetch("catalog.csv");
  if (!response.ok) throw new Error(`Could not load the photo catalogue (HTTP ${response.status}).`);

  const [headers, ...rows] = parseCsv(await response.text());
  const imageIndex = headers.indexOf("image_url");
  if (imageIndex < 0) throw new Error("The photo catalogue is missing its image_url column.");

  return rows
    .map((row) => row[imageIndex] || "")
    .filter(Boolean)
    .filter((image, index, all) => all.indexOf(image) === index);
}

function setText(id, value) {
  const element = document.getElementById(id);
  element.textContent = value;
  return element;
}

function renderCafe(cafe, allCafes) {
  document.title = `${cafe.name} — WHERE?`;
  document.querySelectorAll(".cafe-detail-main > section").forEach((section) => {
    section.hidden = false;
  });
  setText("cafe-area", cafe.area.toUpperCase());
  setText("cafe-id", cafe.id.toUpperCase());
  setText("cafe-name", cafe.name);
  setText("cafe-niche", cafe.niche);
  setText("cafe-price", cafe.price.replace(/\s+for two people \(approx\.\)/i, ""));
  setText("cafe-vibe", cafe.vibe);
  setText("cafe-location", cafe.location);
  setText("cafe-timing", cafe.timing);
  setText("map-address", cafe.location);
  setText("review-vibe", cafe.vibe);
  document.getElementById("cafe-map").setAttribute("aria-label", `Decorative location sketch for ${cafe.name}, not to scale. Address: ${cafe.location}`);

  const directions = document.getElementById("map-directions");
  directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.location)}`;

  document.getElementById("cafe-cuisine").innerHTML = cafe.cuisine
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<span class="detail-tag">${escapeHtml(item)}</span>`)
    .join("");

  const contact = document.getElementById("cafe-contact");
  const phone = cafe.contact.split(/[,;/]/)[0].trim();
  if (phone) {
    const link = document.createElement("a");
    link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
    link.textContent = phone;
    contact.appendChild(link);
  } else {
    contact.textContent = "Not listed";
  }

  const amenities = document.getElementById("cafe-amenities");
  amenities.innerHTML = cafe.amenities.length
    ? cafe.amenities.map((item) => `<span class="detail-tag">${escapeHtml(item)}</span>`).join("")
    : '<span class="detail-muted">No additional details listed.</span>';

  setText("related-area", `MORE IN ${cafe.area.toUpperCase()}`);
  const related = allCafes.filter((item) => item.area === cafe.area && item.id !== cafe.id).slice(0, 3);
  document.getElementById("related-cafes").innerHTML = related.length
    ? related.map((item) => `
      <a class="detail-related__link" href="cafe.html?id=${encodeURIComponent(item.id)}">
        <span>${escapeHtml(item.name)}</span>
      </a>`).join("")
    : '<p class="detail-muted">No other cafes are listed for this area yet.</p>';
}

async function showCafe() {
  const error = document.getElementById("detail-error");
  try {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^cafe-\d{3}$/.test(id)) throw new Error("Choose a cafe from the WHERE? home page.");

    const cafes = await loadCafeRows();
    const cafe = cafes.find((item) => item.id === id);
    if (!cafe) throw new Error("That cafe is not in the current cafe list.");

    renderCafe(cafe, cafes);
    try {
      const images = await loadCatalogImages();
      if (images.length) {
        const cover = document.getElementById("cafe-cover");
        const image = document.getElementById("cafe-cover-image");
        image.src = images[Math.floor(Math.random() * images.length)];
        image.alt = "Cafe scene from the WHERE? photo collection";
        cover.hidden = false;
        cover.classList.add("detail-cover--ready");
      }
    } catch (imageError) {
      console.error("Cafe photos could not be loaded.", imageError);
    }
  } catch (loadError) {
    console.error("Cafe details could not be loaded.", loadError);
    error.textContent = loadError.message;
    error.hidden = false;
  }
}

showCafe();
