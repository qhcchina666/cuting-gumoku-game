const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const refereeMessage = document.getElementById('refereeMessage');
const turnIndicator = document.getElementById('turnIndicator');
const restartBtn = document.getElementById('restartBtn');
const difficultySelect = document.getElementById('difficulty');
const modal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalRestartBtn = document.getElementById('modalRestartBtn');
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const refereeImg = document.getElementById('refereeImg');
const confirmRestartModal = document.getElementById('confirmRestartModal');
const restartConfirmBtn = document.getElementById('restartConfirmBtn');
const restartCancelBtn = document.getElementById('restartCancelBtn');

const confirmStartModal = document.getElementById('confirmStartModal');
const startConfirmBtn = document.getElementById('startConfirmBtn');
const startCancelBtn = document.getElementById('startCancelBtn');

// 游戏常量
const BOARD_SIZE = 15;
const CELL_SIZE = 40;
const PIECE_RADIUS = 18;
const EMPTY = 0;

const BLACK = GameNetwork.BLACK;
const WHITE = GameNetwork.WHITE;

// 游戏状态
let board = [];
let currentPlayer = BLACK;
let gameOver = true; // 页面初始时算作游戏未开始/已结束状态
let isAiThinking = false;
let lastMove = null;
let hoverPos = null;
let moveHistory = [];
let undoCount = 3;
const undoBtn = document.getElementById('undoBtn');

// 计时器变量
let turnTimerInterval = null;
let gameTimerInterval = null;
let turnStartTime = 0;
let gameStartTime = 0;
let totalGameTimeSeconds = 0;

// 人物互动变量
let refereeClickCount = 0;
const refereeClickPhrases = [
    "你点啥！",
    "以雷霆击碎黑暗！",
    "下棋这么认真，你小子有点实力"
];
const refereeClickImages = ['assets/images/referee1.jpg', 'assets/images/referee2.jpg', 'assets/images/referee3.jpg'];

const pieceSound = new Audio('https://actions.google.com/sounds/v1/foley/wood_click.ogg');

const phrases = {
    start: ["欢迎来到QHC五子棋！<br>敢来吗？", "请多指教~<br>黑子先手！"],
    playerTurn: ["轮到你了，<br>请落子！", "仔细想想，<br>不要大意！", "这一步很关键！"],
    aiTurn: ["嗯...let me think think...", "人机思考中...", "以雷霆击碎黑暗！"],
    playerWin: ["啥，你赢了！<br>Fu*k！", "甘拜下风...<br>这局是你赢了。"],
    aiWin: ["哈哈，itsme！<br>太菜了~", "老弟你还得练！"],
    invalidMove: ["这里已经有棋子啦，<br>换个地方吧！"]
};

function getRandomPhrase(type) {
    const list = phrases[type];
    return list[Math.floor(Math.random() * list.length)];
}

function updateReferee(message, type, forceImg = null) {
    if (message) refereeMessage.innerHTML = message;
    if (!refereeImg) return;

    let imgName = forceImg;
    if (!imgName) {
        switch (type) {
            case 'start': case 'playerTurn': imgName = 'assets/images/referee_normal.png'; break;
            case 'aiTurn': imgName = 'assets/images/referee_thinking.png'; break;
            case 'aiWin': imgName = 'assets/images/referee_happy.png'; break;
            case 'playerWin': imgName = 'assets/images/referee_sad.png'; break;
            case 'invalidMove': imgName = 'assets/images/referee_angry.png'; break;
            default: imgName = 'assets/images/referee_normal.png';
        }
    }

    if (refereeImg.src.indexOf(imgName) === -1) {
        refereeImg.src = imgName;
    }
}

// 绑定人物点击互动
if (refereeImg) {
    refereeImg.addEventListener('click', () => {
        const index = refereeClickCount % 3;
        const phrase = refereeClickPhrases[index];
        const img = refereeClickImages[index];
        updateReferee(phrase, 'manual_click', img);
        refereeClickCount++;
    });
}

