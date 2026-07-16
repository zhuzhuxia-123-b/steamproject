"""
Steam Game Galaxy
Evolution Data Builder

生成:
data/evolution.json

用途:
Evolution Timeline 页面

数据来源:
steam_clean.json
game_profiles.json
game_vitality.json

"""

import json
import os
from collections import Counter, defaultdict


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)


DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)



PROFILE_FILE = os.path.join(
    DATA_DIR,
    "game_profiles.json"
)


VITALITY_FILE = os.path.join(
    DATA_DIR,
    "game_vitality.json"
)



OUTPUT_FILE = os.path.join(
    DATA_DIR,
    "evolution.json"
)





def load_json(path):

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as f:

        return json.load(f)







def parse_list(value):

    if not value:

        return []

    if isinstance(value,list):

        return value


    return [

        x.strip()

        for x in str(value).split(",")

        if x.strip()

    ]








def build():


    print("Loading data...")



    profiles = load_json(
        PROFILE_FILE
    )


    vitality = load_json(
        VITALITY_FILE
    )



    games = profiles["games"]


    vitality_map = {

        g["name"]:g

        for g in vitality["games"]

    }




    print(
        "Games:",
        len(games)
    )




    timeline = defaultdict(
        list
    )



    for game in games:


        year = game.get(
            "release_year"
        )


        if not year:

            continue



        timeline[year].append(
            game
        )







    result_years=[]




    for year in sorted(
        timeline.keys()
    ):



        items = timeline[year]



        genre_counter = Counter()

        tag_counter = Counter()

        developer_counter = Counter()



        score_values=[]

        vitality_values=[]



        top_games=[]




        for game in items:



            for genre in parse_list(
                game.get("genres")
            ):

                genre_counter[
                    genre
                ] +=1





            for tag in parse_list(
                game.get("tags")
            )[:30]:

                tag_counter[
                    tag
                ] +=1





            developer = game.get(
                "developer"
            )


            if developer:

                developer_counter[
                    developer
                ] +=1




            score_values.append(

                float(
                    game.get(
                        "score",
                        0
                    )
                    or 0
                )

            )



            name = game.get(
                "name"
            )


            if name in vitality_map:


                vitality_values.append(

                    float(

                    vitality_map[name]
                    .get(
                        "vitality",
                        0
                    )

                    or 0

                    )

                )




        top_games = sorted(

            items,

            key=lambda x:

            float(
                x.get(
                    "score",
                    0
                )
                or 0
            ),

            reverse=True

        )[:5]





        result_years.append({

            "year":year,


            "game_count":
            len(items),



            "avg_score":
            round(

                sum(score_values)
                /
                len(score_values)

                if score_values

                else 0,

                3

            ),



            "avg_vitality":

            round(

                sum(vitality_values)

                /
                len(vitality_values)

                if vitality_values

                else 0,

                2

            ),



            "genres":[

                {
                    "name":k,
                    "value":v
                }

                for k,v

                in genre_counter
                .most_common(10)

            ],




            "tags":[

                k

                for k,v

                in tag_counter
                .most_common(15)

            ],




            "developers":[

                {
                    "name":k,
                    "value":v
                }

                for k,v

                in developer_counter
                .most_common(10)

            ],




            "top_games":[

                {

                "name":
                g.get("name"),


                "score":
                g.get("score"),


                "genres":
                g.get("genres")

                }

                for g in top_games

            ]



        })





    output={


        "description":

        "Steam Game Evolution Timeline",



        "total_years":

        len(result_years),



        "years":

        result_years



    }





    with open(

        OUTPUT_FILE,

        "w",

        encoding="utf-8"

    ) as f:


        json.dump(

            output,

            f,

            ensure_ascii=False,

            indent=2

        )



    print(
        "Saved:",
        OUTPUT_FILE
    )






if __name__=="__main__":

    build()