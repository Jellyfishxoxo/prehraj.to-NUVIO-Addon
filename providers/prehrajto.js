/*
 * Přehraj.to Premium provider for Nuvio
 *
 * Runtime contract verified against NuvioMedia/NuvioMobile (cmp-rewrite):
 *   getStreams(tmdbId, mediaType, season, episode)
 *   onSettings(), globalThis.SCRAPER_SETTINGS, globalThis.TMDB_API_KEY
 *
 * No credentials are embedded in this file. Authentication is performed only
 * against https://prehraj.to and only from the user's device.
 */

var BASE_URL = "https://prehraj.to";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 11; AFTSSS) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

function getSettings() {
  return globalThis.SCRAPER_SETTINGS || {};
}

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function decodeHtml(value) {
  return text(value)
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(text(value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeTitle(value) {
  var out = text(value).toLowerCase();
  var from = "áäčďéěíĺľňóôöřŕšťúůüýž";
  var to =   "aacdeeillnooorrstuuuyz";
  for (var i = 0; i < from.length; i += 1) {
    out = out.split(from.charAt(i)).join(to.charAt(i));
  }
  return out.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value) {
  var url = decodeHtml(value);
  if (/^https?:\/\//i.test(url)) return url;
  if (url.charAt(0) !== "/") url = "/" + url;
  return BASE_URL + url;
}

function baseHeaders(extra) {
  var headers = {
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "cs-CZ,cs;q=0.9,sk;q=0.8,en;q=0.6",
    "User-Agent": USER_AGENT
  };
  Object.keys(extra || {}).forEach(function (key) { headers[key] = extra[key]; });
  return headers;
}

function cookieJarFromString(raw) {
  var jar = {};
  var clean = text(raw).replace(/[\r\n]/g, "").trim();
  if (clean && clean.indexOf("=") < 0) clean = "access_token=" + clean;
  clean.split(";").forEach(function (part) {
    var index = part.indexOf("=");
    if (index < 1) return;
    var name = part.slice(0, index).trim();
    var value = part.slice(index + 1).trim();
    if (/^[A-Za-z0-9_\-]+$/.test(name) && value) jar[name] = value;
  });
  return jar;
}

function updateCookieJar(jar, setCookie) {
  var raw = text(setCookie);
  var matcher = /(?:^|,)\s*([!#$%&'*+.^_`|~0-9A-Za-z-]+)=([^;,]*)/g;
  var match;
  while ((match = matcher.exec(raw)) !== null) {
    var name = match[1];
    var value = match[2].trim();
    if (value) jar[name] = value;
    else delete jar[name];
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.keys(jar).map(function (name) { return name + "=" + jar[name]; }).join("; ");
}

function fetchWithJar(url, options, jar) {
  var opts = options || {};
  opts.headers = baseHeaders(opts.headers || {});
  var cookies = cookieHeader(jar);
  if (cookies) opts.headers.Cookie = cookies;
  return fetch(url, opts).then(function (response) {
    updateCookieJar(jar, response.headers.get("set-cookie"));
    return response;
  });
}

function formBody(fields) {
  return Object.keys(fields).map(function (key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(fields[key]);
  }).join("&");
}

function checkPremium(jar) {
  return fetchWithJar(BASE_URL + "/profil", { redirect: "follow" }, jar)
    .then(function (response) {
      if (!response.ok || /\/$/.test(response.url)) return false;
      return response.text().then(function (html) {
        return /PREMIUM/i.test(html) && /(Vyprší|platn|aktivn)/i.test(html);
      });
    })
    .catch(function () { return false; });
}

function loginWithPassword(email, password) {
  var jar = {};
  return fetchWithJar(BASE_URL + "/", {}, jar)
    .then(function () {
      return fetchWithJar(BASE_URL + "/?frm=loginDialog-login-loginForm", {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody({
          email: email,
          password: password,
          _do: "loginDialog-login-loginForm-submit"
        })
      }, jar);
    })
    .then(function (response) {
      if (jar.access_token) return jar;
      if (response.status !== 404) {
        return response.text().then(function (html) {
          if (/špatné přihlašovací údaje|has-errors/i.test(html)) throw new Error("Přihlášení bylo odmítnuto");
          return jar;
        });
      }
      return jar;
    })
    .then(function (currentJar) {
      if (currentJar.access_token) return currentJar;
      return fetchWithJar(BASE_URL + "/?frm=homepageLoginForm-loginForm", {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody({
          email: email,
          password: password,
          _do: "homepageLoginForm-loginForm-submit",
          login: "Přihlásit se"
        })
      }, currentJar).then(function () { return currentJar; });
    });
}

function authenticate() {
  var settings = getSettings();
  var mode = settings.authMode || "password";
  if (mode === "password") {
    if (!settings.email || !settings.password) return Promise.reject(new Error("Chybí e-mail nebo heslo"));
    return loginWithPassword(text(settings.email).trim(), text(settings.password));
  }
  var jar = cookieJarFromString(settings.sessionCookie);
  if (!jar.access_token) return Promise.reject(new Error("Chybí access_token session cookie"));
  return Promise.resolve(jar);
}

function tmdbDetail(tmdbId, mediaType, language) {
  var key = text(globalThis.TMDB_API_KEY);
  if (!key) return Promise.reject(new Error("V Nuviu není nastaven TMDB API key"));
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(tmdbId) +
    "?api_key=" + encodeURIComponent(key) + "&language=" + encodeURIComponent(language) +
    "&append_to_response=alternative_titles";
  return fetch(url, { headers: { "Accept": "application/json", "User-Agent": USER_AGENT } })
    .then(function (response) {
      if (!response.ok) throw new Error("TMDB HTTP " + response.status);
      return response.json();
    });
}

function unique(values) {
  var seen = {};
  return values.filter(function (value) {
    var key = normalizeTitle(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function buildMetadata(tmdbId, mediaType, season, episode) {
  return Promise.all([
    tmdbDetail(tmdbId, mediaType, "cs-CZ"),
    tmdbDetail(tmdbId, mediaType, "en-US")
  ]).then(function (details) {
    var primaryTitles = [];
    var alternativeTitles = [];
    var year = "";
    details.forEach(function (item) {
      primaryTitles.push(item.title, item.name, item.original_title, item.original_name);
      var date = item.release_date || item.first_air_date || "";
      if (!year && /^\d{4}/.test(date)) year = date.slice(0, 4);
      var alternatives = item.alternative_titles && (item.alternative_titles.titles || item.alternative_titles.results);
      (alternatives || []).forEach(function (entry) { alternativeTitles.push(entry.title); });
    });
    var titles = unique(primaryTitles.concat(alternativeTitles)).slice(0, 4);
    var queries = [];
    if (mediaType === "tv") {
      var s = String(Number(season) || 0);
      var e = String(Number(episode) || 0);
      var s2 = s.length < 2 ? "0" + s : s;
      var e2 = e.length < 2 ? "0" + e : e;
      titles.forEach(function (title) { queries.push(title + " S" + s2 + "E" + e2); });
      return { titles: titles, year: year, queries: unique(queries).slice(0, 4), episodeTag: "s" + s2 + "e" + e2, altEpisodeTag: s + "x" + e2 };
    }
    titles.forEach(function (title) { queries.push(title + (year ? " " + year : "")); });
    return { titles: titles, year: year, queries: unique(queries).slice(0, 4), episodeTag: "", altEpisodeTag: "" };
  });
}

function parseSearchResults(html) {
  var results = [];
  var anchor = /<a\s+class="video video--small video--link"\s+href="([^"]+)"\s+title="([^"]+)"/g;
  var matches = [];
  var match;
  while ((match = anchor.exec(html)) !== null) matches.push({ index: match.index, end: anchor.lastIndex, href: match[1], title: match[2] });
  matches.forEach(function (item, index) {
    var end = index + 1 < matches.length ? matches[index + 1].index : Math.min(html.length, item.end + 18000);
    var fragment = html.slice(item.end, end);
    var sizeMatch = /video__tag--size[^>]*>([\s\S]*?)<\/div>/.exec(fragment);
    results.push({
      url: absoluteUrl(item.href),
      title: decodeHtml(item.title).trim(),
      size: sizeMatch ? stripTags(sizeMatch[1]) : ""
    });
  });
  return results;
}

function searchPrehrajto(query, jar) {
  var url = BASE_URL + "/hledej/" + encodeURIComponent(normalizeTitle(query));
  return fetchWithJar(url, {}, jar).then(function (response) {
    if (!response.ok) throw new Error("Přehraj.to search HTTP " + response.status);
    return response.text();
  }).then(parseSearchResults);
}

function scoreCandidate(candidate, metadata, mediaType) {
  var haystack = normalizeTitle(candidate.title);
  if (mediaType === "tv" && haystack.indexOf(metadata.episodeTag) < 0 && haystack.indexOf(metadata.altEpisodeTag) < 0) return -100;
  var best = 0;
  metadata.titles.forEach(function (title) {
    var normalized = normalizeTitle(title);
    var score = haystack.indexOf(normalized) >= 0 ? 18 : 0;
    normalized.split(" ").filter(function (token) { return token.length > 1; }).forEach(function (token) {
      if (haystack.split(" ").indexOf(token) >= 0) score += 3;
    });
    if (metadata.year && haystack.indexOf(metadata.year) >= 0) score += 4;
    if (score > best) best = score;
  });
  return best;
}

function selectCandidates(lists, metadata, mediaType) {
  var byUrl = {};
  lists.forEach(function (list) {
    list.forEach(function (candidate) { byUrl[candidate.url] = candidate; });
  });
  var settings = getSettings();
  var limit = Math.max(1, Math.min(20, Number(settings.resultLimit) || 8));
  return Object.keys(byUrl).map(function (url) {
    var candidate = byUrl[url];
    candidate.score = scoreCandidate(candidate, metadata, mediaType);
    return candidate;
  }).filter(function (candidate) { return candidate.score >= 9; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, limit);
}

function parsePlayerMedia(html) {
  var sources = [];
  var subtitles = [];
  var sourceBlock = /var\s+sources\s*=\s*\[([\s\S]*?)\];/.exec(html);
  if (sourceBlock) {
    var sourceRegex = /file\s*:\s*["']([^"']+)["'][\s\S]*?label\s*:\s*["']([^"']+)["']/g;
    var sourceMatch;
    while ((sourceMatch = sourceRegex.exec(sourceBlock[1])) !== null) {
      sources.push({ url: decodeHtml(sourceMatch[1]), quality: decodeHtml(sourceMatch[2]) });
    }
  }
  var trackBlock = /var\s+tracks\s*=\s*\[([\s\S]*?)\];/.exec(html);
  if (trackBlock) {
    var trackRegex = /file\s*:\s*["']([^"']+)["'][\s\S]*?label\s*:\s*["']([^"']+)["']/g;
    var trackMatch;
    while ((trackMatch = trackRegex.exec(trackBlock[1])) !== null) {
      var label = decodeHtml(trackMatch[2]);
      var lang = /\b(CZE|CES|CS)\b/i.test(label) ? "cs" : /\b(SLO|SLK|SK)\b/i.test(label) ? "sk" : /\bENG\b/i.test(label) ? "en" : "und";
      subtitles.push({ url: decodeHtml(trackMatch[1]), language: lang, name: label });
    }
  }
  return { sources: dedupeByUrl(sources), subtitles: dedupeByUrl(subtitles) };
}

function dedupeByUrl(items) {
  var seen = {};
  return items.filter(function (item) {
    if (!item.url || seen[item.url]) return false;
    seen[item.url] = true;
    return true;
  });
}

function resolveCandidate(candidate, jar, premiumConfirmed) {
  var settings = getSettings();
  return fetchWithJar(candidate.url, {}, jar).then(function (pageResponse) {
    if (!pageResponse.ok) throw new Error("Video page HTTP " + pageResponse.status);
    return pageResponse.text();
  }).then(function (html) {
    var media = parsePlayerMedia(html);
    var common = {
      name: "Přehraj.to",
      size: candidate.size || undefined,
      headers: { "Referer": candidate.url, "User-Agent": USER_AGENT },
      subtitles: media.subtitles
    };
    var fallback = [];
    if (settings.includePlayerStreams === true) {
      fallback = media.sources.map(function (source) {
        return {
          name: common.name,
          title: candidate.title + " · " + source.quality,
          url: source.url,
          quality: source.quality,
          size: common.size,
          headers: common.headers,
          subtitles: common.subtitles
        };
      });
    }
    if (!premiumConfirmed) return fallback;
    var separator = candidate.url.indexOf("?") >= 0 ? "&" : "?";
    return fetchWithJar(candidate.url + separator + "do=download", { redirect: "manual" }, jar)
      .then(function (downloadResponse) {
        var location = downloadResponse.headers.get("location");
        if (!location || downloadResponse.status < 300 || downloadResponse.status >= 400) return fallback;
        return [{
          name: common.name,
          title: candidate.title + " · PREMIUM" + (candidate.size ? " · " + candidate.size : ""),
          url: absoluteUrl(location),
          quality: "PREMIUM",
          size: common.size,
          headers: common.headers,
          subtitles: common.subtitles
        }].concat(fallback);
      }).catch(function () { return fallback; });
  }).catch(function (error) {
    console.error("[Přehraj.to] Resolve failed:", candidate.title, error && error.message ? error.message : error);
    return [];
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var normalizedType = mediaType === "series" ? "tv" : mediaType;
  if (normalizedType !== "movie" && normalizedType !== "tv") return Promise.resolve([]);
  if (normalizedType === "tv" && (!season || !episode)) return Promise.resolve([]);
  var jar;
  var metadata;
  var premiumConfirmed = false;
  return authenticate()
    .then(function (authenticatedJar) {
      jar = authenticatedJar;
      return checkPremium(jar);
    })
    .then(function (isPremium) {
      premiumConfirmed = isPremium;
      if (!isPremium && getSettings().includePlayerStreams !== true) throw new Error("Účet/session nebyl rozpoznán jako aktivní Premium");
      return buildMetadata(tmdbId, normalizedType, season, episode);
    })
    .then(function (resolvedMetadata) {
      metadata = resolvedMetadata;
      return Promise.all(metadata.queries.map(function (query) { return searchPrehrajto(query, jar).catch(function () { return []; }); }));
    })
    .then(function (lists) {
      var candidates = selectCandidates(lists, metadata, normalizedType);
      return Promise.all(candidates.map(function (candidate) { return resolveCandidate(candidate, jar, premiumConfirmed); }));
    })
    .then(function (streamLists) {
      var flattened = [];
      streamLists.forEach(function (list) { flattened = flattened.concat(list); });
      return dedupeByUrl(flattened);
    })
    .catch(function (error) {
      console.error("[Přehraj.to]", error && error.message ? error.message : error);
      return [];
    });
}

function onSettings() {
  return [
    { type: "header", label: "Přehraj.to Premium" },
    { type: "info", label: "Přihlašovací údaje zůstávají v lokálním nastavení Nuvia na tomto zařízení. Nikdy je nevkládejte do manifestu nebo JavaScriptu." },
    {
      type: "select",
      key: "authMode",
      label: "Způsob přihlášení",
      options: [
        { label: "E-mail a heslo (lokálně)", value: "password" },
        { label: "Session cookie", value: "cookie" }
      ],
      defaultValue: "password"
    },
    { type: "text", key: "email", label: "E-mail", placeholder: "vas@email.cz" },
    { type: "text", key: "password", label: "Heslo", placeholder: "Heslo k Přehraj.to", isPassword: true },
    { type: "text", key: "sessionCookie", label: "Session cookie (volitelné)", placeholder: "access_token=…; refresh_token=…", isPassword: true, description: "Použije se jen v režimu Session cookie." },
    { type: "toggle", key: "includePlayerStreams", label: "Přidat i webové kvality", description: "K Premium odkazu přidá také kvality nalezené ve webovém přehrávači.", defaultValue: false },
    {
      type: "select",
      key: "resultLimit",
      label: "Maximum výsledků",
      options: [
        { label: "5", value: "5" },
        { label: "8", value: "8" },
        { label: "12", value: "12" }
      ],
      defaultValue: "8"
    },
    { type: "info", label: "Pozor: aktuální Android Nuvio ukládá pluginová nastavení jen do privátního úložiště aplikace, nikoli do šifrovaného trezoru." }
  ];
}

module.exports = {
  getStreams: getStreams,
  onSettings: onSettings,
  _test: {
    parseSearchResults: parseSearchResults,
    parsePlayerMedia: parsePlayerMedia,
    cookieJarFromString: cookieJarFromString,
    updateCookieJar: updateCookieJar,
    normalizeTitle: normalizeTitle
  }
};
