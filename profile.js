export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  // Buscar usuário pelo token
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
  });
  const userData = await userResp.json();
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });
  const userId = userData.id;

  if (req.method === 'GET') {
    const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    return res.status(200).json(data[0] || null);
  }

  if (req.method === 'POST') {
    const { nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil } = req.body;

    // Upsert — cria ou atualiza
    const resp = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ user_id: userId, nome, cargo_atual, area, preferencia_modelo, ingles, resumo_perfil })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
