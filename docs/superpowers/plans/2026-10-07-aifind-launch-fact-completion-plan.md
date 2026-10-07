# Launch Fact Completion Sweep

用户范围为已存在的正常 Release Candidate `http://localhost:4000/`，不是新 Phase。沿用现有 Product Domain、Published Reader、管理员审核动作与发布包，不创建 Preview、Catalog 扩容或生产部署。用户附件是本次设计及实施授权；不另行设计架构。

1. 保存当前 working tree 的逐文件字节、Git index/HEAD/.env/已发布 migration 哈希、候选库 Product/Editorial 快照和三个旧冻结包哈希。旧工作及冻结证据保持原样。
2. 对固定 12 个产品主动检索官方产品、日本语、价格、帮助、国家、语言、下载及发布公告。按现有受控字段录入事实；每个仍 unknown 的字段记录来源、检查时间及原因。价格保留原币种、计费期间及限定条件；试用独立于永久免费。
3. 先通过真实读取及渲染测试复现首页缺少核心事实 Gate、试用与免费区分、未知平台主视图噪声及残留 unknown 缺少审核理由。做最小门槛和显示修正，不改变 Domain schema，不放宽 Phase 8.5 Evidence 值绑定。
4. 更新 SSOT corpus 为 revision 3。使用明确 Published 基版本创建新 Draft，审计更新及授权发布；保留旧版本事实。逐篇检查并更新 6 个 Editorial 的引用 revision，保持真实官方来源方式。
5. 重新运行 typecheck、Web build、完整数据库测试、Web tests、site/content smoke 和正常网站真实 Chrome。逐项对照 Phase 8.5 测试名称/状态/SKIP 理由。创建新的本地备份恢复证据及冻结包；保留旧包。
6. 执行一次新鲜的独立最终审核，修复实际发现后完成报告、12 行事实矩阵和全部 remaining unknown 清单。只有所有条件满足才标记 Launch Fact Completeness Gate READY。结束后停止。

安全边界：只访问本机 `aifind_phase85_28f87d2e_launch_candidate_test`；测试使用独立本机 55433 的 `aifind_fact_36c9af37_test`。Preview、采集、真实模型、Detector、Feishu、IndexNow 关闭，浏览器验收仅访问本机。官方资料由阅读工具检索，不由 worker 采集。

事实审核元数据可以附加在现有 dossier，不进入 Product schema。首页 Free 状态必须绑定当前 Published 的真实 Plan/Price 投影，不能将尚未发布 corpus 中的 Draft 事实提前显示。测试应抓住缺失审核/错误来源、价格试用误判及 Published/Draft 混用，不测试源代码文本。

执行中的修正：第一次独立最终审核发现四项 Important，按同一次修复流程通过 RED→GREEN 完成。Pack 从 revision 3 增至 4：补 Firefly 首年优惠条款和 creative Agent/素材搜索边界、ElevenLabs 精确年付价格，并要求 Fact Gate 同时通过来源及最低内容数量检查。Chrome 人工检查又发现 Pro Plus 的标准价格行保留了旧的“条件未确认”说明；先复现 FC07，再最小修正说明及其 Evidence 值绑定，Pack 增至 revision 5，Firefly 使用明确 v3 基版本发布 v4。没有新增 Product 业务、schema 或 Preview。

最终全套曾因本轮定向测试未启用数据库隔离而污染模板出现 23 FAIL，已保留失败日志、逐项归类及根因证据。九个相关文件按项目隔离方式连续两次 52/52 PASS，全套干净模板 1152 PASS/8 原有 SKIP。最终验收使用另一个独立的 `aifind_fact_final_36c9af37_test`，避免与先前套件的清理过程共用模板；最终结果以报告和 `final-accepted-baseline.json` 的实际新执行为准。
