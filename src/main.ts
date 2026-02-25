import './style.css'
import { evaluate, type Mode } from './engine/evaluate'

type LayoutMode = 'basic' | 'scientific'
type ThemeMode = 'dark' | 'light'

type InputType =
  | 'digit'
  | 'operator'
  | 'function'
  | 'constant'
  | 'paren'
  | 'comma'
  | 'dot'
  | 'ans'

type KeyDef = {
  label: string
  aria: string
  input?: string
  action?:
    | 'clear'
    | 'backspace'
    | 'evaluate'
    | 'toggle-sign'
    | 'toggle-angle'
    | 'toggle-layout'
    | 'toggle-theme'
    | 'toggle-orientation'
    | 'smart-paren'
  type?: InputType
  className?: string
}

type State = {
  expression: string
  result: string
  mode: Mode
  layout: LayoutMode
  theme: ThemeMode
  landscapeLock: boolean
  orientationAvailable: boolean
  ans: number
  error: string
  justEvaluated: boolean
}

const THEME_STORAGE_KEY = 'sci-calc-theme'

function supportsOrientationLockApi(): boolean {
  return typeof screen.orientation?.lock === 'function'
}

function isMobileLikeDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 920px)').matches
}

function canUseOrientationControl(): boolean {
  return supportsOrientationLockApi() && isMobileLikeDevice()
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') {
      return saved
    }
  } catch {
    // Ignore storage availability errors and fallback to system preference.
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const state: State = {
  expression: '',
  result: '0',
  mode: 'DEG',
  layout: 'basic',
  theme: getInitialTheme(),
  landscapeLock: false,
  orientationAvailable: canUseOrientationControl(),
  ans: 0,
  error: '',
  justEvaluated: false
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="calculator" id="calculator" data-layout="${state.layout}">
    <header class="top-panel">
      <div class="status-row">
        <button class="toggle mode-toggle" type="button" data-action="toggle-angle" aria-label="角度モード切り替え">
          <span class="toggle-label">ANGLE</span>
          <span class="toggle-pill mode-pill">${state.mode}</span>
        </button>
        <button
          class="toggle layout-toggle"
          type="button"
          data-action="toggle-layout"
          aria-label="関数モード切り替え"
          aria-pressed="false"
        >
          <span class="toggle-label">FUNCTION</span>
          <span class="toggle-pill layout-pill">OFF</span>
        </button>
      </div>
      <div class="status-row preference-row">
        <button class="toggle theme-toggle" type="button" data-action="toggle-theme" aria-label="テーマ切り替え">
          <span class="toggle-label">THEME</span>
          <span class="toggle-pill theme-pill">${state.theme.toUpperCase()}</span>
        </button>
        <button
          class="toggle orientation-toggle"
          type="button"
          data-action="toggle-orientation"
          aria-label="横向き固定切り替え"
          aria-pressed="false"
        >
          <span class="toggle-label">LANDSCAPE</span>
          <span class="toggle-pill orientation-pill">縦</span>
        </button>
      </div>

      <div class="display" aria-live="polite">
        <div class="expression" id="expression"></div>
        <div class="result" id="result">0</div>
        <div class="error" id="error" role="status"></div>
      </div>
      <div class="mode-hint" id="modeHint">通常モード | 角度: ${state.mode}</div>
    </header>

    <section class="keypad">
      <div class="function-grid" id="functionGrid"></div>
      <div class="main-grid" id="mainGrid"></div>
    </section>
  </div>
`

const calculatorEl = app.querySelector<HTMLDivElement>('#calculator')!
const expressionEl = app.querySelector<HTMLDivElement>('#expression')!
const resultEl = app.querySelector<HTMLDivElement>('#result')!
const errorEl = app.querySelector<HTMLDivElement>('#error')!
const modeHintEl = app.querySelector<HTMLDivElement>('#modeHint')!
const modeToggleBtn = app.querySelector<HTMLButtonElement>('[data-action="toggle-angle"]')!
const modePillEl = modeToggleBtn.querySelector<HTMLSpanElement>('.mode-pill')!
const layoutToggleBtn = app.querySelector<HTMLButtonElement>('[data-action="toggle-layout"]')!
const layoutPillEl = layoutToggleBtn.querySelector<HTMLSpanElement>('.layout-pill')!
const themeToggleBtn = app.querySelector<HTMLButtonElement>('[data-action="toggle-theme"]')!
const themePillEl = themeToggleBtn.querySelector<HTMLSpanElement>('.theme-pill')!
const orientationToggleBtn = app.querySelector<HTMLButtonElement>('[data-action="toggle-orientation"]')!
const orientationPillEl = orientationToggleBtn.querySelector<HTMLSpanElement>('.orientation-pill')!

const functionGrid = app.querySelector<HTMLDivElement>('#functionGrid')!
const mainGrid = app.querySelector<HTMLDivElement>('#mainGrid')!

const functionKeys: KeyDef[] = [
  { label: 'sin', aria: 'sin', input: 'sin(', type: 'function', className: 'key function-key' },
  { label: 'cos', aria: 'cos', input: 'cos(', type: 'function', className: 'key function-key' },
  { label: 'tan', aria: 'tan', input: 'tan(', type: 'function', className: 'key function-key' },
  { label: 'ln', aria: 'ln', input: 'ln(', type: 'function', className: 'key function-key' },
  { label: 'log', aria: 'log', input: 'log(', type: 'function', className: 'key function-key' },
  { label: 'sqrt', aria: 'square root', input: 'sqrt(', type: 'function', className: 'key function-key' },
  { label: 'exp', aria: 'exp', input: 'exp(', type: 'function', className: 'key function-key' },
  { label: 'abs', aria: 'absolute', input: 'abs(', type: 'function', className: 'key function-key' },
  { label: 'xʸ', aria: 'power', input: '^', type: 'operator', className: 'key function-key operator-lite' },
  { label: 'asin', aria: 'asin', input: 'asin(', type: 'function', className: 'key function-key' },
  { label: 'acos', aria: 'acos', input: 'acos(', type: 'function', className: 'key function-key' },
  { label: 'atan', aria: 'atan', input: 'atan(', type: 'function', className: 'key function-key' },
  { label: 'min', aria: 'min', input: 'min(', type: 'function', className: 'key function-key' },
  { label: 'max', aria: 'max', input: 'max(', type: 'function', className: 'key function-key' },
  { label: 'π', aria: 'pi', input: 'pi', type: 'constant', className: 'key function-key' },
  { label: 'e', aria: 'e', input: 'e', type: 'constant', className: 'key function-key' },
  { label: 'ANS', aria: 'ans', input: 'ans', type: 'ans', className: 'key function-key' },
  { label: ',', aria: 'comma', input: ',', type: 'comma', className: 'key function-key' }
]

const mainKeys: KeyDef[] = [
  { label: 'AC', aria: 'all clear', action: 'clear', className: 'key utility' },
  { label: '⌫', aria: 'backspace', action: 'backspace', className: 'key utility' },
  { label: '()', aria: 'smart parenthesis', action: 'smart-paren', className: 'key utility' },
  { label: '÷', aria: 'divide', input: '/', type: 'operator', className: 'key operator' },
  { label: '7', aria: '7', input: '7', type: 'digit', className: 'key digit' },
  { label: '8', aria: '8', input: '8', type: 'digit', className: 'key digit' },
  { label: '9', aria: '9', input: '9', type: 'digit', className: 'key digit' },
  { label: '×', aria: 'multiply', input: '*', type: 'operator', className: 'key operator' },
  { label: '4', aria: '4', input: '4', type: 'digit', className: 'key digit' },
  { label: '5', aria: '5', input: '5', type: 'digit', className: 'key digit' },
  { label: '6', aria: '6', input: '6', type: 'digit', className: 'key digit' },
  { label: '-', aria: 'minus', input: '-', type: 'operator', className: 'key operator' },
  { label: '1', aria: '1', input: '1', type: 'digit', className: 'key digit' },
  { label: '2', aria: '2', input: '2', type: 'digit', className: 'key digit' },
  { label: '3', aria: '3', input: '3', type: 'digit', className: 'key digit' },
  { label: '+', aria: 'plus', input: '+', type: 'operator', className: 'key operator' },
  { label: '+/-', aria: 'toggle sign', action: 'toggle-sign', className: 'key utility' },
  { label: '0', aria: '0', input: '0', type: 'digit', className: 'key digit' },
  { label: '.', aria: 'decimal point', input: '.', type: 'dot', className: 'key digit' },
  { label: '=', aria: 'equals', action: 'evaluate', className: 'key equals' }
]

function buildKeys(container: HTMLElement, keys: KeyDef[]) {
  container.innerHTML = ''
  for (const key of keys) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = key.className ?? 'key'
    button.textContent = key.label
    button.setAttribute('aria-label', key.aria)

    if (key.input) {
      button.dataset.input = key.input
      button.dataset.type = key.type ?? 'digit'
    }
    if (key.action) {
      button.dataset.action = key.action
    }

    container.appendChild(button)
  }
}

buildKeys(functionGrid, functionKeys)
buildKeys(mainGrid, mainKeys)

function formatExpression(expr: string): string {
  if (!expr.trim()) return '0'
  return expr
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\bans\b/gi, 'ANS')
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const normalized = Object.is(value, -0) ? 0 : value
  const abs = Math.abs(normalized)
  if (abs === 0) return '0'
  const useExp = abs >= 1e12 || abs < 1e-9
  const raw = useExp ? normalized.toExponential(8) : normalized.toPrecision(12)
  return trimNumberString(raw)
}

function trimNumberString(value: string): string {
  if (value.includes('e')) {
    const [mantissa, exp] = value.split('e')
    return `${trimNumberString(mantissa)}e${exp}`
  }
  if (!value.includes('.')) return value
  return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function updateDisplay() {
  document.documentElement.dataset.theme = state.theme
  const formatted = formatExpression(state.expression)
  const openCount = countOpenParentheses(state.expression)
  if (openCount > 0) {
    expressionEl.innerHTML = escapeHtml(formatted) + '<span class="auto-paren">' + ')'.repeat(openCount) + '</span>'
  } else {
    expressionEl.textContent = formatted
  }

  if (state.error) {
    resultEl.textContent = 'Error'
    errorEl.textContent = state.error
  } else {
    resultEl.textContent = state.result
    errorEl.textContent = ''
  }

  modePillEl.textContent = state.mode

  const scientificEnabled = state.layout === 'scientific'
  layoutPillEl.textContent = scientificEnabled ? 'ON' : 'OFF'
  layoutToggleBtn.classList.toggle('is-active', scientificEnabled)
  layoutToggleBtn.setAttribute('aria-pressed', scientificEnabled ? 'true' : 'false')
  calculatorEl.dataset.layout = state.layout

  themePillEl.textContent = state.theme.toUpperCase()
  themeToggleBtn.classList.toggle('is-active', state.theme === 'light')

  const orientationLabel = state.landscapeLock ? '横' : '縦'
  orientationPillEl.textContent = orientationLabel
  orientationToggleBtn.classList.toggle('is-active', state.landscapeLock)
  orientationToggleBtn.setAttribute('aria-pressed', state.landscapeLock ? 'true' : 'false')
  orientationToggleBtn.disabled = !state.orientationAvailable
  orientationToggleBtn.setAttribute('aria-disabled', state.orientationAvailable ? 'false' : 'true')

  modeHintEl.textContent = scientificEnabled
    ? `関数モード | 角度: ${state.mode} | 画面: ${orientationLabel}`
    : `通常モード | 角度: ${state.mode} | 画面: ${orientationLabel}`
}

function clearAll() {
  state.expression = ''
  state.result = '0'
  state.error = ''
  state.justEvaluated = false
  updateDisplay()
}

function backspace() {
  if (state.justEvaluated) {
    state.expression = ''
    state.justEvaluated = false
  } else {
    state.expression = state.expression.slice(0, -1)
  }
  state.error = ''
  updateDisplay()
}

function toggleAngleMode() {
  state.mode = state.mode === 'DEG' ? 'RAD' : 'DEG'
  updateDisplay()
}

function toggleLayoutMode() {
  state.layout = state.layout === 'basic' ? 'scientific' : 'basic'
  updateDisplay()
}

function toggleThemeMode() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_STORAGE_KEY, state.theme)
  } catch {
    // Ignore storage availability errors.
  }
  updateDisplay()
}

async function lockLandscape(): Promise<boolean> {
  if (!state.orientationAvailable) {
    return false
  }

  try {
    await screen.orientation.lock('landscape')
    return true
  } catch {
    if (document.fullscreenElement || typeof document.documentElement.requestFullscreen !== 'function') {
      return false
    }
    try {
      await document.documentElement.requestFullscreen()
      await screen.orientation.lock('landscape')
      return true
    } catch {
      return false
    }
  }
}

async function unlockLandscape() {
  try {
    if (typeof screen.orientation?.unlock === 'function') {
      screen.orientation.unlock()
    }
  } catch {
    // Ignore unlock errors.
  }
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    try {
      await document.exitFullscreen()
    } catch {
      // Ignore fullscreen exit errors.
    }
  }
}

async function toggleOrientationLockMode() {
  if (!state.orientationAvailable) {
    state.landscapeLock = false
    updateDisplay()
    return
  }

  if (state.landscapeLock) {
    await unlockLandscape()
    state.landscapeLock = false
    updateDisplay()
    return
  }

  const locked = await lockLandscape()
  state.landscapeLock = locked
  updateDisplay()
}

async function initializeOrientationMode() {
  if (!state.orientationAvailable) {
    state.landscapeLock = false
    updateDisplay()
    return
  }

  const locked = await lockLandscape()
  state.landscapeLock = locked
  updateDisplay()
}

function toggleSign() {
  state.error = ''
  if (state.justEvaluated) {
    state.expression = state.result
    state.justEvaluated = false
  }

  const expr = state.expression
  if (!expr) {
    state.expression = '-'
    updateDisplay()
    return
  }

  const match = expr.match(/-?\d*\.?\d+(?:e[+-]?\d+)?$/i)
  if (!match) {
    state.expression = expr + '-'
    updateDisplay()
    return
  }

  const number = match[0]
  const start = match.index ?? expr.length - number.length
  const before = expr.slice(0, start)
  const hasUnaryMinus = number.startsWith('-') && (before === '' || /[+\-*/^(,]$/.test(before))

  state.expression = hasUnaryMinus ? before + number.slice(1) : before + '-' + number
  updateDisplay()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function endsWithValue(expr: string): boolean {
  const trimmed = expr.trimEnd()
  if (!trimmed) return false
  return /[\d.)πa-z]$/i.test(trimmed)
}

function shouldAddImplicitMultiply(input: string, type: InputType): boolean {
  if (!endsWithValue(state.expression)) return false
  if (type === 'function' || type === 'constant' || type === 'ans') return true
  return type === 'paren' && input === '('
}

function handleInput(input: string, type: InputType) {
  if (state.error) {
    state.error = ''
  }

  if (state.justEvaluated) {
    if (type === 'operator') {
      state.expression = `ans${input}`
    } else if (type === 'function') {
      state.expression = `${input}ans)`
    } else {
      state.expression = input
    }
    state.justEvaluated = false
    updateDisplay()
    return
  }

  const token = shouldAddImplicitMultiply(input, type) ? `*${input}` : input
  state.expression += token
  updateDisplay()
}

function countOpenParentheses(expr: string): number {
  let balance = 0
  for (const ch of expr) {
    if (ch === '(') {
      balance += 1
      continue
    }
    if (ch === ')' && balance > 0) {
      balance -= 1
    }
  }
  return balance
}

function insertSmartParenthesis() {
  if (state.error) {
    state.error = ''
  }
  if (state.justEvaluated) {
    state.expression = ''
    state.justEvaluated = false
  }

  const trimmed = state.expression.trimEnd()
  const lastChar = trimmed.slice(-1)
  const balance = countOpenParentheses(trimmed)
  const canClose = balance > 0 && /[\d.)πa-z]$/i.test(lastChar)

  if (canClose) {
    state.expression += ')'
    updateDisplay()
    return
  }

  const needsMultiply = /[\d.)πa-z]$/i.test(lastChar)
  state.expression += needsMultiply ? '*(' : '('
  updateDisplay()
}

function evaluateExpression() {
  if (!state.expression.trim()) return
  const result = evaluate(state.expression, { mode: state.mode, ans: state.ans })

  if (result.ok) {
    const formatted = formatNumber(result.value)
    state.result = formatted
    state.ans = result.value
    state.error = ''
    state.justEvaluated = true
  } else {
    state.error = result.error
    state.justEvaluated = false
  }

  updateDisplay()
}

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('button')
  if (!target) return

  const action = target.dataset.action as KeyDef['action'] | undefined
  const input = target.dataset.input
  const type = target.dataset.type as InputType | undefined

  if (action === 'clear') {
    clearAll()
    return
  }
  if (action === 'backspace') {
    backspace()
    return
  }
  if (action === 'evaluate') {
    evaluateExpression()
    return
  }
  if (action === 'toggle-sign') {
    toggleSign()
    return
  }
  if (action === 'toggle-angle') {
    toggleAngleMode()
    return
  }
  if (action === 'toggle-layout') {
    toggleLayoutMode()
    return
  }
  if (action === 'toggle-theme') {
    toggleThemeMode()
    return
  }
  if (action === 'toggle-orientation') {
    void toggleOrientationLockMode()
    return
  }
  if (action === 'smart-paren') {
    insertSmartParenthesis()
    return
  }
  if (input && type) {
    handleInput(input, type)
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === '=') {
    event.preventDefault()
    evaluateExpression()
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    backspace()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    clearAll()
    return
  }

  const key = event.key
  if (/^[0-9]$/.test(key)) {
    handleInput(key, 'digit')
    return
  }
  if (key === '.') {
    handleInput('.', 'dot')
    return
  }
  if (['+', '-', '*', '/', '^', '(', ')', ','].includes(key)) {
    const type: InputType = key === '(' || key === ')' ? 'paren' : key === ',' ? 'comma' : 'operator'
    handleInput(key, type)
  }
})

updateDisplay()
void initializeOrientationMode()
