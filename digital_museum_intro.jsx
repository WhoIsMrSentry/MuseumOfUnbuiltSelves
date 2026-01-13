// React + Tailwind başlangıç yapısı: İnşa Edilmemiş Benlikler Müzesi

import React, { useEffect, useRef, useState } from "react";

const SPOTIFY_AUTH_STORAGE_KEY = "digitalMuseum.spotifyAuth";
const SPOTIFY_PKCE_STORAGE_KEY = "digitalMuseum.spotifyPkce";
const SPOTIFY_CACHED_PLAYLISTS_KEY = "digitalMuseum.cachedPlaylists";

const SPOTIFY_SCOPES = ["playlist-read-private", "playlist-read-collaborative"];

const PLACEHOLDER_COVER_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640' viewBox='0 0 640 640'>
      <rect width='640' height='640' fill='#111827'/>
      <rect x='64' y='64' width='512' height='512' rx='24' fill='#1f2937'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='28' font-family='system-ui, -apple-system, Segoe UI, Roboto, Arial'>Kapak yok</text>
    </svg>`
  );

function getSpotifyConfig() {
  const clientId = globalThis?.__SPOTIFY_CLIENT_ID__;
  const redirectUriFromEnv = globalThis?.__SPOTIFY_REDIRECT_URI__;
  const redirectUriAuto =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/callback`
      : "";
  const redirectUri =
    typeof redirectUriFromEnv === "string" && redirectUriFromEnv.trim().length > 0
      ? redirectUriFromEnv.trim()
      : redirectUriAuto;
  return {
    clientId: typeof clientId === "string" ? clientId : "",
    redirectUri: typeof redirectUri === "string" ? redirectUri : "",
  };
}

function canUseLocalStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isValidPlaylistShape(p) {
  return (
    p &&
    typeof p === "object" &&
    typeof p.title === "string" &&
    typeof p.link === "string" &&
    (typeof p.description === "string" || typeof p.description === "undefined") &&
    (typeof p.tracks === "number" || typeof p.tracks === "undefined") &&
    (typeof p.coverUrl === "string" || typeof p.coverUrl === "undefined")
  );
}

function getCachedPlaylists() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SPOTIFY_CACHED_PLAYLISTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.filter(isValidPlaylistShape);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

