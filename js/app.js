// ================================
// 1. 背景粒子系统
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

    const COUNT = 180;
    for (let i = 0; i < COUNT; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.2 + 0.3,
            dx: (Math.random() - 0.5) * 0.15,
            dy: (Math.random() - 0.5) * 0.15,
            o: Math.random() * 0.4 + 0.1,
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
    games: [],
    filteredGames: [],
    selectedGame: null,
    filters: {
        genres: [],
        year: 2026,
        gviMin: 20,
    },
    chart: null,
};

const $ = id => document.getElementById(id);
const chartEl = $('galaxy-chart');
const loadingEl = $('loadingOverlay');
const statusText = $('statusText');
const filterCount = $('filterCount');
const searchInput = $('searchInput');
const yearSlider = $('yearSlider');
const yearLabel = $('yearLabel');
const gviSlider = $('gviSlider');
const gviLabel = $('gviLabel');
const resetBtn = $('resetFilters');
const genreFiltersEl = $('genreFilters');

// ================================
// 3. 数据加载
// ================================
async function loadData() {
    try {
        const res = await fetch('./data/galaxy_coords.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        STATE.games = data.games || [];
        STATE.filteredGames = [...STATE.games];
        statusText.textContent = `${STATE.games.length} 款游戏`;
        return true;
    } catch (err) {
        console.warn('加载真实数据失败，使用模拟数据', err);
        STATE.games = generateMockData();
        STATE.filteredGames = [...STATE.games];
        statusText.textContent = `${STATE.games.length} 款 (模拟)`;
        return true;
    }
}

// ================================
// 4. 模拟数据（降级）
// ================================
function generateMockData() {
    const data = [];
    const names = ['Elden Ring', 'Dota 2', 'Counter-Strike 2', 'Cyberpunk 2077', 'Stardew Valley',
        'Factorio', 'Sekiro', 'Hades', 'Dead Cells', 'Hollow Knight',
        'Portal 2', 'The Witcher 3', 'Minecraft', 'Terraria', 'Cuphead',
        'Ori', 'Celeste', 'Undertale', 'Disco Elysium', 'Outer Wilds'
    ];
    const genres = ['RPG', 'Action', 'MOBA', 'FPS', 'Simulation', 'Adventure', 'Strategy'];
    const devs = ['FromSoftware', 'Valve', 'CD Projekt', 'ConcernedApe', 'Wube', 'Supergiant', 'Team Cherry'];

    for (let i = 0; i < 500; i++) {
        const name = names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : '');
        data.push({
            name,
            x: (Math.random() - 0.5) * 30,
            y: (Math.random() - 0.5) * 30,
            price: Math.random() * 60 + 10,
            score: 0.5 + Math.random() * 0.48,
            owners: Math.pow(10, 3 + Math.random() * 5),
            gvi: 20 + Math.random() * 75,
            genres: genres[Math.floor(Math.random() * genres.length)],
            developer: devs[Math.floor(Math.random() * devs.length)],
            release_year: 2005 + Math.floor(Math.random() * 21),
            positive: Math.floor(Math.random() * 10000),
            negative: Math.floor(Math.random() * 2000),
            playtime: Math.floor(Math.random() * 200),
            tags: ['Action', 'RPG', 'Adventure', 'Strategy', 'Simulation', 'MOBA', 'FPS'].slice(0, 2 + Math.floor(Math
                .random() * 3)).join(',')
        });
    }
    return data;
}

