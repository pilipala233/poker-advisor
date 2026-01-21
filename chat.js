// 配置
const SIMULATIONS = 10000;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_MAP = {
  b: 0, // 黑桃
  r: 1, // 红桃
  f: 2, // 方块
  m: 3  // 梅花
};

// DOM 元素
const elements = {
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
  originalPanel: document.getElementById("original-panel"),
  originalClose: document.getElementById("original-close"),
  contactName: document.querySelector(".contact-name"),
  cropModal: document.getElementById("crop-modal"),
  cropCanvas: document.getElementById("crop-canvas"),
  cropCancel: document.getElementById("crop-cancel"),
  cropConfirm: document.getElementById("crop-confirm"),
  avatarInput: document.getElementById("avatar-input")
};

// 点击计数器
let avatarClickCount = 0;
let avatarClickTimer = null;
let nameClickCount = 0;
let nameClickTimer = null;
const CLICK_INTERVAL = 500; // 连续点击的最大间隔

// 头像裁剪相关
let currentAvatarType = null; // 'self' 或 'other'
let cropImage = null;

// 初始化
function init() {
  bindEvents();
  setupKeyboardHandler();
  loadContactName();
  loadAvatars();
  addInitialMessages();
}

// 添加初始对话
function addInitialMessages() {
  addMessage("去吗", "self");
  addMessage("可以", "other");
}

function bindEvents() {
  // 发送按钮
  elements.sendBtn.addEventListener("click", handleSend);

  // 回车发送
  elements.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 关闭原版面板
  elements.originalClose.addEventListener("click", () => {
    elements.originalPanel.classList.remove("show");
  });

  // 3次点击备注修改名字
  if (elements.contactName) {
    elements.contactName.addEventListener("click", handleNameClick);
  }

  // 头像裁剪相关事件
  if (elements.avatarInput) {
    elements.avatarInput.addEventListener("change", handleAvatarSelect);
  }
  if (elements.cropCancel) {
    elements.cropCancel.addEventListener("click", closeCropModal);
  }
  if (elements.cropConfirm) {
    elements.cropConfirm.addEventListener("click", confirmCrop);
  }
}

// 处理发送消息
function handleSend() {
  const text = elements.chatInput.value.trim();
  if (!text) return;

  elements.chatInput.value = "";

  // 解析并分析
  const parseResult = parseInput(text);

  // 添加伪装的用户消息
  addDisguisedMessages(text, parseResult);

  // 显示"对方正在输入..."
  showTypingStatus();

  setTimeout(() => {
    if (parseResult.error) {
      addMessage(parseResult.error, "other");
    } else {
      const result = runAnalysis(parseResult);
      const reply = generateReply(result);
      addMessage(reply, "other");
    }
    hideTypingStatus();
    scrollToBottom();
  }, 300);
}

// 解析输入格式: "b1r13 3" 或 "b1r13 f5f6f7 3"
// 严格分组：手牌一组 [公共牌一组] 人数一组
function parseInput(text) {
  const normalized = text.toLowerCase().trim();
  const parts = normalized.split(/\s+/);

  if (parts.length < 2 || parts.length > 3) {
    return { error: "格式不对，再发一遍？" };
  }

  // 最后一个必须是人数
  const lastPart = parts[parts.length - 1];
  if (!/^\d+$/.test(lastPart)) {
    return { error: "最后要写人数" };
  }
  const opponents = Math.min(Math.max(parseInt(lastPart, 10), 1), 8);

  // 第一组是手牌
  const heroCards = parseCards(parts[0]);
  if (heroCards.length !== 2) {
    return { error: "手牌要2张" };
  }

  // 如果有3组，中间是公共牌
  let boardCards = [];
  if (parts.length === 3) {
    boardCards = parseCards(parts[1]);

    if (boardCards.length < 3 || boardCards.length > 5) {
      return { error: "公共牌要3-5张" };
    }
  }

  // 检查重复
  const allCards = [...heroCards, ...boardCards];
  const uniqueCards = new Set(allCards);
  if (uniqueCards.size !== allCards.length) {
    return { error: "有重复的牌，检查一下？" };
  }

  return { heroCards, boardCards, opponents };
}

