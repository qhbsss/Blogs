---
title: "buy2订单是如何创建的"
source: "https://ata.atatech.org/articles/11000255933?spm=ata.21736010.0.0.552d7536mzyXRd&layout=%2Fvelocity%2Flayout%2Fblank.vm"
author:
  - "[[顾郑东(麟空)]]"
published:
created: 2026-11-15
description:
tags:
  - "clippings"
---
buy2是集团电商最核心的应用，承担了天猫、淘宝、聚划算等各个BU的交易下单业务，是交易流量的入口，承载着各种业务错综复杂的交易下单逻辑和流程。那么在双十一60w/s的流量洪峰背后，订单是如何创建的呢？

## 交易架构

先贴上交易的架构图，串一下交易各个系统负责的部分。

- trademanager：订单管理，一个前端展示层应用。是买家/卖家管理交易订单最主要的入口。
- carts2：购物车，主要进行查看、加购、删除购物车操作。
- buy2：提供订单渲染、订单创建功能。
- tradeplatform3：定义和实现了交易订单履行生命周期中的各个环节，例如：付款、发货、收货、打款、退款等。
- timeoutcenter：交易超时中心，负责订单生命周期里产生的所有超时任务的存储和调度。
- tradelogs：交易相关的销量。
- htm：交易历史库。
- dmc：把数据从在线库迁移到历史库。
- cartscache：监听精卫，失效购物车本地和远程缓存数据。
- cartsapi：监听下单消息删除购物车数据。
- tradeapi：和一些外部买家的下单和查询等操作。
- 交易数据：mysql买家库、esdb卖家库、mysql历史库、adb搜索库、mysql超时库、持久化tair快照销量

## 流量地图

用户在端上的请求，是如何到达交易应用进行订单创建呢？

![](7785ad3d-e333-435f-928e-8c1f6aacf081.png)

## DNS

![](1910b7fa-04cd-4f5a-abe8-4e161196ce2d.png) ![](69601f2b-b090-4365-94a8-59088077cf89.png)

交易域名DNS解析获取IP，从上图可以看到，获取到的IP是统一接入层的VIP。

## LVS集群

![](16097f1b-4391-44aa-96a3-4f46700e8d77.png)

客户端根据解析拿到的VIP，将请求发给负载均衡节点，再由负载均衡节点转发到后端服务器处理。多台LVS形成一个LVS集群，共同完成负载均衡的任务。此时实际后端服务器RS是aserver统一接入层。

## aserver

目前全网对外的流量，基本都要走集团统一接入。有以下两个原因：

- 由于安全考量，所有外网进来的流量都走https，但是https做一次解码其实十分消耗性能，在内网各个服务中如果这样走会对性能消耗极大，因此内网都是走http。
- 如果我们在每个业务系统的前端都部署一个https转http的服务，那之后的每次升级改造，甚至就是修改ssl证书，都要全网每个业务系统都要改。
![](b09bce8a-1133-4a6b-b24d-e56b08bbc9d5.png)

流量是打到aserver上的，aserver需要确定流量业务应用所在的机器IP和端口，这个是通过VIPServer来完成。通过查找该域名对应的VIPServer Key，然后使用VIPServer的服务通过VIPServer Key获取对应机器的IP和端口，并转发请求。

## mtop

buy2的mtop都是去中心化的，由原先的独立部署改为提供二方包供应用集成，将mtop的能力分布到应用中。这样mtop和业务应用都在一个容器内。

![](95f3831d-e38c-453c-8cbc-d0cce8723e2b.png)

## buy2

buy2在整个交易过程中承担下单的职责，一次完整的用户下单活动分成4个步骤完成：订单渲染、异步刷新、订单创建、创建外部支付单。

### 渲染

