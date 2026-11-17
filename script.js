(() => {
  "use strict";

  const LEVELS = {
    easy: { name: "ง่าย", columns: 5, rows: 4, count: 20, trayColumns: 7 },
    medium: { name: "ปานกลาง", columns: 5, rows: 5, count: 25, trayColumns: 7 },
    hard: { name: "ยาก", columns: 6, rows: 5, count: 30, trayColumns: 8 },
    expert: { name: "ยากมาก", columns: 9, rows: 5, count: 45, trayColumns: 9 },
  };
  const image = new Image();
  const levelSelect = document.querySelector("#level-select");
  const gamePanel = document.querySelector("#game-panel");
  const board = document.querySelector("#puzzle-board");
  const tray = document.querySelector("#piece-tray");
  const progressCount = document.querySelector("#progress-count");
  const trayCount = document.querySelector("#tray-count");
  const currentLevel = document.querySelector("#current-level");
  const message = document.querySelector("#game-message");
  const errorMessage = document.querySelector("#error-message");
  const restartButton = document.querySelector("#restart-button");
  const changeLevelButton = document.querySelector("#change-level-button");
  const musicToggleButton = document.querySelector("#music-toggle-button");
  const musicToggleLabel = document.querySelector("#music-toggle-label");
  const musicStatus = document.querySelector("#music-status");
  const backgroundMusic = document.querySelector("#background-music");
  const difficultyButtons = [...document.querySelectorAll(".difficulty-card")];

  let columns = 0;
  let rows = 0;
  let pieceCount = 0;
  let selectedLevel = null;
  let boardWidth = 0;
  let boardHeight = 0;
  let cellWidth = 0;
  let cellHeight = 0;
  let tabSize = 0;
  let pieces = [];
  let placedCount = 0;
  let dragState = null;
  let imageReady = false;
  let musicEnabled = true;
  let musicRequestId = 0;
  let soundContext = null;

  function showError(text) {
    errorMessage.textContent = text;
    errorMessage.hidden = false;
    restartButton.disabled = true;
    difficultyButtons.forEach((button) => {
      button.disabled = true;
    });
  }

  function getBoardWidth() {
    const availableWidth = window.innerWidth > 900
      ? gamePanel.querySelector(".game-layout").clientWidth * 0.57
      : window.innerWidth - 48;
    const availableHeight = window.innerHeight - (window.innerWidth > 900 ? 350 : 340);
    const widthForHeight = Math.max(0, availableHeight) * image.naturalWidth / image.naturalHeight;
    return Math.max(220, Math.min(680, availableWidth, widthForHeight || availableWidth));
  }

  function updateDimensions() {
    boardWidth = getBoardWidth();
    boardHeight = boardWidth * image.naturalHeight / image.naturalWidth;
    cellWidth = boardWidth / columns;
    cellHeight = boardHeight / rows;
    tabSize = Math.min(cellWidth, cellHeight) * 0.2;

    board.style.width = `${boardWidth}px`;
    board.style.height = `${boardHeight}px`;
    board.style.setProperty("--preview-image", `url("${image.src}")`);
    tray.style.setProperty("--columns", String(selectedLevel.trayColumns));

    const slots = board.querySelectorAll(".board-slot");
    slots.forEach((slot) => {
      const column = Number(slot.dataset.column);
      const row = Number(slot.dataset.row);
      slot.style.left = `${column * cellWidth}px`;
      slot.style.top = `${row * cellHeight}px`;
      slot.style.width = `${cellWidth}px`;
      slot.style.height = `${cellHeight}px`;
    });

    pieces.forEach((piece) => {
      drawPiece(piece);
      if (piece.placed) {
        positionPlacedPiece(piece);
      }
    });
  }

  function buildEdges() {
    const edges = Array.from({ length: rows }, () => Array(columns));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        edges[row][column] = {
          top: row === 0 ? 0 : -edges[row - 1][column].bottom,
          right: column === columns - 1 ? 0 : (Math.random() < 0.5 ? 1 : -1),
          bottom: row === rows - 1 ? 0 : (Math.random() < 0.5 ? 1 : -1),
          left: column === 0 ? 0 : -edges[row][column - 1].right,
        };
      }
    }
    return edges;
  }

  function addHorizontalEdge(context, x1, x2, y, direction, tabDepth) {
    if (direction === 0) {
      context.lineTo(x2, y);
      return;
    }

    const width = x2 - x1;
    const x = (amount) => x1 + width * amount;
    const neckStart = x(0.35);
    const neckEnd = x(0.65);
    context.lineTo(neckStart, y);
    context.bezierCurveTo(
      x(0.39), y + direction * tabDepth * 0.35,
      x(0.4), y + direction * tabDepth,
      x(0.46), y + direction * tabDepth
    );
    context.bezierCurveTo(
      x(0.48), y + direction * tabDepth,
      x(0.48), y + direction * tabDepth * 1.38,
      x(0.5), y + direction * tabDepth * 1.38
    );
    context.bezierCurveTo(
      x(0.52), y + direction * tabDepth * 1.38,
      x(0.52), y + direction * tabDepth,
      x(0.54), y + direction * tabDepth
    );
    context.bezierCurveTo(
      x(0.6), y + direction * tabDepth,
      x(0.61), y + direction * tabDepth * 0.35,
      neckEnd, y
    );
    context.lineTo(x2, y);
  }

  function addVerticalEdge(context, x, y1, y2, direction, tabDepth) {
    if (direction === 0) {
      context.lineTo(x, y2);
      return;
    }

    const height = y2 - y1;
    const y = (amount) => y1 + height * amount;
    const neckStart = y(0.35);
    const neckEnd = y(0.65);
    context.lineTo(x, neckStart);
    context.bezierCurveTo(
      x + direction * tabDepth * 0.35, y(0.39),
      x + direction * tabDepth, y(0.4),
      x + direction * tabDepth, y(0.46)
    );
    context.bezierCurveTo(
      x + direction * tabDepth, y(0.48),
      x + direction * tabDepth * 1.38, y(0.48),
      x + direction * tabDepth * 1.38, y(0.5)
    );
    context.bezierCurveTo(
      x + direction * tabDepth * 1.38, y(0.52),
      x + direction * tabDepth, y(0.52),
      x + direction * tabDepth, y(0.54)
    );
    context.bezierCurveTo(
      x + direction * tabDepth, y(0.6),
      x + direction * tabDepth * 0.35, y(0.61),
      x, neckEnd
    );
    context.lineTo(x, y2);
  }

  function tracePiece(context, piece) {
    const left = tabSize;
    const top = tabSize;
    const right = left + cellWidth;
    const bottom = top + cellHeight;

    context.beginPath();
    context.moveTo(left, top);
    addHorizontalEdge(context, left, right, top, -piece.edges.top, tabSize);
    addVerticalEdge(context, right, top, bottom, piece.edges.right, tabSize);
    addHorizontalEdge(context, right, left, bottom, piece.edges.bottom, tabSize);
    addVerticalEdge(context, left, bottom, top, -piece.edges.left, tabSize);
    context.closePath();
  }

  function drawPiece(piece) {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = cellWidth + tabSize * 2;
    const height = cellHeight + tabSize * 2;
    const canvas = piece.canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      showError("เบราว์เซอร์นี้ไม่รองรับ Canvas ซึ่งจำเป็นสำหรับสร้างชิ้นส่วนภาพ");
      return;
    }

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.aspectRatio = `${width} / ${height}`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    tracePiece(context, piece);
    context.save();
    context.clip();
    context.drawImage(
      image,
      tabSize - piece.column * cellWidth,
      tabSize - piece.row * cellHeight,
      boardWidth,
      boardHeight
    );
    context.restore();
    tracePiece(context, piece);
    context.strokeStyle = "rgba(25, 34, 58, 0.68)";
    context.lineWidth = 1.4;
    context.lineJoin = "round";
    context.stroke();
  }

  function createPieces() {
    const edges = buildEdges();
    pieces = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const canvas = document.createElement("canvas");
        const piece = {
          column,
          row,
          edges: edges[row][column],
          canvas,
          element: document.createElement("div"),
          placed: false,
        };
        const element = piece.element;
        element.className = "piece";
        element.setAttribute("role", "listitem");
        element.setAttribute("aria-label", `ชิ้นส่วนที่ ${row * columns + column + 1}`);
        element.append(canvas);
        element.addEventListener("pointerdown", (event) => startDrag(event, piece));
        pieces.push(piece);
      }
    }

    createSlots();
    updateDimensions();
    restartGame();
  }

  function createSlots() {
    board.replaceChildren();
    board.setAttribute("aria-label", `ตำแหน่งวางชิ้นส่วน ${pieceCount} ตำแหน่ง`);
    tray.setAttribute("aria-label", `ชิ้นส่วน ${pieceCount} ชิ้นที่ยังไม่ได้วาง`);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const slot = document.createElement("div");
        slot.className = "board-slot";
        slot.dataset.column = String(column);
        slot.dataset.row = String(row);
        board.append(slot);
      }
    }
  }

  function updateCounts() {
    progressCount.textContent = `${placedCount} / ${pieceCount} ชิ้น`;
    trayCount.textContent = `${pieceCount - placedCount} ชิ้น`;
  }

  function updateMusicButton() {
    musicToggleButton.setAttribute("aria-pressed", String(musicEnabled));
    musicToggleLabel.textContent = musicEnabled ? "ปิดเพลง" : "เปิดเพลง";
  }

  async function startBackgroundMusic() {
    if (!musicEnabled || !selectedLevel) {
      return;
    }

    const requestId = ++musicRequestId;
    musicStatus.textContent = "";
    try {
      await backgroundMusic.play();
      if (!musicEnabled || requestId !== musicRequestId) {
        backgroundMusic.pause();
      }
    } catch (error) {
      if (requestId === musicRequestId && musicEnabled) {
        musicStatus.textContent = "เปิดเพลงไม่ได้ โปรดตรวจสอบไฟล์เพลงหรือกดเปิดเพลงอีกครั้ง";
      }
    }
  }

  function stopBackgroundMusic() {
    musicRequestId += 1;
    backgroundMusic.pause();
  }

  function playPieceSound(kind) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      musicStatus.textContent = "เบราว์เซอร์นี้ไม่รองรับเสียงเอฟเฟกต์";
      return;
    }

    if (!soundContext) {
      try {
        soundContext = new AudioContextConstructor();
      } catch (error) {
        musicStatus.textContent = "เปิดเสียงเอฟเฟกต์ไม่ได้ในเบราว์เซอร์นี้";
        return;
      }
    }

    const playTone = () => {
      const now = soundContext.currentTime;
      const oscillator = soundContext.createOscillator();
      const gain = soundContext.createGain();
      const isPlace = kind === "place";
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(isPlace ? 620 : 440, now);
      if (isPlace) {
        oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.09);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(isPlace ? 0.16 : 0.09, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isPlace ? 0.16 : 0.09));
      oscillator.connect(gain);
      gain.connect(soundContext.destination);
      oscillator.start(now);
      oscillator.stop(now + (isPlace ? 0.17 : 0.1));
    };

    if (soundContext.state === "suspended") {
      soundContext.resume().then(playTone).catch(() => {
        musicStatus.textContent = "เปิดเสียงเอฟเฟกต์ไม่ได้ โปรดตรวจสอบการตั้งค่าเสียงของเบราว์เซอร์";
      });
      return;
    }
    playTone();
  }

  function restartGame() {
    if (!imageReady) {
      return;
    }

    placedCount = 0;
    dragState = null;
    message.textContent = `วางชิ้นส่วนให้ครบทั้ง ${pieceCount} ชิ้นเพื่อประกอบภาพให้สมบูรณ์`;
    message.classList.remove("is-complete");
    pieces.forEach((piece) => {
      piece.placed = false;
      piece.element.className = "piece";
      piece.element.removeAttribute("style");
      piece.canvas.removeAttribute("style");
    });

    const shuffledPieces = [...pieces];
    for (let index = shuffledPieces.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledPieces[index], shuffledPieces[swapIndex]] = [shuffledPieces[swapIndex], shuffledPieces[index]];
    }
    tray.replaceChildren(...shuffledPieces.map((piece) => piece.element));
    updateCounts();
    updateDimensions();
  }

  function startGame(levelKey) {
    if (!imageReady) {
      showError("กำลังโหลดภาพ โปรดลองเลือกระดับอีกครั้ง");
      return;
    }

    selectedLevel = LEVELS[levelKey];
    if (!selectedLevel) {
      showError("เลือกระดับความยากที่ถูกต้องเพื่อเริ่มเกม");
      return;
    }

    columns = selectedLevel.columns;
    rows = selectedLevel.rows;
    pieceCount = selectedLevel.count;
    currentLevel.textContent = selectedLevel.name;
    levelSelect.hidden = true;
    gamePanel.hidden = false;
    errorMessage.hidden = true;
    restartButton.disabled = false;
    createPieces();
    startBackgroundMusic();
  }

  function returnToLevelSelect() {
    dragState = null;
    stopBackgroundMusic();
    gamePanel.hidden = true;
    levelSelect.hidden = false;
    if (imageReady) {
      difficultyButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  function positionPlacedPiece(piece) {
    piece.element.style.left = `${piece.column * cellWidth - tabSize}px`;
    piece.element.style.top = `${piece.row * cellHeight - tabSize}px`;
    piece.element.style.width = `${cellWidth + tabSize * 2}px`;
    piece.element.style.height = `${cellHeight + tabSize * 2}px`;
  }

  function startDrag(event, piece) {
    if (piece.placed || event.button !== 0 || dragState) {
      return;
    }

    event.preventDefault();
    playPieceSound("pickup");
    const rect = piece.element.getBoundingClientRect();
    dragState = {
      piece,
      pointerId: event.pointerId,
      offsetX: (cellWidth + tabSize * 2) / 2,
      offsetY: (cellHeight + tabSize * 2) / 2,
    };
    piece.element.classList.add("is-dragging");
    piece.element.style.left = `${rect.left}px`;
    piece.element.style.top = `${rect.top}px`;
    piece.element.style.width = `${cellWidth + tabSize * 2}px`;
    piece.element.style.height = `${cellHeight + tabSize * 2}px`;
    document.body.append(piece.element);
    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    dragState.piece.element.style.left = `${event.clientX - dragState.offsetX}px`;
    dragState.piece.element.style.top = `${event.clientY - dragState.offsetY}px`;
  }

  function endDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const piece = dragState.piece;
    const rect = piece.element.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const targetLeft = boardRect.left + piece.column * cellWidth - tabSize;
    const targetTop = boardRect.top + piece.row * cellHeight - tabSize;
    const snapDistance = Math.min(cellWidth, cellHeight) * 0.3;
    const isCorrectPosition = Math.abs(rect.left - targetLeft) <= snapDistance
      && Math.abs(rect.top - targetTop) <= snapDistance;

    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    dragState = null;

    if (isCorrectPosition) {
      piece.placed = true;
      piece.element.classList.remove("is-dragging");
      piece.element.classList.add("is-placed");
      board.append(piece.element);
      positionPlacedPiece(piece);
      playPieceSound("place");
      placedCount += 1;
      updateCounts();
      if (placedCount === pieceCount) {
        message.textContent = `ยอดเยี่ยม! ต่อจิ๊กซอว์หมดแล้ว ครบทั้ง ${pieceCount} ชิ้น`;
        message.classList.add("is-complete");
      }
      return;
    }

    piece.element.classList.remove("is-dragging");
    piece.element.className = "piece";
    piece.element.removeAttribute("style");
    tray.append(piece.element);
  }

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      startGame(button.dataset.level);
    });
  });
  restartButton.addEventListener("click", restartGame);
  changeLevelButton.addEventListener("click", returnToLevelSelect);
  musicToggleButton.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    updateMusicButton();
    if (musicEnabled) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
      musicStatus.textContent = "";
    }
  });
  backgroundMusic.addEventListener("ended", () => {
    if (musicEnabled && selectedLevel) {
      backgroundMusic.currentTime = 0;
      startBackgroundMusic();
    }
  });
  backgroundMusic.addEventListener("error", () => {
    if (musicEnabled) {
      musicStatus.textContent = "โหลดเพลงไม่สำเร็จ โปรดตรวจสอบไฟล์ background-music.mp3";
    }
  });
  window.addEventListener("resize", () => {
    if (imageReady) {
      updateDimensions();
    }
  });

  image.addEventListener("load", () => {
    imageReady = true;
    errorMessage.hidden = true;
    difficultyButtons.forEach((button) => {
      button.disabled = false;
    });
  });
  image.addEventListener("error", () => {
    showError("โหลดภาพ car.jpg ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกับหน้าเว็บ");
  });
  image.src = "car.jpg";
})();
