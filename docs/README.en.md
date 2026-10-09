<p align="center"><img src="../public/assets/ember-logo.svg" alt="EMBER" width="260"></p>
<h1 align="center">🔥 EMBER · 余烬</h1>
<p align="center"><strong>Pixel fighting × DeWeb × X Layer</strong><br>Challenge a friend. See the circuits behind your AI opponent.</p>
<p align="center"><a href="https://2-2-300.deweb.tapeoutexplorer.com/">🎮 Play on DeWeb</a> · <a href="https://tapeoutexplorer.com/games/ember/">Hosted fallback</a> · <a href="../README.md">中文</a> · <a href="https://x.com/benson_doge">Creator X</a> · <a href="https://tapeoutexplorer.com/">TapeOutScan</a></p>

![Live circuit challenge with the AI signal panel](images/circuit-battle-current.jpg)

**EMBER has launched in the X Layer DeWeb container `2.2.300.tape`.** Choose Jin, the flame fighter, or Shuang, the moonblade swordswoman. Progress through twelve circuit challenges, practise hit-confirmed combos, or fight friends in real-time PvP. Free play needs no wallet; optional escrow rooms support OKB and BEM on X Layer.

This repository is the public project description, demo and source-code entry for the **TapeOut Genesis Transistor Hackathon** submission. Reviewers can play the game, inspect its screenshots, and follow the [complete submission disclosure](HACKATHON.md). Participation does not imply official endorsement or a prize.

## Play modes

| Mode | What it offers | Wallet required? |
| --- | --- | --- |
| Circuit challenge | Twelve stages of spacing, defence and combos, with signals from the AI circuits currently executing | No |
| Combo training | Unlimited health, configurable dummy, damage and hit counts, full route and next-move coaching | No |
| Free PvP | Public room creation/joining, character selection and real-time combat | No |
| Escrow PvP | Equal OKB or BEM deposits, character selection after both payments, contract settlement | X Layer wallet |
| Mobile play | Landscape arcade controls, portrait handheld controls, home-screen installation and rotation guides | Not for free modes |

**Latest public game source: `1.3-scan.5`, synchronized on 2026-10-10.** It includes recent wallet-session recovery, mobile handoff, payment-state recovery, live selection, reward status and dialog-close improvements. Native wallet opening still depends on the device, browser and wallet version.

## Screenshots

### Twelve challenges and live combo demonstrations

![Challenge lobby and looping combo demonstration](images/campaign-lobby.jpg)

Stages 01–06 teach fundamentals; stages 07–12 increase reaction, defence, spacing and combo pressure. Progress is stored in the current browser, not automatically synchronized across devices.

<details><summary>View stages 07–12</summary>

![Advanced challenges](images/advanced-stages.jpg)

</details>

### Independent character selection

![Jin and Shuang selection](images/character-select.jpg)

Your fighter is selected on the left. Solo play lets you choose the CPU fighter; PvP shows the remote player's selection live on the right. Real-player selection starts after joining a room; escrow rooms first wait for both deposits.

### Public PvP lobby

![Entry, public rooms and combo demonstration](images/pvp-lobby.jpg)

Choose Online duel → Free or Escrow → Create room. Friends join directly from the public room list, without a room code or password. Free play never forces wallet login.

### Combo dummy training

![Full route and next-move coaching](images/combo-training.jpg)

Training checks **actual hits**, not just button presses. Change the combo, reset positions, configure guarding, and inspect damage and combo counts.

### Landscape arcade and portrait handheld

![Landscape mobile controls](images/mobile-landscape.jpg)

<p align="center"><img src="images/mobile-portrait.jpg" width="330" alt="Portrait handheld layout: battle above, stick and action buttons below"></p>

Landscape keeps the arcade layout. Portrait places the fight above the controls, with a left stick and separate action buttons on the right. Attack and Heavy have distinct hit areas; Jump and Dodge are separate. Screenshots show the current source running in isolated browser sessions and contain no real wallet information.

## Start in a minute

