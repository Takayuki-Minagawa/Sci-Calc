import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate'

const evalValue = (expression: string, mode: 'DEG' | 'RAD' = 'DEG') => {
  const result = evaluate(expression, { mode })
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.value
}

describe('evaluate', () => {
  it('基本演算', () => {
    expect(evalValue('1+2')).toBe(3)
    expect(evalValue('2*3+4')).toBe(10)
    expect(evalValue('2*(3+4)')).toBe(14)
    expect(evalValue('10/4')).toBe(2.5)
  })

  it('べき乗（右結合）', () => {
    expect(evalValue('2^3^2')).toBe(512)
  })

  it('単項演算子とべき乗の優先順位', () => {
    expect(evalValue('-2^2')).toBe(-4)
    expect(evalValue('2^-3')).toBeCloseTo(0.125, 10)
  })

  it('定数', () => {
    const pi = evalValue('pi')
    expect(pi).toBeCloseTo(Math.PI, 10)
    const e = evalValue('e')
    expect(e).toBeCloseTo(Math.E, 10)
  })

  it('関数', () => {
    expect(evalValue('sqrt(9)')).toBe(3)
    expect(evalValue('ln(e)')).toBeCloseTo(1, 10)
    expect(evalValue('log(100)')).toBeCloseTo(2, 10)
    expect(evalValue('min(3,1,2)')).toBe(1)
    expect(evalValue('max(3,1,2)')).toBe(3)
  })

  it('三角（DEG）', () => {
    expect(evalValue('sin(30)', 'DEG')).toBeCloseTo(0.5, 10)
    expect(evalValue('asin(0.5)', 'DEG')).toBeCloseTo(30, 10)
  })

  it('三角（RAD）', () => {
    const result = evaluate('sin(pi/6)', { mode: 'RAD' })
    expect(result.ok && result.value).toBeCloseTo(0.5, 10)
  })

  it('エラー', () => {
    expect(evaluate('1/0', { mode: 'DEG' }).ok).toBe(false)
    expect(evaluate('sqrt(-1)', { mode: 'DEG' }).ok).toBe(false)
    expect(evaluate('asin(2)', { mode: 'DEG' }).ok).toBe(false)
    expect(evaluate('acos(-2)', { mode: 'DEG' }).ok).toBe(false)
    expect(evaluate('((1+2)', { mode: 'DEG' }).ok).toBe(false)
  })
})
