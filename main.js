const config = {
    type: Phaser.AUTO,
    parent: 'game-container', 

    width: 1440,
    height: 1024,

    transparent: true, 
    backgroundColor: '#000000',
    scale: {

        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,

        min: { width: 360, height: 256 },
        max: { width: 2880, height: 2048 }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

const GAME_FONT = '"Luckiest Guy", cursive';

const GRID_LAYOUT = {
    startX: 380, startY: 505, gap: 125
};

const TILE_CONFIG = {
    size: 86, scale: 1.1
};

const SLOT_CONFIG = { scale: 0.8 };

const SPEAKER_SCALE = 0.1;

const HINT_CONFIG = {
    color: 0x2abfcd, alpha: 1, padding: 0, cornerRadius: 5
};

const SIDEBAR_CONFIG = {
    bgX: 970, bgY: 380, width: 150, height: 550, shadowOffset: 15,

    keepTextX: 1045, keepTextY: 525, keepSlotX: 1045, keepSlotY: 450,
    keepBgColor: 0x4DE1B5, 

    keepDarkColor: '#08925A', 

    nextSlotX: 950, nextSlotY: 650, queueGap: 100,

    trashLabelX: 1045, trashLabelY: 780,
    trashX: 1045, trashY: 860,
    trashBgWidth: 100, trashBgHeight: 100, 
    trashBgColor: 0xff4444, 

    trashDarkColor: '#FF3131', 

    trashIconOffsetY: -20, trashTextOffsetY: 25,
};

const COLORS = {
    shadow: 0x000000,
    white: 0xffffff,
    sidebarFill: 0xFED451,
    sidebarBorder: 0xF6AE77,
    sidebarLine: 0xB25919,
    hint: 0x2abfcd
};

let grid = Array(16).fill(null);
let queue = [];
let undoStack = []; 
let score = 0;
let bestScore = 0; 
let level = 1;
let trashCount = 10;
let keepTileData = null; 
let hintsActive = false; 
let difficulty = 1; 
let isGameOver = false;
let isMuted = false;
let isMerging = false;

let scoreText, levelText, trashText;
let keepContainer, currentDraggable;
let stackVisuals = [], slotImages = []; 
let hintGraphics; 
let gameOverContainer, finalScoreText, startPopupContainer, speakerBtn; 

let bgm;
let sfx = {};

function preload() {
    this.load.image('cat', 'assets/images/Cat.png');
    this.load.image('cat_start', 'assets/images/cat2.png');
    this.load.image('badge', 'assets/images/Levels and Score.png');
    this.load.image('slot', 'assets/images/Placement_Box.png');
    this.load.image('trash_icon', 'assets/images/trash.png');
    this.load.image('speaker', 'assets/images/speaker.png');
    this.load.image('speaker_mute', 'assets/images/speaker_mute.png');

    this.load.image('tile_blue', 'assets/images/blue.png');
    this.load.image('tile_orange', 'assets/images/orange.png');
    this.load.image('tile_pink', 'assets/images/pink.png');
    this.load.image('tile_purple', 'assets/images/purpule.png'); 
    this.load.image('tile_red', 'assets/images/red.png');

    this.load.audio('bgm', 'assets/audio/bgm.mp3');
    this.load.audio('drag', 'assets/audio/drag.mp3');
    this.load.audio('drop', 'assets/audio/drop.mp3');
    this.load.audio('keep', 'assets/audio/keep.mp3');
    this.load.audio('merge', 'assets/audio/merge.mp3');
    this.load.audio('gameover', 'assets/audio/gameover.mp3');
    this.load.audio('restart', 'assets/audio/restart.mp3');
    this.load.audio('undo', 'assets/audio/undo.mp3');
    this.load.audio('click', 'assets/audio/click.mp3');
}

function create() {
    const scene = this;

    setupAudio(scene);
    setupUI(scene); 
    createStartScreen(scene);

    scene.input.on('dragstart', (pointer, gameObject) => {
        if (!isGameOver && currentDraggable) {
            playSound('drag');
        }
    });

    scene.input.on('drag', function (pointer, gameObject, dragX, dragY) {
        if (isGameOver) return; 
        gameObject.x = dragX;
        gameObject.y = dragY;
    });

    scene.input.on('dragend', function (pointer, gameObject) {
        if (isGameOver) return;
        safeClearHints();

        if (gameObject === keepContainer) {
            handleKeepDragEnd(scene, gameObject);
            return;
        }

        if (Phaser.Math.Distance.Between(gameObject.x, gameObject.y, SIDEBAR_CONFIG.trashX, SIDEBAR_CONFIG.trashY) < 80) {
            handleTrashDrop(scene, gameObject);
            return;
        }

        if (Phaser.Math.Distance.Between(gameObject.x, gameObject.y, SIDEBAR_CONFIG.keepSlotX, SIDEBAR_CONFIG.keepSlotY) < 60) {
            saveState(); 
            handleHandToKeep(scene, gameObject);
            return; 
        }

        if (isValidDrop(gameObject)) {
            saveState(); 
            if (tryDropOnGrid(scene, gameObject)) {
                gameObject.disableInteractive();
                gameObject.destroy();
                spawnNextTile(scene);
            } else {
                undoStack.pop();
                returnToStack(gameObject);
            }
        } else {
            returnToStack(gameObject);
            if (hintsActive && gameObject.getData('value')) showHintsFor(gameObject.getData('value'));
            checkGameOver(scene);
        }
    });

    scene.input.keyboard.on('keydown-Z', () => undo(scene));
    scene.input.keyboard.on('keydown-R', () => startNewGame(scene));
    scene.input.keyboard.on('keydown-G', () => toggleHints());
    scene.input.keyboard.on('keydown-M', () => toggleSoundGlobal(scene));

    scene.input.keyboard.on('keydown-ONE', () => setDifficulty(1));
    scene.input.keyboard.on('keydown-TWO', () => setDifficulty(2));
    scene.input.keyboard.on('keydown-THREE', () => setDifficulty(3));
}

function update() { }

function createStartScreen(scene) {
    if (startPopupContainer) startPopupContainer.destroy();

    startPopupContainer = scene.add.container(720, 512);
    startPopupContainer.setDepth(2000);

    let overlay = scene.add.rectangle(0, 0, 600, 600, 0xffa592, 0.7);
    overlay.disableInteractive(); 

    let catImage = scene.add.image(0, -50, 'cat_start');

    let btnContainer = scene.add.container(0, 0);

    let btnGraphics = scene.add.graphics();
    btnGraphics.fillStyle(0x4DE1B5, 1);
    btnGraphics.fillRoundedRect(-150, -50, 300, 180, 20);

    let btnText = scene.add.text(0, 40, "PLAY GAME", {
        fontSize: '48px',
        fontFamily: GAME_FONT,
        color: '#ffffff'
    }).setOrigin(0.5);

    let btnZone = scene.add.zone(0, 0, 300, 100)
        .setInteractive({ useHandCursor: true });

    btnZone.setDepth(1); 

    btnContainer.add([btnGraphics, btnText, btnZone]);

    startPopupContainer.add([
        overlay,
        catImage,
        btnContainer
    ]);

    btnZone.once('pointerdown', () => {
        playSound('click');

        scene.tweens.add({
            targets: startPopupContainer,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                startPopupContainer.destroy();
                startNewGame(scene);
            }
        });
    });
}

function setupAudio(scene) {
    bgm = scene.sound.add('bgm', { loop: true, volume: 0.3 });
    sfx['drag'] = scene.sound.add('drag', { volume: 0.6 });
    sfx['drop'] = scene.sound.add('drop', { volume: 0.8 });
    sfx['keep'] = scene.sound.add('keep', { volume: 0.8 });
    sfx['merge'] = scene.sound.add('merge', { volume: 1.0 });
    sfx['gameover'] = scene.sound.add('gameover', { volume: 0.8 });
    sfx['restart'] = scene.sound.add('restart', { volume: 0.8 });
    sfx['undo'] = scene.sound.add('undo', { volume: 0.8 });
    sfx['click'] = scene.sound.add('click', { volume: 0.8 });
}

function playSound(key) {
    if (sfx[key]) sfx[key].play();
}

function toggleSoundGlobal(scene) {
    isMuted = !isMuted;

    if (bgm) {
        bgm.setMute(isMuted);
    }

    if (speakerBtn) {
        speakerBtn.setTexture(isMuted ? 'speaker_mute' : 'speaker');
        scene.tweens.add({
            targets: speakerBtn,
            scaleX: SPEAKER_SCALE * 0.8, scaleY: SPEAKER_SCALE * 0.8,
            duration: 100, yoyo: true, ease: 'Quad.out'
        });
    }

    playSound('click');
}

function startNewGame(scene) {
    if (gameOverContainer) gameOverContainer.setVisible(false);

    if (speakerBtn) {
        speakerBtn.destroy();
        speakerBtn = null;
    }

    playSound('restart');

    let savedBest = localStorage.getItem('justDivide_bestScore');
    bestScore = savedBest ? parseInt(savedBest) : 0;

    grid.forEach(c => { if (c) c.obj.destroy(); });
    grid = Array(16).fill(null);
    undoStack = [];
    queue = [];
    score = 0;
    level = 1;
    trashCount = 10;
    keepTileData = null;
    hintsActive = false;
    isGameOver = false;
    isMerging = false; 

    if (currentDraggable) currentDraggable.destroy();
    stackVisuals.forEach(o => o.destroy());
    stackVisuals = [];
    slotImages = [];

    scene.children.removeAll(); 

    hintGraphics = scene.add.graphics().setDepth(5);
    setupUI(scene);
    createGameOverUI(scene); 

    if (bgm && !bgm.isPlaying) {
        bgm.play();
    }
    if (bgm) bgm.setMute(isMuted);

    replenishQueue();
    spawnNextTile(scene);
}

function addScore(points) {
    score += points;
    scoreText.setText('SCORE ' + score);
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('justDivide_bestScore', bestScore);
    }
}

