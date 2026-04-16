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

## 💻 Hướng dẫn Khởi chạy

**Bước 1: Chạy Data Pipeline để chuẩn bị Database**
Mở Terminal, đứng tại thư mục gốc và chạy file Pipeline để import & chấm điểm giao dịch. Bước này có thể mất vài phút tùy vào độ lớn của file CSV.
```cmd
python scripts\run_pipeline.py
```

**Bước 2: Khởi động Server Web Backend**
Chạy ứng dụng Flask để làm nền tảng nuôi giao diện.
```cmd
python web\app.py
```

**Bước 3: Mở Dashboard sử dụng**
Mở ngay trình duyệt web của bạn và nhấp vào đường dẫn sau:
```text
http://localhost:5000
```
Bạn sẽ thấy giao diện **Administr Dashboard** bắt đầu lên sóng và sẵn sàng để phân tích dữ liệu!

---
*Dự án: Administr Dashboard - Data & Security Analytics*
