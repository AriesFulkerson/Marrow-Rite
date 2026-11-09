# Publishing this to GitHub (personal account, no organization)

This repo goes under your own GitHub account. The site will be at
`https://<your-username>.github.io/marrow-rite/`.

## 1. Create the empty repo

1. Go to https://github.com/new while signed in to your personal account.
2. **Owner:** your username (not Tenvia-App).
3. **Repository name:** `marrow-rite`
4. Choose **Public**. GitHub Pages is free only for public repos on a free account.
5. Leave **Add a README**, **.gitignore** and **license** unchecked. This folder already has them.
6. Press **Create repository**.

## 2. Push this folder

Open a terminal in this folder and run (replace `<your-username>`):

```
git remote add origin https://github.com/<your-username>/marrow-rite.git
git push -u origin main
```

Git opens a browser window to sign in the first time.

## 3. Turn on GitHub Pages

1. In the repo, open **Settings > Pages**.
2. **Source:** Deploy from a branch.
3. **Branch:** `main`, folder `/ (root)`. Press **Save**.
4. Wait a minute or two, then refresh. The page shows the live address.

## 4. Finish the repo page

On the repo's main page, click the gear next to **About**:
- **Website:** tick "Use your GitHub Pages website".
- **Description:** "A dark-fantasy tag-team fighting card game. Playable concept build."
- **Topics:** `card-game`, `browser-game`, `dark-fantasy`, `fighting-game`.

Optional: **Settings > General > Social preview** and upload `assets/cards/gatebreaker.jpg` so links show the card art.
