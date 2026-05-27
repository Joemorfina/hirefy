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

  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*&limit=1`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await resp.json();
    return res.status(200).json(Array.isArray(data) ? (data[0] || null) : null);
  }

  if (req.method === 'POST') {
    const { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil } = req.body;

    // Sempre faz PATCH (update) — se não existir, faz INSERT
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil })
      }
    );

    if (patchResp.ok) {
      // Verifica se atualizou algo
      const countResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=id`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const existing = await countResp.json();

      if (!Array.isArray(existing) || existing.length === 0) {
        // Não existia — faz INSERT
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
            body: JSON.stringify({ user_id: userId, nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil })
          }
        );
        if (!insertResp.ok) {
          const err = await insertResp.text();
          return res.status(500).json({ error: err });
        }
      }

      return res.status(200).json({ success: true });
    }

    const err = await patchResp.text();
    return res.status(500).json({ error: err });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
