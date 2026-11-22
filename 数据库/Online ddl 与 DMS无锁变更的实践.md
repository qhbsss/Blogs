---
title: "Online ddl 与 DMS无锁变更的实践"
source: "https://ata.atatech.org/articles/11020595613?spm=ata.23639746.0.0.4d63b945O17LSF"
author:
  - "[[李智超(驰晖)]]"
published:
created: 2026-11-21
description:
tags:
  - "clippings"
---
最近在做一些大表结构变更时，经常被问到若干问题：会不会锁表、过程有哪些风险、会影响哪些线上指标。

经过查阅 MySQL 5.6 官方文档（InnoDB and Online DDL），结合线上实践， 目前的经验是：

1. 优先使用 DMS 的无锁变更降低阻塞和不确定性，可以有效降低主从延迟。
2. 若无锁变更不支持，则确认该操作在 MySQL 5.6+ 是否属于原生 Online DDL， 尽可能使用online ddl执行。

本文基于这套原则整理常见操作的支持范围、风险点与落地建议，供后续参考。

---

## Online DDL 和DMS无锁变更

从一条SQL语句开始

```alter
ALTER TABLE `history_publish_exception_info`
    ADD COLUMN `publish_time` datetime NULL COMMENT '推流开始时间';
```

在 MySQL 5.6 之前，线上遇到“给大表加一列”这类操作时，基本是停机维护的状态：多数情况下它走的是“拷贝表（COPY）”——MySQL会创建一张临时表，把原表数据整表搬过去，再用临时表替换原表。这个过程中不可避免要持有更强的锁（表锁/元数据锁），表越大、拷贝越久，业务写入越容易被卡住，甚至读也可能受影响；随之而来的就是接口超时、阻塞、主从延迟飙升等一连串风险。

到了 MySQL 5.6引入Online DDL后，情况有了改善，很多常见的加列、加索引（MySQL 5.5时引入fast index creation特性支持原地增删索引）等DDL操作都可以原地执行，可以用 `ALGORITHM=INPLACE` 尽量在原表上完成，再配合 `LOCK` 子句控制并发级别，从而在 DDL 执行期间尽量保持表仍可读写，避免过去那种动辄把表“停摆几分钟甚至几小时”的情况。

不过，Online DDL 也不是“完全无锁”。即便过程中允许并发 DML，DDL 在开始阶段和最终提交表定义时仍会涉及 MDL（元数据锁）的切换；如果碰上长事务占着 MDL 不放，DDL 仍然可能等待，甚至连带把后续访问也阻塞住。

另外，哪怕业务不中断，执行期间的资源波动也很真实：CPU/IO 上升、以及主从复制延迟增加，都是需要提前评估和盯紧的指标。只不过这些影响相比“直接锁到业务不可用”，通常更可控、更可预期。

