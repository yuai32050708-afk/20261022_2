// 保留從 CSV 讀取的完整題庫，以及本回合抽出的題目和選項。
let questionTable;
let questionBank = [];
let questions = [];
let choices = [];

// 記錄每個圖示題目目前放入的文字卡編號。
let placedChoices = [];
// 記錄目前拖曳中的文字卡和它原本的位置。
let dragging = null;
// 記錄按下的題目圖示與起點，用來區分點擊和拖曳。
let pressedIconIndex = null;
let pressStartX = 0;
let pressStartY = 0;
// 記錄作答結果與彩帶粒子。
let submitted = false;
let score = 0;
let confetti = [];
// 記錄全螢幕畫布上各個互動區域的座標。
let layout = {};

// 在畫布建立前先載入 CSV 題庫，讓資料可供本回合抽題使用。
function preload() {
  questionTable = loadTable("questions.csv", "csv", "header");
}

// 建立填滿視窗的畫布，並從 CSV 載入題庫後開始第一回合。
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Trebuchet MS, sans-serif");
  textAlign(CENTER, CENTER);
  questionBank = questionTable.getRows().map((row) => ({
    icon: row.getString("icon"),
    label: row.getString("label"),
    answer: row.getString("answer")
  }));
  startRound();
  calculateLayout();
}

// 每回合從題庫隨機抽六題，並打亂下方文字選項。
function startRound() {
  questions = shuffle([...questionBank]).slice(0, 6);
  choices = shuffle(questions.map((question, questionIndex) => ({
    id: questionIndex,
    questionIndex,
    text: question.answer
  })));
  choices.forEach((choice, index) => {
    choice.id = index;
  });
  placedChoices = Array(questions.length).fill(null);
}

// 每一幀重繪背景、題目、選項及互動狀態。
function draw() {
  background("#f5f3ec");
  drawDecorations();
  drawHeader();
  drawTargets();
  drawChoices();
  drawConfetti();
  if (submitted) drawResult();
  drawActionButton();
}

// 依視窗大小計算兩欄或三欄版面，避免卡片超出畫布。
function calculateLayout() {
  const compact = width < 700;
  const columns = compact ? 2 : 3;
  const padding = compact ? 18 : 34;
  const gap = compact ? 10 : 16;
  const headerHeight = compact ? 94 : 116;
  const buttonHeight = compact ? 52 : 58;
  const buttonBottom = compact ? 18 : 26;
  const targetTop = headerHeight + 4;
  const targetBottom = compact ? height * 0.61 : height * 0.56;
  const choiceTop = targetBottom + (compact ? 18 : 30);
  const choiceBottom = height - buttonHeight - buttonBottom - 24;
  const targetRows = Math.ceil(questions.length / columns);
  const targetCellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const targetCellHeight = (targetBottom - targetTop - gap * (targetRows - 1)) / targetRows;
  const choiceCellHeight = (choiceBottom - choiceTop - gap * 2) / 3;
  const buttonWidth = Math.min(compact ? 260 : 300, width - padding * 2);

  // 保留計算結果，供繪圖、點擊及拖曳共用。
  layout = {
    compact, columns, padding, gap, headerHeight, buttonHeight, buttonBottom,
    targetTop, targetBottom, choiceTop, choiceBottom, targetRows,
    targetCellWidth, targetCellHeight, choiceCellHeight, buttonWidth
  };
}

// 畫出淡色圓點背景，讓畫面更活潑但不影響題目閱讀。
function drawDecorations() {
  noStroke();
  fill("#e9e5d9");
  for (let x = 16; x < width; x += 34) {
    for (let y = 18; y < height; y += 34) circle(x, y, 2);
  }
}

// 顯示測驗標題、完成進度，以及拖曳提示。
function drawHeader() {
  const titleSize = layout.compact ? 25 : 34;
  textAlign(LEFT, CENTER);
  noStroke();
  fill("#25352e");
  textSize(titleSize);
  text("生活小達人", layout.padding, 34);
  fill("#758078");
  textSize(layout.compact ? 12 : 15);
  text("把每句生活好習慣，配對到正確圖示！", layout.padding + 1, 67);

  // 顯示已完成題數，鼓勵孩子完成所有配對。
  const completeCount = placedChoices.filter((choiceId) => choiceId !== null).length;
  textAlign(RIGHT, CENTER);
  fill("#557b67");
  textSize(layout.compact ? 13 : 15);
  text(`${completeCount} / 6 題`, width - layout.padding, 38);
  textAlign(CENTER, CENTER);
}

