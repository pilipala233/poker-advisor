const SIMULATIONS = 10000;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_DISPLAY = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { key: "S", name: "Spades", label: "黑桃", symbol: "&spades;" },
  { key: "H", name: "Hearts", label: "红桃", symbol: "&hearts;" },
  { key: "D", name: "Diamonds", label: "方块", symbol: "&diams;" },
  { key: "C", name: "Clubs", label: "梅花", symbol: "&clubs;" }
];

const state = {
  opponents: 1,
  hero: [null, null],
  board: [null, null, null, null, null],
  active: { type: "hero", index: 0 }
};

const elements = {
  heroSlots: document.getElementById("hero-slots"),
  boardSlots: document.getElementById("board-slots"),
  cardGrid: document.getElementById("card-grid"),
  cardPanel: document.getElementById("card-panel"),
  opponents: document.getElementById("opponents"),
  analyzeBtn: document.getElementById("analyze-btn"),
  clearBtn: document.getElementById("clear-btn"),
  openCardPanel: document.getElementById("open-card-panel"),
  closeCardPanel: document.getElementById("close-card-panel"),
  overlay: document.getElementById("overlay"),
  status: document.getElementById("status"),
  winRate: document.getElementById("win-rate"),
  recommendation: document.getElementById("recommendation"),
  threshold: document.getElementById("threshold"),
  stageLabel: document.getElementById("stage-label"),
  simCount: document.getElementById("sim-count")
};

const cardMap = new Map();
const cardButtons = new Map();
const modalQuery = window.matchMedia("(max-width: 860px)");
let lastFocus = null;

function init() {
  if (elements.simCount) {
    elements.simCount.textContent = SIMULATIONS.toString();
  }
  buildSlots(elements.heroSlots, "hero", 2);
  buildSlots(elements.boardSlots, "board", 5);
  buildCardGrid();
  setActiveSlot("hero", 0);
  bindEvents();
  syncCardPanelMode();
  renderAll();
}

function buildSlots(container, type, count) {
  container.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-slot";
    button.dataset.type = type;
    button.dataset.index = i.toString();
    button.addEventListener("click", () => handleSlotClick(type, i));
    container.appendChild(button);
  }
}

function buildCardGrid() {
  elements.cardGrid.innerHTML = "";
  cardMap.clear();
  cardButtons.clear();
  SUITS.forEach((suit, suitIndex) => {
    const section = document.createElement("div");
    section.className = "card-section";

    const title = document.createElement("div");
    title.className = "card-section-title";
    title.dataset.suit = suit.key;
    title.innerHTML = `<span class="section-suit">${suit.symbol}</span><span class="section-name">${suit.label}</span>`;

    const grid = document.createElement("div");
    grid.className = "card-section-grid";

    RANK_DISPLAY.forEach((rank) => {
      const rankIndex = RANKS.indexOf(rank);
      const code = suitIndex * 13 + rankIndex;
      const card = {
        code,
        rank,
        rankValue: rankIndex + 2,
        suit: suit.key,
        suitSymbol: suit.symbol,
        label: `${rank}${suit.key}`
      };
      cardMap.set(code, card);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-button";
      button.dataset.code = code.toString();
      button.dataset.suit = suit.key;
      button.setAttribute("role", "listitem");
      button.innerHTML = `<span class="rank">${rank}</span><span class="suit">${suit.symbol}</span>`;
      button.addEventListener("click", () => handleCardPick(code));
      grid.appendChild(button);
      cardButtons.set(code, button);
    });

    section.appendChild(title);
    section.appendChild(grid);
    elements.cardGrid.appendChild(section);
  });
}

function bindEvents() {
  elements.opponents.addEventListener("change", () => {
    const value = clampInt(elements.opponents.value, 1, 8, 1);
    elements.opponents.value = value.toString();
    state.opponents = value;
    updateThreshold();
  });

  elements.analyzeBtn.addEventListener("click", () => {
    clearStatus();
    runAnalysis();
  });

  elements.clearBtn.addEventListener("click", () => {
    state.hero = [null, null];
    state.board = [null, null, null, null, null];
    setActiveSlot("hero", 0);
    clearStatus();
    resetResult();
    renderAll();
  });

  if (elements.openCardPanel) {
    elements.openCardPanel.addEventListener("click", () => setCardPanelOpen(true));
  }

  if (elements.closeCardPanel) {
    elements.closeCardPanel.addEventListener("click", () => setCardPanelOpen(false));
  }

  if (elements.overlay) {
    elements.overlay.addEventListener("click", () => setCardPanelOpen(false));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("card-panel-open")) {
      setCardPanelOpen(false);
    }
  });

  if (modalQuery.addEventListener) {
    modalQuery.addEventListener("change", syncCardPanelMode);
  } else if (modalQuery.addListener) {
    modalQuery.addListener(syncCardPanelMode);
  }

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const target = chip.dataset.target;
      if (!target) {
        return;
      }
      const index = target === "hero" ? findFirstEmpty(state.hero) : findFirstEmpty(state.board);
      setActiveSlot(target, index >= 0 ? index : 0);
      openCardPanelIfNeeded();
    });
  });
}

