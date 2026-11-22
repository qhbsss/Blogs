---
title: "中间件学习系列-TDDL源码解读"
source: "https://ata.atatech.org/articles/11000099338?spm=ata.23639746.0.0.1208f7d3CtHp5u"
author:
  - "[[芦阳]]"
published:
created: 2026-10-15
description:
tags:
  - "clippings"
---
## 写在前面

本文的目的是让读者深入TDDL的细节及源码。  
如读者想首先对TDDL有一个概览，迅速了解如何使用，可以看我的另一篇文章。  
[中间件学习系列-TDDL全局概览](https://www.atatech.org/articles/99342)

## 1\. TDDL的主要组成

Matrix: SQL解释、优化和执行  
Group: 主备切换、读写分离  
Atom: 链接管理

## 包结构

tddl-atom-datasource  
tddl-client  
tddl-common  
tddl-docs  
tddl-druid-datasource  
tddl-group-datasource  
tddl-integration-test  
tddl-interact  
tddl-mysql-parser  
tddl-parser  
tddl-qatest  
tddl-route-datasource  
tddl-rule  
tddl-rule-le  
tddl\_sample

## 源码逻辑概述

tddl\_sample 里有主流程的例子，是一个很好的切入点。

## 1\. matrix（TDataSource初始化）

```
1.1 如果tddl-rule文件存在，解析规则
1.2 如果不使用本地tddl-rule配置，如果dynamicRule为false，订阅分库分表规则；
    1.2.1 从diamond获取rule配置
        1.2.1.1 从diamond获取rule配置，放到mbean中。

1.3 如果dynamicRule为true，则在diamond订阅分库分表规则，并且监听变化
    1.3.1 根据固定规则获取dataId,根据dataId去diamond拉取rule配置数据
        1.3.1.1 获取rule配置的处理器
            1.3.1.1.1 根据dataId去diamond拉取rule配置数据
            1.3.1.1.2 对dataId加监听器
        1.3.1.2 根据dataId去diamond拉取rule配置数据

1.4 初始化配置工程，批量获取配置
    1.4.1 批量获取DBGroup、SqlExecutor配置

1.5 初始化DataSource Map
1.6 初始化各个管线，matrix层的能力以handler的方式提供扩展
    1.6.1 实例化 pipelineFactory， pipelineFactory包含一组pipeline
        1.6.1.1 初始化各个管线，实现表名解析、拿到真实库和真实表、sql解析、资源结果校验、生成最终的执行计划、批量逻辑等
1.7 已经使用过的配置移除
```

## 2.tddl-rule

```
2.1 初始化tableSlotMap
2.2 对库rules进行参数替换
2.3 对表rules进行参数替换
2.4 对库rules进行转化并set
2.5 对表rules进行转化并set
2.6 初始化实际拓扑结构
    2.6.1 actualTopology 是 Map<String, Set<String>> 结构。这里对四种情况分别进行判断。
如果库表规则都没有；如果有表规则，没有库规则；如果有库规则，没有表规则；如果有库表规则；
    2.6.2 展示拓扑结构，debug情况下输出到日志
```

## 3.group(TGroupDataSource)

```
3.1 根据APPNAME去diamond获取全局配置
    3.1.1 根据APPNAME去diamond获取全局配置
        3.1.1.1 根据APPNAME去diamond获取全局配置

3.2 根据APPNAME去diamond获取额外配置
3.3 监听额外配置
3.4 解析额外配置
    3.4.1 针对额外配置中返回的json，如果有“sqlForbid”、“sqlDsIndex”、“tabDsIndex”、“defaultMain” ，配置groupExtraConfig
3.5 解析全局配置
    3.5.1 解析读写、权重配置，比如“db0:rwp1q1i0,db1:rwp0q0i1”。
    3.5.2 用线程池并行提交构建DataSourceWrapper的task
    3.5.3 从future中取出DataSourceWrapper
3.6 将封装好的AtomDataSource的列表，进一步封装为可以根据权重优先级随机选择模板库的DBSelector
    3.6.1 将DataSourceWrapper封装成DBSelector
    3.6.2 如果只有一个db，则封装成OneDBSelector
    3.6.3 如果不止一个db，则封装成读写优先级的DBSelector
3.7 监听全局配置
```

## 4.atom（TAtomDataSource）

```
4.1 计算dbName
4.2 取出TAtomDsConfHandle对象（管理动态数据源）
4.3 如果TAtomDsConfHandle对象为空，初始化config的管理器
    4.3.1 初始化参数检查
    4.3.2 配置dbConfManager 初始化dbConfManager
    4.3.3 获取全局配置 注册全局配置监听
        4.3.3.1 如果是全局配置发生变化，可能是IP,PORT,DBNAME,DBTYPE,STATUS
        4.3.3.2 用推送的配置，覆盖当前的配置
        4.3.3.3 本地配置依然优先
        4.3.3.4 如果推送过来的数据库状态是 RW/R->NA,直接销毁掉数据源，以下业务逻辑不做处理
        4.3.3.5 如果推送的状态时 NA->RW/R 时需要重新创建数据源，无需再刷新（创建数据源可参考4.3.10）
        4.3.3.6 如果发生的配置变化是否需要重建数据源并更新（配置变化指IP、port、dbname、dbtype）
        4.3.3.7 处理数据库状态监听器
        4.3.3.8 用新的配置覆盖运行时的配置
    4.3.4 获取应用配置 注册应用配置监听
        4.3.4.1 解析diamond返回的data
        4.3.4.2 配置的覆盖（参考4.3.5）
        4.3.4.3 处理本地优先配置
        4.3.4.4 转换tAtomDsConfDO成为localTxDataSourceDO（参考4.3.8）
        4.3.4.5 判断是否需要重建连接（在driverClass、minPoolSize、maxPoolSize、blockingTimeout、idleTimeout、preparedStatementCacheSize改变的情况下需要重建连接）。如果需要，则重建（参考4.3.10）
        4.3.4.6 判断是否需要刷新链接（在userName、passwd改变的情况下需要刷新连接）如果需要，则刷新
        4.3.4.7 阀值变化无需刷新持有的数据源，只要更新runTimeConf，并且清空wrapDataSource。（在readRestrictTimes、writeRestrictTimes、threadCountRestrict、timeSliceInMillis、应用连接过程中的连接数限制改变的情况下执行此条）
    4.3.5 解析配置string成TAtomDsConfDO
        4.3.5.1 解析全局配置和应用配置

    4.3.6 处理本地优先配置
    4.3.7 如果没有设置本地密码，则用订的密码，初始化passwdManager
    4.3.8 转换tAtomDsConfDO
        4.3.8.1 转换tAtomDsConfDO

    4.3.9 参数检查如果参数不正确直接抛出异常
    4.3.10 创建数据源
        4.3.10.1 创建数据源（TaobaoDataSource）

    4.3.11 将创建好的数据源是指到TAtomDatasource中

4.4 如果TAtomDsConfHandle对象不为空，使用
```

## 源码深入研读

## 1\. matrix（TDataSource初始化）

BaseCrudSampleDao（1. 经过TDDL解析器，2. 规则引擎，9. 合并结果3个步骤的标准流程。）

```
<beans>
    <bean id="master_tddl_ds" class="com.taobao.tddl.client.jdbc.TDataSource" init-method="init">
        <property name="appRuleFile" value="classpath:rule/tddl-rule.xml"/>
        <property name="appName" value="tddl_sample"/>
        <property name="useLocalConfig" value="true"/>
    </bean>
    <bean id="tddlDS" class="org.springframework.jdbc.core.JdbcTemplate">
        <property name="dataSource"><ref bean="master_tddl_ds"/></property>
    </bean>
</beans>
```

TDataSource 这个DataSource是入口。  
appRuleFile 是分库分表的规则  
appName通过diamond获取启动连接参数

```
TDataSource

    public void init() {
        state = new TDataSourceState(getAppName());
        super.init();
        
//        //试点去掉行复制，start by v3.4 20140321
//        initReplication();
    }
```

```
TDataSourceConfig（TDataSource的配置类，专门放置TDataSource的配置处理代码，为简化配置服务）

/**
     * 可以供Spring使用。如果业务绕开spring直接使用，必需先set所有需注入属性，再调用init
     * 如果使用Properties方式初始化，默认只支持1份配置文件，即appRuleFiles[0]
     */
    public void init() {
        if (appRuleFiles != null) {
            this.isUseLocalConfig = true;
            // 使用外部 springContext 解析配置文件路径
            appRuleFiles = doExternalResolve(appRuleFiles);
            if (appRuleFiles[0] != null
                    && appRuleFiles[0].indexOf(".xml") != -1) {
                initBySpringBaseAppRuleFile(appRuleFiles);
            } else if (appRuleFiles[0] != null
                    && appRuleFiles[0].indexOf(".properties") != -1) {
                initByPropertyBaseAppRuleFile(appRuleFiles[0]);
            } else {
                throw new IllegalArgumentException(
                        "appRuleFile属性为空或者不支持的规则文件类型");
            }
        } else if (appRuleString != null) {
            this.isUseLocalConfig = true;
            initByXmlBaseAppRuleString(appRuleString);
        } else if (appRulePropertiesString != null) {
            this.isUseLocalConfig = true;
            // 字符串形式现在只支持properties配置文件
            initByPropertyBaseAppRuleString(appRulePropertiesString);
        } else if (!isUseLocalConfig) {
            // 订阅分库分表规则
            if (!dynamicRule) {
                // 订阅分库分表规则
                Object firstFetchedShardRule = ConfigServerHelper
                        .subscribeShardRuleConfig(appName, shardRuleListener);
                if (firstFetchedShardRule == null) {
                    throw new IllegalStateException("没有接收到分库分表规则配置");
                }
            } else {
                if (tddlRule == null) {
                    tddlRule = new TddlRuleInner();
                    tddlRule.setAppName(appName);
                    tddlRule.addRuleChangeListener(this);
                    tddlRule.setNeedDbTabStat(needDbTabStat);
                    tddlRule.setUnitName(unitName);
                    tddlRule.init();                }

                for (RuleChangeListener listener : this.outListeners) {
                    tddlRule.addRuleChangeListener(listener);
                }
                String tddlRuleStr = RuleLeBeanConvert
                        .convertLeAndOriRuleStr2InteractRule(tddlRule
                                .getOldRuleStr());
                this.initByXmlBaseAppRuleString(tddlRuleStr);
            }
        }
        

        //初始化配置工程，批量获取配置。
        initConfigHoderFactory();
        
        initDSMap();
        initPipeline();
        
        //已经使用过的配置移除
        destoryConfigHoderFactory();

        statMonitor.setAppName(appName);
        statMonitor.setNeedDbTabStat(needDbTabStat);
        statMonitor.start();
    }
```

1.1 如果tddl-rule文件存在，解析规则  
1.2 如果不使用本地tddl-rule配置，如果dynamicRule为false，订阅分库分表规则；  
1.3 如果dynamicRule为true，则在diamond订阅分库分表规则，并且监听变化  
1.4 初始化配置工程，批量获取配置  
1.5 初始化DataSource Map  
1.6 初始化各个管线，matrix层的能力以handler的方式提供扩展  
1.7 已经使用过的配置移除

一路下钻

```
ConfigServerHelper（订阅持久化数据的辅助类）

public static Object subscribePersistentData(String appName, String subscriberName, String dataId, final DataListener listener) {
        cdhf = ConfigDataHandlerCity.getFactory(appName);
        ConfigDataHandler matrixHandler = cdhf.getConfigDataHandler(dataId, null);
        String datas = matrixHandler.getNullableData(DIAMOND_FIRST_DATA_TIMEOUT, ConfigDataHandler.FIRST_SERVER_STRATEGY); //取配置信息的默认超时时间为30秒

        //尝试去拿最新的本地数据
        log.warn(dataId + "'s firstData=" + datas);
        if (datas != null) {
            try {
                listener.onDataReceiveAtRegister(datas);
            } catch (Throwable t) {
                //保证即使首次处理dataId发生异常，listener也一样会被注册，业务仍然能收到后续推送
                log.error("onDataReceiveAtRegister抛出异常，dataId:" + dataId, t);
            }
        }
        matrixHandler.addListener(new ConfigDataListener() {
            @Override
            public void onDataRecieved(String dataId, String data) {
                log.info("recieve data,data id:"+dataId+" data:"+data);
                listener.onDataReceive(data);
            }
        },null);

        return datas;
    }
```

1.2.1 从diamond获取rule配置

```
DiamondConfigDataHandler（持久配置中心diamond实现）

public String getData(long timeout, String strategy) {
        String data = null;
        try {
            data = env.getConfig(dataId, null,
                    Constants.GETCONFIG_LOCAL_SERVER_SNAPSHOT, timeout);
        } catch (IOException e) {
            throw new RuntimeException("get diamond data error!dataId:"
                    + dataId, e);
        }

        if (data != null) {
            mbean.setAttribute(dataId, data);
        } else {
            mbean.setAttribute(dataId, "");
        }

        return data;
    }
```

1.2.1.1 从diamond获取rule配置，放到mbean中。

```
TddlRuleConfig 

public void init() {

        ...
        
        } else if (appName != null) {
            // String versionsDataId = new MessageFormat(
            // TDDL_RULE_LE_VERSIONS_FORMAT)
            // .format(new Object[] { appName });
            String versionsDataId = TddlRuleConfig.getVersionsDataId(appName);
            cdhf = new DefaultConfigDataHandlerFactory();
            versionHandler = cdhf.getConfigDataHandler(versionsDataId,
                    new VersionsConfigListener(),unitName);
            String versionData = versionHandler.getData(10 * 1000,
                    ConfigDataHandler.FIRST_SERVER_STRATEGY);

            if (versionData == null) {
                // String dataId = TDDL_RULE_LE_PREFIX + appName;
                String dataId = TddlRuleConfig
                        .getNonversionedRuledataId(versionData);
                if (!ruleDataSub(dataId, NONE_RULE_VERSION,
                        new SingleRuleConfigListener())) {
                    throw new RuntimeException(
                            "subscribe the rule data or init rule error!check the error log!");
                }
            } else {
                String[] versions = versionData.split(",");
                int index = 0;
                Map<Integer, String> tempIndexMap = new HashMap<Integer, String>();
                for (String version : versions) {
                    // String dataId = TDDL_RULE_LE_PREFIX + appName + "."
                    // + version;
                    String dataId = TddlRuleConfig.getVersionedRuleDataId(
                            appName, version);
                    if (!ruleDataSub(dataId, version,
                            new SingleRuleConfigListener())) {
                        throw new RuntimeException(
                                "subscribe the rule data or init rule error!check the error log! the rule version is:"
                                        + version);
                    }
                    topologyDataSub(appName, version);
                    tempIndexMap.put(index, version);
                    index++;
                }
                this.versionIndex = tempIndexMap;
                // 记下日志,方便分析
                TotalStatMonitor.recieveRuleLog(versionData);
            }
        }
    }
```

1.3.1 根据固定规则获取dataId,根据dataId去diamond拉取rule配置数据

```
TddlRuleConfig 

    private boolean ruleDataSub(String dataId, String version,
            ConfigDataListener listener) {
        ConfigDataHandler ruleHandler = cdhf.getConfigDataHandler(dataId,
                listener,unitName);

        String data = null;
        try {
            data = ruleHandler.getData(10 * 1000,
                    ConfigDataHandler.FIRST_SERVER_STRATEGY);
        } catch (Exception e) {
            logger.error("get diamond data error!",e);
            ruleHandler.closeUnderManager();
            return false;
        }

        if (data == null) {
            logger.error("use diamond rule config,but recieve no config at all!");
            ruleHandler.closeUnderManager();
            return false;
        }

        if (ruleConfigInit(data, version)) {
            if (version != null) {
                this.ruleHandlers.put(version, ruleHandler);
            }
            return true;
        } else {
            ruleHandler.closeUnderManager();
            return false;
        }
    }
```

1.3.1.1 获取rule配置的处理器  
1.3.1.2 根据dataId去diamond拉取rule配置数据

一路下钻到这个方法

```
DiamondConfigDataHandler（持久配置中心diamond实现）

public void init(final String dataId,
            final List<ConfigDataListener> configDataListenerList,
            final Map<String, Object> config, final String unitName) {
        if (unitName != null && !"".equals(unitName.trim())) {
            env = DiamondUnitSite.getDiamondUnitEnv(unitName);
        } else {
            env = DiamondEnvRepo.defaultEnv;
        }

        String data = null;
        try {
            data = env.getConfig(dataId, null,
                    Constants.GETCONFIG_LOCAL_SERVER_SNAPSHOT, TIMEOUT);
        } catch (IOException e) {
            throw new RuntimeException("get diamond data error!dataId:"
                    + dataId, e);
        }

        env.addListeners(dataId, null,
                Arrays.asList(new SkipInitialCallbackListener(data) {
                    @Override
                    public Executor getExecutor() {
                        return (Executor) config.get("executor");
                    }

                    @Override
                    public void receiveConfigInfo0(String arg0) {
                        if (configDataListenerList != null) {
                            for (ConfigDataListener configDataListener : configDataListenerList) {
                                configDataListener.onDataRecieved(dataId, arg0);
                            }
                        }
                    }
                }));

        this.unitName = unitName;
        this.dataId = dataId;
    }
```

1.3.1.1.1 根据dataId去diamond拉取rule配置数据  
1.3.1.1.2 对dataId加监听器

```
TDataSourceConfig（TDataSource的配置类，专门放置TDataSource的配置处理代码，为简化配置服务）

private void initConfigHoderFactory(){
        if(useLocalConfig())return;
        MatrixConfigHolder holder = new MatrixConfigHolder(appName, unitName);
        holder.init();
        ConfigHolderFactory.addConfigDataHolder(appName, holder);
    }
```

```
MatrixConfigHolder

    public void init() {
        String dataId = ConfigServerHelper.getDBGroupsConfig(this.appName);
        String sqlExcutorKey = ParallelDiamondConfigManager.getSqlExecutorKey(this.appName);
        Map<String, String> queryResult = queryAndHold(Arrays.asList(dataId, sqlExcutorKey),this.unitName);
        if(queryResult == null || queryResult.size() == 0){
            log.error("matrix batch get diamond config failed. get one by one");
            return;
        }
        try {
            initSonHolder(dataId);
        } catch (Exception e) {
            throw new IllegalStateException("Init SonConfigHolder Error, Class is : " + GROUP_CONFIG_HOLDER_NAME, e);
        }
    }
```

```
AbstractConfigHolder

        String unitName) {
        DiamondEnv env=null;
        if (!StringUtils.nullOrEmpty(unitName)) {
            env = DiamondUnitSite.getDiamondUnitEnv(unitName);
        } else {
            env = DiamondEnvRepo.defaultEnv;
        }

        BatchHttpResult queryResult = env.batchGetConfig(dataIds, null, 30000);
        Map<String, String> result = new HashMap<String, String>();
        if (queryResult.isSuccess()) {
            List<ConfigInfoEx> configs = queryResult.getResult();
            for (ConfigInfoEx config : configs) {
                result.put(config.getDataId(), config.getContent());
            }
            addDatas(result);
        }
        else {
            log.error("Batch Get Diamond Config Failed. Status Code is " + queryResult.getStatusCode());
        }
        return result;
    }
```

1.4.1 批量获取DBGroup、SqlExecutor配置

```
private void initPipeline() {
        if (null == pipelineFactory) {
            if (dynamicRule && tddlRule != null) {
                pipelineFactory = new RuleLePipelineFactory(tddlRule);
            } else if (useNewRule) {
                pipelineFactory = new NewRulePipelineFactory();
            } else {
                pipelineFactory = new DefaultPipelineFactory();
            }
        }
        pipelineFactory.setDefaultDispatcher(defaultDispatcher);
        pipelineFactory.setDispatcherMap(dispatcherMap);

        // 初始化SQL并行执行控制器

        parallelManager = new ParallelDiamondConfigManager(appName, unitName);

        // 提供给getDBAndTables()使用,不影响正常使用
        if (null != defaultDispatcher) {
            this.defaultDispatcher.setPipelineFactory(pipelineFactory);
        }
        // modified by shen.添加一个appName的注册。这样在statlog中就可以直接使用add方法。不用大改代码
        Monitor.setAppName(appName);
    }
```

1.6.1 实例化 pipelineFactory， pipelineFactory包含一组pipeline

```
DefaultPipelineFactory(默认管线工厂实现类,提供一个固定handler的管线,只初始化一次,
 *              且不能动态改变管线中handler种类和次序(虽然有对外接口方法))

{
        /**
         * 初始化各个管线，管线都为单例
         * 每次查询和数据更新都会返回同一个管线实例。
         * 唯一与一个操作对应的是总线数据，并且以
         * 方法的局部变量在管线中的不同处理器之间传递。
         * 从而从数据上避免多线程问题。
         */
        defaultPipeline.addLast(RouteConditionHandler.HANDLER_NAME,new RouteConditionHandler());
        defaultPipeline.addLast(SqlParseHandler.HANDLER_NAME,new SqlParseHandler());
        defaultPipeline.addLast(RouteMatchHandler.HANDLER_NAME,new RouteMatchHandler());
        defaultPipeline.addLast(SqlDirectDispatchHandler.HANDLER_NAME, new SqlDirectDispatchHandler());
        defaultPipeline.addLast(SqlDispatchHandler.HANDLER_NAME,new SqlDispatchHandler()); 
        defaultPipeline.addLast(ExecutionPlanHandler.HANDLER_NAME, new ExecutionPlanHandler());
        defaultPipeline.addLast(BatchTargetSqlHandler.HANDLER_NAME, new BatchTargetSqlHandler());
    }
    
    
    RouteConditionHandler(这个handler主要是根据RouteCondition生成sql解析结果,
 *              功能与SqlParserHandler平行,但与其不同的是,这个handler
 *              只是模拟了下SqlParser的行为,其解析出来的分库分表字段
 *              以及其他属性(参见SimpleCondition及其子类)是用户手动 指定,而不是根据sql解析得出.
 * 
 *              用户指定分库分表字段可以实例话一个SimpleCondition,并且
 *              设定相应属性,最终将实例放入ThreadLocalMap即可(详见示例).
 * 
 *              这样可以达到的一种效果就是sql中不需要加入分库分表字段,即可
 *              进行分库分表,但是ThreadLocalMap很容易被干扰(因为每次执行后
 *              即被清掉,所以如果在正式sql前执行一条不相关的sql,导致正式
 *              执行sql时,SimpleCondition已经被清除从而出错),所以不推荐这么 使用.)
    

SqlParseHandler(此handler主要功能是进行sql解析,从sql中得到我们需要的信息,包括
 *              表,列,参数列以及对应的序列(PreparedStatement)或者值(Statement),
 *              Order by,Group By,Limit M,N对象等.)

 
 RouteMatchHandler(此handler主要功能就是调用规则引擎计算 库后缀和表后缀,最终目的
 *              是拿到 真实库与真实表 这样一个对应关系.
 *               
 *              2.4.4(包含)之前版本TDDL,规则引擎在计算完所有库后再计算表,后续
 *              将加入算完一个库马上算表的方式,减少中间步骤.
 *              
 *              此handler还进行同句sql中多表的计算, 主要目的就是应对非单表join,但是只支持
 *              单库多表join,对于跨库多表join暂不支持(直接抛错).)

SqlDirectDispatchHandler(此handler主要功能是对于直接指定库的sql生成ExecutionPlan,功能
 *              上与ExecutionPlanHandler平行.
 *              
 *              我们常常需要通过TDataSource执行分库分表的sql和不做分库分表的sql,
 *              这在2.4.x之前相对来说是比较困难的事情,那么我们在后续版本中提供了
 *              这么一种解决方案,只要你告诉我在哪个库上执行,那么TDDL将不对这种sql
 *              进行解析和规则计算,直接在目标库上执行掉sql.而这个handler也就是将
 *              这种直接执行的上下文封装成ExecutionPlan提供给之后的执行引擎执行.
 *              
 *              我们可以使用RouteHelper.executeByDB(dbIndex)告诉TDDL你所要直接执行
 *              sql的目标库,当然你现在也可以在规则文件中的ShardRule Bean下配上
 *              defaultDbIndex,那么你不告诉我直接执行的目标库,并且sql中的第一张表
 *              没有分库分表,我们将会把这条sql在defaultDbIndex上执行掉.)

SqlDispatchHandler(此handler主要功能就是中间结果的校验,包括限制多库多表和单库多表的
 *              GroupBy,Having,有条件DISTINCT支持(因为性能和内存安全原因只有
 *              规则配置completeDistinct属性才会完全打开Distinct多表支持)
 * 
 *              如果可以反向输出,那么做反向输出,包括需要数据复制时加入version
 *              或者变更version, limit m,n中m与n的变换(多库与单库有本质的不同), 
 *              表名替换等行为.)

 
 ExecutionPlanHandler(生成最终的执行计划,主要做的工作是生成RealSqlContext Map(即那些库执行哪些sql),
 *              设置isGoSlave(多库事务判定标准之一),Limit M,N属性(skip,max),聚合函数实例, order
 *              by实例,数据复制上下文(setEvent())等属性.
 * 
 *              tips: 1.生成RealSqlContext包括带参和不带参2种形式,
 *              2.根据是否反向输出属性决定是否使用sql解析的反向输出, 如果不反向输出,那么进行表名替换
 *              3.根据needIdInGroup配置决定是否对id in形式的sql进行 归组优化,这对id
 *              in包含较多分散id的sql有较好的性能 提升.)

BatchTargetSqlHandler(这个handler和ExecutionPlanHandler功能上是平行的,
 *              只处理batch相关逻辑,并且batch基本上是处理数据更新, 所以其不必支持order by,group by,某些聚合函数等
 *              query普遍使用的特性,所以只是进行表名替换,返回目标库和 库上执行的sql即可.)
```

1.6.1.1 初始化各个管线，实现表名解析、拿到真实库和真实表、sql解析、资源结果校验、生成最终的执行计划、批量逻辑等

## 2.tddl-rule

```
tddl-rule.xml

<beans>
    <!-- 请先阅读README.txt! -->
    <bean id="vtabroot" class="com.taobao.tddl.interact.rule.VirtualTableRoot" init-method="init">
        <property name="dbType" value="MYSQL" />
        <property name="tableRules">
            <map>
                <entry key="modDBTab" value-ref="modDBTab" />
                <entry key="modTab" value-ref="modTab" />
                <entry key="gmtTab" value-ref="gmtTab" />  
            </map>
        </property>
    </bean>
    
    <bean id="modDBTab" class="com.taobao.tddl.interact.rule.TableRule">
        <!-- 数据库组的名字,咨询dba可以获取当前逻辑表具体在哪些数据库上。  -->
        <property name="dbNamePattern" value="sample_group_{0}" />
        <!--分库规则-->
        <property name="dbRules" value="(#pk,1,4#.longValue() % 4).intdiv(2)" />
        <!--分表规则,需要注意的是，因为taobao目前dba的要求是所有库内的表名必须完全不同，因此这里多加了一个映射的关系
            简单来说，分表规则只会算表的key.
            俩库4表: db1(tab1+tab2) db2(tab3+tab4)
            db1 == key: 0 value tab1
                   key: 1 value tab2
            
            db2 == key: 0 value tab3
                   key: 1 value tab4
        -->
        <property name="tbRules" value="#pk,1,4#.longValue()% 4 % 2" /> 
        <property name="tbNamePattern" value="modDBTab_{0000}" />
    </bean>
    
    <bean id="modTab" class="com.taobao.tddl.interact.rule.TableRule">
        <property name="dbNamePattern" value="sample_group_0" />
        <!-- 按照sql字段中的pk进行分表 -->
        <property name="tbRules" value="#pk,1_number,4#.longValue() % 4 % 2" /> 
        <property name="tbNamePattern" value="modTab_{0000}" />
    </bean>
    
    <bean id="gmtTab" class="com.taobao.tddl.interact.rule.TableRule">
        <property name="dbNamePattern" value="sample_group_0" />
        <!-- 按照sql字段中的gmt进行分表 -->
        <property name="tbRules" value="dayofweek(#gmt,1_date,7#)" /> 
        <property name="tbNamePattern" value="gmtTab_{0000}" />
    </bean>
    
</beans>
```

```
VirtualTableRoot

    public void init(){
        for(Map.Entry<String, VirtualTable> entry:virtualTableMap.entrySet()){
            log.warn("virtual table start to init :" + entry.getKey());
            VirtualTable vtab = entry.getValue();
            if (vtab.getDbType() == null) {
                //如果虚拟表中dbType为null,那指定全局dbType
                vtab.setDbType(this.getDbTypeEnumObj());
            }
            if (vtab.getVirtualTbName() == null) {
                vtab.setVirtualTbName(entry.getKey());
            }
            vtab.init();
            log.warn("virtual table inited :" + entry.getKey());
        }
    }
```

对其下面的所有逻辑表rules进行初始化。

```
TableRule(一个逻辑表怎样分库分表)

public void init() {
        //不要随意调动位置
        super.setExtraPackagesStr(extraPackages);
        initDbIndexes();
        initVnodeMap();
        replaceWithParam(this.dbRules, dbRuleParames != null ? dbRuleParames : ruleParames);
        replaceWithParam(this.tbRules, tbRuleParames != null ? tbRuleParames : ruleParames);
        super.setDbShardRules(convertToRuleArray(dbRules, dbNamePattern,tableSlotMap,dbTableMap,false));
        super.setTbShardRules(convertToRuleArray(tbRules, tbNamePattern,tableSlotMap,dbTableMap,true));
        super.init();
    }
```

2.1 初始化tableSlotMap  
2.2 对库rules进行参数替换  
2.3 对表rules进行参数替换  
2.4 对库rules进行转化并set  
2.5 对表rules进行转化并set  
2.6 初始化实际拓扑结构

```
VirtualTable（一个逻辑表怎样分库分表）

public void init() {
        if (tbShardRules == null || tbShardRules.size() == 0) {
            if (this.tbNamePattern == null) {
                // 表规则没有，tbKeyPattern为空
                this.tbNamePattern = this.virtualTbName;
            }
        }

        initActualTopology();
    }

    public void initActualTopology() {
        if (actualTopology != null) {
            // 将逗号分隔的表名转换为Set
            for (Map.Entry<String/* 库 */, Set<String/* 表 */>> e : this.actualTopology
                    .entrySet()) {
                if (e.getValue().size() == 1) { // 如果只有一个元素，则怀疑为逗号分隔的
                    Set<String> tables = new LinkedHashSet<String>();
                    tables.addAll(Arrays.asList(e.getValue().iterator().next()
                            .split(tableNameSepInSpring)));
                    e.setValue(tables);
                }
            }
            showTopology(false);
            return; // 用户显式设置的优先
        }
        actualTopology = new TreeMap<String, Set<String>>();

        if ((dbShardRules == null || dbShardRules.size() == 0)
                && (tbShardRules == null || tbShardRules.size() == 0)) {
            Set<String> tbs = new TreeSet<String>();
            tbs.add(this.tbNamePattern);
            actualTopology.put(this.dbNamePattern, tbs);
        } else if (dbShardRules == null || dbShardRules.size() == 0) { // 没有库规则
            Set<String> tbs = new TreeSet<String>();
            for (Rule<String> tbRule : tbShardRules) {
                tbs.addAll(vbvRule(tbRule, getEnumerates(tbRule)));
            }
            actualTopology.put(this.dbNamePattern, tbs);
        } else if (tbShardRules == null || tbShardRules.size() == 0) {// 没有表规则
            Set<String> tbs = new TreeSet<String>();
            tbs.add(this.tbNamePattern);
            for (Rule<String> dbRule : dbShardRules) {
                for (String dbIndex : vbvRule(dbRule, getEnumerates(dbRule))) {
                    actualTopology.put(dbIndex, tbs);
                }
            }
        } else { // 库表规则都有
            for (Rule<String> dbRule : dbShardRules) {
                for (Rule<String> tbRule : tbShardRules) {
                    if (this.tableSlotMap != null && this.dbTableMap != null) {
                        valuebyvalue(this.actualTopology, dbRule, tbRule, true);
                    } else {
                        valuebyvalue(this.actualTopology, dbRule, tbRule, false);
                    }
                }
            }
        }
        showTopology(true);
    }
```

2.6.1 actualTopology 是 Map<String, Set> 结构。这里对四种情况分别进行判断。  
如果库表规则都没有；如果有表规则，没有库规则；如果有库规则，没有表规则；如果有库表规则；  
2.6.2 展示拓扑结构，debug情况下输出到日志

## 3.group(TGroupDataSource)

GroupDataSourceDao

```
<!-- Group层信息动态的挂在Diamond上面 -->
<bean id="tGroupDataSource" class="com.taobao.tddl.jdbc.group.TGroupDataSource" init-method="init">
    <property name="appName" value="tddl_sample"></property>
    <property name="dbGroupKey" value="sample_group_0"></property>
</bean>
```

```
TGroupDataSource( * TGroupDataSource并不是像名字所暗示的那样有一组DataSource，
 * 而是指TGroupDataSource内部包含一组(>=1个)同构的数据库，
 * 这一组数据库的不同个体有不同的读写优先级和权重，
 * 当读写数据时也只是按读写优先级和权重对其中的一个数据库操作，
 * 如果第一个数据库读写失败了，再尝试下一个数据库，
 * 如果第一个数据库读写成功了，直接返回结果给应用层，
 * 其他数据库的同步更新由底层数据库内部完成，
 * TGroupDataSource不负责数据同步。)

/**
     * 基于dbGroupKey、appName来初始化多个TAtomDataSource
     *
     * @throws com.taobao.tddl.jdbc.group.exception.ConfigException
     */
    public void init() {
        if (dsKeyAndWeightCommaArray != null) {
            //本地配置方式：dsKeyAndWeightCommaArray + dataSourceFetcher + dyType
            DataSourceFetcher wrapper = new DataSourceFetcher() {
                @Override
                public DataSource getDataSource(String key) {
                    return dataSourceFetcher.getDataSource(key);
                }

                @Override
                public DBType getDataSourceDBType(String key) {
                    DBType type = dataSourceFetcher.getDataSourceDBType(key);
                    return type == null ? dbType : type; //如果dataSourceFetcher没dbType，用tgds的dbType
                }
            };
            List<DataSourceWrapper> dss = ConfigManager.buildDataSourceWrapper(dsKeyAndWeightCommaArray, wrapper);
            init(dss);
        } else {
            checkProperties();
            configManager = new ConfigManager(this);
            configManager.init();
        }
        
        Monitor.setAppName(appName);
    }
```

初始化configManager

```
ConfigManager( * 一个ConfigManager对应一个TGroupDataSource，
 * 主要用于将根据Group的dataID取得的对应配置字符串信（比如db0:rwp1q1i0, db1:rwp0q0i1），
 * 转化为真正的Group层的配置体系结构：一个Group层挂着两个Atom db0 与 db1 ， 则我们使用一个 Map<String,
 * DataSourceWrapper> 来表示 其中的String 为每个Atom DS 的dbKey ，DataSourceWrapper
 * 为经过封装的TAtomDataSource
 * ---这里需要解释一下，为什么不直接使用AtomDataSource？因为每个AtomDataSource还有相应的权重和优先级信息 因此，需要 ***方法
 *
 
 * 其中，配置的每一个Atom DataSource也只是用Atom
 * 的dbKey表示，因此，我们还需要根据此dbKey取得Atom的配置信息，并且将它封装成一个AtomDataSource对象。 因此需要***方法
 *
 * 有了这个map能根据dbKey迅速的找到对应的Datasource也是不够的，我们的Group层应该是对应用透明的，
 * 因此，当我们的读写请求进来时，Group层应该能够根据配置的权重和优先级，自动的选择一个合适的DB上进行读写，
 * 所以，我们还需要将配置信息生成一个DBSelector来自动的完成根据权重、优先级选择合适的目标库 因此，需要***方法)

    /**
     * 从Diamond配置中心提取信息，构造TAtomDataSource、构造有优先级信息的读写DBSelector ---add by
     * mazhidan.pt
     */
    public void init() {
        // 警告: 不要在构造DefaultDiamondManager时就注册ManagerListener(比如:configReceiver)
        // 也就是说，不要这样用: new DefaultDiamondManager(dbGroupKey, configReceiver)，
        // 而是要设成null，等第一次取得信息并解析完成后再注册，这样可以不用同步，避免任何与并发相关的问题，
        // 因为有可能在第一次刚取回信息后，Diamond配置中心那边马上修改了记录，导致ManagerListener这个线程立刻收到信息，
        // 造成初始化线程和ManagerListener线程同时解析信息。
        
        //初始化配置工程，批量获取配置。
        //单纯group ds批量效果不大，且同一个appName
        //initConfigHoderFactory();
        
        configFactory = ConfigDataHandlerCity.getFactory(tGroupDataSource.getAppName());
        globalHandler = configFactory.getConfigDataHandler(
                tGroupDataSource.getFullDbGroupKey(), tGroupDataSource.getUnitName());

        String dsWeightCommaStr = globalHandler.getData(
                tGroupDataSource.getConfigReceiveTimeout(),
                ConfigDataHandler.FIRST_SERVER_STRATEGY);

        //extra config
        extraFactory = ConfigDataHandlerCity.getFactory(tGroupDataSource.getAppName());
        extraHandler = extraFactory.getConfigDataHandler(
                tGroupDataSource.getDbGroupExtraConfigKey(), tGroupDataSource.getUnitName());
        String extraConfig = extraHandler.getNullableData(tGroupDataSource.getConfigReceiveTimeout(),
                ConfigDataHandler.FIRST_SERVER_STRATEGY);

        if(extraConfig!=null){
            parseExtraConfig(extraConfig);
            extraHandler.addListener(extraGroupConfigReceiver, null);
        }

        List<DataSourceWrapper> dswList = parse2DataSourceWrapperList(dsWeightCommaStr);
        resetByDataSourceWrapper(dswList);
        ((ConfigReceiver)this.configReceiver).setConfigManager(this);
        globalHandler.addListener(configReceiver, null);

        //已经使用过的配置移除
        //destoryConfigHoderFactory();
    }
```

3.1 根据APPNAME去diamond获取全局配置  
3.2 根据APPNAME去diamond获取额外配置  
3.3 监听额外配置  
3.4 解析额外配置  
3.5 解析全局配置  
3.6 将封装好的AtomDataSource的列表，进一步封装为可以根据权重优先级随机选择模板库的DBSelector  
3.7 监听全局配置

```
DefaultConfigDataHandlerFactory

    @Override
    public ConfigDataHandler getConfigDataHandler(String dataId,String unitName) {
        return this.getConfigDataHandlerWithListener(dataId, null,unitName);
    }

    @Override
    public ConfigDataHandler getConfigDataHandlerWithListener(String dataId,
            ConfigDataListener configDataListener,String unitName) {
        List<ConfigDataListener> configDataListenerList = new ArrayList<ConfigDataListener>();
        configDataListenerList.add(configDataListener);
        return this.getConfigDataHandlerWithFullConfig(dataId,
                configDataListenerList, null, new HashMap<String, String>(), unitName);
    }
    
    
    
        @Override
    public ConfigDataHandler getConfigDataHandlerWithFullConfig(String dataId,
            List<ConfigDataListener> configDataListenerList, Executor executor,
            Map<String, String> config, String unitName) {
        ConfigDataHandler instance = newConfigDataHandler();
        if (instance == null)
            return null;

        Map<String, Object> configMap = getConfigMap(config);

        instance.init(dataId, clearNullListener(configDataListenerList), configMap, unitName);
        return instance;
    }
```

3.1.1 根据APPNAME去diamond获取全局配置

```
DiamondConfigDataHandler（持久配置中心diamond实现）

    public void init(final String dataId,
            final List<ConfigDataListener> configDataListenerList,
            final Map<String, Object> config, final String unitName) {
        this.init(dataId, configDataListenerList, config, unitName, null);
    }
    
    public void init(final String dataId,
            final List<ConfigDataListener> configDataListenerList,
            final Map<String, Object> config, final String unitName,String initialData) {
        mbean = new TDDLMBean("Diamond Config Info "
                + System.currentTimeMillis());
        mbeanId = dataId + System.currentTimeMillis();
        if (unitName != null && !"".equals(unitName.trim())) {
            env = DiamondUnitSite.getDiamondUnitEnv(unitName);
        } else {
            env = DiamondEnvRepo.defaultEnv;
        }

        if (initialData == null) {
            try {
                initialData = env.getConfig(dataId, null,
                        Constants.GETCONFIG_LOCAL_SERVER_SNAPSHOT, TIMEOUT);
            } catch (IOException e) {
                throw new RuntimeException("get diamond data error!dataId:"
                        + dataId, e);
            }
        }

        env.addListeners(dataId, null,
                Arrays.asList(new SkipInitialCallbackListener(initialData) {
                    @Override
                    public Executor getExecutor() {
                        return (Executor) config.get("executor");
                    }

                    @Override
                    public void receiveConfigInfo0(String arg0) {
                        if (configDataListenerList != null) {
                            for (ConfigDataListener configDataListener : configDataListenerList) {
                                configDataListener.onDataRecieved(dataId, arg0);
                            }

                            if (arg0 != null) {
                                mbean.setAttribute(dataId, arg0);
                            } else {
                                mbean.setAttribute(dataId, "");
                            }
                        }
                    }
                }));

        this.unitName = unitName;
        this.dataId = dataId;
        TDDLMBeanServer.registerMBeanWithId(mbean, mbeanId);
    }
```

3.1.1.1 根据APPNAME去diamond获取全局配置

```
ConfigManager

/**
     * extraConfig is a json format string,include table dataSourceIndex
     * relation or sql dataSourceIndex relation or default go main db config.
     * example: {sqlDsIndex: { 0:[sql1,sql2,sql3], 1:[sql0], 2:[sql4]
     * }, tabDsIndex: { 0:[table1,table2] 1:[table3,table4] },
     * defaultMain:true}
     *
     * @throws JSONException
     *
     **/
    @SuppressWarnings("rawtypes")
    private void parseExtraConfig(String extraConfig) {
        if(extraConfig==null){
            this.groupExtraConfig.getSqlForbidSet().clear();
            this.groupExtraConfig.getSqlDsIndexMap().clear();
            this.groupExtraConfig.getTableDsIndexMap().clear();
            this.groupExtraConfig.setDefaultMain(false);
        }
        try {
            JSONObject obj = JSONObject.fromObject(extraConfig);
            if(obj.has("sqlForbid")) {
                Set<String> tempSqlForbidSet = new HashSet<String>();
                JSONArray array = obj.getJSONArray("sqlForbid");
                for(int i=0; i<array.size(); i++) {
                    String sql=array.getString(i);
                    String nomalSql = TStringUtil.fillTabWithSpace(sql
                            .trim().toLowerCase());
                    if(nomalSql != null && !nomalSql.trim().isEmpty()){
                        tempSqlForbidSet.add(nomalSql);
                    }
                }
                this.groupExtraConfig.setSqlForbidSet(tempSqlForbidSet);
            }
            else {
                this.groupExtraConfig.getSqlForbidSet().clear();
            }

            if (obj.has("sqlDsIndex")) {
                Map<String, Integer> tempSqlDsIndexMap = new HashMap<String, Integer>();
                JSONObject sqlDsIndex = obj.getJSONObject("sqlDsIndex");
                Iterator it=sqlDsIndex.keys();
                while(it.hasNext()){
                    String key=String.valueOf(it.next()).trim();
                    Integer index=Integer.valueOf(key);
                    JSONArray array=sqlDsIndex.getJSONArray(key);
                    for (int i=0;i<array.size();i++) {
                        String sql=array.getString(i);
                        String nomalSql = TStringUtil.fillTabWithSpace(sql
                                .trim().toLowerCase());
                        if (tempSqlDsIndexMap.get(nomalSql) == null) {
                            tempSqlDsIndexMap.put(nomalSql,index);
                        } else {
                            // have a nice log
                            throw new ConfigException(
                                    "sql can not be route to different dataSourceIndex:"
                                            + sql);
                        }
                    }
                }
                this.groupExtraConfig.setSqlDsIndexMap(tempSqlDsIndexMap);
            }
            else {
                this.groupExtraConfig.getSqlDsIndexMap().clear();
            }

            if (obj.has("tabDsIndex")) {
                Map<String, Integer> tempTabDsIndexMap = new HashMap<String, Integer>();
                JSONObject sqlDsIndex = obj.getJSONObject("tabDsIndex");
                Iterator it=sqlDsIndex.keys();
                while(it.hasNext()){
                    String key=String.valueOf(it.next()).trim();
                    Integer index=Integer.valueOf(key);
                    JSONArray array=sqlDsIndex.getJSONArray(key);
                    for (int i=0;i<array.size();i++) {
                        String table=array.getString(i);
                        String nomalTable = table.trim().toLowerCase();
                        if (tempTabDsIndexMap.get(nomalTable) == null) {
                            tempTabDsIndexMap.put(nomalTable, index);
                        } else {
                            // have a nice log
                            throw new ConfigException(
                                    "table can not be route to different dataSourceIndex:"
                                            + table);
                        }
                    }
                }
                this.groupExtraConfig.setTableDsIndexMap(tempTabDsIndexMap);
            }
            else {
                this.groupExtraConfig.getTableDsIndexMap().clear();
            }

            if (obj.has("defaultMain")) {
                this.groupExtraConfig.setDefaultMain(obj.getBoolean("defaultMain"));
            }
            else {
                this.groupExtraConfig.setDefaultMain(false);
            }

        } catch (JSONException e) {
            throw new ConfigException(
                    "group extraConfig is not json valid string:" + extraConfig,
                    e);
        }
    }
```

3.4.1 针对额外配置中返回的json，如果有“sqlForbid”、“sqlDsIndex”、“tabDsIndex”、“defaultMain” ，配置groupExtraConfig

```
/**
 * 警告: 逗号的位置很重要，要是有连续的两个逗号也不要人为的省略掉， 数据库的个数 =
 * 逗号的个数+1，用0、1、2...编号，比如"db1,,db3"，实际上有3个数据库，
 * 业务层通过传一个ThreadLocal进来，ThreadLocal中就是这种索引编号。
 */
private List<DataSourceWrapper> parse2DataSourceWrapperList(String dsWeightCommaStr) {
    logger.warn("[parse2DataSourceWrapperList]dsWeightCommaStr=" + dsWeightCommaStr);
    this.tGroupDataSource.setDsKeyAndWeightCommaArray(dsWeightCommaStr);
    if ((dsWeightCommaStr == null)
            || (dsWeightCommaStr = dsWeightCommaStr.trim()).length() == 0) {
        throw new ConfigException("与dbGroupKey:'"
                + tGroupDataSource.getFullDbGroupKey()
                + "'对应的配置信息不能为null且长度要大于0");
    }
    return buildDataSourceWrapperParallel(dsWeightCommaStr,
            new MyDataSourceFetcher());
}

public static List<DataSourceWrapper> buildDataSourceWrapperParallel(
        String dsWeightCommaStr, final DataSourceFetcher fetcher) {
    final String[] dsWeightArray = dsWeightCommaStr.split(","); // 逗号分隔：db0:rwp1q1i0,
    // db1:rwp0q0i1
    List<DataSourceWrapper> dss = new ArrayList<DataSourceWrapper>(
            dsWeightArray.length);

    ThreadPoolExecutor executor = new ThreadPoolExecutor(2, 2, 5,
            TimeUnit.SECONDS, new LinkedBlockingQueue<Runnable>(),
            new NamedThreadFactory("TDDL_GROUP_INIT"),
            new ThreadPoolExecutor.CallerRunsPolicy());

    Map<String, Future<DataSourceWrapper>> m = new HashMap<String, Future<DataSourceWrapper>>();
    for (int i = 0; i < dsWeightArray.length; i++) {
        final int j = i;
        final String[] dsAndWeight = dsWeightArray[j].split(":"); // 冒号分隔：db0:rwp1q1i0
        final String dsKey = dsAndWeight[0].trim();
        Future<DataSourceWrapper> f = executor
                .submit(new Callable<DataSourceWrapper>() {
                    @Override
                    public DataSourceWrapper call() throws Exception {
                        String weightStr = dsAndWeight.length == 2 ? dsAndWeight[1]
                                : null;
                        return getDataSourceWrapper(dsKey, weightStr, j, fetcher);
                    }
                });

        m.put(dsKey, f);
    }

    for (Map.Entry<String, Future<DataSourceWrapper>> en : m.entrySet()) {
        try {
            dss.add(en.getValue().get());
        } catch (Exception e) {
            throw new RuntimeException("init ds error! atom key is "
                    + en.getKey(), e);
        }
    }
    
    executor.shutdown();
    return dss;
}
```

3.5.1 解析读写、权重配置，比如“db0:rwp1q1i0,db1:rwp0q0i1”。  
3.5.2 用线程池并行提交构建DataSourceWrapper的task  
3.5.3 从future中取出DataSourceWrapper

```
ConfigManager

    /**
     * 将封装好的AtomDataSource的列表，进一步封装为可以根据权重优先级随机选择模板库的DBSelector ---add by
     * mazhidan.pt
     *
     * @param dswList
     */
    private void resetByDataSourceWrapper(List<DataSourceWrapper> dswList) {
        // 删掉已经不存在的DataSourceWrapper
        Map<String, DataSourceWrapper> newDataSourceWrapperMap = new HashMap<String, DataSourceWrapper>(
                dswList.size());
        for (DataSourceWrapper dsw : dswList) {
            newDataSourceWrapperMap.put(dsw.getDataSourceKey(), dsw);
        }
        Map<String, DataSourceWrapper> old = this.dataSourceWrapperMap;
        this.dataSourceWrapperMap = newDataSourceWrapperMap;
        old.clear();
        old = null;

        DBSelector r_DBSelector = null;
        DBSelector w_DBSelector = null;

        // 如果只有一个db，则用OneDBSelector
        if (dswList.size() == 1) {
            DataSourceWrapper dsw2 = dswList.get(0);
            r_DBSelector = new OneDBSelector(dsw2);
            r_DBSelector.setDbType(dsw2.getDBType());
            w_DBSelector = r_DBSelector;
        } else {
            // 读写优先级Map
            Map<Integer/* 优先级 */, List<DataSourceWrapper>/* 优先级为key的DS 列表 */> rPriority2DswList = new HashMap<Integer, List<DataSourceWrapper>>();
            Map<Integer, List<DataSourceWrapper>> wPriority2DswList = new HashMap<Integer, List<DataSourceWrapper>>();
            for (DataSourceWrapper dsw1 : dswList) {
                add2LinkedListMap(rPriority2DswList, dsw1.getWeight().p, dsw1);
                add2LinkedListMap(wPriority2DswList, dsw1.getWeight().q, dsw1);
            }
            r_DBSelector = createDBSelector(rPriority2DswList, true);
            w_DBSelector = createDBSelector(wPriority2DswList, false);
        }

        r_DBSelector.setReadable(true);
        w_DBSelector.setReadable(false);

        this.readDBSelectorWrapper = r_DBSelector;
        this.writeDBSelectorWrapper = w_DBSelector;

        if (tGroupDataSource.getAutoSelectWriteDataSource())
            runtimeWritableAtomDBSelectorWrapper = new RuntimeWritableAtomDBSelector(
                    dataSourceWrapperMap, groupExtraConfig);

        // System.out.println("dataSourceWrapperMap=" + dataSourceWrapperMap);
        if (this.dataSourceChangeListener != null) {
            dataSourceChangeListener.onDataSourceChanged(null);// 业务通过getDataSource()获取更新后的结果
        }
    }
```

3.6.1 将DataSourceWrapper封装成DBSelector  
3.6.2 如果只有一个db，则封装成OneDBSelector  
3.6.3 如果不止一个db，则封装成读写优先级的DBSelector

```
ConfigManager

/**
     * 根据给定的具有读写优先级及每个优先级对应的DataSource链表的Map，构造DBSelector---add by mazhidan.pt
     *
     * @param priority2DswList
     * @param isRead
     * @return
     */
    private DBSelector createDBSelector(
            Map<Integer/* 优先级 */, List<DataSourceWrapper>> priority2DswList,
            boolean isRead) {
        if (priority2DswList.size() == 1) { // 只有一个优先级直接使用EquityDbManager
            return createDBSelector2(priority2DswList.entrySet().iterator()
                    .next().getValue(), isRead);
        } else {
            List<Integer> priorityKeys = new LinkedList<Integer>();
            priorityKeys.addAll(priority2DswList.keySet());
            Collections.sort(priorityKeys); // 优先级从小到大排序
            EquityDbManager[] priorityGroups = new EquityDbManager[priorityKeys
                    .size()];
            for (int i = 0; i < priorityGroups.length; i++) { // 最大的优先级放到最前面
                List<DataSourceWrapper> dswList = priority2DswList
                        .get(priorityGroups.length - 1 - i); // 倒序
                // PriorityDbGroupSelector依赖EquityDbManager抛出的NoMoreDataSourceException来实现，
                // 所以这里即使只有一个ds也只能仍然用EquityDbManager
                priorityGroups[i] = createEquityDbManager(dswList, isRead, groupExtraConfig);

            }
            return new PriorityDbGroupSelector(priorityGroups);
        }
    }
```

## 4.atom（TAtomDataSource）

```
<bean id="tAtomDataSource" class="com.taobao.tddl.jdbc.atom.TAtomDataSource" init-method="init">
     <property name="appName" value="tddl_sample"></property>
     <property name="dbKey" value="tddl_sample_0"></property>
</bean>
```

```
TAtomDataSource（动态数据源，支持数据源参数动态修改）

    public void init() throws Exception {
        String dbName = TAtomConstants.getDbNameStr(this.getUnitName(), this.getAppName(), this.getDbKey());
        synchronized (cacheConfHandleMap) {
            TAtomDsConfHandle cacheConfHandle = cacheConfHandleMap.get(dbName);
            if (null == cacheConfHandle) {
                //初始化config的管理器
                this.dsConfHandle.init();
                cacheConfHandleMap.put(dbName, dsConfHandle);
                logger.info("create new TAtomDsConfHandle dbName : " + dbName);
            } else {
                dsConfHandle = cacheConfHandle;
                logger.info("use the cache TAtomDsConfHandle dbName : " + dbName);
            }
        }
    }
```

初始化TAtomDataSource

4.1 计算dbName  
4.2 取出TAtomDsConfHandle对象（管理动态数据源）  
4.3 如果TAtomDsConfHandle对象为空，初始化config的管理器  
4.4 如果TAtomDsConfHandle对象不为空，使用

```
TAtomDsConfHandle（数据库动态切换的Handle类，所有数据库的动态切换 都是由这个类完成）

    /**
     * 初始化方法，创建对应的数据源，只能被调用一次
     * 
     * @throws Exception
     */
    protected void init() throws Exception {
        if (initFalg) {
            throw new AtomAlreadyInitException(
                    "[AlreadyInit] double call Init !");
        }
        // 1.初始化参数检查
        if (StringUtil.isBlank(this.appName) || StringUtil.isBlank(this.dbKey)) {
            String errorMsg = "[attributeError] TAtomDatasource of appName Or dbKey is Empty !";
            logger.error(errorMsg);
            throw new AtomIllegalException(errorMsg);
        }
        // 2.配置dbConfManager
        DiamondDbConfManager defaultDbConfManager = new DiamondDbConfManager();
        defaultDbConfManager.setGlobalConfigDataId(TAtomConstants
                .getGlobalDataId(this.dbKey));
        defaultDbConfManager.setAppConfigDataId(TAtomConstants.getAppDataId(
                this.appName, this.dbKey));
        // 初始化dbConfManager
        defaultDbConfManager.setUnitName(unitName);
        defaultDbConfManager.init(appName);
        
        dbConfManager = defaultDbConfManager;
        // 3.获取全局配置
        String globaConfStr = dbConfManager.getGlobalDbConf();
        // 注册全局配置监听
        registerGlobaDbConfListener(defaultDbConfManager);
        if (StringUtil.isBlank(globaConfStr)) {

            String errorMsg = "[ConfError] read globalConfig is Empty ! dataId: " + TAtomConstants.getGlobalDataId(this.dbKey);
            logger.error(errorMsg);
            throw new AtomInitialException(errorMsg);
        }
        // 4.获取应用配置
        String appConfStr = dbConfManager.getAppDbDbConf();
        // 注册应用配置监听
        registerAppDbConfListener(defaultDbConfManager);
        if (StringUtil.isBlank(appConfStr)) {

            String errorMsg = "[ConfError] read appConfig is Empty ! dataId: " + TAtomConstants.getAppDataId(this.appName, this.dbKey);
            logger.error(errorMsg);
            throw new AtomInitialException(errorMsg);
        }
        lock.lock();
        try {
            // 5.解析配置string成TAtomDsConfDO
            runTimeConf = TAtomConfParser.parserTAtomDsConfDO(globaConfStr,
                    appConfStr);
            // 6.处理本地优先配置
            overConfByLocal(localConf, runTimeConf);
            // 7.如果没有设置本地密码，则用订的密码，初始化passwdManager
            if (StringUtil.isBlank(this.runTimeConf.getPasswd())) {
                // 检查dbKey和对应的userName是否为空
                if (StringUtil.isBlank(runTimeConf.getUserName())) {
                    String errorMsg = "[attributeError] TAtomDatasource of UserName is Empty !";
                    logger.error(errorMsg);
                    throw new AtomIllegalException(errorMsg);
                }
                DiamondDbPasswdManager diamondDbPasswdManager = new DiamondDbPasswdManager();
                diamondDbPasswdManager.setPasswdConfDataId(TAtomConstants
                        .getPasswdDataId(runTimeConf.getDbName(),
                                runTimeConf.getDbType(),
                                runTimeConf.getUserName()));

                diamondDbPasswdManager.init(appName);
                diamondDbPasswdManager.setUnitName(unitName);
                dbPasswdManager = diamondDbPasswdManager;
                // 获取密码
                String passwd = dbPasswdManager.getPasswd();
                registerPasswdConfListener(diamondDbPasswdManager);
                if (StringUtil.isBlank(passwd)) {
                    StringBuilder errorMsgBuilder = new StringBuilder();
                    errorMsgBuilder.append("[PasswdError] read passwd is Empty ! dataId: ");
                    errorMsgBuilder.append(TAtomConstants.getPasswdDataId(runTimeConf.getDbName(),
                        runTimeConf.getDbType(),runTimeConf.getUserName()));
                    errorMsgBuilder.append(", maybe passwd parse error, please grep '[parserPasswd Error]' ");
                    
                    logger.error(errorMsgBuilder.toString());
                    throw new AtomInitialException(errorMsgBuilder.toString());
                }
                runTimeConf.setPasswd(passwd);
            }
            // 8.转换tAtomDsConfDO
            OldLocalTxDataSourceDO localTxDataSourceDO = convertTAtomDsConf2JbossConf(
                    this.runTimeConf,
                    TAtomConstants.getDbNameStr(this.unitName, this.appName, this.dbKey));
            // 9.参数检查如果参数不正确直接抛出异常
            if (!checkLocalTxDataSourceDO(localTxDataSourceDO)) {
                String errorMsg = "[ConfigError]init dataSource Prams Error! config is : "
                        + localTxDataSourceDO.toString();
                logger.error(errorMsg);
                throw new AtomInitialException(errorMsg);
            }
            // 10.创建数据源
            // 关闭TB-DATASOURCE的JMX注册
            localTxDataSourceDO.setUseJmx(false);
            LocalTxDataSource localTxDataSource = TaobaoDataSourceFactory
                    .createLocalTxDataSource(localTxDataSourceDO);
            // 11.将创建好的数据源是指到TAtomDatasource中
            this.jbossDataSource = localTxDataSource;
            clearDataSourceWrapper();
            initFalg = true;
        } finally {
            lock.unlock();
        }
    }
```

4.3.1 初始化参数检查  
4.3.2 配置dbConfManager 初始化dbConfManager  
4.3.3 获取全局配置 注册全局配置监听  
4.3.4 获取应用配置 注册应用配置监听  
4.3.5 解析配置string成TAtomDsConfDO  
4.3.6 处理本地优先配置  
4.3.7 如果没有设置本地密码，则用订的密码，初始化passwdManager  
4.3.8 转换tAtomDsConfDO  
4.3.9 参数检查如果参数不正确直接抛出异常  
4.3.10 创建数据源  
4.3.11 将创建好的数据源是指到TAtomDatasource中

```
DiamondConfigDataHandler（持久配置中心diamond实现）

    public String getData(long timeout, String strategy) {
        String data = null;
        try {
            data = env.getConfig(dataId, null,
                    Constants.GETCONFIG_LOCAL_SERVER_SNAPSHOT, timeout);
        } catch (IOException e) {
            throw new RuntimeException("get diamond data error!dataId:"
                    + dataId, e);
        }

        if (data != null) {
            mbean.setAttribute(dataId, data);
        } else {
            mbean.setAttribute(dataId, "");
        }

        return data;
    }

TAtomDsConfHandle（数据库动态切换的Handle类，所有数据库的动态切换 都是由这个类完成）

/**
     * 全局配置监听,全局配置发生变化， 需要重新FLUSH数据源
     * 
     * @param defaultDbConfManager
     */
    private void registerGlobaDbConfListener(DbConfManager dbConfManager) {
        dbConfManager.registerGlobaDbConfListener(new ConfigDataListener() {
            public void onDataRecieved(String dataId, String data) {
                logger.warn("[GlobaConf HandleData] handle received global data, dataId : " + dataId
                        + " data: " + data);
                if (null == data || StringUtil.isBlank(data)) {
                    return;
                }
                lock.lock();
                try {
                    String globaConfStr = data;
                    // 如果是全局配置发生变化，可能是IP,PORT,DBNAME,DBTYPE,STATUS
                    TAtomDsConfDO tmpConf = TAtomConfParser
                            .parserTAtomDsConfDO(globaConfStr, null);
                    TAtomDsConfDO newConf = TAtomDsConfHandle.this.runTimeConf
                            .clone();
                    // 是用推送的配置，覆盖当前的配置
                    newConf.setIp(tmpConf.getIp());
                    newConf.setPort(tmpConf.getPort());
                    newConf.setDbName(tmpConf.getDbName());
                    newConf.setDbType(tmpConf.getDbType());
                    newConf.setDbStatus(tmpConf.getDbStatus());
                    // 处理本地优先配置
                    overConfByLocal(TAtomDsConfHandle.this.localConf, newConf);
                    // 如果推送过来的数据库状态是 RW/R->NA,直接销毁掉数据源，以下业务逻辑不做处理
                    if (AtomDbStatusEnum.NA_STATUS != TAtomDsConfHandle.this.runTimeConf
                            .getDbStautsEnum()
                            && AtomDbStatusEnum.NA_STATUS == tmpConf
                                    .getDbStautsEnum()) {
                        try {
                            TAtomDsConfHandle.this.jbossDataSource.destroy();
                            logger.warn("[NA STATUS PUSH] destroy DataSource !");
                        } catch (Exception e) {
                            logger.error(
                                    "[NA STATUS PUSH] destroy DataSource  Error!",
                                    e);
                        }
                    } else {
                        // 转换tAtomDsConfDO
                        OldLocalTxDataSourceDO localTxDataSourceDO = convertTAtomDsConf2JbossConf(
                                newConf, TAtomConstants.getDbNameStr(
                                        TAtomDsConfHandle.this.unitName,
                                        TAtomDsConfHandle.this.appName,
                                        TAtomDsConfHandle.this.dbKey));
                        // 检查转换后结果是否正确
                        if (!checkLocalTxDataSourceDO(localTxDataSourceDO)) {
                            logger.error("[GlobaConfError] dataSource Prams Error! dataId : "
                                    + dataId + " config : " + data);
                            return;
                        }
                        // 如果推送的状态时 NA->RW/R 时需要重新创建数据源，无需再刷新
                        if (TAtomDsConfHandle.this.runTimeConf
                                .getDbStautsEnum() == AtomDbStatusEnum.NA_STATUS
                                && (newConf.getDbStautsEnum() == AtomDbStatusEnum.RW_STATUS
                                        || newConf.getDbStautsEnum() == AtomDbStatusEnum.R_STATUS || newConf
                                        .getDbStautsEnum() == AtomDbStatusEnum.W_STATUS)) {
                            // 创建数据源
                            try {
                                // 关闭TB-DATASOURCE的JMX注册
                                localTxDataSourceDO.setUseJmx(false);
                                LocalTxDataSource localTxDataSource = TaobaoDataSourceFactory
                                        .createLocalTxDataSource(localTxDataSourceDO);
                                TAtomDsConfHandle.this.jbossDataSource = localTxDataSource;
                                logger.warn("[NA->RW/R STATUS PUSH] ReCreate DataSource !");
                            } catch (Exception e) {
                                logger.error(
                                        "[NA->RW/R STATUS PUSH] ReCreate DataSource Error!",
                                        e);
                            }
                        } else {
                            boolean needFlush = checkGlobaConfChange(
                                    TAtomDsConfHandle.this.runTimeConf, newConf);
                            // 如果发生的配置变化是否需要重建数据源
                            if (needFlush) {
                                TAtomDsConfHandle.this.jbossDataSource
                                        .setConnectionURL(localTxDataSourceDO
                                                .getConnectionURL());
                                TAtomDsConfHandle.this.jbossDataSource
                                        .setDriverClass(localTxDataSourceDO
                                                .getDriverClass());
                                TAtomDsConfHandle.this.jbossDataSource
                                        .setExceptionSorterClassName(localTxDataSourceDO
                                                .getExceptionSorterClassName());
                                try {
                                    // 更新数据源
                                    TAtomDsConfHandle.this.flushDataSource();
                                } catch (Exception e) {
                                    logger.error(
                                            "[Flsh GlobaConf Error] flush dataSource Error !",
                                            e);
                                }
                            }
                        }
                    }
                    //处理数据库状态监听器
                    processDbStatusListener(TAtomDsConfHandle.this.runTimeConf.getDbStautsEnum(),
                            newConf.getDbStautsEnum());
                    //是用新的配置覆盖运行时的配置
                    TAtomDsConfHandle.this.runTimeConf = newConf;
                    clearDataSourceWrapper();
                } finally {
                    lock.unlock();
                }
            }
```

4.3.3.1 如果是全局配置发生变化，可能是IP,PORT,DBNAME,DBTYPE,STATUS  
4.3.3.2 用推送的配置，覆盖当前的配置  
4.3.3.3 本地配置依然优先  
4.3.3.4 如果推送过来的数据库状态是 RW/R->NA,直接销毁掉数据源，以下业务逻辑不做处理  
4.3.3.5 如果推送的状态时 NA->RW/R 时需要重新创建数据源，无需再刷新（创建数据源可参考4.3.10）  
4.3.3.6 如果发生的配置变化是否需要重建数据源并更新（配置变化指IP、port、dbname、dbtype）  
4.3.3.7 处理数据库状态监听器  
4.3.3.8 用新的配置覆盖运行时的配置

```
DiamondDbConfManager（全局和应用的配置管理Diamond实现）

public String getAppDbDbConf() {
        if (null != appDBHandler) {
            return appDBHandler.getData(TDDLConstant.DIAMOND_GET_DATA_TIMEOUT,ConfigDataHandler.FIRST_SERVER_STRATEGY);
        }
        logger.error("[getDataError] appDBConfig not init !");
        return null;
    }
    
    
    TAtomDsConfHandle（数据库动态切换的Handle类，所有数据库的动态切换 都是由这个类完成）
    
    /**
     * 应用配置监听，当应用配置发生变化时，区分发生 变化的配置，来决定具体是flush还是reCreate
     * 
     * @param defaultDbConfManager
     */
    private void registerAppDbConfListener(DbConfManager dbConfManager) {
        dbConfManager.registerAppDbConfListener(new ConfigDataListener() {
            public void onDataRecieved(String dataId, String data) {
                logger.warn("[AppConf HandleData] handle received app data, dataId : " + dataId
                        + " data: " + data);
                if (null == data || StringUtil.isBlank(data)) {
                    return;
                }
                lock.lock();
                try {
                    String appConfStr = data;
                    TAtomDsConfDO tmpConf = TAtomConfParser
                            .parserTAtomDsConfDO(null, appConfStr);
                    TAtomDsConfDO newConf = TAtomDsConfHandle.this.runTimeConf
                            .clone();
                    // 有些既有配置不能变更，所以克隆老的配置，然后将新的set进去
                    newConf.setUserName(tmpConf.getUserName());
                    newConf.setMinPoolSize(tmpConf.getMinPoolSize());
                    newConf.setMaxPoolSize(tmpConf.getMaxPoolSize());
                    newConf.setPrefill(tmpConf.isPrefill());
                    newConf.setIdleTimeout(tmpConf.getIdleTimeout());
                    newConf.setBlockingTimeout(tmpConf.getBlockingTimeout());
                    newConf.setPreparedStatementCacheSize(tmpConf
                            .getPreparedStatementCacheSize());
                    newConf.setConnectionProperties(tmpConf
                            .getConnectionProperties());
                    newConf.setOracleConType(tmpConf.getOracleConType());
                    // 增加3个具体的实现
                    newConf.setWriteRestrictTimes(tmpConf
                            .getWriteRestrictTimes());
                    newConf.setReadRestrictTimes(tmpConf.getReadRestrictTimes());
                    newConf.setThreadCountRestrict(tmpConf
                            .getThreadCountRestrict());
                    newConf.setTimeSliceInMillis(tmpConf.getTimeSliceInMillis());
                    newConf.setDriverClass(tmpConf.getDriverClass());
                    // 应用连接限制配置
                    newConf.setConnRestrictEntries(tmpConf.getConnRestrictEntries());
                    // 处理本地优先配置
                    overConfByLocal(TAtomDsConfHandle.this.localConf, newConf);
                    // 转换tAtomDsConfDO
                    OldLocalTxDataSourceDO localTxDataSourceDO = convertTAtomDsConf2JbossConf(
                            newConf, TAtomConstants.getDbNameStr(
                                    TAtomDsConfHandle.this.unitName,
                                    TAtomDsConfHandle.this.appName,
                                    TAtomDsConfHandle.this.dbKey));
                    // 检查转换后结果是否正确
                    if (!checkLocalTxDataSourceDO(localTxDataSourceDO)) {
                        logger.error("[GlobaConfError] dataSource Prams Error! dataId : "
                                + dataId + " config : " + data);
                        return;
                    }
                    boolean isNeedReCreate = isNeedReCreate(
                            TAtomDsConfHandle.this.runTimeConf, newConf);
                    if (isNeedReCreate) {
                        try {
                            //这个必须在最前面，否则下次推送可能无法比较出不同而不创建新数据源
                            TAtomDsConfHandle.this.runTimeConf = newConf;
                            TAtomDsConfHandle.this.jbossDataSource.destroy();
                            logger.warn("[destroy OldDataSource] dataId : "
                                    + dataId);
                            LocalTxDataSource localTxDataSource = TaobaoDataSourceFactory
                                    .createLocalTxDataSource(localTxDataSourceDO);
                            logger.warn("[create newDataSource] dataId : "
                                    + dataId);
                            TAtomDsConfHandle.this.jbossDataSource = localTxDataSource;
                            clearDataSourceWrapper();
                        } catch (Exception e) {
                            logger.error(
                                    "[Flsh AppConf Error] reCreate dataSource Error ! dataId: "
                                            + dataId, e);
                        }
                    } else {
                        boolean isNeedFlush = isNeedFlush(
                                TAtomDsConfHandle.this.runTimeConf, newConf);
                        /**
                         * 阀值变化无需刷新持有的数据源，只要更新runTimeConf，并且清空wrapDataSource
                         */
                        boolean isRestrictChange = isRestrictChange(
                                TAtomDsConfHandle.this.runTimeConf, newConf);
                        if (isNeedFlush) {
                            TAtomDsConfHandle.this.jbossDataSource
                                    .setConnectionURL(localTxDataSourceDO
                                            .getConnectionURL());
                            TAtomDsConfHandle.this.jbossDataSource
                                    .setUserName(localTxDataSourceDO
                                            .getUserName());
                            try {
                                // 是用新的配置覆盖运行时的配置
                                TAtomDsConfHandle.this.runTimeConf = newConf;
                                // 更新数据源
                                TAtomDsConfHandle.this.flushDataSource();
                                clearDataSourceWrapper();
                            } catch (Exception e) {
                                logger.error(
                                        "[Flash GlobaConf Error] flush dataSource Error !",
                                        e);
                            }
                        } else if (isRestrictChange) {
                            TAtomDsConfHandle.this.runTimeConf = newConf;
                            clearDataSourceWrapper();
                        }
                    }
                } finally {
                    lock.unlock();
                }
            }
```

4.3.4.1 解析diamond返回的data  
4.3.4.2 配置的覆盖（参考4.3.5）  
4.3.4.3 处理本地优先配置  
4.3.4.4 转换tAtomDsConfDO成为localTxDataSourceDO（参考4.3.8）  
4.3.4.5 判断是否需要重建连接（在driverClass、minPoolSize、maxPoolSize、blockingTimeout、idleTimeout、preparedStatementCacheSize改变的情况下需要重建连接）。如果需要，则重建（参考4.3.10）  
4.3.4.6 判断是否需要刷新链接（在userName、passwd改变的情况下需要刷新连接）如果需要，则刷新  
4.3.4.7 阀值变化无需刷新持有的数据源，只要更新runTimeConf，并且清空wrapDataSource。（在readRestrictTimes、writeRestrictTimes、threadCountRestrict、timeSliceInMillis、应用连接过程中的连接数限制改变的情况下执行此条）

```
TAtomConfParser（TAtom数据源的推送配置解析类）

public static TAtomDsConfDO parserTAtomDsConfDO(String globaConfStr, String appConfStr) {
        TAtomDsConfDO pasObj = new TAtomDsConfDO();
        if (StringUtil.isNotBlank(globaConfStr)) {
            Properties globaProp = parserConfStr2Properties(globaConfStr);
            if (!globaProp.isEmpty()) {
                String ip = StringUtil.trim(globaProp.getProperty(TAtomConfParser.GLOBA_IP_KEY));
                if (StringUtil.isNotBlank(ip)) {
                    pasObj.setIp(ip);
                }
                String port = StringUtil.trim(globaProp.getProperty(TAtomConfParser.GLOBA_PORT_KEY));
                if (StringUtil.isNotBlank(port)) {
                    pasObj.setPort(port);
                }
                String dbName = StringUtil.trim(globaProp.getProperty(TAtomConfParser.GLOBA_DB_NAME_KEY));
                if (StringUtil.isNotBlank(dbName)) {
                    pasObj.setDbName(dbName);
                }
                String dbType = StringUtil.trim(globaProp.getProperty(TAtomConfParser.GLOBA_DB_TYPE_KEY));
                if (StringUtil.isNotBlank(dbType)) {
                    pasObj.setDbType(dbType);
                }
                String dbStatus = StringUtil.trim(globaProp.getProperty(TAtomConfParser.GLOBA_DB_STATUS_KEY));
                if (StringUtil.isNotBlank(dbStatus)) {
                    pasObj.setDbStatus(dbStatus);
                }
            }
        }
        if (StringUtil.isNotBlank(appConfStr)) {
            Properties appProp = TAtomConfParser.parserConfStr2Properties(appConfStr);
            if (!appProp.isEmpty()) {
                String userName = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_USER_NAME_KEY));
                if (StringUtil.isNotBlank(userName)) {
                    pasObj.setUserName(userName);
                }
                String oracleConType = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_ORACLE_CON_TYPE_KEY));
                if (StringUtil.isNotBlank(oracleConType)) {
                    pasObj.setOracleConType(oracleConType);
                }
                String minPoolSize = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_MIN_POOL_SIZE_KEY));
                if (StringUtil.isNotBlank(minPoolSize)&&StringUtil.isNumeric(minPoolSize)) {
                    pasObj.setMinPoolSize(Integer.valueOf(minPoolSize));
                }
                String maxPoolSize = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_MAX_POOL_SIZE_KEY));
                if (StringUtil.isNotBlank(maxPoolSize)&&StringUtil.isNumeric(maxPoolSize)) {
                    pasObj.setMaxPoolSize(Integer.valueOf(maxPoolSize));
                }
                String idleTimeout = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_IDLE_TIMEOUT_KEY));
                if (StringUtil.isNotBlank(idleTimeout)&&StringUtil.isNumeric(idleTimeout)) {
                    pasObj.setIdleTimeout(Long.valueOf(idleTimeout));
                }
                String blockingTimeout = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_BLOCKING_TIMEOUT_KEY));
                if (StringUtil.isNotBlank(blockingTimeout)&&StringUtil.isNumeric(blockingTimeout)) {
                    pasObj.setBlockingTimeout(Integer.valueOf(blockingTimeout));
                }
                String preparedStatementCacheSize = StringUtil.trim(appProp
                        .getProperty(TAtomConfParser.APP_PREPARED_STATEMENT_CACHE_SIZE_KEY));
                if (StringUtil.isNotBlank(preparedStatementCacheSize)&&StringUtil.isNumeric(preparedStatementCacheSize)) {
                    pasObj.setPreparedStatementCacheSize(Integer.valueOf(preparedStatementCacheSize));
                }
                
                String writeRestrictTimes = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_WRITE_RESTRICT_TIMES));
                if(StringUtil.isNotBlank(writeRestrictTimes)&&StringUtil.isNumeric(writeRestrictTimes)){
                    pasObj.setWriteRestrictTimes(Integer.valueOf(writeRestrictTimes));
                }
                
                String readRestrictTimes = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_READ_RESTRICT_TIMES));
                if(StringUtil.isNotBlank(readRestrictTimes)&&StringUtil.isNumeric(readRestrictTimes)){
                    pasObj.setReadRestrictTimes(Integer.valueOf(readRestrictTimes));
                }
                String threadCountRestrict = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_THREAD_COUNT_RESTRICT));
                if(StringUtil.isNotBlank(threadCountRestrict)&&StringUtil.isNumeric(threadCountRestrict)){
                    pasObj.setThreadCountRestrict(Integer.valueOf(threadCountRestrict));
                }
                String timeSliceInMillis = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_TIME_SLICE_IN_MILLS));
                if(StringUtil.isNotBlank(timeSliceInMillis)&&StringUtil.isNumeric(timeSliceInMillis)){
                    pasObj.setTimeSliceInMillis(Integer.valueOf(timeSliceInMillis));
                }
                
                String conPropStr = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_CON_PROP_KEY));
                Map<String, String> connectionProperties = parserConPropStr2Map(conPropStr);
                if (null != connectionProperties
                        && !connectionProperties.isEmpty()) {
                    pasObj.setConnectionProperties(connectionProperties);
                    String driverClass = connectionProperties
                            .get(TAtomConfParser.APP_DRIVER_CLASS_KEY);
                    if (!StringUtil.isBlank(driverClass)) {
                        pasObj.setDriverClass(driverClass);
                    }
                    
                    // add by agapple, 简单处理支持下初始化链接
                    if(connectionProperties.containsKey(APP_PREFILL)){
                        String prefill = connectionProperties.remove(APP_PREFILL);
                        pasObj.setPrefill(BooleanUtils.toBoolean(prefill));
                        connectionProperties.remove(APP_PREFILL);
                    }
                    
                    String connectionInitSql = connectionProperties.remove(APP_CONNECTION_INIT_SQL_KEY);
                    if (!StringUtil.isBlank(connectionInitSql)) {
                        pasObj.setConnectionInitSql(connectionInitSql);
                    }
                }
                
                // 解析应用连接限制, 参看下面的文档
                String connRestrictStr = StringUtil.trim(appProp.getProperty(TAtomConfParser.APP_CONN_RESTRICT));
                List<ConnRestrictEntry> connRestrictEntries = parseConnRestrictEntries(connRestrictStr, 
                        pasObj.getMaxPoolSize());
                if (null != connRestrictEntries && !connRestrictEntries.isEmpty()) {
                    pasObj.setConnRestrictEntries(connRestrictEntries);
                }
            }
        }
        return pasObj;
    }
```

4.3.5.1 解析全局配置和应用配置

```
TAtomDsConfHandle（数据库动态切换的Handle类，所有数据库的动态切换 都是由这个类完成）

    /**
     * 将TAtomDsConfDO转换成LocalTxDataSourceDO
     * 
     * @param tAtomDsConfDO
     * @return
     */
    @SuppressWarnings("rawtypes")
    protected static OldLocalTxDataSourceDO convertTAtomDsConf2JbossConf(TAtomDsConfDO tAtomDsConfDO, String dbName) {
        OldLocalTxDataSourceDO localTxDataSourceDO = new OldLocalTxDataSourceDO();
        if (StringUtil.isNotBlank(dbName)) {
            localTxDataSourceDO.setJndiName(dbName);
        }
        localTxDataSourceDO.setUserName(tAtomDsConfDO.getUserName());
        localTxDataSourceDO.setPassword(tAtomDsConfDO.getPasswd());
        localTxDataSourceDO.setDriverClass(tAtomDsConfDO.getDriverClass());
        localTxDataSourceDO.setExceptionSorterClassName(tAtomDsConfDO.getSorterClass());
        //根据数据库类型设置conURL和setConnectionProperties
        if (AtomDbTypeEnum.ORACLE == tAtomDsConfDO.getDbTypeEnum()) {
            String conUlr = TAtomConURLTools.getOracleConURL(tAtomDsConfDO.getIp(), tAtomDsConfDO.getPort(),
                    tAtomDsConfDO.getDbName(), tAtomDsConfDO.getOracleConType());
            localTxDataSourceDO.setConnectionURL(conUlr);
            //如果是oracle没有设置ConnectionProperties则给以个默认的
            if (!tAtomDsConfDO.getConnectionProperties().isEmpty()) {
                localTxDataSourceDO.setConnectionProperties(tAtomDsConfDO.getConnectionProperties());
            } else {
                localTxDataSourceDO.setConnectionProperties(TAtomConstants.DEFAULT_ORACLE_CONNECTION_PROPERTIES);
            }
        } else if (AtomDbTypeEnum.MYSQL == tAtomDsConfDO.getDbTypeEnum()) {
            String conUlr = TAtomConURLTools.getMySqlConURL(tAtomDsConfDO.getIp(), tAtomDsConfDO.getPort(),
                    tAtomDsConfDO.getDbName(), tAtomDsConfDO.getConnectionProperties());
            localTxDataSourceDO.setConnectionURL(conUlr);
            //如果可以找到mysqlDriver中的Valid就使用，否则设置默认的
            Class validConnectionClass = findClass(TAtomConstants.MYSQL_VALID_CONNECTION_CHECKERCLASS);
            if (null == validConnectionClass) {
                logger.warn("MYSQL Driver is NOT support valid connection checker "
                        + TAtomConstants.MYSQL_VALID_CONNECTION_CHECKERCLASS
                        + ", use default "
                        + TAtomConstants.DEFAULT_MYSQL_VALID_CHECKERCLASS);
                validConnectionClass = findClass(TAtomConstants.DEFAULT_MYSQL_VALID_CHECKERCLASS);
            }
            if (null != validConnectionClass) {
                localTxDataSourceDO.setValidConnectionCheckerClassName(
                        validConnectionClass.getName());
            } else {
                logger.error("NOT found default valid connection checker "
                        + TAtomConstants.DEFAULT_MYSQL_VALID_CHECKERCLASS);
            }
            //如果可以找到mysqlDriver中的integrationSorter就使用否则使用默认的
            Class integrationSorterClass = findClass(TAtomConstants.MYSQL_INTEGRATION_SORTER_CLASS);
            if (null == integrationSorterClass) {
                logger.warn("MYSQL Driver is NOT support integration sorter "
                        + TAtomConstants.MYSQL_INTEGRATION_SORTER_CLASS
                        + " use default sorter "
                        + TAtomConstants.DEFAULT_MYSQL_SORTER_CLASS);
                integrationSorterClass = findClass(TAtomConstants.DEFAULT_MYSQL_SORTER_CLASS);
            }
            if (null != integrationSorterClass) {
                localTxDataSourceDO.setExceptionSorterClassName(
                        integrationSorterClass.getName());
            } else {
                logger.error("NOT found default integration sorter "
                        + TAtomConstants.DEFAULT_MYSQL_SORTER_CLASS);
            }
        }
        localTxDataSourceDO.setMinPoolSize(tAtomDsConfDO.getMinPoolSize());
        localTxDataSourceDO.setMaxPoolSize(tAtomDsConfDO.getMaxPoolSize());
        localTxDataSourceDO.setPrefill(tAtomDsConfDO.isPrefill());
        localTxDataSourceDO.setPreparedStatementCacheSize(tAtomDsConfDO.getPreparedStatementCacheSize());
        if (tAtomDsConfDO.getIdleTimeout() > 0) {
            localTxDataSourceDO.setIdleTimeoutMinutes(tAtomDsConfDO.getIdleTimeout());
        }
        if (tAtomDsConfDO.getBlockingTimeout() > 0) {
            localTxDataSourceDO.setBlockingTimeoutMillis(tAtomDsConfDO.getBlockingTimeout());
        }
        if(tAtomDsConfDO.getConnectionInitSql() != null){
            localTxDataSourceDO.setNewConnectionSQL(tAtomDsConfDO.getConnectionInitSql());
        }
        return localTxDataSourceDO;
    }
```

4.3.8.1 转换tAtomDsConfDO

```
TaobaoDataSourceFactory

    public static LocalTxDataSource createLocalTxDataSource(OldLocalTxDataSourceDO dataSourceDO) throws Exception {
        return createLocalTxDataSource(dataSourceDO, (TxManager)null, (CachedConnectionManager)null);
    }

    public static LocalTxDataSource createLocalTxDataSource(OldLocalTxDataSourceDO dataSourceDO, TxManager transactionManager, CachedConnectionManager cachedConnectionManager) throws Exception {
        if(null == dataSourceDO) {
            throw new Exception("dataSource config is Empty!");
        } else {
            LocalTxDataSource localTxDataSource = new LocalTxDataSource();
            if(null != cachedConnectionManager) {
                localTxDataSource.setCachedConnectionManager(cachedConnectionManager);
            } else {
                localTxDataSource.setCachedConnectionManager(defaultCachedConnectionManager);
            }

            if(null != transactionManager) {
                localTxDataSource.setTransactionManager(transactionManager);
            } else {
                localTxDataSource.setTransactionManager(defaultTransactionManager);
            }

            localTxDataSource.setBeanName(dataSourceDO.getJndiName());
            localTxDataSource.setUseJmx(dataSourceDO.isUseJmx());
            localTxDataSource.setBackgroundValidation(dataSourceDO.isBackgroundValidation());
            localTxDataSource.setBackGroundValidationMinutes(dataSourceDO.getBackgroundValidationMinutes());
            localTxDataSource.setBlockingTimeoutMillis(dataSourceDO.getBlockingTimeoutMillis());
            localTxDataSource.setCheckValidConnectionSQL(dataSourceDO.getCheckValidConnectionSQL());
            localTxDataSource.setConnectionProperties(dataSourceDO.getConnectionProperties());
            localTxDataSource.setConnectionURL(dataSourceDO.getConnectionURL());
            localTxDataSource.setDriverClass(dataSourceDO.getDriverClass());
            localTxDataSource.setExceptionSorterClassName(dataSourceDO.getExceptionSorterClassName());
            localTxDataSource.setIdleTimeoutMinutes(dataSourceDO.getIdleTimeoutMinutes());
            localTxDataSource.setMaxSize(dataSourceDO.getMaxPoolSize());
            localTxDataSource.setMinSize(dataSourceDO.getMinPoolSize());
            localTxDataSource.setNewConnectionSQL(dataSourceDO.getNewConnectionSQL());
            localTxDataSource.setNoTxSeparatePools(dataSourceDO.isNoTxSeparatePools());
            localTxDataSource.setPassword(dataSourceDO.getPassword());
            localTxDataSource.setPrefill(dataSourceDO.isPrefill());
            localTxDataSource.setPreparedStatementCacheSize(dataSourceDO.getPreparedStatementCacheSize());
            localTxDataSource.setQueryTimeout(dataSourceDO.getQueryTimeout());
            localTxDataSource.setSharePreparedStatements(dataSourceDO.isSharePreparedStatements());
            localTxDataSource.setTrackStatements(dataSourceDO.getTrackStatements());
            localTxDataSource.setTransactionIsolation(dataSourceDO.getTransactionIsolation());
            localTxDataSource.setTxQueryTimeout(dataSourceDO.isTxQueryTimeout());
            localTxDataSource.setUseFastFail(dataSourceDO.isUseFastFail());
            localTxDataSource.setUserName(dataSourceDO.getUserName());
            localTxDataSource.setValidateOnMatch(dataSourceDO.isValidateOnMatch());
            localTxDataSource.setValidConnectionCheckerClassName(dataSourceDO.getValidConnectionCheckerClassName());
            String securityDomainName = dataSourceDO.getSecurityDomain();
            if(StringUtils.isNotBlank(securityDomainName)) {
                SecureIdentityLoginModule securityDomain = (SecureIdentityLoginModule)loginConfigFinder.get(securityDomainName);
                if(securityDomain != null) {
                    localTxDataSource.setSecurityDomain(securityDomain);
                }
            }

            localTxDataSource.setCriteria(dataSourceDO.getCriteria());
            localTxDataSource.init();
            return localTxDataSource;
        }
    }
```

4.3.10.1 创建数据源（TaobaoDataSource）