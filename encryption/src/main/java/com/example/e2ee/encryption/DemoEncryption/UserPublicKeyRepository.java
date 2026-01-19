package com.example.e2ee.encryption.DemoEncryption;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserPublicKeyRepository extends JpaRepository<UserPublicKey, Long> {
    Optional<UserPublicKey> findByUserIdAndOrgId(Long userId, Long orgId);
}