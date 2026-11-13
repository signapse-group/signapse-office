# Architecture

`scripts/serve.mjs` serves Next.js on loopback, selects the request language and provides `/health`.
The 3D office runs in the browser with sample data. The default route and `?demo` show the Symphony demo.
`?demo=claude` opens the older fictional projects.

The Symphony snapshot is in `src/office/demo/symphony-state.js`. The scenario in `symphony.js` uses the same
session and desk code as the rest of the office. Live Symphony integration is pending.

## The page (`app/`, `src/components/`, `src/styles/`)

* `app/layout.tsx` loads the stylesheets (one per area of the screen, in cascade order) and the QR library.
* `app/page.tsx` composes the static markup: `TopBar`, `SessionRail`, `Stage` (with its overlays), `ActivityPanel`,
  the drawers, the toast, and `OfficeBoot`.
* `src/components/OfficeBoot.tsx` is the only client component: once the markup is on screen it dynamically imports
  `src/office/main.js` and calls `startOffice()`.

The markup components render once and never re-render: the office finds elements by `id` and fills them in. Moving a
panel to stateful React is welcome, one panel at a time (see CONTRIBUTING).

## The office (`src/office/`)

Every module exports what other modules use, and may export a `setup()` that does its work at start: building its part
of the scene, wiring its panel. `main.js` runs the `setup()`s in a fixed order — the scene first, then the furniture
and people, then the panels, the demo, and last the render loop — so a module may use anything set up by a
module listed before it in `main.js`. Functions can call into later modules freely (they run after start-up).

Values that several modules assign (the clock `state.sim`, the selection `state.selectedId`, mode switches…) live on
the shared object in `core/state.js`; everything else is an ordinary import.

Things to know before changing the 3D:

* **Draw calls are the budget.** Static meshes are merged into one mesh per material at start (`core/optimize.js`);
  characters merge their joints' meshes (`people/chibi-rig.js`, `mergeRig`). Anything that moves, blinks or changes
  colour must be flagged `userData.noMerge` (or `dynamic`) or it will be frozen into the merge.
* **Never put a flat decal exactly on another surface**: it flickers when zooming. Keep a few millimetres in front, or
  give the material `polygonOffset`.
* **First-person collisions** come from the bounding boxes of meshes at start (`interact/first-person.js`). A merged
  mesh spread across the floor must be `userData.noCollide` and give its footprints instead (`floorBlocks`).
* **Dispose what is thrown away.** three.js keeps the buffers of every geometry it has drawn until `dispose()` is
  called, even after the mesh is gone and forgotten. Something made more than once while the page is open (a person
  who comes and goes, a portrait) gives its geometries back when it goes: a character through `disposeChibi`
  (`people/chibi-rig.js`), anything else shares one geometry or disposes its own.
* **Frame budget**: 60 fps while something moves or you interact, 40 when calm, 10 in the background, 5 without a GPU
  (`core/loop.js`); on Retina screens the resolution steps down when frames come late.

## Languages (`src/i18n/`)

Settings chooses the language through `?lang=vi`. The local server sets `x-office-lang`; the layout reads it and sets
`<html lang>` for the browser. English is the fallback.

## The online demo

`OFFICE_STATIC=1 next build` exports the page as a static site that runs demo mode with no server
(`scripts/build-demo.mjs` builds every language, English at the root and the others under `/<lang>/`;
`.github/workflows/pages.yml` publishes it). In that build `getLang()` takes the language from the build, and the
engine switches to demo mode and talks to no API.

### Module map

