# MassiveArchive

MassiveArchive is a secure, local-first file archiving system that provides end-to-end encryption for local data storage. Built using Node.js, Express.js, and React.js, the application handles file serialization and cryptographic processing entirely on the user's local environment, preventing unauthorized data access. It's may not be the fastest archive, but it is safe.  

Please Report to [My Email](mailto:developer@nyanpixel.my.id) Or Go To The Issues Tab And Open It, If You Encounter Any Kind Bug.

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

**1. Clone the repository**
```bash
git clone https://github.com/ramdanolii14/MassiveArchive.git
cd MassiveArchive
```
**2. Install dependencies**
```bash
npm install
```
**3. Setup your .env**
```bash
#make sure to create your .env file
#in to the same directory with server.js
SERVER_KEY=your_strong_password_here #this is like master key, so don't forget this key at all. I'm serious
PORT=3001
```
**4. Run the application**
```bash
npm start run
```
---  
Peluk Keamanan xD  

![Ssnappy1 Mahiru Shiina Cosplay](./imgforreadme/ssnappy1-mahiru-shiina.jpg)


---
