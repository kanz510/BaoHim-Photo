# PHOTO BEAUTY STUDIO PRO V2 — Audit ngày 12/11/2026

Baseline `d01e6d0`, branch `preview/pro-v2-completion`. Không sửa ứng dụng ổn định hoặc các checkout tham khảo. GitHub MCP đã xác nhận tất cả HEAD mặc định còn trùng snapshot đã đọc mã trước đó; reuse phần nghiên cứu có chứng cứ, không nâng engine vì giao diện.

## Công cụ đã gọi và môi trường

- Figma: whoami, create_new_file, create_session, get_libraries, search_design_system, use_figma. File: https://www.figma.com/design/mcOqBkZMYZF8d7eqW7mTk5 . Đã tạo 40 token primitive/semantic/layout, 7 text styles Manrope/Lora; tệp Starter chỉ có 3 trang nên components và assets chung trang.
- GitHub MCP: get_repo và fetch metadata/latest commits của đủ 9 nguồn (Qiu-Jun có redirect). `source-refresh.json` giữ SHA/date thật; `source-code-inventory.json` giữ package và tài liệu tại các snapshot read-only.
- Context7: resolve Playwright, query mobile/CDP API. Tài liệu phiên bản được đối chiếu với typings và API runtime Playwright 1.62.1 đang cài; không sử dụng Fabric/React/Vue/Vite API trong app.
- Plugin Management: search Playwright/Chrome DevTools riêng và gộp đều không tìm được plugin. Đây không phải tuyên bố đã dùng MCP Playwright/DevTools.
- Playwright 1.62.1 chạy trực tiếp với Chromium tại `/usr/bin/chromium`; CDP thực tế đã gọi Performance.enable/getMetrics, Runtime.getHeapUsage và Memory.getDOMCounters. Viewport 440 × 956, touch/isMobile bật. Chưa phải Safari hoặc iPhone vật lý.
- Browser QA có package/lock riêng trong scripts/qa; không cài vào node_modules đang trỏ tới bản ổn định. `npm audit --omit=dev` của app hiện tại: 17 package production, 0 advisory tại thời điểm kiểm; không chứng minh không có lỗi trong mã vendored hoặc runtime.

## Các lỗi được nêu

| Mục | Quan sát thực tế trên baseline | Xử lý đã chọn |
|---|---|---|
| Loading | Ảnh đã ready, `hidden=true`, nhưng thông điệp “Đang mở…” vẫn được giữ trong DOM | Session phase nhất quán, bỏ nội dung loading khi ready và đồng bộ aria-busy/caption/controls; không chỉ sửa CSS |
| Thumbnail src rỗng | Chưa tái hiện trong filter panel; các img đang có nguồn thật | Kiểm thêm rapid switch/open/restore và thumbnail cancellation; không nhận sửa một lỗi chưa tái hiện |
| Desktop menu | Tám mục File/Edit/View/Image/Layer/Effects/Tools/Help vẫn trong DOM | Native presentation bridge: giữ engine initialization cần thiết nhưng unmount UI desktop và bỏ callback trình bày sau boot; không đụng source/reference repo |
| Zoom | Controller có 0.35, status riêng 35%, native range vẫn value=100 | Một logical viewport; bỏ widget zoom desktop, route native zoom tới viewport, kiểm cả pinch/pan/sheet |
| Fit ảnh lớn | Unit/48 MP đã có; phải bổ sung browser và backing DPR | DPR độc lập logical zoom, canvas bounded theo vùng xem; kiểm 440×956 và xoay ngang |
| Sheet/safe area | Có compact/expanded, cần bảo đảm slider/action không lọt dưới footer | So với Figma, test bounding boxes và kéo thật qua touch/CDP; không dùng screenshot mock |

Browser baseline: console/pageerror và network không lỗi; CDP DOM 3.389 nodes/708 listeners sau luồng mẫu, JS heap khoảng 9.2 MB (không gồm toàn bộ bitmap/GPU). Screenshot trước của home/editor/filter/beauty/text/sticker/reshape/makeup và raw metrics lưu trong work/pro-v2/before. Node baseline 95/95 qua.

## Ranh giới và lựa chọn

Giữ miniPaint/native layer/history và PBS v1. Không thêm Fabric/Konva hay đổi React/Vue/Vite chỉ vì UI. glfx/ImageFilters/pica có sẵn được dùng lại. Gaps thật cần bổ sung: HSL có chọn dải màu, blur điều chỉnh, heal/skin tone thủ công, eyebrow, glow/extrusion/bubble, font đa ngôn ngữ, ảnh dài/magazine và checkpoint dài hạn; worker chỉ chuyển pixel math hiện có khỏi UI thread.

