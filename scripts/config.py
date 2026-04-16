"""
Database configuration for Big Data Fraud Detection
"""

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "123",
    "dbname": "fraud_detection"
}

DB_URL = f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}"

CSV_PATH = r"D:\data.csv"
