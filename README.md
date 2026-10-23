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

## Account UI prototype

The login, signup, and profile pages are currently frontend-only. They use
browser `localStorage` so the account flow can be designed before the MySQL
schema is finalized. Passwords are hashed in the browser for this prototype;
this is not a production authentication system. The future PHP/MySQL auth
implementation should replace this storage and validation layer.
