import * as Blockly from 'blockly'

export type WorkspaceHandle = { workspace: Blockly.WorkspaceSvg }

let javaGenerator: Blockly.Generator | null = null
let initialized = false
let needsScanner = false

type ArrayDeclInfo =
  | { kind: '1d', name: string, type: string, base: number, end: number }
  | { kind: '2d', name: string, type: string, base1: number, end1: number, base2: number, end2: number }

const arrayDecls = new Map<string, ArrayDeclInfo>()

function javaType(t: string) {
  switch (t) {
    case 'int':
    case 'double':
    case 'boolean':
    case 'String':
      return t
    default:
      return 'Object'
  }
}

function javaDefaultValue(t: string) {
  switch (t) {
    case 'int':
      return '0'
    case 'double':
      return '0.0'
    case 'boolean':
      return 'false'
    case 'String':
      return '""'
    default:
      return 'null'
  }
}

function ensureGenerator() {
  if (javaGenerator) return javaGenerator
  const g = new Blockly.Generator('JavaPWB')

  ;(g as any).ORDER_ATOMIC = 0
  ;(g as any).ORDER_MULTIPLICATIVE = 1
  ;(g as any).ORDER_ADDITIVE = 2
  ;(g as any).ORDER_RELATIONAL = 3
  ;(g as any).ORDER_LOGICAL_AND = 4
  ;(g as any).ORDER_LOGICAL_OR = 5
  ;(g as any).ORDER_NONE = 99

  // ✅ init: prepara definitions + NameDB (para field_variable funcionar)
  ;(g as any).init = function (workspace: Blockly.Workspace) {
    ;(g as any).definitions_ = Object.create(null)
    needsScanner = false
    arrayDecls.clear()

    // garante que o gerador tenha um NameDB para nomes de variáveis válidos
    if (!(g as any).nameDB_) {
      ;(g as any).nameDB_ = new Blockly.Names((g as any).RESERVED_WORDS_ || '')
    }

    // liga o variableMap do workspace no nameDB (Blockly 10/11+)
    const nameDB = (g as any).nameDB_
    if (nameDB?.setVariableMap && workspace.getVariableMap) {
      nameDB.setVariableMap(workspace.getVariableMap())
    }
  }

  ;(g as any).finish = function (code: string) {
    const defs = (g as any).definitions_ || {}
    const declLines = Object.keys(defs)
      .sort()
      .map((k) => String(defs[k]).trim())
      .filter(Boolean)

    const declBlock = declLines.length ? '\n' + declLines.join('\n') + '\n' : '\n'
    return declBlock + code
  }

  ;(g as any).scrub_ = function (block: Blockly.Block, code: string) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
    const nextCode = nextBlock ? g.blockToCode(nextBlock) : ''
    return code + nextCode
  }

  javaGenerator = g
  return g
}