function drawBoard() {
    // 明确设置背景色以保证未开始和开始后贴图一致
    ctx.fillStyle = '#e5ba82';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boardLineColor = 'rgba(0, 0, 0, 0.15)';
    ctx.strokeStyle = boardLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < BOARD_SIZE; i++) {
        let pos = Math.floor(i * CELL_SIZE + CELL_SIZE / 2) + 0.5;
        ctx.moveTo(CELL_SIZE / 2, pos); ctx.lineTo(canvas.width - CELL_SIZE / 2, pos);
        ctx.moveTo(pos, CELL_SIZE / 2); ctx.lineTo(pos, canvas.height - CELL_SIZE / 2);
    }
    ctx.stroke();

    const points = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
    ctx.fillStyle = boardLineColor;
    points.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px * CELL_SIZE + CELL_SIZE / 2, py * CELL_SIZE + CELL_SIZE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPieces() {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (board[i][j] !== EMPTY) drawPiece(i, j, board[i][j]);
        }
    }
    if (lastMove) drawLastMoveMarker(lastMove.x, lastMove.y, board[lastMove.x][lastMove.y]);
}

function drawHover() {
    if (!hoverPos || gameOver || isAiThinking) return;
    const isMyTurn = !GameNetwork.isOnline || (currentPlayer === GameNetwork.myRole);
    if (!isMyTurn) return;
    const centerX = hoverPos.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = hoverPos.y * CELL_SIZE + CELL_SIZE / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, PIECE_RADIUS - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    ctx.restore();
}

function render() {
    drawBoard();
    drawPieces();
    drawHover();
}

function drawPiece(x, y, player) {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, PIECE_RADIUS, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(centerX - PIECE_RADIUS / 3, centerY - PIECE_RADIUS / 3, PIECE_RADIUS / 5, centerX, centerY, PIECE_RADIUS);
    if (player === BLACK) {
        gradient.addColorStop(0, '#666'); gradient.addColorStop(1, '#111');
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
    } else {
        gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#bbb');
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
    }
    ctx.fillStyle = gradient; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}

function drawLastMoveMarker(x, y, player) {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = player === BLACK ? '#fff' : '#e74c3c';
    ctx.fill();
}

function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

function startTimers() {
    stopTimers();
    gameStartTime = Date.now();
    gameTimerInterval = setInterval(() => {
        totalGameTimeSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
        const td = document.getElementById('totalTimerDisplay');
        if (td) td.textContent = formatTime(totalGameTimeSeconds);
    }, 1000);
    startTurnTimer();
}

function startTurnTimer() {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    turnStartTime = Date.now();
    turnTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
        const td = document.getElementById('turnTimerDisplay');
        if (td) td.textContent = formatTime(elapsed);
    }, 1000);
}

function stopTimers() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (turnTimerInterval) clearInterval(turnTimerInterval);
}

function initGame() {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    currentPlayer = BLACK;
    gameOver = false;
    isAiThinking = false;
    lastMove = null;
    hoverPos = null;
    restartBtn.textContent = "重新开始";
    turnIndicator.textContent = "当前回合: 玩家 (黑子)";
    turnIndicator.className = "turn-black";
    modal.classList.add('hidden');
    confirmRestartModal.classList.add('hidden');
    if (confirmStartModal) confirmStartModal.classList.add('hidden');

    startTimers();
    moveHistory = [];
    undoCount = 3;
    if (undoBtn) {
        undoBtn.disabled = true;
        undoBtn.textContent = `悔棋 (${undoCount})`;
    }
    if (GameNetwork.isOnline) {
        updateReferee(GameNetwork.conn ? "联机成功！请开局" : "等待好友加入中...", 'start');
    } else {
        updateReferee(getRandomPhrase('start'), 'start');
    }
    render();
}

function checkWin(x, y, player) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let [dx, dy] of directions) {
        let count = 1;
        let i = x + dx, j = y + dy;
        while (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE && board[i][j] === player) { count++; i += dx; j += dy; }
        i = x - dx; j = y - dy;
        while (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE && board[i][j] === player) { count++; i -= dx; j -= dy; }
        if (count >= 5) return true;
    }
    return false;
}