// ================================
// 5. 渲染银河 (ECharts)
// ================================
function renderGalaxy(games) {
    if (!games || games.length === 0) {
        filterCount.textContent = '0';
        return;
    }

    const data = games.map(g => ({
        name: g.name,
        value: [g.x, g.y, g.gvi || 50],
        gvi: g.gvi || 50,
        score: g.score || 0.5,
        owners: g.owners || 10000,
        genres: g.genres || '',
        developer: g.developer || '',
        release_year: g.release_year || 2020,
        positive: g.positive || 0,
        negative: g.negative || 0,
        playtime: g.playtime || 0,
        tags: g.tags || '',
        price: g.price || 0,
        exploration: g.exploration || 30 + Math.random() * 50,
        challenge: g.challenge || 30 + Math.random() * 50,
        social: g.social || 30 + Math.random() * 50,
        story: g.story || 30 + Math.random() * 50,
        action: g.action || 30 + Math.random() * 50,
        depth: g.depth || 30 + Math.random() * 50,
    }));

    const colors = data.map(d => {
        const gvi = d.gvi;
        if (gvi > 75) return '#ff6b6b';
        if (gvi > 55) return '#ffd93d';
        if (gvi > 35) return '#66c0f4';
        return '#3a6a8a';
    });

    const sizes = data.map(d => {
        const base = Math.log10(d.owners + 1) * 0.8 + 2;
        return Math.min(Math.max(base, 3), 18);
    });

    if (STATE.chart) {
        STATE.chart.dispose();
    }

    const chart = echarts.init(chartEl, 'dark');
    STATE.chart = chart;

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(7,11,21,0.85)',
            borderColor: 'rgba(102,192,244,0.15)',
            borderRadius: 10,
            padding: [12, 16],
            textStyle: { color: '#e8edf5', fontSize: 13 },
            formatter: function(params) {
                const d = params.data;
                return `
                    <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${d.name}</div>
                    <div style="color:#6a8a9a;font-size:12px;">${d.genres || ''}  ·  ${d.developer || ''}</div>
                    <div style="margin-top:6px;display:flex;gap:16px;">
                        <span>💪 <strong style="color:#ffd93d;">${d.gvi.toFixed(1)}</strong></span>
                        <span>⭐ <strong style="color:#6bcb6b;">${(d.score*100).toFixed(0)}%</strong></span>
                        <span>👥 ${formatNumber(d.owners)}</span>
                    </div>
                `;
            }
        },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        xAxis: { show: false, min: -20, max: 20 },
        yAxis: { show: false, min: -20, max: 20 },
        series: [{
            type: 'scatter',
            data: data,
            symbolSize: function(val) {
                const idx = data.indexOf(val);
                return sizes[idx] || 6;
            },
            itemStyle: {
                color: function(params) {
                    const idx = data.indexOf(params.data);
                    return colors[idx] || '#66c0f4';
                },
                shadowBlur: 8,
                shadowColor: 'rgba(102,192,244,0.15)',
                opacity: 0.85,
            },
            emphasis: {
                scale: 1.5,
                itemStyle: {
                    shadowBlur: 24,
                    shadowColor: 'rgba(102,192,244,0.5)',
                },
                label: {
                    show: true,
                    formatter: '{b}',
                    color: '#e8edf5',
                    fontSize: 13,
                    fontWeight: 600,
                    textShadowBlur: 8,
                    textShadowColor: 'rgba(0,0,0,0.8)',
                }
            },
            animationDuration: 800,
            animationEasing: 'cubicOut',
        }],
        dataZoom: [{
            type: 'inside',
            xAxisIndex: 0,
            yAxisIndex: 0,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
        }],
    };

    chart.setOption(option);
    filterCount.textContent = data.length;

    chart.on('click', function(params) {
        if (params.data) {
            selectGame(params.data);
        }
    });

    loadingEl.classList.add('hide');
    window.addEventListener('resize', () => chart.resize());
}

// ================================
// 6. 筛选逻辑
// ================================
function applyFilters() {
    const { genres, year, gviMin } = STATE.filters;

    let filtered = STATE.games.filter(g => {
        if (g.release_year && g.release_year > year) return false;
        if ((g.gvi || 0) < gviMin) return false;
        if (genres.length > 0) {
            const gGenres = (g.genres || '').toLowerCase();
            if (!genres.some(t => gGenres.includes(t.toLowerCase()))) return false;
        }
        return true;
    });

    STATE.filteredGames = filtered;
    renderGalaxy(filtered);
}

// ================================
// 7. 选择游戏（详情面板）
// ================================
function selectGame(gameData) {
    STATE.selectedGame = gameData;

    const empty = $('detailEmpty');
    const card = $('detailCard');
    empty.style.display = 'none';
    card.classList.add('active');

    $('detailName').textContent = gameData.name || '—';
    $('detailDeveloper').textContent = gameData.developer || '—';
    $('detailYear').textContent = gameData.release_year || '—';
    $('detailGenres').textContent = gameData.genres || '—';

    const gvi = gameData.gvi || 0;
    $('detailGvi').textContent = gvi.toFixed(1);
    $('detailGviBar').style.width = Math.min(gvi, 100) + '%';

    const tagsEl = $('detailTags');
    const tags = (gameData.tags || '').split(',').filter(t => t.trim());
    tagsEl.innerHTML = tags.map(t => `<span class="tag">${t.trim()}</span>`).join('');

    const simEl = $('detailSimilar');
    const others = STATE.games.filter(g => g.name !== gameData.name);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 8);
    simEl.innerHTML = shuffled.map(g =>
        `<span class="sim-item" onclick="selectGameByName('${g.name}')">${g.name}</span>`
    ).join('');

    const radarEl = $('detailRadar');
    if (window._radarChart) {
        window._radarChart.dispose();
    }
    const radarChart = echarts.init(radarEl, 'dark');
    window._radarChart = radarChart;

    const dims = ['探索性', '挑战性', '社交性', '叙事性', '动作性', '游戏深度'];
    const vals = [
        gameData.exploration || 30 + Math.random() * 50,
        gameData.challenge || 30 + Math.random() * 50,
        gameData.social || 30 + Math.random() * 50,
        gameData.story || 30 + Math.random() * 50,
        gameData.action || 30 + Math.random() * 50,
        gameData.depth || 30 + Math.random() * 50,
    ];

    radarChart.setOption({
        radar: {
            indicator: dims.map(d => ({ name: d, max: 100 })),
            center: ['50%', '50%'],
            radius: '65%',
            axisName: { color: '#6a8a9a', fontSize: 10 },
            splitArea: { areaStyle: { color: ['rgba(102,192,244,0.02)'] } },
            axisLine: { lineStyle: { color: 'rgba(102,192,244,0.1)' } },
            splitLine: { lineStyle: { color: 'rgba(102,192,244,0.05)' } },
        },
        series: [{
            type: 'radar',
            data: [{
                value: vals,
                name: gameData.name || '',
                areaStyle: { color: 'rgba(102,192,244,0.15)' },
                lineStyle: { color: '#66c0f4', width: 2 },
                itemStyle: { color: '#66c0f4' },
            }]
        }],
        backgroundColor: 'transparent',
    });

    window.addEventListener('resize', () => {
        if (window._radarChart) window._radarChart.resize();
        if (STATE.chart) STATE.chart.resize();
    });
}

