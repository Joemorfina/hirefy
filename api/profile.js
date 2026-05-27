export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });
  const userData = await userResp.json();
  const userId = userData.id;

  // GET — buscar perfil
  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*&limit=1`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await resp.json();
    return res.status(200).json(Array.isArray(data) ? (data[0] || null) : null);
  }

  // POST — salvar perfil
  if (req.method === 'POST') {
    const { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil } = req.body;
    const payload = { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil };

    // Tenta UPDATE primeiro
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!patchResp.ok) {
      const err = await patchResp.text();
      return res.status(500).json({ error: `PATCH failed: ${err}` });
    }

    const patchData = await patchResp.json();

    // Se atualizou algo, retorna sucesso
    if (Array.isArray(patchData) && patchData.length > 0) {
      return res.status(200).json({ success: true });
    }

    // Se não existia, faz INSERT
    const insertResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ user_id: userId, ...payload })
      }
    );

    if (!insertResp.ok) {
      const err = await insertResp.text();
      return res.status(500).json({ error: `INSERT failed: ${err}` });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
