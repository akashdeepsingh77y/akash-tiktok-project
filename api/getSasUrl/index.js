const {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  getSharedKeyCredential,
  getServiceClient,
  getContainerName,
  sanitizeBlobName
} = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const filename = (req.query.filename || (req.body && req.body.filename) || "video.mp4").toString();
    const contentType = (req.query.contentType || (req.body && req.body.contentType) || "video/mp4").toString();

    const { accountName, credential } = getSharedKeyCredential();
    const containerName = getContainerName();
    const blobName = `${Date.now()}_${sanitizeBlobName(filename)}`;

    // Ensure the container exists (creates it if missing)
    const service = getServiceClient();
    const container = service.getContainerClient(containerName);
    await container.createIfNotExists();

    // SAS for upload (create + write)
    const writeSas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("cw"),
        startsOn: new Date(Date.now() - 2 * 60 * 1000),
        expiresOn: new Date(Date.now() + 60 * 60 * 1000)
      },
      credential
    ).toString();

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(
      blobName
    )}?${writeSas}`;

    // SAS for preview (read)
    const readSas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(Date.now() - 2 * 60 * 1000),
        expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      credential
    ).toString();

    const previewUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(
      blobName
    )}?${readSas}`;

    context.res = {
      headers: { "Content-Type": "application/json" },
      body: { uploadUrl, blobName, previewUrl, contentType }
    };
  } catch (err) {
    context.log.error(err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: err.message || "Failed to generate SAS" }
    };
  }
};