1. Open the [DeWeb game](https://2-2-300.deweb.tapeoutexplorer.com/) and choose Circuit challenge or Training. No wallet needed.
2. Pick Jin or Shuang and confirm. Use keyboard controls on desktop or the on-screen stick and buttons on mobile.
3. Begin with three normal attacks; follow up after each hit rather than pressing the whole route at once.
4. To fight friends, open Online duel, create a free room and have them join from the lobby.
5. For escrow play, connect an X Layer wallet and review the asset, per-player amount and wallet confirmation.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move / crouch | A, D / S | Stick left or right / pull down |
| Attack / Heavy | J / H | Attack / Heavy |
| Jump / Dodge | K / L or Shift | Jump / Dodge |
| Ranged / Minor | U / O | Corresponding skill buttons |
| Special / Super | E / I | Special / Super |
| Launcher | W + J | Stick up + Attack |
| Guard / menu | F / Esc | Pull down to crouch-guard / Menu |

**Starter:** `J → J → J`; on mobile, Attack three times.
**Launcher follow-up:** `W+J → K → J → J → H`; on mobile, Stick up + Attack → Jump → Attack → Attack → Heavy.

[Full controls and mobile installation guide →](CONTROLS.md)

## Wallet, deposits and rewards

- Use **X Layer mainnet, chain ID 196; gas is paid in OKB**. The supported BEM asset is on X Layer, not the similarly named BNB Chain token.
- Connecting and signing in is separate from paying or approving tokens. Only escrow play enters the payment flow.
- Escrow supports equal OKB or BEM deposits. BEM requests allowance when necessary, followed by payment. Every funds action still requires the player's wallet confirmation.
- Both players pay before selection; a paid player waits for the other. The funding window is 180 seconds. If both payments are not completed by the deadline, refund eligibility is checked against the contract and can then be claimed through the rewards/refund entry.
- A normal decisive match awards the pool to the winner minus a 10% platform fee. The contract has a 60-second post-match delay, and settlement plus chain verification must complete. Unclaimed rewards/refunds remain accessible in match history, with claim-all for eligible items.
- **BEM is a TapeOut ecosystem token, not a token issued by EMBER. The game supports it only as an optional deposit asset.**

[Contract addresses, source and wallet flow →](X-LAYER.md)

## Download and develop

**[Download the current DeWeb upload ZIP](../downloads/ember-deweb-1.3-scan.5.zip)** · [Manifest](../downloads/deweb-manifest-1.3-scan.5.json) · [SHA-256](../downloads/SHA256SUMS)

The upload contains 54 files, totaling **1,129,497 bytes (about 1.08 MiB)** before ZIP compression, or 90 chunks at 24,000 bytes. Content-hashed assets, compressed modules, resource reuse and a tiny entry page support cheaper incremental updates. Actual transactions and gas depend on existing container contents and chain verification. [Packaging guide](DEWEB.md)

Node.js ≥22.13.0 is required. Bundled runtime dependencies are included:

```sh
git clone https://github.com/BensonXBX/ember-tapeout.git
cd ember-tapeout
node scripts/start.mjs
```

Open `http://localhost:3276/games/ember/`. The development server binds to `0.0.0.0`. Free modes run directly; production finance configuration and keys are not included, so a fresh local instance cannot create payable mainnet rooms.

```sh
pnpm install --frozen-lockfile
pnpm test
python3 build.py
python3 build-tools/package-deweb.py
# Keep the local server running in another terminal for this free-room smoke test:
node test-launch.mjs
```

## Implementation and disclosures

- **DeWeb** stores the public frontend; the **X Layer escrow** handles deposits and settlement; an authoritative **game server** runs multiplayer and records results. Combat does not execute on-chain every frame.
- **Circuit AI** evaluates local NAND networks and displays actual signals. Sensors, timing, seeded randomness and the combat engine remain in the game layer. The original AI remains available for comparison and rollback.
- The TapeOut processor, transistor, circuit container and game escrow are different objects. Taped-out circuit #2 is not the complete game-AI netlist.
- Game and contract source are publicly available for review; publication is not a third-party security audit. Artwork and dependencies retain their own rights and licenses: [third-party notices](../THIRD_PARTY_NOTICES.md).

| Document | Contents |
| --- | --- |
| [Hackathon disclosure](HACKATHON.md) | Description, demo, processor, deployment wallet, supply cap, price and tapeout evidence |
| [Controls](CONTROLS.md) | Keyboard, touch, combos, home-screen app, music and menus |
| [X Layer](X-LAYER.md) | Network, supported assets, escrow and verification materials |
| [Architecture](ARCHITECTURE.md) | AI, combat, multiplayer and on-/off-chain boundaries |
| [Launch announcement](ANNOUNCEMENT.md) | Bilingual announcement and tournament plan |

**Continued development and tournament plan:** the creator plans to sponsor **10 BEM** for a community tournament. Dates, registration, network and rules will be announced; this is not an already claimable reward. Follow [@benson_doge](https://x.com/benson_doge).
