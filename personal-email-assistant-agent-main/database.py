
import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """Create and return a MySQL database connection."""
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "email_assistant"),
        )
        return conn
    except Error as e:
        raise RuntimeError(f"MySQL connection failed: {e}") from e


def initialize_database():
    """Create the email table if it does not exist."""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emails (
                gmail_id VARCHAR(255) PRIMARY KEY,
                sender VARCHAR(320),
                subject TEXT,
                body LONGTEXT,
                category VARCHAR(50),
                draft LONGTEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("MySQL emails table is ready.")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    initialize_database()