function selectGameByName(name) {
    const found = STATE.games.find(g => g.name === name);
    if (found) selectGame(found);
}
window.selectGameByName = selectGameByName;

// ================================
// 8. 搜索定位
// ================================
function searchGame(query) {
    if (!query.trim()) return;
    const q = query.trim().toLowerCase();
    const found = STATE.games.find(g => g.name.toLowerCase().includes(q));
    if (found) {
        selectGame(found);
        if (STATE.chart) {
            const data = STATE.filteredGames;
            const idx = data.findIndex(g => g.name === found.name);
            if (idx >= 0) {
                STATE.chart.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    dataIndex: idx,
                });
                setTimeout(() => {
                    STATE.chart.dispatchAction({
                        type: 'downplay',
                        seriesIndex: 0,
                        dataIndex: idx,
                    });
                }, 2000);
            }
        }
    } else {
        console.log('未找到:', query);
    }
}
window.searchGame = searchGame;


// ================================
// 9. 工具函数
// ================================
function formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

// ================================
// 10. 初始化筛选器 & 事件绑定
// ================================
function initFilters() {
    const allGenres = ['RPG', 'Action', 'MOBA', 'FPS', 'Strategy', 'Adventure', 'Simulation', 'Indie'];
    genreFiltersEl.innerHTML = allGenres.map(g =>
        `<label class="filter-item">
            <input type="checkbox" value="${g}" /> ${g}
            <span class="count">0</span>
        </label>`
    ).join('');

    genreFiltersEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            const checked = [...genreFiltersEl.querySelectorAll('input:checked')].map(el => el.value);
            STATE.filters.genres = checked;
            applyFilters();
        });
    });

    yearSlider.addEventListener('input', function() {
        STATE.filters.year = parseInt(this.value);
        yearLabel.textContent = this.value;
        applyFilters();
    });

    gviSlider.addEventListener('input', function() {
        STATE.filters.gviMin = parseInt(this.value);
        gviLabel.textContent = `≥ ${this.value}`;
        applyFilters();
    });

    resetBtn.addEventListener('click', function() {
        genreFiltersEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        STATE.filters.genres = [];
        yearSlider.value = 2026;
        STATE.filters.year = 2026;
        yearLabel.textContent = '2026';
        gviSlider.value = 20;
        STATE.filters.gviMin = 20;
        gviLabel.textContent = '≥ 20';
        applyFilters();
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            searchGame(this.value);
        }
    });
   // 搜索按钮点击事件
document.getElementById('searchBtn').addEventListener('click', function() {
    const query = document.getElementById('searchInput').value;
    searchGame(query);
});

    $('detailViewBtn').addEventListener('click', function() {
        if (STATE.selectedGame) {
            const name = encodeURIComponent(STATE.selectedGame.name);
            window.location.href = `profile.html?game=${name}`;
        }
    });

    $('detailLocateBtn').addEventListener('click', function() {
        if (STATE.selectedGame && STATE.chart) {
            const name = STATE.selectedGame.name;
            const data = STATE.filteredGames;
            const idx = data.findIndex(g => g.name === name);
            if (idx >= 0) {
                STATE.chart.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    dataIndex: idx,
                });
                setTimeout(() => {
                    STATE.chart.dispatchAction({
                        type: 'downplay',
                        seriesIndex: 0,
                        dataIndex: idx,
                    });
                }, 2000);
            }
        }
    });

    $('detailRecommendBtn').addEventListener('click', function() {
        if (STATE.selectedGame) {
            const name = encodeURIComponent(STATE.selectedGame.name);
            window.location.href = `recommend.html?game=${name}`;
        } else {
            alert('请先选择一个游戏');
        }
    });
}

// ================================
// 11. 启动
// ================================
async function init() {
    await loadData();
    initFilters();
    applyFilters();
}

document.addEventListener('DOMContentLoaded', init);