// 解析牌字符串，如 "b1r13" 或 "bArK" -> [code1, code2]
// 支持: 数字 1-13，或字母 A/J/Q/K（不区分大小写）
function parseCards(str) {
  const cards = [];
  // 匹配花色 + (数字1-13 或 字母A/J/Q/K)
  const regex = /([bfrm])(\d{1,2}|[ajqk])/gi;
  let match;

  while ((match = regex.exec(str)) !== null) {
    const suit = match[1].toLowerCase();
    const rankStr = match[2].toLowerCase();

    if (!(suit in SUIT_MAP)) continue;

    // 转换牌面值
    let rank;
    if (rankStr === "a") {
      rank = 1;
    } else if (rankStr === "j") {
      rank = 11;
    } else if (rankStr === "q") {
      rank = 12;
    } else if (rankStr === "k") {
      rank = 13;
    } else {
      rank = parseInt(rankStr, 10);
      if (rank < 1 || rank > 13) continue;
    }

    // 转换为 code: suit * 13 + rankIndex
    // 原版逻辑: 2 -> index 0, 3 -> index 1, ..., A -> index 12
    const rankIndex = rank === 1 ? 12 : rank - 2;
    const code = SUIT_MAP[suit] * 13 + rankIndex;
    cards.push(code);
  }

  return cards;
}

// 运行蒙特卡洛分析
function runAnalysis({ heroCards, boardCards, opponents }) {
  const winRate = estimateWinProbability(heroCards, boardCards, opponents, SIMULATIONS);
  const threshold = 1 / (opponents + 1);
  const shouldEnter = winRate >= threshold;

  return {
    winRate: Math.round(winRate * 100),
    threshold: Math.round(threshold * 100),
    shouldEnter
  };
}

// 生成随机回复
function generateReply({ winRate, threshold, shouldEnter }) {
  const templates = shouldEnter ? ENTER_TEMPLATES : EXIT_TEMPLATES;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace(/{rate}/g, winRate).replace(/{th}/g, threshold);
}

// 提取牌字符串数组，如 "b1r13" -> ["b1", "r13"]
function extractCardStrings(str) {
  const cards = [];
  const regex = /([bfrm])(\d{1,2}|[ajqk])/gi;
  let match;
  while ((match = regex.exec(str)) !== null) {
    cards.push(match[0]);
  }
  return cards;
}

// 手牌模板（2个插入点：{0} {1}）
const HERO_TEMPLATES = [
  "今天{0}天气{1}怎么样",
  "最近{0}工作{1}忙吗",
  "你{0}那边{1}热不热",
  "今天{0}心情{1}怎么样",
  "周末{0}有没{1}有空",
  "最近{0}身体{1}怎么样",
  "你{0}吃饭{1}了吗",
  "今天{0}加班{1}吗",
  "最近{0}睡眠{1}好吗",
  "你{0}现在{1}方便吗"
];

// 公共牌模板（3-5个插入点）
const BOARD_TEMPLATES_3 = [
  "外面{0}好像{1}挺热{2}的",
  "听说{0}明天{1}会下{2}雨",
  "我{0}刚才{1}看了{2}下",
  "感觉{0}今天{1}还不{2}错",
  "好像{0}快要{1}到了{2}吧"
];

const BOARD_TEMPLATES_4 = [
  "我{0}看了{1}一下{2}好像{3}行",
  "感觉{0}应该{1}没什{2}么问{3}题",
  "外面{0}天气{1}好像{2}还可{3}以"
];

const BOARD_TEMPLATES_5 = [
  "我{0}刚{1}看{2}了{3}一{4}下",
  "感{0}觉{1}应{2}该{3}可{4}以"
];

