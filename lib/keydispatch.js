// ここで利用しているキーコードは下記のブラウザ標準です。現在非推奨になってしまっているため、今後変更の可能性があります
// https://developer.mozilla.org/ja/docs/Web/API/KeyboardEvent/keyCode

const right = 39;
const left = 37;
const up = 38;
const down = 40;
const enter = 13;
const cancel = 27;
const shift = 16;
const ctrl = 17;
// const alt = 18;

const dirKeys = [right, left, up, down];

let downKeyCodes = { "main": [], "sub": [] };
const dirarea = document.getElementById("canvas");
const dirarea2 = document.getElementById("move-axis");

function dispatchKeyCode(upOrDown, keyCode, mainOrSub="main"){
  const canvasEl = document.getElementById("canvas");
  if(document.activeElement !== canvasEl){
    canvasEl.focus();
  }

  let keyEvent= new KeyboardEvent(upOrDown, {keyCode: keyCode, key:keyCode, code:keyCode});
  if(upOrDown == 'keydown'){
    downKeyCodes[mainOrSub].push(keyCode);
    Module.canvas.dispatchEvent(keyEvent);
  }else if (upOrDown == 'keyup'){
    downKeyCodes[mainOrSub] = downKeyCodes[mainOrSub].filter((k) => k != keyCode);
    Module.canvas.dispatchEvent(keyEvent);
  }
}
function cancelAllDirKeyCodes(mainOrSub){
  const downDirKeyCodes = [];
  downKeyCodes[mainOrSub].forEach((keyCode) => { 
    if(dirKeys.includes(keyCode)){
      downDirKeyCodes.push(keyCode);
    }
  });
  downDirKeyCodes.forEach((keyCode) => {
    dispatchKeyCode('keyup', keyCode, mainOrSub);
  });
}

function dispatchDirKeyWithDelta(dx, dy, mainOrSub){
  let angleUnit = 360.0 / 16.0;
  const vectorX = dx || 0.0;
  const vectorY = dy || 0.0;
  const degree = (-180.0 * (Math.atan2(vectorY, vectorX) / Math.PI) + 360.0) % 360;
  const force = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
  const threshold = 10;
  let nanameScale = 1.0;

  const downDirKeyCodes = downKeyCodes[mainOrSub].filter((keyCode) => dirKeys.includes(keyCode));
  if(downDirKeyCodes.length > 0){
    nanameScale = 0.5;
  }

  if(13 * angleUnit < degree || degree < 3 * angleUnit){
    if(!downKeyCodes[mainOrSub].includes(right) && force > threshold * nanameScale){
      if(downKeyCodes[mainOrSub].includes(left)){
        dispatchKeyCode('keyup', left, mainOrSub); 
      }
      dispatchKeyCode('keydown', right, mainOrSub);                 
    }
  }
  if(1 * angleUnit < degree && degree < 7 * angleUnit){
    if(!downKeyCodes[mainOrSub].includes(up) && force > threshold * nanameScale){
      if(downKeyCodes[mainOrSub].includes(down)){
        dispatchKeyCode('keyup', down, mainOrSub); 
      }
      dispatchKeyCode('keydown', up, mainOrSub);                 
    }
  }
  if(5 * angleUnit < degree && degree < 11 * angleUnit){
    if(!downKeyCodes[mainOrSub].includes(left) && force > threshold * nanameScale){
      if(downKeyCodes[mainOrSub].includes(right)){
        dispatchKeyCode('keyup', right, mainOrSub); 
      }
      dispatchKeyCode('keydown', left, mainOrSub);                 
    }
  }
  if(9 * angleUnit < degree && degree < 15 * angleUnit){
    if(!downKeyCodes[mainOrSub].includes(down) && force > threshold * nanameScale){
      if(downKeyCodes[mainOrSub].includes(up)){
        dispatchKeyCode('keyup', up, mainOrSub); 
      }
      dispatchKeyCode('keydown', down, mainOrSub);                 
    }
  }
  if(downKeyCodes[mainOrSub].includes(right) && Math.abs(vectorX) < threshold * nanameScale){
    dispatchKeyCode('keyup', right, mainOrSub);                 
  }
  if(downKeyCodes[mainOrSub].includes(up) && Math.abs(vectorY) < threshold * nanameScale){
    dispatchKeyCode('keyup', up, mainOrSub);                 
  }
  if(downKeyCodes[mainOrSub].includes(left) && Math.abs(vectorX) < threshold * nanameScale){
    dispatchKeyCode('keyup', left, mainOrSub);                 
  }
  if(downKeyCodes[mainOrSub].includes(down) && Math.abs(vectorY) < threshold * nanameScale){
    dispatchKeyCode('keyup', down, mainOrSub);                 
  }
  if(force < threshold){
    cancelAllDirKeyCodes(mainOrSub);
  }
}

