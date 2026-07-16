import pandas as pd
import json
import os
import numpy as np


# =========================
# 1. 路径配置
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

input_file = os.path.join(
    BASE_DIR,
    "data",
    "steam_clean.json"
)

output_file = os.path.join(
    BASE_DIR,
    "data",
    "game_profiles.json"
)


# =========================
# 2. 读取数据
# =========================

df = pd.read_json(input_file)

print(f"加载数据: {len(df)} 款游戏")


# =========================
# 3. 筛选有效游戏
# =========================

df_profile = df[
    (df["Tags"] != "") &
    (df["Review score"] > 0) &
    (df["Name"].notna()) &
    (df["Owners"] > 50000)
].copy()


print(
    f"画像有效数据（热门游戏）: {len(df_profile)} 款"
)



# =========================
# 4. 游戏画像关键词
# =========================


KEYWORDS = {


    # 探索性
    # 去除 Adventure / Survival 等容易误判词

    "exploration":[

        "Open World",
        "Exploration",
        "Sandbox",
        "Free Roam",
        "Metroidvania",
        "Open World Survival Craft",
        "Immersive Sim"

    ],



    # 挑战性
    # 增加竞技和策略维度

    "challenge":[

        "Difficult",
        "Souls-like",
        "Hardcore",
        "Challenging",
        "Unforgiving",
        "Roguelike",
        "Roguelite",
        "Precision Platformer",
        "Competitive",
        "Strategy",
        "Strategic",
        "Tactical",
        "MOBA"

    ],



    # 社交性

    "social":[

        "Multiplayer",
        "Multi-player",
        "Online",
        "Co-op",
        "Cooperative",
        "MMO",
        "PvP",
        "Team-Based"

    ],



    # 叙事性

    "story":[

        "Story Rich",
        "Narrative",
        "Choices Matter",
        "Visual Novel",
        "Interactive Fiction",
        "Multiple Endings",
        "Emotional",
        "Story-Driven"

    ],



    # 动作性

    "action":[

        "Action",
        "Shooter",
        "FPS",
        "Combat",
        "Fighting",
        "Hack and Slash",
        "Third Person",
        "Bullet Hell",
        "Action RPG"

    ]

}




# =========================
# 5. 计算画像分数
# =========================


def calc_dimension_score(
        tags_str,
        categories_str,
        keywords
):


    if pd.isna(tags_str) or tags_str == "":

        return 0



    text = tags_str.lower()


    matched = 0



    # 标签匹配

    for keyword in keywords:

        if keyword.lower() in text:

            matched += 1



    # Categories增强

    if categories_str and not pd.isna(categories_str):

        category_text = categories_str.lower()


        for keyword in keywords:

            if keyword.lower() in category_text:

                matched += 0.5

                break



    # 控制分布

    score = matched / 5


    return min(score,1)



print("\n计算游戏画像...")



dimensions = [

    "exploration",
    "challenge",
    "social",
    "story",
    "action"

]


for dim in dimensions:


    df_profile[f"{dim}_score"] = df_profile.apply(

        lambda row:
        calc_dimension_score(

            row["Tags"],

            row["Categories"],

            KEYWORDS[dim]

        ),

        axis=1

    )




# =========================
# 6. 游戏深度
# =========================


playtime = (

    0.6 *
    df_profile["Average playtime forever"]

    +

    0.4 *
    df_profile["Median playtime forever"]

)



playtime_log = np.log1p(playtime)



df_profile["depth_score"] = (

    playtime_log - playtime_log.min()

) / (

    playtime_log.max()
    -
    playtime_log.min()

)



df_profile["depth_score"] = (

    df_profile["depth_score"]
    .clip(0,1)

)



print("画像计算完成")



# =========================
# 7. 构建输出
# =========================


result=[]



for _,row in df_profile.iterrows():


    result.append({

        "appid":
        int(row["AppID"]),


        "name":
        row["Name"],


        "genres":
        row["Genres"],


        "developer":
        row["Developers"],


        "release_year":
        int(row["Release year"]),


        "price":
        float(row["Price"]),


        "score":
        float(row["Review score"]),


        "owners":
        float(row["Owners"]),



        # 六维画像

        "exploration":
        round(row["exploration_score"]*100,1),


        "challenge":
        round(row["challenge_score"]*100,1),


        "social":
        round(row["social_score"]*100,1),


        "story":
        round(row["story_score"]*100,1),


        "action":
        round(row["action_score"]*100,1),


        "depth":
        round(row["depth_score"]*100,1),



        "tags":
        row["Tags"],


        "categories":
        row["Categories"]

    })




# =========================
# 8. 保存 JSON
# =========================


output={


    "total_games":
    len(result),


    "dimensions":[

        "探索性",
        "挑战性",
        "社交性",
        "叙事性",
        "动作性",
        "游戏深度"

    ],


    "dimension_keys":[

        "exploration",
        "challenge",
        "social",
        "story",
        "action",
        "depth"

    ],


    "games":
    result

}



with open(

    output_file,

    "w",

    encoding="utf-8"

) as f:


    json.dump(

        output,

        f,

        ensure_ascii=False,

        indent=2

    )




print("\n===================")
print("✓ 游戏画像生成完成")
print("===================")

print(
    "游戏数量:",
    len(result)
)

print(
    "保存位置:",
    output_file
)




# =========================
# 9. 样例测试
# =========================


print("\n=== 样例 ===")


sample_names=[

    "Dota 2",
    "Counter-Strike",
    "Elden Ring",
    "Stardew Valley",
    "Factorio"

]



samples=[

    g for g in result

    if any(

        name in g["name"]

        for name in sample_names

    )

]



for g in samples[:5]:


    print("\n",g["name"])


    print(

        "探索:",
        g["exploration"],

        "挑战:",
        g["challenge"],

        "社交:",
        g["social"]

    )


    print(

        "剧情:",
        g["story"],

        "动作:",
        g["action"],

        "深度:",
        g["depth"]

    )