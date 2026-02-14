ALTER TABLE assets
  MODIFY type ENUM('router','switch','server','other') DEFAULT 'router';
