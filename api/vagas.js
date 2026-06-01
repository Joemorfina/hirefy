export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Extrai e valida o token do usuário logado
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  // Valida o token e obtém o userId
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });

  const userData = await userResp.json();
  const userId = userData.id;

  // GET — buscar apenas as vagas do usuário logado
  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/vagas?user_id=eq.${userId}&select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}` // JWT do usuário → RLS aplicado
        }
      }
    );
    const data = await resp.json();
    return res.status(200).json(data);
  }

  // POST — salvar nova vaga vinculada ao usuário logado
  if (req.method === 'POST') {
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Body obrigatório' });

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/vagas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`, // JWT do usuário → RLS aplicado
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ ...body, user_id: userId }) // garante user_id gravado
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `Erro ao salvar vaga: ${err}` });
    }
    return res.status(200).json({ success: true });
  }

  // PATCH — atualizar status apenas de vaga do próprio usuário
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id e status obrigatórios' });

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/vagas?id=eq.${id}&user_id=eq.${userId}`, // filtra por dono
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`, // JWT do usuário → RLS aplicado
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status })
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `Erro ao atualizar: ${err}` });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
