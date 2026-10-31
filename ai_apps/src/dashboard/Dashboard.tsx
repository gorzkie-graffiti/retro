import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  canvasHeightFor,
  clampPosition,
  DEFAULT_LAYOUT,
  loadLayout,
  MODULE_IDS,
  MODULE_PLACEMENTS,
  normalizeLayout,
  saveLayout,
  type ModuleId,
  type ModuleLayout,
} from "./moduleLayout";

export interface DashboardModule {
  title: string;
  icon: string;
  badge?: string;
  actions?: ReactNode;
  content: ReactNode;
}

interface DashboardProps {
  modules: Record<ModuleId, DashboardModule>;
  themeControl?: ReactNode;
}

interface DragState {
  id: ModuleId;
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

export function Dashboard({ modules, themeControl }: DashboardProps) {
  const [layout, setLayout] = useState<ModuleLayout>(() => loadLayout());
  const [draggingId, setDraggingId] = useState<ModuleId | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => saveLayout(layout), 250);
    return () => window.clearTimeout(timer);
  }, [layout]);

  function beginDrag(event: PointerEvent<HTMLDivElement>, id: ModuleId) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest(".module-actions, a, input, select, textarea")) {
      return;
    }
    event.currentTarget
      .querySelector<HTMLButtonElement>(".drag-grip")
      ?.focus({ preventScroll: true });
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const position = layout[id];
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left - position.x,
      offsetY: event.clientY - bounds.top - position.y,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable (older browsers, synthetic input).
      // Dragging still works while the pointer stays over the module.
    }
    setDraggingId(id);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) {
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const next = clampPosition(drag.id, {
      x: event.clientX - bounds.left - drag.offsetX,
      y: event.clientY - bounds.top - drag.offsetY,
    });
    setLayout((current) => ({ ...current, [drag.id]: next }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
    setDraggingId(null);
  }

  function nudge(event: KeyboardEvent<HTMLButtonElement>, id: ModuleId) {
    const step = event.shiftKey ? 24 : 8;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;

    event.preventDefault();
    setLayout((current) => ({
      ...current,
      [id]: clampPosition(id, {
        x: current[id].x + dx,
        y: current[id].y + dy,
      }),
    }));
  }

  function resetLayout() {
    setLayout(normalizeLayout(null));
    saveLayout({ ...DEFAULT_LAYOUT });
  }

  return (
    <section aria-label="Personalized dashboard" className="dashboard-wrap">
      <div className="layout-bar">
        <div className="layout-bar-copy">
          <span className="layout-star" aria-hidden="true">
            ✦
          </span>
          <strong>Personalized homepage</strong>
          <span className="layout-hint">
            Drag any blue module bar to rearrange this page. Positions are saved
            on this computer.
          </span>
        </div>
        <div className="layout-bar-tools">
          {themeControl}
          <span className="autosave-note">Auto-save: on</span>
          <button className="btn btn-small" onClick={resetLayout} type="button">
            Reset layout
          </button>
        </div>
      </div>

      <div
        className="dashboard-canvas"
        id="dashboard-canvas"
        ref={canvasRef}
        style={{ height: canvasHeightFor(layout) }}
      >
        {MODULE_IDS.map((id) => {
          const module = modules[id];
          const position = layout[id];
          const placement = MODULE_PLACEMENTS[id];
          const isDragging = draggingId === id;
          return (
            <article
              aria-labelledby={`module-${id}-title`}
              className={`module module--${id}${isDragging ? " module--dragging" : ""}`}
              data-module={id}
              id={`module-${id}`}
              key={id}
              style={{
                left: position.x,
                top: position.y,
                width: placement.width,
                height: placement.height,
                zIndex: isDragging ? 60 : 1,
              }}
            >
              <div
                className="module-titlebar"
                onPointerCancel={endDrag}
                onPointerDown={(event) => beginDrag(event, id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              >
                <button
                  aria-label={`Move ${module.title} module with arrow keys`}
                  className="drag-grip"
                  onKeyDown={(event) => nudge(event, id)}
                  title="Drag to rearrange · arrow keys to nudge"
                  type="button"
                >
                  <span aria-hidden="true" className="drag-grip-dots" />
                </button>
                <span aria-hidden="true" className="module-icon">
                  {module.icon}
                </span>
                <h2 className="module-title" id={`module-${id}-title`}>
                  {module.title}
                </h2>
                {module.badge ? (
                  <span className="module-badge">{module.badge}</span>
                ) : null}
                <div className="module-actions">{module.actions}</div>
              </div>
              <div className="module-body">{module.content}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
