# PHOTO BEAUTY STUDIO Implementation Plan — bản nghiên cứu, chờ duyệt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, only after the user approves. Steps use checkbox syntax. This document authorizes no implementation, installation, deployment, or changes to the user's repositories.

**Goal:** Ứng dụng chỉnh ảnh và làm đẹp thủ công, chất lượng cao, ưu tiên iPhone 16 Pro Max và offline; không AI, không video, không API trả phí.

**Architecture:** Đề xuất fork miniPaint tại c9192c15918eb61f7dd89e362cf8065a276b89e9, giữ layer model, Canvas 2D compositor và action history. Dùng glfx.js/ImageFilters/pica vốn có; bổ sung các module beauty, gesture, content catalog và lưu dự án. Một engine, một layer model, một lịch sử thao tác.

**Tech Stack:** JavaScript ES modules, HTML/CSS, Canvas 2D, glfx WebGL, ImageFilters, pica, Web Workers cho tác vụ CPU phù hợp, IndexedDB, Service Worker. Giữ Webpack trong đợt đầu; không thêm React/Vue/Fabric/Konva như engine thứ hai.

**Spec:** Yêu cầu của người dùng trong cuộc hội thoại và phần kiến trúc dưới đây. Tất cả quyết định kỹ thuật là đề xuất, chưa được người dùng duyệt.

## Global Constraints

- Không AI dưới bất kỳ hình thức nào: không model, weights, nhận diện khuôn mặt/landmark, FaceDetector, segmentation, API AI, hoặc module AI ẩn trong bundle.
- Không chỉnh video; bỏ animation/timeline và dependency xuất GIF động không cần thiết khỏi bản fork.
- Ưu tiên offline, không API trả phí; không tải ảnh người dùng lên server.
- Không sao chép thương hiệu hoặc tài nguyên độc quyền.
- Không ghép 9 ứng dụng; không thay engine sau khi chốt nếu chưa có lý do đo được và người dùng duyệt thay đổi.
- Chỉ tạo dự án mới sau khi duyệt; không sửa repository khác của người dùng.
- Không công bố hoàn chỉnh khi mới có mã hoặc nút UI. Nghiệm thu phải gồm dữ liệu thử và thiết bị thực.
- Baseline đề xuất: Safari iOS 18+; sRGB 8-bit; ảnh tĩnh JPEG/PNG/WebP và HEIC khi trình duyệt giải mã được. P3/HDR/RAW không được tự nhận hỗ trợ.
- Preview ban đầu cạnh dài tối đa 2048 px; xuất 12 MP là mục tiêu thử trước, 24/48 MP chỉ mở khi vượt kiểm thử. Không âm thầm hạ độ phân giải bản xuất.

## Review Focus

1. Ảnh HEIC, EXIF quay/gương và ảnh 24/48 MP: đúng hướng, không nhân đôi xoay, không crash hoặc âm thầm mất độ phân giải.
2. Đổi một ngón sang hai ngón hoặc pointercancel giữa nét: không phát sinh nét vẽ/warp ngoài ý muốn, undo chỉ một thao tác.
3. Tô makeup rồi warp, crop hoặc lật ảnh: mask theo đúng vùng ảnh, chữ/sticker không bị bóp méo cùng da.
4. Font tiếng Việt có dấu, CJK, emoji, IME và font chưa tải xong: không tách sai ký tự hoặc xuất sai hình.
5. IndexedDB hết quota, tab bị kill và WebGL context lost: khôi phục checkpoint hợp lệ, giữ bản gốc và không làm mất dự án đã lưu.

## Phương pháp và giới hạn nghiên cứu