// ============================================================================
// 【WOLF改造】方向キーの「後押し優先」発行層(tapモード専用)
//   ウディタ本体は方向キーが2方向押されたら後に押した方を有効とする方式のため、
//   合成キー発行もそれに合わせる。方向決定が変わったときは
//   「新しい方向セットに含まれない旧押下キーを必ず先に keyup → その後に新キーを keydown」
//   の順で発行し、エンジン側から見て新旧同時押しの曖昧状態を作らない。
//   - 斜めは「2キーのセット」(例: 右+上)として扱い、セット内の共存は正しい状態とする
//     (例: 右→右上 は keydown上 のみ / 右上→上 は keyup右 のみ / 右→上 は keyup右→keydown上)
//   - 【適用範囲の経緯】当初はdrag(Hammer Pan)のmain/sub両ハンドラにも
//     ヒステリシスなしの差分方式を適用したが、切り返し(右→左)の過渡でデルタが
//     小さく振れて上下ゾーンを横切り、上下キーが誤入力される退行が実機で確認された。
//     原作のヒステリシス(nanameScale 0.5・軸別解除しきい値)はこの誤入力を抑える
//     役割を持つため、dragは原作 dispatchDirKeyWithDelta の挙動を維持し、
//     後押し優先はtapモード(位置ベースでセクター確定・過渡振れなし)のみ適用する
//   - 物理キーボードの実キー入力はこの層を通らない(エンジン/WASM側の領分)ため対象外
// ============================================================================

// 「あるべき押下セット」との差分を 解除→押下 の順で適用する(tapモードが使用)
function applyDirKeySet(targetKeys, mainOrSub){
  const pressedDirKeys = downKeyCodes[mainOrSub].filter((keyCode) => dirKeys.includes(keyCode));
  pressedDirKeys.forEach((keyCode) => {          // (1) 旧方向の解除を先に発行
    if(!targetKeys.includes(keyCode)){
      dispatchKeyCode('keyup', keyCode, mainOrSub);
    }
  });
  targetKeys.forEach((keyCode) => {              // (2) 新方向の押下を後に発行
    if(!downKeyCodes[mainOrSub].includes(keyCode)){
      dispatchKeyCode('keydown', keyCode, mainOrSub);
    }
  });
}

const noSystemTouch = () => {
  const result = WoditorGameSettings?.noSystemTouch;
  return result;
}
let mouseRightButtonFlag = false;

function enableMouseRightButton(){
  mouseRightButtonFlag = true;
}
function disableMouseRightButton(){
  mouseRightButtonFlag = false;
}

const canvasEl = document.getElementById("canvas");
let touches = {};
canvasEl.addEventListener('touchstart', handleTouchStart, false);
canvasEl.addEventListener('touchmove', handleTouchMove, false);
canvasEl.addEventListener('touchend', handleTouchEnd, false);

function handleTouchStart(e) {
  if(noSystemTouch()){
    e.preventDefault(); 
    const newTouches = e.changedTouches;
    for (let i = 0; i < newTouches.length; i++) {
        const touch = newTouches[i];
        touches[touch.identifier] = {
            x: touch.pageX - canvas.offsetLeft,
            y: touch.pageY - canvas.offsetTop
        };
    }
    dispatchTouchMouseEvent(e);
  }
}

function handleTouchMove(e) {
  if(noSystemTouch()){
    e.preventDefault();
    const movedTouches = e.changedTouches;
    for (let i = 0; i < movedTouches.length; i++) {
        const touch = movedTouches[i];
        if (touches[touch.identifier]) {
            touches[touch.identifier] = {
                x: touch.pageX - canvas.offsetLeft,
                y: touch.pageY - canvas.offsetTop
            };
        }
    }
    dispatchTouchMouseEvent(e);
  }
}

function handleTouchEnd(e) {
  if(noSystemTouch()){
    e.preventDefault(); 
    const endedTouches = e.changedTouches;
    for (let i = 0; i < endedTouches.length; i++) {
        const touch = endedTouches[i];
        delete touches[touch.identifier];
    }
    dispatchTouchMouseEvent(e);
  }
}