![](30c6d39b-632f-4ffc-8330-76358f53a1c3.png) ![](88bc04b9-9e2c-41f4-86a7-0b8d6f211666.png) ![](3f7f3e2a-322f-404b-a908-7dda38cac9ef.png)
- 渲染：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#renderOrder(long, com.alibaba.trade.client.model.param.render.RenderOrderParam, java.util.List<com.alibaba.trade.client.model.param.ParamValidator>)
	- 刷单校验：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#checkUserAntiBrush
		- 参数解析：com.alibaba.trade.open.component.parser.CommonParameterParserV2#makeupResult
		- 限流：com.alibaba.trade.buy.sentinel.confirm.ConfirmOrderSentinel
		- 渲染流程：
		- 构建ShoppingRequest：com.alibaba.trade.shared.model.shopping.ShoppingRequest#internalBuildShoppingRequest
			- 构建用户信息：com.alibaba.trade.shared.model.shopping.builder.impl.BuyerBuilder#build
				- uic获取用户数据：com.taobao.uic.common.service.userinfo.client.UicReadServiceClient#getUserInfoByUserId
						- 构建订单列表（orderLineSpecs）：com.alibaba.trade.shared.model.shopping.builder.impl.OrderLineBuilder#build
				- 查询商品：com.taobao.item.service.client.ItemQueryServiceClient#queryItemAndSkuListWithPvToTextWithCache(java.util.List<com.taobao.item.domain.query.ItemAndSkuIdDO>, com.taobao.item.domain.query.QueryItemOptionsDO)
								- 查类目：com.taobao.forest.service.cairo.StdCategoryServices#getStdCategory
								- 查spu：com.taobao.item.service.client.SpuReadServiceClient#getSpu(long)
								- 查mic门店：com.taobao.mitem.client.MicStoreClient#queryStore
								- 查询店铺：com.taobao.shopservice.core.client.ShopReadService#queryMiniShop(com.taobao.shopservice.core.client.query.QueryShopDO)
								- 查询创建好的预售订单：com.alibaba.trade.shared.model.shopping.builder.impl.OrderLineBuilder#findReusedOrder
								- 解析业务身份：com.alibaba.trade.shared.model.shopping.builder.impl.OrderLineBuilder#getBizCodeFromPluginV2
								- orderlineId由本地com.alibaba.trade.client.utils.SequenceGenerator生成
						- 构建收货地址：com.alibaba.trade.shared.model.shopping.builder.impl.AddressBuilder#build
				- 获取默认收货地址：com.taobao.uic.common.service.userinfo.client.UicDeliverAddressReadServiceClient#getDefaultDeliverAddrByUserId
								- 获取选择的收货地址：com.taobao.uic.common.service.userinfo.client.UicDeliverAddressReadServiceClient#getDeliverAddrById
						- 构建配置数据：com.alibaba.trade.shared.model.shopping.builder.impl.BusinessConfigBuilder#build
				- 填充买卖家账号数据：com.taobao.uic.common.service.userinfo.client.UicPaymentAccountReadServiceClient#getAccountByUserId(long)
								- 生效产品和商业能力：com.alibaba.trade.shared.model.shopping.builder.impl.BusinessConfigBuilder#buildOrderLineSpecsBusinessConfig
				- 渲染bpm（StandardBuyRenderingProcessV1.bpm）：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#performRenderProcess
			- 订单渲染初始化子流程（StandardBuyRenderInitProcessV1.bpm）：
				- 子订单初始化：com.alibaba.trade.client.order.init.TradeOrderRenderInitActivity#processRenderOrder
					- 购物车重复下单：com.alibaba.trade.functions.order.service.impl.TradeOrderInitDomainServiceImpl#checkDuplicated
								- 订单拆分前校验：com.alibaba.trade.client.order.validation.TradeOrderValidationRenderActivity#processValidationBeforeSplit(com.alibaba.trade.shared.model.shopping.ShoppingRequest<? extends com.alibaba.trade.client.model.param.PageParam>, com.alibaba.trade.shared.model.shopping.ShoppingResult)
					- 校验买卖家状态，比如冻结、CC、删除、处罚，并进行拆单前，业务对子订单对校验
								- 获取收货、发货方式：com.alibaba.trade.client.delivery.TradeDeliveryRenderingActivity#queryReceiveMethod
					- 获取发货方式：com.alibaba.trade.functions.delivery.service.TradeDeliverySendReceiveDomainService#obtainSendMethod
										- 获取用户收货地址列表：com.alibaba.trade.functions.delivery.v3.repository.impl.UserAddressRepositoryV3Impl#queryUicAddress
						- uic获取收货地址列表：com.taobao.uic.common.service.userinfo.client.UicDeliverAddressReadServiceClient#getDeliverAddrListByUserId
										- 查询物流站点：com.alibaba.delivery.client.service.client.DeliveryTradeServiceClient#queryGlobalService
								- 库存域.库存查询初始化：com.alibaba.trade.client.inventory.TradeInventoryRenderActivity#queryInventory
					- 查询库存：com.taobao.item.service.client.ItemQueryServiceClient#fillInventoryForItemWithReturn
										- 校验库存（优惠前）：com.alibaba.trade.functions.inventory.service.TradeInventoryDomainImpl#verifyInventoryQuantity
										- 查询区域限售：com.taobao.inventory.sic.service.client.regional.RegionalExtQueryClient#queryItemsRegionalExtForBuy
								- 价格域.商品价格初始化：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceInit
								- 资产域，资产初始化：com.alibaba.trade.client.userassets.TradeAssetsInitActivity#initUserAssets
								- 订单域.渲染初始化阶段结束：com.alibaba.trade.client.order.init.TradeOrderRenderInitActivity#initRenderOrderPhaseFinished
						- 是否含有有效订单：com.alibaba.trade.client.order.route.TradeOrderRouteActivity#hasValidateOrderLines
				- 子订单不为空
						- 优惠域.优惠信息获取：com.alibaba.trade.client.promotion.TradePromotionRenderingActivity#performPromotionQuery
				- 查ump货款优惠：com.taobao.xmp.core.service.client.PromotionReadServiceClient#findTradePromotion
					- com.taobao.xmp.core.service.IPromotionReadServiceSpi#findAllPromotion4ConfirmOrderForTmall
						- 价格域.优惠后价格调整：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceAfterPromotion
						- 订单域.订单拆单：com.alibaba.trade.client.order.split.TradeSplitOrderRenderingActivity#performOrderSpittingForInit
				- 其他域拆单：
					- 库存：com.alibaba.trade.functions.inventory.service.TradeInventoryDomainImpl#splitByStoreCode
										- 物流：com.alibaba.trade.functions.delivery.service.TradeDeliveryTransportDomainServiceImpl#splitByDelivery
								- 根据卖家、商品类型、业务身份、自定义等拆单：com.alibaba.trade.functions.order.service.impl.TradeOrderSplitDomainServiceImpl#performOrderSplit(com.alibaba.trade.shared.model.order.OrderGroup, com.alibaba.trade.functions.order.request.TradeOrderSplitReq))
								- 转换成订单组、赠品挂靠：com.alibaba.trade.shared.model.order.OrderGroup#toOrderLineGroups
						- 订单域.拆单完成后校验：com.alibaba.trade.client.order.validation.TradeOrderValidationRenderActivity#processValidationAfterSplit
				- 拆单后订单校验扩展点，包括区域限售：com.alibaba.business.product.sic.realization.SicGeneralTradeExt#performValidationAfterSplit
						- 库存域.减库存策略填充：com.alibaba.trade.client.inventory.TradeInventoryRenderActivity#setInventoryStrategy
				- 校验库存可购买数量：com.alibaba.trade.functions.inventory.service.TradeInventoryDomainImpl#verifyInventoryQuantity
								- 如拍减、付减、预扣超时
						- 限购域.限购数量检查：com.alibaba.trade.client.buylimit.TradeBuyLimitRenderingActivity#processLimitCheck
						- 查询bbq：com.tmall.bbq.service.RuleExecuteService#queryQualifications
				- bbq、优惠最大限购：com.alibaba.trade.functions.buylimit.ability.quantity.impl.MaxQuantityLimitAbilityImpl#checkLimit
								- 未付款订单限购：com.alibaba.trade.functions.buylimit.ability.quantity.impl.UnpaidQuantityLimitAbilityImpl#checkLimit
								- 门店限购：com.alibaba.trade.functions.buylimit.ability.quantity.impl.StoreLimitAbilityImpl#checkLimit
								- 倍数限购：com.alibaba.trade.functions.buylimit.ability.quantity.impl.MultipleQuantityLimitAbilityImpl#checkLimit
								- 最小限购：com.alibaba.trade.functions.buylimit.ability.quantity.impl.MinQuantityLimitAbilityImpl#checkLimit
						- 交付域.获取运送方式和运费：com.alibaba.trade.client.delivery.TradeDeliveryRenderingActivity#queryTransportMethod
				- 调用sdp：com.alibaba.asdp.client.AsdpTradeServiceClient#renderDeliveryOrders
						- 价格域.物流运费后价格调整：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceAfterDelivery
						- 资产域.为服务订单预查询资产：com.alibaba.trade.client.userassets.TradeAssetsRendingActivity#queryUserAssetsForService
						- 价格域.税费渲染计算：com.alibaba.trade.client.price.TradePriceRenderingActivity#calculateTaxPriceForRendering
				- 获取税费：com.alibaba.taxcenter.hsf.service.TaxInfoServiceV2#getTaxFeeForTrade
						- 订单域.服务子订单生成：com.alibaba.trade.client.order.serviceOrder.TradeServiceOrderRenderActivity#processServiceOrderGeneration
				- 调用tsp：com.taobao.trade.tsplatform.api.TradeService#getTradeServicePageInfo
								- 构造服务子订单：com.alibaba.trade.client.order.serviceOrder.TradeServiceOrderRenderActivity#dealServiceOrder
						- 价格域.商品价格调整：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceAdjustment
						- 优惠域.非货款优惠查询：com.alibaba.trade.client.promotion.TradePromotionRenderingActivity#performPromotionQueryBeyondItem
				- 邮费、税费类的优惠查询：com.taobao.xmp.core.service.client.PromotionReadServiceClient#findTradePromotion
					- com.taobao.xmp.core.service.IPromotionReadServiceSpi#findAllPromotion4ConfirmOrderForReward
						- 价格域.非货款优惠查询后价格调整：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceAfterQueryBeyondItemPromotion
						- 用户资产域.获取可用的用户资：com.alibaba.trade.client.userassets.TradeAssetsRendingActivity#queryUserAssets
				- 查fp：com.taobao.payment.service.PaymentServiceForBuy#checkAndUsePaymentForConfirm(long, com.taobao.payment.domain.request.FundQueryReqDTO)
						- 价格域.查询资产后价格调整：com.alibaba.trade.client.price.TradePriceRenderingActivity#processPriceAfterQueryAsset
						- 订单域.订单拆单最终处理：com.alibaba.trade.client.order.split.TradeSplitOrderRenderingActivity#performFinalOrderSplitting
				- 自定义最终拆单扩展点，如果发生拆单，需要重走流程，抛出：TradeRenderRestartException
						- 支付域.获取可用支付方式/金额/发票：com.alibaba.trade.client.payment.TradePaymentRenderingActivity#paymentRender
				- 匿名购买、realpay、代付、发票
						- 支付域.收银模式咨询：com.alibaba.trade.client.payment.TradeCashierModeConsultActivity#consultCashierMode
				- 前置收银，buy2暂无
						- 安全域.进行安全校验：com.alibaba.trade.client.security.TradeSecurityRenderingActivity#processSecurityRendering
				- 是否出验证码
						- 售后域.消保标签等：com.alibaba.trade.client.aftersale.TradeAfterSalesActivity#processAfterSalesRequest
				- 是否可评价、可分享、是否允许卖家签署消保协议以及维权、退款入口
						- 结算域.渲染前处理：com.alibaba.trade.client.settlement.TradeSettlementRenderActivity#processSettlementRender
				- uic获取分销商、品牌商账户
						- 订单域.最终校验\[重走流程\]：com.alibaba.trade.client.order.validation.TradeOrderValidationRenderActivity#processValidationBeforeRendering
				- 业务扩展点校验
						- 订单域.finalize：com.alibaba.trade.client.order.finalize.TradeOrderFinalizeRenderActivity#processRenderOrderFinalize
				- 组件数据填充：com.alibaba.trade.functions.order.service.impl.TradeOrderFinalizeDomainServiceImpl#processOrderRenderFinalize
								- 组件互斥：com.alibaba.trade.functions.order.service.impl.TradeOrderFinalizeDomainServiceImpl#finalizeMutexViewValidation
								- 调用tp3拿outid的sequence，避免渲染重复下单：com.alibaba.trade.shared.utils.OutIdGenerator#newOutIds
						- 视图层.视图转换：com.alibaba.trade.client.view.TradeViewConverterActivity#viewConverter
				- 下单2.0视图层转换域服务
		- 奥创转换：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#ultron2Process
		- 渲染日志：com.alibaba.trade.shared.tracelog.ConfirmOrderTraceBizLog#logTrace

