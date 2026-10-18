package com.elderly.care.security;

import com.elderly.care.config.JwtUtil;
import com.elderly.care.entity.User;
import com.elderly.care.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * JWT 鉴权过滤器（对应原 Node 版 authenticateToken 中间件）：
 * 1. 白名单路径直接放行：登录 / 注册 / 用户列表 / 公开订单 / 图片上传 / 静态图片
 * 2. 其余接口必须携带 Authorization 头（小程序发送的是原始 token），校验失败返回 {code:401}
 * 3. 校验通过后把 userId 放入请求属性，Controller 通过 request.getAttribute("userId") 获取
 * 注：参数上的 @NonNull 与父类方法签名保持一致（Spring 空值契约）
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    /** 无需登录的公开路径（前缀匹配以 / 结尾的项） */
    private static final String[] PUBLIC_PATHS = {
            "/api/user/login",
            "/api/user/register",
            "/api/user/wechat-login",
            "/api/user/wechat-bind",
            "/api/user/phone-login",
            "/api/user/list",
            "/api/orders/public",
            "/api/orders/evaluations",
            "/api/orders/type-stats",
            "/api/upload",
            "/uploads/"
    };

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {
        // CORS 预检请求直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();
        if (isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }

        String token = request.getHeader("Authorization");
        if (token == null || token.isBlank()) {
            writeError(response, 401, "请先登录");
            return;
        }
        // 兼容 "Bearer xxx" 前缀写法（小程序端发送的是原始 token）
        if (token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        try {
            Long userId = jwtUtil.parseUserId(token);

            // token 有效但用户已被删除（如测试账号清理）→ 视为登录过期
            User loginUser = userRepository.findById(userId).orElse(null);
            if (loginUser == null) {
                writeError(response, 401, "登录已过期，请重新登录");
                return;
            }
            // 账号被禁用（社区管理员启停普通用户/互助员、超管启停管理员）→ 拒绝访问
            if (Integer.valueOf(0).equals(loginUser.getStatus())) {
                writeError(response, 403, "账号已被禁用，请联系社区管理员");
                return;
            }

            // 管理接口（/api/admin/**）额外校验角色：管理员/民政管理员/超级管理员
            if (path.startsWith("/api/admin/")) {
                User admin = userRepository.findById(userId).orElse(null);
                boolean isAdminRole = admin != null && ("管理员".equals(admin.getRole())
                        || "民政管理员".equals(admin.getRole())
                        || "超级管理员".equals(admin.getRole()));
                if (!isAdminRole) {
                    writeError(response, 403, "无管理员权限");
                    return;
                }
                // 角色放入请求属性，Controller 按角色细分权限（民政管理员只读）
                request.setAttribute("role", admin.getRole());
            }

            request.setAttribute("userId", userId);
            chain.doFilter(request, response);
        } catch (Exception e) {
            writeError(response, 401, "登录已过期，请重新登录");
        }
    }

    private boolean isPublic(String path) {
        for (String p : PUBLIC_PATHS) {
            if (p.endsWith("/")) {
                if (path.startsWith(p)) {
                    return true;
                }
            } else if (path.equals(p)) {
                return true;
            }
        }
        return false;
    }

    private void writeError(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(200);
        response.setContentType("application/json;charset=UTF-8");
        String json = "{\"code\":" + code + ",\"message\":\"" + message + "\"}";
        response.getOutputStream().write(json.getBytes(StandardCharsets.UTF_8));
    }
}
