# DR Magic Hub

Website tĩnh tập hợp tài liệu và liên kết làm việc của team DR theo 6 nhóm: Vận hành, Công việc, Developer, Game Designer, Artist và QC.

## Chạy local

Project vẫn dùng HTML/CSS/JavaScript thuần. Vite chỉ làm dev server và đóng gói ES module của Three.js, không sử dụng React hay framework giao diện nào.

Yêu cầu Node.js 20.19+ hoặc 22.12+.

```powershell
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định `http://localhost:5173`).

## Build production

```powershell
npm run build
npm run preview
```

Thư mục deploy là `dist/`. Không mở trực tiếp `index.html` bằng `file://`, vì trình duyệt sẽ chặn ES module và việc đọc dữ liệu CSV.

## Nguồn dữ liệu

Website ưu tiên tải CSV từ Apps Script deployment:

`https://script.google.com/macros/s/AKfycbxvX0HRBZU4cEUmRbzBudCXrphisefKXTn58VTJbFlmeUYRTadwclH7yq63XGZg_UN9_w/exec`

Web App cần được deploy với quyền thực thi phù hợp và quyền truy cập **Anyone** để GitHub Pages có thể đọc dữ liệu mà không cần đăng nhập Workspace.

Apps Script đang đọc sheet `DR-Documents-Personal` trong Google Sheet có ID `11hk8kl_FETTGTl925f7QOlt0TA-mkEcQxWSGOvHyGPk`. Khi endpoint không truy cập được, website tự động dùng `datas/DR-Documents-Personal.csv` làm dữ liệu dự phòng.

CSV cần tối thiểu ba cột `Group,Tên,Link`. Các cột `DocumentOrder` và `Active` được dùng để sắp xếp, ẩn/hiện tài liệu. Các dòng để trống `Group` sẽ tự động thuộc nhóm gần nhất phía trên; dòng hoàn toàn trống sẽ được bỏ qua.

## Deploy

Chạy `npm run build`, sau đó deploy toàn bộ nội dung trong `dist/` lên bất kỳ dịch vụ static hosting nào. Website không cần backend hay framework chạy ở phía client.

Scene Three.js nằm riêng trong `three-scene.js`; nếu WebGL không khả dụng, giao diện tự động giữ lại mô hình CSS hiện có làm fallback.
