package com.example.e2ee.encryption.DemoEncryption;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RecoveryKeyRepository extends JpaRepository<RecoveryKey, Long> {
    Optional<RecoveryKey> findByUserIdAndOrgId(Long userId, Long orgId);
}
