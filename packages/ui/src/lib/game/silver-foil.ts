import * as THREE from "three"

export const SILVER_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

// Silver foil: brushed metal, a touch dimmer along the middle of `uv`, with
// rainbow reflections sliding across it. The pack's lining and the NEW badges.
export const SILVER_FOIL = /* glsl */ `
  vec3 silverFoil( vec2 uv, float time ) {
    float across = abs( uv.y - 0.5 ) * 2.0;
    float brushed = 0.04 * sin( uv.x * 420.0 + sin( uv.x * 37.0 ) * 3.0 );
    vec3 silver = mix( vec3( 0.7, 0.72, 0.8 ), vec3( 0.97, 0.97, 1.0 ), across * across ) + brushed;
    vec3 tint = 0.6 + 0.4 * cos( 6.2832 * ( uv.x * 1.3 + uv.y * 0.5 - time * 0.15 + vec3( 0.0, 0.333, 0.667 ) ) );
    float band = pow( 0.5 + 0.5 * sin( uv.x * 11.0 - uv.y * 5.0 - time * 1.4 ), 6.0 );
    float glint = pow( 0.5 + 0.5 * sin( uv.x * 27.0 + uv.y * 9.0 + time * 0.9 ), 24.0 );
    return min( silver * mix( vec3( 0.85 ), vec3( 1.0 ), tint ) + 0.45 * band * tint + 0.5 * glint, 1.0 );
  }
`

export const SILVER_FRAGMENT = /* glsl */ `
  uniform float time;
  varying vec2 vUv;
  ${SILVER_FOIL}
  void main() {
    gl_FragColor = vec4( silverFoil( vUv, time ), 1.0 );
  }
`

// The silver foil as a still image for CSS (--silver-foil), drawn once on
// `renderer` in idle time (the readback and PNG encoding take a weak phone a
// second) and kept for later visits; the CSS has a plain silver until then.
const FOIL_KEY = "musi:silver-foil:1"
export function showSilverFoil(renderer: THREE.WebGLRenderer) {
  const root = document.documentElement
  if (root.style.getPropertyValue("--silver-foil")) return
  const kept = localStorage.getItem(FOIL_KEY)
  if (kept) {
    root.style.setProperty("--silver-foil", `url(${kept})`)
    return
  }
  // Safari has no requestIdleCallback.
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => drawSilverFoil(renderer), { timeout: 5000 })
  } else setTimeout(() => drawSilverFoil(renderer), 2000)
}

function drawSilverFoil(renderer: THREE.WebGLRenderer) {
  const root = document.documentElement
  if (root.style.getPropertyValue("--silver-foil")) return
  if (renderer.getContext().isContextLost()) return
  const size = renderer.getSize(new THREE.Vector2())
  const ratio = renderer.getPixelRatio()
  renderer.setPixelRatio(1)
  renderer.setSize(240, 104, false)
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: SILVER_VERTEX,
    fragmentShader: SILVER_FRAGMENT,
  })
  renderer.render(
    new THREE.Scene().add(new THREE.Mesh(geometry, material)),
    new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
  )
  const image = renderer.domElement.toDataURL()
  root.style.setProperty("--silver-foil", `url(${image})`)
  try {
    localStorage.setItem(FOIL_KEY, image)
  } catch {
    // Full or blocked storage: it's drawn again next visit.
  }
  renderer.setPixelRatio(ratio)
  renderer.setSize(size.x, size.y, false)
  geometry.dispose()
  material.dispose()
}
