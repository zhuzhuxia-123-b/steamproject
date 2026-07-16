"use strict";

/* =========================================================
   Steam Game Galaxy · Game Duel
   - Flask API preferred
   - Local JSON fallback keeps all visualizations usable
   - SiliconFlow AI requested asynchronously
   ========================================================= */

const API_BASE = "http://127.0.0.1:5000";
const DATA_PATHS = {
    profiles: "data/game_profiles.json",
    vitality: "data/game_vitality.json",
    recommendations: "data/recommendations.json"
};

const DIMENSIONS = [
    ["探索性", "exploration"],
    ["挑战性", "challenge"],
    ["社交性", "social"],
    ["叙事性", "story"],
    ["动作性", "action"],
    ["游戏深度", "depth"]
];

const STATE = {
    mode: "api",
    profiles: [],
    gameMap: new Map(),
    vitalityByName: new Map(),
    vitalityByAppid: new Map(),
    recommendations: {},
    radar: null,
    comparing: false
};

const $ = id => document.getElementById(id);

window.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("resize", () => STATE.radar?.resize());

async function initialize() {
    initParticles();
    setStatus("正在连接数据服务…", "loading");
    setButtonLoading(true, "加载数据中…");

    try {
        await loadFromBackend();
        STATE.mode = "api";
        setStatus(`后端已连接 · ${STATE.profiles.length.toLocaleString()} 款游戏`, "ready");
    } catch (apiError) {
        console.warn("后端不可用，切换到本地 JSON：", apiError);
        try {
            await loadFromLocalJSON();
            STATE.mode = "local";
            setStatus(`本地模式 · ${STATE.profiles.length.toLocaleString()} 款游戏`, "warning");
        } catch (localError) {
            console.error("初始化失败：", localError);
            showError(`数据加载失败：${localError.message}`);
            setStatus("数据加载失败", "error");
            setButtonLoading(true, "无法开始分析");
            return;
        }
    }

    populateSelectors();
    bindEvents();
    setButtonLoading(false, "🚀 碰撞分析");
    await runComparison();
}

async function loadFromBackend() {
    await fetchJSON(`${API_BASE}/api/health`, {}, 4500);
    const listData = await fetchJSON(`${API_BASE}/api/game-list`, {}, 12000);
    const names = Array.isArray(listData.games)
        ? listData.games
        : Array.isArray(listData.data?.games)
            ? listData.data.games
            : [];

    if (names.length < 2) {
        throw new Error("后端没有返回足够的游戏名称");
    }

    STATE.profiles = names.map(name => ({ name }));
}

async function loadFromLocalJSON() {
    const [profileData, vitalityData, recommendationData] = await Promise.all([
        fetchJSON(DATA_PATHS.profiles),
        fetchJSON(DATA_PATHS.vitality),
        fetchJSON(DATA_PATHS.recommendations)
    ]);

    STATE.profiles = Array.isArray(profileData.games) ? profileData.games : [];
    if (STATE.profiles.length < 2) {
        throw new Error("game_profiles.json 中没有足够的游戏数据");
    }

    STATE.gameMap = new Map(
        STATE.profiles
            .filter(game => game?.name)
            .map(game => [game.name, game])
    );

    const vitalityGames = Array.isArray(vitalityData.games) ? vitalityData.games : [];
    STATE.vitalityByName = new Map(
        vitalityGames.filter(item => item?.name).map(item => [item.name, item])
    );
    STATE.vitalityByAppid = new Map(
        vitalityGames.filter(item => item?.appid != null).map(item => [String(item.appid), item])
    );

    STATE.recommendations = recommendationData.recommendations || {};
}