Ngày 11/11/2026, múi giờ báo cáo UTC+7. Đã tra metadata, nhánh mặc định, các commit gần đây và release bằng GitHub API; lấy bản sao tách biệt để đọc README, manifest dependency, license, cây thư mục và các đường thực thi liên quan. Không khẳng định đã đọc từng dòng của mọi file. Không cài dependency ứng dụng, không build, không chạy UI hoặc kiểm thử iPhone trong lượt nghiên cứu này. Các kết luận tính năng là bằng chứng tĩnh từ mã nguồn; các mục tiêu hiệu năng là tiêu chí đề xuất.

URL Qiu-Jun/mobile-fabric-editor hiện chuyển đến Qiu-Jun/diy-platform. Đã kiểm tra main 49c65a3fecb0f27a834b27769057f0b833edbdc7 và nhánh backup 71f4a9599d756a3557c9faccb674b51040ea79fe, là mã editor di động phù hợp tên nguồn ban đầu. Main không có LICENSE trong cây; backup có MIT. Không áp license của backup cho code mới của main.

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

## License và bảo mật

Đối chiếu OSV bằng API querybatch cho toàn bộ phiên bản npm chính xác đọc từ lockfile: 3459 cặp tên/phiên bản phân biệt, 3459 phản hồi, không lỗi request. Kết quả bao gồm dev/optional/server, không phân tích reachability, không quét mã vendored/Git/file dependencies. Cặp có advisory không phải số lỗ hổng có thể khai thác của sản phẩm.

| Snapshot | Cặp khóa được quét | Cặp có advisory |
|---|---:|---:|
| miniPaint | 490 | 22 |
| Filerobot | 1194 | 36 |
| mobile backup | 1433 | 74 |
| mtsee | 473 | 29 |
| fabric-photo | 418 | 5 |
| diy-platform main tham khảo thêm | 770 | 24 |
| Vue-fabric, YFT, mini-photo | không có lockfile trong snapshot | chưa thể quét graph cố định |
| glfx | không có npm dependency graph | không áp dụng; mã WebGL vẫn phải review/test |

Đã chạy npm audit --package-lock-only --ignore-scripts --json cho miniPaint: 22 package bị gắn cảnh báo (3 critical, 11 high, 7 moderate, 1 low). Bản --omit=dev: chỉ 1 moderate ở uuid 8.3.2. Advisory GHSA-w5hq-g745-h8pq nói v3/v5/v6 API với output buffer; mã quan sát chỉ gọi uuidv4 nên chưa chứng minh đường khai thác. Không tuyên bố code an toàn vì audit production không có high/critical. Giữ build host kín, cập nhật toolchain và có thể thay uuid bằng crypto.randomUUID ở fork sau khi duyệt.

Fabric dưới 7.2.0 bị GHSA-hfvx-25r5-qc3w; dưới 7.4.0 bị GHSA-w22m-hvvm-xmwx về serialize SVG. Vue-fabric/YFT có luồng import JSON và toSVG cần phân tích thực tế. Fabric-photo chỉ xuất bitmap trong đường mã đọc được; README chấp nhận 2 advisory nhưng scan hiện còn các package dev khác. Không kết luận mọi ứng dụng dùng Fabric đều bị XSS khi xuất PNG, cũng không nâng 5/6 lên 7 bằng đổi số version đơn giản.

MIT cho phép sửa/phân phối thương mại khi giữ notice nhưng không chứng minh quyền bên thứ ba đối với mọi font, LUT, ảnh, sticker hoặc template. Chỉ dùng asset có manifest license: author, source URL, license, attribution, hash. miniPaint còn notice MIT/BSD trong Color Thief; ImageFilters upstream có MIT-LICENSE đã kiểm tra. Giữ các notice liên quan. Font Hoa Khang và font khác chỉ có tên/file không đủ bằng chứng phân phối. Đề xuất nội dung nguyên gốc do người thiết kế tạo hoặc OFL/CC0/CC-BY đã kiểm tra điều kiện; không có tài nguyên sinh bởi AI.

## Quyết định đề xuất

