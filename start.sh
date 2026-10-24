#!/bin/bash
set -e

# Change directory to project root
cd "$(dirname "$0")"

echo "☕ Starting WHERE?..."

# Ensure config.php exists
if [ ! -f api/config.php ]; then
  echo "==> Creating api/config.php from template..."
  cp api/config.example.php api/config.php
fi

# 1. Start MySQL Docker container
echo "==> 1. Starting database container (Docker)..."
docker compose up -d

# 2. Wait until MySQL is accepting connections
echo "==> 2. Waiting for MySQL to be ready..."
until docker exec where-mysql mysqladmin ping -h localhost -u root -pwhere_root_password --silent > /dev/null 2>&1; do
  sleep 1
done

# 3. Load seed database
echo "==> 3. Ensuring database data is loaded..."
docker exec -i where-mysql mysql -uroot -pwhere_root_password cafecompass < database/seed.sql > /dev/null 2>&1 || true

# 4. Start local PHP server
echo "==> 4. Server ready! Open in your browser:"
echo "     👉 http://localhost:8000"
echo "     (Press Ctrl+C to stop the server)"
echo ""
php -S localhost:8000 router.php
