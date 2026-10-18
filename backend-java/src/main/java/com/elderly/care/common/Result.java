package com.elderly.care.common;

/**
 * 统一响应结构 { code, message, data }
 * 与原 Node 版保持一致：code=0 成功，401 未登录，403 无权限，404 不存在，400 参数错误，500 服务器错误
 */
public class Result<T> {

    private int code;
    private String message;
    private T data;

    public Result() {
    }

    public Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    /** 成功（无消息） */
    public static <T> Result<T> ok(T data) {
        return new Result<>(0, null, data);
    }

    /** 成功（带消息） */
    public static <T> Result<T> ok(String message, T data) {
        return new Result<>(0, message, data);
    }

    /** 失败 */
    public static <T> Result<T> error(int code, String message) {
        return new Result<>(code, message, null);
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
