// How to put Holotrack on a phone's Home Screen, by the browser it's open in:
// iOS only adds from Safari's Share menu (other iOS browsers send you there,
// though newer ones have a Share button of their own), Android's browsers
// from their menu. Null on a computer, or once it already runs as an app.
// Each step names the icon the browser shows for it.
export type StepIcon = "share" | "add" | "dots" | "menu" | "install"

export type InstallGuide = {
  browser: string
  steps: ReadonlyArray<{ icon: StepIcon; text: string }>
}

export function installGuide(userAgent: string): InstallGuide | null {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    // iPadOS asks for desktop sites: a Mac with a touch screen is an iPad.
    (/Macintosh/.test(userAgent) && /Mobile\//.test(userAgent))
  if (ios) {
    const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)
    return {
      browser: safari ? "Safari" : "this browser",
      steps: [
        {
          icon: "share",
          text: safari
            ? "Tap Share at the bottom of the screen"
            : "Tap Share, in the address bar or the menu",
        },
        { icon: "add", text: "Scroll down, tap Add to Home Screen" },
        { icon: "install", text: "Tap Add" },
      ],
    }
  }
  if (!/Android/.test(userAgent)) return null
  if (/SamsungBrowser/.test(userAgent)) {
    return {
      browser: "Samsung Internet",
      steps: [
        { icon: "menu", text: "Tap the menu at the bottom" },
        { icon: "add", text: "Tap Add page to, then Home screen" },
        { icon: "install", text: "Tap Add" },
      ],
    }
  }
  if (/Firefox/.test(userAgent)) {
    return {
      browser: "Firefox",
      steps: [
        { icon: "dots", text: "Tap the menu" },
        { icon: "add", text: "Tap Add to Home screen" },
        { icon: "install", text: "Tap Add" },
      ],
    }
  }
  return {
    browser: "Chrome",
    steps: [
      { icon: "dots", text: "Tap the menu at the top right" },
      { icon: "add", text: "Tap Add to Home screen or Install app" },
      { icon: "install", text: "Tap Install" },
    ],
  }
}