function checkGameOver(scene) {
    if (isMerging) return;

    for (let i = 0; i < 16; i++) {
        if (grid[i] === null) return;
    }

    triggerGameOver(scene);
}

function triggerGameOver(scene) {
    if (isGameOver) return;
    isGameOver = true;
    console.log("GAME OVER");

    if (bgm) bgm.stop();
    playSound('gameover');

    if (currentDraggable) currentDraggable.disableInteractive();
    if (keepContainer) keepContainer.disableInteractive();

    if (finalScoreText) {
        finalScoreText.setText("SCORE: " + score + "\nBEST: " + bestScore);
    }

    if (gameOverContainer) {
        gameOverContainer.setDepth(1000);
        gameOverContainer.setVisible(true);
    }
}

function spawnNextTile(scene) {
    replenishQueue();
    let data = queue.shift();
    updateStackVisuals(scene);

    let tile = createTileContainer(
        scene, 
        SIDEBAR_CONFIG.nextSlotX, 
        SIDEBAR_CONFIG.nextSlotY, 
        data.texture, 
        data.value
    );

    tile.setScale(0);
    tile.setDepth(100);
    tile.setInteractive();
    scene.input.setDraggable(tile);
    currentDraggable = tile; 

    scene.tweens.add({
        targets: tile,
        scaleX: TILE_CONFIG.scale,
        scaleY: TILE_CONFIG.scale,
        duration: 300,
        ease: 'Back.out',
        onComplete: () => {
            if (hintsActive) showHintsFor(data.value);
        }
    });

    checkGameOver(scene);
}

