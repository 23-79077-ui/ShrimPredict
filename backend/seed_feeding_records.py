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
            (2, 'Pond A2', 600.0, 45.0),
            (3, 'Pond B1', 450.0, 45.0),
            (4, 'Pond B2', 400.0, 45.0),
            (5, 'Pond C1', 550.0, 45.0),
        ]

        for pid, name, size, target in ponds_data:
            cursor.execute("""
                INSERT INTO ponds (id, pond_name, size_sqm, target_feed_kg)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE pond_name=%s, target_feed_kg=%s
            """, (pid, name, size, target, name, target))
        conn.commit()

        # Clear existing feeding records
        cursor.execute("DELETE FROM feeding_records")
        conn.commit()

        today = datetime.now().date()
        yesterday = today - timedelta(days=1)

        # Standard 5 Feeding Sessions: 6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM
        standard_slots = [
            ('6:00 AM', 1, 'Sanolife PRO-2', '1st feeding session (Morning)'),
            ('9:00 AM', 0, 'None', '2nd feeding session (Mid-Morning)'),
            ('12:00 PM', 1, 'Vitamin C', '3rd feeding session (Noon)'),
            ('3:00 PM', 0, 'None', '4th feeding session (Afternoon)'),
            ('6:00 PM', 1, 'Sanolife PRO-2', '5th feeding session (Evening)'),
        ]

        query = """
            INSERT INTO feeding_records 
            (pond_id, amount_kg, feed_type, feeding_time, product_code, has_vitamin, vitamin_name, record_date, notes, recorded_by_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        inserted_count = 0
        for pid, name, size, target in ponds_data:
            for time_str, has_vit, vit_name, note in standard_slots:
                # 9.0 kg per session = 45.0 kg total
                cursor.execute(query, (pid, 9.0, 'Tateh - Starter', time_str, 'Starter', has_vit, vit_name, str(today), note, 'Caretaker Staff'))
                cursor.execute(query, (pid, 9.0, 'Tateh - Starter', time_str, 'Starter', has_vit, vit_name, str(yesterday), note, 'Caretaker Staff'))
                inserted_count += 2

        conn.commit()
        print(f"Successfully seeded {inserted_count} standard 5-session feeding records into shrim_predict_db!")
        conn.close()
    except Exception as e:
        print("Error seeding database:", e)

if __name__ == "__main__":
    seed_feeding_data()
