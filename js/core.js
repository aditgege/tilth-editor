      /* ================================================================
   TILTH — AI Asset Preparation Editor (MVP v0.1)
   Source (import · kalibrasi · multi-select crop · pipeline)
   Template (zone map AI · prompt presets single-material)
   Inspect (diorama paint · seamless · pixel zoom · validation)
   Project: save/open .tilth.json (source di-embed dataURL)
   ================================================================ */
      export const $ = (s) => document.querySelector(s);
      export const $$ = (s) => [...document.querySelectorAll(s)];
      export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      export const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
      export const DPR = () => window.devicePixelRatio || 1;

      export function makeCanvas(w, h) {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(h));
        return c;
      }
      export function hash2(x, y) {
        let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
        h = (h ^ (h >>> 13)) | 0;
        h = Math.imul(h, 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      }

      /* ---------------- state ---------------- */
      export const S = {
        mode: "source",
        tool: "hand",
        space: false,
        img: null,
        iw: 0,
        ih: 0,
        fileName: "",
        fileBytes: 0,
        imgId: 0,
        srcInfo: { hasAlpha: false, colorMode: "—" },
        grid: { w: 256, h: 128, ox: 0, oy: 0, show: true, lock: true },
        out: { w: 64, h: 32, resample: "nearest" },
        proc: { bg: "none", tol: 24, ath: 0, bin: false },
        hoverCell: null,
        mouse: null,
        calib: { pts: [] }, // 4-point calibration (world coords)
        sel: new Set(), // multi-select cell "c,r"
        tiles: [],
        active: null,
        uidSeq: 1,
        lastAdded: null,
        libQuery: "",
        libFilter: "all",
      };
      export const view = { scale: 1, x: 0, y: 0, moved: false };
      export const pv = {
        scale: 1,
        x: 0,
        y: 0,
        hover: null,
        mouse: null,
        tool: "brush",
        showGrid: true,
        cols: 12,
        rows: 12,
        map: new Map(),
        undo: [],
        redo: [],
        moved: false,
      };
      export const tp = {
        W: 1536,
        H: 1024,
        cols: 8,
        rows: 6,
        dw: 104,
        dh: 52,
        ox: 0,
        oy: 0,
        map: new Map(),
        tool: "paint",
        mat: "grass",
        labels: true,
        borders: true,
        undo: [],
        redo: [],
        hover: null,
        mouse: null,
        moved: false,
      };
      export const tpv = { scale: 1, x: 0, y: 0 };
      export const RT = {
        patchSel: null,
        selDrag: null,
        seamN: 3,
        pixZ: 8,
        ptrS: null,
        ptrP: null,
        ptrT: null,
        pvFitted: false,
        tpFitted: false
      };

      /* ---------------- materials template ---------------- */
      export const MATS = {
        grass: {
          label: "GRASS",
          disp: "Grass",
          color: "#3f7d3b",
          cname: "GREEN",
          prompt:
            "lush green garden grass with subtle per-tile color variation",
          variants:
            "some diamonds pure grass, some with tiny flat wildflowers, some with clover, one or two with a small flat pebble",
        },
        soil: {
          label: "SOIL",
          disp: "Soil",
          color: "#7a5c3e",
          cname: "BROWN",
          prompt:
            "dark tilled loam with fine plow rows following the isometric axes",
          variants:
            "dark tilled rows, a wet darker patch, seeded sprout dots, a few flat pebbles",
        },
        path: {
          label: "PATH",
          disp: "Path",
          color: "#c9a86b",
          cname: "BEIGE",
          prompt: "warm beige gravel garden path with small flat stones",
          variants:
            "light gravel, some scattered stones, a mossy stone, a slightly worn patch",
        },
        water: {
          label: "WATER",
          disp: "Water",
          color: "#3a6ea5",
          cname: "BLUE",
          prompt: "calm blue water with a gentle surface pattern",
          variants:
            "calm ripples, a sparkling patch, a few flat stones breaking the surface",
        },
        stone: {
          label: "STONE",
          disp: "Stone",
          color: "#8d8d92",
          cname: "GREY",
          prompt: "grey sandstone pavers with moss creeping through the seams",
          variants: "clean pavers, mossy seams, one cracked paver",
        },
        sand: {
          label: "SAND",
          disp: "Sand",
          color: "#d9c184",
          cname: "PALE YELLOW",
          prompt: "sandy fine-gravel ground, pale and warm",
          variants:
            "fine ripples, a pebble or two, a slightly damp darker patch",
        },
      };

      /* ---------------- elements ---------------- */
      export const cvSrc = $("#cvSrc"),
        cvPrev = $("#cvPrev"),
        cvLive = $("#cvLive"),
        cvTmpl = $("#cvTmpl");
      export const sctx = cvSrc.getContext("2d"),
        pctx = cvPrev.getContext("2d"),
        lctx = cvLive.getContext("2d"),
        tctx = cvTmpl.getContext("2d");
      export const stImg = $("#stImg"),
        stCur = $("#stCur"),
        stCell = $("#stCell"),
        stZoom = $("#stZoom"),
        stGrid = $("#stGrid"),
        stHint = $("#stHint");
      export const libList = $("#libList"),
        libCount = $("#libCount");

      export const refreshIcons = () => window.lucide && lucide.createIcons();

      export function toast(msg, tone = "ok") {
        const el = document.createElement("div");
        el.className = "toast" + (tone === "warn" ? " warn" : "");
        el.innerHTML = `<i data-lucide="${tone === "warn" ? "info" : "check"}"></i><span></span>`;
        el.querySelector("span").textContent = msg;
        $("#toasts").appendChild(el);
        refreshIcons();
        setTimeout(() => {
          el.classList.add("out");
          setTimeout(() => el.remove(), 300);
        }, 2800);
      }

