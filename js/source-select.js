import { $, RT, S, refreshIcons, toast } from './core.js';
import { cellAt, cellTop } from './geo.js';
import { updateInspectPanels } from './inspect.js';
import { setActive } from './library.js';
import { addAsset, cropPipeline } from './source-crop.js';
import { updateLive } from './source-live.js';
import { renderSource } from './source-render.js';
import { syncInputs, updateStatus } from './ui.js';

      /* ================================================================
   SELECTION (multi-diamond) & CALIBRATION
   ================================================================ */

      export function marqueeCells(m) {
        const x0 = Math.min(m.x0, m.x1),
          x1 = Math.max(m.x0, m.x1);
        const y0 = Math.min(m.y0, m.y1),
          y1 = Math.max(m.y0, m.y1);
        let cMin = 1e9,
          cMax = -1e9,
          rMin = 1e9,
          rMax = -1e9;
        for (const [px, py] of [
          [x0, y0],
          [x1, y0],
          [x0, y1],
          [x1, y1],
        ]) {
          const cc = cellAt(px, py);
          cMin = Math.min(cMin, cc.c);
          cMax = Math.max(cMax, cc.c);
          rMin = Math.min(rMin, cc.r);
          rMax = Math.max(rMax, cc.r);
        }
        if ((cMax - cMin + 1) * (rMax - rMin + 1) > 4000) return [];
        const out = [];
        for (let r = rMin; r <= rMax; r++)
          for (let c = cMin; c <= cMax; c++) {
            const t = cellTop(c, r),
              cx = t.x,
              cy = t.y + S.grid.h / 2;
            if (
              cx >= x0 &&
              cx <= x1 &&
              cy >= y0 &&
              cy <= y1 &&
              cx >= 0 &&
              cx <= S.iw &&
              cy >= 0 &&
              cy <= S.ih
            )
              out.push(c + "," + r);
          }
        return out;
      }
      export function toggleSelCell(c, r) {
        const k = c + "," + r;
        S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k);
        updateSelUI();
      }
      export function updateSelUI() {
        $("#kvSel").textContent = `${S.sel.size} cell`;
        const b = $("#btnCropSel");
        b.innerHTML = `<i data-lucide="check-check"></i>Crop ${S.sel.size} → library`;
        b.classList.toggle("dis", !S.sel.size);
        refreshIcons();
      }
      export function cropSelection() {
        if (!S.sel.size) {
          toast("Belum ada cell terpilih", "warn");
          return;
        }
        const prefix = ($("#selPrefix").value.trim() || "tile").replace(
          /\s+/g,
          "_",
        );
        const cells = [...S.sel]
          .map((k) => {
            const i = k.indexOf(",");
            return { c: +k.slice(0, i), r: +k.slice(i + 1) };
          })
          .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
        let made = 0,
          skipped = 0,
          last = null;
        for (const cell of cells) {
          const res = cropPipeline(cell.c, cell.r, 1, 1);
          if (!res) {
            skipped++;
            continue;
          }
          last = addAsset(
            res,
            1,
            1,
            cell.c,
            cell.r,
            `${prefix}_${String(++made).padStart(2, "0")}`,
          );
        }
        S.sel.clear();
        updateSelUI();
        renderSource();
        updateLive();
        if (last) setActive(last.uid);
        updateInspectPanels();
        toast(
          `${made} tile dibuat${skipped ? `, ${skipped} dilewati (kosong)` : ""}${skipped ? "" : " → library"}`,
        );
      }
      export function applyCalibration() {
        const [T, R, B, L] = S.calib.pts;
        const cx = ((T.x + B.x) / 2 + (R.x + L.x) / 2) / 2;
        const cy = ((T.y + B.y) / 2 + (R.y + L.y) / 2) / 2;
        const hw = (R.x - L.x) / 2,
          hh = (B.y - T.y) / 2;
        if (!isFinite(hw) || !isFinite(hh) || hw < 2 || hh < 1) {
          toast("Kalibrasi tidak valid — coba lagi", "warn");
          S.calib.pts = [];
          renderSource();
          return;
        }
        const skew =
          (Math.abs(T.x - cx) +
            Math.abs(B.x - cx) +
            Math.abs(L.y - cy) +
            Math.abs(R.y - cy)) /
          (R.x - L.x + (B.y - T.y));
        S.grid.w = Math.round(hw * 2);
        S.grid.h = Math.round(hh * 2);
        S.grid.ox = Math.round(cx);
        S.grid.oy = Math.round(cy - hh);
        S.calib.pts = [];
        S.sel.clear();
        RT.patchSel = null;
        syncInputs();
        renderSource();
        updateLive();
        updateStatus();
        updateSelUI();
        updateInspectPanels();
        toast(
          `Kalibrasi: diamond ${S.grid.w}×${S.grid.h} · ratio ${(S.grid.w / S.grid.h).toFixed(2)}:1`,
        );
        if (skew > 0.03)
          toast(
            "Diamond sedikit miring/skew — grid TILTH axis-aligned, periksa hasil crop di live preview",
            "warn",
          );
      }

