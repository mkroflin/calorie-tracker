# Upute za Hosting i Automatizaciju Izvještaja o Prehrani

Ovaj repozitorij/skripta omogućuje automatsko generiranje vizualnog HTML izvještaja iz Google tablice za praćenje kalorija.

---

## 1. GitHub Pages (Preporučena opcija — Besplatno)

### Korak A: Kreiranje repozitorija
1. Kreiraj novi repozitorij na GitHubu (npr. `calorie-tracker-report`).
2. U repozitorij dodaj:
   - `generate_report.py`
   - `index.html` (generirana datoteka, preimenovani `calorie_report.html`)
   - `.github/workflows/update_report.yml`

### Korak B: Postavljanje GitHub Actions za automatsko osvježavanje
Kreiraj datoteku `.github/workflows/update_report.yml`:

```yaml
name: Ažuriraj Izvještaj o Kalorijama

on:
  schedule:
    # Pokreće se svaku večer u 23:00 UTC
    - cron: '0 23 * * *'
  workflow_dispatch: # Omogućuje ručno pokretanje na gumb

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Preuzmi kod
        uses: actions/checkout@v4

      - name: Postavi Python
        uses: setup-python@v5
        with:
          python-version: '3.11'

      - name: Generiraj izvještaj
        run: |
          python generate_report.py index.html

      - name: Deploy na GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          publish_branch: gh-pages
```

### Korak C: Uključi Pages
1. Idi na **Settings** -> **Pages** u GitHub repozitoriju.
2. Pod **Source** odaberi granu `gh-pages` (ili `main` ako držiš `index.html` u korijenu).
3. Tvoj izvještaj je javan na: `https://<tvoj-username>.github.io/<repo-name>/`.

---

## 2. Cloudflare Pages / Vercel / Netlify

1. Poveži svoj GitHub repozitorij na **Cloudflare Pages** (ili Vercel/Netlify).
2. Kao **Build command** stavi: `python generate_report.py index.html`
3. Kao **Build output directory** stavi: `./`
4. Svaki put kad GitHub Action ažurira podatke, Cloudflare automatski objavljuje novi dashboard.

---

## 3. Google Apps Script Web App (Unutar same tablice)

Ako ne želiš koristiti GitHub niti imati javno dostupne podatke:
1. U Google Sheets otvori: **Extensions (Proširenja)** -> **Apps Script**.
2. Zalijepi HTML kôd izravno u Apps Script (`HtmlService.createHtmlOutput(...)`).
3. Klikni **Deploy** -> **New Deployment** -> **Web App**.
4. Dobiješ Google URL koji uvijek prikazuje najnovije podatke izravno iz tablice.

---

## 4. Lokalno pokretanje (Offline)

Kad god želiš lokalno osvježiti:
```bash
python generate_report.py report.html
```
I samo dvoklikom otvori `report.html` u svom web pregledniku!
