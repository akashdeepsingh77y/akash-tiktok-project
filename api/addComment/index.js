const { getServiceClient, getContainerName } = require("../shared/storage");

module.exports = async function (context, req) {
  try {
    const { blobName, author, text } = req.body || {};
    if (!blobName) throw new Error("blobName is required");
    if (!text || !text.toString().trim()) throw new Error("text is required");

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

    meta.comments.push({
      id: Date.now().toString(),
      author: (author && author.toString().slice(0, 50)) || "Anonymous",
      text: text.toString().slice(0, 1000),
      ts: new Date().toISOString()
    });

    const data = Buffer.from(JSON.stringify(meta));
    await metaBlob.uploadData(data, { blobHTTPHeaders: { blobContentType: "application/json" }, overwrite: true });

    const avg = meta.ratings.count ? (meta.ratings.sum / meta.ratings.count) : 0;
    context.res = { headers: { "Content-Type": "application/json" }, body: { ok: true, comments: meta.comments, avg, count: meta.ratings.count } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: err.message } };
  }
};
