import { $, DPR, MATS, S, clamp, cvTmpl, tctx, tp, tpv } from './core.js';
import { cellPathT, cellTopT, fitCanvas, hud, tEdges } from './geo.js';
import { updateTInfo } from './template-export.js';

      /* ================================================================
   TEMPLATE STUDIO
   ================================================================ */

      export function updateTGeom() {
        tp.dh = clamp(Math.round(tp.dh), 4, 512);
        tp.dw = 2 * tp.dh;
        const hw = tp.dw / 2;
        tp.ox = tp.W / 2 + ((tp.rows - tp.cols) * hw) / 2;
        tp.oy = (tp.H - ((tp.cols + tp.rows) * tp.dh) / 2) / 2;
      }
      export function autoDiamond() {
        const pad = 48;
        tp.dh = Math.max(
          4,
          Math.floor(
            Math.min(tp.H - 2 * pad, (tp.W - 2 * pad) / 2) /
              (tp.cols + tp.rows),
          ),
        );
        updateTGeom();
      }
      export function pruneTMap() {
        for (const k of [...tp.map.keys()]) {
          const i = k.indexOf(","),
            c = +k.slice(0, i),
            r = +k.slice(i + 1);
          if (c >= tp.cols || r >= tp.rows || c < 0 || r < 0) tp.map.delete(k);
        }
      }
      export function applyTLayout(kind) {
        tp.map.clear();
        if (kind === "garden") {
          for (let r = 0; r < tp.rows; r++)
            for (let c = 0; c < tp.cols; c++) {
              let m = "grass";
              if (c >= tp.cols - 2) m = "water";
              if (r >= 1 && r <= 2 && c >= 1 && c <= 3) m = "soil";
              if (r === tp.rows - 2 && c < tp.cols - 2) m = "path";
              tp.map.set(c + "," + r, m);
            }
        } else if (kind === "grass") {
          for (let r = 0; r < tp.rows; r++)
            for (let c = 0; c < tp.cols; c++) tp.map.set(c + "," + r, "grass");
        }
        renderTemplate();
        updateTInfo();
      }
      export function connectedT() {
        const seen = new Set(),
          out = [];
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const k = c + "," + r,
              m = tp.map.get(k);
            if (!m || seen.has(k)) continue;
            const cells = [],
              q = [[c, r]];
            seen.add(k);
            while (q.length) {
              const [cc, rr] = q.pop();
              cells.push({ c: cc, r: rr });
              for (const [dc, dr] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]) {
                const nk = cc + dc + "," + (rr + dr);
                if (!seen.has(nk) && tp.map.get(nk) === m) {
                  seen.add(nk);
                  q.push([cc + dc, rr + dr]);
                }
              }
            }
            let sx = 0,
              sy = 0;
            for (const cell of cells) {
              const t = cellTopT(cell.c, cell.r);
              sx += t.x;
              sy += t.y + tp.dh / 2;
            }
            out.push({
              mat: m,
              cells,
              cx: sx / cells.length,
              cy: sy / cells.length,
            });
          }
        return out;
      }
      export function borderEdgesT() {
        const out = [];
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const m = tp.map.get(c + "," + r);
            if (!m) continue;
            for (const e of tEdges(c, r)) {
              const [nc, nr] = e.n;
              if (nc < 0 || nc >= tp.cols || nr < 0 || nr >= tp.rows) continue;
              const nm = tp.map.get(nc + "," + nr);
              if (nm && nm !== m) out.push(e);
            }
          }
        return out;
      }
      export function fitTemplate() {
        const r = cvTmpl.getBoundingClientRect();
        if (r.width < 10) return;
        tpv.scale = clamp(
          Math.min((r.width - 40) / tp.W, (r.height - 40) / tp.H),
          0.02,
          8,
        );
        tpv.x = (r.width - tp.W * tpv.scale) / 2;
        tpv.y = (r.height - tp.H * tpv.scale) / 2;
        tp.moved = false;
      }
      export function tGridPath(c2d) {
        c2d.beginPath();
        for (let c = 0; c <= tp.cols; c++) {
          const a = cellTopT(c, 0),
            b = cellTopT(c, tp.rows);
          c2d.moveTo(a.x, a.y);
          c2d.lineTo(b.x, b.y);
        }
        for (let r = 0; r <= tp.rows; r++) {
          const a = cellTopT(0, r),
            b = cellTopT(tp.cols, r);
          c2d.moveTo(a.x, a.y);
          c2d.lineTo(b.x, b.y);
        }
      }
      export function renderTemplate() {
        if (S.mode !== "template") return;
        const { w, h } = fitCanvas(cvTmpl),
          d = DPR();
        tctx.setTransform(d, 0, 0, d, 0, 0);
        tctx.fillStyle = "#0d0e11";
        tctx.fillRect(0, 0, w, h);
        tctx.setTransform(
          d * tpv.scale,
          0,
          0,
          d * tpv.scale,
          d * tpv.x,
          d * tpv.y,
        );
        tctx.fillStyle = "#101214";
        tctx.fillRect(0, 0, tp.W, tp.H);
        tctx.strokeStyle = "rgba(255,255,255,.25)";
        tctx.lineWidth = 1 / tpv.scale;
        tctx.strokeRect(0, 0, tp.W, tp.H);
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const m = tp.map.get(c + "," + r);
            tctx.beginPath();
            cellPathT(tctx, c, r);
            tctx.fillStyle = m ? MATS[m].color : "#23262a";
            tctx.fill();
          }
        tGridPath(tctx);
        tctx.strokeStyle = "rgba(255,255,255,.5)";
        tctx.lineWidth = 1.2 / tpv.scale;
        tctx.stroke();
        if (tp.borders) {
          const be = borderEdgesT();
          if (be.length) {
            tctx.beginPath();
            for (const e of be) {
              tctx.moveTo(e.p1.x, e.p1.y);
              tctx.lineTo(e.p2.x, e.p2.y);
            }
            tctx.strokeStyle = "#ffffff";
            tctx.lineWidth = 3 / tpv.scale;
            tctx.stroke();
          }
        }
        if (tp.labels) drawTLabels(tctx);
        if (tp.hover) {
          tctx.beginPath();
          cellPathT(tctx, tp.hover.c, tp.hover.r);
          tctx.fillStyle = "rgba(240,179,74,.22)";
          tctx.fill();
          tctx.strokeStyle = "#efb34a";
          tctx.lineWidth = 1.5 / tpv.scale;
          tctx.stroke();
        }
        tctx.setTransform(d, 0, 0, d, 0, 0);
        if (tp.mouse && tp.hover) {
          const m = tp.map.get(tp.hover.c + "," + tp.hover.r);
          hud(
            tctx,
            tp.mouse.x,
            tp.mouse.y,
            `CELL ${tp.hover.c},${tp.hover.r}${m ? " · " + MATS[m].label : ""}`,
          );
        }
      }
      export function drawTLabels(c) {
        const zones = connectedT();
        if (!zones.length) return;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineJoin = "round";
        for (const z of zones) {
          const size = clamp(
            tp.dh * 0.18 * Math.sqrt(z.cells.length),
            9,
            tp.dh * 0.45,
          );
          c.font = `bold ${size}px Arial, sans-serif`;
          const cx = clamp(z.cx, 40, tp.W - 40),
            cy = clamp(z.cy, size, tp.H - size);
          c.strokeStyle = "rgba(0,0,0,.85)";
          c.lineWidth = size * 0.16;
          c.strokeText(MATS[z.mat].label, cx, cy);
          c.fillStyle = "#ffffff";
          c.fillText(MATS[z.mat].label, cx, cy);
        }
      }