function populateSelectors() {
    const selectA = $("gameA-select");
    const selectB = $("gameB-select");
    if (!selectA || !selectB) {
        throw new Error("compare.html 与 compare.js 版本不一致：缺少游戏选择器");
    }

    const names = [...new Set(STATE.profiles.map(item => item.name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "zh-CN"));

    selectA.replaceChildren();
    selectB.replaceChildren();
    const fragmentA = document.createDocumentFragment();
    const fragmentB = document.createDocumentFragment();

    names.forEach(name => {
        fragmentA.appendChild(new Option(name, name));
        fragmentB.appendChild(new Option(name, name));
    });

    selectA.appendChild(fragmentA);
    selectB.appendChild(fragmentB);

    selectA.value = names.includes("Dota 2") ? "Dota 2" : names[0];
    selectB.value = names.includes("Counter-Strike 2")
        ? "Counter-Strike 2"
        : names.find(name => name !== selectA.value) || names[1];
}

function bindEvents() {
    $("compareBtn")?.addEventListener("click", runComparison);
    $("gameA-select")?.addEventListener("change", preventSameSelection.bind(null, "A"));
    $("gameB-select")?.addEventListener("change", preventSameSelection.bind(null, "B"));

    document.addEventListener("keydown", event => {
        if (event.key === "Enter" && !STATE.comparing) runComparison();
    });
}

function preventSameSelection(changed) {
    const a = $("gameA-select");
    const b = $("gameB-select");
    if (!a || !b || a.value !== b.value) return;

    const other = [...b.options].find(option => option.value !== a.value)?.value;
    if (changed === "A" && other) b.value = other;
    if (changed === "B" && other) a.value = other;
}

async function runComparison() {
    if (STATE.comparing) return;

    const gameAName = $("gameA-select")?.value;
    const gameBName = $("gameB-select")?.value;
    if (!gameAName || !gameBName) return showError("请选择两款游戏");
    if (gameAName === gameBName) return showError("请选择两款不同的游戏");

    STATE.comparing = true;
    clearError();
    setButtonLoading(true, "分析中…");

    try {
        const comparison = STATE.mode === "api"
            ? await getComparisonFromAPI(gameAName, gameBName)
            : getComparisonFromLocal(gameAName, gameBName);

        const A = comparison.gameA;
        const B = comparison.gameB;
        if (!A || !B) throw new Error("没有取得完整的游戏比较数据");

        $("resultContainer").style.display = "block";
        $("emptyState").style.display = "none";

        renderStars(A, B);
        renderRadar(A, B);
        renderDifferences(A, B);
        renderMetrics(A, B, comparison.similarity);
        renderTags(A, B, comparison.tag_analysis);
        renderRecommendations(A, B, comparison.recommendationsA, comparison.recommendationsB);

        const localInsight = generateLocalInsight(A, B, comparison.similarity, comparison.tag_analysis);
        renderInsight(localInsight, "本地画像引擎");
        requestAIAnalysis(A, B, localInsight);

        requestAnimationFrame(() => {
            $("resultContainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
            STATE.radar?.resize();
        });
    } catch (error) {
        console.error("比较失败：", error);
        showError(`碰撞分析失败：${error.message}`);
    } finally {
        STATE.comparing = false;
        setButtonLoading(false, "🚀 碰撞分析");
    }
}

async function getComparisonFromAPI(gameA, gameB) {
    const data = await fetchJSON(`${API_BASE}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameA, gameB })
    }, 20000);

    const payload = data.data || data;
    return {
        gameA: payload.gameA,
        gameB: payload.gameB,
        similarity: normalizeSimilarity(payload.similarity),
        tag_analysis: payload.tag_analysis,
        recommendationsA: payload.recommendationsA,
        recommendationsB: payload.recommendationsB
    };
}

function getComparisonFromLocal(gameAName, gameBName) {
    const rawA = STATE.gameMap.get(gameAName);
    const rawB = STATE.gameMap.get(gameBName);
    if (!rawA || !rawB) throw new Error("在本地画像数据中找不到所选游戏");

    const A = attachVitality(rawA);
    const B = attachVitality(rawB);
    return {
        gameA: A,
        gameB: B,
        similarity: calculateProfileSimilarity(A, B),
        tag_analysis: compareTags(A, B),
        recommendationsA: (STATE.recommendations[A.name] || []).slice(0, 6),
        recommendationsB: (STATE.recommendations[B.name] || []).slice(0, 6)
    };
}

function attachVitality(game) {
    const vitality = STATE.vitalityByName.get(game.name)
        || STATE.vitalityByAppid.get(String(game.appid))
        || {};
    return { ...game, vitality };
}

function renderStars(A, B) {
    renderStar("A", A);
    renderStar("B", B);

    $("starNameA").onclick = () => openProfile(A);
    $("starNameB").onclick = () => openProfile(B);
}

function renderStar(side, game) {
    $(`starName${side}`).textContent = game.name || "未知游戏";
    $(`starMeta${side}`).textContent = [game.developer, game.release_year, game.genres]
        .filter(Boolean)
        .join(" · ") || "暂无元数据";

    const score = clamp(number(game.score) * 100, 0, 100);
    const gvi = number(game.vitality?.vitality);
    const owners = formatOwners(game.owners);
    const price = number(game.price) === 0 ? "免费" : `¥/￥${number(game.price).toFixed(2)}`;

    $(`starStats${side}`).innerHTML = [
        statPill("好评率", `${score.toFixed(1)}%`),
        statPill("玩家规模", owners),
        statPill("价格", price),
        statPill("GVI", gvi ? gvi.toFixed(1) : "—")
    ].join("");
}

function statPill(label, value) {
    return `<span class="stat-pill"><small>${escapeHTML(label)}</small>${escapeHTML(value)}</span>`;
}

function renderRadar(A, B) {
    if (typeof echarts === "undefined") throw new Error("ECharts 未成功加载");

    const element = $("radarChart");
    STATE.radar?.dispose();
    STATE.radar = echarts.init(element);

    STATE.radar.setOption({
        animationDuration: 800,
        color: ["#66c0f4", "#a66cff"],
        tooltip: {
            trigger: "item",
            backgroundColor: "rgba(7,11,21,.96)",
            borderColor: "rgba(102,192,244,.25)",
            textStyle: { color: "#e8edf5" }
        },
        legend: {
            top: 8,
            data: [A.name, B.name],
            textStyle: { color: "#8aa0b5" }
        },
        radar: {
            center: ["50%", "55%"],
            radius: "67%",
            splitNumber: 5,
            indicator: DIMENSIONS.map(([name]) => ({ name, max: 100 })),
            axisName: { color: "#9bb4c9", fontSize: 12 },
            axisLine: { lineStyle: { color: "rgba(160,190,215,.14)" } },
            splitLine: { lineStyle: { color: "rgba(160,190,215,.12)" } },
            splitArea: { areaStyle: { color: ["rgba(255,255,255,.008)", "rgba(102,192,244,.018)"] } }
        },
        series: [{
            type: "radar",
            symbolSize: 6,
            lineStyle: { width: 2 },
            data: [
                {
                    name: A.name,
                    value: DIMENSIONS.map(([, key]) => number(A[key])),
                    areaStyle: { opacity: .16 }
                },
                {
                    name: B.name,
                    value: DIMENSIONS.map(([, key]) => number(B[key])),
                    areaStyle: { opacity: .13 }
                }
            ]
        }]
    });
}

function renderDifferences(A, B) {
    const container = $("diffContainer");
    container.innerHTML = DIMENSIONS.map(([name, key]) => {
        const a = clamp(number(A[key]), 0, 100);
        const b = clamp(number(B[key]), 0, 100);
        const delta = a - b;
        const winner = Math.abs(delta) < 2
            ? "接近"
            : delta > 0 ? `${A.name} +${Math.abs(delta).toFixed(0)}` : `${B.name} +${Math.abs(delta).toFixed(0)}`;

        return `
            <div class="diff-item">
                <div class="diff-title-row">
                    <span class="diff-name">${escapeHTML(name)}</span>
                    <span class="diff-winner">${escapeHTML(winner)}</span>
                </div>
                <div class="diff-dual-row">
                    <span class="diff-value diff-value-a">${a.toFixed(0)}</span>
                    <div class="diff-track diff-track-a"><div style="width:${a}%"></div></div>
                    <div class="diff-center-line"></div>
                    <div class="diff-track diff-track-b"><div style="width:${b}%"></div></div>
                    <span class="diff-value diff-value-b">${b.toFixed(0)}</span>
                </div>
            </div>`;
    }).join("");
}

function renderMetrics(A, B, providedSimilarity) {
    const va = number(A.vitality?.vitality);
    const vb = number(B.vitality?.vitality);
    $("gviA").textContent = va ? va.toFixed(1) : "—";
    $("gviB").textContent = vb ? vb.toFixed(1) : "—";

    const total = Math.max(va + vb, 1);
    $("gviBarA").style.width = `${va / total * 100}%`;
    $("gviBarB").style.width = `${vb / total * 100}%`;

    const similarity = normalizeSimilarity(providedSimilarity ?? calculateProfileSimilarity(A, B));
    const percent = similarity * 100;
    $("simValue").textContent = `${percent.toFixed(1)}%`;
    $("simBarFill").style.width = `${percent}%`;
    $("simLabel").textContent = similarityLabel(percent);

    renderVitalityBreakdown(A, B);
}

function renderVitalityBreakdown(A, B) {
    const card = document.querySelector(".metrics-card");
    if (!card) return;
    let box = $("vitalityBreakdownDual");
    if (!box) {
        box = document.createElement("div");
        box.id = "vitalityBreakdownDual";
        box.className = "vitality-breakdown-dual";
        card.appendChild(box);
    }

    const fields = [
        ["玩家规模", "player"],
        ["社区活跃", "community"],
        ["评价质量", "positive_rate"],
        ["持续运营", "operation"],
        ["年龄韧性", "age_factor"]
    ];

    box.innerHTML = fields.map(([label, key]) => {
        const a = clamp(number(A.vitality?.[key]), 0, 100);
        const b = clamp(number(B.vitality?.[key]), 0, 100);
        return `
            <div class="vitality-mini-row">
                <span>${escapeHTML(label)}</span>
                <div class="vitality-mini-values"><b class="a">${a.toFixed(0)}</b><b class="b">${b.toFixed(0)}</b></div>
                <div class="vitality-mini-bars">
                    <i class="a" style="width:${a}%"></i>
                    <i class="b" style="width:${b}%"></i>
                </div>
            </div>`;
    }).join("");
}

function renderTags(A, B, providedAnalysis) {
    const analysis = providedAnalysis || compareTags(A, B);
    const common = analysis.common || [];
    const uniqueA = analysis.uniqueA || analysis.unique_a || [];
    const uniqueB = analysis.uniqueB || analysis.unique_b || [];
    const overlap = analysis.overlap != null
        ? number(analysis.overlap)
        : calculateTagOverlap(A, B);

    renderTagCloud("uniqueA", uniqueA.length ? uniqueA : difference(getTags(A), common), "a");
    renderTagCloud("commonTags", common, "common");
    renderTagCloud("uniqueB", uniqueB.length ? uniqueB : difference(getTags(B), common), "b");
    $("tagOverlapLabel").textContent = `${(normalizeSimilarity(overlap) * 100).toFixed(1)}% 重叠`;
}

function renderTagCloud(id, tags, type) {
    const box = $(id);
    const items = tags.slice(0, 14);
    box.innerHTML = items.length
        ? items.map((tag, index) => `<span class="tag-chip tag-${type} tag-size-${index % 3}">${escapeHTML(tag)}</span>`).join("")
        : `<span class="tag-empty">暂无</span>`;
}

function renderRecommendations(A, B, recA, recB) {
    const listA = Array.isArray(recA) ? recA : (STATE.recommendations[A.name] || []).slice(0, 6);
    const listB = Array.isArray(recB) ? recB : (STATE.recommendations[B.name] || []).slice(0, 6);

    $("recommendSection").innerHTML = `
        ${recommendColumn(A, listA, "a")}
        <div class="migration-core">
            <div class="migration-orbit">↔</div>
            <strong>跨星系迁移</strong>
            <span>相似标签降低学习成本，差异画像带来新鲜体验</span>
        </div>
        ${recommendColumn(B, listB, "b")}`;
}

function recommendColumn(source, items, side) {
    const cards = items.length
        ? items.slice(0, 5).map(item => `
            <button class="recommend-item recommend-${side}" data-game="${escapeAttribute(item.name)}">
                <span class="recommend-rank">${String(items.indexOf(item) + 1).padStart(2, "0")}</span>
                <span class="recommend-info">
                    <strong>${escapeHTML(item.name || "未知游戏")}</strong>
                    <small>${escapeHTML(item.genres || item.developer || "相似游戏")}</small>
                </span>
                <span class="recommend-score">${(normalizeSimilarity(item.similarity) * 100).toFixed(1)}%</span>
            </button>`).join("")
        : `<div class="recommend-empty">暂无推荐数据</div>`;

    setTimeout(() => {
        document.querySelectorAll(".recommend-item[data-game]").forEach(button => {
            button.onclick = () => location.href = `profile.html?game=${encodeURIComponent(button.dataset.game)}`;
        });
    }, 0);

    return `
        <div class="recommend-column">
            <div class="recommend-column-title ${side}">
                <span>从</span><strong>${escapeHTML(source.name)}</strong><span>出发</span>
            </div>
            <div class="recommend-list">${cards}</div>
        </div>`;
}

async function requestAIAnalysis(A, B, fallbackText) {
    const insight = $("insightText");
    insight.classList.add("is-loading");
    insight.dataset.source = "SiliconFlow 正在生成…";

    try {
        const data = await fetchJSON(`${API_BASE}/api/ai/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameA: A.name, gameB: B.name })
        }, 90000);

        const analysis = data.analysis || data.data?.analysis;
        if (!analysis) throw new Error(data.error || "AI 接口未返回分析文本");
        renderInsight(analysis, data.provider || data.data?.provider || "SiliconFlow");
    } catch (error) {
        console.warn("AI 分析不可用，保留本地分析：", error);
        renderInsight(`${fallbackText}\n\n[AI 服务暂不可用：${error.message}]`, "本地画像引擎");
    }
}

