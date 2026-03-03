import React, { useEffect, useRef, useState } from 'react'
import * as Blockly from 'blockly'
import BlocklyWorkspace from './components/BlocklyWorkspace'
import { generateJavaFromWorkspace, type WorkspaceHandle } from './blockly/java'
import { generatePortugolFromWorkspace } from './blockly/portugol'
import { generateJsFromWorkspace } from './blockly/js'

type PendingInput = {
  runId: number
  resolve: (value: string) => void
  reject: (error: Error) => void
}

type DialogState =
  | { kind: 'closed' }
  | {
      kind: 'confirm'
      title: string
      message: string
      confirmLabel: string
      cancelLabel: string
      resolve: (accepted: boolean) => void
    }
  | {
      kind: 'prompt'
      title: string
      message: string
      confirmLabel: string
      cancelLabel: string
      defaultValue: string
      resolve: (value: string | null) => void
    }

const WORKSPACE_STORAGE_KEY = 'pwb:blockly:workspace:v1'
type OutputTabId = 'java' | 'portugol'

export default function App() {
  const [javaCode, setJavaCode] = useState<string | null>(null)
  const [portugolCode, setPortugolCode] = useState<string | null>(null)
  const [generatedAtByTab, setGeneratedAtByTab] = useState<{ java: string | null, portugol: string | null }>({
    java: null,
    portugol: null,
  })
  const [activeOutputTab, setActiveOutputTab] = useState<OutputTabId>('java')
  const [status, setStatus] = useState<string>('Pronto.')
  const workspaceRef = useRef<WorkspaceHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workspaceChangeListenerRef = useRef<(() => void) | null>(null)

  // ✅ Execução (UI)
  const [showExec, setShowExec] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [execCollapsed, setExecCollapsed] = useState(false)
  const [outputCollapsed, setOutputCollapsed] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(true)
  const [isExecFullscreen, setIsExecFullscreen] = useState(false)
  const [execHeightPct, setExecHeightPct] = useState(42)
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 980 : false
  ))

  // ✅ Execução (dados)
  const [runOutput, setRunOutput] = useState<string>('')
  const [runStatus, setRunStatus] = useState<string>('Parado.')
  const [liveInput, setLiveInput] = useState<string>('')
  const [awaitingInput, setAwaitingInput] = useState<boolean>(false)
  const [currentPrompt, setCurrentPrompt] = useState<string>('Entrada')

  // "token" simples pra parar execução
  const runIdRef = useRef(0)
  const pendingInputRef = useRef<PendingInput | null>(null)
  const runOutputRef = useRef('')
  const liveInputRef = useRef<HTMLInputElement | null>(null)
  const dialogInputRef = useRef<HTMLInputElement | null>(null)
  const [dialogState, setDialogState] = useState<DialogState>({ kind: 'closed' })
  const [dialogInputValue, setDialogInputValue] = useState('')
  const execResizePointerIdRef = useRef<number | null>(null)

  const onWorkspaceReady = (handle: WorkspaceHandle) => {
    if (workspaceChangeListenerRef.current && workspaceRef.current?.workspace) {
      workspaceRef.current.workspace.removeChangeListener(workspaceChangeListenerRef.current)
    }
    workspaceRef.current = handle
    restoreWorkspaceFromStorage(handle.workspace)

    const onWorkspaceChange = () => {
      persistWorkspaceToStorage(handle.workspace)
    }
    workspaceChangeListenerRef.current = onWorkspaceChange
    handle.workspace.addChangeListener(onWorkspaceChange)
  }

  useEffect(() => {
    return () => {
      if (workspaceChangeListenerRef.current && workspaceRef.current?.workspace) {
        workspaceRef.current.workspace.removeChangeListener(workspaceChangeListenerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!awaitingInput) return
    liveInputRef.current?.focus()
  }, [awaitingInput])

  useEffect(() => {
    if (dialogState.kind !== 'prompt') return
    dialogInputRef.current?.focus()
    dialogInputRef.current?.select()
  }, [dialogState])

  useEffect(() => {
    Blockly.dialog.setConfirm((message, callback) => {
      askConfirm({
        title: 'Confirmação',
        message,
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar',
      }).then(callback)
    })
    Blockly.dialog.setPrompt((message, defaultValue, callback) => {
      askPrompt({
        title: 'Entrada',
        message,
        defaultValue: defaultValue ?? '',
        confirmLabel: 'OK',
        cancelLabel: 'Cancelar',
      }).then(callback)
    })
  }, [])

  useEffect(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
    }
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
    }
    const canRequest = typeof root.requestFullscreen === 'function' || typeof root.webkitRequestFullscreen === 'function'
    const canExit =
      typeof doc.exitFullscreen === 'function' ||
      typeof (doc as Document & { webkitExitFullscreen?: () => Promise<void> | void }).webkitExitFullscreen === 'function'
    setFullscreenSupported(canRequest && canExit)

    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement))
    }
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener)
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setIsNarrowViewport(window.innerWidth <= 980)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onGenerateJava = () => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return
    const code = generateJavaFromWorkspace(ws)
    const generatedAt = new Date().toLocaleTimeString()
    setJavaCode(code)
    setGeneratedAtByTab((prev) => ({ ...prev, java: generatedAt }))
    setActiveOutputTab('java')
    setOutputCollapsed(false)
    setStatus(`Java gerado em ${generatedAt}`)
  }

  const onGeneratePortugol = () => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return
    const code = generatePortugolFromWorkspace(ws)
    const generatedAt = new Date().toLocaleTimeString()
    setPortugolCode(code)
    setGeneratedAtByTab((prev) => ({ ...prev, portugol: generatedAt }))
    setActiveOutputTab('portugol')
    setOutputCollapsed(false)
    setStatus(`Portugol gerado em ${generatedAt}`)
  }

  const outputTabs = [
    javaCode
      ? {
          id: 'java' as const,
          label: 'Java',
          code: javaCode,
          ariaLabel: 'Código Java gerado',
          generatedAt: generatedAtByTab.java,
        }
      : null,
    portugolCode
      ? {
          id: 'portugol' as const,
          label: 'Portugol',
          code: portugolCode,
          ariaLabel: 'Código Portugol gerado',
          generatedAt: generatedAtByTab.portugol,
        }
      : null,
  ].filter((tab): tab is { id: OutputTabId, label: string, code: string, ariaLabel: string, generatedAt: string | null } => Boolean(tab))

  useEffect(() => {
    if (!outputTabs.length) return
    if (!outputTabs.some((tab) => tab.id === activeOutputTab)) {
      setActiveOutputTab(outputTabs[0].id)
    }
  }, [outputTabs, activeOutputTab])

  const activeTab = outputTabs.find((tab) => tab.id === activeOutputTab) ?? outputTabs[0]
  const isOutputCollapsed = outputCollapsed || outputTabs.length === 0
  const outputStatusText = activeTab?.generatedAt ? `${activeTab.label} gerado em ${activeTab.generatedAt}` : status

  const onExpandOutput = () => {
    if (!outputTabs.length) return
    setOutputCollapsed(false)
  }

  const toggleFullscreen = async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => Promise<void> | void
    }
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
    }
    const active = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)

    try {
      if (!active) {
        if (root.requestFullscreen) {
          await root.requestFullscreen()
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen()
        }
      } else if (doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      }
    } catch {
      setStatus('Não foi possível alternar a tela cheia neste navegador.')
    }
  }

  const onNewWorkspace = async () => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return
    const confirmed = await askConfirm({
      title: 'Novo Workspace',
      message: 'Deseja criar um novo workspace?\n\nSugestão: salve os blocos antes em "Salvar".',
      confirmLabel: 'Criar Novo',
      cancelLabel: 'Cancelar',
    })
    if (!confirmed) return

    // se estiver rodando, interrompe
    runIdRef.current += 1
    cancelPendingInput()

    ws.clear()
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    setJavaCode(null)
    setPortugolCode(null)
    setGeneratedAtByTab({ java: null, portugol: null })
    setActiveOutputTab('java')
    setOutputCollapsed(true)
    setStatus('Workspace limpo.')

    // reset execução
    setShowExec(false)
    setExecCollapsed(false)
    setIsExecFullscreen(false)
    setIsRunning(false)
    setRunOutput('')
    setRunStatus('Parado.')
    setLiveInput('')
    setAwaitingInput(false)
    setCurrentPrompt('Entrada')
    runOutputRef.current = ''
  }

  useEffect(() => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return
    requestAnimationFrame(() => Blockly.svgResize(ws))
  }, [isOutputCollapsed, showExec, execCollapsed, javaCode, portugolCode, isExecFullscreen, execHeightPct, isNarrowViewport])

  const onSaveBlocks = async () => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return

    try {
      const suggestedName = buildWorkspaceFileBaseName(ws)
      const chosenName = await askPrompt({
        title: 'Salvar Workspace',
        message: 'Nome do arquivo:',
        defaultValue: suggestedName,
        confirmLabel: 'Salvar',
        cancelLabel: 'Cancelar',
      })
      if (chosenName === null) return
      const safeName = sanitizeFileName(chosenName.trim() || suggestedName)
      const state = Blockly.serialization.workspaces.save(ws)
      const json = JSON.stringify(state, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus('Blocos salvos em arquivo JSON.')
    } catch {
      setStatus('Erro ao salvar os blocos.')
    }
  }

  const onLoadBlocksClick = () => {
    fileInputRef.current?.click()
  }

  const onLoadBlocksFromFile: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const ws = workspaceRef.current?.workspace
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!ws || !file) return

    try {
      const text = await file.text()
      const state = JSON.parse(text)
      ws.clear()
      Blockly.serialization.workspaces.load(state, ws)
      persistWorkspaceToStorage(ws)
      setStatus(`Workspace carregado de "${file.name}".`)
    } catch {
      setStatus('Arquivo inválido. Não foi possível carregar os blocos.')
    }
  }

  const appendOut = (s: string) => {
    runOutputRef.current += s
    setRunOutput(runOutputRef.current)
  }
  const clearOut = () => {
    runOutputRef.current = ''
    setRunOutput('')
  }

  const cancelPendingInput = (message = 'stopped') => {
    const pending = pendingInputRef.current
    if (!pending) return
    pendingInputRef.current = null
    setAwaitingInput(false)
    pending.reject(new Error(message))
  }

  const onSubmitLiveInput = () => {
    const pending = pendingInputRef.current
    if (!pending || !awaitingInput) return
    if (pending.runId !== runIdRef.current) return

    const value = liveInput
    setLiveInput('')
    pendingInputRef.current = null
    setAwaitingInput(false)
    setCurrentPrompt('Entrada')
    setRunStatus('Executando...')
    appendOut(`> ${value}\n`)
    pending.resolve(value)
  }

  const onStop = () => {
    runIdRef.current += 1
    cancelPendingInput()
    setIsRunning(false)
    setRunStatus('Parado.')
    appendOut('\n[Execução interrompida]\n')
  }

  const toggleExecFullscreen = () => {
    setExecCollapsed(false)
    setIsExecFullscreen((v) => !v)
  }

  const onToggleExecCollapsed = () => {
    setExecCollapsed((v) => {
      const next = !v
      if (next) setIsExecFullscreen(false)
      return next
    })
  }

  const onExecResizeStart: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    if (isNarrowViewport || isExecFullscreen || execCollapsed) return
    event.preventDefault()
    execResizePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (execResizePointerIdRef.current !== moveEvent.pointerId) return
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
      const nextPct = ((viewportHeight - moveEvent.clientY) / viewportHeight) * 100
      const clamped = Math.max(28, Math.min(72, nextPct))
      setExecHeightPct(clamped)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (execResizePointerIdRef.current !== upEvent.pointerId) return
      execResizePointerIdRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const onRun = async () => {
    const ws = workspaceRef.current?.workspace
    if (!ws) return

    // ✅ mostra painel de execução somente quando clicar Executar
    setShowExec(true)
    setExecCollapsed(false)

    // ✅ marca como rodando e limpa saída
    setIsRunning(true)
    clearOut()
    setRunStatus('Executando...')
    setLiveInput('')
    setAwaitingInput(false)
    setCurrentPrompt('Entrada')
    pendingInputRef.current = null

    const myRunId = runIdRef.current + 1
    runIdRef.current = myRunId

    // helpers de IO
    const __pwb_print = (s: string) => {
      if (runIdRef.current !== myRunId) return
      appendOut(s)
    }
    const __pwb_println = (s: string) => {
      if (runIdRef.current !== myRunId) return
      appendOut(s + '\n')
    }

    const __pwb_readLine = async () => {
      if (runIdRef.current !== myRunId) throw new Error('stopped')
      setCurrentPrompt(extractCurrentPrompt(runOutputRef.current))
      setRunStatus('Aguardando entrada...')
      setExecCollapsed(false)
      setAwaitingInput(true)
      return await new Promise<string>((resolve, reject) => {
        pendingInputRef.current = { runId: myRunId, resolve, reject }
      })
    }

    const __pwb_readInt = async () => {
      const v = await __pwb_readLine()
      const n = parseInt(v, 10)
      if (Number.isNaN(n)) throw new Error(`Entrada inválida (inteiro): "${v}"`)
      return n
    }

    const __pwb_readDouble = async () => {
      const v = await __pwb_readLine()
      const n = parseFloat(v.replace(',', '.'))
      if (Number.isNaN(n)) throw new Error(`Entrada inválida (real): "${v}"`)
      return n
    }

    const __pwb_readBool = async () => {
      const v = (await __pwb_readLine()).trim().toLowerCase()
      if (['true', 'verdadeiro', 'v'].includes(v)) return true
      if (['false', 'falso', 'f'].includes(v)) return false
      throw new Error(`Entrada inválida (lógico): "${v}"`)
    }

    try {
      const js = generateJsFromWorkspace(ws)

      // sandbox simples: AsyncFunction
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any

      const runner = new AsyncFunction(
        '__pwb_print',
        '__pwb_println',
        '__pwb_readLine',
        '__pwb_readInt',
        '__pwb_readDouble',
        '__pwb_readBool',
        js
      )

      await runner(__pwb_print, __pwb_println, __pwb_readLine, __pwb_readInt, __pwb_readDouble, __pwb_readBool)

      if (runIdRef.current === myRunId) {
        pendingInputRef.current = null
        setAwaitingInput(false)
        setCurrentPrompt('Entrada')
        setRunStatus('Finalizado.')
        setIsRunning(false)
      }
    } catch (e: any) {
      if (String(e?.message || e) === 'stopped') return
      pendingInputRef.current = null
      setAwaitingInput(false)
      setCurrentPrompt('Entrada')
      setRunStatus('Erro.')
      setIsRunning(false)
      appendOut(`\n[ERRO] ${e?.message ?? String(e)}\n`)
    }
  }

  const appClassName = `app${showExec ? ' withExec' : ''}${showExec && execCollapsed ? ' execCollapsed' : ''}${isOutputCollapsed ? ' javaCollapsed' : ''}${isExecFullscreen ? ' execFullscreen' : ''}`
  const appStyle = showExec && !execCollapsed && !isExecFullscreen && !isNarrowViewport
    ? { gridTemplateRows: `minmax(0, ${100 - execHeightPct}%) minmax(0, ${execHeightPct}%)` }
    : undefined

  return (
    <div className={appClassName} style={appStyle}>
      <section className="panel mainPanel">
        <header className="mainHeader">
          <h1>Programming With Blockly</h1>
          <div className="toolbar mainActions">
            <button onClick={onRun}>Executar</button>
            {/* ✅ Parar só aparece se estiver executando */}
            {isRunning && <button onClick={onStop}>Parar</button>}
            <button onClick={onGenerateJava}>Gerar Java</button>
            <button onClick={onGeneratePortugol}>Gerar Portugol</button>
            <button onClick={onSaveBlocks}>Salvar</button>
            <button onClick={onLoadBlocksClick}>Carregar</button>
            <button onClick={onNewWorkspace}>Novo</button>
            {fullscreenSupported && (
              <button onClick={toggleFullscreen}>
                {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={onLoadBlocksFromFile}
            />
          </div>
          <div className="toolbar javaToggleToolbar">
            {isOutputCollapsed && outputTabs.length > 0 && <button onClick={onExpandOutput}>Expandir</button>}
          </div>
        </header>

        <div className="workspaceHost">
          <BlocklyWorkspace onReady={onWorkspaceReady} />
        </div>
      </section>

      {!isOutputCollapsed && activeTab && (
        <section className="panel">
          <header>
            <div>
              <h2>Saída</h2>
              <small className="muted">{outputStatusText}</small>
            </div>
            <div className="toolbar">
              <div className="tabs" role="tablist" aria-label="Linguagens geradas">
                {outputTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tabButton${tab.id === activeTab.id ? ' active' : ''}`}
                    role="tab"
                    aria-selected={tab.id === activeTab.id}
                    onClick={() => setActiveOutputTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setOutputCollapsed(true)}>Minimizar</button>
            </div>
          </header>
          <pre className="code" aria-label={activeTab.ariaLabel}>
            {activeTab.code}
          </pre>
        </section>
      )}

      {/* ✅ Execução só aparece depois que clicar Executar */}
      {showExec && (
        <section className={`panel execPanel ${execCollapsed ? 'collapsed' : ''}`}>
          {!execCollapsed && !isExecFullscreen && !isNarrowViewport && (
            <button
              className="execResizeHandle"
              type="button"
              onPointerDown={onExecResizeStart}
              aria-label="Arraste para redimensionar a área de execução"
              title="Arraste para redimensionar a área de execução"
            />
          )}
          <header>
            <div>
              <h2>Execução</h2>
              <small className="muted">{runStatus}</small>
            </div>
            <div className="toolbar">
              <button onClick={toggleExecFullscreen}>
                {isExecFullscreen ? 'Sair da tela cheia da execução' : 'Tela cheia da execução'}
              </button>
              <button onClick={onToggleExecCollapsed}>
                {execCollapsed ? 'Expandir' : 'Minimizar'}
              </button>
            </div>
          </header>

          {!execCollapsed && <div className="execGrid">
            <div className="execConsole">
              <label className="muted">Console (saída + entradas):</label>
              <pre className="code" aria-label="Saída da execução">
                {runOutput}
              </pre>
            </div>

            <div>
              <label className="muted">{awaitingInput ? currentPrompt : 'Entrada'}</label>
              <div className="inputRow">
                <input
                  ref={liveInputRef}
                  className="liveInput"
                  type="text"
                  value={liveInput}
                  onChange={(e) => setLiveInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmitLiveInput()
                  }}
                  disabled={!awaitingInput}
                  placeholder={awaitingInput ? 'Digite sua resposta e pressione Enter' : 'Aguardando o programa solicitar leia...'}
                />
                <button className="liveButton" onClick={onSubmitLiveInput} disabled={!awaitingInput}>
                  Enviar
                </button>
              </div>
            </div>
          </div>}
        </section>
      )}

      {dialogState.kind !== 'closed' && (
        <div className="dialogBackdrop" role="presentation">
          <div className="dialogCard" role="dialog" aria-modal="true">
            <h3>{dialogState.title}</h3>
            <p>{dialogState.message}</p>

            {dialogState.kind === 'prompt' && (
              <input
                ref={dialogInputRef}
                className="liveInput dialogInput"
                type="text"
                value={dialogInputValue}
                onChange={(e) => setDialogInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmDialog()
                  if (e.key === 'Escape') cancelDialog()
                }}
              />
            )}

            <div className="dialogActions">
              <button onClick={cancelDialog}>{dialogState.cancelLabel}</button>
              <button onClick={confirmDialog}>{dialogState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function askConfirm(args: {
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
  }) {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        kind: 'confirm',
        title: args.title,
        message: args.message,
        confirmLabel: args.confirmLabel,
        cancelLabel: args.cancelLabel,
        resolve,
      })
    })
  }

  function askPrompt(args: {
    title: string
    message: string
    defaultValue: string
    confirmLabel: string
    cancelLabel: string
  }) {
    return new Promise<string | null>((resolve) => {
      setDialogInputValue(args.defaultValue)
      setDialogState({
        kind: 'prompt',
        title: args.title,
        message: args.message,
        defaultValue: args.defaultValue,
        confirmLabel: args.confirmLabel,
        cancelLabel: args.cancelLabel,
        resolve,
      })
    })
  }

  function cancelDialog() {
    const current = dialogState
    if (current.kind === 'closed') return
    if (current.kind === 'confirm') current.resolve(false)
    if (current.kind === 'prompt') current.resolve(null)
    setDialogState({ kind: 'closed' })
  }

  function confirmDialog() {
    const current = dialogState
    if (current.kind === 'closed') return
    if (current.kind === 'confirm') current.resolve(true)
    if (current.kind === 'prompt') current.resolve(dialogInputValue)
    setDialogState({ kind: 'closed' })
  }
}

function extractCurrentPrompt(output: string) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line.startsWith('>') && !line.startsWith('[ERRO]')) return line
  }

  return 'Entrada'
}

function persistWorkspaceToStorage(workspace: Blockly.Workspace) {
  try {
    const state = Blockly.serialization.workspaces.save(workspace)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignora erros de serialização/localStorage
  }
}

function restoreWorkspaceFromStorage(workspace: Blockly.Workspace) {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return
    const state = JSON.parse(raw)
    workspace.clear()
    Blockly.serialization.workspaces.load(state, workspace)
  } catch {
    // ignora dados inválidos
  }
}

function buildWorkspaceFileBaseName(workspace: Blockly.Workspace) {
  const programBlock = workspace.getTopBlocks(false).find((block) => block.type === 'program_main')
  const rawName = programBlock?.getFieldValue('NAME') || 'pwb-workspace'
  return sanitizeFileName(rawName)
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'pwb-workspace'
}