// 依網格繪製六個固定的圖示題目區。
function drawTargets() {
  for (let index = 0; index < questions.length; index += 1) {
    const bounds = targetBounds(index);
    const isFilled = placedChoices[index] !== null;
    const cardColor = isFilled ? "#e7f0e7" : "#fffefa";

    // 用柔和卡片底色標示可放置答案的區域。
    drawCard(bounds, cardColor, isFilled ? "#b5cbb8" : "#e1ded4");
    drawIcon(questions[index].icon, bounds.x + bounds.w / 2, bounds.y + bounds.h * 0.23, index);
    drawSoundBadge(bounds.x + bounds.w - 19, bounds.y + 20);

    // 題目名稱固定在插圖下方，與答案投放框分開排列。
    noStroke();
    fill("#34463c");
    textSize(layout.compact ? 14 : 18);
    text(questions[index].label, bounds.x + 6, bounds.y + bounds.h * 0.59, bounds.w - 12, 22);

    // 使用獨立底框標出答案位置，讓孩子清楚知道要把文字拖到哪裡。
    const dropZone = {
      x: bounds.x + 8,
      y: bounds.y + bounds.h * 0.73,
      w: bounds.w - 16,
      h: bounds.h * 0.24
    };
    stroke(isFilled ? "#b5cbb8" : "#d8d8ce");
    strokeWeight(1);
    fill(isFilled ? "#f6fbf6" : "#f7f6f1");
    rect(dropZone.x, dropZone.y, dropZone.w, dropZone.h, 7);

    // 將答案或提示文字限制在獨立框內，避免與題目名稱重疊。
    noStroke();
    if (isFilled) {
      fill("#52715e");
      textSize(layout.compact ? 12 : 14);
      text(wrapChineseText(choiceById(placedChoices[index]).text, dropZone.w - 10), dropZone.x + 4, dropZone.y + 2, dropZone.w - 8, dropZone.h - 4);
    } else {
      fill("#a9aea7");
      textSize(layout.compact ? 12 : 14);
      text("拖曳文字到這裡", dropZone.x + 4, dropZone.y + 2, dropZone.w - 8, dropZone.h - 4);
    }
  }
}

