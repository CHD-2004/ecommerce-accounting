const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// 数据库存储路径（Netlify持久化存储）
const DB_DIR = path.join(process.cwd(), '.netlify', 'database');
const DB_PATH = path.join(DB_DIR, 'accounting.db');

// 确保数据库目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// 密码加密
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// 获取数据库连接
const getDbConnection = () => {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('数据库连接失败:', err.message);
    else console.log('数据库连接成功');
  });
};

// 初始化数据库
const initDb = () => {
  const db = getDbConnection();

  // 1. 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. 创建支付宝交易表
  db.run(`
    CREATE TABLE IF NOT EXISTS alipay_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      transaction_time TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // 3. 创建1688交易表
  db.run(`
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
  `);

  // 插入7个固定用户（汉斌为管理员）
  const defaultUsers = [
    ['hanbin', hashPassword('123456'), '汉斌', 1],
    ['hanpeng', hashPassword('123456'), '汉鹏', 1],
    ['hanlong', hashPassword('123456'), '汉龙', 1],
    ['hanyang', hashPassword('123456'), '汉阳', 1],
    ['hanfeng', hashPassword('123456'), '汉丰',1 ],
    ['hanwei', hashPassword('123456'), '汉伟', 1],
    ['handi', hashPassword('123456'), '汉迪',1 ]
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, is_admin) 
    VALUES (?, ?, ?, ?)
  `);

  defaultUsers.forEach(user => {
    insertUser.run(user, (err) => {
      if (err && !err.message.includes('UNIQUE constraint failed')) {
        console.error('插入用户失败:', err.message);
      }
    });
  });

  insertUser.finalize();
  console.log("数据库初始化完成！7个用户已创建，初始密码：123456");
  
  return db;
};

module.exports = {
  getDbConnection,
  initDb,
  hashPassword,
  DB_PATH
};