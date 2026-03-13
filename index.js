/**
 * 财经新闻监控脚本
 * 每分钟检查东方财富要闻，推送到飞书
 * 每日 23:00 - 次日 08:00 免打扰
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CHECK_INTERVAL = 60 * 1000;
const DATA_FILE = path.join(__dirname, 'sent_news.json');

const DND_START = 23;
const DND_END = 8;

function isDNDTime() {
  const hour = new Date().getHours();
  return hour >= DND_START || hour < DND_END;
}

function loadSentNews() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    }
  } catch (e) { console.error('加载失败:', e); }
  return new Set();
}

function saveSentNews(set) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([...set]));
}

function sendFeishuMessage(content) {
  return new Promise((resolve, reject) => {
    const cmd = `openclaw message send --channel feishu --target ou_636d711a1a1c9999d79991e8b0b38498 --message "${content.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) { reject(error); } else { resolve(stdout); }
    });
  });
}

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
            resolve(json.LivesList || []);
          } else { resolve([]); }
        } catch (e) { resolve([]); }
      });
    }).on('error', reject);
  });
}

// 只推送官方推荐的（titlestyle=3）
function isImportantNews(item) {
  return item.titlestyle === '3';
}

async function checkAndNotify() {
  const now = new Date();
  console.log(`[${now.toLocaleString()}] 检查新闻...`);
  
  if (isDNDTime()) {
    console.log('😴 免打扰中');
    return;
  }
  
  try {
    const newsList = await fetchNews();
    const sentSet = loadSentNews();
    let count = 0;
    
    for (const item of newsList) {
      if (isImportantNews(item) && !sentSet.has(item.id)) {
        // 提取摘要，去掉开头的【...】标签
        let digest = item.digest || '';
        digest = digest.replace(/^【[^】]+】/, '').trim();
        
        // 组装消息：标题 + 摘要
        let content = `【财经要闻】${item.title}`;
        if (digest) {
          content += `\n\n${digest}`;
        }
        
        console.log('发送:', item.title);
        
        try {
          await sendFeishuMessage(content);
          sentSet.add(item.id);
          count++;
        } catch (e) { console.error('失败:', e.message); }
      }
    }
    
    if (sentSet.size > 0) saveSentNews(sentSet);
    console.log(`完成，新增 ${count} 条`);
  } catch (e) { console.error('错误:', e.message); }
}

console.log('财经新闻监控已启动');
checkAndNotify();
setInterval(checkAndNotify, CHECK_INTERVAL);
