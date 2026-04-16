"""
Pipeline Runner: Chạy toàn bộ 4 tầng và ghi nhận thời gian
"""
import sys
import time
import json
import os

sys.stdout.reconfigure(encoding='utf-8')

# Thêm thư mục scripts vào đường dẫn
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from layer1_import import create_database, create_tables, import_transactions_dask
from layer2_scoring import calculate_anomaly_scores
from layer3_locations import generate_locations


def run_pipeline():
    """Chạy toàn bộ pipeline 3 tầng xử lý dữ liệu"""
    print("" * 30)
    print(" BIG DATA FRAUD DETECTION PIPELINE")
    print("" * 30)
    
    pipeline_start = time.time()
    results = {}
    
    # ============ TẦNG 1 ============
    print("\n" + "=" * 60)
    print(" TẦNG 1: IMPORT DỮ LIỆU VÀO POSTGRESQL")
    print("=" * 60)
    create_database()
    create_tables()
    results["layer1"] = import_transactions_dask()
    
    # ============ TẦNG 2 ============
    print("\n" + "=" * 60)
    print(" TẦNG 2: TÍNH ANOMALY SCORE & CẬP NHẬT STATUS")
    print("=" * 60)
    results["layer2"] = calculate_anomaly_scores()
    
    # ============ TẦNG 3 ============
    print("\n" + "=" * 60)
    print(" TẦNG 3: MÔ PHỎNG TỌA ĐỘ GIAO DỊCH")
    print("=" * 60)
    results["layer3"] = generate_locations()
    
    pipeline_total = time.time() - pipeline_start
    results["pipeline_total"] = pipeline_total
    
    # Lưu kết quả thời gian chạy
    results_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'pipeline_results.json')
    os.makedirs(os.path.dirname(results_path), exist_ok=True)
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # ============ TỔNG KẾT ============
    print("\n" + "" * 30)
    print(" TỔNG KẾT PIPELINE")
    print("" * 30)
    print(f"  Tầng 1 - Import dữ liệu:        {results['layer1']['total']:.2f} giây")
    print(f"    ├── Dask đọc CSV:              {results['layer1']['dask_read']:.2f} giây")
    print(f"    ├── Import accounts:           {results['layer1']['accounts_import']:.2f} giây")
    print(f"    └── Import transactions:       {results['layer1']['transactions_import']:.2f} giây")
    print(f"  Tầng 2 - Chấm điểm anomaly:     {results['layer2']['total']:.2f} giây")
    print(f"    ├── Scoring:                   {results['layer2']['scoring_time']:.2f} giây")
    print(f"    └── Update status:             {results['layer2']['status_time']:.2f} giây")
    print(f"  Tầng 3 - Mô phỏng tọa độ:       {results['layer3']['total']:.2f} giây")
    print(f"  ─────────────────────────────────────────")
    print(f"  ⏱️  TỔNG THỜI GIAN PIPELINE:      {pipeline_total:.2f} giây")
    print(f"\n Pipeline hoàn thành! Kết quả đã lưu tại: {results_path}")
    print(f" Khởi chạy dashboard: python web/app.py")
    
    return results


if __name__ == "__main__":
    run_pipeline()
