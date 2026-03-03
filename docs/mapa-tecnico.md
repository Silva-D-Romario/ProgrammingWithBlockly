# Mapa Técnico do Sistema (PWB)

## Visão rápida

| Arquivo | Responsabilidade principal | Funções/estruturas-chave | Observações |
|---|---|---|---|
| `src/App.tsx` | Orquestra toda a aplicação (UI, estados, geração, execução, salvar/carregar) | `App`, `onGenerateJava`, `onGeneratePortugol`, `onRun`, `onSaveBlocks`, `onLoadBlocksFromFile`, `persistWorkspaceToStorage`, `restoreWorkspaceFromStorage` | É o "controlador" principal do frontend. |
| `src/components/BlocklyWorkspace.tsx` | Inicializa e configura o workspace Blockly | `BlocklyWorkspace`, `recolorBlocksByCategory` | Faz `Blockly.inject`, aplica locale PT-BR, tema, toolbox e listeners. |
| `src/blockly/blocks.ts` | Define blocos customizados do domínio | `PwbFieldVariable`, `registerCustomBlocks` | Contém a única classe custom explícita (`PwbFieldVariable`). |
| `src/blockly/toolbox.ts` | Declara o XML da toolbox (categorias e blocos) | `toolboxXml` | Controla o que aparece no menu lateral. |
| `src/blockly/js.ts` | Gera JavaScript a partir dos blocos para execução no navegador | `initJsGenerator`, `generateJsFromWorkspace` | Base da execução simulada com `AsyncFunction` em `App.tsx`. |
| `src/blockly/java.ts` | Gera código Java a partir dos blocos | `initJavaGenerator`, `generateJavaFromWorkspace` | Geração textual de Java (não compila). |
| `src/blockly/portugol.ts` | Gera código Portugol (estilo Visualg) a partir dos blocos | `generatePortugolFromWorkspace` | Geração textual de Portugol (não executa diretamente). |
| `src/styles.css` | Estilo da interface (layout, painéis, abas, execução) | classes CSS (`.app`, `.panel`, `.tabs`, `.execPanel` etc.) | Regras de layout responsivo e aparência dos painéis. |

## Onde está cada lógica importante

| Tema | Onde fica | Como funciona |
|---|---|---|
| Salvar blocos em JSON (arquivo) | `src/App.tsx` (`onSaveBlocks`) | Serializa workspace com `Blockly.serialization.workspaces.save`, cria `Blob` e dispara download `.json`. |
| Carregar blocos de JSON (arquivo) | `src/App.tsx` (`onLoadBlocksFromFile`) | Lê arquivo, faz `JSON.parse` e aplica com `Blockly.serialization.workspaces.load`. |
| Auto-save local | `src/App.tsx` (`onWorkspaceReady` + `persistWorkspaceToStorage`) | Listener de mudança no workspace salva no `localStorage`. |
| Restore local | `src/App.tsx` (`restoreWorkspaceFromStorage`) | Ao iniciar workspace, tenta recuperar estado salvo do `localStorage`. |
| Geração Java | `src/App.tsx` + `src/blockly/java.ts` | Botão chama `generateJavaFromWorkspace`, resultado vai para aba de saída. |
| Geração Portugol | `src/App.tsx` + `src/blockly/portugol.ts` | Botão chama `generatePortugolFromWorkspace`, resultado vai para aba de saída. |
| Execução do programa | `src/App.tsx` + `src/blockly/js.ts` | Converte blocos para JS, executa com `AsyncFunction` e usa helpers `__pwb_read*`/`__pwb_print*`. |
| Definição dos blocos | `src/blockly/blocks.ts` | Registra blocos de programa, variáveis, IO, controle, operadores e vetores/matrizes. |
| Menu lateral de blocos | `src/blockly/toolbox.ts` | XML com categorias: Programa, Variáveis, Entrada/Saída, Operadores, Funções, Controle, Vetor/Matriz. |

## Estruturas de estado principais (App)

| Estado | Tipo | Finalidade |
|---|---|---|
| `javaCode` | `string \| null` | Código Java gerado para exibição em aba. |
| `portugolCode` | `string \| null` | Código Portugol gerado para exibição em aba. |
| `activeOutputTab` | `'java' \| 'portugol'` | Aba ativa da área de saída. |
| `generatedAtByTab` | `{ java: string \| null, portugol: string \| null }` | Horário de geração por linguagem. |
| `showExec` / `isRunning` | `boolean` | Controle de visibilidade e status do painel de execução. |
| `runOutput` / `runStatus` | `string` | Conteúdo e status textual da execução. |
| `awaitingInput` / `currentPrompt` | `boolean` / `string` | Controla quando o programa está esperando entrada do usuário. |

## Classe customizada existente

| Classe | Arquivo | Papel |
|---|---|---|
| `PwbFieldVariable` | `src/blockly/blocks.ts` | Extende `Blockly.FieldVariable` para incluir opção "Criar nova variável..." diretamente no dropdown do bloco. |

## Fluxo resumido

1. Usuário monta blocos no workspace (`BlocklyWorkspace`).
2. Mudanças são persistidas automaticamente no `localStorage`.
3. Usuário pode salvar/carregar arquivo `.json` do workspace.
4. Usuário gera Java ou Portugol; a saída aparece em abas.
5. Usuário executa; o sistema gera JS e roda localmente com entrada/saída controlada.
