# WHERE?

WHERE? is a cafe-discovery site for Surat, built with HTML, CSS, vanilla
JavaScript, PHP, and MySQL.

## Requirements

- Docker Desktop with Docker Compose
- PHP 8.0 or newer with PDO MySQL enabled

On macOS with XAMPP, PHP may be available at
`/Applications/XAMPP/xamppfiles/bin/php`.

## Start the project

From the project folder:

```sh
cp .env.example .env
cp api/config.example.php api/config.php
docker compose up -d
```

The first MySQL startup creates the schema from `database/schema.sql`. The
example credentials are for local development only. If you change the database
values in `.env`, update the ignored local `api/config.php` to match, or set
`WHERE_DB_HOST`, `WHERE_DB_PORT`, `WHERE_DB_NAME`, `WHERE_DB_USER`, and
`WHERE_DB_PASSWORD` in the PHP process environment.

If Docker already has an initialized data volume from before the schema was
added, apply the schema once with:

```sh
docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/schema.sql
```

Import the normalized project datasets into the database:

```sh
php database/import.php
```

The six required source files are `data/areas.csv`, `data/cafes.csv`,
`data/cuisines.csv`, `data/cafe_cuisines.csv`, `data/amenities.csv`, and
`data/cafe_amenities.csv`. The importer maps numeric cafe IDs to the existing
`cafe-001` style IDs and imports every amenity availability value, including
unavailable (`0`) values. It does not modify the CSVs. The root `catalog.csv`
is optional and is imported only as an image-selection catalog; photos are not
assigned to cafes automatically.

The importer refuses to run if cafe records already exist. Do not pass
`--force` unless you intend to replace matching CSV-sourced cafe details,
cuisines, and amenity associations with the values in `data/`; it also removes
obsolete area-source records and unreferenced legacy areas not present in the
normalized source.

Create an administrator account:

```sh
php database/create-admin.php
```

The script asks for a username, a 10-digit phone number, and a password. The
password prompt is visible in the terminal; do not use a password that is used
for another account.

Start PHP's built-in server:

```sh
php -S localhost:8000
```

Open <http://localhost:8000> for the public site or
<http://localhost:8000/admin.html> for the CMS. If `php` is not on your PATH,
run the XAMPP PHP executable directly:

```sh
/Applications/XAMPP/xamppfiles/bin/php -S localhost:8000
```

The CMS lets an administrator create, edit, publish, and archive cafes; manage
cuisines and amenity availability; assign gallery images from the imported
catalog; and edit homepage sections and featured cafe order. Public cafe,
homepage, review, login, favorite, and profile data use the PHP/MySQL API.
Profile pictures currently stay in that browser's local storage.

The catalog is only a pool of available images. An image appears as a cafe
photo only after an administrator associates it with that cafe in the CMS.
The project does not upload or copy media files.
