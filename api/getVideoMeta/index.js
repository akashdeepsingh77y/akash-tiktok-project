const { getServiceClient, getContainerName } = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const blobName = (req.query.blobName || "").toString();
    if (!blobName) throw new Error("blobName is required");

    const service = getServiceClient();
    const container = service.getContainerClient(getContainerName());
    await container.createIfNotExists();

    const metaName = `__meta/${blobName}.json`;
    const metaBlob = container.getBlobClient(metaName);

    let meta = { comments: [], ratings: { sum: 0, count: 0 } };
    if (await metaBlob.exists()) {
      const buf = await metaBlob.downloadToBuffer();
      meta = JSON.parse(buf.toString() || "{}") || meta;
      meta.comments = meta.comments || [];
      meta.ratings = meta.ratings || { sum: 0, count: 0 };
    }

    const avg = meta.ratings.count ? (meta.ratings.sum / meta.ratings.count) : 0;
    context.res = { headers: { "Content-Type": "application/json" }, body: { ...meta, avg } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: err.message } };
  }
};