// 过渡句模板（翻牌前第二行）
const TRANSITION_TEMPLATES = [
  "最近忙不忙啊",
  "好久没联系了",
  "在干嘛呢",
  "吃了没",
  "下班了吗",
  "休息了没",
  "还在加班吗",
  "周末有安排吗"
];

// 人数模板（{n}是人数插入点）
const COUNT_TEMPLATES = [
  "有空出来玩吗{n}",
  "一起吃饭{n}",
  "出来坐坐{n}",
  "约不约{n}",
  "有时间吗{n}",
  "方便吗{n}",
  "得空吗{n}",
  "走不走{n}"
];

// 添加伪装的用户消息（三行）
function addDisguisedMessages(originalText, parseResult) {
  const parts = originalText.trim().split(/\s+/);
  const heroStr = parts[0];
  const countStr = parts[parts.length - 1];
  const hasBoard = parts.length === 3;
  const boardStr = hasBoard ? parts[1] : null;

  // 第一行：手牌嵌入
  const heroCards = extractCardStrings(heroStr);
  const heroTpl = HERO_TEMPLATES[Math.floor(Math.random() * HERO_TEMPLATES.length)];
  const line1 = heroTpl.replace("{0}", heroCards[0] || "").replace("{1}", heroCards[1] || "");
  addMessage(line1, "self");

  // 第二行：公共牌嵌入 或 过渡句
  if (hasBoard) {
    const boardCards = extractCardStrings(boardStr);
    const templates = boardCards.length === 3 ? BOARD_TEMPLATES_3 :
                      boardCards.length === 4 ? BOARD_TEMPLATES_4 : BOARD_TEMPLATES_5;
    const boardTpl = templates[Math.floor(Math.random() * templates.length)];
    let line2 = boardTpl;
    boardCards.forEach((card, i) => { line2 = line2.replace(`{${i}}`, card); });
    addMessage(line2, "self");
  } else {
    const transTpl = TRANSITION_TEMPLATES[Math.floor(Math.random() * TRANSITION_TEMPLATES.length)];
    addMessage(transTpl, "self");
  }

  // 第三行：人数嵌入
  const countTpl = COUNT_TEMPLATES[Math.floor(Math.random() * COUNT_TEMPLATES.length)];
  const line3 = countTpl.replace("{n}", countStr);
  addMessage(line3, "self");
}

// 入局回复模板
const ENTER_TEMPLATES = [
  "今天{rate}度，超过{th}度了，出门吧",
  "{rate}分，及格线{th}，可以去",
  "状态不错，{rate}比{th}高，走起",
  "今天挺热的{rate}度，{th}度就能出门了",
  "看了下天气{rate}度，比{th}度高不少，出去转转",
  "{rate}，够了，{th}就行",
  "可以啊，{rate}呢，{th}就够了",
  "今天{rate}度，暖和，出门没问题",
  "刚看了，{rate}度，超过{th}了，走吧",
  "温度{rate}，及格线{th}，可以出门",
  "{rate}度，比预想的{th}度高，去吧",
  "今天天气还行，{rate}度，{th}度就能出了",
  "不错不错，{rate}分，{th}分及格，稳了",
  "我看了下，{rate}度，{th}度的标准肯定够了",
  "行，{rate}比{th}高，出门吧"
];

// 退出回复模板
const EXIT_TEMPLATES = [
  "今天{rate}度，没到{th}度，在家待着吧",
  "{rate}分，没到{th}，算了",
  "状态一般，{rate}比{th}低，歇着",
  "才{rate}度，要{th}度才能出门",
  "不太行，{rate}度，得{th}度才行",
  "{rate}，不够，要{th}",
  "今天冷，{rate}度，{th}度才能出门呢",
  "看了眼天气，{rate}度，没到{th}度，别出门了",
  "算了吧，{rate}度，离{th}度还差点",
  "不行，{rate}分没到{th}分",
  "{rate}度有点低，{th}度才及格，在家吧",
  "今天不太行，{rate}度，标准是{th}度",
  "差一点，{rate}度，{th}度才够",
  "我觉得不行，{rate}度，起码要{th}度",
  "还是别了，{rate}没到{th}"
];

