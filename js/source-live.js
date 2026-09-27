import { $, RT, S, lctx } from './core.js';
import { drawCheckerTo, normRect } from './geo.js';
import { cropPipeline } from './source-crop.js';

      /* ================================================================
   LIVE CROP PREVIEW
   ================================================================ */

      export function updateLive() {
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        drawCheckerTo(lctx, 0, 0, 520, 260, 10);
        let res = null,
          label = "—";
        if (S.img && S.tool === "tile" && S.hoverCell) {
          res = cropPipeline(S.hoverCell.c, S.hoverCell.r, 1, 1);
          if (res) label = `cell ${S.hoverCell.c},${S.hoverCell.r}`;
        } else if (S.img && S.tool === "patch") {
          let c0,
            r0,
            wc = 1,
            hc = 1;
          if (RT.patchSel) {
            const n = normRect();
            c0 = n.cA;
            r0 = n.rA;
            wc = n.wc;
            hc = n.hc;
          } else if (S.hoverCell) {
            c0 = S.hoverCell.c;
            r0 = S.hoverCell.r;
          }
          if (c0 !== undefined) {
            res = cropPipeline(c0, r0, wc, hc);
            if (res)
              label =
                wc === 1 && hc === 1
                  ? `cell ${c0},${r0}`
                  : `${wc}×${hc} → ${res.canvas.width}×${res.canvas.height}`;
          }
        }
        if (res) {
          const s = Math.min(
            (520 - 30) / res.canvas.width,
            (260 - 30) / res.canvas.height,
            4,
          );
          const ss = s >= 1 ? Math.max(1, Math.floor(s)) : s;
          const dw = res.canvas.width * ss,
            dh = res.canvas.height * ss;
          lctx.imageSmoothingEnabled = ss < 1;
          lctx.imageSmoothingQuality = "high";
          lctx.drawImage(res.canvas, (520 - dw) / 2, (260 - dh) / 2, dw, dh);
        }
        $("#lpCell").textContent = label;
      }