### 创建

![](783d900e-2f77-422c-b791-74b3b7db8430.png) ![](a083d191-6e92-4744-8fca-87a85fa600ea.png) ![](90e8f6ac-4e15-4027-98d8-10ed1d67b93d.png)
- 创建：com.alibaba.trade.buy.service.TradeComponentServiceV2ImplWrapper#createOrderNewUltron
	- 组件回收：com.alibaba.trade.buy.new\_ultronage.gray.UltronGraySubmitProcess#collect
		- 防重复下单：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#checkDuplicated
		- 刷单校验：com.alibaba.trade.open.utils.AntiBrushUtils#checkUserAntiBrush(long, com.alibaba.trade.client.model.source.CreatingOrderSystem)
		- 限流：com.alibaba.trade.buy.sentinel.create.CreateOrderSentinel
		- 参数构建：com.alibaba.trade.buy.service.order.TradeOrderServiceImplWrapper#buildCreatingOrderParam
		- com.alibaba.trade.shared.model.shopping.ShoppingRequest#internalBuildShoppingRequest：和渲染一致
		- 创建流程（StandardBuyCreatingProcessV1.bpm）：
		- 订单域.订单初始化：com.alibaba.trade.client.order.init.TradeOrderCreatingInitActivity#processCreatingOrder
				- 是否只创建支付宝订单：com.alibaba.trade.client.order.route.TradeOrderRouteActivity#reCreateAlipayOrders
			- 如果是，则直接到支付域，生成checkout信息
				- 资产域.资产初始化：com.alibaba.trade.client.userassets.TradeAssetsInitActivity#initUserAssets 和渲染一致
				- 订单域.拆单前校验：com.alibaba.trade.client.order.validation.TradeOrderValidationCreatingActivity#processValidationBeforeSplit 和渲染一致
				- 交付域.获取收货/发货方式：com.alibaba.trade.client.delivery.TradeDeliveryCreatingActivity#confirmTransitAndDestination
			- 发货方式，以及收货地址，门店自提信息
				- 库存域.库存查询和校验：com.alibaba.trade.client.inventory.TradeInventoryCreateActivity#queryInventory
			- 查询库存和区域限售，调用方法和渲染一致
				- 价格域.初始化商品价格：com.alibaba.trade.client.price.TradePriceCreatingActivity#processPriceInit
			- 单价、数量、折扣等价格初始化
				- 优惠域.使用优惠计算：com.alibaba.trade.client.promotion.TradePromotionCreatingActivity#performPromotionUsing
			- 调用ump的using：com.taobao.xmp.core.service.client.PromotionReadServiceClient#usingPromotion
				- 远程调用：com.taobao.xmp.core.service.IPromotionReadServiceSpi#usingPromotionForTmall
				- 价格域.优惠计算后价格调整：com.alibaba.trade.client.price.TradePriceCreatingActivity#processPriceAfterPromotion
				- 交付域.获取运送方式和运费：com.alibaba.trade.client.delivery.TradeDeliveryCreatingActivity#confirmTransportMethod(com.alibaba.trade.shared.model.shopping.ShoppingRequest<com.alibaba.trade.client.model.param.creating.CreatingOrderParam>, com.alibaba.trade.shared.model.shopping.ShoppingResult)
			- 调用sdp：com.alibaba.asdp.client.AsdpTradeServiceClient#submitDeliveryOrders
				- 价格域.运费价格计算调整：com.alibaba.trade.client.price.TradePriceCreatingActivity#processPriceAfterDelivery
				- 用户资产域.使用UPP用户资产：com.alibaba.trade.client.userassets.TradeAssetsCreatingActivity#useUppUserAssets
				- 价格域.创建时税费计算：com.alibaba.trade.client.price.TradePriceCreatingActivity#calculateTaxPriceForCreating
			- 获取税费：com.alibaba.taxcenter.hsf.service.TaxInfoServiceV2#getTaxFeeForTrade
				- 服务订单处理子流程（StandardBuyServiceOrderProcessV1）
				- 库存域.设置减库存策略：com.alibaba.trade.client.inventory.TradeInventoryCreateActivity#setInventoryStrategy 和渲染一致
				- 限购域.限购数量检查：com.alibaba.trade.client.buylimit.TradeBuyLimitCreatingActivity#processLimitCheck 和渲染一致
				- 优惠域.使用非货款优惠：com.alibaba.trade.client.promotion.TradePromotionCreatingActivity#performPromotionUsingBeyondItem
			- 调用ump的using：com.taobao.xmp.core.service.client.PromotionReadServiceClient#usingPromotion
				- 远程调用：com.taobao.xmp.core.service.IPromotionReadServiceSpi#usingPromotionForReward
				- 价格域.非货款优惠后价格调整：com.alibaba.trade.client.price.TradePriceCreatingActivity#processPriceAfterUsingBeyondItemPromotion
				- 用户资产域.用户资产预扣：com.alibaba.trade.client.userassets.TradeAssetsCreatingActivity#useUserAssets
			- 调用fp：com.taobao.payment.service.PaymentServiceForBuy#checkAndUsePayment(long, com.taobao.payment.domain.request.FundQueryReqDTO)
				- 价格域.商品价格调整：com.alibaba.trade.client.price.TradePriceCreatingActivity#processPriceAdjustment
				- 支付域.提交支付方式/金额/发票：com.alibaba.trade.client.payment.TradePaymentCreatingActivity#paymentCreate
			- 设置支付相关参数，如匿名购买、发票、折扣后金额
				- 支付域.收银模式确认：com.alibaba.trade.client.payment.TradeCashierModeConsultActivity#confirmCashierMode
				- 售后域.维权/消保标签：com.alibaba.trade.client.aftersale.TradeAfterSalesActivity#processAfterSalesRequest 和渲染一致
				- 超时域.生成超时信息：com.alibaba.trade.client.timeout.TradeTimeoutCreatingActivity#generateOrderTimeoutInfo
			- 走业务扩展点获取定制超时：com.alibaba.trade.functions.timeout.service.TradeTimeoutDomainServiceImpl#getOrderLineGroupTimeouts
				- 结算域.生成结算信息：com.alibaba.trade.client.settlement.TradeSettlementCreatingActivity#processSettlement
			- 设置结算分账数据
				- 订单域.订单保存前校验：com.alibaba.trade.client.order.validation.TradeOrderValidationCreatingActivity#processValidationBeforeSaving
			- 业务扩展点校验订单和订单组的有效性
				- 安全域.进行安全校验：com.alibaba.trade.client.security.TradeOrderSecurityCreatingActivity#processSecurityValidation
			- 调用mtee：com.taobao.mtee.service.RequestService#invoke
				- 订单域.快照生成：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#generateOrderSnapshot
			- 生成子订单商品快照：com.alibaba.trade.functions.order.ability.saving.OrderSavingBusinessExt#customizeDetailOrderSnapshotDO
						- 生成主订单和优惠快照：com.alibaba.trade.functions.order.service.impl.TradeOrderSavingDomainServiceImpl#buildOrderLineGroupSnapshot
				- 订单域.生成待保存订单信息：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#processOrderConvert
			- 调用tp3生成订单号：com.alibaba.trade.shared.external.tradeplatform.TradeOrderSavingService#generateBizOrderIds
						- 调用tp3生成关联订单号：com.alibaba.trade.shared.utils.OutIdGenerator#newOutIds
						- 业务扩展点打标：com.alibaba.trade.functions.order.service.impl.TradeOrderSavingDomainServiceImpl#loadCustomizedOrderSavingInfo
						- 生成订单对象：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#convertMainOrder
				- 交付域.生成履行合约：com.alibaba.trade.client.delivery.TradeDeliveryCreatingActivity#createDeliveryContract
			- 走履约平台的合约数据
				- 是否CreateEnable合并：com.alibaba.trade.client.order.route.TradeOrderRouteActivity#isOneStepCeatingAndEnablingOrders
			- 一步创建：先扣减资源，再创建
						- 两步创建：先创建，再扣减资源，再enable订单
				- 订单域.一步创建订单：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#processOneStepCreate
			- 主子订单打上cvb一步创建标
				- 资源扣减流程（StandardBuyResourceReduceV1）
			- 交付域.物流资源扣：com.alibaba.trade.client.delivery.TradeDeliveryReducingActivity#reduce
				- 调用sdp扣减：com.alibaba.asdp.client.AsdpTradeServiceClient#occupyLogisticsResources
						- 库存域.预扣/扣减：com.alibaba.trade.client.inventory.TradeInventoryCreateActivity#reduce
				- 扣减库存：com.taobao.item.service.client.InventoryBidServiceClient#mixReduceInventory(java.util.List<com.taobao.inventory.client.domain.dto.InventoryTradeDTO>, com.taobao.item.domain.AppInfoDO)
						- 优惠域.优惠扣减：com.alibaba.trade.client.promotion.TradePromotionReducingActivity#reduce
				- 扣减优惠：com.taobao.xmp.core.service.client.PromotionWriteServiceClient#dealAfterPromotion
					- 远程调用：com.taobao.xmp.core.service.IUnitPromotionWriteServiceSpi#dealAfterPromotion
						- 限购域.BBQ资源扣减：com.alibaba.trade.client.buylimit.TradeBuyLimitCreatingActivity#reduce
				- 限购扣减：com.tmall.bbq.service.RuleExecuteService#proceedRule
						- 用户资产域.用户资产扣减：com.alibaba.trade.client.userassets.TradeAssetsCreatingActivity#reduce
				- 调用fp冻结资产；com.taobao.payment.service.PaymentServiceForBuy#freezePayment(long, com.taobao.payment.domain.request.FundFreezeReqDTO)
						- 订单域.Enabling打标： com.alibaba.trade.client.aftercreated.TradeEnablingAttributeActivity#reduce
				- 订单域.订单保存：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#processOrderSaving
			- 保存关联订单垂直表：com.alibaba.trade.client.order.saving.UsingOrderGroupHandle#handle
						- 调用tp3创建订单：com.taobao.trade.platform.api.unit.write.BuyOrderStoreService#createBizOrderAttributeForOrderGroup
				- 单笔创建：com.alibaba.trade.fulfillment.api.unit.write.BuyOrderStoreServiceV3#syncCreateWithAttr
								- 批量创建：com.alibaba.trade.fulfillment.api.unit.write.BuyOrderStoreServiceV3#batchCreateWithAttribute
				- 支付域.生成Checkout信息：com.alibaba.trade.client.payment.TradePaymentCreatingActivity#buildCheckoutInformation
			- 设置支付后链接、是否需要支付宝支付等参数
				- 构建流程返回结果：com.alibaba.trade.client.order.finalize.TradeOrderFinalizeCreatingActivity#buildCreatingProcessResult
		- enable流程（StandardBuyEnablingProcessV1.bpm）
		- 订单域.订单Enable：com.alibaba.trade.client.order.saving.TradeOrderSavingActivity#processOrderEnabling
			- 写tair防重复下单：com.alibaba.trade.functions.order.service.impl.TradeOrderEnablingDomainServiceImpl#writeCartId2Tair
						- enable订单，一步创建跳过enable：com.taobao.trade.platform.api.unit.write.BuyOrderStoreService#syncEnableOrderBatch(long, java.util.List<java.lang.Long>, java.util.Map<java.lang.Long,java.util.Map<java.lang.String,java.lang.String>>, com.taobao.tc.domain.dataobject.FaceLogDO)
						- 预售保存订单：com.alibaba.business.trade.china.presale.realization.tail.trade.order.create.PreSaleTailOrderCreateExt#internalCustomizeUpdateOrderAfterSaving
						- 调用tp3批量保存：com.alibaba.trade.fulfillment.api.unit.write.BuyOrderStoreServiceV3#batchUpdateOrderInfo
				- 支付域.生成安全验证/支付链接：com.alibaba.trade.client.payment.TradePaymentCreatingActivity#generatePayUrl
			- 批量支付：com.taobao.trade.platform.api.unit.write.PayOrderUnitService#batchPay(long, com.taobao.tc.domain.dataobject.BizOrderDO\[\])
						- 单笔支付：com.taobao.trade.platform.api.unit.write.PayOrderUnitService#pay
				- 订单域.Enabling订单Finalize：com.alibaba.trade.client.order.finalize.TradeOrderFinalizeCreatingActivity#processCreatingOrderFinalize
		- 处理废单：com.alibaba.trade.buy.scenario.TradeScenarioServiceImpl#processFailOrders
		- 创建日志：com.alibaba.trade.shared.tracelog.CreatingOrderTraceBizLog#logTrace(long, com.alibaba.trade.client.service.creatingOrder.request.CreatingOrderRequest, com.alibaba.trade.shared.model.shopping.ShoppingRequest<com.alibaba.trade.client.model.param.creating.CreatingOrderParam>, com.alibaba.trade.shared.model.shopping.ShoppingResult, long, java.lang.Throwable)