function renderInsight(text, source) {
    const box = $("insightText");
    box.classList.remove("is-loading");
    box.textContent = text;
    box.dataset.source = source;
}

function generateLocalInsight(A, B, similarityValue, tagAnalysis) {
    const strongestA = strongestDimension(A);
    const strongestB = strongestDimension(B);
    const similarity = normalizeSimilarity(similarityValue ?? calculateProfileSimilarity(A, B)) * 100;
    const common = (tagAnalysis?.common || intersection(getTags(A), getTags(B))).slice(0, 5);
    const gviA = number(A.vitality?.vitality);
    const gviB = number(B.vitality?.vitality);

    const vitalityText = Math.abs(gviA - gviB) < 3
        ? "两者生命力接近，当前生态稳定性差距不明显。"
        : gviA > gviB
            ? `${A.name} 的 GVI 更高，玩家规模、社区活跃或持续运营表现更占优势。`
            : `${B.name} 的 GVI 更高，玩家规模、社区活跃或持续运营表现更占优势。`;

    return `生态定位：${A.name} 的突出维度是${strongestA.name}（${strongestA.value.toFixed(0)}），${B.name} 的突出维度是${strongestB.name}（${strongestB.value.toFixed(0)}）。\n\n核心差异：两款游戏的六维画像相似度为 ${similarity.toFixed(1)}%。${vitalityText}\n\n共同基因：${common.length ? `双方共享 ${common.join("、")} 等标签。` : "双方核心标签交集较少，体验方向差异明显。"}\n\n迁移建议：重视共同标签的玩家迁移成本较低；追求另一款游戏强势画像维度的玩家，则能获得更明显的新体验。`;
}