Chọn miniPaint làm nền chính. Đây là quyết định ưu tiên bộ công cụ raster, lịch sử/layer có sẵn, độ bao phủ thông thường và glfx tích hợp. Chưa chọn framework UI mới. Các lựa chọn thực tế khác: Vue-fabric nếu ưu tiên poster/typography hơn raster, nhưng phải làm thêm beauty/raster core và sửa dependency/Fabric; fabric-photo nếu ưu tiên core headless React và test, nhưng phải làm thêm nhiều công cụ/photo asset. Filerobot phù hợp editor nhúng phạm vi nhỏ hơn, không đủ nền của studio beauty/layer/typography đầy đủ. Không kết hợp các lựa chọn này vào runtime.

Điểm đổi lại khi chọn miniPaint: DOM/jQuery/singleton không phải headless SDK; cần thay UI sâu; Canvas filter không thể dùng làm mặc định Safari; nhiều action bitmap đang mã hóa PNG/dataURL và tốn RAM; chưa có test suite ứng dụng tại snapshot. P0 phải giải quyết/đo những điểm này, không che chúng bằng giao diện mới.

## Kiến trúc được đề xuất để duyệt

1. Giữ config.layers, Base_layers_class, State.do_action và Bundle_action là hệ trạng thái/lịch sử duy nhất. Thêm schema studio vào layer qua constructor/validator/save/load rõ ràng vì Insert_layer_action hiện chỉ chấp nhận khóa đã biết. Chỉ cache tạm đặt dưới khóa private; metadata cần lưu không được đặt dưới tên _ vì export bỏ qua chúng.
2. StudioFacade là API hẹp cho UI mới, dùng lại crop/resize/select/clone/text/layer/history. Không giả vờ miniPaint đã có core headless; vẫn có một editor instance và các DOM hook cần thiết. Giữ build system đợt đầu, không vừa đổi engine vừa đổi UI vừa đổi bundler.
3. RasterService bọc glfx/ImageFilters/pica có sẵn. Không dựa vào ctx.filter cho màu/blur xuất ảnh. Thử pixel để kiểm năng lực, không chỉ kiểm 'filter' in ctx. CSS brightness là nhân kênh còn brightness của glfx có định nghĩa khác; adapter phải giữ quy ước màu được chọn bằng test pixel, không truyền nguyên số giữa hai API. Một context dùng lại; tái sử dụng texture và destroy khi xong; chống context loss, out-of-order jobs và stale revision. glfx hiện dùng document.createElement, vì vậy không hứa chuyển toàn bộ sang worker không sửa adapter. CPU/histogram/mask có thể dùng worker; main-thread GPU preview nhỏ vẫn là baseline.
4. Beauty operations giữ sourceAssetId, source revision, mask/control points, params và cached result. Nguồn ảnh gốc bất biến trong IDB; layer.link là bề mặt/cache dùng cho compositor. Action của beauty lưu/đảo metadata theo một gesture; checkpoint bitmap tham chiếu Blob, không chép 48 MP mỗi pointermove. Đường legacy có thao tác destructive + undo; không tự quảng cáo cả app non-destructive.
5. Skin: clone/brush sẵn có, denoise có mask vẽ tay và feather, dodge/burn, giảm sắc vàng/răng theo vùng người dùng tô. Không suy ra vùng da/răng/mắt bằng model hoặc FaceDetector.
6. Reshape: forward-warp brush và các handle eo/chân do người dùng đặt; bulge/pinch tận dụng sẵn; freeze mask nền, restore, giới hạn biến dạng tránh lật lưới. Tích lũy displacement map rồi sample nguồn để giảm mờ do resample lặp; đây là phần mới, chưa có trong 9 repo.
7. Makeup: mask brush hoặc path Bézier thủ công cho son, má hồng, mắt, highlight; blend/opacity giữ texture. Quy ước pipeline cố định local retouch → makeup → warp → global color → layer transform → composite chữ/sticker. Pointer sau warp phải được map về source coordinates; mask đi theo ảnh khi warp/crop/lật, chữ/sticker không tự warp theo ảnh.
8. Typography mở rộng text.js hiện có: giữ spans/kerning/leading/stroke; sửa input/selection theo grapheme và IME; font cục bộ đợi document.fonts.ready trước export. Text path/arc/multiple stroke là phần bổ sung nếu nằm trong baseline được duyệt, không nhét Fabric engine vào để lấy một text component.
9. Sticker/template/collage dùng layer native. Catalog JSON local + asset manifest có license; template schema có version; collage slots chứa crop rectangle/mask, image reference và transform riêng. Không nhầm layer chồng tay với frame collage tự đổi hình. Asset là local file/Blob; SVG không chèn inline tùy tiện, phải kiểm/sanitize và cấm external reference; có thể chỉ phân phối PNG cho sticker bản đầu để giảm bề mặt parser.
10. ProjectRepository là lưu dài hạn riêng khỏi image_store history (history có logic xóa dữ liệu phiên cũ). Dùng IndexedDB transaction/checkpoint, Blob nguồn và recipe, export/import dự án; phiên bản schema và migrate. SW cache app/font/preset sau lần cài đầu. Offline không đảm bảo dữ liệu không bị hệ điều hành eviction; luôn có xuất bản sao dự án và báo lỗi quota trước khi mất dữ liệu.
11. Chặn JSON sai schema, chiều ảnh/pixel/object vượt budget, NaN/Infinity, render_function không thuộc registry cho phép, URL ngoài catalog và tên file chứa HTML. Text UI dùng textContent. Bundle allowlist module không AI/video; network test không có truyền ảnh hoặc tải remote font/catalog. Dev server không là bản production.

