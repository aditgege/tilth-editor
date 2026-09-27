import { $, RT, S, clamp, cvPrev, cvSrc, cvTmpl, pv, toast, tp, tpv, view } from './core.js';
import { cellAt, cellAtP, cellAtT, cellTop, evPos, normRect, toWorld } from './geo.js';
import { canErase, canPaint, eraseCell, paintCell, pushUndo, renderPreview } from './inspect.js';
import { commitCrop } from './source-crop.js';
import { updateLive } from './source-live.js';
import { renderSource } from './source-render.js';
import { applyCalibration, marqueeCells, toggleSelCell, updateSelUI } from './source-select.js';
import { applyTStroke, fillT, pushTUndo, updateTInfo } from './template-export.js';
import { renderTemplate } from './template-studio.js';
import { syncInputs, updateStatus } from './ui.js';

      /* ================================================================
   VIEW / ZOOM / PAN
   ================================================================ */

      export function zoomAt(v, px, py, f) {
        const ns = clamp(v.scale * f, 0.02, 40);
        f = ns / v.scale;
        v.x = px - (px - v.x) * f;
        v.y = py - (py - v.y) * f;
        v.scale = ns;
        v.moved = true;
      }
      export function fitView() {
        if (!S.img) return;
        const r = cvSrc.getBoundingClientRect();
        if (r.width < 10) return;
        view.scale = clamp(
          Math.min((r.width - 60) / S.iw, (r.height - 60) / S.ih),
          0.03,
          8,
        );
        view.x = (r.width - S.iw * view.scale) / 2;
        view.y = (r.height - S.ih * view.scale) / 2;
        view.moved = false;
      }
      export function zoomCenter(f) {
        const cv =
          S.mode === "source" ? cvSrc : S.mode === "inspect" ? cvPrev : cvTmpl;
        const v = S.mode === "source" ? view : S.mode === "inspect" ? pv : tpv;
        const r = cv.getBoundingClientRect();
        zoomAt(v, r.width / 2, r.height / 2, f);
        S.mode === "source"
          ? renderSource()
          : S.mode === "inspect"
            ? renderPreview()
            : renderTemplate();
        updateStatus();
      }

      /* ================================================================
   EVENTS — source canvas
   ================================================================ */
      cvSrc.addEventListener("contextmenu", (e) => e.preventDefault());
      cvSrc.addEventListener("pointerdown", (e) => {
        if (!S.img) return;
        e.preventDefault();
        cvSrc.setPointerCapture(e.pointerId);
        const p = evPos(e, cvSrc);
        if (e.button === 1 || e.button === 2 || S.space || S.tool === "hand") {
          RT.ptrS = { kind: "pan", x: p.x, y: p.y, vx: view.x, vy: view.y };
          cvSrc.style.cursor = "grabbing";
          return;
        }
        if (e.button !== 0) return;
        const [wx, wy] = toWorld(p),
          cell = cellAt(wx, wy);
        if (S.tool === "calib") {
          S.calib.pts.push({ x: wx, y: wy });
          if (S.calib.pts.length >= 4) applyCalibration();
          else renderSource();
          return;
        }
        if (S.tool === "select") {
          RT.selDrag = { x0: wx, y0: wy, x1: wx, y1: wy, sx: p.x, sy: p.y };
          renderSource();
          return;
        }
        if (S.tool === "tile") commitCrop(cell.c, cell.r, 1, 1);
        else if (S.tool === "patch") {
          RT.patchSel = { c0: cell.c, r0: cell.r, c1: cell.c, r1: cell.r };
          renderSource();
          updateLive();
        } else if (S.tool === "origin") {
          S.grid.ox = Math.round(wx);
          S.grid.oy = Math.round(wy);
          syncInputs();
          renderSource();
          updateLive();
          toast(`Origin grid → ${S.grid.ox}, ${S.grid.oy}`);
        }
      });
      cvSrc.addEventListener("pointermove", (e) => {
        if (!S.img) return;
        const p = evPos(e, cvSrc);
        S.mouse = p;
        if (RT.ptrS && RT.ptrS.kind === "pan") {
          view.x = RT.ptrS.vx + (p.x - RT.ptrS.x);
          view.y = RT.ptrS.vy + (p.y - RT.ptrS.y);
          view.moved = true;
          renderSource();
          updateStatus();
          return;
        }
        const [wx, wy] = toWorld(p);
        if (RT.selDrag) {
          RT.selDrag.x1 = wx;
          RT.selDrag.y1 = wy;
        }
        const cell = cellAt(wx, wy);
        const changed =
          !S.hoverCell || S.hoverCell.c !== cell.c || S.hoverCell.r !== cell.r;
        S.hoverCell = cell;
        if (RT.patchSel) {
          RT.patchSel.c1 = cell.c;
          RT.patchSel.r1 = cell.r;
        }
        renderSource();
        if (changed) updateLive();
        updateStatus();
      });
      export const endPtrS = () => {
        if (RT.ptrS && RT.ptrS.kind === "pan") {
          RT.ptrS = null;
          cvSrc.style.cursor = S.tool === "hand" ? "grab" : "crosshair";
          return;
        }
        if (RT.selDrag) {
          const movedPx =
            Math.hypot(RT.selDrag.x1 - RT.selDrag.x0, RT.selDrag.y1 - RT.selDrag.y0) *
            view.scale;
          if (movedPx < 5) {
            const t = cellTop(
              RT.selDrag.x1 === undefined ? 0 : cellAt(RT.selDrag.x1, RT.selDrag.y1).c,
              0,
            ); // noop guard
            const cell = cellAt(RT.selDrag.x1, RT.selDrag.y1);
            const ct = cellTop(cell.c, cell.r);
            if (
              ct.x >= -S.grid.w &&
              ct.x <= S.iw + S.grid.w &&
              ct.y >= -S.grid.h &&
              ct.y <= S.ih + S.grid.h
            )
              toggleSelCell(cell.c, cell.r);
          } else {
            marqueeCells(RT.selDrag).forEach((k) => S.sel.add(k));
            updateSelUI();
          }
          RT.selDrag = null;
          renderSource();
          return;
        }
        if (RT.patchSel) {
          const n = normRect();
          commitCrop(n.cA, n.rA, n.wc, n.hc);
          RT.patchSel = null;
          renderSource();
          updateLive();
        }
      };
      cvSrc.addEventListener("pointerup", endPtrS);
      cvSrc.addEventListener("pointercancel", endPtrS);
      cvSrc.addEventListener("pointerleave", () => {
        if (RT.ptrS) return;
        S.mouse = null;
        S.hoverCell = null;
        renderSource();
        updateStatus();
        updateLive();
      });
      cvSrc.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          if (!S.img) return;
          const p = evPos(e, cvSrc);
          zoomAt(view, p.x, p.y, Math.exp(-e.deltaY * 0.0012));
          renderSource();
          updateStatus();
        },
        { passive: false },
      );

      /* ================================================================
   EVENTS — template canvas
   ================================================================ */
      cvTmpl.addEventListener("contextmenu", (e) => e.preventDefault());
      cvTmpl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        cvTmpl.setPointerCapture(e.pointerId);
        const p = evPos(e, cvTmpl);
        if (e.button === 1 || S.space) {
          RT.ptrT = { kind: "pan", x: p.x, y: p.y, vx: tpv.x, vy: tpv.y };
          return;
        }
        if (e.button === 0) {
          if (tp.tool === "fill") {
            const cell = cellAtT(...toWorldT(p));
            if (fillT(cell.c, cell.r)) {
              pushTUndo();
              renderTemplate();
              updateTInfo();
              toast("Zona diisi");
            } else toast("Zona sudah berisi material ini", "warn");
            return;
          }
          RT.ptrT = { kind: "paint" };
          applyTStroke(p);
        } else if (e.button === 2) {
          RT.ptrT = { kind: "erase" };
          applyTStroke(p);
        }
      });
      cvTmpl.addEventListener("pointermove", (e) => {
        const p = evPos(e, cvTmpl);
        tp.mouse = p;
        if (RT.ptrT && RT.ptrT.kind === "pan") {
          tpv.x = RT.ptrT.vx + (p.x - RT.ptrT.x);
          tpv.y = RT.ptrT.vy + (p.y - RT.ptrT.y);
          tp.moved = true;
          renderTemplate();
          updateStatus();
          return;
        }
        tp.hover = cellAtT(...toWorldT(p));
        if (RT.ptrT && (RT.ptrT.kind === "paint" || RT.ptrT.kind === "erase"))
          applyTStroke(p);
        renderTemplate();
        updateStatus();
      });
      cvTmpl.addEventListener("pointerup", () => (RT.ptrT = null));
      cvTmpl.addEventListener("pointercancel", () => (RT.ptrT = null));
      cvTmpl.addEventListener("pointerleave", () => {
        if (!RT.ptrT) {
          tp.mouse = null;
          tp.hover = null;
          renderTemplate();
          updateStatus();
        }
      });
      cvTmpl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const p = evPos(e, cvTmpl);
          zoomAt(tpv, p.x, p.y, Math.exp(-e.deltaY * 0.0012));
          renderTemplate();
          updateStatus();
        },
        { passive: false },
      );

      /* ================================================================
   EVENTS — inspect canvas
   ================================================================ */
      cvPrev.addEventListener("contextmenu", (e) => e.preventDefault());
      export function applyPreviewStroke(p) {
        const cell = cellAtP(...toWorldP(p));
        if (RT.ptrP.kind === "paint") {
          if (canPaint(cell.c, cell.r)) {
            if (!RT.ptrP.pushed) {
              pushUndo();
              RT.ptrP.pushed = true;
            }
            paintCell(cell.c, cell.r);
          }
        } else if (canErase(cell.c, cell.r)) {
          if (!RT.ptrP.pushed) {
            pushUndo();
            RT.ptrP.pushed = true;
          }
          eraseCell(cell.c, cell.r);
        }
      }
      cvPrev.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        cvPrev.setPointerCapture(e.pointerId);
        const p = evPos(e, cvPrev);
        if (e.button === 1 || S.space) {
          RT.ptrP = { kind: "pan", x: p.x, y: p.y, vx: pv.x, vy: pv.y };
          return;
        }
        if (e.button === 0) {
          RT.ptrP = { kind: pv.tool === "brush" ? "paint" : "erase" };
          applyPreviewStroke(p);
        } else if (e.button === 2) {
          RT.ptrP = { kind: "erase" };
          applyPreviewStroke(p);
        }
      });
      cvPrev.addEventListener("pointermove", (e) => {
        const p = evPos(e, cvPrev);
        pv.mouse = p;
        if (RT.ptrP && RT.ptrP.kind === "pan") {
          pv.x = RT.ptrP.vx + (p.x - RT.ptrP.x);
          pv.y = RT.ptrP.vy + (p.y - RT.ptrP.y);
          pv.moved = true;
          renderPreview();
          updateStatus();
          return;
        }
        pv.hover = cellAtP(...toWorldP(p));
        if (RT.ptrP && (RT.ptrP.kind === "paint" || RT.ptrP.kind === "erase"))
          applyPreviewStroke(p);
        renderPreview();
        updateStatus();
      });
      cvPrev.addEventListener("pointerup", () => (RT.ptrP = null));
      cvPrev.addEventListener("pointercancel", () => (RT.ptrP = null));
      cvPrev.addEventListener("pointerleave", () => {
        if (!RT.ptrP) {
          pv.mouse = null;
          pv.hover = null;
          renderPreview();
          updateStatus();
        }
      });
      cvPrev.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const p = evPos(e, cvPrev);
          zoomAt(pv, p.x, p.y, Math.exp(-e.deltaY * 0.0012));
          renderPreview();
          updateStatus();
        },
        { passive: false },
      );

