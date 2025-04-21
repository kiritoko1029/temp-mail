// 尝试加载环境变量，如果没有.env文件也不会报错
try {
  require('dotenv').config();
} catch (err) {
  console.log('未找到.env文件，将使用默认配置');
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保日志目录存在
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建访问日志流
const accessLogStream = fs.createWriteStream(
  path.join(logDir, 'access.log'), 
  { flags: 'a' }
);

// 创建简易日志记录中间件
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] ${req.method} ${req.url}\n`;
  accessLogStream.write(log);
  next();
};

// 基础配置
const CONFIG = {
  API_URL: process.env.TEMPMAIL_API_URL || 'https://tempmail.plus/api',
  EMAIL: process.env.EMAIL || '',
  LIMIT: process.env.LIMIT || 20,
  EPIN: process.env.EPIN || '',
  ACCESS_CODE: process.env.CODE || '123456' // 默认验证码
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(logger);
app.use(express.static(path.join(__dirname, 'public')));

// 验证访问代码
app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ success: false, message: '请输入验证码' });
  }
  
  // 验证码校验
  if (code === CONFIG.ACCESS_CODE) {
    // 记录验证成功
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] 验证码验证成功\n`;
    accessLogStream.write(log);
    
    return res.json({ success: true, message: '验证成功' });
  } else {
    // 记录验证失败
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] 验证码验证失败: ${code}\n`;
    accessLogStream.write(log);
    
    return res.status(401).json({ success: false, message: '验证码错误' });
  }
});

// 获取邮件列表
app.get('/api/mails', async (req, res) => {
  try {
    const response = await axios.get(`${CONFIG.API_URL}/mails`, {
      params: {
        email: CONFIG.EMAIL,
        limit: CONFIG.LIMIT,
        epin: CONFIG.EPIN
      }
    });

    // 记录API响应
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] API邮件列表响应: ${response.status} - 共${response.data?.count || 0}封邮件\n`;
    accessLogStream.write(log);

    // 处理邮件数据，隐藏邮箱地址
    const data = response.data;
    // 如果有邮件列表，则隐藏相关字段以保护隐私
    if (data.mail_list && data.mail_list.length > 0) {
      data.mail_list = data.mail_list.map(mail => {
        // 隐藏收件人字段，如果存在的话
        if (mail.to) {
          mail.to = '已隐藏';
        }
        return mail;
      });
    }

    res.json(data);
  } catch (error) {
    console.error('获取邮件列表出错:', error.message);
    
    // 记录错误
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] API错误: 获取邮件列表 - ${error.message}\n`;
    accessLogStream.write(log);
    
    res.status(500).json({ error: '获取邮件列表失败', details: error.message });
  }
});

// 获取邮件详情
app.get('/api/mails/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(
      `${CONFIG.API_URL}/mails/${id}`,
      {
        params: {
          email: CONFIG.EMAIL,
          epin: CONFIG.EPIN
        }
      }
    );

    // 记录API响应
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] API邮件详情响应: ${response.status} - ID:${id} - 主题:${response.data?.subject || '无主题'}\n`;
    accessLogStream.write(log);

    // 处理响应数据，隐藏邮箱
    const data = response.data;
    if (data.to) {
      data.to = '已隐藏';
    }

    res.json(data);
  } catch (error) {
    console.error('获取邮件详情出错:', error.message);
    
    // 记录错误
    const timestamp = new Date().toISOString();
    const log = `[${timestamp}] API错误: 获取邮件详情(ID:${req.params.id}) - ${error.message}\n`;
    accessLogStream.write(log);
    
    res.status(500).json({ error: '获取邮件详情失败', details: error.message });
  }
});

// API配置端点 - 用于前端获取当前配置
app.get('/api/config', (req, res) => {
  // 返回配置但不包含敏感信息
  res.json({
    requireAuth: true,  // 告诉前端需要验证
    apiUrl: CONFIG.API_URL
  });
});

// 所有其他路由返回前端页面
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  const startupLog = `[${timestamp}] 服务器启动在 http://localhost:${PORT}\n`;
  accessLogStream.write(startupLog);
  
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('访问码认证已启用');
}); 