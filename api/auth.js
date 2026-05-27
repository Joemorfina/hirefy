export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { action, email, password } = req.body;

  if (action === 'signup') {
    const resp = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: data.msg || data.error_description || 'Erro ao cadastrar' });
    return res.status(200).json({ user: data.user, access_token: data.access_token });
  }

  if (action === 'login') {
    const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: data.error_description || 'Email ou senha incorretos' });
    return res.status(200).json({ user: data.user, access_token: data.access_token });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
