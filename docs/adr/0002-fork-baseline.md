# ADR-0002：以 aramgg 客户端作为本地基线

## Status

Accepted

## Context

项目复用 aramgg 客户端的 Electron、Vue、LCU、OCR 和打包基础。原仓库没有许可证文件，且 `package.json` 标记为 private。

## Decision

该 fork 仅供本地个人使用，不公开分发、不开源、不商用。需要公开时，先取得授权或替换所有来源不明的实现。

## Consequences

- 发布和分享需要重新评估来源授权。
- 数据、日志和配置使用本应用自己的可写目录。
- 斗魂业务可以复用客户端基础设施，但不沿用 ARAM 领域模型。

