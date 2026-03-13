# 财联社电报监控脚本

自动监控财联社（CLS.cn）电报频道，当检测到**加红/重要电报**时，通过飞书机器人实时推送通知。

## 功能特性

- 🔴 **智能识别**：自动识别加红电报（level=B、有标题、recommend=1 等）
- ⏰ **定时检查**：每分钟自动检查最新电报
- 📢 **飞书推送**：重要电报即时推送到飞书
- 🔄 **去重机制**：已发送的电报不会重复推送
- 💾 **本地存储**：使用本地文件记录已发送的电报ID
- 🚀 **开箱即用**：纯 Node.js 实现，无需额外依赖

## 安装与运行

### 1. 克隆/下载脚本

确保你有 Node.js 环境（建议 v14+）：

```bash
node --version
```

### 2. 配置飞书机器人

#### 创建飞书自定义机器人

1. 打开飞书群聊，点击右上角「设置」→「群机器人」→「添加机器人」
2. 选择「自定义机器人」
3. 设置机器人名称（如「财联社监控」）和头像
4. 复制 Webhook 地址，格式如下：
   ```
   https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

### 3. 配置脚本

**方式一：环境变量（推荐）**

```bash
export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
node index.js
```

**方式二：修改配置文件**

编辑 `index.js`，修改以下配置项：

```javascript
// 飞书机器人 Webhook 地址
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

### 4. 启动监控

```bash
node index.js
```

## 配置选项

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `FEISHU_WEBHOOK` | 飞书机器人 Webhook 地址 | 必填 |
| `CHECK_INTERVAL` | 检查间隔（毫秒） | 60000 (1分钟) |
| `LOG_LEVEL` | 日志级别: debug, info, warn, error | info |

### 示例：调整检查频率

```bash
# 每30秒检查一次
export CHECK_INTERVAL=30000
node index.js
```

### 示例：调试模式

```bash
# 开启详细日志
export LOG_LEVEL=debug
node index.js
```

## 后台运行

### 使用 nohup

```bash
nohup node index.js > cls-monitor.log 2>&1 &
echo $! > cls-monitor.pid

# 停止监控
kill $(cat cls-monitor.pid)
```

### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start index.js --name cls-monitor

# 查看状态
pm2 status

# 查看日志
pm2 logs cls-monitor

# 停止
pm2 stop cls-monitor

# 开机自启
pm2 startup
pm2 save
```

### 使用 systemd（Linux）

创建服务文件 `/etc/systemd/system/cls-monitor.service`：

```ini
[Unit]
Description=CLS Telegraph Monitor
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cls-monitor
Environment="FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cls-monitor
sudo systemctl start cls-monitor
sudo systemctl status cls-monitor
```

## 电报识别规则

脚本通过以下条件判断是否为加红/重要电报：

| 条件 | 说明 |
|-----|------|
| `level === "B"` | B级为重要电报，C级为普通 |
| `title` 非空 | 有标题的通常为重要电报 |
| `recommend === 1` | 推荐标记 |
| `bold === 1` | 加粗标记 |
| `jpush === 1` | 推送标记 |

满足任一条件即判定为重要电报。

## 飞书消息格式

推送的消息包含以下信息：

```
🔴 财联社加红电报 - 【央行：降准0.5个百分点】

⏰ 时间: 03/13 15:30:00

📰 内容:
央行决定于2026年3月15日下调金融机构存款准备金率0.5个百分点...

👉 查看详情
```

## 数据文件

脚本会自动创建 `.sent_ids.json` 文件用于存储已发送的电报ID，避免重复推送。

- 位置：脚本同级目录
- 格式：JSON 数组
- 自动清理：只保留最近 500 条记录

**注意**：删除此文件会导致之前发送过的电报重新推送。

## 常见问题

### Q: 如何测试脚本是否正常工作？

A: 启动后观察日志输出，确认有「监控已启动」提示。也可以临时修改 `isImportantTelegraph` 函数让它发送普通电报来测试。

### Q: 飞书消息发送失败怎么办？

A: 检查以下几点：
1. Webhook 地址是否正确
2. 网络是否能访问飞书服务器
3. 飞书机器人是否被删除或禁用

### Q: 如何避免首次运行时发送大量历史电报？

A: 脚本会自动创建 `.sent_ids.json` 文件。首次运行前可以先创建一个空文件：

```bash
echo "[]" > .sent_ids.json
```

### Q: 可以发送到多个飞书群吗？

A: 目前只支持单个 Webhook。如需多群推送，可以：
1. 复制脚本为多个实例，每个配置不同的 Webhook
2. 修改 `sendFeishuMessage` 函数，支持多个 Webhook 循环发送

## 更新日志

### v1.0 (2026-03-13)
- ✨ 初始版本发布
- ✨ 支持加红电报识别
- ✨ 支持飞书消息推送
- ✨ 支持定时自动检查

## 免责声明

本脚本仅供学习研究使用，请遵守财联社网站的使用条款。使用本脚本产生的任何后果由使用者自行承担。

## License

MIT
