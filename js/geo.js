import { DPR, RT, S, clamp, makeCanvas, pv, tp, tpv, view } from './core.js';

      /* ================================================================
   GEOMETRI ISOMETRIC
   Cell (c, r): top-vertex di (ox + (c-r)*hw, oy + (c+r)*hh).
   a = (x/hw + y/hh)/2, b = (y/hh - x/hw)/2 → cell = floor(a), floor(b).
   ================================================================ */

      export const gHW = () => S.grid.w / 2,
        gHH = () => S.grid.h / 2;
      export function cellTop(c, r) {
        return {
          x: S.grid.ox + (c - r) * gHW(),
          y: S.grid.oy + (c + r) * gHH(),
        };
      }
      export function cellAt(wx, wy) {
        const a = ((wx - S.grid.ox) / gHW() + (wy - S.grid.oy) / gHH()) / 2;
        const b = ((wy - S.grid.oy) / gHH() - (wx - S.grid.ox) / gHW()) / 2;
        return { c: Math.floor(a), r: Math.floor(b) };
      }
      export function cellTopP(c, r) {
        const hw = S.out.w / 2,
          hh = S.out.h / 2;
        return { x: (c - r) * hw, y: (c + r) * hh };
      }
      export function cellAtP(wx, wy) {
        const hw = S.out.w / 2,
          hh = S.out.h / 2;
        const a = (wx / hw + wy / hh) / 2,
          b = (wy / hh - wx / hw) / 2;
        return { c: Math.floor(a), r: Math.floor(b) };
      }
      export function cellTopT(c, r) {
        const hw = tp.dw / 2,
          hh = tp.dh / 2;
        return { x: tp.ox + (c - r) * hw, y: tp.oy + (c + r) * hh };
      }
      export function cellAtT(wx, wy) {
        const hw = tp.dw / 2,
          hh = tp.dh / 2;
        const a = ((wx - tp.ox) / hw + (wy - tp.oy) / hh) / 2;
        const b = ((wy - tp.oy) / hh - (wx - tp.ox) / hw) / 2;
        return { c: Math.floor(a), r: Math.floor(b) };
      }
      export function cellPathT(ctx, c, r) {
        const t = cellTopT(c, r),
          hw = tp.dw / 2,
          hh = tp.dh / 2;
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + hw, t.y + hh);
        ctx.lineTo(t.x, t.y + tp.dh);
        ctx.lineTo(t.x - hw, t.y + hh);
        ctx.closePath();
      }
      export function tEdges(c, r) {
        const T = cellTopT(c, r),
          hw = tp.dw / 2,
          hh = tp.dh / 2;
        const R = { x: T.x + hw, y: T.y + hh },
          B = { x: T.x, y: T.y + tp.dh },
          L = { x: T.x - hw, y: T.y + hh };
        return [
          { p1: T, p2: R, n: [c, r - 1] },
          { p1: T, p2: L, n: [c - 1, r] },
          { p1: R, p2: B, n: [c + 1, r] },
          { p1: L, p2: B, n: [c, r + 1] },
        ];
      }

      export const evPos = (e, cv) => {
        const r = cv.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      export const toWorld = (p) => [
        (p.x - view.x) / view.scale,
        (p.y - view.y) / view.scale,
      ];
      export const toWorldP = (p) => [
        (p.x - pv.x) / pv.scale,
        (p.y - pv.y) / pv.scale,
      ];
      export const toWorldT = (p) => [
        (p.x - tpv.x) / tpv.scale,
        (p.y - tpv.y) / tpv.scale,
      ];

      export function normRect() {
        const cA = Math.min(RT.patchSel.c0, RT.patchSel.c1),
          cB = Math.max(RT.patchSel.c0, RT.patchSel.c1);
        const rA = Math.min(RT.patchSel.r0, RT.patchSel.r1),
          rB = Math.max(RT.patchSel.r0, RT.patchSel.r1);
        return { cA, rA, wc: cB - cA + 1, hc: rB - rA + 1 };
      }

      /* ================================================================
   CANVAS helpers
   ================================================================ */
      export function fitCanvas(cv) {
        const r = cv.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)),
          h = Math.max(1, Math.round(r.height));
        const d = DPR(),
          W = Math.round(w * d),
          H = Math.round(h * d);
        if (cv.width !== W || cv.height !== H) {
          cv.width = W;
          cv.height = H;
        }
        return { w, h };
      }
      export let checkerPattern = null;
      export function getChecker(ctx) {
        if (!checkerPattern) {
          const pc = makeCanvas(16, 16),
            p = pc.getContext("2d");
          p.fillStyle = "#14161a";
          p.fillRect(0, 0, 16, 16);
          p.fillStyle = "#1a1d22";
          p.fillRect(0, 0, 8, 8);
          p.fillRect(8, 8, 8, 8);
          checkerPattern = ctx.createPattern(pc, "repeat");
        }
        return checkerPattern;
      }
      export function drawCheckerTo(c, x, y, w, h, s) {
        c.fillStyle = "#14161a";
        c.fillRect(x, y, w, h);
        c.fillStyle = "#1a1d22";
        for (let yy = y, j = 0; yy < y + h; yy += s, j++)
          for (let xx = x + (j % 2) * s; xx < x + w; xx += s * 2)
            c.fillRect(xx, yy, s, s);
      }
      export function hud(ctx, x, y, text) {
        ctx.font = '11px "IBM Plex Mono", monospace';
        const w = ctx.measureText(text).width + 16,
          h = 20;
        const hx = clamp(x + 14, 6, ctx.canvas.width / DPR() - w - 6);
        const hy = clamp(y - 28, 6, ctx.canvas.height / DPR() - h - 6);
        ctx.fillStyle = "rgba(13,14,17,.88)";
        ctx.strokeStyle = "rgba(240,179,74,.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(hx, hy, w, h, 5) : ctx.rect(hx, hy, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#efb34a";
        ctx.fillText(text, hx + 8, hy + 14);
      }

