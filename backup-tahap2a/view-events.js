      /* ================================================================
   VIEW / ZOOM / PAN
   ================================================================ */
      function zoomAt(v, px, py, f) {
        const ns = clamp(v.scale * f, 0.02, 40);
        f = ns / v.scale;
        v.x = px - (px - v.x) * f;
        v.y = py - (py - v.y) * f;
        v.scale = ns;
        v.moved = true;
      }
      function fitView() {
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
      function zoomCenter(f) {
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
          ptrS = { kind: "pan", x: p.x, y: p.y, vx: view.x, vy: view.y };
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
          selDrag = { x0: wx, y0: wy, x1: wx, y1: wy, sx: p.x, sy: p.y };
          renderSource();
          return;
        }
        if (S.tool === "tile") commitCrop(cell.c, cell.r, 1, 1);
        else if (S.tool === "patch") {
          patchSel = { c0: cell.c, r0: cell.r, c1: cell.c, r1: cell.r };
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
        if (ptrS && ptrS.kind === "pan") {
          view.x = ptrS.vx + (p.x - ptrS.x);
          view.y = ptrS.vy + (p.y - ptrS.y);
          view.moved = true;
          renderSource();
          updateStatus();
          return;
        }
        const [wx, wy] = toWorld(p);
        if (selDrag) {
          selDrag.x1 = wx;
          selDrag.y1 = wy;
        }
        const cell = cellAt(wx, wy);
        const changed =
          !S.hoverCell || S.hoverCell.c !== cell.c || S.hoverCell.r !== cell.r;
        S.hoverCell = cell;
        if (patchSel) {
          patchSel.c1 = cell.c;
          patchSel.r1 = cell.r;
        }
        renderSource();
        if (changed) updateLive();
        updateStatus();
      });
      const endPtrS = () => {
        if (ptrS && ptrS.kind === "pan") {
          ptrS = null;
          cvSrc.style.cursor = S.tool === "hand" ? "grab" : "crosshair";
          return;
        }
        if (selDrag) {
          const movedPx =
            Math.hypot(selDrag.x1 - selDrag.x0, selDrag.y1 - selDrag.y0) *
            view.scale;
          if (movedPx < 5) {
            const t = cellTop(
              selDrag.x1 === undefined ? 0 : cellAt(selDrag.x1, selDrag.y1).c,
              0,
            ); // noop guard
            const cell = cellAt(selDrag.x1, selDrag.y1);
            const ct = cellTop(cell.c, cell.r);
            if (
              ct.x >= -S.grid.w &&
              ct.x <= S.iw + S.grid.w &&
              ct.y >= -S.grid.h &&
              ct.y <= S.ih + S.grid.h
            )
              toggleSelCell(cell.c, cell.r);
          } else {
            marqueeCells(selDrag).forEach((k) => S.sel.add(k));
            updateSelUI();
          }
          selDrag = null;
          renderSource();
          return;
        }
        if (patchSel) {
          const n = normRect();
          commitCrop(n.cA, n.rA, n.wc, n.hc);
          patchSel = null;
          renderSource();
          updateLive();
        }
      };
      cvSrc.addEventListener("pointerup", endPtrS);
      cvSrc.addEventListener("pointercancel", endPtrS);
      cvSrc.addEventListener("pointerleave", () => {
        if (ptrS) return;
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
          ptrT = { kind: "pan", x: p.x, y: p.y, vx: tpv.x, vy: tpv.y };
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
          ptrT = { kind: "paint" };
          applyTStroke(p);
        } else if (e.button === 2) {
          ptrT = { kind: "erase" };
          applyTStroke(p);
        }
      });
      cvTmpl.addEventListener("pointermove", (e) => {
        const p = evPos(e, cvTmpl);
        tp.mouse = p;
        if (ptrT && ptrT.kind === "pan") {
          tpv.x = ptrT.vx + (p.x - ptrT.x);
          tpv.y = ptrT.vy + (p.y - ptrT.y);
          tp.moved = true;
          renderTemplate();
          updateStatus();
          return;
        }
        tp.hover = cellAtT(...toWorldT(p));
        if (ptrT && (ptrT.kind === "paint" || ptrT.kind === "erase"))
          applyTStroke(p);
        renderTemplate();
        updateStatus();
      });
      cvTmpl.addEventListener("pointerup", () => (ptrT = null));
      cvTmpl.addEventListener("pointercancel", () => (ptrT = null));
      cvTmpl.addEventListener("pointerleave", () => {
        if (!ptrT) {
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
      function applyPreviewStroke(p) {
        const cell = cellAtP(...toWorldP(p));
        if (ptrP.kind === "paint") {
          if (canPaint(cell.c, cell.r)) {
            if (!ptrP.pushed) {
              pushUndo();
              ptrP.pushed = true;
            }
            paintCell(cell.c, cell.r);
          }
        } else if (canErase(cell.c, cell.r)) {
          if (!ptrP.pushed) {
            pushUndo();
            ptrP.pushed = true;
          }
          eraseCell(cell.c, cell.r);
        }
      }
      cvPrev.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        cvPrev.setPointerCapture(e.pointerId);
        const p = evPos(e, cvPrev);
        if (e.button === 1 || S.space) {
          ptrP = { kind: "pan", x: p.x, y: p.y, vx: pv.x, vy: pv.y };
          return;
        }
        if (e.button === 0) {
          ptrP = { kind: pv.tool === "brush" ? "paint" : "erase" };
          applyPreviewStroke(p);
        } else if (e.button === 2) {
          ptrP = { kind: "erase" };
          applyPreviewStroke(p);
        }
      });
      cvPrev.addEventListener("pointermove", (e) => {
        const p = evPos(e, cvPrev);
        pv.mouse = p;
        if (ptrP && ptrP.kind === "pan") {
          pv.x = ptrP.vx + (p.x - ptrP.x);
          pv.y = ptrP.vy + (p.y - ptrP.y);
          pv.moved = true;
          renderPreview();
          updateStatus();
          return;
        }
        pv.hover = cellAtP(...toWorldP(p));
        if (ptrP && (ptrP.kind === "paint" || ptrP.kind === "erase"))
          applyPreviewStroke(p);
        renderPreview();
        updateStatus();
      });
      cvPrev.addEventListener("pointerup", () => (ptrP = null));
      cvPrev.addEventListener("pointercancel", () => (ptrP = null));
      cvPrev.addEventListener("pointerleave", () => {
        if (!ptrP) {
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

