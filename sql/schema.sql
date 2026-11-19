CREATE DATABASE IF NOT EXISTS batloung_farm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_name VARCHAR(120) NOT NULL,
  contact_person VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  province ENUM('Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape',
    'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West') NOT NULL,
  address VARCHAR(255) NOT NULL,
  PRIMARY KEY (supplier_id),
  UNIQUE KEY uq_suppliers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fruits (
  fruit_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Available',
  PRIMARY KEY (fruit_id),
  UNIQUE KEY uq_fruits_name (fruit_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendors (
  vendor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  location VARCHAR(180) NOT NULL,
  status ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Available',
  registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  PRIMARY KEY (vendor_id),
  UNIQUE KEY uq_vendors_phone (phone_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fruit_prices (
  fruit_id INT UNSIGNED NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  status ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Available',
  PRIMARY KEY (fruit_id, packaging_size),
  CONSTRAINT chk_fruit_prices_positive CHECK (unit_price > 0),
  CONSTRAINT fk_fruit_prices_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id INT UNSIGNED NOT NULL,
  purchase_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (purchase_id),
  CONSTRAINT chk_purchases_total CHECK (total_amount >= 0),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_details (
  purchase_detail_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id INT UNSIGNED NOT NULL,
  fruit_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  PRIMARY KEY (purchase_detail_id),
  CONSTRAINT chk_purchase_quantity CHECK (quantity > 0),
  CONSTRAINT chk_purchase_unit_cost CHECK (unit_cost > 0),
  CONSTRAINT fk_purchase_details_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (purchase_id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_details_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  sale_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id INT UNSIGNED NOT NULL,
  sale_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  payment_status ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
  payment_method ENUM('CASH', 'MOBILE_MONEY', 'CREDIT') NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (sale_id),
  CONSTRAINT chk_sales_total CHECK (total_amount >= 0),
  CONSTRAINT chk_sales_paid CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
  CONSTRAINT fk_sales_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_details (
  sales_detail_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  fruit_id INT UNSIGNED NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (sales_detail_id),
  CONSTRAINT chk_sales_quantity CHECK (quantity > 0),
  CONSTRAINT chk_sales_unit_price CHECK (unit_price > 0),
  CONSTRAINT fk_sales_details_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_details_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock (
  stock_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_id INT UNSIGNED NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stock_id),
  UNIQUE KEY uq_stock_fruit_package (fruit_id, packaging_size),
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO suppliers (supplier_id, business_name, contact_person, phone, province, address) VALUES
  (1, 'Highveld Fresh Produce', 'Thabo Mokoena', '+27 11 555 0181', 'Gauteng', 'Johannesburg Market, Johannesburg'),
  (2, 'Cape Valley Farms', 'Lerato Ndlovu', '+27 21 555 0142', 'Western Cape', 'Paarl Produce Road, Paarl'),
  (3, 'Sunrise Citrus Co-op', 'Nomsa Dlamini', '+27 15 555 0165', 'Limpopo', 'Citrusdal Road, Tzaneen');

INSERT IGNORE INTO fruits (fruit_id, fruit_name, description, status) VALUES
  (1, 'Apples', 'Crisp seasonal apples', 'Available'),
  (2, 'Bananas', 'Ripe yellow bananas', 'Available'),
  (3, 'Oranges', 'Fresh citrus oranges', 'Available'),
  (4, 'Mangoes', 'Sweet seasonal mangoes', 'Available'),
  (5, 'Grapes', 'Seedless table grapes', 'Available');

INSERT IGNORE INTO vendors (vendor_id, vendor_name, phone_number, location) VALUES
  (1, 'Maseru Market Stall 14', '+266 5912 3401', 'Maseru Central Market'),
  (2, 'Leribe Fresh Corner', '+266 5987 2104', 'Hlotse, Leribe'),
  (3, 'South Gate Produce', '+266 5843 7612', 'Mazenod, Maseru');

INSERT IGNORE INTO fruit_prices (fruit_id, packaging_size, unit_price) VALUES
  (1, 'SMALL', 85.00), (1, 'MEDIUM', 120.00), (1, 'LARGE', 160.00),
  (2, 'SMALL', 60.00), (2, 'MEDIUM', 90.00), (2, 'LARGE', 120.00),
  (3, 'SMALL', 70.00), (3, 'MEDIUM', 100.00), (3, 'LARGE', 140.00),
  (4, 'SMALL', 100.00), (4, 'MEDIUM', 150.00), (4, 'LARGE', 200.00),
  (5, 'SMALL', 120.00), (5, 'MEDIUM', 180.00), (5, 'LARGE', 240.00);

INSERT IGNORE INTO purchases (purchase_id, supplier_id, purchase_date, total_amount) VALUES
  (1, 1, '2026-11-10', 11964.00),
  (2, 2, '2026-11-12', 9780.00);

INSERT IGNORE INTO purchase_details (purchase_detail_id, purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
  (1, 1, 1, 30, 55.00, 'SMALL'), (2, 1, 1, 20, 80.00, 'MEDIUM'), (3, 1, 1, 12, 110.00, 'LARGE'),
  (4, 1, 2, 35, 40.00, 'SMALL'), (5, 1, 2, 24, 60.00, 'MEDIUM'), (6, 1, 2, 14, 80.00, 'LARGE'),
  (7, 1, 3, 28, 45.00, 'SMALL'), (8, 1, 3, 18, 68.00, 'MEDIUM'), (9, 1, 3, 10, 95.00, 'LARGE'),
  (10, 2, 4, 25, 70.00, 'SMALL'), (11, 2, 4, 16, 105.00, 'MEDIUM'), (12, 2, 4, 9, 140.00, 'LARGE'),
  (13, 2, 5, 22, 85.00, 'SMALL'), (14, 2, 5, 14, 130.00, 'MEDIUM'), (15, 2, 5, 8, 175.00, 'LARGE');

INSERT IGNORE INTO sales (sale_id, vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid) VALUES
  (1, 1, '2026-11-13', 'PAID', 'CASH', 435.00, 435.00),
  (2, 2, '2026-11-14', 'PARTIALLY_PAID', 'MOBILE_MONEY', 400.00, 350.00),
  (3, 1, '2026-11-15', 'UNPAID', 'CREDIT', 500.00, 0.00);

INSERT IGNORE INTO sales_details (sales_detail_id, sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
  (1, 1, 1, 'SMALL', 3, 85.00), (2, 1, 2, 'MEDIUM', 2, 90.00),
  (3, 2, 3, 'LARGE', 2, 140.00), (4, 2, 5, 'SMALL', 1, 120.00),
  (5, 3, 4, 'SMALL', 5, 100.00);

INSERT IGNORE INTO stock (fruit_id, packaging_size, available_quantity) VALUES
  (1, 'SMALL', 27), (1, 'MEDIUM', 20), (1, 'LARGE', 12),
  (2, 'SMALL', 35), (2, 'MEDIUM', 22), (2, 'LARGE', 14),
  (3, 'SMALL', 28), (3, 'MEDIUM', 18), (3, 'LARGE', 8),
  (4, 'SMALL', 20), (4, 'MEDIUM', 16), (4, 'LARGE', 9),
  (5, 'SMALL', 21), (5, 'MEDIUM', 14), (5, 'LARGE', 8);
