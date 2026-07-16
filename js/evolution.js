/*
================================================

Steam Game Galaxy
Evolution Explorer

evolution.js

功能:
1. Timeline
2. Growth Chart
3. Genre Evolution
4. Tag Nebula
5. Era Games

================================================
*/

let evolutionData = null;
let years = [];
let currentIndex = 0;

let growthChart = null;
let genreChart = null;

// ========================================
// 初始化
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    initEvolution
);

async function initEvolution() {
    try {
        setStatus(
            "Loading Evolution Data..."
        );

        const response =
            await fetch(
                "data/evolution.json"
            );

        evolutionData =
            await response.json();

        years =
            evolutionData.years;

        if (!years || years.length === 0) {
            throw new Error(
                "evolution.json没有年份数据"
            );
        }

        initTimeline();
        initCharts();
        updateYear(
            currentIndex
        );
        setStatus(
            "Evolution Ready"
        );
    } catch (error) {
        console.error(
            error
        );
        setStatus(
            "Evolution Load Failed"
        );
        showError(
            error.message
        );
    }
}

// ========================================
// 状态
// ========================================

function setStatus(text) {
    const el =
        document.getElementById(
            "statusText"
        );
    if (el) {
        el.innerText = text;
    }
}

// ========================================
// 年份滑块
// ========================================

function initTimeline() {
    const slider =
        document.getElementById(
            "yearSlider"
        );

    slider.min = 0;
    slider.max =
        years.length - 1;

    slider.value =
        Math.floor(
            years.length / 2
        );

    currentIndex =
        Number(
            slider.value
        );

    slider.addEventListener(
        "input",
        () => {
            updateYear(
                Number(
                    slider.value
                )
            );
        }
    );

    createYearScale();
}

function createYearScale() {
    const box =
        document.getElementById(
            "yearScale"
        );

    box.innerHTML = "";

    const step =
        Math.ceil(
            years.length / 6
        );

    years
        .filter(
            (_, i) =>
            i % step === 0
        )
        .forEach(
            item => {
                let span =
                    document.createElement(
                        "span"
                    );
                span.innerText =
                    item.year;
                box.appendChild(
                    span
                );
            }
        );
}

// ========================================
// 更新时代
// ========================================

function updateYear(index) {
    currentIndex = index;

    const item =
        years[index];

    if (!item)
        return;

    document
        .getElementById(
            "currentYear"
        )
        .innerText =
        item.year;

    document
        .getElementById(
            "gameCount"
        )
        .innerText =
        item.game_count
        .toLocaleString();

    document
        .getElementById(
            "avgScore"
        )
        .innerText =
        (
            item.avg_score * 100
        )
        .toFixed(1) +
        "%";

    document
        .getElementById(
            "avgVitality"
        )
        .innerText =
        item.avg_vitality
        .toFixed(1);

    updateStory(
        item
    );
    renderTags(
        item.tags
    );
    renderGames(
        item.top_games
    );
}

// ========================================
// 时代故事
// ========================================

function updateStory(item) {
    const desc =
        document
        .getElementById(
            "eraDescription"
        );

    let text = "";

    if (item.year < 2014) {
        text =
            `
        Steam早期探索阶段。
        
        游戏生态仍以传统PC游戏、
        独立开发者和核心玩家社区为主。
        `;
    } else if (item.year < 2018) {
        text =
            `
        Steam进入快速扩张时代。
        
        独立游戏数量增加，
        多类型游戏开始形成星系。
        `;
    } else if (item.year < 2021) {
        text =
            `
        在线游戏与开放世界生态爆发。
        
        玩家社交、
        生存、
        多人体验成为重要方向。
        `;
    } else {
        text =
            `
        Steam进入成熟宇宙阶段。
        
        游戏类型高度丰富，
        AI辅助开发、
        长生命周期运营成为趋势。
        `;
    }

    desc.innerHTML =
        `
    <strong>
    ${item.year} Era
    </strong>
    <br><br>
    ${text}
    `;
}

// ========================================
// 初始化图表
// ========================================

function initCharts() {
    growthChart =
        echarts.init(
            document.getElementById(
                "growthChart"
            )
        );

    genreChart =
        echarts.init(
            document.getElementById(
                "genreChart"
            )
        );

    renderGrowth();
    renderGenre();
}

// ========================================
// 游戏数量增长
// ========================================

function renderGrowth() {
    growthChart.setOption({
        tooltip: {
            trigger: "axis"
        },
        grid: {
            left: 40,
            right: 30,
            top: 40,
            bottom: 40
        },
        xAxis: {
            type: "category",
            data:
                years.map(
                    x => x.year
                ),
            axisLabel: {
                color: "#789"
            }
        },
        yAxis: {
            type: "value",
            axisLabel: {
                color: "#789"
            }
        },
        series: [{
            name: "Games",
            type: "line",
            smooth: true,
            data:
                years.map(
                    x =>
                    x.game_count
                ),
            symbolSize: 8
        }]
    });
}

// ========================================
// 类型演化
// ========================================

function renderGenre() {
    let allGenres =
        new Set();

    years.forEach(
        y => {
            y.genres.forEach(
                g =>
                allGenres.add(
                    g.name
                )
            );
        }
    );

    let topGenres =
        Array.from(
            allGenres
        )
        .slice(
            0,
            6
        );

    let series =
        topGenres.map(
            genre => ({
                name: genre,
                type: "line",
                stack: "genre",
                smooth: true,
                areaStyle: {},
                data:
                    years.map(
                        y => {
                            let obj =
                                y.genres.find(
                                    g =>
                                    g.name === genre
                                );
                            return obj ?
                                obj.value :
                                0;
                        }
                    )
            })
        );

    genreChart.setOption({
        tooltip: {
            trigger: "axis"
        },
        legend: {
            textStyle: {
                color: "#aaa"
            }
        },
        xAxis: {
            type: "category",
            data:
                years.map(
                    y => y.year
                )
        },
        yAxis: {
            type: "value"
        },
        series: series
    });
}

// ========================================
// 标签星云
// ========================================

function renderTags(tags) {
    const box =
        document.getElementById(
            "tagNebula"
        );

    box.innerHTML = "";

    if (!tags)
        return;

    tags.forEach(
        (tag, index) => {
            let span =
                document.createElement(
                    "span"
                );

            span.className =
                "evolution-tag ";

            if (index < 3) {
                span.className +=
                    "large";
            } else if (index < 8) {
                span.className +=
                    "medium";
            } else {
                span.className +=
                    "small";
            }

            span.innerText =
                tag;

            box.appendChild(
                span
            );
        }
    );
}

// ========================================
// 代表游戏
// ========================================

function renderGames(games) {
    const box =
        document.getElementById(
            "topGames"
        );

    box.innerHTML = "";

    if (!games)
        return;

    games.forEach(
        game => {
            let div =
                document.createElement(
                    "div"
                );

            div.className =
                "game-star";

            div.innerHTML =
                `
            <div class="game-star-name">
            ⭐ ${game.name}
            </div>
            <div class="game-star-score">
            Score:
            ${(game.score * 100).toFixed(1)}%
            </div>
            <div class="game-star-genre">
            ${game.genres || ""}
            </div>
            `;

            box.appendChild(
                div
            );
        }
    );
}

// ========================================
// 错误
// ========================================

function showError(message) {
    const main =
        document.querySelector(
            ".main-content"
        );
    let box =
        document.createElement(
            "div"
        );
    box.className =
        "duel-error-box";
    box.innerHTML =
        `
    Evolution 数据加载失败:
    <br>
    ${message}
    `;
    main.prepend(
        box
    );
}