function handleKeepDragEnd(scene, gameObject) {
    if (isValidDrop(gameObject)) {
        saveState();
        if (tryDropOnGrid(scene, gameObject)) {
            keepTileData = null;
            updateKeepVisuals(scene);
            gameObject.x = SIDEBAR_CONFIG.keepSlotX;
            gameObject.y = SIDEBAR_CONFIG.keepSlotY;
        } else {
            undoStack.pop();
            gameObject.x = SIDEBAR_CONFIG.keepSlotX;
            gameObject.y = SIDEBAR_CONFIG.keepSlotY;
        }
    } else {
        gameObject.x = SIDEBAR_CONFIG.keepSlotX;
        gameObject.y = SIDEBAR_CONFIG.keepSlotY;
    }
    if (hintsActive && currentDraggable) showHintsFor(currentDraggable.getData('value'));
}

function handleTrashDrop(scene, gameObject) {
    if (trashCount > 0) {
        saveState();
        playSound('drop'); 
        trashCount--;
        trashText.setText('x' + trashCount);
        gameObject.disableInteractive();

        scene.tweens.add({
            targets: gameObject,
            x: SIDEBAR_CONFIG.trashX,
            y: SIDEBAR_CONFIG.trashY,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                gameObject.destroy();
                spawnNextTile(scene);
            }
        });
    } else {
        returnToStack(gameObject);
        if (hintsActive && gameObject.getData('value')) showHintsFor(gameObject.getData('value'));
    }
}

function handleHandToKeep(scene, handTile) {
    let handData = { value: handTile.getData('value'), texture: handTile.list[0].texture.key };
    if (keepTileData === null) {
        keepTileData = handData;
        updateKeepVisuals(scene);
        handTile.destroy();
        spawnNextTile(scene);
    } else {
        let temp = keepTileData;
        keepTileData = handData;
        updateKeepVisuals(scene);
        updateTileVisuals(handTile, temp.value, temp.texture);
        returnToStack(handTile);
        if (hintsActive) showHintsFor(temp.value);
        checkGameOver(scene);
    }
    playSound('keep');
}

function createGridTile(scene, index, x, y, value, texture) {
    playSound('drop');
    restoreGridTile(scene, index, value, texture);
    checkMerges(index, scene);
    checkLevelUp();
}