## 数据流向

### 数据结构

![](acbd29aa-083c-43bf-bb13-64e22875be0b.png)

上面是交易订单数据的基础数据结构。

- 主订单：定义为一组买、卖家的一次交易行为的履行单元。
- 子订单：和主订单结构一致，在主订单的基础上，按商品sku维度拆分后的交易履行单元。内容包括交易合同的基本信息（交易状态、商品信息、购买数量、交易条款）和交易履行的记录。
- 支付订单：交易履行过程中，定义和记录支付行为的数据结构。和主订单一一对应，对应一笔外部支付单。
- 交付订单：交易履行过程中，定义和记录交付行为的数据结构。和主订单一一对应，对应一笔菜鸟物流单。
- 资金明细：担保户中款项的流转记录。
- 子交付订单：多次交付的场景下，对应一次交付行为的记录。
- 子阶段订单：多阶段情况下，对应单个阶段的订单信息。

### 具体流向

创建的订单数据，会通过消息消费、hsf消费、精卫迁移、tt迁移、数据库同步。

![](d4ada703-0394-44be-ac8f-9d5c0a7d1918.png)

## 限流策略

双十一保障的60w/s创单峰值的同时，限流是必不可少的。在脉冲的一波，流量都会高过限流值，很容易会出现如下的前方拥堵文案。buy2的限流主要靠三块保障：aserver限流、buy2霸下、buy2sentinel。

