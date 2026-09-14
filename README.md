# 斗魂竞技场助手

面向 Windows 的《英雄联盟》斗魂竞技场桌面助手。它通过只读 LCU 状态和屏幕 OCR 判断采购阶段，识别左、中、右三个强化符文或棱彩装备候选，并显示顶部推荐弹窗。

> 本项目仅供本地个人使用。代码基线的来源与分发限制见 [ADR-0002](./docs/adr/0002-fork-baseline.md)。

## 当前能力

- 识别斗魂对局、当前英雄和采购阶段信号。
- 自动识别三个强化符文候选，保留游戏中的卡位顺序。
- 自动识别三个棱彩装备候选。
- 按英雄读取 OP.GG 统计并使用磁盘 cache，数据不可用时返回可诊断原因。
- 显示强化符文、英雄和组合榜。
- 按 `F8` 手动触发一次识别刷新。
- 支持简体中文、英文和繁体中文。

## 运行

环境要求：Windows x64、Node.js 22、npm 10。

```powershell
npm ci
npm run dev
```

首次构建若缺少客户端数据：

```powershell
npm run prepare:client-data
npm run build
```

## 验证

```powershell
npm run test:unit
npm run lint
npm run type-check
npm run build
```

涉及 OCR 时额外运行：

```powershell
npm run test:augment-ocr
```

## 文档入口

- [领域词表](./CONTEXT.md)
- [完整架构](./COMPLETE_ARCHITECTURE.md)
- [架构决策](./docs/adr/README.md)
- [使用指南](./docs/USER_GUIDE_AUTO_AUGMENT.md)
- [游戏阶段检测](./docs/GAMEFLOW_DETECTION_GUIDE.md)
- [LCU 排障](./docs/LCU_TROUBLESHOOTING.md)
- [当前状态](./docs/STATUS.md)
- [维护者文档索引](./docs/README.md)

仓库仍保留一部分 fork 基线的 ARAM implementation，供渐进迁移时参考；它不属于当前产品范围。新的功能、文档和测试应直接使用 [斗魂领域词表](./CONTEXT.md)。
