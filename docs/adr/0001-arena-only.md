# ADR-0001：只支持斗魂竞技场

## Status

Accepted

## Context

斗魂竞技场以 8 支两人队伍、多个回合和最终名次为核心；ARAM 以单局胜负为核心。两者只共享 Electron、LCU 和截图等客户端基础设施，业务模型不共享。

## Decision

产品只支持斗魂竞技场，不建立多模式领域抽象。fork 基线中暂未清除的 ARAM implementation 属于遗留代码，不代表当前产品能力。

## Consequences

- 当前文档、入口和新功能只使用斗魂领域语言。
- 新模块直接表达斗魂概念。
- 遗留 ARAM implementation 可分批移除，但移除不得阻塞斗魂功能维护。

