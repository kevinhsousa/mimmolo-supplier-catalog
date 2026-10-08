export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GH_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GH_TOKEN not configured on server' });
  }

  try {
    const { responses, supplierInfo } = req.body || {};
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: responses required' });
    }

    const repoUrl = 'https://api.github.com/repos/kevinhsousa/mimmolo-supplier-catalog/contents/supplier_responses.json';
    
    // 1. Get current SHA if file exists
    let currentSha = null;
    try {
      const getRes = await fetch(repoUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Mimmolo-Catalog-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        currentSha = getData.sha;
      }
    } catch (e) {
      console.warn('Could not fetch existing file SHA:', e.message);
    }

    // 2. Prepare payload
    const nowIso = new Date().toISOString();
    const filePayload = {
      lastUpdated: nowIso,
      supplierInfo: supplierInfo || {},
      totalItemsQuoted: Object.keys(responses).length,
      responses: responses
    };

    const contentBase64 = Buffer.from(JSON.stringify(filePayload, null, 2), 'utf-8').toString('base64');
    const commitMessage = `Supplier quotation update: ${nowIso.substring(0, 19).replace('T', ' ')}`;

    const putBody = {
      message: commitMessage,
      content: contentBase64,
      branch: 'main'
    };
    if (currentSha) {
      putBody.sha = currentSha;
    }

    // 3. Commit to GitHub
    const putRes = await fetch(repoUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Mimmolo-Catalog-App',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return res.status(putRes.status).json({ error: 'GitHub commit error', details: errText });
    }

    const putData = await putRes.json();
    return res.status(200).json({
      success: true,
      lastUpdated: nowIso,
      commitSha: putData.commit?.sha,
      message: 'Quotation saved and updated successfully!'
    });
  } catch (error) {
    console.error('Error in /api/save:', error);
    return res.status(500).json({ error: error.message });
  }
}
