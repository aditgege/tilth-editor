import { $, DPR, RT, S, cvSrc, sctx, view } from './core.js';
import { cellAt, cellTop, fitCanvas, gHH, gHW, getChecker, hud, normRect } from './geo.js';
import { marqueeCells } from './source-select.js';

      /* ================================================================
   RENDER — SOURCE
   ================================================================ */

      export function renderSource() {
        const { w, h } = fitCanvas(cvSrc),
          d = DPR();
        sctx.setTransform(d, 0, 0, d, 0, 0);
        sctx.fillStyle = "#0d0e11";
        sctx.fillRect(0, 0, w, h);
        if (!S.img) return;

        sctx.save();
        sctx.translate(view.x, view.y);
        sctx.fillStyle = getChecker(sctx);
        sctx.fillRect(0, 0, S.iw * view.scale, S.ih * view.scale);
        sctx.restore();

        sctx.setTransform(
          d * view.scale,
          0,
          0,
          d * view.scale,
          d * view.x,
          d * view.y,
        );
        sctx.imageSmoothingEnabled = view.scale < 1;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(S.img, 0, 0);
        sctx.strokeStyle = "rgba(255,255,255,.18)";
        sctx.lineWidth = 1 / view.scale;
        sctx.strokeRect(0, 0, S.iw, S.ih);

        if (S.grid.show) drawGridS();
        drawHighlightS();
        drawCalibS();
        drawOriginS();

        sctx.setTransform(d, 0, 0, d, 0, 0);
        if (S.mouse) {
          let line = null;
          if (S.tool === "calib") {
            const n = S.calib.pts.length;
            line =
              n >= 4
                ? "CALIB — applying…"
                : `CALIB ${n}/4 — klik vertex ${["ATAS", "KANAN", "BAWAH", "KIRI"][n]}`;
          } else if (S.tool === "select") {
            const n = RT.selDrag ? marqueeCells(RT.selDrag).length : S.sel.size;
            line = `SELECT ${n} cell`;
          } else if (S.tool === "origin")
            line = `SET ORIGIN  ${Math.round(S.grid.ox)}, ${Math.round(S.grid.oy)}`;
          else if (S.tool === "tile" && S.hoverCell)
            line = `CELL ${S.hoverCell.c},${S.hoverCell.r} → ${S.out.w}×${S.out.h}`;
          else if (S.tool === "patch") {
            if (RT.patchSel) {
              const n = normRect();
              line = `${n.wc}×${n.hc} cells → ${Math.round(((n.wc + n.hc) * S.out.w) / 2)}×${Math.round(((n.wc + n.hc) * S.out.h) / 2)}`;
            } else if (S.hoverCell)
              line = `CELL ${S.hoverCell.c},${S.hoverCell.r}`;
          }
          if (line) hud(sctx, S.mouse.x, S.mouse.y, line);
        }
      }

      export function cellPathS(ctx, c, r) {
        const t = cellTop(c, r),
          hw = gHW(),
          hh = gHH();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + hw, t.y + hh);
        ctx.lineTo(t.x, t.y + S.grid.h);
        ctx.lineTo(t.x - hw, t.y + hh);
        ctx.closePath();
      }
      export function drawGridS() {
        let cMin = 1e9,
          cMax = -1e9,
          rMin = 1e9,
          rMax = -1e9;
        for (const [x, y] of [
          [0, 0],
          [S.iw, 0],
          [0, S.ih],
          [S.iw, S.ih],
        ]) {
          const { c, r } = cellAt(x, y);
          cMin = Math.min(cMin, c);
          cMax = Math.max(cMax, c);
          rMin = Math.min(rMin, r);
          rMax = Math.max(rMax, r);
        }
        cMin--;
        cMax++;
        rMin--;
        rMax++;
        if (cMax - cMin + rMax - rMin > 8000) return;
        sctx.beginPath();
        for (let c = cMin; c <= cMax + 1; c++) {
          const p0 = cellTop(c, rMin),
            p1 = cellTop(c, rMax + 1);
          sctx.moveTo(p0.x, p0.y);
          sctx.lineTo(p1.x, p1.y);
        }
        for (let r = rMin; r <= rMax + 1; r++) {
          const p0 = cellTop(cMin, r),
            p1 = cellTop(cMax + 1, r);
          sctx.moveTo(p0.x, p0.y);
          sctx.lineTo(p1.x, p1.y);
        }
        sctx.strokeStyle = "rgba(255,255,255,.22)";
        sctx.lineWidth = 1 / view.scale;
        sctx.stroke();
      }
      export function patchPathS(ctx, cA, rA, wc, hc) {
        const A = cellTop(cA, rA),
          hw = gHW(),
          hh = gHH();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(A.x + wc * hw, A.y + wc * hh);
        ctx.lineTo(A.x + (wc - hc) * hw, A.y + (wc + hc) * hh);
        ctx.lineTo(A.x - hc * hw, A.y + hc * hh);
        ctx.closePath();
      }
      export function drawCellsFill(keys, fill, stroke, lw) {
        sctx.beginPath();
        for (const k of keys) {
          const i = k.indexOf(",");
          cellPathS(sctx, +k.slice(0, i), +k.slice(i + 1));
        }
        if (fill) {
          sctx.fillStyle = fill;
          sctx.fill();
        }
        if (stroke) {
          sctx.strokeStyle = stroke;
          sctx.lineWidth = lw;
          sctx.stroke();
        }
      }
      export function drawHighlightS() {
        const lw = 1.5 / view.scale;

        /* multi-select persisten */
        if (S.sel.size)
          drawCellsFill(
            S.sel,
            "rgba(168,202,108,.18)",
            "#a8ca6c",
            1.2 / view.scale,
          );

        /* marquee aktif */
        if (RT.selDrag) {
          const cells = marqueeCells(RT.selDrag);
          if (cells.length)
            drawCellsFill(cells, "rgba(168,202,108,.14)", null, 0);
          const x0 = Math.min(RT.selDrag.x0, RT.selDrag.x1),
            y0 = Math.min(RT.selDrag.y0, RT.selDrag.y1);
          const x1 = Math.max(RT.selDrag.x0, RT.selDrag.x1),
            y1 = Math.max(RT.selDrag.y0, RT.selDrag.y1);
          sctx.setLineDash([6 / view.scale, 4 / view.scale]);
          sctx.strokeStyle = "#a8ca6c";
          sctx.lineWidth = 1 / view.scale;
          sctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          sctx.setLineDash([]);
        }

        if (S.tool === "select" && S.hoverCell) {
          sctx.beginPath();
          cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
          sctx.strokeStyle = "rgba(255,255,255,.55)";
          sctx.lineWidth = 1 / view.scale;
          sctx.stroke();
        } else if (S.tool === "tile" && S.hoverCell) {
          sctx.beginPath();
          cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
          sctx.fillStyle = "rgba(240,179,74,.16)";
          sctx.fill();
          sctx.strokeStyle = "#efb34a";
          sctx.lineWidth = lw;
          sctx.stroke();
        } else if (S.tool === "patch") {
          if (RT.patchSel) {
            const n = normRect();
            sctx.beginPath();
            patchPathS(sctx, n.cA, n.rA, n.wc, n.hc);
            sctx.fillStyle = "rgba(240,179,74,.16)";
            sctx.fill();
            sctx.strokeStyle = "#efb34a";
            sctx.lineWidth = lw;
            sctx.stroke();
          } else if (S.hoverCell) {
            sctx.beginPath();
            cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
            sctx.fillStyle = "rgba(240,179,74,.10)";
            sctx.fill();
          }
        }
      }
      export function drawCalibS() {
        const pts = S.calib.pts;
        if (!pts.length) return;
        const s = 1 / view.scale;
        if (pts.length > 1) {
          sctx.setLineDash([6 * s, 4 * s]);
          sctx.strokeStyle = "#7fd1d8";
          sctx.lineWidth = 1.5 * s;
          sctx.beginPath();
          pts.forEach((p, i) =>
            i ? sctx.lineTo(p.x, p.y) : sctx.moveTo(p.x, p.y),
          );
          if (pts.length === 4) sctx.closePath();
          sctx.stroke();
          sctx.setLineDash([]);
        }
        const lbl = ["T", "R", "B", "L"];
        pts.forEach((p, i) => {
          sctx.beginPath();
          sctx.arc(p.x, p.y, 6 * s, 0, Math.PI * 2);
          sctx.fillStyle = "#7fd1d8";
          sctx.fill();
          sctx.fillStyle = "#0d0e11";
          sctx.font = `bold ${9 * s}px monospace`;
          sctx.textAlign = "center";
          sctx.textBaseline = "middle";
          sctx.fillText(lbl[i], p.x, p.y + 0.5);
          sctx.textAlign = "left";
          sctx.textBaseline = "alphabetic";
        });
      }
      export function drawOriginS() {
        const { ox, oy } = S.grid,
          s = 1 / view.scale,
          L = 7 * s;
        sctx.lineWidth = 3 * s;
        sctx.strokeStyle = "rgba(10,12,14,.9)";
        sctx.beginPath();
        sctx.moveTo(ox - L, oy);
        sctx.lineTo(ox + L, oy);
        sctx.moveTo(ox, oy - L);
        sctx.lineTo(ox, oy + L);
        sctx.stroke();
        sctx.lineWidth = 1 * s;
        sctx.strokeStyle = "#7fd1d8";
        sctx.beginPath();
        sctx.moveTo(ox - L, oy);
        sctx.lineTo(ox + L, oy);
        sctx.moveTo(ox, oy - L);
        sctx.lineTo(ox, oy + L);
        sctx.stroke();
      }