function restoreGridTile(scene, index, value, texture) {
    const { startX, startY, gap } = GRID_LAYOUT;
    let col = index % 4; 
    let row = Math.floor(index / 4);
    let x = startX + (col * gap); 
    let y = startY + (row * gap);

    let tile = createTileContainer(scene, x, y, texture, value);
    tile.setDepth(10);
    grid[index] = { value: value, obj: tile };
}

function checkMerges(index, scene) {
    let currentTile = grid[index];
    if (!currentTile) return;

    let row = Math.floor(index / 4);
    let col = index % 4;
    let neighbors = [{ r: row - 1, c: col }, { r: row + 1, c: col }, { r: row, c: col - 1 }, { r: row, c: col + 1 }];

    for (let pos of neighbors) {
        if (pos.r >= 0 && pos.r < 4 && pos.c >= 0 && pos.c < 4) {
            let nIndex = pos.r * 4 + pos.c;
            let neighbor = grid[nIndex];
            if (neighbor) {
                let match = false;
                let divide = false;

                if (neighbor.value === currentTile.value) match = true;

                let big = Math.max(currentTile.value, neighbor.value);
                let small = Math.min(currentTile.value, neighbor.value);
                if (!match && big % small === 0) divide = true;

                if (match || divide) {
                    isMerging = true; 
                    playSound('merge');

                    if (match || (divide && big/small === 1)) {
                        grid[index] = null;
                        grid[nIndex] = null;

                        animateMerge(currentTile.obj);
                        animateMerge(neighbor.obj, () => {
                            currentTile.obj.destroy(); 
                            neighbor.obj.destroy();
                            addScore(10); 

                            isMerging = false;
                            if(hintsActive && currentDraggable) showHintsFor(currentDraggable.getData('value'));
                        });
                        return;
                    }

                    if (divide) {
                        let result = big / small;
                        let survivorIndex = -1;
                        let survivor = null;

                        if (currentTile.value === small) {
                            grid[index] = null;

                            animateMerge(currentTile.obj, () => {
                                currentTile.obj.destroy();
                                isMerging = false; 
                                if(hintsActive && currentDraggable) showHintsFor(currentDraggable.getData('value'));
                            });

                            updateTileVisuals(neighbor.obj, result, neighbor.obj.list[0].texture.key);
                            neighbor.value = result;
                            survivorIndex = nIndex;
                            survivor = neighbor.obj;

                        } else {
                            grid[nIndex] = null;

                            animateMerge(neighbor.obj, () => {
                                neighbor.obj.destroy();
                                isMerging = false; 
                                if(hintsActive && currentDraggable) showHintsFor(currentDraggable.getData('value'));
                            });

                            updateTileVisuals(currentTile.obj, result, currentTile.obj.list[0].texture.key);
                            currentTile.value = result;
                            survivorIndex = index;
                            survivor = currentTile.obj;
                        }

                        if(survivor) {
                            survivor.scene.tweens.add({
                                targets: survivor,
                                scaleX: TILE_CONFIG.scale * 1.2,
                                scaleY: TILE_CONFIG.scale * 1.2,
                                duration: 100,
                                yoyo: true,
                                ease: 'Sine.easeInOut'
                            });
                        }

                        addScore(20); 
                        if (survivorIndex !== -1) checkMerges(survivorIndex, scene);
                        return;
                    }
                }
            }
        }
    }
}

function animateMerge(target, onComplete) {
    if(!target.scene) return;
    target.scene.tweens.add({
        targets: target,
        scaleX: 0,
        scaleY: 0,
        alpha: 0.5,
        duration: 200,
        onComplete: onComplete
    });
}

function createTileContainer(scene, x, y, texture, value) {
    let tile = scene.add.container(x, y);
    tile.setSize(TILE_CONFIG.size, TILE_CONFIG.size);
    tile.setScale(TILE_CONFIG.scale);

    let bg = scene.add.image(0, 0, texture);
    let text = scene.add.text(0, 0, value, { 
        fontSize: '45px', fontFamily: GAME_FONT, color: '#000000' 
    }).setOrigin(0.5);

    text.setAlpha(0.4);
    text.setShadow(2, 2, 'rgba(255,255,255,0.6)', 0);

    tile.add([bg, text]);
    tile.setData('value', value);
    return tile;
}

function updateTileVisuals(container, value, texture) {
    container.list[0].setTexture(texture);
    let text = container.list[1];
    text.setText(value);
    container.setData('value', value);
}

