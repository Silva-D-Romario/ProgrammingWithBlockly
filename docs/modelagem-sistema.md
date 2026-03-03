# Modelagem do Sistema PWB (Programming With Blockly)

Este documento descreve a modelagem do sistema atual (React + Blockly + geradores Java/Portugol + execução via JS).

## 1) Diagrama de Contexto

```mermaid
flowchart LR
  A[Professor/Aluno] -->|Monta blocos, gera código, executa| PWB[PWB Web App]
  PWB -->|Persistência local| LS[LocalStorage do Navegador]
  PWB -->|Download/Upload JSON| ARQ[Arquivos .json de workspace]
  PWB -->|Renderização visual de blocos| B[Blockly]
```

## 2) Diagrama de Casos de Uso

```mermaid
flowchart TB
  U[Usuário]
  subgraph Sistema[PWB]
    UC1((Montar programa em blocos))
    UC2((Salvar workspace))
    UC3((Carregar workspace))
    UC4((Gerar Java))
    UC5((Gerar Portugol))
    UC6((Executar programa))
    UC7((Fornecer entrada durante execução))
    UC8((Alternar abas Java/Portugol))
    UC9((Novo workspace))
  end

  U --> UC1
  U --> UC2
  U --> UC3
  U --> UC4
  U --> UC5
  U --> UC6
  U --> UC7
  U --> UC8
  U --> UC9
```

## 3) Diagrama de Componentes (Arquitetura)

```mermaid
flowchart TB
  subgraph UI[Frontend React]
    App[App.tsx]
    W[BlocklyWorkspace.tsx]
  end

  subgraph BlocklyLayer[Camada Blockly]
    Blocks[blocks.ts <br/> blocos customizados]
    Toolbox[toolbox.ts]
  end

  subgraph Gen[Geradores de Código]
    JavaGen[java.ts]
    PortGen[portugol.ts]
    JsGen[js.ts]
  end

  Storage[LocalStorage]

  App --> W
  W --> Blocks
  W --> Toolbox
  W --> JavaGen
  W --> JsGen

  App --> JavaGen
  App --> PortGen
  App --> JsGen
  App --> Storage
```

## 4) Diagrama de Classes Lógicas (Modelo de Domínio Técnico)

```mermaid
classDiagram
  class App {
    +javaCode: string|null
    +portugolCode: string|null
    +activeOutputTab: OutputTabId
    +onGenerateJava()
    +onGeneratePortugol()
    +onRun()
    +onSaveBlocks()
    +onLoadBlocksFromFile()
  }

  class BlocklyWorkspace {
    +onReady(handle)
    +injectWorkspace()
    +registerCustomBlocks()
  }

  class JavaGenerator {
    +initJavaGenerator()
    +generateJavaFromWorkspace(ws)
  }

  class PortugolGenerator {
    +generatePortugolFromWorkspace(ws)
  }

  class JsGenerator {
    +initJsGenerator()
    +generateJsFromWorkspace(ws)
  }

  class BlocklyWorkspaceState {
    +save(state)
    +load(state)
  }

  App --> BlocklyWorkspace : renderiza
  App --> JavaGenerator : usa
  App --> PortugolGenerator : usa
  App --> JsGenerator : usa
  App --> BlocklyWorkspaceState : persiste/recupera
  BlocklyWorkspace --> JavaGenerator : inicializa
  BlocklyWorkspace --> JsGenerator : inicializa
```

## 5) Diagrama de Sequência: Gerar Código (Java/Portugol)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant A as App.tsx
  participant WS as Workspace Blockly
  participant J as java.ts
  participant P as portugol.ts

  U->>A: Clica em "Gerar Java"
  A->>WS: obter workspace atual
  A->>J: generateJavaFromWorkspace(ws)
  J-->>A: código Java
  A-->>U: exibe/expande aba "Java"

  U->>A: Clica em "Gerar Portugol"
  A->>WS: obter workspace atual
  A->>P: generatePortugolFromWorkspace(ws)
  P-->>A: código Portugol
  A-->>U: exibe/expande aba "Portugol"
```

## 6) Diagrama de Sequência: Execução (interpretada via JS)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant A as App.tsx
  participant WS as Workspace Blockly
  participant G as js.ts
  participant R as Runner AsyncFunction

  U->>A: Clica em "Executar"
  A->>WS: obter workspace
  A->>G: generateJsFromWorkspace(ws)
  G-->>A: código JS equivalente
  A->>R: criar e executar função assíncrona
  R-->>A: saída parcial (__pwb_print/println)
  A-->>U: atualiza console de execução
  R->>A: solicita entrada (__pwb_readLine)
  A-->>U: habilita campo de entrada
  U->>A: envia valor
  A-->>R: resolve promise de entrada
  R-->>A: finalização/erro
  A-->>U: status final da execução
```

## 7) Diagrama de Atividade: Fluxo Principal do Usuário

```mermaid
flowchart TD
  I([Início]) --> B[Montar blocos no workspace]
  B --> C{Ação}
  C -->|Gerar Java| J[Atualiza aba Java + timestamp]
  C -->|Gerar Portugol| P[Atualiza aba Portugol + timestamp]
  C -->|Executar| E[Gerar JS + executar]
  C -->|Salvar| S[Exportar JSON]
  C -->|Carregar| L[Importar JSON]
  C -->|Novo| N[Limpar workspace e estados]
  J --> C
  P --> C
  E --> C
  S --> C
  L --> C
  N --> C
```

## Observações de modelagem

- O sistema é 100% client-side no estado atual.
- A execução usa tradução para JavaScript e um runner assíncrono local.
- Java/Portugol são saídas de geração (não compilação/execução real dessas linguagens).
- Persistência de workspace usa LocalStorage + arquivo JSON.
