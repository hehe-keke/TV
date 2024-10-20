const axios = require('axios');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 获取文件的相对路径
const getRelativeFilePath = (relativePath) => {
  return path.join(process.cwd(), relativePath);
};

// 写入 M3U8 文件
const writeM3u8File = (relativeFilePath, content) => {
  const filePath = getRelativeFilePath(relativeFilePath);

  if (typeof filePath !== 'string' || typeof content !== 'string') {
    console.log('写入文件失败，filePath 和 content 必须为字符串类型');
    return;
  }

  const directory = path.dirname(filePath);
  
  // 检查目录是否存在，若不存在则创建
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  // 写入内容到文件
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`成功写入文件 ${filePath}`);
};

// 随机生成 User-Agent
const randomUserAgent = () => {
  const devices = ['iPhone', 'iPad', 'Android', 'Windows Phone'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Opera'];
  const randomDevice = devices[Math.floor(Math.random() * devices.length)];
  const randomBrowser = browsers[Math.floor(Math.random() * browsers.length)];
  return `Mozilla/5.0 (Linux; U; ${randomDevice}; zh-cn; M2007J17C Build/SKQ1.211006.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ${randomBrowser}/109.0.5414.118 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.9.111128 swan-mibrowser`;
};
//并发
const withConcurrencyLimit = async (tasks, limit = 5) => {
  let activePromises = 0; // 当前活跃的任务数
  const taskQueue = [...tasks]; // 将任务队列复制一份

  const results = []; // 存储任务结果
  const runTask = async (task) => {
      activePromises++;
      try {
          const result = await task(); // 执行任务
          results.push(result); // 保存任务结果
      } catch (error) {
          console.error(`任务失败: ${error.message}`);
      } finally {
          activePromises--; // 任务完成后减少活跃任务数
          if (taskQueue.length > 0) {
              // 如果队列中还有任务，继续执行下一个任务
              const nextTask = taskQueue.shift();
              runTask(nextTask);
          }
      }
  };

  // 启动初始任务，最多不会超过并发限制
  const initialTasks = Math.min(limit, taskQueue.length);
  for (let i = 0; i < initialTasks; i++) {
      const task = taskQueue.shift();
      runTask(task);
  }

  // 等待所有任务完成
  while (activePromises > 0 || taskQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 小的延迟等待任务完成
  }

  console.log("线程任务已完成")
};

// 获取网页内容
async function fetchPageContent(url) {
  try {
    const response = await axios({
      method: 'get',
      url: url,
      headers: { 'User-Agent': randomUserAgent() },
    });
    console.log(`成功从 ${url} 获取网页内容`);
    return response.data;
  } catch (error) {
    console.error(`从 ${url} 获取网页内容时发生错误: ${error.message}`);
    return null;
  }
}

// 解析页面中的 IP:Port 地址
function extractIPs(pageContent) {
  console.log('开始解析页面内容中的 IP:Port 地址...');
  const ipRegex = /(http|https):\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/g;
  const matches = pageContent.match(ipRegex);
  const ips = matches ? [...new Set(matches)] : []; // 使用 Set 去重
  return ips;
}

// 修改 IP 地址的最后一段为 1-255，并返回构建的完整 URL
function generateModifiedIPs(baseUrl, ipEnd = ip_end) {
  console.log(`生成基于 ${baseUrl} 的修改后的 IP 地址...`);
  const protocolIndex = baseUrl.indexOf("//") + 2;
  const portIndex = baseUrl.indexOf(":", protocolIndex);

  const protocol = baseUrl.substring(0, protocolIndex); // http:// 或 https://
  const ipAddress = baseUrl.substring(protocolIndex, portIndex); // 提取 IP 地址
  const port = baseUrl.substring(portIndex); // 提取端口

  const ipSegments = ipAddress.split('.');
  const urls = [];

  for (let i = 1; i <= 255; i++) {
    ipSegments[3] = i.toString(); // 修改最后一段
    const modifiedIp = ipSegments.join('.');
    const fullUrl = `${protocol}${modifiedIp}${port}${ipEnd}`; // 构建完整 URL
    urls.push(fullUrl);
  }

  return urls;
}

// 验证 URL 是否可用
async function isUrlAccessible(testUrl, retryCount = 1, timeout = 5000) {
  for (let i = 0; i < retryCount; i++) {
    console.log(`正在请求，${testUrl}`);
    const startTime = Date.now();
    try {
      const response = await axios({
        method: testUrl.startsWith('https') ? 'post' : 'get',
        url: testUrl,
        timeout: timeout,
        maxRedirects: 1,
        headers: { 'User-Agent': randomUserAgent() },
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.status === 200) {
        console.log(`请求成功，${testUrl}: ${responseTime} ms`);
        return { success: true, url: testUrl, statusCode: response.status, responseTime: responseTime };
      } else {
        console.log(`请求失败，状态码: ${response.status}，${testUrl}`);
        return { success: false, url: testUrl, statusCode: response.status, responseTime: responseTime };
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const isTimeout = error.code === 'ECONNABORTED';
      return {
        success: false,
        url: testUrl,
        statusCode: error.response ? error.response.status : null,
        responseTime: isTimeout ? Infinity : responseTime,
      };
    }
  }
  return { success: false, statusCode: null, responseTime: Infinity };
}
//并发




// 解析响应数据并组织分类数据
function parseResponseData(response, baseUrl) {
  console.log('解析响应数据并组织分类数据...');
  let categorizedData = {};

  if (response && response.data && Array.isArray(response.data)) {
    response.data.forEach((item) => {
      let typename = item.typename || '未分类';
      let channel = item.name || '未知频道';
      let videoPath = '';

      if (item.url && typeof item.url === 'string' && item.url.includes('m3u8')) {
        videoPath = item.url;
      } else if (item.url_standby && typeof item.url_standby === 'string' && item.url_standby.includes('m3u8')) {
        videoPath = item.url_standby;
      }

      if (videoPath) {
        const VideoUrl = `${baseUrl}${videoPath}`;
        if (!categorizedData[typename]) {
          categorizedData[typename] = [];
        }
        categorizedData[typename].push({ channel: channel, VideoUrl: VideoUrl });
      }
    });
  }
  console.log(`解析到的分类数据: ${JSON.stringify(categorizedData, null, 2)}`);
  return categorizedData;
}

// 处理有效的 URL 列表
async function processValidUrls(validUrls) {
  console.log('处理有效的 URL 列表...');
  let allCategorizedData = {};

  const tasks = validUrls.map((validUrl) => async () => {
    console.log(`处理 URL: ${validUrl}`);
    const pageContent = await fetchPageContent(validUrl);
    if (!pageContent) return;

    const parsedUrlObj = parseUrl(validUrl);
    console.log(pageContent)
    const parsedData = parseResponseData(pageContent, `${parsedUrlObj.protocol}//${parsedUrlObj.ipAddress}:${parsedUrlObj.port}`);

    for (let [category, channels] of Object.entries(parsedData)) {
      if (!allCategorizedData[category]) {
        allCategorizedData[category] = [];
      }
      allCategorizedData[category].push(...channels);
    }
  });

  await withConcurrencyLimit(tasks,10)

  console.log(`合并后的数据: ${JSON.stringify(allCategorizedData, null, 2)}`);
  return allCategorizedData;
}

// 解析 URL
function parseUrl(fullUrl) {
  console.log(`解析 URL: ${fullUrl}`);
  const parsedUrl = url.parse(fullUrl);

  // 提取协议、主机（包含 IP 地址和端口）、路径
  const protocol = parsedUrl.protocol;
  const host = parsedUrl.host; // 包含 IP 地址和端口
  const pathname = parsedUrl.path; // 包含路径（不包括查询字符串）

  // 分离主机部分为 IP 地址和端口
  const [ipAddress, port] = host.split(':');

  return {
    protocol: protocol,
    ipAddress: ipAddress,
    port: port || '', // 如果没有端口，则返回空字符串
    path: pathname
  };
};

const processChannels = async (channels, filter = false) => {
  const promises = Object.keys(channels).map(async category => {
    const visitedChannels = {};
    let categoryResult = `${category},#genre#\n`;

    // 存储每个频道的结果
    const channelResults = {};

    // 对每个频道进行处理
    await Promise.all(channels[category].map(async item => {
      if (item.channel && item.channel.trim() !== '') {
        if (filter) {
          const result = await isUrlAccessible(item.VideoUrl);

          if (result.success) {
            // 如果 URL 验证成功
            if (!visitedChannels[item.channel]) {
              visitedChannels[item.channel] = true;
              if (!channelResults[item.channel]) {
                channelResults[item.channel] = [];
              }
            }
            // 添加验证成功的 URL
            channelResults[item.channel].push(item.VideoUrl);
          } else {
            // 如果 URL 验证失败
            if (!visitedChannels[item.channel]) {
              // 如果频道未访问过，添加空 URL
              visitedChannels[item.channel] = true;
              if (!channelResults[item.channel]) {
                channelResults[item.channel] = [];
              }
              channelResults[item.channel].push(''); // 添加空 URL
            } else {
              // 如果频道已访问过，移除失败的 URL
              const index = channelResults[item.channel]?.indexOf(item.VideoUrl);
              if (index > -1) {
                channelResults[item.channel].splice(index, 1);
              }
            }
          }
        } else {
          // 无需过滤，直接添加
          if (!channelResults[item.channel]) {
            channelResults[item.channel] = [];
          }
          channelResults[item.channel].push(item.VideoUrl);
        }
      }
    }));

    // 生成分类结果
    for (const [channel, urls] of Object.entries(channelResults)) {
      urls.forEach(url => {
        categoryResult += `${channel},${url || ''}\n`;
      });
    }
    return categoryResult;
  });

  const results = await Promise.all(promises);
  return results.join('');
};

// 主函数：提取 IP 地址、验证可用性并解析响应数据
async function processUrls(urls) {
  let allValidUrls = []; // 用于存储所有有效的 URL
  let allIpUrls = []; // 存储所有从不同 URL 提取的 IP

  // 阶段一：并发提取每个 URL 中的 IP 地址
  const urlTasks = urls.map(url => async () => {
    console.log(`从 URL: ${url} 中提取 IP 地址`);
    const pageContent = await fetchPageContent(url);
    if (!pageContent) return; // 跳过无效的 URL

    // 使用 extractIPs 提取 IP 地址
    const ipUrls = extractIPs(pageContent);
    allIpUrls.push(...ipUrls); // 将提取的 IP 地址加入列表
  });

  // 限制并发处理 URL 为 10
  await withConcurrencyLimit(urlTasks, 10, 360000);

  console.log(`提取的 IP 地址列表: ${allIpUrls}`);

  // 阶段二：对提取的 IP 地址进行批量验证
  const ipTasks = allIpUrls.map(ipUrl => async () => {
    console.log(`生成修改后的 IP 地址 URL: ${ipUrl}`);
    const modifiedUrls = generateModifiedIPs(ipUrl);

    // 针对每个 IP 变体进行并发验证
    const validationTasks = modifiedUrls.map(modUrl => async () => {
      const accessibleUrl = await isUrlAccessible(modUrl);
      if (accessibleUrl.success) {
        console.log(`有效的 URL: ${accessibleUrl.url}`);
        allValidUrls.push(accessibleUrl.url);
      } else {
        console.log(`无效的 URL: ${accessibleUrl.url}`);
      }
    });

    // 限制对每个 IP 变体的验证并发为 30
    await withConcurrencyLimit(validationTasks, 25); 
  });

  // 限制同时进行 IP 验证的并发任务为 10
  await withConcurrencyLimit(ipTasks, 10);

  // 最终处理有效的 URL
  if (allValidUrls.length > 0) {
    console.log(`有效的 URL 列表: ${allValidUrls}`);
    
    // 处理有效的 URL 列表，解析网页数据并打印最终结果
    const mergedData = await processValidUrls(allValidUrls);
    console.log(`最终合并结果: ${JSON.stringify(mergedData, null, 2)}`);
    return mergedData;
  } else {
    console.log(`未找到有效的 URL`);
  }

  return {};
}

// 示例用法
const urls = [
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iSGViZWki",  // Hebei (河北)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iYmVpamluZyI%3D",  // Beijing (北京)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iZ3Vhbmdkb25nIg%3D%3D",  // Guangdong (广东)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0ic2hhbmdoYWki",  // Shanghai (上海)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0idGlhbmppbiI%3D",  // Tianjin (天津)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iY2hvbmdxaW5nIg%3D%3D",  // Chongqing (重庆)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0ic2hhbnhpIg%3D%3D",  // Shanxi (山西)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iU2hhYW54aSI%3D",  // Shaanxi (陕西)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0ibGlhb25pbmci",  // Liaoning (辽宁)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iamlhbmdzdSI%3D",  // Jiangsu (江苏)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iemhlamlhbmci",  // Zhejiang (浙江)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5a6J5b69Ig%3D%3D",  // Anhui (安徽)
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0iRnVqaWFuIg%3D%3D",  // 福建
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5rGf6KW%2FIg%3D%3D",  // 江西
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5bGx5LicIg%3D%3D",  // 山东
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5rKz5Y2XIg%3D%3D",  // 河南
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5rmW5YyXIg%3D%3D",  // 湖北
  "https://fofa.info/result?qbase64=ImlwdHYvbGl2ZS96aF9jbi5qcyIgJiYgY291bnRyeT0iQ04iICYmIHJlZ2lvbj0i5rmW5Y2XIg%3D%3D",  // 湖南
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22hebei%22",        //河北
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22beijing%22",   //北京
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22guangdong%22",    //广东
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22shanghai%22",    //上海
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22tianjin%22",    //天津
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22chongqing%22",    //重庆
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22shanxi%22",    //山西
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22shaanxi%22",    //陕西
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22liaoning%22",    //辽宁
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22jiangsu%22",    //江苏
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22zhejiang%22",    //浙江
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22anhui%22",    //安徽
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22fujian%22",    //福建
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22jiangxi%22",    //江西
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22shandong%22",    //山东
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22henan%22",    //河南
  "https://www.zoomeye.org/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22hubei%22",    //湖北
   "https://www.zoomeye.hk/searchResult?q=%2Fiptv%2Flive%2Fzh_cn.js%20%2Bcountry%3A%22CN%22%20%2Bsubdivisions%3A%22hunan%22"    //湖南
]

//const ip_end='/ZHGXTV/Public/json/live_interface.txt';
const ip_end='/iptv/live/1000.json?key=txiptv';
async function runApp() {
  
  try {
    // 处理 URL 并提取频道信息
    const extractedUrls = await processUrls(urls);

    // 等待 processChannels 完成并返回处理后的频道列表
    const processedChannels = await processChannels(extractedUrls, false);

    // 在处理完成后，再进行文件写入操作
    writeM3u8File('./live/iptv_live.txt', processedChannels);

    console.log('写入完成!');
  } catch (error) {
    console.error('处理过程中发生错误:', error);
  }
}

runApp()