![](40c50394-865c-4a3e-bd2f-d69ae1f20ff2.png)

## aserver

aserver-buy2-pc-wireless-buildorder: 389w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 流量比例 | 0.267 | 0.183 | 0.183 | 0.167 | 0.167 | 0.033 | 100% |
| 容器数量 | 1960 | 815 | 820 | 599 | 890 | 1134 |  |
| 单机限流 | 500 | 900 | 900 | 1000 | 750 | 150 |  |
| 单元容量 | 980000 | 733500 | 738000 | 599000 | 667500 | 170100 | 3888100 |

aserver-buy2-pc-wireless-createorder: 131w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 流量比例 | 0.267 | 0.183 | 0.183 | 0.167 | 0.167 | 0.033 | 100% |
| 容器数量 | 1960 | 815 | 820 | 599 | 890 | 1134 |  |
| 单机阈值 | 170 | 300 | 300 | 350 | 250 | 50 |  |
| 单元容量 | 333200 | 244500 | 246000 | 209650 | 222500 | 56700 | 1312550 |

aserver-pc-buildorder:3w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aserver单元容量 | 9000 | 4800 | 4800 | 4500 | 4500 | 3000 | 30600 |

aserver-pc-createrorder:1w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aserver单元容量 | 3000 | 1600 | 1600 | 1500 | 1500 | 1000 | 10200 |

