export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobText } = req.body;
  if (!jobText) return res.status(400).json({ error: 'jobText is required' });

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  // ── 1. Extrai e valida o token do usuário logado ───────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Token inválido' });

  const userData = await userResp.json();
  const userId = userData.id;

  // ── 2. Busca o perfil do usuário logado no Supabase ───────────────────────
  let perfilTexto = 'Profissional em busca de recolocação.'; // fallback genérico

  try {
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (profileResp.ok) {
      const profileData = await profileResp.json();
      const p = Array.isArray(profileData) ? profileData[0] : null;
      if (p) {
        // Monta o contexto dinamicamente com os campos salvos
        const partes = [];
        if (p.nome)               partes.push(p.nome);
        if (p.cargo_atual)        partes.push(`Cargo: ${p.cargo_atual}`);
        if (p.area)               partes.push(`Área: ${p.area}`);
        if (p.preferencia_modelo) partes.push(`Preferência de modelo: ${p.preferencia_modelo}`);
        if (p.ingles)             partes.push(`Inglês: ${p.ingles}`);
        if (p.resumo_perfil)      partes.push(p.resumo_perfil);
        if (partes.length > 0) perfilTexto = partes.join(' | ');
      }
    }
  } catch (e) {
    // Se falhar ao buscar perfil, segue com o fallback — não bloqueia a análise
    console.error('[analyze] Erro ao buscar perfil:', e.message);
  }

  const prompt = `Você é um assistente especialista em carreira e candidaturas. Analise a vaga abaixo com base no perfil do candidato e retorne uma análise completa em português brasileiro.

PERFIL DO CANDIDATO:
${perfilTexto}

VAGA:
${jobText}

Retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON:

{
  "resumo": "resumo em 1 linha do que é a vaga de verdade",
  "check": {
    "oque": "o que é de verdade",
    "exige": "vai exigir o quê no dia a dia",
    "vale": "vale a pena pelo pacote"
  },
  "levantamento": {
    "cargo": "",
    "empresa": "",
    "local": "",
    "modelo": "",
    "salario": "",
    "horario": "",
    "beneficios": "",
    "keywords": []
  },
  "placar": {
    "tecnica": 0,
    "comportamental": 0,
    "custobeneficio": 0,
    "esforco": 0,
    "estrategico": 0,
    "internacional": 0
  },
  "pros": [],
  "contras": [],
  "riscos": [],
  "estrategia": "",
  "veredito": "APLICA AGORA ou APLICA COM RESSALVAS ou NAO E PRA VOCE ou SO APLICA SE SALARIO COMPENSAR",
  "respostas": {
    "apresentacao": "",
    "pretensao": "",
    "porquequer": ""
  }
}`;

  try {
    // 1. Chama o Groq
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const groqData = await groqResp.json();
    if (!groqResp.ok) return res.status(500).json({ error: groqData.error?.message || 'Groq API error' });

    const text = groqData.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({ raw: clean });
    }

    // 2. Salva no Supabase — só se as credenciais existirem
    if (supabaseUrl && supabaseKey) {
      const l = parsed.levantamento || {};

      await fetch(`${supabaseUrl}/rest/v1/vagas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`, // JWT do usuário → RLS aplicado
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,          // vincula a vaga ao usuário logado
          cargo: l.cargo || '',
          empresa: l.empresa || '',
          local: l.local || '',
          modelo: l.modelo || '',
          salario: l.salario || '',
          veredito: parsed.veredito || '',
          status: 'SALVA',
          resumo: parsed.resumo || '',
          estrategia: parsed.estrategia || '',
          pros: parsed.pros || [],
          contras: parsed.contras || [],
          riscos: parsed.riscos || [],
          placar: parsed.placar || {},
          respostas: parsed.respostas || {},
          keywords: l.keywords || [],
          texto_vaga: jobText
        })
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
