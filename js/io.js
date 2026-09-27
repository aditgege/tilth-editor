import { $, S, c255, hash2, makeCanvas, pv, toast } from './core.js';
import { entriesSorted, updateInspectPanels } from './inspect.js';
import { byUid } from './library.js';
import { setSourceImage } from './project.js';
import { updateLive } from './source-live.js';
import { renderSource } from './source-render.js';
import { syncInputs, updateStatus } from './ui.js';
import { fitView } from './view-events.js';

      /* ================================================================
   EXPORT TILESET
   ================================================================ */

      export function download(blob, name) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 500);
      }
      export const canvasBlob = (cv) =>
        new Promise((res) => cv.toBlob(res, "image/png"));
      export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      export function buildPreviewPng() {
        const hw = S.out.w / 2,
          hh = S.out.h / 2;
        const cv = makeCanvas(
          (pv.cols + pv.rows) * hw,
          (pv.cols + pv.rows) * hh,
        );
        const c = cv.getContext("2d");
        c.imageSmoothingEnabled = false;
        c.translate(pv.rows * hw, 0);
        for (const e of entriesSorted()) {
          const t = byUid(e.uid);
          if (!t) continue;
          c.drawImage(
            t.canvas,
            (e.c - e.r) * hw - t.ax,
            (e.c + e.r) * hh - t.ay,
          );
        }
        return cv;
      }
      export function uniqueNameOf() {
        const used = new Set(),
          m = new Map();
        for (const t of S.tiles) {
          let n = t.name || t.type,
            i = 2;
          while (used.has(n)) n = `${t.name}_${i++}`;
          used.add(n);
          m.set(t.uid, n);
        }
        return (t) => m.get(t.uid);
      }
      async function exportAll() {
        if (!S.tiles.length) {
          toast(
            "Asset library masih kosong — crop minimal satu tile dulu.",
            "warn",
          );
          return;
        }
        const nameOf = uniqueNameOf();
        const tiles = S.tiles.filter((t) => t.type === "tile");
        const patches = S.tiles.filter((t) => t.type === "patch");
        const meta = {
          generator: "TILTH — ai asset preparation editor",
          tile_width: S.out.w,
          tile_height: S.out.h,
          resample: S.out.resample,
          processing: { ...S.proc },
          tiles: [],
          patches: [],
        };
        const files = [];
        if (tiles.length) {
          const cols = 8,
            rows = Math.ceil(tiles.length / cols);
          const cv = makeCanvas(cols * S.out.w, rows * S.out.h),
            c = cv.getContext("2d");
          tiles.forEach((t, i) => {
            const x = (i % cols) * S.out.w,
              y = Math.floor(i / cols) * S.out.h;
            c.drawImage(t.canvas, x, y);
            meta.tiles.push({
              id: nameOf(t),
              atlas_x: x,
              atlas_y: y,
              width: t.canvas.width,
              height: t.canvas.height,
            });
          });
          files.push(["ground_tiles.png", await canvasBlob(cv)]);
        }
        if (patches.length) {
          const pad = 4;
          let maxW = 1024;
          patches.forEach(
            (t) => (maxW = Math.max(maxW, t.canvas.width + pad * 2)),
          );
          let x = pad,
            y = pad,
            rowH = 0;
          const placed = [];
          for (const t of patches) {
            if (x + t.canvas.width + pad > maxW) {
              x = pad;
              y += rowH + pad;
              rowH = 0;
            }
            placed.push([t, x, y]);
            x += t.canvas.width + pad;
            rowH = Math.max(rowH, t.canvas.height);
          }
          const cv = makeCanvas(maxW, y + rowH + pad),
            c = cv.getContext("2d");
          patches.forEach((t, i) => {
            const [, px, py] = placed[i];
            c.drawImage(t.canvas, px, py);
            meta.patches.push({
              id: nameOf(t),
              atlas_x: px,
              atlas_y: py,
              width: t.canvas.width,
              height: t.canvas.height,
              cells_w: t.wc,
              cells_h: t.hc,
              anchor_x: Math.round(t.ax),
            });
          });
          files.push(["ground_patches.png", await canvasBlob(cv)]);
        }
        files.push([
          "ground_tiles.json",
          new Blob([JSON.stringify(meta, null, 2)], {
            type: "application/json",
          }),
        ]);
        if (pv.map.size)
          files.push([
            "ground_preview.png",
            await canvasBlob(buildPreviewPng()),
          ]);
        for (const [name, blob] of files) {
          download(blob, name);
          await sleep(350);
        }
        toast(
          `Export ${files.length} file: ${files.map((f) => f[0]).join(", ")}`,
        );
      }

      /* ================================================================
   SAMPLE DIORAMA
   ================================================================ */
      export function generateSample() {
        const C = 7,
          R = 6,
          hw = 128,
          hh = 64,
          pad = 88;
        const W = (C + R) * hw + pad * 2,
          H = (C + R) * hh + pad * 2;
        const ox = pad + R * hw,
          oy = pad;
        const T = Array.from({ length: R }, () => Array(C).fill("G"));
        for (let r = 0; r < R; r++) {
          T[r][C - 2] = "W";
          T[r][C - 1] = "W";
        }
        [
          [1, 1],
          [1, 2],
          [2, 1],
          [2, 2],
          [2, 3],
        ].forEach(([r, c]) => (T[r][c] = "S"));
        for (let c = 0; c <= C - 3; c++) T[4][c] = "P";
        T[5][C - 3] = "P";
        const cv = makeCanvas(W, H),
          ctx = cv.getContext("2d");
        const id = ctx.createImageData(W, H),
          D = id.data;
        const BASE = { G: [82, 126, 60], W: [50, 108, 146], S: [122, 92, 62] };
        const GRAVEL = [
          [186, 166, 124],
          [160, 140, 98],
          [196, 178, 138],
          [148, 128, 88],
        ];
        const FLOWER = [
          [226, 120, 150],
          [232, 200, 92],
          [238, 238, 230],
        ];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const a = ((x - ox) / hw + (y - oy) / hh) / 2,
              b = ((y - oy) / hh - (x - ox) / hw) / 2;
            const c = Math.floor(a),
              r = Math.floor(b);
            if (c < 0 || c >= C || r < 0 || r >= R) continue;
            const t = T[r][c],
              fa = a - c,
              fb = b - r;
            const n1 = hash2(x, y),
              n2 = hash2(x >> 3, y >> 3),
              cs = hash2(c * 7 + 13, r * 11 + 29);
            let R8, G8, B8;
            if (t === "P") {
              const g = GRAVEL[(n1 * 4) | 0];
              R8 = g[0];
              G8 = g[1];
              B8 = g[2];
            } else {
              const bs = BASE[t];
              const v = (n2 - 0.5) * 26 + (n1 - 0.5) * 10 + (cs - 0.5) * 8;
              R8 = bs[0] + v;
              G8 = bs[1] + v;
              B8 = bs[2] + v * 0.8;
              if (t === "G" && n1 > 0.94) {
                R8 += 16;
                G8 += 22;
                B8 += 6;
              }
              if (t === "W" && n1 > 0.985) {
                R8 = 152;
                G8 = 206;
                B8 = 226;
              }
              if (t === "S" && n1 > 0.968) {
                R8 = 158;
                G8 = 134;
                B8 = 102;
              }
              if (t === "G") {
                const f = hash2(x * 3 + 11, y * 5 + 7);
                if (f > 0.9935 && cs > 0.3) {
                  const fl = FLOWER[Math.floor(f * 997) % 3];
                  R8 = fl[0];
                  G8 = fl[1];
                  B8 = fl[2];
                }
              }
            }
            const e = 0.045;
            const nb = (cc, rr) =>
              cc >= 0 && cc < C && rr >= 0 && rr < R ? T[rr][cc] : t;
            if (
              (fa < e && nb(c - 1, r) !== t) ||
              (fa > 1 - e && nb(c + 1, r) !== t) ||
              (fb < e && nb(c, r - 1) !== t) ||
              (fb > 1 - e && nb(c, r + 1) !== t)
            ) {
              R8 *= 0.72;
              G8 *= 0.72;
              B8 *= 0.72;
            }
            const i = (y * W + x) * 4;
            D[i] = c255(R8);
            D[i + 1] = c255(G8);
            D[i + 2] = c255(B8);
            D[i + 3] = 255;
          }
        ctx.putImageData(id, 0, 0);
        return { canvas: cv, ox, oy };
      }
      export function loadSample() {
        const s = generateSample();
        setSourceImage(s.canvas, "sample_diorama.png", 0);
        S.grid.w = 256;
        S.grid.h = 128;
        S.grid.ox = s.ox;
        S.grid.oy = s.oy;
        syncInputs();
        fitView();
        renderSource();
        updateStatus();
        updateLive();
        updateInspectPanels();
        toast(
          "Sample diorama siap — coba Select (S) + drag, atau Crop tile (T)",
        );
      }

