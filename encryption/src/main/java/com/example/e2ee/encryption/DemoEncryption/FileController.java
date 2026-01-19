package com.example.e2ee.encryption.DemoEncryption;

import com.google.gson.*;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class FileController {

    private final EncryptedFileRepository repo;
    private final Gson gson = new Gson();

    @PostMapping("/upload")
    public ResponseEntity<String> upload(
            @RequestParam Long userId,
            @RequestParam Long orgId,
            @RequestParam("pkg") MultipartFile file) throws IOException {

        String json = new String(file.getBytes());
        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();

        EncryptedFile ef = new EncryptedFile();
        ef.setUserId(userId);
        ef.setOrgId(orgId);
        ef.setName(obj.get("name").getAsString());
        ef.setType(obj.get("type").getAsString());
        ef.setWrappedKey(toBytes(obj.getAsJsonArray("wrappedKey")));
        ef.setIv(toBytes(obj.getAsJsonArray("iv")));
        ef.setCiphertext(toBytes(obj.getAsJsonArray("ciphertext")));

        EncryptedFile saved = repo.save(ef);
        return ResponseEntity.ok("Uploaded. ID: " + saved.getId());
    }

    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam Long orgId) {
        List<Map<String, Object>> list = repo.findByOrgId(orgId).stream()
                .map(f -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", f.getId());
                    map.put("name", f.getName());
                    map.put("type", f.getType());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<String> download(
            @PathVariable Long id,
            @RequestParam Long orgId) {

        EncryptedFile f = repo.findByIdAndOrgId(id, orgId)
                .orElseThrow(() -> new RuntimeException("File not found or access denied"));

        JsonObject res = new JsonObject();
        res.add("wrappedKey", toJsonArray(f.getWrappedKey()));
        res.add("iv", toJsonArray(f.getIv()));
        res.add("ciphertext", toJsonArray(f.getCiphertext()));
        res.addProperty("name", f.getName());
        res.addProperty("type", f.getType());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(gson.toJson(res));
    }

    // --- FIXED: Explicit import + correct usage ---
    private byte[] toBytes(JsonArray arr) {
        byte[] b = new byte[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            b[i] = (byte) arr.get(i).getAsInt();
        }
        return b;
    }

    private JsonArray toJsonArray(byte[] bytes) {
        JsonArray arr = new JsonArray();
        for (byte b : bytes) {
            arr.add(b & 0xFF);
        }
        return arr;
    }
}