const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require("@azure/storage-blob");

function parseConnectionString(connStr) {
  const map = {};
  for (const part of connStr.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) map[k.trim()] = v.trim();
  }
  if (!map.AccountName || !map.AccountKey) {
    throw new Error("Invalid storage connection string; AccountName/AccountKey missing.");
  }
  return { accountName: map.AccountName, accountKey: map.AccountKey };
}

function getSharedKeyCredential() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_STORAGE_CONNECTION_STRING missing.");
  const { accountName, accountKey } = parseConnectionString(conn);
  return { accountName, credential: new StorageSharedKeyCredential(accountName, accountKey) };
}

// 🔒 Hardcode the container we use. No env var needed.
function getContainerName() {
  return "videos";
}

function getServiceClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_STORAGE_CONNECTION_STRING missing.");
  return BlobServiceClient.fromConnectionString(conn);
}

function sanitizeBlobName(name) {
  return name.replace(/[?#<>:"\\\/|*]/g, "_").replace(/\s+/g, "_");
}

module.exports = {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  getSharedKeyCredential,
  getServiceClient,
  getContainerName,
  sanitizeBlobName
};
