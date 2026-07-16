import os
import json


BASE = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)


DATA = os.path.join(BASE,"data")

OUT = os.path.join(
    BASE,
    "data_publish"
)


os.makedirs(
    OUT,
    exist_ok=True
)


def load(name):

    path=os.path.join(
        DATA,
        name
    )

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as f:

        return json.load(f)



def save(name,data):

    path=os.path.join(
        OUT,
        name
    )

    with open(
        path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2
        )



# =========================
# galaxy
# =========================

try:

    galaxy=load(
        "galaxy_coords.json"
    )


    if isinstance(galaxy,list):

        galaxy=galaxy[:5000]


    save(
        "galaxy_coords.json",
        galaxy
    )


    print(
        "galaxy done",
        len(galaxy)
    )

except Exception as e:

    print(
        "galaxy skip",
        e
    )




# =========================
# profile
# =========================

try:

    profiles=load(
        "game_profiles.json"
    )


    new_profiles=[]


    games=profiles["games"]


    for g in games[:5000]:


        new_profiles.append({

            "appid":
            g.get("appid"),

            "name":
            g.get("name"),

            "genres":
            g.get("genres"),

            "developer":
            g.get("developer"),

            "release_year":
            g.get("release_year"),

            "score":
            g.get("score"),

            "owners":
            g.get("owners"),

            "exploration":
            g.get("exploration"),

            "challenge":
            g.get("challenge"),

            "social":
            g.get("social"),

            "story":
            g.get("story"),

            "action":
            g.get("action"),

            "depth":
            g.get("depth"),

            "tags":
            ",".join(
                str(
                    g.get("tags","")
                ).split(",")[:10]
            )

        })


    profiles["games"]=new_profiles


    save(
        "game_profiles.json",
        profiles
    )


    print(
        "profiles done",
        len(new_profiles)
    )


except Exception as e:

    print(
        "profile skip",
        e
    )





# =========================
# vitality
# =========================

try:

    vitality=load(
        "game_vitality.json"
    )


    vitality["games"]= [

        {

        "appid":g.get("appid"),

        "name":g.get("name"),

        "vitality":g.get("vitality"),

        "player":g.get("player"),

        "community":g.get("community"),

        "positive_rate":
        g.get("positive_rate")

        }

        for g in vitality["games"][:5000]

    ]


    save(
        "game_vitality.json",
        vitality
    )


    print(
        "vitality done"
    )


except Exception as e:

    print(
        "vitality skip",
        e
    )





# =========================
# recommendations
# =========================

try:

    rec=load(
        "recommendations.json"
    )


    new={}


    count=0


    for k,v in rec["recommendations"].items():


        if count>=2000:

            break


        new[k]=v[:5]

        count+=1



    rec["recommendations"]=new


    save(
        "recommendations.json",
        rec
    )


    print(
        "recommend done",
        count
    )


except Exception as e:

    print(
        "recommend skip",
        e
    )





# =========================
# small json copy
# =========================


for file in [

    "knowledge_graph.json",

    "evolution.json",

    "dashboard.json"

]:

    try:

        data=load(file)

        save(
            file,
            data
        )

        print(
            file,
            "done"
        )

    except Exception as e:

        print(
            file,
            "skip"
        )



print(
    "ALL FINISHED"
)