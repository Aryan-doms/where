# WHERE?

A simple cafe-discovery homepage for a college project.

## Run locally

The project uses Docker Compose for a consistent local MySQL installation. You
do not need XAMPP, Homebrew, or MySQL installed directly on your computer.

1. Install Docker Desktop (or another Docker-compatible engine).
2. Start the MySQL container:

   ```sh
   docker compose up -d
   ```

3. Copy `api/config.example.php` to `api/config.php`:

   ```sh
   cp api/config.example.php api/config.php
   ```

4. From this folder, run PHP's built-in server:

   ```sh
   php -S localhost:8000
   ```

5. Open <http://localhost:8000>.

The Docker setup currently creates only the empty `cafecompass` database and
the local `where` user. The `cafes` and `areas` schema has intentionally not
been added yet; it will be designed from the finalized frontend features.
Until then, the homepage will show its existing database-unavailable state
when the API is requested.

Keep `api/config.php` local and do not commit it. Stop the container with:

```sh
docker compose down
```

The database data is stored in the Docker volume `where_mysql_data`, so
stopping the container does not delete it. To remove that local data as well:

```sh
docker compose down -v
```
