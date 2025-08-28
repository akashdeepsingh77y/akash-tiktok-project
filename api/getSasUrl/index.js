const { generateBlobSASQueryParameters, BlobSASPermissions, getSharedKeyCredential, getContainerName, sanitizeBlobName } = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const filename = (req.query.filename || (req.body && req.body.filename) || "video.mp4").toString();
    const contentType = (req.query.contentType || (req.body && req.body.contentType) || "video/mp4").toString();

    const { accountName, credential } = getSharedKeyCredential();
    const containerName = getContainerName();
    const blobName = `${Date.now()}_${sanitizeBlobName(filename)}`;

    // Write SAS (for upload)
    const writePerms = BlobSASPermissions.parse("cw"); // create + write
    const writeSas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: writePerms,
      startsOn: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes clock skew
      expiresOn: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    }, credential).toString();

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}?${writeSas}`;

    // Read SAS for later/preview
    const readPerms = BlobSASPermissions.parse("r");
    const readSas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: readPerms,
      startsOn: new Date(Date.now() - 2 * 60 * 1000),
      expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }, credential).toString();

    const readUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}?${readSas}`;

    context.res = {
      headers: { "Content-Type": "application/json" },
      body: { uploadUrl, blobName, previewUrl: readUrl, contentType }
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
