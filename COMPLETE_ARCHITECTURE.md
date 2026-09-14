# 斗魂竞技场助手架构

本文件描述当前实现。产品范围和术语以 [CONTEXT.md](./CONTEXT.md) 为准；难以逆转的取舍以 [ADR](./docs/adr/README.md) 为准。

## 运行结构

```text
League Client / Game window
  ├─ read-only LCU → 斗魂身份、当前英雄、gameflow
  └─ screenshot → visual gate → PaddleOCR → 左/中/右候选
                                      ↓
                         斗魂推荐数据 interface
                         ├─ OP.GG adapter + disk cache
                         └─ CommunityDragon 基础字典
                                      ↓
                         顶部强化符文推荐弹窗
```

Electron main process 负责 LCU、截图、OCR、数据 adapter、窗口和 IPC。preload 只暴露 `src/shared/ipc-contract.ts` 中声明的能力。Vue renderer 不直接访问 Node.js。

## 主要模块

| 责任 | 位置 |
| --- | --- |
| 进程入口与生命周期 | `src/main/index.ts`、`src/main/modules/app-config.ts` |
| 窗口创建与布局 | `src/main/modules/window-manager.ts` |
| 自动截图运行时 | `src/main/auto-screenshot-service.ts` |
| 图像与 OCR 分析 | `src/main/image-analyzer.ts` |
| 斗魂会话观察 | `src/main/services/arena-session/` |
| 斗魂推荐数据 | `src/main/services/arena-augment-data/` |
| LCU 读取 | `src/main/services/lcu/` |
| IPC 契约 | `src/shared/ipc-contract.ts` |
| preload adapter | `src/preload/preload.ts` |
| Vue 界面 | `src/renderer/` |

## 斗魂会话

队列 ID `1700` 或 game mode `CHERRY` 表示斗魂对局。LCU 的 `InProgress` 不能说明当前正在采购；采购阶段由视觉门禁产生带时效的 signal，再与 LCU 快照合成会话观察结果。已知非斗魂会话不得携带英雄状态。

## 识别运行时

正常运行先捕获小尺寸门禁帧，连续出现候选特征后升级为完整 OCR 帧。OCR 队列串行消费，繁忙时只保留最新帧。首次显示要求完整三个卡位；切换动画的瞬时 miss 可以保留上一轮完整结果，连续 miss 后清空。

PaddleOCR Node adapter 和 ONNX 模型位于 `resources/paddleocr`。识别始终保持左、中、右卡位，读不到的卡位为空，不使用会改变顺序的宽区域补齐。

## 推荐数据

OP.GG 页面获取、RSC 解析、字段映射和失败分类都位于数据 adapter 后。运行时按英雄读取并写入应用数据目录的 cache；同一进程复用数据源实例。CommunityDragon 字典提供稳定的 ID、名称、位阶和图标。

OP.GG 的 `win_rate` 是第三方字段，项目没有证据将其定义为平均名次或第一名率。它可以参与推荐度计算和诊断，但玩家界面必须带 OP.GG 来源及口径说明，不能简称为本项目的“胜率”。

## 窗口与安全

强化符文推荐弹窗是透明、无边框、置顶且不抢焦点的顶部三卡窗口。它只保证在无边框窗口化全屏下可见。项目不注入游戏进程。

renderer 发起的 IPC 通过 `src/main/security/trusted-ipc.ts` 验证所属窗口、顶层 frame 和本地 renderer origin。`contextIsolation`、sandbox、`webSecurity` 和导航阻断保持开启。renderer 可写 preference 必须在 main process allowlist 中声明。

## 数据与本地文件

electron-store、日志、cache 和 OCR 调试截图统一经过 `src/main/modules/app-paths.ts`。打包资源保持只读。客户端数据按 locale 隔离；完整的随包或 cache 数据优先渲染，远端检查在后台进行，只有完整版本才能激活。

## 遗留范围

fork 基线中仍存在 ARAM 选人、战绩和旧推荐窗口 implementation。它们不是当前产品能力。修改这些路径时先确认是否能删除；若暂时保留，只修安全和构建问题，不为其增加新功能或新抽象。

## 发布门槛

提交前运行 `npm run test:unit`、`npm run lint`、`npm run type-check` 和 `npm run build`。Windows 安装包在上传前还必须运行 `npm run test:packaged-windows`。发布受 [ADR-0002](./docs/adr/0002-fork-baseline.md) 的来源授权限制。