## iPhone và nghiệm thu hiệu năng

Apple công bố màn 1320×2868 và ảnh 24/48 MP; viewport mục tiêu đề xuất 440×956 CSS px ở tỷ lệ mặc định, cần xác nhận trên Safari máy thật. Dùng safe-area env(), 100dvh/visualViewport cho bàn phím, hit target >=44 CSS px, bottom sheet và slider đủ chạm; không hardcode isIPhoneX. Palette/typography/icons thiết kế nguyên gốc lấy cảm hứng mức trải nghiệm, không lấy tài nguyên Meitu.

48 triệu pixel ×4 byte =192 MB cho một RGBA8 surface, chưa tính ảnh decode, canvas, framebuffer, float texture hoặc undo. Không suy ra Safari có hạn mức RAM cố định hoặc khả năng xuất 48 MP chỉ từ A18 Pro. Preview adaptive <=2048 cạnh dài, ROI và tile có halo cho filter/warp; không đủ nếu cuối cùng vẫn ghép vào canvas quá lớn, phải đo encoder/compositor và giới hạn riêng.

Mục tiêu chưa đo: thao tác preview thông dụng p95 <=33 ms/frame ở preview đã chốt; feedback UI <=100 ms; export 12 MP <=10 s cho kịch bản ghi rõ; phiên 15 phút/100 nét/20 layer không reload do cạn bộ nhớ. Không hứa 120 fps từ tần số màn. Shader nặng có thể giảm preview chất lượng, không âm thầm giảm file output. Test tối thiểu Safari máy thật + PWA standalone, phiên bản iOS/browser ghi lại; Playwright WebKit bổ trợ, không thay iPhone.

## Kế hoạch triển khai sau duyệt

Các đường dẫn mới dưới src/js/studio là đề xuất cho repository mới. Không tạo các file này trong lượt nghiên cứu. Các lệnh/test dưới đây chỉ là kế hoạch, chưa được chạy.

### P0 — baseline, quyền sử dụng và kiểm chứng Safari

**Files:** sửa package.json/package-lock.json/webpack.config.js trong fork mới; tạo docs/source-register.md, docs/architecture-decision.md, tests/fixtures; không sửa checkout của người dùng.

