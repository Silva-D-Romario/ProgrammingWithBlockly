import * as Blockly from 'blockly'

let registered = false

// ✅ FieldVariable custom: adiciona "➕ Criar nova variável..."
class PwbFieldVariable extends Blockly.FieldVariable {
  static NEW_VAR = '__PWB_NEW_VAR__'

  override getOptions(useCache?: boolean) {
    const options = super.getOptions(useCache) as [string, string][]
    options.push(['➕ Criar nova variável...', PwbFieldVariable.NEW_VAR])
    return options
  }

  override onItemSelected_(menu: any, menuItem: any) {
    const value = menuItem.getValue()

    if (value === PwbFieldVariable.NEW_VAR) {
      const ws = this.getSourceBlock()?.workspace
      if (!ws) return

      Blockly.dialog.prompt('Nome da nova variável:', '', (name) => {
        if (!name) return
        // ✅ cria a variável no workspace e seleciona no campo
        // FieldVariable armazena o ID da variável como "value".
        const model = ws.createVariable(name)
        this.setValue(model.getId())
      })
      return
    }

    super.onItemSelected_(menu, menuItem)
  }
}

export function registerCustomBlocks() {
  if (registered) return
  registered = true

  // ✅ Define todos os blocos "normais" via JSON
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'program_main',
      message0: 'programa %1 executar %2',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'Main' },
        { type: 'input_statement', name: 'BODY' },
      ],
      colour: 210,
    },

    {
      type: 'io_print_inline',
      message0: 'escreva %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
    },
    {
      type: 'io_print_line',
      message0: 'escreval %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
    },
    {
      type: 'io_read',
      message0: 'leia %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'READTYPE',
          options: [
            ['inteiro', 'int'],
            ['real', 'double'],
            ['lógico', 'boolean'],
            ['texto', 'String'],
          ],
        },
      ],
      output: null,
      colour: 120,
      tooltip: 'Lê um valor do usuário.',
      helpUrl: '',
    },
    {
      type: 'math_randi',
      message0: 'randi de %1 até %2',
      args0: [
        { type: 'input_value', name: 'FROM', check: 'Number' },
        { type: 'input_value', name: 'TO', check: 'Number' },
      ],
      output: 'Number',
      colour: '%{BKY_MATH_HUE}',
      tooltip: 'Retorna um inteiro aleatório entre os limites (inclusivo).',
      helpUrl: '',
    },
    {
      type: 'text_upper',
      message0: 'maiusc %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      output: 'String',
      colour: '%{BKY_TEXTS_HUE}',
      tooltip: 'Converte texto para maiúsculas.',
      helpUrl: '',
    },
    {
      type: 'text_lower',
      message0: 'minusc %1',
      args0: [{ type: 'input_value', name: 'TEXT' }],
      output: 'String',
      colour: '%{BKY_TEXTS_HUE}',
      tooltip: 'Converte texto para minúsculas.',
      helpUrl: '',
    },

    {
      type: 'ctrl_if',
      message0: 'se %1 então %2 senão %3',
      args0: [
        { type: 'input_value', name: 'COND' },
        { type: 'input_statement', name: 'THEN' },
        { type: 'input_statement', name: 'ELSE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },
    {
      type: 'ctrl_if_no_else',
      message0: 'se %1 então %2',
      args0: [
        { type: 'input_value', name: 'COND' },
        { type: 'input_statement', name: 'THEN' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },
    {
      type: 'ctrl_while',
      message0: 'enquanto %1 faça %2',
      args0: [
        { type: 'input_value', name: 'COND' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },
    {
      type: 'ctrl_for',
      message0: 'para %1 de %2 até %3 passo %4 direção %5 faça %6',
      args0: [
        { type: 'field_input', name: 'VAR', text: 'i' },
        { type: 'input_value', name: 'FROM' },
        { type: 'input_value', name: 'TO' },
        { type: 'input_value', name: 'STEP', check: 'Number' },
        {
          type: 'field_dropdown',
          name: 'DIR',
          options: [
            ['automático', 'AUTO'],
            ['crescente', 'UP'],
            ['decrescente', 'DOWN'],
          ],
        },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },
    {
      type: 'ctrl_break',
      message0: 'parar (break)',
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },

    {
      type: 'array_declare_1d',
      message0: 'declarar vetor %1 : %2 [ %3 .. %4 ]',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'v' },
        {
          type: 'field_dropdown',
          name: 'ELTYPE',
          options: [
            ['inteiro', 'int'],
            ['real', 'double'],
            ['lógico', 'boolean'],
            ['texto', 'String'],
          ],
        },
        { type: 'field_number', name: 'BASE', value: 0, precision: 1 },
        { type: 'field_number', name: 'END', value: 9, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
    {
      type: 'array_get_1d',
      message0: '%1 [ %2 ]',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'v' },
        { type: 'input_value', name: 'INDEX' },
      ],
      output: null,
      colour: 290,
    },
    {
      type: 'array_set_1d',
      message0: '%1 [ %2 ] ← %3',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'v' },
        { type: 'input_value', name: 'INDEX' },
        { type: 'input_value', name: 'VALUE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },

    {
      type: 'array_declare_2d',
      message0: 'declarar matriz %1 : %2 [ %3 .. %4 , %5 .. %6 ]',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'm' },
        {
          type: 'field_dropdown',
          name: 'ELTYPE',
          options: [
            ['inteiro', 'int'],
            ['real', 'double'],
            ['lógico', 'boolean'],
            ['texto', 'String'],
          ],
        },
        { type: 'field_number', name: 'BASE1', value: 0, precision: 1 },
        { type: 'field_number', name: 'END1', value: 2, precision: 1 },
        { type: 'field_number', name: 'BASE2', value: 0, precision: 1 },
        { type: 'field_number', name: 'END2', value: 2, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
    {
      type: 'array_get_2d',
      message0: '%1 [ %2 , %3 ]',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'm' },
        { type: 'input_value', name: 'I' },
        { type: 'input_value', name: 'J' },
      ],
      output: null,
      colour: 290,
    },
    {
      type: 'array_set_2d',
      message0: '%1 [ %2 , %3 ] ← %4',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'm' },
        { type: 'input_value', name: 'I' },
        { type: 'input_value', name: 'J' },
        { type: 'input_value', name: 'VALUE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
  ])

  // Extende o bloco aritmético padrão para incluir o operador de módulo (%).
  Blockly.Blocks['math_arithmetic'] = {
    init: function () {
      this.jsonInit({
        message0: '%1 %2 %3',
        args0: [
          { type: 'input_value', name: 'A', check: 'Number' },
          {
            type: 'field_dropdown',
            name: 'OP',
            options: [
              ['+', 'ADD'],
              ['-', 'MINUS'],
              ['×', 'MULTIPLY'],
              ['÷', 'DIVIDE'],
              ['^', 'POWER'],
              ['%', 'MOD'],
            ],
          },
          { type: 'input_value', name: 'B', check: 'Number' },
        ],
        inputsInline: true,
        output: 'Number',
        colour: '%{BKY_MATH_HUE}',
        helpUrl: '%{BKY_MATH_ARITHMETIC_HELPURL}',
      })

      this.setTooltip(() => {
        const op = this.getFieldValue('OP')
        const tooltips: Record<string, string> = {
          ADD: Blockly.Msg.MATH_ARITHMETIC_TOOLTIP_ADD,
          MINUS: Blockly.Msg.MATH_ARITHMETIC_TOOLTIP_MINUS,
          MULTIPLY: Blockly.Msg.MATH_ARITHMETIC_TOOLTIP_MULTIPLY,
          DIVIDE: Blockly.Msg.MATH_ARITHMETIC_TOOLTIP_DIVIDE,
          POWER: Blockly.Msg.MATH_ARITHMETIC_TOOLTIP_POWER,
          MOD: Blockly.Msg.MATH_MODULO_TOOLTIP,
        }
        return tooltips[op] ?? ''
      })
    },
  }

  // ✅ Blocos de variável via Blockly.Blocks para usar o campo custom PwbFieldVariable

  Blockly.Blocks['var_declare'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('declarar')
        .appendField(
          new Blockly.FieldDropdown([
            ['inteiro', 'int'],
            ['real', 'double'],
            ['lógico', 'boolean'],
            ['texto', 'String'],
          ]),
          'VARTYPE'
        )
        .appendField(new PwbFieldVariable('x'), 'VAR')

      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(330)
    },
  }

  Blockly.Blocks['var_set_custom'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('atribuir')
        .appendField(new PwbFieldVariable('x'), 'VAR')
        .appendField(
          new Blockly.FieldDropdown([
            ['←', 'ASSIGN'],
            ['+=', 'ADD_ASSIGN'],
            ['-=', 'SUB_ASSIGN'],
            ['*=', 'MUL_ASSIGN'],
            ['/=', 'DIV_ASSIGN'],
            ['%=', 'MOD_ASSIGN'],
          ]),
          'ASSIGN_OP'
        )

      this.appendValueInput('VALUE')

      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(330)
    },
  }

  Blockly.Blocks['var_get_custom'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('variável')
        .appendField(new PwbFieldVariable('x'), 'VAR')

      this.setOutput(true)
      this.setColour(330)
    },
  }
}
