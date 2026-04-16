"""
TẦNG 3: Tạo dữ liệu mô phỏng tọa độ cho transaction_details
- Phân bổ giao dịch ở các thành phố Việt Nam
- Giao dịch fraud có pattern riêng (tập trung một số khu vực)
"""

import sys
import time
import random
import psycopg2
from config import DB_CONFIG

sys.stdout.reconfigure(encoding='utf-8')

# Các thành phố Việt Nam với tọa độ trung tâm và bán kính phân bổ
VIETNAM_CITIES = [
    {"name": "Hồ Chí Minh", "lat": 10.8231, "lng": 106.6297, "weight": 30},
    {"name": "Hà Nội", "lat": 21.0285, "lng": 105.8542, "weight": 25},
    {"name": "Đà Nẵng", "lat": 16.0544, "lng": 108.2022, "weight": 10},
    {"name": "Cần Thơ", "lat": 10.0452, "lng": 105.7469, "weight": 7},
    {"name": "Hải Phòng", "lat": 20.8449, "lng": 106.6881, "weight": 6},
    {"name": "Biên Hòa", "lat": 10.9574, "lng": 106.8426, "weight": 5},
    {"name": "Nha Trang", "lat": 12.2388, "lng": 109.1967, "weight": 4},
    {"name": "Huế", "lat": 16.4637, "lng": 107.5909, "weight": 4},
    {"name": "Vũng Tàu", "lat": 10.3460, "lng": 107.0843, "weight": 3},
    {"name": "Đà Lạt", "lat": 11.9404, "lng": 108.4583, "weight": 3},
    {"name": "Quy Nhơn", "lat": 13.7829, "lng": 109.2196, "weight": 2},
    {"name": "Buôn Ma Thuột", "lat": 12.6680, "lng": 108.0378, "weight": 1},
]


def pick_city():
    """Chọn thành phố ngẫu nhiên theo trọng số"""
    total_weight = sum(c["weight"] for c in VIETNAM_CITIES)
    r = random.uniform(0, total_weight)
    cumulative = 0
    for city in VIETNAM_CITIES:
        cumulative += city["weight"]
        if r <= cumulative:
            return city
    return VIETNAM_CITIES[0]


def generate_coordinate(city, is_fraud=False):
    """Tạo tọa độ ngẫu nhiên quanh thành phố"""
    # Giao dịch gian lận: phân bổ rộng hơn (vùng ngoại ô/bất thường)
    spread = 0.08 if is_fraud else 0.03
    lat = city["lat"] + random.gauss(0, spread)
    lng = city["lng"] + random.gauss(0, spread)
    return lat, lng, city["name"]


def generate_locations():
    """Tạo dữ liệu tọa độ cho tất cả giao dịch"""
    print("️  Generating location data...")
    start = time.time()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Xóa dữ liệu cũ
    cur.execute("DELETE FROM transaction_details")
    conn.commit()
    
    # Lấy ID và trạng thái gian lận của tất cả giao dịch
    cur.execute("SELECT transaction_id, is_fraud FROM transactions ORDER BY transaction_id")
    transactions = cur.fetchall()
    total = len(transactions)
    print(f" Tổng giao dịch cần mô phỏng: {total:,}")
    
    # Phân bổ vị trí theo từng lô (batch)
    batch_size = 10000
    random.seed(42)  # Để giữ giá trị ngẫu nhiên cố định (Reproducibility)
    
    for i in range(0, total, batch_size):
        batch = transactions[i:i + batch_size]
        values_list = []
        
        for tx_id, is_fraud in batch:
            city = pick_city()
            lat, lng, loc_name = generate_coordinate(city, is_fraud == 1)
            values_list.append((tx_id, lat, lng, loc_name))
        
        args_str = ','.join(
            cur.mogrify("(%s, %s, %s, %s)", row).decode('utf-8')
            for row in values_list
        )
        
        cur.execute(f"""
            INSERT INTO transaction_details 
            (transaction_id, latitude, longitude, location_name)
            VALUES {args_str}
        """)
        
        if (i // batch_size) % 10 == 0:
            conn.commit()
            progress = min(i + batch_size, total)
            pct = progress / total * 100
            print(f"  → {progress:,}/{total:,} ({pct:.1f}%)")
    
    conn.commit()
    
    # In ra sự phân bổ theo thành phố
    cur.execute("""
        SELECT location_name, COUNT(*) 
        FROM transaction_details 
        GROUP BY location_name 
        ORDER BY COUNT(*) DESC
    """)
    print("\n Phân bố vị trí giao dịch:")
    for loc, count in cur.fetchall():
        print(f"  {loc:20s}: {count:>10,} giao dịch")
    
    cur.close()
    conn.close()
    
    elapsed = time.time() - start
    
    print(f"\n{'='*60}")
    print(f" TẦNG 3 HOÀN THÀNH!")
    print(f"{'='*60}")
    print(f"⏱️  TỔNG THỜI GIAN TẦNG 3:         {elapsed:.2f} giây")
    print(f"{'='*60}")
    
    return {"total": elapsed, "total_locations": total}


if __name__ == "__main__":
    print("=" * 60)
    print(" TẦNG 3: MÔ PHỎNG TỌA ĐỘ GIAO DỊCH")
    print("=" * 60)
    generate_locations()
