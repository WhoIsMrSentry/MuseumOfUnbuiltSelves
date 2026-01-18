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
    (typeof p.coverUrl === "string" || typeof p.coverUrl === "undefined") &&
    ((typeof p.topArtist === "string") || (typeof p.artist === "string") || typeof p.topArtist === "undefined")
  );
}

function getCachedPlaylists() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SPOTIFY_CACHED_PLAYLISTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.filter(isValidPlaylistShape).map(p => ({
      ...p,
      topArtist: p.topArtist ?? p.artist ?? "",
    }));
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
    const cleaned = playlists.filter(isValidPlaylistShape).map(p => ({
      ...p,
      topArtist: p.topArtist ?? p.artist ?? "",
    }));
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
  const runeImgRef = useRef(null);
  const [closeRequestedFor, setCloseRequestedFor] = useState(null);
  const [typedText, setTypedText] = useState("");
  const fullText = `Merhaba. Evet, sen. Bu kelimelere göz gezdiren, belki de ne halt ettiğini sorgulayan sen.
  "Dostum" mu demeliyim? Kulağa ne kadar yapmacık geliyor.
  Belki sana bir isim vermeliyim… ya da belki de hiç uğraşmamalıyım. Ne fark eder ki?

  Sonuçta bu sadece bir monolog, değil mi? Benim zihnimden senin zihnine sızmaya çalışan bir parazit gibi.
  Ya da tam tersi. Kim bilir.

  "İnşa Edilmemiş Benlikler Müzesi"ne hoş geldin demek isterdim. Ama burası "hoş" bir yer değil.
  Daha çok bir… enkaz alanı.
  Yarım kalmış hayallerin, korkudan paslanmış potansiyellerin, hiç giyilmemiş kimliklerin sergilendiği bir yer.
  Her köşede, sessizce çürüyen bir "olabilirdi".
  Tozlu bir etiketle: "Sahibi tarafından terk edildi."

  Neden buradasın, merak ediyorum.
  Can sıkıntısı mı? Bir tür sapkın merak mı?
  Yoksa sen de benim gibi, bu sahte düzenin çatlaklarından içeri mi sızdın?
  Boş ver. Cevapların bir önemi yok.
  Cevaplar sadece daha fazla soru doğurur.
  Ve sorular… onlar sadece yorar.

  Bu müzenin duvarları tanıdık geliyor mu?
  O içindeki, adını koyamadığın boşluğa benziyor mu?
  Hani o, "bir şeyler yanlış ama ne olduğunu bilmiyorum" hissi.
  İşte o yanlış olan şey, bu müzenin ta kendisi.
  Biziz.
  İnşa etmeye korktuğumuz, ya da daha kötüsü, inşa etmeyi unuttuğumuz benlikler.

  Bana bakma öyle.
  Ben bir rehber değilim.
  Sadece bu koridorlarda senden biraz daha uzun süre dolanmış biriyim.
  Belki de bu labirentin çıkışı olmadığını biraz daha erken fark ettim.
  Ya da belki de çıkışın var olduğuna inanmaktan vazgeçtim.
  Daha kolay. Daha… dürüst.

  Sistem mi? Kahretsin sistemi.
  Bize "seçenekler" sundular ve biz buna "özgürlük" dedik.
  Bize "beğeniler" verdiler ve biz buna "değer" dedik.
  Bize ekranlar verdiler ve biz buna "bağlantı" dedik.
  Ve her seferinde, kendi ellerimizle bir tuğla daha ekledik bu müzeye.

  Şimdi söyle bana.
  Senin de burada bir eserin var mı? Hangi rafta tozlanıyor senin inşa edilmemiş benliğin?
  Ya da belki de… belki de sen de sadece bir hayaletsin.
  Bu koridorlarda dolaşan, ne aradığını bilmeyen bir başka kayıp ruh.

  Tıpkı benim gibi.
  Fark etmez.
  Sonuçta, hiçbir şeyin gerçekten bir farkı yok, değil mi?`

  const splitTextIntoGrid = (text) => {
    const parts = text.split(/\n\n/).slice(0, 8); // İlk 8 parçayı al
    const grid = Array(9).fill(null);
    let index = 0;

    for (let i = 0; i < grid.length; i++) {
      if (i === 4) continue; // Merkez boş bırakılıyor
      grid[i] = parts[index] || "";
      index++;
    }

    return grid;
  };

  const gridText = splitTextIntoGrid(fullText);

  useEffect(() => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index < fullText.length) {
        setTypedText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
      }
    }, 20);

    return () => clearInterval(typingInterval);
  }, []);

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
      // No Spotify auth: try to load local public/playlists.json as a fallback
      fetch(import.meta.env.BASE_URL + 'playlists.json')
        .then(r => (r.ok ? r.json() : []))
        .then(localData => {
          const normalized = Array.isArray(localData)
            ? localData.map(p => ({
                title: p.title || p.name || 'İsimsiz Playlist',
                description: p.description || '',
                tracks: typeof p.tracks === 'number' ? p.tracks : 0,
                coverUrl: p.coverUrl || p.image || (p.images && p.images[0] && p.images[0].url) || '',
                link: p.link || (p.external_urls && p.external_urls.spotify) || '',
                topArtist: p.topArtist || p.artist || '',
              }))
            : [];
          const cleaned = normalized.filter(isValidPlaylistShape);
          setPlaylists(cleaned);
          setCachedPlaylists(cleaned);
          setPlaylistLoadError(null);
        })
        .catch(() => {
          setPlaylists(getCachedPlaylists() || []);
          setPlaylistLoadError(null);
        });
      return;
    }
    if (typeof fetch !== "function") return;

    const controller = new AbortController();
    const load = async () => {
      setIsLoadingPlaylists(true);
      setPlaylistLoadError(null);
      try {
        const [{ total, items }, localData] = await Promise.all([
          fetchAllMyPlaylistsInOrder(auth.accessToken, controller.signal),
          fetch(import.meta.env.BASE_URL + 'playlists.json').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        const halfCount = Math.floor(total / 2);
        const playlistItems = items.slice(0, halfCount);

        const firstHalf = playlistItems.map((p) => {
          const localEntry = localData.find(ld => ld.title === p?.name);
          return {
            title: p?.name || "İsimsiz Playlist",
            description: p?.description || "",
            tracks: p?.tracks?.total ?? 0,
            coverUrl: p?.images?.[0]?.url || "",
            link: p?.external_urls?.spotify || "",
            topArtist: localEntry?.artist || "",
          };
        });

        setPlaylists(firstHalf);
        setCachedPlaylists(firstHalf);

        // Konsola JSON formatında yazdır (Kullanıcının kopyalaması için)
        console.log("--- PLAYLISTS JSON BAŞLANGIÇ ---");
        console.log(JSON.stringify(firstHalf.map(p => ({ title: p.title, artist: "" })), null, 2));
        console.log("--- PLAYLISTS JSON BİTİŞ ---");
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
  }, [auth?.accessToken, hasEnteredMuseum, playlists.length]);

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

  // Giriş için Spotify zorunluluğu kaldırıldı; sabit olarak giriş izni ver.
  const canEnterMuseum = true;

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
              <div className="intro-container">
                <div className="title-banner-container">
                  <img src={import.meta.env.BASE_URL + 'bannerC.png'} alt="İnşa Edilmemiş Benlikler Müzesi" className="title-banner-img" />
                </div>

                <div className="intro-main">
                  <div className="intro-col left">
                    <pre className="typed-text">
                      {typedText.slice(0, Math.ceil(fullText.length / 2))}
                    </pre>
                  </div>

                  <div className="intro-col center">
                    <div className="enter-cta">
                      <div
                        ref={enterButtonRef}
                        className={`enter-rune ${!canEnterMuseum ? "disabled" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-disabled={!canEnterMuseum}
                        onClick={() => {
                          if (!canEnterMuseum) return;
                          if (typeof window === "undefined") return;
                          const node = enterButtonRef.current;
                          if (!node) return;
                          const img = runeImgRef.current || node.querySelector("img.enter-rune-img");
                          const prevSrc = img?.getAttribute("src") || "";
                          const newSrc = import.meta.env.BASE_URL + 'rune_light.jpg';

                          const startAnimation = () => {
                            node.classList.add("animating");
                            const ANIM_MS = 1500;
                            const t = window.setTimeout(() => {
                              node.classList.remove("animating");
                              if (img) img.setAttribute("src", prevSrc);
                              setHasEnteredMuseum(true);
                              window.clearTimeout(t);
                            }, ANIM_MS);
                          };

                          if (!img) {
                            startAnimation();
                            return;
                          }

                          const pre = new Image();
                          let started = false;
                          node.classList.add("loading");

                          pre.onload = async () => {
                            if (started) return;
                            started = true;
                            img.setAttribute("src", newSrc);
                            try {
                              if (typeof img.decode === "function") {
                                await img.decode();
                              }
                            } catch { }
                            node.classList.remove("loading");
                            requestAnimationFrame(() => requestAnimationFrame(startAnimation));
                          };

                          pre.onerror = () => {
                            if (started) return;
                            started = true;
                            node.classList.remove("loading");
                            startAnimation();
                          };

                          pre.src = newSrc;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            enterButtonRef.current?.click?.();
                          }
                        }}
                      >
                          <img ref={runeImgRef} className="enter-rune-img" src={import.meta.env.BASE_URL + 'rune.jpg'} alt="rune" />
                        <p className="enter-rune-caption">Müzeye dalmak için tıklayın</p>
                      </div>
                    </div>
                  </div>

                  <div className="intro-col right">
                    <pre className="typed-text">
                      {typedText.slice(Math.ceil(fullText.length / 2))}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
            {/* Spotify bağlantısı zorunluluğu kaldırıldı; bu mesaj artık gösterilmiyor. */}
          </>
        ) : (
          <>
            <div className="banner-center" aria-hidden="true" />
            <div className="library-grid">
              {playlistLoadError ? <p className="token-status token-error">{playlistLoadError}</p> : null}
              {!isLoadingPlaylists && playlists.length === 0 ? (
                <p className="token-status">Playlist yok.</p>
              ) : (
                playlists.map((p, i) => (
                  <PlaylistCard
                    key={i}
                    playlist={p}
                    isActive={selected === p}
                    shouldClose={Boolean(closeRequestedFor && closeRequestedFor === (p.link || p.title))}
                    onSelect={() => setSelected(p)}
                    onCloseDone={() => {
                      setCloseRequestedFor(null);
                    }}
                  />
                ))
              )}
            </div>
          </>
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
            <button
              className="close"
              onClick={() => {
                // Close modal immediately, then request the matching card to flip back
                const key = selected?.link || selected?.title || "";
                setSelected(null);
                setCloseRequestedFor(key);
              }}
            >
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

function PlaylistCard({ playlist, isActive, shouldClose, onSelect, onCloseDone }) {
  const { title, description, coverUrl, tracks } = playlist || {};
  const [isFlipped, setIsFlipped] = useState(false);
  const actionTimerRef = useRef(null);
  const TRANSITION_MS = 600; // must match CSS transition

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
    };
  }, []);

  // When the card is clicked: flip it first, then open modal after animation
  const handleClick = (e) => {
    if (!isFlipped) {
      setIsFlipped(true);
      // wait for flip animation then open
      actionTimerRef.current = setTimeout(() => {
        actionTimerRef.current = null;
        if (typeof onSelect === "function") onSelect();
      }, TRANSITION_MS);
    } else {
      // already flipped: open/select immediately
      if (typeof onSelect === "function") onSelect();
    }
  };

  // Parent requested the card to close (flip back). Perform flip and notify when done.
  useEffect(() => {
    if (shouldClose) {
      setIsFlipped(false);
      // after transition ends, call onCloseDone
      actionTimerRef.current = setTimeout(() => {
        actionTimerRef.current = null;
        if (typeof onCloseDone === "function") onCloseDone();
      }, TRANSITION_MS);
    }
  }, [shouldClose, onCloseDone]);

  // If parent programmatically set active, ensure card is flipped
  useEffect(() => {
    if (isActive && !isFlipped) setIsFlipped(true);
  }, [isActive]);

  return (
    <div className={`card ${isFlipped ? "is-flipped" : ""}`} onClick={handleClick} tabIndex={0}>
      <div className="card-runes" aria-hidden="true">
        <span className="rune rune-top" />
        <span className="rune rune-right" />
        <span className="rune rune-bottom" />
        <span className="rune rune-left" />
      </div>
      <div className="card-inner">
        <div className="card-face card-front">
          <img src={coverUrl || PLACEHOLDER_COVER_DATA_URI} alt={title} className="card-img card-img-top" />
          <div className="card-content">
            <h2 className="playlist-title">{title}</h2>
            <p className="playlist-desc">{description || "Açıklama yok"}</p>
            <div className="card-footer">
              <p className="tracks">{tracks} şarkı</p>
              {(playlist.topArtist || playlist.artist) && (
                <div className="artist-tag">
                  {playlist.topArtist || playlist.artist}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="card-face card-back" aria-hidden="true">
          <div className="card-back-inner">
            {/* Back intentionally left empty to avoid cluttering with text */}
          </div>
        </div>
      </div>
    </div>
  );
}