function replenishQueue() {
    const colors = ['tile_blue', 'tile_orange', 'tile_pink', 'tile_purple', 'tile_red'];
    let baseMax = 20;
    if (difficulty === 1) baseMax = 15; if (difficulty === 3) baseMax = 30; 
    let maxVal = baseMax + (level * 2);
    while (queue.length < 5) {
        let randomVal = Math.floor(Math.random() * (maxVal - 1)) + 2; 
        let randomColor = colors[Math.floor(Math.random() * colors.length)];
        queue.push({ value: randomVal, texture: randomColor });
    }
}

function updateStackVisuals(scene) {
    stackVisuals.forEach(obj => obj.destroy());
    stackVisuals = [];
    if (queue[0]) createQueueTile(scene, queue[0], SIDEBAR_CONFIG.queueGap);
    if (queue[1]) createQueueTile(scene, queue[1], SIDEBAR_CONFIG.queueGap * 2);
}

function createQueueTile(scene, data, offsetX) {
    let tile = scene.add.container(SIDEBAR_CONFIG.nextSlotX + offsetX, SIDEBAR_CONFIG.nextSlotY); 
    tile.setDepth(95).setScale(TILE_CONFIG.scale);

    let bg = scene.add.image(0, 0, data.texture);
    if (scene.renderer.type === Phaser.WEBGL) {
        bg.postFX.addColorMatrix().blackWhite();
    } else {
        bg.setTint(0x777777);
    }

    let text = scene.add.text(0, 0, data.value, { 
        fontSize: '45px', fontFamily: GAME_FONT, color: '#000000' 
    }).setOrigin(0.5);

    text.setAlpha(0.3);
    text.setShadow(2, 2, 'rgba(0,0,0,0.4)', 5);

    tile.add([bg, text]);
    stackVisuals.push(tile);
}

function updateKeepVisuals(scene) {
    keepContainer.removeAll(true);
    if (keepTileData) {
        let bg = scene.add.image(0, 0, keepTileData.texture);
        let text = scene.add.text(0, 0, keepTileData.value, { 
            fontSize: '45px', fontFamily: GAME_FONT, color: '#000000' 
        }).setOrigin(0.5);

        text.setAlpha(0.4);
        text.setShadow(2, 2, 'rgba(255,255,255,0.6)', 0);

        keepContainer.add([bg, text]);
        keepContainer.setData('value', keepTileData.value);
        keepContainer.setInteractive();
        scene.input.setDraggable(keepContainer);

        keepContainer.setSize(TILE_CONFIG.size, TILE_CONFIG.size);
        keepContainer.setScale(TILE_CONFIG.scale);

        keepContainer.on('pointerdown', () => {
             if (hintsActive && keepTileData) showHintsFor(keepTileData.value);
        });
    } else {
        keepContainer.setData('value', null);
        keepContainer.disableInteractive();
    }
}

function isValidDrop(tileObj) {
    if (!tileObj.getData('value')) return false;
    const { startX, startY, gap } = GRID_LAYOUT;
    for (let i = 0; i < 16; i++) {
        let col = i % 4; let row = Math.floor(i / 4);
        let slotX = startX + (col * gap); let slotY = startY + (row * gap);
        if (Phaser.Math.Distance.Between(tileObj.x, tileObj.y, slotX, slotY) < 60) {
            if (grid[i] === null) return true;
        }
    }
    return false;
}

function tryDropOnGrid(scene, tileObj) {
    if (!tileObj.getData('value')) return false;
    const { startX, startY, gap } = GRID_LAYOUT;
    for (let i = 0; i < 16; i++) {
        let col = i % 4; let row = Math.floor(i / 4);
        let slotX = startX + (col * gap); let slotY = startY + (row * gap);
        if (Phaser.Math.Distance.Between(tileObj.x, tileObj.y, slotX, slotY) < 60) {
            if (grid[i] === null) {
                let texture = tileObj.list[0].texture.key;
                let value = tileObj.getData('value');
                createGridTile(scene, i, slotX, slotY, value, texture);
                return true; 
            }
        }
    }
    return false;
}

function checkLevelUp() {
    let calculatedLevel = Math.floor(score / 10) + 1;
    if (calculatedLevel > level) {
        let levelsGained = calculatedLevel - level;
        level = calculatedLevel;
        let addedTrash = 1 * levelsGained; 
        trashCount = Math.min(10, trashCount + addedTrash);
        levelText.setText('LEVEL ' + level);
        trashText.setText('x' + trashCount);
    }
}

function returnToStack(obj) {
    if (!obj.scene) return; 
    obj.scene.tweens.add({
        targets: obj,
        x: SIDEBAR_CONFIG.nextSlotX,
        y: SIDEBAR_CONFIG.nextSlotY,
        duration: 200,
        ease: 'Cubic.out'
    });
}

