package com.example.e2ee.encryption.DemoEncryption;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EncryptedFileRepository extends JpaRepository<EncryptedFile, Long> {
    List<EncryptedFile> findByOrgId(Long orgId);
    Optional<EncryptedFile> findByIdAndOrgId(Long id, Long orgId);
}
