export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  // Buscar usuário pelo token
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });
  const userData = await userResp.json();
  const userId = userData.id;

  // GET — buscar perfil
  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    const data = await resp.json();
    return res.status(200).json(Array.isArray(data) ? (data[0] || null) : null);
  }

  // POST — salvar perfil (insert ou update)
  if (req.method === 'POST') {
    const { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil } = req.body;

    // Verifica se já existe
    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    const existing = await checkResp.json();

    const payload = { user_id: userId, nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil };

    if (Array.isArray(existing) && existing.length > 0) {
      // UPDATE
      const upResp = await fetch(
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
      if (!upResp.ok) {
        const err = await upResp.text();
        return res.status(500).json({ error: err });
      }
    } else {
      // INSERT
      const inResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        }
      );
      if (!inResp.ok) {
        const err = await inResp.text();
        return res.status(500).json({ error: err });
      }
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
