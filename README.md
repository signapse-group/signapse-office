# SIGNAPSE AI Coding Agents Office

Văn phòng 3D với demo Symphony/Codex ngoại tuyến.

## Chạy thử

Cần **Node.js từ 20.9**, npm và trình duyệt hỗ trợ WebGL. Chạy trong thư mục dự án trên Windows, macOS hoặc Linux:

```sh
npm ci
npm run dev
```

Mở [demo Symphony bằng tiếng Việt](http://localhost:4310/?lang=vi). Các thành viên tự nhận việc khi văn phòng tải xong.

| Đường dẫn | Nội dung |
| --- | --- |
| `/?lang=vi` hoặc `/?demo&lang=vi` | Demo Symphony/Codex: trạng thái runtime, hàng đợi issue và nhân vật trong văn phòng 3D. |
| `/?demo=claude&lang=vi` | Demo Claude Code với các dự án giả lập. |

## Kịch bản Symphony/Codex

Demo dùng dữ liệu mẫu trong [symphony-state.js](src/office/demo/symphony-state.js).

- Backend, Frontend, Quality Assurance, Project Management, Sales và Marketing có hai thành viên mỗi nhóm.
- Hàng đợi có tiến trình từ requirement đến epic, user story và subtask. QA ghi bug cho Frontend và kiểm thử lại sau khi có bản sửa.
- Kịch bản tự lặp. **Về ảnh chụp** hiển thị trạng thái mẫu dựa trên lần khảo sát lúc **13:21 ngày 13/11/2026 (UTC+7)**.

**Demo chạy ngoại tuyến trong trình duyệt** và mở được ngay khi chạy ứng dụng local.

Để chạy bản đã biên dịch:

```sh
npm run build
npm start
```

Server mặc định nghe tại `127.0.0.1:4310`. Dùng `OFFICE_PORT` để đổi cổng và `OFFICE_LANG=vi` để chọn tiếng Việt mặc định.

## Phát triển

[`scripts/serve.mjs`](scripts/serve.mjs) phục vụ giao diện Next.js. Mã dựng cảnh Three.js, dữ liệu mẫu và kịch bản nằm trong `src/office/`.

```sh
npm run lint
npm run typecheck
npm test
```

Kiểm tra giao diện bằng Playwright cần build trước và cài Chromium:

```sh
npm run build
npx playwright install chromium
npm run test:e2e -- tests/e2e/symphony.spec.ts
```

Chạy `npm run test:e2e` để kiểm tra toàn bộ giao diện. Khi cần sửa từng phần, xem [hướng dẫn đóng góp](CONTRIBUTING.md), [bản đồ kiến trúc](docs/ARCHITECTURE.md) và [các lệnh trong package.json](package.json).

## Giấy phép và ghi nhận

Mã nguồn theo [MIT](LICENSE), kế thừa dự án My Office của khanh020905. Ý tưởng từ agents-at-work, cubicle-crew và cc-reaper. Thư viện và tài nguyên giữ giấy phép riêng: Three.js và qrcode.js (MIT), Be Vietnam Pro và JetBrains Mono (SIL OFL), Simple Icons (CC0); nguồn mô hình xe và logo được ghi trong [tài nguyên xe](public/assets/vehicles/README.md) và [tài nguyên thương hiệu](public/assets/brands/README.md). Dự án không liên kết với Anthropic hay các thương hiệu được mô phỏng.
