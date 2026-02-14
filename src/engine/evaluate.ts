export type Mode = 'DEG' | 'RAD'

export type EvalContext = {
  mode: Mode
  ans?: number
}

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'function'; name: string }
  | { type: 'variable'; name: string }

type RpnToken =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: string }
  | { type: 'function'; name: string; argCount: number }
  | { type: 'variable'; name: string }

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'log',
  'ln',
  'sqrt',
  'abs',
  'exp',
  'min',
  'max'
])

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E
}

const PRECEDENCE: Record<string, number> = {
  '^': 4,
  'u+': 3,
  'u-': 3,
  '*': 2,
  '/': 2,
  '+': 1,
  '-': 1
}

const RIGHT_ASSOC = new Set(['^', 'u+', 'u-'])

export function evaluate(expression: string, context: EvalContext): EvalResult {
  try {
    const tokens = tokenize(expression)
    if (tokens.length === 0) {
      return { ok: false, error: '空の式です' }
    }
    const rpn = toRpn(tokens)
    const value = evalRpn(rpn, context)
    if (!Number.isFinite(value)) {
      return { ok: false, error: '計算エラー' }
    }
    return { ok: true, value }
  } catch (error) {
    const message = error instanceof Error ? error.message : '計算エラー'
    return { ok: false, error: message }
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (isWhitespace(ch)) {
      i += 1
      continue
    }

    if (isDigit(ch) || ch === '.') {
      const start = i
      let hasDigit = false
      let hasDot = false

      while (i < input.length) {
        const c = input[i]
        if (isDigit(c)) {
          hasDigit = true
          i += 1
          continue
        }
        if (c === '.') {
          if (hasDot) break
          hasDot = true
          i += 1
          continue
        }
        break
      }

      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        let j = i + 1
        if (input[j] === '+' || input[j] === '-') {
          j += 1
        }
        const expStart = j
        while (j < input.length && isDigit(input[j])) {
          j += 1
        }
        if (j > expStart) {
          i = j
        }
      }

      const raw = input.slice(start, i)
      if (!hasDigit) {
        throw new Error('数値の形式が不正です')
      }
      const value = Number.parseFloat(raw)
      if (Number.isNaN(value)) {
        throw new Error('数値の形式が不正です')
      }
      tokens.push({ type: 'number', value })
      continue
    }

    if (isAlpha(ch)) {
      const start = i
      while (i < input.length && isAlpha(input[i])) {
        i += 1
      }
      const name = input.slice(start, i).toLowerCase()
      if (FUNCTIONS.has(name)) {
        tokens.push({ type: 'function', name })
        continue
      }
      if (name in CONSTANTS) {
        tokens.push({ type: 'number', value: CONSTANTS[name] })
        continue
      }
      if (name === 'ans') {
        tokens.push({ type: 'variable', name })
        continue
      }
      throw new Error(`未知のトークン: ${name}`)
    }

    if (ch === 'π') {
      tokens.push({ type: 'number', value: CONSTANTS.pi })
      i += 1
      continue
    }

    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i += 1
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i += 1
      continue
    }

    if (isOperator(ch)) {
      tokens.push({ type: 'operator', value: normalizeOperator(ch) })
      i += 1
      continue
    }

    throw new Error(`未知の文字: ${ch}`)
  }

  return tokens
}