- [ ] Tạo riêng fork/project được duyệt, pin SHA, pin hermite Git commit, lập license inventory cho code và asset.
- [ ] Cập nhật dependency có advisory, giữ API phù hợp; bỏ runtime/feature không cần dùng và thay UUID helper nếu chọn built-in.
- [ ] Chạy build upstream đã pin và ghi kết quả; tạo bộ fixture quyền dùng rõ (12/24/48 MP, EXIF, HEIC, PNG alpha, text đa ngôn ngữ).
- [ ] Trên iPhone thật: đo crop, native text input, history, ctx.filter pixel behavior, glfx creation và export 12 MP. Đây là kiểm thử kỹ thuật được thực hiện SAU duyệt.
- [ ] Nghiệm thu: build lặp lại được, mọi dependency/asset đang ship được ghi nhận; cảnh báo high/critical đã xử lý hoặc có reachability/mitigation được review; không dựa vào cờ Canvas Filters. Nếu blocker cần đổi kiến trúc, trình bằng chứng và đợi duyệt, không tự đổi nền.

### P1 — ảnh cơ bản và lớp adapter

**Files:** tạo studio/editor-facade.js, studio/raster-service.js, studio/import-image.js; sửa modules/file/open.js, effects/abstract/css.js, core/base-layers.js theo điểm nối nhỏ.

**Interfaces:** facade open(file: File): Promise<void>, run(commandId: string, params: object): Promise<void>, subscribe(listener): unsubscribe; RasterService render({assetId, revision, operations, targetSize, signal}): Promise<{revision, bitmap}>. Đây là API đề xuất, chưa tồn tại.

- [ ] Viết test pixel cho màu/blur/alpha không dùng ctx.filter và test EXIF không xoay hai lần; chạy test để thấy thất bại trước khi triển khai.
- [ ] Nối công cụ hiện có vào facade; dùng glfx/ImageFilters cho render thật; không thay crop/resize/clone engine.
- [ ] Test crop ratio, straighten/arbitrary rotate, flip, resize, perspective, selection, brush/eraser/clone, layer order/merge/opacity/blend, histogram, compare và export; kiểm tra WebP MIME thực trả về và JPEG flatten alpha.
- [ ] Nối RGB curves vào primitive glfx có sẵn; bổ sung UI levels, exposure, temperature/tint và shadows/highlights thành tham số/recipe có định nghĩa pixel rõ. Đây là chức năng bổ sung, chưa được tính là đã có đầy đủ ở miniPaint.
- [ ] Nghiệm thu: đủ baseline chỉnh ảnh đã thống nhất; preview/export cùng recipe; undo/redo chính xác. Chỉ commit sau test, không deploy.

### P2 — giao diện và gesture iPhone

**Files:** tạo studio/ui/studio-shell.js, studio/ui/bottom-sheet.js, studio/gesture-router.js, src/css/studio.css; sửa core/base-tools.js và base-selection.js để không xử lý trùng input.

**Interfaces:** GestureRouter nhận event và view-to-layer mapping; phát begin/update/end/cancel cho một công cụ hoặc pan/zoom, không cả hai cùng lúc.

- [ ] Test chuyển 1→2 ngón, pointercancel, gesture đang diễn ra khi xoay máy/đổi tool, keyboard/visualViewport.
- [ ] Làm UI ảnh lớn, nút so sánh, undo/redo, thanh công cụ dưới và một sheet thuộc tính; giữ nhãn dễ hiểu, không hiện thông số implementation.
- [ ] Nghiệm thu portrait/landscape, safe area, hit target >=44 px, không vẽ khi pinch, VoiceOver labels và font scale không che nút lưu.

### P3 — lưu dự án và offline

**Files:** studio/project-repository.js, studio/project-schema.js, studio/asset-catalog.js, service-worker.js, manifest.json; nối open/save nhưng tách database project khỏi history.

