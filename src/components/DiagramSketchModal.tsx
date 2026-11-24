import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, RotateCcw, Check, X, Ruler, Compass, CircleDot } from 'lucide-react';

interface DiagramSketchModalProps {
  isOpen: boolean;
  title?: string;
  initialImage?: string;
  onClose: () => void;
  onSaveDiagram: (dataUrl: string) => void;
}

type InstrumentMode = 'none' | 'ruler' | 'compass' | 'protractor';

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

  // Geometry instruments state
  const [activeInstrument, setActiveInstrument] = useState<InstrumentMode>('none');
  const [instX, setInstX] = useState(240);
  const [instY, setInstY] = useState(145);
  const [rulerAngle, setRulerAngle] = useState(0); // degrees
  const [rulerLength, setRulerLength] = useState(180); // px
  const [compassRadius, setCompassRadius] = useState(65); // px
  const [arcStartDeg, setArcStartDeg] = useState(0);
  const [arcSweepDeg, setArcSweepDeg] = useState(360);
  const [targetAngleDeg, setTargetAngleDeg] = useState(60);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);

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
    drawGrid(ctx, canvas.width, canvas.height);
  };

  // Ruler action: draw a straight line along the ruler edge
  const drawRulerLine = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rad = (rulerAngle * Math.PI) / 180;
    const half = rulerLength / 2;
    const x1 = instX - Math.cos(rad) * half;
    const y1 = instY - Math.sin(rad) * half;
    const x2 = instX + Math.cos(rad) * half;
    const y2 = instY + Math.sin(rad) * half;

    ctx.save();
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? 14 : lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  // Compass action: draw arc or full circle centered at (instX, instY) with compassRadius
  const drawCompassArc = (fullCircle = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startRad = (arcStartDeg * Math.PI) / 180;
    const endRad = fullCircle
      ? startRad + Math.PI * 2
      : ((arcStartDeg + arcSweepDeg) * Math.PI) / 180;

    ctx.save();
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? 14 : lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(instX, instY, compassRadius, startRad, endRad);
    ctx.stroke();

    // Small center pivot dot if using pen
    if (!isEraser) {
      ctx.fillStyle = penColor;
      ctx.beginPath();
      ctx.arc(instX, instY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };


  // Protractor action: draw base line + angled ray at targetAngleDeg from vertex (instX, instY)
  const drawProtractorAngle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rayLen = 110;
    // Canvas y goes down, so angle upward from horizontal right is -targetAngleDeg
    const rad = (-targetAngleDeg * Math.PI) / 180;
    const endX = instX + Math.cos(rad) * rayLen;
    const endY = instY + Math.sin(rad) * rayLen;

    ctx.save();
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? 14 : lineWidth;
    ctx.lineCap = 'round';

    // Base arm to right
    ctx.beginPath();
    ctx.moveTo(instX, instY);
    ctx.lineTo(instX + rayLen, instY);
    ctx.stroke();

    // Angled arm
    ctx.beginPath();
    ctx.moveTo(instX, instY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Small angle arc indicator
    if (!isEraser) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(instX, instY, 26, rad, 0);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      const labelRad = rad / 2;
      ctx.fillText(
        `${targetAngleDeg}°`,
        instX + Math.cos(labelRad) * 34 - 8,
        instY + Math.sin(labelRad) * 34 + 4
      );
    }
    ctx.restore();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onSaveDiagram(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-2.5 p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              Freehand sketch or use Ruler, Compass &amp; Protractor instruments.
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

        {/* Ink, Eraser & Stroke Controls */}
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

        {/* Geometry Instruments Selector */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">
            Instruments:
          </span>
          <button
            type="button"
            onClick={() => setActiveInstrument(activeInstrument === 'ruler' ? 'none' : 'ruler')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
              activeInstrument === 'ruler'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Ruler</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInstrument(activeInstrument === 'compass' ? 'none' : 'compass')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
              activeInstrument === 'compass'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Compass</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveInstrument(activeInstrument === 'protractor' ? 'none' : 'protractor')
            }
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
              activeInstrument === 'protractor'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span>Protractor</span>
          </button>
        </div>


        {/* Active Instrument Controls */}
        {activeInstrument !== 'none' && (
          <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-slate-700 font-semibold">
                Center X ({instX}px)
                <input
                  type="range"
                  min={20}
                  max={460}
                  value={instX}
                  onChange={(e) => setInstX(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>
              <label className="text-slate-700 font-semibold">
                Center Y ({instY}px)
                <input
                  type="range"
                  min={20}
                  max={260}
                  value={instY}
                  onChange={(e) => setInstY(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>
            </div>

            {activeInstrument === 'ruler' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-slate-700 font-semibold">
                    Angle ({rulerAngle}°)
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={rulerAngle}
                      onChange={(e) => setRulerAngle(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <label className="text-slate-700 font-semibold">
                    Length ({rulerLength}px)
                    <input
                      type="range"
                      min={40}
                      max={340}
                      value={rulerLength}
                      onChange={(e) => setRulerLength(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 45, 90, -45].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRulerAngle(deg)}
                        className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold cursor-pointer"
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={drawRulerLine}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Draw Straight Line
                  </button>
                </div>
              </div>
            )}

            {activeInstrument === 'compass' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-slate-700 font-semibold">
                    Radius ({compassRadius}px)
                    <input
                      type="range"
                      min={15}
                      max={120}
                      value={compassRadius}
                      onChange={(e) => setCompassRadius(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <label className="text-slate-700 font-semibold">
                    Start ({arcStartDeg}°)
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={arcStartDeg}
                      onChange={(e) => setArcStartDeg(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <label className="text-slate-700 font-semibold">
                    Sweep ({arcSweepDeg}°)
                    <input
                      type="range"
                      min={15}
                      max={360}
                      value={arcSweepDeg}
                      onChange={(e) => setArcSweepDeg(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => drawCompassArc(false)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Draw Arc ({arcSweepDeg}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => drawCompassArc(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Draw Full Circle
                  </button>
                </div>
              </div>
            )}

            {activeInstrument === 'protractor' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-slate-700 font-semibold flex-1">
                    Angle ({targetAngleDeg}°)
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={targetAngleDeg}
                      onChange={(e) => setTargetAngleDeg(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    {[30, 45, 60, 90, 120].map((ang) => (
                      <button
                        key={ang}
                        type="button"
                        onClick={() => setTargetAngleDeg(ang)}
                        className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold cursor-pointer"
                      >
                        {ang}°
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={drawProtractorAngle}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Draw {targetAngleDeg}° Angle &amp; Rays
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Canvas + Live SVG Geometry Overlay */}
        <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-white touch-none">
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

          {activeInstrument !== 'none' && (
            <svg
              viewBox="0 0 480 280"
              className="pointer-events-none absolute inset-0 w-full h-full"
            >
              {activeInstrument === 'ruler' && (() => {
                const rad = (rulerAngle * Math.PI) / 180;
                const deg = (rad * 180) / Math.PI;
                const half = rulerLength / 2;
                const ticks = [];
                for (let d = -half; d <= half; d += 10) {
                  const isMajor = Math.abs(Math.round(d) % 50) === 0;
                  ticks.push(
                    <line
                      key={d}
                      x1={d}
                      y1={-14}
                      x2={d}
                      y2={isMajor ? -2 : -7}
                      stroke="#1e293b"
                      strokeWidth={isMajor ? 1.5 : 0.9}
                    />
                  );
                }
                return (
                  <g transform={`translate(${instX}, ${instY}) rotate(${deg})`}>
                    <rect
                      x={-half}
                      y={-15}
                      width={rulerLength}
                      height={30}
                      rx={3}
                      fill="rgba(254, 240, 138, 0.42)"
                      stroke="#4f46e5"
                      strokeWidth={1.5}
                    />
                    {ticks}
                    <line
                      x1={-half}
                      y1={15}
                      x2={half}
                      y2={15}
                      stroke="#4f46e5"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  </g>
                );
              })()}


              {activeInstrument === 'compass' && (() => {
                const startRad = (arcStartDeg * Math.PI) / 180;
                const endRad = ((arcStartDeg + arcSweepDeg) * Math.PI) / 180;
                const x1 = instX + Math.cos(startRad) * compassRadius;
                const y1 = instY + Math.sin(startRad) * compassRadius;
                const x2 = instX + Math.cos(endRad) * compassRadius;
                const y2 = instY + Math.sin(endRad) * compassRadius;
                const largeArc = arcSweepDeg > 180 ? 1 : 0;
                return (
                  <g>
                    <circle
                      cx={instX}
                      cy={instY}
                      r={compassRadius}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <path
                      d={`M ${x1} ${y1} A ${compassRadius} ${compassRadius} 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth={2.2}
                    />
                    <line
                      x1={instX}
                      y1={instY}
                      x2={x2}
                      y2={y2}
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                    />
                    <circle cx={instX} cy={instY} r={4} fill="#dc2626" />
                    <circle cx={x2} cy={y2} r={3.5} fill="#4f46e5" />
                  </g>
                );
              })()}

              {activeInstrument === 'protractor' && (() => {
                const r = 74;
                const rad = (-targetAngleDeg * Math.PI) / 180;
                const rx = instX + Math.cos(rad) * r;
                const ry = instY + Math.sin(rad) * r;
                const degTicks = [];
                for (let a = 0; a <= 180; a += 15) {
                  const aRad = (-a * Math.PI) / 180;
                  const inner = a % 45 === 0 ? r - 12 : r - 6;
                  degTicks.push(
                    <line
                      key={a}
                      x1={instX + Math.cos(aRad) * inner}
                      y1={instY + Math.sin(aRad) * inner}
                      x2={instX + Math.cos(aRad) * r}
                      y2={instY + Math.sin(aRad) * r}
                      stroke="#475569"
                      strokeWidth={a % 45 === 0 ? 1.5 : 1}
                    />
                  );
                }
                return (
                  <g>
                    <path
                      d={`M ${instX - r} ${instY} A ${r} ${r} 0 0 1 ${instX + r} ${instY} Z`}
                      fill="rgba(224, 231, 255, 0.45)"
                      stroke="#4f46e5"
                      strokeWidth={1.5}
                    />
                    {degTicks}
                    <line
                      x1={instX}
                      y1={instY}
                      x2={rx}
                      y2={ry}
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                    <circle cx={instX} cy={instY} r={3.5} fill="#0f172a" />
                  </g>
                );
              })()}
            </svg>
          )}
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
