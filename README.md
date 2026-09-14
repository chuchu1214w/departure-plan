# 出发前的六个月

赴美前的月度计划、待办清单与打工存钱进度。单文件 HTML，纯前端，无需构建。

**在线地址：** https://chuchu1214w.github.io/departure-plan/

手机浏览器打开后可以「添加到主屏幕」，会以独立图标启动，接近原生 app 的体验。

## 本地开发

```bash
python3 -m http.server 8000
```

打开 `http://localhost:8000/`。

## 部署

推到 `main` 分支即自动通过 GitHub Pages 重新发布，约 1 分钟生效：

```bash
git add -A
git commit -m "说明这次改了什么"
git push
```

## 数据存储

待办勾选和打工收入存在浏览器的 `localStorage` 里，按设备保存，不跨设备同步。
清除浏览器数据或换设备会丢失记录。