function dispatchTouchMouseEvent(evt) {
  let type = null;
  let touch = null;
  let buttonType = mouseRightButtonFlag ? 1 : 0; 
  let buttonState = buttonType + 1;
  let touchIndex = 0;

  switch (evt.type) {
    case "touchstart":
      type = "mousedown";
      touch = evt.changedTouches[touchIndex];
      break;
    case "touchmove":
      type = "mousemove";
      touch = evt.changedTouches[touchIndex];
      break;
    case "touchend":
      type = "mouseup";
      buttonState = 0;
      touch = evt.changedTouches[touchIndex];
    case "touchcancel":
      type = "mouseup";
      buttonState = 0;
      touch = evt.changedTouches[touchIndex];
      break;
  }
  const newEvt = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    detail: 1,
    button: buttonType,
    buttons: buttonState,
    view: window,
    clientX: touch.clientX,
    clientY: touch.clientY,
    screenX: touch.screenX,
    screenY: touch.screenY,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    relatedTarget: null
  });

  canvasEl.dispatchEvent(newEvt); // マウスを投げる
}

const dirMC = new Hammer.Manager(dirarea);
const pan = new Hammer.Pan({ event: 'pan'});
dirMC.add([pan]);
dirMC.on('pan', function(e){
  if(!noSystemTouch()){
    e.preventDefault();
    // 【WOLF改造】dragは原作の dispatchDirKeyWithDelta のまま(ヒステリシス維持)。
    // 一時期ここを後押し優先の差分方式に置き換えたが、切り返し(右→左)の過渡で
    // 上下キーが入る退行が出たため原作挙動へ戻した。後押し優先はtapモードのみ適用
    dispatchDirKeyWithDelta(e.deltaX, e.deltaY, "main")
  }
});
dirMC.on('panend', function(e){
  if(!noSystemTouch()){
    e.preventDefault();
    cancelAllDirKeyCodes("main");
  }
});

const dirMC2 = new Hammer.Manager(dirarea2);
const pan2 = new Hammer.Pan({ event: 'pan'});
dirMC2.add([pan2]);
dirMC2.on('pan', function(e){
  // 【WOLF改造】即反応式(tap)モード中はドラッグ式(Hammer Pan)を無効化
  if(getDirPadMode() !== 'drag'){ return; }
  e.preventDefault();
  // 【WOLF改造】dragは原作の dispatchDirKeyWithDelta のまま(ヒステリシス維持)。
  // 切り返し時の上下誤入力防止を優先。後押し優先はtapモードのみ適用
  dispatchDirKeyWithDelta(e.deltaX, e.deltaY, "sub")
});
dirMC2.on('panend', function(e){
  // 【WOLF改造】即反応式(tap)モード中はドラッグ式(Hammer Pan)を無効化
  if(getDirPadMode() !== 'drag'){ return; }
  e.preventDefault();
  cancelAllDirKeyCodes("sub");
});

function dispatchClick(keyCode){
  dispatchKeyCode('keydown', keyCode, "main");
  setTimeout(function(){ dispatchKeyCode('keyup', keyCode, "main"); }, 100);
}