aserver-h5-buildorder:3.3w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aserver单元容量 | 6000 | 4500 | 4500 | 3000 | 6000 | 9000 | 33000 |

aserver-h5-createorder:1.1w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aserver单元容量 | 2000 | 1500 | 1500 | 1000 | 2000 | 3000 | 11000 |

## buy2

### 霸下

buy2-pc-wireless-buildorder:213w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 流量比例 | 0.267 | 0.183 | 0.183 | 0.167 | 0.167 | 0.033 | 100% |
| 容器数量 | 7756 | 5500 | 4856 | 4422 | 5000 | 900 |  |
| 单机阈值 | 75 | 75 | 75 | 75 | 75 | 75 |  |
| 单元容量 | 581700 | 412500 | 364200 | 331650 | 375000 | 67500 | 2132550 |

buy2-pc-wireless-createorder:71w

| 单元 | center | une1 | unn1 | unzbmix | unzbmix25g | unsh | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 流量比例 | 0.267 | 0.183 | 0.183 | 0.167 | 0.167 | 0.033 | 100% |
| 容器数量 | 7756 | 5500 | 4856 | 4422 | 5000 | 900 |  |
| 单机阈值 | 25 | 25 | 25 | 25 | 25 | 25 |  |
| 单元容量 | 193900 | 137500 | 121400 | 110550 | 125000 | 22500 | 710850 |

