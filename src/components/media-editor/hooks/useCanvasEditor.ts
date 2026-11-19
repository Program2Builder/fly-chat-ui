import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'
import { dataUrlToBlob } from '../utils/imageExport'

export type FabricTool = 'draw' | 'text' | 'sticker' | 'crop' | 'none'

const DRAW_COLORS = ['#ff0000', '#ffffff', '#000000', '#00e5ff', '#69ff47', '#ff00c8', '#ff9800']
const DEFAULT_DRAW_COLOR = '#ff0000'

export function useCanvasEditor(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  imageUrl: string | null,
  containerRef?: React.RefObject<HTMLElement | null>
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
  const cropTransformHandlerRef = useRef<((e: fabric.CanvasEvents['object:moving']) => void) | null>(null)
  const cropRegionRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)

  // Natural (unscaled) source image size, used to export at full resolution.
  const sourceSizeRef = useRef<{ width: number; height: number } | null>(null)
  // Last canvas size applied by the fit logic.
  const fitKeyRef = useRef<string | null>(null)

  const saveSnapshot = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || isMutating.current) return
    undoStack.current.push(JSON.stringify(canvas.toJSON()))
    redoStack.current = []
  }, [])

  // Scale the canvas (and its image) so the whole image fits the visible area.
  const fitImageToContainer = useCallback(
    (canvas: fabric.Canvas, img: fabric.FabricImage, force = false) => {
      const naturalWidth = img.width || 1
      const naturalHeight = img.height || 1

      let maxWidth = Math.min(window.innerWidth * 0.92, 1280)
      let maxHeight = window.innerHeight * 0.9

      const container = containerRef?.current
      if (container) {
        const style = window.getComputedStyle(container)
        const availableWidth =
          container.clientWidth -
          (parseFloat(style.paddingLeft) || 0) -
          (parseFloat(style.paddingRight) || 0)
        const availableHeight =
          container.clientHeight -
          (parseFloat(style.paddingTop) || 0) -
          (parseFloat(style.paddingBottom) || 0)
        if (availableWidth > 0) maxWidth = availableWidth
        if (availableHeight > 0) maxHeight = availableHeight
      }

      const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1)
      const width = Math.max(1, Math.round(naturalWidth * ratio))
      const height = Math.max(1, Math.round(naturalHeight * ratio))

      // Avoid pointless re-renders (and ResizeObserver feedback loops) when
      // the available area did not actually change.
      const fitKey = `${width}x${height}`
      if (!force && fitKeyRef.current === fitKey) return
      fitKeyRef.current = fitKey

      canvas.setDimensions({ width, height })
      // Fabric v6+ defaults to a centered origin; anchor the photo to the
      // top-left of the canvas so the whole image is visible instead of only
      // its bottom-right quadrant.
      img.set({
        originX: 'left',
        originY: 'top',
        scaleX: width / naturalWidth,
        scaleY: height / naturalHeight,
        left: 0,
        top: 0,
        objectCaching: false,
      })
      img.setCoords()
      canvas.renderAll()
    },
    [containerRef]
  )

  useEffect(() => {
    if (!canvasRef.current) return

    let disposed = false

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
    })
    fabricRef.current = canvas
    undoStack.current = []
    redoStack.current = []
    cropRectRef.current = null
    cropMasksRef.current = []
    cropTransformHandlerRef.current = null
    cropRegionRef.current = null
    sourceSizeRef.current = null
    fitKeyRef.current = null

    canvas.on('object:modified', saveSnapshot)
    canvas.on('path:created', saveSnapshot)

    if (imageUrl) {
      fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' })
        .then((img) => {
          if (disposed || fabricRef.current !== canvas) return

          img.set({ selectable: false, evented: false })
          canvas.add(img)
          canvas.sendObjectToBack(img)
          sourceSizeRef.current = {
            width: img.width || canvas.width || 1,
            height: img.height || canvas.height || 1,
          }
          fitImageToContainer(canvas, img)

          undoStack.current = [JSON.stringify(canvas.toJSON())]
        })
        .catch((error) => {
          if (!disposed) {
            console.error('Failed to load image for canvas editor', error)
          }
        })
    }

    return () => {
      disposed = true
      canvas.dispose()
      fabricRef.current = null
    }
  }, [canvasRef, fitImageToContainer, imageUrl, saveSnapshot])

  // Refit the image when the editor area is resized.
  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      const canvas = fabricRef.current
      if (!canvas) return
      const image = canvas
        .getObjects()
        .find((obj): obj is fabric.FabricImage => obj instanceof fabric.FabricImage)
      if (image) fitImageToContainer(canvas, image)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, fitImageToContainer])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const removeCropOverlay = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (cropTransformHandlerRef.current) {
      canvas.off('object:moving', cropTransformHandlerRef.current)
      canvas.off('object:scaling', cropTransformHandlerRef.current)
      cropTransformHandlerRef.current = null
    }
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

    const maskProps: Partial<fabric.RectProps> = {
      fill: 'rgba(0,0,0,0.5)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      originX: 'left',
      originY: 'top',
    }

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
    canvas.bringObjectToFront(cropRect)
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
    if (!canvas || cropRectRef.current) return

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
      lockRotation: true,
      excludeFromExport: true,
      originX: 'left',
      originY: 'top',
    })

    cropRectRef.current = cropRect
    canvas.add(cropRect)
    canvas.setActiveObject(cropRect)
    updateMasks(cropRect)

    // Redraw masks as the user resizes/moves the crop rect
    const handleCropTransform = (e: fabric.CanvasEvents['object:moving']) => {
      if (e.target === cropRect) updateMasks(cropRect)
    }
    cropTransformHandlerRef.current = handleCropTransform
    canvas.on('object:moving', handleCropTransform)
    canvas.on('object:scaling', handleCropTransform)
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
    canvas.isDrawingMode = false
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
    saveSnapshot()
    setActiveTool('text')
  }, [saveSnapshot])

  const addSticker = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.isDrawingMode = false
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
    saveSnapshot()
    setActiveTool('sticker')
  }, [saveSnapshot])

  const rotateActiveOrImage = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (obj) {
      obj.rotate(((obj.angle ?? 0) + 90) % 360)
      obj.setCoords()
      canvas.renderAll()
      saveSnapshot()
    }
  }, [saveSnapshot])

  const applySnapshot = useCallback(async (json: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    isMutating.current = true
    try {
      await canvas.loadFromJSON(json)
      // The source image is serialized as a regular object, so restore its
      // non-interactive flags after every history restore.
      canvas.getObjects().forEach((obj) => {
        if (obj instanceof fabric.FabricImage) {
          obj.set({ selectable: false, evented: false })
        }
      })
      canvas.requestRenderAll()
    } finally {
      isMutating.current = false
    }
  }, [])

  const undo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || undoStack.current.length <= 1) return
    const current = undoStack.current.pop()!
    redoStack.current.push(current)
    const prev = undoStack.current[undoStack.current.length - 1]
    void applySnapshot(prev)
  }, [applySnapshot])

  const redo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(next)
    void applySnapshot(next)
  }, [applySnapshot])

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (obj && obj.selectable) {
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.renderAll()
      saveSnapshot()
    }
  }, [saveSnapshot])

  const exportBlob = useCallback(async (): Promise<Blob> => {
    const canvas = fabricRef.current
    if (!canvas) throw new Error('Canvas not initialized')

    canvas.discardActiveObject()
    canvas.renderAll()

    // Render the export at (up to) the source image resolution so annotations
    // stay sharp instead of being limited to the on-screen canvas size.
    const source = sourceSizeRef.current
    const displayWidth = canvas.width || 1
    const multiplier = source
      ? Math.min(4, Math.max(1, source.width / displayWidth))
      : 1

    const region = cropRegionRef.current
    const dataUrl = region
      ? canvas.toDataURL({
          format: 'jpeg',
          quality: 0.88,
          multiplier,
          left: region.left,
          top: region.top,
          width: region.width,
          height: region.height,
        })
      : canvas.toDataURL({ format: 'jpeg', quality: 0.85, multiplier })

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
