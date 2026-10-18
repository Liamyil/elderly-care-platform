package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.config.AppConfig;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 图片上传与访问：
 * 1. POST /api/upload：多图上传（最多3张），压缩为 800px JPG（对应原版 sharp 压缩）
 * 2. GET /uploads/{filename}：访问图片（原版 express.static 的替代实现）
 */
@RestController
public class UploadController {

    private static final int MAX_IMAGES = 3;
    private final AppConfig appConfig;
    private final Random random = new Random();

    public UploadController(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    /** 上传图片（公开接口，与原版一致） */
    @PostMapping("/api/upload")
    public Result<List<String>> upload(@RequestParam("images") MultipartFile[] files) {
        try {
            if (files == null || files.length == 0) {
                return Result.error(400, "请选择图片");
            }
            if (files.length > MAX_IMAGES) {
                return Result.error(400, "最多上传3张图片");
            }

            File uploadDir = new File(appConfig.uploadDirAbsolute());
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }

            List<String> urls = new ArrayList<>();
            for (MultipartFile file : files) {
                // 统一输出为 .jpg 扩展名（压缩后实际就是 JPEG 格式，避免扩展名与内容不一致）
                String compressedName = "compressed_" + System.currentTimeMillis() + "-" + random.nextInt(1_000_000_000) + ".jpg";
                File out = new File(uploadDir, compressedName);

                // 压缩为 800px 以内、JPG 质量 0.8（对应原版 sharp resize + jpeg 80）
                Thumbnails.of(file.getInputStream())
                        .size(800, 800)
                        .outputFormat("jpg")
                        .outputQuality(0.8)
                        .toFile(out);

                urls.add(appConfig.imageBaseUrl() + "/uploads/" + compressedName);
            }
            return Result.ok("上传成功", urls);
        } catch (Exception e) {
            return Result.error(500, e.getMessage() == null ? "上传失败" : e.getMessage());
        }
    }

    /** 访问上传的图片（防止路径穿越，仅允许 uploads 目录内的文件） */
    @GetMapping("/uploads/{filename}")
    public ResponseEntity<byte[]> serveImage(@PathVariable String filename) {
        try {
            Path dir = Paths.get(appConfig.uploadDirAbsolute()).toAbsolutePath().normalize();
            Path file = dir.resolve(filename).normalize();
            if (!file.startsWith(dir) || !Files.exists(file)) {
                return ResponseEntity.notFound().build();
            }
            byte[] data = Files.readAllBytes(file);
            // 按文件实际内容判断类型（老图片存在"扩展名是png但内容是jpeg"的历史情况）
            boolean isPng = data.length > 4
                    && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G';
            MediaType mediaType = isPng ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
            return ResponseEntity.ok().contentType(mediaType).body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
