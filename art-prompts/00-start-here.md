# Marrow Rite: art prompts, start here

One file per fighter, each self-contained. Every prompt is generated from the game's current card data (94 cards) and matches your concept portraits.

## What changed in this update
- **26 new cards:** 3 per character (including Vorhul) and 5 neutral cards. Each is marked "(new)": Incense Burner, Flare-Up, Pyre Oath, Stitch Up, Leech Jar, Amputation, Tomb Slam, Gatekeeper's Oath, Sealed Door, Bitten Veil, Porcelain Crack, Endless Banquet, Bog Eel, Wait in the Reeds, Hag's Bargain, Hangman's Knot, Trapdoor, Death Warrant, Throne of Bones, Kneel, The Hundredth Rite, Elbow, Headbutt, Grapple, Smelling Salts, Blood Price.
- **Finished art:** Gatebreaker and Wind the Linen now use your illustrations in the game. Their prompts are marked "(art done)".
- **Echo cards:** each fighter's file ends with its Echo prompt (E1-E7). They're also in the in-game Art Prompts screen.
- **Balance changes:** Pyre Kick 5 + Heat (EX 9), Vivisection 4 piercing with Bleed 2 (EX 8), Amputation 4 (EX 6), Brannoch 31 HP. The Gate Holds starter now runs Grapple instead of Haymaker.
- **Matchup rules (latest):** tagging out now halves Burn, Bleed, Venom and Noose (rounded up) instead of clearing them. Brannoch's Grave Linen now gives 3 Guard a turn and his Guard soaks effect damage. Retaliate triggers once per card instead of once per hit. Thousand Cuts runs 2 Trapdoor instead of 2 Cross. No card names or art changed.
- **Removed:** nothing. Collector numbers of existing cards are unchanged; new cards are 069-094.

## Files
- 01-ashkar.md: Ashkar, The Ember Monk (Self-burn aggro), 10 cards + 1 Echo, portrait ashkar.png
- 02-sable-moru.md: Sable Moru, The Stitched Surgeon (Bleed attrition), 10 cards + 1 Echo, portrait sable-moru.png
- 03-brannoch.md: Brannoch, The Wrapped (Retaliation tank), 10 cards + 1 Echo, portrait brannoch.png
- 04-lady-wen.md: Lady Wen, Of the Hollow (Discard engine), 10 cards + 1 Echo, portrait lady-wen.png
- 05-old-teeth.md: Old Teeth, The Bog Mother (Traps & venom control), 10 cards + 1 Echo, portrait old-teeth.png
- 06-bram-coil.md: Bram Coil, The Hook (Tag control & executions), 10 cards + 1 Echo, portrait bram-coil.png
- 07-vorhul.md: Vorhul, The Unburied (Boss: tithe & drain), 7 cards + 1 Echo, no portrait yet
- 08-neutral-cards-frames-arenas.md: the 27 neutral cards, card back, rarity frames, foil, Meter gem, arenas and logo

## Starter decks
- **Plague Pyre** (Sable Moru, Ashkar, Old Teeth): Stack Burn, Bleed and Venom, then cash them in. Every effect ticks through Guard, and Open Wounds hits harder for each one on the target.
- **The Gate Holds** (Brannoch, Old Teeth, Bram Coil): Build a wall of Guard, make attackers pay for hitting it, then turn the wall into damage and drag the weak to the gallows.
- **Thousand Cuts** (Bram Coil, Lady Wen, Ashkar): Multi-hit attacks with per-hit bonuses. Every hit adds chain, Noose, Bloodlust and Empower damage, so three small hits beat one big one.

## Workflow
1. Paste the **Style bible** below into a new ChatGPT chat with 2 or 3 style references attached.
2. For each fighter, attach your concept portrait and paste their reference-sheet prompt. Save the sheet.
3. For each card, attach the portrait and the sheet, then paste the card prompt.

## Style references (use for every fighter)
- [The Calling of Saint Matthew](https://en.wikipedia.org/wiki/The_Calling_of_Saint_Matthew) (Caravaggio): The lighting model: one hard warm source, deep black shadow
- [Black Paintings](https://en.wikipedia.org/wiki/Black_Paintings) (Francisco Goya): Overall mood and muddy, desaturated palette
- [Saturn Devouring His Son](https://en.wikipedia.org/wiki/Saturn_Devouring_His_Son) (Francisco Goya): How far the horror goes: dread over gore
- [The Triumph of Death](https://en.wikipedia.org/wiki/The_Triumph_of_Death) (Pieter Bruegel the Elder): Crowds, arenas, the tournament as spectacle
- [Gustave Doré (Divine Comedy engravings)](https://en.wikipedia.org/wiki/Gustave_Dor%C3%A9) (Gustave Doré): Scale and depth for arenas and backgrounds
- [Judith Beheading Holofernes](https://en.wikipedia.org/wiki/Judith_Beheading_Holofernes_(Caravaggio)) (Caravaggio): Violence at the moment of action, framed tight

## Style bible (paste first in every chat)

```
You are illustrating "Marrow Rite", an original dark-fantasy collectible card game about a brutal underground fighting tournament held every hundred years in a citadel of bone by Vorhul, a king who refused to die.

Style for every image in this chat:
- Painterly oil-on-canvas finish, visible brush texture, grounded realistic anatomy.
- Heavy chiaroscuro: one hard, warm key light; deep near-black shadows.
- Desaturated earth palette (bone, ash, rust, leather, wet stone) with one saturated accent colour per image, taken from the fighter's palette.
- Mood: dread and violence that is implied, not shown. Wounds are suggested with shadow and dark stains; no exposed organs, no close-up gore.
- All characters are original. No likeness of any existing game, film, comic or real person.
- Never include text, letters, numbers, logos, borders, card frames or watermarks.
I have attached style references (Caravaggio, Goya, Bruegel). Match their lighting and mood, not their subjects. Reply "ready" and wait for my prompts.
```

The gore is written as implied (shadow, stains, aftermath) so the prompts pass image-model content filters.
