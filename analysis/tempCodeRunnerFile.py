import pandas as pd
import numpy as np
import json
import os

from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# =========================
# 1. 路径
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


profile_file = os.path.join(
    BASE_DIR,
    "data",
    "game_profiles.json"
)


vitality_file = os.path.join(
    BASE_DIR,
    "data",
    "game_vitality.json"
)


output_file = os.path.join(
    BASE_DIR,
    "data",
    "recommendations.json"
)



# =========================
# 2. 加载数据
# =========================


print("加载游戏画像...")


with open(profile_file,encoding="utf-8") as f:
    profile=json.load(f)


games=pd.DataFrame(profile["games"])


print("游戏数量:",len(games))



print("加载生命力指数...")


with open(vitality_file,encoding="utf-8") as f:
    vitality=json.load(f)


vitality_df=pd.DataFrame(vitality["games"])



# 合并

games=games.merge(
    vitality_df[["appid","vitality"]],
    on="appid",
    how="left"
)



games["vitality"]=games["vitality"].fillna(0)



# =========================
# 3. 文本特征
# =========================


print("\n构建文本特征...")


# Genres + Tags

games["text_feature"] = (
    games["genres"].fillna("")
    +" "
    +games["tags"].fillna("")
)



tfidf=TfidfVectorizer(
    max_features=1000,
    stop_words=None
)


text_matrix=tfidf.fit_transform(
    games["text_feature"]
)



print(
    "文本维度:",
    text_matrix.shape
)




# =========================
# 4. 数值画像特征
# =========================


print("\n构建游戏画像特征...")


feature_cols=[

    "exploration",
    "challenge",
    "social",
    "story",
    "action",
    "depth",
    "score",
    "vitality"

]


numeric_matrix=games[feature_cols].fillna(0)



scaler=StandardScaler()


numeric_matrix=scaler.fit_transform(
    numeric_matrix
)



# =========================
# 5. 合并特征
# =========================


print("\n融合游戏特征...")


from scipy.sparse import hstack


# 权重设计

# 标签 60%
# 游戏画像 40%


final_matrix=hstack(
    [

        text_matrix*0.6,

        numeric_matrix*0.4

    ]
)



print(
    "最终特征:",
    final_matrix.shape
)



# =========================
# 6. 相似度计算
# =========================


print("\n计算游戏相似度...")


similarity=cosine_similarity(
    final_matrix
)



# =========================
# 7. 构建推荐结果
# =========================


recommendations={}



for i,row in games.iterrows():

    name=row["name"]


    scores=similarity[i]


    # 排除自己

    index=np.argsort(
        scores
    )[::-1]


    rec=[]


    for j in index:

        if j==i:
            continue


        rec.append({

            "name":
            games.iloc[j]["name"],


            "appid":
            int(games.iloc[j]["appid"]),


            "similarity":
            round(
                float(scores[j]),
                3
            )

        })


        if len(rec)>=5:
            break



    recommendations[name]=rec




# =========================
# 8. 保存
# =========================


with open(
    output_file,
    "w",
    encoding="utf-8"
) as f:


    json.dump(

        {

        "description":
        "Steam Game Intelligent Recommendation System",


        "method":
        "TFIDF + Game Profile + GVI similarity",


        "total_games":
        len(games),


        "recommendations":
        recommendations

        },


        f,

        ensure_ascii=False,

        indent=2

    )



print("\n====================")
print("✓ 游戏推荐系统生成完成")
print("====================")


print(
    "游戏数量:",
    len(games)
)


print(
    "保存位置:",
    output_file
)



# =========================
# 9. 测试
# =========================


print("\n=== 推荐测试 ===")


test_games=[

"Dota 2",

"Counter-Strike 2",

"Stardew Valley"

]



for g in test_games:


    if g in recommendations:

        print("\n",g)


        for r in recommendations[g]:

            print(
                " ->",
                r["name"],
                "相似度:",
                r["similarity"]
            )