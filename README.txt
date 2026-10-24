================================================================================
WHERE? - Surat Cafe Discovery Platform
================================================================================

A web platform to discover and explore cafes, coffee spots, and eateries in Surat.

--------------------------------------------------------------------------------
HOW TO RUN
--------------------------------------------------------------------------------

Run the startup script in terminal:

    ./start.sh

The script will automatically detect Python, check the database, start the local
server on port 8000, and open the homepage in your default web browser.

To stop the server at any time, press Ctrl + C.

Alternatively, you can run directly with Python:

    python3 server.py

Or if you have PHP installed:

    php -S localhost:8000 router.php

--------------------------------------------------------------------------------
PROJECT STRUCTURE
--------------------------------------------------------------------------------
- start.sh          Startup script
- server.py         Python standalone server
- requirements.txt  Python requirements
- router.php        PHP server router
- index.html        Main entry page
- where.png         Brand logo
- html/             HTML pages (about, explore, cafe, admin, login, signup, profile)
- css/              Stylesheets (styles.css, admin.css)
- js/               JavaScript files (script, explore, cafe-details, admin, auth)
- assets/           Media files (videos, stickers, cafe images)
- database/         Database schema and seed files (where.db, seed.sql, schema.sql)
- api/              Backend PHP API endpoints
- oep_submission/   Clean PHP-MySQL-Bootstrap folder ready for OEP academic submission
- archive/          Archived scraper scripts and raw data dumps (gitignored)