Phê duyệt tự động từ chối full-page capture sang Figma vì payload chưa được chứng minh không nhạy cảm. Không retry hoặc đi đường vòng; thay bằng native Figma layers và chỉ public licensed demo assets có manifest. Không gửi dự án/ảnh người dùng hoặc toàn trang vào Figma.

## Snapshot và stack

| Nguồn | SHA | Commit HEAD theo UTC+7 | Stack/dependency đáng chú ý | License code |
|---|---|---|---|---|
| miniPaint | c9192c15918e | 10/11/2026 | JS/jQuery, Webpack, ImageFilters/glfx vendored, pica ^7, hermite-resize từ Git | MIT-LICENSE.txt; API GitHub NOASSERTION không thay nội dung license |
| Filerobot | a7cce3173cb3 | 04/06/2026 | React, react-konva, Konva 9.3.6, styled-components; React package 4.9.1 | MIT |
| mini-photo-editor | 475a0e9dcb5b | 30/10/2025 | @xdadda/mini và mini-gl qua file:../, Vite ^6.2.2; không lockfile | LICENSE MIT; manifest ghi ISC |
| glfx.js | 86ae72acfffc | 11/01/2022 | WebGL 1, GLSL, không framework; build.py | MIT |
| vue-fabric-editor | b3bdcfb0bd6d | 21/07/2026 | Vue 3, Fabric 5.3.0 cố định, @kuaitu/core, View UI Plus 1.3.7, Vite ^4.2.1; không lockfile | root MIT; core manifest ISC |
| yft-design | f1328edcd073 | 04/09/2026 | Vue 3, Fabric ^6.4.1, Element Plus, Pinia, Dexie, Vite ^5.4.3; không lockfile | MIT |
| mobile-fabric-editor backup | 71f4a9599d75 | 31/05/2026 | Vue/uni-app alpha, Fabric ^5.4.0 (lock 5.4.0), Wot Design, Pinia | MIT |
| mtsee/image-editor | c284e1ffa25a | 24/05/2024 | React 18, MobX 5, Leafer 1.0.0-rc.21, Semi UI, Axios 0.24 trong lock | MIT |
| fabric-photo | 6d5a06b56a35 | 31/10/2026 | core UI độc lập, Fabric ^6 (lock 6.9.1); React peer >=18, demo React 19; Node >=22 | MIT, copyright boilerplate ghi Evan You; giữ nguyên và kiểm tra provenance |

Tình trạng bảo trì: miniPaint có merge tính năng mới; Filerobot có công việc bảo mật/refactor năm 2026 nhưng release gần nhất quan sát là v4.9.1 ngày 30/12/2024 UTC. Vue-fabric HEAD tháng 7/2026 là README; sửa core gần nhất quan sát 22/01/2026. YFT HEAD tháng 9/2026 là README; thay đổi src gần nhất 13/06/2025. glfx thay đổi gần đây nhất chủ yếu URL/build, không đồng nghĩa thuật toán được nâng cấp cho Safari hiện đại. fabric-photo có feature tháng 10/2026 và các test file, chưa chạy test. Không dùng ngày updated_at hay stars làm bằng chứng bảo trì code.

## So sánh tính năng từ mã

Quy ước: C = có đường thực thi; P = một phần hoặc primitive; K = chưa tìm thấy module đáp ứng; X = lõi/asset nằm ngoài nguồn. Đây không phải kết quả test.

| Nguồn | Màu/filter | Beauty thủ công | Liquify kéo nét | Layer | Typography | Sticker/template | Collage theo ô | Touch |
|---|---|---|---|---|---|---|---|---|
| miniPaint | C, nhiều hiệu ứng; màu Canvas filter cần sửa Safari | P, clone/blur/denoise | P, bulge/pinch theo điểm, chưa kéo nét | C raster + text/shape | C kerning, leading, span, outline; thiếu text path | P import ảnh/JSON, chưa catalog | K; sprites là xếp sprites, không phải collage | P touch có, cần gesture 2 ngón |
| Filerobot | C brightness/contrast/HSV/warmth và preset | P blur, không skin mask | K | P annotations trên một ảnh chính | P font/size/style/outline, không text engine chuyên sâu | P image/watermark gallery tự cung cấp | K | C pinch/pan có module riêng |
| mini-photo-editor | C UI curves/perspective/LUT; X shaders mini-gl | P heal Telea wired, không bộ beauty | K | K; image blender không là layer stack | K | P recipes điều chỉnh, không layout | K | C pointer/pinch, chưa test iPhone |
| glfx.js | C shader curves, denoise, blur, hue, vibrance | P denoise, chưa mask/UI | P bulge/pinch/swirl; không forward brush | K | K | K | K | K; thư viện không UI |
| vue-fabric-editor | C Fabric filters và gamma, không photo grading sâu | K | K | C object/group, chưa raster layer mask | C textbox, spacing, text path plugin | C import; X catalog/font server | P clipPath primitive; chưa workflow collage | P Fabric touch cơ sở, UI desktop |
| yft-design | C Fabric filters, không tính worker Pixi chưa nối | K; matting không là bộ beauty | K | C object/page/group | C arc/curved/vertical/textbox | C template workflow; X tài nguyên remote | P masks/template primitives | C FabricTouch + mobile view; chưa đo iPhone |
| mobile backup | P 5 control, grayscale mức liên tục chưa chứng minh | K; AI được README ghi không mở nguồn | K | C object stack/history | P font/style/stroke/shadow | C 2 template local + lưu local, hình/line | K | P UI rpx/safe area; chưa có pinch chuyên dụng được tìm thấy |
| mtsee | P blend modes; tên Filter không có LUT | K; nút AI placeholder/đi website | K | C group/page, vài phần dở dang | C text style/spacing/gradient; chưa path text | C import workflow; X H5DS catalog | P compositing tay, chưa frame slots | P từ Leafer, UI desktop |
| fabric-photo | C đúng 7 filter fields | K | K | C object/layer order/lock/hide | P đúng 7 text style fields | P ảnh overlay; chưa catalog/template | K | P Fabric mouse/pan; chưa pinch riêng |

