# Marrow Rite

A brutal dark-fantasy tag-team fighting card game (TCG). Every hundred years Vorhul, the Unburied, holds a tournament to choose who sits beside his throne. The losers become the throne.

Build a team of three fighters, tag between them, and play your cards like combos.

**Play it:** open the project's GitHub Pages site and press **Play now**. The site's address is shown in the repo's About box.

![Gatebreaker card art](assets/cards/gatebreaker.jpg)

## The fighters

| Fighter | Title | Style | HP | Passive |
|---|---|---|---|---|
| Ashkar | The Ember Monk | Self-burn aggro | 29 | **Pyre:** first hit each turn applies Burn 2; builds Heat (max 5) |
| Sable Moru | The Stitched Surgeon | Bleed attrition | 27 | **Sutures:** heals 2 whenever an enemy takes Bleed damage |
| Brannoch | The Wrapped | Retaliation tank | 31 | **Grave Linen:** 3 Guard each turn; Burn, Bleed and Venom hit his Guard first; each card that lands on his Guard takes 1 back |
| Lady Wen | Of the Hollow | Discard engine | 24 | **Hunger:** discards build Hunger; Specials +1 per 2 Hunger |
| Old Teeth | The Bog Mother | Traps & venom control | 28 | **Patience:** unspent Energy becomes Guard; sets hidden Traps |
| Bram Coil | The Hook | Tag control & executions | 28 | **Reel:** 3 damage on tag-in; Noose amplifies every hit |
| Vorhul | The Unburied (boss) | Tithe & drain | 40 | **Tithe:** heals 6 whenever an enemy fighter is knocked out |

94 cards in total: 10 per fighter, 7 for Vorhul, 27 neutral, plus one Echo card per fighter.

### Starter decks

- **Plague Pyre** (Sable Moru, Ashkar, Old Teeth): stack Burn, Bleed and Venom, then cash them in.
- **The Gate Holds** (Brannoch, Old Teeth, Bram Coil): a wall of Guard that punishes attackers.
- **Thousand Cuts** (Bram Coil, Lady Wen, Ashkar): multi-hit attacks with per-hit bonuses.

Tagging out halves Burn, Bleed, Venom and Noose (rounded up) instead of clearing them, and Retaliate triggers once per card rather than once per hit.

Balance was checked with over 20,000 simulated games. Every card wins 47–56% of the games it appears in. Overall the starters win about 51% (Plague Pyre), 48% (The Gate Holds) and 51% (Thousand Cuts), and no head-to-head matchup is worse than 56/44.

## What's in this repo

| Path | What it is |
|---|---|
| `index.html` | The project landing page (served by GitHub Pages) |
| `play/` | The playable browser build: vs AI, packs, collection, deck builder. Progress saves in the browser. |
| `host/` | The Windows host app for 1v1 against friends (see `host/README.md`) |
| `marrow-rite-host.zip` | The same host app, zipped for download from the site |
| `android/` | The Android app project: the same game plus a built-in 1v1 server (see `android/README.md`) |
| `MarrowRite.apk` | The Android app, ready to install (Android 8.0+) |
| `art-prompts/` | Art bible and per-card image prompts, one file per fighter |
| `assets/` | Fighter portraits and finished card art used by the landing page |

## 1v1 multiplayer

GitHub Pages only serves static files, so online 1v1 isn't on the site itself. Two ways to play a friend:

- **Android:** install `MarrowRite.apk` on each phone. One phone hosts (its start screen shows its Wi-Fi address) and the others join with that address. `android/README.md` has the steps.
- **Windows PC:** download `marrow-rite-host.zip`, unzip it and double-click **Start Marrow Rite server.bat**. Friends join from a browser or the Android app. `host/README.md` has the full instructions, including how to let friends outside your Wi-Fi connect.

Both downloads are also on the repo's **Releases** page.

## Status

Concept build. The art is in progress: six fighter portraits and two card illustrations are finished, and the rest of the cards use placeholder frames.

All characters, story and art are original to this project.
