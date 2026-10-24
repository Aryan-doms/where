USE cafecompass;

CREATE TABLE IF NOT EXISTS areas (
  area_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  standardized_category VARCHAR(191) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  PRIMARY KEY (area_id),
  UNIQUE KEY uq_areas_standardized_category (standardized_category),
  UNIQUE KEY uq_areas_display_name (display_name),
  UNIQUE KEY uq_areas_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS area_sources (
  area_source_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  area_id INT UNSIGNED NOT NULL,
  source_row_number SMALLINT UNSIGNED NOT NULL,
  source_area_name VARCHAR(150) NOT NULL,
  source_zone VARCHAR(150) NOT NULL,
  source_subzone_id VARCHAR(32) NOT NULL,
  source_cafes_scraped_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (area_source_id),
  UNIQUE KEY uq_area_sources_row_number (source_row_number),
  KEY ix_area_sources_area_id (area_id),
  CONSTRAINT fk_area_sources_area FOREIGN KEY (area_id)
    REFERENCES areas (area_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cafes (
  id VARCHAR(16) NOT NULL,
  source_row_number SMALLINT UNSIGNED NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  area_id INT UNSIGNED NOT NULL,
  location TEXT NOT NULL,
  cuisine_source TEXT NOT NULL,
  niche_type VARCHAR(200) NOT NULL,
  timing TEXT NOT NULL,
  weekday_hours VARCHAR(255) NULL,
  weekend_hours VARCHAR(255) NULL,
  hours_note TEXT NULL,
  contact_details_number VARCHAR(100) NOT NULL DEFAULT '',
  price_range VARCHAR(100) NOT NULL DEFAULT '',
  price_for_two INT UNSIGNED NOT NULL DEFAULT 0,
  vibe_ambiance TEXT NOT NULL,
  more_info TEXT NOT NULL,
  maps_url VARCHAR(500) NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cafes_source_row_number (source_row_number),
  KEY ix_cafes_area_id (area_id),
  KEY ix_cafes_name (name),
  UNIQUE KEY uq_cafes_slug (slug),
  KEY ix_cafes_niche_type (niche_type),
  KEY ix_cafes_price_for_two (price_for_two),
  KEY ix_cafes_status (status),
  CONSTRAINT fk_cafes_area FOREIGN KEY (area_id)
    REFERENCES areas (area_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cuisines (
  cuisine_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (cuisine_id),
  UNIQUE KEY uq_cuisines_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cafe_cuisines (
  cafe_id VARCHAR(16) NOT NULL,
  cuisine_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (cafe_id, cuisine_id),
  CONSTRAINT fk_cafe_cuisines_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_cafe_cuisines_cuisine FOREIGN KEY (cuisine_id)
    REFERENCES cuisines (cuisine_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS amenities (
  amenity_key VARCHAR(64) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (amenity_key),
  UNIQUE KEY uq_amenities_display_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cafe_amenities (
  cafe_id VARCHAR(16) NOT NULL,
  amenity_key VARCHAR(64) NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (cafe_id, amenity_key),
  CONSTRAINT fk_cafe_amenities_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_cafe_amenities_amenity FOREIGN KEY (amenity_key)
    REFERENCES amenities (amenity_key) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS image_catalog (
  image_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_name VARCHAR(255) NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  local_file VARCHAR(500) NOT NULL DEFAULT '',
  source_status VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (image_id),
  UNIQUE KEY uq_image_catalog_image_url (image_url(500))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cafe_images (
  cafe_id VARCHAR(16) NOT NULL,
  image_id INT UNSIGNED NOT NULL,
  alt_text VARCHAR(255) NOT NULL DEFAULT '',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_cover TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (cafe_id, image_id),
  KEY ix_cafe_images_order (cafe_id, sort_order),
  CONSTRAINT fk_cafe_images_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_cafe_images_image FOREIGN KEY (image_id)
    REFERENCES image_catalog (image_id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  phone_number CHAR(10) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_image_path VARCHAR(500) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_phone_number (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  user_id INT UNSIGNED NOT NULL,
  cafe_id VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, cafe_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_favorites_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  review_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cafe_id VARCHAR(16) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  review_text VARCHAR(280) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  KEY ix_reviews_cafe_created (cafe_id, created_at),
  CONSTRAINT fk_reviews_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS homepage_sections (
  section_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_key VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  media_path VARCHAR(500) NOT NULL DEFAULT '',
  link_label VARCHAR(100) NOT NULL DEFAULT '',
  link_url VARCHAR(500) NOT NULL DEFAULT '',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (section_id),
  UNIQUE KEY uq_homepage_sections_key (section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS homepage_featured_cafes (
  cafe_id VARCHAR(16) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (cafe_id),
  UNIQUE KEY uq_homepage_featured_position (position),
  CONSTRAINT fk_homepage_featured_cafe FOREIGN KEY (cafe_id)
    REFERENCES cafes (id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS homepage_areas (
  area_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  image_1 VARCHAR(1000) NOT NULL DEFAULT '',
  image_2 VARCHAR(1000) NOT NULL DEFAULT '',
  image_3 VARCHAR(1000) NOT NULL DEFAULT '',
  PRIMARY KEY (area_id),
  UNIQUE KEY uq_homepage_areas_position (position),
  CONSTRAINT fk_homepage_areas_area FOREIGN KEY (area_id)
    REFERENCES areas (area_id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO amenities (amenity_key, display_name) VALUES
  ('lunch', 'Lunch'),
  ('dinner', 'Dinner'),
  ('home-delivery', 'Home delivery'),
  ('vegetarian-only', 'Vegetarian only'),
  ('elevator-access', 'Elevator access'),
  ('wifi', 'Wifi'),
  ('indoor-seating', 'Indoor seating'),
  ('outdoor-seating', 'Outdoor seating'),
  ('family-friendly', 'Family friendly'),
  ('city-view', 'City view'),
  ('work-friendly', 'Work friendly'),
  ('vegetarian-friendly', 'Vegetarian friendly');

INSERT IGNORE INTO homepage_sections
  (section_key, title, body, media_path, link_label, link_url, sort_order, is_published)
VALUES
  ('hero', '', '', 'assets/where.mp4', 'Find your somewhere', '#cafe-types', 1, 1),
  ('poster', 'Not your typical map.', 'Find your niche place.', '', '', '', 2, 1);
