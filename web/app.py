"""
TẦNG 4: Flask API Backend - Dashboard trực quan hóa dữ liệu
Redesigned with sidebar navigation, multiple pages
"""

import sys
import os
import math
from flask import Flask, render_template, jsonify, request
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from config import DB_CONFIG

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')


def get_db():
    return psycopg2.connect(**DB_CONFIG)


@app.route('/')
def index():
    return render_template('index.html')


# ============ DASHBOARD APIs ============

@app.route('/api/overview')
def api_overview():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions")
    total_tx = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM accounts")
    total_accounts = cur.fetchone()[0]
    cur.execute("SELECT is_fraud, COUNT(*) FROM transactions GROUP BY is_fraud ORDER BY is_fraud")
    fraud_dist = {str(row[0]): row[1] for row in cur.fetchall()}
    cur.execute("SELECT COUNT(*) FROM transactions WHERE status = 'success'")
    success_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM transactions WHERE status = 'fail'")
    fail_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM transactions WHERE anomaly_score >= 60")
    need_review = cur.fetchone()[0]
    cur.close()
    conn.close()
    return jsonify({
        "total_transactions": total_tx,
        "total_accounts": total_accounts,
        "fraud_count": fraud_dist.get("1", 0),
        "non_fraud_count": fraud_dist.get("0", 0),
        "success_count": success_count,
        "fail_count": fail_count,
        "need_review": need_review
    })


