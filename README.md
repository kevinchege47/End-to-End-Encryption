# Secure File Transfer

A demo secure file transfer system with **client-side end-to-end encryption**.
The project is split into two parts:

- `secure-file-transfer/` — Angular frontend
- `encryption/` — Spring Boot backend

The browser generates and keeps the private key locally, encrypts files before upload, and only sends encrypted payloads to the server.

## Highlights

- End-to-end encrypted file uploads and downloads
- RSA-OAEP key wrapping for per-file AES keys
- AES-GCM encryption for file contents
- Passphrase-based recovery for private keys
- Public key registration and recovery endpoints
- H2 in-memory database for demo storage

## Technology Stack

- **Frontend:** Angular 20, TypeScript
- **Backend:** Spring Boot 3.5, Java 17, Spring Web, Spring Data JPA
- **Database:** H2 in-memory database
- **Crypto APIs:** Web Crypto API in the browser, Gson on the backend for JSON payloads

## Project Structure

```text
Secure File Transfer/
├── encryption/            # Spring Boot API and persistence layer
└── secure-file-transfer/   # Angular client
```

## How It Works

1. A user creates an account in the browser.
2. The frontend generates an RSA key pair.
3. The private key is encrypted with a passphrase and saved for recovery.
4. The public key is registered with the backend.
5. Files are encrypted in the browser with a random AES-GCM key.
6. The AES key is wrapped with the user's public RSA key.
7. Only encrypted file data is uploaded to the backend.
8. On download, the browser fetches the encrypted package, unwraps the AES key, and decrypts the file locally.

## Prerequisites

- Java 17
- Maven Wrapper or Maven
- Node.js and npm compatible with Angular 20

## Running the Backend

From the project root:

```bash
cd "encryption"
./mvnw spring-boot:run
```

The backend runs on:

- API: `http://localhost:8080`
- H2 console: `http://localhost:8080/h2-console`

Default H2 settings from `application.yaml`:

- JDBC URL: `jdbc:h2:mem:e2ee`
- Username: `sa`
- Password: `1234`

## Running the Frontend

From the project root:

```bash
cd "secure-file-transfer"
npm install
npm start
```

Then open:

- `http://localhost:4200/`

> The Angular app calls the backend at `http://localhost:8080`.

## Available Scripts

### Frontend (`secure-file-transfer/`)

```bash
npm start   # Run the Angular dev server
npm run build
npm test
```

### Backend (`encryption/`)

```bash
./mvnw spring-boot:run
./mvnw test
./mvnw package
```

## Main API Endpoints

### Recovery

- `POST /api/recovery/save`
  - Saves an encrypted private key for recovery
  - Query params: `userId`, `orgId`, `encryptedKey`

- `GET /api/recovery/get`
  - Retrieves the encrypted private key for recovery
  - Query params: `userId`, `orgId`

### Public Key Registration

- `POST /api/keys/register`
  - Registers a user's public key
  - Query params: `userId`, `orgId`, `pub`

### Files

- `POST /api/files/upload`
  - Stores an encrypted file package
  - Query params: `userId`, `orgId`
  - Form field: `pkg`

- `GET /api/files/list`
  - Returns file metadata for an organization
  - Query params: `orgId`

- `GET /api/files/download/{id}`
  - Returns the encrypted package for download
  - Query params: `orgId`

## Demo Notes

- The frontend currently uses fixed demo identifiers:
  - `userId = 1`
  - `orgId = 1001`
- The backend uses an in-memory H2 database, so data is cleared when the backend stops.
- Cross-origin requests are enabled for local development.
- File uploads are limited to 100 MB by the backend configuration.

## Development Tips

- If you change backend ports, update the hard-coded `http://localhost:8080` URLs in the Angular app.
- If you want persistence across restarts, replace H2 with a persistent database such as PostgreSQL or MySQL.
- For production use, add real authentication and authorization instead of the demo user/org IDs.

