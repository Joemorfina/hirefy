export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Pega o token do usuário logado
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  // Valida o token e pega o userId
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });

  const userData = await userResp.json();
  const userId = userData.id;

  // ─── GET: buscar perfil ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}` // token do usuário, não a anon key
        }
      }
    );
    const data = await resp.json();
    return res.status(200).json(Array.isArray(data) ? (data[0] || null) : null);
  }

  // ─── POST: salvar perfil (upsert manual) ─────────────────────────────────
  if (req.method === 'POST') {
    const { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil } = req.body;
    const payload = { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil };

    // PASSO 1: verificar se já existe um perfil para esse user_id
    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}` // token do usuário
        }
      }
    );

    if (!checkResp.ok) {
      const err = await checkResp.text();
      return res.status(500).json({ error: `Erro ao verificar perfil: ${err}` });
    }

    const checkData = await checkResp.json();
    const profileExists = Array.isArray(checkData) && checkData.length > 0;

    // DEBUG — aparece no log do Vercel
    console.log('[profile] userId:', userId);
    console.log('[profile] checkData:', JSON.stringify(checkData));
    console.log('[profile] profileExists:', profileExists);

    if (profileExists) {
      // PASSO 2a: perfil existe → faz PATCH (update)
      const patchResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`, // token do usuário
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!patchResp.ok) {
        const err = await patchResp.text();
        return res.status(500).json({ error: `Erro ao atualizar perfil: ${err}` });
      }

      return res.status(200).json({ success: true, action: 'updated' });

    } else {
      // PASSO 2b: perfil não existe → faz INSERT
      console.log("[profile] Caiu no INSERT — userId:", userId, "payload:", JSON.stringify(payload));
      const insertResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`, // token do usuário
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ user_id: userId, ...payload })
        }
      );

      if (!insertResp.ok) {
        const err = await insertResp.text();
        return res.status(500).json({ error: `Erro ao criar perfil: ${err}` });
      }

      return res.status(200).json({ success: true, action: 'created' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
