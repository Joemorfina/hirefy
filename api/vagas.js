export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // GET — buscar vagas
  if (req.method === 'GET') {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/vagas?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    const data = await resp.json();
    return res.status(200).json(data);
  }

  // PATCH — atualizar status
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id e status obrigatórios' });

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/vagas?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status })
      }
    );

    if (!resp.ok) return res.status(500).json({ error: 'Erro ao atualizar' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
