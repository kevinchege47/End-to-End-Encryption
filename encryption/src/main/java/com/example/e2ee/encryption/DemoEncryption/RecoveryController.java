package com.example.e2ee.encryption.DemoEncryption;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/recovery")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class RecoveryController {

    private final RecoveryKeyRepository repo;

    @PostMapping("/save")
    public ResponseEntity<String> save(
            @RequestParam Long userId,
            @RequestParam Long orgId,
            @RequestParam("encryptedKey") String base64EncryptedKey) {

        RecoveryKey rk = new RecoveryKey();
        rk.setUserId(userId);
        rk.setOrgId(orgId);
        rk.setEncryptedPrivateKey(Base64.getDecoder().decode(base64EncryptedKey));
        repo.save(rk);
        return ResponseEntity.ok("Saved");
    }

    @GetMapping("/get")
    public ResponseEntity<Map<String, String>> get(
            @RequestParam Long userId,
            @RequestParam Long orgId) {

        RecoveryKey rk = repo.findByUserIdAndOrgId(userId, orgId)
                .orElseThrow(() -> new RuntimeException("No recovery key"));

        String base64 = Base64.getEncoder().encodeToString(rk.getEncryptedPrivateKey());

        Map<String, String> response = new HashMap<>();
        response.put("wrappedKey", base64);

        return ResponseEntity.ok(response);
    }
}