// 依序繪製尚未配對的文字選項，並保留足夠的觸控空間。
function drawChoices() {
  const available = choices.filter((choice) => !placedChoices.includes(choice.id));
  const columns = layout.columns;
  const gap = layout.gap;
  const cellWidth = (width - layout.padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = layout.choiceCellHeight;

  // 顯示下方區域標題，避免文字選項與題目圖示混淆。
  textAlign(LEFT, CENTER);
  noStroke();
  fill("#758078");
  textSize(layout.compact ? 14 : 16);
  text("文字選項", layout.padding, layout.choiceTop - 13);
  textAlign(CENTER, CENTER);

  // 讓文字卡依欄列排列，窄螢幕時自動切換為兩欄。
  available.forEach((choice, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const bounds = {
      x: layout.padding + column * (cellWidth + gap),
      y: layout.choiceTop + row * (cellHeight + gap),
      w: cellWidth,
      h: cellHeight
    };
    const isDragging = dragging && dragging.choiceId === choice.id;
    if (!isDragging) drawChoiceCard(choice, bounds, false);
  });

  // 將正在拖曳的答案畫在最上層，提供清楚的操作回饋。
  if (dragging) {
    drawChoiceCard(choiceById(dragging.choiceId), {
      x: mouseX - dragging.offsetX,
      y: mouseY - dragging.offsetY,
      w: dragging.width,
      h: dragging.height
    }, true);
  }
}

// 繪製單張文字卡，並在拖曳時增加陰影與高亮邊框。
function drawChoiceCard(choice, bounds, active) {
  drawingContext.save();
  if (active) {
    drawingContext.shadowColor = "rgba(37, 53, 46, 0.22)";
    drawingContext.shadowBlur = 16;
    drawingContext.shadowOffsetY = 6;
  }
  drawCard(bounds, active ? "#fff2c9" : "#ffffff", active ? "#d6ae58" : "#dfddd5");
  drawingContext.restore();
  noStroke();
  fill("#35453b");
  textSize(layout.compact ? 14 : 16);
  text(wrapChineseText(choice.text, bounds.w - 20), bounds.x + 8, bounds.y + 5, bounds.w - 16, bounds.h - 10);
}

// 依實際字寬逐字換行，支援沒有空格分隔的中文句子。
function wrapChineseText(value, maxWidth) {
  let lines = "";
  let currentLine = "";
  for (const character of value) {
    const candidate = currentLine + character;
    if (currentLine && textWidth(candidate) > maxWidth) {
      lines += `${currentLine}\n`;
      currentLine = character;
    } else {
      currentLine = candidate;
    }
  }
  return lines + currentLine;
}

// 繪製交卷按鈕，只有六題都放入答案時才可以使用。
function drawActionButton() {
  const complete = placedChoices.every((choiceId) => choiceId !== null);
  const button = {
    x: (width - layout.buttonWidth) / 2,
    y: height - layout.buttonHeight - layout.buttonBottom,
    w: layout.buttonWidth,
    h: layout.buttonHeight
  };
  layout.button = button;
  drawCard(button, complete ? "#527b61" : "#d5d7d0", complete ? "#527b61" : "#d5d7d0");
  noStroke();
  fill(complete ? "#ffffff" : "#858b83");
  textSize(layout.compact ? 15 : 17);
  text(submitted ? "再玩一次" : "交卷看成績", button.x, button.y + 1, button.w, button.h);
}

// 畫出簡潔的卡片圓角背景，統一題目與按鈕的視覺樣式。
function drawCard(bounds, color, borderColor) {
  rectMode(CORNER);
  stroke(borderColor);
  strokeWeight(1);
  fill(color);
  rect(bounds.x, bounds.y, bounds.w, bounds.h, 12);
}

// 以 p5.js 動態繪圖製作六種會輕微晃動的生活主題插圖。
function drawIcon(type, centerX, centerY, seed) {
  const bounce = sin(frameCount * 0.06 + seed * 1.4) * 2;
  const x = centerX;
  const y = centerY + bounce;
  const size = layout.compact ? Math.min(42, layout.targetCellHeight * 0.42) : 56;

  // 統一插圖線條，讓不同主題圖案保持一致的手繪感。
  push();
  translate(x, y);
  strokeJoin(ROUND);
  strokeCap(ROUND);
  stroke("#456c56");
  strokeWeight(3);
  noFill();

  // 依題目類型繪製肥皂、回收、牙刷、雨傘、熱鍋和行人號誌。
  if (type === "soap") {
    fill("#b9dce0");
    rect(-size * 0.55, -size * 0.22, size * 1.1, size * 0.58, 8);
    noStroke();
    fill("#ffffff");
    circle(-size * 0.22, -size * 0.08, 5);
    circle(size * 0.08, -size * 0.12, 4);
    circle(size * 0.32, -size * 0.02, 3);
  } else if (type === "recycle") {
    noFill();
    stroke("#4e8a66");
    strokeWeight(4);
    arc(0, 0, size * 1.35, size * 1.35, -2.4, -0.4);
    arc(0, 0, size * 1.35, size * 1.35, -0.3, 1.7);
    arc(0, 0, size * 1.35, size * 1.35, 1.8, 3.7);
    fill("#4e8a66");
    noStroke();
    triangle(size * 0.37, -size * 0.5, size * 0.62, -size * 0.4, size * 0.39, -size * 0.25);
    triangle(size * 0.25, size * 0.53, size * 0.04, size * 0.68, size * 0.02, size * 0.42);
    triangle(-size * 0.62, -size * 0.08, -size * 0.64, -size * 0.35, -size * 0.39, -size * 0.22);
  } else if (type === "tooth") {
    fill("#fffefa");
    beginShape();
    vertex(-size * 0.35, -size * 0.46);
    vertex(-size * 0.08, -size * 0.36);
    vertex(size * 0.12, -size * 0.42);
    vertex(size * 0.38, -size * 0.3);
    vertex(size * 0.3, size * 0.1);
    vertex(size * 0.15, size * 0.49);
    vertex(0, size * 0.34);
    vertex(-size * 0.16, size * 0.5);
    vertex(-size * 0.32, size * 0.1);
    endShape(CLOSE);
    stroke("#e3a963");
    line(-size * 0.52, -size * 0.34, size * 0.5, -size * 0.34);
    line(-size * 0.45, -size * 0.46, -size * 0.45, -size * 0.3);
    line(-size * 0.28, -size * 0.46, -size * 0.28, -size * 0.3);
    line(-size * 0.1, -size * 0.46, -size * 0.1, -size * 0.3);
  } else if (type === "umbrella") {
    fill("#f2cf72");
    arc(0, 0, size * 1.5, size * 1.25, PI, TWO_PI, CHORD);
    line(0, -size * 0.62, 0, size * 0.55);
    noFill();
    arc(size * 0.18, size * 0.53, size * 0.38, size * 0.38, 0, PI);
    line(-size * 0.5, -size * 0.02, -size * 0.27, size * 0.16);
    line(0, -size * 0.02, 0, size * 0.16);
    line(size * 0.5, -size * 0.02, size * 0.27, size * 0.16);
  } else if (type === "pot") {
    fill("#f2a06c");
    rect(-size * 0.48, -size * 0.1, size * 0.96, size * 0.55, 7);
    line(-size * 0.65, -size * 0.12, size * 0.65, -size * 0.12);
    line(-size * 0.2, -size * 0.25, size * 0.2, -size * 0.25);
    noFill();
    stroke("#dc8f54");
    arc(-size * 0.16, -size * 0.48, size * 0.2, size * 0.28, PI, TWO_PI);
    arc(size * 0.16, -size * 0.48, size * 0.2, size * 0.28, PI, TWO_PI);
  } else if (type === "crosswalk") {
    fill("#dce8dc");
    rect(-size * 0.62, -size * 0.35, size * 1.24, size * 0.7, 5);
    noStroke();
    fill("#ffffff");
    rect(-size * 0.43, -size * 0.25, size * 0.13, size * 0.5, 2);
    rect(-size * 0.13, -size * 0.25, size * 0.13, size * 0.5, 2);
    rect(size * 0.17, -size * 0.25, size * 0.13, size * 0.5, 2);
    stroke("#456c56");
    noFill();
    circle(0, -size * 0.57, size * 0.23);
  }
  pop();
}

// 在每個可朗讀的插圖旁畫出小喇叭提示。
function drawSoundBadge(centerX, centerY) {
  push();
  translate(centerX, centerY);
  noStroke();
  fill("#e8efe7");
  circle(0, 0, 24);
  fill("#527b61");
  rect(-7, -3, 4, 6, 1);
  triangle(-3, -4, 3, -8, 3, 8, -3, 4);
  noFill();
  stroke("#527b61");
  strokeWeight(1.5);
  arc(1, 0, 12, 12, -0.85, 0.85);
  arc(1, 0, 18, 18, -0.75, 0.75);
  pop();
}

// 依索引計算圖示題目卡的位置，供繪圖和拖放判定共用。
function targetBounds(index) {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: layout.padding + column * (layout.targetCellWidth + layout.gap),
    y: layout.targetTop + row * (layout.targetCellHeight + layout.gap),
    w: layout.targetCellWidth,
    h: layout.targetCellHeight
  };
}

