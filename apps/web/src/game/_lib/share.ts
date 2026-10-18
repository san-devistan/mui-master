// Shares a PNG through the device's share sheet, with no message, or saves it
// where there's none. Call it from the tap: the sheet needs that gesture.
// `name` becomes the file's name.
export async function sharePicture(blob: Blob, name: string) {
  const fileName = `${name.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`
  const file = new File([blob], fileName, { type: "image/png" })
  if (navigator.canShare?.({ files: [file] })) {
    // A dismissed sheet rejects; nothing to do.
    await navigator.share({ files: [file] }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