function handleGameOver(winner) {
    gameOver = true;
    stopTimers();
    restartBtn.textContent = "开始游戏";
    if (undoBtn) undoBtn.disabled = true;
    setTimeout(() => {
        modal.classList.remove('hidden');
        if (winner === BLACK) {
            modalTitle.textContent = "Vectory！";
            modalMessage.textContent = GameNetwork.isOnline ? (GameNetwork.myRole === BLACK ? "你战胜了对手！" : "对手获得了胜利") : "你战胜了人机！";
            updateReferee(getRandomPhrase('playerWin'), 'playerWin');
        } else {
            modalTitle.textContent = "Defeat";
            modalMessage.textContent = GameNetwork.isOnline ? (GameNetwork.myRole === WHITE ? "你战胜了对手！" : "对手获得了胜利") : "人机获胜了！";
            updateReferee(getRandomPhrase('aiWin'), 'aiWin');
        }
    }, 500);
}

function placePiece(x, y) {
    if (gameOver || board[x][y] !== EMPTY) return false;
    board[x][y] = currentPlayer;
    lastMove = { x, y };
    pieceSound.play().catch(e => { });
    if (checkWin(x, y, currentPlayer)) { render(); handleGameOver(currentPlayer); return true; }
    currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK;
    startTurnTimer();
    const isMyTurn = !GameNetwork.isOnline || (currentPlayer === GameNetwork.myRole);
    if (currentPlayer === BLACK) {
        turnIndicator.textContent = GameNetwork.isOnline ? (GameNetwork.myRole === BLACK ? "当前回合: 你 (黑子)" : "当前回合: 对手 (黑子)") : "当前回合: 玩家 (黑子)";
        turnIndicator.className = "turn-black";
        if (isMyTurn) updateReferee(getRandomPhrase('playerTurn'), 'playerTurn');
        else if (GameNetwork.isOnline) updateReferee("对方正在思考...", 'aiTurn');
    } else {
        turnIndicator.textContent = GameNetwork.isOnline ? (GameNetwork.myRole === WHITE ? "当前回合: 你 (白子)" : "当前回合: 对手 (白子)") : "当前回合: 婷婷 (白子)";
        turnIndicator.className = "turn-white";
        if (!GameNetwork.isOnline) {
            isAiThinking = true;
            updateReferee(getRandomPhrase('aiTurn'), 'aiTurn');
            setTimeout(() => { makeAiMove(); }, 1000);
        } else if (isMyTurn) updateReferee(getRandomPhrase('playerTurn'), 'playerTurn');
        else updateReferee("对方正在思考...", 'aiTurn');
    }
    render();
    moveHistory.push({ x, y, player: board[x][y] });
    if (!GameNetwork.isOnline && undoCount > 0 && !gameOver) {
        if (undoBtn) undoBtn.disabled = false;
    }
    return true;
}

function makeAiMove() {
    if (gameOver) return;
    const depth = parseInt(difficultySelect.value);
    const bestMove = getBestMove(board, WHITE, depth);
    isAiThinking = false;
    if (bestMove) placePiece(bestMove.x, bestMove.y);
}

canvas.addEventListener('click', (e) => {
    if (gameOver || isAiThinking) return;
    const isMyTurn = !GameNetwork.isOnline || (currentPlayer === GameNetwork.myRole);
    if (!isMyTurn) return;
    if (!GameNetwork.isOnline && currentPlayer !== BLACK) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        if (board[x][y] !== EMPTY) updateReferee(getRandomPhrase('invalidMove'), 'invalidMove');
        else {
            if (GameNetwork.isOnline) {
                if (GameNetwork.conn && currentPlayer === GameNetwork.myRole) {
                    if (placePiece(x, y)) GameNetwork.send({ type: 'move', x, y });
                }
            } else if (currentPlayer === BLACK) placePiece(x, y);
        }
    }
});

