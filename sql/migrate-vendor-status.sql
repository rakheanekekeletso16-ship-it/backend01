ALTER TABLE vendors
  ADD COLUMN status ENUM('Available', 'Archived') NOT NULL DEFAULT 'Available'
  AFTER location;
