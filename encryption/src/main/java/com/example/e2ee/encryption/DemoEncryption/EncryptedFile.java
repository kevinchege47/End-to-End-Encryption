package com.example.e2ee.encryption.DemoEncryption;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EncryptedFile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long orgId;
    private String name;
    private String type;

    @Lob
    @Column(columnDefinition = "BYTEA")
    private byte[] wrappedKey;

    @Lob
    @Column(columnDefinition = "BYTEA")
    private byte[] iv;

    @Lob
    @Column(columnDefinition = "BYTEA")
    private byte[] ciphertext;

    private LocalDateTime uploadedAt = LocalDateTime.now();
    // In EncryptedFile.java
    @ElementCollection
    private Map<Long, byte[]> wrappedKeys = new HashMap<>();  // userId → wrapped AES key

    private Set<Long> accessibleBy = new HashSet<>();  // All userIds who can open
}