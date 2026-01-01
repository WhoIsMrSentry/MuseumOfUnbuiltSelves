# Museum of Unbuilt Selves

A small React + Vite single-page “digital museum” prototype.

It connects to Spotify using OAuth (Authorization Code + PKCE), fetches your playlists from `GET /v1/me/playlists`, then displays only the **first half** (example: 120 playlists → first 60). Clicking a card opens the playlist in a Spotify embed modal.

## What it does

- Spotify connect/disconnect (PKCE flow)
- Fetches all playlist pages **in order** and merges them
- Shows playlist cover images from the Spotify Web API response (`images[0].url`)
- Displays only the first half of playlists: `Math.floor(total / 2)`
- Caches the last successful playlist list in `localStorage` and falls back to it on errors
- Automatically refreshes the access token using the refresh token (when available)

## Requirements

- Node.js (LTS recommended)
- npm

## Setup

```bash
npm install
```

## Configure Spotify

1) Create a Spotify app

- Spotify Developer Dashboard: https://developer.spotify.com/dashboard
- Create an app and copy the **Client ID**.
- Add a **Redirect URI** (must match exactly). The default dev URL for this repo is:
  - `http://127.0.0.1:8888/callback`

2) Configure environment variables

- Copy [.env.example](.env.example) to `.env.local` and fill it in.
- `.env.local` should not be committed (see `.gitignore`).

```bash
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

## Run (Vite)

```bash
npm run dev
```

Open `http://127.0.0.1:8888`.

Build / preview:

```bash
npm run build
npm run preview
```

## Test

```bash
npm test
```

## Notes

- This is a client-only prototype; tokens and cached playlists are stored in `localStorage`.
- If Spotify requests fail temporarily, the app renders the most recent cached playlist list.

## Project structure

- `digital_museum_intro.jsx`: Main component
- `src/main.jsx`: App entry point
- `src/styles.css`: Styles
- `digital_museum_intro.test.jsx`: Basic render test
