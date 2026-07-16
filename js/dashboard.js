/*
=================================================

Steam Game Galaxy
Galaxy Observatory Dashboard

dashboard.js

功能:

1. Overview Metrics
2. Galaxy Health Gauge
3. Genre Civilization Sunburst
4. Developer Empire
5. Tag Nebula

=================================================
*/

let dashboardData = null;

let healthChart = null;
let genreChart = null;
let developerChart = null;

document.addEventListener(
    "DOMContentLoaded",
    initDashboard
);

// =====================================
// 初始化
// =====================================

async function initDashboard() {
    try {
        setStatus(
            "Loading Observatory..."
        );

        const response =
            await fetch(
                "data/dashboard.json"
            );

        dashboardData =
            await response.json();

        renderOverview();
        initHealth();
        initGenre();
        initDeveloper();
        renderTags();

        setStatus(
            "Observatory Ready"
        );
    } catch (error) {
        console.error(
            error
        );
        setStatus(
            "Dashboard Failed"
        );
        showError(
            error.message
        );
    }
}

// =====================================
// 状态
// =====================================

function setStatus(text) {
    const el =
        document.getElementById(
            "statusText"
        );
    if (el) {
        el.innerText = text;
    }
}

// =====================================
// Overview
// =====================================

function renderOverview() {
    const data =
        dashboardData.overview;

    document
        .getElementById(
            "totalGames"
        )
        .innerText =
        data.total_games
        .toLocaleString();

    document
        .getElementById(
            "analyzedGames"
        )
        .innerText =
        data.analyzed_games
        .toLocaleString();

    document
        .getElementById(
            "avgVitality"
        )
        .innerText =
        data.avg_vitality.toFixed(1);

    document
        .getElementById(
            "activeYear"
        )
        .innerText =
        data.active_year;
}

// =====================================
// Galaxy Health
// =====================================

function initHealth() {
    healthChart =
        echarts.init(
            document.getElementById(
                "healthGauge"
            )
        );

    const health =
        dashboardData.health;

    document
        .getElementById(
            "qualityScore"
        )
        .innerText =
        health.quality.toFixed(1);

    document
        .getElementById(
            "vitalityScore"
        )
        .innerText =
        health.vitality.toFixed(1);

    document
        .getElementById(
            "diversityScore"
        )
        .innerText =
        health.diversity.toFixed(1);

    healthChart.setOption({
        series: [{
            type: "gauge",
            startAngle: 220,
            endAngle: -40,
            min: 0,
            max: 100,
            radius: "85%",
            progress: {
                show: true,
                width: 18
            },
            axisLine: {
                lineStyle: {
                    width: 18
                }
            },
            detail: {
                valueAnimation: true,
                formatter: "{value}",
                color: "#ffd93d",
                fontSize: 45,
                fontFamily: "JetBrains Mono"
            },
            data: [{
                value: health.score,
                name: "Galaxy Health"
            }]
        }]
    });
}

// =====================================
// Genre Civilization
// =====================================

function initGenre() {
    genreChart =
        echarts.init(
            document.getElementById(
                "genreSunburst"
            )
        );

    let children =
        dashboardData.genres.map(
            item => ({
                name: item.name,
                value: item.value
            })
        );

    genreChart.setOption({
        tooltip: {
            formatter: function(params) {
                return (
                    params.name +
                    "<br>Games: " +
                    params.value
                );
            }
        },
        series: [{
            type: "sunburst",
            radius: [
                "15%",
                "85%"
            ],
            data: [{
                name: "Steam Universe",
                children: children
            }],
            label: {
                color: "#ddd"
            }
        }]
    });
}

// =====================================
// Developer Empire
// =====================================

function initDeveloper() {
    developerChart =
        echarts.init(
            document.getElementById(
                "developerChart"
            )
        );

    const data =
        dashboardData.developers
        .slice()
        .reverse();

    developerChart.setOption({
        tooltip: {
            trigger: "axis"
        },
        grid: {
            left: 120,
            right: 40,
            top: 30,
            bottom: 30
        },
        xAxis: {
            type: "value",
            axisLabel: {
                color: "#789"
            }
        },
        yAxis: {
            type: "category",
            data: data.map(
                x => x.name
            ),
            axisLabel: {
                color: "#9ab"
            }
        },
        series: [{
            type: "bar",
            data: data.map(
                x => x.value
            ),
            barWidth: 16
        }]
    });
}

// =====================================
// Tag Nebula
// =====================================

function renderTags() {
    const box =
        document.getElementById(
            "tagNebula"
        );

    box.innerHTML = "";

    const tags =
        dashboardData.tags;

    tags.forEach(
        (tag, index) => {
            const span =
                document.createElement(
                    "span"
                );

            span.className =
                "dashboard-tag";

            if (index < 5) {
                span.classList.add(
                    "large"
                );
            } else if (index < 15) {
                span.classList.add(
                    "medium"
                );
            } else {
                span.classList.add(
                    "small"
                );
            }

            span.innerHTML =
                tag.name;

            span.title =
                "Popularity: " +
                tag.value;

            box.appendChild(
                span
            );
        }
    );
}

// =====================================
// 错误
// =====================================

function showError(message) {
    const main =
        document.querySelector(
            ".main-content"
        );

    const box =
        document.createElement(
            "div"
        );

    box.style.cssText =
        `
    margin:20px;
    padding:20px;
    background:
    rgba(255,80,80,.1);
    border:
    1px solid rgba(255,80,80,.3);
    border-radius:12px;
    color:#ffaaaa;
    `;

    box.innerHTML =
        `
    Dashboard加载失败:
    <br>
    ${message}
    `;

    main.prepend(
        box
    );
}

// =====================================
// 自适应
// =====================================

window.addEventListener(
    "resize",
    () => {
        if (healthChart)
            healthChart.resize();

        if (genreChart)
            genreChart.resize();

        if (developerChart)
            developerChart.resize();
    }
);