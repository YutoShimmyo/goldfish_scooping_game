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
// 各キャラクターの画像パスは ASSET_PATHS.IMAGES + 'ファイル名' となる
// 各キャラクターの音声パスは ASSET_PATHS.SOUNDS + 'ファイル名' となる (必要であれば)
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
    { id: 'rare_dragon', name: 'レアドラゴン', level: 10, medals: 50, speed: 2.0, avoidsPoi: true, hitRadius: 35, appearanceRate: 1, color: '#f1c40f', imageName: 'rare_dragon.png' }
    // --- ここにさらに多様なキャラクターを追加 ---
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
// 16進数カラーコードをRGB配列に変換 (エラー時は黒を返す)
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
        // audio.load(); // Safariなどで必要になる場合があるかもしれない
        this.sounds.set(id, { asset: audio, loaded: false });
    }

    _assetLoaded(id, path, success) {
        this.loadedAssets++;
        const assetData = this.images.get(id) || this.sounds.get(id);
        if (assetData) {
            assetData.loaded = success;
        }

        if (success) {
            // console.log(`[AssetLoader] Loaded: ${path}`); // 開発時デバッグ用
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

    // 画像や音声のパスを指定してロードを開始するヘルパー関数
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
        // 音声はロード失敗しても再生試行時にエラーになるだけなので、asset自体は返す
        // readyStateチェックは再生側で行う
        const sound = data ? data.asset : null;
        // 同時再生のためにクローンを返す (ロードできていない場合はnull)
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
        // ロード中の場合は _assetLoaded 内で onComplete が呼ばれる
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
        this.stopBGM(); // 既存のBGMを停止
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
        } else {
            // console.warn(`[SoundManager] SE asset not ready or not found: ${id}`); // SEは頻繁なので警告しない方が良いかも
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM();
        } else {
            // 必要であれば、ミュート解除時に直前のBGMを再開する処理
        }
        console.log(`[SoundManager] Muted: ${this.isMuted}`);
    }
}

// --- ランキングマネージャー ---
class Ranking {
    constructor(storageKey = 'medalGameRanking_v1') { // キーを変更して古いデータと競合しないように
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
        if (typeof score !== 'number' || score <= 0) return; // 無効なスコアは追加しない
        this.scores.push({ score, date: Date.now() }); // Date.now()で数値として保存
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10); // 上位10件
        this._saveScores();
    }

    getHighScores(limit = 5) {
        return this.scores.slice(0, limit).map(entry => ({
            score: entry.score,
            // 日付表示が必要な場合:
            // date: new Date(entry.date).toLocaleDateString()
        }));
    }

    getHighScore() {
        return this.scores.length > 0 ? this.scores[0].score : 0;
    }
}

// --- UI (描画関連) ---
class UI {
    constructor(ctx, assetLoader, game) { // gameへの参照を追加して状態を取得
        this.ctx = ctx;
        this.assetLoader = assetLoader;
        this.game = game; // gameオブジェクトへの参照
        this.floatingTexts = [];
        this.buttons = []; // 現在表示中のボタンリスト
    }

    // フローティングテキスト（+メダル表示など）
    addFloatingText(text, x, y, options = {}) {
        const { color = 'gold', duration = 1000, size = 20, vy = -0.5 } = options;
        const rgbColor = hexToRgb(color); // RGBA用にRGB配列を取得
        this.floatingTexts.push({
            text, x, y, rgbColor, startTime: Date.now(), duration, size, vy
        });
    }

    update(deltaTime) {
        const now = Date.now();
        this.floatingTexts = this.floatingTexts.filter(ft => {
            const elapsed = now - ft.startTime;
            if (elapsed >= ft.duration) return false;
            ft.y += ft.vy * (deltaTime / 16.67); // フレームレートに依存しない移動
            ft.alpha = 1.0 - (elapsed / ft.duration);
            return true;
        });

        // ボタンのホバー状態更新
        this.buttons.forEach(button => {
            button.hover = this._isMouseOverButton(button, this.game.mouseX, this.game.mouseY);
        });
    }

