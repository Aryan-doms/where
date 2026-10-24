from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sqlite3
import urllib.parse
from http import HTTPStatus

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_db():
    candidates = [
        os.path.join(BASE_DIR, "where.db"),
        os.path.join(BASE_DIR, "..", "database", "where.db"),
        os.path.join(os.getcwd(), "database", "where.db"),
        os.path.join(os.getcwd(), "api", "where.db"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            conn = sqlite3.connect(p)
            conn.row_factory = sqlite3.Row
            return conn
    raise FileNotFoundError("SQLite database where.db not found")

def format_cafe(conn, row):
    cafe_id = row["id"]
    cur = conn.cursor()
    cur.execute(
        """SELECT cu.name FROM cafe_cuisines cc
           JOIN cuisines cu ON cu.cuisine_id = cc.cuisine_id
           WHERE cc.cafe_id = ? ORDER BY cu.name""",
        (cafe_id,),
    )
    cuisines = [r["name"] for r in cur.fetchall()]

    cur.execute(
        """SELECT a.display_name FROM cafe_amenities ca
           JOIN amenities a ON a.amenity_key = ca.amenity_key
           WHERE ca.cafe_id = ? AND ca.is_available = 1
           ORDER BY a.display_name""",
        (cafe_id,),
    )
    amenities = [r["display_name"] for r in cur.fetchall()]

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
        src = local_rel if local_rel else img["image_url"]
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

class handler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=60")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        
        # Route determination
        route = query.get("__route", [None])[0]
        if not route:
            route = self.headers.get("x-matched-path", "") or parsed.path
        route = route.lstrip("/")

        try:
            conn = get_db()
        except Exception as e:
            # Fallback to static JSON if sqlite fails
            if "home-data" in route:
                fallback_path = os.path.join(BASE_DIR, "home-data.json")
                if os.path.isfile(fallback_path):
                    with open(fallback_path, "r", encoding="utf-8") as f:
                        return self.send_json(json.load(f))
            elif "cafe" in route:
                fallback_path = os.path.join(BASE_DIR, "cafes.json")
                if os.path.isfile(fallback_path):
                    with open(fallback_path, "r", encoding="utf-8") as f:
                        return self.send_json(json.load(f))
            return self.send_json({"error": str(e)}, 500)

        try:
            # Home data
            if "home-data" in route:
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

                return self.send_json({
                    "cafes": cafes,
                    "types": types_list,
                    "areas": areas_list,
                    "featured": featured,
                    "sections": sections,
                })

            # Cafes
            if "cafe" in route:
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
                        return self.send_json({"error": "Cafe not found."}, 404)
                    return self.send_json(format_cafe(conn, row))

                cafes = fetch_all_cafes(conn, published_only=True)
                if req_area:
                    cafes = [c for c in cafes if c.get("area_slug") == req_area or c.get("area") == req_area]
                if req_niche:
                    cafes = [c for c in cafes if c.get("niche", "").lower() == req_niche.lower()]

                return self.send_json({"cafes": cafes})

            # User & Reviews
            if "user" in route:
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
                    return self.send_json({"reviews": reviews})
                elif action == "me":
                    return self.send_json({"authenticated": False, "user": None})
                return self.send_json({"status": "ok"})

            # Admin
            if "admin" in route:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM cafes WHERE status = 'published'")
                pub = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM cafes")
                tot = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM areas")
                areas_c = cur.fetchone()[0]
                return self.send_json({
                    "counts": {"published": pub, "total": tot, "areas": areas_c},
                    "cafes": fetch_all_cafes(conn, published_only=False),
                })

            return self.send_json({"error": "Unknown route", "route": route}, 404)
        finally:
            conn.close()

    def do_POST(self):
        return self.do_GET()
