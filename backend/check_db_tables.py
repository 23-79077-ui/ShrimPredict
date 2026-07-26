import mysql.connector

try:
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="shrim_predict_db"
    )
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    tables = [row[0] for row in cursor.fetchall()]
    print("MySQL Tables in shrim_predict_db:", tables)
    conn.close()
except Exception as e:
    print("Database error:", e)