function setDifficulty(val) {
    difficulty = val;
    playSound('click'); 
    let names = ['EASY', 'MEDIUM', 'HARD'];
    console.log("DIFFICULTY SET TO: " + names[val-1]);
}

function saveState() {
    if (undoStack.length >= 10) undoStack.shift(); 
    let snapshot = {
        grid: grid.map(cell => cell ? { value: cell.value, texture: cell.obj.list[0].texture.key } : null),
        queue: JSON.parse(JSON.stringify(queue)), 
        score: score,
        level: level,
        trashCount: trashCount,
        keepTileData: keepTileData ? {...keepTileData} : null,
        currentHand: currentDraggable ? { value: currentDraggable.getData('value'), texture: currentDraggable.list[0].texture.key } : null,
        isGameOver: isGameOver
    };
    undoStack.push(snapshot);
}

function undo(scene) {
    if (undoStack.length === 0) return;

    playSound('undo');
    safeClearHints();

    if (isGameOver && gameOverContainer) {
        gameOverContainer.setVisible(false); isGameOver = false;
        if (currentDraggable) currentDraggable.setInteractive();
        if (keepContainer) keepContainer.setInteractive();
        if (bgm && !bgm.isPlaying) bgm.play();
    }

    let state = undoStack.pop();
    score = state.score; level = state.level; trashCount = state.trashCount;
    keepTileData = state.keepTileData; queue = state.queue;
    scoreText.setText('SCORE ' + score); levelText.setText('LEVEL ' + level); trashText.setText('x' + trashCount);

    grid.forEach(c => { if (c) c.obj.destroy(); });
    grid = Array(16).fill(null);
    state.grid.forEach((cellData, index) => {
        if (cellData) restoreGridTile(scene, index, cellData.value, cellData.texture);
    });

    updateKeepVisuals(scene);
    if (currentDraggable) currentDraggable.destroy();
    updateStackVisuals(scene);

    if (state.currentHand) {
        let tile = createTileContainer(
            scene, 
            SIDEBAR_CONFIG.nextSlotX, 
            SIDEBAR_CONFIG.nextSlotY, 
            state.currentHand.texture, 
            state.currentHand.value
        );
        tile.setDepth(100).setInteractive();
        scene.input.setDraggable(tile);
        currentDraggable = tile;

        if (hintsActive) showHintsFor(state.currentHand.value);
    }
}

function toggleHints() {
    hintsActive = !hintsActive;
    playSound('click'); 
    if (!hintsActive) { safeClearHints(); } 
    else { if (currentDraggable) showHintsFor(currentDraggable.getData('value')); }
}

function safeClearHints() {
    if (hintGraphics && hintGraphics.scene) { hintGraphics.clear(); }
}

function showHintsFor(value) {
    if (!hintsActive) return;
    safeClearHints();
    if (hintGraphics && hintGraphics.scene) { hintGraphics.fillStyle(HINT_CONFIG.color, HINT_CONFIG.alpha); }
    for (let i = 0; i < 16; i++) {
        if (grid[i] === null) {
            if (checkIfMergePossible(i, value)) {
                if (slotImages[i] && hintGraphics && hintGraphics.scene) {
                    let slot = slotImages[i];
                    let size = (TILE_CONFIG.size * TILE_CONFIG.scale) + HINT_CONFIG.padding; 
                    hintGraphics.fillRoundedRect(slot.x - (size / 2), slot.y - (size / 2), size, size, HINT_CONFIG.cornerRadius);
                }
            }
        }
    }
}

function checkIfMergePossible(index, incomingValue) {
    let row = Math.floor(index / 4); let col = index % 4;
    let neighbors = [{ r: row - 1, c: col }, { r: row + 1, c: col }, { r: row, c: col - 1 }, { r: row, c: col + 1 }];
    for (let pos of neighbors) {
        if (pos.r >= 0 && pos.r < 4 && pos.c >= 0 && pos.c < 4) {
            let nIndex = pos.r * 4 + pos.c;
            let neighbor = grid[nIndex];
            if (neighbor) {
                if (neighbor.value === incomingValue) return true;
                let big = Math.max(neighbor.value, incomingValue);
                let small = Math.min(neighbor.value, incomingValue);
                if (big % small === 0) return true;
            }
        }
    }
    return false;
}

