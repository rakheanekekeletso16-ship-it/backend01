-- Five most frequently sold fruits, ranked by boxes sold.
SELECT f.fruit_name, SUM(sd.quantity) AS boxes_sold
FROM sales_details sd
JOIN fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY boxes_sold DESC
LIMIT 5;

-- Total sales revenue for a selected date range (replace the dates).
SELECT COALESCE(SUM(total_amount), 0) AS total_sales_revenue
FROM sales
WHERE sale_date BETWEEN '2026-11-01' AND '2026-11-30';

-- Vendor who purchased the highest number of boxes.
SELECT v.vendor_name, SUM(sd.quantity) AS boxes_purchased
FROM sales_details sd
JOIN sales s ON s.sale_id = sd.sale_id
JOIN vendors v ON v.vendor_id = s.vendor_id
GROUP BY v.vendor_id, v.vendor_name
ORDER BY boxes_purchased DESC
LIMIT 1;

-- Current stock for every fruit/package size combination.
SELECT f.fruit_name, st.packaging_size, st.available_quantity
FROM stock st
JOIN fruits f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name, FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE');
