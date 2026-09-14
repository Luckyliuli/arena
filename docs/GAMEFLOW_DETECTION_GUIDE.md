# 斗魂游戏阶段检测指南

主进程优先订阅 LCU WAMP 的 `/lol-gameflow/v1/gameflow-phase` 事件。连接断开、长时间没有事件或凭据变化时，回退到只读 HTTP 查询。斗魂身份由队列 ID `1700` 或 game mode `CHERRY` 确认。

`InProgress` 覆盖整场对局，不能说明当前正在采购。采购阶段必须由屏幕门禁和 OCR 产生带时效的视觉 signal。

## 状态与行为

| LCU phase | 行为 |
| --- | --- |
| `Lobby` / `Matchmaking` / `ReadyCheck` | 停止 gameflow 管理的截图，清理过期推荐 |
| `ChampSelect` | 读取斗魂身份和当前英雄，不运行采购阶段 OCR |
| `GameStart` | 清理上一场状态，准备进入对局 |
| `InProgress` | 运行门禁帧；确认候选后升级到完整 OCR |
| `WaitingForStats` / `PreEndOfGame` / `EndOfGame` | 停止截图并清理顶部强化符文推荐弹窗 |

斗魂会话 `status` 取值为 `unavailable`、`unknown`、`not-arena` 或 `arena`。已知非斗魂会话不能携带当前英雄。`shoppingPhase` 在没有新鲜视觉 signal 时为 `unknowable`。

## 实现位置

- LCU 读取与订阅：`src/main/services/lcu/`
- 斗魂会话观察：`src/main/services/arena-session/`
- gameflow 效果去重：`src/main/services/game-session/game-session-machine.ts`
- 自动截图运行时：`src/main/auto-screenshot-service.ts`
- 图像与 OCR：`src/main/image-analyzer.ts`
- 顶部窗口：`src/main/modules/window-manager.ts` 的 `/floating-overlay`

## 验证

```powershell
npm run test:unit -- tests/unit/arena-session-state.test.ts tests/unit/arena-shopping-phase-signal.test.ts
```

手工验证时观察大厅、选人、加载、对局和结算切换；确认只有斗魂 `InProgress` 启动自动截图，视觉 signal 过期后采购阶段回到 `unknowable`，离开对局后顶部窗口清空。