@app.route('/api/fraud_distribution')
def api_fraud_distribution():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            CASE WHEN is_fraud = 1 THEN 'Gian lận' ELSE 'Không gian lận' END as label,
            COUNT(*) as count
        FROM transactions GROUP BY is_fraud ORDER BY is_fraud
    """)
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/amount_distribution')
def api_amount_distribution():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            CASE WHEN amount > 200000 THEN 'Trên 200,000' ELSE 'Dưới 200,000' END as range,
            COUNT(*) as count
        FROM transactions 
        GROUP BY CASE WHEN amount > 200000 THEN 'Trên 200,000' ELSE 'Dưới 200,000' END
    """)
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/transaction_types')
def api_transaction_types():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT transaction_type, COUNT(*) FROM transactions GROUP BY transaction_type ORDER BY COUNT(*) DESC")
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/account_type_transactions')
def api_account_type_transactions():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.transaction_type, a.account_type, COUNT(*) as count
        FROM transactions t
        JOIN accounts a ON t.from_account_id = a.account_id
        GROUP BY t.transaction_type, a.account_type
        ORDER BY t.transaction_type, a.account_type
    """)
    result = {}
    for row in cur.fetchall():
        tx_type, acc_type, count = row
        if tx_type not in result:
            result[tx_type] = {"Customer": 0, "Merchant": 0}
        result[tx_type][acc_type] = count
    cur.close()
    conn.close()
    return jsonify(result)


@app.route('/api/anomaly_distribution')
def api_anomaly_distribution():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            CASE 
                WHEN anomaly_score = 0 THEN '0'
                WHEN anomaly_score <= 20 THEN '1-20'
                WHEN anomaly_score <= 40 THEN '21-40'
                WHEN anomaly_score <= 60 THEN '41-60'
                WHEN anomaly_score <= 80 THEN '61-80'
                WHEN anomaly_score <= 100 THEN '81-100'
            END as score_range,
            COUNT(*) as count
        FROM transactions 
        GROUP BY 1 ORDER BY MIN(anomaly_score)
    """)
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/status_distribution')
def api_status_distribution():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            CASE 
                WHEN status = 'success' THEN 'Thành công'
                WHEN status = 'fail' AND anomaly_score >= 60 THEN 'Bị chặn'
                ELSE 'Nghi vấn'
            END as label,
            COUNT(*) 
        FROM transactions GROUP BY 1
    """)
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/account_types')
def api_account_types():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT account_type, COUNT(*) FROM accounts GROUP BY account_type ORDER BY account_type")
    data = [{"label": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/step_frequency')
def api_step_frequency():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT step, COUNT(*) FROM transactions GROUP BY step ORDER BY step")
    data = [{"step": row[0], "count": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/map_data')
def api_map_data():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT td.latitude, td.longitude, td.location_name, 
               t.transaction_type, t.amount, t.is_fraud, t.anomaly_score
        FROM transaction_details td
        JOIN transactions t ON td.transaction_id = t.transaction_id
    """)
    data = [{
        "lat": row[0], "lng": row[1], "location": row[2],
        "type": row[3], "amount": row[4], "is_fraud": row[5], "anomaly_score": row[6]
    } for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


# ============ LOGS - Transaction Table ============

@app.route('/api/transactions_table')
def api_transactions_table():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 15))
    tx_type = request.args.get('type', '')
    min_amount = request.args.get('min_amount', '')
    max_amount = request.args.get('max_amount', '')
    sort_by = request.args.get('sort', 'transaction_id')
    sort_dir = request.args.get('dir', 'DESC')
    
    # Kiểm tra cột sắp xếp
    allowed_sorts = ['transaction_id', 'amount', 'anomaly_score', 'created_at', 'step']
    if sort_by not in allowed_sorts:
        sort_by = 'transaction_id'
    if sort_dir not in ['ASC', 'DESC']:
        sort_dir = 'DESC'
    
    conn = get_db()
    cur = conn.cursor()
    
    where_clauses = []
    params = []
    
    if tx_type:
        where_clauses.append("t.transaction_type = %s")
        params.append(tx_type)
    if min_amount:
        where_clauses.append("t.amount >= %s")
        params.append(float(min_amount))
    if max_amount:
        where_clauses.append("t.amount <= %s")
        params.append(float(max_amount))
    
    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    
    # Đếm tổng số lượng
    cur.execute(f"SELECT COUNT(*) FROM transactions t {where_sql}", params)
    total = cur.fetchone()[0]
    
    # Lấy dữ liệu trang hiện tại
    offset = (page - 1) * per_page
    cur.execute(f"""
        SELECT t.transaction_id, t.created_at, t.transaction_type, 
               t.from_account_id, t.to_account_id, t.amount, 
               t.anomaly_score, t.status, t.is_fraud, t.step
        FROM transactions t
        {where_sql}
        ORDER BY t.{sort_by} {sort_dir}
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    
    rows = [{
        "id": r[0],
        "created_at": r[1].strftime("%Y-%m-%d %H:%M:%S") if r[1] else "",
        "type": r[2],
        "from_account": r[3],
        "to_account": r[4],
        "amount": r[5],
        "anomaly_score": r[6],
        "status": r[7],
        "is_fraud": r[8],
        "step": r[9]
    } for r in cur.fetchall()]
    
    cur.close()
    conn.close()
    
    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": math.ceil(total / per_page)
    })


# ============ Recent Fraud Alerts ============

@app.route('/api/recent_alerts')
def api_recent_alerts():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.transaction_id, t.created_at, t.amount, t.anomaly_score,
               t.from_account_id, t.transaction_type
        FROM transactions t
        WHERE t.anomaly_score >= 60
        ORDER BY t.anomaly_score DESC, t.transaction_id DESC
        LIMIT 20
    """)
    data = [{
        "id": r[0],
        "created_at": r[1].strftime("%d/%m/%Y %H:%M:%S") if r[1] else "",
        "amount": r[5] if len(r) > 5 else r[2],
        "anomaly_score": r[3],
        "from_account": r[4],
        "type": r[5] if len(r) > 5 else "",
        "level": "High" if r[3] >= 80 else "Medium"
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


# ============ Báo cáo - Reports ============

def get_report_filters():
    tx_type = request.args.get('type', '')
    location = request.args.get('location', '')
    risk = request.args.get('risk', '')
    
    where_clauses = []
    params = []
    join_sql = ""
    
    if tx_type:
        where_clauses.append("t.transaction_type = %s")
        params.append(tx_type)
    
    if location:
        where_clauses.append("td.location_name = %s")
        params.append(location)
        join_sql = "JOIN transaction_details td ON t.transaction_id = td.transaction_id"
        
    if risk == 'high':
        where_clauses.append("t.anomaly_score >= 80")
    elif risk == 'medium':
        where_clauses.append("t.anomaly_score >= 40 AND t.anomaly_score < 80")
    elif risk == 'low':
        where_clauses.append("t.anomaly_score < 40")
        
    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    return join_sql, where_sql, params


@app.route('/api/blocked_by_step')
def api_blocked_by_step():
    conn = get_db()
    cur = conn.cursor()
    join_sql, where_sql, params = get_report_filters()
    cur.execute(f"""
        SELECT t.step, 
               COUNT(*) FILTER (WHERE t.anomaly_score >= 60) as blocked,
               COUNT(*) FILTER (WHERE t.anomaly_score < 60 AND t.anomaly_score > 0) as suspicious,
               COUNT(*) FILTER (WHERE t.anomaly_score = 0) as clean
        FROM transactions t
        {join_sql}
        {where_sql}
        GROUP BY t.step ORDER BY t.step
    """, params)
    data = [{"step": r[0], "blocked": r[1], "suspicious": r[2], "clean": r[3]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/risk_by_type')
def api_risk_by_type():
    conn = get_db()
    cur = conn.cursor()
    join_sql, where_sql, params = get_report_filters()
    cur.execute(f"""
        SELECT t.transaction_type, 
               ROUND(AVG(t.anomaly_score)::numeric, 1) as avg_score,
               COUNT(*) FILTER (WHERE t.is_fraud = 1) as fraud_count,
               COUNT(*) as total
        FROM transactions t
        {join_sql}
        {where_sql}
        GROUP BY t.transaction_type ORDER BY avg_score DESC
    """, params)
    data = [{
        "type": r[0], "avg_score": float(r[1]), 
        "fraud_count": r[2], "total": r[3]
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


@app.route('/api/geo_heatmap')
def api_geo_heatmap():
    conn = get_db()
    cur = conn.cursor()
    _, where_sql, params = get_report_filters()
    cur.execute(f"""
        SELECT td.location_name,
               AVG(td.latitude) as lat, AVG(td.longitude) as lng,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE t.is_fraud = 1) as fraud_count,
               ROUND(AVG(t.anomaly_score)::numeric, 1) as avg_score
        FROM transaction_details td
        JOIN transactions t ON td.transaction_id = t.transaction_id
        {where_sql}
        GROUP BY td.location_name
        ORDER BY avg_score DESC
    """, params)
    data = [{
        "location": r[0], "lat": float(r[1]), "lng": float(r[2]),
        "total": r[3], "fraud_count": r[4], "avg_score": float(r[5])
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data)


if __name__ == '__main__':
    print(" Dashboard đang chạy tại: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
