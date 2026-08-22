<a href="https://www.vubdivingcenter.be" target="_blank" style="margin-left: auto; margin-right: auto;">
    <img src="images/logo.svg" alt="vdc logo" style="width: 300px;">
</a>
<h1>VUB Diving Center Website</h1>

## Installatie
1. Installeer NodeJS 22 of hoger
2. Installeer yarn via `npm install -g yarn`
3. `yarn install` om alle dependencies te installeren
4. `npm run build` om de website te bouwen
5. Voeg een `.env` file toe aan de root van de server met de calendar en photos_album variabelen

## Environment variables
```text
PHOTOS_ALBUM=https://photos.google.com/...
CALENDAR=https://calendar.google.com/calendar/ical/...
```

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

### Social Media
Het toevoegen van de "excerpt" metadata laat toe om een beschrijving toe te voegen die zichtbaar is bij het delen van de link op social media. De "image" optie laat toe om een social image toe te voegen. Een template kan gevonden worden in /images/social/summary-large.png, dit is alsook de default social image.

```md
---
layout: post
title: Kerstballentraining op 20 december
tags: [activiteit]
date: 2024-11-09
image: /posts/2024/social_kerstballentraining2024.png
excerpt: 'Op 20 december organiseren een speciale kerstballentraining in het VUB zwembad voor leden'
---

Ho ho ho beste plonzertjes,
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

## Redactiesysteem (Decap CMS)
Niet-technische redacteurs kunnen de website bewerken via [Decap CMS](https://decapcms.org), bereikbaar op
[https://www.vubdivingcenter.be/admin/](https://www.vubdivingcenter.be/admin/). Deze pagina is bewust niet gelinkt
op de website en blijft verborgen. Redacteurs hebben een GitHub-account met *write*-toegang tot dit repository nodig.
Een handleiding voor redacteurs staat op [https://www.vubdivingcenter.be/docs/cms-handboek/](https://www.vubdivingcenter.be/docs/cms-handboek/) (eveneens niet gelinkt).

### Hoe de login werkt
Decap CMS kan de GitHub-OAuth token-uitwisseling niet zelf in de browser doen (CORS). Daarom
dient een kleine **Google Apps Script**-webapp als tussenpersoon (zie
[decap-cms-google-apps-script](https://github.com/nuzulul/decap-cms-google-apps-script)).
De *client secret* wordt uitsluitend in die Apps Script opgeslagen, nooit in dit repository of in de browser.

De login-volgordening:
1. De redacteur klikt op *Log in with GitHub* op `/admin/`.
2. De popup laadt `https://www.vubdivingcenter.be/admin/client.html` (PKCE-middleware, deel van deze site).
3. Die page doorverwijst via de Apps Script naar GitHub; na inloggen bevestigt de redacteur met
   twee klikken (*Continue with Github*, *Confirm Github Authorization*).
4. De Apps Script ruilt de code in tegen een token en stuurt het terug naar de CMS.

### Eénmalige setup

#### 0. Het `/a/~`-web app-URL
Google herschrijft gewone web app-URLs (`script.google.com/macros/s/...`) naar `script.google.com/macros/u/N/s/...`
als de browser met meerdere Google-accounts is ingelogd; die URL geeft een 404
("Kan het bestand momenteel niet openen"). Daarom wordt overal de `/a/~`-variant gebruikt, die die herschrijving
omzeilt. Van het web app-URL dat Google toont
(`https://script.google.com/macros/s/.../exec`) maak je:

```
https://script.google.com/a/~/macros/s/.../exec
```

(dus `/a/~` invoegen na `script.google.com`). Dit is het URL dat hieronder overal bedoeld wordt.

#### 1. GitHub OAuth App
Settings → Developer settings → OAuth Apps → New OAuth App:
- *Application name*: bv. `VDC CMS`
- *Authorization callback URL*: het `/a/~`-web app-URL uit stap 2 hieronder — exact kopiëren.

#### 2. Google Apps Script webapp
1. Ga naar <https://script.google.com> → *Nieuw project*.
2. Vervang de inhoud van `Code.gs` met de inhoud van [`_docs/gas-oauth/Code.gs`](_docs/gas-oauth/Code.gs) uit dit repository.
   (Die code gebruikt zelf al het `/a/~`-URL voor de `redirect_uri` naar GitHub.)
3. Voeg een HTML-bestand toe genaamd `config.html` (Insert → HTML file) met de inhoud van
   [`_docs/gas-oauth/config.html`](_docs/gas-oauth/config.html), waar je de placeholders vervangt door de
   echte *Client ID* en *Client Secret* van de GitHub OAuth App.
4. *Deploy* → *New deployment* → type *Web app*:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Kopieer het *web app URL* en zet het om naar de `/a/~`-variant (stap 0).

> **Belangrijk:** vul dit bestand met het echte secret uitsluitend in het Apps Script-project.
> Commit een `config.html` met het echte secret nooit naar dit repository.

#### 3. Koppelen
1. Zet in de GitHub OAuth App de *Authorization callback URL* op het `/a/~`-web app-URL uit stap 2.5.
2. Zet in [`admin/client.html`](admin/client.html) de variabele `apps_script_url` op hetzelfde `/a/~`-web app-URL en commit.
   De CI deployt de website automatisch.

> Worden `Code.gs` of `config.html` later aangepast in het Apps Script-project, dan moet je bij
> *Deploy → Manage deployments → Edit* de versie op *New version* zetten en herdeployen.

### Configuratie
- `admin.html` (permalink `/admin/`) en `admin/config.yml` bevatten de CMS-configuratie
  (`base_url` + `auth_endpoint` wijzen naar `admin/client.html`).
- `admin/client.html` is de PKCE-middleware; hij bevat alleen de (publieke) *Client ID*.
- In `admin/config.yml` kan je bepalen welke bestanden redacteurs mogen bewerken (collecties: pagina's, ledeninfo-pagina's, nieuwsberichten, downloads).
- Wijzigingen worden rechtstreeks naar `master` gecommit; de bestaande CI bouwt en deployt de website automatisch.

## Gesubsidiëerd door:
<a href="https://www.sportinbrussel.be/" target="_blank">
    <img src="images/misc/logo_sportinbrussel.svg" alt="vgc logo" style="width: 400px">
</a>