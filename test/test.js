const assert = require('node:assert/strict');
const provider = require('../providers/prehrajto.js');
const t = provider._test;

assert.equal(t.normalizeTitle('Příliš žluťoučký Kůň'), 'prilis zlutoucky kun');

const cookies = t.cookieJarFromString('access_token=abc.def; refresh_token=xyz');
t.updateCookieJar(cookies, '_nss=1; path=/, access_token=new-token; path=/; HttpOnly');
assert.equal(cookies.access_token, 'new-token');
assert.equal(cookies.refresh_token, 'xyz');

const searchHtml = `
<div class="video__picture--container">
  <a class="video video--small video--link" href="/film/abc123" title="Film 2024 CZ dabing">
  <div class="video__tag video__tag--size video__tag--size-alone"> 2.50 GB </div>
</div>`;
assert.deepEqual(t.parseSearchResults(searchHtml), [{
  url: 'https://prehraj.to/film/abc123',
  title: 'Film 2024 CZ dabing',
  size: '2.50 GB'
}]);

const playerHtml = `
<script>
var sources = [{ file: "https://cdn.example/video.mp4", label: '1080p' }];
var tracks = [{ file: "https://cdn.example/sub.vtt", label: "CZE - titulky", kind: "captions" }];
</script>`;
assert.deepEqual(t.parsePlayerMedia(playerHtml), {
  sources: [{ url: 'https://cdn.example/video.mp4', quality: '1080p' }],
  subtitles: [{ url: 'https://cdn.example/sub.vtt', language: 'cs', name: 'CZE - titulky' }]
});

console.log('All parser tests passed.');