function setActiveSlot(type, index) {
  state.active = { type, index };
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("chip-active", chip.dataset.target === type);
  });
  renderSlots();
  renderCardGrid();
}

function handleSlotClick(type, index) {
  setActiveSlot(type, index);
  openCardPanelIfNeeded();
}

function openCardPanelIfNeeded() {
  if (!modalQuery.matches) {
    return;
  }
  if (!document.body.classList.contains("card-panel-open")) {
    setCardPanelOpen(true);
  }
}

function syncCardPanelMode() {
  if (!elements.cardPanel || !elements.openCardPanel) {
    return;
  }

  if (!modalQuery.matches) {
    document.body.classList.remove("card-panel-open");
    elements.cardPanel.removeAttribute("aria-hidden");
    elements.cardPanel.removeAttribute("aria-modal");
    elements.cardPanel.removeAttribute("role");
    elements.openCardPanel.setAttribute("aria-expanded", "false");
    if (elements.overlay) {
      elements.overlay.setAttribute("aria-hidden", "true");
    }
    return;
  }

  if (!document.body.classList.contains("card-panel-open")) {
    elements.cardPanel.setAttribute("aria-hidden", "true");
    if (elements.overlay) {
      elements.overlay.setAttribute("aria-hidden", "true");
    }
  }
}

function setCardPanelOpen(open) {
  if (!elements.cardPanel || !elements.openCardPanel || !modalQuery.matches) {
    return;
  }

  document.body.classList.toggle("card-panel-open", open);
  elements.openCardPanel.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    lastFocus = document.activeElement;
    elements.cardPanel.setAttribute("aria-hidden", "false");
    elements.cardPanel.setAttribute("role", "dialog");
    elements.cardPanel.setAttribute("aria-modal", "true");
    if (elements.overlay) {
      elements.overlay.setAttribute("aria-hidden", "false");
    }
    if (elements.closeCardPanel) {
      elements.closeCardPanel.focus();
    }
  } else {
    elements.cardPanel.setAttribute("aria-hidden", "true");
    elements.cardPanel.removeAttribute("aria-modal");
    elements.cardPanel.removeAttribute("role");
    if (elements.overlay) {
      elements.overlay.setAttribute("aria-hidden", "true");
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }
}

function handleCardPick(code) {
  const location = findCardLocation(code);
  if (location) {
    state[location.type][location.index] = null;
    setActiveSlot(location.type, location.index);
    renderAll();
    return;
  }

  assignToActiveSlot(code);
  renderAll();
}

function assignToActiveSlot(code) {
  const { type, index } = state.active;
  if (!type) {
    return;
  }
  state[type][index] = code;
  advanceSlot(type, index);
}

function advanceSlot(type, index) {
  const slots = state[type];
  for (let i = index + 1; i < slots.length; i += 1) {
    if (slots[i] === null) {
      setActiveSlot(type, i);
      return;
    }
  }

  if (type === "hero") {
    const nextBoard = findFirstEmpty(state.board);
    if (nextBoard >= 0) {
      setActiveSlot("board", nextBoard);
      return;
    }
  }
  setActiveSlot(type, index);
}

function renderAll() {
  renderSlots();
  renderCardGrid();
  updateStageLabel();
  updateThreshold();
}

function renderSlots() {
  renderSlotGroup(elements.heroSlots, state.hero);
  renderSlotGroup(elements.boardSlots, state.board);
}

