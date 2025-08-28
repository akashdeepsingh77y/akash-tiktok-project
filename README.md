# Akash TikTok Project

A scalable, assignment-ready mini web app to upload and watch short videos.
- **Frontend:** static HTML/CSS/JS (modern UI, drag & drop upload, progress, searchable gallery)
- **Backend:** Azure Functions (Node.js) that issues **SAS** tokens and lists blobs
- **Storage:** Azure Blob Storage container (e.g., `videos`)

The frontend here is **very different** from earlier BASIT guide (new layout, design, interactions) but meets the *same* project requirements.

## 1) Project structure

```
akash-tiktok-project/
├─ web/                 # Static site (deploys to Azure Static Web Apps)
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
└─ api/                 # Azure Functions (SWA will deploy as API)
   ├─ getSasUrl/
   │  ├─ function.json
   │  └─ index.js
   ├─ listVideos/
   │  ├─ function.json
   │  └─ index.js
   ├─ shared/storage.js
   ├─ host.json
   ├─ local.settings.json   # for local dev only; replace placeholders
   └─ package.json
```

## 2) Azure prerequisites

1. **Create Azure Storage Account**
   - Services → Storage Accounts → *Create*
   - Performance: Standard. Redundancy: LRS is fine.
   - After creation: **Containers** → *+ Container* → name: `videos` (Private access is fine).

2. **Get the connection string**
   - Storage Account → **Access keys** → Show keys → copy **Connection string**.

3. **CORS for Blob (important for browser uploads)**
   - Storage Account → **Resource sharing (CORS)** → **Blob service**
   - Add allowed origin: your Static Web App URL (e.g., `https://<your-swa>.azurestaticapps.net`)
   - Allowed methods: `GET, PUT, HEAD, OPTIONS`
   - Allowed headers: `*` (for quick setup)
   - Exposed headers: `*`
   - Max age: `3600`

## 3) Deploy with Azure Static Web Apps (GitHub workflow)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Akash TikTok Project - initial"
   git branch -M main
   git remote add origin https://github.com/<your-username>/akash-tiktok-project.git
   git push -u origin main
   ```

2. **Create a Static Web App**
   - Azure Portal → Create resource → **Static Web App**
   - Deployment source: **GitHub**
   - Select your repo + branch (`main`).
   - Build details:
     - **App location:** `web`
     - **API location:** `api`
     - **Output location:** *(leave empty)*
   - Finish → This creates a GitHub Action to build and deploy.

3. **Configure API settings (Function App settings)**
   - In your Static Web App → **Environment variables** (for the API)
     - Add: `AZURE_STORAGE_CONNECTION_STRING` = *(paste the connection string)*
     - Add: `CONTAINER_NAME` = `videos`
   - Save → **Redeploy** (or wait for next commit).

> Tip: If you use a separate Azure Functions App, set the same settings under **Configuration**.

## 4) Test

- Open your SWA URL → Upload a short MP4/WEBM → watch it appear in the gallery.
- Use **Search** to filter by filename. **Copy link** to share the SAS URL.
- If uploads fail, check:
  - CORS settings on the storage account
  - `AZURE_STORAGE_CONNECTION_STRING`/`CONTAINER_NAME` values
  - Functions logs in Azure or the GitHub Actions build log

## 5) Local development (optional)

- Install Azure Functions Core Tools + Node 18.
- In one terminal:
  ```bash
  cd api
  npm install
  func start
  ```
- In another terminal, serve `web/` with any static server (e.g., VS Code Live Server).
- Update `local.settings.json` with your connection string (do **not** commit secrets).
- 

---

**License:** MIT
