const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fetchSpotifyData() {
    // If SKIP_FETCH is set, copy local playlists.json to public and exit
    if (process.env.SKIP_FETCH === 'true') {
        const fallbackSrc = path.join(__dirname, '../playlists.json');
        const fallbackDest = path.join(__dirname, '../public/playlists.json');
        if (fs.existsSync(fallbackSrc)) {
            const outDir = path.dirname(fallbackDest);
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            fs.copyFileSync(fallbackSrc, fallbackDest);
            console.log('SKIP_FETCH=true — copied local playlists.json to public/playlists.json');
            process.exit(0);
        } else {
            console.error('SKIP_FETCH=true but no local playlists.json found at', fallbackSrc);
            process.exit(1);
        }
    }
    const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('Error: VITE_SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env');
        process.exit(1);
    }

    try {
        // 1. Get Access Token (Client Credentials Flow)
        console.log('Fetching access token...');
        const authUrl = 'https://accounts.spotify.com/api/token';
        console.log('Requesting token from', authUrl);
        const authRes = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            },
            body: 'grant_type=client_credentials',
        });

        // capture full response for debugging
        const authText = await authRes.text();
        let authData;
        try { authData = JSON.parse(authText); } catch (e) { authData = { raw: authText }; }
        console.log('Auth response status:', authRes.status);
        console.log('Auth response body:', authData);

        if (!authRes.ok) {
            // provide more context in error
            throw new Error(`Auth failed: status=${authRes.status} body=${JSON.stringify(authData)}`);
        }
        const accessToken = authData.access_token;

        // 2. Fetch User Playlists
        // Note: To fetch a specific user's public playlists, we need their user ID.
        // If not provided, we can fetch from a specific playlist URL if we had one,
        // but the original app used 'me/playlists'. For a static build, we need a target user ID.
        const userId = process.env.SPOTIFY_USER_ID;
        if (!userId) {
            console.error('Error: SPOTIFY_USER_ID must be set in .env');
            process.exit(1);
        }

        console.log(`Fetching playlists for user: ${userId}...`);
        let url = `https://api.spotify.com/v1/users/${userId}/playlists?limit=50`;
        const allPlaylists = [];

        while (url) {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
            if (!res.ok) {
                console.error('Fetch playlists failed status:', res.status, 'body:', data);
                throw new Error(`Fetch playlists failed: status=${res.status} body=${JSON.stringify(data)}`);
            }

            allPlaylists.push(...data.items);
            url = data.next;
        }

        // 3. Load local metadata for artists
        const localPlaylistsPath = path.join(__dirname, '../playlists.json');
        let localData = [];
        if (fs.existsSync(localPlaylistsPath)) {
            localData = JSON.parse(fs.readFileSync(localPlaylistsPath, 'utf8'));
        }

        // 4. Transform data
        // The original app took the first half of playlists
        const halfCount = Math.floor(allPlaylists.length / 2);
        const playlistItems = allPlaylists.slice(0, halfCount);

        const transformed = playlistItems.map(p => {
            const localEntry = localData.find(ld => ld.title === p.name);
            return {
                title: p.name || "İsimsiz Playlist",
                description: p.description || "",
                tracks: p.tracks?.total ?? 0,
                coverUrl: p.images?.[0]?.url || "",
                link: p.external_urls?.spotify || "",
                topArtist: localEntry?.artist || "",
            };
        });

        // 5. Save to public/playlists.json (Vite serves this)
        const outputPath = path.join(__dirname, '../public/playlists.json');
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2));
        console.log(`Successfully saved ${transformed.length} playlists to public/playlists.json`);

    } catch (error) {
        console.error('Failed to fetch Spotify data:', error.message);
        // Fallback: copy local playlists.json to public if available
        try {
            const fallbackSrc = path.join(__dirname, '../playlists.json');
            const fallbackDest = path.join(__dirname, '../public/playlists.json');
            if (fs.existsSync(fallbackSrc)) {
                const outDir = path.dirname(fallbackDest);
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                fs.copyFileSync(fallbackSrc, fallbackDest);
                console.log('Used local fallback — copied playlists.json to public/playlists.json');
                process.exit(0);
            } else {
                console.error('No local playlists.json fallback available at', fallbackSrc);
                process.exit(1);
            }
        } catch (e) {
            console.error('Fallback copy failed:', e.message);
            process.exit(1);
        }
    }
}

fetchSpotifyData();