// 添加消息到聊天区域
function addMessage(text, type) {
  const row = document.createElement("div");
  row.className = `message-row ${type}`;

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.dataset.type = type;
  avatar.src = getAvatarSrc(type);
  avatar.alt = "";

  // 单击上传头像，对方头像3次点击进入原版
  avatar.addEventListener("click", (e) => handleAvatarInteraction(e, type));

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  elements.chatMessages.appendChild(row);

  scrollToBottom();
}

// 处理头像交互：单击上传，对方头像3次点击进入原版
function handleAvatarInteraction(e, type) {
  if (type === "other") {
    avatarClickCount++;
    if (avatarClickTimer) clearTimeout(avatarClickTimer);

    if (avatarClickCount >= 3) {
      avatarClickCount = 0;
      elements.originalPanel.classList.add("show");
    } else {
      avatarClickTimer = setTimeout(() => {
        if (avatarClickCount < 3) {
          currentAvatarType = type;
          elements.avatarInput.click();
        }
        avatarClickCount = 0;
      }, CLICK_INTERVAL);
    }
  } else {
    currentAvatarType = type;
    elements.avatarInput.click();
  }
}

// 3次点击备注修改名字
function handleNameClick() {
  nameClickCount++;

  if (nameClickTimer) {
    clearTimeout(nameClickTimer);
  }

  if (nameClickCount >= 3) {
    nameClickCount = 0;
    const currentName = elements.contactName.textContent;
    const newName = prompt("修改备注", currentName);
    if (newName && newName.trim()) {
      elements.contactName.textContent = newName.trim();
      localStorage.setItem("contactName", newName.trim());
    }
  } else {
    nameClickTimer = setTimeout(() => {
      nameClickCount = 0;
    }, CLICK_INTERVAL);
  }
}

// 显示"对方正在输入..."
function showTypingStatus() {
  if (elements.contactName) {
    elements.contactName.dataset.originalName = elements.contactName.textContent;
    elements.contactName.textContent = "对方正在输入...";
  }
}

// 隐藏输入状态，恢复名字
function hideTypingStatus() {
  if (elements.contactName && elements.contactName.dataset.originalName) {
    elements.contactName.textContent = elements.contactName.dataset.originalName;
  }
}

// 加载保存的备注名
function loadContactName() {
  const savedName = localStorage.getItem("contactName");
  if (savedName && elements.contactName) {
    elements.contactName.textContent = savedName;
  }
}

// 获取头像地址
function getAvatarSrc(type) {
  const saved = localStorage.getItem(`avatar_${type}`);
  if (saved) return saved;
  return type === "self" ? "avatars/self.svg" : "avatars/other.svg";
}

// 加载已保存的头像
function loadAvatars() {
  // 头像会在 addMessage 时通过 getAvatarSrc 加载
}

// 处理头像选择
function handleAvatarSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      cropImage = img;
      showCropModal();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

// 显示裁剪弹窗
function showCropModal() {
  if (!cropImage || !elements.cropCanvas) return;

  const canvas = elements.cropCanvas;
  const ctx = canvas.getContext("2d");
  const size = Math.min(cropImage.width, cropImage.height);
  canvas.width = 200;
  canvas.height = 200;

  const sx = (cropImage.width - size) / 2;
  const sy = (cropImage.height - size) / 2;
  ctx.drawImage(cropImage, sx, sy, size, size, 0, 0, 200, 200);

  elements.cropModal.classList.add("show");
}

// 关闭裁剪弹窗
function closeCropModal() {
  elements.cropModal.classList.remove("show");
  cropImage = null;
}

// 确认裁剪
function confirmCrop() {
  if (!elements.cropCanvas || !currentAvatarType) return;

  const dataUrl = elements.cropCanvas.toDataURL("image/png");
  localStorage.setItem(`avatar_${currentAvatarType}`, dataUrl);

  // 更新页面上所有对应类型的头像
  document.querySelectorAll(`.avatar[data-type="${currentAvatarType}"]`).forEach(img => {
    img.src = dataUrl;
  });

  closeCropModal();
}