    // ボタン描画ヘルパー
    _drawButton(button) {
        const ctx = this.ctx;
        // スタイル設定
        const bgColor = button.hover ? (button.hoverBgColor || '#e0e0e0') : (button.bgColor || '#f5f5f5');
        const textColor = button.hover ? (button.hoverTextColor || '#000000') : (button.textColor || '#333333');
        const borderColor = button.borderColor || '#cccccc';
        const font = button.font || '20px Arial';

        // 背景
        ctx.fillStyle = bgColor;
        ctx.fillRect(button.x, button.y, button.width, button.height);

        // 枠線
        if(borderColor) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(button.x, button.y, button.width, button.height);
        }

        // テキスト
        ctx.fillStyle = textColor;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 2); // 少し下にずらす調整
    }

    // マウスがボタン上にあるか判定
    _isMouseOverButton(button, mouseX, mouseY) {
        return mouseX >= button.x && mouseX <= button.x + button.width &&
               mouseY >= button.y && mouseY <= button.y + button.height;
    }

    // クリックされたボタンのアクションを実行
    handleClick(mouseX, mouseY) {
        const clickedButton = this.buttons.find(button => this._isMouseOverButton(button, mouseX, mouseY));
        if (clickedButton && clickedButton.action) {
            this.game.soundManager.playSE('button_click_sfx');
            clickedButton.action();
            return true; // クリックが処理された
        }
        return false; // クリックは処理されなかった
    }

    // --- 各画面の描画 ---

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
        const bg = this.assetLoader.getImage('title_bg'); // タイトル背景画像取得
        if (bg) {
            ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.fillStyle = '#3498db'; // デフォルト背景色
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // タイトルテキストスタイル
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // メインタイトル
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('奇妙な仲間たちをすくえ！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        // サブタイトル
        ctx.font = 'bold 70px Impact, sans-serif'; // Impactがなければsans-serif
        ctx.fillStyle = '#f1c40f'; // 金色
        ctx.fillText('メダルポイポイ', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        // 開始メッセージ (点滅)
        ctx.shadowColor = 'transparent'; // 影リセット
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillText('Click or Tap to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
        }
        // ボタンリストは空
        this.buttons = [];
    }

    drawDifficultySelectScreen() {
        const ctx = this.ctx;
        ctx.fillStyle = '#2ecc71'; // 背景色
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('難易度を選んでね', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.2);

        // ボタン定義
        const btnWidth = 180;
        const btnHeight = 60;
        const btnY = CANVAS_HEIGHT / 2 - btnHeight / 2;
        const spacing = 40;
        const totalWidth = btnWidth * 3 + spacing * 2;
        const startX = (CANVAS_WIDTH - totalWidth) / 2;

        this.buttons = [
            {
                text: Difficulty.EASY.name, x: startX, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.startGame(Difficulty.EASY),
                bgColor: '#90ee90', hoverBgColor: '#7cfc00' // Easy用カラー
            },
            {
                text: Difficulty.NORMAL.name, x: startX + btnWidth + spacing, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.startGame(Difficulty.NORMAL),
                 bgColor: '#add8e6', hoverBgColor: '#87cefa' // Normal用カラー
            },
            {
                text: Difficulty.HARD.name, x: startX + (btnWidth + spacing) * 2, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.startGame(Difficulty.HARD),
                 bgColor: '#f08080', hoverBgColor: '#ff6347' // Hard用カラー
            }
        ];

        // ボタン描画
        this.buttons.forEach(button => this._drawButton(button));
    }

    drawGameScreen(medals, highScore) {
        const ctx = this.ctx;
        // 背景描画 (もしあれば)
        const bg = this.assetLoader.getImage('game_bg');
        if (bg) {
            ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.fillStyle = '#e0f7fa'; // デフォルトの水中色
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            // ここに気泡などの背景エフェクトを追加可能
        }

        // キャラクターとポイは Game クラスで描画される

        // UI情報バー
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 50);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`メダル: ${medals}`, 20, 27);

        ctx.textAlign = 'right';
        ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH - 20, 27);

        // フローティングテキスト描画
        this.floatingTexts.forEach(ft => {
            ctx.fillStyle = `rgba(${ft.rgbColor.join(',')}, ${ft.alpha})`;
            ctx.font = `bold ${ft.size}px Arial Black`; // 目立つフォント
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    drawGameOverScreen(finalMedals, highScore, isNewHighScore) {
        const ctx = this.ctx;
        // 背景は薄く表示されている想定 (Gameクラスで制御)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // 暗めのオーバーレイ
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4444'; // 赤色
        ctx.font = 'bold 80px Impact, sans-serif';
        ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(`最終メダル: ${finalMedals}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        if (isNewHighScore) {
            ctx.fillStyle = '#f1c40f'; // 金色
            ctx.font = 'bold 30px Arial';
            ctx.fillText('ハイスコア更新！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        } else {
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        }

        // ボタン定義
        const btnWidth = 180;
        const btnHeight = 50;
        const btnY = CANVAS_HEIGHT * 0.7;
        const spacing = 40;

        this.buttons = [
            {
                text: 'ランキングを見る', x: CANVAS_WIDTH / 2 - btnWidth - spacing / 2, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.goToRanking(),
                bgColor: '#3498db', hoverBgColor: '#5dade2' // 青系
            },
            {
                text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 + spacing / 2, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.goToTitle(),
                bgColor: '#95a5a6', hoverBgColor: '#bdc3c7' // グレー系
            }
        ];
        // ボタン描画
        this.buttons.forEach(button => this._drawButton(button));
    }

     drawRankingScreen(highScores) {
        const ctx = this.ctx;
        ctx.fillStyle = '#8e44ad'; // 紫背景
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ランキング', CANVAS_WIDTH / 2, 100);

        ctx.font = '24px Arial';
        if (highScores.length === 0) {
            ctx.fillText('まだ記録がありません', CANVAS_WIDTH / 2, 200);
        } else {
            highScores.forEach((entry, index) => {
                const yPos = 180 + index * 45;
                ctx.textAlign = 'left';
                ctx.fillText(`${index + 1}.`, CANVAS_WIDTH / 2 - 180, yPos);
                ctx.textAlign = 'right';
                ctx.fillText(`${entry.score} メダル`, CANVAS_WIDTH / 2 + 180, yPos);
            });
        }

        // ボタン定義
        const btnWidth = 200;
        const btnHeight = 50;
        const btnY = CANVAS_HEIGHT * 0.85;
        this.buttons = [
             {
                text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 - btnWidth / 2, y: btnY, width: btnWidth, height: btnHeight,
                action: () => this.game.goToTitle(),
                bgColor: '#bdc3c7', hoverBgColor: '#ecf0f1'
            }
        ];
        // ボタン描画
        this.buttons.forEach(button => this._drawButton(button));
    }
}

// --- ポイクラス ---
class Poi {
    constructor(assetLoader) {
        this.x = -100; // 初期位置は画面外
        this.y = -100;
        this.radius = POI_RADIUS;
        this.isDown = false; // マウスが押されているか
        this.image = assetLoader.getImage('poi'); // ポイ画像 (オプション)
        this.isVisible = false; // マウスがCanvas内にあるか
    }

    update(mouseX, mouseY, isMouseDown, isMouseInCanvas) {
        this.x = mouseX;
        this.y = mouseY;
        this.isDown = isMouseDown;
        this.isVisible = isMouseInCanvas;
    }

    draw(ctx) {
        if (!this.isVisible) return; // Canvas外なら描画しない

        if (this.image) {
            ctx.drawImage(this.image, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            // 代替描画
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.isDown ? POI_DOWN_COLOR : POI_COLOR;
            ctx.fill();
            ctx.strokeStyle = POI_RING_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 水に入っている時の波紋エフェクト
        if (this.isDown) {
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const rippleRadius = this.radius + 6 + Math.sin(Date.now() / 120) * 3;
            ctx.arc(this.x, this.y, rippleRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1; // リセット
        }
    }

    // すくい上げ判定用
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

        // 初期位置 (画面端から出現させる)
        this._setInitialPosition();

        this.baseSpeed = this.type.speed * getRandomFloat(0.8, 1.2); // 個体差
        this.speedMultiplier = difficultyMultiplier;
        this.angle = getRandomFloat(0, Math.PI * 2); // 初期角度
        this.targetAngle = this.angle;
        this.turnSpeed = 0.05 * getRandomFloat(0.8, 1.2); // 旋回速度にも個体差

        this.wanderTimer = 0;
        this.wanderInterval = getRandomFloat(1000, 3500); // 次の方向転換までの時間

        this.avoidsPoi = this.type.avoidsPoi;
        this.avoidDistance = 80 + this.getRadius(); // ポイを避ける距離
        this.isFleeing = false;

        this.scoopSoundId = this.type.scoopSoundId; // すくわれた時の固有音ID
    }

    _setInitialPosition() {
        const margin = this.getRadius() + 20; // 画面外のマージン
        const side = getRandomInt(0, 3);
        switch (side) {
            case 0: // 上
                this.x = getRandomFloat(0, CANVAS_WIDTH);
                this.y = -margin;
                break;
            case 1: // 右
                this.x = CANVAS_WIDTH + margin;
                this.y = getRandomFloat(0, CANVAS_HEIGHT);
                break;
            case 2: // 下
                this.x = getRandomFloat(0, CANVAS_WIDTH);
                this.y = CANVAS_HEIGHT + margin;
                break;
            case 3: // 左
                this.x = -margin;
                this.y = getRandomFloat(0, CANVAS_HEIGHT);
                break;
        }
    }

    getRadius() { return this.type.hitRadius || 15; }
    getScoopRadius() { return this.getRadius() * (1 + this.type.level * 0.08); } // すくわれやすさ (レベル依存)

    update(deltaTime, poiX, poiY) {
        const dtRatio = deltaTime / 16.67; // 60FPS基準の移動量補正
        const currentSpeed = this.baseSpeed * this.speedMultiplier * dtRatio;

        // --- 回避行動 ---
        this.isFleeing = false;
        if (this.avoidsPoi && distance(this.x, this.y, poiX, poiY) < this.avoidDistance) {
            this.isFleeing = true;
            this.targetAngle = Math.atan2(this.y - poiY, this.x - poiX); // ポイから離れる角度
            const fleeSpeed = currentSpeed * 1.6; // 少し速く逃げる
            // 旋回はせず、直接目標角度へ
            this.x += Math.cos(this.targetAngle) * fleeSpeed;
            this.y += Math.sin(this.targetAngle) * fleeSpeed;
            // 逃げている時はwanderしない
            this.wanderTimer = this.wanderInterval / 2; // 少し早めに次のWanderへ
        }

        // --- 通常移動 (ランダムウォーク) ---
        if (!this.isFleeing) {
            this.wanderTimer -= deltaTime;
            if (this.wanderTimer <= 0) {
                this.targetAngle = getRandomFloat(0, Math.PI * 2);
                this.wanderTimer = this.wanderInterval * getRandomFloat(0.8, 1.2);
            }

            // 目標角度へ滑らかに旋回
            let angleDiff = this.targetAngle - this.angle;
            while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            this.angle += angleDiff * this.turnSpeed * dtRatio; // フレームレート補正

            // 前進
            this.x += Math.cos(this.angle) * currentSpeed;
            this.y += Math.sin(this.angle) * currentSpeed;
        }

        // --- 画面端での反射 (少し柔らかく) ---
        const radius = this.getRadius();
        const bounceFactor = -0.8; // 跳ね返り係数 (1未満で減速)
        if (this.x < radius) {
            this.x = radius;
            this.angle = Math.PI - this.angle + getRandomFloat(-0.1, 0.1); // 少しランダム性
            this.targetAngle = this.angle;
        } else if (this.x > CANVAS_WIDTH - radius) {
            this.x = CANVAS_WIDTH - radius;
            this.angle = Math.PI - this.angle + getRandomFloat(-0.1, 0.1);
            this.targetAngle = this.angle;
        }
        if (this.y < radius) {
            this.y = radius;
            this.angle = -this.angle + getRandomFloat(-0.1, 0.1);
            this.targetAngle = this.angle;
        } else if (this.y > CANVAS_HEIGHT - radius) {
            this.y = CANVAS_HEIGHT - radius;
            this.angle = -this.angle + getRandomFloat(-0.1, 0.1);
            this.targetAngle = this.angle;
        }

        // 角度正規化
        this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // 逃げている時は少し傾けるなど、状態に応じた見た目の変化も可能
        ctx.rotate(this.angle + Math.PI / 2); // 画像は通常上が正面

        if (this.image) {
            try {
                const radius = this.getRadius();
                ctx.drawImage(this.image, -radius, -radius, radius * 2, radius * 2);
            } catch (e) {
                 console.error(`[Character] Error drawing image for ${this.type.id}:`, e);
                 this._drawFallback(ctx);
            }
        } else {
            this._drawFallback(ctx); // 画像がない or ロード失敗
        }
        ctx.restore();

        // デバッグ用: 当たり判定円
        // ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        // ctx.beginPath();
        // ctx.arc(this.x, this.y, this.getRadius(), 0, Math.PI*2);
        // ctx.stroke();
        // ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        // ctx.beginPath();
        // ctx.arc(this.x, this.y, this.getScoopRadius(), 0, Math.PI*2);
        // ctx.stroke();
    }

    // 画像がない場合の代替描画
    _drawFallback(ctx) {
         const radius = this.getRadius();
         ctx.beginPath();
         ctx.arc(0, 0, radius, 0, Math.PI * 2);
         ctx.fillStyle = this.type.color || 'gray';
         ctx.fill();
         // 目印 (進行方向)
         ctx.fillStyle = 'white';
         ctx.beginPath();
         ctx.moveTo(0, -radius * 0.6);
         ctx.lineTo(-radius * 0.3, -radius * 0.3);
         ctx.lineTo(radius * 0.3, -radius * 0.3);
         ctx.closePath();
         ctx.fill();
    }

    // 画面外に出たか判定
    isOutOfScreen() {
        const margin = this.getRadius() + 50; // 画面外判定のマージン
        return this.x < -margin || this.x > CANVAS_WIDTH + margin ||
               this.y < -margin || this.y > CANVAS_HEIGHT + margin;
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
        this.ui = new UI(this.ctx, this.assetLoader, this); // UIにGameへの参照を渡す
        this.poi = new Poi(this.assetLoader);

        this.currentState = GameState.LOADING;
        this.currentDifficulty = Difficulty.NORMAL;
        this.characters = [];
        this.medals = 0;
        this.highScore = this.ranking.getHighScore();

        // 入力状態
        this.isMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseInCanvas = false;

        // 時間管理
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.maxCharacters = MAX_CHARACTERS_DEFAULT;

        this._setupEventHandlers();
        console.log("[Game] Game instance created. Waiting for initialization.");
    }

    // --- 初期化 ---
    init() {
        console.log("[Game] Initializing...");
        this.currentState = GameState.LOADING;
        this._loadRequiredAssets(() => {
            console.log("[Game] Assets loaded. Proceeding to Title.");
            this.currentState = GameState.TITLE;
            this.soundManager.playBGM('title_bgm');
        });
        // ローディング表示のために先にループ開始
        this.gameLoop();
    }

    _loadRequiredAssets(onComplete) {
        console.log("[Game] Loading required assets...");
        // --- 画像ロード ---
        this.assetLoader.loadImage('title_bg', 'title_background.png'); // オプション
        this.assetLoader.loadImage('game_bg', 'game_background.png'); // オプション
        // this.assetLoader.loadImage('poi', 'poi.png'); // ポイ画像 (オプション)
        characterTypes.forEach(type => {
            if (type.imageName) {
                this.assetLoader.loadImage(type.id, type.imageName);
            }
        });

        // --- 音声ロード ---
        // BGM
        this.assetLoader.loadSound('title_bgm', 'title_bgm.mp3');
        this.assetLoader.loadSound('game_bgm', 'game_bgm.mp3');
        this.assetLoader.loadSound('game_over_bgm', 'game_over.mp3');
        this.assetLoader.loadSound('ranking_bgm', 'ranking.mp3');
        // SE
        this.assetLoader.loadSound('scoop_sfx', 'scoop.wav'); // メダル消費音
        this.assetLoader.loadSound('medal_get_sfx', 'medal_get.wav'); // メダル獲得 (通常)
        this.assetLoader.loadSound('rare_get_sfx', 'rare_get.wav');   // メダル獲得 (レア)
        this.assetLoader.loadSound('poi_in_sfx', 'poi_in.wav');     // ポイ入水
        this.assetLoader.loadSound('button_click_sfx', 'button_click.wav');
        // キャラ固有SE (必要なら)
        this.assetLoader.loadSound('ojisan_voice', 'ojisan_voice.wav');

        // ロード開始 & 完了時のコールバック設定
        this.assetLoader.start(onComplete);
    }

    // --- イベントハンドラ設定 ---
    _setupEventHandlers() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this._handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseenter', () => this.isMouseInCanvas = true);
        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseInCanvas = false;
            this.isMouseDown = false; // Canvas外に出たらドラッグ解除
        });

        // Touch Events (簡易対応)
        this.canvas.addEventListener('touchstart', this._handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: false });

        // ウィンドウリサイズ対応など、必要に応じて追加
    }

    // --- 入力処理ハンドラ ---
    _handleMouseDown(e) {
        e.preventDefault();
        this._updateMousePosition(e);

        switch (this.currentState) {
            case GameState.TITLE:
                this.goToDifficultySelect();
                break;
            case GameState.DIFFICULTY_SELECT:
            case GameState.GAME_OVER:
            case GameState.RANKING:
                this.ui.handleClick(this.mouseX, this.mouseY);
                break;
            case GameState.PLAYING:
                if (this.medals > 0) { // メダルがある時のみ
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
        this._updateMousePosition(touch); // mouseX/Yを更新
        this.isMouseInCanvas = true; // タッチ開始でCanvas内とみなす
        this._handleMouseDown(touch); // mousedown処理を呼び出す
    }
    _handleTouchEnd(e) {
        e.preventDefault();
        // touchendでは座標が取れないことがあるので、mouseup処理のみ
        this._handleMouseUp({}); // 空のイベントオブジェクトでmouseup処理
        this.isMouseInCanvas = false; // タッチ終了でCanvas外扱い（ポイを消すため）
    }
    _handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this._updateMousePosition(touch); // mouseX/Yを更新
        // mousemove処理はPoi更新で使われるので直接呼び出さない
    }


    _updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = (e.clientX || 0) - rect.left; // e.clientX がない場合(touchendなど)は0
        this.mouseY = (e.clientY || 0) - rect.top;
    }


    // --- ゲーム状態遷移 ---
    startGame(difficulty) {
        console.log(`[Game] Starting game with difficulty: ${difficulty.name}`);
        this.currentDifficulty = difficulty;
        this.medals = difficulty.initialMedals;
        this.highScore = this.ranking.getHighScore(); // 最新のハイスコアを取得
        this.characters = [];
        this.spawnTimer = 1000; // 最初のスポーンまでの時間
        this.maxCharacters = MAX_CHARACTERS_DEFAULT + difficulty.maxCharsModifier;
        this.ui.floatingTexts = []; // フローティングテキスト初期化

        // 初期キャラクター配置
        const initialCharCount = Math.max(5, Math.floor(this.maxCharacters / 3));
        for (let i = 0; i < initialCharCount; i++) {
            this._spawnCharacter(true); // isInitial=true で画面内に配置
        }

        this.currentState = GameState.PLAYING;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_bgm');
    }

    goToGameOver() {
        console.log("[Game] Game Over.");
        this.currentState = GameState.GAME_OVER;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_over_bgm', false); // ループなし

        // スコア記録 (最終メダル数が0未満にならないように)
        const finalScore = Math.max(0, this.medals);
        const isNewHighScore = finalScore > this.highScore;
        if (isNewHighScore) {
            this.ranking.addScore(finalScore);
            this.highScore = finalScore; // UI表示用に更新
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
        // BGMはタイトル画面のものを継続、または専用BGMを再生
    }

    // --- ゲームロジック ---
    _performScoop() {
        if (this.medals <= 0) { // すくい上げ開始時にメダルがあっても、処理中に0になった場合の保険
             console.log("[Game] Cannot scoop, no medals left.");
             // 必要なら「メダルが足りません」的な音や表示
             return;
        }

        this.medals--; // メダル消費
        this.soundManager.playSE('scoop_sfx');
        console.log(`[Game] Scoop performed. Medals left: ${this.medals}`);

        let earnedMedals = 0;
        let gotRare = false;
        let scoopedCount = 0;
        const scoopBounds = this.poi.getScoopBounds();

        // すくい判定
        for (let i = this.characters.length - 1; i >= 0; i--) {
            const char = this.characters[i];
            // ポイの中心とキャラの中心の距離で判定 (キャラのすくわれ判定半径を使用)
            if (distance(scoopBounds.x, scoopBounds.y, char.x, char.y) <= char.getScoopRadius()) {
                const charMedals = char.type.medals;
                earnedMedals += charMedals;
                scoopedCount++;
                console.log(`[Game] Scooped: ${char.type.name} (+${charMedals} medals)`);

                // 獲得演出
                const floatColor = charMedals > 10 ? '#f1c40f' : (charMedals > 0 ? 'gold' : '#aaaaaa');
                const floatSize = charMedals > 10 ? 24 : (charMedals > 5 ? 20 : 16);
                this.ui.addFloatingText(`+${charMedals}`, char.x, char.y - char.getRadius(), { color: floatColor, size: floatSize });

                // レアキャラ判定 (レベル8以上など)
                if (char.type.level >= 8) {
                    gotRare = true;
                }

                // 固有のすくい音があれば再生
                if(char.scoopSoundId) {
                    this.soundManager.playSE(char.scoopSoundId);
                }

                // キャラクター削除
                this.characters.splice(i, 1);
            }
        }

        // メダル獲得処理と効果音
        if (earnedMedals > 0) {
            this.medals += earnedMedals;
            console.log(`[Game] Earned ${earnedMedals} medals. Total: ${this.medals}`);
            if (gotRare) {
                this.soundManager.playSE('rare_get_sfx');
                // レアゲット専用演出（画面フラッシュなど）
                 this.ui.addFloatingText(`超レアゲット！`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, { color: '#ff00ff', size: 36, duration: 2000, vy: -0.2 });
            } else {
                this.soundManager.playSE('medal_get_sfx', 0.8); // 通常獲得音は少し音量抑えめかも
            }
        }

        // 大量ゲット演出 (3体以上)
        if (scoopedCount >= 3) {
            console.log(`[Game] Multi scoop bonus! x${scoopedCount}`);
            const comboColor = scoopedCount >= 5 ? '#ff6347' : '#1abc9c'; // 5体以上はさらに派手な色
            this.ui.addFloatingText(`すごい！ x${scoopedCount}`, this.poi.x, this.poi.y - 60, { color: comboColor, size: 28, duration: 1500 });
        }

        // ゲームオーバーチェック
        if (this.medals <= 0) {
            console.log("[Game] Medals reached zero after scoop.");
            this.goToGameOver();
        }
    }

    _spawnCharacter(isInitial = false) {
        if (this.characters.length >= this.maxCharacters) return; // 上限チェック

        // --- キャラクタータイプの抽選ロジック ---
        const difficulty = this.currentDifficulty;
        const levelDistribution = difficulty.levelDistribution;
        const levelRand = Math.random();
        let cumulativeRate = 0;
        let targetLevel = 1;
        for (let i = 0; i < levelDistribution.length; i++) {
            cumulativeRate += levelDistribution[i];
            if (levelRand <= cumulativeRate) {
                targetLevel = i + 1; // レベルは1から
                break;
            }
        }

        // ターゲットレベルに近いキャラクターを候補にする (例: ±1レベル)
        const possibleTypes = characterTypes.filter(type => Math.abs(type.level - targetLevel) <= 1);
        if (possibleTypes.length === 0) { // 候補がいない場合 (定義が少ない場合など)
             possibleTypes.push(...characterTypes.filter(type => type.level === targetLevel)); // 完全一致を探す
             if (possibleTypes.length === 0) possibleTypes.push(characterTypes[0]); // それでもなければ最初のキャラ
        }

        // 出現率(appearanceRate)に基づいて最終決定
        const totalAppearanceRate = possibleTypes.reduce((sum, type) => sum + (type.appearanceRate || 1), 0);
        let appearanceRand = Math.random() * totalAppearanceRate;
        let selectedType = possibleTypes[possibleTypes.length - 1]; // デフォルト
        for (const type of possibleTypes) {
            if (appearanceRand < (type.appearanceRate || 1)) {
                selectedType = type;
                break;
            }
            appearanceRand -= (type.appearanceRate || 1);
        }
        // --- 抽選ロジックここまで ---

        const newChar = new Character(selectedType, this.assetLoader, difficulty.speedMultiplier);

        // 初期配置の場合、画面内にランダムに配置
        if (isInitial) {
            const margin = newChar.getRadius() + 10;
            newChar.x = getRandomFloat(margin, CANVAS_WIDTH - margin);
            newChar.y = getRandomFloat(margin, CANVAS_HEIGHT - margin);
        }

        this.characters.push(newChar);
        // console.log(`[Game] Spawned: ${selectedType.name} (Total: ${this.characters.length})`); // スポーンログ（デバッグ用）
    }

    _updateCharacters(deltaTime) {
        for (let i = this.characters.length - 1; i >= 0; i--) {
            const char = this.characters[i];
            char.update(deltaTime, this.poi.x, this.poi.y);

            // 画面外に出たキャラは削除 (パフォーマンスのため)
            if (char.isOutOfScreen()) {
                this.characters.splice(i, 1);
                // console.log(`[Game] Character removed (out of screen). Total: ${this.characters.length}`);
            }
        }
    }

    _updateSpawning(deltaTime) {
        if (this.characters.length < this.maxCharacters) {
            this.spawnTimer -= deltaTime;
            if (this.spawnTimer <= 0) {
                this._spawnCharacter();
                // 次のスポーンまでの時間を計算 (基本間隔 * 難易度補正 * 密度補正 * ランダム)
                const baseInterval = 1800; // ミリ秒
                const difficultyFactor = 1.0 / this.currentDifficulty.spawnRateMultiplier;
                const densityFactor = Math.max(0.2, 1.0 - (this.characters.length / this.maxCharacters)); // 密度が高いほど間隔長く
                this.spawnTimer = baseInterval * difficultyFactor * densityFactor * getRandomFloat(0.8, 1.2);
            }
        }
    }

    // --- 更新処理 ---
    update(deltaTime) {
        this.ui.update(deltaTime); // UI要素のアニメーション（フローティングテキストなど）

        switch (this.currentState) {
            case GameState.LOADING:
                // ローディング中は特に何もしない (描画のみ)
                break;
            case GameState.PLAYING:
                this.poi.update(this.mouseX, this.mouseY, this.isMouseDown, this.isMouseInCanvas);
                this._updateCharacters(deltaTime);
                this._updateSpawning(deltaTime);
                 // ゲームオーバー条件チェック (メダル0で、かつマウスが上がっている状態)
                 if (this.medals <= 0 && !this.isMouseDown) {
                     this.goToGameOver();
                 }
                break;
            // 他の画面（タイトル、選択など）のアニメーション等があればここに追加
        }
    }

    // --- 描画処理 ---
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // 画面クリア

        try { // 描画エラーでループが止まらないように
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
                    this.ui.drawGameScreen(this.medals, this.highScore); // 背景とUIバー
                    this.characters.forEach(char => char.draw(ctx));   // キャラクター描画
                    this.poi.draw(ctx);                                // ポイ描画 (最前面)
                    break;
                case GameState.GAME_OVER:
                    // ゲーム画面を背景として薄く描画
                    this.ui.drawGameScreen(this.medals, this.highScore); // 背景とUIバー
                    this.characters.forEach(char => char.draw(ctx));   // キャラクター描画
                    // ポイは描画しない
                    // ゲームオーバーUIを上書き描画
                    const finalScore = Math.max(0, this.medals);
                    const isNewHighScore = finalScore > this.ranking.scores.find(s => s.score === this.highScore)?.score; // TODO: この判定改善の余地あり
                    this.ui.drawGameOverScreen(finalScore, this.highScore, isNewHighScore);
                    break;
                case GameState.RANKING:
                    this.ui.drawRankingScreen(this.ranking.getHighScores());
                    break;
                default:
                    // 未知の状態の場合のエラー表示
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

    // --- メインループ ---
    gameLoop(timestamp = 0) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        // deltaTime が異常値（タブ非アクティブからの復帰など）の場合の対策
        const dt = (deltaTime > 0 && deltaTime < 500) ? Math.min(deltaTime, 100) : 16.67; // 500ms以上空いたら1フレーム分(60fps)とする

        try {
            this.update(dt);
            this.draw();
        } catch (error) {
            console.error("[Game] Uncaught error in game loop:", error);
            // ここでループを停止することも検討できる
            // return;
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
        console.error("[Main] Canvas initialization failed. Element 'gameCanvas' not found or context unavailable.");
        alert("エラー: ゲームの描画に必要なCanvas要素が見つからないか、初期化に失敗しました。");
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    console.log("[Main] Canvas initialized. Creating game instance...");

    try {
        const game = new Game(canvas, ctx);
        game.init(); // ゲーム初期化とループ開始
    } catch (error) {
        console.error("[Main] Critical error initializing game:", error);
        alert(`致命的なエラーが発生しました: ${error.message}`);
    }
};
