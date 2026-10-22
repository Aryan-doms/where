# WHERE? Project Rules

## Scope and stack
- Keep this project beginner-friendly and use HTML, CSS, Bootstrap only if already included, vanilla JavaScript, PHP, and MySQL.
- Do not add frameworks, packages, build tools, CDNs, or animation libraries without approval.
- Implement only the requested homepage. Do not expand it into a complete discovery app or modify another project.

## Assets and data
- Prefer project-owned local assets. Do not download or scrape media.
- Use the supplied `where.png` logo and `where.mp4` hero video.
- Treat supplied datasets as the source of truth. Do not invent records or fields, or overwrite source datasets.
- Use the existing local `cafecompass` MySQL database and its `cafes` and `areas` tables. Do not recreate the database or import the CSVs again.
- Keep local database credentials in the ignored `api/config.php`; never commit credentials.
- Do not present placeholder artwork as authentic cafe or area photography.

## Quality
- Use semantic, accessible HTML, visible keyboard focus, responsive layouts, and reduced-motion support.
- Keep JavaScript and styles organized in their own files and favor clear, explainable code.
- Preserve existing project behavior and avoid unrelated changes.
- Report actual test results and disclose missing assets or unfinished destinations.
