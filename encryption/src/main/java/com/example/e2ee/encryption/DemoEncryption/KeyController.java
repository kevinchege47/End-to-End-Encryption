package com.example.e2ee.encryption.DemoEncryption;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/keys")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class KeyController {

    private final UserPublicKeyRepository repo;

    @PostMapping("/register")
    public ResponseEntity<String> register(
            @RequestParam Long userId,
            @RequestParam Long orgId,
            @RequestParam String pub) {

        UserPublicKey key = new UserPublicKey();
        key.setUserId(userId);
        key.setOrgId(orgId);
        key.setPublicKeyPem(pub.trim());

        repo.save(key);
        return ResponseEntity.ok("Public key registered for user " + userId + " in org " + orgId);
    }
}