/**
 * 奇妙な仲間たちをすくえ！メダルポイポイ ゲーム
 *
 * 作成日: 2023-MM-DD (あなたの現在の日付)
 * 製作者: Your Name (または AI)
 *
 * このゲームは、マウスでポイを操作し、様々なキャラクターをすくってメダルを増やすゲームです。
 */

// --- グローバル定数 ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const POI_RADIUS = 40; // ポイの視覚的な半径
const POI_SCOOP_RADIUS_MARGIN = 5; // すくい判定を少しだけ甘くするマージン
const POI_COLOR = 'rgba(255, 255, 255, 0.5)';
const POI_RING_COLOR = 'red';
const POI_DOWN_COLOR = 'rgba(220, 220, 255, 0.6)';
const MAX_CHARACTERS_DEFAULT = 20; // 同時出現数の基準値
const GAME_TIME_LIMIT = 60000; // ゲームの制限時間 (ミリ秒) => 60秒
const ASSET_PATHS = { // アセットパスを一元管理
    IMAGES: 'images/',
    SOUNDS: 'sounds/'
};

// --- ゲーム状態 ---
const GameState = Object.freeze({
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    DIFFICULTY_SELECT: 'DIFFICULTY_SELECT',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
    RANKING: 'RANKING'
});

// --- 難易度設定 ---
const Difficulty = Object.freeze({
    EASY: { name: 'かんたん', initialMedals: 15, speedMultiplier: 0.8, spawnRateMultiplier: 1.2, levelDistribution: [0.5, 0.3, 0.15, 0.04, 0.01], maxCharsModifier: -5 },
    NORMAL: { name: 'ふつう', initialMedals: 10, speedMultiplier: 1.0, spawnRateMultiplier: 1.0, levelDistribution: [0.4, 0.3, 0.2, 0.08, 0.02], maxCharsModifier: 0 },
    HARD: { name: 'むずかしい', initialMedals: 5, speedMultiplier: 1.3, spawnRateMultiplier: 0.8, levelDistribution: [0.3, 0.25, 0.25, 0.15, 0.05], maxCharsModifier: 5 }
});

// --- キャラクタータイプ定義 ---
const characterTypes = [
    // レベル、メダル、速度、回避有無、当たり判定半径、出現比率、色(画像ない場合)、画像ファイル名
    { id: 'wakin', name: '和金', level: 1, medals: 1, speed: 1.0, avoidsPoi: false, hitRadius: 15, appearanceRate: 30, color: '#e74c3c', imageName: 'wakin.png' },
    { id: 'demekin', name: '出目金', level: 2, medals: 3, speed: 0.8, avoidsPoi: false, hitRadius: 18, appearanceRate: 20, color: '#34495e', imageName: 'demekin.png' },
    { id: 'ryukin', name: '琉金', level: 3, medals: 5, speed: 1.2, avoidsPoi: true, hitRadius: 20, appearanceRate: 15, color: '#f39c12', imageName: 'ryukin.png' },
    { id: 'ranchu', name: 'らんちゅう', level: 4, medals: 8, speed: 0.7, avoidsPoi: false, hitRadius: 22, appearanceRate: 10, color: '#e67e22', imageName: 'ranchu.png' },
    { id: 'koi', name: '錦鯉', level: 5, medals: 12, speed: 1.5, avoidsPoi: true, hitRadius: 25, appearanceRate: 7, color: '#ecf0f1', imageName: 'koi.png' },
    { id: 'zarigani', name: 'ザリガニ', level: 3, medals: 4, speed: 0.9, avoidsPoi: false, hitRadius: 20, appearanceRate: 10, color: '#c0392b', imageName: 'zarigani.png' },
    { id: 'slime', name: 'スライム', level: 2, medals: 2, speed: 0.6, avoidsPoi: false, hitRadius: 18, appearanceRate: 15, color: '#3498db', imageName: 'slime.png' },
    { id: 'baby', name: '赤ちゃん', level: 1, medals: 1, speed: 0.5, avoidsPoi: false, hitRadius: 16, appearanceRate: 10, color: '#ffc9a7', imageName: 'baby.png' },
    { id: 'ojisan', name: 'おじさん', level: 6, medals: 15, speed: 1.3, avoidsPoi: true, hitRadius: 28, appearanceRate: 5, color: '#bdc3c7', imageName: 'ojisan.png', scoopSoundId: 'ojisan_voice' },
    { id: 'brick', name: 'レンガ', level: 1, medals: 0, speed: 0.1, avoidsPoi: false, hitRadius: 20, appearanceRate: 5, color: '#a0522d', imageName: 'brick.png' },
    { id: 'rare_dragon', name: 'レアドラン', level: 10, medals: 50, speed: 2.0, avoidsPoi: true, hitRadius: 35, appearanceRate: 1, color: '#f1c40f', imageName: 'rare_dragon.png' }
];