function toRpn(tokens: Token[]): RpnToken[] {
  const output: RpnToken[] = []
  const stack: Token[] = []
  const argStack: Array<number | null> = []
  let lastType: 'start' | 'value' | 'operator' | 'lparen' | 'rparen' | 'comma' | 'function' =
    'start'

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'variable') {
      output.push(token)
      lastType = 'value'
      continue
    }

    if (token.type === 'function') {
      stack.push(token)
      lastType = 'function'
      continue
    }

    if (token.type === 'comma') {
      if (argStack.length === 0 || argStack[argStack.length - 1] === null) {
        throw new Error('カンマの位置が不正です')
      }
      if (lastType === 'comma' || lastType === 'lparen') {
        throw new Error('関数の引数が不足しています')
      }
      while (stack.length > 0 && stack[stack.length - 1].type !== 'paren') {
        const popped = stack.pop()!
        output.push(toRpnToken(popped))
      }
      argStack[argStack.length - 1]! += 1
      lastType = 'comma'
      continue
    }

    if (token.type === 'paren' && token.value === '(') {
      stack.push(token)
      if (lastType === 'function') {
        argStack.push(0)
      } else {
        argStack.push(null)
      }
      lastType = 'lparen'
      continue
    }

    if (token.type === 'paren' && token.value === ')') {
      if (lastType === 'comma' || lastType === 'lparen') {
        throw new Error('関数の引数が不足しています')
      }
      while (stack.length > 0 && stack[stack.length - 1].type !== 'paren') {
        const popped = stack.pop()!
        output.push(toRpnToken(popped))
      }
      if (stack.length === 0) {
        throw new Error('括弧が対応していません')
      }
      stack.pop()
      const argCount = argStack.pop()
      if (argCount !== null) {
        const funcToken = stack.pop()
        if (!funcToken || funcToken.type !== 'function') {
          throw new Error('関数の構文が不正です')
        }
        output.push({ type: 'function', name: funcToken.name, argCount: argCount + 1 })
      }
      lastType = 'rparen'
      continue
    }

    if (token.type === 'operator') {
      let op = token.value
      let isUnary = false
      if (
        (op === '+' || op === '-') &&
        (lastType === 'start' || lastType === 'operator' || lastType === 'lparen' || lastType === 'comma')
      ) {
        op = op === '+' ? 'u+' : 'u-'
        isUnary = true
      }

      if (!isUnary) {
        while (stack.length > 0) {
          const top = stack[stack.length - 1]
          if (top.type !== 'operator') break
          const topOp = top.value
          const shouldPop = RIGHT_ASSOC.has(op)
            ? PRECEDENCE[op] < PRECEDENCE[topOp]
            : PRECEDENCE[op] <= PRECEDENCE[topOp]
          if (!shouldPop) break
          output.push(toRpnToken(stack.pop()!))
        }
      }
      stack.push({ type: 'operator', value: op })
      lastType = 'operator'
      continue
    }
  }

  if (lastType === 'operator' || lastType === 'comma' || lastType === 'lparen' || lastType === 'function') {
    throw new Error('式の構文が不正です')
  }

  while (stack.length > 0) {
    const token = stack.pop()!
    if (token.type === 'paren') {
      throw new Error('括弧が対応していません')
    }
    output.push(toRpnToken(token))
  }

  return output
}

function toRpnToken(token: Token): RpnToken {
  if (token.type === 'number' || token.type === 'operator' || token.type === 'variable') {
    return token
  }
  if (token.type === 'function') {
    return { type: 'function', name: token.name, argCount: 1 }
  }
  throw new Error('トークン変換エラー')
}

function evalRpn(tokens: RpnToken[], context: EvalContext): number {
  const stack: number[] = []

  for (const token of tokens) {
    if (token.type === 'number') {
      stack.push(token.value)
      continue
    }
    if (token.type === 'variable') {
      if (token.name === 'ans') {
        if (context.ans === undefined) {
          throw new Error('ANSが未定義です')
        }
        stack.push(context.ans)
        continue
      }
      throw new Error(`未知の変数: ${token.name}`)
    }
    if (token.type === 'operator') {
      applyOperator(stack, token.value)
      continue
    }
    if (token.type === 'function') {
      applyFunction(stack, token, context)
      continue
    }
  }

  if (stack.length !== 1) {
    throw new Error('式の評価に失敗しました')
  }

  return stack[0]
}