function strongestDimension(game) {
    return DIMENSIONS
        .map(([name, key]) => ({ name, value: number(game[key]) }))
        .sort((a, b) => b.value - a.value)[0];
}

function compareTags(A, B) {
    const tagsA = getTags(A);
    const tagsB = getTags(B);
    const common = intersection(tagsA, tagsB);
    const union = new Set([...tagsA.map(normalizeTag), ...tagsB.map(normalizeTag)]);
    return {
        common,
        uniqueA: difference(tagsA, common),
        uniqueB: difference(tagsB, common),
        overlap: union.size ? common.length / union.size : 0
    };
}

function calculateTagOverlap(A, B) {
    return compareTags(A, B).overlap;
}

function getTags(game) {
    const raw = game?.tags || "";
    const values = Array.isArray(raw) ? raw : String(raw).split(",");
    return [...new Set(values.map(item => item.trim()).filter(Boolean))];
}

function intersection(a, b) {
    const mapB = new Set(b.map(normalizeTag));
    return a.filter(item => mapB.has(normalizeTag(item)));
}

function difference(values, excluded) {
    const set = new Set(excluded.map(normalizeTag));
    return values.filter(item => !set.has(normalizeTag(item)));
}

function normalizeTag(value) {
    return String(value).trim().toLowerCase();
}

