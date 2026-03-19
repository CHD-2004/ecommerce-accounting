const jwt = require('jsonwebtoken');
const { getDbConnection, initDb, hashPassword } = require('./database');
const { v4: uuidv4 } = require('uuid');

// 初始化数据库
let db = initDb();

// Netlify Functions处理函数
exports.handler = async (event, context) => {
  // 解决跨域
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  // 重新获取数据库连接（Netlify函数每次执行需重新连接）
  db = getDbConnection();

  // 解析请求路径和参数
  const path = event.path.replace('/api/', '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const queryStringParameters = event.queryStringParameters || {};

  // JWT密钥
  const SECRET_KEY = process.env.SECRET_KEY || 'ecommerce-accounting-2024-' + uuidv4();

  // ====================== 工具函数 ======================
  // 验证JWT令牌
  const verifyToken = (token) => {
    try {
      return jwt.verify(token.replace('Bearer ', ''), SECRET_KEY);
    } catch (err) {
      return null;
    }
  };

  // 执行SQL查询并返回结果
  const queryDb = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  // 执行SQL插入/更新
  const executeDb = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  };

  // ====================== 登录接口 ======================
  if (path === 'login' && method === 'POST') {
    const { username, password } = body;
    
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请输入账号和密码' })
      };
    }

    try {
      const users = await queryDb('SELECT * FROM users WHERE username = ?', [username]);
      const user = users[0];

      if (!user || user.password !== hashPassword(password)) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: '账号或密码错误' })
        };
      }

      // 生成JWT令牌（有效期7天）
      const token = jwt.sign({
        user_id: user.id,
        username: user.username,
        name: user.name,
        is_admin: user.is_admin,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      }, SECRET_KEY);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            is_admin: user.is_admin
          }
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // ====================== 验证登录（所有后续接口需验证） ======================
  const token = event.headers.authorization;
  const payload = verifyToken(token);
  
  if (!payload) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: '请先登录或登录已过期' })
    };
  }

  // ====================== 用户列表接口（仅管理员） ======================
  if (path === 'users' && method === 'GET') {
    if (!payload.is_admin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权限' })
      };
    }

    try {
      const users = await queryDb('SELECT id, username, name, is_admin FROM users');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(users)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // ====================== 支付宝接口 ======================
  if (path === 'alipay') {
    // 获取支付宝交易
    if (method === 'GET') {
      const { user_id, start_date, end_date } = queryStringParameters;
      let sql = 'SELECT * FROM alipay_transactions WHERE 1=1';
      const params = [];

      // 权限控制
      if (!payload.is_admin) {
        sql += ' AND user_id = ?';
        params.push(payload.user_id);
      } else if (user_id) {
        sql += ' AND user_id = ?';
        params.push(user_id);
      }

      // 日期筛选
      if (start_date && end_date) {
        sql += ' AND transaction_time BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }

      sql += ' ORDER BY transaction_time DESC';

      try {
        const transactions = await queryDb(sql, params);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(transactions)
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }

    // 新增支付宝交易
    if (method === 'POST') {
      const { amount, description, transaction_time } = body;
      
      if (!amount || !description || !transaction_time) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '缺少必要参数' })
        };
      }

      try {
        await executeDb(`
          INSERT INTO alipay_transactions 
          (user_id, amount, description, transaction_time)
          VALUES (?, ?, ?, ?)
        `, [payload.user_id, amount, description, transaction_time]);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: '记录添加成功' })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }
  }

  // ====================== 1688接口 ======================
  if (path === 'alibaba') {
    // 获取1688交易
    if (method === 'GET') {
      const { user_id, start_date, end_date } = queryStringParameters;
      let sql = 'SELECT * FROM alibaba_transactions WHERE 1=1';
      const params = [];

      // 权限控制
      if (!payload.is_admin) {
        sql += ' AND user_id = ?';
        params.push(payload.user_id);
      } else if (user_id) {
        sql += ' AND user_id = ?';
        params.push(user_id);
      }

      // 日期筛选
      if (start_date && end_date) {
        sql += ' AND transaction_time BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }

      sql += ' ORDER BY transaction_time DESC';

      try {
        const transactions = await queryDb(sql, params);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(transactions)
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }

    // 新增1688交易
    if (method === 'POST') {
      const { amount, product_name, product_image, product_url, transaction_time } = body;
      
      if (!amount || !product_name || !product_image || !product_url || !transaction_time) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '缺少必要参数' })
        };
      }

      try {
        await executeDb(`
          INSERT INTO alibaba_transactions 
          (user_id, amount, product_name, product_image, product_url, transaction_time)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          payload.user_id, amount, product_name,
          product_image, product_url, transaction_time
        ]);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: '记录添加成功' })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }
  }

  // ====================== 汇总接口 ======================
  if (path === 'summary' && method === 'GET') {
    const { period, user_id } = queryStringParameters;
    const targetUserId = user_id || payload.user_id;

    // 权限控制
    if (!payload.is_admin && targetUserId != payload.user_id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权限' })
      };
    }

    // 日期分组逻辑
    let groupBy = 'DATE(transaction_time)';
    if (period === 'weekly') groupBy = "strftime('%Y-%W', transaction_time)";
    if (period === 'monthly') groupBy = "strftime('%Y-%m', transaction_time)";
    if (period === 'quarterly') groupBy = "strftime('%Y', transaction_time) || '-Q' || ((cast(strftime('%m', transaction_time) as int)-1)/3 +1)";

    try {
      // 支付宝汇总
      const alipaySummary = await queryDb(`
        SELECT ${groupBy} as period, COUNT(*) as count, SUM(amount) as total 
        FROM alipay_transactions WHERE user_id = ? GROUP BY ${groupBy} ORDER BY period DESC
      `, [targetUserId]);

      // 1688汇总
      const alibabaSummary = await queryDb(`
        SELECT ${groupBy} as period, COUNT(*) as count, SUM(amount) as total 
        FROM alibaba_transactions WHERE user_id = ? GROUP BY ${groupBy} ORDER BY period DESC
      `, [targetUserId]);

      // 计算总计
      const totalAlipay = alipaySummary.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalAlibaba = alibabaSummary.reduce((sum, item) => sum + (item.total || 0), 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          alipay: alipaySummary,
          alibaba: alibabaSummary,
          total: {
            alipay: totalAlipay,
            alibaba: totalAlibaba,
            all: totalAlipay + totalAlibaba
          }
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // 未匹配的接口
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: '接口不存在' })
  };
};