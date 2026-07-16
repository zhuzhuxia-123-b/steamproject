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
    data: null,
    selectedNode: null,
    simulation: null,
    zoom: null,
};

const $ = id => document.getElementById(id);
const statusText = $('statusText');
const loadingEl = $('loadingOverlay');
const canvasEl = $('graph-canvas');

const COLOR_MAP = {
    'game': '#ff6b6b',
    'genre': '#6bcb6b',
    'tag': '#ffd93d',
    'developer': '#a66cff',
};
const TYPE_LABEL = {
    'game': '游戏',
    'genre': '类型',
    'tag': '标签',
    'developer': '开发商',
};
const TYPE_ORDER = ['game', 'genre', 'tag', 'developer'];

// ================================
// 3. 数据加载
// ================================
async function loadData() {
    try {
        const res = await fetch('./data/knowledge_graph.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        STATE.data = data;
        statusText.textContent = `${data.nodes.length} 节点 · ${data.links.length} 边`;
        return true;
    } catch (err) {
        console.warn('加载知识图谱失败，使用模拟数据', err);
        STATE.data = generateMockGraph();
        statusText.textContent = `${STATE.data.nodes.length} 节点 (模拟)`;
        return true;
    }
}

function generateMockGraph() {
    const nodes = [];
    const links = [];
    const games = ['Elden Ring', 'Dota 2', 'CS2', 'Cyberpunk 2077', 'Stardew Valley',
        'Factorio', 'Sekiro', 'Hades', 'Dead Cells', 'Hollow Knight'
    ];
    const genres = ['RPG', 'Action', 'MOBA', 'FPS', 'Simulation', 'Adventure', 'Strategy'];
    const tags = ['Open World', 'Souls-like', 'Multiplayer', 'Competitive', 'Story Rich',
        'Roguelike', 'Metroidvania', 'Indie', 'Building', 'Exploration'
    ];
    const devs = ['FromSoftware', 'Valve', 'CD Projekt', 'ConcernedApe', 'Wube', 'Supergiant'];

    games.forEach((g, i) => {
        nodes.push({ id: `game_${i}`, name: g, type: 'game', group: 0, size: 10 });
        const gIdx = Math.floor(Math.random() * genres.length);
        const gid = `genre_${gIdx}`;
        if (!nodes.find(n => n.id === gid)) {
            nodes.push({ id: gid, name: genres[gIdx], type: 'genre', group: 1, size: 8 });
        }
        links.push({ source: `game_${i}`, target: gid, relation: 'belongs_to' });
        for (let j = 0; j < 2 + Math.floor(Math.random() * 3); j++) {
            const tid = `tag_${(i + j) % tags.length}`;
            if (!nodes.find(n => n.id === tid)) {
                nodes.push({ id: tid, name: tags[(i + j) % tags.length], type: 'tag', group: 2, size: 6 });
            }
            links.push({ source: `game_${i}`, target: tid, relation: 'has_tag' });
        }
        const did = `dev_${i % devs.length}`;
        if (!nodes.find(n => n.id === did)) {
            nodes.push({ id: did, name: devs[i % devs.length], type: 'developer', group: 3, size: 12 });
        }
        links.push({ source: `game_${i}`, target: did, relation: 'developed_by' });
    });
    return { nodes, links };
}

// ================================
// 4. Tooltip
// ================================
let tooltipEl = null;

function showTooltip(event, d) {
    if (!tooltipEl) {
        tooltipEl = d3.select('body').append('div')
            .style('position', 'fixed')
            .style('background', 'rgba(7,11,21,0.92)')
            .style('border', '1px solid rgba(102,192,244,0.15)')
            .style('border-radius', '10px')
            .style('padding', '10px 14px')
            .style('color', '#e8edf5')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('backdrop-filter', 'blur(8px)')
            .style('box-shadow', '0 8px 32px rgba(0,0,0,0.5)')
            .style('max-width', '260px')
            .style('transition', 'opacity 0.2s');
    }
    const typeLabel = TYPE_LABEL[d.type] || d.type;
    tooltipEl.html(`
        <div style="font-weight:600;font-size:15px;margin-bottom:2px;">${d.name}</div>
        <div style="color:#6a8a9a;font-size:11px;">${typeLabel}</div>
        <div style="margin-top:6px;display:flex;gap:10px;font-size:12px;color:#8a9aaa;">
            <span>度: ${d.degree || 0}</span>
            <span>连接: ${(d.degree || 0)}</span>
        </div>
    `)
    .style('left', (event.clientX + 16) + 'px')
    .style('top', (event.clientY - 20) + 'px')
    .style('opacity', 1);
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style('opacity', 0);
}

// ================================
// 5. 渲染力导向图
// ================================
function renderGraph(data) {
    const container = canvasEl;
    const width = container.clientWidth;
    const height = container.clientHeight;
    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', 'transparent');

    const zoom = d3.zoom()
        .extent([
            [0, 0],
            [width, height]
        ])
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => { g.attr('transform', event.transform); });
    svg.call(zoom);
    STATE.zoom = zoom;

    const g = svg.append('g');

    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(80).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => d.size + 10))
        .force('group', d3.forceManyBody().strength(-50));

    STATE.simulation = simulation;

    const link = g.append('g')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-width', 1.2)
        .selectAll('line')
        .data(data.links)
        .enter().append('line')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-width', 1.2);

    const node = g.append('g')
        .selectAll('g')
        .data(data.nodes)
        .enter().append('g')
        .attr('cursor', 'pointer')
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            })
        );

    node.append('circle')
        .attr('r', d => Math.max(d.size || 6, 4))
        .attr('fill', d => COLOR_MAP[d.type] || '#66c0f4')
        .attr('stroke', 'rgba(255,255,255,0.1)')
        .attr('stroke-width', 1)
        .attr('opacity', 0.85)
        .style('filter', 'drop-shadow(0 0 6px rgba(0,0,0,0.3))');

    node.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .attr('font-size', d => d.type === 'game' ? 11 : 10)
        .attr('fill', '#8a9aaa')
        .attr('font-family', 'Inter, sans-serif')
        .text(d => d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name)
        .style('pointer-events', 'none')
        .style('text-shadow', '0 0 8px rgba(0,0,0,0.8)');

    node.on('mouseover', function(event, d) {
        node.select('circle').transition().duration(150)
            .attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 1);
        showTooltip(event, d);
    })
    .on('mouseout', function() {
        node.select('circle').transition().duration(150)
            .attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 1).attr('opacity', 0.85);
        hideTooltip();
    })
    .on('click', function(event, d) {
        selectNode(d);
    });

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function resizeGraph() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        svg.attr('width', w).attr('height', h);
        simulation.force('center', d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.3).restart();
    }
    window.addEventListener('resize', resizeGraph);

    STATE.svg = svg;
    STATE.g = g;
    STATE.node = node;
    STATE.link = link;
    STATE.simulation = simulation;
    STATE.resizeGraph = resizeGraph;

    loadingEl.classList.add('hide');

    const firstGame = data.nodes.find(n => n.type === 'game');
    if (firstGame) selectNode(firstGame);
}

