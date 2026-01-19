package com.example.e2ee.encryption.DemoEncryption;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
public class RecoveryKey {
    @Id
    @GeneratedValue
    private Long id;
    private Long userId;
    private Long orgId;

    @Lob
    @Column(columnDefinition = "BYTEA")
    private byte[] encryptedPrivateKey;

    private LocalDateTime createdAt = LocalDateTime.now();
}
