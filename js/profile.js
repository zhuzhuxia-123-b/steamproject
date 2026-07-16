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
    gameData: null,
    profiles: null,
    vitalityData: null,
};

const $ = id => document.getElementById(id);
const statusText = $('statusText');
const loadingState = $('loadingState');
const contentWrapper = $('contentWrapper');

// ================================
// 3. 工具函数
// ================================
function getGameFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('game') || 'Elden Ring';
}

function goToRecommend() {
    if (STATE.gameData) {
        const name = encodeURIComponent(STATE.gameData.name);
        window.location.href = `recommend.html?game=${name}`;
    }
}

function goBack() {
    if (document.referrer && document.referrer.includes('index_galaxy.html')) {
        window.history.back();
    } else {
        window.location.href = 'index_galaxy.html';
    }
}
window.goBack = goBack;
window.goToRecommend = goToRecommend;

// ================================
// 4. 数据加载
// ================================
async function loadData() {
    try {
        const [profileRes, vitalityRes] = await Promise.all([
            fetch('./data/game_profiles.json'),
            fetch('./data/game_vitality.json'),
        ]);
        const profileData = await profileRes.json();
        const vitalityData = await vitalityRes.json();
        STATE.profiles = profileData.games || [];
        STATE.vitalityData = vitalityData.games || [];
        statusText.textContent = `${STATE.profiles.length} 款游戏`;
        return true;
    } catch (err) {
        console.warn('加载真实数据失败，使用模拟数据', err);
        STATE.profiles = generateMockProfiles();
        STATE.vitalityData = generateMockVitality();
        statusText.textContent = `${STATE.profiles.length} 款 (模拟)`;
        return true;
    }
}

// ================================
// 5. 模拟数据（降级）
// ================================
function generateMockProfiles() {
    const names = ['Elden Ring', 'Dota 2', 'Counter-Strike 2', 'Cyberpunk 2077', 'Stardew Valley',
        'Factorio', 'Sekiro', 'Hades', 'Dead Cells', 'Hollow Knight'
    ];
    const devs = ['FromSoftware', 'Valve', 'CD Projekt', 'ConcernedApe', 'Wube', 'Supergiant', 'Team Cherry'];
    const genres = ['RPG', 'Action', 'MOBA', 'FPS', 'Simulation', 'Adventure', 'Strategy'];
    const tags_list = [
        ['Open World', 'Souls-like', 'RPG'],
        ['MOBA', 'Strategy', 'Multiplayer'],
        ['FPS', 'Multiplayer', 'Competitive'],
        ['Open World', 'RPG', 'Story Rich'],
        ['Simulation', 'Farming', 'Relaxing'],
        ['Strategy', 'Building', 'Management'],
        ['Action', 'Souls-like', 'Stealth'],
        ['Roguelike', 'Action', 'Indie'],
        ['Roguelike', 'Platformer', 'Indie'],
        ['Metroidvania', 'Indie', 'Exploration']
    ];
    return names.map((name, i) => ({
        name,
        appid: 100000 + i,
        genres: genres[i % genres.length],
        developer: devs[i % devs.length],
        release_year: 2015 + (i % 8),
        price: 29.99 + i * 3,
        score: 0.75 + Math.random() * 0.2,
        owners: 100000 + Math.random() * 10000000,
        exploration: 30 + Math.random() * 60,
        challenge: 30 + Math.random() * 60,
        social: 30 + Math.random() * 60,
        story: 30 + Math.random() * 60,
        action: 30 + Math.random() * 60,
        depth: 30 + Math.random() * 60,
        tags: tags_list[i % tags_list.length].join(','),
        categories: 'Single-player,Steam Achievements'
    }));
}

function generateMockVitality() {
    return STATE.profiles.map(g => ({
        appid: g.appid,
        name: g.name,
        vitality: 40 + Math.random() * 55,
        player: 50 + Math.random() * 45,
        community: 50 + Math.random() * 45,
        positive_rate: 60 + Math.random() * 35,
        operation: 40 + Math.random() * 50,
        age_factor: 50 + Math.random() * 40,
        game_age: 3 + Math.random() * 10,
    }));
}