function setupUI(scene) {
    const { startX, startY, gap } = GRID_LAYOUT;

    let board = scene.add.graphics();
    board.fillStyle(0x008080, 1);
    board.fillRoundedRect(300, 335, 535, 620, 30);
    board.lineStyle(10, 0xcffef3, 1);
    board.strokeRoundedRect(300, 335, 535, 620, 30);
    board.setDepth(-5);

    drawSidebarPanel(scene);
    drawQueueArea(scene);
    drawKeepArea(scene);
    drawTrashArea(scene);

    if (speakerBtn) {
        speakerBtn.destroy();
        speakerBtn = null;
    }

    speakerBtn = scene.add.image(1350, 70, isMuted ? 'speaker_mute' : 'speaker')
        .setOrigin(0.5)
        .setScale(SPEAKER_SCALE)
        .setInteractive({ useHandCursor: true })
        .setDepth(100);

    speakerBtn.on('pointerdown', () => toggleSoundGlobal(scene));

    for (let i = 0; i < 16; i++) {
        let col = i % 4; let row = Math.floor(i / 4);
        let x = startX + (col * gap); let y = startY + (row * gap);
        let slot = scene.add.image(x, y, 'slot').setDepth(2).setScale(SLOT_CONFIG.scale);
        slotImages.push(slot);
    }

    drawTextLayers(scene);
}

function drawSidebarPanel(scene) {
    let panel = scene.add.graphics();
    const { bgX, bgY, width, height } = SIDEBAR_CONFIG;

    panel.fillStyle(COLORS.shadow, 0.4); 
    panel.fillRoundedRect(bgX + 15, bgY + 15, width, height, 30);

    panel.fillStyle(COLORS.sidebarFill, 1);
    panel.fillRoundedRect(bgX, bgY, width, height, 30);

    panel.lineStyle(15, COLORS.sidebarBorder, 1);
    panel.strokeRoundedRect(bgX, bgY, width, height, 30);

    panel.lineStyle(3, COLORS.sidebarLine, 1);
    panel.strokeRoundedRect(bgX - 7, bgY - 7, width + 14, height + 14, 34);
    panel.strokeRoundedRect(bgX + 7, bgY + 7, width - 14, height - 14, 26);
    panel.setDepth(-5);
}

function drawQueueArea(scene) {
    let uiGraphics = scene.add.graphics().setDepth(2);
    let middleX = SIDEBAR_CONFIG.nextSlotX + SIDEBAR_CONFIG.queueGap;
    let w = (SIDEBAR_CONFIG.queueGap * 2) + 110; 
    let h = 110;
    let x = middleX - (w / 2);
    let y = SIDEBAR_CONFIG.nextSlotY - (h / 2);

    uiGraphics.fillStyle(COLORS.white, 1);
    uiGraphics.fillRoundedRect(x, y, w, h, 13); 

    uiGraphics.lineStyle(8, COLORS.shadow, 0.2);
    uiGraphics.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 15); 

    uiGraphics.lineStyle(1, COLORS.shadow, 1);
    uiGraphics.strokeRoundedRect(x - 5, y - 5, w + 10, h + 10, 18);

    uiGraphics.lineStyle(6, COLORS.white, 1);  
    uiGraphics.strokeRoundedRect(x, y, w, h, 13); 
}

function drawKeepArea(scene) {
    let uiGraphics = scene.add.graphics().setDepth(2);
    let size = 100; 
    let x = SIDEBAR_CONFIG.keepSlotX - (size/2);
    let y = SIDEBAR_CONFIG.keepSlotY - (size/2);

    uiGraphics.fillStyle(SIDEBAR_CONFIG.keepBgColor, 1); 
    uiGraphics.fillRoundedRect(x, y, size, size, 15);

    uiGraphics.lineStyle(8, COLORS.shadow, 0.2); 
    uiGraphics.strokeRoundedRect(x + 2, y + 2, size - 4, size - 4, 13);

    uiGraphics.lineStyle(6, COLORS.white, 1);   
    uiGraphics.strokeRoundedRect(x, y, size, size, 15);

    scene.add.image(SIDEBAR_CONFIG.keepSlotX, SIDEBAR_CONFIG.keepSlotY, 'slot').setScale(0.8).setDepth(1);

    let label = scene.add.text(SIDEBAR_CONFIG.keepTextX, SIDEBAR_CONFIG.keepTextY, 'KEEP', { 
        fontSize: '32px', fontFamily: GAME_FONT, color: SIDEBAR_CONFIG.keepDarkColor
    }).setOrigin(0.5).setDepth(3);
    label.setShadow(2, 2, 'rgba(255,255,255,0.5)', 0); 

    keepContainer = scene.add.container(SIDEBAR_CONFIG.keepSlotX, SIDEBAR_CONFIG.keepSlotY).setDepth(100);
    keepContainer.setSize(TILE_CONFIG.size, TILE_CONFIG.size);
    keepContainer.setScale(TILE_CONFIG.scale);
}

