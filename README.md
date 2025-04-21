# 临时邮箱查看器

这是一个基于Node.js的临时邮箱查看应用，使用TempMail.plus API获取临时邮箱数据。

## 功能特点

- 查看临时邮箱的邮件列表
- 查看邮件详情内容
- 自动刷新邮件列表
- 响应式设计，适配移动端和桌面端
- 优雅的UI设计，基于TailwindCSS

## 安装和使用

### 前提条件

- Node.js 14+
- npm 或 yarn

### 安装步骤

1. 克隆仓库或下载代码

```bash
git clone https://github.com/yourusername/temp-mail.git
cd temp-mail
```

2. 安装依赖

```bash
npm install
# 或使用 yarn
yarn install
```

3. 配置环境变量

创建一个`.env`文件在项目根目录，添加以下配置：

```
PORT=3000
TEMPMAIL_API_URL=https://tempmail.plus/api
EMAIL=你的临时邮箱地址
LIMIT=20
EPIN=你的邮箱PIN码（如果有）
```

4. 启动应用

```bash
npm start
# 或使用开发模式
npm run dev
```

5. 访问应用

打开浏览器访问：`http://localhost:3000`

## 项目结构

```
temp-mail/
├── public/              # 前端静态文件
│   ├── index.html      # 主HTML文件
│   ├── styles.css      # 自定义样式
│   └── app.js          # 前端JavaScript逻辑
├── server.js           # 后端服务器入口
├── .env                # 环境变量配置（需自行创建）
├── .env.example        # 环境变量示例
├── .gitignore          # Git忽略文件
├── package.json        # 项目依赖和脚本
└── README.md           # 项目说明文档
```

## API 接口

### 获取邮件列表

```
GET /api/mails
```

### 获取邮件详情

```
GET /api/mails/:id
```

## 技术栈

- 后端：Node.js, Express
- 前端：TailwindCSS, JavaScript
- 工具：Axios, dotenv

## 许可证

MIT 