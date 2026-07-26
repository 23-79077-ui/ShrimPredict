import mysql.connector
from datetime import datetime, timedelta

def seed_feeding_data():
    try:
        conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="shrim_predict_db"
        )
        cursor = conn.cursor()

        # 1. Ensure ponds exist
        ponds_data = [
            (1, 'Pond A1', 500.0, 45.0),
            (2, 'Pond A2', 600.0, 50.0),
            (3, 'Pond B1', 450.0, 40.0),
            (4, 'Pond B2', 400.0, 35.0),
            (5, 'Pond C1', 550.0, 48.0),
        ]

        for pid, name, size, target in ponds_data:
            cursor.execute("""
                INSERT INTO ponds (id, pond_name, size_sqm, target_feed_kg)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE pond_name=%s, target_feed_kg=%s
            """, (pid, name, size, target, name, target))
        conn.commit()

        # 2. Check feeding_records
        cursor.execute("SELECT COUNT(*) FROM feeding_records")
        count = cursor.fetchone()[0]

        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        two_days_ago = today - timedelta(days=2)
        three_days_ago = today - timedelta(days=3)

        records_to_insert = [
            # Today's Feeding Records
            (1, 15.0, 'Tateh - Starter', '06:00 AM', 'Starter', 1, 'Vitamin C', str(today), 'Morning feeding complete', 'Juan Dela Cruz'),
            (1, 15.0, 'Tateh - Starter', '11:00 AM', 'Starter', 0, 'None', str(today), 'Noon feeding done', 'Juan Dela Cruz'),
            (1, 15.0, 'Tateh - Starter', '04:00 PM', 'Starter', 1, 'Multi-Vit', str(today), 'Afternoon feeding done', 'Juan Dela Cruz'),

            (2, 18.0, 'Tateh - Grower', '06:30 AM', 'Grower', 1, 'Amino Boost', str(today), 'High appetite observed', 'Maria Santos'),
            (2, 20.0, 'Tateh - Grower', '11:30 AM', 'Grower', 0, 'None', str(today), 'Heavy feeding', 'Maria Santos'),
            (2, 20.0, 'Tateh - Grower', '04:30 PM', 'Grower', 1, 'Vitamin C', str(today), 'Slight overfeeding warning', 'Maria Santos'),

            (3, 13.0, 'Tateh - Starter', '07:00 AM', 'Starter', 0, 'None', str(today), 'Normal feeding', 'Pedro Penduko'),
            (3, 13.0, 'Tateh - Starter', '12:00 PM', 'Starter', 1, 'Vitamin C', str(today), 'Good tray clearance', 'Pedro Penduko'),
            (3, 14.0, 'Tateh - Starter', '05:00 PM', 'Starter', 0, 'None', str(today), 'Evening ration complete', 'Pedro Penduko'),

            (4, 9.0, 'Tateh - Grower', '07:30 AM', 'Grower', 0, 'None', str(today), 'Lower feed response', 'Elena Cruz'),
            (4, 9.0, 'Tateh - Grower', '12:30 PM', 'Grower', 0, 'None', str(today), 'Underfeeding alert', 'Elena Cruz'),
            (4, 10.0, 'Tateh - Grower', '05:30 PM', 'Grower', 1, 'Probiotics', str(today), 'Probiotics added', 'Elena Cruz'),

            # Yesterday's Records
            (1, 45.0, 'Tateh - Starter', '06:00 AM', 'Starter', 1, 'Vitamin C', str(yesterday), 'Full day feed ration', 'Juan Dela Cruz'),
            (2, 52.0, 'Tateh - Grower', '06:30 AM', 'Grower', 0, 'None', str(yesterday), 'Full day feed ration', 'Maria Santos'),
            (3, 39.0, 'Tateh - Starter', '07:00 AM', 'Starter', 1, 'Multi-Vit', str(yesterday), 'Full day feed ration', 'Pedro Penduko'),

            # Earlier Records
            (1, 44.0, 'Tateh - Starter', '06:00 AM', 'Starter', 1, 'Vitamin C', str(two_days_ago), 'Normal log', 'Juan Dela Cruz'),
            (2, 48.0, 'Tateh - Grower', '06:30 AM', 'Grower', 0, 'None', str(two_days_ago), 'Normal log', 'Maria Santos'),
            (3, 40.0, 'Tateh - Starter', '07:00 AM', 'Starter', 1, 'Multi-Vit', str(three_days_ago), 'Normal log', 'Pedro Penduko'),
        ]

        query = """
            INSERT INTO feeding_records 
            (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, vitamin_name, record_date, notes, recorded_by_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        for rec in records_to_insert:
            cursor.execute(query, rec)

        conn.commit()
        print(f"Successfully seeded {len(records_to_insert)} feeding records into shrim_predict_db!")
        conn.close()
    except Exception as e:
        print("Error seeding database:", e)

if __name__ == "__main__":
    seed_feeding_data()