## Những kiểm tra mã quan trọng

- miniPaint: src/js/tools/bulge_pinch.js chỉ gọi bulgePinch ở mousedown và commit ở mouseup; không có forward warp theo kéo. src/js/tools/text.js có kerning/leading, span meta và action undo thực tế dù comment TODO cũ còn tồn tại. src/js/modules/tools/sprites.js xếp sprite sheet; không được gọi là collage grid. service-worker.js ghi rõ không dùng; index.html comment manifest. src/js/modules/effects/common/brightness.js và color_corrections.js dùng ctx.filter.
- Filerobot: packages/react-filerobot-image-editor/src/components/tools/tools.constants.js, custom/filters và MainCanvas/touchZoomingEvents.js xác nhận công cụ. Các Konva Layer nội bộ không chứng minh có layer stack ảnh chuyên nghiệp. Cloudimage là tùy chọn, không phải mọi lần chỉnh ảnh đều cần API trả phí.
- mini-photo: src/app.js nối curves, filters, perspective qua composition và heal; src/js/inpaint.js là thuật toán Telea cổ điển, không AI. package.json trỏ hai core về thư mục anh em nên checkout đơn không tái lập được engine; không khẳng định đã xác minh toàn bộ shader, P3 hoặc độ sâu bit. LICENSE/manifest lệch MIT/ISC; inpaint tham chiếu upstream không có LICENSE ở cây hiện tại, cần giải quyết provenance trước khi chép.
- glfx: src/core/canvas.js công khai các shader nhưng không có document/history/UI. src/filters/adjust/denoise.js có 2 lượt cửa sổ 9x9; khá tốn mẫu texture. Bulge/pinch/swirl không phải bộ bóp mặt hoàn chỉnh.
- Vue-fabric: packages/core là Editor và plugin tương đối tách khỏi UI; filters nằm trong Vue component, FontPlugin dùng endpoint font, assets có 2 font Trung Quốc không kèm OFL riêng. PathTextPlugin có code thật. Bản H5/pro trong quảng cáo không tự động thuộc bản MIT.
- YFT: extension/object/ArcText.ts, CurvedText.ts, VerticalText.ts và ElementFilter.vue có mã. FabricTouch được khởi tạo ở views/Canvas/useCanvas.ts. API matting upload ảnh và template/font ngoài repo không đáp ứng offline nguyên trạng. worker/pixi.ts tham chiếu dependency không được khai báo trong package.json; usePixi.ts đang comment, không suy thành tính năng hoạt động hoặc build chắc chắn lỗi.
- Mobile backup: Templates/index.vue nhập 2 template local thật và đọc template người dùng từ localStorage; ImageCom/components/Filter.vue nối 5 control vào Fabric. Material hiện chủ yếu line/path, không phải kho sticker phong phú. useSafeArea.ts dùng isIPhoneX thay vì xác minh model 16. Không tính backend/AI đóng là source sẵn dùng.
- Mtsee: Filter.tsx chỉ gán elementData.blendMode; không phải LUT. AiImg.tsx là Toast hoặc nhắc đi website, không có thuật toán AI tách nền trong module này dù README đánh dấu hoàn tất. Template.tsx gọi H5DS. SDK vanilla vẫn có thể bundle React; không coi đây là core trung lập thuần Vue.
- Fabric-photo: model/doc.ts và render/filters.ts chỉ có brightness, contrast, saturation, blur, grayscale, sepia, invert. Text model chỉ có 7 thuộc tính style. Step/Transaction/History là code thật, 36 file test được tìm thấy nhưng chưa chạy. @gmi/fp-* chưa được README xác nhận phát hành npm, phải vendor workspace nếu chọn.

