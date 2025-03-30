// グローバル定数
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const POI_RADIUS = 40; // ポイの半径
const POI_COLOR = 'rgba(255, 255, 255, 0.5)'; // ポイの色（半透明の白）
const POI_RING_COLOR = 'red'; // ポイの枠の色
const POI_DOWN_COLOR = 'rgba(220, 220, 255, 0.6)'; // 水に入れた時の色

// ゲーム状態
const GameState = {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    DIFFICULTY_SELECT: 'DIFFICULTY_SELECT',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
    RANKING: 'RANKING'
};

// 難易度設定
const Difficulty = {
    EASY: { name: 'かんたん', initialMedals: 15, speedMultiplier: 0.8, spawnRateMultiplier: 1.2, levelDistribution: [0.5, 0.3, 0.15, 0.04, 0.01] }, // レベル1～5の出現割合
    NORMAL: { name: 'ふつう', initialMedals: 10, speedMultiplier: 1.0, spawnRateMultiplier: 1.0, levelDistribution: [0.4, 0.3, 0.2, 0.08, 0.02] },
    HARD: { name: 'むずかしい', initialMedals: 5, speedMultiplier: 1.3, spawnRateMultiplier: 0.8, levelDistribution: [0.3, 0.25, 0.25, 0.15, 0.05] }
};

// --- ユーティリティ関数 ---
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
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

// --- アセット（画像・音声）管理 ---
class AssetLoader {
    constructor() {
        this.images = {};
        this.sounds = {};
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.onComplete = null;
    }

    addImage(id, path) {
        this.totalAssets++;
        const img = new Image();
        img.onload = () => this._assetLoaded();
        img.onerror = () => {
            console.error(`Failed to load image: ${path}`);
            this._assetLoaded(); // エラーでもカウントは進める
        };
        img.src = path;
        this.images[id] = img;
    }

    addSound(id, path) {
        this.totalAssets++;
        const audio = new Audio();
        // 'canplaythrough' イベントでロード完了を判定
        audio.oncanplaythrough = () => this._assetLoaded();
        audio.onerror = () => {
            console.error(`Failed to load sound: ${path}`);
            this._assetLoaded(); // エラーでもカウントは進める
        };
        audio.src = path;
        this.sounds[id] = audio;
    }

    _assetLoaded() {
        this.loadedAssets++;
        if (this.loadedAssets === this.totalAssets && this.onComplete) {
            this.onComplete();
        }
    }

    getImage(id) {
        return this.images[id];
    }

    getSound(id) {
        // サウンド再生時にクローンを作成して同時再生に対応
        const sound = this.sounds[id];
        return sound ? sound.cloneNode() : null;
    }

    startLoading(onComplete) {
        this.onComplete = onComplete;
        if (this.totalAssets === 0) { // 読み込むアセットがない場合
            onComplete();
        }
    }

    getLoadingProgress() {
        if (this.totalAssets === 0) return 1;
        return this.loadedAssets / this.totalAssets;
    }
}

// --- サウンド管理 ---
class SoundManager {
    constructor(assetLoader) {
        this.assetLoader = assetLoader;
        this.bgm = null;
        this.isMuted = false; // 消音機能（オプション）
    }

    playBGM(id, loop = true) {
        if (this.isMuted) return;
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        this.bgm = this.assetLoader.getSound(id);
        if (this.bgm) {
            this.bgm.loop = loop;
            this.bgm.play().catch(e => console.warn("BGM play failed:", e)); // 自動再生ポリシー対策
        }
    }

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        this.bgm = null;
    }

    playSE(id) {
        if (this.isMuted) return;
        const se = this.assetLoader.getSound(id);
        if (se) {
            se.play().catch(e => console.warn("SE play failed:", e));
        }
    }

    // 消音切り替えなどのメソッドを追加可能
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM(); // ミュート時にBGM停止
        } else {
            // 必要なら直前のBGMを再開するロジック
        }
    }
}

// --- ランキング管理 ---
class Ranking {
    constructor(storageKey = 'medalGameRanking') {
        this.storageKey = storageKey;
        this.scores = this._loadScores();
    }

    _loadScores() {
        try {
            const storedScores = localStorage.getItem(this.storageKey);
            return storedScores ? JSON.parse(storedScores) : [];
        } catch (e) {
            console.error("Failed to load scores from localStorage:", e);
            return [];
        }
    }