function applyOperator(stack: number[], op: string) {
  if (op === 'u+' || op === 'u-') {
    const value = stack.pop()
    if (value === undefined) throw new Error('単項演算子の引数がありません')
    stack.push(op === 'u-' ? -value : value)
    return
  }

  const right = stack.pop()
  const left = stack.pop()
  if (left === undefined || right === undefined) {
    throw new Error('演算子の引数が不足しています')
  }

  switch (op) {
    case '+':
      stack.push(left + right)
      return
    case '-':
      stack.push(left - right)
      return
    case '*':
      stack.push(left * right)
      return
    case '/':
      if (right === 0) throw new Error('ゼロ除算です')
      stack.push(left / right)
      return
    case '^':
      stack.push(Math.pow(left, right))
      return
    default:
      throw new Error(`未知の演算子: ${op}`)
  }
}

function applyFunction(stack: number[], token: { name: string; argCount: number }, context: EvalContext) {
  const { name, argCount } = token
  const args = pullArgs(stack, argCount)

  const mode = context.mode
  const toRadians = (value: number) => (mode === 'DEG' ? (value * Math.PI) / 180 : value)
  const fromRadians = (value: number) => (mode === 'DEG' ? (value * 180) / Math.PI : value)
  const clampUnitRange = (value: number) => Math.min(1, Math.max(-1, value))
  const ensureInverseTrigDomain = (value: number) => {
    const epsilon = 1e-12
    if (value < -1 - epsilon || value > 1 + epsilon) {
      throw new Error(`${name}の引数は-1から1の範囲です`)
    }
    return clampUnitRange(value)
  }

  switch (name) {
    case 'sin':
      ensureArity(name, argCount, 1)
      stack.push(Math.sin(toRadians(args[0])))
      return
    case 'cos':
      ensureArity(name, argCount, 1)
      stack.push(Math.cos(toRadians(args[0])))
      return
    case 'tan':
      ensureArity(name, argCount, 1)
      stack.push(Math.tan(toRadians(args[0])))
      return
    case 'asin':
      ensureArity(name, argCount, 1)
      stack.push(fromRadians(Math.asin(ensureInverseTrigDomain(args[0]))))
      return
    case 'acos':
      ensureArity(name, argCount, 1)
      stack.push(fromRadians(Math.acos(ensureInverseTrigDomain(args[0]))))
      return
    case 'atan':
      ensureArity(name, argCount, 1)
      stack.push(fromRadians(Math.atan(args[0])))
      return
    case 'log':
      ensureArity(name, argCount, 1)
      if (args[0] <= 0) throw new Error('logの引数は正の値のみです')
      stack.push(Math.log(args[0]) / Math.LN10)
      return
    case 'ln':
      ensureArity(name, argCount, 1)
      if (args[0] <= 0) throw new Error('lnの引数は正の値のみです')
      stack.push(Math.log(args[0]))
      return
    case 'sqrt':
      ensureArity(name, argCount, 1)
      if (args[0] < 0) throw new Error('平方根の引数が負です')
      stack.push(Math.sqrt(args[0]))
      return
    case 'abs':
      ensureArity(name, argCount, 1)
      stack.push(Math.abs(args[0]))
      return
    case 'exp':
      ensureArity(name, argCount, 1)
      stack.push(Math.exp(args[0]))
      return
    case 'min':
      if (argCount < 1) throw new Error('minの引数が不足しています')
      stack.push(Math.min(...args))
      return
    case 'max':
      if (argCount < 1) throw new Error('maxの引数が不足しています')
      stack.push(Math.max(...args))
      return
    default:
      throw new Error(`未知の関数: ${name}`)
  }
}

function pullArgs(stack: number[], count: number): number[] {
  if (stack.length < count) {
    throw new Error('関数の引数が不足しています')
  }
  return stack.splice(stack.length - count, count)
}

function ensureArity(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name}の引数は${expected}個です`)
  }
}

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch)
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}

function isOperator(ch: string): boolean {
  return ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '×' || ch === '÷'
}

function normalizeOperator(ch: string): string {
  if (ch === '×') return '*'
  if (ch === '÷') return '/'
  return ch
}
