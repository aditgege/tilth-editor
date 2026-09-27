# TILTH — AI Asset Preparation Editor

Editor web statis (vanilla JS, tanpa build step) untuk menyiapkan aset *ground tileset* isometrik
sebagai acuan AI image-gen, lalu memvalidasinya sebelum dipakai di game.

Alur kerjanya: **import gambar → kalibrasi grid isometrik → crop tile multi-select → pipeline
pemrosesan → simpan project / export PNG.**

---

## 1. Requirements

| Kebutuhan | Keterangan |
|---|---|
| Node.js 18+ | hanya untuk menjalankan `npx serve` (tidak ada `npm install`) |
| Browser modern | Chrome / Edge / Firefox terbaru (ES Modules + Canvas 2D) |
| Koneksi internet | hanya untuk memuat Google Fonts + Lucide Icons dari CDN |

> Tidak ada dependensi, tidak ada bundler, tidak ada `package.json` yang wajib diinstal.
> Seluruh kode ada di `index.html`, `css/`, dan `js/`.

---

## 2. Menjalankan dengan `npx serve`

Karena project memakai **ES Modules** (`<script type="module">`), file **tidak bisa** langsung
dibuka lewat `file://` — akan kena CORS. Harus lewat HTTP server.

```bash
# dari folder project
npx serve
```

Output-nya seperti ini:

```
   ┌────────────────────────────────────────────────────┐
   │                                                    │
   │   Serving!                                        │
   │                                                    │
   │   - Local:    http://localhost:3000                 │
   │   - Network:  http://192.168.x.x:3000               │
   │                                                    │
   └────────────────────────────────────────────────────┘
```

Buka **http://localhost:3000** di browser.

Opsi berguna:

```bash
npx serve -l 8080            # ganti port (default 3000)
npx serve --no-clipboard     # jangan copy URL ke clipboard
npx serve -n                 # tanpa auto reload saat file berubah
```

Alternatif lain jika tidak mau pakai `npx`:

```bash
python -m http.server 3000    # Python
php -S localhost:3000         # PHP
```

### Troubleshooting `npx serve`

| Masalah | Solusi |
|---|---|
| `npx : 无法将...` / `npx not recognized` | Node.js belum terinstal — cek `node -v` |
| Halaman putih, error di console | Format `file://` — jalankan lewat `npx serve` |
| Font / ikon tidak muncul | Butuh internet; offline akan tetap jalan, hanya tampilan fallback |
| Port 3000 dipakai proses lain | `npx serve -l 8080` |

---

## 3. Struktur project

```
tilth-editor/
├── index.html              # markup + entry <script type="module" src="js/main.js">
├── css/
│   └── app.css             # seluruh styling (tema, layout, panel, toolbar)
├── js/
│   ├── main.js             # entry: import semua modul
│   ├── core.js             # state global (S, view, pv, tp), material, helper
│   ├── geo.js              # transform isometric (world <-> screen, picking)
│   ├── source-render.js    # render canvas Source
│   ├── source-select.js    # marquee / multi-select cell
│   ├── source-crop.js      # crop tile & patch dari source
│   ├── source-live.js      # preview live hasil proses
│   ├── library.js          # daftar tile, rename, hapus, export per tile
│   ├── inspect.js          # mode Inspect: cat diorama, seamless, pixel zoom
│   ├── template-studio.js  # zone map + preset prompt per material
│   ├── template-export.js  # export zone map & grid lines
│   ├── io.js               # import gambar, drag & drop, export ZIP/PNG
│   ├── project.js          # save / open .tilth.json
│   ├── view-events.js      # pan, zoom, wheel, pointer
│   ├── ui.js               # wiring tombol & panel
│   └── bindings-init.js    # keyboard, dropzone, init
├── backup-tahap2a/         # snapshot lama (tidak dipakai runtime)
└── index.backup.html       # snapshot lama
```

---

## 4. Tiga Mode

### Source
Import gambar sumber (hasil AI-gen atau PNG bebas), lalu:

1. **Kalibrasi** — klik 4 vertex diamond (kiri, atas, kanan, bawah) agar grid isometrik menempel.
2. **Grid** — atur `cols` × `rows`, offset `ox/oy` (tool `G` untuk tampil/sembunyi).
3. **Select** — drag kotak untuk multi-select cell, lalu `Enter` untuk crop.
4. **Pipeline** — background removal, threshold alpha, binary, resample (nearest/lanczos).
5. Library tile terkumpul di panel kanan, siap di-ekspor atau dipakai di Inspect.

### Template
Grid zona isometrik untuk membuat *zone map* yang jadi acuan AI-gen:

- Tool: `B` brush, `E` erase, `F` fill.
- Material: GRASS, SOIL, PATH, WATER, STONE, SAND.
- Tiap material punya preset prompt + daftar variant (lihat `MATS` di `js/core.js`).
- Export: `zone_map_<W>x<H>.png` dan `grid_lines_<W>x<H>.png`.

### Inspect
Validasi hasil akhir sebelum dipakai:

- Cat langsung di atas diorama preview (brush / erase).
- Cek seamless (offset tile bersebelahan).
- Pixel zoom untuk inspeksi tepi tile.
- Preview PNG bisa diunduh langsung.

---

## 5. Keyboard Shortcuts

**Umum** — `Space` (tahan) = pan, `0` = fit view, `+` / `-` = zoom, `Ctrl+Z` / `Ctrl+Shift+Z` = undo/redo.

**Source**

| Key | Fungsi |
|---|---|
| `V` | Pan / geser |
| `C` | Kalibrasi 4-point |
| `S` | Select cell |
| `T` | Tile tool |
| `P` | Patch tool |
| `O` | Set origin |
| `G` | Tampilkan/sembunyikan grid |
| `Enter` | Crop selection |
| `Esc` | Batal (patch → kalibrasi → selection) |

**Template** — `B` paint · `E` erase · `F` fill

**Inspect** — `B` brush · `E` erase

---

## 6. Format File

| File | Keterangan |
|---|---|
| `*.tilth.json` | Project — menyimpan grid, kalibrasi, tile, dan source image **di-embed sebagai dataURL** (jadi file tunggal, besar) |
| `ground_tiles.png` | Sheet semua tile (atlas) |
| `ground_patches.png` | Sheet semua patch |
| `ground_preview.png` | Preview hasil pipeline |
| `zone_map_<W>x<H>.png` | Peta zona untuk AI-gen |
| `grid_lines_<W>x<H>.png` | Garis grid isometrik |

Save: tombol **Save** → file `.tilth.json`. Buka lagi: tombol **Open** → pilih file tersebut.
Import gambar: tombol **Import** atau **drag & drop** langsung ke halaman.
**Sample** memuat gambar contoh bawaan untuk coba-coba.

---

## 7. Push ke GitHub

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/aditgege/tilth-editor.git
git push -u origin main
```

Kalau repo sudah ada tapi `origin` belum terdaftar, cukup:

```bash
git remote add origin https://github.com/aditgege/tilth-editor.git
git branch -M main
git push -u origin main
```

Kalau `remote origin` sudah ada tapi salah URL:

```bash
git remote set-url origin https://github.com/aditgege/tilth-editor.git
git push -u origin main
```

---

## License

MIT