### sentinel

现货渲染：98w

现货创建：60w

定金渲染：90w

定金创建：24w

预售：38w

单品：8500

| 机房 | 流量占比 | 预期渲染 | 预期创建 | 预期尾款 | 渲染单机限流 | 创建单机限流 | 日常单品限流 | 大促单品限流 | 预售单机限流 | 定金渲染限流 | 定金创建限流 | 机器数 | 实际渲染 | 实际创建 | 日常单品限流 | 大促单品限流 | 预售尾款 | 定金渲染限流 | 定金创建限流 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| center.na610 | 13.33% | 130667 | 80000 | 50400 | 33.8 | 20.7 | 0.5 | 0.3 | 13.2 | 66.5 | 18.2 | 3878 | 131076.4 | 80274.6 | 1939 | 1163.4 | 51189.6 | 257887 | 70579.6 |
| center.na620 | 13.33% | 130667 | 80000 | 50400 | 33.8 | 20.7 | 0.5 | 0.3 | 13.2 | 66.5 | 18.2 | 3872 | 130873.6 | 80150.4 | 1936 | 1161.6 | 51110.4 | 257488 | 70470.4 |
| na610.unzbmix | 16.67% | 163334 | 100000 | 63000 | 37.1 | 22.7 | 0.5 | 0.3 | 14.4 | 72.7 | 19.9 | 4417 | 163870.7 | 100265.9 | 2208.5 | 1325.1 | 63604.8 | 321115.9 | 87898.3 |
| na62.unzbmix25g | 16.67% | 163334 | 100000 | 63000 | 32.9 | 20.1 | 0 | 0.3 | 12.8 | 0 | 0 | 4970 | 163513 | 99897 | 0 | 1491 | 63616 | 0 | 0 |
| ea119.unsh | 3.33% | 32667 | 20000 | 12600 | 36.3 | 22.2 | 0.5 | 0.3 | 14.3 | 72.1 | 19.7 | 891 | 32343.3 | 19780.2 | 445.5 | 267.3 | 12741.3 | 64241.1 | 17552.7 |
| ea118.une1 | 18.33% | 179667 | 110000 | 69300 | 32.7 | 20.1 | 0 | 0.3 | 12.8 | 0 | 0 | 5490 | 179523 | 110349 | 0 | 1647 | 70272 | 0 | 0 |
| ea118.unn1 | 18.33% | 179667 | 110000 | 69300 | 36.9 | 22.6 | 0 | 0.3 | 14.4 | 0 | 0 | 4860 | 179334 | 109836 | 0 | 1458 | 69984 | 0 | 0 |
| 总 | 100.00% | 980000 | 600000 | 378000 |  |  |  |  |  |  |  | 28378 | 980534 | 600553.1 | 6529 | 8513.4 | 382518.1 | 900732 | 246501 |

## 0点成功率

在大促零点时，会有大量渲染、创建流量进入。将一些明确知道下单会出错的请求，在Sentinel限流之前进行拦截，抛出特定错误码处理，提高0点下单的成功率。

### 链路

![](b89c3f7a-2991-4bff-af34-c05496706f8c.png)

### 防刷拦截

#### 含义

针对错误码，将一些疑似刷单的用户，放入tair中累计。当累加次数超过一定阈值之后，拦截请求。

#### 开关

openCheckNewAntiBrush：开启防刷校验

openNewAntiBrush：更新刷单次数

#### 日志

/home/admin/buy2/logs/misc/buy-anti-brush.log

#### 刷单累加逻辑

代码：com.alibaba.trade.open.utils.AntiBrushUtils#countOneTracer

![](7c82395c-47c7-4a5e-95c9-4022a302193d.png)

创建或者渲染过程中，如果出现错误，针对疑似刷单的错误码集合，累加到tair中。失效时间是1分钟。错误码集合，在diaomond中配置。dataID=safety.anti.brush.trace.code，groupID=safety。拦截的错误码是：BLOCKED\_BY\_MTEE

BUYER\_IS\_PUNISHED

ANTI\_BRUSH\_ERROR

HOT\_ITEM\_CAN\_NOT\_BUY

HOT\_ITEM\_WIRELESS\_PATH\_ERROR

HOT\_ITEM\_H5\_PATH\_ERROR

HOT\_ITEM\_PATH\_NOT\_FROM\_DETAIL

HOT\_ITEM\_PC\_PATH\_ERROR