function drawTrashArea(scene) {
    let uiGraphics = scene.add.graphics().setDepth(2);
    let { trashX, trashY, trashBgWidth, trashBgHeight, trashBgColor } = SIDEBAR_CONFIG;
    let x = trashX - (trashBgWidth / 2);
    let y = trashY - (trashBgHeight / 2);

    uiGraphics.fillStyle(trashBgColor, 1);
    uiGraphics.fillRoundedRect(x, y, trashBgWidth, trashBgHeight, 15);

    uiGraphics.lineStyle(8, COLORS.shadow, 0.2); 
    uiGraphics.strokeRoundedRect(x + 2, y + 2, trashBgWidth - 4, trashBgHeight - 4, 13);

    uiGraphics.lineStyle(6, COLORS.white, 1);   
    uiGraphics.strokeRoundedRect(x, y, trashBgWidth, trashBgHeight, 15);

    scene.add.image(trashX, trashY, 'slot').setScale(0.8).setDepth(1);

    if (scene.textures.exists('trash_icon')) {
        scene.add.image(trashX, trashY + SIDEBAR_CONFIG.trashIconOffsetY, 'trash_icon')
             .setDepth(3).setScale(0.5).setTint(COLORS.white);
    }

    trashText = scene.add.text(trashX, SIDEBAR_CONFIG.trashY + SIDEBAR_CONFIG.trashTextOffsetY, 'x' + trashCount, 
        { fontSize: '32px', color: '#ffffff', fontStyle: 'bold', fontFamily: GAME_FONT }
    ).setOrigin(0.5).setDepth(3);

    let label = scene.add.text(SIDEBAR_CONFIG.trashLabelX, SIDEBAR_CONFIG.trashLabelY, 'TRASH', { 
        fontSize: '32px', fontFamily: GAME_FONT, color: SIDEBAR_CONFIG.trashDarkColor
    }).setOrigin(0.5).setDepth(3);
    label.setShadow(2, 2, 'rgba(255,255,255,0.5)', 0);
}

function drawTextLayers(scene) {
    scene.add.text(720, 50, 'JUST DIVIDE', {
        fontSize: '50px', fontFamily: GAME_FONT, color: '#303030'
    }).setOrigin(0.5).setDepth(2);

    scene.add.text(720, 120, 'DIVIDE WITH THE NUMBER TO SOLVE THE ROWS AND COLUMNS.', {
        fontSize: '28px', fontFamily: GAME_FONT, color: '#FFEFB7', stroke: '#AC262F', strokeThickness: 6
    }).setOrigin(0.5).setDepth(2);

    scene.add.image(360, 390, 'badge').setDepth(1);
    levelText = scene.add.text(360, 385, 'LEVEL ' + level, { fontSize: '32px', fontFamily: GAME_FONT, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(2);

    scene.add.image(780, 390, 'badge').setDepth(1);
    scoreText = scene.add.text(780, 385, 'SCORE ' + score, { fontSize: '32px', fontFamily: GAME_FONT, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(2);

    scene.add.image(560, 270, 'cat').setDepth(3);
}

function createGameOverUI(scene) {
    if (gameOverContainer) gameOverContainer.destroy();
    gameOverContainer = scene.add.container(720, 512).setDepth(1000);
    gameOverContainer.setVisible(false);

    let bg = scene.add.rectangle(0, 0, 1440, 1024, 0x000000, 0.85);
    let panel = scene.add.rectangle(0, 0, 600, 400, 0x5e4034).setStrokeStyle(4, 0xffffff);
    let title = scene.add.text(0, -100, "GAME OVER", { fontSize: '70px', fontFamily: GAME_FONT, color: '#ff4444' }).setOrigin(0.5);
    finalScoreText = scene.add.text(0, -20, "SCORE: 0", { fontSize: '50px', color: '#ffffff', fontFamily: GAME_FONT }).setOrigin(0.5);

    let btnContainer = scene.add.container(0, 100);
    let btnBg = scene.add.rectangle(0, 0, 250, 70, 0xffffff);
    let btnText = scene.add.text(0, 0, "RESTART", { fontSize: '40px', color: '#000000', fontFamily: GAME_FONT }).setOrigin(0.5);
    let btnZone = scene.add.zone(0, 0, 250, 70).setInteractive({ useHandCursor: true });

    btnZone.on('pointerdown', () => startNewGame(scene));

    btnContainer.add([btnBg, btnText, btnZone]);
    gameOverContainer.add([bg, panel, title, finalScoreText, btnContainer]);
}