#!/bin/bash
set -e

# Change directory to project root
cd "$(dirname "$0")"

echo "☕ Starting WHERE?..."

# 1. Check if Docker is running (on Mac, automatically launches Docker Desktop if closed)
if ! docker info > /dev/null 2>&1; then
  echo "==> Docker is not running."
  if [ -d "/Applications/Docker.app" ]; then
    echo "==> Launching Docker Desktop..."
    open -a Docker
    echo "==> Waiting for Docker engine to start..."
    until docker info > /dev/null 2>&1; do
      sleep 2
    done
  else
    echo "⚠️ Docker is not running. Please launch Docker Desktop, then re-run this script."
    exit 1
  fi
fi

# 2. Check if PHP is installed
if ! command -v php > /dev/null 2>&1; then
  echo "⚠️ PHP is not installed. Please run: brew install php"
  exit 1
fi

# 3. Ensure api/config.php exists
if [ ! -f api/config.php ]; then
  echo "==> Creating api/config.php from template..."
  cp api/config.example.php api/config.php
fi

# 4. Start MySQL Docker container
echo "==> 1. Starting database container..."
docker compose up -d

# 5. Wait until MySQL is ready
echo "==> 2. Waiting for MySQL to be ready..."
until docker exec where-mysql mysqladmin ping -h localhost -u root -pwhere_root_password --silent > /dev/null 2>&1; do
  sleep 1
done

# 6. Load seed database with all 128 cafes & photos
echo "==> 3. Ensuring database data is loaded..."
docker exec -i where-mysql mysql -uroot -pwhere_root_password cafecompass < database/seed.sql > /dev/null 2>&1 || true

# 7. Start local PHP server and open browser
echo "==> 4. Server ready! Opening in your browser:"
echo "     👉 http://localhost:8000"
echo "     (Press Ctrl+C to stop the server)"
echo ""

(sleep 1 && open "http://localhost:8000") &

php -S localhost:8000 router.php