// 回傳圖片周圍的點擊範圍，讓觸控操作不必精準點中小圖案。
function iconHitBounds(index) {
  const bounds = targetBounds(index);
  const iconSize = layout.compact ? Math.min(42, layout.targetCellHeight * 0.42) : 56;
  const hitSize = Math.min(bounds.w - 12, Math.max(62, iconSize * 1.6));
  const bounce = sin(frameCount * 0.06 + index * 1.4) * 2;
  return {
    x: bounds.x + (bounds.w - hitSize) / 2,
    y: bounds.y + bounds.h * 0.23 + bounce - hitSize / 2,
    w: hitSize,
    h: Math.min(bounds.h * 0.52, hitSize)
  };
}

// 依編號取得文字選項，供拖曳與結果計分使用。
function choiceById(choiceId) {
  return choices.find((choice) => choice.id === choiceId);
}

// 按下滑鼠或觸控時，判斷是否選中按鈕、文字卡或已放入的答案。
function mousePressed() {
  if (submitted) {
    if (inside(mouseX, mouseY, layout.button)) resetQuiz();
    return false;
  }

  // 記錄插圖點擊起點，放開時才確認是否要朗讀。
  pressedIconIndex = questions.findIndex((question, index) => inside(mouseX, mouseY, iconHitBounds(index)));
  pressStartX = mouseX;
  pressStartY = mouseY;

  // 答案完整時才接受交卷，避免未完成就計分。
  if (placedChoices.every((choiceId) => choiceId !== null) && inside(mouseX, mouseY, layout.button)) {
    submitQuiz();
    return false;
  }

  // 已放入的文字答案仍可再次拖曳，方便修正配對。
  for (let index = 0; index < placedChoices.length; index += 1) {
    if (placedChoices[index] === null) continue;
    const bounds = targetBounds(index);
    if (inside(mouseX, mouseY, bounds)) {
      dragging = { choiceId: placedChoices[index], sourceTarget: index, offsetX: bounds.w / 2, offsetY: bounds.h / 2, width: bounds.w, height: bounds.h };
      placedChoices[index] = null;
      return false;
    }
  }

  // 從尚未使用的文字卡中選取開始拖曳。
  const available = choices.filter((choice) => !placedChoices.includes(choice.id));
  const cellWidth = (width - layout.padding * 2 - layout.gap * (layout.columns - 1)) / layout.columns;
  available.forEach((choice, index) => {
    const bounds = {
      x: layout.padding + (index % layout.columns) * (cellWidth + layout.gap),
      y: layout.choiceTop + Math.floor(index / layout.columns) * (layout.choiceCellHeight + layout.gap),
      w: cellWidth,
      h: layout.choiceCellHeight
    };
    if (!dragging && inside(mouseX, mouseY, bounds)) {
      dragging = { choiceId: choice.id, sourceTarget: null, offsetX: mouseX - bounds.x, offsetY: mouseY - bounds.y, width: bounds.w, height: bounds.h };
    }
  });
  return false;
}

