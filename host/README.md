# Marrow Rite 1v1, hosted on your PC

Run the game on your own computer and play 1v1 with friends in their browsers. Nothing to install: the server uses Windows PowerShell, which every Windows PC already has. Your friends only need a web browser and the address you give them.

## Start it

1. Double-click **Start Marrow Rite server.bat**.
2. A window opens and prints the addresses to use, for example:
   - On this PC: `http://localhost:8787`
   - Friends on your Wi-Fi: `http://192.168.1.23:8787`
3. The first time, Windows may ask whether to let PowerShell accept network connections. Choose **Private networks** and **Allow**.
4. Keep the window open while you play. Close it, or press **Ctrl+C** in it, to stop the server.

## Play

1. Open the address in your browser and enter a display name.
2. Press **1v1** in the top bar, pick a deck, and press **Create match**. You get a four-letter code.
3. Your friend opens the address on their device, enters their name, presses **1v1**, types the code and presses **Join**.
4. The match starts for both of you. Each player only sees their own hand and traps.

Everyone starts with every card unlocked (this is a test build), so you can build any deck on the Deck screen and pick "Your deck" in the 1v1 lobby. Vs AI, Packs, Collection and Art Prompts work too.

## Friends who aren't on your Wi-Fi

The Wi-Fi address only works inside your home network. For friends elsewhere, pick one of these:

- **Tailscale (easiest and safest).** You and each friend install Tailscale (free for personal use) and join the same tailnet. They then open `http://<your Tailscale IP>:8787`. Nothing on your router changes.
- **A tunnel such as Cloudflare Tunnel or ngrok.** Point the tunnel at `http://localhost:8787` and share the public address it gives you. Anyone with that address can open the game while the tunnel runs, so only share it with friends and stop the tunnel afterward.
- **Router port forwarding.** Forward TCP port 8787 to your PC. This exposes the server to the whole internet while it runs, so it's the least safe option.

## If friends can't connect

- Check that the server window is still open and shows no red errors.
- Make sure your PC's network is set to **Private**, not Public (Windows Settings > Network & internet > your connection > Network profile type).
- If Windows never asked to allow access, or you clicked Cancel, open PowerShell **as administrator** once and run:

  ```
  netsh advfirewall firewall add rule name="Marrow Rite 1v1" dir=in action=allow protocol=TCP localport=8787 profile=private
  ```

  To remove the rule later: `netsh advfirewall firewall delete rule name="Marrow Rite 1v1"`
- If port 8787 is already in use, start the server on another port from a PowerShell window in this folder: `.\server.ps1 -Port 8788`, and use that port in the addresses.

## Good to know

- Matches and player saves are stored in `data\store.json` in this folder, so a match survives a server restart. Delete that file to wipe everything.
- This is a friendly-game server, not a secure one. Anyone who can reach the address can play, and a determined player could read hidden information (like the other hand) from the browser's developer tools. Only run it while you're playing, with people you trust.
- The game fonts load from Google Fonts. Without internet access, the game falls back to standard fonts and still plays normally.

## Files

| File | What it is |
|---|---|
| `Start Marrow Rite server.bat` | Double-click to start |
| `server.ps1` | The server (serves the game, stores matches) |
| `host-shim.js` | Connects the game page to this server (already built into `public\index.html`) |
| `public\` | The game itself, plus fighter portraits and card art |
| `data\store.json` | Created on first use: matches, saves and player names |