export function initJavaGenerator() {
  if (initialized) return
  initialized = true

  const g = ensureGenerator()

  // ✅ programa_main deve retornar STRING
  g.forBlock['program_main'] = function (block: Blockly.Block, gen: Blockly.Generator) {
    const name = block.getFieldValue('NAME') || 'Main'
    const body = gen.statementToCode(block, 'BODY')
    const mainBody = (gen as any).finish(body.trim().length ? body : '')

    return `public class ${sanitizeJavaIdent(name)} {
  public static void main(String[] args) {${indentBlock(mainBody, 4)}
  }
}
`
  }

  // ✅ agora pega o nome da variável pelo field_variable (VAR)
  g.forBlock['var_declare'] = function (block, gen) {
    const t = javaType(block.getFieldValue('VARTYPE'))
    const name = getVarName(gen, block, 'VAR')
    ;(gen as any).definitions_[`var_${name}`] = `${t} ${name} = ${javaDefaultValue(t)};`
    return ''
  }

  g.forBlock['var_set_custom'] = function (block, gen) {
    const name = getVarName(gen, block, 'VAR')
    const value = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const op = block.getFieldValue('ASSIGN_OP') || 'ASSIGN'
    const opMap: Record<string, string> = {
      ADD_ASSIGN: '+=',
      SUB_ASSIGN: '-=',
      MUL_ASSIGN: '*=',
      DIV_ASSIGN: '/=',
      MOD_ASSIGN: '%=',
    }
    const assignSym = opMap[op]
    if (assignSym) return `${name} ${assignSym} ${value};\n`
    return `${name} = ${value};\n`
  }

  g.forBlock['var_get_custom'] = function (block, gen) {
    const name = getVarName(gen, block, 'VAR')
    return [name, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['io_print_inline'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `System.out.print(${v});\n`
  }

  g.forBlock['io_print_line'] = function (block, gen) {
    const v = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '""'
    return `System.out.println(${v});\n`
  }

  g.forBlock['io_read'] = function (block, gen) {
    const t = block.getFieldValue('READTYPE') || 'int'

    ;(gen as any).definitions_[`scanner_decl`] =
      `java.util.Scanner scanner = new java.util.Scanner(System.in);`

    if (t === 'int') return ['scanner.nextInt()', (gen as any).ORDER_ATOMIC]
    if (t === 'double') return ['scanner.nextDouble()', (gen as any).ORDER_ATOMIC]
    if (t === 'boolean') return ['scanner.nextBoolean()', (gen as any).ORDER_ATOMIC]

    return ['scanner.nextLine()', (gen as any).ORDER_ATOMIC]
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
    const v = sanitizeJavaIdent(block.getFieldValue('VAR') || 'i')
    ;(gen as any).definitions_[`var_${v}`] = `int ${v};`
    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    const stepRaw = gen.valueToCode(block, 'STEP', (gen as any).ORDER_NONE) || '1'
    const stepLiteral = parsePositiveIntegerLiteral(stepRaw)
    const stepExpr = stepLiteral !== null ? String(stepLiteral) : `(int)Math.max(1, Math.abs(${stepRaw}))`
    const upUpdate = formatJavaForUpdate(v, 'UP', stepExpr, stepLiteral)
    const downUpdate = formatJavaForUpdate(v, 'DOWN', stepExpr, stepLiteral)
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
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'v')
    const t = javaType(block.getFieldValue('ELTYPE'))
    const base = Number(block.getFieldValue('BASE') ?? 0)
    const end = Number(block.getFieldValue('END') ?? 0)
    const len = Math.max(0, end - base + 1)
    arrayDecls.set(name, { kind: '1d', name, type: t, base, end })
    ;(gen as any).definitions_[`arr_${name}`] = `${t}[] ${name} = new ${t}[${len}]; // base=${base}`
    return ''
  }

  g.forBlock['array_get_1d'] = function (block, gen) {
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base = info && info.kind === '1d' ? info.base : 0
    const expr = base !== 0 ? `${name}[(${idx}) - (${base})]` : `${name}[${idx}]`
    return [expr, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['array_set_1d'] = function (block, gen) {
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'v')
    const idx = gen.valueToCode(block, 'INDEX', (gen as any).ORDER_NONE) || '0'
    const val = gen.valueToCode(block, 'VALUE', (gen as any).ORDER_NONE) || '0'
    const info = arrayDecls.get(name)
    const base = info && info.kind === '1d' ? info.base : 0
    const target = base !== 0 ? `${name}[(${idx}) - (${base})]` : `${name}[${idx}]`
    return `${target} = ${val};\n`
  }

  g.forBlock['array_declare_2d'] = function (block, gen) {
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'm')
    const t = javaType(block.getFieldValue('ELTYPE'))
    const base1 = Number(block.getFieldValue('BASE1') ?? 0)
    const end1 = Number(block.getFieldValue('END1') ?? 0)
    const base2 = Number(block.getFieldValue('BASE2') ?? 0)
    const end2 = Number(block.getFieldValue('END2') ?? 0)
    const rows = Math.max(0, end1 - base1 + 1)
    const cols = Math.max(0, end2 - base2 + 1)
    arrayDecls.set(name, { kind: '2d', name, type: t, base1, end1, base2, end2 })
    ;(gen as any).definitions_[`arr_${name}`] = `${t}[][] ${name} = new ${t}[${rows}][${cols}]; // base1=${base1}, base2=${base2}`
    return ''
  }

  g.forBlock['array_get_2d'] = function (block, gen) {
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'm')
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
    const name = sanitizeJavaIdent(block.getFieldValue('NAME') || 'm')
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

  g.forBlock['math_number'] = function (block) {
    const n = block.getFieldValue('NUM')
    return [String(n), (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['text'] = function (block) {
    const t = block.getFieldValue('TEXT') ?? ''
    return [`"${escapeJavaString(String(t))}"`, (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['text_join'] = function (block, gen) {
    const itemCount = Number((block as any).itemCount_ ?? 0)
    if (!itemCount) return ['""', (gen as any).ORDER_ATOMIC]

    const parts: string[] = []
    for (let i = 0; i < itemCount; i += 1) {
      parts.push(gen.valueToCode(block, `ADD${i}`, (gen as any).ORDER_NONE) || '""')
    }
    const first = parts[0]?.trim() ?? '""'
    const startsWithStringLiteral = first.startsWith('"')
    const expr = startsWithStringLiteral
      ? parts.join(' + ')
      : `"" + ${parts.join(' + ')}`
    return [expr, (gen as any).ORDER_ADDITIVE]
  }

  g.forBlock['math_randi'] = function (block, gen) {
    const from = gen.valueToCode(block, 'FROM', (gen as any).ORDER_NONE) || '0'
    const to = gen.valueToCode(block, 'TO', (gen as any).ORDER_NONE) || '0'
    ;(gen as any).definitions_[`random_decl`] = `java.util.Random random = new java.util.Random();`
    const expr = `(random.nextInt(((${to}) - (${from}) + 1)) + (${from}))`
    return [expr, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_upper'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`String.valueOf(${text}).toUpperCase()`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['text_lower'] = function (block, gen) {
    const text = gen.valueToCode(block, 'TEXT', (gen as any).ORDER_NONE) || '""'
    return [`String.valueOf(${text}).toLowerCase()`, (gen as any).ORDER_ATOMIC]
  }

  g.forBlock['logic_boolean'] = function (block) {
    const b = block.getFieldValue('BOOL') === 'TRUE'
    return [b ? 'true' : 'false', (ensureGenerator() as any).ORDER_ATOMIC]
  }

  g.forBlock['math_arithmetic'] = function (block, gen) {
    const op = block.getFieldValue('OP') || 'ADD'
    const A = gen.valueToCode(block, 'A', (gen as any).ORDER_NONE) || '0'
    const B = gen.valueToCode(block, 'B', (gen as any).ORDER_NONE) || '0'
    const map: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', MOD: '%', POWER: 'Math.pow' }
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
    const map: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
    const sym = map[op] || '=='
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

export function generateJavaFromWorkspace(workspace: Blockly.Workspace) {
  const g = ensureGenerator()
  ;(g as any).init(workspace)

  const topBlocks = workspace.getTopBlocks(true)
  const program = topBlocks.find((b) => b.type === 'program_main')
  if (!program) return `// Dica: adicione o bloco "programa" (categoria Programa) para gerar a classe Java.\n`

  const code = g.blockToCode(program)
  return Array.isArray(code) ? String(code[0] ?? '') : String(code ?? '')
}

function indent(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx].trim() === ''))
    .map((l) => (l.trim().length ? pad + l : l))
    .join('\n')
}

function indentBlock(code: string, spaces = 2) {
  const pad = ' '.repeat(spaces)
  const lines = code.replace(/\s+$/, '').split('\n')
  if (lines.length === 1 && lines[0] === '') return '\n'
  return '\n' + lines.map((l) => (l.length ? pad + l : l)).join('\n') + '\n'
}

function sanitizeJavaIdent(s: string) {
  const cleaned = String(s).trim().replace(/[^a-zA-Z0-9_]/g, '_')
  if (!cleaned) return 'x'
  if (/^[0-9]/.test(cleaned)) return '_' + cleaned
  return cleaned
}

// ✅ pega o nome selecionado em field_variable
function getVarName(gen: Blockly.Generator, block: Blockly.Block, fieldName = 'VAR') {
  const field = block.getField(fieldName) as any
  const raw = field?.getText?.() ?? block.getFieldValue(fieldName) ?? 'x'

  const nameDB = (gen as any).nameDB_
  if (nameDB?.getName) {
    return nameDB.getName(raw, Blockly.Names.NameType.VARIABLE)
  }
  return sanitizeJavaIdent(raw)
}

function escapeJavaString(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function parsePositiveIntegerLiteral(code: string) {
  const cleaned = code.replace(/[()]/g, '').trim()
  if (!/^[+-]?\d+$/.test(cleaned)) return null
  const n = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(n)) return null
  return Math.max(1, Math.abs(n))
}

function formatJavaForUpdate(
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
