# Programming With Blockly (PWB)

Aplicação web para ensino introdutório de programação usando blocos visuais (Blockly), com geração de código textual e execução direta no navegador.

## O que é

O **Programming With Blockly** é um ambiente de programação visual onde a pessoa monta algoritmos arrastando blocos, sem precisar escrever código manualmente no início.

O projeto foi feito para apoiar aprendizado de lógica de programação de forma mais acessível e progressiva.

## Objetivo do projeto

- Facilitar o primeiro contato com programação.
- Permitir criar algoritmos com blocos de forma intuitiva.
- Mostrar a equivalência entre blocos e código textual.
- Ajudar em contextos educacionais (aulas, monitoria, estudo individual).

## Principais funcionalidades

- Workspace com Blockly em português.
- Categorias de blocos para:
  - Programa principal
  - Variáveis
  - Entrada/Saída
  - Operadores
  - Funções
  - Controle
  - Vetor/Matriz
- Execução do algoritmo no navegador com console de saída.
- Entrada dinâmica durante execução (`leia`).
- Geração de código:
  - Java
  - Portugol
- Salvar e carregar workspace em `.json`.
- Limpar workspace com confirmação.
- Interface responsiva com melhorias para uso em celular.
- Opções de tela cheia (geral e da área de execução).

## Tecnologias utilizadas

- **React**
- **TypeScript**
- **Vite**
- **Blockly**

## Pré-requisitos

- **Node.js 18+** (recomendado)
- **npm**

## Como executar localmente

1. Clone o repositório:

```bash
git clone <https://github.com/Silva-D-Romario/ProgrammingWithBlockly.git>
cd PWB-ProgrammingWithBlockly
```

2. Instale as dependências:

```bash
npm install
```

3. Execute em modo desenvolvimento:

```bash
npm run dev
```

4. Abra no navegador o endereço exibido no terminal (normalmente `http://localhost:5173`).

## Como testar rapidamente

1. Clique em **Executar** para abrir o painel de execução.
2. Monte um exemplo simples com bloco de saída (`escreval`).
3. Rode o programa e confira a saída no console.
4. Gere código em **Java** e **Portugol** pelos botões da barra superior.
5. Teste **Salvar** e **Carregar** para validar persistência do workspace.

## Build de produção

Para gerar versão otimizada:

```bash
npm run build
```

Os arquivos finais serão gerados em `dist/`.

## Documentação adicional

A pasta [`docs/`](./docs) contém materiais técnicos do projeto, incluindo modelagem e mapa técnico.

## Estrutura básica

```text
src/
  blockly/        # Blocos, geradores e toolbox
  components/     # Componentes React
  App.tsx         # Layout principal e lógica de execução
  styles.css      # Estilos globais e responsividade
```

## Status

Projeto acadêmico em evolução contínua.
