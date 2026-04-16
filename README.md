# Big Data: Fraud Detection Dashboard

Đây là một hệ thống hoàn chỉnh từ xử lý dữ liệu lớn (Big Data Pipeline) cho đến trực quan hóa dữ liệu (Dashboard) phục vụ cho bài toán phát hiện gian lận (Fraud Detection) trong các giao dịch tài chính.

## 🚀 Tính năng chính
- **Data Pipeline tự động hóa (ETL):** Đổ dữ liệu thô lớn (hàng triệu dòng) với Python và PostgreSQL thông qua 3 tầng xử lý nối tiếp.
- **Tính toán điểm bất thường (Anomaly Scoring):** Hệ thống chấm điểm giao dịch (0 - 100) dựa trên các quy tắc tài chính để phân loại giao dịch "Bị chặn" (>60), "Nghi vấn" (>0), và "An toàn" (0).
- **Dashboard quản trị thông minh:** 
  - Dữ liệu truy xuất trực tiếp từ CSDL real-time qua Flask API.
  - Thống kê tổng quan (KPIs: Số lượng giao dịch, Được chấp nhận, Bị chặn, Cần duyệt).
  - Biểu đồ phân tích lịch sử giao dịch và rủi ro động (sử dụng thư viện Chart.js).
  - Bản đồ nhiệt (Geo Heatmap) thể hiện phân bổ mã rủi ro theo vị trí địa lý (sử dụng Leaflet).
- **Giao diện hiện đại (Modern UI/UX):** Hỗ trợ chuyển đổi nhanh Dark/Light Mode, menu thu gọn, trải nghiệm Web siêu mượt, không logo/emoji rườm rà.
- **Hệ thống Lọc Báo Cáo Cấp Tốc:** Bộ lọc hoạt động bằng cách chèn tự động mệnh đề `WHERE` vào cơ sở dữ liệu để giúp trả về data báo cáo đã chắt lọc kịp thời nhất.

## 📂 Cấu trúc dự án

```text
dashboard_bigdata/
├── data/
│   └── pipeline_results.json    # File lưu trữ nhật ký thời gian chạy của Pipeline
├── scripts/
│   ├── config.py                # File lưu cấu hình chuỗi kết nối Database PostgreSQL
│   ├── layer1_import.py         # Tầng 1: Tải data mẫu từ file CSV vào PostgreSQL
│   ├── layer2_scoring.py        # Tầng 2: Điểm chuẩn thuật toán Anomaly cho giao dịch
│   ├── layer3_locations.py      # Tầng 3: Map tọa độ/vị trí địa lý cho từng IP/điểm truy cập
│   └── run_pipeline.py          # Code điều phối chính, chạy nối tiếp 3 tầng trên cùng
└── web/
    ├── app.py                   # Tầng 4: Xương sống API chạy bằng Flask Backend
    ├── static/
    │   ├── css/style.css        # File chứa 100% linh hồn thiết kế UI/UX 
    │   └── js/dashboard.js      # Logic Frontend: xử lý biểu đồ, vẽ bản đồ và gọi API
    └── templates/
        └── index.html           # Khung sườn bố cục Sidebar và Main Web Workspace
```

## ⚙️ Yêu cầu Hệ thống
- Python 3.9+
- PostgreSQL 14+
- Các thư viện Python cần thiết cốt lõi: `Flask`, `psycopg2`, `pandas`, `dask` (với script layer 1).

> **Lưu ý cấu hình DB:** Đảm bảo PosgreSQL đang chạy trước khi bắt đầu.
> Dự án đang kết nối mặc định vào DB tên `fraud_detection`, User: `postgres`, Password: `123`, Port: `5432` tại `localhost`. 
> (Có thể đổi cấu hình trong file `scripts/config.py`).

## 💻 Hướng dẫn Cài đặt & Khởi chạy

Dự án này đã có sẵn file sao lưu cơ sở dữ liệu (`fraud_detection.sql`). Bạn có thể bỏ qua quá trình cào dữ liệu từ file CSV (Pipeline) và đi thẳng vào việc phục hồi dữ liệu:

**Bước 1: Khôi phục Dữ liệu (Restore PostgreSQL)**
Mở Terminal/Cmd và dùng lệnh sau để import thẳng file backup SQL vào CSDL của bạn:
```cmd
# Tạo môi trường Database rỗng
psql -U postgres -c "CREATE DATABASE fraud_detection;"

# Bơm dữ liệu từ file .sql vào Database
psql -U postgres -d fraud_detection -f fraud_detection.sql
```
*(Mẹo: Bạn có thể dễ dàng chuột phải dùng công cụ `Restore` trong phần mềm pgAdmin4 hoặc DBeaver nếu không quen dùng lệnh).*

**Bước 2: Kiểm tra mật khẩu Database**
Nếu Postgres của máy bạn không phải là tài khoản mặc định, hãy mở file `scripts/config.py` và sửa `user` / `password` khớp với máy tính của bạn:
```python
DB_CONFIG = {
    'dbname': 'fraud_detection',
    'user': 'postgres',
    'password': '123', # Đổi pass tại đây
}
```

**Bước 3: Khởi động Web Server (Backend)**
Cài đặt các thư viện lõi và chạy app:
```cmd
pip install flask psycopg2-binary
python web\app.py
```

**Bước 4: Trải nghiệm Dashboard**
Truy cập trình duyệt theo liên kết nội bộ:
```text
http://localhost:5000
```
Giao diện **Administr Dashboard** sẽ hiển thị cùng với toàn bộ dữ liệu lịch sử giao dịch.

---
*Dự án: Administr Dashboard - Data & Security Analytics*