// 滚动到底部
function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// 处理键盘弹出时的滚动
function setupKeyboardHandler() {
  // 使用 visualViewport API（现代浏览器）
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      scrollToBottom();
    });
  }

  // 输入框获得焦点时滚动
  elements.chatInput.addEventListener("focus", () => {
    setTimeout(scrollToBottom, 300);
  });
}

// ========== 蒙特卡洛模拟（从 app.js 移植） ==========

function estimateWinProbability(heroCards, boardCards, opponents, iterations) {
  const excluded = new Set([...heroCards, ...boardCards]);
  const baseDeck = buildDeck(excluded);
  const boardMissing = 5 - boardCards.length;
  const drawCount = boardMissing + opponents * 2;
  let winShare = 0;

  for (let i = 0; i < iterations; i++) {
    const deck = baseDeck.slice();
    drawPartialShuffle(deck, drawCount);
    const drawn = deck.slice(0, drawCount);
    let cursor = 0;
    const finalBoard = boardCards.slice();
    for (let j = 0; j < boardMissing; j++) {
      finalBoard.push(drawn[cursor++]);
    }

    const heroRank = bestRank(heroCards.concat(finalBoard));
    let best = heroRank;
    let bestCount = 1;

    for (let opp = 0; opp < opponents; opp++) {
      const oppCards = [drawn[cursor++], drawn[cursor++]];
      const oppRank = bestRank(oppCards.concat(finalBoard));
      if (oppRank > best) {
        best = oppRank;
        bestCount = 1;
      } else if (oppRank === best) {
        bestCount++;
      }
    }

    if (heroRank === best) {
      winShare += 1 / bestCount;
    }
  }

  return winShare / iterations;
}

function buildDeck(excluded) {
  const deck = [];
  for (let i = 0; i < 52; i++) {
    if (!excluded.has(i)) {
      deck.push(i);
    }
  }
  return deck;
}

function drawPartialShuffle(deck, count) {
  const max = deck.length;
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (max - i));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
}

function bestRank(cards) {
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const rank = rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (rank > best) {
              best = rank;
            }
          }
        }
      }
    }
  }
  return best;
}

function rankFive(cards) {
  const ranks = cards.map((code) => (code % 13) + 2).sort((a, b) => b - a);
  const suits = cards.map((code) => Math.floor(code / 13));
  const isFlush = suits.every((suit) => suit === suits[0]);

  const counts = {};
  ranks.forEach((rank) => {
    counts[rank] = (counts[rank] || 0) + 1;
  });

  const uniqueRanks = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a);

  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) {
    return encodeRank(8, [straightHigh]);
  }

  const groups = uniqueRanks
    .map((rank) => ({ rank, count: counts[rank] }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (groups[0].count === 4) {
    const kicker = groups[1].rank;
    return encodeRank(7, [groups[0].rank, kicker]);
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return encodeRank(6, [groups[0].rank, groups[1].rank]);
  }

  if (isFlush) {
    return encodeRank(5, uniqueRanks);
  }

  if (isStraight) {
    return encodeRank(4, [straightHigh]);
  }

  if (groups[0].count === 3) {
    const kickers = uniqueRanks.filter((rank) => rank !== groups[0].rank);
    return encodeRank(3, [groups[0].rank, ...kickers]);
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const kicker = groups[2].rank;
    return encodeRank(2, [groups[0].rank, groups[1].rank, kicker]);
  }

  if (groups[0].count === 2) {
    const kickers = uniqueRanks.filter((rank) => rank !== groups[0].rank);
    return encodeRank(1, [groups[0].rank, ...kickers]);
  }

  return encodeRank(0, uniqueRanks);
}

function encodeRank(category, kickers) {
  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (kickers[i] || 0);
  }
  return score;
}

// 启动
init();
