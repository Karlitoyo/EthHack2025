export default async (req, res) => {
    const resp = await fetch(`${process.env.BACKEND_URL}/zk-snark/generate-proof`, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body)
    });
    res.status(resp.status).send(await resp.text());
  };