**Interfaces:** save(projectId, snapshot, blobs): Promise<revision>; load(projectId): Promise<snapshot>; delete(projectId): Promise<void>; exportProject(projectId): Promise<Blob>. Định dạng bản đầu có thể giữ JSON miniPaint mở rộng, chỉ bổ sung ZIP library khi đã xác nhận nhu cầu đóng gói Blob và license.

- [ ] Test save-load giữ layer/source/mask/recipe/font reference và migration; inject quota failure và kill tab giữa transaction.
- [ ] Tắt remote Google Fonts/webfonts catalog và thay font/local content; SW versioned cache không xóa project DB.
- [ ] Test cài lần đầu có mạng → airplane mode → mở lại → chỉnh → export, hoàn toàn không request ngoài origin sau asset setup.
- [ ] Nghiệm thu khôi phục checkpoint, bản gốc giữ nguyên, thông báo quota; khôi phục từ file project độc lập với cache browser.

### P4 — retouch có mask

**Files:** studio/beauty/masks.js, studio/beauty/retouch.js, studio/actions/beauty-action.js; nối clone/blur/denoise hiện có và update layer metadata.

**Interfaces:** MaskStroke {points trong source space, radius, hardness, opacity}; BeautyAction dùng Base_action/Bundle_action hiện có; một nét là một undo.

- [ ] Test mask=0 giữ nguyên pixel, mask=1 có hiệu ứng, feather không có seam, alpha đúng; sourceBlob không đổi.
- [ ] ROI/halo cho denoise; không chạy shader 9×9 hai vòng toàn ảnh ở mỗi pointermove.
- [ ] Test clone/retouch ở layer đang rotate/scale và pan/zoom; nghiệm thu bằng ảnh texture da thật có quyền sử dụng và đồ thị pixel tổng hợp.

### P5 — Liquify mặt/vóc dáng

**Files:** studio/beauty/warp-field.js, studio/beauty/reshape-tool.js, studio/beauty/body-handles.js, shader extension trong libs/glfx hoặc studio/shaders; không thêm engine.

**Interfaces:** WarpStroke {from, to, radius, strength} trong source units; freeze mask; BodyHandles là control points do người dùng đặt, không detector.

- [ ] Test strength=0 identity, ngoài radius/freeze không thay đổi, affine/inverse mapping đúng khi rotate/flip/crop, field hữu hạn và không foldover.
- [ ] Tích lũy displacement và sample nguồn; checkpoint dùng chung history thay vì stack độc lập.
- [ ] Test 100 nét, undo/redo từng nét, restore một vùng, đổi một ngón sang pinch và context lost.
- [ ] Nghiệm thu kéo mặt/eo/chân theo control thật; chữ/sticker đứng riêng; không coi Bulge/Pinch hiện tại là đã xong phần này.

### P6 — makeup thủ công và phối hợp warp

**Files:** studio/beauty/makeup.js, studio/beauty/makeup-presets.json và mask/path editor dùng chung gesture.

- [ ] Test blend/opacity giới hạn 0..1, không mất texture; mask theo source khi đã warp và inverse-map cursor.
- [ ] Son, má, mắt, highlight có brush/path thủ công; mọi control point do người dùng tạo.
- [ ] Test makeup→warp→crop→flip→save→load→export, pixel alignment/undo nhất quán.

### P7 — typography, sticker, filter presets, template và collage

**Files:** mở rộng tools/text.js; studio/typography/{text-path,font-loader}.js, studio/collage/{slots,layout}.js, studio/content/manifest.json.

- [ ] Test tiếng Việt NFC/NFD, CJK, emoji grapheme, selection/IME và font readiness; giữ spans, kerning, leading, outlines có sẵn.
- [ ] Thêm text path/arc và preset text trong cùng native text layer model nếu nằm trong scope duyệt; không nhập Fabric để vẽ chữ.
- [ ] Preset filter là thông số thuật toán, không texture/LUT sao chép từ thương hiệu. Sticker và template có license manifest và dùng được offline.
- [ ] Test collage slot replace/pan/crop, gutter/round corner, nhiều aspect ratio; thay ảnh không đổi toàn bộ bố cục, save/load giữ đúng khung.
- [ ] Nghiệm thu font/content thực và số lượng bộ khởi đầu được duyệt riêng; không thay kho nội dung bằng placeholder rồi gọi đầy đủ.

