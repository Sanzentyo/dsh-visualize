/**
 * Safari on iOS では JS から haptic を直接起こせない(navigator.vibrate 非対応)。
 * Safari 17.4 の switch 入力はトグル時に haptic を鳴らすので、long-press の
 * 成立時にその trusted click を起こす。tijn.dev/projects/ios-haptics と同じ方式。
 *
 * - hapticTrigger(element): 要素の上にスイッチを透過で載せ、pulse を返す。
 * - pulse(): スイッチの trusted click を起こす(長押しの成立で呼ぶ)。
 *
 * ラベルは要素の上に載るが pointer-events を持たないので、要素の操作
 * (ツールチップ・コントロール・スクロール)を奪わない。
 */

let switchEl = null

/**
 * 要素の上に haptic スイッチを透過で載せる。iOS Safari のみ有効。
 * @param {HTMLElement|undefined|null} element - 長押しの対象。
 * @returns {function(): void} pulse — 長押しの成立時に呼ぶ。
 */
export function hapticTrigger(element) {
  if (element === null || element === undefined || typeof window === 'undefined') return null
  if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return null
  if (element.querySelector(':scope > [data-haptic-trigger]') !== null) return pulse

  const labelEl = document.createElement('label')
  labelEl.setAttribute('data-haptic-trigger', '')
  labelEl.setAttribute('aria-hidden', 'true')
  const labelStyles = {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    touchAction: 'manipulation',
  }
  Object.assign(labelEl.style, labelStyles)
  labelEl.style.setProperty('-webkit-tap-highlight-color', 'transparent')

  // スイッチは指の下に置かない: WebKit はその touchstart を handled にし、
  // スクロールを止める。1x1 で隠し、trusted click だけを起こす。
  switchEl = document.createElement('input')
  switchEl.type = 'checkbox'
  switchEl.setAttribute('switch', '')
  const switchStyles = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '0',
    visibility: 'hidden',
  }
  Object.assign(switchEl.style, switchStyles)
  switchEl.addEventListener('click', event => event.stopPropagation())
  labelEl.append(switchEl)

  if (getComputedStyle(element).position === 'static') element.style.position = 'relative'
  element.insertAdjacentElement('beforeend', labelEl)
  return pulse
}

/**
 * 長押しの成立: スイッチの trusted click を起こし、Safari の haptic を鳴らす。
 */
export function pulse() {
  if (switchEl === null) return
  switchEl.click()
}
