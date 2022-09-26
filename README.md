# VUB Diving Center Website

## Installatie
`npm install`

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
Het VUB Diving Center heeft een gedeeld album waar fotos op kunnen worden toegevoegd. Elke week zal de website
de nieuwe foto's downloaden en weergeven op de website.