// Run: node apps/web/src/game/_lib/install-guide.check.mjs
import { installGuide } from "./install-guide.ts"

/** @type {(ok: unknown, what: string) => void} */
function check(ok, what) {
  if (!ok) throw new Error(`install guide: ${what}`)
}

const safari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const chromeIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1"
const ipad =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const chromeAndroid =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
const samsung =
  "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"
const firefoxAndroid =
  "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0"
const macSafari =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
const windowsChrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

check(installGuide(safari)?.browser === "Safari", "iPhone Safari")
check(installGuide(chromeIos)?.browser === "this browser", "Chrome on iPhone")
check(installGuide(ipad)?.browser === "Safari", "iPad asking for desktop sites")
check(installGuide(chromeAndroid)?.browser === "Chrome", "Android Chrome")
check(installGuide(samsung)?.browser === "Samsung Internet", "Samsung")
check(installGuide(firefoxAndroid)?.browser === "Firefox", "Android Firefox")
check(installGuide(macSafari) === null, "no guide on a Mac")
check(installGuide(windowsChrome) === null, "no guide on Windows")
check(
  installGuide(safari)?.steps[0]?.icon === "share",
  "iPhone starts at Share"
)
check(
  installGuide(chromeAndroid)?.steps[0]?.icon === "dots",
  "Chrome at its ⋮ menu"
)
check(
  installGuide(samsung)?.steps[0]?.icon === "menu",
  "Samsung at its ☰ menu"
)
