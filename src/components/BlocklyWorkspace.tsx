import React, { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import 'blockly/blocks'
import * as PtBr from 'blockly/msg/pt-br'
import { toolboxXml } from '../blockly/toolbox'
import { registerCustomBlocks } from '../blockly/blocks'
import { initJavaGenerator, type WorkspaceHandle } from '../blockly/java'
import { initJsGenerator } from '../blockly/js'

type Props = {
  onReady?: (handle: WorkspaceHandle) => void
}

const CATEGORY_BLOCK_COLOURS: Record<string, string> = {
  io_print_inline: '#5CA65C',
  io_print_line: '#5CA65C',
  io_read: '#5CA65C',
  math_number: '#5CA65C',
  text: '#5CA65C',
  text_join: '#5CA65C',

  logic_boolean: '#A6745C',
  math_arithmetic: '#A6745C',
  logic_compare: '#A6745C',
  logic_operation: '#A6745C',
  logic_negate: '#A6745C',

  math_randi: '#3F8F80',
  text_upper: '#3F8F80',
  text_lower: '#3F8F80',
}

function recolorBlocksByCategory(workspace: Blockly.Workspace) {
  workspace.getAllBlocks(false).forEach((block) => {
    const colour = CATEGORY_BLOCK_COLOURS[block.type]
    if (colour) block.setColour(colour)
  })
}

export default function BlocklyWorkspace({ onReady }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const ptBrLocale = Object.fromEntries(
      Object.entries(PtBr).filter(([k]) => k !== 'default')
    ) as { [key: string]: string }

    Blockly.setLocale(ptBrLocale)
    registerCustomBlocks()
    initJavaGenerator()
    initJsGenerator()

    const workspace = Blockly.inject(hostRef.current, {
      toolbox: toolboxXml,
      trashcan: true,
      scrollbars: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2.0,
        minScale: 0.4,
        scaleSpeed: 1.1,
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: '#2a2d45',
        snap: true,
      },
      theme: Blockly.Theme.defineTheme('pwb-dark', {
        // Blockly v11 não expõe mais Themes.Dark; usamos um tema base (Classic)
        // e sobrescrevemos as cores do workspace/toolbox.
        name: 'pwb-dark',
        base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: '#0b0c10',
          toolboxBackgroundColour: '#111218',
          toolboxForegroundColour: '#e6e6e6',
          flyoutBackgroundColour: '#111218',
          flyoutForegroundColour: '#e6e6e6',
          flyoutOpacity: 0.98,
          scrollbarColour: '#222437',
          insertionMarkerColour: '#ffffff',
          insertionMarkerOpacity: 0.25,
        },
      }),
    })

    const recolorAll = () => {
      recolorBlocksByCategory(workspace)
      const flyoutWorkspace = (workspace as any).getFlyout?.()?.getWorkspace?.() as Blockly.Workspace | undefined
      if (flyoutWorkspace) recolorBlocksByCategory(flyoutWorkspace)
    }
    recolorAll()
    const recolorListener = () => recolorAll()
    workspace.addChangeListener(recolorListener)

    onReady?.({ workspace })

    const onResize = () => Blockly.svgResize(workspace)
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      workspace.removeChangeListener(recolorListener)
      workspace.dispose()
    }
  }, [])

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
}