// --- ユーティリティ関数 ---
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}
function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

// --- アセットローダー ---
class AssetLoader {
    constructor() {
        this.images = new Map();
        this.sounds = new Map();
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.errorAssets = 0;
        this.onComplete = null;
    }

    _addImage(id, path) {
        this.totalAssets++;
        const img = new Image();
        img.onload = () => this._assetLoaded(id, path, true);
        img.onerror = () => this._assetLoaded(id, path, false);
        img.src = path;
        this.images.set(id, { asset: img, loaded: false });
    }

    _addSound(id, path) {
        this.totalAssets++;
        const audio = new Audio();
        const onCanPlayThrough = () => {
            this._assetLoaded(id, path, true);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
        };
        const onError = () => {
            this._assetLoaded(id, path, false);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
        };
        audio.addEventListener('canplaythrough', onCanPlayThrough);
        audio.addEventListener('error', onError);
        audio.src = path;
        this.sounds.set(id, { asset: audio, loaded: false });
    }

    _assetLoaded(id, path, success) {
        this.loadedAssets++;
        const assetData = this.images.get(id) || this.sounds.get(id);
        if (assetData) {
            assetData.loaded = success;
        }

        if (success) {
            // console.log(`[AssetLoader] Loaded: ${path}`);
        } else {
            this.errorAssets++;
            console.warn(`[AssetLoader] Failed to load: ${path}`);
        }

        if (this.loadedAssets === this.totalAssets) {
            console.log(`[AssetLoader] Loading complete. Total: ${this.totalAssets}, Errors: ${this.errorAssets}`);
            if (this.onComplete) {
                try {
                    this.onComplete();
                } catch (e) {
                    console.error("[AssetLoader] Error in onComplete callback:", e);
                }
            }
        }
    }

    loadImage(id, filename) {
        this._addImage(id, ASSET_PATHS.IMAGES + filename);
    }
    loadSound(id, filename) {
        this._addSound(id, ASSET_PATHS.SOUNDS + filename);
    }

    getImage(id) {
        const data = this.images.get(id);
        return (data && data.loaded) ? data.asset : null;
    }

    getSound(id) {
        const data = this.sounds.get(id);
        const sound = data ? data.asset : null;
        return sound && sound.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA ? sound.cloneNode() : null;
    }

    start(onComplete) {
        this.onComplete = onComplete;
        if (this.totalAssets === 0) {
            console.log("[AssetLoader] No assets to load.");
            setTimeout(() => this.onComplete ? this.onComplete() : null, 0);
        } else if (this.loadedAssets === this.totalAssets) {
             console.log("[AssetLoader] Assets already loaded (possibly cached).");
             setTimeout(() => this.onComplete ? this.onComplete() : null, 0);
        }
    }

    getProgress() {
        return this.totalAssets === 0 ? 1 : this.loadedAssets / this.totalAssets;
    }
}

// --- サウンドマネージャー ---
class SoundManager {
    constructor(assetLoader) {
        this.assetLoader = assetLoader;
        this.currentBGM = null;
        this.isMuted = false;
    }

    playBGM(id, loop = true) {
        if (this.isMuted) return;
        this.stopBGM();
        const bgm = this.assetLoader.getSound(id);
        if (bgm) {
            this.currentBGM = bgm;
            this.currentBGM.loop = loop;
            this.currentBGM.play().catch(e => console.warn(`[SoundManager] BGM play failed for ${id}: ${e.message}`));
        } else {
            console.warn(`[SoundManager] BGM asset not ready or not found: ${id}`);
        }
    }

    stopBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
            this.currentBGM = null;
        }
    }

    playSE(id, volume = 1.0) {
        if (this.isMuted) return;
        const se = this.assetLoader.getSound(id);
        if (se) {
            se.volume = volume;
            se.play().catch(e => console.warn(`[SoundManager] SE play failed for ${id}: ${e.message}`));
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM();
        }
        console.log(`[SoundManager] Muted: ${this.isMuted}`);
    }
}

// --- ランキングマネージャー ---
class Ranking {
    constructor(storageKey = 'medalGameRanking_v2') { // バージョンを上げて古いデータとの競合を防ぐ
        this.storageKey = storageKey;
        this.scores = this._loadScores();
    }

