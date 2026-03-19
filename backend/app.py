from flask import Flask, jsonify, request
from flask_cors import CORS
import jwt
import datetime
import os
from database import get_db_connection, hash_password, init_db

# 初始化Flask
app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False  # 解决中文乱码
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-123456')  # 生产环境改复杂
CORS(app, supports_credentials=True)  # 允许跨域（前端访问）

# 初始化数据库（首次运行自动执行）
init_db()

# ====================== 登录认证 ======================
@app.route('/api/login', methods=['POST'])
def login():
    """用户登录，返回JWT令牌"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': '请输入账号和密码'}), 400

    # 验证用户
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()

    if not user or user['password'] != hash_password(password):
        return jsonify({'error': '账号或密码错误'}), 401

    # 生成JWT令牌（有效期7天）
    token = jwt.encode({
        'user_id': user['id'],
        'username': user['username'],
        'name': user['name'],
        'is_admin': user['is_admin'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm='HS256')

    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'name': user['name'],
            'is_admin': user['is_admin']
        }
    }), 200

# ====================== 权限验证装饰器 ======================
def token_required(f):
    """验证JWT令牌的装饰器"""
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': '请先登录'}), 401

        try:
            # 解析令牌（Bearer xxx 格式）
            token = token.replace('Bearer ', '')
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user = payload  # 将用户信息存入request
        except jwt.ExpiredSignatureError:
            return jsonify({'error': '登录已过期，请重新登录'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': '无效的登录信息'}), 401

        return f(*args, **kwargs)
    return wrapper

# ====================== 支付宝接口（带权限） ======================
@app.route('/api/alipay', methods=['GET'])
@token_required
def get_alipay_transactions():
    """获取支付宝交易（管理员看全部，普通用户看自己）"""
    user = request.user
    user_id = request.args.get('user_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    conn = get_db_connection()
    query = 'SELECT * FROM alipay_transactions WHERE 1=1'
    params = []

    # 权限控制：非管理员只能看自己的数据
    if not user['is_admin']:
        query += ' AND user_id = ?'
        params.append(user['user_id'])
    # 管理员可筛选指定用户
    elif user_id:
        query += ' AND user_id = ?'
        params.append(user_id)

    # 日期筛选
    if start_date and end_date:
        query += ' AND transaction_time BETWEEN ? AND ?'
        params.extend([start_date, end_date])

    # 按时间排序
    query += ' ORDER BY transaction_time DESC'
    transactions = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(t) for t in transactions]), 200

@app.route('/api/alipay', methods=['POST'])
@token_required
def add_alipay_transaction():
    """新增支付宝交易（只能加自己的）"""
    user = request.user
    data = request.get_json()

    required = ['amount', 'description', 'transaction_time']
    if not all(k in data for k in required):
        return jsonify({'error': '缺少必要参数'}), 400

    conn = get_db_connection()
    try:
        conn.execute('''
        INSERT INTO alipay_transactions 
        (user_id, amount, description, transaction_time)
        VALUES (?, ?, ?, ?)
        ''', (user['user_id'], data['amount'], data['description'], data['transaction_time']))
        conn.commit()
        conn.close()
        return jsonify({'message': '记录添加成功'}), 201
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

# ====================== 1688接口（带权限） ======================
@app.route('/api/alibaba', methods=['GET'])
@token_required
def get_alibaba_transactions():
    """获取1688交易（管理员看全部，普通用户看自己）"""
    user = request.user
    user_id = request.args.get('user_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    conn = get_db_connection()
    query = 'SELECT * FROM alibaba_transactions WHERE 1=1'
    params = []

    # 权限控制
    if not user['is_admin']:
        query += ' AND user_id = ?'
        params.append(user['user_id'])
    elif user_id:
        query += ' AND user_id = ?'
        params.append(user_id)

    # 日期筛选
    if start_date and end_date:
        query += ' AND transaction_time BETWEEN ? AND ?'
        params.extend([start_date, end_date])

    query += ' ORDER BY transaction_time DESC'
    transactions = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(t) for t in transactions]), 200

@app.route('/api/alibaba', methods=['POST'])
@token_required
def add_alibaba_transaction():
    """新增1688交易（只能加自己的）"""
    user = request.user
    data = request.get_json()

    required = ['amount', 'product_name', 'product_image', 'product_url', 'transaction_time']
    if not all(k in data for k in required):
        return jsonify({'error': '缺少必要参数'}), 400

    conn = get_db_connection()
    try:
        conn.execute('''
        INSERT INTO alibaba_transactions 
        (user_id, amount, product_name, product_image, product_url, transaction_time)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user['user_id'], data['amount'], data['product_name'],
            data['product_image'], data['product_url'], data['transaction_time']
        ))
        conn.commit()
        conn.close()
        return jsonify({'message': '记录添加成功'}), 201
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

# ====================== 辅助接口 ======================
@app.route('/api/users', methods=['GET'])
@token_required
def get_users():
    """获取用户列表（仅管理员可见）"""
    user = request.user
    if not user['is_admin']:
        return jsonify({'error': '无权限'}), 403

    conn = get_db_connection()
    users = conn.execute('SELECT id, username, name, is_admin FROM users').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users]), 200

@app.route('/api/summary', methods=['GET'])
@token_required
def get_summary():
    """获取汇总数据（按日/周/月/季）"""
    user = request.user
    period = request.args.get('period', 'daily')
    user_id = request.args.get('user_id', type=int) or user['user_id']

    # 非管理员只能看自己的汇总
    if not user['is_admin'] and user_id != user['user_id']:
        return jsonify({'error': '无权限'}), 403

    conn = get_db_connection()

    # 日期分组逻辑
    if period == 'daily':
        group_by = 'DATE(transaction_time)'
    elif period == 'weekly':
        group_by = 'strftime("%Y-%W", transaction_time)'
    elif period == 'monthly':
        group_by = 'strftime("%Y-%m", transaction_time)'
    elif period == 'quarterly':
        group_by = 'strftime("%Y", transaction_time) || "-Q" || ((cast(strftime("%m", transaction_time) as int)-1)/3 +1)'
    else:
        group_by = 'DATE(transaction_time)'

    # 支付宝汇总
    alipay_query = f'''
    SELECT {group_by} as period, COUNT(*) as count, SUM(amount) as total 
    FROM alipay_transactions WHERE user_id = ? GROUP BY {group_by} ORDER BY period DESC
    '''
    alipay_summary = conn.execute(alipay_query, (user_id,)).fetchall()

    # 1688汇总
    alibaba_query = f'''
    SELECT {group_by} as period, COUNT(*) as count, SUM(amount) as total 
    FROM alibaba_transactions WHERE user_id = ? GROUP BY {group_by} ORDER BY period DESC
    '''
    alibaba_summary = conn.execute(alibaba_query, (user_id,)).fetchall()

    conn.close()

    return jsonify({
        'alipay': [dict(s) for s in alipay_summary],
        'alibaba': [dict(s) for s in alibaba_summary],
        'total': {
            'alipay': sum(s['total'] for s in alipay_summary if s['total']),
            'alibaba': sum(s['total'] for s in alibaba_summary if s['total']),
            'all': sum(s['total'] for s in alipay_summary if s['total']) + sum(s['total'] for s in alibaba_summary if s['total'])
        }
    }), 200

# 启动服务器
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)