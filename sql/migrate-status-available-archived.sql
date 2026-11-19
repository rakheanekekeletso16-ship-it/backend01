USE batloung_farm;

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
  MODIFY status ENUM('Available', 'Archived')
  NOT NULL DEFAULT 'Available';

ALTER TABLE vendors
  MODIFY status ENUM('ACTIVE', 'INACTIVE', 'Available', 'Archived')
  NOT NULL DEFAULT 'Available';

UPDATE vendors
SET status = CASE UPPER(status)
  WHEN 'ACTIVE' THEN 'Available'
  WHEN 'INACTIVE' THEN 'Archived'
  ELSE status
END;

ALTER TABLE vendors
  MODIFY status ENUM('Available', 'Archived')
  NOT NULL DEFAULT 'Available';
