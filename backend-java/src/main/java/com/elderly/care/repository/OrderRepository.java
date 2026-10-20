package com.elderly.care.repository;

import com.elderly.care.entity.Order;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 订单表数据访问
 */
public interface OrderRepository extends JpaRepository<Order, String> {

    /** 订单广场：待接单且非本人发布的订单（按发布时间倒序） */
    List<Order> findByStatusKeyAndIsDeletedAndUserIdNotOrderByCreatedAtDesc(
            String statusKey, Integer isDeleted, Long userId, Pageable pageable);

    /** 我的订单（我发布的 + 我接的），可选按状态过滤 */
    @Query("select o from Order o where o.isDeleted = 0 and (o.userId = :uid or o.helperId = :uid) order by o.createdAt desc")
    List<Order> findMine(@Param("uid") Long uid);

    @Query("select o from Order o where o.isDeleted = 0 and (o.userId = :uid or o.helperId = :uid) and o.statusKey = :status order by o.createdAt desc")
    List<Order> findMineByStatus(@Param("uid") Long uid, @Param("status") String status);

    /** 公开订单（H5/对外公示用） */
    @Query("select o from Order o where o.isDeleted = 0 order by o.createdAt desc")
    List<Order> findPublicAll(Pageable pageable);

    @Query("select o from Order o where o.isDeleted = 0 and o.statusKey = :status order by o.createdAt desc")
    List<Order> findPublicByStatus(@Param("status") String status, Pageable pageable);

    /** 公开评价列表：已完成且已评价的订单（陪诊页信任感展示用） */
    List<Order> findByIsDeletedAndStatusKeyAndEvaluated(Integer isDeleted, String statusKey, Integer evaluated, Pageable pageable);

    /** 行锁查询：确认完成结算等并发场景使用 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") String id);

    /** 管理后台订单搜索：按状态 + 服务类型 + 关键词（订单号/服务类型/地址）分页查询 */
    @Query("select o from Order o where o.isDeleted = 0 " +
            "and (:status is null or o.statusKey = :status) " +
            "and (:type is null or o.type = :type) " +
            "and (:kw is null or o.id like concat('%',:kw,'%') or o.type like concat('%',:kw,'%') or o.address like concat('%',:kw,'%') or o.helper like concat('%',:kw,'%')) " +
            "order by o.createdAt desc")
    List<Order> adminSearch(@Param("status") String status, @Param("type") String type, @Param("kw") String kw, Pageable pageable);

    @Query("select count(o) from Order o where o.isDeleted = 0 " +
            "and (:status is null or o.statusKey = :status) " +
            "and (:type is null or o.type = :type) " +
            "and (:kw is null or o.id like concat('%',:kw,'%') or o.type like concat('%',:kw,'%') or o.address like concat('%',:kw,'%') or o.helper like concat('%',:kw,'%'))")
    long adminCount(@Param("status") String status, @Param("type") String type, @Param("kw") String kw);

    /** 通用类型统计：按服务类型 + 状态计数 */
    long countByTypeAndStatusKeyAndIsDeleted(String type, String statusKey, Integer isDeleted);

    /** 通用类型统计：某类型今日新增 */
    @Query("select count(o) from Order o where o.isDeleted = 0 and o.type = :type and o.createdAt >= :since")
    long countCreatedSinceByType(@Param("type") String type, @Param("since") LocalDateTime since);

    /** 通用类型统计：某类型已完成订单累计时间币 */
    @Query("select coalesce(sum(o.reward), 0) from Order o where o.isDeleted = 0 and o.type = :type and o.statusKey = 'completed'")
    long sumCompletedRewardByType(@Param("type") String type);

    /** 通用类型趋势：某类型某时间之后的发布/完成订单 */
    List<Order> findByIsDeletedAndTypeAndCreatedAtGreaterThanEqual(Integer isDeleted, String type, LocalDateTime since);

    List<Order> findByIsDeletedAndTypeAndCompletedAtGreaterThanEqual(Integer isDeleted, String type, LocalDateTime since);

    /** 按状态统计数量 */
    long countByStatusKeyAndIsDeleted(String statusKey, Integer isDeleted);

    /** 用户参与的已完成订单数（作为下单人或互助员，实时统计替代存量 service_count 列） */
    @Query("select count(o) from Order o where o.isDeleted = 0 and o.statusKey = 'completed' and (o.userId = :uid or o.helperId = :uid)")
    long countCompletedByUser(@Param("uid") Long uid);

    /** 互助员真实评分均值（仅统计已评价订单；从未被评价返回 null，前端显示「暂无」） */
    @Query("select avg(o.rating) from Order o where o.isDeleted = 0 and o.helperId = :uid and o.rating is not null")
    Double avgRatingByHelper(@Param("uid") Long uid);

    /** 用户人民币消费累计（陪诊订单已支付金额合计，未支付/已退款不计入） */
    @Query("select coalesce(sum(o.rmbAmount), 0) from Order o where o.isDeleted = 0 and o.userId = :uid and o.assetType = 'rmb' and o.payStatus = 'paid'")
    BigDecimal sumRmbSpentByUser(@Param("uid") Long uid);

    /** 已完成订单按参与人分组计数（批量场景用，key=userId / key=helperId） */
    @Query("select o.userId, count(o) from Order o where o.isDeleted = 0 and o.statusKey = 'completed' group by o.userId")
    List<Object[]> countCompletedGroupByUser();

    @Query("select o.helperId, count(o) from Order o where o.isDeleted = 0 and o.statusKey = 'completed' and o.helperId is not null group by o.helperId")
    List<Object[]> countCompletedGroupByHelper();

    /** 互助员进行中订单数（服务中 + 待确认，并发订单数上限校验用） */
    long countByHelperIdAndStatusKeyInAndIsDeleted(Long helperId, List<String> statusKeys, Integer isDeleted);

    /** 今日新增订单数 */
    @Query("select count(o) from Order o where o.isDeleted = 0 and o.createdAt >= :since")
    long countCreatedSince(@Param("since") LocalDateTime since);

    /** 超时兜底扫描：待接单且发布时间早于阈值（升序，先超时的先处理） */
    List<Order> findByStatusKeyAndIsDeletedAndCreatedAtBeforeOrderByCreatedAtAsc(
            String statusKey, Integer isDeleted, LocalDateTime threshold);

    /** 服务超时提醒扫描：服务中且未提醒过的订单 */
    List<Order> findByStatusKeyAndIsDeletedAndTimeoutNotified(String statusKey, Integer isDeleted, Integer timeoutNotified);

    /** 某类型已完成订单（按子类型统计销量用） */
    List<Order> findByIsDeletedAndTypeAndStatusKey(Integer isDeleted, String type, String statusKey);

    /** 统计用：某时间之后发布/完成的订单 */
    List<Order> findByIsDeletedAndCreatedAtGreaterThanEqual(Integer isDeleted, LocalDateTime since);

    List<Order> findByIsDeletedAndCompletedAtGreaterThanEqual(Integer isDeleted, LocalDateTime since);
}
