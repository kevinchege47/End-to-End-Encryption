import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface FileMetadata {
  id: number;
  name: string;
  type: string;
}

/**
 * Main E2EE File Vault Component
 * - Full client-side encryption
 * - Passphrase-based recovery
 * - IndexedDB key storage
 * - Zero-knowledge: server never sees keys or plaintext
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  // --- USER & ORG IDENTIFIERS ---
  /** Fixed for demo. In production: get from auth */
  readonly userId = 1;
  readonly orgId = 1001;

  // --- RECOVERY & KEY STATE ---
  /** User-entered passphrase for encryption/recovery */
  passphrase = '';
  /** True when RSA keys are loaded and ready */
  keysLoaded = false;

  // --- FILE MANAGEMENT ---
  /** List of files from server (metadata only) */
  files: FileMetadata[] = [];
  /** File selected for upload */
  selectedFile: File | null = null;

  // --- CRYPTO KEYS ---
  /** Public key in PEM format (for wrapping AES keys) */
  publicKeyPem = '';
  /** RSA private key (non-extractable) */
  privateKey!: CryptoKey;

  /** IndexedDB database reference */
  private db!: IDBOpenDBRequest;

  /* ============================================================= */
  /* ====================== 1. CONSTRUCTOR ======================= */
  /* ============================================================= */
  constructor(private http: HttpClient) {
    // Open IndexedDB: 'E2EEVault' version 1
    this.db = indexedDB.open('E2EEVault', 1);

    // Create object store on first run
    this.db.onupgradeneeded = () => {
      this.db.result.createObjectStore('keys', { keyPath: 'id' });
    };

    // Start initialization once DB is ready
    this.db.onsuccess = () => this.init();
  }

  /* ============================================================= */
  /* ====================== 2. INITIALIZE ======================= */
  /* ============================================================= */
  /**
   * Initialize app: load keys from IndexedDB or show create/recover UI
   */
  private async init() {
    const tx = this.db.result.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get(this.userId);

    req.onsuccess = () => {
      if (req.result) {
        // Keys exist locally → load them
        this.publicKeyPem = req.result.publicKeyPem;
        this.privateKey = req.result.privateKey;
        this.keysLoaded = true;
        this.loadFiles();
      } else {
        // No local keys → show "Create or Recover" UI
        this.keysLoaded = false;
      }
    };
  }

  /* ============================================================= */
  /* =============== 3. FIRST-TIME SETUP (CREATE) =============== */
  /* ============================================================= */
  /**
   * Create new account: generate keys, encrypt private key with passphrase, save to server
   */
  async setupWithPassphrase() {
    if (!this.passphrase) return alert('Please enter a strong passphrase');

    // 1. Generate RSA key pair
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    // 2. Export keys
    const priv = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const pub = await crypto.subtle.exportKey('spki', pair.publicKey);
    this.publicKeyPem = this.toPem(pub, 'PUBLIC KEY');
    this.privateKey = pair.privateKey;

    // 3. Encrypt private key with passphrase
    const encryptedBase64 = await this.encryptPrivateKeyWithPassphrase(priv, this.passphrase);

    // 4. Clean & URL-encode base64
    const cleanBase64 = encryptedBase64.replace(/\s/g, '');
    const urlSafeBase64 = encodeURIComponent(cleanBase64);

    // 5. Save encrypted private key to server
    const saveRes = await fetch(
      `http://localhost:8080/api/recovery/save?userId=${this.userId}&orgId=${this.orgId}&encryptedKey=${urlSafeBase64}`,
      { method: 'POST' }
    );

    if (!saveRes.ok) {
      alert('Failed to save recovery key');
      return;
    }

    // 6. Save keys locally
    await this.saveKeysToIndexedDB();

    // 7. Register public key (for sharing)
    this.registerKey();

    // 8. Done
    this.keysLoaded = true;
    this.loadFiles();
  }

  /* ============================================================= */
  /* =================== 4. RECOVER ACCOUNT ===================== */
  /* ============================================================= */
  /**
   * Recover account on new device using passphrase
   */
  async recoverWithPassphrase() {
    if (!this.passphrase) return alert('Please enter your passphrase');

    // 1. Call recovery endpoint
    const res = await fetch(
      `http://localhost:8080/api/recovery/get?userId=${this.userId}&orgId=${this.orgId}`
    );

    if (!res.ok) {
      alert('No recovery data found. Create an account first.');
      return;
    }

    // 2. Parse JSON response → { wrappedKey: "base64..." }
    let json: { wrappedKey: string };
    try {
      json = await res.json();
    } catch {
      alert('Invalid response from server');
      return;
    }

    // 3. Clean base64
    const cleanBase64 = json.wrappedKey.replace(/\s/g, '');

    // 4. Decode to binary payload
    let payload: Uint8Array;
    try {
      payload = Uint8Array.from(atob(cleanBase64).split('').map(c => c.charCodeAt(0)));
    } catch {
      alert('Invalid base64 in recovery data');
      return;
    }

    // 5. Extract: salt (16), iv (12), encrypted private key (rest)
    const salt = payload.slice(0, 16);
    const iv = payload.slice(16, 28);
    const encryptedPriv = payload.slice(28);

    try {
      // 6. Derive AES key
      const aesKey = await this.deriveKeyFromPassphrase(this.passphrase, salt);

      // 7. Decrypt private key
      const priv = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encryptedPriv
      );

      // 8. Import private key
      this.privateKey = await crypto.subtle.importKey(
        'pkcs8',
        priv,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      );

      // 9. Generate new public key (for future uploads)
      const newPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );
      const pub = await crypto.subtle.exportKey('spki', newPair.publicKey);
      this.publicKeyPem = this.toPem(pub, 'PUBLIC KEY');

      // 10. Save to IndexedDB
      await this.saveKeysToIndexedDB();

      // 11. Register new public key
      this.registerKey();

      this.keysLoaded = true;
      this.loadFiles();
    } catch (err) {
      console.error('Recovery failed:', err);
      alert('Wrong passphrase or corrupted data');
    }
  }

  /* ============================================================= */
  /* ============ 5. ENCRYPT PRIVATE KEY WITH PASSPHRASE ========= */
  /* ============================================================= */
  /**
   * Encrypt private key using PBKDF2 + AES-GCM
   * @returns URL-safe base64 string
   */
  private async encryptPrivateKeyWithPassphrase(
    priv: ArrayBuffer,
    passphrase: string
  ): Promise<string> {
    const encoder = new TextEncoder();

    // 1. Import passphrase as PBKDF2 base key
    const passKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // 2. Generate random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 3. Derive AES-GCM key
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // 4. Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 5. Encrypt private key
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      priv
    );

    // 6. Combine: salt + iv + ciphertext
    const payload = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
    payload.set(salt, 0);
    payload.set(iv, salt.byteLength);
    payload.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);

    // 7. Return clean base64
    return btoa(String.fromCharCode(...payload));
  }

  /* ============================================================= */
  /* =============== 6. DERIVE KEY FROM PASSPHRASE ============== */
  /* ============================================================= */
  /**
   * Derive AES-GCM key from passphrase + salt
   */
  private async deriveKeyFromPassphrase(
    passphrase: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  /* ============================================================= */
  /* =================== 7. SAVE KEYS TO DB ===================== */
  /* ============================================================= */
  private async saveKeysToIndexedDB() {
    const tx = this.db.result.transaction('keys', 'readwrite');
    tx.objectStore('keys').put({
      id: this.userId,
      publicKeyPem: this.publicKeyPem,
      privateKey: this.privateKey
    });
    await this.awaitTransaction(tx);
  }

  /* ============================================================= */
  /* ====================== 8. UPLOAD FILE ====================== */
  /* ============================================================= */
  async upload() {
    if (!this.selectedFile) return;
    const file = this.selectedFile;

    // 1. Generate random AES key
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );

    // 2. Encrypt file
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await file.arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      data
    );
    const rawAes = await crypto.subtle.exportKey('raw', aesKey);

    // 3. Wrap AES key with public key
    const pubKey = await crypto.subtle.importKey(
      'spki',
      this.pemToBuf(this.publicKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const wrappedKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      pubKey,
      rawAes
    );

    // 4. Build payload
    const payload = {
      wrappedKey: Array.from(new Uint8Array(wrappedKey)),
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
      name: file.name,
      type: file.type || 'application/octet-stream'
    };

    // 5. Upload
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const form = new FormData();
    form.append('pkg', blob, 'pkg.json');

    this.http
      .post(
        `http://localhost:8080/api/files/upload?userId=${this.userId}&orgId=${this.orgId}`,
        form
      )
      .subscribe(() => {
        this.selectedFile = null;
        this.loadFiles();
      });
  }

  /* ============================================================= */
  /* ===================== 9. DOWNLOAD FILE ===================== */
  /* ============================================================= */
  async download(id: number) {
    const pkg = await fetch(
      `http://localhost:8080/api/files/download/${id}?orgId=${this.orgId}`
    ).then(r => r.json());

    // 1. Unwrap AES key
    const rawAes = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      this.privateKey,
      Uint8Array.from(pkg.wrappedKey)
    );

    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 2. Decrypt file
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(pkg.iv) },
      aesKey,
      Uint8Array.from(pkg.ciphertext)
    );

    // 3. Download
    const blob = new Blob([plain], { type: pkg.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pkg.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ============================================================= */
  /* =================== 10. HELPER API CALLS =================== */
  /* ============================================================= */
  public loadFiles() {
    this.http
      .get<FileMetadata[]>(
        `http://localhost:8080/api/files/list?orgId=${this.orgId}`
      )
      .subscribe(data => (this.files = data));
  }

  private registerKey() {
    this.http
      .post(
        `http://localhost:8080/api/keys/register?userId=${this.userId}&orgId=${this.orgId}&pub=${encodeURIComponent(this.publicKeyPem)}`,
        {}
      )
      .subscribe();
  }

  /* ============================================================= */
  /* ===================== 11. UI HANDLERS ===================== */
  /* ============================================================= */
  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  /* ============================================================= */
  /* ===================== 12. PEM UTILS ======================== */
  /* ============================================================= */
  private toPem(buf: ArrayBuffer, label: string): string {
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END ${label}-----`;
  }

  private pemToBuf(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '');
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }

  /* ============================================================= */
  /* =============== 13. INDEXEDDB TRANSACTION ================ */
  /* ============================================================= */
  private awaitTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    });
  }
}
