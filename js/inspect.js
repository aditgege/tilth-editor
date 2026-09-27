import { $, DPR, RT, S, clamp, cvPrev, pctx, pv } from './core.js';
import { cellTopP, drawCheckerTo, fitCanvas, hud } from './geo.js';
import { byUid } from './library.js';

      /* ================================================================
   PREVIEW / DIORAMA PAINT (Inspect)
   ================================================================ */

      export function entriesSorted() {
        return [...pv.map]
          .map(([k, e]) => {
            const i = k.indexOf(",");
            return { c: +k.slice(0, i), r: +k.slice(i + 1), ...e };
          })
          .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
      }
      export function serializeMap() {
        return JSON.stringify(
          [...pv.map].map(([k, e]) => [k, e.uid, e.wc, e.hc]),
        );
      }
      export function loadMap(s) {
        pv.map = new Map(
          JSON.parse(s).map(([k, uid, wc, hc]) => [k, { uid, wc, hc }]),
        );
      }
      export function pushUndo() {
        pv.undo.push(serializeMap());
        if (pv.undo.length > 60) pv.undo.shift();
        pv.redo.length = 0;
        updateUndoBtns();
      }
      export function doUndo() {
        if (!pv.undo.length) return;
        pv.redo.push(serializeMap());
        loadMap(pv.undo.pop());
        renderPreview();
        updateUndoBtns();
      }
      export function doRedo() {
        if (!pv.redo.length) return;
        pv.undo.push(serializeMap());
        loadMap(pv.redo.pop());
        renderPreview();
        updateUndoBtns();
      }
      export function updateUndoBtns() {
        $("#tbUndo").classList.toggle("dis", !pv.undo.length);
        $("#tbRedo").classList.toggle("dis", !pv.redo.length);
      }
      export function removeOverlap(c, r, wc, hc) {
        for (const [k, e] of [...pv.map]) {
          const i = k.indexOf(","),
            ec = +k.slice(0, i),
            er = +k.slice(i + 1);
          if (ec < c + wc && ec + e.wc > c && er < r + hc && er + e.hc > r)
            pv.map.delete(k);
        }
      }
      export function canPaint(c, r) {
        const t = byUid(S.active);
        return !!(
          t &&
          c >= 0 &&
          r >= 0 &&
          c + t.wc <= pv.cols &&
          r + t.hc <= pv.rows
        );
      }
      export function canErase(c, r) {
        for (const [k, e] of pv.map) {
          const i = k.indexOf(","),
            ec = +k.slice(0, i),
            er = +k.slice(i + 1);
          if (ec <= c && c < ec + e.wc && er <= r && r < er + e.hc) return true;
        }
        return false;
      }
      export function paintCell(c, r) {
        const t = byUid(S.active);
        if (!t) return;
        removeOverlap(c, r, t.wc, t.hc);
        pv.map.set(c + "," + r, { uid: t.uid, wc: t.wc, hc: t.hc });
        renderPreview();
      }
      export function eraseCell(c, r) {
        let hit = false;
        for (const [k, e] of [...pv.map]) {
          const i = k.indexOf(","),
            ec = +k.slice(0, i),
            er = +k.slice(i + 1);
          if (ec <= c && c < ec + e.wc && er <= r && r < er + e.hc) {
            pv.map.delete(k);
            hit = true;
          }
        }
        if (hit) renderPreview();
      }
      export function fitPreview() {
        const r = cvPrev.getBoundingClientRect();
        if (r.width < 10) return;
        const hw = S.out.w / 2,
          hh = S.out.h / 2;
        const W = (pv.cols + pv.rows) * hw,
          H = (pv.cols + pv.rows) * hh;
        pv.scale = clamp(
          Math.min((r.width - 70) / W, (r.height - 70) / H),
          0.05,
          8,
        );
        pv.x = r.width / 2 - (((pv.cols - pv.rows) * hw) / 2) * pv.scale;
        pv.y = r.height / 2 - (H / 2) * pv.scale;
        pv.moved = false;
      }
      export function renderPreview() {
        if (S.mode !== "inspect") return;
        const { w, h } = fitCanvas(cvPrev),
          d = DPR();
        pctx.setTransform(d, 0, 0, d, 0, 0);
        pctx.fillStyle = "#0d0e11";
        pctx.fillRect(0, 0, w, h);
        pctx.setTransform(d * pv.scale, 0, 0, d * pv.scale, d * pv.x, d * pv.y);
        const hw = S.out.w / 2,
          hh = S.out.h / 2;

        pctx.imageSmoothingEnabled = false;
        for (const e of entriesSorted()) {
          const t = byUid(e.uid);
          if (!t) continue;
          pctx.drawImage(
            t.canvas,
            (e.c - e.r) * hw - t.ax,
            (e.c + e.r) * hh - t.ay,
          );
        }

        pctx.beginPath();
        pctx.moveTo(0, 0);
        pctx.lineTo(pv.cols * hw, pv.cols * hh);
        pctx.lineTo((pv.cols - pv.rows) * hw, (pv.cols + pv.rows) * hh);
        pctx.lineTo(-pv.rows * hw, pv.rows * hh);
        pctx.closePath();
        pctx.strokeStyle = "rgba(255,255,255,.16)";
        pctx.lineWidth = 1 / pv.scale;
        pctx.stroke();

        if (pv.showGrid) {
          pctx.beginPath();
          for (let c = 0; c <= pv.cols; c++) {
            const p0 = cellTopP(c, 0),
              p1 = cellTopP(c, pv.rows);
            pctx.moveTo(p0.x, p0.y);
            pctx.lineTo(p1.x, p1.y);
          }
          for (let r = 0; r <= pv.rows; r++) {
            const p0 = cellTopP(0, r),
              p1 = cellTopP(pv.cols, r);
            pctx.moveTo(p0.x, p0.y);
            pctx.lineTo(p1.x, p1.y);
          }
          pctx.strokeStyle = "rgba(255,255,255,.10)";
          pctx.lineWidth = 1 / pv.scale;
          pctx.stroke();
        }

        const bt = byUid(S.active);
        if (
          pv.tool === "brush" &&
          bt &&
          pv.hover &&
          canPaint(pv.hover.c, pv.hover.r)
        ) {
          const p = cellTopP(pv.hover.c, pv.hover.r);
          pctx.globalAlpha = 0.55;
          pctx.drawImage(bt.canvas, p.x - bt.ax, p.y - bt.ay);
          pctx.globalAlpha = 1;
        }

        pctx.setTransform(d, 0, 0, d, 0, 0);
        if (pv.mouse && pv.hover)
          hud(pctx, pv.mouse.x, pv.mouse.y, `CELL ${pv.hover.c},${pv.hover.r}`);
      }
      export function updatePrevEmpty() {
        const show = S.mode === "inspect" && !byUid(S.active);
        const el = $("#prevEmpty");
        el.innerHTML = !S.tiles.length
          ? "<strong>Library masih kosong</strong><span>Kembali ke mode Source, crop beberapa diamond, lalu validasi di sini.</span>"
          : "<strong>Pilih brush dulu</strong><span>Klik salah satu tile di Asset Library, lalu klik grid untuk melukis.</span>";
        el.classList.toggle("hidden", !show);
      }

      /* ================================================================
   INSPECT PANELS — seamless · pixel zoom · validation
   ================================================================ */
      export function renderSeamless() {
        const cv = $("#cvSeam"),
          ctx = cv.getContext("2d");
        const t = byUid(S.active);
        $("#kvSeamTile").textContent = t ? `${t.name} (${t.wc}×${t.hc})` : "—";
        if (!t) {
          cv.width = 272;
          cv.height = 120;
          ctx.fillStyle = "#101214";
          ctx.fillRect(0, 0, 272, 120);
          ctx.fillStyle = "#5d615b";
          ctx.font = '11px "IBM Plex Mono", monospace';
          ctx.fillText("pilih tile di Asset Library", 20, 62);
          return;
        }
        const N = RT.seamN;
        const C = N * t.wc,
          R = N * t.hc,
          hw = S.out.w / 2,
          hh = S.out.h / 2;
        const W = (C + R) * hw,
          H = (C + R) * hh;
        cv.width = Math.max(1, W);
        cv.height = Math.max(1, H);
        drawCheckerTo(ctx, 0, 0, W, H, Math.max(6, Math.round(hw / 4)));
        ctx.imageSmoothingEnabled = false;
        for (let j = 0; j < N; j++)
          for (let i = 0; i < N; i++) {
            const cx = (i * t.wc - j * t.hc) * hw,
              cy = (i * t.wc + j * t.hc) * hh;
            ctx.drawImage(t.canvas, cx - t.ax, cy - t.ay);
          }
      }
      export function renderPixelZoom() {
        const cv = $("#cvPixel"),
          t = byUid(S.active);
        if (!t) {
          cv.width = 272;
          cv.height = 60;
          const c = cv.getContext("2d");
          c.fillStyle = "#101214";
          c.fillRect(0, 0, 272, 60);
          c.fillStyle = "#5d615b";
          c.font = '11px "IBM Plex Mono", monospace';
          c.fillText("pilih tile di Asset Library", 20, 32);
          return;
        }
        const Z = RT.pixZ;
        cv.width = t.canvas.width * Z;
        cv.height = t.canvas.height * Z;
        const c = cv.getContext("2d");
        drawCheckerTo(
          c,
          0,
          0,
          cv.width,
          cv.height,
          Math.max(6, 8 * Math.min(Z, 2)),
        );
        c.imageSmoothingEnabled = false;
        c.drawImage(t.canvas, 0, 0, cv.width, cv.height);
        if (Z >= 8) {
          c.strokeStyle = "rgba(255,255,255,.12)";
          c.lineWidth = 1;
          c.beginPath();
          for (let x = 0; x <= t.canvas.width; x++) {
            c.moveTo(x * Z + 0.5, 0);
            c.lineTo(x * Z + 0.5, cv.height);
          }
          for (let y = 0; y <= t.canvas.height; y++) {
            c.moveTo(0, y * Z + 0.5);
            c.lineTo(cv.width, y * Z + 0.5);
          }
          c.stroke();
        }
      }
      export function updateValidation() {
        const items = [];
        if (!S.img) {
          items.push(["err", "Belum ada source image — import dulu."]);
        } else {
          const gr = S.grid.w / S.grid.h;
          items.push(
            Math.abs(gr - 2) < 0.02
              ? ["ok", `Grid ratio 2:1 (${gr.toFixed(2)})`]
              : ["warn", `Grid ratio ${gr.toFixed(2)}:1 — bukan 2:1`],
          );
          if (Math.abs(gr - S.out.w / S.out.h) > 0.02)
            items.push([
              "warn",
              `Rasio grid ≠ rasio output ${S.out.w}×${S.out.h} — bentuk bisa terdistorsi`,
            ]);
          if (!S.srcInfo.hasAlpha)
            items.push([
              "info",
              "Source RGB tanpa alpha — OK utk master ground",
            ]);
        }
        const tiles = S.tiles.filter((t) => t.type === "tile");
        const patches = S.tiles.filter((t) => t.type === "patch");
        if (!S.tiles.length) {
          items.push(["warn", "Library kosong — crop minimal satu tile."]);
        } else {
          items.push([
            "ok",
            `Library: ${tiles.length} tile · ${patches.length} patch`,
          ]);
          let outside = 0,
            holes = 0;
          for (const t of tiles) {
            const w = t.canvas.width,
              h = t.canvas.height;
            const d = t.canvas.getContext("2d").getImageData(0, 0, w, h).data;
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                const a = d[(y * w + x) * 4 + 3];
                const A =
                  ((x - t.ax + 0.5) / (S.out.w / 2) +
                    (y + 0.5) / (S.out.h / 2)) /
                  2;
                const B =
                  ((y + 0.5) / (S.out.h / 2) -
                    (x - t.ax + 0.5) / (S.out.w / 2)) /
                  2;
                if (A >= 0 && A <= 1 && B >= 0 && B <= 1) {
                  if (a === 0) holes++;
                } else if (a > 0) outside++;
              }
          }
          items.push(
            outside === 0
              ? ["ok", "Alpha luar diamond = 0 (semua tile)"]
              : ["err", `Alpha bocor di luar diamond (${outside}px)`],
          );
          if (holes > 0)
            items.push([
              "info",
              `Alpha di dalam diamond terdeteksi (${holes}px) — OK utk lubang/desain`,
            ]);
          if (S.proc.bg !== "none")
            items.push([
              "info",
              `BG removal aktif: ${S.proc.bg}, tol ${S.proc.tol}`,
            ]);
        }
        items.push([
          "ok",
          `Output: PNG RGBA ${S.out.w}×${S.out.h} · atlas + JSON`,
        ]);
        if (pv.map.size)
          items.push(["ok", `Preview diorama: ${pv.map.size} asset terpasang`]);
        $("#vlist").innerHTML = items
          .map(([sev, txt]) => `<li class="${sev}">${txt}</li>`)
          .join("");
      }
      export function updateInspectPanels() {
        renderSeamless();
        renderPixelZoom();
        updateValidation();
      }