### P8 — chất lượng và phát hành ứng viên

**Files:** tests/visual, tests/e2e, docs/device-results.md; bộ test quản lý dependency trong fork mới, không ở lượt nghiên cứu.

- [ ] Chạy unit/semantic, visual reference và E2E Safari/PWA trên fixture được chốt; WebKit desktop là hỗ trợ.
- [ ] Đo p95 frame, time-to-feedback, export latency và phiên 15 phút/100 nét/20 layer; ghi iOS/Safari/build/fixture, không chỉ điểm Lighthouse.
- [ ] Thử quota, context loss, background/foreground, cancel export, file MIME giả, JSON hỏng, SVG/network/HTML injection.
- [ ] Release gates: no AI/video code path, asset/license inventory đủ, không truyền ảnh, offline hoạt động, mọi claim có bằng chứng. Chỉ đóng gói bản ứng viên; deployment là hành động riêng khi được yêu cầu.

## Chưa có trong baseline sẵn dùng

Liquify forward brush/freeze/restore, body handles, makeup masks và phối hợp geometry; PWA/cache nội dung/font thật; iPhone UI/gesture; collage slots/template catalog; curves/levels UI và color path không phụ thuộc ctx.filter; typography path/grapheme/IME hoàn chỉnh; durable autosave và export lớn ít RAM; kiểm thử thật và xử lý dependency. Không có nguồn nào trong 9 nguồn đáp ứng toàn bộ nguyên trạng.

## Bằng chứng cục bộ của nghiên cứu

source-manifest.json, github-metadata.json, verified-snapshots.json, các file *-tree.txt, osv-lock-audit.json, minipaint-audit.json, minipaint-prod-audit.json và bản sao nguồn theo SHA. Đây là tài liệu trung gian trong work, không phải code sản phẩm và không phải chứng nhận an toàn.

## Primary references

- miniPaint: https://github.com/viliusle/miniPaint/tree/c9192c15918eb61f7dd89e362cf8065a276b89e9
- Filerobot: https://github.com/scaleflex/filerobot-image-editor/tree/a7cce3173cb380c4900b9cb9fb8d91f7f33a7a26
- mini-photo: https://github.com/xdadda/mini-photo-editor/tree/475a0e9dcb5bb6925d9b7f3c522a1312aeefad3d
- glfx: https://github.com/evanw/glfx.js/tree/86ae72acfffcd50774507eb7b69887ba2493dc35
- Vue-fabric: https://github.com/ikuaitu/vue-fabric-editor/tree/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889
- YFT: https://github.com/dromara/yft-design/tree/f1328edcd07373267bc372bab19be466c7482fc3
- Mobile backup: https://github.com/Qiu-Jun/diy-platform/tree/71f4a9599d756a3557c9faccb674b51040ea79fe
- Mtsee: https://github.com/mtsee/image-editor/tree/c284e1ffa25ada7e494817d9f3f0bedbfb3f979b
- Fabric-photo: https://github.com/ximing/fabric-photo/tree/6d5a06b56a353334923d6b127a66186e36f1e693
- Canvas filter browser data: https://github.com/mdn/browser-compat-data/blob/main/api/CanvasRenderingContext2D.json
- GPU guidance: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Apple device: https://support.apple.com/en-us/121032
- Fabric SVG advisory: https://github.com/advisories/GHSA-hfvx-25r5-qc3w
- Gradient advisory: https://github.com/advisories/GHSA-w22m-hvvm-xmwx
- UUID advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- ImageFilters license: https://github.com/arahaya/ImageFilters.js/blob/master/MIT-LICENSE
