import './style.css'
import { evaluate, type Mode } from './engine/evaluate'

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
  action?: 'clear' | 'backspace' | 'evaluate' | 'toggle-sign' | 'toggle-mode'
  type?: InputType
  className?: string
}

type State = {
  expression: string
  result: string
  mode: Mode
  ans: number
  error: string
  justEvaluated: boolean
}

const state: State = {
  expression: '',
  result: '0',
  mode: 'DEG',
  ans: 0,
  error: '',
  justEvaluated: false
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="calculator">
    <header class="top-panel">
      <div class="brand-row">
        <div class="brand" role="img" aria-label="Sci-Calc logo">
          <span class="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="presentation">
              <defs>
                <linearGradient id="logoOrb" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#ffb36b" />
                  <stop offset="55%" stop-color="#ff7a59" />
                  <stop offset="100%" stop-color="#1f8a70" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="22" fill="url(#logoOrb)" opacity="0.18" />
              <circle cx="32" cy="32" r="18" fill="none" stroke="url(#logoOrb)" stroke-width="3" />
              <path
                d="M20 38c6.2 4.6 15.8 4.6 22 0M24 26l8 14 8-14"
                fill="none"
                stroke="#1f221e"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="32" cy="26" r="3.5" fill="#1f221e" />
            </svg>
          </span>
          <div class="brand-text">
            <span class="brand-title">Sci-Calc</span>
            <span class="brand-sub">Precision Instruments</span>
          </div>
        </div>
        <span class="brand-tag">Field Ready</span>
      </div>
      <div class="mode-row">
        <button class="mode-toggle" type="button" data-action="toggle-mode" aria-label="角度モード切り替え">
          <span class="mode-pill">${state.mode}</span>
          <span class="mode-label">Angle</span>
        </button>
        <div class="mode-hint" id="modeHint">入力: ${state.mode}</div>
      </div>
      <div class="display" aria-live="polite">
        <div class="expression" id="expression"></div>
        <div class="result" id="result">0</div>
        <div class="error" id="error" role="status"></div>
      </div>
    </header>

    <section class="keypad">
      <div class="function-grid" id="functionGrid"></div>
      <div class="main-grid" id="mainGrid"></div>
    </section>
  </div>
`

const expressionEl = app.querySelector<HTMLDivElement>('#expression')!
const resultEl = app.querySelector<HTMLDivElement>('#result')!
const errorEl = app.querySelector<HTMLDivElement>('#error')!
const modeHintEl = app.querySelector<HTMLDivElement>('#modeHint')!
const modeToggleBtn = app.querySelector<HTMLButtonElement>('[data-action="toggle-mode"]')!
const modePillEl = modeToggleBtn.querySelector<HTMLSpanElement>('.mode-pill')!

const functionGrid = app.querySelector<HTMLDivElement>('#functionGrid')!
const mainGrid = app.querySelector<HTMLDivElement>('#mainGrid')!

const functionKeys: KeyDef[] = [
  { label: 'sin', aria: 'sin', input: 'sin(', type: 'function' },
  { label: 'cos', aria: 'cos', input: 'cos(', type: 'function' },
  { label: 'tan', aria: 'tan', input: 'tan(', type: 'function' },
  { label: 'asin', aria: 'asin', input: 'asin(', type: 'function' },
  { label: 'acos', aria: 'acos', input: 'acos(', type: 'function' },
  { label: 'atan', aria: 'atan', input: 'atan(', type: 'function' },
  { label: 'log', aria: 'log', input: 'log(', type: 'function' },
  { label: 'ln', aria: 'ln', input: 'ln(', type: 'function' },
  { label: 'sqrt', aria: 'sqrt', input: 'sqrt(', type: 'function' },
  { label: 'abs', aria: 'abs', input: 'abs(', type: 'function' },
  { label: 'exp', aria: 'exp', input: 'exp(', type: 'function' },
  { label: 'min', aria: 'min', input: 'min(', type: 'function' },
  { label: 'max', aria: 'max', input: 'max(', type: 'function' },
  { label: 'π', aria: 'pi', input: 'pi', type: 'constant' },
  { label: 'e', aria: 'e', input: 'e', type: 'constant' }
]

const mainKeys: KeyDef[] = [
  { label: 'AC', aria: 'all clear', action: 'clear', className: 'key action' },
  { label: '⌫', aria: 'backspace', action: 'backspace', className: 'key action' },
  { label: '(', aria: 'left parenthesis', input: '(', type: 'paren' },
  { label: ')', aria: 'right parenthesis', input: ')', type: 'paren' },
  { label: '7', aria: '7', input: '7', type: 'digit' },
  { label: '8', aria: '8', input: '8', type: 'digit' },
  { label: '9', aria: '9', input: '9', type: 'digit' },
  { label: '÷', aria: 'divide', input: '/', type: 'operator', className: 'key operator' },
  { label: '4', aria: '4', input: '4', type: 'digit' },
  { label: '5', aria: '5', input: '5', type: 'digit' },
  { label: '6', aria: '6', input: '6', type: 'digit' },
  { label: '×', aria: 'multiply', input: '*', type: 'operator', className: 'key operator' },
  { label: '1', aria: '1', input: '1', type: 'digit' },
  { label: '2', aria: '2', input: '2', type: 'digit' },
  { label: '3', aria: '3', input: '3', type: 'digit' },
  { label: '-', aria: 'minus', input: '-', type: 'operator', className: 'key operator' },
  { label: '0', aria: '0', input: '0', type: 'digit' },
  { label: '.', aria: 'decimal point', input: '.', type: 'dot' },
  { label: '+/-', aria: 'toggle sign', action: 'toggle-sign', className: 'key action' },
  { label: '+', aria: 'plus', input: '+', type: 'operator', className: 'key operator' },
  { label: 'ANS', aria: 'ans', input: 'ans', type: 'ans', className: 'key accent' },
  { label: '^', aria: 'power', input: '^', type: 'operator', className: 'key operator' },
  { label: ',', aria: 'comma', input: ',', type: 'comma' },
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
  expressionEl.textContent = formatExpression(state.expression)
  if (state.error) {
    resultEl.textContent = 'Error'
    errorEl.textContent = state.error
  } else {
    resultEl.textContent = state.result
    errorEl.textContent = ''
  }
  modePillEl.textContent = state.mode
  modeHintEl.textContent = `入力: ${state.mode}`
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

function toggleMode() {
  state.mode = state.mode === 'DEG' ? 'RAD' : 'DEG'
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

function handleInput(input: string, type: InputType) {
  if (state.error) {
    state.error = ''
  }

  if (state.justEvaluated) {
    if (type === 'operator') {
      state.expression = `ans${input}`
    } else {
      state.expression = input
    }
    state.justEvaluated = false
    updateDisplay()
    return
  }

  state.expression += input
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
  if (action === 'toggle-mode') {
    toggleMode()
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
