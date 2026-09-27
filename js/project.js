import { $, RT, S, makeCanvas, pv, toast, tp } from './core.js';
import { updateInspectPanels, updatePrevEmpty } from './inspect.js';
import { download } from './io.js';
import { renderLibrary, updateBrushBox } from './library.js';
import { recropTile } from './source-crop.js';
import { updateLive } from './source-live.js';
import { renderSource } from './source-render.js';
import { updateSelUI } from './source-select.js';
import { renderTPalette, updateTInfo } from './template-export.js';
import { updateTGeom } from './template-studio.js';
import { setMode, syncInputs, syncProcInputs, updateStatus } from './ui.js';
import { fitView } from './view-events.js';

      /* ================================================================
   IMAGE / PROJECT LOAD & SAVE
   ================================================================ */

      export function analyzeSource() {
        let has = false;
        const d = S.img.getContext("2d").getImageData(0, 0, S.iw, S.ih).data;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 255) {
            has = true;
            break;
          }
        }
        S.srcInfo = { hasAlpha: has, colorMode: has ? "RGBA" : "RGB" };
      }
      export function fmtBytes(b) {
        if (!b) return "—";
        return b > 1048576
          ? (b / 1048576).toFixed(1) + " MB"
          : Math.round(b / 1024) + " KB";
      }
      export function setSourceImage(img, name, bytes = 0) {
        setMode("source");
        const w = img.naturalWidth || img.width,
          h = img.naturalHeight || img.height;
        const cv = makeCanvas(w, h);
        cv.getContext("2d").drawImage(img, 0, 0);
        S.img = cv;
        S.iw = w;
        S.ih = h;
        S.fileName = name;
        S.fileBytes = bytes;
        S.imgId++;
        S.grid.ox = Math.round(w / 2);
        S.grid.oy = Math.round(h / 2);
        analyzeSource();
        S.sel.clear();
        S.calib.pts = [];
        RT.patchSel = null;
        RT.selDrag = null;
        $("#dropzone").classList.add("hidden");
        $("#ivFile").textContent = name;
        $("#ivSize").textContent = `${w} × ${h} px`;
        $("#ivColor").textContent =
          S.srcInfo.colorMode + (S.srcInfo.hasAlpha ? " (alpha)" : " (opaque)");
        $("#ivAlpha").textContent = S.srcInfo.hasAlpha ? "ya" : "tidak";
        $("#ivBytes").textContent = bytes ? fmtBytes(bytes) : "generated";
        $("#ivNote").hidden = S.srcInfo.hasAlpha;
        syncInputs();
        fitView();
        renderSource();
        updateStatus();
        updateLive();
        updateInspectPanels();
      }
      export function loadFile(file) {
        if (!file || !/^image\//.test(file.type)) {
          toast("File bukan gambar.", "warn");
          return;
        }
        const url = URL.createObjectURL(file),
          im = new Image();
        im.onload = () => {
          URL.revokeObjectURL(url);
          setSourceImage(im, file.name, file.size);
          toast(`${file.name} dimuat`);
        };
        im.onerror = () => toast("Gagal membaca gambar.", "warn");
        im.src = url;
      }
      export function importManifestJson(m) {
        const g = m.grid || m;
        if (!g.diamond_w || !g.diamond_h) throw 0;
        S.grid.w = g.diamond_w;
        S.grid.h = g.diamond_h;
        if (typeof g.origin_x === "number") S.grid.ox = Math.round(g.origin_x);
        if (typeof g.origin_y === "number") S.grid.oy = Math.round(g.origin_y);
        toast(
          `Manifest dimuat — grid ${g.diamond_w}×${g.diamond_h}${g.cols ? `, ${g.cols}×${g.rows} cell` : ""}`,
        );
        syncInputs();
        renderSource();
        updateLive();
        updateStatus();
        updateInspectPanels();
      }
      export function copyText(txt) {
        const fallback = () => {
          const ta = document.createElement("textarea");
          ta.value = txt;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            toast("Teks dicopy ke clipboard");
          } catch (e) {
            toast("Gagal copy", "warn");
          }
          ta.remove();
        };
        if (navigator.clipboard && window.isSecureContext)
          navigator.clipboard
            .writeText(txt)
            .then(() => toast("Teks dicopy ke clipboard"))
            .catch(fallback);
        else fallback();
      }
      export function loadImageURL(url) {
        return new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = url;
        });
      }
      export const projName = () =>
        (S.fileName.replace(/\.[^.]+$/, "") || "tilth-project").replace(
          /\s+/g,
          "_",
        );

      export function buildProject() {
        return {
          generator: "TILTH",
          version: 1,
          name: projName(),
          source: {
            name: S.fileName,
            width: S.iw,
            height: S.ih,
            color_mode: S.srcInfo.colorMode,
            has_alpha: S.srcInfo.hasAlpha,
            dataURL: S.img ? S.img.toDataURL("image/png") : null,
          },
          grid: {
            diamond_width: S.grid.w,
            diamond_height: S.grid.h,
            origin_x: Math.round(S.grid.ox),
            origin_y: Math.round(S.grid.oy),
          },
          out: { ...S.out },
          proc: { ...S.proc },
          assets: S.tiles.map((t) => ({
            name: t.name,
            type: t.type,
            wc: t.wc,
            hc: t.hc,
            source_cell: {
              c: t.src.c0,
              r: t.src.r0,
              gw: t.src.gw,
              gh: t.src.gh,
              gox: t.src.gox,
              goy: t.src.goy,
            },
          })),
          preview: {
            cols: pv.cols,
            rows: pv.rows,
            map: [...pv.map].map(([k, e]) => [
              k,
              S.tiles.findIndex((t) => t.uid === e.uid),
              e.wc,
              e.hc,
            ]),
          },
          template: {
            W: tp.W,
            H: tp.H,
            cols: tp.cols,
            rows: tp.rows,
            dh: tp.dh,
            mat: tp.mat,
            map: [...tp.map],
          },
        };
      }
      export function saveProject() {
        if (!S.img && !S.tiles.length) {
          toast("Belum ada yang bisa disimpan.", "warn");
          return;
        }
        const j = buildProject();
        download(
          new Blob([JSON.stringify(j)], { type: "application/json" }),
          j.name + ".tilth.json",
        );
        toast(`Project "${j.name}" disimpan · ${S.tiles.length} asset`);
      }
      async function loadProject(j) {
        try {
          if (!j.source || !j.source.dataURL) throw 0;
          const im = await loadImageURL(j.source.dataURL);
          S.tiles = [];
          S.active = null;
          S.sel.clear();
          S.calib.pts = [];
          pv.map.clear();
          pv.undo = [];
          pv.redo = [];
          RT.pvFitted = false;
          tp.map = [];
          tp.map = new Map();
          tp.undo = [];
          tp.redo = [];
          RT.patchSel = null;
          RT.selDrag = null;
          setSourceImage(im, j.source.name || "project.png", 0);
          if (j.grid)
            Object.assign(S.grid, {
              w: j.grid.diamond_width ?? j.grid.w,
              h: j.grid.diamond_height ?? j.grid.h,
              ox: j.grid.origin_x ?? j.grid.ox,
              oy: j.grid.origin_y ?? j.grid.oy,
            });
          if (j.out) Object.assign(S.out, j.out);
          if (j.proc) Object.assign(S.proc, j.proc);
          (j.assets || []).forEach((a) =>
            S.tiles.push({
              uid: S.uidSeq++,
              name: a.name,
              type: a.type,
              wc: a.wc,
              hc: a.hc,
              canvas: makeCanvas(4, 4),
              ax: 0,
              ay: 0,
              src: {
                c0: a.source_cell.c,
                r0: a.source_cell.r,
                gw: a.source_cell.gw,
                gh: a.source_cell.gh,
                gox: a.source_cell.gox,
                goy: a.source_cell.goy,
              },
            }),
          );
          S.tiles.forEach((t) => {
            t.src.imgId = S.imgId;
          });
          S.tiles.forEach((t) => {
            if (!recropTile(t)) {
              const P = t.wc + t.hc,
                ow = Math.max(1, Math.round((P * S.out.w) / 2)),
                oh = Math.max(1, Math.round((P * S.out.h) / 2));
              t.canvas = makeCanvas(ow, oh);
              t.ax = (t.hc / P) * ow;
            }
          });
          if (S.tiles.length) S.active = S.tiles[0].uid;
          const pj = j.preview || {};
          pv.cols = pj.cols || 12;
          pv.rows = pj.rows || 12;
          pv.map = new Map(
            (pj.map || [])
              .filter((e) => S.tiles[e[1]])
              .map(([k, idx, wc, hc]) => [
                k,
                { uid: S.tiles[idx].uid, wc, hc },
              ]),
          );
          const tj = j.template || {};
          if (tj.map) {
            Object.assign(tp, {
              W: tj.W || 1536,
              H: tj.H || 1024,
              cols: tj.cols || 8,
              rows: tj.rows || 6,
              dh: tj.dh || 52,
              mat: tj.mat || "grass",
            });
            tp.map = new Map(tj.map);
            updateTGeom();
          }
          syncInputs();
          syncProcInputs();
          renderTPalette();
          updateTInfo();
          fitView();
          renderSource();
          updateLive();
          renderLibrary();
          updateBrushBox();
          updatePrevEmpty();
          updateSelUI();
          updateInspectPanels();
          toast(
            `Project "${j.name || "untitled"}" dibuka — ${S.tiles.length} asset`,
          );
        } catch (e) {
          toast("File project tidak valid.", "warn");
        }
      }
      export function newProject() {
        setMode("source");
        S.img = null;
        S.iw = 0;
        S.ih = 0;
        S.fileName = "";
        S.fileBytes = 0;
        S.imgId++;
        S.srcInfo = { hasAlpha: false, colorMode: "—" };
        S.tiles = [];
        S.active = null;
        S.sel.clear();
        S.calib.pts = [];
        pv.map.clear();
        pv.undo = [];
        pv.redo = [];
        RT.pvFitted = false;
        tp.map.clear();
        tp.undo = [];
        tp.redo = [];
        RT.patchSel = null;
        RT.selDrag = null;
        S.hoverCell = null;
        S.mouse = null;
        $("#dropzone").classList.remove("hidden");
        ["ivFile", "ivSize", "ivColor", "ivAlpha", "ivBytes"].forEach(
          (id) => ($("#" + id).textContent = "—"),
        );
        $("#ivNote").hidden = true;
        syncInputs();
        syncProcInputs();
        renderLibrary();
        updateBrushBox();
        updatePrevEmpty();
        updateSelUI();
        renderSource();
        updateLive();
        updateInspectPanels();
        toast("Project baru dimulai");
      }