// ============================================================================
// 【WOLF改造】方向キーパッド(#move-axis)の「即反応式(tap)」モード追加
//   - 従来のドラッグ式(Hammer Pan・タッチ開始点からの移動量)はそのまま残し、
//     localStorage['woditor_dirpad_mode'] = 'drag'(既定) | 'tap' で切り替える
//   - tapモード: パッド要素の中心からタッチ位置へのベクトルで即座に8方向判定。
//     中心付近(短辺の約18%)はデッドゾーンとして全方向キー解除
//   - 方向ゾーンは非対称(丸型十字キー風): 上下左右 各60°・斜め 各30°。
//     十字の腕を素直に押せば確実に単方向、四隅を狙ったときだけ斜めになる。
//     角度→8方向に自前解決した上で、その方向の「あるべき押下キーセット」を
//     後押し優先の発行層 applyDirKeySet(解除→押下順を保証)で差分適用する
//   - tapモード中はJS生成のSVGオーバーレイで「十字キー(＋四隅の斜めくさび)」の見た目に切り替える
//   - canvas全面ドラッグ(dirarea="main"系)はこの改造の対象外・無変更
// ============================================================================
{
  const DIRPAD_MODE_KEY = 'woditor_dirpad_mode';
  const DIRPAD_DEADZONE_RATIO = 0.18; // パッド短辺に対するデッドゾーン半径の比率

  // ---- モード管理 ----
  function getDirPadMode(){
    try{
      return localStorage.getItem(DIRPAD_MODE_KEY) === 'tap' ? 'tap' : 'drag';
    }catch(e){
      return 'drag'; // localStorage不可の環境では既定のドラッグ式
    }
  }
  function toggleDirPadMode(){
    const next = getDirPadMode() === 'tap' ? 'drag' : 'tap';
    try{
      localStorage.setItem(DIRPAD_MODE_KEY, next);
    }catch(e){ /* 保存不可でも今セッションの見た目だけは切り替える */ }
    cancelAllDirKeyCodes("sub"); // モード切替時に押しっぱなし方向キーを解除
    applyDirPadMode();
  }

  // ---- 方向ゾーン定義(セガサターン式・非対称) ----
  // 上下左右は中心角±30°(計60°)と広く、斜めは残りの各30°と狭くする。
  // 十字の腕を押せば安定して単方向、四隅を意図的に狙ったときだけ斜めが出る。
  // ここを変えれば操作感を調整できる(45で8方向均等に戻る)
  const DIRPAD_CARDINAL_HALF_DEG = 30;
  // 8方向それぞれの「あるべき押下キーセット」。斜めは2キーのセットとして共存させる。
  // [0]=右,[1]=右上,[2]=上,...45°刻み反時計回り
  const DIRPAD_SECTOR_KEYS = [
    [right], [right, up], [up], [left, up], [left], [left, down], [down], [right, down]
  ];

  // 角度(度: 0=右,90=上,反時計回り)を非対称ゾーン表で8方向インデックスに解決する
  function resolveDirPadSector(degree){
    for(let i = 0; i < 8; i++){
      let diff = Math.abs(degree - i * 45);
      if(diff > 180){ diff = 360 - diff; }
      if(i % 2 === 0){
        // 上下左右: 境界(±30°ちょうど)は上下左右側に倒す
        if(diff <= DIRPAD_CARDINAL_HALF_DEG){ return i; }
      }else{
        // 斜め: 残りの帯(45°中心の±15°)
        if(diff < 45 - DIRPAD_CARDINAL_HALF_DEG){ return i; }
      }
    }
    return 0; // 全域をカバーしているため論理上到達しない
  }

  // ---- SVGオーバーレイ（サターン風十字キーの見た目）----
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let dirPadOverlayEl = null;      // 生成したSVG要素
  let dirPadArmEls = [];           // 十字の腕4本 [0]=右,[1]=上,[2]=左,[3]=下
  let dirPadArrowEls = [];         // 腕先端の▲矢印4個(同順)
  let dirPadWedgeEls = [];         // 四隅の斜めくさび4個 [0]=右上,[1]=左上,[2]=左下,[3]=右下
  let dirPadCenterEl = null;       // 中央デッドゾーンのくぼみ円
  let dirPadSavedBgImage = null;   // dragモード復帰用に退避した背景画像(moveaxis.png)

  // 押下中の腕は中心→外周へ金色(#d6c284系)が伸びるグラデーションで方向感を強調
  const HIGHLIGHT_FILL = 'url(#dirpad-hl-grad)';        // 上下左右押下時の腕
  const HIGHLIGHT_FILL_WEAK = 'url(#dirpad-hl-grad-weak)'; // 斜め押下時の隣接2腕(弱め)
  const HIGHLIGHT_ARROW = '#ffe9a8';
  const HIGHLIGHT_WEDGE = '#ffe9a8';
  const NORMAL_ARM = 'rgba(255, 255, 255, 0.10)';
  const NORMAL_ARROW = 'rgba(255, 255, 255, 0.65)';
  const NORMAL_WEDGE = 'rgba(255, 255, 255, 0.30)';
  const ARROW_HIGHLIGHT_OFFSET = 5; // ハイライト時に矢印を外側へ押し出す距離(viewBox単位)

  function buildDirPadOverlay(){
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';   // viewBox方式なのでパッドのリサイズに自動追従する
    svg.style.pointerEvents = 'none'; // 入力は下の#move-axis本体が受ける
    const cx = 100, cy = 100;
    const rOut = 96;   // パッド外周半径
    const rIn = 35;    // デッドゾーン半径(比率0.18*短辺 ≒ 0.36*外周 に対応)

    // ハイライト用グラデーション定義: 中心側は透明→外周へ向かって金色が濃くなる。
    // 腕の塗りに使うと「押した方向へ光が伸びる」表現になり方向感が伝わる。
    // 通常版(上下左右押下)と弱め版(斜め押下時に隣接2腕へ使う)の2種を用意
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradDefs = [
      ['dirpad-hl-grad', [
        [0.36, 'rgba(214, 194, 132, 0.10)'], // デッドゾーン境界: ほぼ透明
        [0.65, 'rgba(214, 194, 132, 0.38)'],
        [1.00, 'rgba(230, 210, 148, 0.68)']  // 外周: 最も明るい
      ]],
      ['dirpad-hl-grad-weak', [
        [0.36, 'rgba(214, 194, 132, 0.05)'],
        [0.65, 'rgba(214, 194, 132, 0.18)'],
        [1.00, 'rgba(230, 210, 148, 0.34)']
      ]]
    ];
    for(const [gradId, stops] of gradDefs){
      const grad = document.createElementNS(SVG_NS, 'radialGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.setAttribute('cx', cx); grad.setAttribute('cy', cy); grad.setAttribute('r', rOut);
      for(const [offset, color] of stops){
        const stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', color);
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }
    svg.appendChild(defs);

    // 半透明ダークの円形パッド本体(サターンパッドの「丸部分」)
    const base = document.createElementNS(SVG_NS, 'circle');
    base.setAttribute('cx', cx); base.setAttribute('cy', cy); base.setAttribute('r', rOut);
    base.setAttribute('fill', 'rgba(18, 22, 34, 0.60)');
    base.setAttribute('stroke', 'rgba(255, 255, 255, 0.30)');
    base.setAttribute('stroke-width', '1.5');
    svg.appendChild(base);

    dirPadArmEls = [];
    dirPadArrowEls = [];
    dirPadWedgeEls = [];

    // 十字パッドのプロポーション。腕の半幅32は中間半径60px付近で
    // 見込み角±28°≒当たり判定の上下左右ゾーン(±30°)とほぼ一致するように選んだ
    const armHW = 32;       // 腕の半幅
    const armOut = 90;      // 腕の外端半径
    const armIn = cx - armHW, armTop = cy - armHW, armBot = cy + armHW; // 中央プレート境界

    // 中央プレート(十字の交差部)。腕4本の根元をつなぐ土台で、ハイライト対象外
    const plate = document.createElementNS(SVG_NS, 'rect');
    plate.setAttribute('x', armIn); plate.setAttribute('y', armTop);
    plate.setAttribute('width', armHW * 2); plate.setAttribute('height', armHW * 2);
    plate.setAttribute('fill', NORMAL_ARM);
    svg.appendChild(plate);

    // 「右向き」の腕・矢印・くさびをテンプレートとして作り、rotateで4方向(または四隅)に配置する。
    // 回転グループ<g>の内側でtranslate(+x)すれば常に「外周方向への押し出し」になるため、
    // ハイライト時のオフセットが全方向で同じコードで済む
    const armD = 'M ' + (cx + armHW) + ' ' + armTop +
      ' L ' + (cx + armOut - 6) + ' ' + armTop +
      ' Q ' + (cx + armOut) + ' ' + armTop + ' ' + (cx + armOut) + ' ' + (armTop + 6) +
      ' L ' + (cx + armOut) + ' ' + (armBot - 6) +
      ' Q ' + (cx + armOut) + ' ' + armBot + ' ' + (cx + armOut - 6) + ' ' + armBot +
      ' L ' + (cx + armHW) + ' ' + armBot + ' Z'; // 角丸の腕(右向き)
    const arrowD = 'M ' + (cx + 77) + ' ' + cy +
      ' L ' + (cx + 60) + ' ' + (cy - 8) +
      ' L ' + (cx + 60) + ' ' + (cy + 8) + ' Z'; // 腕先端の▲(右向き)
    const wedgeD = 'M ' + (cx + 83) + ' ' + cy +
      ' L ' + (cx + 71) + ' ' + (cy - 5.5) +
      ' L ' + (cx + 71) + ' ' + (cy + 5.5) + ' Z'; // 四隅用の小さなくさび(右向き・控えめ)

    // 上下左右の腕と矢印: [0]=右,[1]=上,[2]=左,[3]=下
    // SVGのrotateは正=時計回り(y下向き座標)のため、上=-90°
    const cardinalRotates = [0, -90, 180, 90];
    for(const rot of cardinalRotates){
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', 'rotate(' + rot + ' ' + cx + ' ' + cy + ')');
      const arm = document.createElementNS(SVG_NS, 'path');
      arm.setAttribute('d', armD);
      arm.setAttribute('fill', NORMAL_ARM);
      arm.setAttribute('stroke', 'rgba(255, 255, 255, 0.28)');
      arm.setAttribute('stroke-width', '1.5');
      g.appendChild(arm);
      const arrow = document.createElementNS(SVG_NS, 'path');
      arrow.setAttribute('d', arrowD);
      arrow.setAttribute('fill', NORMAL_ARROW);
      g.appendChild(arrow);
      svg.appendChild(g);
      dirPadArmEls.push(arm);
      dirPadArrowEls.push(arrow);
    }

    // 四隅の斜めくさび: [0]=右上,[1]=左上,[2]=左下,[3]=右下。
    // 「押せる」ことだけ控えめに示す(主張しすぎない)
    const diagonalRotates = [-45, -135, 135, 45];
    for(const rot of diagonalRotates){
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', 'rotate(' + rot + ' ' + cx + ' ' + cy + ')');
      const wedge = document.createElementNS(SVG_NS, 'path');
      wedge.setAttribute('d', wedgeD);
      wedge.setAttribute('fill', NORMAL_WEDGE);
      g.appendChild(wedge);
      svg.appendChild(g);
      dirPadWedgeEls.push(wedge);
    }

    // 中央デッドゾーン: 十字中心の薄いくぼみ表現。
    // 十字形状だけで意味が通るため旧「MOVE」テキストは廃止
    dirPadCenterEl = document.createElementNS(SVG_NS, 'circle');
    dirPadCenterEl.setAttribute('cx', cx); dirPadCenterEl.setAttribute('cy', cy);
    dirPadCenterEl.setAttribute('r', rIn - 11);
    dirPadCenterEl.setAttribute('fill', 'rgba(0, 0, 0, 0.25)');
    dirPadCenterEl.setAttribute('stroke', 'rgba(255, 255, 255, 0.20)');
    dirPadCenterEl.setAttribute('stroke-width', '1');
    svg.appendChild(dirPadCenterEl);

    return svg;
  }

  function clearDirPadHighlight(){
    for(let i = 0; i < dirPadArmEls.length; i++){
      dirPadArmEls[i].setAttribute('fill', NORMAL_ARM);
      dirPadArrowEls[i].setAttribute('fill', NORMAL_ARROW);
      dirPadArrowEls[i].removeAttribute('transform'); // 外側オフセット解除
    }
    for(let i = 0; i < dirPadWedgeEls.length; i++){
      dirPadWedgeEls[i].setAttribute('fill', NORMAL_WEDGE);
      dirPadWedgeEls[i].removeAttribute('transform');
    }
    if(dirPadCenterEl){
      dirPadCenterEl.setAttribute('fill', 'rgba(0, 0, 0, 0.25)');
    }
  }

  // sectorIndex: 0=右,1=右上,...,7=右下(45度刻み)。-1=中央デッドゾーン押下中
  function highlightDirPadSector(sectorIndex){
    clearDirPadHighlight();
    if(sectorIndex < 0){
      if(dirPadCenterEl){
        dirPadCenterEl.setAttribute('fill', 'rgba(214, 194, 132, 0.25)');
      }
      return;
    }
    // 要素は回転済み<g>の内側にあるため、translate(+x)が常に「外周方向への押し出し」になる
    const pushOut = 'translate(' + ARROW_HIGHLIGHT_OFFSET + ' 0)';
    if(sectorIndex % 2 === 0){
      // 上下左右: その腕全体が金色グラデーションで外周方向に光り、▲を明色化＋押し出し
      const armIdx = sectorIndex / 2; // 0=右,1=上,2=左,3=下
      dirPadArmEls[armIdx].setAttribute('fill', HIGHLIGHT_FILL);
      dirPadArrowEls[armIdx].setAttribute('fill', HIGHLIGHT_ARROW);
      dirPadArrowEls[armIdx].setAttribute('transform', pushOut);
    }else{
      // 斜め: 隣接する2腕を弱めに光らせ、四隅のくさびを明るく押し出して
      // 「右上に入っている」等が一目で分かるようにする
      const wedgeIdx = (sectorIndex - 1) / 2;          // 0=右上,1=左上,2=左下,3=右下
      const armIdxA = wedgeIdx;                        // 反時計回り側の腕(右上なら右)
      const armIdxB = (wedgeIdx + 1) % 4;              // 時計回り側の腕(右上なら上)
      dirPadArmEls[armIdxA].setAttribute('fill', HIGHLIGHT_FILL_WEAK);
      dirPadArmEls[armIdxB].setAttribute('fill', HIGHLIGHT_FILL_WEAK);
      dirPadWedgeEls[wedgeIdx].setAttribute('fill', HIGHLIGHT_WEDGE);
      dirPadWedgeEls[wedgeIdx].setAttribute('transform', pushOut);
    }
  }

  // モードに応じて #move-axis の見た目を切り替える
  function applyDirPadMode(){
    if(!dirarea2){ return; }
    const mode = getDirPadMode();
    if(mode === 'tap'){
      if(!dirPadOverlayEl){
        dirPadOverlayEl = buildDirPadOverlay();
      }
      // オーバーレイ配置のための最小限のスタイル調整(テンプレCSSは変更しない)
      if(getComputedStyle(dirarea2).position === 'static'){
        dirarea2.style.position = 'relative';
      }
      dirarea2.style.overflow = 'hidden';
      if(dirPadSavedBgImage === null){
        dirPadSavedBgImage = dirarea2.style.backgroundImage || ''; // インライン分を退避
      }
      dirarea2.style.backgroundImage = 'none'; // moveaxis.png(Drag表記)を隠す
      if(dirPadOverlayEl.parentNode !== dirarea2){
        dirarea2.appendChild(dirPadOverlayEl);
      }
    }else{
      // dragモード: オーバーレイを外し、従来のmoveaxis.png表示に戻す
      if(dirPadOverlayEl && dirPadOverlayEl.parentNode){
        dirPadOverlayEl.parentNode.removeChild(dirPadOverlayEl);
      }
      if(dirPadSavedBgImage !== null){
        dirarea2.style.backgroundImage = dirPadSavedBgImage; // ''ならCSS指定(moveaxis.png)に戻る
        dirPadSavedBgImage = null;
      }
    }
    updateDirPadModeButton();
  }

  // 設定ポップアップのトグルボタン表記更新(ボタンはポータル側テンプレが提供。無ければ何もしない)
  function updateDirPadModeButton(){
    const buttonEl = document.getElementById('dirpad-mode');
    if(!buttonEl){ return; }
    buttonEl.value = getDirPadMode() === 'tap' ? '方向キー: 十字キー' : '方向キー: ドラッグ式'; // 方向キーは移動以外にも使うため「移動:」表記をやめた
  }

  // ---- tapモードの入力処理(タッチ＋マウス) ----
  // 【マルチタッチ対応】タッチを identifier ごとのスタックで管理し、
  // 「最後に開始したタッチ(スタック最上位)」が常に方向を支配する
  // (キーボードの後押し優先と同じ操作感。後の指を離すと先の指の方向に戻る)。
  // リスナーはパッド要素(#move-axis)自体に張っているため、touchmove/touchend の
  // changedTouches には「パッド上で開始したタッチ」しか来ない(パッド外開始の指は混入しない)
  let tapPadTouches = [];       // {id, x, y} を開始順に保持。末尾=最後に開始した指=有効
  let tapPadMouseDown = false;  // マウス押下中フラグ(マウスは従来どおり単一ポインタ)

  function tapPadTopTouch(){
    return tapPadTouches.length > 0 ? tapPadTouches[tapPadTouches.length - 1] : null;
  }

  // スタック最上位のタッチの現在座標で方向を決め直す。残存タッチが無ければ全解除
  function refreshTapPadDirection(){
    const top = tapPadTopTouch();
    if(!top){
      releaseTapPad();
      return;
    }
    // デッドゾーン判定も最上位タッチに対して適用される(handleTapPadPoint内)。
    // 最上位がデッドゾーン内なら方向なし＝下位の指の方向には落ちない
    handleTapPadPoint(top.x, top.y);
  }

  function handleTapPadPoint(clientX, clientY){
    const rect = dirarea2.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2.0);
    const dy = clientY - (rect.top + rect.height / 2.0);
    const deadRadius = Math.min(rect.width, rect.height) * DIRPAD_DEADZONE_RATIO;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if(dist < deadRadius){
      // 中央デッドゾーン: 何も押さない(押下中キーは解除)
      cancelAllDirKeyCodes("sub");
      highlightDirPadSector(-1);
    }else{
      // 方向決定は非対称ゾーン表(上下左右60°/斜め30°)で自前解決し、
      // その方向の「あるべき押下キーセット」を後押し優先の発行層(applyDirKeySet)で
      // 差分適用する(旧方向の解除→新方向の押下の順が保証される)
      const degree = (-180.0 * (Math.atan2(dy, dx) / Math.PI) + 360.0) % 360;
      const sector = resolveDirPadSector(degree);
      applyDirKeySet(DIRPAD_SECTOR_KEYS[sector], "sub");
      highlightDirPadSector(sector);
    }
  }

  function releaseTapPad(){
    cancelAllDirKeyCodes("sub"); // 全方向キー解除
    clearDirPadHighlight();
    tapPadTouches = [];
    tapPadMouseDown = false;
  }

  if(dirarea2){
    // タッチ操作(即反応: touchstartの時点で方向決定。identifierスタックで後押し優先)
    dirarea2.addEventListener('touchstart', function(e){
      if(getDirPadMode() !== 'tap'){ return; }
      e.preventDefault(); // スクロール・マウスイベント合成の抑止
      for(let i = 0; i < e.changedTouches.length; i++){
        const touch = e.changedTouches[i];
        tapPadTouches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
      }
      refreshTapPadDirection(); // 最後に開始した指の位置で方向を上書き
    }, { passive: false });

    dirarea2.addEventListener('touchmove', function(e){
      if(getDirPadMode() !== 'tap'){ return; }
      e.preventDefault();
      // 全タッチの座標を保持しつつ、方向の再計算は最上位(=最後に開始した指)が
      // 動いたときだけ行う。下位の指の移動は保持のみで無視する
      let topMoved = false;
      const top = tapPadTopTouch();
      for(let i = 0; i < e.changedTouches.length; i++){
        const touch = e.changedTouches[i];
        for(let j = 0; j < tapPadTouches.length; j++){
          if(tapPadTouches[j].id === touch.identifier){
            tapPadTouches[j].x = touch.clientX;
            tapPadTouches[j].y = touch.clientY;
            if(top && tapPadTouches[j] === top){ topMoved = true; }
          }
        }
      }
      if(topMoved){
        refreshTapPadDirection(); // 指を滑らせての方向変更にも対応
      }
    }, { passive: false });

    const onTapPadTouchEnd = function(e){
      if(getDirPadMode() !== 'tap'){ return; }
      e.preventDefault();
      for(let i = 0; i < e.changedTouches.length; i++){
        const endedId = e.changedTouches[i].identifier;
        tapPadTouches = tapPadTouches.filter((t) => t.id !== endedId);
      }
      // 最上位を離した場合は次に新しい残存タッチの現在座標で方向復帰、
      // 残存タッチが無ければ全解除(refreshTapPadDirection内で分岐)
      refreshTapPadDirection();
    };
    dirarea2.addEventListener('touchend', onTapPadTouchEnd, { passive: false });
    dirarea2.addEventListener('touchcancel', onTapPadTouchEnd, { passive: false });

    // マウス操作(PCでの動作確認用。押下中のみ反応)
    dirarea2.addEventListener('mousedown', function(e){
      if(getDirPadMode() !== 'tap'){ return; }
      e.preventDefault();
      tapPadMouseDown = true;
      handleTapPadPoint(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', function(e){
      if(getDirPadMode() !== 'tap' || !tapPadMouseDown){ return; }
      handleTapPadPoint(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function(e){
      if(getDirPadMode() !== 'tap' || !tapPadMouseDown){ return; }
      releaseTapPad();
    });
  }

  // グローバル公開(ポータル側テンプレの typeof チェック・onclick から呼ばれる)
  window.getDirPadMode = getDirPadMode;
  window.toggleDirPadMode = toggleDirPadMode;
  window.updateDirPadModeButton = updateDirPadModeButton;

  // 起動時: 保存済みモードを反映(このスクリプトはDOM構築後に読み込まれる前提だが念のためガード)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyDirPadMode);
  }else{
    applyDirPadMode();
  }
}