import sqlite3
import os
from datetime import datetime
import hashlib

# 数据库路径
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'accounting.db')

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    """密码加密（简单版，生产环境可加强）"""
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    """初始化数据库（含用户表、权限、交易表）"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 用户表（含登录账号、密码、权限）
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,  # 登录名（汉斌/汉鹏等）
        password TEXT NOT NULL,         # 加密密码
        name TEXT NOT NULL,             # 显示名
        is_admin BOOLEAN DEFAULT 0,     # 是否管理员（0=普通，1=管理员）
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 2. 支付宝交易表（关联用户ID，仅自己可见）
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS alipay_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        transaction_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    # 3. 1688交易表（关联用户ID，仅自己可见）
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS alibaba_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        product_name TEXT NOT NULL,
        product_image TEXT,
        product_url TEXT,
        transaction_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    # 插入7个固定用户（初始密码123456，汉斌设为管理员）
    default_users = [
        ('hanbin', hash_password('123456'), '汉斌', 1),    # 管理员
        ('hanpeng', hash_password('123456'), '汉鹏', 0),
        ('hanlong', hash_password('123456'), '汉龙', 0),
        ('hanyang', hash_password('123456'), '汉阳', 0),
        ('hanfeng', hash_password('123456'), '汉丰', 0),
        ('hanwei', hash_password('123456'), '汉伟', 0),
        ('handi', hash_password('123456'), '汉迪', 0)
    ]

    for username, password, name, is_admin in default_users:
        try:
            cursor.execute('''
            INSERT OR IGNORE INTO users (username, password, name, is_admin) 
            VALUES (?, ?, ?, ?)
            ''', (username, password, name, is_admin))
        except sqlite3.IntegrityError:
            pass  # 用户已存在则跳过

    # 插入示例数据（汉斌的测试数据）
    cursor.execute('SELECT id FROM users WHERE username = "hanbin"')
    hanbin_id = cursor.fetchone()[0] if cursor.fetchone() else 1

    # 支付宝示例数据
    alipay_samples = [
        (hanbin_id, 100.50, '支付1688货款', '2024-03-01 10:30:00'),
        (hanbin_id, 200.75, '支付运费', '2024-03-01 14:20:00')
    ]
    for sample in alipay_samples:
        cursor.execute('''
        INSERT OR IGNORE INTO alipay_transactions 
        (user_id, amount, description, transaction_time)
        VALUES (?, ?, ?, ?)
        ''', sample)

    # 1688示例数据
    alibaba_samples = [
        (hanbin_id, 150.20, '办公用品', 'https://via.placeholder.com/100.jpg', 'https://1688.com/item/123', '2024-03-01 09:30:00')
    ]
    for sample in alibaba_samples:
        cursor.execute('''
        INSERT OR IGNORE INTO alibaba_transactions 
        (user_id, amount, product_name, product_image, product_url, transaction_time)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', sample)

    conn.commit()
    conn.close()
    print("数据库初始化完成！7个用户已创建，初始密码：123456")

if __name__ == '__main__':
    init_db()