| Module | Lines | What it is |
| --- | ---: | --- |
| `audio/sfx.js` | 75 | Sounds, synthesized in the browser. |
| `core/env.js` | 73 | Page-wide basics: DOM helpers, the floor plan choice, replay clock, office clock, season, formatting. |
| `core/loop.js` | 260 | The render loop and its frame budget. |
| `core/optimize.js` | 141 | Merging static meshes into fewer draw calls, then starting. |
| `core/state.js` | 3 | Values that more than one module assigns (the clock, the selection, mode switches…), on one shared object so any module can change them. |
| `demo/demo-log.js` | 17 | The demo's conversation logs (a session's, shown in its drawer, and each subagent's steps), kept to what the drawer can show. |
| `demo/demo.js` | 331 | Demo mode: fictional projects and a fictional Mac. |
| `interact/first-person.js` | 188 | Walk the office and its terrace as your own character. |
| `interact/place-cards.js` | 201 | Place cards: what happens at each place. |
| `interact/place-chips.js` | 182 | Place chips over the furniture and label decluttering. |
| `interact/props.js` | 284 | Furniture you can point at: highlight, tooltip, click actions. |
| `interact/rings.js` | 16 | Selection and hover rings on the floor. |
| `life/altar.js` | 172 | The Thần Tài – Thổ Địa altar in the lobby (company floor), and the offerings on the lunar 1st and 15th. |
| `life/day-swaps.js` | 39 | Làm bù, nghỉ bù: the office on the Government's swapped days (the dates and their notices: src/shared/workdays.js). |
| `life/drill.js` | 368 | Diễn tập PCCC: the quarterly fire drill (company floor). |
| `life/incidents.js` | 95 | Incidents: repeated failures turn the office red. |
| `life/lift-service.js` | 226 | The lift being serviced, right after the office's server starts (server/lift-service.mjs says for how long: three minutes, five on a new build). |
| `life/nap.js` | 63 | The midday nap, 12:30–13:30: blinds down, the room a little dimmer, everyone resting naps at their desk. |
| `life/photostrips.js` | 123 | Displays previously saved release photo strips on the whiteboard. |
| `life/post.js` | 113 | The post box: every commit is a letter in it. |
| `life/quota.js` | 139 | Out of Claude: an account's plan limit used up, its people on a break until it resets. |
| `life/rain.js` | 78 | Umbrellas and a wet-floor sign when it rains. |
| `life/seasons.js` | 234 | Seasonal decorations: Halloween, Christmas, Tết. |
| `life/tests.js` | 116 | The test board: a screen on a stand in the server room (in the small office, on the wall by the racks) with a row for each session at a desk. |
| `life/trophies.js` | 121 | The trophy cabinet and the opening plaque. |
| `life/weather.js` | 90 | Real weather outside (Open-Meteo). |
| `life/your-turn.js` | 37 | "Your turn": sessions that finished or wait for you. |
| `net/live.js` | 157 | The live connection: sessions, desks, teams, events. |
| `people/accountant.js` | 255 | The accountant (company floor): her desk in the director's office, the day's API cost on her screen, the report to the director at 17:30, and a word with whoever spends the most when the plan's limit gets near. |
| `people/bedding.js` | 64 | Nap bedding: blanket, pillow, folding it away. |
| `people/billiards.js` | 484 | Pool in the lounge (company floor; the table: world/props/billiards.js). |
| `people/breaks.js` | 87 | Lunch and the afternoon coffee queue. |
| `people/chibi-rig.js` | 902 | Office characters, two looks on one rig:   toy   (A) designer-toy chibi, ~2 heads: big round head, low wide-set bean eyes, stubby legs, chunky sneakers, matte vinyl. |
| `people/comnha.js` | 195 | Cơm nhà: lunch brought from home, warmed at the pantry's two microwaves at noon (company floor; the corner: world/props/microwave.js; who brought some today, and what: src/shared/comnha.js). |
| `people/director.js` | 129 | The director: brings each prompt to its desk, receives reports. |
| `people/duty.js` | 240 | Trực nhật: the pantry's daily chores, a turn each (company floor; the board and the cups at the sink: world/props/duty-board.js; the rota itself: src/shared/duty.js). |
| `people/errands.js` | 294 | People reacting to what you do in the office: switch off the lamp someone is working by and they get up and switch it back on; print a page and someone fetches it; make a coffee and someone comes for it; the cat on a keyboard gets lifted down; a thirsty plant gets watered; click someone at work and they look up. |
| `people/farewell.js` | 380 | The farewell (tiệc chia tay): a project the office remembers that has had no session for a month (Settings → More: 14, 30, 60 or 90 days, or never; server/tenure.mjs keeps each project's working life and says which are due) gets a last afternoon. |
| `people/foosball.js` | 166 | Foosball in the lounge (the company floor): now and then two people who are resting play a game at the table (one asks, the other comes over), rods spinning, the ball rattling up and down the pitch, the goals counted out loud, the winner pleased with themselves. |
| `people/gaming.js` | 277 | Video games on the lounge TV (company floor). |
| `people/gatherings.js` | 156 | Gatherings round the meeting table: the bell on it calls a quick meeting (everyone free comes, each says what they are on, the director wraps up), a new trophy brings a cake (everyone comes and claps), and a deploy gets a round of applause from the people sitting nearby. |
| `people/hr.js` | 362 | HR and the attendance terminal (company floor). |
| `people/interns.js` | 196 | Interns made permanent (thực tập sinh lên chính thức). |
| `people/karaoke-songs.js` | 51 | The karaoke box's songs (people/karaoke.js): words written for the office, nobody else's. |
| `people/karaoke.js` | 342 | Karaoke in the box on the dev floor (company floor; the booth: world/props/karaoke.js). |
| `people/look.js` | 9 | Which character look (A / B) this viewer chose. |
| `people/navigation.js` | 255 | The walking graph, desk spots and stations people go to. |
| `people/rounds.js` | 130 | The director's rounds (company floor): twice a day out of the corner office and round the desks. |
| `people/staff.js` | 394 | People who work here but aren't sessions: the receptionist, the evening cleaner, a Shopee courier with a parcel. |
| `people/team-lines.js` | 28 | Dashed lines from a boss to its subagents. |
| `people/teatime.js` | 91 | Friday 16:00: afternoon tea. |
| `people/workers.js` | 555 | Workers: one character per session or subagent, what they do and where they walk. |
| `replay/replay.js` | 164 | Replay and recording. |
| `replay/timeline.js` | 193 | The timeline: one lane per session. |
| `scene/blocks.js` | 32 | Building blocks: materials, rounded boxes, cylinders, rugs, canvas textures. |
| `scene/lights.js` | 35 | Sun, sky light and the room lamps (per-room night lighting on the company floor). |
| `scene/quality.js` | 77 | Graphics quality: Auto (the default), Low, Medium or High, each viewer's own choice (Settings → Display). |
| `scene/renderer.js` | 97 | Renderer, cameras, orbit controls, post-processing and environment light. |
| `ui/activity.js` | 302 | The activity column and the session list. |
| `ui/ai-accounts.js` | 270 | The other AI tools' accounts, in the plan card under Claude's (server/codex-accounts.mjs, antigravity-accounts.mjs): Codex and Antigravity IDE, each with its accounts (usage, the one in use, out until when), adding one, using another, and switching by itself when the one in use runs out. |
| `ui/burn.js` | 218 | What eats your plan: where Claude Code's usage goes, by model, MCP server, skill, plugin, subagent, project and session. |
| `ui/cache-words.js` | 51 | Prompt cache status in the session drawer and chat, and the cache notification switch in Settings. |
| `ui/camera-bar.js` | 58 | The camera toolbar. |
| `ui/chat-avatars.js` | 72 | Round photos for the group chat (group-chat-view.js): each person's own chibi, head and shoulders, drawn once by the office's renderer (the way Settings draws its portraits: same materials, light and tone mapping) and kept as a data URL. |
| `ui/ci-card.js` | 44 | "Sửa luôn" (server/index.mjs ciCard / ciFix): the card in the group chat when a repository's CI goes red, from the session working in it. |
| `ui/clip-music.js` | 122 | The clip's music: an original lo-fi loop made right here, nothing borrowed (no samples, no files): a Rhodes-like FM electric piano on Fmaj9 – Em7 – Dm9 – G13, a round bass, a swung boom-bap kit, a soft pentatonic lead, vinyl crackle and a small Schroeder reverb. |
| `ui/denied-card.js` | 46 | "Hộp lệnh bị chặn" (server/index.mjs onDenied): the card in the group chat for a call auto mode refused: who, what, why. |
| `ui/event-text.js` | 125 | How events read on screen: actions per event type, verbs, bubble text, streamer mode. |
| `ui/group-chat-view.js` | 912 | The group chat's window (the conversation: group-chat.js), drawn after the Vietnamese messenger's group chat on a phone (its own web CSS and string table, and a 2026 screenshot of the app, for the colours, sizes and words): the blue gradient bar with the back chevron, the group's name and "👥 N thành viên", call, video and ☰; the pinned message under it; the conversation on a lavender-grey ground, gathered at the bottom like the app's, the others' white bubbles on the left (the name at the top inside the first of a run, the face beside it, the time inside the last), yours pale blue on the right with who has seen it; dark pills for the time lines, white ones for what the group does; "Tin nhắn mới" where you stopped reading; replies quoting what they answer; a recalled message's "Tin nhắn đã được thu hồi"; the ♡ on a bubble's corner and a small pill once someone reacts (hover a bubble for the six, a reply and, on yours, recall); polls and reminders as cards in the middle; "… đang soạn tin"; the input bar: stickers and emoji, "Tin nhắn", ••• (a poll, @ someone), the mic and a photo, or send once you type; writing to Claude, a prompt helper over it. |
| `ui/group-chat.js` | 214 | The company group chat, on the page (the window: group-chat-view.js; the people and what they say: src/shared/chat-engine.js). |
| `ui/icons.js` | 85 | Stroke icons (24 px grid) and the icon helper. |
| `ui/image-view.js` | 28 | Images in the feed: a session that read, wrote or edited an image gets a thumbnail on that line (activity.js), and a click opens it here, large, over the office (the server serves it by id: GET /api/image). |
| `ui/look-switch.js` | 22 | Switching the character look. |
| `ui/mac-approve.js` | 23 | Settings → More: "Approve from the Mac's notifications" (on by default; kept by the server, data/prefs.json). |
| `ui/mac-drawer.js` | 707 | The Mac drawer: memory, CPU, dev servers, plan limits, cleanup. |
| `ui/models.js` | 44 | "Model: người điều phối và subagent" (Settings → More; server/models.mjs): the model a Claude session runs on, the one its subagents run on, always that one or only when Claude doesn't pick, and the note asking Claude to split big tasks. |
| `ui/notify.js` | 64 | Notifications on this phone (Web Push: server/push.mjs sends them, public/sw.js shows them): Claude's answers in the group chat and an approval waiting, even with the office closed and the phone locked. |
| `ui/permissions.js` | 160 | Approve / deny cards and Claude's questions. |
| `ui/phone-home.js` | 114 | "Tổng quan", the home sheet of the phone layout (ui/phone.js): one screen for "what needs me, and how are things". |
| `ui/phone.js` | 105 | The office on a phone: an app-like layout for small screens, upright or held sideways. |
| `ui/photo.js` | 138 | Photo mode: the office alone over the whole window, the camera free (any angle, closer or further, pan with the right button), then a PNG at the screen's size, Full HD or 4K. |
| `ui/pins.js` | 63 | "Ghi nhớ cho Claude" (server: /api/pins, /hook/start): what you want a conversation to keep in mind, said to Claude again each time Claude Code compacts it. |
| `ui/portraits.js` | 64 | Portraits of the two character looks for Settings → Characters: two people in each look, drawn by the office's own renderer (same materials, light and tone mapping, so they match what you will see) into a canvas, the first time the tab opens. |
| `ui/session-account.js` | 54 | "Change account" in a session's drawer (on this computer only): the accounts of the plan card, each with what it has left. |
| `ui/session-compose.js` | 122 | Writing to a session from its own page: a box under the conversation, the same way as the group chat's "Gửi tới" (POST /api/tasks { sid, text, images, chat: true }; a session at work asks first, then POST /api/tasks/steer). |
| `ui/session-drawer.js` | 396 | The session drawer: chat, steps, subagents. |
| `ui/settings.js` | 124 | Settings for the floor plan, look, time, and toggles. |
| `ui/stranded.js` | 159 | "Việc bỏ quên" in the Mac drawer: the worktrees and checkouts of the repositories the office knows that still hold work (files not committed, commits not pushed, stashes), and worktrees with nothing left in them that could go. |
| `ui/stuck.js` | 97 | Stuck sessions ("Ngắt vòng lặp kẹt", server/loops.mjs): the card in the group chat (what repeats, Stop, a hint for Claude) and the row in Settings → More (on or off, after how many failures, after how many minutes of spending with nothing edited). |
| `ui/task-sheet.js` | 98 | "Giao việc": giving Claude work from the group chat (server/tasks.mjs runs it on the Mac). |
| `ui/ticks.js` | 25 | The page's clocks: the time in the top bar, the open session's header, the Mac's readings. |
| `ui/timelapse.js` | 156 | A 15-second clip of the office to share: square (1080 × 1080) for a feed or vertical (1080 × 1920) for Reels, TikTok and Shorts, the camera turning slowly round the floor, people at four times their pace, the day running into the evening (a clock in the corner from 8:00 to 23:00, the lights coming on at six), a title at the start and the day's numbers over the last two and a half seconds, with an original lo-fi tune under it (clip-music.js; it can be turned off). |
| `ui/topbar.js` | 257 | Phone modal, notifications, the night switch. |
| `ui/undo-view.js` | 55 | "Hoàn tác lượt cuối" (server/undo.mjs): in the session drawer, what undoing the last turn would do to each file, two clicks to do it, then what was done and "Tell Claude" (it doesn't know its files were put back otherwise). |
| `ui/vault.js` | 165 | "Kho lịch sử" (server/vault.mjs): every conversation's words, kept after Claude Code deletes its transcript (30 days by default). |
| `ui/whiteboard.js` | 284 | The whiteboard: agents' tasks and your own sticky notes. |
| `ui/wrapped.js` | 107 | The week in review: a 1080 × 1350 picture card (the office as it looks right now, then the week's numbers) to save as a PNG or copy, for sharing. |
| `world/cozy-room.js` | 54 | The cozy plan's room: floor and walls. |
| `world/desks.js` | 183 | Desks and office chairs, and each person's coat and backpack at their desk. |
| `world/entrance.js` | 277 | The cozy plan's door; the company floor's lift and, beside it, the stairs. |
| `world/furniture/board.js` | 25 | The whiteboard's frame (its drawing lives in ui/whiteboard.js). |
| `world/furniture/coffee.js` | 33 | The coffee corner (the pantry counter on the company floor). |
| `world/furniture/meeting.js` | 44 | The meeting table and its chairs. |
| `world/furniture/plants-lamps.js` | 33 | Room plants and floor lamps. |
| `world/furniture/rocket.js` | 22 | The deploy rocket on its launch pad. |
| `world/furniture/room-pieces.js` | 107 | Wall clock, framed art, bookshelf, sofa corner and the globe. |
| `world/furniture/server-racks.js` | 65 | Server racks with LEDs and fans that follow the Mac's CPU. |
| `world/layout.js` | 43 | The floor plans (cozy, pro, hq): where the shared furniture stands, and the headquarters wing. |
| `world/pro/floor.js` | 347 | The company floor: rooms, partitions and furniture. |
| `world/pro/pieces.js` | 142 | Company floor building pieces: floor finishes, walls, glass, chairs, dining sets. |
| `world/pro/wing.js` | 134 | Headquarters' wing: in front of the company floor, a corridor along it, a corridor down the middle and four department rooms of two pods each (the desks, pods' screens and carpets come from the shared code). |
| `world/props/aquarium.js` | 44 | The aquarium. |
| `world/props/arcade.js` | 62 | The arcade cabinet and its little game. |
| `world/props/billiards.js` | 124 | The pool table (company floor), on the lounge's right side between the sofa and the arcade: a 7-foot table (green cloth with its spots, cushions, walnut rails inlaid with pearl diamonds, six leather pockets, turned legs), a rug under it, chalk on the rail, and a round cue stand by the arcade. |
| `world/props/bins.js` | 41 | Context waste bins beside each desk. |
| `world/props/cat.js` | 103 | The office cat. |
| `world/props/cups.js` | 103 | A cup of coffee on each resting desk ("Đồng hồ bộ nhớ đệm"): its steam fades as the session's prompt cache cools (src/shared/cache-clock.js) and is gone once the cache is cold, when writing to the session again means it reads the whole conversation back. |
| `world/props/dev-servers.js` | 85 | Mini servers for each running dev server, and forgotten ones. |
| `world/props/duty-board.js` | 109 | The pantry's duty board and the cups at its sink (company floor; who does what today: people/duty.js). |
| `world/props/game-tv.js` | 94 | The lounge TV (company floor): a 55" TV on a low walnut media unit against the back wall, facing the sofa, with a games console standing beside it, two controllers lying on top, a soundbar, a plant, and a glow on the wall behind it that takes the colour of the picture. |
| `world/props/karaoke.js` | 109 | The karaoke box (company floor), where the front phone booth was, like the coin-op booths in Vietnamese malls: a soundproof cabin on a dark base, black frame, purple acoustic felt at the back and on the side toward the phone booth, glass toward the room so you can watch the singers, a lit KARAOKE band over the glass and over the door, an LED strip round the roof and the base. |
| `world/props/microwave.js` | 231 | The pantry's microwave corner (company floor): two microwaves side by side on a low cabinet against the library's wall, where everyone who brought lunch from home warms it at noon (people/comnha.js). |
| `world/props/neon.js` | 22 | The neon sign. |
| `world/props/printer.js` | 25 | The printer that prints a page when a session finishes. |
| `world/props/shredder.js` | 178 | Paper by context: an in-tray on every desk whose stack grows with its session's context window (loose sheets and a red flag past 85 %), and a paper shredder by the printer. |
| `world/props/string-lights.js` | 29 | String lights along the top of the walls. |
| `world/props/switches.js` | 37 | The light switch by the door: on the company floor it puts out the open-plan floor's light (the one that follows its people after dark), in the cozy room the room's own lights. |
| `world/props/trinkets.js` | 69 | Desk trinkets and the seeded random used by props. |
| `world/props/tv-games.js` | 951 | Video games on the lounge TV (world/props/game-tv.js; people/gaming.js plays them): football, a split-screen racer and a rooftop fighter, drawn as pixel art on a small 2D canvas and played by two players: people resting in the office, a computer player (game.ai) or you in first person. |
| `world/props/tv.js` | 59 | The TV with live machine stats. |
| `world/props/update.js` | 44 | Per-frame updates for the props. |
| `world/props/vacuum.js` | 33 | The robot vacuum. |
| `world/room-update.js` | 177 | Room lights, particles, the rocket, the clock and day / night. |
| `world/screens.js` | 100 | What each desk's screens show: the editor while it edits, a terminal for commands, a browser for the web, code with the match highlighted while it reads or searches, a chat while it thinks, a permission dialog while it waits for you, a screensaver while it naps. |
| `world/skyline.js` | 23 | Starts the city backdrop and updates its day/night state. |
| `world/backdrops/city.js` | 318 | Original street grid, buildings, parks and static roadside details. |
| `world/terrace.js` | 114 | The terrace around the office: tiles, glass railing, bollards, planters, potted plants, seating. |
| `world/windows.js` | 96 | Windows on the outer walls and the views they show. |