    _loadScores() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("[Ranking] Failed to load scores:", e);
            return [];
        }
    }

    _saveScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch (e) {
            console.error("[Ranking] Failed to save scores:", e);
        }
    }

    addScore(score) {
        if (typeof score !== 'number') return; // スコアが数値でない場合は追加しない
        this.scores.push({ score, date: Date.now() });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10); // 上位10件まで保存
        this._saveScores();
    }

    getHighScores(limit = 5) {
        return this.scores.slice(0, limit);
    }

    getHighScore() {
        return this.scores.length > 0 ? this.scores[0].score : 0;
    }
}

// --- UI (描画関連) ---
class UI {
    constructor(ctx, assetLoader, game) {
        this.ctx = ctx;
        this.assetLoader = assetLoader;
        this.game = game;
        this.floatingTexts = [];
        this.buttons = [];
    }

    addFloatingText(text, x, y, options = {}) {
        const { color = 'gold', duration = 1000, size = 20, vy = -0.5 } = options;
        const rgbColor = hexToRgb(color);
        this.floatingTexts.push({
            text, x, y, rgbColor, startTime: Date.now(), duration, size, vy
        });
    }

    update(deltaTime) {
        const now = Date.now();
        this.floatingTexts = this.floatingTexts.filter(ft => {
            const elapsed = now - ft.startTime;
            if (elapsed >= ft.duration) return false;
            ft.y += ft.vy * (deltaTime / 16.67);
            ft.alpha = 1.0 - (elapsed / ft.duration);
            return true;
        });

        this.buttons.forEach(button => {
            button.hover = this._isMouseOverButton(button, this.game.mouseX, this.game.mouseY);
        });
    }

    _drawButton(button) {
        const ctx = this.ctx;
        const bgColor = button.hover ? (button.hoverBgColor || '#e0e0e0') : (button.bgColor || '#f5f5f5');
        const textColor = button.hover ? (button.hoverTextColor || '#000000') : (button.textColor || '#333333');
        const borderColor = button.borderColor || '#cccccc';
        const font = button.font || '20px Arial';

        ctx.fillStyle = bgColor;
        ctx.fillRect(button.x, button.y, button.width, button.height);

        if(borderColor) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(button.x, button.y, button.width, button.height);
        }

