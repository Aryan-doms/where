# WHERE?

A cafe-discovery frontend for Surat.

## Run the frontend

The homepage and cafe detail page currently read the supplied cafe CSV in the
browser. They do not connect to MySQL or call the PHP API; the database design
will come later.

From this folder, start PHP's built-in server:

```sh
php -S localhost:8000
```

If `php` is not found in your terminal but XAMPP is installed, use its PHP
executable directly:

```sh
/Applications/XAMPP/xamppfiles/bin/php -S localhost:8000
```

Open <http://localhost:8000>.

Choose a cafe from the homepage to open its detail page. The page uses the cafe
row number from `surat_cafes_data.csv` as its temporary URL id, for example
`cafe.html?id=cafe-001`.

The Docker Compose database is optional and not needed for the current
frontend. Do not import the CSV or alter the existing database while working
on these pages.

## MySQL import data

The `database_import/` directory contains normalized CSVs generated from all
128 records in `surat_cafes_data.csv`. Import the lookup tables first, then
`cafes.csv`, followed by `cafe_cuisines.csv` and `cafe_amenities.csv`.

The import includes the source cafe name, address, area, cuisine links, niche
type, vibe, price for two, timing, phone number, source notes, and every
available amenity flag. `catalog_images.csv` preserves the 239 image-catalog
records separately because the catalog names cannot be matched to cafe IDs
reliably. `cafe_images.csv` is intentionally empty until those image-to-cafe
relationships are confirmed.

## Account UI prototype

The login, signup, and profile pages are currently frontend-only. They use
browser `localStorage` so the account flow can be designed before the MySQL
schema is finalized. Passwords are hashed in the browser for this prototype;
this is not a production authentication system. The future PHP/MySQL auth
implementation should replace this storage and validation layer.
