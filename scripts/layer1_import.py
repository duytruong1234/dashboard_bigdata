"""
TẦNG 1: Import dữ liệu từ CSV vào PostgreSQL
- Bảng accounts: trích xuất unique account IDs, phân loại Customer/Merchant
- Bảng transactions: import 1,048,575 dòng dữ liệu giao dịch
- Sử dụng Dask để xử lý dữ liệu lớn
- Đo thời gian import
"""

import sys
import time
import psycopg2
from psycopg2 import sql
import dask.dataframe as dd
import pandas as pd
from config import DB_CONFIG, CSV_PATH

sys.stdout.reconfigure(encoding='utf-8')


def create_database():
    """Tạo database fraud_detection nếu chưa tồn tại"""
    conn = psycopg2.connect(
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        dbname="postgres"
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    # Kiểm tra xem database đã tồn tại chưa
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'fraud_detection'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE fraud_detection")
        print(" Database 'fraud_detection' created!")
    else:
        print("ℹ️  Database 'fraud_detection' already exists")
    
    cur.close()
    conn.close()


def create_tables():
    """Tạo bảng accounts và transactions"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Xóa các bảng hiện tại (nếu có, để chạy lại từ đầu)
    cur.execute("DROP TABLE IF EXISTS transaction_details CASCADE")
    cur.execute("DROP TABLE IF EXISTS transactions CASCADE")
    cur.execute("DROP TABLE IF EXISTS accounts CASCADE")
    
    # Tạo bảng accounts (Tài khoản)
    cur.execute("""
        CREATE TABLE accounts (
            account_id VARCHAR(20) PRIMARY KEY,
            account_type VARCHAR(10) NOT NULL
        )
    """)
    
    # Tạo bảng transactions (Giao dịch)
    cur.execute("""
        CREATE TABLE transactions (
            transaction_id SERIAL PRIMARY KEY,
            step INTEGER NOT NULL,
            transaction_type VARCHAR(20) NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            from_account_id VARCHAR(20) REFERENCES accounts(account_id),
            old_balance_org DOUBLE PRECISION,
            new_balance_org DOUBLE PRECISION,
            to_account_id VARCHAR(20) REFERENCES accounts(account_id),
            old_balance_dest DOUBLE PRECISION,
            new_balance_dest DOUBLE PRECISION,
            is_fraud INTEGER DEFAULT 0,
            is_flagged_fraud INTEGER DEFAULT 0,
            anomaly_score INTEGER DEFAULT 0,
            status VARCHAR(10) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tạo bảng transaction_details (Chi tiết giao dịch)
    cur.execute("""
        CREATE TABLE transaction_details (
            log_id SERIAL PRIMARY KEY,
            transaction_id INTEGER REFERENCES transactions(transaction_id),
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            location_name VARCHAR(100)
        )
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print(" Tables created: accounts, transactions, transaction_details")


def import_accounts(df):
    """Import bảng accounts từ DataFrame"""
    print("\n Importing accounts...")
    start = time.time()
    
    # Trích xuất các ID tài khoản duy nhất từ cột người gửi và người nhận
    from_accounts = df['nameOrig'].unique()
    to_accounts = df['nameDest'].unique()
    all_accounts = set(from_accounts) | set(to_accounts)
    
    # Khởi tạo dataframe chứa tài khoản
    accounts_data = []
    for acc_id in all_accounts:
        if acc_id.startswith('C'):
            acc_type = 'Customer'
        elif acc_id.startswith('M'):
            acc_type = 'Merchant'
        else:
            acc_type = 'Unknown'
        accounts_data.append((acc_id, acc_type))
    
    # Bắt đầu chèn dữ liệu theo từng lô (Batch)
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    batch_size = 10000
    for i in range(0, len(accounts_data), batch_size):
        batch = accounts_data[i:i + batch_size]
        args_str = ','.join(
            cur.mogrify("(%s, %s)", row).decode('utf-8')
            for row in batch
        )
        cur.execute(f"INSERT INTO accounts (account_id, account_type) VALUES {args_str}")
        if (i // batch_size) % 10 == 0:
            print(f"  → Imported {min(i + batch_size, len(accounts_data)):,}/{len(accounts_data):,} accounts")
    
    conn.commit()
    cur.close()
    conn.close()
    
    elapsed = time.time() - start
    customer_count = sum(1 for _, t in accounts_data if t == 'Customer')
    merchant_count = sum(1 for _, t in accounts_data if t == 'Merchant')
    print(f" Accounts imported: {len(accounts_data):,} total ({customer_count:,} Customer, {merchant_count:,} Merchant)")
    print(f"⏱️  Thời gian import accounts: {elapsed:.2f} giây")
    return elapsed


def import_transactions_dask():
    """Import bảng transactions sử dụng Dask cho Big Data"""
    print("\n Loading CSV with Dask...")
    total_start = time.time()
    
    # Đọc chunk dữ liệu từ CSV lớn bằng thư viện Dask
    dask_start = time.time()
    ddf = dd.read_csv(CSV_PATH, assume_missing=True)
    df = ddf.compute()  # Chuyển đổi thành pandas dataframe để thao tác
    dask_elapsed = time.time() - dask_start
    print(f"⏱️  Thời gian Dask đọc CSV: {dask_elapsed:.2f} giây")
    print(f" Tổng dòng dữ liệu: {len(df):,}")
    
    # Import dữ liệu danh sách Tài khoản trước
    accounts_time = import_accounts(df)
    
    # Sau đó mới Import thông tin Giao dịch
    print(f"\n Importing {len(df):,} transactions into PostgreSQL...")
    tx_start = time.time()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    batch_size = 5000
    total_rows = len(df)
    
    for i in range(0, total_rows, batch_size):
        batch_df = df.iloc[i:i + batch_size]
        
        values_list = []
        for _, row in batch_df.iterrows():
            values_list.append((
                int(row['step']),
                str(row['type']),
                float(row['amount']),
                str(row['nameOrig']),
                float(row['oldbalanceOrg']),
                float(row['newbalanceOrig']),
                str(row['nameDest']),
                float(row['oldbalanceDest']),
                float(row['newbalanceDest']),
                int(row['isFraud']),
                int(row['isFlaggedFraud'])
            ))
        
        args_str = ','.join(
            cur.mogrify(
                "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                row
            ).decode('utf-8')
            for row in values_list
        )
        
        cur.execute(f"""
            INSERT INTO transactions 
            (step, transaction_type, amount, from_account_id, old_balance_org, 
             new_balance_org, to_account_id, old_balance_dest, new_balance_dest, 
             is_fraud, is_flagged_fraud)
            VALUES {args_str}
        """)
        
        if (i // batch_size) % 20 == 0:
            conn.commit()
            progress = min(i + batch_size, total_rows)
            pct = progress / total_rows * 100
            print(f"  → {progress:,}/{total_rows:,} ({pct:.1f}%)")
    
    conn.commit()
    cur.close()
    conn.close()
    
    tx_elapsed = time.time() - tx_start
    total_elapsed = time.time() - total_start
    
    print(f"\n{'='*60}")
    print(f" TẦNG 1 HOÀN THÀNH!")
    print(f"{'='*60}")
    print(f"⏱️  Thời gian Dask đọc CSV:        {dask_elapsed:.2f} giây")
    print(f"⏱️  Thời gian import accounts:      {accounts_time:.2f} giây")
    print(f"⏱️  Thời gian import transactions:  {tx_elapsed:.2f} giây")
    print(f"⏱️  TỔNG THỜI GIAN TẦNG 1:         {total_elapsed:.2f} giây")
    print(f"{'='*60}")
    
    return {
        "dask_read": dask_elapsed,
        "accounts_import": accounts_time,
        "transactions_import": tx_elapsed,
        "total": total_elapsed,
        "total_rows": total_rows
    }


if __name__ == "__main__":
    print("=" * 60)
    print(" TẦNG 1: IMPORT DỮ LIỆU VÀO POSTGRESQL")
    print("=" * 60)
    
    create_database()
    create_tables()
    result = import_transactions_dask()
