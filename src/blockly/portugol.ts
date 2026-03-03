import * as Blockly from 'blockly'

let portugolGenerator: Blockly.Generator | null = null

type ArrayDeclInfo =
  | { kind: '1d', base: number }
  | { kind: '2d', base1: number, base2: number }

const arrayDecls = new Map<string, ArrayDeclInfo>()

function ensureGenerator() {
  if (portugolGenerator) return portugolGenerator

  const g = new Blockly.Generator('PortugolPWB')
  ;(g as any).ORDER_ATOMIC = 0
  ;(g as any).ORDER_UNARY = 1
  ;(g as any).ORDER_MULTIPLICATIVE = 2
  ;(g as any).ORDER_ADDITIVE = 3
  ;(g as any).ORDER_RELATIONAL = 4
  ;(g as any).ORDER_LOGICAL_AND = 5
  ;(g as any).ORDER_LOGICAL_OR = 6
  ;(g as any).ORDER_NONE = 99

  ;(g as any).init = function (_workspace: Blockly.Workspace) {
    ;(g as any).definitions_ = Object.create(null)
    ;(g as any).typedVars_ = Object.create(null)
    arrayDecls.clear()
  }

  ;(g as any).finish = function (code: string) {
    return code
  }

  ;(g as any).scrub_ = function (block: Blockly.Block, code: string) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
    const nextCode = nextBlock ? g.blockToCode(nextBlock) : ''
    return code + nextCode
  }

  g.forBlock['program_main'] = function (block: Blockly.Block, gen: Blockly.Generator) {
    const name = block.getFieldValue('NAME') || 'Programa'
    const body = gen.statementToCode(block, 'BODY')

    const defs = (gen as any).definitions_ || {}
    const declLines = Object.keys(defs)
      .sort()
      .map((k) => String(defs[k]).trim())
      .filter(Boolean)

    const varSection = declLines.length
      ? `var\n${declLines.map((line) => `  ${line}`).join('\n')}\n`
      : ''

    const bodyCode = body.trim().length ? body : ''
    return `algoritmo "${escapePortugolString(name)}"\n${varSection}inicio${indentBlock(bodyCode, 2)}\nfimalgoritmo\n`
  }

  g.forBlock['var_declare'] = function (block, gen) {
    const t = portugolType(block.getFieldValue('VARTYPE'))
    const name = getVarName(block, 'VAR')
    ;(gen as any).typedVars_[name] = t
    ;(gen as any).definitions_[`var_${name}`] = `${name}: ${t}`
    return ''
  }

  g.forBlock['var_set_custom'] = function (block, gen) {
    const name = getVarName(block, 'VAR')
    const value = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const op = block.getFieldValue('ASSIGN_OP') || 'ASSIGN'
    if (op === 'ADD_ASSIGN') return `${name} <- ${name} + ${value}\n`
    if (op === 'SUB_ASSIGN') return `${name} <- ${name} - ${value}\n`
    if (op === 'MUL_ASSIGN') return `${name} <- ${name} * ${value}\n`
    if (op === 'DIV_ASSIGN') return `${name} <- ${name} / ${value}\n`
    if (op === 'MOD_ASSIGN') return `${name} <- ${name} mod ${value}\n`
    return `${name} <- ${value}\n`
  }

  g.forBlock['var_get_custom'] = function (block, _gen) {
    const name = getVarName(block, 'VAR')
    return [name, (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['io_print_inline'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `escreva(${v})\n`
  }

  g.forBlock['io_print_line'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `escreval(${v})\n`
  }

  g.forBlock['io_read'] = function () {
    return ['leia()', (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['ctrl_if'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'falso'
    const thenCode = gen.statementToCode(block, 'THEN')
    const elseCode = gen.statementToCode(block, 'ELSE')
    const hasElse = elseCode.trim().length > 0
    return hasElse
      ? `se (${cond}) entao\n${indent(thenCode)}\nsenao\n${indent(elseCode)}\nfimse\n`
      : `se (${cond}) entao\n${indent(thenCode)}\nfimse\n`
  }

  g.forBlock['ctrl_if_no_else'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'falso'
    const thenCode = gen.statementToCode(block, 'THEN')
    return `se (${cond}) entao\n${indent(thenCode)}\nfimse\n`
  }

  g.forBlock['ctrl_while'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'falso'
    const doCode = gen.statementToCode(block, 'DO')
    return `enquanto (${cond}) faca\n${indent(doCode)}\nfimenquanto\n`
  }

  g.forBlock['ctrl_for'] = function (block, gen) {
    const v = sanitizeIdent(block.getFieldValue('VAR') || 'i')
    ;(gen as any).typedVars_[v] = 'inteiro'
    ;(gen as any).definitions_[`var_${v}`] = `${v}: inteiro`

    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    const stepRaw = gen.valueToCode(block, 'STEP', (gen as any).ORDER_NONE) || '1'
    const stepLiteral = parsePositiveIntegerLiteral(stepRaw)
    const stepExpr = stepLiteral !== null ? String(stepLiteral) : `abs(${stepRaw})`
    const dir = block.getFieldValue('DIR') || 'AUTO'
    const doCode = gen.statementToCode(block, 'DO')

    if (dir === 'UP') {
      return `para ${v} de ${from} ate ${to} passo ${stepExpr} faca\n${indent(doCode)}\nfimpara\n`
    }

    if (dir === 'DOWN') {
      return `para ${v} de ${from} ate ${to} passo -${stepExpr} faca\n${indent(doCode)}\nfimpara\n`
    }

    return `se (${from} <= ${to}) entao\n${indent(`para ${v} de ${from} ate ${to} passo ${stepExpr} faca\n${indent(doCode)}\nfimpara\n`)}\nsenao\n${indent(`para ${v} de ${from} ate ${to} passo -${stepExpr} faca\n${indent(doCode)}\nfimpara\n`)}\nfimse\n`
  }

  g.forBlock['ctrl_break'] = function () {
    return 'interrompa\n'
  }

  g.forBlock['array_declare_1d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'v')
    const t = portugolType(block.getFieldValue('ELTYPE'))
    const base = Number(block.getFieldValue('BASE') ?? 0)
    const end = Number(block.getFieldValue('END') ?? 0)
    arrayDecls.set(name, { kind: '1d', base })
    ;(gen as any).definitions_[`arr_${name}`] = `${name}: vetor[${base}..${end}] de ${t}`
    return ''
  }

  g.forBlock['array_get_1d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    return [`${name}[${idx}]`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['array_set_1d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    const val = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    return `${name}[${idx}] <- ${val}\n`
  }

  g.forBlock['array_declare_2d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'm')
    const t = portugolType(block.getFieldValue('ELTYPE'))
    const base1 = Number(block.getFieldValue('BASE1') ?? 0)
    const end1 = Number(block.getFieldValue('END1') ?? 0)
    const base2 = Number(block.getFieldValue('BASE2') ?? 0)
    const end2 = Number(block.getFieldValue('END2') ?? 0)
    arrayDecls.set(name, { kind: '2d', base1, base2 })
    ;(gen as any).definitions_[`arr_${name}`] = `${name}: vetor[${base1}..${end1},${base2}..${end2}] de ${t}`
    return ''
  }

  g.forBlock['array_get_2d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'm')
    const i = gen.valueToCode(block, 'I', (gen as any).ORDER_NONE) || '0'
    const j = gen.valueToCode(block, 'J', (gen as any).ORDER_NONE) || '0'
    return [`${name}[${i},${j}]`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['array_set_2d'] = function (block, gen) {
    const name = sanitizeIdent(block.getFieldValue('NAME') || 'm')
    const i = gen.valueToCode(block, 'I', (gen as any).ORDER_NONE) || '0'
    const j = gen.valueToCode(block, 'J', (gen as any).ORDER_NONE) || '0'
    const val = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    return `${name}[${i},${j}] <- ${val}\n`
  }

  g.forBlock['math_number'] = function (block) {
    const n = block.getFieldValue('NUM')
    return [String(n), (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['text'] = function (block) {
    const t = block.getFieldValue('TEXT') ?? ''
    return [`"${escapePortugolString(String(t))}"`, (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['text_join'] = function (block, gen) {
    const itemCount = Number((block as any).itemCount_ ?? 0)
    if (!itemCount) return ['""', (gen as any).ORDER_ATOMIC]

    const parts: string[] = []
    for (let i = 0; i < itemCount; i += 1) {
      parts.push(gen.valueToCode(block, `ADD${i}`, (gen as any).ORDER_NONE) || '""')
    }
    return [parts.join(' + '), (gen as any).ORDER_ADDITIVE]
  }

  g.forBlock['math_randi'] = function (block, gen) {
    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    return [`randi(${from}, ${to})`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_upper'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`maiusc(${text})`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_lower'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`minusc(${text})`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['logic_boolean'] = function (block) {
    const b = block.getFieldValue('BOOL') === 'TRUE'
    return [b ? 'verdadeiro' : 'falso', (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['math_arithmetic'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'ADD'
    const a = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || '0'
    const b = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || '0'

    if (op === 'POWER') return [`(${a} ^ ${b})`, (gen as any).ORDER_ATOMIC]
    if (op === 'MOD') return [`(${a} mod ${b})`, (gen as any).ORDER_MULTIPLICATIVE]

    const map: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }
    const sym = map[op] || '+'
    const order = op === 'MULTIPLY' || op === 'DIVIDE'
      ? (gen as any).ORDER_MULTIPLICATIVE
      : (gen as any).ORDER_ADDITIVE
    return [`(${a} ${sym} ${b})`, order]
  }

  g.forBlock['logic_compare'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'EQ'
    const a = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || '0'
    const b = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || '0'
    const map: Record<string, string> = { EQ: '=', NEQ: '<>', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
    const sym = map[op] || '='
    return [`(${a} ${sym} ${b})`, (gen as any).ORDER_RELATIONAL]
  }

  g.forBlock['logic_operation'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'AND'
    const a = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || 'falso'
    const b = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || 'falso'
    const sym = op === 'OR' ? 'ou' : 'e'
    const order = op === 'OR' ? (gen as any).ORDER_LOGICAL_OR : (gen as any).ORDER_LOGICAL_AND
    return [`(${a} ${sym} ${b})`, order]
  }

  g.forBlock['logic_negate'] = function (block, gen) {
    const a = gen.valueToCode(block, 'BOOL', (gen as any).ORDER_NONE) || 'falso'
    return [`(nao ${a})`, (gen as any).ORDER_UNARY]
  }

  portugolGenerator = g
  return g
}

export function generatePortugolFromWorkspace(workspace: Blockly.Workspace) {
  const g = ensureGenerator()
  ;(g as any).init(workspace)

  const topBlocks = workspace.getTopBlocks(true)
  const program = topBlocks.find((b) => b.type === 'program_main')
  if (!program) return `// Dica: adicione o bloco "programa" para gerar o código em Portugol.\n`

  const code = g.blockToCode(program)
  return Array.isArray(code) ? String(code[0] ?? '') : String(code ?? '')
}

function getVarName(block: Blockly.Block, fieldName = 'VAR') {
  const field = block.getField(fieldName) as any
  const raw = field?.getText?.() ?? block.getFieldValue(fieldName) ?? 'x'
  return sanitizeIdent(raw)
}

function sanitizeIdent(value: string) {
  const cleaned = String(value).trim().replace(/[^a-zA-Z0-9_]/g, '_')
  if (!cleaned) return 'x'
  if (/^[0-9]/.test(cleaned)) return '_' + cleaned
  return cleaned
}

function portugolType(type: string) {
  switch (type) {
    case 'int':
      return 'inteiro'
    case 'double':
      return 'real'
    case 'boolean':
      return 'logico'
    case 'String':
      return 'caractere'
    default:
      return 'caractere'
  }
}

function escapePortugolString(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function indent(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx].trim() === ''))
    .map((line) => (line.trim().length ? pad + line : line))
    .join('\n')
}

function indentBlock(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  const lines = code.replace(/\s+$/, '').split('\n')
  if (lines.length === 1 && lines[0] === '') return '\n'
  return '\n' + lines.map((line) => (line.length ? pad + line : line)).join('\n')
}

function parsePositiveIntegerLiteral(code: string) {
  const cleaned = code.replace(/[()]/g, '').trim()
  if (!/^[+-]?\d+$/.test(cleaned)) return null
  const n = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.abs(n))
}
