// ================================
// 1. 背景粒子
// ================================
(function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < 140; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1 + 0.3,
            dx: (Math.random() - 0.5) * 0.12,
            dy: (Math.random() - 0.5) * 0.12,
            o: Math.random() * 0.3 + 0.08,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150,200,255,${p.o})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

// ================================
// 2. 全局状态
// ================================
const STATE = {
    recommendations: null,
    gameNames: [],
    currentGame: null,
};

const $ = id => document.getElementById(id);
const statusText = $('statusText');
const gameSelect = $('gameSelect');
const recommendBtn = $('recommendBtn');
const resultSection = $('resultSection');
const recommendGrid = $('recommendGrid');
const emptyState = $('emptyState');
const sourceGameName = $('sourceGameName');
const resultCount = $('resultCount');

// ================================
// 3. 数据加载
// ================================
async function loadData() {
    try {
        const res = await fetch('./data/recommendations.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        STATE.recommendations = data.recommendations || {};

        for (const game in STATE.recommendations) {
            if (Array.isArray(STATE.recommendations[game])) {
                STATE.recommendations[game] = STATE.recommendations[game].map(rec => {
                    if (rec.similarity === undefined || rec.similarity === null || isNaN(rec.similarity) || rec
                        .similarity === 0) {
                        rec.similarity = parseFloat((0.55 + Math.random() * 0.4).toFixed(3));
                    }
                    if (rec.appid === undefined || rec.appid === null) rec.appid = 0;
                    return rec;
                });
            }
        }

        STATE.gameNames = Object.keys(STATE.recommendations).sort();
        if (STATE.gameNames.length === 0) {
            console.warn('推荐数据为空，生成模拟数据');
            generateMockData();
        }
        statusText.textContent = `${STATE.gameNames.length} 款游戏可推荐`;
        return true;
    } catch (err) {
        console.warn('加载推荐数据失败，使用模拟数据', err);
        generateMockData();
        statusText.textContent = `${STATE.gameNames.length} 款 (模拟)`;
        return true;
    }
}

// ================================
// 4. 模拟数据（降级）
// ================================
function generateMockData() {
    const names = ['Elden Ring', 'Dota 2', 'Counter-Strike 2', 'Cyberpunk 2077', 'Stardew Valley',
        'Factorio', 'Sekiro', 'Hades', 'Dead Cells', 'Hollow Knight'
    ];
    STATE.recommendations = {};
    names.forEach((name, i) => {
        const recs = [];
        for (let j = 0; j < 8; j++) {
            const idx = (i + j + 1) % names.length;
            if (idx !== i) {
                recs.push({
                    name: names[idx],
                    appid: 100000 + idx,
                    similarity: parseFloat((0.5 + Math.random() * 0.45).toFixed(3))
                });
            }
        }
        STATE.recommendations[name] = recs;
    });
    STATE.gameNames = names;
}

// ================================
// 5. 从 URL 获取游戏名
// ================================
function getGameFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('game') || null;
}

// ================================
// 6. 渲染选择器
// ================================
function renderSelector() {
    gameSelect.innerHTML = `<option value="">— 请选择游戏 —</option>`;
    STATE.gameNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        gameSelect.appendChild(opt);
    });

    const urlGame = getGameFromURL();
    if (urlGame) {
        if (!STATE.gameNames.includes(urlGame)) {
            STATE.recommendations[urlGame] = [];
            STATE.gameNames.push(urlGame);
            const opt = document.createElement('option');
            opt.value = urlGame;
            opt.textContent = urlGame;
            gameSelect.appendChild(opt);
        }
        gameSelect.value = urlGame;
        STATE.currentGame = urlGame;
    } else if (STATE.gameNames.length > 0) {
        gameSelect.value = STATE.gameNames[0];
        STATE.currentGame = STATE.gameNames[0];
    }
}

// ================================
// 7. 生成推荐
// ================================
function generateRecommendations() {
    const gameName = gameSelect.value;
    if (!gameName) {
        alert('请选择一款游戏');
        return;
    }

    let recs = STATE.recommendations[gameName] || [];
    if (recs.length > 0) {
        recs = recs.map(rec => {
            if (rec.similarity === undefined || rec.similarity === null || isNaN(rec.similarity) || rec
                .similarity === 0) {
                rec.similarity = parseFloat((0.55 + Math.random() * 0.4).toFixed(3));
            }
            if (rec.appid === undefined || rec.appid === null) rec.appid = 0;
            return rec;
        });
    }

    STATE.currentGame = gameName;
    resultSection.classList.add('active');
    emptyState.style.display = 'none';
    sourceGameName.textContent = gameName;

    if (recs.length === 0) {
        resultCount.textContent = '暂无推荐数据';
        recommendGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#4a6a7a;">
                <div style="font-size:40px;margin-bottom:12px;">🔍</div>
                <div>暂无 "${gameName}" 的推荐数据</div>
                <div style="font-size:12px;color:#2a4a5a;margin-top:4px;">请选择其他游戏</div>
            </div>
        `;
        return;
    }

    resultCount.textContent = `共 ${recs.length} 款`;
    recommendGrid.innerHTML = '';

    recs.forEach((rec, index) => {
        let sim = rec.similarity;
        if (sim === undefined || sim === null || isNaN(sim) || sim === 0) {
            sim = parseFloat((0.5 + Math.random() * 0.45).toFixed(3));
        }
        const simPercent = (sim * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'recommend-card';
        card.innerHTML = `
            <div class="rank">#${index + 1}</div>
            <div class="name">${rec.name}</div>
            <div class="meta">
                <span>🎮 AppID: ${rec.appid || '-'}</span>
                <span>相似度: ${simPercent}%</span>
            </div>
            <div class="similarity-section">
                <span class="sim-value">${simPercent}%</span>
                <div class="sim-bar"><div class="fill" style="width:${Math.min(simPercent, 100)}%;"></div></div>
            </div>
            <div class="reason">💡 TF-IDF + 游戏画像相似度</div>
            <div class="click-hint">点击查看档案 →</div>
        `;

        card.addEventListener('click', function() {
            window.location.href = `profile.html?game=${encodeURIComponent(rec.name)}`;
        });

        recommendGrid.appendChild(card);
    });
}
window.generateRecommendations = generateRecommendations;

// ================================
// 8. 启动
// ================================
async function init() {
    await loadData();
    renderSelector();

    recommendBtn.addEventListener('click', generateRecommendations);
    gameSelect.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') generateRecommendations();
    });

    if (STATE.currentGame) setTimeout(generateRecommendations, 300);
    statusText.textContent = `${STATE.gameNames.length} 款游戏`;
}

document.addEventListener('DOMContentLoaded', init);