    _saveScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch (e) {
            console.error("Failed to save scores to localStorage:", e);
        }
    }

    addScore(score) {
        // 名前入力は今回省略し、スコアのみ記録
        this.scores.push({ score: score, date: new Date().toISOString() });
        // スコアで降順ソート
        this.scores.sort((a, b) => b.score - a.score);
        // 上位10件のみ保持（例）
        this.scores = this.scores.slice(0, 10);
        this._saveScores();
    }

    getHighScores(limit = 5) {
        return this.scores.slice(0, limit);
    }

    getHighScore() {
        return this.scores.length > 0 ? this.scores[0].score : 0;
    }
}

// --- UI管理 ---
class UI {
    constructor(ctx, assetLoader) {
        this.ctx = ctx;
        this.assetLoader = assetLoader;
        this.floatingTexts = []; // [+メダル] などの演出用
    }

    // フローティングテキストを追加
    addFloatingText(text, x, y, color = 'gold', duration = 1000, size = 20) {
        this.floatingTexts.push({ text, x, y, color, startTime: Date.now(), duration, size });
    }

    // UI要素の更新（アニメーションなど）
    update(deltaTime) {
        const now = Date.now();
        this.floatingTexts = this.floatingTexts.filter(ft => {
            const elapsed = now - ft.startTime;
            if (elapsed >= ft.duration) return false;
            // 少し上に移動させる
            ft.y -= 0.5 * (deltaTime / 16); // deltaTimeに応じて移動量を調整
            // 徐々に透過させる
            ft.alpha = 1.0 - (elapsed / ft.duration);
            return true;
        });
    }

