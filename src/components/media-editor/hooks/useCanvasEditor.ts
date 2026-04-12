import { useEffect, useRef, useState, useCallback } from 'react'
import { fabric } from 'fabric'
import { dataUrlToBlob, clampDimensions } from '../utils/imageExport'

export type FabricTool = 'draw' | 'text' | 'sticker' | 'crop' | 'none'

const DRAW_COLORS = ['#ff0000', '#ffffff', '#000000', '#00e5ff', '#69ff47', '#ff00c8', '#ff9800']
const DEFAULT_DRAW_COLOR = '#ff0000'

export function useCanvasEditor(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  imageUrl: string | null
) {
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [activeTool, setActiveTool] = useState<FabricTool>('none')
  const [drawColor, setDrawColor] = useState(DEFAULT_DRAW_COLOR)
  const drawColorRef = useRef(DEFAULT_DRAW_COLOR)

  // Undo/redo stacks stored as JSON snapshots
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isMutating = useRef(false)

  // Crop state
  const cropRectRef = useRef<fabric.Rect | null>(null)
  const cropMasksRef = useRef<fabric.Rect[]>([])
  const cropRegionRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)

  const saveSnapshot = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || isMutating.current) return
    undoStack.current.push(JSON.stringify(canvas.toJSON()))
    redoStack.current = []
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    let disposed = false

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
    })
    fabricRef.current = canvas

    canvas.on('object:modified', saveSnapshot)
    canvas.on('path:created', saveSnapshot)

    if (imageUrl) {
      fabric.Image.fromURL(
        imageUrl,
        (img) => {
          if (disposed || !fabricRef.current) return

          const { width: cw, height: ch } = clampDimensions(
            img.width || 800,
            img.height || 600,
            Math.min(window.innerWidth * 0.92, 1280)
          )
          const scaleX = cw / (img.width || 1)
          const scaleY = ch / (img.height || 1)

          canvas.setWidth(cw)
          canvas.setHeight(ch)

          img.set({ scaleX, scaleY, left: 0, top: 0, selectable: false, evented: false })
          canvas.add(img)
          canvas.sendToBack(img)
          canvas.renderAll()

          undoStack.current = [JSON.stringify(canvas.toJSON())]
        },
        { crossOrigin: 'anonymous' }
      )
    }

    return () => {
      disposed = true
      canvas.dispose()
      fabricRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const removeCropOverlay = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (cropRectRef.current) {
      canvas.remove(cropRectRef.current)
      cropRectRef.current = null
    }
    cropMasksRef.current.forEach((m) => canvas.remove(m))
    cropMasksRef.current = []
  }, [])

  const updateMasks = useCallback((cropRect: fabric.Rect) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const cw = canvas.width ?? 0
    const ch = canvas.height ?? 0
    const left = cropRect.left ?? 0
    const top = cropRect.top ?? 0
    const w = (cropRect.width ?? 100) * (cropRect.scaleX ?? 1)
    const h = (cropRect.height ?? 100) * (cropRect.scaleY ?? 1)

    const maskProps = {
      fill: 'rgba(0,0,0,0.5)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
    } as fabric.IRectOptions

    const masks = [
      // Top
      new fabric.Rect({ ...maskProps, left: 0, top: 0, width: cw, height: top }),
      // Bottom
      new fabric.Rect({ ...maskProps, left: 0, top: top + h, width: cw, height: ch - top - h }),
      // Left
      new fabric.Rect({ ...maskProps, left: 0, top, width: left, height: h }),
      // Right
      new fabric.Rect({ ...maskProps, left: left + w, top, width: cw - left - w, height: h }),
    ]

    cropMasksRef.current.forEach((m) => canvas.remove(m))
    cropMasksRef.current = masks
    masks.forEach((m) => canvas.add(m))

    // Keep crop rect on top
    canvas.bringToFront(cropRect)
    canvas.renderAll()
  }, [])

  // ─── Tools ───────────────────────────────────────────────────────────────

  const setTool = useCallback(
    (tool: FabricTool) => {
      const canvas = fabricRef.current
      if (!canvas) return

      // Leaving crop without confirming → cancel
      if (activeTool === 'crop' && tool !== 'crop') {
        removeCropOverlay()
        cropRegionRef.current = null
      }

      setActiveTool(tool)
      canvas.isDrawingMode = tool === 'draw'

      if (tool === 'draw') {
        const brush = new fabric.PencilBrush(canvas)
        brush.color = drawColorRef.current
        brush.width = 6
        canvas.freeDrawingBrush = brush
      } else if (tool === 'none') {
        canvas.discardActiveObject()
        canvas.renderAll()
      }
    },
    [activeTool, removeCropOverlay]
  )

  const activateCrop = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    setActiveTool('crop')
    canvas.isDrawingMode = false

    const cw = canvas.width ?? 400
    const ch = canvas.height ?? 300
    const pad = 20

    const cropRect = new fabric.Rect({
      left: pad,
      top: pad,
      width: cw - pad * 2,
      height: ch - pad * 2,
      fill: 'transparent',
      stroke: '#ffffff',
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: true,
      hasRotatingPoint: false,
      lockRotation: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    cropRectRef.current = cropRect
    canvas.add(cropRect)
    canvas.setActiveObject(cropRect)
    updateMasks(cropRect)

    // Redraw masks as the user resizes/moves the crop rect
    canvas.on('object:moving', (e) => {
      if (e.target === cropRect) updateMasks(cropRect)
    })
    canvas.on('object:scaling', (e) => {
      if (e.target === cropRect) updateMasks(cropRect)
    })
  }, [updateMasks])

  const confirmCrop = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || !cropRectRef.current) return

    const cropRect = cropRectRef.current
    const left = cropRect.left ?? 0
    const top = cropRect.top ?? 0
    const width = (cropRect.width ?? 100) * (cropRect.scaleX ?? 1)
    const height = (cropRect.height ?? 100) * (cropRect.scaleY ?? 1)

    cropRegionRef.current = { left, top, width, height }

    removeCropOverlay()
    setActiveTool('none')
    canvas.discardActiveObject()
    canvas.renderAll()
  }, [removeCropOverlay])

  const cancelCrop = useCallback(() => {
    removeCropOverlay()
    cropRegionRef.current = null
    setActiveTool('none')
    const canvas = fabricRef.current
    if (canvas) {
      canvas.discardActiveObject()
      canvas.renderAll()
    }
  }, [removeCropOverlay])

  const changeDrawColor = useCallback((color: string) => {
    setDrawColor(color)
    drawColorRef.current = color
    const canvas = fabricRef.current
    if (canvas?.isDrawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color
    }
  }, [])

  const addText = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    saveSnapshot()
    const text = new fabric.IText('Type here', {
      left: (canvas.width ?? 400) / 2,
      top: (canvas.height ?? 300) / 2,
      fontFamily: 'Inter, Roboto, sans-serif',
      fill: '#ffffff',
      fontSize: Math.max(28, Math.round((canvas.width ?? 400) / 12)),
      originX: 'center',
      originY: 'center',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.6)', blur: 3 }),
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
    setActiveTool('text')
  }, [saveSnapshot])

  const addSticker = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    saveSnapshot()
    const emojis = ['😎', '❤️', '🔥', '✨', '😂', '👍', '🎉']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]
    const sticker = new fabric.Text(emoji, {
      left: (canvas.width ?? 400) / 2,
      top: (canvas.height ?? 300) / 2,
      fontSize: 64,
      originX: 'center',
      originY: 'center',
    })
    canvas.add(sticker)
    canvas.setActiveObject(sticker)
    canvas.renderAll()
    setActiveTool('sticker')
  }, [saveSnapshot])

  const rotateActiveOrImage = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    saveSnapshot()
    const obj = canvas.getActiveObject()
    if (obj) {
      obj.rotate(((obj.angle ?? 0) + 90) % 360)
      canvas.renderAll()
    }
  }, [saveSnapshot])

  const undo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || undoStack.current.length <= 1) return
    const current = undoStack.current.pop()!
    redoStack.current.push(current)
    const prev = undoStack.current[undoStack.current.length - 1]
    isMutating.current = true
    canvas.loadFromJSON(prev, () => {
      canvas.renderAll()
      isMutating.current = false
    })
  }, [])

  const redo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(next)
    isMutating.current = true
    canvas.loadFromJSON(next, () => {
      canvas.renderAll()
      isMutating.current = false
    })
  }, [])

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (obj && obj.selectable) {
      saveSnapshot()
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.renderAll()
    }
  }, [saveSnapshot])

  const exportBlob = useCallback(async (): Promise<Blob> => {
    const canvas = fabricRef.current
    if (!canvas) throw new Error('Canvas not initialized')

    canvas.discardActiveObject()
    canvas.renderAll()

    const region = cropRegionRef.current
    const dataUrl = region
      ? canvas.toDataURL({
          format: 'jpeg',
          quality: 0.88,
          left: region.left,
          top: region.top,
          width: region.width,
          height: region.height,
        })
      : canvas.toDataURL({ format: 'jpeg', quality: 0.82 })

    return dataUrlToBlob(dataUrl)
  }, [])

  return {
    activeTool,
    setTool,
    drawColor,
    changeDrawColor,
    drawColors: DRAW_COLORS,
    addText,
    addSticker,
    rotateActiveOrImage,
    activateCrop,
    confirmCrop,
    cancelCrop,
    undo,
    redo,
    deleteSelected,
    exportBlob,
  }
}
