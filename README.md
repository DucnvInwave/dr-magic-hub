# DR Magic Hub

Website tĩnh tập hợp tài liệu và liên kết làm việc của team DR theo 6 nhóm: Vận hành, Công việc, Developer, Game Designer, Artist và QC.

## Chạy local

Yêu cầu Node.js 18 trở lên. Không cần cài package hoặc chạy build.

```powershell
node serve.mjs
```

Mở `http://127.0.0.1:4173`. Có thể chọn cổng khác bằng cách truyền số cổng:

```powershell
node serve.mjs 8080
```

Không mở trực tiếp `index.html` bằng `file://`, vì trình duyệt sẽ chặn việc đọc `docs/DR-Documents.csv`.

## Cập nhật tài liệu

Chỉnh sửa `docs/DR-Documents.csv` với ba cột `Group,Tên,Link`. Các dòng để trống `Group` sẽ tự động thuộc nhóm gần nhất phía trên; dòng hoàn toàn trống sẽ được bỏ qua.

## Deploy

Deploy toàn bộ repository lên bất kỳ dịch vụ static hosting nào và đặt `index.html` làm entry point. Website không cần backend, framework hay bước build. Các file production chính gồm:

- `index.html`
- `styles.css`
- `script.js`
- `assets/icon.png`
- `docs/DR-Documents.csv`

`serve.mjs` chỉ hỗ trợ chạy thử local và không bắt buộc trên hosting.
