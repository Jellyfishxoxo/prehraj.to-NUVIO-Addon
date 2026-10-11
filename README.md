Přehraj.to Premium pro Nuvio

Nativní JavaScript provider pro [Nuvio](https://github.com/NuvioMedia/NuvioMobile), určený pro vlastní účet Přehraj.to Premium.

Provider běží lokálně přímo v Nuvio na zařízení. Podle TMDB metadat vyhledá odpovídající film nebo epizodu na Přehraj.to a pokusí se získat přímý Premium odkaz pro přehrání.

> [!IMPORTANT]
> Provider neposkytuje Premium účet ani žádný obsah. Potřebujete vlastní aktivní Přehraj.to Premium účet. Používejte jej pouze pro obsah, ke kterému máte oprávněný přístup, a v souladu s podmínkami služby a místními zákony.

## Funkce

- filmy a seriály;
- české, anglické a původní názvy z TMDB;
- přesné rozpoznávání epizod `S01E02` a `1x02`;
- přihlášení e-mailem a heslem přímo z nastavení Nuvia;
- alternativní přihlášení pomocí session cookie;
- Premium odkazy přes Přehraj.to download redirect;
- volitelné webové kvality nalezené v přehrávači;
- externí titulky nalezené na stránce videa;
- žádný vlastní server ani Docker — provider běží na zařízení.

## Požadavky

- aktuální sideloadovaná verze Nuvia s podporou Plugins;
- Amazon Fire TV nebo jiné podporované zařízení;
- vlastní aktivní Přehraj.to Premium účet;
- funkční TMDB API key nastavený v Nuvio;
- veřejně dostupná HTTPS adresa tohoto repozitáře.

## Instalace

### 1. Nahrajte soubory na GitHub

Obsah balíčku nahrajte do kořene veřejného GitHub repozitáře. Struktura musí zůstat zachována:

```text
.
├── manifest.json
├── providers/
│   └── prehrajto.js
├── test/
│   └── test.js
└── README.md
```

Přihlašovací údaje se do repozitáře nevkládají.

### 2. Sestavte URL manifestu

Nahraďte `GITHUB_UZIVATEL` a `REPO` vlastními hodnotami:

```text
https://raw.githubusercontent.com/GITHUB_UZIVATEL/REPO/main/manifest.json
```

Příklad:

```text
https://raw.githubusercontent.com/novak/nuvio-prehrajto/main/manifest.json
```

### 3. Přidejte repository do Nuvia

Na Fire TV otevřete:

```text
Settings → Content & Discovery → Plugins → Add Repository
```

Vložte raw URL souboru `manifest.json`, repository obnovte a následně zapněte provider **Přehraj.to Premium**.

> [!NOTE]
> Přidání repository samo o sobě provider nezapne. Po načtení manifestu je nutné zapnout také konkrétní provider.

## Přihlášení

V Nuvio otevřete nastavení provideru **Přehraj.to Premium**.

### E-mail a heslo

Výchozí a nejjednodušší možnost:

1. ponechte **Způsob přihlášení → E-mail a heslo (lokálně)**;
2. zadejte e-mail používaný na Přehraj.to;
3. zadejte heslo k Přehraj.to;
4. nastavení uložte.

Údaje nejsou součástí manifestu ani JavaScriptu. Provider je používá pouze pro HTTPS přihlášení přímo na `https://prehraj.to`.

### Session cookie

Pokud nechcete ukládat heslo do Nuvia, můžete použít session cookie:

1. na vlastním počítači se přihlaste na Přehraj.to;
2. v nástrojích pro vývojáře prohlížeče otevřete úložiště cookies pro `https://prehraj.to`;
3. zkopírujte hodnoty `access_token` a případně `refresh_token`;
4. v nastavení provideru zvolte **Session cookie**;
5. vložte hodnotu v tomto formátu:

```text
access_token=HODNOTA; refresh_token=HODNOTA
```

Session cookie je citlivý údaj. Nikomu ji neposílejte a nikdy ji neukládejte do GitHub repozitáře.

## Bezpečnost

Přihlašovací údaje zůstávají v lokálním privátním úložišti aplikace Nuvio na zařízení. Současný Android build je ale ukládá jako prostý text, nikoli do šifrovaného trezoru.

To znamená:

- jiné běžné aplikace k nim bez oprávnění nemají přístup;
- mohou být dostupné na rootnutém nebo kompromitovaném zařízení;
- mohou se objevit v nezabezpečené záloze aplikace;
- současné Nuvio nemusí pole s heslem při zadávání vizuálně maskovat.

Pro Přehraj.to proto používejte unikátní heslo, které nepoužíváte pro e-mail ani jiné služby. Bezpečnější alternativou je dočasná session cookie.

Provider neposílá heslo nebo cookie na TMDB ani na výsledný CDN server a záměrně je nezapisuje do logu.

## Nastavení provideru

| Nastavení | Význam |
|---|---|
| Způsob přihlášení | Lokální e-mail/heslo nebo session cookie |
| E-mail | E-mail Přehraj.to účtu |
| Heslo | Heslo Přehraj.to účtu |
| Session cookie | Alternativní `access_token` a `refresh_token` |
| Přidat i webové kvality | Přidá 720p/1080p zdroje z webového přehrávače |
| Maximum výsledků | Omezuje počet souborů, které provider zpracuje |

Ve výchozím stavu se zobrazují pouze výsledky, u kterých byla rozpoznána aktivní Premium session a Přehraj.to vrátilo download redirect.

## Jak provider pracuje

1. Nuvio zavolá `getStreams(tmdbId, mediaType, season, episode)`.
2. Provider získá český, anglický a původní název z TMDB.
3. Přihlásí se k Přehraj.to nebo použije uloženou session.
4. Ověří stav Premium účtu přes profil.
5. Vyhledá odpovídající soubory na Přehraj.to.
6. U seriálů vyřadí výsledky s nesprávným číslem epizody.
7. Načte video a titulky z nalezených stránek.
8. Vyžádá Premium download redirect a vrátí přímý odkaz Nuviu.

## Ověřený stav

Při vytvoření verze `0.1.1` bylo ověřeno:

- aktuální manifest a `getStreams` API Nuvia;
- `hasSettings`, `onSettings()` a `SCRAPER_SETTINGS`;
- QuickJS HTTP bridge používaný pluginy;
- aktuální Přehraj.to login formulář;
- veřejné vyhledávání a jeho HTML struktura;
- extrakce video kvalit a titulků z aktuální stránky videa;
- syntaxe JavaScriptu a validita manifestu;
- lokální automatické testy parserů.

Parser byl vyzkoušen také nad živě načteným veřejným HTML Přehraj.to a správně našel výsledky vyhledávání, video kvality i titulky.

> [!WARNING]
> Skutečný Premium login a následný Premium download redirect nebyly otestovány s reálným uživatelským účtem. Provider proto zatím není potvrzený jako funkční end-to-end. Přehraj.to může autentizaci nebo HTML kdykoli změnit.

## Řešení problémů

### Repository se nenačte

- zkontrolujte, že URL míří přímo na raw `manifest.json`;
- GitHub repozitář musí být veřejný;
- zkontrolujte větev v URL — obvykle `main`;
- v Nuvio repository obnovte;
- po načtení zapněte samotný provider.

### Provider vždy vrací nula zdrojů

- ověřte TMDB API key v Nuvio;
- znovu zadejte e-mail a heslo;
- zkontrolujte, že Premium účet je aktivní;
- případně obnovte session cookie;
- dočasně zapněte **Přidat i webové kvality**.

Pokud se poté objeví webové kvality, vyhledávání funguje a problém je pravděpodobně v Premium autentizaci nebo download redirectu.

### Filmy fungují, seriály ne

Název souboru na Přehraj.to pravděpodobně neobsahuje rozpoznatelné označení `SxxExx` nebo `1x02`. Přísná kontrola chrání před přehráním nesprávné epizody.

### Odkaz přestal fungovat

Přímé odkazy mohou být časově omezené. Zavřete seznam zdrojů a znovu otevřete detail titulu, aby provider získal čerstvou URL.

## Lokální test

Test parserů lze spustit v Node.js 18 nebo novějším:

```bash
node test/test.js
```

Test nepoužívá žádné přihlašovací údaje ani Premium účet.

## Aktualizace

Po změně `providers/prehrajto.js` zvyšte verzi provideru i repository v `manifest.json`. Následně změny nahrajte na GitHub a v Nuvio repository obnovte.

## Technické zdroje

- [NuvioMobile](https://github.com/NuvioMedia/NuvioMobile)
- [Nuvio manifest model](https://github.com/NuvioMedia/NuvioMobile/blob/cmp-rewrite/composeApp/src/commonMain/kotlin/com/nuvio/app/features/plugins/PluginModels.kt)
- [Nuvio QuickJS bindings](https://github.com/NuvioMedia/NuvioMobile/blob/cmp-rewrite/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/js/JsBindings.kt)
- [Nuvio HTTP bridge](https://github.com/NuvioMedia/NuvioMobile/blob/cmp-rewrite/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/network/FetchBridge.kt)
- [ArchivCZSK Přehraj.to](https://github.com/archivczsk/archivczsk-doplnky/blob/main/plugin_video_prehrajto/prehrajto.py)

## Upozornění

Tento projekt není spojený s Nuvio ani Přehraj.to. Nehostuje, neukládá ani nedistribuuje žádný mediální obsah. Veškerá komunikace probíhá mezi zařízením uživatele a službami, které si uživatel sám nastavil.