BUYER\_TOO\_MANY\_UNPAID\_ORDERS

CUSTOM\_REASON\_CANNOT\_BUY\_C

CUSTOM\_REASON\_CANNOT\_BUY

F-10001-01-16-020

F-10001-01-16-021

P-02305-11-16-004

P-02305-02-16-009

P-02305-11-16-003

407

#### 刷单校验逻辑

代码：com.alibaba.trade.open.utils.AntiBrushUtils#checkUserAntiBrush(long)

![](74d0714e-8b3e-4d3f-bcea-112a851354b1.png)

根据用户id，从tair中取出疑似刷单的数据。如果超过5次，将拦截该次请求。同时，如果在拦截期间内再次请求，将会延长拦截时间。

### 商品拦截

#### 含义

针对请求中下架或者售罄的商品，放入tair中。下次请求提前拦截。一般在大促0点到15分钟才会开启。

#### 开关

successRateOptimizeOnDouble11：开启大促成功率优化

successRateOptimizeStartTime：优化开始时间

successRateOptimizeEndTime：优化结束时间

filterInvalidItemOptimizeForOnDouble11：开启商品拦截功能

#### 日志

/home/admin/buy2/logs/service-trace/double11OptimizeLog.log

#### 商品失效记录逻辑

代码：com.alibaba.trade.shared.valve.SuccessRateOptimizeRuleValve#bizStore

![](1adcf2dd-a570-4212-96b4-9db5850c779f.png)

有两个判断类：

- InvalidItemOptimizeValve：针对下架或者售罄的商品，限流前进行拦截。
- XflushInvalidItemOptimizeValve：通过diamond推送，针对xflush监控统计的失效商品，在限流前进行请求拦截。这个从来没有使用过。

调用源有两个：

- com.alibaba.trade.functions.inventory.service.TradeInventoryDomainImpl#double11Optimize 查询库存时，将库存为0的商品记录到tair中，进行前置校验。失效时间为15s。
- com.alibaba.trade.functions.order.ability.validation.itemValidation.impl.SkuValidator#logItemStatus 拆单校验时，查询商品信息。如果是下架或者删除状态，进行前置校验。失效时间为15min。

#### 商品失效校验逻辑

代码：com.alibaba.trade.shared.valve.SuccessRateOptimizeRuleValve#bizCheck

校验请求的商品是否在指定的tair中。

#### 白名单商品标

2178:区域销售

13186:天猫国际商品,

28033:门店自提,

277698:周期送,

120321:前端商品单仓卖家标,

120257:前端商品多仓卖家标,

68289:确定性时效商家寻源方式-多边形,

242242:门店经纬度路由商品标,

202626:时效表达标,

209666:库存前置分单商品标.

28482:全渠道线上线下,

28546:纯线下（只有线下O2O销售）,

268290:火凤凰商品.

102209：村淘线下门店

75905：天猫优品

191361：完美履约

1528706：完美履约

188545：同城购

456450:多级时效

### 优惠拦截

#### 含义

若渲染在大促前，创单在大促活动中，这种情况下提交订单会不带有大促优惠，因而影响成功率，拦截该请求。

#### 开关

double11PromotionItemTagCheckTime：本次大促开始时间

#### 日志

/home/admin/buy2/logs/service-trace/promotionItemTagCheck.log

#### 渲染逻辑

代码：com.alibaba.trade.functions.security.utils.PromotionCheckUtils#checkPromotion

![](c79a11e6-9888-47af-912f-e02a86d55f93.png)

在渲染时，校验商品是否是大促优惠商品。判断逻辑是：商品报名参加大促，且大促活动在UMP的diamond配置中：dataID：com.taobao.ump.diamond.sa\_campaign\_date、groupID：UMP。取出商品大促时间，校验时间double11PromotionItemTagCheckTime如果在UMP配置的大促时间中，则有大促单品优惠。

如果上述判断成功，则在下发时，带上校验参数和渲染时间，\_\_prom\_itm\_chk\_\_、\_\_prom\_itm\_time\_\_：代码在com.alibaba.trade.functions.security.transformer.requestComplement.Double11PromItemTagChkReqFiller#complement

#### 优惠校验逻辑

代码：com.alibaba.trade.buy.new\_ultronage.datachecker.Double11PromItemTagDataCheckerV2#checkData

![](e3f5fce2-48e1-451d-b5e1-2b1da570aa34.png)

在提交订单后，组件回收阶段，判断上面下发的字段。若渲染在大促前，创单在大促活动中，这种情况下提交订单会不带有大促优惠，拦截该请求。

### 拦截前置

#### 含义

将下架和库存不足的商品，提前前置到霸下进行拦截，不用到达buy2应用。

#### 日志

/home/admin/buy2/logs/double11OptimizeData.log

#### 采集规则

buy2\_double11optimize\_tmd

![](9d18ad95-43ee-4ee3-9360-fa38e744f31d.png)

#### 前置逻辑

代码：com.alibaba.trade.functions.security.valve.InvalidItemOptimizeValve#logInvalidItem

![](3b5a3095-b310-4141-ad1c-864c5494077e.png)
- 在buy2侧，会将下架和库存不足的商品，记录到日志中。
- tlog会采集记录的日志。
- 针对0点成功率优化的商品，tlog发送metaq消息：FOURIER\_METAQ\_PUNISH。
- 前置安全应用，接到metaq消息之后，将提前拦截该商品的下单请求。

最后附上文中buy2链路大图

##### buy2大图.xmind

718.7KB

中