        ctx.fillStyle = textColor;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 2);
    }

    _isMouseOverButton(button, mouseX, mouseY) {
        return mouseX >= button.x && mouseX <= button.x + button.width &&
               mouseY >= button.y && mouseY <= button.y + button.height;
    }

    handleClick(mouseX, mouseY) {
        const clickedButton = this.buttons.find(button => this._isMouseOverButton(button, mouseX, mouseY));
        if (clickedButton && clickedButton.action) {
            this.game.soundManager.playSE('button_click_sfx');
            clickedButton.action();
            return true;
        }
        return false;
    }

    drawLoadingScreen(progress) {
        const ctx = this.ctx;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading Assets...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        const barWidth = 300;
        const barHeight = 20;
        const barX = (CANVAS_WIDTH - barWidth) / 2;
        const barY = CANVAS_HEIGHT / 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        ctx.font = '16px Arial';
        ctx.fillText(`${Math.round(progress * 100)}%`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }

    drawTitleScreen() {
        const ctx = this.ctx;
        const bg = this.assetLoader.getImage('title_bg');
        if (bg) {
            ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('奇妙な仲間たちをすくえ！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        ctx.font = 'bold 70px Impact, sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('メダルポイポイ', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        ctx.shadowColor = 'transparent';
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillText('Click or Tap to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
        }
        this.buttons = [];
    }

    drawDifficultySelectScreen() {
        const ctx = this.ctx;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('難易度を選んでね', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.2);

        const btnWidth = 180;
        const btnHeight = 60;
        const btnY = CANVAS_HEIGHT / 2 - btnHeight / 2;
        const spacing = 40;
        const totalWidth = btnWidth * 3 + spacing * 2;
        const startX = (CANVAS_WIDTH - totalWidth) / 2;

        this.buttons = [
            { text: Difficulty.EASY.name, x: startX, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.startGame(Difficulty.EASY), bgColor: '#90ee90', hoverBgColor: '#7cfc00' },
            { text: Difficulty.NORMAL.name, x: startX + btnWidth + spacing, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.startGame(Difficulty.NORMAL), bgColor: '#add8e6', hoverBgColor: '#87cefa' },
            { text: Difficulty.HARD.name, x: startX + (btnWidth + spacing) * 2, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.startGame(Difficulty.HARD), bgColor: '#f08080', hoverBgColor: '#ff6347' }
        ];
        this.buttons.forEach(button => this._drawButton(button));
    }

    drawGameScreen(medals, highScore, timer) {
        const ctx = this.ctx;
        const bg = this.assetLoader.getImage('game_bg');
        if (bg) {
            ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.fillStyle = '#e0f7fa';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 50);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`メダル: ${medals}`, 20, 27);

        // 残り時間を表示
        const seconds = Math.max(0, Math.ceil(timer / 1000));
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = seconds <= 10 ? '#ff4444' : 'white'; // 10秒以下で赤く
        ctx.fillText(`残り時間: ${seconds}`, CANVAS_WIDTH / 2, 27);

        ctx.textAlign = 'right';
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH - 20, 27);

        this.floatingTexts.forEach(ft => {
            ctx.fillStyle = `rgba(${ft.rgbColor.join(',')}, ${ft.alpha})`;
            ctx.font = `bold ${ft.size}px Arial Black`;
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    drawGameOverScreen(finalScore, highScore, isNewHighScore) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 80px Impact, sans-serif';
        ctx.fillText('TIME UP!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(`スコア: ${finalScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        if (isNewHighScore) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 30px Arial';
            ctx.fillText('ハイスコア更新！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        } else {
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        }

        const btnWidth = 180;
        const btnHeight = 50;
        const btnY = CANVAS_HEIGHT * 0.7;
        const spacing = 40;

        this.buttons = [
            { text: 'ランキングを見る', x: CANVAS_WIDTH / 2 - btnWidth - spacing / 2, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.goToRanking(), bgColor: '#3498db', hoverBgColor: '#5dade2' },
            { text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 + spacing / 2, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.goToTitle(), bgColor: '#95a5a6', hoverBgColor: '#bdc3c7' }
        ];
        this.buttons.forEach(button => this._drawButton(button));
    }

    drawRankingScreen(highScores) {
        const ctx = this.ctx;
        ctx.fillStyle = '#3d405b'; // 落ち着いた背景色
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ランキング', CANVAS_WIDTH / 2, 80);

        if (highScores.length === 0) {
            ctx.font = '24px Arial';
            ctx.fillText('まだ記録がありません', CANVAS_WIDTH / 2, 200);
        } else {
            const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32']; // 金、銀、銅
            const rankFonts = ['bold 32px Arial', 'bold 28px Arial', 'bold 26px Arial'];

            highScores.forEach((entry, index) => {
                const yPos = 180 + index * 55;
                const isTop3 = index < 3;
                const date = new Date(entry.date);
                const dateString = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

                // 順位表示
                ctx.font = isTop3 ? rankFonts[index] : 'bold 24px Arial';
                ctx.fillStyle = isTop3 ? rankColors[index] : 'white';
                ctx.textAlign = 'left';
                ctx.fillText(`${index + 1}.`, CANVAS_WIDTH / 2 - 250, yPos);

                // スコア表示
                ctx.textAlign = 'right';
                ctx.fillText(`${entry.score} メダル`, CANVAS_WIDTH / 2 + 100, yPos);

                // 日付表示
                ctx.font = '16px Arial';
                ctx.fillStyle = '#cccccc';
                ctx.fillText(dateString, CANVAS_WIDTH / 2 + 250, yPos);
            });
        }

        const btnWidth = 200;
        const btnHeight = 50;
        const btnY = CANVAS_HEIGHT * 0.85;
        this.buttons = [
             { text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 - btnWidth / 2, y: btnY, width: btnWidth, height: btnHeight, action: () => this.game.goToTitle(), bgColor: '#bdc3c7', hoverBgColor: '#ecf0f1' }
        ];
        this.buttons.forEach(button => this._drawButton(button));
    }
}

// --- ポイクラス ---
class Poi {
    constructor(assetLoader) {
        this.x = -100;
        this.y = -100;
        this.radius = POI_RADIUS;
        this.isDown = false;
        this.image = assetLoader.getImage('poi');
        this.isVisible = false;
    }

    update(mouseX, mouseY, isMouseDown, isMouseInCanvas) {
        this.x = mouseX;
        this.y = mouseY;
        this.isDown = isMouseDown;
        this.isVisible = isMouseInCanvas;
    }

    draw(ctx) {
        if (!this.isVisible) return;

        if (this.image) {
            ctx.drawImage(this.image, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.isDown ? POI_DOWN_COLOR : POI_COLOR;
            ctx.fill();
            ctx.strokeStyle = POI_RING_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (this.isDown) {
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const rippleRadius = this.radius + 6 + Math.sin(Date.now() / 120) * 3;
            ctx.arc(this.x, this.y, rippleRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    getScoopBounds() {
        const scoopRadius = this.radius + POI_SCOOP_RADIUS_MARGIN;
        return {
            x: this.x,
            y: this.y,
            radius: scoopRadius
        };
    }
}

// --- キャラクタークラス ---
class Character {
    constructor(type, assetLoader, difficultyMultiplier = 1) {
        this.type = type;
        this.assetLoader = assetLoader;
        this.image = this.assetLoader.getImage(this.type.id);
        this._setInitialPosition();
        this.baseSpeed = this.type.speed * getRandomFloat(0.8, 1.2);
        this.speedMultiplier = difficultyMultiplier;
        this.angle = getRandomFloat(0, Math.PI * 2);
        this.targetAngle = this.angle;
        this.turnSpeed = 0.05 * getRandomFloat(0.8, 1.2);
        this.wanderTimer = 0;
        this.wanderInterval = getRandomFloat(1000, 3500);
        this.avoidsPoi = this.type.avoidsPoi;
        this.avoidDistance = 80 + this.getRadius();
        this.isFleeing = false;
        this.scoopSoundId = this.type.scoopSoundId;
    }

    _setInitialPosition() {
        const margin = this.getRadius() + 20;
        const side = getRandomInt(0, 3);
        switch (side) {
            case 0: this.x = getRandomFloat(0, CANVAS_WIDTH); this.y = -margin; break;
            case 1: this.x = CANVAS_WIDTH + margin; this.y = getRandomFloat(0, CANVAS_HEIGHT); break;
            case 2: this.x = getRandomFloat(0, CANVAS_WIDTH); this.y = CANVAS_HEIGHT + margin; break;
            case 3: this.x = -margin; this.y = getRandomFloat(0, CANVAS_HEIGHT); break;
        }
    }

    getRadius() { return this.type.hitRadius || 15; }
    getScoopRadius() { return this.getRadius() * (1 + this.type.level * 0.08); }

    update(deltaTime, poiX, poiY) {
        const dtRatio = deltaTime / 16.67;
        const currentSpeed = this.baseSpeed * this.speedMultiplier * dtRatio;
        this.isFleeing = false;
        if (this.avoidsPoi && distance(this.x, this.y, poiX, poiY) < this.avoidDistance) {
            this.isFleeing = true;
            this.targetAngle = Math.atan2(this.y - poiY, this.x - poiX);
            const fleeSpeed = currentSpeed * 1.6;
            this.x += Math.cos(this.targetAngle) * fleeSpeed;
            this.y += Math.sin(this.targetAngle) * fleeSpeed;
            this.wanderTimer = this.wanderInterval / 2;
        }
        if (!this.isFleeing) {
            this.wanderTimer -= deltaTime;
            if (this.wanderTimer <= 0) {
                this.targetAngle = getRandomFloat(0, Math.PI * 2);
                this.wanderTimer = this.wanderInterval * getRandomFloat(0.8, 1.2);
            }
            let angleDiff = this.targetAngle - this.angle;
            while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            this.angle += angleDiff * this.turnSpeed * dtRatio;
            this.x += Math.cos(this.angle) * currentSpeed;
            this.y += Math.sin(this.angle) * currentSpeed;
        }
        const radius = this.getRadius();
        if (this.x < radius) { this.x = radius; this.angle = Math.PI - this.angle + getRandomFloat(-0.1, 0.1); this.targetAngle = this.angle; }
        else if (this.x > CANVAS_WIDTH - radius) { this.x = CANVAS_WIDTH - radius; this.angle = Math.PI - this.angle + getRandomFloat(-0.1, 0.1); this.targetAngle = this.angle; }
        if (this.y < radius) { this.y = radius; this.angle = -this.angle + getRandomFloat(-0.1, 0.1); this.targetAngle = this.angle; }
        else if (this.y > CANVAS_HEIGHT - radius) { this.y = CANVAS_HEIGHT - radius; this.angle = -this.angle + getRandomFloat(-0.1, 0.1); this.targetAngle = this.angle; }
        this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        if (this.image) {
            try {
                const radius = this.getRadius();
                ctx.drawImage(this.image, -radius, -radius, radius * 2, radius * 2);
            } catch (e) {
                console.error(`[Character] Error drawing image for ${this.type.id}:`, e);
                this._drawFallback(ctx);
            }
        } else {
            this._drawFallback(ctx);
        }
        ctx.restore();
    }

    _drawFallback(ctx) {
        const radius = this.getRadius();
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.type.color || 'gray';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.6);
        ctx.lineTo(-radius * 0.3, -radius * 0.3);
        ctx.lineTo(radius * 0.3, -radius * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    isOutOfScreen() {
        const margin = this.getRadius() + 50;
        return this.x < -margin || this.x > CANVAS_WIDTH + margin || this.y < -margin || this.y > CANVAS_HEIGHT + margin;
    }
}

// --- ゲーム本体クラス ---
class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assetLoader = new AssetLoader();
        this.soundManager = new SoundManager(this.assetLoader);
        this.ranking = new Ranking();
        this.ui = new UI(this.ctx, this.assetLoader, this);
        this.poi = new Poi(this.assetLoader);
        this.currentState = GameState.LOADING;
        this.currentDifficulty = Difficulty.NORMAL;
        this.characters = [];
        this.medals = 0;
        this.highScore = this.ranking.getHighScore();
        this.isMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseInCanvas = false;
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.maxCharacters = MAX_CHARACTERS_DEFAULT;
        this.gameTimer = 0; // ゲームタイマー
        this._setupEventHandlers();
        console.log("[Game] Game instance created.");
    }

    init() {
        console.log("[Game] Initializing...");
        this.currentState = GameState.LOADING;
        this._loadRequiredAssets(() => {
            console.log("[Game] Assets loaded. Proceeding to Title.");
            this.currentState = GameState.TITLE;
            this.soundManager.playBGM('title_bgm');
        });
        this.gameLoop();
    }

    _loadRequiredAssets(onComplete) {
        console.log("[Game] Loading required assets...");
        this.assetLoader.loadImage('title_bg', 'title_background.png');
        this.assetLoader.loadImage('game_bg', 'game_background.png');
        characterTypes.forEach(type => {
            if (type.imageName) {
                this.assetLoader.loadImage(type.id, type.imageName);
            }
        });
        this.assetLoader.loadSound('title_bgm', 'title_bgm.mp3');
        this.assetLoader.loadSound('game_bgm', 'game_bgm.mp3');
        this.assetLoader.loadSound('game_over_bgm', 'game_over.mp3');
        this.assetLoader.loadSound('ranking_bgm', 'ranking.mp3');
        this.assetLoader.loadSound('scoop_sfx', 'scoop.wav');
        this.assetLoader.loadSound('medal_get_sfx', 'medal_get.wav');
        this.assetLoader.loadSound('rare_get_sfx', 'rare_get.wav');
        this.assetLoader.loadSound('poi_in_sfx', 'poi_in.wav');
        this.assetLoader.loadSound('button_click_sfx', 'button_click.wav');
        this.assetLoader.loadSound('ojisan_voice', 'ojisan_voice.wav');
        this.assetLoader.start(onComplete);
    }

    _setupEventHandlers() {
        this.canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this._handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseenter', () => this.isMouseInCanvas = true);
        this.canvas.addEventListener('mouseleave', () => { this.isMouseInCanvas = false; this.isMouseDown = false; });
        this.canvas.addEventListener('touchstart', this._handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: false });
    }

    _handleMouseDown(e) {
        e.preventDefault();
        this._updateMousePosition(e);
        switch (this.currentState) {
            case GameState.TITLE: this.goToDifficultySelect(); break;
            case GameState.DIFFICULTY_SELECT:
            case GameState.GAME_OVER:
            case GameState.RANKING:
                this.ui.handleClick(this.mouseX, this.mouseY);
                break;
            case GameState.PLAYING:
                if (this.medals > 0) {
                    this.isMouseDown = true;
                    this.soundManager.playSE('poi_in_sfx');
                }
                break;
        }
    }

    _handleMouseUp(e) {
        e.preventDefault();
        this._updateMousePosition(e);
        if (this.currentState === GameState.PLAYING && this.isMouseDown) {
            this.isMouseDown = false;
            this._performScoop();
        }
    }

    _handleMouseMove(e) {
        e.preventDefault();
        this._updateMousePosition(e);
    }

    _handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this._updateMousePosition(touch);
        this.isMouseInCanvas = true;
        this._handleMouseDown(touch);
    }
    _handleTouchEnd(e) {
        e.preventDefault();
        this._handleMouseUp({});
        this.isMouseInCanvas = false;
    }
    _handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this._updateMousePosition(touch);
    }

    _updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = (e.clientX || 0) - rect.left;
        this.mouseY = (e.clientY || 0) - rect.top;
    }

    startGame(difficulty) {
        console.log(`[Game] Starting game with difficulty: ${difficulty.name}`);
        this.currentDifficulty = difficulty;
        this.medals = difficulty.initialMedals;
        this.highScore = this.ranking.getHighScore();
        this.characters = [];
        this.spawnTimer = 1000;
        this.maxCharacters = MAX_CHARACTERS_DEFAULT + difficulty.maxCharsModifier;
        this.ui.floatingTexts = [];
        this.gameTimer = GAME_TIME_LIMIT; // タイマーをセット
        const initialCharCount = Math.max(5, Math.floor(this.maxCharacters / 3));
        for (let i = 0; i < initialCharCount; i++) {
            this._spawnCharacter(true);
        }
        this.currentState = GameState.PLAYING;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_bgm');
    }

    goToGameOver() {
        console.log("[Game] Game Over.");
        this.currentState = GameState.GAME_OVER;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_over_bgm', false);

        const finalScore = this.medals;
        this.ranking.addScore(finalScore); // スコアを記録
        const currentHighScore = this.ranking.getHighScore(); // 最新のハイスコアを再取得
        const isNewHighScore = finalScore === currentHighScore && finalScore > this.highScore;

        if (isNewHighScore) {
            this.highScore = finalScore;
            console.log(`[Game] New high score: ${finalScore}`);
        }
    }

    goToRanking() {
        console.log("[Game] Go to Ranking screen.");
        this.currentState = GameState.RANKING;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('ranking_bgm');
    }

    goToTitle() {
        console.log("[Game] Go to Title screen.");
        this.currentState = GameState.TITLE;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('title_bgm');
    }

    goToDifficultySelect() {
        console.log("[Game] Go to Difficulty Select screen.");
        this.currentState = GameState.DIFFICULTY_SELECT;
    }

    _performScoop() {
        if (this.medals <= 0) {
            return;
        }
        this.medals--;
        this.soundManager.playSE('scoop_sfx');
        console.log(`[Game] Scoop performed. Medals left: ${this.medals}`);
    
        let earnedMedals = 0;
        let gotRare = false;
        let scoopedCount = 0;
        const scoopBounds = this.poi.getScoopBounds();
    
        for (let i = this.characters.length - 1; i >= 0; i--) {
            const char = this.characters[i];
            if (distance(scoopBounds.x, scoopBounds.y, char.x, char.y) <= char.getScoopRadius()) {
                const charMedals = char.type.medals;
                earnedMedals += charMedals;
                scoopedCount++;
                const floatColor = charMedals > 10 ? '#f1c40f' : (charMedals > 0 ? 'gold' : '#aaaaaa');
                const floatSize = charMedals > 10 ? 24 : (charMedals > 5 ? 20 : 16);
                this.ui.addFloatingText(`+${charMedals}`, char.x, char.y - char.getRadius(), { color: floatColor, size: floatSize });
                if (char.type.level >= 8) { gotRare = true; }
                if (char.scoopSoundId) { this.soundManager.playSE(char.scoopSoundId); }
                this.characters.splice(i, 1);
            }
        }
    
        if (earnedMedals > 0) {
            this.medals += earnedMedals;
            if (gotRare) {
                this.soundManager.playSE('rare_get_sfx');
                this.ui.addFloatingText(`超レアゲット！`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, { color: '#ff00ff', size: 36, duration: 2000, vy: -0.2 });
            } else {
                this.soundManager.playSE('medal_get_sfx', 0.8);
            }
        }
        if (scoopedCount >= 3) {
            const comboColor = scoopedCount >= 5 ? '#ff6347' : '#1abc9c';
            this.ui.addFloatingText(`すごい！ x${scoopedCount}`, this.poi.x, this.poi.y - 60, { color: comboColor, size: 28, duration: 1500 });
        }
    
        // ↓↓↓ このゲームオーバーチェックを追加・修正します ↓↓↓
        if (this.medals <= 0) {
            // goToGameOverが呼ばれる前に、次のフレームで操作ができてしまわないようにcurrentStateを先に変更する
            this.currentState = GameState.GAME_OVER; 
            this.goToGameOver();
        }
    }
    
    _spawnCharacter(isInitial = false) {
        if (this.characters.length >= this.maxCharacters) return;
        const difficulty = this.currentDifficulty;
        const levelDistribution = difficulty.levelDistribution;
        const levelRand = Math.random();
        let cumulativeRate = 0;
        let targetLevel = 1;
        for (let i = 0; i < levelDistribution.length; i++) {
            cumulativeRate += levelDistribution[i];
            if (levelRand <= cumulativeRate) {
                targetLevel = i + 1;
                break;
            }
        }
        const possibleTypes = characterTypes.filter(type => Math.abs(type.level - targetLevel) <= 1);
        if (possibleTypes.length === 0) {
            possibleTypes.push(...characterTypes.filter(type => type.level === targetLevel));
            if (possibleTypes.length === 0) possibleTypes.push(characterTypes[0]);
        }
        const totalAppearanceRate = possibleTypes.reduce((sum, type) => sum + (type.appearanceRate || 1), 0);
        let appearanceRand = Math.random() * totalAppearanceRate;
        let selectedType = possibleTypes[possibleTypes.length - 1];
        for (const type of possibleTypes) {
            if (appearanceRand < (type.appearanceRate || 1)) {
                selectedType = type;
                break;
            }
            appearanceRand -= (type.appearanceRate || 1);
        }
        const newChar = new Character(selectedType, this.assetLoader, difficulty.speedMultiplier);
        if (isInitial) {
            const margin = newChar.getRadius() + 10;
            newChar.x = getRandomFloat(margin, CANVAS_WIDTH - margin);
            newChar.y = getRandomFloat(margin, CANVAS_HEIGHT - margin);
        }
        this.characters.push(newChar);
    }

    _updateCharacters(deltaTime) {
        for (let i = this.characters.length - 1; i >= 0; i--) {
            const char = this.characters[i];
            char.update(deltaTime, this.poi.x, this.poi.y);
            if (char.isOutOfScreen()) {
                this.characters.splice(i, 1);
            }
        }
    }

    _updateSpawning(deltaTime) {
        if (this.characters.length < this.maxCharacters) {
            this.spawnTimer -= deltaTime;
            if (this.spawnTimer <= 0) {
                this._spawnCharacter();
                const baseInterval = 1800;
                const difficultyFactor = 1.0 / this.currentDifficulty.spawnRateMultiplier;
                const densityFactor = Math.max(0.2, 1.0 - (this.characters.length / this.maxCharacters));
                this.spawnTimer = baseInterval * difficultyFactor * densityFactor * getRandomFloat(0.8, 1.2);
            }
        }
    }

    update(deltaTime) {
        this.ui.update(deltaTime);
        switch (this.currentState) {
            case GameState.LOADING:
                break;
            case GameState.PLAYING:
                this.poi.update(this.mouseX, this.mouseY, this.isMouseDown, this.isMouseInCanvas);
                this._updateCharacters(deltaTime);
                this._updateSpawning(deltaTime);
                this.gameTimer -= deltaTime;
    
                if (this.gameTimer <= 0 || this.medals <= 0) {
                    if (this.currentState === GameState.PLAYING) { // 既にGAME_OVERになっていない場合のみ呼び出す
                        this.goToGameOver();
                    }
                }
                break;
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (this.currentState === GameState.PLAYING && this.isMouseInCanvas) {
            this.canvas.style.cursor = 'none';
        } else {
            this.canvas.style.cursor = 'pointer';
        }

        try {
            switch (this.currentState) {
                case GameState.LOADING:
                    this.ui.drawLoadingScreen(this.assetLoader.getProgress());
                    break;
                case GameState.TITLE:
                    this.ui.drawTitleScreen();
                    break;
                case GameState.DIFFICULTY_SELECT:
                    this.ui.drawDifficultySelectScreen();
                    break;
                case GameState.PLAYING:
                    this.ui.drawGameScreen(this.medals, this.highScore, this.gameTimer);
                    this.characters.forEach(char => char.draw(ctx));
                    this.poi.draw(ctx);
                    break;
                case GameState.GAME_OVER:
                    const finalScore = this.medals;
                    const isNewHighScore = finalScore > this.highScore;
                    this.ui.drawGameOverScreen(finalScore, this.ranking.getHighScore(), isNewHighScore);
                    break;
                case GameState.RANKING:
                    this.ui.drawRankingScreen(this.ranking.getHighScores(5));
                    break;
                default:
                    ctx.fillStyle = 'red';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Error: Unknown Game State "${this.currentState}"`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            }
        } catch (e) {
            console.error(`[Game] Error during draw state ${this.currentState}:`, e);
            ctx.fillStyle = 'red';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Render Error! Check console. (${this.currentState})`, 10, 50);
        }
    }

    gameLoop(timestamp = 0) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        const dt = (deltaTime > 0 && deltaTime < 500) ? Math.min(deltaTime, 100) : 16.67;
        try {
            this.update(dt);
            this.draw();
        } catch (error) {
            console.error("[Game] Uncaught error in game loop:", error);
        }
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// --- ゲーム開始処理 ---
window.onload = () => {
    console.log("[Main] Window loaded.");
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
        console.error("[Main] Canvas initialization failed.");
        alert("エラー: Canvasの初期化に失敗しました。");
        return;
    }
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    console.log("[Main] Canvas initialized. Creating game instance...");
    try {
        const game = new Game(canvas, ctx);
        game.init();
    } catch (error) {
        console.error("[Main] Critical error initializing game:", error);
        alert(`致命的なエラーが発生しました: ${error.message}`);
    }
};