    // ゲームプレイ中のUIを描画
    drawGameUI(medals, highScore) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, 50); // 上部バー

        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`メダル: ${medals}`, 20, 35);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH - 20, 35);

        // フローティングテキストを描画
        this.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = `rgba(${this._hexToRgb(ft.color)}, ${ft.alpha})`;
            this.ctx.font = `${ft.size}px Arial Black`; // 目立つフォント
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    // タイトル画面描画
    drawTitleScreen() {
        this.ctx.fillStyle = '#3498db'; // 明るい青
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 背景画像があれば描画
        const bg = this.assetLoader.getImage('title_bg');
        if (bg) {
            this.ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;
        this.ctx.fillText('奇妙な仲間たちをすくえ！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
        this.ctx.font = 'bold 60px Impact'; // インパクトのあるフォント
        this.ctx.fillStyle = '#f1c40f'; // 金色
        this.ctx.fillText('メダルポイポイ', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        this.ctx.shadowColor = 'transparent'; // 影をリセット
        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        // 点滅するテキスト（簡易実装）
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            this.ctx.fillText('Click or Tap to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.7);
        }
    }

    // 難易度選択画面描画
    drawDifficultySelectScreen(buttons) {
        this.ctx.fillStyle = '#2ecc71'; // 緑色
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('難易度を選んでね', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);

        // ボタンを描画
        buttons.forEach(button => {
            this.ctx.fillStyle = button.hover ? '#bdc3c7' : '#ecf0f1'; // ホバー色変更
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        });
    }

    // ゲームオーバー画面描画
    drawGameOverScreen(finalMedals, highScore, isNewHighScore, buttons) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 半透明の黒でオーバーレイ
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 72px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        this.ctx.font = '36px Arial';
        this.ctx.fillText(`最終メダル: ${finalMedals}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        if (isNewHighScore) {
            this.ctx.fillStyle = '#f1c40f'; // 金色
            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillText('ハイスコア更新！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
            this.ctx.fillStyle = 'white'; // 色を戻す
        } else {
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`ハイスコア: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        }

        // ボタンを描画
        buttons.forEach(button => {
             this.ctx.fillStyle = button.hover ? '#95a5a6' : '#7f8c8d'; // ホバー色変更
             this.ctx.fillRect(button.x, button.y, button.width, button.height);
             this.ctx.fillStyle = 'white';
             this.ctx.font = '20px Arial';
             this.ctx.textAlign = 'center';
             this.ctx.textBaseline = 'middle';
             this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        });
    }

     // ランキング画面描画
    drawRankingScreen(highScores, buttons) {
        this.ctx.fillStyle = '#8e44ad'; // 紫色
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ランキング', CANVAS_WIDTH / 2, 100);

        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        if (highScores.length === 0) {
            this.ctx.fillText('まだ記録がありません', CANVAS_WIDTH / 2, 200);
        } else {
            highScores.forEach((entry, index) => {
                const yPos = 180 + index * 40;
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`${index + 1}.`, CANVAS_WIDTH / 2 - 150, yPos);
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${entry.score} メダル`, CANVAS_WIDTH / 2 + 150, yPos);
                // 日付表示 (オプション)
                // const date = new Date(entry.date).toLocaleDateString();
                // this.ctx.textAlign = 'center';
                // this.ctx.fillText(date, CANVAS_WIDTH / 2 + 200, yPos);
            });
        }

        // ボタンを描画
        buttons.forEach(button => {
            this.ctx.fillStyle = button.hover ? '#ecf0f1' : '#bdc3c7'; // ホバー色変更
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        });
    }

    // ローディング画面描画
    drawLoadingScreen(progress) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        // プログレスバー
        const barWidth = 300;
        const barHeight = 20;
        const barX = (CANVAS_WIDTH - barWidth) / 2;
        const barY = CANVAS_HEIGHT / 2;
        this.ctx.strokeStyle = 'white';
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }

    // 16進数カラーコードをRGBオブジェクトに変換
    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
                      : '0, 0, 0'; // デフォルトは黒
    }
}

// --- ポイクラス ---
class Poi {
    constructor(x, y, radius, assetLoader) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.isDown = false; // 水に入っているか
        this.assetLoader = assetLoader;
        // ポイの画像を使う場合
        // this.image = this.assetLoader.getImage('poi_image');
    }

    update(mouseX, mouseY, isMouseDown) {
        this.x = mouseX;
        this.y = mouseY;
        this.isDown = isMouseDown;
    }

    draw(ctx) {
        // 画像があれば画像を描画
        // if (this.image) {
        //     ctx.drawImage(this.image, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        // } else {
            // 画像がない場合は円で描画
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.isDown ? POI_DOWN_COLOR : POI_COLOR;
            ctx.fill();
            ctx.strokeStyle = POI_RING_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.lineWidth = 1; // 他の描画のためにリセット
        // }

        // 水に入っているエフェクト（波紋など）
        if (this.isDown) {
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    // 指定した座標がポイの中にあるか判定（すくい上げ用）
    contains(x, y) {
        return distance(this.x, this.y, x, y) <= this.radius;
    }
}

// --- キャラクタークラス ---
class Character {
    constructor(type, assetLoader, difficultyMultiplier = 1) {
        this.type = type;
        this.assetLoader = assetLoader;
        this.image = this.assetLoader.getImage(this.type.id);
        this.x = getRandomInt(0, CANVAS_WIDTH);
        this.y = getRandomInt(0, CANVAS_HEIGHT);
        // 初期位置を画面外周にすることも可能
        // const side = getRandomInt(0, 3);
        // if (side === 0) { this.x = -this.getRadius(); this.y = getRandomInt(0, CANVAS_HEIGHT); } // Left
        // else if (side === 1) { this.x = CANVAS_WIDTH + this.getRadius(); this.y = getRandomInt(0, CANVAS_HEIGHT); } // Right
        // else if (side === 2) { this.x = getRandomInt(0, CANVAS_WIDTH); this.y = -this.getRadius(); } // Top
        // else { this.x = getRandomInt(0, CANVAS_WIDTH); this.y = CANVAS_HEIGHT + this.getRadius(); } // Bottom

        this.baseSpeed = this.type.speed * getRandomFloat(0.8, 1.2); // 個体差
        this.speedMultiplier = difficultyMultiplier;
        this.angle = getRandomFloat(0, Math.PI * 2);
        this.targetAngle = this.angle;
        this.turnSpeed = 0.05; // 方向転換の速さ
        this.wanderTimer = 0;
        this.wanderInterval = getRandomFloat(1000, 3000); // 次の方向転換までの時間

        this.avoidsPoi = this.type.avoidsPoi;
        this.avoidDistance = 100 + this.getRadius(); // ポイを避ける距離
        this.isFleeing = false;
    }

    getRadius() {
        // 画像があれば画像のサイズから、なければhitRadiusから算出
        return this.type.hitRadius || 20;
    }

    getScoopRadius() {
        // すくわれ判定半径 (レベルに応じて大きく)
        return this.getRadius() * (1 + this.type.level * 0.1);
    }

    update(deltaTime, poiX, poiY) {
        const dtSeconds = deltaTime / 1000;
        const currentSpeed = this.baseSpeed * this.speedMultiplier * 60 * dtSeconds; // 60FPS基準の速度に調整

        // --- 回避行動 ---
        this.isFleeing = false;
        if (this.avoidsPoi) {
            const distToPoi = distance(this.x, this.y, poiX, poiY);
            if (distToPoi < this.avoidDistance) {
                this.isFleeing = true;
                // ポイから離れる角度を設定
                this.targetAngle = Math.atan2(this.y - poiY, this.x - poiX);
                // 少し速く逃げる
                 const fleeSpeed = currentSpeed * 1.5;
                 this.x += Math.cos(this.targetAngle) * fleeSpeed;
                 this.y += Math.sin(this.targetAngle) * fleeSpeed;
            }
        }

        // --- 通常移動 (ランダムウォーク) ---
        if (!this.isFleeing) {
            this.wanderTimer -= deltaTime;
            if (this.wanderTimer <= 0) {
                // 新しい目標角度をランダムに設定
                this.targetAngle = getRandomFloat(0, Math.PI * 2);
                this.wanderTimer = this.wanderInterval;
                // 稀に一時停止する
                // if (Math.random() < 0.1) this.wanderTimer *= 2; // 例
            }

            // 目標角度に滑らかに近づける
            let angleDiff = this.targetAngle - this.angle;
            while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            this.angle += angleDiff * this.turnSpeed;

            this.x += Math.cos(this.angle) * currentSpeed;
            this.y += Math.sin(this.angle) * currentSpeed;
        }


        // --- 画面端での反射 ---
        const radius = this.getRadius();
        if (this.x < radius) {
            this.x = radius;
            this.angle = Math.PI - this.angle; // 反射
            this.targetAngle = this.angle; // 目標も更新
        } else if (this.x > CANVAS_WIDTH - radius) {
            this.x = CANVAS_WIDTH - radius;
            this.angle = Math.PI - this.angle;
            this.targetAngle = this.angle;
        }
        if (this.y < radius) {
            this.y = radius;
            this.angle = -this.angle; // 反射
            this.targetAngle = this.angle;
        } else if (this.y > CANVAS_HEIGHT - radius) {
            this.y = CANVAS_HEIGHT - radius;
            this.angle = -this.angle;
            this.targetAngle = this.angle;
        }

        // 角度を正規化 (-PI から PI の範囲に)
        while (this.angle <= -Math.PI) this.angle += Math.PI * 2;
        while (this.angle > Math.PI) this.angle -= Math.PI * 2;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2); // 画像が上向きの場合、進行方向に合わせる

        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            const radius = this.getRadius();
            ctx.drawImage(this.image, -radius, -radius, radius * 2, radius * 2);
        } else {
            // 画像がない場合の代替描画 (色付きの円)
            ctx.beginPath();
            ctx.arc(0, 0, this.getRadius(), 0, Math.PI * 2);
            ctx.fillStyle = this.type.color || 'gray'; // タイプに定義された色、なければグレー
            ctx.fill();
            // 目印（進行方向を示す）
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(0, -this.getRadius() * 0.6);
            ctx.lineTo(-this.getRadius() * 0.3, -this.getRadius() * 0.3);
            ctx.lineTo(this.getRadius() * 0.3, -this.getRadius() * 0.3);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // デバッグ用: 当たり判定円表示
        // ctx.strokeStyle = 'red';
        // ctx.beginPath();
        // ctx.arc(this.x, this.y, this.getRadius(), 0, Math.PI*2);
        // ctx.stroke();
        // ctx.strokeStyle = 'blue';
        // ctx.beginPath();
        // ctx.arc(this.x, this.y, this.getScoopRadius(), 0, Math.PI*2);
        // ctx.stroke();
    }
}

// --- キャラクターデータ定義 ---
// ★画像パスは実際のファイルに合わせてください
const characterTypes = [
    { id: 'wakin', name: '和金', level: 1, medals: 1, speed: 1.0, avoidsPoi: false, hitRadius: 15, appearanceRate: 30, imagePath: 'images/wakin.png', color: '#e74c3c' },
    { id: 'demekin', name: '出目金', level: 2, medals: 3, speed: 0.8, avoidsPoi: false, hitRadius: 18, appearanceRate: 20, imagePath: 'images/demekin.png', color: '#34495e' },
    { id: 'ryukin', name: '琉金', level: 3, medals: 5, speed: 1.2, avoidsPoi: true, hitRadius: 20, appearanceRate: 15, imagePath: 'images/ryukin.png', color: '#f39c12' },
    { id: 'ranchu', name: 'らんちゅう', level: 4, medals: 8, speed: 0.7, avoidsPoi: false, hitRadius: 22, appearanceRate: 10, imagePath: 'images/ranchu.png', color: '#e67e22' },
    { id: 'koi', name: '錦鯉', level: 5, medals: 12, speed: 1.5, avoidsPoi: true, hitRadius: 25, appearanceRate: 7, imagePath: 'images/koi.png', color: '#ecf0f1' },
    { id: 'zarigani', name: 'ザリガニ', level: 3, medals: 4, speed: 0.9, avoidsPoi: false, hitRadius: 20, appearanceRate: 10, imagePath: 'images/zarigani.png', color: '#c0392b' },
    { id: 'slime', name: 'スライム', level: 2, medals: 2, speed: 0.6, avoidsPoi: false, hitRadius: 18, appearanceRate: 15, imagePath: 'images/slime.png', color: '#3498db' },
    { id: 'baby', name: '赤ちゃん', level: 1, medals: 1, speed: 0.5, avoidsPoi: false, hitRadius: 16, appearanceRate: 10, imagePath: 'images/baby.png', color: '#f C9a7' },
    { id: 'ojisan', name: 'おじさん', level: 6, medals: 15, speed: 1.3, avoidsPoi: true, hitRadius: 28, appearanceRate: 5, imagePath: 'images/ojisan.png', color: '#bdc3c7' },
    { id: 'brick', name: 'レンガ', level: 1, medals: 0, speed: 0.1, avoidsPoi: false, hitRadius: 20, appearanceRate: 5, imagePath: 'images/brick.png', color: '#a0522d' }, // すくっても得点なし
    { id: 'rare_dragon', name: 'レアドラン', level: 10, medals: 50, speed: 2.0, avoidsPoi: true, hitRadius: 35, appearanceRate: 1, imagePath: 'images/rare_dragon.png', color: '#f1c40f' }
    // --- もっとたくさん追加！ ---
];

// --- ゲーム本体クラス ---
class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assetLoader = new AssetLoader();
        this.soundManager = new SoundManager(this.assetLoader);
        this.ranking = new Ranking();
        this.ui = new UI(this.ctx, this.assetLoader);
        this.poi = new Poi(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, POI_RADIUS, this.assetLoader);

        this.currentState = GameState.LOADING;
        this.currentDifficulty = Difficulty.NORMAL;
        this.characters = [];
        this.medals = 0;
        this.highScore = this.ranking.getHighScore();
        this.isMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;

        this.lastTime = 0;
        this.spawnTimer = 0;
        this.maxCharacters = 20; // 同時出現数の上限

        this.difficultyButtons = [];
        this.gameOverButtons = [];
        this.rankingButtons = [];

        this._setupInputHandlers();
    }

    // --- 初期化・ロード ---
    init() {
        this.currentState = GameState.LOADING;
        this._loadAssets(() => {
            this.currentState = GameState.TITLE;
            this.soundManager.playBGM('title_bgm'); // タイトルBGM再生
            this.gameLoop(); // ロード完了後ゲームループ開始
        });
        // ローディング中も描画ループは動かす
        this.gameLoop();
    }

    _loadAssets(onComplete) {
        console.log("Loading assets...");
        // 画像ファイルのロード
        this.assetLoader.addImage('title_bg', 'images/title_background.png'); // タイトル背景 (オプション)
        this.assetLoader.addImage('game_bg', 'images/game_background.png'); // ゲーム背景 (オプション)
        // this.assetLoader.addImage('poi_image', 'images/poi.png'); // ポイ画像 (オプション)
        characterTypes.forEach(type => {
            if (type.imagePath) {
                this.assetLoader.addImage(type.id, type.imagePath);
            }
        });

        // 音声ファイルのロード (★パスは適宜変更)
        this.assetLoader.addSound('title_bgm', 'sounds/title_bgm.mp3');
        this.assetLoader.addSound('game_bgm', 'sounds/game_bgm.mp3');
        this.assetLoader.addSound('game_over_bgm', 'sounds/game_over.mp3');
        this.assetLoader.addSound('ranking_bgm', 'sounds/ranking.mp3');
        this.assetLoader.addSound('scoop_sfx', 'sounds/scoop.wav'); // すくう音（メダル消費音）
        this.assetLoader.addSound('medal_get_sfx', 'sounds/medal_get.wav'); // メダル獲得音
        this.assetLoader.addSound('rare_get_sfx', 'sounds/rare_get.wav'); // レアキャラ獲得音
        this.assetLoader.addSound('poi_in_sfx', 'sounds/poi_in.wav'); // ポイ入水音
        this.assetLoader.addSound('button_click_sfx', 'sounds/button_click.wav');
        // this.assetLoader.addSound('ojisan_voice', 'sounds/ojisan_voice.wav'); // 特定キャラの声

        this.assetLoader.startLoading(onComplete);
    }

    // --- ゲーム状態遷移 ---
    startGame(difficulty) {
        this.currentDifficulty = difficulty;
        this.medals = this.currentDifficulty.initialMedals;
        this.highScore = this.ranking.getHighScore(); // 最新のハイスコアを取得
        this.characters = [];
        this.spawnTimer = 0;
        this.ui.floatingTexts = []; // フローティングテキストリセット
        this.maxCharacters = 20 + (difficulty === Difficulty.EASY ? -5 : difficulty === Difficulty.HARD ? 5 : 0); // 難易度で最大数調整

        // 初期キャラクター配置
        for (let i = 0; i < 10; i++) { // 最初は少し少なめ
            this._spawnCharacter();
        }

        this.currentState = GameState.PLAYING;
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_bgm'); // ゲームBGM再生
    }

    goToGameOver() {
        this.soundManager.stopBGM();
        this.soundManager.playBGM('game_over_bgm', false); // ゲームオーバーBGM (ループなし)
        this.currentState = GameState.GAME_OVER;
        const isNewHighScore = this.medals > this.highScore;
        if (isNewHighScore) {
            this.ranking.addScore(this.medals);
            this.highScore = this.medals; // 表示用に更新
        }
        // ゲームオーバー画面のボタン設定
        this.gameOverButtons = [
            { text: 'ランキングを見る', x: CANVAS_WIDTH / 2 - 160, y: CANVAS_HEIGHT * 0.7, width: 150, height: 50, hover: false, action: () => this.goToRanking() },
            { text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 + 10, y: CANVAS_HEIGHT * 0.7, width: 150, height: 50, hover: false, action: () => this.goToTitle() }
        ];
    }

     goToRanking() {
        this.soundManager.stopBGM();
        this.soundManager.playBGM('ranking_bgm');
        this.currentState = GameState.RANKING;
        // ランキング画面のボタン設定
        this.rankingButtons = [
             { text: 'タイトルへ戻る', x: CANVAS_WIDTH / 2 - 100, y: CANVAS_HEIGHT * 0.85, width: 200, height: 50, hover: false, action: () => this.goToTitle() }
        ];
    }

    goToTitle() {
        this.soundManager.stopBGM();
        this.soundManager.playBGM('title_bgm');
        this.currentState = GameState.TITLE;
    }

    goToDifficultySelect() {
        this.soundManager.playSE('button_click_sfx');
        this.currentState = GameState.DIFFICULTY_SELECT;
        // 難易度選択ボタンの設定
        const btnWidth = 180;
        const btnHeight = 60;
        const btnY = CANVAS_HEIGHT / 2 - btnHeight / 2;
        const spacing = 30;
        const totalWidth = btnWidth * 3 + spacing * 2;
        const startX = (CANVAS_WIDTH - totalWidth) / 2;

        this.difficultyButtons = [
            { text: Difficulty.EASY.name, difficulty: Difficulty.EASY, x: startX, y: btnY, width: btnWidth, height: btnHeight, hover: false },
            { text: Difficulty.NORMAL.name, difficulty: Difficulty.NORMAL, x: startX + btnWidth + spacing, y: btnY, width: btnWidth, height: btnHeight, hover: false },
            { text: Difficulty.HARD.name, difficulty: Difficulty.HARD, x: startX + (btnWidth + spacing) * 2, y: btnY, width: btnWidth, height: btnHeight, hover: false }
        ];
    }

    // --- 入力処理 ---
    _setupInputHandlers() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.currentState === GameState.PLAYING) {
                this.isMouseDown = true;
                this.soundManager.playSE('poi_in_sfx'); // ポイ入水音
            }
             // 他の状態でのクリック処理もここに追加
             else if (this.currentState === GameState.TITLE) {
                 this.goToDifficultySelect();
             }
             else if (this.currentState === GameState.DIFFICULTY_SELECT) {
                this.difficultyButtons.forEach(button => {
                    if (this._isMouseOverButton(button)) {
                        this.soundManager.playSE('button_click_sfx');
                        this.startGame(button.difficulty);
                    }
                });
            }
             else if (this.currentState === GameState.GAME_OVER) {
                this.gameOverButtons.forEach(button => {
                    if (this._isMouseOverButton(button)) {
                        this.soundManager.playSE('button_click_sfx');
                        button.action();
                    }
                });
            }
            else if (this.currentState === GameState.RANKING) {
                this.rankingButtons.forEach(button => {
                    if (this._isMouseOverButton(button)) {
                        this.soundManager.playSE('button_click_sfx');
                        button.action();
                    }
                });
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.currentState === GameState.PLAYING && this.isMouseDown) {
                this.isMouseDown = false;
                this._performScoop(); // すくい上げ処理
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            // ボタンのホバー状態更新
             if (this.currentState === GameState.DIFFICULTY_SELECT) {
                this.difficultyButtons.forEach(button => button.hover = this._isMouseOverButton(button));
            } else if (this.currentState === GameState.GAME_OVER) {
                this.gameOverButtons.forEach(button => button.hover = this._isMouseOverButton(button));
            } else if (this.currentState === GameState.RANKING) {
                this.rankingButtons.forEach(button => button.hover = this._isMouseOverButton(button));
            }
        });

        // タッチイベント対応（簡易）
        this.canvas.addEventListener('touchstart', (e) => {
             e.preventDefault(); // デフォルトのタッチ動作（スクロールなど）を抑制
             const touch = e.touches[0];
             const rect = this.canvas.getBoundingClientRect();
             this.mouseX = touch.clientX - rect.left;
             this.mouseY = touch.clientY - rect.top;
             // mousedown と同じ処理を実行
             this.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY }));
         }, { passive: false });

         this.canvas.addEventListener('touchend', (e) => {
             e.preventDefault();
             // mouseup と同じ処理を実行
             this.canvas.dispatchEvent(new MouseEvent('mouseup', {}));
         }, { passive: false });

         this.canvas.addEventListener('touchmove', (e) => {
             e.preventDefault();
             const touch = e.touches[0];
              const rect = this.canvas.getBoundingClientRect();
              this.mouseX = touch.clientX - rect.left;
              this.mouseY = touch.clientY - rect.top;
              // mousemove と同じ処理を実行
             this.canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY }));
         }, { passive: false });
    }

    // ボタン上にマウスがあるか判定
    _isMouseOverButton(button) {
        return this.mouseX >= button.x && this.mouseX <= button.x + button.width &&
               this.mouseY >= button.y && this.mouseY <= button.y + button.height;
    }


    // --- ゲームロジック ---
    _performScoop() {
        if (this.medals <= 0) return; // メダルがない場合はすくえない

        this.medals--; // ポイを使うたびにメダル消費
        this.soundManager.playSE('scoop_sfx'); // すくい上げ音

        let earnedMedals = 0;
        let gotRare = false;
        let scoopedCount = 0;

        // 後ろからループ（削除してもインデックスがずれないように）
        for (let i = this.characters.length - 1; i >= 0; i--) {
            const char = this.characters[i];
            // ポイの中心とキャラクターの中心の距離で判定
            // キャラクターの「すくわれ判定半径」を使う
            if (distance(this.poi.x, this.poi.y, char.x, char.y) <= char.getScoopRadius()) {
                 console.log(`Scooped: ${char.type.name}`);
                 const charMedals = char.type.medals;
                 earnedMedals += charMedals;
                 scoopedCount++;

                 // 獲得演出
                 this.ui.addFloatingText(`+${charMedals}`, char.x, char.y - char.getRadius(), charMedals > 10 ? '#f1c40f' : 'gold', 1200, charMedals > 10 ? 24 : 18);

                // レアキャラ判定 (例: level 8以上)
                if (char.type.level >= 8) {
                    gotRare = true;
                }

                // 特定キャラの効果音（例: おじさん）
                if (char.type.id === 'ojisan') {
                   // this.soundManager.playSE('ojisan_voice');
                }

                // キャラクターを削除
                this.characters.splice(i, 1);
            }
        }

        if (earnedMedals > 0) {
            this.medals += earnedMedals;
            if (gotRare) {
                this.soundManager.playSE('rare_get_sfx'); // レア獲得音
                // レアゲット演出（画面フラッシュなど）を追加可能
                 this.ui.addFloatingText(`超レアゲット！`, this.poi.x, this.poi.y - 60, '#ff00ff', 2000, 30);
            } else if (scoopedCount > 0) {
                this.soundManager.playSE('medal_get_sfx'); // 通常の獲得音
            }
            // 大量ゲット演出 (例: 3体以上)
            if (scoopedCount >= 3) {
                 this.ui.addFloatingText(`大量ゲット! x${scoopedCount}`, this.poi.x, this.poi.y - 30, '#1abc9c', 1500, 26);
            }
        }

        // メダルが0になったらゲームオーバー
        if (this.medals <= 0) {
            this.goToGameOver();
        }
    }

    _spawnCharacter() {
        if (this.characters.length >= this.maxCharacters) {
            return; // 上限に達していたらスポーンしない
        }

        // 難易度に応じたレベル分布からキャラクタータイプを選択
        const levelDistribution = this.currentDifficulty.levelDistribution;
        const rand = Math.random();
        let cumulativeRate = 0;
        let selectedLevel = 1;
        for (let i = 0; i < levelDistribution.length; i++) {
            cumulativeRate += levelDistribution[i];
            if (rand <= cumulativeRate) {
                selectedLevel = i + 1; // level は 1 から始まる
                break;
            }
        }
         // selectedLevelに近いレベルのキャラクターをフィルタリング
        const possibleTypes = characterTypes.filter(type =>
            Math.abs(type.level - selectedLevel) <= 1 // レベルが近いものを候補に（完全に一致しなくても良い）
        );

        // さらにappearanceRateに基づいて抽選
        let totalRate = possibleTypes.reduce((sum, type) => sum + type.appearanceRate, 0);
        let typeRand = Math.random() * totalRate;
        let selectedType = possibleTypes[possibleTypes.length - 1]; // デフォルト
         for (const type of possibleTypes) {
             if (typeRand < type.appearanceRate) {
                 selectedType = type;
                 break;
             }
             typeRand -= type.appearanceRate;
         }


        const newChar = new Character(selectedType, this.assetLoader, this.currentDifficulty.speedMultiplier);
        this.characters.push(newChar);
    }

    // --- 更新処理 ---
    update(deltaTime) {
        switch (this.currentState) {
            case GameState.PLAYING:
                this._updatePlaying(deltaTime);
                break;
            // 他の状態での更新処理（アニメーションなど）
            case GameState.TITLE:
            case GameState.DIFFICULTY_SELECT:
            case GameState.GAME_OVER:
            case GameState.RANKING:
                // UI要素のアニメーション更新など
                this.ui.update(deltaTime);
                 break;
        }
    }

    _updatePlaying(deltaTime) {
        // ポイの位置更新
        this.poi.update(this.mouseX, this.mouseY, this.isMouseDown);

        // キャラクターの移動更新
        this.characters.forEach(char => char.update(deltaTime, this.poi.x, this.poi.y));

        // キャラクターのスポーン管理
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0) {
            this._spawnCharacter();
            // 次のスポーンまでの時間 (難易度と現在のキャラ数で調整)
            const baseInterval = 1500 / this.currentDifficulty.spawnRateMultiplier;
            const densityFactor = Math.max(0.1, 1 - (this.characters.length / this.maxCharacters)); // 密度が高いほど間隔を長く
            this.spawnTimer = baseInterval * densityFactor * getRandomFloat(0.7, 1.3);
        }

         // UI要素の更新
        this.ui.update(deltaTime);

        // メダルが0になった場合のチェック（念のため）
        if (this.medals <= 0 && !this.isMouseDown) { // すくい上げ中でなければ即ゲームオーバー
            this.goToGameOver();
        }
    }


    // --- 描画処理 ---
    draw() {
        // 背景クリア
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 背景描画 (画像 or 単色)
        const gameBg = this.assetLoader.getImage('game_bg');
        if (this.currentState === GameState.PLAYING && gameBg) {
            this.ctx.drawImage(gameBg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (this.currentState === GameState.PLAYING) {
             // 画像がない場合は水色背景
            this.ctx.fillStyle = '#e0f7fa';
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            // 気泡エフェクトなど追加可能
        }


        // 状態に応じた描画
        switch (this.currentState) {
             case GameState.LOADING:
                this.ui.drawLoadingScreen(this.assetLoader.getLoadingProgress());
                break;
            case GameState.TITLE:
                this.ui.drawTitleScreen();
                break;
            case GameState.DIFFICULTY_SELECT:
                 this.ui.drawDifficultySelectScreen(this.difficultyButtons);
                break;
            case GameState.PLAYING:
                this._drawPlaying();
                break;
            case GameState.GAME_OVER:
                 // ゲーム画面を薄く表示した上にオーバーレイ
                 this._drawPlaying(true); // isBackground=true
                 const isNewHighScore = this.medals > this.ranking.scores.find(s => s.score === this.highScore)?.score; // ちょっと冗長かも
                 this.ui.drawGameOverScreen(this.medals <=0 ? 0 : this.medals, this.highScore, isNewHighScore, this.gameOverButtons);
                 break;
             case GameState.RANKING:
                 this.ui.drawRankingScreen(this.ranking.getHighScores(), this.rankingButtons);
                 break;
        }
    }

    _drawPlaying(isBackground = false) {
         // キャラクター描画
        this.characters.forEach(char => char.draw(this.ctx));

        // ポイ描画
        this.poi.draw(this.ctx);

        // UI描画 (ゲームオーバー画面の背景として描画する場合はUIは描画しない)
        if (!isBackground) {
             this.ui.drawGameUI(this.medals, this.highScore);
        }
    }

    // --- メインループ ---
    gameLoop(timestamp = 0) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // フレームレートが極端に低い場合はdeltaTimeを制限 (例: 最大100ms)
        const dt = Math.min(deltaTime, 100);

        if (this.currentState !== GameState.LOADING) { // ロード中以外は更新
             this.update(dt);
        }
        this.draw();

        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// --- ゲームの開始 ---
window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // ゲームインスタンスを作成し、初期化を開始
    const game = new Game(canvas, ctx);
    game.init();
};