function calculateProfileSimilarity(A, B) {
    const va = DIMENSIONS.map(([, key]) => number(A[key]));
    const vb = DIMENSIONS.map(([, key]) => number(B[key]));
    const dot = va.reduce((sum, value, index) => sum + value * vb[index], 0);
    const ma = Math.sqrt(va.reduce((sum, value) => sum + value ** 2, 0));
    const mb = Math.sqrt(vb.reduce((sum, value) => sum + value ** 2, 0));
    return ma && mb ? clamp(dot / (ma * mb), 0, 1) : 0;
}

function normalizeSimilarity(value) {
    const result = number(value);
    return clamp(result > 1 ? result / 100 : result, 0, 1);
}

function similarityLabel(percent) {
    if (percent >= 85) return "高度同源 · 迁移成本较低";
    if (percent >= 65) return "中度相似 · 共享部分核心体验";
    if (percent >= 40) return "差异互补 · 适合探索新体验";
    return "生态差异显著 · 跨类型碰撞";
}

function openProfile(game) {
    location.href = `profile.html?game=${encodeURIComponent(game.name)}`;
}

async function fetchJSON(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error(`接口未返回 JSON（HTTP ${response.status}）`);
        }
        const data = await response.json();
        if (!response.ok || data.success === false) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        if (error.name === "AbortError") throw new Error("请求超时");
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

