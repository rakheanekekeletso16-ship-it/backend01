USE batloung_farm;

SET @add_package_status = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE fruit_prices ADD COLUMN status ENUM(''Available'', ''Unavailable'') NOT NULL DEFAULT ''Available'' AFTER unit_price',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fruit_prices'
    AND COLUMN_NAME = 'status'
);
PREPARE add_package_status FROM @add_package_status;
EXECUTE add_package_status;
DEALLOCATE PREPARE add_package_status;