function setCachedPlaylists(playlists) {
  if (!canUseLocalStorage()) return;
  try {
    if (!Array.isArray(playlists) || playlists.length === 0) {
      window.localStorage.removeItem(SPOTIFY_CACHED_PLAYLISTS_KEY);
      return;
    }
    const cleaned = playlists.filter(isValidPlaylistShape);
    window.localStorage.setItem(SPOTIFY_CACHED_PLAYLISTS_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore
  }
}

function isValidAuthShape(a) {
  return (
    a &&
    typeof a === "object" &&
    typeof a.accessToken === "string" &&
    typeof a.refreshToken === "string" &&
    typeof a.expiresAt === "number" &&
    (typeof a.scope === "string" || typeof a.scope === "undefined")
  );
}

function getStoredAuth() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SPOTIFY_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidAuthShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setStoredAuth(auth) {
  if (!canUseLocalStorage()) return;
  try {
    if (!isValidAuthShape(auth)) return;
    window.localStorage.setItem(SPOTIFY_AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // ignore
  }
}

function clearStoredAuth() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(SPOTIFY_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isValidPkceShape(p) {
  return (
    p &&
    typeof p === "object" &&
    typeof p.state === "string" &&
    typeof p.codeVerifier === "string" &&
    (typeof p.refreshToken === "string" || typeof p.refreshToken === "undefined")
  );
}

function getStoredPkce() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SPOTIFY_PKCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidPkceShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setStoredPkce(pkce) {
  if (!canUseLocalStorage()) return;
  try {
    if (!isValidPkceShape(pkce)) return;
    window.localStorage.setItem(SPOTIFY_PKCE_STORAGE_KEY, JSON.stringify(pkce));
  } catch {
    // ignore
  }
}

function clearStoredPkce() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(SPOTIFY_PKCE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    let out = "";
    for (let i = 0; i < values.length; i += 1) out += charset[values[i] % charset.length];
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i += 1) out += charset[Math.floor(Math.random() * charset.length)];
  return out;
}

async function sha256Base64Url(input) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Tarayıcı crypto.subtle desteklemiyor.");
  }
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function buildSpotifyAuthorizeUrl({ clientId, redirectUri, scopes, state, codeChallenge }) {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", (scopes || []).join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  return url.toString();
}

async function exchangeCodeForToken({ clientId, redirectUri, code, codeVerifier, signal }) {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", codeVerifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_description || data?.error || `Spotify token alınamadı (${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

async function refreshAccessToken({ clientId, refreshToken, signal }) {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_description || data?.error || `Spotify refresh başarısız (${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

async function fetchAllMyPlaylistsInOrder(accessToken, signal) {
  let url = new URL("https://api.spotify.com/v1/me/playlists");
  url.searchParams.set("limit", "50");

  const items = [];
  let total = 0;

  while (url) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `Spotify playlistleri alınamadı (${res.status}).`;
      throw new Error(msg);
    }

    if (typeof data.total === "number") total = data.total;
    if (Array.isArray(data.items)) items.push(...data.items);

    url = data.next ? new URL(data.next) : null;
  }

  return { total: total || items.length, items };
}

function extractSpotifyPlaylistId(link) {
  if (!link || typeof link !== "string") return "";
  const trimmed = link.trim();
  const m1 = trimmed.match(/spotify:playlist:([A-Za-z0-9]+)/);
  if (m1) return m1[1];
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("playlist");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // ignore
  }
  return "";
}

export default function MuseumIntro() {
  const [selected, setSelected] = useState(null);
  const [playlists, setPlaylists] = useState(() => getCachedPlaylists() || []);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [playlistLoadError, setPlaylistLoadError] = useState(null);
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [authStatus, setAuthStatus] = useState(null);
  const [lightMode, setLightMode] = useState("top");
  const [hasEnteredMuseum, setHasEnteredMuseum] = useState(false);
  const [isEnteringMuseum, setIsEnteringMuseum] = useState(false);
  const [enterOrigin, setEnterOrigin] = useState({ x: "50%", y: "22%" });
  const enterButtonRef = useRef(null);

  useEffect(() => {
    document.title = "İnşa Edilmemiş Benlikler Müzesi";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      // Başlık görünürken "top"; scroll başlayınca "center".
      setLightMode(window.scrollY <= 24 ? "top" : "center");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    // Auth localStorage dışında değiştiyse yakala
    if (!canUseLocalStorage()) return;
    const onStorage = (e) => {
      if (e.key === SPOTIFY_AUTH_STORAGE_KEY) {
        setAuth(getStoredAuth());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;
    const prevOverflow = body.style.overflow;
    if (selected) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [selected]);

  useEffect(() => {
    // Callback: ?code=...&state=... gelirse token al.
    if (typeof window === "undefined") return;
    const { clientId, redirectUri } = getSpotifyConfig();
    if (!clientId || !redirectUri) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      setAuthStatus(`Spotify giriş hatası: ${error}`);
      // URL'i temizle
      url.searchParams.delete("error");
      window.history.replaceState({}, document.title, url.toString());
      return;
    }

    if (!code) return;

    const pkce = getStoredPkce();
    if (!pkce?.codeVerifier || !pkce?.state || pkce.state !== state) {
      setAuthStatus("Spotify giriş doğrulaması başarısız (state uyuşmadı). Tekrar deneyin.");
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setAuthStatus("Spotify ile bağlanılıyor…");
      try {
        const tokenData = await exchangeCodeForToken({
          clientId,
          redirectUri,
          code,
          codeVerifier: pkce.codeVerifier,
          signal: controller.signal,
        });

        const now = Date.now();
        const expiresInMs = (tokenData?.expires_in ? Number(tokenData.expires_in) : 3600) * 1000;
        const newAuth = {
          accessToken: tokenData?.access_token || "",
          refreshToken: tokenData?.refresh_token || pkce.refreshToken || "",
          expiresAt: now + expiresInMs,
          scope: tokenData?.scope || SPOTIFY_SCOPES.join(" "),
        };

        setStoredAuth(newAuth);
        setAuth(newAuth);
        setAuthStatus("Spotify bağlantısı kuruldu.");
        clearStoredPkce();

        // URL'i temizle (code/state kalmasın)
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, document.title, url.toString());
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Spotify ile bağlanılamadı.";
        setAuthStatus(msg);
      }
    };
    run();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    // Token süresi dolmadan yenile.
    const { clientId } = getSpotifyConfig();
    if (!clientId) return;
    if (!auth?.refreshToken || !auth?.expiresAt) return;
    if (typeof fetch !== "function") return;

    const now = Date.now();
    const refreshAt = Math.max(now, Number(auth.expiresAt) - 60_000);
    const delay = refreshAt - now;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const refreshed = await refreshAccessToken({
          clientId,
          refreshToken: auth.refreshToken,
          signal: controller.signal,
        });

        const nextExpiresInMs = (refreshed?.expires_in ? Number(refreshed.expires_in) : 3600) * 1000;
        const nextAuth = {
          ...auth,
          accessToken: refreshed?.access_token || auth.accessToken,
          // Spotify refresh endpoint refresh_token dönmeyebilir; eskisini koru
          refreshToken: refreshed?.refresh_token || auth.refreshToken,
          expiresAt: Date.now() + nextExpiresInMs,
          scope: refreshed?.scope || auth.scope,
        };

        setStoredAuth(nextAuth);
        setAuth(nextAuth);
      } catch {
        // sessizce bırak; playlist fetch hata verirse cache'e düşer
      }
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [auth?.refreshToken, auth?.expiresAt]);

  useEffect(() => {
    // Spotify hesabındaki playlistleri sırayla çek; ilk yarısını al.
    if (!hasEnteredMuseum) {
      setIsLoadingPlaylists(false);
      setPlaylistLoadError(null);
      return;
    }
    if (!auth?.accessToken) {
      setPlaylists(getCachedPlaylists() || []);
      setPlaylistLoadError(null);
      return;
    }
    if (typeof fetch !== "function") return;

    const controller = new AbortController();
    const load = async () => {
      setIsLoadingPlaylists(true);
      setPlaylistLoadError(null);
      try {
        const { total, items } = await fetchAllMyPlaylistsInOrder(auth.accessToken, controller.signal);
        const halfCount = Math.floor(total / 2);
        const firstHalf = items.slice(0, halfCount).map((p) => ({
          title: p?.name || "İsimsiz Playlist",
          description: p?.description || "",
          tracks: p?.tracks?.total ?? 0,
          coverUrl: p?.images?.[0]?.url || "",
          link: p?.external_urls?.spotify || "",
        }));

        setPlaylists(firstHalf);
        // "Son çekilen" listeyi hardcoded fallback gibi sakla.
        setCachedPlaylists(firstHalf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Spotify playlistleri alınamadı.";
        setPlaylistLoadError(msg);
        // Hata durumunda sayfa boş kalmasın diye en son çekilen listeye (yoksa boş listeye) dön.
        setPlaylists(getCachedPlaylists() || []);
      } finally {
        setIsLoadingPlaylists(false);
      }
    };

    load();
    return () => controller.abort();
  }, [auth?.accessToken, hasEnteredMuseum]);

  const startSpotifyLogin = async () => {
    const { clientId, redirectUri } = getSpotifyConfig();
    if (!clientId || !redirectUri) {
      setAuthStatus("Spotify Client ID / Redirect URI ayarlı değil (.env). ");
      return;
    }
    if (typeof window === "undefined") return;

    try {
      const state = randomString(24);
      const codeVerifier = randomString(96);
      const codeChallenge = await sha256Base64Url(codeVerifier);
      setStoredPkce({ state, codeVerifier });
      const authUrl = buildSpotifyAuthorizeUrl({
        clientId,
        redirectUri,
        scopes: SPOTIFY_SCOPES,
        state,
        codeChallenge,
      });
      window.location.assign(authUrl);
    } catch {
      setAuthStatus("Spotify giriş başlatılamadı (tarayıcı kısıtlaması olabilir). ");
    }
  };

  const disconnectSpotify = () => {
    clearStoredAuth();
    clearStoredPkce();
    setAuth(null);
    setAuthStatus("Spotify bağlantısı kaldırıldı.");
    // Bağlantı kesilince de son çekilen liste hardcoded gibi kalsın.
    setPlaylists(getCachedPlaylists() || []);
  };

  const enterMuseum = () => {
    if (typeof window === "undefined") return;
    if (hasEnteredMuseum || isEnteringMuseum) return;

    const btn = enterButtonRef.current;
    if (btn && typeof btn.getBoundingClientRect === "function") {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const x = `${Math.round((cx / window.innerWidth) * 100)}%`;
      const y = `${Math.round((cy / window.innerHeight) * 100)}%`;
      setEnterOrigin({ x, y });
    }

    const DIVE_MS = 850;
    setIsEnteringMuseum(true);
    window.setTimeout(() => {
      setHasEnteredMuseum(true);
      setIsEnteringMuseum(false);
    }, DIVE_MS);
  };

  const canEnterMuseum = Boolean(auth?.accessToken) || playlists.length > 0;

  return (
    <div
      className={`app${isEnteringMuseum ? " entering" : ""}`}
      data-light={lightMode}
      style={{ "--enter-x": enterOrigin.x, "--enter-y": enterOrigin.y }}
    >
      {isEnteringMuseum ? <div className="enter-overlay" aria-hidden="true" /> : null}

      <div className="scene">
        {!hasEnteredMuseum ? (
          <>
            {!isEnteringMuseum ? (
              <>
                <div className="hero">
                  <h1 className="text-4xl md:text-6xl font-bold mb-6 text-[#88001b]">İnşa Edilmemiş Benlikler Müzesi</h1>
                  <p className="text-lg md:text-xl text-gray-300">
                    Merhaba. Evet, sen. Bu kelimelere göz gezdiren, belki de ne halt ettiğini sorgulayan sen.
                    <br />
                    "Dostum" mu demeliyim? Kulağa ne kadar yapmacık geliyor...
                    <br />
                    Belki sana bir isim vermeliyim... ya da belki de hiç uğraşmamalıyım. Ne fark eder ki?
                  </p>
                </div>

                <div className="token-banner" role="region" aria-label="Spotify bağlantısı">
                  <div className="token-banner-row">
                    <div className="token-banner-text">
                      <p className="token-title">Spotify’dan otomatik playlist çekme</p>
                      <p className="token-sub">
                        Spotify ile bağlanınca playlistler sırayla çekilir ve ilk yarısı (örn. 120 → 60) gösterilir.
                      </p>
                    </div>
                    {auth?.accessToken ? (
                      <button className="token-button" onClick={disconnectSpotify} type="button">
                        Bağlantıyı kes
                      </button>
                    ) : (
                      <button className="token-button" onClick={startSpotifyLogin} type="button">
                        Spotify ile bağlan
                      </button>
                    )}
                  </div>

                  {authStatus ? <p className="token-status">{authStatus}</p> : null}
                </div>
              </>
            ) : null}

            <div className="enter-cta">
              <button
                ref={enterButtonRef}
                className="enter-button"
                type="button"
                onClick={enterMuseum}
                disabled={!canEnterMuseum}
                aria-disabled={!canEnterMuseum}
              >
                Müzeye dal
              </button>
            </div>
            {!canEnterMuseum ? (
              <p className="token-status">Önce Spotify ile bağlan (veya cache’li playlist olsun).</p>
            ) : null}
          </>
        ) : (
          <div className="library-grid">
            {isLoadingPlaylists ? <p className="token-status">Spotify playlistleri yükleniyor…</p> : null}
            {playlistLoadError ? <p className="token-status token-error">{playlistLoadError}</p> : null}
            {!isLoadingPlaylists && playlists.length === 0 ? (
              <p className="token-status">Playlist yok.</p>
            ) : (
              playlists.map((p, i) => (
                <div
                  key={i}
                  className="card"
                  onClick={() => {
                    setSelected(p);
                  }}
                >
                  <div className="card-runes" aria-hidden="true">
                    <span className="rune rune-top" />
                    <span className="rune rune-right" />
                    <span className="rune rune-bottom" />
                    <span className="rune rune-left" />
                  </div>
                  <img src={p.coverUrl || PLACEHOLDER_COVER_DATA_URI} alt={p.title} className="card-img card-img-top" />
                  <div className="card-content">
                    <h2 className="playlist-title">{p.title}</h2>
                    <p className="playlist-desc">{p.description || "Açıklama yok"}</p>
                    <p className="tracks">🎶 {p.tracks} şarkı</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay">
          <div
            className="modal"
            style={{
              "--modal-cover": `url("${String(
                selected.coverUrl || PLACEHOLDER_COVER_DATA_URI
              ).replace(/\"/g, "%22")}")`,
            }}
          >
            <button className="close" onClick={() => setSelected(null)}>
              ✕
            </button>
            <h2 className="playlist-title">{selected.title}</h2>
            <p className="playlist-desc">{selected.description}</p>
            <iframe
              className="playlist-iframe"
              src={`https://open.spotify.com/embed/playlist/${extractSpotifyPlaylistId(selected.link) || ""}?utm_source=generator`}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}