function setStatus(text, type) {
    const statusText = $("statusText");
    const dot = document.querySelector(".status-dot");
    if (statusText) statusText.textContent = text;
    if (dot) dot.dataset.state = type;
}

function setButtonLoading(disabled, text) {
    const button = $("compareBtn");
    if (!button) return;
    button.disabled = disabled;
    button.textContent = text;
}

function showError(message) {
    let box = $("duelErrorBox");
    if (!box) {
        box = document.createElement("div");
        box.id = "duelErrorBox";
        box.className = "duel-error-box";
        document.querySelector(".main-content")?.prepend(box);
    }
    box.innerHTML = `<strong>页面提示</strong><span>${escapeHTML(message)}</span>`;
}

function clearError() {
    $("duelErrorBox")?.remove();
}

function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function formatOwners(value) {
    const n = number(value);
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)} 万`;
    return n ? n.toLocaleString() : "—";
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
}

function initParticles() {
    const canvas = $("particles-canvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];

    function resize() {
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        canvas.style.width = `${innerWidth}px`;
        canvas.style.height = `${innerHeight}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        particles = Array.from({ length: Math.min(130, Math.floor(innerWidth / 10)) }, () => ({
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            r: Math.random() * 1.2 + .25,
            a: Math.random() * .55 + .1,
            v: Math.random() * .08 + .015
        }));
    }

    function draw() {
        context.clearRect(0, 0, innerWidth, innerHeight);
        for (const particle of particles) {
            particle.y -= particle.v;
            if (particle.y < -3) particle.y = innerHeight + 3;
            context.beginPath();
            context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
            context.fillStyle = `rgba(130,195,235,${particle.a})`;
            context.fill();
        }
        requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
}
