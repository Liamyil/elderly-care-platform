package com.elderly.care.repository;

import com.elderly.care.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 用户表数据访问
 */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByPhone(String phone);

    boolean existsByPhone(String phone);

    /** 按微信 openid 查用户（绑定校验：一个 openid 只能绑一个账号） */
    Optional<User> findByOpenid(String openid);

    /** 行锁查询：时间币扣减/增加等并发场景使用，防止超扣 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /** 按角色查用户（管理后台指派互助员时使用） */
    List<User> findByRoleOrderByIdAsc(String role);

    /** 全平台时间币存量合计（统计看板用） */
    @Query("select coalesce(sum(u.timeCoins), 0) from User u")
    Long sumAllCoins();
}
