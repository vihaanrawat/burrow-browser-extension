# Burrow

A Chrome extension that draws your browsing as a map, so you can see how one click turned into a three-hour detour.

Made by [Vihaan Rawat](https://github.com/vihaanrawat).

<img width="392" height="656" alt="popup" src="https://github.com/user-attachments/assets/f2be44fe-b9ed-493d-9605-5a0cc4b293b7" />
<img width="1917" height="872" alt="map" src="https://github.com/user-attachments/assets/5ddbd8c1-d5d4-41b4-8d3c-99f6e4e92ad1" />
<img width="1917" height="876" alt="mytracks" src="https://github.com/user-attachments/assets/f19c7b4b-e356-4eac-8094-0d324cc8766f" />

## What it does

**Rabbit hole map.** Every page you visit becomes a dot. Lines show how you got from one page to the next. Bigger dots mean you spent more time there, and each site keeps its own color. Open the map and it updates live while you browse.

**Weather tint.** Burrow looks up the weather for your city and lays a faint color over every page you visit: warm for clear days, deep blue at night, grey for fog, and optional falling rain or snow. The map and the popup take their colors from the same weather.

**Ambient music.** Pick original generated music in one of two moods (a hushed piano one and a brighter bell one), or add your own audio files and Burrow plays them in shuffled order. Music pauses by itself whenever a tab is playing sound.

## Install

Burrow isn't on the Chrome Web Store, so you load it by hand:

1. Download or clone this repo.
2. Open `chrome://extensions` in Chrome (version 116 or newer).
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked** and choose the folder that contains `manifest.json`.
5. Click the Burrow icon, type your city, and pick a music option if you want one.

After you change any file, click the reload arrow on the Burrow card.

## Using it

- **Open the map:** click the icon, then **Open the map**. Scroll to zoom, drag to pan, hover a dot for details, click a dot to reopen that page.
- **Connect every page in order:** a solid line is a link you clicked. A dotted line means "this was just the next page you opened" (typed address, bookmark, another tab). Turn this switch off if you only want clicked links drawn.
- **New trail:** after 30 minutes of inactivity, Burrow starts a new rabbit hole. Use the dropdown on the map to look at older ones.
- **Your own music:** in the popup choose **My own tracks**, then **Add or remove my tracks**. Only add music you own.

## How it works

I'll explain the parts that took the most thought.

### The trail lives in storage, not in variables

Chrome puts an extension's background script (a "service worker") to sleep when it's idle, and anything held in a normal variable disappears when it does. So Burrow writes every step of your trail into browser storage and reads it back each time something happens.

That creates a second problem: Chrome fires events in parallel, so two events can read the same saved state and the second one overwrites the first. To avoid losing steps, Burrow puts every event in a queue and handles them one at a time.

### How a page gets connected to another

For each new page Burrow checks how you arrived there. If you clicked a link, the page is connected to the page you were on in that tab. If you opened a link in a new tab, the new tab inherits its place from the tab it came from. If you typed an address or used a bookmark, that's a fresh start, and with **Connect every page in order** on, it's linked to your previous page with a dotted line instead.

Time on a page is counted for the tab you're actually looking at, in a focused window. Each stretch is capped at five minutes so that leaving your laptop open overnight doesn't produce a 9-hour dot.

### How the map is drawn

The map is plain SVG with no charting library. Pages can link back to ones you've already visited, which makes loops, and loops don't fit a tidy left-to-right layout. So each page keeps the first link that reached it as its "parent" to place it in the tree, and any extra links are drawn as dashed lines on top. Depth decides how far right a dot sits, and siblings stack vertically.

Page titles come from websites, so I never insert them as HTML. They go in as plain text, so a page with a strange title can't inject anything into the map.

### Music runs in a hidden page

A service worker can't play sound, so Burrow opens a hidden "offscreen document" that does it. The generated music is made with the Web Audio API: slow chords, a few notes picked at random from a minor scale, and a long, dark reverb so the notes hang in the air. Each site nudges the key slightly. Your own tracks are stored in the browser's IndexedDB, and the player shuffles through them.

### Weather

City names are turned into coordinates, and the current weather code is fetched from [Open-Meteo](https://open-meteo.com/) (free, no key). The code is mapped to a mood such as clear, fog, rain, snow or storm. The tint is a layer over the page that ignores clicks, so it never gets in the way.

## Project layout

| File | What it does |
| --- | --- |
| `manifest.json` | Extension settings and permissions |
| `background.js` | Records the trail, fetches weather, controls the music page |
| `content.js` | Draws the weather tint and rain/snow over pages |
| `shared.js` | Helpers shared by every part (settings, weather moods, trail tree, track storage) |
| `popup.html/css/js` | The small window from the toolbar icon |
| `map.html/css/js` | The full-page rabbit hole map |
| `offscreen.html/js` | Hidden page that plays the music |
| `music.html/css/js` | Page for adding your own tracks |

## Privacy

Everything stays on your computer. Burrow has no server and no analytics. The only requests it makes are to Open-Meteo, to turn your city into coordinates and to get the weather. See [PRIVACY.md](PRIVACY.md) for details.

## Known limitations

- It only works in Chrome (and probably other Chromium browsers) version 116 or newer.
- It has been tested by hand only. There are no automated tests yet.
- The generated music is an approximation of a mood, not a copy of anything. How good it sounds is subjective.
- Sites that change pages without reloading (single-page apps) are tracked, but may occasionally add extra dots.

## Not affiliated

Burrow is a personal project. It isn't affiliated with or endorsed by Team Cherry. The mood names in the popup only describe the feel of the music, and Burrow contains no music from any game.

## Credits

Made by Vihaan Rawat. Weather data from Open-Meteo.

## License

MIT, see [LICENSE](LICENSE).
