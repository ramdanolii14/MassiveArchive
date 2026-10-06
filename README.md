# MassiveArchive

MassiveArchive is a secure, local-first file archiving system that provides end-to-end encryption for local data storage. Built using Node.js, Express.js, and React.js, the application handles file serialization and cryptographic processing entirely on the user's local environment, preventing unauthorized data access. It's may not be the fastest archive, but it is safe.  

Please Report to [My Email](mailto:developer@nyanpixel.my.id) Or Go To The Issues Tab And Open It, If You Encounter Any Kind Bug.

## Core Architecture
- **Cryptographic Processing:** Utilizes AES-256-GCM via Node.js built-in `crypto` module.
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
- Cryptography: Node.js `crypto` (AES-256-GCM)

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
#copy .env.example to .env (same directory as server.js)
SERVER_KEY=your_strong_password_here #master key, min. 8 chars. Don't lose it. I'm serious
PORT=3001
```
**4. Run the application**
```bash
npm start
```
---  
Peluk Keamanan xD  

![Ssnappy1 Mahiru Shiina Cosplay](./imgforreadme/ssnappy1-mahiru-shiina.jpg)


---

## Windows: jalankan otomatis dari flashdisk

Fitur ini membuat komputer Windows memantau drive USB dan menjalankan `npm start` otomatis ketika menemukan folder `MassiveArchive` yang memiliki file penanda `.massivearchive-usb`.

Jalankan sekali di komputer Windows dari folder `scripts`:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows-usb-autostart.ps1
```

Setelah pemasangan, folder project, `database/`, dan file `.env` tetap berada di flashdisk. Komputer hanya menyimpan watcher kecil di profil pengguna Windows.
