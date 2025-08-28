const { getSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, getServiceClient, getContainerName } = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const { accountName, credential } = getSharedKeyCredential();
    const service = getServiceClient();
    const containerName = getContainerName();
    const container = service.getContainerClient(containerName);

    const videos = [];
    for await (const blob of container.listBlobsFlat()) {
      // Only include common video types
      const isVideo = /\.(mp4|webm|mov|mkv|m4v)$/i.test(blob.name);
      if (!isVideo) continue;

      const readPerms = BlobSASPermissions.parse("r");
      const sas = generateBlobSASQueryParameters({
        containerName,
        blobName: blob.name,
        permissions: readPerms,
        startsOn: new Date(Date.now() - 2*60*1000),
        expiresOn: new Date(Date.now() + 24*60*60*1000)
      }, credential).toString();

      const url = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blob.name)}?${sas}`;
      videos.push({ name: blob.name, url, size: blob.properties.contentLength || 0, lastModified: blob.properties.lastModified || null });
    }

    // Sort by lastModified desc (fallback to name)
    videos.sort((a,b) => (new Date(b.lastModified||0) - new Date(a.lastModified||0)) || b.name.localeCompare(a.name));

    context.res = { headers: { "Content-Type": "application/json" }, body: { videos } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: err.message || "Failed to list videos" } };
  }
};
