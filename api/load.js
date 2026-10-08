export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GH_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GH_TOKEN not configured on server' });
  }

  try {
    const url = 'https://api.github.com/repos/kevinhsousa/mimmolo-supplier-catalog/contents/supplier_responses.json';
    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Mimmolo-Catalog-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (ghRes.status === 404) {
      return res.status(200).json({ exists: false, responses: {} });
    }

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return res.status(ghRes.status).json({ error: 'GitHub API error', details: errText });
    }

    const data = await ghRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const parsed = JSON.parse(content);

    return res.status(200).json({
      exists: true,
      sha: data.sha,
      lastUpdated: parsed.lastUpdated || null,
      supplierInfo: parsed.supplierInfo || {},
      responses: parsed.responses || {}
    });
  } catch (error) {
    console.error('Error in /api/load:', error);
    return res.status(500).json({ error: error.message });
  }
}