function renderSlotGroup(container, cards) {
  const buttons = Array.from(container.querySelectorAll(".card-slot"));
  buttons.forEach((button) => {
    const index = Number(button.dataset.index);
    const code = cards[index];
    const isActive = button.dataset.type === state.active.type && index === state.active.index;
    button.classList.toggle("active", isActive);
    button.classList.toggle("filled", code !== null);
    if (code !== null) {
      const card = cardMap.get(code);
      button.dataset.suit = card.suit;
      button.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${card.suitSymbol}</span>`;
    } else {
      button.dataset.suit = "";
      button.textContent = "空";
    }
  });
}

function renderCardGrid() {
  const heroSet = new Set(state.hero.filter((card) => card !== null));
  const boardSet = new Set(state.board.filter((card) => card !== null));
  const activeCard = getActiveCardCode();
  cardButtons.forEach((button, code) => {
    const isHero = heroSet.has(code);
    const isBoard = boardSet.has(code);
    button.classList.toggle("used", isHero || isBoard);
    button.classList.toggle("used-hero", isHero);
    button.classList.toggle("used-board", isBoard);
    button.classList.toggle("active", activeCard === code);
  });
}

function getActiveCardCode() {
  const { type, index } = state.active;
  if (!type) {
    return null;
  }
  return state[type][index];
}

function runAnalysis() {
  const heroCards = state.hero.filter((card) => card !== null);
  if (heroCards.length < 2) {
    setStatus("请先选择两张手牌再开始分析。");
    return;
  }
  const boardCards = state.board.filter((card) => card !== null);
  if (boardCards.length > 5) {
    setStatus("公共牌最多 5 张。");
    return;
  }

  const opponents = clampInt(elements.opponents.value, 1, 8, 1);
  state.opponents = opponents;
  elements.opponents.value = opponents.toString();
  updateThreshold();

  elements.analyzeBtn.disabled = true;
  setStatus("正在进行蒙特卡洛模拟...");
  setTimeout(() => {
    const winRate = estimateWinProbability(heroCards, boardCards, opponents, SIMULATIONS);
    updateResult(winRate, opponents);
    elements.analyzeBtn.disabled = false;
    clearStatus();
  }, 20);
}

function updateResult(winRate, opponents) {
  const pct = (winRate * 100).toFixed(1);
  elements.winRate.textContent = `${pct}%`;
  const players = opponents + 1;
  const threshold = 1 / players;
  const recommendation = winRate >= threshold ? "入局" : "退出";
  elements.recommendation.textContent = recommendation;
  elements.threshold.textContent = `阈值：${(threshold * 100).toFixed(1)}% (1/${players})`;
}

function resetResult() {
  elements.winRate.textContent = "--";
  elements.recommendation.textContent = "--";
  elements.threshold.textContent = "阈值：--";
}

function updateStageLabel() {
  const count = state.board.filter((card) => card !== null).length;
  let label = "阶段：进行中";
  if (count === 0) {
    label = "阶段：翻牌前";
  } else if (count === 3) {
    label = "阶段：翻牌";
  } else if (count === 4) {
    label = "阶段：转牌";
  } else if (count === 5) {
    label = "阶段：河牌";
  }
  elements.stageLabel.textContent = label;
}

function updateThreshold() {
  const opponents = clampInt(elements.opponents.value, 1, 8, 1);
  const players = opponents + 1;
  const threshold = 1 / players;
  elements.threshold.textContent = `阈值：${(threshold * 100).toFixed(1)}% (1/${players})`;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function clearStatus() {
  elements.status.textContent = "";
}

function findCardLocation(code) {
  const heroIndex = state.hero.indexOf(code);
  if (heroIndex >= 0) {
    return { type: "hero", index: heroIndex };
  }
  const boardIndex = state.board.indexOf(code);
  if (boardIndex >= 0) {
    return { type: "board", index: boardIndex };
  }
  return null;
}

function findFirstEmpty(list) {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === null) {
      return i;
    }
  }
  return -1;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function estimateWinProbability(heroCards, boardCards, opponents, iterations) {
  const excluded = new Set([...heroCards, ...boardCards]);
  const baseDeck = buildDeck(excluded);
  const boardMissing = 5 - boardCards.length;
  const drawCount = boardMissing + opponents * 2;
  let winShare = 0;

  for (let i = 0; i < iterations; i += 1) {
    const deck = baseDeck.slice();
    drawPartialShuffle(deck, drawCount);
    const drawn = deck.slice(0, drawCount);
    let cursor = 0;
    const finalBoard = boardCards.slice();
    for (let j = 0; j < boardMissing; j += 1) {
      finalBoard.push(drawn[cursor++]);
    }

    const heroRank = bestRank(heroCards.concat(finalBoard));
    let best = heroRank;
    let bestCount = 1;

    for (let opp = 0; opp < opponents; opp += 1) {
      const oppCards = [drawn[cursor++], drawn[cursor++]];
      const oppRank = bestRank(oppCards.concat(finalBoard));
      if (oppRank > best) {
        best = oppRank;
        bestCount = 1;
      } else if (oppRank === best) {
        bestCount += 1;
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
  for (let i = 0; i < 52; i += 1) {
    if (!excluded.has(i)) {
      deck.push(i);
    }
  }
  return deck;
}

function drawPartialShuffle(deck, count) {
  const max = deck.length;
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(Math.random() * (max - i));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
}

function bestRank(cards) {
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n - 4; a += 1) {
    for (let b = a + 1; b < n - 3; b += 1) {
      for (let c = b + 1; c < n - 2; c += 1) {
        for (let d = c + 1; d < n - 1; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
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
  for (let i = 0; i < 5; i += 1) {
    score = score * 15 + (kickers[i] || 0);
  }
  return score;
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