// ================================
// 6. 选择节点
// ================================
function selectNode(d) {
    STATE.selectedNode = d;

    const empty = $('infoEmpty');
    const card = $('infoCard');
    empty.style.display = 'none';
    card.classList.add('active');

    $('nodeName').textContent = d.name;
    const typeLabel = TYPE_LABEL[d.type] || d.type;
    $('nodeTypeBadge').textContent = typeLabel;

    const degree = d.degree || 0;
    const links = STATE.data.links.filter(l => l.source.id === d.id || l.target.id === d.id);
    const relatedNodes = new Set();
    links.forEach(l => {
        if (l.source.id === d.id) relatedNodes.add(l.target.id);
        if (l.target.id === d.id) relatedNodes.add(l.source.id);
    });

    $('nodeStats').innerHTML = `
        <div class="stat-item"><div class="num">${degree}</div><div class="label">直接连接</div></div>
        <div class="stat-item"><div class="num">${relatedNodes.size}</div><div class="label">关联节点</div></div>
    `;

    const relEl = $('nodeRelations');
    const related = Array.from(relatedNodes).map(id => STATE.data.nodes.find(n => n.id === id)).filter(Boolean);
    const grouped = {};
    related.forEach(n => {
        if (!grouped[n.type]) grouped[n.type] = [];
        grouped[n.type].push(n);
    });

    let html = `<div class="rel-title">🔗 关联节点（${related.length}）</div>`;
    TYPE_ORDER.forEach(type => {
        if (grouped[type] && grouped[type].length > 0) {
            const label = TYPE_LABEL[type] || type;
            html += `<div class="rel-group">
                <div class="group-label">${label}</div>
                <div class="rel-list">
                    ${grouped[type].map(n => `<span class="rel-item" onclick="selectNodeById('${n.id}')">${n.name}</span>`).join('')}
                </div>
            </div>`;
        }
    });
    if (related.length === 0) html += `<div style="color:#3a5a6a;font-size:12px;margin-top:8px;">无关联节点</div>`;
    relEl.innerHTML = html;

    // 推荐按钮
    const recommendBtn = $('graphRecommendBtn');
    if (d.type === 'game') {
        recommendBtn.style.display = 'block';
        recommendBtn.onclick = function() {
            window.location.href = `recommend.html?game=${encodeURIComponent(d.name)}`;
        };
    } else {
        recommendBtn.style.display = 'none';
    }
}

function selectNodeById(id) {
    const node = STATE.data.nodes.find(n => n.id === id);
    if (node) selectNode(node);
}
window.selectNodeById = selectNodeById;

// ================================
// 7. 启动
// ================================
async function init() {
    await loadData();
    if (STATE.data) renderGraph(STATE.data);
}

document.addEventListener('DOMContentLoaded', init);

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (STATE.resizeGraph) STATE.resizeGraph();
    }, 200);
});