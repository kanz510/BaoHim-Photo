# BaoHim Photo V5 · Giai đoạn 3, Đợt 1 (Antigravity)

Đọc DESIGN_SPEC.md và v5-tokens.css trong cùng thư mục trước khi sửa. Đọc src/js/studio/index.mjs, premium-ui.mjs, mobile-ui.mjs, mobile-sheet.mjs, mobile-viewport.mjs, styles.mjs, src/css/v4-theme.css và scripts/build.mjs.

**Mục tiêu DUY NHẤT:** dựng khung V5 (Design System, Home, header, EditorShell, điều hướng compact) gắn engine V4. Chưa refactor sâu Filter/Beauty/Makeup/HSL.

1. Dùng namespace .v5 hoặc body.immersive-v5; import CSS mới SAU v4-theme.css và áp dụng chỉ khi UI mode V5.
2. Bật V5 bằng query ?ui=v5 trên cùng Pages; mặc định V4 cho tới khi hoàn thiện toàn bộ.
3. Trang chủ V5 có CTA mở thư viện ảnh thật, recent projects từ Facade Repository và quick access hoạt động. Các nút chưa có workflow phải vô hiệu hóa minh bạch thay vì giả lập.
4. Editor stage vẫn dùng canvas và facade hiện tại, cập nhật header, một dock compact, bottom nav, bao gồm đường truy cập 100% công cụ V4.
5. Không dùng preview-v4/index.html hay preview-v4/app.js làm engine. Không đổi IndexedDB keys, autosave, layer/history, exports, offline.
6. Không làm mất tác vụ đang chỉnh khi chuyển Home/Editor. Fit và Manual zoom/pan phải bảo toàn đúng. Không height animation của vùng ảnh.
7. Kiểm thử Playwright WebKit: Home/Editor 440×956 DPR3, 390×844, 375×812; chuyển 10 công cụ, zoom thủ công 200% giữ anchor, ảnh không crop, nút Save + project thật.
8. Chạy npm run check, npm test, npm run test:webkit, npm run build. Commit push lên main (không PR, không force), xác nhận Pages deploy.
9. Báo cáo commit SHA, Actions, URL ?ui=v5 thực tế, ảnh screenshot QA, tính năng đã nối và thiếu.

**Ảnh tham chiếu:** BẮT BUỘC mở đủ 7 ảnh tại [`docs/v5/references/README.md`](./references/README.md) và đối chiếu trực quan với `DESIGN_SPEC.md`. Trang chủ tham chiếu ảnh 04, editor shell tham chiếu ảnh 01–03 và 05–07. Không biến hình minh họa thành chức năng giả. Nếu ảnh và tính năng cũ xung đột, giữ chức năng thật và ghi rõ lựa chọn UI.

**Không làm Đợt 2 trong commit này.** Chờ chủ dự án duyệt shell V5.
