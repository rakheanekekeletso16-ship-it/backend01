-- Migrate the earlier schema, where selling prices lived on stock rows.
-- Prices are copied before the redundant stock column is removed.
USE batloung_farm;

CREATE TABLE IF NOT EXISTS fruit_prices (
  fruit_id INT NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (fruit_id, packaging_size),
  CONSTRAINT fk_fruit_prices_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @copy_legacy_stock_prices = (
  SELECT IF(
    COUNT(*) > 0,
    'INSERT IGNORE INTO fruit_prices (fruit_id, packaging_size, unit_price) SELECT fruit_id, UPPER(packaging_size), selling_price FROM stock WHERE selling_price > 0',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock'
    AND COLUMN_NAME = 'selling_price'
);
PREPARE copy_legacy_stock_prices FROM @copy_legacy_stock_prices;
EXECUTE copy_legacy_stock_prices;
DEALLOCATE PREPARE copy_legacy_stock_prices;

ALTER TABLE fruits
  MODIFY status ENUM('ACTIVE', 'INACTIVE', 'Available', 'Archived')
  NOT NULL DEFAULT 'Available';

UPDATE fruits
SET status = CASE UPPER(status)
  WHEN 'ACTIVE' THEN 'Available'
  WHEN 'INACTIVE' THEN 'Archived'
  ELSE status
END;

ALTER TABLE fruits
  MODIFY status ENUM('Available', 'Archived') NOT NULL DEFAULT 'Available';

ALTER TABLE stock
  MODIFY packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL;

SET @drop_legacy_stock_price = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE stock DROP COLUMN selling_price',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock'
    AND COLUMN_NAME = 'selling_price'
);
PREPARE drop_legacy_stock_price FROM @drop_legacy_stock_price;
EXECUTE drop_legacy_stock_price;
DEALLOCATE PREPARE drop_legacy_stock_price;
