# Privacy

Burrow keeps everything on your own computer. It has no server, no account, no analytics and no ads.

## What it stores (locally, in your browser)

- **Your browsing trail:** the address and title of pages you visit, how you got from one to the next, and roughly how long you spent on each. This is what draws the map. Only http and https pages are recorded. Chrome's own pages (such as the new tab page and settings) are skipped.
- **Your settings:** the switches you choose, your volume, and the city (or coordinates) you set for the weather.
- **Your music files:** any audio files you add are copied into the extension's own browser storage. They are never uploaded.

You can delete the trail at any time with **Clear history** on the map page. Removing the extension deletes everything it stored.

## What it sends over the internet

Only two kinds of request, both to [Open-Meteo](https://open-meteo.com/):

- Your city name, to look up its coordinates.
- Those coordinates, to get the current weather.

Nothing about your browsing, your pages, or your music is sent anywhere.

## Why it asks for broad permissions

- It runs a small script on web pages only to draw the weather tint. It does not read or change what's on the page.
- It watches tab and navigation events to build the map.
- It uses a hidden page to play music, and extra storage so your own audio files fit.
- If you press "Use my location", it asks your browser for your location once to get local weather. You can type a city instead.