至于 DMS 的 [无锁变更](https://help.aliyun.com/zh/dms/lock-free-structure-change/) ，属于一类在线改表方案（Online Schema Change），不是 MySQL 内核原生 Online DDL。它通过“影子表 + 数据同步 + 切换”的方式完成结构替换：先创建与原表一致的临时表，在临时表上执行目标 DDL；随后将原表数据全量迁移到临时表，并持续订阅解析原表 binlog，把迁移期间产生的增量变更回放到临时表，直到数据追平；最后通过 `RENAME TABLE` 等方式进行原子切换，用临时表替换原表，并保留旧表作为备份。

DMS 无锁变更有两点主要优势，成为我们结构设计的首选。

1. 有些DDL操作原生不支持inplace方式，例如列的数据类型的变化，把主键从int到bigint就是不支持的，此时要么做好停机维护的准备，要么只能选择DMS无锁变更。
2. 能有效降低主从延迟，1千万的数据使用原生DDL，主从延迟会达到60s以上，对于某些业务风险还是很大的，而无锁变更带来的延迟可能只有几秒。

## DMS无锁变更的局限

1. 并非所有区域都支持无锁变更，不支持的区域使用无锁变更会提示主机网络延迟较大，无法执行任务。必须使用原生SQL语句执行结构设计。这个时候需要让DMS值班人员帮忙关掉无锁变更后再执行。
![](5866c49d-692e-49a0-bf3c-7a8747e106ae.png)
2. 对于某些情况，比如我们遇到的对于一个频繁更改唯一索引的情况，数据校验每次都会失败，无锁变更无法正常完成。
![](99370749-dd8a-4369-988c-4e10be264b82.png)
3. 其他问题可以参考： [https://help.aliyun.com/zh/dms/lock-free-structure-change-faq](https://help.aliyun.com/zh/dms/lock-free-structure-change-faq) 总之，需要通过选择业务低峰期、降低数据量、减少操作难度等方式符合DMS无锁变更“在线数据复制与回放”的特性。

## DMS无锁变更不给用，怎么办

![](c69a0e73-46ed-4ce3-b4a2-1ae39be5555b.png)

## 最直接的方法当然是解决DMS无锁变更遇到的问题。

在2.2 我们遇到的问题中， DMS的同学根据错误信息帮我们识别到主要是新增数据中，存在对唯一索引同一个UK的并发修改，由于replace原表数据乱序导致不满足数据最终一致性。解决方案是发现客户每次会重复调用两次黑名单接口，导致有并发修改，更改业务逻辑后成功完成变更。

## 那么不适用无锁变更，什么SQL是可以放心执行的呢

Mysql 5.6 [文档](https://downloads.mysql.com/docs/refman-5.5-en.pdf) 的（14.13 InnoDB and Online DDL） 一节详细介绍了支持的online ddl 的 种类，对于各种操作有不同的限制，比如加索引比较安全，加一列可能数据会延迟写入等等，需要仔细查阅。而且独占元数据锁、CPU/IO 上升、以及主从复制延迟增加这种问题是无法避免的，带来的业务影响仍然需要仔细评估。

完整的DDL SQL大概这样：

```alter
ALTER TABLE tbl_name
  ADD COLUMN new_col INT NULL COMMENT '示例列',
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

ALGORITHM 支持 INPLACE 和 COPY，INPlACE就是运行中不锁表的形式，COPY就会到了MYSQL 5.5之前锁表的方式。

LOCK语句则是对锁级别的描述，MySQL 在执行 DDL 时会尽量使用最少的锁。如果需要更严格的锁定级别，可以在 `ALTER TABLE` 末尾指定 `LOCK` 子句。如果指定的LOCK级别低于SQL要求的级别，会直接报错。

| LOCK 选项 | 含义（并发能力） | 文档中的使用建议 |
| --- | --- | --- |
| `LOCK=NONE` | 允许并发查询和并发 DML | 适用于用户注册、下单等不能长时间不可写的表，避免在耗时 DDL 期间让表不可用。 |
| `LOCK=SHARED` | 允许并发查询，但阻塞 DML | 适用于数仓类表：可以延后数据装载（写入），但查询不能长时间中断。 |
| `LOCK=DEFAULT` | 尽可能允许最大并发（查询、DML 或两者）；省略 `LOCK` 等同于 `LOCK=DEFAULT` | 当你确认该 DDL 的默认锁级别不会带来可用性问题时使用。 |
| `LOCK=EXCLUSIVE` | 阻塞并发查询和并发 DML | 适用于最关心“尽快完成 DDL”，且不需要并发访问的场景；也可用于预计服务器空闲时，避免意外访问。 |

详细的SQL支持情况如下（感谢gpt-5.2-1211-global的倾力总结）

### 索引操作 (Index Operations)

| 操作 | 原地执行（In Place） | 重建表（Rebuilds Table） | 允许并发 DML（Permits Concurrent DML） | 仅修改元数据（Only Modifies Metadata） | 条件与例外 |
| --- | --- | --- | --- | --- | --- |
| 创建或新增二级索引（secondary index） | 是 | 否 | 是 | 否 | 无 |
| 删除索引（Dropping an index） | 是 | 否 | 是 | 是 | 无 |
| 新增 FULLTEXT 索引（Adding a FULLTEXT index） | 是\* | 否\* | 否 | 否 | 第一个 FULLTEXT 索引：如果没有用户自定义 `FTS_DOC_ID` 列，则会重建表；后续 FULLTEXT 索引可能不需要重建表。 |
| 修改索引类型（Changing the index type） | 是 | 否 | 是 | 是 | 无 |

### 主键操作 (Primary Key Operations)

| 操作 | 原地执行（In Place） | 重建表（Rebuilds Table） | 允许并发 DML（Permits Concurrent DML） | 仅修改元数据（Only Modifies Metadata） | 条件与例外 |
| --- | --- | --- | --- | --- | --- |
| 新增主键（Adding a primary key） | 是\* | 是\* | 是 | 否 | 若需要将列转换为 `NOT NULL`，在某些条件下不允许 `ALGORITHM=INPLACE`。另外，使用 `ALGORITHM=INPLACE` 增加主键仅在 `SQL_MODE` 包含 `strict_trans_tables` 或 `strict_all_tables` 时允许；即使是 strict 模式，如果主键列包含 `NULL` 值仍可能失败。 |
| 删除主键（Dropping a primary key） | 否 | 是 | 否 | 否 | 仅 `ALGORITHM=COPY` 支持“只删除主键且不同时新增新主键”。 |
| 删除主键并新增另一个（Dropping a primary key and adding another） | 是 | 是 | 是 | 否 | 无 |

### 列操作 (Column Operations)

| 操作 | 原地执行（In Place） | 重建表（Rebuilds Table） | 允许并发 DML（Permits Concurrent DML） | 仅修改元数据（Only Modifies Metadata） | 条件与例外 |
| --- | --- | --- | --- | --- | --- |
| 新增列（Adding a column） | 是 | 是 | 是\* | 否 | 新增 `auto_increment` 列时不允许并发 DML；至少需要 `ALGORITHM=INPLACE, LOCK=SHARED`。 |
| 删除列（Dropping a column） | 是 | 是 | 是 | 否 | 无 |
| 重命名列（Renaming a column） | 是 | 否 | 是\* | 是 | 为允许并发 DML，需要保持相同数据类型，仅修改列名；重命名参与外键的列只在 `ALGORITHM=INPLACE` 下可用，如果使用 `ALGORITHM=COPY`（或因其他条件导致使用 COPY），语句会失败。 |
| 调整列顺序（Reordering columns） | 是 | 是 | 是 | 否 | 无 |
| 设置列默认值（Setting a column default value） | 是 | 否 | 是 | 是 | 只修改表元数据；默认值存储在表的 `.frm` 文件中，不在 InnoDB 数据字典中。 |
| 修改列数据类型（Changing the column data type） | 否 | 是 | 否 | 否 | 仅支持 `ALGORITHM=COPY`。 |
| 删除列默认值（Dropping the column default value） | 是 | 否 | 是 | 是 | 无 |
| 修改 auto-increment 值（Changing the auto-increment value） | 是 | 否 | 是 | 否\* | 修改的是内存中的值，不是数据文件。 |
| 将列改为 NULL（Making a column NULL） | 是 | 是\* | 是 | 否 | “原地重建表（in place rebuild）”。 |
| 将列改为 NOT NULL（Making a column NOT NULL） | 是\* | 是\* | 是 | 否 | “原地重建表（in place rebuild）”；需要 `STRICT_ALL_TABLES` 或 `STRICT_TRANS_TABLES`；如果列包含 `NULL` 值会失败；服务器禁止对外键列做可能导致参照完整性丢失的更改。 |
| 修改 ENUM/SET 列定义（Modifying the definition of an ENUM or SET column） | 是 | 否 | 是 | 是 | 仅当在枚举/集合值列表末尾追加新成员且数据类型存储大小不变时，可原地执行；若导致存储大小变化（例如 SET 成员从 8 个变 9 个导致每值存储从 1 字节变 2 字节）则需要表拷贝；在列表中间插入成员会导致既有成员重新编号，也需要表拷贝。 |

### 外键操作 (Foreign Key Operations)

| 操作 | 原地执行（In Place） | 重建表（Rebuilds Table） | 允许并发 DML（Permits Concurrent DML） | 仅修改元数据（Only Modifies Metadata） | 条件与例外 |
| --- | --- | --- | --- | --- | --- |
| 新增外键约束（Adding a foreign key constraint） | 是\* | 否 | 是 | 是 | 当 `foreign_key_checks` 关闭时支持 INPLACE；否则仅支持 COPY。 |
| 删除外键约束（Dropping a foreign key constraint） | 是 | 否 | 是 | 是 | `foreign_key_checks` 开启或关闭都可以在线执行。 |

### 表级操作 (Table Operations)

| 操作 | 原地执行（In Place） | 重建表（Rebuilds Table） | 允许并发 DML（Permits Concurrent DML） | 仅修改元数据（Only Modifies Metadata） | 条件与例外 |
| --- | --- | --- | --- | --- | --- |
| 修改 ROW\_FORMAT（Changing the ROW\_FORMAT） | 是 | 是 | 是 | 否 | 无 |
| 修改 KEY\_BLOCK\_SIZE（Changing the KEY\_BLOCK\_SIZE） | 是 | 是 | 是 | 否 | 无 |
| 设置持久化表统计信息（Setting persistent table statistics） | 是 | 否 | 是 | 是 | 无 |
| 指定字符集（Specifying a character set） | 是 | 是\* | 否 | 否 | 当新的字符编码不同，会重建表。 |
| 转换字符集（Converting a character set） | 否 | 是 | 否 | 否 | 仅支持 `ALGORITHM=COPY`。 |
| 优化表（Optimizing a table） | 是\* | 是 | 是 | 否 | 从 MySQL 5.6.17 起原地执行；对含 FULLTEXT 索引的表不支持原地执行；该操作使用 INPLACE 算法，但不允许写 `ALGORITHM` 和 `LOCK` 语法。 |
| 使用 FORCE 选项重建（Rebuilding with the FORCE option） | 是\* | 是 | 是 | 否 | 从 MySQL 5.6.17 起使用 `ALGORITHM=INPLACE`；含 FULLTEXT 索引的表不支持 `ALGORITHM=INPLACE`。 |
| 执行“空重建”（Performing a null rebuild） | 是\* | 是 | 是 | 否 | 从 MySQL 5.6.17 起使用 `ALGORITHM=INPLACE`；含 FULLTEXT 索引的表不支持 `ALGORITHM=INPLACE`。 |
| 重命名表（Renaming a table） | 是 | 否 | 是 | 是 | 无 |

### 分区操作 (Partitioning Operations)

| 场景/操作（来自文档描述） | 在线 DDL 情况（中文概括） | 是否支持 ALGORITHM/LOCK | 条件与例外 |
| --- | --- | --- | --- |
| 分区 InnoDB 表的在线 DDL（不涉及 `ALTER TABLE` 分区子句） | 遵循与普通 InnoDB 表相同的在线 DDL 规则；对每个分区分别执行该 `ALTER TABLE` 支持的 INPLACE 操作 | 支持（同普通表规则） | 当对每个分区执行 INPLACE 操作时，由于要对多个分区分别操作，会增加系统资源消耗（increased demand on system resources）。 |
| `ALTER TABLE` 使用分区子句（partitioning clauses）修改分区定义 | 不走常规 online DDL API；通常使用 `ALTER TABLE COPY` 方式重新分区 | 大多数不支持 | 会创建一个采用新分区方案的新分区表；新表包含该 `ALTER TABLE` 的所有变更；数据被拷贝到新表结构中。 |
| RANGE 或 LIST 分区表：`ADD PARTITION` / `DROP PARTITION` | 不拷贝已有数据（do not copy existing data） | 文档未说明 | 属于 MySQL 在分区子句不走 online DDL API 的情况下，仍尽量减少拷贝/锁的特例优化。 |
| 任意分区表：`TRUNCATE PARTITION` | 不拷贝已有数据（does not copy existing data） | 文档未说明 | 同上，属于减少拷贝/锁的特例优化。 |
| HASH 或 LIST 分区表：`ADD PARTITION` / `COALESCE PARTITION` | 允许并发查询（concurrent queries are allowed）；拷贝数据时持有共享锁（shared lock） | 文档未说明 | 拷贝数据期间加共享锁，因此只保证并发查询（文档未声明并发 DML）。 |
| LINEAR HASH 或 LIST 分区表：`REORGANIZE PARTITION` / `REBUILD PARTITION`，以及 `ADD PARTITION` / `COALESCE PARTITION` | 允许并发查询；从受影响分区拷贝数据时，对表持有共享元数据（读）锁（shared metadata (read) lock） | 文档未说明 | 拷贝发生在“受影响分区”；锁为共享 MDL（读锁）。 |
| `PARTITION BY` / `REMOVE PARTITIONING` | 允许并发查询（permit concurrent queries） | 文档未说明 | 文档只明确“允许并发查询”。 |
| 改变表分区的 `ALTER TABLE`（change a table’s partitioning） | 不能使用 `ALGORITHM` 的 `DEFAULT/COPY/INPLACE`；也不支持 `LOCK` 子句 | 不支持（DEFAULT/COPY/INPLACE；LOCK 也不支持） | MySQL 5.6.11 及以后，在升级/降级时可使用 `ALGORITHM=1` 或 `ALGORITHM=2`。 |

## 总结

解决所有问题的方法是一开始就把表设计的天衣无缝、完美无暇。

否则变更时只能根据各种文档劝慰自己: 这么操作数据库一定没事哒！

中