import * as Blockly from 'blockly'

let jsGen: Blockly.Generator | null = null
type ArrayDeclInfo =
  | { kind: '1d', base: number }
  | { kind: '2d', base1: number, base2: number }
const arrayDecls = new Map<string, ArrayDeclInfo>()

function ensureJs() {
  if (jsGen) return jsGen

  const g = new Blockly.Generator('PWB_JS')

  ;(g as any).ORDER_ATOMIC = 0
  ;(g as any).ORDER_MULTIPLICATIVE = 1
  ;(g as any).ORDER_ADDITIVE = 2
  ;(g as any).ORDER_RELATIONAL = 3
  ;(g as any).ORDER_LOGICAL_AND = 4
  ;(g as any).ORDER_LOGICAL_OR = 5
  ;(g as any).ORDER_NONE = 99

  ;(g as any).init = function (_ws: Blockly.Workspace) {
    ;(g as any).definitions_ = Object.create(null)
    arrayDecls.clear()
  }

  ;(g as any).finish = function (code: string) {
    return code
  }

  ;(g as any).scrub_ = function (block: Blockly.Block, code: string) {
    const next = block.nextConnection?.targetBlock()
    return code + (next ? g.blockToCode(next) : '')
  }

  jsGen = g
  return g
}

export function initJsGenerator() {
  const g = ensureJs()

  // ✅ BLOCO RAIZ: precisa existir no gerador JS, senão dá erro:
  // "generator does not know how to generate code for block type program_main"
  g.forBlock['program_main'] = function (block, gen) {
    const body = gen.statementToCode(block, 'BODY') // <-- seu input é BODY
    // executa como async pra suportar await __pwb_readX()
    return `async function __pwb_main__() {\n${indent(body)}\n}\nawait __pwb_main__();\n`
  }

  g.forBlock['var_declare'] = function (block, gen) {
    const name = getVarName(block, 'VAR')
    const t = block.getFieldValue('VARTYPE') || 'int'
    const init =
      t === 'boolean' ? 'false'
      : t === 'String' ? '""'
      : '0'
    ;(gen as any).definitions_[`v_${name}`] = `let ${name} = ${init};`
    return ''
  }

  g.forBlock['var_set_custom'] = function (block, gen) {
    const name = getVarName(block, 'VAR')
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const op = block.getFieldValue('ASSIGN_OP') || 'ASSIGN'
    const opMap: Record<string, string> = {
      ADD_ASSIGN: '+=',
      SUB_ASSIGN: '-=',
      MUL_ASSIGN: '*=',
      DIV_ASSIGN: '/=',
      MOD_ASSIGN: '%=',
    }
    const assignSym = opMap[op]
    if (assignSym) return `${name} ${assignSym} ${v};\n`
    return `${name} = ${v};\n`
  }

  g.forBlock['var_get_custom'] = function (block, gen) {
    const name = getVarName(block, 'VAR')
    return [name, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['io_print_inline'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `__pwb_print(String(${v}));\n`
  }

  g.forBlock['io_print_line'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `__pwb_println(String(${v}));\n`
  }

  g.forBlock['io_read'] = function (block) {
    const t = block.getFieldValue('READTYPE') || 'String'
    if (t === 'int') return [`await __pwb_readInt()`, (g as any).ORDER_ATOMIC]
    if (t === 'double') return [`await __pwb_readDouble()`, (g as any).ORDER_ATOMIC]
    if (t === 'boolean') return [`await __pwb_readBool()`, (g as any).ORDER_ATOMIC]
    return [`await __pwb_readLine()`, (g as any).ORDER_ATOMIC]
  }

  g.forBlock['ctrl_if'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'false'
    const thenCode = gen.statementToCode(block, 'THEN')
    const elseCode = gen.statementToCode(block, 'ELSE')
    const hasElse = elseCode.trim().length > 0
    return `if (${cond}) {\n${indent(thenCode)}\n}${hasElse ? ` else {\n${indent(elseCode)}\n}` : ''}\n`
  }

  g.forBlock['ctrl_if_no_else'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'false'
    const thenCode = gen.statementToCode(block, 'THEN')
    return `if (${cond}) {\n${indent(thenCode)}\n}\n`
  }

  g.forBlock['ctrl_while'] = function (block, gen) {
    const cond = gen.valueToCode(block, 'COND', (gen as any).ORDER_NONE) || 'false'
    const doCode = gen.statementToCode(block, 'DO')
    return `while (${cond}) {\n${indent(doCode)}\n}\n`
  }

  g.forBlock['ctrl_for'] = function (block, gen) {
    const v = sanitizeJsIdent(block.getFieldValue('VAR') || 'i')
    ;(gen as any).definitions_[`v_${v}`] = `let ${v};`
    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    const stepRaw = gen.valueToCode(block, 'STEP', (gen as any).ORDER_NONE) || '1'
    const stepLiteral = parsePositiveIntegerLiteral(stepRaw)
    const stepExpr = stepLiteral !== null ? String(stepLiteral) : `Math.max(1, Math.abs(${stepRaw}))`
    const upUpdate = formatJsForUpdate(v, 'UP', stepExpr, stepLiteral)
    const downUpdate = formatJsForUpdate(v, 'DOWN', stepExpr, stepLiteral)
    const dir = block.getFieldValue('DIR') || 'AUTO'
    const doCode = gen.statementToCode(block, 'DO')

    if (dir === 'UP') {
      return `for (${v} = ${from}; ${v} <= ${to}; ${upUpdate}) {\n${indent(doCode)}\n}\n`
    }

    if (dir === 'DOWN') {
      return `for (${v} = ${from}; ${v} >= ${to}; ${downUpdate}) {\n${indent(doCode)}\n}\n`
    }

    return `if (${from} <= ${to}) {\n  for (${v} = ${from}; ${v} <= ${to}; ${upUpdate}) {\n${indent(doCode, 4)}\n  }\n} else {\n  for (${v} = ${from}; ${v} >= ${to}; ${downUpdate}) {\n${indent(doCode, 4)}\n  }\n}\n`
  }

  g.forBlock['ctrl_break'] = function () {
    return `break;\n`
  }

  g.forBlock['array_declare_1d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'v')
    const base = Number(block.getFieldValue('BASE') ?? 0)
    const end = Number(block.getFieldValue('END') ?? 0)
    const len = Math.max(0, end - base + 1)
    arrayDecls.set(name, { kind: '1d', base })
    ;(gen as any).definitions_[`arr_${name}`] = `let ${name} = new Array(${len});`
    return ''
  }

  g.forBlock['array_get_1d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base = info && info.kind === '1d' ? info.base : 0
    const expr = base !== 0 ? `${name}[(${idx}) - (${base})]` : `${name}[${idx}]`
    return [expr, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['array_set_1d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    const val = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base = info && info.kind === '1d' ? info.base : 0
    const target = base !== 0 ? `${name}[(${idx}) - (${base})]` : `${name}[${idx}]`
    return `${target} = ${val};\n`
  }

  g.forBlock['array_declare_2d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'm')
    const base1 = Number(block.getFieldValue('BASE1') ?? 0)
    const end1 = Number(block.getFieldValue('END1') ?? 0)
    const base2 = Number(block.getFieldValue('BASE2') ?? 0)
    const end2 = Number(block.getFieldValue('END2') ?? 0)
    const rows = Math.max(0, end1 - base1 + 1)
    const cols = Math.max(0, end2 - base2 + 1)
    arrayDecls.set(name, { kind: '2d', base1, base2 })
    ;(gen as any).definitions_[`arr_${name}`] = `let ${name} = Array.from({ length: ${rows} }, () => new Array(${cols}));`
    return ''
  }

  g.forBlock['array_get_2d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'm')
    const i = gen.valueToCode(block, 'I', (gen as any).ORDER_NONE) || '0'
    const j = gen.valueToCode(block, 'J', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base1 = info && info.kind === '2d' ? info.base1 : 0
    const base2 = info && info.kind === '2d' ? info.base2 : 0
    const ii = base1 !== 0 ? `(${i}) - (${base1})` : i
    const jj = base2 !== 0 ? `(${j}) - (${base2})` : j
    return [`${name}[${ii}][${jj}]`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['array_set_2d'] = function (block, gen) {
    const name = sanitizeJsIdent(block.getFieldValue('NAME') || 'm')
    const i = gen.valueToCode(block, 'I', (gen as any).ORDER_NONE) || '0'
    const j = gen.valueToCode(block, 'J', (gen as any).ORDER_NONE) || '0'
    const val = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base1 = info && info.kind === '2d' ? info.base1 : 0
    const base2 = info && info.kind === '2d' ? info.base2 : 0
    const ii = base1 !== 0 ? `(${i}) - (${base1})` : i
    const jj = base2 !== 0 ? `(${j}) - (${base2})` : j
    return `${name}[${ii}][${jj}] = ${val};\n`
  }

  // básicos e operadores
  g.forBlock['math_number'] = (block) => [
    String(block.getFieldValue('NUM')),
    (g as any).ORDER_ATOMIC,
  ]

  g.forBlock['text'] = (block) => [
    `"${String(block.getFieldValue('TEXT') ?? '').replace(/"/g, '\\"')}"`,
    (g as any).ORDER_ATOMIC,
  ]

  g.forBlock['text_join'] = function (block, gen) {
    const itemCount = Number((block as any).itemCount_ ?? 0)
    if (!itemCount) return ['""', (gen as any).ORDER_ATOMIC]

    const parts: string[] = []
    for (let i = 0; i < itemCount; i += 1) {
      parts.push(gen.valueToCode(block, `ADD${i}`, (gen as any).ORDER_NONE) || '""')
    }
    return [`(${parts.join(' + ')})`, (gen as any).ORDER_ADDITIVE]
  }

  g.forBlock['math_randi'] = function (block, gen) {
    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    const expr = `(Math.floor(Math.random() * ((${to}) - (${from}) + 1)) + (${from}))`
    return [expr, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_upper'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`String(${text}).toUpperCase()`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_lower'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`String(${text}).toLowerCase()`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['logic_boolean'] = function (block) {
    const b = block.getFieldValue('BOOL') === 'TRUE'
    return [b ? 'true' : 'false', (g as any).ORDER_ATOMIC]
  }

  g.forBlock['math_arithmetic'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'ADD'
    const A = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || '0'
    const B = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || '0'
    const map: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', MOD: '%' }
    if (op === 'POWER') return [`Math.pow(${A}, ${B})`, (gen as any).ORDER_ATOMIC]
    const sym = map[op] || '+'
    const order = op === 'MULTIPLY' || op === 'DIVIDE' || op === 'MOD'
      ? (gen as any).ORDER_MULTIPLICATIVE
      : (gen as any).ORDER_ADDITIVE
    return [`(${A} ${sym} ${B})`, order]
  }

  g.forBlock['logic_compare'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'EQ'
    const A = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || '0'
    const B = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || '0'
    const map: Record<string, string> = { EQ: '===', NEQ: '!==', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
    const sym = map[op] || '==='
    return [`(${A} ${sym} ${B})`, (gen as any).ORDER_RELATIONAL]
  }

  g.forBlock['logic_operation'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'AND'
    const A = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || 'false'
    const B = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || 'false'
    const sym = op === 'OR' ? '||' : '&&'
    const order = op === 'OR' ? (gen as any).ORDER_LOGICAL_OR : (gen as any).ORDER_LOGICAL_AND
    return [`(${A} ${sym} ${B})`, order]
  }

  g.forBlock['logic_negate'] = function (block, gen) {
    const A = gen.valueToCode(block, 'BOOL', (gen as any).ORDER_NONE) || 'false'
    return [`(!${A})`, (gen as any).ORDER_ATOMIC]
  }
}

export function generateJsFromWorkspace(workspace: Blockly.Workspace) {
  const g = ensureJs()
  ;(g as any).init(workspace)

  const program = workspace.getTopBlocks(true).find((b) => b.type === 'program_main')
  if (!program) return `__pwb_println("Adicione o bloco programa.");`

  const code = g.blockToCode(program)
  const defs = (g as any).definitions_ || {}
  const decls = Object.keys(defs)
    .sort()
    .map((k) => defs[k])
    .join('\n')

  return `${decls}\n${code}`
}

function indent(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

// FieldVariable guarda ID no value; para gerar JS precisamos do nome exibido.
function getVarName(block: Blockly.Block, fieldName = 'VAR') {
  const field = block.getField(fieldName) as any
  const raw = field?.getText?.() ?? block.getFieldValue(fieldName) ?? 'x'
  return sanitizeJsIdent(String(raw))
}

function sanitizeJsIdent(s: string) {
  const cleaned = String(s).trim().replace(/[^a-zA-Z0-9_]/g, '_')
  if (!cleaned) return 'x'
  if (/^[0-9]/.test(cleaned)) return '_' + cleaned
  return cleaned
}

function parsePositiveIntegerLiteral(code: string) {
  const cleaned = code.replace(/[()]/g, '').trim()
  if (!/^[+-]?\d+$/.test(cleaned)) return null
  const n = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.abs(n))
}

function formatJsForUpdate(
  varName: string,
  dir: 'UP' | 'DOWN',
  stepExpr: string,
  stepLiteral: number | null
) {
  if (stepLiteral === 1) return dir === 'UP' ? `${varName}++` : `${varName}--`
  const op = dir === 'UP' ? '+=' : '-='
  const amount = stepLiteral !== null ? String(stepLiteral) : stepExpr
  return `${varName} ${op} ${amount}`
}
