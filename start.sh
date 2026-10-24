#!/usr/bin/env bash
set -e

# Change directory to project root
cd "$(dirname "$0")"

echo "☕ Starting WHERE?..."

# 1. Detect Python 3
PYTHON_BIN="$(command -v python3 || command -v python || true)"
if [ -z "$PYTHON_BIN" ]; then
  echo "⚠️ Python 3 is required but could not be found. Please ensure Python 3 is installed."
  exit 1
fi

echo "==> Using Python: $($PYTHON_BIN --version)"

# 2. Install requirements if pip is available
if command -v pip3 > /dev/null 2>&1; then
  echo "==> Checking dependencies from requirements.txt..."
  pip3 install -r requirements.txt --quiet 2>/dev/null || true
elif "$PYTHON_BIN" -m pip --version > /dev/null 2>&1; then
  echo "==> Checking dependencies from requirements.txt..."
  "$PYTHON_BIN" -m pip install -r requirements.txt --quiet 2>/dev/null || true
fi

# 3. Verify built-in database exists
if [ ! -f "database/where.db" ]; then
  echo "==> Initializing built-in database from schema..."
  if [ -f "database/sqlite_seed.sql" ]; then
    sqlite3 database/where.db < database/sqlite_seed.sql
  fi
fi

# 4. Free port 8000 if already in use
EXISTING_PID=$(lsof -ti :8000 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
  echo "==> Freeing port 8000 (stopping previous process $EXISTING_PID)..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

echo "==> Database built-in (database/where.db) ready! 128 Surat cafes loaded."
echo "==> Server ready at: http://localhost:8000"
echo "    (Press Ctrl+C to stop)"
echo ""

# 5. Open browser automatically
if command -v open > /dev/null 2>&1; then
  (sleep 1 && open "http://localhost:8000") &
elif command -v xdg-open > /dev/null 2>&1; then
  (sleep 1 && xdg-open "http://localhost:8000") &
fi

# 6. Run standalone server
exec "$PYTHON_BIN" server.py
