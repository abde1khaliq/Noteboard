import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  Undo2, Redo2, MousePointer2, PenLine, Highlighter, Eraser, Square,
  Circle, Minus, ArrowUpRight, Type, ImagePlus, Plus, Moon, Sun,
  Share, Trash2, ChevronDown, Hand, Check,
} from "lucide-react";

const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button {...props} />;

type Point = { x: number; y: number };
type Tool = "select" | "pan" | "pen" | "marker" | "eraser" | "shape" | "text";
type Shape = "rectangle" | "ellipse" | "line" | "arrow";
type BoardItem = {
  id: string; kind: "stroke" | "shape" | "text" | "image";
  x: number; y: number; color: string; width: number;
  points?: Point[]; shape?: Shape; x2?: number; y2?: number;
  text?: string; src?: string; imageWidth?: number; imageHeight?: number;
  marker?: boolean;
};
type Gesture = {
  mode: "draw" | "move" | "pan" | "erase";
  start: Point; initialItems: BoardItem[]; itemId?: string;
  initialOffset?: Point; initialPosition?: Point;
};

const palette = [
  { name: "Charcoal", value: "#202124" },
  { name: "Red", value: "#f0443e" },
  { name: "Orange", value: "#fb920b" },
  { name: "Yellow", value: "#f9c510" },
  { name: "Green", value: "#2ab85d" },
  { name: "Blue", value: "#1674ee" },
  { name: "Purple", value: "#a74ed6" },
  { name: "Gray", value: "#85878c" },
];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const uid = () => crypto.randomUUID();

