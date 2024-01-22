<a href="https://www.vubdivingcenter.be" target="_blank" style="margin-left: auto; margin-right: auto;">
    <img src="images/logo.svg" alt="vdc logo" style="width: 300px;">
</a>
<h1>VUB Diving Center Website</h1>

## Installatie
1. Installeer NodeJS 14 of hoger
2. `npm install` om alle dependencies te installeren
3. `npm run build` om de website te bouwen

## Nieuws
Nieuws post kunnen aangemaakt worden in de directory `_posts`. 
Een nieuws post is een markdown file (*.md)
```md
---
layout: post
title: De titel van de post hier
tags: [activiteit]
date: 2022-09-25
---
Hier schrijf je de post neer.
```

### Foto's in nieuws posts
Foto's toevoegen aan een post kan door de URL van de image (liefst google photos)
onder 'images' te plaatsen

```md
---
layout: post
title: Septemberweekend 2022
tags: [activiteit]
date: 2022-09-25
images:
    - https://lh3.googleusercontent.com/uWjjMepm2HhzA9tydRu08Wu_C3Ou0hM7Wfx8BPDDMDLN1IR-3kXLuU_72nF-70gPjaQwhf9WfR7HoSVQqW16-LxGps7zoOFmFhcaWVyKbjAS52gNjkuQF64w-qQFwhyQh_exQB3QNg8
    - https://lh3.googleusercontent.com/VxebrHGtOVJwYenWKum7om0HlsYhWvWVQb4vNcf1XKL74W6YCs5Ddcfz6E5KQCqPb53jKyPA9G944n6LhS5aWinrcc7Q0LmK0qtxi5W5yrzGMUHOsK0d99xsNx7NG2sNrOoAXE5G7-I
    - https://lh3.googleusercontent.com/dtFI9cwCqmS2J5TEyaagKffFU8sxoofTDuYAUv-ccaM0V-QsRklbvfOLE0PpRePOiijFGQ8rdyvZzv7evL8j0Awqc0lkXKmj0fdTiNJSshxN9FvUCM4vdoU3indRdeRy7qhQrRzaDn0
---
Test
```

## Foto's
Het VUB Diving Center heeft een gedeeld *Google Photos* album waar fotos op kunnen worden toegevoegd. Elke dag zal de website
de nieuwe foto's weergeven op de website. Foto's worden nooit gedownload van Google Photos.

## Pagina's
Een pagina is een markdown file met bovenaan metadata.
```md 
---
layout: main
title: Duikopleiding
subtitle: Leren duiken? Dat kan!
background: https://lh3.googleusercontent.com/vhJaAyeWCqiTWYAKEnoBBMCCnDQNNXQq_JKeR6dvAH6K4DpNd2uFkWGXPdbSTfnYOohQjD2swoqN7RhuAMe6b-mlwUhh22DBEpPB7kwHuqih2yMoEf9ptvqYGn5tjXI7CqESbsiKkyQ
eleventyNavigation:
    key: Duikopleiding
    order: 1
---
Dit is een pagina
```

Standaard gebruikt een pagina de layout `main` en heeft het een titel en subtitle. De subtitle is niet noodzakelijk.
De achtergrond is ofwel een relatieve URL naar een image in de repository of een foto van Google Photos.

## Documenten
Documenten kan men toevoegen of aanpassen in het bestand "/documents/documents.json".

```json
[
    {
        "name": "Huishoudelijk reglement",
        "description": "Het huishoudelijk reglement van de vereniging.",
        "files": [
            {
                "date": "2020-03-12",
                "version": 2,
                "url": "/downloads/huishoudelijk_reglement_12032020_v2.pdf"
            },
            {
                "date": "2020-03-12",
                "version": 1,
                "url": "/downloads/huishoudelijk_reglement_12032020.pdf"
            }
        ]
    },
    {
        "name": "Statuten",
        "description": "De statuten van de vereniging.",
        "files": [
            {
                "date": "2021-10-03",
                "version": 1,
                "url": "/downloads/statuten_03102011.pdf"
            }
        ]
    }
]
```

## Gesubsidiëerd door:
<a href="https://www.sportinbrussel.be/" target="_blank">
    <img src="images/misc/logo_sportinbrussel.svg" alt="vgc logo" style="width: 400px">
</a>