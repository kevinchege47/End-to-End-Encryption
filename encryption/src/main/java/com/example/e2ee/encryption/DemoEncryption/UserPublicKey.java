package com.example.e2ee.encryption.DemoEncryption;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserPublicKey {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long orgId;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String publicKeyPem;

    private LocalDateTime registeredAt = LocalDateTime.now();
}