function Whiteboard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const itemsRef = useRef<BoardItem[]>([]);
  const [history, setHistory] = useState<{ past: BoardItem[][]; future: BoardItem[][] }>({ past: [], future: [] });
  const historyRef = useRef<{ past: BoardItem[][]; future: BoardItem[][] }>({ past: [], future: [] });
  const [tool, setTool] = useState<Tool>("select");
  const [shape, setShape] = useState<Shape>("rectangle");
  const [shapeOpen, setShapeOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [color, setColor] = useState(palette[0]?.value ?? "#202124");
  const [size, setSize] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const [customColor, setCustomColor] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);
  const wheelRef = useRef<(event: WheelEvent) => void>(() => {});

  const replaceItems = (next: BoardItem[]) => { itemsRef.current = next; setItems(next); };
  const updateHistory = (next: { past: BoardItem[][]; future: BoardItem[][] }) => { historyRef.current = next; setHistory(next); };
  const commit = (before: BoardItem[]) => updateHistory({ past: [...historyRef.current.past, before], future: [] });
  const addItem = (item: BoardItem) => { commit(itemsRef.current); replaceItems([...itemsRef.current, item]); };
  const undo = () => {
    const h = historyRef.current;
    const previous = h.past.at(-1);
    if (!previous) return;
    const current = itemsRef.current;
    replaceItems(previous);
    setSelected(null);
    updateHistory({ past: h.past.slice(0, -1), future: [current, ...h.future] });
  };
  const redo = () => {
    const h = historyRef.current;
    const next = h.future[0];
    if (!next) return;
    const current = itemsRef.current;
    replaceItems(next);
    setSelected(null);
    updateHistory({ past: [...h.past, current], future: h.future.slice(1) });
  };
  const deleteSelected = () => {
    if (!selected) return;
    commit(itemsRef.current);
    replaceItems(itemsRef.current.filter(item => item.id !== selected));
    setSelected(null);
  };
  const clearBoard = () => {
    if (!itemsRef.current.length || !window.confirm("Clear the entire whiteboard?")) return;
    commit(itemsRef.current); replaceItems([]); setSelected(null);
  };
  const message = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 2400); };
  const toWorld = (point: Point): Point => ({ x: (point.x - offsetRef.current.x) / zoomRef.current, y: (point.y - offsetRef.current.y) / zoomRef.current });
  const localPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = boardRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const changeZoom = (next: number, anchor?: Point) => {
    const rect = boardRef.current?.getBoundingClientRect();
    const center = anchor ?? { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
    const current = zoomRef.current;
    const target = clamp(next, 0.25, 4);
    const k = target / current;
    const updated = { x: center.x - (center.x - offsetRef.current.x) * k, y: center.y - (center.y - offsetRef.current.y) * k };
    zoomRef.current = target; offsetRef.current = updated;
    setZoom(target); setOffset(updated);
  };
  wheelRef.current = event => {
    event.preventDefault();
    const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    changeZoom(zoomRef.current * Math.exp(-dy * 0.0015), localPoint(event));
  };
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => wheelRef.current(event);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
      else if (event.key === "Escape") { setSelected(null); setShapeOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const screen = localPoint(event);
    const point = toWorld(screen);
    const target = event.target as Element;
    const id = target.closest("[data-item-id]")?.getAttribute("data-item-id") ?? undefined;
    if (tool === "text" && event.button === 0) {
      const text = window.prompt("Enter text");
      if (text?.trim()) addItem({ id: uid(), kind: "text", x: point.x, y: point.y, text: text.trim(), color, width: size });
      return;
    }
    if (tool === "eraser" && id) {
      gestureRef.current = { mode: "erase", start: point, initialItems: itemsRef.current };
      replaceItems(itemsRef.current.filter(item => item.id !== id));
    } else if (tool === "pan" || event.button === 1 || (tool === "select" && !id)) {
      if (tool === "select") setSelected(null);
      gestureRef.current = { mode: "pan", start: screen, initialItems: itemsRef.current, initialOffset: offsetRef.current };
    } else if (tool === "select" && id) {
      const item = itemsRef.current.find(entry => entry.id === id);
      if (!item) return;
      setSelected(id);
      gestureRef.current = { mode: "move", start: point, initialItems: itemsRef.current, itemId: id, initialPosition: { x: item.x, y: item.y } };
    } else if (tool === "pen" || tool === "marker" || tool === "shape") {
      setSelected(null);
      const item: BoardItem = tool === "shape"
        ? { id: uid(), kind: "shape", shape, x: point.x, y: point.y, x2: 0, y2: 0, color, width: size }
        : { id: uid(), kind: "stroke", x: point.x, y: point.y, points: [{ x: 0, y: 0 }], color, width: tool === "marker" ? size * 4 : size, marker: tool === "marker" };
      gestureRef.current = { mode: "draw", start: point, initialItems: itemsRef.current, itemId: item.id };
      replaceItems([...itemsRef.current, item]);
    } else return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const screen = localPoint(event);
    const point = toWorld(screen);
    if (gesture.mode === "pan" && gesture.initialOffset) {
      const updated = { x: gesture.initialOffset.x + screen.x - gesture.start.x, y: gesture.initialOffset.y + screen.y - gesture.start.y };
      offsetRef.current = updated; setOffset(updated);
    } else if (gesture.mode === "move" && gesture.initialPosition) {
      const initialPosition = gesture.initialPosition;
      replaceItems(itemsRef.current.map(item => item.id === gesture.itemId ? { ...item, x: initialPosition.x + point.x - gesture.start.x, y: initialPosition.y + point.y - gesture.start.y } : item));
    } else if (gesture.mode === "draw") {
      replaceItems(itemsRef.current.map(item => item.id === gesture.itemId ? item.kind === "stroke"
        ? { ...item, points: [...(item.points ?? []), { x: point.x - item.x, y: point.y - item.y }] }
        : { ...item, x2: point.x - item.x, y2: point.y - item.y } : item));
    } else if (gesture.mode === "erase") {
      const target = event.target as Element;
      const id = target.closest("[data-item-id]")?.getAttribute("data-item-id");
      if (id) replaceItems(itemsRef.current.filter(item => item.id !== id));
    }
  };
  const onPointerUp = () => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.mode !== "pan" && gesture.initialItems !== itemsRef.current) commit(gesture.initialItems);
    gestureRef.current = null;
  };
  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 360 / image.width, 280 / image.height);
        const w = image.width * scale, h = image.height * scale;
        const rect = boardRef.current?.getBoundingClientRect();
        const center = toWorld({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 });
        addItem({ id: uid(), kind: "image", x: center.x - w / 2, y: center.y - h / 2, color, width: size, src: reader.result as string, imageWidth: w, imageHeight: h });
        setTool("select");
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const exportPng = async () => {
    const board = boardRef.current;
    if (!board) return;
    const svg = board.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(board.clientWidth * 2));
    clone.setAttribute("height", String(board.clientHeight * 2));
    clone.setAttribute("viewBox", `0 0 ${board.clientWidth} ${board.clientHeight}`);
    clone.querySelectorAll("[data-selection-outline]").forEach(node => node.remove());
    const serialized = new XMLSerializer().serializeToString(clone);
    const image = new Image();
    image.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = board.clientWidth * 2; canvas.height = board.clientHeight * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = dark ? "#181a1e" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async blob => {
        if (!blob) return;
        const file = new File([blob], "whiteboard.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: "Whiteboard" }); return; } catch { /* fall back to download */ }
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = "whiteboard.png"; link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        message("Whiteboard saved as PNG");
      }, "image/png");
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  };

  const iconButton = (label: string, icon: React.ReactNode, action: () => void, active = false, disabled = false) => (
    <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} aria-pressed={active} disabled={disabled}
      className={`wb-tool ${active ? "wb-active" : ""}`} onClick={action}>{icon}</Button>
  );
  const pathFor = (points: Point[]) => points.length === 1 && points[0]
    ? `M ${points[0].x} ${points[0].y} l 0.01 0.01`
    : points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const ShapeIcon = shape === "ellipse" ? Circle : shape === "line" ? Minus : shape === "arrow" ? ArrowUpRight : Square;

  return <main className={`wb ${dark ? "wb-dark" : ""}`}>
    <style>{whiteboardStyles}</style>
    <div className="wb-board" ref={boardRef}>
      <svg className={`wb-canvas wb-cursor-${tool}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Whiteboard canvas">
        <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          {items.map(item => <g key={item.id} data-item-id={item.id} transform={`translate(${item.x} ${item.y})`}>
            {item.kind === "stroke" && <path d={pathFor(item.points ?? [])} fill="none" stroke={item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round" opacity={item.marker ? 0.45 : 1} />}
            {item.kind === "shape" && (() => {
              const x = item.x2 ?? 0, y = item.y2 ?? 0;
              const common = { fill: "none", stroke: item.color, strokeWidth: item.width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
              if (item.shape === "ellipse") return <ellipse cx={x / 2} cy={y / 2} rx={Math.max(1, Math.abs(x / 2))} ry={Math.max(1, Math.abs(y / 2))} {...common} />;
              if (item.shape === "rectangle") return <rect x={Math.min(0, x)} y={Math.min(0, y)} width={Math.max(1, Math.abs(x))} height={Math.max(1, Math.abs(y))} {...common} />;
              if (item.shape === "arrow") { const angle = Math.atan2(y, x); const length = 15 + item.width; return <g {...common}><line x1={0} y1={0} x2={x} y2={y} /><path d={`M ${x - length * Math.cos(angle - 0.5)} ${y - length * Math.sin(angle - 0.5)} L ${x} ${y} L ${x - length * Math.cos(angle + 0.5)} ${y - length * Math.sin(angle + 0.5)}`} /></g>; }
              return <line x1={0} y1={0} x2={x} y2={y} {...common} />;
            })()}
            {item.kind === "text" && <text fill={item.color} fontSize={Math.max(16, item.width * 6)} fontFamily="Arial, sans-serif" dominantBaseline="hanging">{item.text}</text>}
            {item.kind === "image" && <image href={item.src} width={item.imageWidth} height={item.imageHeight} />}
            {selected === item.id && <rect data-selection-outline="true" x={item.kind === "shape" ? Math.min(0, item.x2 ?? 0) - 7 : -7} y={item.kind === "shape" ? Math.min(0, item.y2 ?? 0) - 7 : -7} width={item.kind === "shape" ? Math.abs(item.x2 ?? 0) + 14 : item.kind === "image" ? (item.imageWidth ?? 0) + 14 : item.kind === "text" ? (item.text?.length ?? 0) * Math.max(9, item.width * 3.5) + 14 : Math.max(14, Math.max(...(item.points ?? [{ x: 0 }]).map(p => p.x)) - Math.min(...(item.points ?? [{ x: 0 }]).map(p => p.x)) + 14)} height={item.kind === "shape" ? Math.abs(item.y2 ?? 0) + 14 : item.kind === "image" ? (item.imageHeight ?? 0) + 14 : item.kind === "text" ? Math.max(16, item.width * 6) + 14 : Math.max(14, Math.max(...(item.points ?? [{ y: 0 }]).map(p => p.y)) - Math.min(...(item.points ?? [{ y: 0 }]).map(p => p.y)) + 14)} fill="none" stroke="var(--wb-blue)" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} pointerEvents="none" />}
          </g>)}
        </g>
      </svg>
    </div>

    <div className="wb-top wb-panel" role="toolbar" aria-label="Whiteboard tools">
      <div className="wb-group">{iconButton("Undo", <Undo2 />, undo, false, !history.past.length)}{iconButton("Redo", <Redo2 />, redo, false, !history.future.length)}</div>
      <span className="wb-divider" />
      <div className="wb-group">
        {iconButton("Select", <MousePointer2 />, () => setTool("select"), tool === "select")}
        {iconButton("Pan", <Hand />, () => setTool("pan"), tool === "pan")}
        {iconButton("Pen", <PenLine />, () => setTool("pen"), tool === "pen")}
        {iconButton("Highlighter", <Highlighter />, () => setTool("marker"), tool === "marker")}
        {iconButton("Eraser", <Eraser />, () => setTool("eraser"), tool === "eraser")}
      </div>
      <span className="wb-divider" />
      <div className="wb-group">
        <div className="wb-shape-wrap">
          {iconButton(`Shape: ${shape}`, <ShapeIcon />, () => { setTool("shape"); setShapeOpen(!shapeOpen); }, tool === "shape")}
          <Button type="button" variant="ghost" size="icon" className="wb-shape-caret" aria-label="Choose shape" title="Choose shape" onClick={() => setShapeOpen(!shapeOpen)}><ChevronDown /></Button>
          {shapeOpen && <div className="wb-shape-menu wb-panel" role="menu">{(["rectangle", "ellipse", "line", "arrow"] as Shape[]).map(option => {
            const Icon = option === "rectangle" ? Square : option === "ellipse" ? Circle : option === "line" ? Minus : ArrowUpRight;
            return <Button key={option} type="button" variant="ghost" role="menuitem" className="wb-shape-option" onClick={() => { setShape(option); setTool("shape"); setShapeOpen(false); }}><Icon /> <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>{shape === option && <Check className="wb-check" />}</Button>;
          })}</div>}
        </div>
        {iconButton("Text", <Type />, () => setTool("text"), tool === "text")}
        {iconButton("Add image", <ImagePlus />, () => fileRef.current?.click())}
      </div>
      <span className="wb-divider" />
      <div className="wb-group wb-zoom-group">
        {iconButton("Zoom out", <Minus />, () => changeZoom(zoomRef.current / 1.2))}
        <Button type="button" variant="ghost" title="Reset zoom" className="wb-zoom-label" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</Button>
        {iconButton("Zoom in", <Plus />, () => changeZoom(zoomRef.current * 1.2))}
      </div>
      <span className="wb-divider" />
      <div className="wb-group">
        {iconButton(dark ? "Light mode" : "Dark mode", dark ? <Sun /> : <Moon />, () => setDark(!dark))}
        {iconButton("Share or download", <Share />, exportPng)}
        {iconButton(selected ? "Delete selected" : "Clear board", <Trash2 />, selected ? deleteSelected : clearBoard, false, !items.length)}
      </div>
    </div>

    <div className="wb-bottom wb-panel" role="toolbar" aria-label="Drawing settings">
      <div className="wb-colors">{palette.map(option => <Button key={option.name} type="button" variant="ghost" size="icon" className={`wb-swatch-button ${color === option.value ? "wb-swatch-selected" : ""}`} title={option.name} aria-label={`${option.name} color`} aria-pressed={color === option.value} onClick={() => { setColor(option.value); setCustomColor(false); }}><span className="wb-swatch" style={{ backgroundColor: option.value }} /></Button>)}
        <label className={`wb-custom-color ${customColor ? "wb-swatch-selected" : ""}`} title="Custom color"><span className="wb-color-wheel" /><input type="color" aria-label="Custom color" value={color} onChange={event => { setColor(event.target.value); setCustomColor(true); }} /></label>
      </div>
      <span className="wb-divider" />
      <div className="wb-size-control"><span className="wb-size-dot" style={{ width: Math.max(3, size / 2), height: Math.max(3, size / 2) }} /><input type="range" min="1" max="30" value={size} aria-label="Stroke size" onChange={event => setSize(Number(event.target.value))} /><output>{size}</output></div>
    </div>
    <input ref={fileRef} type="file" accept="image/*" onChange={uploadImage} className="wb-hidden" aria-label="Upload image" />
    {notice && <div className="wb-toast" role="status">{notice}</div>}
  </main>;
}

const whiteboardStyles = `
  .wb { --wb-bg: oklch(1 0 0); --wb-grid: oklch(0.94 0 0); --wb-panel: oklch(1 0 0); --wb-ink: oklch(0.20 0 0); --wb-muted: oklch(0.53 0 0); --wb-border: oklch(0.90 0 0); --wb-hover: oklch(0.96 0 0); --wb-active: oklch(0.93 0.04 252); --wb-blue: oklch(0.58 0.22 257); --wb-shadow: 0 2px 7px oklch(0.2 0 0 / .10), 0 9px 24px oklch(0.2 0 0 / .045); position: fixed; inset: 0; overflow: hidden; background: var(--wb-bg); color: var(--wb-ink); font-family: Arial, Helvetica, sans-serif; }
  .wb-dark { --wb-bg: oklch(0.19 0.008 260); --wb-grid: oklch(0.25 0.008 260); --wb-panel: oklch(0.25 0.008 260); --wb-ink: oklch(0.94 0 0); --wb-muted: oklch(0.63 0 0); --wb-border: oklch(0.36 0.005 260); --wb-hover: oklch(0.32 0.008 260); --wb-active: oklch(0.35 0.06 252); --wb-shadow: 0 2px 10px oklch(0 0 0 / .3); }
  .wb-board { position: absolute; inset: 0; background-color: var(--wb-bg); background-image: linear-gradient(to right, var(--wb-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--wb-grid) 1px, transparent 1px); background-size: 23px 23px; touch-action: none; }
  .wb-canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: default; }
  .wb-cursor-pen, .wb-cursor-marker, .wb-cursor-shape, .wb-cursor-text { cursor: crosshair; }
  .wb-cursor-eraser { cursor: cell; } .wb-cursor-pan { cursor: grab; } .wb-cursor-pan:active { cursor: grabbing; }
  .wb-canvas [data-item-id] { cursor: pointer; } .wb-cursor-select [data-item-id] { cursor: move; }
  .wb-panel { background: var(--wb-panel); border: 1px solid var(--wb-border); box-shadow: var(--wb-shadow); border-radius: 15px; }
  .wb-top { position: absolute; z-index: 5; left: 50%; top: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 3px; padding: 4px 7px; height: 42px; white-space: nowrap; max-width: calc(100vw - 16px); }
  .wb-group { display: flex; align-items: center; gap: 1px; }
  .wb-divider { display: block; flex: none; width: 1px; height: 22px; background: var(--wb-border); margin: 0 5px; }
  .wb .wb-tool { flex: none; width: 30px; height: 30px; padding: 0; border-radius: 7px; color: var(--wb-ink); }
  .wb .wb-tool svg { width: 15px; height: 15px; stroke-width: 1.8; }
  .wb .wb-tool:hover:not(:disabled), .wb .wb-zoom-label:hover, .wb .wb-shape-caret:hover { background: var(--wb-hover); }
  .wb .wb-tool.wb-active { background: var(--wb-active); color: var(--wb-blue); }
  .wb .wb-tool:disabled { color: var(--wb-muted); opacity: .36; }
  .wb .wb-zoom-label { min-width: 48px; height: 30px; padding: 0 3px; color: var(--wb-ink); font-size: 10px; font-weight: 500; box-shadow: none; }
  .wb-shape-wrap { display: flex; align-items: center; position: relative; }
  .wb .wb-shape-caret { width: 11px; height: 23px; padding: 0; margin-left: -4px; color: var(--wb-muted); }
  .wb .wb-shape-caret svg { width: 9px; height: 9px; }
  .wb-shape-menu { position: absolute; top: 39px; left: 0; padding: 5px; width: 158px; z-index: 10; border-radius: 9px; }
  .wb .wb-shape-option { display: flex; width: 100%; height: 32px; justify-content: flex-start; gap: 9px; padding: 0 8px; font-size: 12px; color: var(--wb-ink); }
  .wb .wb-shape-option:hover { background: var(--wb-hover); } .wb .wb-shape-option svg { width: 15px; height: 15px; } .wb .wb-shape-option .wb-check { width: 13px; height: 13px; margin-left: auto; color: var(--wb-blue); }
  .wb-bottom { position: absolute; z-index: 5; left: 50%; bottom: 14px; transform: translateX(-50%); height: 42px; padding: 4px 7px; display: flex; align-items: center; gap: 4px; max-width: calc(100vw - 16px); }
  .wb-colors { display: flex; align-items: center; gap: 4px; }
  .wb .wb-swatch-button { width: 27px; height: 29px; flex: none; padding: 0; border-radius: 50%; box-shadow: none; }
  .wb-swatch { width: 19px; height: 19px; border-radius: 50%; display: block; }
  .wb-swatch-selected .wb-swatch { outline: 1.5px solid var(--wb-ink); outline-offset: 2px; }
  .wb-custom-color { position: relative; display: grid; place-items: center; width: 29px; height: 29px; flex: none; cursor: pointer; border-radius: 50%; }
  .wb-color-wheel { width: 19px; height: 19px; border-radius: 50%; background: conic-gradient(oklch(0.63 0.24 25), oklch(0.8 0.19 85), oklch(0.7 0.2 145), oklch(0.65 0.2 220), oklch(0.62 0.22 290), oklch(0.63 0.24 25)); }
  .wb-custom-color.wb-swatch-selected .wb-color-wheel { outline: 1.5px solid var(--wb-ink); outline-offset: 2px; }
  .wb-custom-color input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
  .wb-size-control { display: flex; align-items: center; gap: 14px; padding: 0 5px 0 10px; min-width: 153px; }
  .wb-size-dot { background: var(--wb-ink); border-radius: 50%; flex: none; max-width: 12px; max-height: 12px; }
  .wb-size-control input { width: 106px; height: 3px; accent-color: var(--wb-blue); cursor: pointer; }
  .wb-size-control output { width: 13px; text-align: right; font-size: 10px; color: var(--wb-muted); }
  .wb-hidden { display: none; }
  .wb-toast { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); background: var(--wb-ink); color: var(--wb-bg); padding: 8px 12px; border-radius: 7px; font-size: 12px; z-index: 10; }
  @media (max-width: 700px) { .wb-top { top: 10px; height: auto; min-height: 42px; flex-wrap: wrap; justify-content: center; width: min(380px, calc(100vw - 16px)); padding: 5px; } .wb-top .wb-divider { margin: 0 2px; } .wb-top .wb-group { gap: 0; } .wb .wb-tool { width: 29px; } .wb-bottom { bottom: 12px; height: auto; width: min(360px, calc(100vw - 16px)); flex-wrap: wrap; justify-content: center; padding: 6px; } .wb-bottom .wb-divider { display: none; } .wb-colors { gap: 3px; } .wb-size-control { width: 100%; justify-content: center; padding: 2px 10px; } .wb-size-control input { flex: 1; max-width: 220px; } }
  @media (prefers-reduced-motion: no-preference) { .wb .wb-tool, .wb .wb-swatch-button { transition: background-color .15s ease, transform .15s ease; } .wb .wb-swatch-button:hover { transform: translateY(-2px); } }
`;
