# WHERE?

A simple cafe-discovery homepage for a college project.

## Run locally

1. Start MySQL in XAMPP.
2. Copy `api/config.example.php` to `api/config.php` and enter your local MySQL username and password.
3. From this folder, run PHP's built-in server:

   ```sh
   /Applications/XAMPP/xamppfiles/bin/php -S localhost:8000
   ```

4. Open <http://localhost:8000>.

The homepage reads cafes and area counts from the existing `cafecompass` database. It does not create tables or import CSV files. Keep `api/config.php` local and do not commit it.

To inspect the existing database from the XAMPP terminal:

```sh
/Applications/XAMPP/xamppfiles/bin/mysql -u admin -p cafecompass
```

Enter your local MySQL password when prompted. For example, `SHOW TABLES;` lists tables and `SELECT COUNT(*) FROM cafes;` checks the cafe records.
