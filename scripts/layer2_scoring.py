"""
TẦNG 2: Tính anomaly_score và cập nhật status
Bảng điểm (max 100):
  Phía tài khoản gửi:
    1. new_balance_org ≠ old_balance_org - amount → +20
    2. amount > old_balance_org → +20
    3. old_balance_org = 0 AND amount > 0 → +20
  Phía tài khoản nhận (trừ tài khoản "M"):
    4. amount > 0 AND new_balance_dest = 0 → +20
    5. new_balance_dest ≠ old_balance_dest + amount → +20
  Status: anomaly_score = 0 → 'success', > 0 → 'fail'
"""

import sys
import time
import psycopg2
from config import DB_CONFIG

sys.stdout.reconfigure(encoding='utf-8')


def calculate_anomaly_scores():
    """Tính anomaly_score cho tất cả giao dịch"""
    print(" Calculating anomaly scores...")
    start = time.time()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Cập nhật anomaly_score bằng SQL để đạt hiệu suất tối đa
    # Tiêu chí 1: Sai lệch số dư gửi (new_balance_org ≠ old_balance_org - amount)
    print("  → Tiêu chí 1: Sai lệch số dư gửi...")
    cur.execute("""
        UPDATE transactions 
        SET anomaly_score = anomaly_score + 20
        WHERE ABS(new_balance_org - (old_balance_org - amount)) > 0.01
    """)
    rows1 = cur.rowcount
    print(f"    Affected: {rows1:,} rows")
    
    # Tiêu chí 2: Giao dịch vượt số dư (amount > old_balance_org)
    print("  → Tiêu chí 2: Giao dịch vượt số dư...")
    cur.execute("""
        UPDATE transactions 
        SET anomaly_score = anomaly_score + 20
        WHERE amount > old_balance_org
    """)
    rows2 = cur.rowcount
    print(f"    Affected: {rows2:,} rows")
    
    # Tiêu chí 3: Rút tiền từ ví rỗng (old_balance_org = 0 AND amount > 0)
    print("  → Tiêu chí 3: Rút tiền từ ví rỗng...")
    cur.execute("""
        UPDATE transactions 
        SET anomaly_score = anomaly_score + 20
        WHERE old_balance_org = 0 AND amount > 0
    """)
    rows3 = cur.rowcount
    print(f"    Affected: {rows3:,} rows")
    
    # Tiêu chí 4: Số dư tài khoản nhận bằng 0 (trừ Merchant "M")
    print("  → Tiêu chí 4: Số dư nhận bằng 0 (trừ Merchant)...")
    cur.execute("""
        UPDATE transactions 
        SET anomaly_score = anomaly_score + 20
        WHERE amount > 0 
          AND new_balance_dest = 0
          AND to_account_id NOT LIKE 'M%'
    """)
    rows4 = cur.rowcount
    print(f"    Affected: {rows4:,} rows")
    
    # Tiêu chí 5: Số dư nhận khác mới (trừ Merchant "M")
    print("  → Tiêu chí 5: Số dư nhận khác mới (trừ Merchant)...")
    cur.execute("""
        UPDATE transactions 
        SET anomaly_score = anomaly_score + 20
        WHERE ABS(new_balance_dest - (old_balance_dest + amount)) > 0.01
          AND to_account_id NOT LIKE 'M%'
    """)
    rows5 = cur.rowcount
    print(f"    Affected: {rows5:,} rows")
    
    conn.commit()
    scoring_time = time.time() - start
    print(f"⏱️  Thời gian chấm điểm: {scoring_time:.2f} giây")
    
    # Cập nhật trạng thái dựa trên điểm anomaly_score
    print("\n Updating status...")
    status_start = time.time()
    
    cur.execute("""
        UPDATE transactions 
        SET status = CASE 
            WHEN anomaly_score = 0 THEN 'success'
            ELSE 'fail'
        END
    """)
    
    conn.commit()
    status_time = time.time() - status_start
    print(f"⏱️  Thời gian cập nhật status: {status_time:.2f} giây")
    
    # In ra số liệu thống kê phân bổ
    cur.execute("""
        SELECT anomaly_score, COUNT(*) 
        FROM transactions 
        GROUP BY anomaly_score 
        ORDER BY anomaly_score
    """)
    print("\n Phân bố anomaly_score:")
    for score, count in cur.fetchall():
        print(f"  Score {score:3d}: {count:>10,} giao dịch")
    
    cur.execute("""
        SELECT status, COUNT(*) 
        FROM transactions 
        GROUP BY status
    """)
    print("\n Phân bố status:")
    for status, count in cur.fetchall():
        print(f"  {status:8s}: {count:>10,} giao dịch")
    
    cur.close()
    conn.close()
    
    total_elapsed = scoring_time + status_time
    
    print(f"\n{'='*60}")
    print(f" TẦNG 2 HOÀN THÀNH!")
    print(f"{'='*60}")
    print(f"⏱️  Thời gian chấm điểm anomaly:   {scoring_time:.2f} giây")
    print(f"⏱️  Thời gian cập nhật status:      {status_time:.2f} giây")
    print(f"⏱️  TỔNG THỜI GIAN TẦNG 2:         {total_elapsed:.2f} giây")
    print(f"{'='*60}")
    
    return {
        "scoring_time": scoring_time,
        "status_time": status_time,
        "total": total_elapsed
    }


if __name__ == "__main__":
    print("=" * 60)
    print(" TẦNG 2: TÍNH ANOMALY SCORE & CẬP NHẬT STATUS")
    print("=" * 60)
    calculate_anomaly_scores()