// 放開滑鼠或手指時，將文字放入目標區，或退回未配對選項。
function mouseReleased() {
  // 只有短距離點擊圖片才朗讀，拖曳操作不會觸發語音。
  const tappedIcon = pressedIconIndex !== null
    && dist(mouseX, mouseY, pressStartX, pressStartY) < 12
    && inside(mouseX, mouseY, iconHitBounds(pressedIconIndex));
  if (tappedIcon) speakQuestion(pressedIconIndex);
  pressedIconIndex = null;

  if (!dragging) return false;
  const destination = questions.findIndex((question, index) => inside(mouseX, mouseY, targetBounds(index)));
  if (destination >= 0) placedChoices[destination] = dragging.choiceId;
  dragging = null;
  return false;
}

// 以活潑的繁體中文語音朗讀題目名稱和生活常識句子。
function speakQuestion(index) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const question = questions[index];
  const utterance = new SpeechSynthesisUtterance(`叮咚！${question.label}！${question.answer}`);
  const voices = window.speechSynthesis.getVoices();
  const chineseVoice = voices.find((voice) => voice.lang.toLowerCase() === "zh-tw")
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"));
  utterance.lang = "zh-TW";
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.pitch = 1.3;
  utterance.rate = 0.92;
  utterance.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// 判斷座標是否位於指定矩形範圍內。
function inside(x, y, bounds) {
  return bounds && x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
}

// 計算正確配對數與百分比，並在高於六成時啟動彩帶。
function submitQuiz() {
  const correctCount = placedChoices.filter((choiceId, index) => choiceById(choiceId).questionIndex === index).length;
  score = Math.round((correctCount / questions.length) * 100);
  submitted = true;
  if (score > 60) {
    confetti = Array.from({ length: 150 }, () => ({
      x: random(width), y: random(-height, 0), size: random(5, 10),
      speed: random(2, 6), drift: random(-1.5, 1.5), color: random(["#e77856", "#e6bd52", "#5e9a74", "#5e91b8", "#d9789a"]),
      angle: random(TWO_PI), spin: random(-0.08, 0.08)
    }));
  }
}

// 顯示半透明成績畫面，並依分數提供鼓勵訊息。
function drawResult() {
  noStroke();
  fill(37, 53, 46, 190);
  rect(0, 0, width, height);
  fill("#fffefa");
  textSize(layout.compact ? 19 : 25);
  text(score > 60 ? "太棒了，生活小達人！" : "完成挑戰，再接再厲！", width / 2, height / 2 - 64);
  fill("#f2cf72");
  textSize(layout.compact ? 48 : 62);
  text(`${score}%`, width / 2, height / 2 + 2);
  fill("#ffffff");
  textSize(layout.compact ? 15 : 18);
  text(`答對 ${Math.round(score * questions.length / 100)} / 6 題`, width / 2, height / 2 + 54);
  fill("#d7e5d9");
  textSize(layout.compact ? 12 : 14);
  text("按下方按鈕再玩一次", width / 2, height / 2 + 88);
}

// 更新並繪製得分達標時的彩帶粒子效果。
function drawConfetti() {
  if (!submitted || score <= 60) return;
  noStroke();
  confetti.forEach((piece) => {
    push();
    translate(piece.x, piece.y);
    rotate(piece.angle);
    fill(piece.color);
    rectMode(CENTER);
    rect(0, 0, piece.size, piece.size * 0.55, 2);
    pop();
    piece.y += piece.speed;
    piece.x += piece.drift;
    piece.angle += piece.spin;
    if (piece.y > height + 12) {
      piece.y = random(-80, -10);
      piece.x = random(width);
    }
  });
}

// 清空作答和動畫狀態，讓孩子可以重新挑戰。
function resetQuiz() {
  startRound();
  dragging = null;
  submitted = false;
  score = 0;
  confetti = [];
}

// 視窗尺寸變更時同步調整全螢幕畫布和各區域排版。
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateLayout();
}
