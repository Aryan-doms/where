#!/usr/bin/env python3
"""
WHERE? - Standalone Local Server
Runs natively with Python 3 and SQLite (no Docker or PHP required).
"""

import http.server
import json
import os
import re
import socketserver
import sqlite3
import sys
import urllib.parse
from http import HTTPStatus

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database", "where.db")

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def format_cafe(conn, row):
    cafe_id = row["id"]
    
    # Cuisines
    cur = conn.cursor()
    cur.execute(
        """SELECT cu.name FROM cafe_cuisines cc
           JOIN cuisines cu ON cu.cuisine_id = cc.cuisine_id
           WHERE cc.cafe_id = ? ORDER BY cu.name""",
        (cafe_id,),
    )
    cuisines = [r["name"] for r in cur.fetchall()]

    # Amenities
    cur.execute(
        """SELECT a.display_name FROM cafe_amenities ca
           JOIN amenities a ON a.amenity_key = ca.amenity_key
           WHERE ca.cafe_id = ? AND ca.is_available = 1
           ORDER BY a.display_name""",
        (cafe_id,),
    )
    amenities = [r["display_name"] for r in cur.fetchall()]

    # Images
    cur.execute(
        """SELECT ic.image_id, ic.image_url, ic.local_file, ci.alt_text
           FROM cafe_images ci
           JOIN image_catalog ic ON ic.image_id = ci.image_id
           WHERE ci.cafe_id = ?
           ORDER BY ci.is_cover DESC, ci.sort_order, ci.image_id""",
        (cafe_id,),
    )
    gallery = []
    for img in cur.fetchall():
        local_rel = img["local_file"] or ""
        local_full = os.path.join(BASE_DIR, local_rel.lstrip("/"))
        src = local_rel if (local_rel and os.path.isfile(local_full)) else img["image_url"]
        gallery.append({
            "image_id": img["image_id"],
            "image_url": img["image_url"],
            "local_file": img["local_file"],
            "alt_text": img["alt_text"],
            "src": src,
        })

    def extract_range(t):
        if not t:
            return ""
        cleaned = re.sub(r"12midnight", "12am", t, flags=re.IGNORECASE)
        cleaned = re.sub(r"12noon", "12pm", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace("–", "-").replace("—", "-")
        m = re.search(r"(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))", cleaned, re.I)
        if m:
            return m.group(1).replace("-", "–").strip()
        return ""

    weekday_range = extract_range(row["weekday_hours"]) or extract_range(row["timing"]) or "11am – 11pm"
    weekend_range = extract_range(row["weekend_hours"]) or extract_range(row["timing"]) or weekday_range
    timing = f"Mon–Fri: {weekday_range}\nSat–Sun: {weekend_range}"
    price = row["price_range"] if row["price_range"] else f"₹{int(float(row['price_for_two'] or 0)):,}"

    rating_val = None
    if row["rating"] is not None and float(row["rating"]) > 0:
        rating_val = f"{float(row['rating']):.1f}"

    cover_img = gallery[0]["src"] if gallery else ""

    return {
        "id": cafe_id,
        "name": row["name"],
        "slug": row["slug"] or "",
        "area_id": int(row["area_id"]),
        "area": row["area"],
        "area_slug": row["area_slug"] or "",
        "city": "Surat",
        "city_slug": "surat",
        "url_path": f"surat/{row['area_slug'] or 'area'}/{row['slug'] or cafe_id}",
        "location": row["location"],
        "address": row["location"],
        "cuisine": ", ".join(cuisines) if cuisines else row["cuisine_source"],
        "cuisines": cuisines,
        "niche": row["niche_type"],
        "niche_type": row["niche_type"],
        "timing": timing,
        "weekday_hours": row["weekday_hours"],
        "weekend_hours": row["weekend_hours"],
        "hours_note": row["hours_note"],
        "contact": row["contact_details_number"],
        "price": price,
        "price_for_two": float(row["price_for_two"] or 0),
        "rating": rating_val,
        "vibe": row["vibe_ambiance"],
        "moreInfo": row["more_info"],
        "maps_url": row["maps_url"],
        "amenities": amenities,
        "images": gallery,
        "cover_image": cover_img,
        "status": row["status"],
    }

def fetch_all_cafes(conn, published_only=True):
    sql = """
        SELECT c.*, a.display_name AS area, a.slug AS area_slug
        FROM cafes c
        JOIN areas a ON a.area_id = c.area_id
    """
    if published_only:
        sql += " WHERE c.status = 'published'"
    sql += " ORDER BY c.rating DESC, c.name ASC"
    
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    return [format_cafe(conn, r) for r in rows]


class WhereHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file_content(self, filepath, content_type=None):
        if not os.path.isfile(filepath):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return
        ext = os.path.splitext(filepath)[1].lower()
        mime = content_type or MIME_TYPES.get(ext, "application/octet-stream")
        with open(filepath, "rb") as f:
            content = f.read()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def locate_file(self, rel_path):
        rel_path = rel_path.lstrip("/")
        candidates = [
            os.path.join(BASE_DIR, rel_path),
            os.path.join(BASE_DIR, "html", rel_path),
            os.path.join(BASE_DIR, "css", rel_path),
            os.path.join(BASE_DIR, "js", rel_path),
            os.path.join(BASE_DIR, "assets", rel_path),
            os.path.join(BASE_DIR, "html", os.path.basename(rel_path)),
            os.path.join(BASE_DIR, "css", os.path.basename(rel_path)),
            os.path.join(BASE_DIR, "js", os.path.basename(rel_path)),
            os.path.join(BASE_DIR, "assets", os.path.basename(rel_path)),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API routes
        if path.startswith("/api/") or path.startswith("api/"):
            self.handle_api(path, query)
            return

        # 2. Clean routing
        # / or /home or /index.html
        if path in ["/", "/home", "/index.html"]:
            idx = self.locate_file("index.html")
            if idx:
                self.send_file_content(idx, "text/html; charset=utf-8")
                return

        # /admin or /admin/
        if path in ["/admin", "/admin/"]:
            admin_page = self.locate_file("admin.html")
            if admin_page:
                self.send_file_content(admin_page, "text/html; charset=utf-8")
                return

        # /surat Discovery routes
        parts = [p for p in path.strip("/").split("/") if p]
        if parts and parts[0] == "surat":
            if len(parts) == 1 or parts[1] in ["all", "all-spots"]:
                explore_page = self.locate_file("explore.html")
                if explore_page:
                    self.send_file_content(explore_page, "text/html; charset=utf-8")
                    return
            elif len(parts) == 2:
                explore_page = self.locate_file("explore.html")
                if explore_page:
                    self.send_file_content(explore_page, "text/html; charset=utf-8")
                    return
            elif len(parts) >= 3:
                cafe_page = self.locate_file("cafe.html")
                if cafe_page:
                    self.send_file_content(cafe_page, "text/html; charset=utf-8")
                    return

        # 3. Static files
        found = self.locate_file(path)
        if found:
            self.send_file_content(found)
            return

        # Fallback to index.html for unknown routes
        idx = self.locate_file("index.html")
        if idx:
            self.send_file_content(idx, "text/html; charset=utf-8")
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""
        
        if path.startswith("/api/") or path.startswith("api/"):
            self.handle_api(path, query, body)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def handle_api(self, path, query, body=b""):
        clean_path = path.lstrip("/")
        conn = get_db()

        try:
            # Home data
            if clean_path in ["api/home-data.php", "api/home-data"]:
                cafes = fetch_all_cafes(conn, published_only=True)
                types_count = {}
                for c in cafes:
                    t = c["niche"] or "other"
                    types_count[t] = types_count.get(t, 0) + 1
                types_list = [{"name": k, "count": v} for k, v in sorted(types_count.items(), key=lambda x: -x[1])]

                cur = conn.cursor()
                cur.execute("""
                    SELECT a.area_id, a.display_name AS name, a.slug,
                           COUNT(c.id) AS count,
                           ha.position, ha.image_1, ha.image_2, ha.image_3
                    FROM homepage_areas ha
                    JOIN areas a ON a.area_id = ha.area_id
                    LEFT JOIN cafes c ON c.area_id = a.area_id AND c.status = 'published'
                    GROUP BY a.area_id, a.display_name, a.slug, ha.position, ha.image_1, ha.image_2, ha.image_3
                    ORDER BY ha.position ASC
                """)
                areas_list = []
                for row in cur.fetchall():
                    imgs = [img for img in [row["image_1"], row["image_2"], row["image_3"]] if img]
                    areas_list.append({
                        "area_id": row["area_id"],
                        "name": row["name"],
                        "slug": row["slug"],
                        "count": row["count"],
                        "position": row["position"],
                        "images": imgs,
                    })

                cur.execute("""
                    SELECT c.id FROM homepage_featured_cafes h
                    JOIN cafes c ON c.id = h.cafe_id
                    WHERE c.status = 'published'
                    ORDER BY h.position
                """)
                featured = [r["id"] for r in cur.fetchall()]
                if not featured:
                    featured = [c["id"] for c in cafes[:6]]

                cur.execute("""
                    SELECT section_key, title, body, media_path, link_label, link_url, is_published
                    FROM homepage_sections ORDER BY sort_order
                """)
                sections = [dict(r) for r in cur.fetchall()]

                self.send_json({
                    "cafes": cafes,
                    "types": types_list,
                    "areas": areas_list,
                    "featured": featured,
                    "sections": sections,
                })
                return

            # Cafes list / single cafe
            if clean_path in ["api/cafes.php", "api/cafes", "api/cafe-data.php", "api/cafe-data"]:
                req_id = (query.get("id", [""])[0]).strip()
                req_slug = (query.get("slug", [""])[0]).strip()
                req_area = (query.get("area", [""])[0]).strip()
                req_niche = (query.get("niche", [""])[0]).strip()

                if req_id or req_slug:
                    cur = conn.cursor()
                    sql = """
                        SELECT c.*, a.display_name AS area, a.slug AS area_slug
                        FROM cafes c
                        JOIN areas a ON a.area_id = c.area_id
                        WHERE c.status = 'published'
                    """
                    params = []
                    if req_id:
                        sql += " AND c.id = ?"
                        params.append(req_id)
                    elif req_slug:
                        sql += " AND c.slug = ?"
                        params.append(req_slug)
                        if req_area:
                            sql += " AND (a.slug = ? OR a.display_name = ?)"
                            params.extend([req_area, req_area])
                    cur.execute(sql, params)
                    row = cur.fetchone()
                    if not row:
                        self.send_json({"error": "Cafe not found."}, 404)
                        return
                    self.send_json(format_cafe(conn, row))
                    return

                cafes = fetch_all_cafes(conn, published_only=True)
                if req_area:
                    cafes = [c for c in cafes if c.get("area_slug") == req_area or c.get("area") == req_area]
                if req_niche:
                    cafes = [c for c in cafes if c.get("niche", "").lower() == req_niche.lower()]
                
                self.send_json({"cafes": cafes})
                return

            # User & Reviews
            if clean_path in ["api/user.php", "api/user"]:
                action = (query.get("action", [""])[0]).strip()
                if action == "reviews":
                    cafe_id = (query.get("cafe_id", [""])[0]).strip()
                    cur = conn.cursor()
                    cur.execute("""
                        SELECT r.review_id, r.cafe_id, r.review_text, r.created_at,
                               u.username, u.profile_image_path
                        FROM reviews r
                        JOIN users u ON u.user_id = r.user_id
                        WHERE r.cafe_id = ?
                        ORDER BY r.created_at DESC
                    """, (cafe_id,))
                    reviews = [dict(r) for r in cur.fetchall()]
                    self.send_json({"reviews": reviews})
                    return
                elif action == "me":
                    self.send_json({"authenticated": False, "user": None})
                    return
                else:
                    self.send_json({"status": "ok"})
                    return

            # Admin API placeholder
            if clean_path in ["api/admin.php", "api/admin"]:
                action = (query.get("action", ["dashboard"])[0]).strip()
                if action == "dashboard":
                    cur = conn.cursor()
                    cur.execute("SELECT COUNT(*) FROM cafes WHERE status = 'published'")
                    pub = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM cafes")
                    tot = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM areas")
                    areas_c = cur.fetchone()[0]
                    self.send_json({
                        "counts": {"published": pub, "total": tot, "areas": areas_c},
                        "cafes": fetch_all_cafes(conn, published_only=False),
                    })
                    return
                self.send_json({"status": "ok"})
                return

            self.send_json({"error": "Unknown endpoint"}, 404)
        finally:
            conn.close()


def run_server():
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), WhereHandler) as httpd:
        print(f"🚀 WHERE? local server running at http://localhost:{PORT}")
        print("   Database: database/where.db (SQLite built-in)")
        print("   (Press Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