function undoMove() {
    if (gameOver || isAiThinking || undoCount <= 0 || moveHistory.length === 0 || GameNetwork.isOnline) return;

    // 如果是人机模式且轮到玩家（黑子），说明AI刚刚下完，需要悔棋2步
    // 如果只有1步（玩家刚下完第一步），或者轮到AI（白子），则悔棋1步
    let stepsToUndo = 1;
    if (!GameNetwork.isOnline && currentPlayer === BLACK && moveHistory.length >= 2) {
        stepsToUndo = 2;
    }

    for (let i = 0; i < stepsToUndo; i++) {
        const last = moveHistory.pop();
        if (last) {
            board[last.x][last.y] = EMPTY;
        }
    }

    undoCount--;
    const nextMove = moveHistory[moveHistory.length - 1];
    lastMove = nextMove ? { x: nextMove.x, y: nextMove.y } : null;
    currentPlayer = BLACK; // 悔棋后总是回到玩家回合（黑子）

    // 更新 UI
    turnIndicator.textContent = "当前回合: 玩家 (黑子)";
    turnIndicator.className = "turn-black";
    if (undoBtn) {
        undoBtn.textContent = `悔棋 (${undoCount})`;
        if (undoCount <= 0 || moveHistory.length === 0) undoBtn.disabled = true;
    }

    updateReferee("No，<br>这步不算，重来吧~", 'playerTurn');
    render();
}

if (undoBtn) {
    undoBtn.addEventListener('click', undoMove);
}

canvas.addEventListener('mousemove', (e) => {
    if (gameOver || isAiThinking) { if (hoverPos) { hoverPos = null; render(); } return; }
    const isMyTurn = !GameNetwork.isOnline || (currentPlayer === GameNetwork.myRole);
    if (!isMyTurn) { if (hoverPos) { hoverPos = null; render(); } return; }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[x][y] === EMPTY) {
        if (!hoverPos || hoverPos.x !== x || hoverPos.y !== y) { hoverPos = { x, y }; render(); }
    } else { if (hoverPos) { hoverPos = null; render(); } }
});

canvas.addEventListener('mouseleave', () => { if (hoverPos) { hoverPos = null; render(); } });

// 在说明框显示时，点击“开始对局”会调用此逻辑
closeHelpBtn.addEventListener('click', () => {
    helpModal.classList.add('hidden');
    // 如果游戏还没开始，点击说明框的按钮即视为开始
    if (gameOver) {
        initGame();
    }
});

GameNetwork.onMessage((data) => {
    if (data.type === 'move') placePiece(data.x, data.y);
    else if (data.type === 'restart' || data.type === 'start') {
        if (data.role) GameNetwork.myRole = data.role;
        initGame();
    }
});

restartBtn.addEventListener('click', () => {
    if (gameOver) {
        confirmStartModal.classList.remove('hidden');
    } else {
        confirmRestartModal.classList.remove('hidden');
    }
});

restartConfirmBtn.addEventListener('click', () => {
    confirmRestartModal.classList.add('hidden');
    if (GameNetwork.isOnline) GameNetwork.send({ type: 'restart' });
    initGame();
});

restartCancelBtn.addEventListener('click', () => {
    confirmRestartModal.classList.add('hidden');
});

modalRestartBtn.addEventListener('click', () => {
    if (GameNetwork.isOnline) GameNetwork.send({ type: 'restart' });
    initGame();
});

startConfirmBtn.addEventListener('click', () => {
    confirmStartModal.classList.add('hidden');
    if (GameNetwork.isOnline) GameNetwork.send({ type: 'restart' });
    initGame();
});

startCancelBtn.addEventListener('click', () => {
    confirmStartModal.classList.add('hidden');
});

helpBtn.addEventListener('click', () => { helpModal.classList.remove('hidden'); });
closeHelpBtn.addEventListener('click', () => {
    helpModal.classList.add('hidden');
});

// 移除 window.onload 避免必须等待页面图片资源加载完毕，实现立即绘制棋盘和自动开局
GameNetwork.init();

// 初始先重置数据但保持 gameOver=true 以便于弹出说明
board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
render();

// 自动弹出说明框
helpModal.classList.remove('hidden');