// ================================
// 6. 渲染页面
// ================================
function renderProfile(gameName) {
    const game = STATE.profiles.find(g => g.name === gameName);
    if (!game) {
        const found = STATE.profiles.find(g => g.name.toLowerCase().includes(gameName.toLowerCase()));
        if (found) return renderProfile(found.name);
        alert(`未找到游戏「${gameName}」，显示默认游戏`);
        return renderProfile('Elden Ring');
    }

    STATE.gameData = game;
    document.title = `${game.name} · 游戏档案`;

    $('breadcrumbGame').textContent = game.name;
    $('gameName').textContent = game.name;
    $('gameDeveloper').textContent = game.developer || '—';
    $('gameYear').textContent = game.release_year || '—';
    $('gameGenres').textContent = game.genres || '—';

    const vitality = STATE.vitalityData.find(v => v.appid === game.appid);
    const gvi = vitality ? vitality.vitality : (50 + Math.random() * 30);
    $('gameGvi').textContent = gvi.toFixed(1);
    $('gameGviBar').style.width = Math.min(gvi, 100) + '%';

    // ---- 标签 ----
    const tags = (game.tags || '').split(',').filter(t => t.trim());
    $('gameTags').innerHTML = tags.map(t => `<span class="tag">${t.trim()}</span>`).join('');

    // ---- 游戏封面 ----
    if (tags.length > 0) {
        const firstTag = tags[0].trim();
        let coverText;
        if (firstTag.includes(' ')) {
            const words = firstTag.split(' ');
            coverText = words.map(w => w[0]).join('').slice(0, 2).toUpperCase();
        } else {
            coverText = firstTag.slice(0, 2).toUpperCase();
        }
        $('gameCover').textContent = coverText;
    } else {
        $('gameCover').textContent = '🎮';
    }

    // ---- 雷达图（修复比例：减小半径，增大容器高度） ----
    const dims = ['探索性', '挑战性', '社交性', '叙事性', '动作性', '游戏深度'];
    const keys = ['exploration', 'challenge', 'social', 'story', 'action', 'depth'];
    const vals = keys.map(k => game[k] !== undefined ? game[k] : 30 + Math.random() * 50);

    const radarEl = $('radarChart');
    radarEl.style.height = '340px';
    const radarChart = echarts.init(radarEl, 'dark');
    radarChart.setOption({
        radar: {
            indicator: dims.map(d => ({ name: d, max: 100 })),
            center: ['50%', '50%'],
            radius: '48%',   // 从 58% 减小到 48%，给标签更多空间
            axisName: {
                color: '#8a9aaa',
                fontSize: 11,
                padding: [2, 4],
            },
            splitArea: {
                areaStyle: {
                    color: ['rgba(102,192,244,0.02)', 'rgba(102,192,244,0.04)']
                }
            },
            axisLine: { lineStyle: { color: 'rgba(102,192,244,0.1)' } },
            splitLine: { lineStyle: { color: 'rgba(102,192,244,0.05)' } },
        },
        series: [{
            type: 'radar',
            data: [{
                value: vals,
                name: game.name,
                areaStyle: { color: 'rgba(102,192,244,0.12)' },
                lineStyle: { color: '#66c0f4', width: 2 },
                itemStyle: { color: '#66c0f4' },
            }]
        }],
        backgroundColor: 'transparent',
    });
    window.addEventListener('resize', () => radarChart.resize());

    // ---- 生命力拆解 ----
    const breakdown = [
        { key: 'player', label: '👥 玩家规模', color: '#66c0f4' },
        { key: 'community', label: '📊 社区活跃', color: '#ffd93d' },
        { key: 'positive_rate', label: '⭐ 用户好评', color: '#6bcb6b' },
        { key: 'operation', label: '🔄 运营能力', color: '#a66cff' },
        { key: 'age_factor', label: '⏳ 生命周期', color: '#ff9f6e' },
    ];

    const v = vitality || {};
    const vitalityEl = $('vitalityBreakdown');
    vitalityEl.innerHTML = breakdown.map(b => {
        const val = v[b.key] !== undefined ? v[b.key] : (40 + Math.random() * 40);
        return `
            <div class="item">
                <span class="label">${b.label}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width:0%;background:${b.color};" data-target="${Math.min(val,100)}"></div>
                </div>
                <span class="value">${Math.round(val)}</span>
            </div>
        `;
    }).join('');
    requestAnimationFrame(() => {
        vitalityEl.querySelectorAll('.bar-fill').forEach(el => {
            el.style.width = el.dataset.target + '%';
        });
    });

    // ---- DNA 标签云 ----
    const dnaEl = $('dnaCloud');
    const allTags = tags.length > 0 ? tags : ['Action', 'RPG', 'Adventure', 'Strategy', 'Indie'];
    const sizes = ['size-lg', 'size-md', 'size-sm'];
    dnaEl.innerHTML = allTags.map((t, i) =>
        `<span class="dna-item ${sizes[i % sizes.length]}" style="opacity:${0.7 + Math.random()*0.3};">#${t.trim()}</span>`
    ).join('');

    // ---- 相似游戏 ----
    const simEl = $('similarGames');
    const others = STATE.profiles.filter(g => g.name !== game.name);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 8);
    simEl.innerHTML = shuffled.map(g => `
        <div class="sim-item" onclick="location.href='profile.html?game=${encodeURIComponent(g.name)}'">
            <div class="sim-name">${g.name}</div>
            <div class="sim-score">${(70 + Math.random()*25).toFixed(0)}% 相似</div>
        </div>
    `).join('');

    loadingState.style.display = 'none';
    contentWrapper.style.display = 'block';

    // ---- 绑定推荐按钮 ----
    document.getElementById('recommendBtnHeader').addEventListener('click', goToRecommend);
    document.getElementById('recommendBtnEntry').addEventListener('click', goToRecommend);
}

// ================================
// 7. 启动
// ================================
async function init() {
    await loadData();
    const gameName = getGameFromURL();
    renderProfile(gameName);
}

document.addEventListener('DOMContentLoaded', init);