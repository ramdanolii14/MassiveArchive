# MassiveArchive

MassiveArchive is a secure, local-first file archiving system that provides end-to-end encryption for local data storage. Built using Node.js, Express.js, and React.js, the application handles file serialization and cryptographic processing entirely on the user's local environment, preventing unauthorized data access.

## Core Architecture
- **Cryptographic Processing:** Utilizes AES-256 via Crypto.js.
- **File System Management:** Appends `.arsip` extension to the encrypted payload.
- **Local State Tracking:** Records file metadata inside a dedicated local database.

## Key Features
- **Local End-to-End Encryption:** Encrypts data on-premise using a 256-bit key structure.
- **Custom Payload Packaging:** Packages processed binaries into `.arsip` archives.
- **Localized Database Mapping:** Syncs disk storage with a local database schema.
- **Decryption Pipeline:** Reverses the AES-256 routine via user-supplied keys.

## Technology Stack
- Frontend: React.js
- Backend: Node.js, Express.js
- Cryptography: Crypto.js

## Installation

1. Clone repository locally.
2. Install dependencies:
   npm install
3. Run the application:
   npm start run
