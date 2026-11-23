import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, RotateCcw, Check, X } from 'lucide-react';

interface DiagramSketchModalProps {
  isOpen: boolean;
  title?: string;
  initialImage?: string;
  onClose: () => void;
  onSaveDiagram: (dataUrl: string) => void;
}

export const DiagramSketchModal: React.FC<DiagramSketchModalProps> = ({
  isOpen,
  title = 'Draw Question Diagram / Sketch',
  initialImage,
  onClose,
  onSaveDiagram,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [penColor, setPenColor] = useState<'#0f172a' | '#4f46e5' | '#dc2626'>('#0f172a');
  const [isEraser, setIsEraser] = useState(false);
  const [lineWidth, setLineWidth] = useState(2.5);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle faint grid to help draw triangles, graphs, angles, and diagrams
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialImage;
    }
  }, [isOpen, initialImage]);

  if (!isOpen) return null;

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };


const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? 14 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    onSaveDiagram(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden space-y-3 p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              Draw shapes, angles, graphs, or diagrams using your finger or stylus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsEraser(false);
                setPenColor('#0f172a');
              }}
              className={`w-6 h-6 rounded-full bg-slate-900 border-2 cursor-pointer ${
                !isEraser && penColor === '#0f172a' ? 'border-indigo-500 scale-110' : 'border-white'
              }`}
              title="Black Ink"
            />
            <button
              type="button"
              onClick={() => {
                setIsEraser(false);
                setPenColor('#4f46e5');
              }}
              className={`w-6 h-6 rounded-full bg-indigo-600 border-2 cursor-pointer ${
                !isEraser && penColor === '#4f46e5' ? 'border-amber-400 scale-110' : 'border-white'
              }`}
              title="Indigo Ink"
            />
            <button
              type="button"
              onClick={() => {
                setIsEraser(false);
                setPenColor('#dc2626');
              }}
              className={`w-6 h-6 rounded-full bg-rose-600 border-2 cursor-pointer ${
                !isEraser && penColor === '#dc2626' ? 'border-amber-400 scale-110' : 'border-white'
              }`}
              title="Red Highlight"
            />
            <button
              type="button"
              onClick={() => setIsEraser(!isEraser)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
                isEraser
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {isEraser ? <Eraser className="w-3.5 h-3.5" /> : <PenTool className="w-3.5 h-3.5" />}
              <span>{isEraser ? 'Eraser On' : 'Pen'}</span>
            </button>
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md"
              title="Stroke thickness"
            >
              <option value={1.5}>Fine</option>
              <option value={2.5}>Medium</option>
              <option value={4}>Thick</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>

        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white touch-none">
          <canvas
            ref={canvasRef}
            width={480}
            height={280}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-56 block touch-none cursor-crosshair"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Attach Diagram</span>
          </button>
        </div>
      </div>
    </div>
  );
};
