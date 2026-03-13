/**
 * 财经新闻监控脚本
 * 每分钟检查东方财富要闻，推送到飞书
 * 每日 23:00 - 次日 08:00 免打扰
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CHECK_INTERVAL = 60 * 1000; // 1分钟
const DATA_FILE = path.join(__dirname, 'sent_news.json');

// 免打扰时间配置
const DND_START = 23; // 23:00
const DND_END = 8;    // 次日 8:00

// 检查是否在免打扰时间
function isDNDTime() {
  const now = new Date();
  const hour = now.getHours();
  
  if (DND_START > DND_END) {
    // 跨天情况：23:00 - 次日 8:00
    return hour >= DND_START || hour < DND_END;
  } else {
    return hour >= DND_START && hour < DND_END;
  }
}

// 加载已发送的新闻ID
function loadSentNews() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    }
  } catch (e) {
    console.error('加载历史记录失败:', e);
  }
  return new Set();
}

// 保存已发送的新闻ID
function saveSentNews(set) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([...set]));
}

// 发送飞书消息
function sendFeishuMessage(content) {
  return new Promise((resolve, reject) => {
    const cmd = `openclaw message send --channel feishu --target ou_636d711a1a1c9999d79991e8b0b38498 --message "${content.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('发送失败:', stderr);
        reject(error);
      } else {
        console.log('发送成功');
        resolve(stdout);
      }
    });
  });
}

// 获取东方财富要闻
function fetchNews() {
  return new Promise((resolve, reject) => {
    const url = 'https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html';
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const match = data.match(/var ajaxResult=({.+})/);
          if (match) {
            const json = JSON.parse(match[1]);
            const newsList = json.LivesList || [];
            resolve(newsList);
          } else {
            resolve([]);
          }
        } catch (e) {
          console.error('解析失败:', e.message);
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

// 识别重要新闻
function isImportantNews(item) {
  return item.titlestyle === '3' || parseInt(item.commentnum || '0') > 10;
}

// 主函数
async function checkAndNotify() {
  const now = new Date();
  console.log(`[${now.toLocaleString()}] 检查财经新闻...`);
  
  // 免打扰检查
  if (isDNDTime()) {
    console.log('😴 免打扰时间 (23:00-08:00)，跳过推送');
    return;
  }
  
  try {
    const newsList = await fetchNews();
    const sentSet = loadSentNews();
    
    for (const item of newsList) {
      if (isImportantNews(item) && !sentSet.has(item.id)) {
        const content = `【财经要闻】${item.title}`;
        console.log('发现重要新闻:', item.title);
        
        try {
          await sendFeishuMessage(content);
          sentSet.add(item.id);
        } catch (e) {
          console.error('发送消息失败:', e.message);
        }
      }
    }
    
    if (sentSet.size > 0) {
      saveSentNews(sentSet);
    }
    console.log(`检查完成，最新 ${newsList.length} 条新闻`);
  } catch (e) {
    console.error('检查失败:', e.message);
  }
}

// 启动
console.log('财经新闻监控已启动，每分钟检查一次...');
console.log('免打扰时间: 23:00 - 次日 08:00');
checkAndNotify();
setInterval(checkAndNotify, CHECK_INTERVAL);
