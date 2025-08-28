const { getServiceClient, getContainerName } = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const { blobName, rating } = req.body || {};
    if (!blobName) throw new Error("blobName is required");

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) throw new Error("rating must be 1..5");

    const service = getServiceClient();
    const container = service.getContainerClient(getContainerName());
    await container.createIfNotExists();

    const metaName = `__meta/${blobName}.json`;
    const metaBlob = container.getBlockBlobClient(metaName);

    let meta = { comments: [], ratings: { sum: 0, count: 0 } };
    if (await metaBlob.exists()) {
      const buf = await container.getBlobClient(metaName).downloadToBuffer();
      meta = JSON.parse(buf.toString() || "{}") || meta;
      meta.comments = meta.comments || [];
      meta.ratings = meta.ratings || { sum: 0, count: 0 };
    }

    meta.ratings.sum += r;
    meta.ratings.count += 1;

    const data = Buffer.from(JSON.stringify(meta));
    await metaBlob.uploadData(data, { blobHTTPHeaders: { blobContentType: "application/json" }, overwrite: true });

    const avg = meta.ratings.sum / meta.ratings.count;
    context.res = { headers: { "Content-Type": "application/json" }, body: { ok: true, avg, count: meta.ratings.count } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: err.message } };
  }
};
