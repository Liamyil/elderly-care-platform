package com.elderly.care;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 智慧互助养老平台后端启动类
 * 技术栈：SpringBoot 3 + Spring Data JPA + MySQL + JWT
 */
@SpringBootApplication
@EnableScheduling
public class CareApplication {

    public static void main(String[] args) {
        SpringApplication.run(CareApplication.class, args);
    }
}
