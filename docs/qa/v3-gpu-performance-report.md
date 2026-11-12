# BAOHIM PHOTO V3 — BÁO CÁO TỐI ƯU HIỆU NĂNG, GPU LIQUIFY & BUNDLE

Ngày đo: 2026-11-12 (UTC: `2026-11-12T12:59:36.296Z`)  
Dữ liệu gốc JSON: [v3-gpu-benchmark.json](v3-gpu-benchmark.json)  
Dữ liệu đối chiếu trước đây (CPU / Node baseline): [premium-v2-metrics.json](premium-v2-metrics.json)

---

## 1. Môi trường, Thiết bị & Phương pháp đo

- **Trình duyệt / Engine:** Playwright WebKit `26.5` (headless)
- **Hồ sơ thiết bị mô phỏng:** iPhone 16 Pro Max (`440 × 956 CSS px`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, iOS 18 Safari User-Agent)
- **Phần cứng & OS thực thi:** Máy trạm `win32 x64`, `Node.js v24.15.0`
- **Lưu ý phân biệt thiết bị thật:** Toàn bộ số liệu trình duyệt dưới đây được đo bằng **giả lập Playwright WebKit trên Windows x64**, **CHƯA kiểm thử trên phần cứng iPhone 16 Pro Max vật lý thật**. Khả năng duy trì FPS/nhiệt độ và giới hạn bộ nhớ GPU/Safari WebContent của thiết bị iOS thật cần xác minh bổ sung khi có máy vật lý.
- **Phương pháp đo:**
  - Bộ unit/integration test: `npm test` (`node --test tests/*.test.mjs`) với 144 test cases.
  - Bộ kiểm thử E2E WebKit + benchmark tự động: `WRITE_BENCHMARK=1 npm run test:webkit` (`scripts/qa/webkit-smoke.mjs`) phục vụ bản build `dist/` qua HTTP cục bộ `127.0.0.1` (cấm tuyệt đối request mạng ra ngoài).
  - Thời gian GPU vs CPU Liquify: đo trực tiếp bằng `performance.now()` trong WebKit qua `RasterService.compareWarpAccuracy()` trên cùng buffer nguồn RGBA và cùng công thức nét.
  - Kích thước bundle: đo trực tiếp trên tệp phát hành trong `dist/` sau `npm run build` (`webpack --mode production`).

---

## 2. Kết quả Benchmark Trước / Sau

### 2.1. Hiệu năng Liquify: CPU vs GPU WebGL2 (Trong Playwright WebKit 26.5)

Công thức kiểm thử: 8 nét biến dạng kết hợp `push`, `pinch`, `bulge` + vùng bảo vệ `freeze`.

| Kịch bản đo | Trước (CPU JS `warpPixels`) | Sau (GPU WebGL2 `#version 300 es`) | Mức cải thiện | Sai lệch ảnh tối đa |
| --- | --- | --- | --- | --- |
| Preview `1280 × 1024` (`1.31 MP`) | `86 ms` | `11 ms` | **Nhanh hơn 7.82×** | `maxDiff = 0 LSB`, `meanAbsDiff = 0` |
| Độ phân giải cao `2560 × 2048` (`5.24 MP`) | `278 ms` | `43 ms` | **Nhanh hơn 6.47×** | `maxDiff = 0 LSB`, `meanAbsDiff = 0` |

> Đối chiếu lịch sử (chỉ mang tính tham khảo khác môi trường): trong [premium-v2-metrics.json](premium-v2-metrics.json), 100 nét dày đặc trên ảnh `960 × 1280` chạy trên Node 24 + Skia CPU mất trung vị `363 ms` (reference) và `270 ms` (indexed CPU).

### 2.2. Độ chính xác hình ảnh giữa GPU WebGL2 và CPU `warpPixels`

Đo trên ảnh mẫu `256 × 256` RGBA có kênh alpha biến thiên (`0`, `140`, `255`):

| Điều kiện kiểm thử | Chỉ số đo | Kết quả |
| --- | --- | --- |
| `strength = 0` (`push` & `pinch`) | `strengthZeroMaxDiff` | `0 LSB` (giữ nguyên 100% pixel gốc) |
| Vùng ngoài bán kính tác động | `outsideRadiusMaxDiff` | `0 LSB` (không biến dạng hậu cảnh, ROI `gl.scissor` + `gl.readPixels`) |
| Tổng hợp `push + pinch + bulge + restore + freeze (có erase & freezeCount) + perspective (X=14, Y=-10) + alpha` | `maxChannelDiffLSB` | `1 LSB` |
| Tổng hợp như trên | `meanAbsDiffLSB` | `0.000034` |
| Tổng hợp như trên | `exactMatchRatio` | `99.9966%` (`0.999966`) |
| Mất ngữ cảnh WebGL (`webglcontextlost`) | Tự động fallback | Chuyển sang `worker` / CPU, khôi phục tự động về `webgl2` khi phục hồi ngữ cảnh |

### 2.3. Tối ưu Bundle & Tốc độ tải khởi động

