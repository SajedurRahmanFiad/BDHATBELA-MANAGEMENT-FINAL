ALTER TABLE company_settings
  ADD COLUMN pages LONGTEXT NULL AFTER logo;

ALTER TABLE orders
  ADD COLUMN page_id VARCHAR(64) NULL AFTER customer_id,
  ADD COLUMN page_snapshot LONGTEXT NULL AFTER history,
  ADD KEY idx_orders_page_id (page_id);

DROP VIEW IF EXISTS orders_with_customer_creator;
CREATE VIEW orders_with_customer_creator AS
SELECT
  o.id,
  o.order_number AS orderNumber,
  o.order_date AS orderDate,
  o.customer_id AS customerId,
  o.page_id AS pageId,
  c.name AS customerName,
  c.phone AS customerPhone,
  c.address AS customerAddress,
  o.created_by AS createdBy,
  u.name AS creatorName,
  o.status,
  o.items,
  o.subtotal,
  o.discount,
  o.shipping,
  o.total,
  o.paid_amount AS paidAmount,
  o.notes,
  o.history,
  o.page_snapshot AS pageSnapshot,
  o.created_at AS createdAt,
  o.deleted_at AS deletedAt,
  o.deleted_by AS deletedBy,
  o.carrybee_consignment_id AS carrybeeConsignmentId,
  o.steadfast_consignment_id AS steadfastConsignmentId,
  o.paperfly_tracking_number AS paperflyTrackingNumber
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN users u ON u.id = o.created_by
WHERE o.deleted_at IS NULL;