| Chỉ số | Trước tối ưu (V2 / đầu V3) | Sau tối ưu (V3 hiện tại) |
| --- | --- | --- |
| Cảnh báo kích thước entrypoint của Webpack | Cảnh báo entrypoint ~`1.77 MiB` (`1,812.5 KiB`) | **`0` cảnh báo** |
| Kích thước tệp entrypoint khởi động (`dist/studio.<hash>.js`) | ~`1,812.5 KiB` | **`4.53 KiB`** |
| Các nhóm lazy-load đã tách chunk riêng | Nạp gộp lúc khởi động | `studio-makeup` (`3.40 KiB`), `studio-creative` (`5.67 KiB`), `studio-lut` (`2.40 KiB`), `studio-fx` (`0.18 KiB` + chunk vendor tách riêng), `legacy-open` (`13.80 KiB`) |
| Số chunk lazy bị nạp sớm trước khi người dùng bấm dùng | — | **`0`** |
| Số request font / asset ra mạng ngoài (external) | — | **`0`** |
| Tổng tài nguyên offline precache trong Service Worker (`dist/service-worker.js`) | — | **`143` tài nguyên** (`revision def6a341182d`), bao gồm toàn bộ lazy chunks |

### 2.4. Bộ nhớ RAM, Thời gian mở/xuất ảnh & Ảnh 12 MP (`4000 × 3000`)

| Thao tác | Trước (Node 24 + jsdom CPU trong `premium-v2-metrics.json`, không phải Safari) | Sau (Playwright WebKit 26.5 + GPU WebGL2 + Tiled Export) |
| --- | --- | --- |
| Khởi động app & khôi phục trạng thái (`appBootAndRestoreMs`) | — | `1194 ms` |
| Mở ảnh PNG có Alpha (`320 × 400`) | — | `189 ms` |
| Mở ảnh JPEG mẫu (`portrait.jpg`) | — | `247 ms` |
| Xuất JPEG bản preview | — | `465 ms` |
| Xuất PNG bản preview | — | `406 ms` |
| **Mở + preview ảnh 12 MP (`4000 × 3000`)** | `340 ms` (Node CPU) | **`391 ms`** |
| **GPU Liquify + Filter + Grade ảnh 12 MP** | — | **`267 ms`** |
| **Xuất ảnh JPEG 12 MP theo tile (`4000 × 3000`)** | `7089 ms` (Node CPU, ảnh `3000 × 4000`) | **`706 ms`** (`75,378 bytes` cho canvas kiểm thử tổng hợp) |
| Giới hạn xuất tối đa | Khóa cứng `12.5 MP` | Giữ nguyên khóa cứng **`12.5 MP`** (`scale: 1.2` bị từ chối đúng thiết kế) |
| Dọn RAM khi đưa app ra nền (`visibilitychange: hidden`) | — | Giải phóng `0` canvas còn treo (`trackedAfterHidden = 0`) + thu hồi texture GPU lớn (`> 2.5 MP`) |
| Chỉ số WebGL2 cuối phiên QA | — | `gpuRuns: 49`, `cpuFallbacks: 0`, `contextLosses: 1`, `contextRestores: 1`, `lastBackend: "webgl2"`, `allocW: 240`, `allocH: 180` (`345,600 bytes`) |

---

## 3. Nghiệm thu Tự động, Dependency & License

| Bước kiểm tra | Lệnh thực thi | Kết quả |
| --- | --- | --- |
| Production build & Service Worker | `npm run build` | PASS (`7240 ms`, `0` Webpack warnings, `143` offline resources) |
| Static & Asset License Check | `npm run check` | PASS (`Static entrypoint and 67 licensed asset entries checked.`) |
| Unit & Integration Tests | `npm test` | PASS (`144/144` passed, `0` failed, `0` skipped) |
| Safari / iPhone 16 Pro Max WebKit E2E + Offline QA | `npm run test:webkit` | PASS (`WebKit 26.5`, `0` console/page errors, `0` failed offline requests) |
| Dependency Security Audit | `npm audit --omit=dev` | `found 0 vulnerabilities` (không thêm dependency mới ngoài `package.json`) |
| License Notices Generation | `node scripts/notices.mjs` | `30` phần bản quyền/giấy phép trong `THIRD_PARTY_NOTICES.txt` (MIT / tương thích MIT) |

---

## 4. Giới hạn còn tồn tại & Lưu ý

1. **Chưa kiểm thử trên thiết bị iPhone 16 Pro Max vật lý thật:** Các kết quả WebKit, cảm ứng, safe-area và bộ nhớ hiện tại mới được xác nhận qua Playwright WebKit `26.5` trên Windows x64.
2. **Số nét tối đa trong một pass WebGL2:** Shader WebGL2 xử lý tối đa `64` nét warp (`MAX_WARP_STROKES = 64`) và `64` thao tác vùng đóng băng (`MAX_FREEZE_OPS = 64`) hoặc ảnh vượt `MAX_TEXTURE_SIZE`; nếu vượt ngưỡng này hoặc WebGL2 không khả dụng, hệ thống tự động fallback chính xác về `warpPixels` CPU/Worker mà không mất nét hay hỏng undo/redo.
3. **Giới hạn xuất ảnh 12.5 MP:** Giữ nguyên trần `maxMegapixels = 12.5` theo yêu cầu an toàn bộ nhớ Safari di động; chưa bật xuất 48 MP do chưa kiểm thử giới hạn phần cứng iOS thực tế.
4. **Hành vi Playwright `setOffline(true)` với `Blob.arrayBuffer()`:** Trong harness giả lập Playwright WebKit trên Windows, việc bật `context.setOffline(true)` khiến tầng IPC của WebKit chặn luôn thao tác `Blob.arrayBuffer()` / `FileReader` trên các `Blob` mới tạo từ `canvas.toBlob`; do đó trong kịch bản test tự động WebKit, lớp trang điểm mẫu được khởi tạo trước khi ngắt mạng để kiểm tra chuyển đổi công cụ/chỉnh màu/precache offline. Hành vi này là đặc thù của giả lập Playwright WebKit và không ảnh hưởng luồng WebKit/Safari online cũng như Service Worker precache.
